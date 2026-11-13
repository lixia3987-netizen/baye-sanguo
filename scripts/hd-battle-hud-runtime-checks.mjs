import assert from 'node:assert/strict';
import {summarizeFrames} from './hd-performance-metrics.mjs';

export const battleResultNoteObservation = `(() => {
    const note=BayeHdBattleNote.debugSnapshot();
    if(!note.active||!note.place)return null;
    const d=baye.data, native=baye.hd.battleNote(), param=d.g_FgtParam;
    if(native.active!==1||native.seq!==note.seq||native.generation!==note.generation)return null;
    const root=document.getElementById('hd-battle-note'), caption=document.getElementById('hd-battle-note-place'),
        message=document.getElementById('hd-battle-note-text'), summary=document.getElementById('hd-battle-note-summary');
    const measure=node=>{
        const rect=node.getBoundingClientRect();
        return {text:node.textContent, visible:node.checkVisibility({visibilityProperty:true,opacityProperty:true}),
            fits:rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight&&
                node.scrollWidth<=node.clientWidth, top:rect.top, bottom:rect.bottom};
    };
    return {note,native,city:{index:param.CityIndex,name:baye.getCityName(param.CityIndex),owner:d.g_Cities[param.CityIndex].Belong},
        mode:param.Mode,skip:d.g_hdFightSkip,king:d.g_PlayerKing,fightOver:d.g_FgtOver,nativeOver:d.g_hdFightOver,
        caption:measure(caption),message:measure(message),pointerEvents:getComputedStyle(root).pointerEvents,
        desktop:!document.body.classList.contains('hd-mobile-page'),
        totals:{day:d.g_FgtBoutCnt,limit:d.g_FgtBoutMax,food:param.MProvender},
        summary:summary?{...measure(summary),days:measure(document.getElementById('hd-battle-note-days')),
            food:measure(document.getElementById('hd-battle-note-food'))}:null};
})()`;

export function verifyBattleResultNote(sample, {outcome, kind, cityIndex}) {
    const {note,native,city,caption,message} = sample;
    assert.equal(note.presentation,'hd'); assert.equal(native.outcome,outcome); assert.equal(note.outcome,outcome);
    assert.equal(note.winner,native.winner); assert.equal(city.index,cityIndex);
    assert.deepEqual(note.place,{cityIndex,cityName:city.name,kind});
    if (outcome === 1) assert.equal(native.winner,sample.king,'Original player wins this order');
    if (kind === 'occupation' || kind === 'arrival') {
        assert.equal(sample.skip,kind==='occupation'?1:2);
        assert.equal(city.owner,sample.king+1,'The destination belongs to the original player');
    } else {
        assert.equal(sample.fightOver,outcome); assert.equal(sample.nativeOver,outcome);
        assert.equal(sample.mode,kind==='attack'?1:0);
    }
    const labels={attack:'进攻',defense:'守城',occupation:'占领',arrival:'入驻'};
    assert.equal(caption.text,`${labels[kind]} · ${city.name}`);
    assert.equal(message.text,native.text);
    assert.ok(caption.visible&&caption.fits&&message.visible&&message.fits&&caption.bottom<=message.top,
        'The place and original result fit and remain individually legible');
    assert.equal(sample.pointerEvents,'none','Result presentation remains passive');
    const {summary,totals}=sample;
    if (sample.desktop && (kind==='attack'||kind==='defense') && native.cityIndex===cityIndex && totals.day>0) {
        const days=Math.min(totals.day,totals.limit);
        assert.deepEqual(note.summary,{days,food:totals.food});
        assert.ok(summary?.visible&&summary.fits&&summary.days.visible&&summary.days.fits&&
            summary.food.visible&&summary.food.fits&&message.bottom<=summary.top,'Both totals fit below the original result');
        assert.equal(summary.days.text,days+' 天');
        assert.equal(summary.food.text,totals.food.toLocaleString('zh-CN'));
    } else {
        assert.equal(note.summary,undefined);
        assert.ok(!summary?.visible,'No battle totals appear for a skipped or non-desktop result');
    }
}

