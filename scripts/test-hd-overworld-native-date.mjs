import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// Default is the applied product file. For a pre-apply candidate check only,
// BAYE_HD_DATE_SOURCE may select the reviewable candidate; no old-byte lock.
function sourceRoot(){let at=path.dirname(fileURLToPath(import.meta.url));for(let n=0;n<7;n++){if(fs.existsSync(path.join(at,'js/hd-overworld.js')))return at;const parent=path.dirname(at);if(parent===at)break;at=parent;}throw Error('Product source root missing');}
const root=sourceRoot(),productPath=process.env.BAYE_HD_DATE_SOURCE?path.resolve(root,process.env.BAYE_HD_DATE_SOURCE):path.join(root,'js/hd-overworld.js'),product=fs.readFileSync(productPath,'utf8');
function block(source,start,end){const a=source.indexOf('    function '+start+'('),b=source.indexOf('    function '+end+'(',a);assert.ok(a>=0&&b>a,'Applied product date function '+start);return source.slice(a,b);}
function literal(name){const row=product.split('\n').find(l=>l.trim().startsWith('var '+name+' = '));assert.ok(row,name);return vm.compileFunction('return ('+row.slice(row.indexOf('=')+1).trim().replace(/;$/,'')+');')();}
const shared=block(product,'probe','writeNumber'),dateSource=block(product,'validDateInteger','kingLabel');
const args=['global','engineData','state','YEAR_FIELDS','MONTH_FIELDS','DATE_OBJECT_FIELDS','PERIOD_NAMES','BayeHdOverworldProbe'];
const factory=vm.compileFunction(shared+dateSource+'return {refreshDateInfo,dateLabel,validDateInteger};',args),yearFields=literal('YEAR_FIELDS'),monthFields=literal('MONTH_FIELDS'),dateFields=literal('DATE_OBJECT_FIELDS'),periodNames=literal('PERIOD_NAMES');
function setup(data,probe=null){const ui={dateInfo:null},g=probe?{BayeHdOverworldProbe:probe}:{},api=factory(g,()=>data,ui,yearFields,monthFields,dateFields,periodNames,probe);return {...api,ui,data};}
function fresh(data,probe=null){const before=structuredClone(data),api=setup(data,probe);const info=api.refreshDateInfo();assert.deepEqual(data,before,'HUD reads do not mutate original world/mock fields');assert.equal(api.ui.dateInfo,info);return {info,label:api.dateLabel()};}
test('applied product script parses and executes its real date functions without historical-byte dependency',()=>{new vm.Script(product,{filename:productPath});assert.equal(setup({g_YearDate:237,g_MonthDate:3}).refreshDateInfo().year,237);});
test('original canonical237/2 is rendered after a fresh read of the applied product',()=>{const actual=fresh({g_YearDate:237,g_MonthDate:2,g_PIdx:4});assert.equal(actual.info.year,237);assert.equal(actual.info.month,2);assert.equal(actual.info.yearPath,'g_YearDate');assert.equal(actual.info.monthPath,'g_MonthDate');assert.equal(actual.info.source,'native');assert.equal(actual.label,'237年2月');});
for(const year of [1,184,220,221,237,299,65535])test('canonical original U16 year'+year+' remains displayable',()=>{const {info,label}=fresh({g_YearDate:year,g_MonthDate:2,g_PIdx:4});assert.equal(info.year,year);assert.equal(info.month,2);assert.equal(label,year+'年2月');});
for(const year of [NaN,Infinity,-Infinity,-1,0,65536,210.5,237.5,undefined,null])test('invalid canonical year '+String(year)+' is not accepted',()=>{const {info,label}=fresh({g_YearDate:year,g_MonthDate:2,g_PIdx:4});assert.equal(info.year,null);assert.equal(info.yearPath,null);assert.match(label,/年月未探测到/);});
for(const month of [NaN,Infinity,-Infinity,-1,0,13,2.5,undefined,null])test('invalid canonical month '+String(month)+' is not accepted',()=>{const {info,label}=fresh({g_YearDate:237,g_MonthDate:month,g_PIdx:4});assert.equal(info.year,237);assert.equal(info.month,null);assert.equal(info.monthPath,null);assert.equal(label,'237年');});
for(const month of [1,2,12])test('canonical native month'+month+' uses exact original value',()=>{const {info,label}=fresh({g_YearDate:237,g_MonthDate:month});assert.equal(info.month,month);assert.equal(label,'237年'+month+'月');});
test('known native year beats narrow alias/probe fields without changing their guesses',()=>{const guess={year:{name:'guessYear',value:210},month:{name:'guessMonth',value:3}},before=structuredClone(guess),r=fresh({g_YearDate:237,g_MonthDate:2,year:211,month:4},{guessDate:()=>guess});assert.equal(r.info.year,237);assert.equal(r.info.month,2);assert.equal(r.info.source,'native');assert.deepEqual(guess,before);});
for(const year of [221,237,65535,210.5,-1,0])test('unknown alias year'+year+' retains narrow integer heuristic',()=>{const {info}=fresh({year,month:2});assert.equal(info.year,null);});
for(const year of [184,210,220])test('legacy alias year'+year+' remains narrow supported fallback',()=>{const {info,label}=fresh({year,month:2});assert.equal(info.year,year);assert.equal(info.yearPath,'year');assert.equal(info.month,2);assert.equal(label,year+'年2月');});
for(const year of [221,237,65535,210.5,NaN])test('unknown guessed year'+String(year)+' is not broadened to native range',()=>{const guess={year:{name:'guessYear',value:year},month:{name:'guessMonth',value:2}},{info}=fresh({}, {guessDate:()=>guess});assert.equal(info.year,null);assert.equal(info.month,2);});
test('unknown guessed historical integer210 remains narrow fallback',()=>{const {info}=fresh({}, {guessDate:()=>({year:{name:'guessYear',value:210},month:{name:'guessMonth',value:2}})});assert.equal(info.year,210);assert.equal(info.month,2);});
for(const month of [0,13,2.5,NaN])test('unknown guessed invalid month'+String(month)+' is rejected',()=>{const {info}=fresh({}, {guessDate:()=>({year:{name:'guessYear',value:210},month:{name:'guessMonth',value:month}})});assert.equal(info.month,null);});
test('same exact refresh function follows fresh canonical original dates without UI keys or native setters',()=>{const data={g_YearDate:237,g_MonthDate:12},api=setup(data);assert.deepEqual([api.refreshDateInfo().year,api.ui.dateInfo.month],[237,12]);assert.equal(api.dateLabel(),'237年12月');data.g_YearDate=238;data.g_MonthDate=1;assert.deepEqual([api.refreshDateInfo().year,api.ui.dateInfo.month],[238,1]);assert.equal(api.dateLabel(),'238年1月');assert.deepEqual(data,{g_YearDate:238,g_MonthDate:1});});
test('undefined engine data stays unknown without fabricating any campaign date',()=>{const api=setup(null),info=api.refreshDateInfo();assert.deepEqual(info,{year:null,month:null,yearPath:null,monthPath:null,source:'none'});assert.equal(api.dateLabel(),'年月未探测到');});

