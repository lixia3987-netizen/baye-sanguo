import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const recordBattleMapNumbers = `(() => {
    const mobile=!!window.BayeHdMobileBattle, battle=BayeHdBattle;
    const host=mobile?BayeHdMobileBattle:battle, callbackName=mobile?'onEngineMapNumber':'onEngineFight';
    const original=host[callbackName], canvas=document.getElementById(mobile?'hd-mobile-battle-canvas':'hd-battle-canvas');
    const ctx=canvas.getContext('2d'), fillText=ctx.fillText, frames=[];
    let painted=null;
    ctx.fillText=function(text,...args){
        const out=fillText.call(this,text,...args), d=baye.data;
        if(d.g_hdFightNumberKind&&/^[+-]\\d+$/.test(text)){
            const point=this.getTransform().transformPoint({x:args[0],y:args[1]});
            painted={seq:d.g_hdFightNumberSeq,text,x:point.x,y:point.y};
        }
        return out;
    };
    host[callbackName]=function(){
        const out=original.apply(this,arguments), d=baye.data;
        const seq=d.g_hdFightNumberSeq, kind=d.g_hdFightNumberKind, target=d.g_hdFightNumberTarget;
        if(!kind||frames.some(frame=>frame.seq===seq))return out;
        const pos=d.g_GenPos[target], fight=baye.hd.fight(), view=mobile?host.debugSnapshot():null;
        const rect=canvas.getBoundingClientRect(), current=painted?.seq===seq?painted:null;
        const top=current&&document.elementFromPoint(rect.left+current.x/canvas.width*rect.width,rect.top+current.y/canvas.height*rect.height);
        const dialog=top!==canvas?BayeHdDialog.debugSnapshot():null;
        frames.push({seq,kind,target,value:d.g_hdFightNumberValue,skillSession:d.g_hdFightNumberSkillSession,
            skillId:d.g_hdSkillResultSkillId,x:pos.x,y:pos.y,personId:d.g_FgtParam.GenArray[target]-1,
            fight, painted:current, view, canvasHit:top===canvas, top:top?.id||top?.className,
            dialog:dialog&&{kind:dialog.kind,open:dialog.open,reportSeq:dialog.reportSeq,live:baye.hd.report(),asyncId:d.g_asyncActionID},
            lcdHidden:getComputedStyle(document.getElementById('lcd')).visibility==='hidden',
            inputReady:battle.debugSnapshot().inputReady,spe:BayeHdSpe.isOpen(),speEvent:BayeHdSpe.debugSnapshot().event,
            hud:document.getElementById('hd-battle-hud').textContent,
            keys:(mobile?window.__mobileMapKeys:window.__battleKeys).length,
            png:canvas.toDataURL('image/png')});
        return out;
    };
    window.__battleMapNumbers=frames;
    return true;
})()`;

export function verifyBattleMapNumber(frames, {target, value, skillId=0, kind=1, keys, artifactDir, label}) {
    const matching=frames.filter(frame=>frame.target===target.i&&frame.kind===kind&&
        (skillId?frame.skillSession>0&&frame.skillId===skillId:frame.skillSession===0));
    assert.equal(matching.length,1,'One exact original map number belongs to the confirmed action');
    const {png,...frame}=matching[0];
    assert.equal(frame.value,value,'Visible map number matches the observed native result');
    assert.deepEqual([frame.x,frame.y,frame.personId],[target.x,target.y,target.id-1]);
    assert.equal(frame.fight.inputKind,0);assert.equal(frame.fight.wait,0);assert.equal(frame.inputReady,false);
    assert.equal(frame.canvasHit,true,'The HD board must own the visible result '+JSON.stringify(frame));
    assert.equal(frame.spe,false);assert.equal(frame.keys,keys);
    const expected=(kind===2?'+':'-')+value;
    assert.equal(frame.painted?.text,expected,'The active HD canvas draws the signed native number');
    assert.ok(frame.hud.includes(target.name)&&frame.hud.includes(expected),'The battle HUD identifies the native target and result');
    if(frame.view) {
        assert.equal(frame.view.presentation,'hd');assert.equal(frame.lcdHidden,true);
        assert.deepEqual(frame.view.mapNumber,{kind,target:target.i,value,seq:frame.seq,skillSession:frame.skillSession,x:target.x,y:target.y});
        const {x,y,cols,rows}=frame.view.camera;
        assert.ok(target.x>=x&&target.x<x+cols&&target.y>=y&&target.y<y+rows,'The board contains the exact result tile');
    }
    assert.ok(png?.startsWith('data:image/png;base64,'));
    writeFileSync(join(artifactDir,label+'.png'),Buffer.from(png.split(',')[1],'base64'),{flag:'wx'});
    return frame;
}
