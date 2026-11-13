import assert from 'node:assert/strict';
import {summarizeSamples} from './hd-performance-metrics.mjs';

export function desktopBattlePoint(tile) {
    const board=document.getElementById('hd-battle-canvas'), rail=document.getElementById('hd-battle-rail');
    const view=BayeHdBattle.debugSnapshot().view, bounds=board.getBoundingClientRect();
    const sidebar=rail&&!rail.hidden&&rail.getBoundingClientRect();
    const boardWidth=sidebar?.width>0&&sidebar.left>bounds.left&&sidebar.left<bounds.right
        ?Math.max(80,(sidebar.left-bounds.left)/bounds.width*1920-104):1760;
    if(tile.x<view.x||tile.x>=view.x+view.w||tile.y<view.y||tile.y>=view.y+view.h){
        throw Error('Requested tile is outside the actual HD board');
    }
    return {x:bounds.left+(80+(tile.x-view.x+0.5)*boardWidth/view.w)*bounds.width/1920,
        y:bounds.top+(72+(tile.y-view.y+0.5)*920/view.h)*bounds.height/1080};
}

// Stringified into the isolated game page. Observe the trusted gesture, the real
// input queue's wake callbacks and the first draw for the resulting owner.
export function observeBattleInput(tile, nextKind, touchPoint = null, desktopPoint = desktopBattlePoint) {
    const board=document.getElementById(touchPoint?'hd-mobile-battle-canvas':'hd-battle-canvas');
    const point=touchPoint||desktopPoint(tile);
    if(document.elementFromPoint(point.x,point.y)!==board)throw Error('Measured tile is covered');
    const read=()=>{
        const d=baye.data;
        return {kind:d.g_hdFightInputKind,seq:d.g_hdFightInputSeq,actor:d.g_hdFightActor,
            x:d.g_FoucsX,y:d.g_FoucsY,city:d.g_FgtParam.CityIndex,bout:d.g_FgtBoutCnt};
    };
    const sample={before:read(),gesture:touchPoint?'touch-release':'click',click:null,keys:[],paints:[]};
    let sending=null,fightReads=0;
    const eventType=touchPoint?'pointerup':'click';
    const onGesture=event=>{
        if(event.isTrusted&&event.target===board&&sample.click===null&&
            (!touchPoint||event.pointerType==='touch'&&event.isPrimary))sample.click=performance.now();
    };
    const send=window.sendKey, timer=window.setTimeout, hd=baye.hd, fight=hd.fight;
    window.addEventListener(eventType,onGesture,true);
    hd.fight=function(){
        if(sample.click!==null)fightReads++;
        return fight.apply(this,arguments);
    };
    window.sendKey=function(code){
        if(sample.click===null)return send.apply(this,arguments);
        const entry={code,at:performance.now(),before:read(),fightReads,wakeScheduled:0,acks:[]};
        sample.keys.push(entry);sending=entry;
        try{return send.apply(this,arguments);}finally{sending=null;}
    };
    window.setTimeout=function(callback,ms,...args){
        const entry=sending;
        if(!entry||ms!==0||typeof callback!=='function')return timer.call(this,callback,ms,...args);
        entry.wakeScheduled++;
        return timer.call(this,function(){
            try{return callback.apply(this,arguments);}
            finally{entry.acks.push({at:performance.now(),after:read(),fightReads});}
        },ms,...args);
    };
    const ctx=nextKind===null?document.getElementById('hd-spe-canvas').getContext('2d'):board.getContext('2d');
    const method=nextKind===null?'drawImage':'clearRect', paint=ctx[method];
    ctx[method]=function(){
        const result=paint.apply(this,arguments);
        if(sample.keys.at(-1)?.code!==39||sample.paints.length>=40)return result;
        const state=read();
        if(nextKind!==null){
            if(state.kind===nextKind)sample.paints.push({at:performance.now(),state});
        }else if(arguments[0]?.src){
            const spe=baye.hd.spe();
            if(spe.active===1&&spe.kind===3)sample.paints.push({at:performance.now(),state,
                spe:{id:spe.id,eventId:spe.eventId,actor:spe.actorIndex,target:spe.targetIndex},image:arguments[0].src});
        }
        return result;
    };
    window.__battleInputTiming={sample,finish(){
        window.removeEventListener(eventType,onGesture,true);
        window.sendKey=send;window.setTimeout=timer;hd.fight=fight;ctx[method]=paint;
        delete window.__battleInputTiming;
        return sample;
    }};
    return point;
}