// Same VM DOM approach as test-hd-overworld-identity.mjs: execute the complete
// product IIFE, exporting only internal test access at its existing final fence.
// Calling the actual updateHud assigns actual DOM-node textContent. This does
// not claim browser/WASM/native LOAD or pixel acceptance.
function domHarness(initial){
  let raw=structuredClone(initial),writes=[];
  const data=new Proxy({}, {get:(_,k)=>raw[k],set:(_,k)=>{writes.push(k);throw Error('Unexpected native write '+String(k));}});
  const nodes=new Map(),docAttrs=new Map(),events=[];
  function element(id){let text='';const changes=[];return {id,changes,get textContent(){return text;},set textContent(value){text=String(value);changes.push(text);},setAttribute:(k,v)=>docAttrs.set(k,String(v)),style:{setProperty(){}}};}
  for(const id of ['hd-overworld-hud-left','hd-overworld-hud-right'])nodes.set(id,element(id));
  const document={hidden:false,documentElement:element('html'),getElementById:id=>nodes.get(id)||null};
  const context=vm.createContext({document,console:{log(){},warn(){}},localStorage:{getItem:()=>null,setItem(){throw Error('Unexpected preference write');}},addEventListener:(...x)=>events.push(x),baye:{data,ensureData:()=>data,hd:{ready:()=>true}},sendKey:()=>{throw Error('Unexpected native key');}});context.window=context;
  const fenced=product.replace(/\}\)\(window\);\s*$/,'global.__dateHudTest={state,refreshDateInfo,dateLabel,updateHud};\n})(window);');assert.notEqual(fenced,product,'Only final product IIFE fence is instrumented');
  vm.runInContext(fenced,context,{filename:productPath});
  const api=context.__dateHudTest;api.state.hudLeft=nodes.get('hd-overworld-hud-left');api.state.hudRight=nodes.get('hd-overworld-hud-right');api.state.phase='map';
  return {api,nodes,writes,read:()=>structuredClone(raw),replaceDate:data=>{raw=structuredClone(data);},render(){api.refreshDateInfo();api.updateHud();return nodes.get('hd-overworld-hud-left').textContent;}};
}
test('full product IIFE refresh and real updateHud write237year to DOM textContent without game input/write',()=>{const h=domHarness({g_YearDate:237,g_MonthDate:2,g_PIdx:4}),before=h.read();assert.equal(h.render(),'237年2月');assert.deepEqual(h.nodes.get('hd-overworld-hud-left').changes,['237年2月']);assert.match(h.nodes.get('hd-overworld-hud-right').textContent,/己方 0\/0 城/);assert.deepEqual(h.read(),before);assert.deepEqual(h.writes,[]);});
test('full product DOM updates loaded-date replacements and natural year boundary in the same cached HUD',()=>{const h=domHarness({g_YearDate:220,g_MonthDate:12});assert.equal(h.render(),'220年12月');for(const data of [{g_YearDate:221,g_MonthDate:1},{g_YearDate:237,g_MonthDate:3},{g_YearDate:237,g_MonthDate:12},{g_YearDate:238,g_MonthDate:1}]){h.replaceDate(data);assert.equal(h.render(),data.g_YearDate+'年'+data.g_MonthDate+'月');}assert.deepEqual(h.writes,[]);});
test('full product DOM keeps invalid native dates unknown and generic aliases historically narrow',()=>{for(const year of [NaN,237.5,-1,65536]){const h=domHarness({g_YearDate:year,g_MonthDate:2,g_PIdx:4});assert.match(h.render(),/年月未探测到/);assert.equal(h.api.state.dateInfo.year,null);assert.deepEqual(h.writes,[]);}const alias=domHarness({year:237,month:2});assert.match(alias.render(),/年月未探测到/);alias.replaceDate({year:210,month:2});assert.equal(alias.render(),'210年2月');});
test('full product DOM canonical native fields override alias guesses and reject fractional month',()=>{const h=domHarness({g_YearDate:237,g_MonthDate:3,year:210,month:2});assert.equal(h.render(),'237年3月');assert.equal(h.api.state.dateInfo.source,'native');h.replaceDate({g_YearDate:237,g_MonthDate:3.5});assert.equal(h.render(),'237年');assert.equal(h.api.state.dateInfo.month,null);assert.deepEqual(h.writes,[]);});
