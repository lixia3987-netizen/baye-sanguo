import assert from 'node:assert/strict';

export const skillOptionsExpression = `(() => {
    const d=baye.data, fight=baye.hd.fight(), menu=baye.hd.skills(), actor=d.g_GenPos[fight.actorIndex];
    const terrain=baye.getTerrainByGeneralIndex(fight.actorIndex), weather=Number(d.g_FgtWeather)-1;
    const array=(values,length)=>Array.from({length},(_,i)=>Number(values[i]));
    return menu.ids.map((id,index)=>{
        const rule=d.g_Skills[id-1], useMp=Number(rule.useMp);
        return {id,index,name:menu.names[index],aim:Number(rule.aim),state:Number(rule.state),
            power:Number(rule.power),destroy:Number(rule.destroy),useMp,eland:array(rule.eland,8),earm:array(rule.earm,6),
            available:useMp>0&&useMp<=Number(actor.mp)&&Number(rule.weather[weather])>0&&Number(rule.oland[terrain])>0};
    });
})()`;

export const skillAimObservation = `(() => {
    const d=baye.data, fight=baye.hd.fight(), feedback=BayeHdBattle.debugSnapshot().feedback, raw=d.g_FgtAtkRng;
    const size=Number(raw[0]), originX=Number(raw[1]), originY=Number(raw[2]);
    const range={size,originX,originY,values:Array.from({length:size*size},(_,i)=>Number(raw[i+3]))};
    const slots=Array.from({length:20},(_,i)=>{
        const id=Number(d.g_FgtParam.GenArray[i]), pos=d.g_GenPos[i];
        const x=Number(pos.x), y=Number(pos.y), state=Number(pos.state);
        const onBoard=state!==8&&x<fight.mapW&&y<fight.mapH;
        return {i,id,x,y,onBoard,terrain:onBoard?baye.getTerrainByGeneralIndex(i):null,
            arm:onBoard&&id>0&&id<=200?baye.getArmType(id-1):null};
    });
    const row=field=>{
        const el=document.querySelector('[data-hd-mobile-focus-field='+field+']');
        if(!el)return null;
        const r=el.getBoundingClientRect(), card=el.parentElement.parentElement.getBoundingClientRect();
        return {text:el.textContent,visible:r.width>0&&r.height>0&&r.top>=card.top-1&&r.bottom<=card.bottom+1};
    };
    return {fight,feedback,range,slots,screen:{width:innerWidth,height:innerHeight},
        mobile:{title:row('skill'),target:row('target')}};
})()`;

export function verifySkillAim(observed, skill, { mobile = false } = {}) {
    const { fight, feedback, range, slots } = observed;
    const ally = Boolean(skill.aim & 1), side = ally ? 'player' : 'enemy';
    assert.deepEqual([fight.active,fight.over,fight.wait,fight.inputKind,fight.aimType],[1,0,1,5,1]);
    const occupants = slots.filter(unit => unit.onBoard &&
        slots.find(other => other.onBoard && unit.x === other.x && unit.y === other.y) === unit);
    const statuses = slots.map(unit => {
        if (!occupants.includes(unit) || unit.arm == null || skill.earm[unit.arm] == null || skill.eland[unit.terrain] == null) return 0;
        if (!skill.earm[unit.arm]) return 2;
        if (!skill.eland[unit.terrain]) return 3;
        return ally === (unit.i < 10) ? 1 : 4;
    });
    assert.deepEqual(fight.skillAim,{ id:skill.id, name:skill.name, side, targets:statuses,
        inputSeq:fight.inputSeq, actorIndex:fight.actorIndex },'AIM publication matches the selected original skill and actual units');
    const inRange = (x,y) => {
        const dx=(x-range.originX)&255, dy=(y-range.originY)&255;
        return dx<range.size&&dy<range.size&&range.values[dy*range.size+dx]===1;
    };
    const allowed = occupants.filter(unit => statuses[unit.i]===1 && inRange(unit.x,unit.y)).map(unit => unit.i);
    assert.equal(feedback.active,true);
    assert.equal(feedback.kind,'skill');
    assert.equal(feedback.inputSeq,fight.inputSeq);
    assert.deepEqual(feedback.rangedUnits.map(unit=>unit.i),allowed,'Only eligible units in the real native range have markers');
    const title=skill.name+(ally?' · 选择己方将领':' · 选择敌将');
    assert.equal(feedback.skillAim.title,title);
    const x=fight.focusX,y=fight.focusY, focus=occupants.find(unit=>unit.x===x&&unit.y===y);
    const status=focus?statuses[focus.i]:0;
    const label=!inRange(x,y)?'不在计谋射程内':!focus?'计谋射程内 · 空地':
        ['射程内将领','可选目标','兵种不符','地形不符','阵营不符'][status];
    assert.deepEqual([feedback.focus.x,feedback.focus.y,feedback.focus.label,feedback.focus.targetIndex],
        [x,y,label,focus&&inRange(x,y)&&status===1?focus.i:null]);
    if(mobile){
        assert.deepEqual(observed.mobile.title,{text:title,visible:true},'The selected skill fits in the visible mobile focus card');
        assert.deepEqual(observed.mobile.target,{text:label,visible:true},'The target status fits in the visible mobile focus card');
    }
    return { id:skill.id, name:skill.name, side, allowed, focus:feedback.focus, screen:observed.screen };
}
