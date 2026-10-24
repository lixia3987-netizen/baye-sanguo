// Read-only original person equipment evidence, independent of the HD getters.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

function originalEquipment(libBytes) {
  const lib=Buffer.from(libBytes);
  assert.equal(lib.length,207195);
  assert.equal(createHash('sha256').update(lib).digest('hex'),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
  const item=(resource,index)=>{
    const base=lib.readUInt32LE((resource-1)*4),end=base+lib.readUInt32LE(base);
    assert.equal(lib.readUInt16LE(base+4),resource);assert.equal(lib.readUInt16LE(base+12),0);
    const count=lib.readUInt16LE(base+6),fixed=lib.readUInt32LE(base+8);
    assert.ok(index>=0&&index<count&&end<=lib.length);
    const row=base+14+index*8,offset=fixed?base+14+index*fixed:count===1?base+14:base+lib.readUInt32LE(row);
    const length=fixed|| (count===1?end-base-14:lib.readUInt32LE(row+4));
    assert.ok(offset>=base+14&&offset+length<=end);return lib.subarray(offset,offset+length);
  };
  const table=item(66,0);assert.equal(table.length,33*66);
  return Array.from({length:33},(_,index)=>{
    const p=index*66,nameBytes=item(73,index),zero=nameBytes.indexOf(0);
    return {name:new TextDecoder('gbk').decode(nameBytes.subarray(0,Math.min(zero<0?nameBytes.length:zero,31))),
      useFlag:table[p+1],changeAttackRange:table[p+32],attack:table[p+62],iq:table[p+63],move:table[p+64],arm:table[p+65]};
  });
}

export async function checkPersonEquipmentCards(ctx,driver,entry,personId) {
  const {evaluate,until,libBytes,readKeys}=ctx,tools=originalEquipment(libBytes),before=await driver.sample();
  const m=before.state.menu,p=before.world.people[personId];
  assert.ok(m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids[m.index]===personId);
  const expected=[p.Tool1,p.Tool2].flatMap((id,slot)=>id?[{slot,toolIndex:id-1,tool:tools[id-1]}]:[]);
  assert.ok(expected.every(v=>v.tool),'Actual original equipment index');
  for(const [index,t]of tools.entries())for(const [field,key]of Object.entries({useflag:'useFlag',changeAttackRange:'changeAttackRange',at:'attack',iq:'iq',move:'move',arm:'arm'})){
    assert.equal(before.world.tools[index][field],t[key],'Live tool fields equal actual original ROM '+index+'.'+field);
  }
  await until('current person equipment cards',`(() => {const s=BayeHdCityMenu.debugSnapshot(),d=s.personDetail,m=baye.hd.menuItems();
    return d&&m.active===1&&m.kind===3&&m.ids[m.index]===${personId}&&d.personIndex===${personId}&&d.equipment?.length===${expected.length};})()`);
  const snapshot=await evaluate('BayeHdCityMenu.debugSnapshot().personDetail'),dom=await evaluate(`(() => {
    const pane=document.getElementById('hd-city-menu-person-details'),fields=document.getElementById('hd-city-menu-person-fields');
    return {hidden:pane.hidden,text:fields.textContent,cards:[...fields.querySelectorAll('[data-hd-equipment-slot]')].map(n=>({
      slot:Number(n.getAttribute('data-hd-equipment-slot')),toolIndex:Number(n.getAttribute('data-hd-equipment-tool')),
      heading:n.querySelector('h3')?.textContent,rows:[...n.querySelectorAll('[data-hd-equipment-field]')].map(r=>({
        field:r.getAttribute('data-hd-equipment-field'),title:r.querySelector('span')?.textContent,value:r.querySelector('strong')?.textContent}))}))};})()`);
  assert.equal(dom.hidden,false);assert.equal(dom.cards.length,expected.length);assert.equal(snapshot.equipment.length,expected.length);
  assert.equal(snapshot.nativeIndex,m.index);assert.equal(snapshot.seq,m.seq);assert.equal(snapshot.context,1);assert.equal(snapshot.kind,3);
  assert.equal(snapshot.ownerKey,before.state.cityUi.deepMenuOwner.key);
  const visible=[];
  for(const [i,expect]of expected.entries()){
    const {slot,toolIndex,tool}=expect,card=dom.cards[i],state=snapshot.equipment[i];
    assert.equal(card.slot,slot);assert.equal(card.toolIndex,toolIndex);assert.equal(state.slot,slot);assert.equal(state.toolIndex,toolIndex);
    assert.equal(state.name,tool.name);assert.equal(state.generation,m.detailGeneration);
    assert.equal(state.source,'standard-tool-details');
    assert.deepEqual(state.properties,Object.fromEntries(['useFlag','attack','iq','move','arm','changeAttackRange'].map(k=>[k,tool[k]])));
    assert.ok(card.heading.includes(slot?'装备二':'装备一')&&card.heading.includes(tool.name));
    const arm=tool.arm===0?'无':tool.arm===1?'水军':tool.arm===2?'玄兵':tool.arm===3?'极兵':['骑兵','步兵','弓箭兵','水军','极兵','玄兵'][tool.arm-4]||'原始码 '+tool.arm;
    const values={useFlag:tool.useFlag?'使用':'装备',attack:String(tool.attack),iq:String(tool.iq),move:String(tool.move),arm,
      changeAttackRange:tool.changeAttackRange?'改变（以战场为准）':'不改变'};
    assert.equal(card.rows.length,6);
    for(const [field,value]of Object.entries(values)){
      const row=card.rows.find(v=>v.field===field);assert.ok(row,'Native equipment field '+field);assert.equal(row.value,value);
      const dtoRow=state.rows.find(v=>v.field===field);assert.ok(dtoRow);assert.equal(dtoRow.value,value);assert.equal(dtoRow.label,row.title);
      const selector=`#hd-city-menu-person-fields [data-hd-equipment-slot="${slot}"] [data-hd-equipment-field="${field}"]`;
      const geometry=await driver.reveal(selector,{control:false});
      assert.ok(geometry.visible,'Every actual equipment row can be read after genuine scrolling');
      visible.push({slot,toolIndex,field,value,geometry});
    }
    await driver.snap('equipment-person-'+personId+'-slot-'+slot);
  }
  if(!expected.length)await driver.snap('equipment-person-'+personId+'-empty');
  const after=await driver.sample(),keys=await readKeys(before.state.keyCount);
  assert.deepEqual(keys,[],'Rendering, reading and scrolling cards sends no native keys');
  assert.deepEqual(after.native,before.native,'Equipment cards preserve exact sampled native owner/cursor');
  assert.deepEqual(after.world,before.world,'Equipment cards preserve every measured world/resource/order/equipment field');
  assert.equal(after.state.touchCount,before.state.touchCount,'No original LCD touches');
  entry.equipmentCards??=[];entry.equipmentCards.push({personId,expected,snapshot,dom,visible,before,after,keys,accepted:true});
}