export function verifyBattleInput(sample, tile, nextKind) {
    const {before,click,keys,paints}=sample;
    assert.ok(Number.isFinite(click),'The sample begins at a real trusted board gesture');
    const dx=tile.x-before.x,dy=tile.y-before.y;
    const expected=[...Array(Math.abs(dx)).fill(dx<0?36:37),...Array(Math.abs(dy)).fill(dy<0?34:35),39];
    assert.deepEqual(keys.map(key=>key.code),expected,'One original direction per tile and one Enter');
    const firstPaint=paints[0], commit=keys.at(-1);
    assert.ok(firstPaint&&firstPaint.at>=commit.at,'Observed a real resulting canvas draw');
    let x=before.x,y=before.y;
    for(const [index,key] of keys.entries()){
        assert.ok(key.wakeScheduled===0||key.wakeScheduled===1,'One input schedules at most one native queue wake');
        assert.equal(key.acks.length,key.wakeScheduled,'Observed every native queue wake scheduled by this key');
        assert.deepEqual(key.before,{...before,x,y},'Each key is sent from the last acknowledged original tile');
        const ack=key.acks[0], next=keys[index+1];
        // A pending native timer can wake the original queue before the key
        // itself schedules a callback. Verify its state at the next key or
        // draw, and omit those steps from the exact wake timing measurements.
        const after=ack?.after??next?.before??firstPaint.state;
        assert.ok(key.at>=click&&(!ack||ack.at>=key.at));
        if(key.code===39){
            assert.notEqual(after.seq,before.seq,'Enter retires the native input');
            if(nextKind!==null)assert.equal(after.kind,nextKind);
        }else{
            x+=(key.code===37?1:key.code===36?-1:0);y+=(key.code===35?1:key.code===34?-1:0);
            assert.deepEqual(after,{...before,x,y},'Original wake acknowledged the exact next tile');
            assert.ok(!ack||next.at>=ack.at,'The next key follows the actual native acknowledgement');
        }
    }
    if(nextKind===null)assert.deepEqual([firstPaint.spe.actor,firstPaint.spe.target],[before.actor,tile.i]);
    else if(commit.acks.length)assert.equal(firstPaint.state.seq,commit.acks[0].after.seq);
    const arrows=keys.slice(0,-1);
    return {arrows:keys.length-1,clickToFirstKey:keys[0].at-click,clickToCommit:commit.at-click,
        clickToAck:commit.acks.length?commit.acks[0].at-click:null,clickToDraw:firstPaint.at-click,
        fightReadsBeforeFirstKey:keys[0].fightReads,
        arrowToAck:arrows.flatMap(key=>key.acks.map(ack=>ack.at-key.at)),
        ackToNextKey:arrows.flatMap((key,index)=>key.acks.map(ack=>keys[index+1].at-ack.at)),
        fightReadsBetweenSteps:arrows.flatMap((key,index)=>key.acks.map(ack=>keys[index+1].fightReads-ack.fightReads))};
}

export function summarizeBattleInputs(samples) {
    return Object.fromEntries(['select','move','attack'].map(kind=>{
        const group=samples.filter(sample=>sample.kind===kind).map(sample=>sample.timing);
        return [kind,Object.fromEntries(['arrows','clickToFirstKey','clickToCommit','clickToAck','clickToDraw',
            'arrowToAck','ackToNextKey','fightReadsBeforeFirstKey','fightReadsBetweenSteps']
            .map(name=>[name,summarizeSamples(group.flatMap(sample=>sample[name]??[]))]))];
    }));
}

export async function timeBattleInput({evaluate, sample, nextKind, dispatch, waitForOutcome, waitForPaint, touchPoint = null}) {
    const point=await evaluate(`(${observeBattleInput})(${JSON.stringify(sample.tile)},${nextKind},${JSON.stringify(touchPoint)},(${desktopBattlePoint}))`);
    let outcome;
    try{
        await dispatch(point);
        outcome=await waitForOutcome();
        await waitForPaint('window.__battleInputTiming.sample.paints.length>0');
    }finally{
        sample.trace=await evaluate('window.__battleInputTiming.finish()');
    }
    sample.timing=verifyBattleInput(sample.trace,sample.tile,nextKind);
    return outcome;
}

export async function measureBattleSelectionsAndMoves({initial, measureTile, moveTiles, cancelMove, resetFocus}) {
    const anchor={x:initial.fight.focusX,y:initial.fight.focusY};
    const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    const actor=initial.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![1,6,8].includes(u.state))
        .sort((a,b)=>distance(b,anchor)-distance(a,anchor))[0];
    assert.ok(actor&&distance(actor,anchor)>0,'A real player general has a multi-step selection route');
    let target;
    for(let repetition=1;repetition<=4;repetition++){
        const selected=await measureTile('select',actor,2);
        assert.equal(selected.fight.actorIndex,actor.i,'Measured selection chooses the actual original general');
        const candidates=await moveTiles();
        target??=candidates.filter(p=>!initial.units.some(u=>u.state!==8&&u.x===p.x&&u.y===p.y))
            .sort((a,b)=>distance(b,actor)-distance(a,actor))[0];
        assert.ok(target&&candidates.some(p=>p.x===target.x&&p.y===target.y),'The same measured tile remains legal in the original path mask');
        const movement=await measureTile('move',target,3);
        const moved=movement.units.find(u=>u.i===actor.i);
        assert.deepEqual([moved.x,moved.y],[target.x,target.y]);
        const restored=await cancelMove();
        assert.deepEqual(restored.units,initial.units);
        await resetFocus(anchor,repetition);
    }
}
