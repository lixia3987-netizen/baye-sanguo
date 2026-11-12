import assert from 'node:assert/strict';
import {summarizeSamples} from './hd-performance-metrics.mjs';

// Stringified into the isolated game page. Observe the trusted click, the real
// input queue's wake callbacks and the first draw for the resulting owner.
export function observeDesktopBattleInput(tile, nextKind) {
    const board=document.getElementById('hd-battle-canvas');
    const rail=document.getElementById('hd-battle-rail');
    const view=BayeHdBattle.debugSnapshot().view, bounds=board.getBoundingClientRect();
    const sidebar=rail&&!rail.hidden&&rail.getBoundingClientRect();
    const boardWidth=sidebar?.width>0&&sidebar.left>bounds.left&&sidebar.left<bounds.right
        ?Math.max(80,(sidebar.left-bounds.left)/bounds.width*1920-104):1760;
    const point={x:bounds.left+(80+(tile.x-view.x+0.5)*boardWidth/view.w)*bounds.width/1920,
        y:bounds.top+(72+(tile.y-view.y+0.5)*920/view.h)*bounds.height/1080};
    if(tile.x<view.x||tile.x>=view.x+view.w||tile.y<view.y||tile.y>=view.y+view.h||
        document.elementFromPoint(point.x,point.y)!==board)throw Error('Measured tile is outside the actual HD board');
    const read=()=>{
        const d=baye.data;
        return {kind:d.g_hdFightInputKind,seq:d.g_hdFightInputSeq,actor:d.g_hdFightActor,
            x:d.g_FoucsX,y:d.g_FoucsY,city:d.g_FgtParam.CityIndex,bout:d.g_FgtBoutCnt};
    };
    const sample={before:read(),click:null,keys:[],paints:[]};
    let sending=null;
    const onClick=event=>{
        if(event.isTrusted&&event.target===board&&sample.click===null)sample.click=performance.now();
    };
    const send=window.sendKey, timer=window.setTimeout;
    window.addEventListener('click',onClick,true);
    window.sendKey=function(code){
        if(sample.click===null)return send.apply(this,arguments);
        const entry={code,at:performance.now(),before:read(),wakeScheduled:0,acks:[]};
        sample.keys.push(entry);sending=entry;
        try{return send.apply(this,arguments);}finally{sending=null;}
    };
    window.setTimeout=function(callback,ms,...args){
        const entry=sending;
        if(!entry||ms!==0||typeof callback!=='function')return timer.call(this,callback,ms,...args);
        entry.wakeScheduled++;
        return timer.call(this,function(){
            try{return callback.apply(this,arguments);}
            finally{entry.acks.push({at:performance.now(),after:read()});}
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
        window.removeEventListener('click',onClick,true);
        window.sendKey=send;window.setTimeout=timer;ctx[method]=paint;
        delete window.__battleInputTiming;
        return sample;
    }};
    return point;
}

export function verifyDesktopBattleInput(sample, tile, nextKind) {
    const {before,click,keys,paints}=sample;
    assert.ok(Number.isFinite(click),'The sample begins at a real trusted board click');
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
        arrowToAck:arrows.flatMap(key=>key.acks.map(ack=>ack.at-key.at)),
        ackToNextKey:arrows.flatMap((key,index)=>key.acks.map(ack=>keys[index+1].at-ack.at))};
}

export function summarizeDesktopBattleInputs(samples) {
    return Object.fromEntries(['select','move','attack'].map(kind=>{
        const group=samples.filter(sample=>sample.kind===kind).map(sample=>sample.timing);
        return [kind,Object.fromEntries(['arrows','clickToFirstKey','clickToCommit','clickToAck','clickToDraw',
            'arrowToAck','ackToNextKey'].map(name=>[name,summarizeSamples(group.flatMap(sample=>sample[name]??[]))]))];
    }));
}
