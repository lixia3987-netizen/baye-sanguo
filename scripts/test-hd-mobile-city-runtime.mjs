#!/usr/bin/env node
// Original mobile CITY touch runtime. Native actions use trusted CDP touch; boot uses public title keys. Importing this file does not launch or sample an OS process.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {snapshotOwnedChrome, cleanupOwnedChrome} from './hd-runtime-owned-chrome.mjs';
import {writeJsonAtomicSync} from './hd-runtime-json.mjs';
import {checkMobileQuantityPresentation} from './hd-mobile-quantity-runtime-checks.mjs';

const ORIGINAL_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const MOBILE_PREF = 'baye/mobileOverworldMode', PC_PREF = 'baye/overworldMode';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Node HTTP accepts Chrome debugging ports that the Fetch forbidden-port list rejects.
export function readChromePageTargets(port, timeoutMs = 1_000) {
  return new Promise((resolve, reject) => {
    let request, done = false;
    const finish = (error, targets) => {
      if (done) return;
      done = true; clearTimeout(deadline);
      if (error) { request?.destroy(); reject(error); } else resolve(targets);
    };
    const deadline = setTimeout(() => finish(new Error('Private Chrome /json/list timed out after '+timeoutMs+'ms')), timeoutMs);
    try {
      request = http.get({hostname:'127.0.0.1',port,path:'/json/list'}, response => {
        if (response.statusCode !== 200) {
          response.resume(); finish(new Error('Private Chrome /json/list HTTP '+response.statusCode)); return;
        }
        const chunks = []; let bytes = 0;
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 1_048_576) { finish(new Error('Private Chrome /json/list exceeded 1MiB')); return; }
          chunks.push(chunk);
        });
        response.on('error', error => finish(error));
        response.on('end', () => {
          try {
            const targets = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!Array.isArray(targets)) throw new Error('Private Chrome /json/list is not an array');
            finish(null, targets);
          } catch (error) { finish(error); }
        });
      });
      request.on('error', error => finish(error));
    } catch (error) { finish(error); }
  });
}

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.png':'image/png'};

// The native king list uses zero-based person IDs; City.Belong is that ID plus one.
export function chooseMultiCityKing(snapshot) {
  assert.ok(snapshot && Array.isArray(snapshot.kings) && Array.isArray(snapshot.cities));
  assert.equal(snapshot.cities.length,38,'Original first-period city census');
  assert.ok(snapshot.cities.every(c=>Number.isInteger(c.belong)&&c.belong>=0&&c.belong<=200));
  const candidates=snapshot.kings.map((k,index)=>{
    assert.ok(Number.isInteger(k.id)&&k.id>=0&&k.id<200,'Actual native king ID');
    return {...k,index,ownedCount:snapshot.cities.filter(c=>c.belong===k.id+1).length};
  }).filter(k=>k.ownedCount>=2&&k.ownedCount<38);
  const selected=candidates.find(k=>k.name==='董卓')||candidates[0];
  assert.ok(selected,'A genuine selectable king with at least two owned cities is required');
  return {selected,candidates};
}

// Persistent evidence contains command lines only for independently verified owned processes.
const identity = p => ({ProcessId:p.ProcessId, ParentProcessId:p.ParentProcessId,
  CreationDate:p.CreationDate, ExecutablePath:p.ExecutablePath});
function persistOwnership(s, sameRoot) {
  return {schemaVersion:s.schemaVersion,rootPid:s.rootPid,profile:s.profile,sampledAt:s.sampledAt,
    rootVerified:s.rootVerified && sameRoot,sameRoot,owned:sameRoot && s.rootVerified ? s.owned : [],
    excludedIdentities:s.excluded.map(identity),profileMatchIdentities:s.profileMatches.map(identity)};
}
function persistCleanup(p, basis) {
  const recorded = q => basis.owned.some(o => o.ProcessId===q.ProcessId && o.CreationDate===q.CreationDate &&
    o.ExecutablePath===q.ExecutablePath && o.CommandLine===q.CommandLine);
  return {schemaVersion:p.schemaVersion,rootPid:p.rootPid,profile:p.profile,treeExited:p.treeExited,
    directoriesDeleted:p.directoriesDeleted,errors:p.errors,stopEvents:p.stopEvents,recordedOwned:basis.owned,
    samples:p.samples.map(s=>({stage:s.stage,sampledAt:s.sampledAt,owned:s.processes.filter(recorded),
      unrelatedCount:s.processes.filter(q=>!recorded(q)).length})),
    recheck:p.recheck && {targets:p.recheck.targets.map(identity),absent:p.recheck.absent.map(identity),
      refused:p.recheck.refused.map(q=>({recorded:identity(q.recorded),current:identity(q.current),reason:q.reason}))},
    exitVerification:p.exitVerification && {treeExited:p.exitVerification.treeExited,
      survivingRecorded:p.exitVerification.survivingRecorded.map(identity),
      rootDescendants:p.exitVerification.rootDescendants.map(identity),profileMatches:p.exitVerification.profileMatches.map(identity)}};
}


export function verifyMobileTreatWorld(before,after,cityIndex,personIndex,phase = 'retired') {
  assert.ok(phase==='report'||phase==='retired','Explicit native Treat publication phase');
  assert.ok(Number.isInteger(cityIndex)&&cityIndex>=0&&cityIndex<38);
  assert.ok(Number.isInteger(personIndex)&&personIndex>=0&&personIndex<200&&personIndex!==before.king);
  assert.equal(before.cities[cityIndex].Belong,before.king+1);
  const c=before.cities[cityIndex],p=before.people[personIndex];
  const resident=before.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons);
  assert.ok(resident.includes(personIndex)&&p.Belong===before.king+1&&c.Money>=100,'Actual resident and original public Treat budget');
  const expected=structuredClone(before);expected.cities[cityIndex].Money-=100;
  expected.people[personIndex].Thew=Math.min(100,p.Thew+50);
  if(phase==='retired')expected.people[personIndex].Devotion=Math.min(100,p.Devotion+1);
  assert.deepEqual(after,expected,'Only original nonking Treat changes at native '+phase+' phase');
  return {phase,cityIndex,personIndex,money:{before:c.Money,after:expected.cities[cityIndex].Money},
    thew:{before:p.Thew,after:expected.people[personIndex].Thew},devotion:{before:p.Devotion,after:expected.people[personIndex].Devotion}};
}

const baseWorldSource = `(() => {
  const d=baye.data,n=Number(baye.getPersonCount()),nc=Number(d.g_engineConfig.citiesCount);
  if(n!==200||nc!==38)throw Error('Original world ABI counts differ');
  const take=(o,fields)=>Object.fromEntries(fields.map(k=>{const v=Number(o[k]);if(!Number.isInteger(v))throw Error('Noninteger native '+k);return [k,v];}));
  return {period:Number(d.g_PIdx),king:Number(d.g_PlayerKing),year:Number(d.g_YearDate),month:Number(d.g_MonthDate),
    people:Array.from({length:n},(_,i)=>take(d.g_Persons[i],['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'])),
    cities:Array.from({length:nc},(_,i)=>take(d.g_Cities[i],['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'])),
    queue:Array.from(d.g_PersonsQueue,Number),fighters:Array.from(d.FIGHTERS,Number),fighterIndex:Array.from(d.FIGHTERS_IDX,Number),
    config:{enable16bitConsumeMoney:Number(d.g_engineConfig.enable16bitConsumeMoney),checkRedundantOnAddPerson:Number(d.g_engineConfig.checkRedundantOnAddPerson),
      armsPerMoney:Number(d.g_engineConfig.armsPerMoney),armsPerDevotion:Number(d.g_engineConfig.armsPerDevotion),fixOverFlow16:Number(d.g_engineConfig.fixOverFlow16),
      enableCustomRatio:Number(d.g_engineConfig.enableCustomRatio),ratioOfArmsToLevel:Number(d.g_engineConfig.ratioOfArmsToLevel),
      ratioOfArmsToAge:Number(d.g_engineConfig.ratioOfArmsToAge),ratioOfArmsToIQ:Number(d.g_engineConfig.ratioOfArmsToIQ),ratioOfArmsToForce:Number(d.g_engineConfig.ratioOfArmsToForce),
      disableExpGrowing:Number(d.g_engineConfig.disableExpGrowing),maxLevel:Number(d.g_engineConfig.maxLevel),
      disableAllPersonReport:Number(d.g_engineConfig.disableAllPersonReport)},
    orders:Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>take(d.g_OrderQueue[i],['OrderId','City','Person','Object','TimeCount','Food']))};
})()`;
const nativeWaitSource = `(() => {const d=baye.data;return {mapCity:Number(d.g_hdMapCity),mapPick:Number(d.g_hdMapPick),
  cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},menu:baye.hd.menuItems(),march:baye.hd.march(),report:baye.hd.report()};})()`;
const readSource = `(() => {
  const d=baye.data,map=window.BayeHdOverworld,rect=n=>{if(!n)return null;const r=n.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const shown=n=>{if(!n||n.hidden)return false;for(let q=n;q&&q.nodeType===1;q=q.parentElement){const s=getComputedStyle(q);if(q.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}const r=n.getBoundingClientRect();return r.width>0&&r.height>0;};
  const lcd=document.getElementById('lcd'),canvas=document.getElementById('hd-overworld-canvas'),stage=document.getElementById('hd-mobile-stage'),bar=document.getElementById('hd-mobile-bar');
  const hit=n=>{if(!shown(n))return false;const r=n.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===n;};
  const menu=baye.hd.menuItems(),march=baye.hd.march(),city=Number(d.g_hdMapCity)-1,c=city>=0&&city<38?d.g_Cities[city]:null;
  const expected=c?{city:baye.getCityName(city),owner:Number(c.Belong)?baye.getPersonName(Number(c.Belong)-1):'无主',
    date:Number(d.g_YearDate)+'年'+Number(d.g_MonthDate)+'月',money:String(Number(c.Money)),food:String(Number(c.Food)),arms:String(Number(c.MothballArms))}:null;

  const cityUi=window.BayeHdCityMenu&&BayeHdCityMenu.debugSnapshot(),dialogUi=window.BayeHdDialog&&BayeHdDialog.debugSnapshot();
  const mobileCity=window.BayeHdMobileCity&&BayeHdMobileCity.snapshot();
  const cityLayer=document.getElementById('hd-city-menu'),dialogLayer=document.getElementById('hd-dialog');
  const preferences=Object.fromEntries(['baye/overworldMode','baye/cityMenuMode','baye/mobileOverworldMode','baye/mobileCityMenuMode'].map(k=>[k,localStorage.getItem(k)]));
  return {at:performance.now(),viewport:[innerWidth,innerHeight],identity:BayeHdLibIdentity.read(),hud:BayeHdMobile.refresh(),adapter:window.BayeHdMobileMap&&BayeHdMobileMap.refresh(),expected,
    cityUi,dialogUi,mobileCity,preferences,qty:baye.hd.qty(),help:baye.hd.help(),visibility:document.visibilityState,
    fight:baye.hd.fight(),battleUi:window.BayeHdBattle&&BayeHdBattle.debugSnapshot(),mobileBattle:window.BayeHdMobileBattle&&BayeHdMobileBattle.debugSnapshot(),
    speUi:window.BayeHdSpe&&BayeHdSpe.debugSnapshot(),effectCanvas:{shown:shown(document.getElementById('hd-spe-canvas')),rect:rect(document.getElementById('hd-spe-canvas'))},
    battleCanvas:{shown:shown(document.getElementById('hd-mobile-battle-canvas')),rect:rect(document.getElementById('hd-mobile-battle-canvas'))},
    cityLayer:{shown:shown(cityLayer),rect:rect(cityLayer)},dialogLayer:{shown:shown(dialogLayer),rect:rect(dialogLayer)},
    map:map&&map.debugSnapshot(),camera:map&&{...map.getCamera()},menu,march,report:baye.hd.report(),mapCity:city,
    cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},lcd:{shown:shown(lcd),hit:hit(lcd),rect:rect(lcd),rotation:lcdRotateMode,width:lcdWidth,height:lcdHeight},
    canvas:{shown:shown(canvas),rect:rect(canvas),width:canvas&&canvas.width,height:canvas&&canvas.height},stage:rect(stage),barHeight:bar?bar.getBoundingClientRect().height:0,
    mobilePreference:localStorage.getItem('${MOBILE_PREF}'),pcPreference:localStorage.getItem('${PC_PREF}'),
    keyCount:__mobileMapKeys.length,touchCount:__mobileMapNativeTouches.length,eventCount:__mobileMapEvents.length};
})()`;
const mapReadySource = `(() => {if(!window.BayeHdOverworld||!window.BayeHdMobile)return false;
  const m=BayeHdOverworld.debugSnapshot(),n=baye.hd.menuItems(),p=baye.hd.march(),r=baye.hd.report();
  return m.mode==='hd-map'&&m.presentationReady&&m.phase==='map'&&m.hitsEnabled&&!m.aligning&&
    !n.active&&!r.active&&p.pick===1&&!p.battlePick&&BayeHdMobile.refresh().visible&&
    window.BayeHdMobileMap&&BayeHdMobileMap.refresh().active&&m;})()`;