export async function measureIdleBattleBoard(evaluate, send, canvasId) {
    const mapRange=await evaluate(`({address:baye.data.g_FightMapData._addr,
        bytes:baye.data.g_MapWid*baye.data.g_MapHgt,readable:typeof window._baye_get_u8_value==='function'})`);
    assert.ok(Number.isInteger(mapRange.address)&&mapRange.address>0&&
        Number.isInteger(mapRange.bytes)&&mapRange.bytes>0&&mapRange.readable,
        'The original battle exposes the native map byte reader');
    await send('Performance.enable');
    try {
        const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).metrics.map(({name, value}) => [name, value]));
        const before = await metrics();
        const sample = await evaluate(`(() => {
            const NativePromise=(async()=>{})().constructor;
            return new NativePromise(resolve=>{
                const canvas=document.getElementById(${JSON.stringify(canvasId)}),context=canvas.getContext('2d');
                const original=context.clearRect,startedAt=performance.now(),frames=[],paints=[];
                const viewport={width:innerWidth,height:innerHeight,dpr:devicePixelRatio};
                const reads={}, restores=[];
                const mapStart=${mapRange.address},mapBytes=${mapRange.bytes};
                const readByte=window._baye_get_u8_value;
                let nativeMapByteReads=0;
                window._baye_get_u8_value=function(address){
                    if(address>=mapStart&&address<mapStart+mapBytes)nativeMapByteReads++;
                    return readByte.apply(this,arguments);
                };
                restores.push(()=>{window._baye_get_u8_value=readByte;});
                const stringify=JSON.stringify;
                let speEntrySerializations=0;
                JSON.stringify=function(value){
                    if(value&&typeof value==='object'&&Object.hasOwn(value,'speId')&&
                        Object.hasOwn(value,'pictures')&&Object.hasOwn(value,'units'))speEntrySerializations++;
                    return stringify.apply(this,arguments);
                };
                restores.push(()=>{JSON.stringify=stringify;});
                for(const [owner,name] of [[baye.hd,'fight'],[baye.hd,'menuItems'],[baye.hd,'realm'],
                    [baye.hd,'report'],[baye,'getPersonName'],[baye,'getArmType'],[baye.hd,'battleMapTiles']]){
                    const originalRead=owner[name];
                    if(typeof originalRead!=='function')continue;
                    const count=reads[name]={calls:0,ms:0};
                    owner[name]=function(){
                        const at=performance.now();count.calls++;
                        try{return originalRead.apply(this,arguments);}
                        finally{count.ms+=performance.now()-at;}
                    };
                    restores.push(()=>{owner[name]=originalRead;});
                }
                context.clearRect=function(){paints.push(performance.now());return original.apply(this,arguments);};
                function frame(time){
                    if(time>=startedAt)frames.push(time);
                    if(time-startedAt<1500){requestAnimationFrame(frame);return;}
                    context.clearRect=original;
                    restores.forEach(restore=>restore());
                    resolve({viewport,startedAt,endedAt:performance.now(),frames,paints,reads,speEntrySerializations,mapBytes,nativeMapByteReads});
                }
                requestAnimationFrame(frame);
            });
        })()`);
        const after = await metrics();
        assert.ok(sample.frames.length>0, 'The foreground battle receives animation frames');
        let nativeMap=null;
        if(sample.reads.battleMapTiles){
            nativeMap=await evaluate(`(() => {
                const data=baye.data,width=data.g_MapWid,height=data.g_MapHgt,original=data.g_FightMapData;
                const copied=baye.hd.battleMapTiles();
                if(!copied||copied.width!==width||copied.height!==height||copied.tiles.length!==width*height)return null;
                const matches=copied.tiles.every((value,index)=>value===original[index]);
                const first=original[0];
                copied.tiles[0]=first^255;
                const detached=original[0]===first&&baye.hd.battleMapTiles()?.tiles[0]===first;
                return {width,height,matches,detached,current:baye.data===data};
            })()`);
            assert.ok(nativeMap?.matches&&nativeMap.detached&&nativeMap.current,
                'The bulk copy exactly matches the current native map and cannot modify it');
            assert.ok(sample.reads.battleMapTiles.calls>0,'Idle HD battle uses the bulk map copy');
            assert.equal(sample.nativeMapByteReads,0,'Idle board sampling no longer crosses the bridge for individual map tiles');
        }
        return {browser: (await send('Browser.getVersion')).product, sample,
            nativeMap,
            frames: summarizeFrames(sample.frames, sample.startedAt, sample.endedAt),
            paints: summarizeFrames(sample.paints, sample.startedAt, sample.endedAt),
            scriptMs: (after.ScriptDuration-before.ScriptDuration)*1000,
            taskMs: (after.TaskDuration-before.TaskDuration)*1000};
    } finally {
        await send('Performance.disable');
    }
}

