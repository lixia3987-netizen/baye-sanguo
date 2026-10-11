// Genuine original CITY previews. Every game input comes from a current visible trusted touch.
import assert from 'node:assert/strict';

export async function runMobilePreviewChecks(ctx) {
  const {report,evaluate,until,checkpoint,ready,root,submenu,selectPerson,back,mapReturn,
    controlPoint,touchButton,touches,readKeys,navigation,worldSame,testCity,mark,label}=ctx;
  const entry={label,cityIndex:testCity.index,checks:[],scrollChecks:[],accepted:false};
  report.previewChecks.push(entry);entry.baseline=await mark();
  let phase=0;
  const snap=suffix=>checkpoint(label+'-'+String(++phase).padStart(2,'0')+'-'+suffix);
  const sample=async()=>{
    const measured=await ready();
    const attributes=await evaluate('({person:baye.hd.personProperties(),goods:baye.hd.goods()})');
    worldSame(entry.baseline,measured,'Every read-only preview and property page');
    assert.equal(measured.state.touchCount,entry.baseline.state.touchCount,'No LCD touch leakage');
    return {...measured,attributes};
  };
  const geometry=async selector=>evaluate(`(() => {
    const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;
    const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const b=rect(n),clip={left:0,right:innerWidth,top:0,bottom:innerHeight},ownedStickyClips=[];let scroller=null,shown=true;
    for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p),r=rect(p);
      if(p.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)shown=false;
      if(['auto','scroll','hidden','clip'].includes(s.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}
      if(['auto','scroll','hidden','clip'].includes(s.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}
      if(!scroller&&['auto','scroll'].includes(s.overflowY)&&p.scrollHeight>p.clientHeight+2)scroller={id:p.id,rect:r,scrollTop:p.scrollTop,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight};
    }
    const pane=n.closest('#hd-city-menu-person-details,#hd-city-menu-tool-details');
    for(const toolbar of pane?.querySelectorAll('.hd-city-menu-person-property-controls,.hd-city-menu-tool-controls')||[]){
      const s=getComputedStyle(toolbar),r=rect(toolbar);
      if(toolbar.contains(n)||toolbar.hidden||s.position!=='sticky'||s.display==='none'||s.visibility==='hidden'||r.width<=0||r.height<=0||r.right<=b.left||r.left>=b.right)continue;
      if(s.top==='0px'&&r.top<=clip.top+.5&&r.bottom>clip.top){clip.top=Math.max(clip.top,r.bottom);ownedStickyClips.push({id:toolbar.id,edge:'top',rect:r});}
      if(s.bottom==='0px'&&r.bottom>=clip.bottom-.5&&r.top<clip.bottom){clip.bottom=Math.min(clip.bottom,r.top);ownedStickyClips.push({id:toolbar.id,edge:'bottom',rect:r});}
    }
    const x=b.left+b.width/2,y=b.top+b.height/2,hit=document.elementFromPoint(x,y);
    return {selector:${JSON.stringify(selector)},shown,disabled:!!n.disabled,rect:b,clip,scroller,ownedStickyClips,
      visible:shown&&!n.disabled&&b.left>=clip.left-.1&&b.right<=clip.right+.1&&b.top>=clip.top-.1&&b.bottom<=clip.bottom+.1&&(hit===n||n.contains(hit))};
  })()`);
  const reveal=async(selector,{control=true}={})=>{
    for(let attempt=0;attempt<36;attempt++){
      const g=await until('mounted current preview control '+selector,`document.querySelector(${JSON.stringify(selector)})&&true`,3_000).then(()=>geometry(selector));
      assert.ok(g?.shown&&!g.disabled,'Current preview control is shown and enabled '+selector);
      if(g.visible){if(control)assert.ok(g.rect.width>=43.5&&g.rect.height>=43.5,'Preview/property control >=44px');return g;}
      assert.ok(g.scroller?.id,'Clipped preview control has a genuine identified scroll container');
      const down=g.rect.bottom>g.clip.bottom;
      if(!down&&g.rect.top>=g.clip.top){entry.geometryFailures??=[];entry.geometryFailures.push(g);throw Error('No scroll around unrelated obstruction '+selector);}
      const before=await sample(),r=g.scroller.rect,top=Math.max(r.top,g.clip.top),bottom=Math.min(r.bottom,g.clip.bottom);
      assert.ok(bottom-top>=44,'Real preview scroll area is tall enough for a trusted pan');
      const x=Math.min(r.right,g.clip.right)-12,y=top+(bottom-top)*(down?.8:.2),end=top+(bottom-top)*(down?.2:.8);
      assert.equal(await evaluate(`(() => {const p=document.getElementById(${JSON.stringify(g.scroller.id)}),h=document.elementFromPoint(${x},${y});return !!p&&(h===p||p.contains(h));})()`),true);
      await touches('touchStart',[{x,y}]);for(let i=1;i<=6;i++)await touches('touchMove',[{x,y:y+(end-y)*i/6}]);await touches('touchEnd');
      const after=await sample(),keys=await readKeys(before.state.keyCount),scrollTop=await evaluate(`document.getElementById(${JSON.stringify(g.scroller.id)}).scrollTop`);
      assert.deepEqual(keys,[],'Content pan never selects, pages or confirms');assert.deepEqual(after.native,before.native,'Content pan preserves the native owner and cursor');
      assert.notEqual(scrollTop,g.scroller.scrollTop,'Actual trusted pan moves the scroller');
      entry.scrollChecks.push({selector,geometry:g,before,after,scrollTop,keys});
    }
    throw Error('Preview control remains clipped after bounded actual pans '+selector);
  };
  const ownerSame=(before,after)=>{
    for(const k of ['active','seq','context','kind','generation','detailGeneration','count','idsValid'])assert.equal(after.state.menu[k],before.state.menu[k],'Preview keeps native menu '+k);
    assert.deepEqual(after.state.menu.ids,before.state.menu.ids);assert.deepEqual(after.state.menu.names,before.state.menu.names);
  };
  const attributes=async kind=>{
    const s=await sample(),m=s.state.menu,n=kind===3?s.attributes.person:s.attributes.goods,u=kind===3?s.state.cityUi.personProperties:s.state.cityUi.toolDetail;
    assert.ok(m.active===1&&m.context===1&&m.kind===kind&&m.idsValid&&n.active===1&&u,'Current complete native detail and HD presentation');
    assert.equal(n.menuSeq,m.seq);assert.equal(n.index,m.index);assert.equal(n.generation,m.detailGeneration);assert.equal(n.detailGeneration,m.detailGeneration);
    assert.equal(u.ownerKey,s.state.cityUi.deepMenuOwner.key);assert.equal(u.seq,m.seq);assert.equal(u.context,1);assert.equal(u.kind,kind);
    assert.equal(u.generation,n.generation);assert.equal(u.detailGeneration,n.detailGeneration);
    if(kind===3){assert.equal(u.paintSeq,n.paintSeq);assert.equal(u.pageIndex,n.pageIndex);}
    assert.equal(kind===3?n.person:n.tool,m.ids[m.index]);assert.equal(kind===3?u.personIndex:u.toolIndex,m.ids[m.index]);
    assert.equal(u.nativeIndex,m.index);assert.equal(u.name,n.name);assert.equal(u.propertyCount,n.propertyCount);
    for(const k of ['pageStart','pageEnd'])assert.equal(u[k],n[k]);
    for(let i=0;i<n.propertyCount;i++){
      const p=n.properties[i],v=u.properties[i];assert.equal(v.captured,p.captured);
      if(p.captured){assert.equal(v.title,p.title||'属性 '+(i+1)+'（标题为空）');assert.equal(v.value,p.value||'（空）');}
      if(kind===3){assert.equal(v.current,p.captured&&p.titlePaintSeq===n.paintSeq&&p.valuePaintSeq===n.paintSeq);}
    }
    const dom=await evaluate(`(() => {const kind=${kind},root=document.getElementById(kind===3?'hd-city-menu-person-properties-fields':'hd-city-menu-tool-fields');
      return {name:document.getElementById(kind===3?'hd-city-menu-person-name':'hd-city-menu-tool-name')?.textContent,
        text:root?.textContent,rows:kind===3?[...root.querySelectorAll('[data-hd-person-property]')].map(r=>({index:Number(r.getAttribute('data-hd-person-property')),current:r.getAttribute('data-hd-person-property-current'),title:r.querySelector('span')?.textContent,value:r.querySelector('strong')?.textContent})):
          [...root.querySelector('.hd-city-menu-info-group').querySelectorAll('.hd-city-menu-stat')].map((r,index)=>({index,title:r.querySelector('span')?.textContent,value:r.querySelector('strong')?.textContent}))};})()`);
    assert.equal(dom.name,n.name);assert.ok(dom.text);
    if(kind===3){assert.equal(n.pageComplete,1);assert.equal(dom.rows.length,n.propertyCount);
      for(let i=n.pageStart;i<n.pageEnd;i++){assert.equal(dom.rows[i].title,n.properties[i].title);assert.equal(dom.rows[i].value,n.properties[i].value);assert.equal(dom.rows[i].current,'1');}}
    else {assert.equal(dom.rows.length,n.propertyCount);for(const p of n.properties.filter(p=>p.captured)){assert.equal(dom.rows[p.index].title,p.title);assert.equal(dom.rows[p.index].value,p.value,'Captured goods value rendered on its actual property row');}}
    return {sample:s,dom};
  };
  const preview=async(kind,index)=>{
    const before=await sample(),m=before.state.menu,selector=`#hd-city-menu [data-hd-deep-preview="${index}"]`;
    const geo=await reveal(selector);await touchButton(selector);
    await until('actual preview focus and current detail',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),d=${kind===3?'s.personProperties':'s.toolDetail'};
      return m.active===1&&m.context===1&&m.kind===${kind}&&m.seq===${m.seq}&&m.index===${index}&&!s.sending&&!s.queueLen&&d&&d.nativeIndex===m.index&&${kind===3?'d.personIndex':'d.toolIndex'}===m.ids[m.index];})()`);
    const details=await attributes(kind),after=details.sample,keys=await readKeys(before.state.keyCount),distance=index-m.index;
    assert.deepEqual(keys.map(k=>k.code),Array(Math.abs(distance)).fill(distance>0?0x23:0x22),'Preview sends only exact native focus arrows, never Enter');ownerSame(before,after);
    assert.equal(after.state.qty.active,0);assert.equal(after.state.report.active,0);
    entry.checks.push({kind:'preview',menuKind:kind,index,personOrTool:m.ids[index],geometry:geo,before,after,keys,dom:details.dom});
    await snap((kind===3?'person':'tool')+'-'+m.ids[index]+'-preview');return after;
  };
  const page=async(kind,direction)=>{
    const first=await attributes(kind),before=first.sample,n=kind===3?before.attributes.person:before.attributes.goods;
    const selector=`#hd-city-menu [data-hd-${kind===3?'person':'tool'}-page="${direction}"]`,geo=await reveal(selector);
    await touchButton(selector);
    await until('native explicit property page ACK',`(() => {const n=baye.hd.${kind===3?'personProperties':'goods'}();return n.active===1&&n.menuSeq===${n.menuSeq}&&n.index===${n.index}&&n.pageStart!==${n.pageStart}&&n;})()`);
    const details=await attributes(kind),after=details.sample,next=kind===3?after.attributes.person:after.attributes.goods,keys=await readKeys(before.state.keyCount);
    assert.deepEqual(keys.map(k=>k.code),[direction==='next'?0x25:0x24]);ownerSame(before,after);assert.equal(after.state.menu.index,before.state.menu.index);
    assert.equal(direction==='next'?next.pageStart:next.pageEnd,direction==='next'?n.pageEnd:n.pageStart,'Explicit page advances exactly one native property range');
    if(kind===3){assert.notEqual(next.paintSeq,n.paintSeq);assert.equal(next.person,n.person);}
    else assert.equal(next.tool,n.tool);
    entry.checks.push({kind:'property-page',menuKind:kind,direction,geometry:geo,before,after,keys,dom:details.dom});return next;
  };
  const allPages=async kind=>{
    const readCurrent=async n=>{
      for(let i=n.pageStart;i<n.pageEnd;i++){
        const selector=kind===3?`#hd-city-menu [data-hd-person-property="${i}"]`:
          `#hd-city-menu-tool-fields .hd-city-menu-info-group:first-of-type .hd-city-menu-stat:nth-child(${i+1})`;
        const g=await reveal(selector,{control:false});
        entry.checks.push({kind:'visible-current-property',menuKind:kind,index:i,geometry:g,attributes:n.properties[i],paintSeq:n.paintSeq});
      }
    };
    let current=(await attributes(kind)).sample.attributes[kind===3?'person':'goods'];
    for(let i=0;current.pageStart>0;i++){assert.ok(i<16);current=await page(kind,'prev');}
    await readCurrent(current);
    for(let i=0;current.pageEnd<current.propertyCount;i++){assert.ok(i<16);current=await page(kind,'next');await readCurrent(current);}
    assert.equal(current.complete,1,'All actual native attributes captured through deliberate touch paging');
    entry.checks.push({kind:'complete-properties',menuKind:kind,attributes:current});await snap((kind===3?'person':'tool')+'-'+(kind===3?current.person:current.tool)+'-all-properties');
    if(current.pageStart>0)await page(kind,'prev');
  };
  await root(0,'内政');const picker=await submenu('搜寻');assert.ok(picker.state.menu.ids.length>=2);
  const equipped=picker.state.menu.ids.find(id=>picker.world.people[id].Tool1>0&&picker.world.people[id].Tool2>0);
  assert.ok(Number.isInteger(equipped),'Fresh resident has two actual equipped tools; no initial equipment compaction');
  const target=picker.state.menu.ids.indexOf(equipped),other=target===0?1:0;
  await preview(3,picker.state.menu.index);
  const blockedSelector=`#hd-city-menu [data-hd-deep-preview="${target}"]`;await reveal(blockedSelector);
  for(const mode of ['touchcancel','untrusted-click']){
    const before=await sample();
    if(mode==='touchcancel'){await touches('touchStart',[await controlPoint(blockedSelector)]);await touches('touchCancel');}
    else await evaluate(`document.querySelector(${JSON.stringify(blockedSelector)}).click()`);
    const after=await sample(),keys=await readKeys(before.state.keyCount);assert.deepEqual(keys,[]);assert.deepEqual(after.native,before.native);
    entry.checks.push({kind:'negative-'+mode,before,after,keys});
  }
  await preview(3,target);await allPages(3);await preview(3,other);
  await back(label+' searched person cancel');await mapReturn(label+' searched person return');
  await root(0,'内政');const confiscate=await submenu('没收');
  assert.ok(confiscate.world.people[equipped].Tool1>0&&confiscate.world.people[equipped].Tool2>0);
  const selection=await selectPerson(equipped,'没收');
  await until('actual equipped goods owner',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===4&&m.idsValid&&m.ids.length===2&&!s.sending&&!s.queueLen&&s.toolDetail&&s.toolDetail.nativeIndex===m.index;})()`);
  const goods=await sample();navigation(await readKeys(selection.before.state.keyCount),'Necessary native person confirmation only to open equipped goods');
  const actualEquipment=confiscate.world.people[equipped];assert.deepEqual(goods.state.menu.ids,[actualEquipment.Tool1-1,actualEquipment.Tool2-1]);
  entry.goodsEntry={before:selection.before,after:goods,personId:equipped,keys:await readKeys(selection.before.state.keyCount)};
  await preview(4,0);await allPages(4);await preview(4,1);await allPages(4);
  await back(label+' equipped goods cancel');
  await until('goods cancellation publishes a fresh complete person picker',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner;
    return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.seq!==${confiscate.state.menu.seq}&&m.seq!==${goods.state.menu.seq}&&
      m.index===${selection.index}&&s.open&&s.layer==='deep'&&!s.sending&&!s.queueLen&&o&&o.seq===m.seq&&o.kind===3&&o.detailGeneration===m.detailGeneration&&
      s.deepItems.length===m.ids.length&&m.ids.every((id,i)=>s.deepItems.find(v=>v.i===i)?.pind===id);})()`);
  entry.returnedPerson=await sample();assert.deepEqual(entry.returnedPerson.state.menu.ids,confiscate.state.menu.ids);
  assert.deepEqual(entry.returnedPerson.state.menu.names,confiscate.state.menu.names);assert.equal(entry.returnedPerson.state.menu.ids[entry.returnedPerson.state.menu.index],equipped);
  await back(label+' confiscation person cancel');await mapReturn(label+' goods return');
  entry.returned=await sample();assert.equal(entry.returned.state.hud.visible,true);
  for(const [k,v]of Object.entries(entry.returned.state.expected))assert.equal(entry.returned.state.hud[k],v,'Returned preview HUD matches native '+k);
  assert.deepEqual(entry.returned.world,entry.baseline.world);entry.accepted=true;await snap('map');
}