async function connectCdp(url) {
  const address=new URL(url);assert.ok(['127.0.0.1','localhost','[::1]'].includes(address.hostname),'CDP must stay on the owned local endpoint');
  address.hostname='127.0.0.1';const ws=new WebSocket(address),pending=new Map(),listeners=new Map();let sequence=0;
  const rejectAll=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('CDP closed'));}pending.clear();};
  ws.addEventListener('close',rejectAll);
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){
    const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
  }else listeners.get(m.method)?.(m.params);});
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',event=>reject(Error('CDP connection failed: '+String(event.error?.message||event.message||'WebSocket error'))),{once:true});});
  return {on:(name,fn)=>listeners.set(name,fn),close(){rejectAll();ws.close();},send(method,params={}){
    const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},20000);
      pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}};
}
async function unusedPort() {
  const s=net.createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
  const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;
}

export async function main(args=process.argv.slice(2)) {
  const reportsOnly=args.includes('--reports-only'),portraitsOnly=args.includes('--portraits-only'),battleEffects=args.includes('--battle-effects'),battleOnly=args.includes('--battle-only')||battleEffects,marchOnly=args.includes('--march-only'),distribution=args.includes('--distribution'),recruitment=args.includes('--recruitment')||distribution;
  const previewOnly=args.includes('--preview-only');
  const systemOnly=args.includes('--system-only'),systemFlags=args.filter(arg=>arg.startsWith('--system-width=')),systemWidth=Number(systemFlags[0]?.split('=')[1]||844);
  const equipmentOnly=args.includes('--equipment-only'),equipmentFlags=args.filter(arg=>arg.startsWith('--equipment-width=')),equipmentWidth=Number(equipmentFlags[0]?.split('=')[1]||844);
  const worldSource=previewOnly||equipmentOnly||systemOnly?`(() => {const w=${baseWorldSource},d=baye.data;
    const take=(o,fields)=>Object.fromEntries(fields.map(k=>{const v=Number(o[k]);if(!Number.isInteger(v))throw Error('Noninteger goods '+k);return [k,v];}));
    return {...w,cities:w.cities.map((c,i)=>({...c,...take(d.g_Cities[i],['Tools','ToolQueue'])})),
      goodsQueue:Array.from(d.g_GoodsQueue,Number),
      tools:Array.from({length:Number(baye.getToolCount())},(_,i)=>take(d.g_Tools[i],['useflag','changeAttackRange','at','iq','move','arm']))};})()`:baseWorldSource;
  const caseFlags=args.filter(arg=>arg.startsWith('--portrait-case=')),portraitCase=caseFlags[0]?.split('=')[1]||'normal';
  const effectFlags=args.filter(arg=>arg.startsWith('--battle-effects-case=')),effectsCase=effectFlags[0]?.split('=')[1]||'normal';
  const marchFlags=args.filter(arg=>arg.startsWith('--march-width=')),marchWidth=Number(marchFlags[0]?.split('=')[1]||844);
  const options=args.filter(arg=>!['--reports-only','--portraits-only','--battle-only','--battle-effects','--march-only','--recruitment','--distribution','--preview-only','--equipment-only','--system-only'].includes(arg)&&!arg.startsWith('--portrait-case=')&&!arg.startsWith('--battle-effects-case=')&&!arg.startsWith('--march-width=')&&!arg.startsWith('--equipment-width=')&&!arg.startsWith('--system-width='));
  assert.ok(args.filter(arg=>arg==='--reports-only').length<=1&&args.filter(arg=>arg==='--portraits-only').length<=1&&
    args.filter(arg=>arg==='--battle-only'||arg==='--battle-effects').length<=1&&args.filter(arg=>arg==='--march-only').length<=1&&[reportsOnly,portraitsOnly,battleOnly,marchOnly].filter(Boolean).length<=1&&caseFlags.length<=1&&(!caseFlags.length||portraitsOnly)&&['normal','hd-missing','all-missing','delayed'].includes(portraitCase)&&
    effectFlags.length<=1&&(!effectFlags.length||battleEffects)&&['normal','hd-missing'].includes(effectsCase)&&
    marchFlags.length<=1&&(!marchFlags.length||marchOnly)&&[844,667].includes(marchWidth)&&
    args.filter(arg=>arg==='--recruitment').length<=1&&(!recruitment||![reportsOnly,portraitsOnly,battleOnly,marchOnly].some(Boolean))&&
    args.filter(arg=>arg==='--distribution').length<=1&&!(distribution&&args.includes('--recruitment'))&&
    args.filter(arg=>arg==='--preview-only').length<=1&&(!previewOnly||![reportsOnly,portraitsOnly,battleOnly,marchOnly,recruitment].some(Boolean))&&
    args.filter(arg=>arg==='--equipment-only').length<=1&&equipmentFlags.length<=1&&(!equipmentFlags.length||equipmentOnly)&&[844,667].includes(equipmentWidth)&&
    (!equipmentOnly||![previewOnly,reportsOnly,portraitsOnly,battleOnly,marchOnly,recruitment].some(Boolean))&&
    args.filter(arg=>arg==='--system-only').length<=1&&systemFlags.length<=1&&(!systemFlags.length||systemOnly)&&[844,667].includes(systemWidth)&&
    (!systemOnly||![equipmentOnly,previewOnly,reportsOnly,portraitsOnly,battleOnly,marchOnly,recruitment].some(Boolean))&&
    (options.length===0||options.length===2&&options[0]==='--artifact-dir'),'Usage: node scripts/test-hd-mobile-city-runtime.mjs [--system-only [--system-width=844|667] | --equipment-only [--equipment-width=844|667] | --preview-only | --distribution | --recruitment | --reports-only | --march-only [--march-width=844|667] | --battle-only | --battle-effects [--battle-effects-case=normal|hd-missing] | --portraits-only [--portrait-case=normal|hd-missing|all-missing|delayed]] [--artifact-dir build/new-directory]');
  const root=process.cwd(),relative=options[1]||'build/mobile-city-runtime-'+Date.now(),out=path.resolve(root,relative);
  assert.ok(out.startsWith(path.join(root,'build')+path.sep),'Artifacts must stay in a fresh build subdirectory');
  assert.ok(!fs.existsSync(out),'Preserve prior evidence: artifact directory must not already exist');fs.mkdirSync(out,{recursive:true});
  const profile=path.join(out,'private-browser-profile');fs.mkdirSync(profile);
  const report={schemaVersion:1,reportsOnly,portraitsOnly,battleOnly,battleEffects,marchOnly,recruitment,marchWidth:marchOnly?marchWidth:null,marchAccepted:false,effectsCase:battleEffects?effectsCase:null,effectsAccepted:false,portraitCase:portraitsOnly?portraitCase:null,navigationMatrixAccepted:false,scope:marchOnly?'Original mobile HD march through trusted controls with exact measured selection, cancellation and dispatch; no native writes, real-device or full-HD claim':battleOnly?'Original mobile battle with trusted emulated touch after a genuine fresh public march; no native writes, real-device or full-HD claim':portraitsOnly?'Original mobile native-owned person/report portraits, authentic reference/LCD fallback and late-image retirement; not real devices or battle':reportsOnly?'Original mobile public nonking Treat reports only: full-world two-phase effect, one trusted ACK and one natural retirement; navigation matrix not run':recruitment?'Original mobile HD CITY navigation, quantity cancellation, two Treats and two real recruitment commitments at 844x390/667x375; no month advance, real device or full-HD claim':'Original mobile HD CITY menus with trusted Chrome emulated touch, native ownership and bounded public Treat; not real Android/iOS, battle HD or all-command coverage',
    startedAt:new Date().toISOString(),ok:false,accepted:false,realDeviceAccepted:false,reportInteractionAccepted:false,recruitmentCommitted:false,battleAccepted:false,fullHdAccepted:false,
    artifacts:relative,profileRetained:true,directoriesDeleted:false,sourceFiles:[],requests:[],blockedExternal:[],console:[],exceptions:[],
    phases:[],actions:[],cities:[],inputs:[],ownershipSamples:'owned-process-samples.jsonl',user8080Accessed:false};
  report.distribution=distribution;report.distributions=[];report.distributionAccepted=false;
  report.previewOnly=previewOnly;report.previewAccepted=false;report.previewChecks=[];
  report.equipmentOnly=equipmentOnly;report.equipmentWidth=equipmentOnly?equipmentWidth:null;report.equipmentAccepted=false;report.equipmentChecks=[];
  report.systemOnly=systemOnly;report.systemWidth=systemOnly?systemWidth:null;report.systemAccepted=false;
  if(systemOnly)report.scope='Original mobile HD title, period, ruler, system and local save/load through trusted touch; independent presentation, cancelled gestures and exact recorded world restored after reload. No real-device, cloud-save, complete-ABI or full-HD acceptance.';
  if(equipmentOnly)report.scope='Original mobile CITY actual confiscation and granting at the selected emulated width, with empty/full-equipment rejection, cancellation, actual report ownership and exact recorded world deltas; no native writes, real-device, all-tool-class or full-HD acceptance';
  if(previewOnly)report.scope='Original mobile CITY person and equipped-goods preview through trusted touch with actual native focus and property paging; exact recorded world including goods queue and resource fields; no equipment commitment, native writes, real-device or full-HD claim';
  if(distribution)report.scope='Original mobile HD CITY navigation and two genuine recruitment-to-distribution flows: cancellation, target total increase, reduction and zero return at 844x390/667x375; no native writes, month advance, real-device or full-HD claim';
  const frozen=new Map(),historical=new Map();let server,chrome,cdp,ownership,rootIdentity,interrupted=false;
  const freeze=rel=>{if(frozen.has(rel))return frozen.get(rel);const filename=path.resolve(root,rel);
    assert.ok(filename.startsWith(root+path.sep));const bytes=fs.readFileSync(filename),ref={path:rel,bytes:bytes.length,sha256:sha(bytes)};
    const item={bytes,ref};frozen.set(rel,item);report.sourceFiles.push(ref);return item;};
  const write=(name,value)=>writeJsonAtomicSync(path.join(out,name),value);
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const until=async(label,expression,timeout=45000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(interrupted)throw Error('Interrupted');
    const r=await evaluate(expression);if(r)return r;await delay(100);}throw Error('Timed out '+label);};
  const sampleOwned=async label=>{if(!chrome)return;try{const s=await snapshotOwnedChrome(chrome.pid,profile),r=s.owned.find(p=>p.ProcessId===chrome.pid);
    const sameRoot=!rootIdentity || !!r&&r.CreationDate===rootIdentity.CreationDate&&r.ExecutablePath===rootIdentity.ExecutablePath&&r.CommandLine===rootIdentity.CommandLine;
    fs.appendFileSync(path.join(out,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),...persistOwnership(s,sameRoot)})+'\n');
    if(s.rootVerified&&sameRoot){ownership=s;rootIdentity||=r;for(const p of s.owned)historical.set(p.ProcessId+'|'+p.CreationDate,identity(p));}
  }catch{fs.appendFileSync(path.join(out,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),error:'Owned sampling failed; previous verified basis retained'})+'\n');}};
  const checkpoint=async name=>{const s=await evaluate(readSource);report.phases.push({name,state:s});
    const png=await cdp.send('Page.captureScreenshot',{format:'png'});const bytes=Buffer.from(png.data,'base64'),file=name+'.png';fs.writeFileSync(path.join(out,file),bytes,{flag:'wx'});
    report.phases.at(-1).screenshot={file,bytes:bytes.length,sha256:sha(bytes)};
    const canvasId=s.effectCanvas.shown?'hd-spe-canvas':s.battleCanvas.shown?'hd-mobile-battle-canvas':s.canvas.shown?'hd-overworld-canvas':s.lcd.shown?'lcd':null;
    if(canvasId){const raw=await evaluate(`(() => {const c=document.getElementById(${JSON.stringify(canvasId)}),ctx=c.getContext('2d'),colors=new Set();
      for(let y=0;y<c.height;y+=Math.max(1,Math.floor(c.height/24)))for(let x=0;x<c.width;x+=Math.max(1,Math.floor(c.width/40))){colors.add(Array.from(ctx.getImageData(x,y,1,1).data).join(','));}
      return {url:c.toDataURL('image/png'),colorCount:colors.size,width:c.width,height:c.height};})()`);
      const b=Buffer.from(raw.url.slice(raw.url.indexOf(',')+1),'base64'),rawFile=name+'-'+canvasId+'.png';fs.writeFileSync(path.join(out,rawFile),b,{flag:'wx'});
      report.phases.at(-1).actualCanvas={file:rawFile,bytes:b.length,sha256:sha(b),width:raw.width,height:raw.height,sampledColors:raw.colorCount};
      if(s.canvas.shown||s.battleCanvas.shown||s.effectCanvas.shown&&s.speUi?.source==='hd-assets')assert.ok(raw.colorCount>8,'HD canvas contains actual varied painted pixels');}
    await sampleOwned(name);console.log('PASS',name);return s;};
  const key=async(code,reason)=>{report.inputs.push({type:'public native key',code,reason});await evaluate('sendKey('+code+')');await delay(160);};
  const metrics=async(width,height)=>{report.inputs.push({type:'CDP viewport',width,height});await cdp.send('Emulation.setDeviceMetricsOverride',{
    width,height,deviceScaleFactor:1,mobile:true,screenOrientation:{type:width>height?'landscapePrimary':'portraitPrimary',angle:width>height?90:0}});await delay(250);};
  const touches=async(type,points=[])=>{report.inputs.push({type:'trusted CDP '+type,points});await cdp.send('Input.dispatchTouchEvent',{
    type,touchPoints:points.map(p=>({x:p.x,y:p.y,id:p.id??1,radiusX:1,radiusY:1}))});await delay(90);};
  const tap=async(point,jitter=false)=>{await touches('touchStart',[{x:point.x,y:point.y}]);
    if(jitter)await touches('touchMove',[{x:point.x+2,y:point.y+1}]);await touches('touchEnd');await delay(150);};
  const buttonPoint=async selector=>{
    const probe=`(() => {const n=document.querySelector(${JSON.stringify(selector)});
      if(!n)return {ready:false,reason:'missing-target'};
      const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,ancestors=[];
      let shown=true;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);
        ancestors.push({tag:p.tagName,id:p.id,hidden:!!p.hidden,display:s.display,visibility:s.visibility,opacity:s.opacity});
        if(p.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)shown=false;}
      const top=document.elementFromPoint(x,y),hit=top===n||!!top&&n.contains(top);
      return {ready:shown&&!n.disabled&&r.width>0&&r.height>0&&hit,disabled:!!n.disabled,
        point:{x,y,width:r.width,height:r.height},ancestors,
        hit:top?{tag:top.tagName,id:top.id}:null};})()`;
    try{return await until('visible unobstructed mobile control '+selector,`(() => {const p=${probe};return p.ready?p.point:null;})()`,3_000);}
    catch(error){const diagnostic={selector,timeoutMs:3_000,error:error.message};
      try{diagnostic.lastProbe=await evaluate(probe);diagnostic.native=await evaluate(nativeWaitSource);}
      catch(probeError){diagnostic.probeError=probeError.message;}
      report.buttonWaitFailures??=[];report.buttonWaitFailures.push(diagnostic);throw error;}
  };
  const button=async selector=>tap(await buttonPoint(selector));
  const mark=async()=>({world:await evaluate(worldSource),native:await evaluate(nativeWaitSource),state:await evaluate(readSource)});
  const presentationUnchanged=async(before,label,{native=true}={})=>{await delay(150);const after=await mark();
    assert.deepEqual(after.world,before.world,label+' preserves all 200 people/38 cities/queues/orders/fighters');
    if(native)assert.deepEqual(after.native,before.native,label+' preserves actual native input owner/cursor');
    assert.equal(after.state.keyCount,before.state.keyCount,label+' zero native keys');
    assert.equal(after.state.touchCount,before.state.touchCount,label+' zero native LCD touch');
    assert.equal(after.state.pcPreference,report.initialPreferences.pc,label+' does not change PC mode');return after;};
  const assertHud=s=>{assert.equal(s.identity.sha256,ORIGINAL_SHA);assert.equal(s.hud.visible,true);
    for(const [k,v]of Object.entries(s.expected))assert.equal(s.hud[k],v,'HUD equals current native '+k);};
  const assertHd=s=>{assertHud(s);assert.ok(Math.abs(s.viewport[0]-s.stage.width)<.1&&Math.abs(s.viewport[1]-s.stage.bottom)<.1,'Stage ends at viewport bottom');
    assert.equal(s.map.mode,'hd-map');assert.equal(s.map.presentationReady,true);assert.equal(s.canvas.shown,true);assert.equal(s.lcd.shown,false);
    assert.equal(s.adapter.active,true);assert.equal(s.map.mobile,true);
    assert.ok(s.canvas.width>0&&s.canvas.height>0,'Actual HD backing canvas exists');
    for(const k of ['left','top','right','bottom'])assert.ok(Math.abs(s.canvas.rect[k]-s.stage[k])<=1,'Map fills mobile stage '+k);};
  const assertLcd=s=>{assert.equal(s.lcd.shown,true,'Native LCD restored');assert.equal(s.canvas.shown,false,'HD map cannot cover native LCD');
    const r=s.lcd.rect,t=s.stage;assert.ok(r.width>0&&r.height>0&&r.left>=t.left-.1&&r.top>=t.top-.1&&r.right<=t.right+.1&&r.bottom<=t.bottom+.1,'Native LCD remains inside stage');
    assert.ok(Math.abs((s.lcd.rotation===0?r.width/r.height:r.height/r.width)-s.lcd.width/s.lcd.height)<.003,'Native LCD aspect ratio');};
  const cityPoint=async city=>{const before=await mark();const result=await evaluate('BayeHdOverworld.centerOnCity('+city.index+')');
    assert.notEqual(result,false,'Public presentation-only city centering');await until('map after centering',mapReadySource);
    await presentationUnchanged(before,'centerOnCity('+city.name+')');
    const p=await evaluate(`(() => {const p=BayeHdOverworld.cityScreenPos(${city.index}),c=document.getElementById('hd-overworld-canvas');
      if(!p)return null;return {...p,hit:document.elementFromPoint(p.clientX,p.clientY)===c};})()`);
    assert.ok(p&&p.hit,'City geometry is unobstructed on actual canvas '+city.name);return {x:p.clientX,y:p.clientY,...p};};
  async function cityChecks() {
    const VK={UP:0x22,DOWN:0x23,LEFT:0x24,RIGHT:0x25,ENTER:0x27,EXIT:0x28};
    const idle=`(() => {const s=BayeHdCityMenu.debugSnapshot();return !s.sending&&!s.queueLen&&!s.rootMenuPending;})()`;
    const cityNative=(kind)=>`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===${kind}&&s.open&&s.cityIndex===${testCity.index}&&!s.sending&&!s.queueLen&&{menu:m,city:s};})()`;
    report.cityChecks=[];report.returnChecks=[];report.negativeChecks=[];report.treatments=[];report.recruitments=[];report.quantityPresentation=[];
    const readKeys=start=>evaluate(`__mobileMapKeys.slice(${start})`);
    const ready=async()=>{await until('current native city shell idle',idle);await delay(180);return mark();};
    const saveCheck=(type,before,after,keys,extra={})=>{const item={type,before:before.state,after:after.state,worldBefore:before.world,worldAfter:after.world,keys,...extra};report.cityChecks.push(item);return item;};
    const worldSame=(before,after,label)=>assert.deepEqual(after.world,before.world,label+' preserves complete original world');
    const navigation=(keys,label)=>{const codes=keys.map(k=>k.code);assert.equal(codes.filter(c=>c===VK.ENTER).length,1,label+' one Enter');assert.ok(codes.every(c=>[VK.UP,VK.DOWN,VK.LEFT,VK.RIGHT,VK.ENTER].includes(c)),label+' only native selection arrows and Enter');};
    const prefsSame=s=>{for(const key of ['baye/overworldMode','baye/cityMenuMode'])assert.equal(s.preferences[key],report.initialPcPreferences[key],'PC preference unchanged '+key);};
    const controlPoint=async(selector,{scroll=false}={})=>{
      if(scroll){const geo=await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const p=n.closest('.hd-city-menu-body,.hd-city-menu-panel,.hd-dialog-body')||n.parentElement;return p&&{scrollHeight:p.scrollHeight,clientHeight:p.clientHeight};})()`);report.controlScrollRequests??=[];report.controlScrollRequests.push({selector,geo});}
      const p=await buttonPoint(selector);assert.ok(p.width>=43.5&&p.height>=43.5,'Touch target is at least 44 CSS pixels '+selector);return p;
    };
    const touchButton=async selector=>tap(await controlPoint(selector));
    const visibleSelector=async selectors=>{
      const found=await evaluate(`(() => {for(const s of ${JSON.stringify(selectors)}){const n=document.querySelector(s);if(!n||n.disabled||n.hidden)continue;let visible=true;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const c=getComputedStyle(p);if(p.hidden||c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0)visible=false;}const r=n.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(visible&&r.width>0&&r.height>0&&(t===n||n.contains(t)))return s;}return null;})()`);
      assert.ok(found,'A current visible owned control exists: '+selectors.join(', '));return found;
    };
    const shell=async()=>{const s=await evaluate(readSource);assert.equal(s.identity.sha256,ORIGINAL_SHA);assert.ok(s.cityUi?.open&&s.cityUi.showHd&&s.cityLayer.shown,'Actual mobile HD city pane is visible');assert.equal(s.adapter.active,false,'Map overlay yields to native CITY');assert.equal(s.hud.visible,false,'Read-only map HUD retires on city input');assert.equal(await evaluate('BayeHdMobileCity.isActive()'),true,'Public mobile city host active');prefsSame(s);return s;};
    const openCity=async label=>{
      if(await evaluate(`!!(${cityNative(1)})`))return shell();
      await until('ordinary map before city',mapReadySource);const p=await cityPoint(testCity),before=await mark();await tap(p,true);
      await until('actual city root',cityNative(1));const after=await ready(),keys=await readKeys(before.state.keyCount);
      navigation(keys,'Trusted city tap');worldSame(before,after,'City entry');assert.equal(after.state.touchCount,before.state.touchCount);
      await shell();await checkpoint(label);saveCheck('city-entry',before,after,keys,{city:testCity});return after.state;
    };
    const back=async(label,{status=false}={})=>{
      const before=await ready(),selector=await visibleSelector(['#hd-dialog [data-hd-dlg-back]','#hd-city-menu [data-hd-menu-back]']);
      await touchButton(selector);
      await until('Back owner retires '+label,`(() => {const m=baye.hd.menuItems(),q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();return !s.sending&&!s.queueLen&&${status?'s.layer==="root"&&m.active===1&&m.context===1&&m.kind===1':
        before.state.qty.active?'q.active===0':`(!m.active&&Number(baye.data.g_hdMapPick)===1)||(m.active===1&&m.context===1&&m.seq!==${before.state.menu.seq})`};})()`);
      await delay(350);const after=await mark(),keys=await readKeys(before.state.keyCount);
      assert.deepEqual(keys.map(k=>k.code),status?[]:[VK.EXIT],label+' exact single owner return');
      assert.equal(after.state.touchCount,before.state.touchCount,'HD Back does not leak native LCD touches');
      worldSame(before,after,label);prefsSame(after.state);
      const check=saveCheck('Back '+label,before,after,keys,{selector,status});report.returnChecks.push(check);return after;
    };
    const mapReturn=async label=>{
      for(let n=0;n<5;n++){const s=await evaluate(readSource);if(!s.menu.active&&!s.qty.active&&!s.report.active&&s.march.pick===1&&!s.cityUi.open)break;
        if(s.report.active)throw Error('Report still owns input during '+label);
        await back(label+'-'+n,{status:s.cityUi.layer==='status'});}
      await until('native map after '+label,mapReadySource);prefsSame(await evaluate(readSource));
    };
    const root=async(index,name)=>{
      await openCity('entry-for-'+name+'-'+report.cityChecks.length);await until('root before '+name,cityNative(1));
      const before=await ready();assert.equal(before.state.menu.names[index],name,'Actual native root label');
      await touchButton(`#hd-city-menu [data-hd-root="${index}"]`);
      if(index===3){await until('local readonly status',`BayeHdCityMenu.debugSnapshot().layer==='status'`);const after=await ready();
        const keys=await readKeys(before.state.keyCount);assert.deepEqual(keys,[]);assert.deepEqual(after.native,before.native,'Status does not replace native owner');
        worldSame(before,after,'Readonly city status');assert.ok(after.state.cityUi.cityDetails,'Actual city detail snapshot');
        saveCheck('readonly-status',before,after,keys);await checkpoint('status-'+report.cityChecks.length);return;}
      await until('real '+name+' submenu',cityNative(2));const after=await ready(),keys=await readKeys(before.state.keyCount);
      navigation(keys,name+' root');worldSame(before,after,'Root selection');saveCheck('root-'+name,before,after,keys);await shell();
    };
    const revealSubmenu=async(selector,before)=>{
      assert.ok(before.state.menu.active===1&&before.state.menu.context===1&&before.state.menu.kind===2,'Scroll only the actual current submenu owner');
      const probe=`(() => {const n=document.querySelector(${JSON.stringify(selector)}),list=document.getElementById('hd-city-menu-sublist');
        if(!n||!list||!list.contains(n))return null;
        for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);
          if(p.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return null;}
        const r=list.getBoundingClientRect(),b=n.getBoundingClientRect(),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),
          top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom),x=b.left+b.width/2,y=b.top+b.height/2,hit=document.elementFromPoint(x,y);
        if(right-left<44||bottom-top<44)return null;
        return {visible:!n.disabled&&b.top>=top&&b.bottom<=bottom&&b.left>=left&&b.right<=right&&(hit===n||n.contains(hit)),
          target:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},clip:{left,right,top,bottom},
          scrollTop:list.scrollTop,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight};})()`;
      report.submenuScrollChecks??=[];
      for(let step=0;step<=8;step++){
        const info=await until('published current scrollable submenu '+selector,probe,3_000);
        report.submenuScrollChecks.push({selector,step,phase:'probe',info});
        if(info.visible)return;
        assert.ok(step<8,'Submenu target becomes visible within eight trusted pans '+selector);
        assert.ok(info.scrollHeight>info.clientHeight+2,'Offscreen submenu exposes actual overflow '+selector);
        assert.ok(info.target.bottom>info.clip.bottom||info.target.top<info.clip.top,'Do not pan around an external obstruction '+selector);
        const r=info.clip,down=info.target.bottom>r.bottom,x=r.right-12,
          y=r.top+(r.bottom-r.top)*(down?.75:.25),end=r.top+(r.bottom-r.top)*(down?.25:.75);
        const panHit=await evaluate(`(() => {const list=document.getElementById('hd-city-menu-sublist'),n=document.elementFromPoint(${x},${y});return !!list&&!!n&&(n===list||list.contains(n));})()`);
        assert.equal(panHit,true,'Trusted pan starts inside the actual submenu scroll area');
        await touches('touchStart',[{x,y}]);for(let i=1;i<=6;i++)await touches('touchMove',[{x,y:y+(end-y)*i/6}]);await touches('touchEnd');
        const after=await assertNoInput(before,'Reveal '+selector+' with native-independent trusted pan '+(step+1));
        const scrollTop=await evaluate('document.getElementById("hd-city-menu-sublist").scrollTop');
        report.submenuScrollChecks.push({selector,step,phase:'pan',beforeScrollTop:info.scrollTop,afterScrollTop:scrollTop,state:after.state});
        assert.ok(Number.isFinite(scrollTop)&&scrollTop!==info.scrollTop,'Trusted submenu pan actually changes scrollTop');
      }
    };
    const submenu=async name=>{
      const before=await ready(),index=before.state.menu.names.indexOf(name);assert.ok(index>=0,'Actual native submenu '+name);
      const selector=`#hd-city-menu [data-hd-sub="${index}"]`;await revealSubmenu(selector,before);await touchButton(selector);
      await until('actual '+name+' person picker',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner,items=s.deepItems;return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids.length&&s.open&&s.layer==='deep'&&s.deepLabel===${JSON.stringify(name)}&&!s.sending&&!s.queueLen&&o&&o.seq===m.seq&&o.context===m.context&&o.kind===m.kind&&o.detailGeneration===m.detailGeneration&&Array.isArray(items)&&items.length===m.ids.length&&m.ids.every((id,i)=>items.find(v=>v.i===i)?.pind===id)&&{m,s};})()`);
      const after=await ready(),keys=await readKeys(before.state.keyCount);navigation(keys,name+' submenu');worldSame(before,after,'Open '+name);
      const m=after.state.menu,c=after.world.cities[testCity.index];
      const actual=after.world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>after.world.people[id].Belong===c.Belong);
      assert.deepEqual(m.ids,actual,'Original current allied picker IDs in native order');
      const owner=after.state.cityUi.deepMenuOwner;assert.ok(owner&&owner.seq===m.seq&&owner.detailGeneration===m.detailGeneration&&owner.context===m.context&&owner.kind===m.kind);
      for(let i=0;i<m.ids.length;i++)assert.equal(after.state.cityUi.deepItems.find(v=>v.i===i)?.pind,m.ids[i],'HD row retains actual full person ID');
      saveCheck('person-picker-'+name,before,after,keys,{ids:m.ids});return after;
    };
    const selectPerson=async(personIndex,label)=>{
      const before=await ready(),m=before.state.menu,index=m.ids.indexOf(personIndex);
      assert.ok(m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&index>=0);
      await touchButton(`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${personIndex}"]`);
      return {before,personIndex,index,label};
    };
    const assertNoInput=async(before,label,{native=true}={})=>{
      const after=await presentationUnchanged(before,label,{native});prefsSame(after.state);
      const keys=await readKeys(before.state.keyCount);assert.deepEqual(keys,[]);report.negativeChecks.push({label,before:before.state,after:after.state,keys});return after;
    };
    const cancellationCases=async label=>{
      const selector='#hd-city-menu [data-hd-menu-back]';
      let before=await ready(),p=await controlPoint(selector);
      await touches('touchStart',[p]);await touches('touchCancel');await assertNoInput(before,label+' touchcancel');
      before=await ready();p=await controlPoint(selector);const header=await controlPoint('#hd-mobile-menu-mode');
      await touches('touchStart',[{...p,id:1}]);await touches('touchStart',[{...p,id:1},{...header,id:2}]);await touches('touchEnd');
      await assertNoInput(before,label+' second finger retires press');
      before=await ready();await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await assertNoInput(before,label+' untrusted bare click');
      before=await ready();p=await controlPoint(selector);await touches('touchStart',[p]);await metrics(375,667);await touches('touchEnd');
      await until('portrait actual native LCD',`(() => {const s=${readSource};return s.lcd.shown&&s.lcd.hit&&!s.cityLayer.shown&&s.barHeight===0;})()`);
      await assertNoInput(before,label+' portrait retires held press');await checkpoint(label+'-portrait');
      await metrics(844,390);await until('landscape city host restored',`window.BayeHdMobileCity&&BayeHdMobileCity.isActive()&&BayeHdCityMenu.isOpen()`);
      await assertNoInput(before,label+' landscape restoration');
    };
    const checkScroll=async label=>{
      const info=await evaluate(`(() => {const root=document.getElementById('hd-city-menu');return [...root.querySelectorAll('*')].map(n=>{const r=n.getBoundingClientRect(),c=getComputedStyle(n);return {tag:n.tagName,id:n.id,cls:n.className,overflow:c.overflowY,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight,scrollTop:n.scrollTop,rect:{left:r.left,top:r.top,width:r.width,height:r.height}};}).filter(n=>n.clientHeight>44&&n.scrollHeight>n.clientHeight+2&&['auto','scroll'].includes(n.overflow)).sort((a,b)=>b.scrollHeight-b.clientHeight-(a.scrollHeight-a.clientHeight))[0]||null;})()`);
      report.scrollChecks??=[];if(!info){const fit=await evaluate(`(() => {const root=document.getElementById('hd-city-menu'),stage=document.getElementById('hd-mobile-stage').getBoundingClientRect();return [...root.querySelectorAll('button')].filter(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;}).every(n=>{const r=n.getBoundingClientRect();return r.left>=stage.left-.5&&r.right<=stage.right+.5&&r.top>=stage.top-.5&&r.bottom<=stage.bottom+.5;});})()`);assert.equal(fit,true,'Content either fits or exposes a real scroll container');report.scrollChecks.push({label,needed:false,allContentFits:true});return;}const before=await ready(),r=info.rect,x=r.left+r.width-12,y=r.top+r.height*.75;
      await touches('touchStart',[{x,y}]);for(let i=1;i<=6;i++)await touches('touchMove',[{x,y:y-r.height*.5*i/6}]);await touches('touchEnd');
      const after=await assertNoInput(before,label+' native-independent content scroll');
      const scroll=await evaluate(`(() => {const root=document.getElementById('hd-city-menu'),n=${info.id?`document.getElementById(${JSON.stringify(info.id)})`:`[...root.querySelectorAll('*')].find(n=>n.className===${JSON.stringify(info.cls)}&&n.scrollHeight>n.clientHeight+2)`};return n&&n.scrollTop;})()`);
      report.scrollChecks.push({label,info,beforeScrollTop:info.scrollTop,afterScrollTop:scroll,state:after.state});
      assert.ok(Number.isFinite(scroll)&&scroll!==info.scrollTop,'Trusted touch actually scrolls long menu content');
    };
    const quantityCase=async label=>{
      await root(2,'军备');const picker=await submenu('征兵');
      const actor=picker.state.menu.ids.find(id=>id!==picker.world.king&&picker.world.people[id].Thew>=20)||picker.state.menu.ids.find(id=>picker.world.people[id].Thew>=20);
      assert.ok(Number.isInteger(actor),'Actual eligible recruitment actor');
      const chosen=await selectPerson(actor,'征兵');
      const q=await until('genuine recruitment quantity',`(() => {const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();return q.active&&q.protocol&&q.ready===1&&q.session>0&&q.max>0&&BayeHdCityMenu.isQtyLive()&&!s.sending&&!s.queueLen&&q;})()`);
      const reached=await ready();navigation(await readKeys(chosen.before.state.keyCount),'Recruiter selection');worldSame(chosen.before,reached,'Opening original quantity');
      report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,label+' opened'));
      await checkpoint(label+'-qty');
      const plus=q.value+q.step<=q.max;assert.ok(plus||q.value-q.step>=q.min,'Actual quantity has one valid original step');const selector=await visibleSelector([`#hd-dialog [data-hd-qty="${plus?1:-1}"]`,`#hd-city-menu [data-hd-qty="${plus?1:-1}"]`]),before=await ready();
      await touchButton(selector);
      const receipt=await until('single actual quantity touch ACK',`(() => {const q=baye.hd.qty();return q.active&&q.ready===1&&q.session===${q.session}&&q.inputSeq!==${q.inputSeq}&&q;})()`);
      const after=await ready(),keys=await readKeys(before.state.keyCount),expectedKey=plus?VK.UP:VK.DOWN;
      assert.deepEqual(keys.map(k=>k.code),[expectedKey]);assert.equal(receipt.inputSeq,q.inputSeq===0xffffffff?1:q.inputSeq+1);assert.equal(receipt.lastKey,expectedKey);
      assert.equal(receipt.value,plus?q.value+q.step:q.value-q.step);worldSame(before,after,'Quantity editing is not commitment');
      report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,label+' edited before cancel'));
      saveCheck('quantity-edit',before,after,keys,{beforeQuantity:q,receipt,actor,selector});
      await back(label+' quantity cancel');await mapReturn(label+' cancelled quantity');
      assert.deepEqual(await evaluate(worldSource),picker.world,'Cancelled recruitment changes no money, troops, person or order');
    };
    const treat=async(label,{naturalHeld=false}={})=>{
      await root(0,'内政');const picker=await submenu('宴请'),actor=picker.state.menu.ids.find(id=>id!==picker.world.king&&picker.world.people[id].Belong===picker.world.king+1);
      assert.ok(Number.isInteger(actor)&&picker.world.cities[testCity.index].Money>=100,'Actual nonking Treat person and cash');
      const selected=await selectPerson(actor,'宴请');
      const nativeReport=await until('actual nonking public Treat report',`(() => {const r=baye.hd.report();return r.active===1&&r.kind===2&&r.person===${actor}&&r.seq>0&&r.inputSeq>0&&r;})()`,15000);
      await until('mobile HD actual report',`(() => {const s=${readSource};return s.dialogLayer.shown&&s.dialogUi.open&&s.dialogUi.kind==='report'&&s.report.active===1;})()`);
      const during=await ready();navigation(await readKeys(selected.before.state.keyCount),'Actual Treat person');
      assert.ok(during.state.report.active===1&&during.state.report.seq===nativeReport.seq&&during.state.report.inputSeq===nativeReport.inputSeq&&during.state.report.person===actor,'During oracle is bound to the actual still-active Treat report');
      const delta=verifyMobileTreatWorld(picker.world,during.world,testCity.index,actor,'report');
      await checkpoint(label+'-report');const fresh=await evaluate('baye.hd.report()');assert.ok(fresh.active===1&&fresh.seq===nativeReport.seq&&fresh.inputSeq===nativeReport.inputSeq&&fresh.person===actor,'Original report still owns input after screenshot');const point=await controlPoint('#hd-dialog [data-hd-dlg-ok]'),begin=await mark();
      if(naturalHeld){await touches('touchStart',[point]);await until('real report naturally retired',`baye.hd.report().active===0`,15000);await touches('touchEnd');}
      else await tap(point);
      await until('Treat report inactive',`baye.hd.report().active===0`,15000);await delay(350);const after=await mark(),keys=await readKeys(begin.state.keyCount);
      assert.deepEqual(keys.map(k=>k.code),naturalHeld?[]:[VK.ENTER],naturalHeld?'Old report pointer cannot confirm new owner':'One trusted current report ACK');
      assert.notEqual(after.state.report.inputSeq,nativeReport.inputSeq,'Native report owner retired');
      const finalDelta=verifyMobileTreatWorld(picker.world,after.world,testCity.index,actor,'retired');
      report.treatments.push({label,actor,before:picker.world,during:during.world,after:after.world,delta,finalDelta,nativeReport,begin:begin.state,retired:after.state,keys,naturalHeld});
      await mapReturn(label+' after report');
    };
    const recruit=async label=>{
      const {verifyMobileRecruitment}=await import('./hd-mobile-recruitment-runtime-oracle.mjs');
      await root(2,'军备');const picker=await submenu('征兵');
      const actor=picker.state.menu.ids.find(id=>id!==picker.world.king&&picker.world.people[id].Thew>=12);
      assert.ok(Number.isInteger(actor)&&picker.world.cities[testCity.index].Money>=1,'Actual nonking recruiter with original ROM eligibility');
      assert.ok(picker.world.orders.some(o=>o.OrderId===255),'Real recruitment requires a free native order slot');
      const entry={label,viewport:picker.state.viewport,cityIndex:testCity.index,personId:actor,picker,steps:[]};report.recruitments.push(entry);
      const chosen=await selectPerson(actor,'征兵');
      const q=await until('genuine recruitment quantity ready',`(() => {const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();return q.active===1&&q.protocol&&q.ready===1&&q.session>0&&q.max>1&&BayeHdCityMenu.isQtyLive()&&!s.sending&&!s.queueLen&&q;})()`);
      const reached=await ready();entry.opened=reached;navigation(await readKeys(chosen.before.state.keyCount),'Recruiter selection for commitment');
      worldSame(picker,reached,'Opening recruitment quantity');
      const c=picker.world.cities[testCity.index],cfg=picker.world.config;
      assert.equal(q.min,0);assert.equal(q.max,Math.min(c.PeopleDevotion*cfg.armsPerDevotion,c.Money*cfg.armsPerMoney,65534));
      assert.equal(q.value,q.max,'Original recruitment starts at the actual maximum');assert.equal(q.step,1);
      report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,label+' opened'));
      const selector=await visibleSelector(['#hd-dialog [data-hd-qty="-1"]','#hd-city-menu [data-hd-qty="-1"]']),beforeEdit=await ready();
      await touchButton(selector);
      const receipt=await until('recruitment single quantity ACK',`(() => {const q=baye.hd.qty();return q.active===1&&q.ready===1&&q.session===${q.session}&&q.inputSeq!==${q.inputSeq}&&q;})()`);
      const edited=await ready(),editKeys=await readKeys(beforeEdit.state.keyCount);
      assert.deepEqual(editKeys.map(k=>k.code),[VK.DOWN]);assert.equal(receipt.value,q.value-1);
      assert.equal(receipt.inputSeq,q.inputSeq===0xffffffff?1:q.inputSeq+1);assert.equal(receipt.lastKey,VK.DOWN);
      worldSame(beforeEdit,edited,'Recruitment quantity edit does not commit');
      entry.steps.push({selector,before:beforeEdit,after:edited,keys:editKeys,receipt});
      report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,label+' edited before confirm'));
      await checkpoint(label+'-quantity');
      const confirmSelector=await visibleSelector(['#hd-dialog [data-hd-dlg-ok]','#hd-city-menu [data-hd-qty-ok]']);
      const confirmation=await ready(),point=await controlPoint(confirmSelector);entry.confirmation={selector:confirmSelector,point,before:confirmation};
      worldSame(picker,confirmation,'Selecting and editing up to actual recruitment confirmation');
      assert.equal(confirmation.state.qty.session,q.session);assert.equal(confirmation.state.qty.ready,1);assert.equal(confirmation.state.qty.value,receipt.value);
      await tap(point);
      // Qty end precedes business writes. Wait for the actual next native person publication and matching HD rows.
      await until('committed recruitment publishes remaining native people',`(() => {
        const q=baye.hd.qty(),m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner,items=s.deepItems;
        if(q.active!==0||q.ready!==0||m.active!==1||m.context!==1||m.kind!==3||!m.idsValid||m.seq===${picker.state.menu.seq}||m.ids.includes(${actor})||!m.ids.length||
          !s.open||s.cityIndex!==${testCity.index}||s.layer!=='deep'||s.deepLabel!=='征兵'||s.sending||s.queueLen||!o||o.seq!==m.seq||o.context!==m.context||o.kind!==m.kind||o.detailGeneration!==m.detailGeneration||
          !Array.isArray(items)||items.length!==m.ids.length||!m.ids.every((id,i)=>items.find(v=>v.i===i)?.pind===id))return false;
        const c=baye.data.g_Cities[${testCity.index}],ids=Array.from(baye.data.g_PersonsQueue).slice(Number(c.PersonQueue),Number(c.PersonQueue)+Number(c.Persons));
        return !ids.includes(${actor});})()`);
      const committed=await ready(),keys=await readKeys(confirmation.state.keyCount);entry.confirmation.after=committed;entry.confirmation.keys=keys;
      const owner=committed.state.cityUi.deepMenuOwner,menu=committed.state.menu;
      assert.ok(committed.state.cityUi.cityIndex===testCity.index&&menu.active===1&&menu.context===1&&menu.kind===3&&menu.seq!==picker.state.menu.seq&&owner&&owner.seq===menu.seq&&owner.context===menu.context&&owner.kind===menu.kind&&owner.detailGeneration===menu.detailGeneration,'Current complete recruitment picker owns the committed sample');
      assert.deepEqual(keys.map(k=>k.code),[VK.ENTER],'One trusted current quantity confirmation');
      assert.equal(committed.state.touchCount,confirmation.state.touchCount,'No raw LCD touch leaks from confirmation');
      assert.equal(committed.state.qty.session,q.session);assert.equal(committed.state.qty.lastKey,VK.ENTER);
      assert.equal(committed.state.qty.inputSeq,receipt.inputSeq===0xffffffff?1:receipt.inputSeq+1);
      const currentCity=committed.world.cities[testCity.index];
      const ids=committed.world.queue.slice(currentCity.PersonQueue,currentCity.PersonQueue+currentCity.Persons).filter(id=>committed.world.people[id].Belong===currentCity.Belong);
      assert.deepEqual(committed.state.menu.ids,ids,'Next picker contains exactly the remaining native residents');
      entry.quantity=receipt.value;entry.before=confirmation.world;entry.after=committed.world;
      entry.verdict=verifyMobileRecruitment({before:entry.before,after:entry.after,cityIndex:testCity.index,personId:actor,quantity:entry.quantity,libBytes:frozen.get('libs/dat-mod.lib').bytes});
      report.recruitmentCommitted=true;
      await checkpoint(label+'-committed-persons');
      await back(label+' next recruiter cancel');await mapReturn(label+' committed recruitment return');
      entry.returned=await mark();assert.deepEqual(entry.returned.world,entry.after,'Leaving the continuing recruitment loop preserves the committed world');
      await checkpoint(label+'-map');
    };

    const headerGeometry=async label=>{const rows=await evaluate(`(() => {const bar=document.getElementById('hd-mobile-bar');return [...bar.querySelectorAll('button')].map(n=>{let shown=true;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const c=getComputedStyle(p);if(p.hidden||c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0)shown=false;}const r=n.getBoundingClientRect();return {id:n.id,shown:shown&&r.width>0&&r.height>0,disabled:n.disabled,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};});})()`);for(const r of rows.filter(r=>r.shown)){assert.ok(r.rect.width>=43.5&&r.rect.height>=43.5,'Every shown header button is >=44 CSS px '+r.id);assert.ok(r.rect.left>=-.5&&r.rect.right<=label[0]+.5&&r.rect.top>=-.5&&r.rect.bottom<=label[1]+.5,'Header button remains inside viewport '+r.id);}report.headerGeometry??=[];report.headerGeometry.push({viewport:label,rows});};
    const all=report.initialAllCities,world=await evaluate(worldSource);
    const selected=all.find(c=>c.kind==='owned'&&(previewOnly||equipmentOnly?
      world.queue.slice(world.cities[c.index].PersonQueue,world.cities[c.index].PersonQueue+world.cities[c.index].Persons).some(id=>world.people[id].Belong===world.king+1&&world.people[id].Tool1>0&&world.people[id].Tool2>0):
      world.cities[c.index].Money>=(recruitment?202:200)&&world.queue.slice(world.cities[c.index].PersonQueue,world.cities[c.index].PersonQueue+world.cities[c.index].Persons).filter(id=>id!==world.king&&world.people[id].Belong===world.king+1&&(!recruitment||world.people[id].Thew>=12)).length>=(recruitment?2:1)));
    assert.ok(selected,previewOnly||equipmentOnly?'Original selected lord has an actual resident with two equipped tools':'Original selected lord has an actual owned city with nonking resident and 200 Treat cash');const testCity=selected;report.testCity=testCity;
    report.initialPcPreferences=(await evaluate(readSource)).preferences;
    if(equipmentOnly){
      const {runMobilePreviewChecks}=await import('./hd-mobile-preview-runtime-checks.mjs'),{runMobileEquipmentChecks}=await import('./hd-mobile-equipment-runtime-checks.mjs');
      const size=[equipmentWidth,equipmentWidth===844?390:375];await metrics(...size);await headerGeometry(size);
      const context={report,evaluate,until,delay,checkpoint,ready,root,submenu,revealSubmenu,selectPerson,back,mapReturn,controlPoint,tap,touchButton,touches,readKeys,navigation,worldSame,testCity,mark};
      await runMobilePreviewChecks({...context,label:'equipment-preview-'+size.join('x')});
      await runMobileEquipmentChecks({...context,label:'equipment-'+size.join('x')});
      assert.equal(report.equipmentChecks.length,1);assert.ok(report.equipmentChecks.every(v=>v.accepted)&&report.previewChecks.every(v=>v.accepted));
      const final=await checkpoint('final-equipment-HD-map');await until('final actual equipment map',mapReadySource);prefsSame(final);
      report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
      assert.equal(report.nativeTouches.length,0);assert.deepEqual(report.requests.filter(r=>r.status!==200),[]);assert.equal(report.exceptions.length,0);
      report.equipmentPreviewRegressionAccepted=true;report.equipmentAccepted=true;report.ok=true;report.accepted=true;
      report.acceptedScope=['Actual original king and nonking confiscation, full-equipped rejection and genuine granting through trusted touch at '+size.join('x'),
        'Exact recorded world and ROM tool oracle before/while/after actual reports; complete inventory discovery bits and queue relocation',
        'Current native GOODS/PERSON/SUB publication, focus-only preview regression, explicit property paging and updated recipient details',
        'Single-owner returns and HUD; not all tool classes, real devices or full-HD acceptance'];return;
    }
    if(previewOnly){
      const {runMobilePreviewChecks}=await import('./hd-mobile-preview-runtime-checks.mjs');
      for(const [width,height]of [[844,390],[667,375]]){
        await metrics(width,height);await headerGeometry([width,height]);
        await runMobilePreviewChecks({report,evaluate,until,delay,checkpoint,ready,root,submenu,selectPerson,back,mapReturn,
          controlPoint,tap,touchButton,touches,readKeys,navigation,worldSame,testCity,mark,label:'preview-'+width+'x'+height});
      }
      assert.equal(report.previewChecks.length,2);assert.ok(report.previewChecks.every(v=>v.accepted));
      const final=await checkpoint('final-preview-HD-map');await until('final actual preview map',mapReadySource);prefsSame(final);
      report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
      assert.equal(report.nativeTouches.length,0);assert.deepEqual(report.requests.filter(r=>r.status!==200),[]);assert.equal(report.exceptions.length,0);
      report.previewAccepted=true;report.ok=true;report.accepted=true;
      report.acceptedScope=['Original mobile person and equipped-goods focus-only preview at 844x390 and 667x375',
        'Only current native arrows for preview, zero Enter; person and goods attributes follow the actual native index and explicit property page',
        'All recorded world fields including equipment, all city goods metadata, full goods queue discovery bits and tool resource fields remain unchanged',
        '44px controls and actual clipped scrolling, exact single-owner cancellation and returned HUD; no equipment commitment or real-device/full-HD acceptance'];
      return;
    }
    if(!reportsOnly){
    const gameplayBefore=await evaluate(worldSource);
    for(const [width,height]of [[844,390],[667,375]]){
      await metrics(width,height);const label=width+'x'+height;await headerGeometry([width,height]);
      for(const [index,name]of [[0,'内政'],[1,'外交'],[2,'军备']]){await root(index,name);await checkpoint(label+'-'+name);if(index===0)await checkScroll(label+' internal submenu');await back(label+' '+name+' submenu');await mapReturn(label+' root return');}
      await root(3,'状况');await back(label+' status return',{status:true});await back(label+' root return');await until('map after readonly status',mapReadySource);
      await root(0,'内政');await submenu('开垦');await checkpoint(label+'-person');if(width===667)await checkScroll(label);
      await back(label+' person cancel');await mapReturn(label+' person return');
      await quantityCase(label);
      assert.deepEqual(await evaluate(worldSource),gameplayBefore,'All navigation and cancelled quantities preserve full original gameplay world');
    }
    await metrics(844,390);await openCity('negative-current-root');await cancellationCases('root-gesture');
    // A second real private tab makes the game genuinely hidden; never redefine document.hidden.
    const beforeHidden=await ready(),press=await controlPoint('#hd-city-menu [data-hd-menu-back]');await touches('touchStart',[press]);
    const otherTab=await cdp.send('Target.createTarget',{url:'about:blank'});report.visibilityPrivateTarget=otherTab.targetId;
    try{await cdp.send('Target.activateTarget',{targetId:otherTab.targetId});await until('real document hidden','document.visibilityState==="hidden"',10000);
      report.hiddenObserved=await evaluate('({hidden:document.hidden,visibility:document.visibilityState})');
      assert.equal(report.hiddenObserved.hidden,true);assert.equal(report.hiddenObserved.visibility,'hidden');
      const hidden=await assertNoInput(beforeHidden,'Hidden document retires held Back without background touch dispatch');
      report.hiddenPhase={observed:report.hiddenObserved,keyCount:hidden.state.keyCount,touchCount:hidden.state.touchCount};}
    finally{await cdp.send('Target.closeTarget',{targetId:otherTab.targetId});await cdp.send('Page.bringToFront');}
    await until('city after private-tab restoration','document.visibilityState==="visible"&&!document.hidden&&window.BayeHdMobileCity&&BayeHdMobileCity.isActive()');
    report.hiddenRestored=await evaluate('({hidden:document.hidden,visibility:document.visibilityState,hostActive:BayeHdMobileCity.isActive()})');
    await touches('touchEnd');const released=await assertNoInput(beforeHidden,'Visible owner restored; releasing retired held Back cannot send old action');
    report.hiddenRelease={restored:report.hiddenRestored,keyCount:released.state.keyCount,touchCount:released.state.touchCount};
    await mapReturn('negative root cleanup');
    // Public mobile host control is the only mode change; shared PC setMode is never called.
    await openCity('mode-current-root');const beforeMode=await ready();await touchButton('#hd-mobile-menu-mode');
    await until('native LCD city fallback',`(() => {const s=${readSource};return s.lcd.shown&&s.lcd.hit&&!s.cityLayer.shown;})()`);
    await assertNoInput(beforeMode,'Independent mobile menu classic mode');await checkpoint('classic-city');
    await touchButton('#hd-mobile-menu-mode');await until('HD city restored','BayeHdMobileCity.isActive()&&BayeHdCityMenu.isOpen()');
    await assertNoInput(beforeMode,'Independent mobile HD restoration');await mapReturn('mode restored city');
    report.navigationMatrixAccepted=true;
    }
    await treat('public-treat-confirmed');await treat('public-treat-natural-owner-retirement',{naturalHeld:true});
    if(recruitment){for(const [width,height]of [[844,390],[667,375]]){
      await metrics(width,height);await recruit('recruitment-'+width+'x'+height);
      if(distribution){const {runMobileDistributionChecks}=await import('./hd-mobile-distribution-runtime-checks.mjs');
        await runMobileDistributionChecks({report,evaluate,until,checkpoint,ready,root,submenu,selectPerson,back,mapReturn,
          visibleSelector,controlPoint,tap,touchButton,touches,readKeys,navigation,worldSame,testCity,mark,
          originalLibBytes:frozen.get('libs/dat-mod.lib').bytes,label:'distribution-'+width+'x'+height});}
    }assert.equal(report.recruitments.length,2);report.recruitmentCommitted=true;
      if(distribution){assert.equal(report.distributions.length,2);assert.ok(report.distributions.every(v=>v.accepted));report.distributionAccepted=true;}}
    const final=await checkpoint('final-mobile-HD-map');await until('final actual map',mapReadySource);prefsSame(final);
    report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
    if(!reportsOnly){assert.ok(report.trustedEvents.some(e=>e.trusted&&e.type==='touchcancel'));
    assert.ok(report.trustedEvents.some(e=>!e.trusted&&e.type==='click'),'Bare-click negative is explicitly untrusted');}
    const sourceKeys=report.nativeKeys;assert.ok(sourceKeys.length);assert.equal(report.treatments.length,2);assert.equal(report.treatments.filter(t=>!t.naturalHeld).length,1);
    assert.deepEqual(report.requests.filter(r=>r.status!==200),[]);assert.equal(report.exceptions.length,0);
    report.reportInteractionAccepted=true;report.ok=true;report.accepted=true;
    report.acceptedScope=reportsOnly?['Original public nonking Treat report-active money/Thew and post-retirement Devotion: strict full-world two-phase validation','One trusted current-report ACK; one naturally retired report with held-pointer release sending zero keys']:['Original genuine multi-city lord and native city entry','844x390 and 667x375 trusted four-category city menus','Actual person U16 owner list and quantity edit/cancel','Readonly status zero keys and single-owner Back','44px unobstructed touch targets; fitting content or measured genuine overflow scrolling','Touchcancel/multifinger/rotation/hidden/untrusted-click retirement','Independent mobile presentation mode; PC preferences unchanged','Two bounded nonking original Treat operations; one report ACK and one natural report retirement'];
    if(recruitment)report.acceptedScope.push('Two original recruitment commitments at 844x390 and 667x375: exact measured world, ROM Thew/financial gate, quantity fee, first native order slot, resident queue and continuing picker cancellation; no month advance or return-to-duty claim');
    if(distribution)report.acceptedScope.push('Two original target-total troop distribution flows: current authenticated actor and reserve description; one cancelled edit and three commitments per viewport (increase, reduce to one, return to zero); native HELP bounds and exact full measured world with only actor Arms and city MothballArms changed');
}
  const interrupt=()=>{interrupted=true;report.interrupted=true;cdp?.close();server?.closeAllConnections();};
  process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
  try {
    assert.equal(typeof WebSocket,'function','Node 22+ built-in WebSocket is required');
    const tool=freeze('scripts/test-hd-mobile-city-runtime.mjs');fs.writeFileSync(path.join(out,'executed-tool.mjs'),tool.bytes,{flag:'wx'});
    for(const f of ['scripts/hd-runtime-owned-chrome.mjs','scripts/hd-runtime-json.mjs','scripts/hd-mobile-quantity-runtime-checks.mjs','m.html','js/original-game.js','js/hd-mobile.js','js/hd-mobile-map.js','js/hd-mobile-city.js','js/hd-city-menu.js','js/hd-dialog.js','js/hd-overworld.js','js/lcd.js','libs/dat-mod.lib'])freeze(f);
    if(recruitment)freeze('scripts/hd-mobile-recruitment-runtime-oracle.mjs');
    if(distribution){freeze('scripts/hd-mobile-distribution-runtime-checks.mjs');freeze('scripts/hd-mobile-distribution-runtime-oracle.mjs');}
    if(previewOnly||equipmentOnly)freeze('scripts/hd-mobile-preview-runtime-checks.mjs');
    if(equipmentOnly){freeze('scripts/hd-mobile-equipment-runtime-checks.mjs');freeze('scripts/hd-mobile-equipment-runtime-oracle.mjs');freeze('package.json');}
    if(systemOnly){for(const f of ['scripts/hd-mobile-system-runtime-checks.mjs','scripts/hd-mobile-system-runtime-oracle.mjs','scripts/test-hd-mobile-system.mjs','scripts/test-hd-mobile-system-runtime-oracle.mjs','scripts/test-lcd-touch.mjs','package.json','pc.html','js/hd-system-ui.js','js/hd-mobile-system.js','css/hd-mobile.css','css/hd-system-ui.css','js/save-storage.js'])freeze(f);}
    if(portraitsOnly)freeze('scripts/hd-mobile-portraits-runtime-checks.mjs');
    if(marchOnly){for(const f of ['scripts/hd-mobile-march-runtime-checks.mjs','scripts/hd-mobile-march-runtime-oracle.mjs','scripts/hd-mobile-battle-runtime-oracle.mjs','js/hd-battle.js','js/hd-mobile-battle.js','css/hd-mobile.css'])freeze(f);}
    if(battleOnly){for(const f of ['scripts/hd-mobile-battle-runtime-checks.mjs','scripts/hd-mobile-battle-runtime-oracle.mjs','js/hd-battle.js','js/hd-mobile-battle.js','js/hd-battle-terrain.js','js/hd-battle-feedback.js'])freeze(f);}
    if(battleEffects){for(const f of ['scripts/hd-mobile-battle-effects-runtime-checks.mjs','scripts/hd-mobile-battle-skill-oracle.mjs','scripts/hd-mobile-battle-attack-oracle.mjs','scripts/hd-mobile-successor-runtime-oracle.mjs','assets/hd-spe/manifest.json'])freeze(f);}
    assert.equal(frozen.get('libs/dat-mod.lib').ref.sha256,ORIGINAL_SHA);assert.equal(frozen.get('libs/dat-mod.lib').ref.bytes,207195);
    server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://private'),rel=decodeURIComponent(url.pathname).replace(/^\/+/,''),filename=path.resolve(root,rel);
      const allowed=/^(?:js|css|assets|libs|fonts|vendor)\//.test(rel)||['m.html','favicon.png','manifest.json'].includes(rel);
      if(!allowed||!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){
        report.requests.push({url:req.url,status:404});res.writeHead(404).end();return;}
      const item=freeze(rel),dongHd='assets/hd-portraits/hd/hd_p1_0000_董卓.png';
      if(battleEffects&&effectsCase==='hd-missing'&&rel.startsWith('assets/hd-spe/')&&rel.endsWith('.png')){
        freeze(rel); // Record the untouched production bytes even though this private response is 404.
        report.requests.push({url:req.url,status:404,controlled:'battle effect PNG missing; original production file preserved'});res.writeHead(404,{'Cache-Control':'no-store'}).end();return;}
      const hdTargets=[dongHd,'assets/hd-portraits/hd/hd_p1_0020_吕布.png'];
      const refTargets=['assets/hd-portraits/refs/period-1/0-董卓.png','assets/hd-portraits/refs/period-1/20-吕布.png'];
      const missing=portraitsOnly&&((['hd-missing','all-missing'].includes(portraitCase)&&hdTargets.includes(rel))||(portraitCase==='all-missing'&&refTargets.includes(rel)));
      if(missing){report.requests.push({url:req.url,status:404,injected:'exact original person portrait missing',...item.ref});res.writeHead(404,{'Cache-Control':'no-store'}).end();return;}
      const held=portraitsOnly&&portraitCase==='delayed'&&rel===dongHd;
      report.requests.push({url:req.url,status:200,delayMs:held?5000:0,...item.ref});
      const respond=()=>{if(!res.destroyed)res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'}).end(item.bytes);};
      if(held)setTimeout(respond,5000);else respond();
    }catch{res.writeHead(500).end();report.requests.push({url:req.url,status:500});}});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    report.httpPort=server.address().port;report.debugPort=await unusedPort();assert.notEqual(report.httpPort,8080);assert.notEqual(report.debugPort,8080);
    const origin='http://127.0.0.1:'+report.httpPort;
    chrome=spawn(process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding',
      '--remote-debugging-port='+report.debugPort,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
    chrome.on('error',error=>{report.chromeSpawnError=true;report.chromeSpawnErrorDetail={code:error.code||null,message:error.message};});
    chrome.on('exit',(code,signal)=>{report.chromeExit={code,signal,at:new Date().toISOString()};});report.chromePid=chrome.pid;
    let target;for(let n=0;n<100&&!target;n++){if(report.chromeSpawnError)throw Error('Private Chrome launch failed');
      try{target=(await readChromePageTargets(report.debugPort)).find(t=>t.type==='page');}
      catch(error){report.chromeEndpointProbeError={attempt:n+1,code:error.code||null,message:error.message,childExit:report.chromeExit||null};}
      if(!target)await delay(100);}
    assert.ok(target,'Private Chrome page target: '+JSON.stringify({probeError:report.chromeEndpointProbeError||null,childExit:report.chromeExit||null}));await sampleOwned('launch-before-page');assert.ok(ownership?.rootVerified,'PID, birth and exact private profile verified before page load');
    report.rootBirth=rootIdentity.CreationDate;report.cdpConnectionAttempts=[];
    for(let attempt=0;attempt<10&&!cdp;attempt++){
      try{cdp=await connectCdp(target.webSocketDebuggerUrl);report.cdpConnectionAttempts.push({attempt:attempt+1,connected:true,target:target.id});}
      catch(error){report.cdpConnectionAttempts.push({attempt:attempt+1,connected:false,target:target.id,error:error.message});
        if(chrome.exitCode!==null)throw error;if(attempt===9)throw error;
        await delay(200);target=(await readChromePageTargets(report.debugPort)).find(t=>t.type==='page');assert.ok(target,'Same owned browser retains a page target');}
    }
    cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e));cdp.on('Runtime.consoleAPICalled',e=>report.console.push(e));
    cdp.on('Fetch.requestPaused',e=>{const local=e.request.url.startsWith(origin+'/');if(!local)report.blockedExternal.push(e.request.url);
      cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
    await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    await metrics(systemOnly?systemWidth:844,systemOnly&&systemWidth===667?375:390);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    report.earlyInputObserver=await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:"for(const type of ['touchstart','touchmove','touchend','touchcancel','pointerdown','pointerup','pointercancel','click','keydown'])document.addEventListener(type,event=>{if(Array.isArray(window.__mobileMapEvents))window.__mobileMapEvents.push({type,trusted:event.isTrusted,target:event.target?.id||event.target?.tagName||null,key:event.key||null,pointerId:event.pointerId??null,at:performance.now()});},true);"});
    await cdp.send('Page.navigate',{url:origin+'/m.html#'+Math.floor(Date.now()/1000)});
    await until('original engine','window.baye&&baye.hd&&baye.hd.ready()',60000);
    await evaluate(`(() => {window.__mobileMapKeys=[];window.__mobileMapNativeTouches=[];window.__mobileMapEvents=[];
      const k=window.sendKey,t=window._bayeSendTouchEvent;window.sendKey=function(code){__mobileMapKeys.push({code,at:performance.now()});return k.apply(this,arguments);};
      window._bayeSendTouchEvent=function observeTouch(){__mobileMapNativeTouches.push({args:Array.from(arguments),at:performance.now()});const r=t.apply(this,arguments);window._bayeSendTouchEvent=observeTouch;return r;};
      return true;})()`);
    report.initialPreferences=await evaluate(`({mobile:localStorage.getItem('${MOBILE_PREF}'),pc:localStorage.getItem('${PC_PREF}'),debug:localStorage.getItem('baye/debug')})`);
    assert.notEqual(report.initialPreferences.debug,'1','Fresh profile starts without requested native debug');
    for(let n=0;n<60;n++){if(await evaluate('baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1'))break;
      const intro=await evaluate('baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)');if(intro)await key(0x27,'Public intro acknowledgement');else await delay(150);}
    await until('native title','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1');
    if(systemOnly){
      const {runMobileSystemChecks}=await import('./hd-mobile-system-runtime-checks.mjs');
      await runMobileSystemChecks({report,evaluate,until,delay,checkpoint,metrics,touches,tap,buttonPoint,mark,worldSource,readSource,mapReadySource,assertHd,cdp,origin});
      report.nativeKeys=[...report.systemPageInputs.flatMap(p=>p.keys),...await evaluate('__mobileMapKeys')];
      report.nativeTouches=[...report.systemPageInputs.flatMap(p=>p.touches),...await evaluate('__mobileMapNativeTouches')];
      report.trustedEvents=[...report.systemPageInputs.flatMap(p=>p.events),...await evaluate('__mobileMapEvents')];
      assert.equal(report.nativeTouches.length,0);assert.deepEqual(report.requests.filter(r=>r.status!==200),[]);assert.equal(report.exceptions.length,0);
      report.systemAccepted=true;report.ok=true;report.accepted=true;return;
    }
    await checkpoint('00-title-844');await key(0x27,'Start genuine new game');
    await until('native period','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===2');await key(0x27,'Select original first period');
    await until('native king list','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===3&&Number(baye.data.g_PIdx)===1&&baye.hd.kings().count>0');
    const kingCensus=await evaluate(`(() => {const d=baye.data,first=baye.hd.kings(),menu=baye.hd.menuItems();
      const cities=Array.from({length:38},(_,index)=>({index,name:baye.getCityName(index),belong:Number(d.g_Cities[index].Belong)}));
      const last=baye.hd.kings(),again=baye.hd.menuItems();
      if(menu.active!==1||menu.context!==4||menu.kind!==3||JSON.stringify(first)!==JSON.stringify(last)||JSON.stringify(menu)!==JSON.stringify(again))throw Error('Native king census owner changed');
      return {kings:first.kings,index:first.index,currentId:first.currentId,menu,cities};})()`);
    report.initialKingSelection={census:kingCensus};
    const selection=battleOnly||marchOnly?{selected:kingCensus.kings.map((k,index)=>({...k,index,ownedCount:kingCensus.cities.filter(c=>c.belong===k.id+1).length})).find(k=>k.name==='马腾')}:chooseMultiCityKing(kingCensus),chosenKing=selection.selected;
    assert.ok(chosenKing&&chosenKing.ownedCount>=2,'Actual selected original multi-city lord');Object.assign(report.initialKingSelection,selection);
    for(let i=kingCensus.index;i<chosenKing.index;i++)await key(0x23,'Select actual multi-city king row');
    for(let i=kingCensus.index;i>chosenKing.index;i--)await key(0x22,'Select actual multi-city king row');
    const selectedNativeKing=await evaluate('baye.hd.kings()');assert.equal(selectedNativeKing.index,chosenKing.index);assert.equal(selectedNativeKing.currentId,chosenKing.id);
    report.initialKingSelection.beforeConfirmation=selectedNativeKing;await key(0x27,'Confirm actual multi-city king '+chosenKing.name);
    await until('mobile public map API','window.BayeHdOverworld&&typeof BayeHdOverworld.applyMobilePage===\'function\'&&typeof BayeHdOverworld.centerOnCity===\'function\'');
    await until('default mobile HD map',mapReadySource,60000);report.defaultHdMap=true;
    const all=await evaluate('BayeHdOverworld.getCities().map(c=>({index:c.index,name:c.name,kind:c.kind,belong:c.belong,engX:c.engX,engY:c.engY}))');
    report.initialAllCities=all;assert.equal(all.length,38);const owned=all.filter(c=>c.kind==='owned'),foreign=all.find(c=>c.kind!=='owned');
    const actualKing=await evaluate('Number(baye.data.g_PlayerKing)');report.actualKing={id:actualKing,name:await evaluate('baye.getPersonName(Number(baye.data.g_PlayerKing))'),ownedCount:owned.length};
    assert.equal(actualKing,chosenKing.id);assert.equal(owned.length,chosenKing.ownedCount);assert.ok(owned.length>=2&&foreign);
    const initialMapCity=(await evaluate(readSource)).mapCity,current=all.find(c=>c.index===initialMapCity),otherOwned=owned.find(c=>c.index!==initialMapCity);
    assert.ok(current&&current.kind==='owned'&&otherOwned);report.selectedCities={current,otherOwned,nonOwned:foreign};
    await until('mobile city/dialog host modules','window.BayeHdCityMenu&&window.BayeHdDialog&&window.BayeHdMobileCity&&typeof BayeHdMobileCity.isActive==="function"');
    if(marchOnly){
      const {runMobileMarchChecks}=await import('./hd-mobile-march-runtime-checks.mjs');
      await runMobileMarchChecks({report,evaluate,until,delay,checkpoint,metrics,touches,tap,buttonPoint,button,mark,presentationUnchanged,cityPoint,
        readSource,worldSource,mapReadySource,sendCdp:(method,params)=>cdp.send(method,params),originalLibBytes:frozen.get('libs/dat-mod.lib').bytes,assertLcd});
    }else if(battleOnly){
      const {runMobileBattleChecks}=await import('./hd-mobile-battle-runtime-checks.mjs');
      const context={report,evaluate,until,delay,checkpoint,key,metrics,touches,tap,buttonPoint,button,mark,presentationUnchanged,cityPoint,
        readSource,worldSource,mapReadySource,sendCdp:(method,params)=>cdp.send(method,params),originalLibBytes:frozen.get('libs/dat-mod.lib').bytes};
      const controls=await runMobileBattleChecks(context);
      if(battleEffects){const {runMobileBattleEffectsChecks}=await import('./hd-mobile-battle-effects-runtime-checks.mjs');await runMobileBattleEffectsChecks({...context,controls,effectManifest:JSON.parse(frozen.get('assets/hd-spe/manifest.json').bytes)});}
    }else if(portraitsOnly){
      const {runMobilePortraitChecks}=await import('./hd-mobile-portraits-runtime-checks.mjs');
      await runMobilePortraitChecks({report,evaluate,until,delay,checkpoint,key,metrics,touches,tap,buttonPoint,button,mark,presentationUnchanged,cityPoint,
        readSource,worldSource,mapReadySource,verifyMobileTreatWorld,sendCdp:(method,params)=>cdp.send(method,params)});
    }else await cityChecks();
  }catch(error){report.ok=false;report.accepted=false;report.error=error.stack||String(error);process.exitCode=1;console.error(report.error);
    if(systemOnly&&cdp){try{
      report.nativeKeys=[...(report.systemPageInputs||[]).flatMap(p=>p.keys),...await evaluate('window.__mobileMapKeys||[]')];
      report.nativeTouches=[...(report.systemPageInputs||[]).flatMap(p=>p.touches),...await evaluate('window.__mobileMapNativeTouches||[]')];
      report.trustedEvents=[...(report.systemPageInputs||[]).flatMap(p=>p.events),...await evaluate('window.__mobileMapEvents||[]')];
      report.systemInputDiagnostics=[...(report.systemInputDiagnostics||[]),...await evaluate('window.__mobileSystemDiagnostics||[]')];
      report.failureSystem=await evaluate('({host:window.BayeHdMobileSystem&&BayeHdMobileSystem.snapshot(),ui:window.BayeHdSystemUi&&BayeHdSystemUi.debugSnapshot(),menu:baye.hd.menuItems(),record:baye.hd.record()})');
      report.failureWorld=await evaluate(`baye.getPersonCount()===200?${worldSource}:null`);
    }catch{report.failureSystemInputsUnavailable=true;}}
    if((previewOnly||equipmentOnly)&&cdp){try{report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');report.failureWorld=await evaluate(worldSource);}catch{report.failurePreviewInputsUnavailable=true;}}
    if(recruitment&&cdp){try{report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');report.failureWorld=await evaluate(worldSource);}catch{report.failureRecruitmentInputsUnavailable=true;}}
    if(marchOnly&&cdp){try{report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');report.marchKeyTrace=await evaluate('window.__mobileMarchKeyTrace');report.failureWorld=await evaluate(worldSource);}catch{report.failureMarchInputsUnavailable=true;}}
    if(battleEffects&&cdp){try{report.effectTrace=await evaluate('window.__mobileBattleEffects&&__mobileBattleEffects.trace');report.effectReports=await evaluate('window.__mobileBattleEffects&&__mobileBattleEffects.reports');
      report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');}catch{report.failureEffectsUnavailable=true;}}
    if(portraitsOnly&&cdp){try{report.failurePortrait=await evaluate('window.BayeHdMobilePortraits&&BayeHdMobilePortraits.debugSnapshot()');}catch{report.failurePortraitUnavailable=true;}}
    if(cdp){try{await checkpoint('failure');}catch{report.failureCaptureUnavailable=true;}}
  }finally{
    await sampleOwned('before-cleanup');
    if(cdp&&ownership?.rootVerified){
      report.gracefulBrowserClose={requested:true};
      try{await cdp.send('Browser.close');report.gracefulBrowserClose.responded=true;}
      catch(error){report.gracefulBrowserClose.responseError=error.message;}
      await delay(750);
    }
    cdp?.close();
    if(ownership?.rootVerified){try{const p=await cleanupOwnedChrome(ownership);report.cleanup=persistCleanup(p,ownership);if(!p.treeExited){report.ok=false;report.accepted=false;process.exitCode=1;}}
      catch{report.cleanup={treeExited:false,error:'Owned cleanup failed; private profile retained'};report.ok=false;report.accepted=false;process.exitCode=1;}}
    else if(chrome){report.cleanup={treeExited:false,error:'No verified owned browser basis; no broad stop attempted'};report.ok=false;report.accepted=false;process.exitCode=1;}
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}report.serverClosed=!server?.listening;
    report.historicalRecordedIdentities=[...historical.values()];report.profileRetained=fs.existsSync(profile);
    report.sourceDrift=report.sourceFiles.filter(ref=>{try{const b=fs.readFileSync(path.join(root,ref.path));return b.length!==ref.bytes||sha(b)!==ref.sha256;}catch{return true;}});
    if(report.sourceDrift.length){report.ok=false;report.accepted=false;process.exitCode=1;}
    report.finishedAt=new Date().toISOString();write('source-verification.json',{sourceFiles:report.sourceFiles,sourceDrift:report.sourceDrift});write('result.json',report);
    process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
    console.log(JSON.stringify({ok:report.ok,accepted:report.accepted,out,phases:report.phases.map(p=>p.name),error:report.error}));
  }
  return report;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