// Compare the actual rendered text and clipping with the original C fields.
export const battleHudObservation = `(() => {
    const d=baye.data,f=baye.hd.fight(),m=baye.hd.menuItems();
    const element=id=>document.getElementById(id);
    const measure=n=>{
        const r=n.getBoundingClientRect(),visible=n.checkVisibility({visibilityProperty:true,opacityProperty:true});
        const clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
        for(let p=n.parentElement;p&&p!==document.body;p=p.parentElement){
            const s=getComputedStyle(p),b=p.getBoundingClientRect();
            if(s.overflowX!=='visible'){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}
            if(s.overflowY!=='visible'){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}
        }
        return {text:n.textContent,visible,width:r.width,height:r.height,
            fits:visible&&r.width>0&&r.height>0&&r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5};
    };
    const status=element('hd-battle-context'),list=element('hd-battle-menu-list'),row=list.querySelector('.is-on');
    const settingRows=Array.from(list.querySelectorAll('[data-hd-battle-setting-value]'),n=>{
        const button=n.parentElement,b=button.getBoundingClientRect(),r=n.getBoundingClientRect();
        return {index:Number(button.dataset.hdBattleMenu),name:n.previousElementSibling.textContent,value:n.textContent,
            fitsRow:r.width>0&&r.height>0&&r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom};
    });
    return {viewport:{width:innerWidth,height:innerHeight},fight:f,menu:m,
        native:{mode:d.g_FgtParam.Mode,cityIndex:d.g_FgtParam.CityIndex,
            cityName:f.active===1&&f.over===0?baye.getCityName(d.g_FgtParam.CityIndex):null,
            day:d.g_FgtBoutCnt,limit:d.g_FgtBoutMax,weather:d.g_FgtWeather,food:d.g_FgtParam.MProvender,
            settings:{movie:d.g_LookMovie,speed:d.g_MoveSpeed,enemy:d.g_LookEnemy}},
        status:{...measure(status),fields:[...status.children].map(n=>({field:n.dataset.hdBattleStat,...measure(n)}))},
        focus:row&&{index:Number(row.dataset.hdBattleMenu),...measure(row)},scrollTop:list.scrollTop,
        settings:measure(element('hd-battle-settings-note')),settingRows,guidance:measure(element('hd-battle-hud')),
        menuTitle:measure(element('hd-battle-menu-title'))};
})()`;

export function verifyBattleHud(sample, {visible = true, settings = false, mobileFocus = false, mode = 1} = {}) {
    assert.equal(sample.status.visible, visible, 'Battle status visibility follows the current surface');
    if (!visible) return;

    const {native, fight, status} = sample;
    assert.equal(fight.active, 1);
    assert.equal(fight.over, 0);
    assert.equal(native.mode, mode, 'The current original player battle owns these values');
    assert.equal(native.cityIndex, fight.cityIndex);
    assert.ok(native.cityName, 'Original name for the current battle city');
    assert.equal(native.day, fight.bout);
    for (const key of ['day', 'limit', 'food']) assert.ok(Number.isInteger(native[key]) && native[key] >= 0);
    const weather = ['', '晴', '阴', '风', '雨', '冰雹'][native.weather];
    assert.ok(weather, 'Actual original weather code');
    assert.deepEqual(status.fields.map(({field, text}) => [field, text]), [
        ['place', `${mode === 0 ? '守城' : '进攻'} · ${native.cityName}`],
        ['day', `第${native.day}天 / 上限${native.limit}天`],
        ['weather', `天气 ${weather}`],
        ['food', `我方粮草 ${native.food}`]
    ]);
    assert.ok(status.fields.every(field => field.fits), 'City, day, weather and player grain all fit on screen');

    if (settings) {
        assert.ok([6,8].includes(fight.inputKind));
        const {movie, speed, enemy} = native.settings;
        assert.ok([movie, speed, enemy].every(value => value === 0 || value === 1));
        const look = ['不看', '观看'];
        const speedLabel = ['快速', '慢速'][speed];
        if (fight.inputKind === 6) {
            assert.equal(sample.settings.visible, false);
            assert.deepEqual(sample.settingRows, [
                {index:2,name:'战斗动画',value:look[movie],fitsRow:true},
                {index:3,name:'移动速度',value:speedLabel,fitsRow:true},
                {index:4,name:'敌军移动',value:look[enemy],fitsRow:true}
            ]);
        } else {
            assert.deepEqual(sample.settingRows, []);
            assert.equal(sample.settings.text, `当前设置：动画 ${look[movie]} · 移速 ${speedLabel} · 敌军移动 ${look[enemy]}`);
            assert.ok(sample.settings.fits, 'The current original settings are readable');
        }
    }
    if (mobileFocus) {
        assert.equal(sample.focus?.index, sample.menu.index);
        assert.ok(sample.focus.fits && sample.focus.width >= 44 && sample.focus.height >= 44,
            'The current original menu row is fully visible and touchable');
        assert.ok(sample.guidance.fits && !sample.menuTitle.visible, 'One visible mobile menu heading keeps its guidance');
    }
}
