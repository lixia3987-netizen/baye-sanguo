import assert from 'node:assert/strict';

export function observeBattleEquipmentSettlement(cityIndex, worldExpression) {
    return `(() => {
        const samples=window.__battleEquipment={before:null,deaths:[],settled:null};
        const matches=()=>{
            const f=baye.hd.fight();
            return !f.active&&f.over===1&&f.cityIndex===${cityIndex}&&baye.data.g_FgtParam.Mode===1;
        };
        const battle=BayeHdBattle,onFight=battle.onEngineFight;
        battle.onEngineFight=function(){
            const value=onFight.apply(this,arguments);
            if(!samples.before&&matches())samples.before=${worldExpression};
            return value;
        };
        const dialog=BayeHdDialog,onReport=dialog.onEngineReport;
        dialog.onEngineReport=function(){
            const value=onReport.apply(this,arguments),r=baye.hd.report();
            if(matches()&&r.active===1&&r.kind===1&&r.text.endsWith(' 战死')&&
                !samples.deaths.some(e=>e.native.seq===r.seq))samples.deaths.push({native:r,world:${worldExpression}});
            return value;
        };
        window.addEventListener('baye-hd-battle-settled',({detail:receipt})=>{
            if(receipt.mode===1&&receipt.over===1&&receipt.city===${cityIndex})samples.settled={receipt,world:${worldExpression}};
        });
        return true;
    })()`;
}

export function discoveredCityEquipment(world, cityIndex) {
    const city=world.cities[cityIndex];
    return world.goods.slice(city.ToolQueue,city.ToolQueue+city.Tools).filter(value=>value&0x8000).map(value=>value&0x7fff);
}

export function appendDiscoveredEquipment(cities, queue, cityIndex, equipment) {
    const itemIds=equipment.filter(Boolean).map(id=>{
        assert.ok(Number.isInteger(id)&&id>=1&&id<=33,'An original equipment slot contains a valid one-based ID');
        return id-1;
    });
    const city=cities[cityIndex],offset=city.ToolQueue+city.Tools;
    assert.equal(queue.length,2000);
    assert.ok(offset>=0&&offset+itemIds.length<=queue.length);
    queue.splice(offset,0,...itemIds.map(id=>id|0x8000));
    queue.length=2000;
    city.Tools+=itemIds.length;
    for(let i=cityIndex+1;i<cities.length;i++)cities[i].ToolQueue+=itemIds.length;
    return itemIds;
}

export function verifyEquipmentDeposit(before, after, cityIndex, equipment) {
    const queue=before.goods.slice(),cities=before.cities.map(c=>({ToolQueue:c.ToolQueue,Tools:c.Tools}));
    const itemIds=appendDiscoveredEquipment(cities,queue,cityIndex,equipment);
    assert.deepEqual(after.goods,queue,'Original goods insertion sets the discovery bit and preserves the entire shifted queue');
    assert.deepEqual(after.cities.map(c=>[c.ToolQueue,c.Tools]),cities.map(c=>[c.ToolQueue,c.Tools]),
        'Only the destination count and subsequent city offsets change');
    return itemIds;
}
