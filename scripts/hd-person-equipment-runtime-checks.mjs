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
      heading:n.querySelector('h3')?.textContent,rows:[...n.querySelectorAll('[data-hd-equipment-field]')].map(r=>{
        const label=r.querySelector('span'),svgs=label?[...label.querySelectorAll('svg')]:[];
        return{field:r.getAttribute('data-hd-equipment-field'),title:label?.textContent,value:r.querySelector('strong')?.textContent,svgCount:svgs.length,
          icons:svgs.map(s=>({namespace:s.namespaceURI,field:s.getAttribute('data-hd-equipment-icon'),ariaHidden:s.getAttribute('aria-hidden'),focusable:s.getAttribute('focusable'),title:s.getAttribute('title'),titleCount:s.querySelectorAll('title').length,ariaLabel:s.getAttribute('aria-label'),ariaLabelledBy:s.getAttribute('aria-labelledby'),tabIndex:s.getAttribute('tabindex'),labelledDescendants:s.querySelectorAll('[aria-label],[aria-labelledby]').length,interactiveDescendants:s.querySelectorAll('a,button,input,select,textarea,[tabindex],[contenteditable],[role="button"],[role="link"]').length}))};})}))};})()`);
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
      assert.equal(row.svgCount,1,'Exactly one decorative equipment icon');assert.equal(row.icons.length,1);
      const icon=row.icons[0];assert.equal(icon.namespace,'http://www.w3.org/2000/svg');assert.equal(icon.field,field);
      assert.equal(icon.ariaHidden,'true');assert.equal(icon.focusable,'false');assert.equal(icon.title,null);assert.equal(icon.titleCount,0);
      assert.equal(icon.ariaLabel,null);assert.equal(icon.ariaLabelledBy,null);assert.equal(icon.tabIndex,null);
      assert.equal(icon.labelledDescendants,0);assert.equal(icon.interactiveDescendants,0,'Decorative SVG contains no interactive descendants');
      const selector=`#hd-city-menu-person-fields [data-hd-equipment-slot="${slot}"] [data-hd-equipment-field="${field}"]`;
      const geometry=await driver.reveal(selector,{control:false});
      assert.ok(geometry.visible,'Every actual equipment row can be read after genuine scrolling');
      const decoration=await evaluate(`(() => {
        const row=document.querySelector(${JSON.stringify(selector)}),label=row&&row.querySelector('span'),value=row&&row.querySelector('strong'),icons=label?[...label.querySelectorAll('svg')]:[],icon=icons[0];
        if(!row||!label||!value||!icon)return null;
        const rect=n=>{const r=n.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},style=n=>{const s=getComputedStyle(n);return{whiteSpace:s.whiteSpace,overflowX:s.overflowX,overflowWrap:s.overflowWrap};},s=getComputedStyle(icon);
        return{field:row.getAttribute('data-hd-equipment-field'),title:label.textContent,value:value.textContent,svgCount:icons.length,iconField:icon.getAttribute('data-hd-equipment-icon'),
          bounds:{row:rect(row),label:rect(label),value:rect(value),icon:rect(icon),viewport:{left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight}},
          iconStyle:{pointerEvents:s.pointerEvents,width:s.width,height:s.height,fontSize:s.fontSize},labelStyle:style(label),valueStyle:style(value),
          textWidths:{label:{client:label.clientWidth,scroll:label.scrollWidth},value:{client:value.clientWidth,scroll:value.scrollWidth}}};})()`);
      assert.ok(decoration,'The revealed row still has its decorative icon');assert.equal(decoration.field,field);assert.equal(decoration.title,row.title);assert.equal(decoration.value,value);assert.equal(decoration.svgCount,1);assert.equal(decoration.iconField,field);
      const epsilon=.5,b=decoration.bounds,contains=(outer,inner)=>inner.left>=outer.left-epsilon&&inner.right<=outer.right+epsilon&&inner.top>=outer.top-epsilon&&inner.bottom<=outer.bottom+epsilon;
      for(const name of ['row','label','value','icon','viewport']){const r=b[name];assert.ok(r&&['left','top','right','bottom','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0,'Positive finite equipment '+name+' rectangle');}
      for(const name of ['label','value','icon']){assert.ok(contains(b.row,b[name]),'Equipment '+name+' stays inside its row');assert.ok(contains(b.viewport,b[name]),'Equipment '+name+' stays inside the viewport');}
      assert.ok(contains(b.label,b.icon),'Decorative icon stays inside its label');assert.ok(b.label.right<=b.value.left+epsilon,'Equipment label and value do not overlap horizontally');
      assert.equal(decoration.iconStyle.pointerEvents,'none');const em=Number.parseFloat(decoration.iconStyle.fontSize),width=Number.parseFloat(decoration.iconStyle.width),height=Number.parseFloat(decoration.iconStyle.height);
      assert.ok(Number.isFinite(em)&&em>0&&Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0&&Math.abs(width-em)<=epsilon&&Math.abs(height-em)<=epsilon,'Decorative icon is bounded to one computed em');
      for(const name of ['label','value'])assert.ok(decoration.textWidths[name].scroll<=decoration.textWidths[name].client+epsilon,'Complete equipment '+name+' text has no horizontal overflow');
      visible.push({slot,toolIndex,field,value,geometry,decoration});
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
