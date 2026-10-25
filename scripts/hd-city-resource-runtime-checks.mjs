// Read-only current native CITY resource rows; no presentation or world setters.
import assert from 'node:assert/strict';

const fields=['Money','Food','MothballArms','Persons','Tools'];
const labels=['金钱','粮食','预备兵','城内人物','城内道具'];

export async function checkCityResourceIcons(ctx,driver,entry,cityIndex) {
  const {evaluate,until,readKeys}=ctx,before=await driver.sample(),m=before.state.menu,ui=before.state.cityUi;
  assert.ok(m.active===1&&m.context===1&&m.kind===1,'Resource presentation retains the real CITY root owner');
  assert.ok(ui.open&&ui.layer==='status'&&ui.cityIndex===cityIndex,'Current selected city status');
  const city=before.world.cities[cityIndex];assert.ok(city);
  const expected=fields.map((field,index)=>{assert.ok(Number.isInteger(city[field])&&city[field]>=0,'Measured native city '+field);return{field,title:labels[index],value:String(city[field])};});
  await until('five current native city resource rows',`(() => {const s=BayeHdCityMenu.debugSnapshot(),p=document.getElementById('hd-city-menu-status');return s.open&&s.layer==='status'&&s.cityIndex===${cityIndex}&&p&&!p.hidden&&p.querySelectorAll('[data-hd-city-resource]').length===5;})()`);
  const snapshot=await evaluate('BayeHdCityMenu.debugSnapshot().cityDetails');assert.ok(snapshot);assert.equal(snapshot.cityIndex,cityIndex);
  const group=snapshot.groups.find(g=>g.title==='资源与军备');assert.ok(group);assert.deepEqual(group.rows,expected.map(e=>[e.title,e.value]));
  const dom=await evaluate(`(() => {const pane=document.getElementById('hd-city-menu-status');return{hidden:pane.hidden,icons:pane.querySelectorAll('svg').length,rows:[...pane.querySelectorAll('[data-hd-city-resource]')].map(row=>{
    const label=row.querySelector('span'),value=row.querySelector('strong'),svgs=label?[...label.querySelectorAll('svg')]:[];return{field:row.getAttribute('data-hd-city-resource'),title:label?.textContent,value:value?.textContent,icons:svgs.map(s=>({namespace:s.namespaceURI,field:s.getAttribute('data-hd-city-resource-icon'),ariaHidden:s.getAttribute('aria-hidden'),focusable:s.getAttribute('focusable'),title:s.getAttribute('title'),titleCount:s.querySelectorAll('title').length,ariaLabel:s.getAttribute('aria-label'),ariaLabelledBy:s.getAttribute('aria-labelledby'),tabIndex:s.getAttribute('tabindex'),labelledDescendants:s.querySelectorAll('[aria-label],[aria-labelledby]').length,interactiveDescendants:s.querySelectorAll('a,button,input,select,textarea,[tabindex],[contenteditable],[role="button"],[role="link"]').length}))};})};})()`);
  assert.equal(dom.hidden,false);assert.equal(dom.icons,5);assert.deepEqual(dom.rows.map(r=>r.field),fields);
  const visible=[];
  for(const [index,e]of expected.entries()){
    const row=dom.rows[index];assert.equal(row.title,e.title);assert.equal(row.value,e.value);assert.equal(row.icons.length,1);
    const icon=row.icons[0];assert.equal(icon.namespace,'http://www.w3.org/2000/svg');assert.equal(icon.field,e.field);
    assert.equal(icon.ariaHidden,'true');assert.equal(icon.focusable,'false');assert.equal(icon.title,null);assert.equal(icon.titleCount,0);assert.equal(icon.ariaLabel,null);assert.equal(icon.ariaLabelledBy,null);assert.equal(icon.tabIndex,null);assert.equal(icon.labelledDescendants,0);assert.equal(icon.interactiveDescendants,0);
    const selector=`#hd-city-menu-status [data-hd-city-resource="${e.field}"]`,geometry=await driver.reveal(selector,{control:false});assert.ok(geometry.visible,'Every resource row is genuinely revealed');
    const decoration=await evaluate(`(() => {const row=document.querySelector(${JSON.stringify(selector)}),label=row?.querySelector('span'),value=row?.querySelector('strong'),icons=label?[...label.querySelectorAll('svg')]:[],icon=icons[0];if(!row||!label||!value||!icon)return null;
      const rect=n=>{const r=n.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},s=getComputedStyle(icon);
      return{field:row.getAttribute('data-hd-city-resource'),title:label.textContent,value:value.textContent,svgCount:icons.length,iconField:icon.getAttribute('data-hd-city-resource-icon'),bounds:{row:rect(row),label:rect(label),value:rect(value),icon:rect(icon),viewport:{left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight}},iconStyle:{pointerEvents:s.pointerEvents,width:s.width,height:s.height,fontSize:s.fontSize},textWidths:{label:{client:label.clientWidth,scroll:label.scrollWidth},value:{client:value.clientWidth,scroll:value.scrollWidth}}};})()`);
    assert.ok(decoration);assert.equal(decoration.field,e.field);assert.equal(decoration.title,e.title);assert.equal(decoration.value,e.value);assert.equal(decoration.svgCount,1);assert.equal(decoration.iconField,e.field);
    const epsilon=.5,b=decoration.bounds,contains=(outer,inner)=>inner.left>=outer.left-epsilon&&inner.right<=outer.right+epsilon&&inner.top>=outer.top-epsilon&&inner.bottom<=outer.bottom+epsilon;
    for(const name of ['row','label','value','icon','viewport']){const r=b[name];assert.ok(r&&['left','top','right','bottom','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0,'Positive finite resource '+name+' rectangle');}
    for(const name of ['label','value','icon']){assert.ok(contains(b.row,b[name]),'Resource '+name+' is inside its row');assert.ok(contains(b.viewport,b[name]),'Resource '+name+' is inside the viewport');}
    assert.ok(contains(b.label,b.icon));assert.ok(b.label.right<=b.value.left+epsilon,'Resource label and value do not overlap');assert.equal(decoration.iconStyle.pointerEvents,'none');
    const em=Number.parseFloat(decoration.iconStyle.fontSize),width=Number.parseFloat(decoration.iconStyle.width),height=Number.parseFloat(decoration.iconStyle.height);assert.ok([em,width,height].every(n=>Number.isFinite(n)&&n>0)&&Math.abs(width-em)<=epsilon&&Math.abs(height-em)<=epsilon,'Resource SVG is one computed em');
    for(const name of ['label','value'])assert.ok(decoration.textWidths[name].scroll<=decoration.textWidths[name].client+epsilon,'Resource text has no horizontal overflow');
    visible.push({...e,geometry,decoration});if(index===0||index===expected.length-1)await driver.snap('city-resource-'+e.field);
  }
  const after=await driver.sample(),keys=await readKeys(before.state.keyCount);assert.deepEqual(keys,[],'Reading and scrolling resources emits no native key');assert.deepEqual(after.native,before.native,'Resource rows preserve the whole measured native owner/cursor');assert.deepEqual(after.world,before.world,'Resource rows preserve the whole measured native world');assert.equal(after.state.touchCount,before.state.touchCount,'Resource rows leak no LCD touch');
  const evidence={cityIndex,expected,snapshot,dom,visible,before,after,keys,accepted:true};entry.resourceIcons=evidence;return evidence;
}
