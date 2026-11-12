import assert from 'node:assert/strict';

export function recordBattleOpeningStatus(personId) {
    return `(() => {
        const api=BayeHdSpe,dialog=BayeHdDialog,flush=api.onLcdFlush,onReport=dialog.onEngineReport;
        const sample=window.__battleOpeningStatus={frames:[],report:null,image:null};
        const surface=(id)=>{
            const node=document.getElementById(id),r=node.getBoundingClientRect();
            return {visible:node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0,
                inViewport:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};
        };
        api.onLcdFlush=function(){
            const result=flush.apply(this,arguments);
            const s=baye.hd.spe(),d=s.display,e=d?.statusEffect;
            if(s.active!==1||s.id!==27||s.kind!==4||s.startFrm!==6||s.endFrm!==11||d?.frameValid!==true||
                d.generation!==s.generation||d.eventId!==s.eventId||!e?.valid||e.phase!==2||e.subjectPerson!==${personId})return result;
            if(sample.frames.at(-1)?.commitSeq===d.commitSeq)return result;
            const data=baye.data,ui=api.debugSnapshot(),p=data.g_GenPos[e.subjectIndex],person=data.g_Persons[e.subjectPerson];
            const hd=surface('hd-spe-canvas'),lcd=surface('lcd');
            sample.frames.push({generation:s.generation,eventId:s.eventId,commitSeq:d.commitSeq,frame:d.frameIndex,
                fight:baye.hd.fight(),status:{index:e.subjectIndex,person:e.subjectPerson,x:e.subjectX,y:e.subjectY,
                    before:e.beforeState,after:e.afterState,hp:e.afterHp,arms:e.afterArms,level:e.afterLevel,experience:e.afterExperience},
                actual:{token:Number(data.g_FgtParam.GenArray[e.subjectIndex]),x:Number(p.x),y:Number(p.y),state:Number(p.state),
                    hp:Number(p.hp),arms:Number(person.Arms),level:Number(person.Level),experience:Number(person.Experience),equip:Array.from(person.Equip,Number)},
                keys:__runtimeEngineInputs.length,input:!!BayeHdBattle.getInputTicket(),
                ui:{source:ui.source,presentation:ui.mobilePresentation,reason:ui.fallbackReason,projected:ui.projectedScene,
                    projectionFallback:ui.projectionFallbackReason,skip:ui.skipVisible,title:document.getElementById('hd-spe-title').textContent},
                hd,lcd});
            if(d.frameIndex===11&&(hd.visible||lcd.visible)){
                const id=hd.visible?'hd-spe-canvas':'lcd';
                sample.image=document.getElementById(id).toDataURL('image/png');
            }
            return result;
        };
        dialog.onEngineReport=function(){
            const result=onReport.apply(this,arguments),r=baye.hd.report();
            if(sample.frames.length&&!sample.report&&r.active===1&&r.kind===2&&r.person===${personId}){
                sample.report={native:r,keys:__runtimeEngineInputs.length};
            }
            return result;
        };
        return true;
    })()`;
}

export function verifyBattleOpeningStatus(observation,person,acks,missingArt) {
    const {frames,report}=observation;
    const final=frames.findLast(f=>f.frame===11);
    assert.ok(frames.length>=2&&final,'The real initialization status reaches its final native display frame');
    for(const f of frames) {
        const {status:s,actual:a}=f;
        assert.deepEqual([f.generation,f.eventId,f.keys],[final.generation,final.eventId,final.keys]);
        assert.equal(f.fight.active,0,'The opening status plays before native battle input is active');
        assert.equal(f.input,false,'The display never authorizes a battle action');
        assert.equal(f.ui.skip,false,'The original status movie cannot be skipped');
        assert.equal(s.person,person.i);
        assert.equal(s.before,0);
        assert.equal(s.after,8);
        assert.equal(s.arms,0);
        assert.ok(s.hp>0);
        assert.deepEqual(a,{token:s.person+1,x:s.x,y:s.y,state:s.after,hp:s.hp,arms:s.arms,
            level:s.level,experience:s.experience,equip:person.Equip});
    }
    if(missingArt) {
        assert.ok(frames.every(f=>f.ui.presentation==='lcd'&&f.lcd.visible&&!f.hd.visible),
            'The original LCD owns the full opening status when a required picture is missing');
        assert.ok(frames.some(f=>f.ui.reason==='asset-load-failed'),'The missing picture is observed by the actual mobile renderer');
    } else {
        assert.equal(final.ui.presentation,'hd','The final native opening frame is visible in HD on mobile');
        assert.equal(final.ui.source,'hd-assets');
        assert.equal(final.ui.title,'战场退场提示');
        assert.ok(final.hd.visible&&final.hd.inViewport&&!final.lcd.visible);
        const scene=final.ui.projected;
        assert.ok(scene?.source==='hd-battle-scene','The opening effect appears on the actual HD battle scene');
        assert.deepEqual([scene.phase,scene.family,scene.generation,scene.eventId,scene.commitSeq],
            [2,'departure',final.generation,final.eventId,final.commitSeq]);
        assert.deepEqual(scene.subject,{index:final.status.index,person:person.i,x:final.status.x,y:final.status.y});
        assert.ok(!scene.renderedUnits.includes(final.status.index),'The HD scene has retired the departed unit');
    }
    assert.ok(report?.native.text&&report.keys===final.keys,'The original general report follows the status without an extra input');
    const matching=acks.filter(a=>a.native.seq===report.native.seq&&a.native.inputSeq===report.native.inputSeq);
    assert.equal(matching.length,1,'The original status report is acknowledged once');
    assert.deepEqual(matching[0].keys,[39]);
    return {frames:frames.length,person:person.i,eventId:final.eventId,finalFrame:final.frame,
        presentation:final.ui.presentation,report:report.native};
}
