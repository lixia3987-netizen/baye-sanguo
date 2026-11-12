#!/usr/bin/env node
/**
 * Real Chromium + LIB/WASM HD campaign acceptance; every engine action uses a player entry.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-campaign-runtime.mjs -- --staged
 *   node scripts/test-hd-campaign-runtime.mjs -- --artifact-dir build/campaign-runtime-smoke
 * --staged serves build/wasm/src/baye.{js,wasm,wasm.map} without replacing js/.
 * --scenario arrival queues two armies for the same enemy city and settles both in one month.
 * --mobile-width=667|844 uses mobile HD touch controls for victory, defense, arrival, empty or save.
 * --scenario defense prepares garrisons and plays original incoming attacks to a victory.
 * --defense-any-outcome accepts either result after a playable defense settles back to the map.
 * --defense-after-succession requires an inherited city to survive a later native defense.
 * --defense-same-month follows multiple native defensive battles through one strategy month.
 * --find-generals checks name search and sorting in the original recruitment and march lists.
 * --period=1|2|3|4 chooses the original period for probe, victory, save or same-month defense.
 * --scenario captives --captive-order exercises one actual surrender order through month-end.
 * --captive-width=1280 selects a 720p desktop viewport for either captive flow.
 * --captive-mobile-width=667|844 saves the captured city, then loads and plays it in m.html.
 * --captive-resume=build/.../result.json replays a captured native save from a closed private run.
 * --elite-transit=build/.../result.json continues the original 刘备 campaign to 濮阳 and prepares the 南皮 defender.
 * --elite-transit-months=N sets the month budget and saves the current campaign if the defender is still unready.
 * --west-transit=build/.../result.json prepares original 西凉 access by sending 劝降 from 刘备's campaign.
 * --west-transit-months=N sets the month budget for those original diplomatic orders.
 * --west-road continues from 西凉 access to an original connected realm and moves 韩玄 to 西凉.
 * Uses a temporary browser profile; it never edits portraits, saves or game assets.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {snapshotOwnedChrome,cleanupOwnedChrome} from './hd-runtime-owned-chrome.mjs';
import {writeJsonAtomicSync} from './hd-runtime-json.mjs';
import {battleResultNoteObservation,verifyBattleResultNote} from './hd-battle-hud-runtime-checks.mjs';
import {createMobileCampaignInputs} from './hd-mobile-campaign-inputs.mjs';
import {verifyNativePersonSelection} from './hd-city-person-navigation-checks.mjs';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';
import {verifyMobileSuccessorChoice,verifyMobileSuccessorReport,verifyMobileSuccessorSettlement} from './hd-mobile-successor-runtime-oracle.mjs';
import {recordBattleOpeningStatus,verifyBattleOpeningStatus} from './hd-battle-opening-status-runtime-checks.mjs';
import {observeBattleEquipmentSettlement,discoveredCityEquipment,verifyEquipmentDeposit} from './hd-battle-equipment-runtime-checks.mjs';
import {awardOriginalCampaignMysticToken, dispatchOriginalInduce, lowerOriginalCampaignLoyalty, moveOriginalCampaignOfficer,
    originalRewardWorldSource, searchOriginalCampaignCity} from './hd-reward-token-runtime-checks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staged = process.argv.includes('--staged');
const scenarioFlag = process.argv.indexOf('--scenario');
const eliteTransitFlag = process.argv.find(arg => arg.startsWith('--elite-transit='));
const eliteTransit = eliteTransitFlag?.slice('--elite-transit='.length);
assert.ok(!eliteTransitFlag || eliteTransit && scenarioFlag < 0, '--elite-transit requires an original save report and selects its own campaign');
const westTransitFlag = process.argv.find(arg => arg.startsWith('--west-transit='));
const westTransit = westTransitFlag?.slice('--west-transit='.length);
assert.ok(!westTransitFlag || westTransit && !eliteTransitFlag && scenarioFlag < 0,
    '--west-transit requires an original 刘备 save report and selects its own campaign');
const westRoad = process.argv.includes('--west-road');
assert.ok(!westRoad || westTransit,'--west-road requires a 西凉 checkpoint via --west-transit');
const westSearch = process.argv.includes('--west-search');
assert.ok(!westSearch || westTransit && !westRoad,'--west-search requires a 韩玄 arrival checkpoint via --west-transit');
const westRival = process.argv.includes('--west-rival');
assert.ok(!westRival || westTransit && !westRoad && !westSearch,
    '--west-rival requires a 南方小鬼 recruitment checkpoint via --west-transit');
const westRivalAttackers = process.argv.includes('--west-rival-attackers');
assert.ok(!westRivalAttackers || westRival,'--west-rival-attackers requires --west-rival');
const liuBeiTransit = eliteTransit ?? westTransit;
const eliteTransitMonthsFlag = process.argv.find(arg => arg.startsWith('--elite-transit-months='));
const eliteTransitMonthsText = eliteTransitMonthsFlag?.slice('--elite-transit-months='.length) ?? '18';
const eliteTransitMonths = Number(eliteTransitMonthsText);
assert.ok(!eliteTransitMonthsFlag || eliteTransit && /^\d+$/.test(eliteTransitMonthsText) && Number.isSafeInteger(eliteTransitMonths),
    '--elite-transit-months requires --elite-transit and a nonnegative integer');
const westTransitMonthsFlag = process.argv.find(arg => arg.startsWith('--west-transit-months='));
const westTransitMonthsText = westTransitMonthsFlag?.slice('--west-transit-months='.length) ??
    (westRivalAttackers ? '0' : westSearch || westRival ? '84' : '18');
const westTransitMonths = Number(westTransitMonthsText);
assert.ok(!westTransitMonthsFlag || westTransit && /^\d+$/.test(westTransitMonthsText) && Number.isSafeInteger(westTransitMonths),
    '--west-transit-months requires --west-transit and a nonnegative integer');
const scenario = eliteTransit ? 'elite-transit' : westTransit ? 'west-transit' : scenarioFlag >= 0 ? process.argv[scenarioFlag + 1] : 'victory';
assert.ok(['victory', 'defense', 'arrival', 'retreat', 'empty', 'campaign', 'save', 'restart', 'domestic', 'probe', 'captives', 'elite-transit', 'west-transit'].includes(scenario), 'Unknown campaign scenario: ' + scenario);
assert.ok(scenario!=='west-transit'||westTransit,'Use --west-transit with the original campaign report');
const arrivalScenario=scenario==='arrival',defenseScenario=scenario==='defense';
const defenseAnyOutcome=process.argv.includes('--defense-any-outcome');
const defenseAfterSuccession=process.argv.includes('--defense-after-succession');
const defenseSameMonth=process.argv.includes('--defense-same-month');
const defenseTenGenerals=process.argv.includes('--defense-ten-generals');
const verifyDefenderTaps=defenseSameMonth||defenseTenGenerals;
const verifyDefensiveSuccession=defenseAfterSuccession||verifyDefenderTaps;
assert.ok(!defenseAnyOutcome||defenseScenario,'--defense-any-outcome requires the defense scenario');
const findGenerals=process.argv.includes('--find-generals');
assert.ok(!findGenerals||scenario==='victory','General search acceptance requires the victory scenario');
const periodFlag=process.argv.find(arg=>arg.startsWith('--period='));
const campaignPeriod=Number(periodFlag?.split('=')[1]??(liuBeiTransit ? 2 : 1));
assert.ok([1,2,3,4].includes(campaignPeriod)&&
    (campaignPeriod===1||['probe','victory','save'].includes(scenario)||verifyDefenderTaps||liuBeiTransit),
    'Select an original period for probe, victory, save or a supported defense campaign');
const mobileCampaignFlag=process.argv.find(arg=>arg.startsWith('--mobile-width='));
const mobileCampaignWidth=Number(mobileCampaignFlag?.split('=')[1]??0);
assert.ok(!mobileCampaignFlag||['victory','defense','arrival','empty','save'].includes(scenario)&&[667,844].includes(mobileCampaignWidth),
    'Mobile campaign victory, defense, arrival, empty or save requires a 667px or 844px landscape viewport');
const rotateSkippedNoteFlag=process.argv.find(arg=>arg.startsWith('--rotate-skipped-note='));
const rotateSkippedNote=rotateSkippedNoteFlag?.split('=')[1];
assert.ok(!rotateSkippedNoteFlag||scenario==='empty'&&mobileCampaignWidth&&['occupation','arrival'].includes(rotateSkippedNote),
    '--rotate-skipped-note=occupation|arrival requires a mobile empty-city campaign');
assert.ok(!defenseAfterSuccession||defenseScenario&&mobileCampaignWidth&&!defenseAnyOutcome,
    '--defense-after-succession requires mobile defense victory');
assert.ok(!defenseSameMonth||defenseScenario&&mobileCampaignWidth&&!defenseAnyOutcome&&!defenseAfterSuccession,
    '--defense-same-month requires a mobile defense campaign');
assert.ok(!defenseTenGenerals||defenseScenario&&mobileCampaignWidth&&campaignPeriod===4&&
    !defenseSameMonth&&!defenseAnyOutcome&&!defenseAfterSuccession,
    '--defense-ten-generals requires the period 4 mobile defense campaign');
const battleOpeningStatus=process.argv.includes('--battle-opening-status');
const missingOpeningStatusArt=process.argv.includes('--opening-status-art-missing');
const lastCityEquipment=process.argv.includes('--last-city-equipment');
assert.ok(!battleOpeningStatus||scenario==='victory'&&mobileCampaignWidth&&campaignPeriod===1,
    '--battle-opening-status requires the period 1 mobile victory campaign');
assert.ok(!missingOpeningStatusArt||battleOpeningStatus,'--opening-status-art-missing requires --battle-opening-status');
assert.ok(!lastCityEquipment||scenario==='victory'&&mobileCampaignWidth&&campaignPeriod===1&&!battleOpeningStatus,
    '--last-city-equipment requires the period 1 mobile victory campaign');
const captiveScenario=scenario==='captives',preflightOnly=process.argv.includes('--preflight-only');
const captiveOrder=process.argv.includes('--captive-order');
const captiveUntilJoined=process.argv.includes('--captive-until-joined');
const captiveWidthFlag=process.argv.find(arg=>arg.startsWith('--captive-width='));
const captiveWidth=Number(captiveWidthFlag?.split('=')[1]??1920);
const captiveMobileFlag=process.argv.find(arg=>arg.startsWith('--captive-mobile-width='));
const captiveMobileWidth=Number(captiveMobileFlag?.split('=')[1]??0);
const captiveResumeFlag=process.argv.find(arg=>arg.startsWith('--captive-resume='));
assert.ok(!captiveScenario||!staged,'Captive inspection uses the current original installed engine only');
assert.ok(!preflightOnly||captiveScenario,'Preflight-only is limited to the isolated captive scenario');
assert.ok(!captiveOrder||captiveScenario&&!preflightOnly,'Surrender order requires a live captive scenario');
assert.ok(!captiveUntilJoined||captiveOrder,'Waiting for a successful surrender requires --captive-order');
assert.ok(!captiveWidthFlag||captiveScenario&&[1280,1920].includes(captiveWidth),'Captive desktop viewport is 1280 or 1920 pixels wide');
assert.ok(!captiveMobileFlag||captiveOrder&&[667,844].includes(captiveMobileWidth),'Mobile captive orders require a 667px or 844px landscape viewport');
assert.ok(!captiveResumeFlag||captiveOrder,'Captive replay requires a live surrender order');
const winningScenarios=new Set(['victory','arrival','campaign','save','restart','captives']);
const defaultWinningFixture=[
    {lord:'董卓',origin:15,target:16,leaders:['吕布','张辽','李儒'],recruitments:7}, // 洛阳 → 许昌
    {lord:'刘备',origin:13,target:7,leaders:['关羽','张飞'],recruitments:3}, // 徐州 → 北海
    {lord:'曹操',origin:26,target:32,leaders:['许褚','张辽'],recruitments:2}, // 襄阳 → 武陵
    {lord:'刘禅',origin:14,target:8,leaders:['赵云','马超'],recruitments:3}, // 汉中 → 天水
][campaignPeriod-1];
const winningFixture=lastCityEquipment?{...defaultWinningFixture,target:21,opponent:'袁术'}:defaultWinningFixture;
const emptyMobileFixture={lord:'刘表',origin:26,target:32,leader:'蔡瑁'}; // 襄阳 → 武陵
const startingLord=mobileCampaignWidth&&scenario==='empty'?emptyMobileFixture.lord:
    campaignPeriod===1&&!winningScenarios.has(scenario)&&!defenseScenario?'马腾':winningFixture.lord;
const artifactFlag = process.argv.indexOf('--artifact-dir');
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/campaign-runtime-smoke'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.lib': 'application/octet-stream' };
const report = { scenario, period:campaignPeriod, staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
if (liuBeiTransit) {
    assert.equal(campaignPeriod, 2);
    Object.assign(report, {route:{period:2,king:'刘备',origin:12,originName:'濮阳'},destination:westTransit?0:6,sources:{}});
}
if(captiveScenario)Object.assign(report,{accepted:false,identityAccepted:false,hdAccepted:false,captiveAccepted:false,personCaptivesAccepted:false,preflightOnly});
if(captiveOrder)report.captiveOrderAccepted=false;
const acknowledgedProgressReports=new Set();
let progressReportIndex=0;

// Only the captive scenario uses this frozen, repository-bounded HTTP inventory.
// The older campaign entry points retain their existing source/cleanup contract.
const captiveAssets=new Map(),captiveDirectories=['js','css','assets','vendor/iBaye'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let captiveLib,runCaptiveInspection,captiveSampleOwned=async()=>{};
let captiveMobileDocument=false;
let mobileCampaignInput=null;
const processIdentity=p=>({ProcessId:p.ProcessId,ParentProcessId:p.ParentProcessId,CreationDate:p.CreationDate,ExecutablePath:p.ExecutablePath});
function walkCaptiveSources(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(i=>i.isDirectory()?walkCaptiveSources(path.join(directory,i.name)):[path.join(directory,i.name)]);}
function freezeCaptiveAsset(rel){
    assert.ok(typeof rel==='string'&&!path.isAbsolute(rel)&&!rel.split('/').includes('..'),'Frozen asset remains repository relative');
    if(captiveAssets.has(rel))return captiveAssets.get(rel);
    const data=fs.readFileSync(path.join(root,rel)),metadata={source:rel,bytes:data.length,sha256:sha(data)};
    report.sources[rel]=metadata;const asset={data,metadata};captiveAssets.set(rel,asset);return asset;
}
async function prepareCaptiveSources(){
    report.sources={};
    for(const dir of captiveDirectories)for(const filename of walkCaptiveSources(path.join(root,dir)))freezeCaptiveAsset(path.relative(root,filename).replaceAll('\\','/'));
    const tool=path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/');
    const helpers=['scripts/hd-runtime-owned-chrome.mjs','scripts/hd-runtime-json.mjs','scripts/hd-person-identity-runtime-checks.mjs','scripts/hd-person-identity-rom.mjs','scripts/hd-captive-person-runtime-checks.mjs','scripts/hd-mobile-preview-runtime-checks.mjs'];
    for(const rel of ['package.json','.gitattributes','pc.html','m.html','fonts/HarmonyOS_Sans_SC_Regular.ttf','favicon.png','qr.png','scripts/write-wasm-manifest.mjs',tool,...helpers])freezeCaptiveAsset(rel);
    captiveLib=freezeCaptiveAsset('libs/dat-mod.lib').data;
    assert.equal(captiveLib.length,207195);assert.equal(sha(captiveLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    const build=JSON.parse(freezeCaptiveAsset('js/baye.build.json').data);
    for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const a=freezeCaptiveAsset('js/'+name);assert.equal(a.data.length,build.artifacts[name].bytes);assert.equal(a.metadata.sha256,build.artifacts[name].sha256);}
    const names=walkCaptiveSources(path.join(root,'vendor/iBaye')).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(n=>n!=='vendor/iBaye/src/baye/version.h').sort(),hash=crypto.createHash('sha256'),files=[];
    for(const name of names){const a=freezeCaptiveAsset(name);hash.update(name+'\0');hash.update(a.data);files.push({name,...a.metadata});}
    assert.equal(names.length,128);report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),manifest:build.engineSourceSha256,files};assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256);report.engineManifest=build;report.tool=freezeCaptiveAsset(tool).metadata;
    for(const [source,dest] of [[tool,'executed-tool.mjs'],['scripts/hd-captive-person-runtime-checks.mjs','executed-captive-helper.mjs'],['scripts/hd-person-identity-runtime-checks.mjs','executed-identity-helper.mjs'],['scripts/hd-person-identity-rom.mjs','executed-rom.mjs'],['scripts/hd-runtime-owned-chrome.mjs','executed-owned-chrome.mjs'],['scripts/hd-runtime-json.mjs','executed-json.mjs'],['js/hd-city-menu.js','executed-city-menu.js']])fs.writeFileSync(path.join(artifactDir,dest),freezeCaptiveAsset(source).data,{flag:'wx'});
    // Resolve the maintained helper before opening Chrome and retain that exact
    // module instance for the single post-battle inspection. Never run copies.
    const helper='scripts/hd-captive-person-runtime-checks.mjs',pin=freezeCaptiveAsset(helper).metadata;
    assert.equal(sha(fs.readFileSync(path.join(root,helper))),pin.sha256);
    ({runCaptiveInspection}=await import('./hd-captive-person-runtime-checks.mjs'));
    assert.equal(typeof runCaptiveInspection,'function');assert.equal(sha(fs.readFileSync(path.join(root,helper))),pin.sha256);
}
function verifyCaptiveSources(){
    const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),actualSha256=fs.existsSync(f)?sha(fs.readFileSync(f)):null;return {name,...m,actualSha256,match:actualSha256===m.sha256};});
    const added=captiveDirectories.flatMap(dir=>walkCaptiveSources(path.join(root,dir))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(n=>!captiveAssets.has(n)),drift=sources.filter(s=>!s.match);
    return {ok:!added.length&&!drift.length,count:sources.length,added,drift,sources};
}
function persistCaptiveOwnership(s,sameRoot){return {schemaVersion:s.schemaVersion,rootPid:s.rootPid,profile:s.profile,sampledAt:s.sampledAt,rootVerified:s.rootVerified&&sameRoot,sameRoot,owned:sameRoot&&s.rootVerified?s.owned:[],excludedIdentities:s.excluded.map(processIdentity),profileMatchIdentities:s.profileMatches.map(processIdentity)};}
function persistCaptiveCleanup(p,basis){
    const recorded=q=>basis.owned.some(o=>o.ProcessId===q.ProcessId&&o.CreationDate===q.CreationDate&&o.ExecutablePath===q.ExecutablePath&&o.CommandLine===q.CommandLine);
    return {schemaVersion:p.schemaVersion,rootPid:p.rootPid,profile:p.profile,treeExited:p.treeExited,directoriesDeleted:p.directoriesDeleted,errors:p.errors,stopEvents:p.stopEvents,recordedOwned:basis.owned,samples:p.samples.map(s=>({stage:s.stage,sampledAt:s.sampledAt,owned:s.processes.filter(recorded),unrelatedCount:s.processes.filter(q=>!recorded(q)).length})),recheck:p.recheck&&{targets:p.recheck.targets.map(processIdentity),absent:p.recheck.absent.map(processIdentity),refused:p.recheck.refused.map(q=>({recorded:processIdentity(q.recorded),current:processIdentity(q.current),reason:q.reason}))},exitVerification:p.exitVerification&&{treeExited:p.exitVerification.treeExited,survivingRecorded:p.exitVerification.survivingRecorded.map(processIdentity),rootDescendants:p.exitVerification.rootDescendants.map(processIdentity),profileMatches:p.exitVerification.profileMatches.map(processIdentity)}};
}
async function observeCaptiveLib(cdp,stage){
    const expression='(()=>{const before=Number(baye.data.g_hdSpeGeneration),a=BayeHdLibIdentity.read(),hex=window.dynLib,b=BayeHdLibIdentity.read(),after=Number(baye.data.g_hdSpeGeneration);return {before,after,a,b,hex};})()',first=await evaluate(cdp,expression),last=await evaluate(cdp,expression);
    for(const r of [first,last]){assert.equal(r.before,r.after);assert.ok(Number.isInteger(r.before)&&r.before>0);assert.equal(r.a.status,'ready');assert.equal(r.b.status,'ready');assert.equal(r.a.generation,r.b.generation);assert.equal(r.a.sha256,sha(captiveLib));assert.equal(r.b.sha256,sha(captiveLib));assert.ok(typeof r.hex==='string'&&/^(?:[0-9a-f]{2})+$/i.test(r.hex));const bytes=Buffer.from(r.hex,'hex');assert.equal(bytes.length,captiveLib.length);assert.equal(sha(bytes),sha(captiveLib));}
    assert.equal(last.before,first.before);assert.equal(last.a.generation,first.a.generation);assert.equal(last.hex,first.hex);report.actualLibReads??=[];report.actualLibReads.push({stage,first,last});
}

const captiveObserverSource="(function(){\n window.__identityKeys=[];window.__identityTouches=[];window.__identityCalls=[];window.__identityEvents=[];\n let depth=0;for(const[object,name,api]of[[window,'sendKey','window.sendKey'],[baye,'sendKey','baye.sendKey']]){const old=object[name];if(typeof old!=='function')throw Error('Missing public native input');object[name]=function(code){const outer=depth++===0;try{return old.apply(this,arguments);}finally{depth--;window.__identityCalls.push({api,code,at:performance.now(),depth});if(outer)window.__identityKeys.push(code);}};}\n if(typeof window._bayeSendTouchEvent!=='function')throw Error('Missing real touch binding');const touch=window._bayeSendTouchEvent;window._bayeSendTouchEvent=function(){window.__identityTouches.push(Array.from(arguments));return touch.apply(this,arguments);};\n for(const type of ['pointerdown','pointerup','click','keydown','keyup','wheel','touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{if(e.isTrusted)window.__identityEvents.push({type,key:e.key||null,x:e.clientX||0,y:e.clientY||0,target:e.target.id||e.target.tagName,at:performance.now()});},true);\n window.__identitySample=function(){\n  const d=baye.data,a=BayeHdLibIdentity.read();\n  const take=(o,ks)=>Object.fromEntries(ks.map(k=>{const v=Number(o[k]);if(!Number.isInteger(v))throw Error('Noninteger native '+k);return[k,v];}));\n  const world=()=>{const n=Number(baye.getPersonCount()),nc=Number(d.g_engineConfig.citiesCount);if(n!==200||nc!==38||Number(d.g_Persons.length)!==2000||Number(d.g_PersonsQueue.length)!==2000||Number(d.g_Cities.length)!==38||Number(baye.getToolCount())!==33)throw Error('Original world ABI counts');return {config:take(d.g_engineConfig,['citiesCount','enable16bitConsumeMoney','fixAlienateComsumeThew']),period:Number(d.g_PIdx),king:Number(d.g_PlayerKing),year:Number(d.g_YearDate),month:Number(d.g_MonthDate),people:Array.from({length:200},(_,i)=>take(d.g_Persons[i],['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'])),cities:Array.from({length:38},(_,i)=>take(d.g_Cities[i],['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons','Tools','ToolQueue'])),queue:Array.from(d.g_PersonsQueue,Number),goodsQueue:Array.from(d.g_GoodsQueue,Number),fighters:Array.from(d.FIGHTERS,Number),fighterIndex:Array.from(d.FIGHTERS_IDX,Number),orders:Array.from(d.g_OrderQueue,o=>take(o,['OrderId','City','Person','Object','TimeCount','Food','Arms','Money','Consume'])),tools:Array.from({length:33},(_,i)=>take(d.g_Tools[i],['useflag','changeAttackRange','at','iq','move','arm']))};};\n  const native=()=>({generation:Number(d.g_hdDetailGeneration),mapCity:Number(d.g_hdMapCity),mapPick:Number(d.g_hdMapPick),cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},menu:baye.hd.menuItems(),march:baye.hd.march(),report:baye.hd.report(),qty:baye.hd.qty(),person:baye.hd.personProperties(),diplomacy:baye.hd.diplomacy()});\n  const before=native(),w=world(),cityUi=BayeHdCityMenu.debugSnapshot(),after=native(),w2=world(),b=BayeHdLibIdentity.read();\n  if(d!==baye.data||a.status!=='ready'||a.sha256!=='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'||JSON.stringify(a)!==JSON.stringify(b)||JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(w)!==JSON.stringify(w2))throw Error('Unstable original native/person/world sample');\n  if(w.queue.length!==2000||w.goodsQueue.length!==2000||w.fighters.length!==600||w.fighterIndex.length!==30||w.orders.length!==200)throw Error('Truncated original world arrays'); for(const name of ['queue','goodsQueue','fighters','fighterIndex'])if(!w[name].every(Number.isInteger))throw Error('Invalid native '+name);\n  return {world:w,native:after,state:{menu:after.menu,cityUi,qty:after.qty,report:after.report,keyCount:window.__identityKeys.length,touchCount:window.__identityTouches.length},identity:a};\n };\n return {keys:true,touch:true,forwardOnce:true};\n})()";

async function startServer(port=0) {
    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'pc.html';
            if(captiveScenario) {
                const asset=captiveAssets.get(rel);
                if(!asset){report.requests.push({url:url.pathname,status:404,expected:rel==='favicon.ico'});res.writeHead(404).end();return;}
                report.requests.push({url:url.pathname,status:200,...asset.metadata});
                res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});
                res.end(asset.data);return;
            }
            const base = staged && /^js\/baye\.(js|wasm|wasm\.map)$/.test(rel) ? path.join(root, 'build/wasm/src') : root;
            const filename = path.resolve(base, base === root ? rel : path.basename(rel));
            if (!filename.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
            fs.readFile(filename, (err, data) => {
                if (err) { report.requests.push({ url: url.pathname, status: 404 }); res.writeHead(404).end(); return; }
                if (liuBeiTransit) {
                    const name = rel === 'js/baye.wasm' ? 'baye.wasm' : rel;
                    const metadata = {source:path.relative(root,filename),bytes:data.length,sha256:sha(data)};
                    if (report.sources[name] && report.sources[name].sha256 !== metadata.sha256) {
                        (report.changedResponses ??= []).push(name);
                        res.writeHead(409).end();
                        return;
                    }
                    report.sources[name] = metadata;
                }
                if (/baye\.(js|wasm|wasm\.map)$/.test(filename) || /\.lib$/.test(filename)) {
                    report.requests.push({ url: url.pathname, status: 200, source: path.relative(root, filename), bytes: data.length });
                }
                res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(data);
            });
        } catch { res.writeHead(400).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    return server;
}

async function unusedPort() {
    const socket = net.createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    return port;
}

async function connectCdp(url) {
    const ws = new WebSocket(url);
    let sequence = 0;
    const pending = new Map();
    const listeners = new Map();
    const rejectAll = () => {
        for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('CDP connection closed')); }
        pending.clear();
    };
    ws.addEventListener('close', rejectAll);
    ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const task = pending.get(msg.id); pending.delete(msg.id); clearTimeout(task.timer);
            if (msg.error) task.reject(new Error(JSON.stringify(msg.error)));
            else task.resolve(msg.result);
        } else if (listeners.has(msg.method)) {
            listeners.get(msg.method)(msg.params);
        }
    });
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error('Cannot connect to Chrome DevTools')), { once: true });
    });
    return {
        on: (name, callback) => listeners.set(name, callback),
        send(method, params = {}) {
            if (ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP connection is closed'));
            const id = ++sequence;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
                pending.set(id, { resolve, reject, timer });
                ws.send(JSON.stringify({ id, method, params }));
            });
        },
        close() { rejectAll(); ws.close(); }
    };
}

async function evaluate(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
}

async function waitFor(cdp, description, expression, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const value = await evaluate(cdp, expression);
        if (value) return value;
        await delay(150);
    }
    throw new Error('Timed out waiting for ' + description);
}

async function acknowledgeCampaignReport(cdp,native) {
    const selector='#hd-dialog [data-hd-dlg-ok]';
    if(!mobileCampaignInput)return click(cdp,selector);
    const offset=await evaluate(cdp,'__runtimeEngineInputs.length');
    const retired=`(() => {const r=baye.hd.report();return r.active!==1||r.seq!==${native.seq}||r.inputSeq!==${native.inputSeq};})()`;
    if(!await click(cdp,selector,{retired}))return;
    await waitFor(cdp,'native report acknowledgement',retired);
    const keys=await evaluate(cdp,`__runtimeEngineInputs.slice(${offset}).map(input=>input.code)`);
    assert.deepEqual(keys,[39],'A mobile report tap acknowledges exactly one current report');
    report.mobileReportAcks??=[];report.mobileReportAcks.push({native,keys});
}

async function waitForGameProgress(cdp,description,expression,timeout=20000,nativeProgress=null) {
    const started=Date.now(),deadline=started+(nativeProgress?.maxTimeout??timeout);
    let lastProgress=started,previousNative=null;
    const progress=nativeProgress?{description,round:nativeProgress.round,bout:nativeProgress.bout,
        startedAt:new Date(started).toISOString(),noProgressTimeoutMs:timeout,
        totalTimeoutMs:nativeProgress.maxTimeout,trace:[]}:null;
    if(progress) {report.progressWaits??=[];report.progressWaits.push(progress);}
    const finish=(status)=> {
        if(progress)Object.assign(progress,{status,elapsedMs:Date.now()-started,
            noProgressMs:Date.now()-lastProgress,finishedAt:new Date().toISOString()});
    };
    while(Date.now()<deadline) {
        const value=await evaluate(cdp,expression);
        if(value&&!progress)return value;
        const owners=await evaluate(cdp,progress?
            `({fight:baye.hd.fight(),spe:baye.hd.spe(),report:baye.hd.report(),dialog:BayeHdDialog.debugSnapshot()})`:
            `({report:baye.hd.report(),dialog:BayeHdDialog.debugSnapshot()})`);
        if(progress) {
            const now=Date.now(),f=owners.fight,s=owners.spe,r=owners.report;
            if(now>=deadline) {
                finish('total-timeout');
                throw new Error('Timed out waiting for '+description+' (total native wait limit reached)');
            }
            const native={bout:f.bout,fightInputSeq:f.inputSeq,focusX:f.focusX,focusY:f.focusY,
                speSeq:s.seq,speActive:s.active,reportSeq:r.seq,reportInputSeq:r.inputSeq,reportActive:r.active};
            const changed=Object.keys(native).filter(key=>!previousNative||native[key]!==previousNative[key]);
            if(changed.length) {
                lastProgress=now;
                progress.trace.push({at:new Date(now).toISOString(),elapsedMs:now-started,changed,native});
                previousNative=native;
            }
            if(value) {finish('complete');return value;}
            if(now-lastProgress>=timeout) {
                finish('no-native-progress');
                throw new Error('Timed out waiting for '+description+' (no native progress for '+timeout+'ms)');
            }
        }
        const native=owners.report,dialog=owners.dialog;
        if(native?.active===1&&native.inputSeq>0&&dialog?.open&&dialog.kind==='report'&&!dialog.pass&&
            dialog.reportOwner&&Number(dialog.reportOwner.inputSeq)===Number(native.inputSeq)&&
            Number(dialog.reportOwner.seq)===Number(native.seq)) {
            const token=native.seq+':'+native.inputSeq;
            if(!acknowledgedProgressReports.has(token)) {
                // This report can arrive between the progress and owner reads.
                // Give the caller the matching report before advancing it.
                const currentMatch=await evaluate(cdp,expression);
                if(currentMatch) {finish('complete');return currentMatch;}
                acknowledgedProgressReports.add(token);
                await checkpoint(cdp,'progress-native-report-'+(++progressReportIndex));
                const current=await evaluate(cdp,'baye.hd.report()');
                if(current.active===1&&current.seq===native.seq&&current.inputSeq===native.inputSeq) {
                    report.progressReports??=[];
                    report.progressReports.push({description,owner:native});
                    await acknowledgeCampaignReport(cdp,native);
                }
            }
        }
        await delay(150);
    }
    finish('total-timeout');
    throw new Error('Timed out waiting for '+description);
}

const snapshotExpression = `(() => {
    const api = window.baye, d = api && api.data;
    const read = (key) => { try { return d && d[key]; } catch { return null; } };
    return {
        ready: !!(api && api.hd && api.hd.ready()), engineReady: read('g_hdEngineReady'),
        fightMenuControl: read('g_hdFightMenuControl'), period: read('g_PIdx'), playerKing: read('g_PlayerKing'),
        menu: api && api.hd && api.hd.menuItems(), qty: api && api.hd && api.hd.qty(),
        kings: api && api.hd && api.hd.kings(),
        record: api && api.hd && api.hd.record && api.hd.record(),
        movie: api && api.hd && api.hd.movie(), spe: api && api.hd && api.hd.spe(),
        realm: api && api.hd && api.hd.realm(), report: api && api.hd && api.hd.report(), year: read('g_YearDate'), month: read('g_MonthDate'),
        fight: api && api.hd && api.hd.fight(), march: api && api.hd && api.hd.march(),
        system: window.BayeHdSystemUi && BayeHdSystemUi.debugSnapshot(),
        city: window.BayeHdCityMenu && BayeHdCityMenu.debugSnapshot(),
        dialog: window.BayeHdDialog && BayeHdDialog.debugSnapshot(),
        overworld: window.BayeHdOverworld && BayeHdOverworld.debugSnapshot(),
        battle: window.BayeHdBattle && BayeHdBattle.debugSnapshot(),
        mobile: location.pathname==='/m.html'?{map:window.BayeHdMobileMap?.snapshot(),city:window.BayeHdMobileCity?.snapshot(),
            battle:window.BayeHdMobileBattle?.debugSnapshot(),system:window.BayeHdMobileSystem?.snapshot()}:null,
        bodyClass: document.body.className, lastHdCall: window.__bayeLastHdCall
    };
})()`;

function unloadedWorldOwner(state, personCount) {
    if(personCount!==0)return null;
    if(state.menu?.active===1&&state.menu.context===4&&state.menu.kind===1)
        return {loaded:false,reason:'native-world-not-loaded',personCount,owner:'title',seq:state.menu.seq};
    if(state.record?.active===1&&state.record.mode===2)
        return {loaded:false,reason:'native-world-not-loaded',personCount,owner:'load',seq:state.record.seq};
    return null;
}

async function checkpoint(cdp, name, extra = null) {
    const state = await evaluate(cdp, snapshotExpression);
    if(extra)Object.assign(state,extra);
    if (state.fight?.active) state.rawBattle = await evaluate(cdp, battleStateExpression);
    if (/^(army-fixture|domestic|save|load|restart)/.test(name)) {
        const personCount=await evaluate(cdp,'baye.getPersonCount()');
        state.worldStatus=unloadedWorldOwner(state,personCount);
        if(!state.worldStatus) {
            state.world=await evaluate(cdp,worldExpression);
            state.worldStatus={loaded:true,personCount:state.world.personCount};
        }
    }
    report.phases.push({ name, ...state });
    fs.writeFileSync(path.join(artifactDir, name + '.json'), JSON.stringify(state, null, 2) + '\n');
    console.log('PASS', name);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(image.data, 'base64'));
    return state;
}

async function key(cdp, name) {
    assert.ok(!mobileCampaignInput,'The mobile campaign uses actual touch controls');
    report.inputs.push({ type:"key", key:name, at:new Date().toISOString() });
    const codes = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, h: 72, f: 70, s: 83, ' ': 32 };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await delay(180);
}

async function captiveTouch(cdp,type,points=[]) {
    const {width,height}=report.mobileViewport;
    assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<width&&p.y>=0&&p.y<height));
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((point,id)=>({...point,id,radiusX:2,radiusY:2,force:1}))});
    report.inputs.push({type,points});
    await delay(75);
}

async function captiveTap(cdp,point) {
    await captiveTouch(cdp,'touchStart',[point]);
    await captiveTouch(cdp,'touchEnd');
    await delay(175);
}

async function click(cdp, selector, options) {
    report.inputs.push({ type:captiveMobileDocument||mobileCampaignInput?'tap':'click', selector, at:new Date().toISOString() });
    if(mobileCampaignInput)return mobileCampaignInput.click(selector,options);
    const expression=`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        ${captiveMobileDocument?'':'node.scrollIntoView({ block: \'center\' });'}
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        const x=rect.x+rect.width/2,y=rect.y+rect.height/2,top=document.elementFromPoint(x,y);
        return {x,y,unobstructed:!!(top&&(top===node||node.contains(top))),disabled:!!node.disabled,top:top&&top.id};
    })()`;
    let point=null,previous=null,last=null;
    const deadline=Date.now()+20000;
    while(Date.now()<deadline) {
        const current=await evaluate(cdp,expression);
        last=current;
        if(current?.unobstructed&&!current.disabled&&previous&&
            Math.abs(current.x-previous.x)<0.5&&Math.abs(current.y-previous.y)<0.5) {point=current;break;}
        previous=current?.unobstructed&&!current.disabled?current:null;
        await delay(100);
    }
    report.lastClickTarget={selector,last,stable:!!point};
    assert.ok(point, 'Visible click target: ' + selector);
    assert.ok(point.unobstructed, 'Click target is not covered: '+selector+' (top='+point.top+')');
    const mousePoint={x:point.x,y:point.y};
    if(captiveMobileDocument)return captiveTap(cdp,mousePoint);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mousePoint, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mousePoint, button: 'left', clickCount: 1 });
    await delay(250);
}

function mobileQuantityControl(cityAttribute,dialogAttribute=cityAttribute) {
    return `body.hd-mobile-city-on #hd-city-menu [${cityAttribute}],`+
        `html[data-baye-dialog-qty="1"] body.hd-mobile-dialog-on #hd-dialog [${dialogAttribute}]`;
}

async function confirmCampaignQuantity(cdp) {
    if(!mobileCampaignInput)return click(cdp,await evaluate(cdp,
        `BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'`));
    const current=await waitFor(cdp,'visible native quantity input owner',`(() => {
        const host=BayeHdMobileCity.snapshot(),q=baye.hd.qty();
        const standalone=baye.hd.march().phase!==2;
        const ticket=standalone?host.dialogVisible&&BayeHdDialog.getInputTicket():host.cityVisible&&BayeHdCityMenu.getMarchDialogTicket();
        return q.active===1&&q.ready===1&&ticket?.ownerType==='qty'&&
            {standalone,keys:__runtimeEngineInputs.length,session:q.session,inputSeq:q.inputSeq};
    })()`);
    await click(cdp,current.standalone?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]');
    await waitFor(cdp,'original quantity confirmation acknowledged',`(() => {const q=baye.hd.qty();
        return q.session!==${current.session}||q.active===0||q.inputSeq!==${current.inputSeq}&&q.lastKey===39;})()`);
    assert.deepEqual(await evaluate(cdp,`__runtimeEngineInputs.slice(${current.keys}).map(input=>input.code)`),[39],
        'One touch sends one original quantity confirmation');
}

function engineInputRecorderExpression(documentId) {
    assert.ok(Number.isInteger(documentId)&&documentId>=0,'input recorder document ID is valid');
    return `(() => {
        const previous=window.__runtimeEngineInputRecorder;
        if(previous) {
            if(previous.wrapper!==window.sendKey||previous.inputs!==window.__runtimeEngineInputs||
                !Array.isArray(previous.inputs)||!Number.isInteger(previous.documentId))
                throw new Error('Native input recorder ownership changed');
            return {installed:false,documentId:previous.documentId,count:previous.inputs.length};
        }
        if(typeof window.sendKey!=='function')throw new Error('Native sendKey must exist before input recording');
        const original=window.sendKey,inputs=[];
        const wrapper=function(code) {
            const f=baye.hd.fight(),m=baye.hd.march();
            inputs.push({code,fightKind:f.inputKind,fightSeq:f.inputSeq,marchPhase:m.phase,marchSeq:m.inputSeq,marchSession:m.session});
            return original.apply(this,arguments);
        };
        window.__runtimeEngineInputs=inputs;
        window.__runtimeEngineInputRecorder={documentId:${documentId},inputs,wrapper};
        window.sendKey=wrapper;
        return {installed:true,documentId:${documentId},count:0};
    })()`;
}

const engineInputDocumentExpression=`(() => {
    const recorder=window.__runtimeEngineInputRecorder;
    if(!recorder||recorder.wrapper!==window.sendKey||recorder.inputs!==window.__runtimeEngineInputs||
        !Array.isArray(recorder.inputs)||!Number.isInteger(recorder.documentId))
        throw new Error('Native input recording is unavailable for the current document');
    return {documentId:recorder.documentId,inputs:recorder.inputs};
})()`;
let nextEngineInputDocument=0;

async function installEngineInputRecorder(cdp) {
    const installed=await evaluate(cdp,engineInputRecorderExpression(nextEngineInputDocument));
    assert.ok(installed&&typeof installed.installed==='boolean'&&Number.isInteger(installed.documentId),'native input recorder acknowledges its document');
    if(installed.installed) {
        assert.equal(installed.documentId,nextEngineInputDocument);
        nextEngineInputDocument++;
    }
    return installed;
}

async function archiveEngineInputDocument(cdp,label) {
    const current=await evaluate(cdp,engineInputDocumentExpression);
    assert.ok(current&&Number.isInteger(current.documentId)&&Array.isArray(current.inputs),'native input archive contains an actual recording');
    const documents=report.engineInputDocuments??=[];
    let document=documents.find(item=>item.documentId===current.documentId);
    if(document) {
        assert.deepEqual(current.inputs.slice(0,document.inputs.length),document.inputs,'previously archived native inputs remain the exact prefix of this document');
    } else {
        document={documentId:current.documentId,checkpoints:[],inputs:[]};
        documents.push(document);
    }
    document.inputs=current.inputs;
    document.checkpoints.push({label,count:current.inputs.length});
    report.engineInputs=documents.flatMap(item=>item.inputs);
}

async function installCaptiveObserver(cdp,stage) {
    await waitFor(cdp,'current original LIB identity',"window.BayeHdLibIdentity&&BayeHdLibIdentity.read().status==='ready'&&BayeHdLibIdentity.read().sha256==='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'&&typeof dynLib==='string'&&dynLib.length===414390",60000);
    await observeCaptiveLib(cdp,stage);
    assert.equal(await evaluate(cdp,'window.__runtimeEngineInputRecorder?.wrapper===window.sendKey'),true);
    const observer=await evaluate(cdp,captiveObserverSource);
    await evaluate(cdp,'window.__runtimeEngineInputRecorder.wrapper=window.sendKey');
    return observer;
}

async function smoke(cdp) {
    report.library=await waitForOriginalLibrary(cdp);
    await installEngineInputRecorder(cdp);
    if(captiveScenario)report.inputObserver=await installCaptiveObserver(cdp,'startup');
    const bindings = await evaluate(cdp, `({ ready: baye.data.g_hdEngineReady, control: baye.data.g_hdFightMenuControl,
        battlePref: BayeHdBattle.getMode(), hook: Object.prototype.hasOwnProperty.call(baye.hooks, 'fightOpenMainMenu') })`);
    assert.equal(bindings.ready, 1, 'HD C fields are bound after LIB initialization');
    assert.equal(bindings.control, 0);
    assert.equal(bindings.battlePref, 'auto', 'fresh profiles follow the overworld battle preference');
    assert.equal(await evaluate(cdp, 'BayeHdBattle.shouldShowHd()'), false, 'default overworld keeps classic battle');
    assert.equal(bindings.hook, false, 'classic battle does not own the engine menu hook');
    await checkpoint(cdp, '01-engine-ready');

    // Native title/era menus are animated pictures, not text menus. Observe
    // genuine C SPE notifications (MAIN_ICON1=100, YEAR_ICON1=104) without
    // creating replacement engine hooks or assigning game-state fields.
    await evaluate(cdp, `(() => {
        window.__runtimeSpeSeen = [];
        const remember = () => {
            const event = baye.hd.spe();
            if (event.id) window.__runtimeSpeSeen.push(event.id);
        };
        const original = BayeHdSpe.onEngineSpe;
        BayeHdSpe.onEngineSpe = function () { remember(); return original.apply(this, arguments); };
        remember();
    })()`);
    // Skip only the real opening movie, using the same Enter as a player.
    for (let i = 0; i < 20; i++) {
        const title = await evaluate(cdp, `window.__runtimeSpeSeen.includes(100)`);
        if (title) break;
        if (await evaluate(cdp, `baye.hd.movie().active || (baye.hd.spe().active && baye.hd.spe().kind === 1)`)) {
            await key(cdp, 'Enter');
        } else await delay(150);
    }
    await waitFor(cdp, 'classic animated title', `window.__runtimeSpeSeen.includes(100)`);
    await checkpoint(cdp, '02-classic-title');
    if (eliteTransit) return runEliteTransit(cdp);
    if (westTransit) return runWestTransit(cdp);
    await key(cdp, 'Enter');
    await waitFor(cdp, 'classic animated period selection', `window.__runtimeSpeSeen.includes(104)`);
    await checkpoint(cdp, '03-period');
    const era=await waitFor(cdp,'current native period chooser',`(() => {
        const m=baye.hd.menuItems();return m.active===1&&m.context===4&&m.kind===2&&m.count===4&&m;
    })()`);
    const periodIndex=campaignPeriod-1,forward=periodIndex>era.index;
    for(let index=era.index;index!==periodIndex;) {
        index+=forward?1:-1;
        await key(cdp,forward?'ArrowDown':'ArrowUp');
        await waitFor(cdp,'original period highlight ACK',`(() => {const m=baye.hd.menuItems();return m.seq===${era.seq}&&m.index===${index};})()`);
    }
    await key(cdp, 'Enter');
    await waitFor(cdp, 'lord selection', `baye.data.g_PIdx === ${campaignPeriod} && baye.hd.kings().count > 0`);
    await checkpoint(cdp, '04-lord');
    const lord = await evaluate(cdp, `(() => {
        const menu = baye.hd.kings();
        let target = menu.kings.findIndex((person) => person.name === ${JSON.stringify(startingLord)});
        if (${JSON.stringify(scenario)}==='empty') {
            const d=baye.data;
            const candidate=menu.kings.findIndex(king=>Array.from({length:baye.hdCityLimit()},(_,i)=>i).some(i=>
                Number(d.g_Cities[i].Belong)===king.id+1&&Number(d.g_Cities[i].Persons)>0&&
                baye.hd.cityLinks(i).some(link=>Number(d.g_Cities[Number(link.index)].Belong)===0)));
            if(candidate>=0)target=candidate;
        }
        return { target, index: menu.index, kings: menu.kings };
    })()`);
    assert.ok(lord.target>=0,'the actual native menu offers the requested starting lord');
    for (let i = lord.index; i < lord.target; i++) {await key(cdp, 'ArrowDown');await waitFor(cdp,'native initial lord DOWN ACK','baye.hd.kings().index==='+Number(i+1));}
    for (let i = lord.index; i > lord.target; i--) {await key(cdp, 'ArrowUp');await waitFor(cdp,'native initial lord UP ACK','baye.hd.kings().index==='+Number(i-1));}
    await waitFor(cdp, 'real lord highlight', `baye.hd.kings().index === ${lord.target}`);
    report.selectedLord = lord.kings[lord.target];
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', `baye.hd.march().pick && baye.hd.realm().ownedCount > 0`);
    assert.deepEqual(await evaluate(cdp,'[baye.data.g_PIdx,baye.data.g_PlayerKing]'),[campaignPeriod,report.selectedLord.id]);
    if(captiveScenario)report.initialOriginalWorld=await evaluate(cdp,'__identitySample()');
    await checkpoint(cdp, '05-classic-map');

    await campaignSmoke(cdp);
}

const mobileMapReady=`(() => {const h=BayeHdMobileMap.snapshot(),m=baye.hd.march();
    return h.active&&h.ownerType==='map'&&m.pick===1&&!m.battlePick&&!baye.hd.menuItems().active;})()`;

function waitForOriginalLibrary(cdp) {
    return waitFor(cdp,'original engine and authenticated LIB',`(() => {
        const api=window.BayeHdLibIdentity,lib=api&&api.read();
        return !window.__runtimeEngineInputRecorder&&window.baye?.hd?.ready()&&lib?.status==='ready'&&api.isCurrent(lib)&&lib.byteLength===207195&&
            lib.sha256==='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'&&lib;
    })()`,60000);
}

async function observeMobileCampaignDocument(cdp) {
    const library=await waitForOriginalLibrary(cdp);
    const recorder=await installEngineInputRecorder(cdp);
    await evaluate(cdp,`(() => {
        window.__campaignLcdTouches=[];
        const send=window._bayeSendTouchEvent;
        if(typeof send!=='function')throw Error('Original LCD touch handler must exist');
        window._bayeSendTouchEvent=function(...args){__campaignLcdTouches.push(args);return send.apply(this,args);};
    })()`);
    return {library,documentId:recorder.documentId};
}

function waitMobileCampaignSystem(cdp,screen) {
    return waitFor(cdp,'current mobile HD '+screen,`(() => {
        const h=BayeHdMobileSystem.snapshot(),s=BayeHdSystemUi.debugSnapshot();
        return h.active&&h.owner?.screen===${JSON.stringify(screen)}&&s.open&&!s.pending&&s.screen===h.owner.screen;
    })()`,120000);
}

async function smokeMobileCampaign(cdp) {
    const initial=await observeMobileCampaignDocument(cdp);
    report.mobileLibrary=initial.library;
    await waitMobileCampaignSystem(cdp,'title');
    await checkpoint(cdp,'01-mobile-title');
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    await waitMobileCampaignSystem(cdp,'period');
    await click(cdp,`#hd-system-ui [data-hd-sys="${campaignPeriod-1}"]`);
    await waitMobileCampaignSystem(cdp,'king');
    const kings=await evaluate(cdp,'baye.hd.kings()');
    const index=kings.kings.findIndex(person=>person.name===startingLord);
    assert.ok(index>=0,'The selected original period offers the prepared ruler');
    report.selectedLord=kings.kings[index];
    await checkpoint(cdp,'04-mobile-lords');
    await click(cdp,`#hd-system-ui [data-hd-sys="${index}"]`);
    await waitFor(cdp,'new original mobile strategy map',mobileMapReady,60000);
    assert.deepEqual(await evaluate(cdp,'[baye.data.g_PIdx,baye.data.g_PlayerKing]'),[campaignPeriod,report.selectedLord.id]);
    await campaignSmoke(cdp);
    report.mobileLcdTouches=(report.mobileLcdTouches||[]).concat(await evaluate(cdp,'__campaignLcdTouches'));
    assert.deepEqual(report.mobileLcdTouches,[],'The whole mobile campaign uses the HD touch surfaces');
    assert.ok(report.inputs.every(input=>input.type!=='key'&&input.type!=='action'),'No synthetic game action bypasses the mobile controls');
}

async function action(cdp, label, expression) {
    assert.ok(!mobileCampaignInput,'The mobile campaign uses the visible native controls');
    if (captiveMobileDocument && expression.startsWith('BayeHdBattle.')) {
        // Let the mobile host observe the new native owner before the shared
        // battle driver starts its next command.
        await waitFor(cdp, 'displayed mobile battle input before ' + label, `(() => {
            const fight=baye.hd.fight(), shown=BayeHdMobileBattle.debugSnapshot();
            return shown.presentation==='hd'&&shown.inputKind===fight.inputKind&&shown.inputSeq===fight.inputSeq;
        })()`);
    }
    const before=await evaluate(cdp,'({fight:baye.hd.fight(),march:baye.hd.march(),menu:baye.hd.menuItems()})');
    const result=await evaluate(cdp, expression);
    report.inputs.push({type:'action', label, before, result, at:new Date().toISOString()});
    return result;
}

const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<0xfffe) units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),arms:Number(d.g_Persons[id-1].Arms)});
    }
    return {fight:baye.hd.fight(),units,mode:Number(d.g_FgtParam.Mode),mainGen:Number(d.g_MainGenIdx),weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
})()`;

async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot(),h=window.BayeHdMobileBattle?.debugSnapshot();
        return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&
            (!${!!mobileCampaignInput}||h?.presentation==='hd'&&h.inputKind===f.inputKind&&h.inputSeq===f.inputSeq)&&f;})()`,timeout);
}
async function nativeLcdVisibility(cdp) {
    return evaluate(cdp,`(() => {
        const help=BayeHdDialog.debugSnapshot();
        const dialog=document.querySelector('#hd-dialog');
        if(help.open&&help.kind==='help'&&help.body&&dialog) {const r=dialog.getBoundingClientRect(),s=getComputedStyle(dialog),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&dialog.contains(top))return {visible:true,id:'hd-dialog',kind:help.kind,text:help.body,top:top&&top.id};}
        const nodes=[...document.querySelectorAll('canvas')].filter(n=>n.id!=='hd-battle-canvas' && n.id!=='hd-overworld-canvas');
        return nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:n.id,width:r.width,height:r.height,display:s.display,visibility:s.visibility,top:top&&top.id,visible:!!(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&(top===n||n.contains(top)))};}).find(n=>n.visible)||{visible:false,nodes:nodes.map(n=>n.id)};
    })()`);
}
const moveTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),out=[];
    const sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY);
    for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++) {
        const px=x-sx+ux,py=y-sy+uy;
        if(px>=0&&py>=0&&px<15&&py<15&&Number(d.g_FightPath[py*15+px])<=128)out.push({x,y});
    }
    return out;
})()`;
async function chooseGeneral(cdp,unit) {
    if(mobileCampaignInput)await mobileCampaignInput.tile(unit.x,unit.y);
    else {
        const selected=await action(cdp,'select-'+unit.name,`BayeHdBattle.clickUnitByName(${JSON.stringify(unit.name)})`);
        assert.equal(selected.ok,true);
    }
    return waitFor(cdp,'selected general movement or direct action',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return !s.transaction&&(f.inputKind===2||f.inputKind===3)&&f.actorIndex===${unit.i}&&f;})()`);
}
async function menuChoice(cdp,name,kind) {
    if(mobileCampaignInput) {
        const menu=await evaluate(cdp,'baye.hd.menuItems()'),index=menu.names.indexOf(name);
        assert.ok(menu.active&&menu.context===3&&index>=0,'The current battle menu owns '+name);
        await click(cdp,`#hd-battle-menu [data-hd-battle-menu="${index}"]`);
    } else {
        const result=await action(cdp,'choose-'+name,`BayeHdBattle.pickMenuName(${JSON.stringify(name)})`);
        assert.equal(result.ok,true,'actual menu choice '+name);
    }
    if(kind) await waitBattle(cdp,kind,'menu choice '+name);
}

async function battleTile(cdp,label,x,y) {
    if(mobileCampaignInput)return mobileCampaignInput.tile(x,y);
    const response=await action(cdp,label,`BayeHdBattle.clickTile(${x},${y})`);
    assert.equal(response.ok,true);
}

async function battleSystem(cdp,label) {
    if(mobileCampaignInput)return click(cdp,'#hd-battle [data-hd-battle-sys]');
    return action(cdp,label,'BayeHdBattle.openSystemMenu()');
}

async function cancelBattleMenu(cdp,label) {
    if(mobileCampaignInput)return click(cdp,'#hd-battle [data-hd-battle-cancel]');
    return action(cdp,label,'BayeHdBattle.cancel()');
}
const rangedUnitsExpression=`(() => {
    const d=baye.data,r=d.g_FgtAtkRng,size=Number(r[0]),sx=Number(r[1]),sy=Number(r[2]);
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);if(!id||id>=0xfffe)continue;
        const p=d.g_GenPos[i],x=Number(p.x),y=Number(p.y),dx=(x-sx)&255,dy=(y-sy)&255;
        if(p.state===8||dx>=size||dy>=size||Number(r[3+dx+dy*size])!==1)continue;
        units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x,y,arms:Number(d.g_Persons[id-1].Arms),terrain:baye.getTerrainByGeneralIndex(i),armType:baye.getArmType(id-1)});
    }
    return units;
})()`;

const worldExpression = `(() => {
    const d=baye.data,read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=> {
        const v=o[k];return [k,v&&typeof v==='object'&&Number.isFinite(Number(v.length))?Array.from({length:Number(v.length)},(_,i)=>Number(v[i])):v];
    }));
    const realm=baye.hd.realm();
    const array=(key,size)=> {
        const value=d[key];
        if(!value||Number(value.length)!==size)throw new Error('Actual native array '+key+' must expose '+size+' entries; got '+(value&&value.length));
        return Array.from({length:size},(_,i)=>Number(value[i]));
    };
    if(!d.g_OrderQueue||Number(d.g_OrderQueue.length)!==200)throw new Error('Native g_OrderQueue must expose all 200 records');
    if(Number(d.g_Cities.length)!==Number(d.g_engineConfig.citiesCount)||realm.cities.length!==Number(d.g_Cities.length))throw new Error('World snapshot must include every native CITY_MAX city');
    const cities=realm.cities.map(c=>({...c,...read(d.g_Cities[c.i])}));
    const persons=[],allPersons=[],count=baye.getPersonCount();
    for(let i=0;i<count;i++) {
        const p=d.g_Persons[i];
        const item={i,name:baye.getPersonName(i),...read(p)};
        if(!Array.isArray(item.Equip)||item.Equip.length!==2)throw new Error('Person '+i+' must expose both actual equipment slots');
        allPersons.push(item);
        if(Number(p.Belong)===realm.playerBelong)persons.push(item);
    }
    if(count<=0||count>Number(d.g_PersonsQueue.length)||count>Number(d.g_Persons.length))throw new Error('Native person count must be valid before world snapshot');
    const personQueue=Array.from({length:count},(_,i)=>Number(d.g_PersonsQueue[i]));
    const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>read(d.g_OrderQueue[i]));
    const goods=array('g_GoodsQueue',2000),fighters=array('FIGHTERS',600),fighterIndex=array('FIGHTERS_IDX',30);
    return {realm,cities,persons,allPersons,personCount:count,personQueue,orders,goods,fighters,fighterIndex,
        cityCursor:read(d.g_CityPos),period:Number(d.g_PIdx),settings:{lookEnemy:Number(d.g_LookEnemy),lookMovie:Number(d.g_LookMovie),moveSpeed:Number(d.g_MoveSpeed)},
        year:Number(d.g_YearDate),month:Number(d.g_MonthDate)};
})()`;

const successionWorldExpression=`(() => {
    const d=baye.data,w=${worldExpression};
    const people=w.allPersons.map(({i,name,...raw})=>raw);
    const cities=w.cities.map(({i,name,belong,owner,owned,ownership,...raw})=>raw);
    const tools=Array.from({length:baye.getToolCount()},(_,i)=>Object.fromEntries(
        ['useflag','changeAttackRange','at','iq','move','arm'].map(key=>[key,Number(d.g_Tools[i][key])])));
    return {period:w.period,king:w.realm.playerKing,year:w.year,month:w.month,people,cities,tools,
        queue:Array.from(d.g_PersonsQueue,Number),orders:w.orders,fighters:w.fighters,fighterIndex:w.fighterIndex,
        goodsQueue:w.goods,config:{fixOverFlow16:Number(d.g_engineConfig.fixOverFlow16)}};
})()`;

function realmChanges(before,after) {
    assert.deepEqual(after.cities.map(c=>c.i),before.cities.map(c=>c.i),'ownership comparison reads the same complete native city set');
    return before.cities.flatMap(city=> {
        const next=after.cities.find(c=>c.i===city.i);
        return Number(city.Belong)===Number(next.Belong)?[]:[{
            i:city.i,name:city.name,beforeBelong:Number(city.Belong),afterBelong:Number(next.Belong),
            beforeOwner:city.owner,afterOwner:next.owner,beforeOwned:city.owned,afterOwned:next.owned
        }];
    });
}

async function recruitArmy(cdp,fixture,label,reservedLeaders=[]) {
    const cityIndex=fixture.origin;
    await openCity(cdp,cityIndex,label);
    const before=await evaluate(cdp,worldExpression);
    const city=before.cities.find(c=>c.i===cityIndex);
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,'recruitment actual military submenu',`baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2&&baye.hd.menuItems().names[1]==='征兵'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="1"]');
    const recruitments=[];
    let recruiterMenuSeq=null;
    for(let attempt=0;attempt<fixture.recruitments;attempt++) {
        assert.ok(await evaluate(cdp,`Number(baye.data.g_Cities[${cityIndex}].Money)>0`),'real recruitment '+attempt+' still has native money');
        const live=await livePersonMenu(cdp,'recruitment '+attempt,recruiterMenuSeq);
        const recruiter=live.city.deepItems.findLast(person=>!reservedLeaders.includes(person.name));
        assert.ok(recruiter,'a real recruiter is available while the chosen garrison leaders remain in the city');
        const auxiliary=recruiter.name;
        const recruitmentQueue=await readCityPersons(cdp,cityIndex);
        const oldReserve=await evaluate(cdp,`Number(baye.data.g_Cities[${cityIndex}].MothballArms)`);
        const auxiliaryId=Number(recruiter.pind);
        assert.ok(Number.isInteger(auxiliaryId)&&auxiliaryId>=0,'recruitment exposes the actual zero-based PersonQueue identity');
        await checkpoint(cdp,label+'-recruit-person-'+attempt);
        if(findGenerals&&attempt===0)await findMilitaryGeneral(cdp,live,recruiter,'recruitment');
        if(findGenerals&&attempt===1)await assertFreshGeneralSearch(cdp,live.menu);
        await click(cdp,personSelector(live.menu,recruiter));
        recruiterMenuSeq=live.menu.seq;
        await waitFor(cdp,'real recruitment GetArmy',`baye.hd.qty().active&&baye.hd.qty().min===0&&baye.hd.qty().max>0`);
        const qty=await evaluate(cdp,'baye.hd.qty()');
        assert.equal(qty.value,qty.max,'GetArmy presents its legitimate maximum by default');
        await checkpoint(cdp,label+'-recruit-quantity-'+attempt);
        await confirmCampaignQuantity(cdp);
        await waitFor(cdp,'recruitment actual reserve and order',`(() => {const d=baye.data,c=d.g_Cities[${cityIndex}],queue=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));return Number(c.MothballArms)===${oldReserve+qty.value}&&!queue.includes(${auxiliaryId});})()`);
        const remaining=await readCityPersons(cdp,cityIndex);
        assert.deepEqual(remaining.map(p=>p.pind).sort((a,b)=>a-b),recruitmentQueue.filter(p=>p.pind!==auxiliaryId).map(p=>p.pind).sort((a,b)=>a-b),
            'native recruitment removes exactly its assigned allied general, preserving every in-wild resident');
        recruitments.push({auxiliary,auxiliaryId,qty:qty.value,beforeReserve:oldReserve,afterReserve:oldReserve+qty.value});
    }
    assert.equal(recruitments.length,fixture.recruitments,'all requested recruitment commands actually complete');
    assert.equal(new Set(recruitments.map(p=>p.auxiliaryId)).size,recruitments.length,'every native recruitment order uses a distinct available allied general');
    await settleDomestic(cdp);
    const recruited=await evaluate(cdp,worldExpression);
    assert.equal(recruited.cities.find(c=>c.i===cityIndex).MothballArms,Number(city.MothballArms)+recruitments.reduce((n,p)=>n+p.qty,0),'native recruitment allocates exactly the confirmed troops to reserves');
    await checkpoint(cdp,label+'-reserve-recruited');
    return {...fixture,requestedRecruitments:fixture.recruitments,cityIndex,recruitments,before,recruited};
}

async function allocateArmy(cdp,{cityIndex,leaders},label) {
    await openCity(cdp,cityIndex,label+'-distribute');
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,'distribution actual military submenu',`baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2&&baye.hd.menuItems().names[2]==='分配'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="2"]');
    const allocations=[];
    let distributionMenuSeq=null;
    for(const name of leaders) {
        const current=await livePersonMenu(cdp,'distribution '+name,distributionMenuSeq),live=current.city;
        const at=live.deepItems.findIndex(p=>(p.name||p.label||String(p)).includes(name));
        assert.ok(at>=0,'the intended returned general is available for distribution: '+name);
        const personIndex=Number(live.deepItems[at].pind);
        assert.ok(Number.isInteger(personIndex)&&personIndex>=0,'distribution exposes the real selected general identity');
        const general=await evaluate(cdp,`({i:${personIndex},arms:Number(baye.data.g_Persons[${personIndex}].Arms),
            reserve:Number(baye.data.g_Cities[${cityIndex}].MothballArms)})`);
        await click(cdp,personSelector(current.menu,live.deepItems[at]));
        distributionMenuSeq=current.menu.seq;
        await waitFor(cdp,'actual distribution GetArmy '+name,`baye.hd.qty().active&&baye.hd.qty().min===0&&baye.hd.qty().max>0`);
        const quantity=await evaluate(cdp,'baye.hd.qty()');
        assert.equal(quantity.value,quantity.max,'distribution presents its legitimate maximum');
        assert.ok(quantity.value>general.arms,'distribution gives '+name+' more troops than the initial army');
        await checkpoint(cdp,label+'-distribute-'+general.i);
        await confirmCampaignQuantity(cdp);
        await waitFor(cdp,'real troops distributed '+name,`!baye.hd.qty().active&&Number(baye.data.g_Persons[${general.i}].Arms)===${quantity.value}&&
            Number(baye.data.g_Cities[${cityIndex}].MothballArms)===${general.reserve+general.arms-quantity.value}`);
        allocations.push({name,pind:general.i,before:general.arms,after:quantity.value,nativeMax:quantity.max});
    }
    await settleDomestic(cdp);
    const prepared=await evaluate(cdp,worldExpression);
    assert.equal(allocations.length,leaders.length,'every chosen leader completes actual native troop allocation');
    for(const allocation of allocations) {
        assert.equal(prepared.persons.find(p=>p.i===allocation.pind)?.Arms,allocation.nativeMax,'prepared leader retains exactly the confirmed native allocation maximum: '+allocation.name);
    }
    await checkpoint(cdp,label+'-prepared-map');
    return {allocations,prepared};
}

async function prepareArmy(cdp,fixture) {
    const label='army-fixture';
    const recruitment=await recruitArmy(cdp,fixture,label);
    const {before,cityIndex,recruitments}=recruitment;
    const afterMonth=await advanceCampaignMonth(cdp,label+'-end-month');
    assert.ok(afterMonth.year!==before.year||afterMonth.month!==before.month,'one explicit strategy end advances the real game date');
    assert.ok(recruitments.every(p=>afterMonth.persons.some(v=>v.i===p.auxiliaryId)), 'the real recruit orders preserve their assigned generals');
    const returned=new Set((await readCityPersons(cdp,cityIndex)).map(person=>person.pind));
    assert.ok(recruitments.every(person=>returned.has(person.auxiliaryId)),'one explicit month completes the native recruitment orders and returns generals');
    await checkpoint(cdp,label+'-recruiter-returned');
    report.armyFixture={...recruitment,afterMonth,...await allocateArmy(cdp,recruitment,label)};
}

async function prepareUnarmedMarch(cdp,cityIndex) {
    const before=await evaluate(cdp,worldExpression),person=before.allPersons[before.realm.playerKing];
    assert.ok(person.Arms>0&&person.Equip.some(Boolean),'The original ruler is armed and carries equipment');
    const reserve=before.cities.find(city=>city.i===cityIndex).MothballArms;
    await openCity(cdp,cityIndex,'opening-status-distribution');
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,'original distribution command',`baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&
        baye.hd.menuItems().kind===2&&baye.hd.menuItems().names[2]==='分配'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="2"]');
    const picker=await livePersonMenu(cdp,'opening status distribution');
    const item=picker.city.deepItems.find(p=>p.pind===person.i);
    assert.ok(item,'The original distribution list offers the equipped ruler');
    await click(cdp,personSelector(picker.menu,item));
    const qty=await waitFor(cdp,'actual minimum distribution',`(() => {const q=baye.hd.qty();
        return q.active&&q.ready&&q.min===0&&q.value>0&&q;})()`);
    await click(cdp,mobileQuantityControl('data-hd-qty-bound'));
    await waitFor(cdp,'native minimum distribution ACK',`(() => {const q=baye.hd.qty();
        return q.active&&q.ready&&q.session===${qty.session}&&q.value===0&&q.lastKey===38;})()`);
    await checkpoint(cdp,'opening-status-zero-arms');
    await confirmCampaignQuantity(cdp);
    await waitFor(cdp,'native troops return to reserve',`baye.data.g_Persons[${person.i}].Arms===0&&
        baye.data.g_Cities[${cityIndex}].MothballArms===${reserve+person.Arms}`);
    await settleDomestic(cdp);
    await waitFor(cdp,'ordinary map after zero-troop allocation',mobileMapReady);
    await checkpoint(cdp,'opening-status-prepared-map');
    return {person,cityIndex,quantity:0,reserveBefore:reserve,reserveAfter:reserve+person.Arms,missingArt:missingOpeningStatusArt};
}

async function openCampaignDomesticList(cdp,cityIndex,name,kind) {
    await openCity(cdp,cityIndex,'battle-equipment-'+kind);
    await click(cdp,'#hd-city-menu [data-hd-root="0"]');
    const submenu=await waitFor(cdp,'actual domestic command '+name,`(() => {const m=baye.hd.menuItems();
        return m.active&&m.context===1&&m.kind===2&&m.names.includes(${JSON.stringify(name)})&&m;})()`);
    await click(cdp,`#hd-city-menu [data-hd-sub="${submenu.names.indexOf(name)}"]`);
    return waitFor(cdp,'current native domestic list '+name,`(() => {
        const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),owner=s.deepMenuOwner;
        if(!m.active||m.context!==1||m.kind!==${kind}||!m.idsValid||s.cityIndex!==${cityIndex}||owner?.seq!==m.seq)return false;
        const nodes=[...document.querySelectorAll('#hd-city-menu [data-hd-deep]')];
        if(nodes.length!==m.count)return false;
        return m.names.every((name,i)=>nodes.some(node=>Number(node.dataset.hdDeep)===i&&node.dataset.hdDeepName===name&&
            Number(node.dataset.hdMenuSeq)===m.seq))&&m;
    })()`);
}

async function inspectBattleEquipment(cdp,cityIndex,opponentName,terminal,after) {
    const observation=report.lastCityEquipment=await evaluate(cdp,'window.__battleEquipment');
    const {before,settled}=observation;
    assert.ok(before&&settled,'Original battle publishes both sides of the actual settlement');
    const opponent=before.cities[cityIndex].Belong;
    assert.equal(before.cities[cityIndex].owner,opponentName);
    assert.deepEqual(before.cities.filter(c=>c.Belong===opponent).map(c=>c.i),[cityIndex],
        'The original opponent has only the city being captured');
    assert.equal(settled.world.cities[cityIndex].Belong,before.realm.playerBelong);
    const defeated=terminal.units.filter(p=>p.side==='enemy').map(p=>before.allPersons[p.id-1]);
    assert.ok(defeated.some(p=>p.Equip.some(Boolean)),'Actual defending army includes an equipped original general');
    const loot=[];
    let previous=before;
    for(const death of observation.deaths) {
        const matches=defeated.filter(p=>death.native.text===p.name+' 战死');
        assert.equal(matches.length,1,'The original death report identifies an actual defeated general');
        const [person]=matches;
        death.itemIds=verifyEquipmentDeposit(previous,death.world,cityIndex,person.Equip);
        loot.push(...death.itemIds);
        previous=death.world;
    }
    verifyEquipmentDeposit(previous,settled.world,cityIndex,[]);
    if(!loot.length) {
        // The original captive command exercises the same discovered-inventory
        // insertion after an ordinary capture, with its own report and input.
        const city=after.cities[cityIndex],residents=after.personQueue.slice(city.PersonQueue,city.PersonQueue+city.Persons);
        const captives=residents.filter(id=>after.allPersons[id].Belong===65535);
        const person=defeated.find(p=>captives.includes(p.i)&&p.Equip.some(Boolean));
        assert.ok(person,'An equipped original defender is available as a real captive');
        assert.deepEqual(after.allPersons[person.i].Equip,person.Equip);
        const picker=await openCampaignDomesticList(cdp,cityIndex,'处斩',3),index=picker.ids.indexOf(person.i);
        assert.deepEqual(picker.ids,captives,'Native prisoner list matches the actual captured city residents');
        assert.ok(index>=0&&picker.names[index]===person.name);
        const offset=await evaluate(cdp,'__runtimeEngineInputs.length');
        await click(cdp,personSelector(picker,{i:index,name:person.name,pind:person.i}));
        const native=await waitFor(cdp,'original captive report and mobile confirmation',`(() => {
            const r=baye.hd.report(),d=BayeHdDialog.debugSnapshot(),t=BayeHdDialog.getInputTicket();
            return r.active===1&&r.kind===2&&r.person===${person.i}&&r.text&&d.open&&d.body===r.text&&
                d.reportOwner?.seq===r.seq&&t?.ownerType==='report'&&r;
        })()`);
        const during=await evaluate(cdp,worldExpression);
        const itemIds=verifyEquipmentDeposit(after,during,cityIndex,person.Equip);
        assert.deepEqual(during.personQueue,after.personQueue,'The original prisoner still belongs to the report until confirmation');
        const keys=await evaluate(cdp,`__runtimeEngineInputs.slice(${offset}).map(input=>input.code)`);
        verifyNativePersonSelection(picker,index,keys,await evaluate(cdp,'Number(baye.data.g_screenHeight)'));
        await checkpoint(cdp,'battle-equipment-captive-report',{native,person:person.name,itemIds});
        await acknowledgeCampaignReport(cdp,native);
        await settleDomestic(cdp);
        await waitFor(cdp,'ordinary map after native prisoner report',mobileMapReady);
        const final=await evaluate(cdp,worldExpression);
        verifyEquipmentDeposit(during,final,cityIndex,[]);
        assert.deepEqual((await readCityPersons(cdp,cityIndex)).map(p=>p.pind),residents.filter(id=>id!==person.i));
        observation.captiveCommand={person:person.name,native,itemIds};
        loot.push(...itemIds);
        after=final;
    }
    const inventory=await openCampaignDomesticList(cdp,cityIndex,'赏赐',4);
    assert.deepEqual(inventory.ids,discoveredCityEquipment(after,cityIndex),'The original reward list reflects the full discovered city inventory');
    assert.ok(loot.every(id=>inventory.ids.includes(id)),'The deposited equipment is visible in the real reward list');
    observation.inventory=inventory.ids.map((id,i)=>({id,name:inventory.names[i]}));
    for(const id of new Set(loot)) {
        const row=await mobileCampaignInput.reveal(`#hd-city-menu [data-hd-deep-tool="${id}"][data-hd-menu-seq="${inventory.seq}"]`);
        assert.ok(row?.visible&&row.hit,'The deposited item can be reached in the current mobile inventory');
    }
    await checkpoint(cdp,'battle-equipment-in-city',{inventory:observation.inventory});
    await settleDomestic(cdp);
    await waitFor(cdp,'ordinary map after viewing captured equipment',mobileMapReady);
    await checkpoint(cdp,'battle-equipment-final-map');
}

async function recordBattleResultNote(cdp,label,expected) {
    const sample=await waitFor(cdp,'current native result note for city '+expected.cityIndex,
        `(() => {const s=${battleResultNoteObservation};return s&&s.note.outcome===${expected.outcome}&&s.city.index===${expected.cityIndex}?s:null;})()`,15000);
    return captureBattleResultNote(cdp,label,sample,expected);
}

async function captureBattleResultNote(cdp,label,sample,expected) {
    verifyBattleResultNote(sample,expected);
    report.resultNotes??=[];report.resultNotes.push({label,...sample});
    await checkpoint(cdp,label+'-result-note',{resultNote:sample});
    return sample;
}

async function returnFromCompletedMarch(cdp,label) {
    const mapReceipt=await waitFor(cdp,'completed march on the current native map',`(() => {
        const m=baye.hd.march();return m.pick===1&&!m.battlePick&&m.mapInputSeq>0&&m.phase===7&&
            !baye.hd.menuItems().active&&BayeHdCityMenu.isMarchReady()&&m;})()`);
    const before=await evaluate(cdp,worldExpression);
    const keyCount=await evaluate(cdp,'__runtimeEngineInputs.length');
    await click(cdp,'#hd-city-menu [data-hd-march-map]');
    await waitFor(cdp,'ordinary map with the first army still queued',`(() => {const m=baye.hd.march(),s=BayeHdOverworld.debugSnapshot();
        return m.pick===1&&!m.battlePick&&m.mapInputSeq===${mapReceipt.mapInputSeq}&&s.phase==='map'&&s.hitsEnabled&&
            !BayeHdCityMenu.isOpen()&&!BayeHdCityMenu.isMarchReady();})()`);
    assert.deepEqual(await evaluate(cdp,'baye.hd.march()'),mapReceipt,'Closing the receipt keeps the current native map and order ticket');
    assert.equal(await evaluate(cdp,'__runtimeEngineInputs.length'),keyCount,'Returning from a completed march sends no native input');
    assert.deepEqual(await evaluate(cdp,worldExpression),before,'Returning from a completed march preserves the whole native world');
    await checkpoint(cdp,label);
    return {before,mapReceipt};
}

async function queueFollowingArmy(cdp,march) {
    const {before,mapReceipt}=await returnFromCompletedMarch(cdp,'first-army-kept-on-map');
    const reserve=(await readCityPersons(cdp,march.origin)).find(p=>p.arms>0&&p.belong===before.realm.playerBelong&&p.pind!==before.realm.playerKing);
    assert.ok(reserve,'A distinct armed general remains in the city for the second march');
    const following=await dispatchMarch(cdp,march.origin,march.target,'following-army',{
        generalNames:[reserve.name],queuedMarch:march,leaveQueued:true});
    const pending=await evaluate(cdp,worldExpression);
    assert.equal(pending.year,before.year);assert.equal(pending.month,before.month);
    assert.equal(pending.cities.find(c=>c.i===march.target).Belong,before.cities.find(c=>c.i===march.target).Belong,
        'The destination ownership stays the same while both orders are queued');
    assert.ok([march,following].every(entry=>pending.orders.some(o=>o.OrderId===27&&o.Person===entry.order.slot&&
        o.City===march.origin&&o.Object===march.target)&&pending.fighterIndex[entry.order.slot]===1));
    report.arrival={before,mapReceipt,following,pending};
    return report.arrival;
}

async function inspectMarchPlans(cdp,cityIndex,world,label,expectedCount) {
    const expected=world.orders.flatMap((order,slot)=>{
        if(order.OrderId!==27||order.City!==cityIndex)return [];
        assert.equal(world.fighterIndex[order.Person],1,'An active march has its own native fighter slot');
        const members=[];
        for(let i=0;i<10;i++) {
            const offset=order.Person*20+i*2,token=world.fighters[offset]+256*world.fighters[offset+1];
            if(!token)continue;
            const person=world.allPersons[token-1];
            assert.equal(person.Belong,world.realm.playerBelong);
            assert.ok(Number.isInteger(person.Arms)&&person.Arms>=0&&person.Arms<=65535);
            members.push({id:person.i,text:`${person.name} ${person.Arms} 兵`,arms:person.Arms});
        }
        assert.ok(members.length&&new Set(members.map(member=>member.id)).size===members.length);
        const total=members.reduce((sum,member)=>sum+member.arms,0);
        return [{slot,summary:`${world.cities[order.Object].name} · 携粮 ${order.Food} · 合计 ${total} 兵`,
            members:members.map(({id,text})=>({id,text}))}];
    });
    assert.equal(expected.length,expectedCount);
    await openCity(cdp,cityIndex,label);
    const before=await evaluate(cdp,worldExpression),keys=await evaluate(cdp,'__runtimeEngineInputs.length');
    const touches=await evaluate(cdp,'window.__campaignLcdTouches?.length||0');
    await click(cdp,'#hd-city-menu [data-hd-root="3"]');
    const visible=await waitFor(cdp,'current city plans for '+label,`(() => {
        const s=BayeHdCityMenu.debugSnapshot(),box=document.getElementById('hd-city-menu-status');
        const plans=box.querySelector('[data-hd-city-plans="1"]');
        if(s.layer!=='status'||s.cityIndex!==${cityIndex}||box.hidden||!plans||!plans.checkVisibility())return null;
        const orders=[...plans.querySelectorAll('[data-hd-city-order-id="27"]')];
        return {rows:orders.map(row=>({slot:Number(row.dataset.hdCityOrder),summary:row.children[1].textContent,
            members:[...row.querySelectorAll('[data-hd-city-march-member]')].map(item=>({id:Number(item.dataset.hdCityMarchMember),text:item.textContent}))})),
            fits:orders.every(row=>row.scrollWidth<=row.clientWidth+1)&&box.scrollWidth<=box.clientWidth+1};
    })()`);
    assert.deepEqual(visible.rows,expected,'The displayed members and army totals match the actual queued order and person records');
    assert.equal(visible.fits,true,'The march rows fit the city status pane');
    if(expected.length) {
        const last=expected.at(-1),member=last.members.at(-1);
        const selector=`#hd-city-menu-status [data-hd-city-order="${last.slot}"] [data-hd-city-march-member="${member.id}"]`;
        if(mobileCampaignInput) {
            const item=await mobileCampaignInput.reveal(selector);
            assert.ok(item.visible&&item.hit,'Touch scrolling reaches the last queued army member');
        } else {
            await evaluate(cdp,`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
            await waitFor(cdp,'visible last queued army member',`(() => {const item=document.querySelector(${JSON.stringify(selector)}),r=item.getBoundingClientRect();
                return r.width>0&&r.height>0&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===item;})()`);
        }
    }
    await checkpoint(cdp,label+'-plans',{plans:visible.rows});
    await click(cdp,'#hd-city-menu [data-hd-menu-back]');
    await waitFor(cdp,'return to the current original city root',`BayeHdCityMenu.getLayer()==='root'&&baye.hd.menuItems().context===1`);
    assert.deepEqual(await evaluate(cdp,worldExpression),before,'Reading city plans preserves the original world');
    assert.equal(await evaluate(cdp,'__runtimeEngineInputs.length'),keys);
    assert.equal(await evaluate(cdp,'window.__campaignLcdTouches?.length||0'),touches);
    await click(cdp,'#hd-city-menu [data-hd-menu-back]');
    await waitFor(cdp,'return to the original map after inspecting the orders',`(() => {const m=baye.hd.march();
        return m.pick===1&&!m.battlePick&&!baye.hd.menuItems().active&&!BayeHdCityMenu.isOpen()&&BayeHdOverworld.debugSnapshot().phase==='map';})()`);
    assert.deepEqual(await evaluate(cdp,`__runtimeEngineInputs.slice(${keys}).map(input=>input.code)`),[40]);
    return visible.rows;
}

function observeSkippedOrders(cityIndex,orderIndices,slots) {
    return `(() => {
        const trace=window.__skippedOrderTrace={notes:[],fights:[]};
        const battle=BayeHdBattle,onFight=battle.onEngineFight;
        battle.onEngineFight=function(){
            const result=onFight.apply(this,arguments),f=baye.hd.fight();
            if(f.active&&f.cityIndex===${cityIndex})trace.fights.push(f);
            return result;
        };
        const controller=BayeHdBattleNote,onNote=controller.onEngineNote;
        window.BayeHdBattleNote=Object.freeze({...controller,onEngineNote(){
            const result=onNote.apply(controller,arguments),native=baye.hd.battleNote(),d=baye.data;
            if(!native?.active||![1,3].includes(native.outcome)||d.g_FgtParam.CityIndex!==${cityIndex}||
                trace.notes.some(sample=>sample.native.seq===native.seq))return result;
            const city=d.g_Cities[${cityIndex}],start=Number(city.PersonQueue);
            trace.notes.push({native,viewport:[innerWidth,innerHeight],presented:controller.debugSnapshot().active,
                cityOwner:Number(city.Belong),skip:Number(d.g_hdFightSkip),fightInputSeq:Number(d.g_hdFightInputSeq),
                residents:Array.from({length:Number(city.Persons)},(_,i)=>Number(d.g_PersonsQueue[start+i])),
                orderIds:${JSON.stringify(orderIndices)}.map(i=>Number(d.g_OrderQueue[i].OrderId)),
                fighterSlots:${JSON.stringify(slots)}.map(i=>Number(d.FIGHTERS_IDX[i]))});
            return result;
        }});
        return true;
    })()`;
}

async function setMobileCampaignOrientation(cdp,portrait=false) {
    const landscape=report.mobileViewport;
    const viewport=portrait?{width:landscape.height,height:landscape.width}:landscape;
    await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true,
        screenOrientation:portrait?{type:'portraitPrimary',angle:0}:{type:'landscapePrimary',angle:90}});
    await waitFor(cdp,'mobile campaign viewport',`innerWidth===${viewport.width}&&innerHeight===${viewport.height}`);
}

async function restoreSkippedNote(cdp,label,cityIndex,kind) {
    const skip=kind==='occupation'?1:2,keysBefore=await evaluate(cdp,'__runtimeEngineInputs.length');
    await setMobileCampaignOrientation(cdp,true);
    const native=await waitFor(cdp,'native '+kind+' result while held in portrait',`(() => {
        const r=baye.hd.battleNote();return r.active===1&&r.outcome===1&&baye.data.g_hdFightSkip===${skip}&&
            baye.data.g_FgtParam.CityIndex===${cityIndex}&&!BayeHdBattleNote.debugSnapshot().active&&r;
    })()`,30000);
    const [announcement,result]=await evaluate(cdp,`__skippedOrderTrace.notes.slice(0,
        __skippedOrderTrace.notes.findIndex(sample=>sample.native.seq===${native.seq})+1).slice(-2)`);
    assert.ok(announcement&&result,'Observe the genuine native announcement and result callbacks');
    assert.deepEqual([announcement.native.outcome,result.native.outcome],[3,1]);
    for(const sample of [announcement,result]) {
        assert.ok(sample.viewport[0]<sample.viewport[1],'Both original note publications occur in portrait');
        assert.equal(sample.presented,false,'HD does not cover the original portrait display');
    }
    await setMobileCampaignOrientation(cdp);
    const restored=await waitFor(cdp,'same live result after returning to landscape',`(() => {
        const note=BayeHdBattleNote.debugSnapshot();return note.active&&note.seq===${native.seq}&&note;
    })()`);
    const keysAfter=await evaluate(cdp,'__runtimeEngineInputs.length');
    report.skippedNoteRotation={kind,announcement,result,restored,keysBefore,keysAfter};
    assert.equal(keysAfter,keysBefore,'Rotating the mobile viewport sends no original key');
    const sample=await evaluate(cdp,battleResultNoteObservation);
    assert.ok(sample,'The current original result restores its city caption after rotation');
    return captureBattleResultNote(cdp,label,sample,{outcome:1,kind,cityIndex});
}

async function mobileEmptyCampaign(cdp,before) {
    const {origin,target,leader}=emptyMobileFixture;
    const originalCity=before.cities[target],neutral=before.personQueue.slice(originalCity.PersonQueue,originalCity.PersonQueue+originalCity.Persons);
    assert.equal(originalCity.Belong,0,'The original destination starts unowned');
    assert.ok(await evaluate(cdp,`baye.hd.cityLinks(${origin}).some(link=>Number(link.index)===${target})`));
    const first=await dispatchMarch(cdp,origin,target,'empty',{generalNames:[leader],foodBudget:before.cities[origin].Food-20,leaveQueued:true});
    const arrival=await queueFollowingArmy(cdp,first),armies=[first,arrival.following],slots=armies.map(army=>army.order.slot);
    const orderIndices=slots.map(slot=>arrival.pending.orders.findIndex(o=>o.OrderId===27&&o.Person===slot&&o.City===origin&&o.Object===target));
    assert.ok(orderIndices[0]>=0&&orderIndices[1]>orderIndices[0],'Both native orders are queued in their actual execution sequence');
    assert.ok(await evaluate(cdp,observeSkippedOrders(target,orderIndices,slots)));
    const mapSeqBefore=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await click(cdp,'#hd-city-menu [data-hd-strategy-end]');
    if(rotateSkippedNote==='occupation')await restoreSkippedNote(cdp,'empty',target,'occupation');
    else await recordBattleResultNote(cdp,'empty',{outcome:1,kind:'occupation',cityIndex:target});
    if(rotateSkippedNote==='arrival')arrival.note=await restoreSkippedNote(cdp,'following-army',target,'arrival');
    await settleToMap(cdp,'empty',{arrival,mapSeqBefore});
    assert.ok(arrival.note,'The second original order shows its own arrival result');
    const trace=await evaluate(cdp,'window.__skippedOrderTrace');
    assert.deepEqual(trace.fights,[],'Neither original order starts a battle at the destination');
    assert.deepEqual(trace.notes.map(s=>s.native.outcome),[3,1,3,1]);
    let expectedResidents=neutral;
    for(const [i,army] of armies.entries()) {
        const [announcement,result]=trace.notes.slice(2*i,2*i+2);
        expectedResidents=[...army.selected.map(p=>p.pind).reverse(),...expectedResidents];
        assert.equal(result.skip,i+1);assert.equal(result.cityOwner,before.realm.playerBelong);
        assert.equal(result.fightInputSeq,announcement.fightInputSeq);
        assert.deepEqual(result.residents,expectedResidents,'Each order adds only its own officers to the original garrison');
        assert.deepEqual(result.orderIds,i===0?[27,27]:[255,27]);
        assert.deepEqual(result.fighterSlots,i===0?[0,1]:[0,0]);
    }
    const after=await evaluate(cdp,worldExpression);
    assert.deepEqual([after.year,after.month],[before.year,before.month+1]);
    assert.equal(after.cities[target].Belong,after.realm.playerBelong);
    assert.ok(orderIndices.every(i=>after.orders[i].OrderId===255)&&slots.every(i=>after.fighterIndex[i]===0));
    const city=await inspectMobileOwnedCity(cdp,target,after,'mobile-empty-occupied');
    assert.ok(armies.every(army=>army.selected.every(person=>city.residents.includes(person.pind))));
    report.emptyCapture={plan:{origin,target},before,after,trace,orderIndices,slots,city,realmChanges:realmChanges(before,after)};
    await checkpoint(cdp,'empty-occupied-map');
}

async function campaignSmoke(cdp) {
    if(!mobileCampaignInput)await evaluate(cdp, `(() => { BayeHdOverworld.setMode('hd-map'); BayeHdCityMenu.setMode('hd'); BayeHdBattle.setMode('hd'); })()`);
    const before=await evaluate(cdp,worldExpression);
    report.campaignBefore=before;
    await checkpoint(cdp,'06-hd-map');
    if(scenario==='probe') {
        const metadata=await evaluate(cdp,`(() => {
            const d=baye.data,realm=baye.hd.realm();
            return realm.cities.map(city=> {
                const native=d.g_Cities[city.i],belong=Number(native.Belong);
                const generals=Array.from({length:Number(native.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(native.PersonQueue)+i]))
                    .map(pind=>({pind,name:baye.getPersonName(pind),belong:Number(d.g_Persons[pind].Belong),
                        arms:Number(d.g_Persons[pind].Arms),force:Number(d.g_Persons[pind].Force),iq:Number(d.g_Persons[pind].IQ),
                        level:Number(d.g_Persons[pind].Level),age:Number(d.g_Persons[pind].Age),armsType:Number(d.g_Persons[pind].ArmsType)}));
                const links=baye.hd.cityLinks(city.i);
                const troops=generals.filter(p=>p.belong===belong).reduce((sum,p)=>sum+p.arms,0);
                return {...city,belong,money:Number(native.Money),food:Number(native.Food),reserve:Number(native.MothballArms),
                    devotion:Number(native.PeopleDevotion),generals,troops,links};
            });
        })()`);
        assert.equal(metadata.length,before.cities.length,'probe reads every actual native city and its real link table');
        report.probe={realm:before.realm,year:before.year,month:before.month,cities:metadata};
        fs.writeFileSync(path.join(artifactDir,'probe.json'),JSON.stringify(report.probe,null,2)+'\n');
        await checkpoint(cdp,'probe-readonly-map');
        return;
    }
    if(scenario==='empty') {
        if(mobileCampaignInput)return mobileEmptyCampaign(cdp,before);
        const empty=await chooseMarchPair(cdp,true);
        assert.ok(empty,'an owned city has a genuinely unowned neighboring target');
        await dispatchMarch(cdp,empty.origin,empty.target,'empty',{generalNames:empty.generals.map(p=>p.name)});
        await recordBattleResultNote(cdp,'empty',{outcome:1,kind:'occupation',cityIndex:empty.target});
        await settleToMap(cdp,'empty');
        const after=await evaluate(cdp,worldExpression);
        assert.equal(after.cities.find(c=>c.i===empty.target).Belong,after.realm.playerBelong,'empty target is owned after the actual order');
        report.emptyCapture={plan:empty,before,after,realmChanges:realmChanges(before,after)};
        await checkpoint(cdp,'empty-occupied-map');
        return;
    }
    if(defenseScenario)return defendCampaign(cdp);
    if(scenario==='domestic')await domesticBeforeMarch(cdp,8);
    if(winningScenarios.has(scenario))await prepareArmy(cdp,winningFixture);
    const openingStatus=battleOpeningStatus?report.openingStatus=await prepareUnarmedMarch(cdp,winningFixture.origin):null;
    if(openingStatus)assert.ok(await evaluate(cdp,recordBattleOpeningStatus(openingStatus.person.i)));
    if(lastCityEquipment)assert.ok(await evaluate(cdp,observeBattleEquipmentSettlement(winningFixture.target,worldExpression)));
    const rounds=['campaign','retreat'].includes(scenario)?3:1;
    for(let round=1;round<=rounds;round++) {
        const winRequested=!['retreat','domestic'].includes(scenario)&&!(scenario==='campaign'&&round>1);
        const plan=round===1&&winningScenarios.has(scenario)?{origin:winningFixture.origin,target:winningFixture.target}:
            scenario==='domestic'?{origin:8,target:9}:await chooseMarchPair(cdp,false);
        assert.ok(plan,'a further legal attack target is adjacent to an owned staffed city');
        const worldBefore=await evaluate(cdp,worldExpression);
        if(!plan.generals)plan.generals=await evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${plan.origin}],belong=baye.hd.realm().playerBelong;
            return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
                .filter(p=>Number(d.g_Persons[p].Belong)===belong&&Number(d.g_Persons[p].Arms)>0)
                .map(p=>({pind:p,name:baye.getPersonName(p),arms:Number(d.g_Persons[p].Arms),iq:Number(d.g_Persons[p].IQ),force:Number(d.g_Persons[p].Force)}))
                .sort((a,b)=>b.arms-a.arms||b.force-a.force);})()`);
        assert.ok(plan.generals.length,'the actual origin has armed player generals');
        let generalNames=winningFixture.leaders.slice();
        if(winRequested) {
            assert.ok(generalNames.every(name=>plan.generals.some(p=>p.name===name)),'all prepared leaders are genuine armed allied generals in the origin');
            if(openingStatus)generalNames.push(openingStatus.person.name);
        }
        if(!winRequested) {
            // A separate real general for each retreat keeps enough actual
            // participants for the three-order campaign lifecycle. Captures,
            // escapes and succession still belong entirely to native C.
            const participants=plan.generals.filter(p=>p.pind!==worldBefore.realm.playerKing);
            generalNames=[(participants.length?participants:plan.generals).sort((a,b)=>b.iq-a.iq)[0].name];
        }
        const foodBudget=arrivalScenario?worldBefore.cities.find(c=>c.i===plan.origin).Food-20:winRequested?undefined:10;
        if(arrivalScenario)assert.ok(foodBudget>0,'The first army leaves twenty actual grain for the second');
        const march=await dispatchMarch(cdp,plan.origin,plan.target,'march-'+round,{generalNames,foodBudget,leaveQueued:arrivalScenario,
            unarmedPerson:openingStatus?.person.i});
        const arrival=arrivalScenario?await queueFollowingArmy(cdp,march):null;
        if(arrival) {
            await returnFromCompletedMarch(cdp,'both-armies-kept-on-map');
            arrival.queuedPlans=await inspectMarchPlans(cdp,plan.origin,arrival.pending,'queued-march',2);
            await openFunctionMenu(cdp,'settle-queued-armies');
            await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
        }
        await waitForGameProgress(cdp,'real player battle',`baye.hd.fight().active && !baye.hd.fight().over && baye.hd.fight().inputKind===1`,60000);
        await checkpoint(cdp,'battle-'+round+'-ready');
        const initial=await evaluate(cdp,battleStateExpression);
        assertDispatchedArmy(initial,march);
        assert.equal(initial.fight.over,0,'the new native battle clears the previous terminal result');
        assert.ok(initial.units.filter(p=>p.side==='player'&&p.id-1!==openingStatus?.person.i).every(p=>p.arms>0),
            'Each prepared active player general has genuine troops');
        if(openingStatus) {
            const {image,...observation}=await evaluate(cdp,'window.__battleOpeningStatus');
            openingStatus.observation=observation;
            if(image)fs.writeFileSync(path.join(artifactDir,'opening-status-final-frame.png'),Buffer.from(image.split(',')[1],'base64'));
            if(missingOpeningStatusArt)assert.ok(report.missingOpeningStatusRequests?.length,'The private browser requests the missing status picture');
            openingStatus.verdict=verifyBattleOpeningStatus(observation,openingStatus.person,report.mobileReportAcks||[],missingOpeningStatusArt);
            assert.equal(initial.units.find(p=>p.id-1===openingStatus.person.i).state,8);
            await waitBattle(cdp,1,'ordinary HD battle after the opening status report');
            assert.equal(await evaluate(cdp,'BayeHdSpe.getLcdPresentation()'),'off');
        }
        if(winRequested)await conquerBattle(cdp,round);
        else await retreatBattle(cdp,round);
        const terminal=await evaluate(cdp,battleStateExpression);
        const expected=winRequested?1:2;
        assert.equal(terminal.fight.over,expected,'native battle terminal result matches requested campaign scenario');
        const note=await recordBattleResultNote(cdp,'battle-'+round,{outcome:expected,kind:'attack',cityIndex:plan.target});
        assert.equal(note.city.owner,worldBefore.cities.find(c=>c.i===plan.target).Belong,'Result note precedes any occupation of the enemy city');
        await checkpoint(cdp,'battle-'+round+'-terminal');
        await settleToMap(cdp,'battle-'+round,{arrival});
        const after=await evaluate(cdp,worldExpression);
        const ownershipChanges=realmChanges(worldBefore,after);
        if(expected===1) {
            assert.equal(after.cities.find(c=>c.i===plan.target).Belong,after.realm.playerBelong,'actual occupation assigns target to player');
            assert.notEqual(worldBefore.cities.find(c=>c.i===plan.target).Belong,worldBefore.realm.playerBelong,'the occupied target was an actual enemy city before departure');
        } else {
            assert.equal(after.cities.find(c=>c.i===plan.target).Belong,worldBefore.cities.find(c=>c.i===plan.target).Belong,'retreat preserves defender ownership');
        }
        if(arrival) {
            assert.ok(arrival.note&&arrival.note.note.seq!==note.note.seq,'The following army has its own native arrival note');
            const garrison=await readCityPersons(cdp,plan.target);
            assert.ok(arrival.following.selected.every(p=>garrison.some(actual=>actual.pind===p.pind&&actual.belong===after.realm.playerBelong)),
                'The second army joins the actual garrison of the captured city');
            for(const entry of [march,arrival.following]) {
                assert.equal(after.fighterIndex[entry.order.slot],0,'The settled army releases its native fighter slot');
                assert.ok(!after.orders.some(o=>o.OrderId===27&&o.Person===entry.order.slot&&o.City===plan.origin&&o.Object===plan.target));
            }
            arrival.garrison=garrison;
            arrival.settledPlans=await inspectMarchPlans(cdp,plan.origin,after,'settled-march',0);
        }
        if(scenario==='domestic') {
            assert.equal(worldBefore.year,report.domestic.before.year,'cultivation and march are submitted in the same strategy year');
            assert.equal(worldBefore.month,report.domestic.before.month,'cultivation and march are submitted in the same strategy month');
            assert.ok(!march.selected.some(p=>p.pind===report.domestic.order.Person),'the cultivating general is not reused by the march order');
            assert.ok(after.cities.find(c=>c.i===8).Farming>=report.domestic.after.cities.find(c=>c.i===8).Farming,'the actual agricultural result remains after the march settles');
            const returned=await readCityPersons(cdp,8);
            assert.ok(returned.some(p=>p.pind===report.domestic.order.Person),'the actual cultivation order returns its general separately');
            report.domestic.march=march;
            report.domestic.settled=after;
        }
        report.battles??=[];report.battles.push({round,plan,march,expectedOutcome:winRequested?'victory':'retreat',worldBefore,initial,terminal,after,realmChanges:ownershipChanges});
        await checkpoint(cdp,'battle-'+round+'-settled-map');
        if(mobileCampaignInput) {
            report.mobileCapturedCity=await inspectMobileOwnedCity(cdp,plan.target,after,'mobile-captured');
            if(openingStatus) {
                const {person}=openingStatus,returned=after.allPersons[person.i];
                assert.equal(after.realm.playerKing,person.i);
                assert.deepEqual(returned.Equip,person.Equip,'The original post-battle settlement preserves the departed ruler’s equipment');
                assert.ok(report.mobileCapturedCity.residents.includes(person.i),'The ruler who departed the battle returns to the captured city');
                openingStatus.settled={person:returned.i,city:plan.target,equipment:returned.Equip};
            }
            await checkpoint(cdp,'mobile-after-capture-map');
        }
        if(lastCityEquipment)await inspectBattleEquipment(cdp,plan.target,winningFixture.opponent,terminal,after);
        if(captiveScenario){await inspectActualCaptives(cdp,plan);return;}
    }
    if(scenario==='campaign')assert.deepEqual(report.battles.map(b=>b.terminal.fight.over),[1,2,2],'mixed campaign verifies one occupation and two explicit retreats across three fresh battles');
    if(scenario==='save')await saveRefreshLoad(cdp);
    if(scenario==='restart')await restartSamePage(cdp);
}

async function inspectMobileOwnedCity(cdp,cityIndex,after,label) {
    const city=after.cities.find(item=>item.i===cityIndex);
    const stationed=(await readCityPersons(cdp,cityIndex)).filter(person=>person.belong===after.realm.playerBelong);
    assert.equal(city.Belong,after.realm.playerBelong,'The inspected city belongs to the current player realm');
    assert.ok(stationed.length,'The inspected city has real allied residents');
    await openCity(cdp,cityIndex,label);
    const keys=await evaluate(cdp,'__runtimeEngineInputs.length');
    await click(cdp,'#hd-city-menu [data-hd-root="3"]');
    const status=await waitFor(cdp,'owned city status and garrison',`(() => {
        const box=document.getElementById('hd-city-menu-status'),s=BayeHdCityMenu.debugSnapshot();
        if(box.hidden||s.layer!=='status'||s.cityIndex!==${cityIndex}||!BayeHdMobileCity.isActive())return null;
        const garrison=box.querySelector('[data-hd-city-garrison]');if(!garrison)return null;
        const owner=[...box.querySelectorAll('.hd-city-menu-stat')].find(row=>row.firstElementChild.textContent==='归属');
        return {title:document.getElementById('hd-city-menu-title').textContent,owner:owner?.lastElementChild.textContent,
            residents:[...garrison.querySelectorAll('[data-hd-city-general]')].map(row=>Number(row.dataset.hdCityGeneral))};
    })()`);
    assert.equal(status.title,city.name);assert.equal(status.owner,city.owner);
    assert.deepEqual(status.residents,stationed.map(person=>person.pind),'The HD garrison matches the actual resident queue');
    await checkpoint(cdp,label+'-city-status',{status});
    status.garrisonRow=await mobileCampaignInput.reveal(`#hd-city-menu-status [data-hd-city-general="${stationed[0].pind}"]`);
    assert.ok(status.garrisonRow?.visible&&status.garrisonRow.hit,'A touch scroll reaches the owned city garrison');
    await checkpoint(cdp,label+'-city-garrison',{status});
    await click(cdp,'#hd-city-menu [data-hd-menu-back]');
    await waitFor(cdp,'back to owned city root',`BayeHdCityMenu.getLayer()==='root'&&BayeHdMobileCity.isActive()`);
    assert.equal(await evaluate(cdp,'__runtimeEngineInputs.length'),keys,'Opening and closing city status sends no game input');
    await click(cdp,'#hd-city-menu [data-hd-menu-back]');
    await waitFor(cdp,'ordinary mobile map after owned city visit',mobileMapReady);
    assert.deepEqual(await evaluate(cdp,`__runtimeEngineInputs.slice(${keys}).map(input=>input.code)`),[40]);
    return status;
}

async function captureCaptivePhase(cdp,label){
    assert.ok(typeof label==='string'&&/^[a-zA-Z0-9_-]{1,150}$/.test(label),'Safe unique captive checkpoint label');
    const png=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'),file='captives-'+String(report.phases.length).padStart(3,'0')+'-'+label+'.png';
    fs.writeFileSync(path.join(artifactDir,file),png,{flag:'wx'});
    const entry={label,file,bytes:png.length,sha256:sha(png),sample:await evaluate(cdp,'__identitySample()')};report.phases.push(entry);
    await captiveSampleOwned('checkpoint-'+label);return entry;
}

const captiveSaveFiles = `Array.from({length:2},(_,i)=>BayeSaveStorage.readFile('baye//data//sango'+i+'.sav'))`;

function captiveFileIdentity(files) {
    assert.ok(Array.isArray(files)&&files.length===2&&files.every(file=>typeof file==='string'&&file.length>0&&file.length%2===0&&/^[a-f0-9]+$/i.test(file)));
    return files.map(file=>({bytes:file.length/2,sha256:sha(Buffer.from(file,'hex'))}));
}

async function saveCaptiveWorld(cdp,before) {
    assert.equal(await evaluate(cdp,'BayeSaveStorage.inspectSlot(0).status'),'empty');
    await openFunctionMenu(cdp,'captive-save');
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    await waitFor(cdp,'native save owner for captured city',`(() => {
        const r=baye.hd.record(),s=BayeHdSystemUi.debugSnapshot();
        return r.active===1&&r.mode===1&&r.count===3&&s.open&&s.screen==='saveload'&&!s.pending;
    })()`);
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    await waitFor(cdp,'original captured city save written','!baye.hd.record().active&&baye.hd.march().pick===1&&BayeSaveStorage.inspectSlot(0).canLoad');
    const saved=await evaluate(cdp,'__identitySample()'),files=await evaluate(cdp,captiveSaveFiles);
    assert.deepEqual(saved.world,before.world,'Public save leaves the actual captured world intact');
    report.captiveSave={slot:0,files:captiveFileIdentity(files),saved};
    await captureCaptivePhase(cdp,'native-capture-saved');
    await archiveEngineInputDocument(cdp,'before-mobile-load');
}

async function loadCaptiveWorld(cdp,origin) {
    const save=report.captiveSave;
    const mobile=!!captiveMobileWidth, surface=mobile?'mobile':'desktop';
    const viewport=mobile?{width:captiveMobileWidth,height:captiveMobileWidth===667?375:390}:
        {width:captiveWidth,height:captiveWidth===1280?720:1080};
    report[mobile?'mobileViewport':'viewport']=viewport;
    await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile});
    if(mobile)await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    const page=mobile?'/m.html':'/pc.html';
    await cdp.send('Page.navigate',{url:origin+page+(mobile?'#'+Math.floor(Date.now()/1000):'')});
    captiveMobileDocument=mobile;
    acknowledgedProgressReports.clear();
    await waitFor(cdp,'fresh '+surface+' WASM and native ready',`location.pathname===${JSON.stringify(page)}&&window.baye?.hd?.ready()`,60000);
    await installEngineInputRecorder(cdp);
    report[surface+'InputObserver']=await installCaptiveObserver(cdp,surface+'-startup');
    const titleNative='baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1';
    for(let i=0;i<60&&!await evaluate(cdp,titleNative);i++) {
        if(await evaluate(cdp,'baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)')) {
            if(mobile)await action(cdp,'mobile-original-intro-ack','sendKey(39)');
            else await key(cdp,'Enter');
        }
        await delay(160);
    }
    await waitFor(cdp,'actual '+surface+' HD title',`(${titleNative})&&${mobile?'BayeHdMobileSystem.snapshot().active&&':''}BayeHdSystemUi.debugSnapshot().screen==='title'`,60000);
    const files=await evaluate(cdp,captiveSaveFiles);
    assert.deepEqual(captiveFileIdentity(files),save.files,'The browser loads the two exact files written by the original game');
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    await waitFor(cdp,surface+' HD load owner and saved row',`(() => {
        const r=baye.hd.record(),s=BayeHdSystemUi.debugSnapshot();
        return r.active===1&&r.mode===2&&r.count===4&&s.open&&s.screen==='saveload'&&!s.pending&&s.saves[0]?.canLoad;
    })()`);
    await checkpoint(cdp,'captive-'+surface+'-load-slots');
    const loadOffset=await evaluate(cdp,'__identityKeys.length');
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    await waitFor(cdp,'loaded capture on the native '+surface+' HD map',`(() => {
        const m=baye.hd.march(),map=BayeHdOverworld.debugSnapshot();
        return !baye.hd.record().active&&m.pick===1&&!m.battlePick&&map.mobile===${mobile}&&map.phase==='map'&&map.hitsEnabled&&
            ${mobile?"document.body.classList.contains('hd-mobile-map-on')":'map.presentationReady'};
    })()`,60000);
    const loaded=save.loaded=await evaluate(cdp,'__identitySample()');
    const persisted=world=>({...world,queue:world.queue.slice(0,world.people.length)});
    assert.deepEqual(persisted(loaded.world),persisted(save.saved.world),'Native load restores the saved campaign and logical resident queue');
    assert.deepEqual(await evaluate(cdp,'__identityKeys.slice('+loadOffset+')'),[39]);
    assert.deepEqual(await evaluate(cdp,captiveSaveFiles),files);
    assert.equal(loaded.native.march.phase,0,'The native load starts a fresh map wait');
    await captureCaptivePhase(cdp,'native-capture-loaded-on-'+surface);
    return loaded;
}

async function inspectActualCaptives(cdp,plan){
    assert.equal(plan.origin,15);assert.equal(plan.target,16);
    await observeCaptiveLib(cdp,'settled-before-captive-inspection');
    const sample=await evaluate(cdp,'__identitySample()'),city=sample.world.cities[plan.target];
    report.originalNativeCapacity=await evaluate(cdp,'({logicalPeople:Number(baye.getPersonCount()),physicalPeople:Number(baye.data.g_Persons.length),personQueue:Number(baye.data.g_PersonsQueue.length),cities:Number(baye.data.g_Cities.length),configuredCities:Number(baye.data.g_engineConfig.citiesCount)})');
    assert.deepEqual(report.originalNativeCapacity,{logicalPeople:200,physicalPeople:2000,personQueue:2000,cities:38,configuredCities:38});
    assert.equal(sample.world.period,1);assert.equal(sample.world.king,report.selectedLord.id);assert.equal(city.Belong,sample.world.king+1);
    assert.equal(sample.native.menu.active,0);assert.equal(sample.native.march.pick,1);assert.equal(sample.native.qty.active,0);assert.equal(sample.native.report.active,0);
    assert.ok(Number.isInteger(city.PersonQueue)&&Number.isInteger(city.Persons)&&city.PersonQueue>=0&&city.Persons>=0&&city.PersonQueue+city.Persons<=sample.world.queue.length);
    const queue=sample.world.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons);
    assert.ok(queue.every(id=>Number.isInteger(id)&&id>=0&&id<200));
    const captives=queue.flatMap((personId,offset)=>sample.world.people[personId].Belong===65535?[{personId,queueOffset:city.PersonQueue+offset}]:[]);
    report.actualCaptives={origin:plan.origin,cityIndex:plan.target,queueStart:city.PersonQueue,queueCount:city.Persons,queue,captives,sample,noRetry:true};
    await captureCaptivePhase(cdp,'actual-captives-settled');
    if(!captives.length){
        report.captiveInspection={accepted:false,reason:'No real captive in the settled target city',attempts:1,noRetry:true};
        report.accepted=false;report.hdAccepted=false;report.captiveAccepted=false;report.personCaptivesAccepted=false;
        return;
    }
    let loaded;
    if(captiveMobileWidth) {
        const origin=await evaluate(cdp,'location.origin');
        await saveCaptiveWorld(cdp,sample);
        loaded=await loadCaptiveWorld(cdp,origin);
    }
    await exerciseCaptiveSelection(cdp,loaded);
}

async function exerciseCaptiveSelection(cdp,loaded){
    const ctx={evaluate:expression=>evaluate(cdp,expression),until:(label,expression,timeout)=>waitFor(cdp,label,expression,timeout),click:selector=>click(cdp,selector),key:name=>key(cdp,name),checkpoint:label=>captureCaptivePhase(cdp,label),capture:label=>captureCaptivePhase(cdp,label),readKeys:(offset=0)=>evaluate(cdp,'__identityKeys.slice('+Number(offset)+')'),readKeyRecords:(offset=0)=>evaluate(cdp,'__identityCalls.slice('+Number(offset)+')'),sample:()=>evaluate(cdp,'__identitySample()'),report,libBytes:captiveLib,cdp,artifactDir};
    ctx.loaded=loaded;
    if(captiveMobileDocument) {
        ctx.mobile={touches:(type,points)=>captiveTouch(cdp,type,points),tap:point=>captiveTap(cdp,point)};
    }
    if(captiveOrder) {
        ctx.untilJoined=captiveUntilJoined;
        ctx.endMonth=async (label) => {
            if(ctx.mobile) {
                const before=await ctx.sample();
                await click(cdp,'#hd-mobile-system-open');
                await waitFor(cdp,'current mobile strategy-end menu',`(() => {
                    const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();
                    return m.active===1&&m.context===2&&m.kind===1&&m.seq!==${before.state.menu.seq}&&m.names[0]==='策略结束'&&
                        s.open&&s.screen==='insystem'&&!s.pending&&BayeHdMobileSystem.snapshot().active;
                })()`);
                assert.deepEqual(await ctx.readKeys(before.state.keyCount),[40]);
                assert.deepEqual((await ctx.sample()).world,before.world);
            } else {
                await openFunctionMenu(cdp,label);
            }
            await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
        };
        ctx.untilProgress=(label,expression)=>waitForGameProgress(cdp,label,expression,90000);
        ctx.settleToMap=label=>settleToMap(cdp,label);
    }
    await runCaptiveInspection(ctx);
    await observeCaptiveLib(cdp,'after-captive-inspection');
    report.nativeKeys=await evaluate(cdp,'__identityKeys');report.nativeTouches=await evaluate(cdp,'__identityTouches');report.publicInputCalls=await evaluate(cdp,'__identityCalls');report.trustedEvents=await evaluate(cdp,'__identityEvents');
    if(ctx.mobile) {
        assert.deepEqual(report.nativeTouches,[],'HD captive touches never go to the classic LCD');
        assert.ok(report.trustedEvents.some(event=>event.type==='touchstart'));
    }
}

async function chooseMarchPair(cdp,emptyOnly,origin=null) {
    return evaluate(cdp,`(() => {
        const realm=baye.hd.realm(),d=baye.data;
        const candidates=[];
        for(const city of realm.cities.filter(c=>c.owned&&(${origin===null?'true':`c.i===${origin}`})&&Number(d.g_Cities[c.i].Persons)>0)) {
            const raw=d.g_Cities[city.i];
            if(Number(raw.Food)<=0)continue;
            const generals=Array.from({length:Number(raw.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(raw.PersonQueue)+i]))
                .filter(p=>Number(d.g_Persons[p].Belong)===realm.playerBelong&&Number(d.g_Persons[p].Arms)>0)
                .map(p=>({pind:p,name:baye.getPersonName(p),arms:Number(d.g_Persons[p].Arms),iq:Number(d.g_Persons[p].IQ)}));
            if(!generals.length)continue;
            for(const link of baye.hd.cityLinks(city.i)) {
                const target=realm.cities.find(c=>c.i===Number(link.index));
                if(!target||target.owned||(${emptyOnly}&&Number(d.g_Cities[target.i].Belong)!==0))continue;
                if(!${emptyOnly}&&Number(d.g_Cities[target.i].Belong)===0)continue;
                const defenderIds=Array.from({length:Number(d.g_Cities[target.i].Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(d.g_Cities[target.i].PersonQueue)+i]));
                const defenderTroops=defenderIds.filter(p=>Number(d.g_Persons[p].Belong)===Number(d.g_Cities[target.i].Belong))
                    .reduce((n,p)=>n+Number(d.g_Persons[p].Arms),0);
                if(${origin!==null}&&!defenderTroops)continue;
                const troops=generals.reduce((n,p)=>n+p.arms,0);
                candidates.push({origin:city.i,target:target.i,originName:city.name,targetName:target.name,empty:Number(d.g_Cities[target.i].Belong)===0,defenders:Number(d.g_Cities[target.i].Persons),food:Number(raw.Food),money:Number(raw.Money),generals,troops,defenderTroops});
            }
        }
        return candidates.sort((a,b)=>(b.troops/Math.max(1,b.defenderTroops))-(a.troops/Math.max(1,a.defenderTroops))||b.food-a.food)[0]||null;
    })()`);
}

async function openCity(cdp,cityIndex,label) {
    await waitFor(cdp,'real map before opening '+label,`baye.hd.march().pick===1 && !baye.hd.march().battlePick && !baye.hd.fight().active`,60000);
    if(mobileCampaignInput)await mobileCampaignInput.city(cityIndex);
    else {
        await waitFor(cdp,'current HD map can open '+label,`(() => {
            const m=BayeHdOverworld.debugSnapshot();
            return m.phase==='map'&&m.hitsEnabled&&m.owned.some(city=>city.i===${cityIndex});
        })()`);
        assert.ok(await action(cdp,'open-city-'+label,`BayeHdOverworld.walkToCity(${cityIndex})`));
    }
    await waitFor(cdp,'bound native root '+label,`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();return s.open&&s.layer==='root'&&s.cityIndex===${cityIndex}&&!s.entryPending&&m.active&&m.context===1&&m.kind===1;})()`);
    await checkpoint(cdp,label+'-city-root');
}

async function readCityPersons(cdp,cityIndex) {
    return evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${cityIndex}];
        return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
            .map(pind=>({pind,name:baye.getPersonName(pind),arms:Number(d.g_Persons[pind].Arms),belong:Number(d.g_Persons[pind].Belong)}));})()`);
}

async function acknowledgeGarrisonMove(cdp,phase,person) {
    const owner=await waitFor(cdp,'current move report '+phase,`(() => {
        const transfer=baye.hd.transfer(),native=baye.hd.report(),ticket=BayeHdCityMenu.getTransferDialogTicket();
        if(transfer?.command!==14||transfer.phase!==${phase}||native.active!==1||native.kind!==2||native.person!==${person}||
            ticket?.ownerType!=='transfer-report'||ticket.session!==transfer.session||ticket.reportSeq!==native.seq||
            ticket.reportInputSeq!==native.inputSeq)return null;
        const selector=['#hd-city-menu [data-hd-transfer-continue]','#hd-dialog [data-hd-dlg-ok]'].find(s=>{
            const button=document.querySelector(s);return button&&!button.disabled&&button.checkVisibility();
        });
        return selector&&{selector,transfer,native,offset:__runtimeEngineInputs.length};
    })()`);
    const {native,transfer,selector,offset}=owner;
    const retired=`(() => {const r=baye.hd.report();return r.active!==1||r.seq!==${native.seq}||r.inputSeq!==${native.inputSeq};})()`;
    assert.ok(await click(cdp,selector,{retired}));
    await waitFor(cdp,'acknowledged move report '+phase,retired);
    const keys=await evaluate(cdp,`__runtimeEngineInputs.slice(${offset}).map(input=>input.code)`);
    assert.deepEqual(keys,[39],'A move report is acknowledged with one original confirmation');
    return {transfer,native,keys};
}

async function moveGarrisonReinforcements(cdp) {
    const origin=25,target=31; // 棉竹 → 巴郡
    const realm=await evaluate(cdp,'baye.hd.realm()'),residents=await readCityPersons(cdp,origin);
    const movers=['魏延','简雍','李严'].map(name=>residents.find(p=>p.name===name&&p.belong===realm.playerBelong&&p.arms>0));
    assert.ok(movers.every(Boolean),'The original source city has all three armed reinforcement candidates');
    await openCity(cdp,origin,'garrison-reinforcements');
    await click(cdp,'#hd-city-menu [data-hd-root="0"]');
    const submenu=await waitFor(cdp,'original domestic move command',`(() => {const m=baye.hd.menuItems();
        return m.active&&m.context===1&&m.kind===2&&m.names.includes('移动')&&m;})()`);
    await click(cdp,`#hd-city-menu [data-hd-sub="${submenu.names.indexOf('移动')}"]`);
    const prompt=await acknowledgeGarrisonMove(cdp,5,realm.playerKing);
    const {session}=prompt.transfer;
    assert.equal(prompt.transfer.origin,origin);
    const targetOwner=await waitFor(cdp,'original move target map',`(() => {
        const t=BayeHdCityMenu.getTransferTargetTicket(),m=BayeHdMobileMap.snapshot();
        return t?.session===${session}&&m.active&&m.ownerType==='transfer-target'&&{targets:t.targets,offset:__runtimeEngineInputs.length};
    })()`);
    assert.ok(targetOwner.targets.includes(target),'The original campaign allows the reinforcement route');
    await mobileCampaignInput.city(target,'transfer-target');
    await waitFor(cdp,'touch selects the move target',`BayeHdCityMenu.getTransferPresentation()?.pendingTarget===${target}`);
    assert.equal(await evaluate(cdp,'__runtimeEngineInputs.length'),targetOwner.offset,'Previewing a move target sends no original input');
    await click(cdp,'#hd-city-menu [data-hd-transfer-confirm]');
    const route=await waitFor(cdp,'original move target and distance',`(() => {const t=baye.hd.transfer();
        return t?.session===${session}&&t.phase===1&&t.target===${target}&&t.distance>0&&t.distance<255&&t;})()`);
    const entry={origin,target,prompt,route,moves:[]};
    let picker=await livePersonMenu(cdp,'move reinforcements');
    for(const mover of movers) {
        const {menu,city}=picker,person=city.deepItems.find(p=>p.pind===mover.pind);
        assert.ok(person&&menu.idsValid&&menu.ids[person.i]===mover.pind,'The original move list offers '+mover.name);
        await click(cdp,personSelector(menu,person));
        const departure=await acknowledgeGarrisonMove(cdp,8,mover.pind);
        assert.equal(departure.transfer.session,session);
        assert.equal(departure.transfer.person,mover.pind);
        picker=await livePersonMenu(cdp,'next move after '+mover.name,menu.seq);
        const committed=await evaluate(cdp,'baye.hd.transfer()');
        assert.equal(committed.session,session);
        assert.notEqual(committed.commitSeq,departure.transfer.commitSeq);
        assert.equal(committed.commitResult,1,'The native move command accepted '+mover.name);
        const world=await evaluate(cdp,worldExpression);
        const orders=world.orders.filter(o=>o.OrderId===14&&o.City===origin&&o.Object===target&&o.Person===mover.pind);
        assert.equal(orders.length,1,'Exactly one native move order names the departing reinforcement');
        assert.equal(orders[0].TimeCount,route.distance);
        assert.ok(!(await readCityPersons(cdp,origin)).some(p=>p.pind===mover.pind),'The moving general leaves the original source queue');
        const move={person:mover,departure,committed,order:orders[0],orderIndex:world.orders.indexOf(orders[0])};
        entry.moves.push(move);
        await checkpoint(cdp,'garrison-move-'+mover.pind,{move});
    }
    await settleDomestic(cdp);
    await waitFor(cdp,'ordinary mobile map after move orders',mobileMapReady);
    await checkpoint(cdp,'garrison-moves-queued');
    return entry;
}

async function livePersonMenu(cdp,description,previousSeq=null) {
    return waitFor(cdp,'current native and DOM person menu '+description,`(() => {
        const menu=baye.hd.menuItems(),city=BayeHdCityMenu.debugSnapshot(),owner=city.deepMenuOwner;
        if(!menu.active||menu.context!==1||menu.kind!==3||${previousSeq===null?'false':`menu.seq===${previousSeq}`}||
            !owner||owner.context!==menu.context||owner.kind!==menu.kind||owner.seq!==menu.seq||
            !city.open||!city.deepItems.length||city.deepItems.length!==menu.names.length)return false;
        const nodes=[...document.querySelectorAll('#hd-city-menu [data-hd-deep]')];
        if(nodes.length!==menu.names.length)return false;
        const d=baye.data,nativeCity=d.g_Cities[city.cityIndex],playerBelong=baye.hd.realm().playerBelong;
        const queue=Array.from({length:Number(nativeCity.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(nativeCity.PersonQueue)+i]));
        const resolved=[];
        for(let i=0;i<menu.names.length;i++) {
            const item=city.deepItems[i],node=nodes.find(n=>Number(n.getAttribute('data-hd-deep'))===i);
            if(!node||item.name!==menu.names[i]||node.getAttribute('data-hd-deep-name')!==item.name||
                Number(node.getAttribute('data-hd-menu-context'))!==menu.context||
                Number(node.getAttribute('data-hd-menu-kind'))!==menu.kind||
                Number(node.getAttribute('data-hd-menu-seq'))!==menu.seq)return false;
            const matches=queue.filter(pind=>baye.getPersonName(pind)===item.name);
            if(matches.length!==1)throw new Error('Native person name must resolve to one actual origin queue ID: '+item.name);
            const pind=matches[0];
            if(Number(d.g_Persons[pind].Belong)!==playerBelong)throw new Error('Native military/domestic menu includes a non-allied origin identity: '+item.name);
            if(item.pind!=null&&Number(item.pind)!==pind)throw new Error('HD person identity disagrees with actual origin queue: '+item.name);
            const domPind=node.hasAttribute('data-hd-deep-pind')?Number(node.getAttribute('data-hd-deep-pind')):null;
            if(domPind!=null&&domPind!==pind)throw new Error('DOM person identity disagrees with actual native menu name: '+item.name);
            resolved.push({...item,i,pind,domPind});
        }
        return {menu,city:{...city,deepItems:resolved},march:baye.hd.march()};
    })()`);
}

function personSelector(menu,person) {
    return '#hd-city-menu [data-hd-deep-name='+JSON.stringify(person.name)+']'+
        '[data-hd-deep="'+person.i+'"]'+
        (person.domPind!=null?'[data-hd-deep-pind="'+person.domPind+'"]':'')+
        '[data-hd-menu-context="'+menu.context+'"]'+
        '[data-hd-menu-kind="'+menu.kind+'"]'+
        '[data-hd-menu-seq="'+menu.seq+'"]';
}

const generalSearchRows=`[...document.querySelectorAll('#hd-city-menu-deep [data-hd-deep]')]
    .filter(node=>node.checkVisibility()).map(node=>({index:Number(node.dataset.hdDeep),id:Number(node.dataset.hdDeepPind)}))`;

async function assertFreshGeneralSearch(cdp,menu) {
    await waitFor(cdp,'unfiltered new native general list',`(() => {
        const tools=document.getElementById('hd-city-menu-list-tools'),q=document.getElementById('hd-city-menu-list-query');
        const rows=${generalSearchRows};
        return !tools.hidden&&document.getElementById('hd-city-menu-list-controls').hidden&&q.value===''&&
            baye.hd.menuItems().seq===${menu.seq}&&rows.length===${menu.count};
    })()`);
}

async function findMilitaryGeneral(cdp,live,person,label) {
    const prefix='#hd-city-menu-list-',native='({menu:baye.hd.menuItems(),march:baye.hd.march(),qty:baye.hd.qty(),keys:__runtimeEngineInputs.length})';
    await waitFor(cdp,'general search in '+label,"!document.getElementById('hd-city-menu-list-tools').hidden",8000);
    const before=await evaluate(cdp,native);
    await click(cdp,prefix+'toggle');
    const march=live.city.deepKind==='person-city',sortValue=march?'arms':'force',field=march?'Arms':'Force';
    const sortIndex=await evaluate(cdp,`(() => {
        const select=document.getElementById('hd-city-menu-list-sort');select.focus();
        return [...select.options].findIndex(option=>option.value===${JSON.stringify(sortValue)});
    })()`);
    assert.ok(sortIndex>0,'The general sort is offered as a native browser control');
    const arrow={key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40};
    for(let step=0;step<sortIndex;step++) {
        await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',...arrow});
        await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',...arrow});
    }
    const expected=await evaluate(cdp,`baye.hd.menuItems().ids.map((id,index)=>({id,index,value:Number(baye.data.g_Persons[id].${field})}))
        .sort((a,b)=>b.value-a.value||a.index-b.index).map(({id,index})=>({id,index}))`);
    assert.equal(await evaluate(cdp,"document.getElementById('hd-city-menu-list-sort').value"),sortValue);
    assert.deepEqual(await evaluate(cdp,generalSearchRows),expected,'Sorting preserves native IDs and original order for ties');
    const search=async text=>{
        await click(cdp,prefix+'query');
        await waitFor(cdp,'focused general name search',"document.activeElement.id==='hd-city-menu-list-query'");
        await cdp.send('Input.insertText',{text});
    };
    await search('无此武将');
    await waitFor(cdp,'empty general name result',`document.querySelector('[data-hd-list-empty]')&&(${generalSearchRows}).length===0`);
    if(march) {
        const finish='[data-hd-finish-persons]';
        if(mobileCampaignInput) {
            const control=await mobileCampaignInput.reveal(finish);
            assert.ok(control.hit&&control.width>=44&&control.height>=44,'Finishing remains touchable with no search matches');
        } else assert.equal(await evaluate(cdp,`document.querySelector(${JSON.stringify(finish)}).checkVisibility()`),true);
    }
    await click(cdp,prefix+'clear');
    await waitFor(cdp,'clear restores the full general list',`(${generalSearchRows}).length===${live.menu.count}`);
    await search(person.name);
    const matches=await waitFor(cdp,'filtered original general row',`(() => {const rows=${generalSearchRows};return rows.length===1&&rows;})()`);
    assert.deepEqual(matches,[{index:person.i,id:person.pind}],'The filtered first visible row retains its original person ID and index');
    const inView=await evaluate(cdp,`(() => {
        const button=document.querySelector(${JSON.stringify(personSelector(live.menu,person))});
        const r=button.getBoundingClientRect(),list=document.getElementById('hd-city-menu-deep').getBoundingClientRect();
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return r.width>=44&&r.height>=44&&r.top>=list.top&&r.bottom<=Math.min(list.bottom,innerHeight)&&button.contains(hit);
    })()`);
    assert.equal(inView,true,'A single search match is fully reachable without scrolling');
    assert.deepEqual(await evaluate(cdp,native),before,'General search sends no native keys and preserves the original menu');
    await checkpoint(cdp,label+'-filtered-general',{person:{name:person.name,id:person.pind,index:person.i}});
}

function assertDispatchedArmy(initial,march) {
    const actual=initial.units.filter(p=>p.side==='player').map(p=>({pind:p.id-1,name:p.name,arms:p.arms}));
    const expected=march.selected.map(p=>({pind:p.pind,name:p.name,arms:p.arms}));
    assert.deepEqual(actual,expected,'native GenArray identities and troops exactly match every selected and acknowledged general: '+march.label);
    march.battleReadyArmy=actual;
}

async function continueCampaignMarch(cdp,label,phase,next) {
    if(!mobileCampaignInput) {
        await waitFor(cdp,'march report '+label,`baye.hd.march().phase===${phase}`);
        return action(cdp,'continue-'+label,'BayeHdCityMenu.continueMarch()');
    }
    await click(cdp,'#hd-city-menu [data-hd-march-continue]',{retired:`baye.hd.march().phase===${next}`});
}

async function dispatchMarch(cdp,origin,target,label,options={}) {
    await openCity(cdp,origin,label);
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,'live military menu '+label,`BayeHdCityMenu.getLayer()==='sub' && baye.hd.menuItems().active && baye.hd.menuItems().names[0]==='侦察'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="4"]');
    await waitFor(cdp,'live selected origin '+label,`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.march();return m.phase===1&&m.origin===${origin}&&s.deepItems.length&&baye.hd.menuItems().active;})()`);
    const start=await evaluate(cdp,'baye.hd.march()');
    const march={label,origin,target,start,selected:[]};
    report.marches??=[];report.marches.push(march);
    await checkpoint(cdp,label+'-persons');
    let previousSeq=null;
    for(let i=0;i<(options.generalNames?options.generalNames.length:10);i++) {
        if(previousSeq!==null)await waitFor(cdp,'native next general wait '+label,`(() => {const m=baye.hd.menuItems();return baye.hd.march().phase!==1||m.active&&m.context===1&&m.kind===3&&m.seq!==${previousSeq};})()`);
        if(await evaluate(cdp,'baye.hd.march().phase!==1'))break;
        const before=await livePersonMenu(cdp,label+' selection '+i,previousSeq);
        assert.equal(before.march.origin,origin,'live native selection still belongs to this origin');
        const personIndex=options.generalNames?before.city.deepItems.findIndex(p=>p.name===options.generalNames[i]):0;
        assert.ok(personIndex>=0,'named prepared general is truly present: '+(options.generalNames?.[i]||'first available'));
        const item=before.city.deepItems[personIndex],queue=await readCityPersons(cdp,origin);
        const person=queue.find(p=>p.pind===Number(item.pind));
        assert.ok(person&&person.name===item.name,'the displayed name maps to the exact native origin PersonQueue identity');
        assert.equal(person.belong,await evaluate(cdp,'baye.hd.realm().playerBelong'),'only an actual allied origin general is dispatched');
        if(person.pind===options.unarmedPerson)assert.equal(person.arms,0,'The opening-status subject travels with the confirmed zero troops');
        else assert.ok(person.arms>0,'every selected general has actual troops before departure');
        await checkpoint(cdp,label+'-select-'+i+'-ready');
        if(findGenerals&&i===0)await findMilitaryGeneral(cdp,before,item,label);
        if(findGenerals&&i===1)await assertFreshGeneralSearch(cdp,before.menu);
        await click(cdp,personSelector(before.menu,item));
        await waitFor(cdp,'general selection ACK '+label,`baye.hd.march().selected===${before.march.selected+1}`);
        const remaining=await readCityPersons(cdp,origin);
        assert.deepEqual(remaining.map(p=>p.pind).sort((a,b)=>a-b),queue.filter(p=>p.pind!==person.pind).map(p=>p.pind).sort((a,b)=>a-b),
            'native selection removes exactly the intended general from the city: '+person.name);
        march.selected.push({...person,nativeIndex:personIndex,menuSeq:before.menu.seq});
        previousSeq=before.menu.seq;
        await checkpoint(cdp,label+'-select-'+i+'-ack');
    }
    if(options.generalNames)assert.equal(march.selected.length,options.generalNames.length,'every requested name receives its actual native selection ACK');
    if(await evaluate(cdp,'baye.hd.march().phase===1')) {
        await livePersonMenu(cdp,label+' finish persons',previousSeq);
        await click(cdp,'#hd-city-menu [data-hd-finish-persons]');
    }
    await waitFor(cdp,'native food quantity '+label,`baye.hd.march().phase===2&&baye.hd.qty().active&&baye.hd.qty().min===1`);
    if(Number.isFinite(options.foodBudget)) {
        const quantity=await evaluate(cdp,'baye.hd.qty()');
        const budget=Math.max(quantity.min,Math.min(quantity.max,Math.floor(options.foodBudget)));
        let current=quantity.value;
        while(current!==budget) {
            const step=Math.abs(current-budget)>=10?10:1,delta=current>budget?-step:step;
            if(mobileCampaignInput)await click(cdp,mobileQuantityControl(`data-hd-qty="${delta}"`));
            else assert.equal(await action(cdp,'explicit-food-step-'+label,`BayeHdCityMenu.stepQty(${delta})`),true);
            current+=delta;
            await waitFor(cdp,'actual food step acknowledged '+label,`baye.hd.qty().active&&baye.hd.qty().value===${current}`);
        }
        assert.equal(await evaluate(cdp,'baye.hd.qty().value'),budget,'The army takes the requested native ration');
    }
    await checkpoint(cdp,label+'-food');
    await confirmCampaignQuantity(cdp);
    await continueCampaignMarch(cdp,'target-'+label,3,4);
    await waitFor(cdp,'target map '+label,'baye.hd.march().phase===4&&baye.hd.march().battlePick===1');
    if(mobileCampaignInput) {
        const keys=await evaluate(cdp,'__runtimeEngineInputs.length');
        await mobileCampaignInput.city(target,'march-target');
        await waitFor(cdp,'visible selected mobile target',`BayeHdCityMenu.debugSnapshot().pendingTarget===${target}&&baye.hd.march().phase===4`);
        assert.equal(await evaluate(cdp,'__runtimeEngineInputs.length'),keys,'Touching the target selects it without native input');
        await click(cdp,'#hd-city-menu [data-hd-confirm-march]');
    } else {
        const selected=await action(cdp,'select-target-'+label,`BayeHdCityMenu.selectMarchTarget(${target})`);
        assert.equal(selected.selected,target);
        assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4,'select target alone delivers no confirmation');
        await action(cdp,'confirm-target-'+label,`BayeHdCityMenu.confirmMarchTarget(${target})`);
    }
    await waitFor(cdp,'native departure report '+label,mobileCampaignInput?'[6,7].includes(baye.hd.march().phase)':'baye.hd.march().phase===6');
    await checkpoint(cdp,label+'-departure-report');
    await continueCampaignMarch(cdp,'departure-'+label,6,7);
    await waitFor(cdp,'native AddFightOrder '+label,'baye.hd.march().phase===7&&baye.hd.march().ok===1');
    await waitFor(cdp,'native strategy input '+label,`(() => {const m=baye.hd.march(),x=baye.hd.menuItems();return x.active&&[1,2].includes(x.context)||!x.active&&m.pick===1&&!m.battlePick;})()`);
    const nativeOrder=await evaluate(cdp,`(() => {
        const d=baye.data,orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]);
        return orders.filter(o=>Number(o.OrderId)===27&&Number(o.City)===${origin}&&Number(o.Object)===${target}).map(o=> {
            const slot=Number(o.Person),offset=slot*20;
            const ids=Array.from({length:10},(_,i)=>Number(d.FIGHTERS[offset+i*2])|(Number(d.FIGHTERS[offset+i*2+1])<<8));
            return {slot,active:Number(d.FIGHTERS_IDX[slot]),ids:ids.filter(id=>id>0),food:Number(o.Food)};
        });
    })()`);
    assert.equal(nativeOrder.length,options.queuedMarch?2:1,'The expected number of native orders shares this origin and target');
    if(options.queuedMarch)assert.deepEqual(nativeOrder[0],options.queuedMarch.order,'The first army remains queued ahead of the new one');
    const submittedOrder=nativeOrder.at(-1);
    assert.equal(submittedOrder.active,1,'the actual pending fighter slot is active');
    assert.deepEqual(submittedOrder.ids,march.selected.map(p=>p.pind+1),'native AddFightOrder stores exactly the named acknowledged team');
    march.order=submittedOrder;
    if(scenario==='domestic') {
        const pending=await evaluate(cdp,worldExpression);
        assert.ok(pending.orders.some(o=>o.OrderId===1&&o.Person===report.domestic.order.Person&&o.City===origin),'the original cultivation order remains distinct while the march is queued');
        assert.ok(pending.orders.some(o=>o.OrderId===27&&o.Person===march.order.slot&&o.City===origin&&o.Object===target),'the native fight order uses its fighter slot and target separately');
        march.pendingDomesticWorld=pending;
    }
    await checkpoint(cdp,label+'-order-ack');
    if(!options.leaveQueued) {
        if(mobileCampaignInput)await click(cdp,'#hd-city-menu [data-hd-strategy-end]');
        else await action(cdp,'end-strategy-'+label,'BayeHdCityMenu.goStrategyEnd()');
        await waitFor(cdp,'strategy request '+label,'BayeHdCityMenu.debugSnapshot().handoff||baye.hd.fight().active||baye.hd.fight().skip',20000);
    }
    return march;
}

async function retreatBattle(cdp,round) {
    const before=await evaluate(cdp,battleStateExpression);
    await battleSystem(cdp,'retreat-open-system');
    await waitBattle(cdp,6,'retreat system menu');
    const system=await evaluate(cdp,'baye.hd.menuItems()');
    await menuChoice(cdp,system.names[1],7);
    await checkpoint(cdp,'battle-'+round+'-retreat-confirm');
    const confirmation=await evaluate(cdp,'baye.hd.menuItems()');
    assert.ok(confirmation.active&&confirmation.context===3&&confirmation.kind===7);
    await menuChoice(cdp,confirmation.names[0]);
    await waitFor(cdp,'native retreat completes','!baye.hd.fight().active&&baye.hd.fight().over===2',30000);
    report.retreat={before,confirmation,after:await evaluate(cdp,battleStateExpression)};
    return report.retreat;
}

const cityTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),tiles=[];
    for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++)if(Number(d.g_FightMapData[y*f.mapW+x])===3)tiles.push({x,y});
    return tiles;
})()`;

function attackOffsets(mask) {
    assert.ok(Number.isInteger(mask.size)&&mask.size>0&&mask.size<=15,'actual C attack mask has a supported size');
    assert.equal(mask.cells.length,mask.size*mask.size,'actual C attack mask is complete');
    const signedByte=value=>((value+128)%256+256)%256-128;
    const sx=signedByte(mask.origin.x-mask.anchor.x),sy=signedByte(mask.origin.y-mask.anchor.y),offsets=[];
    for(let y=0;y<mask.size;y++)for(let x=0;x<mask.size;x++)if(mask.cells[y*mask.size+x]===1)offsets.push({x:sx+x,y:sy+y});
    assert.ok(offsets.length,'the actual selected general has a nonempty attack mask');
    return offsets;
}

function attackCovers(offsets,position,target) {
    return offsets.some(p=>p.x===target.x-position.x&&p.y===target.y-position.y);
}

function chooseCampaignTile(candidates,units,actor,mainGen,cities,offsets,defending=false) {
    const enemies=units.filter(u=>u.side==='enemy'&&u.arms>0&&u.state!==8);
    const onCity=p=>cities.some(c=>c.x===p.x&&c.y===p.y);
    const guards=defending?enemies.filter(u=>u.i===10):enemies.filter(onCity),distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    const garrison=units.filter(u=>u.side==='player'&&u.arms>0&&u.state!==8&&onCity(u));
    const holdCity=defending&&onCity(actor)&&!garrison.some(u=>u.i!==actor.i);
    const available=candidates.filter(p=>!units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8)&&
        (!holdCity||p.x===actor.x&&p.y===actor.y));
    const choices=available.map(p=> {
        const targets=enemies.filter(u=>attackCovers(offsets,p,u));
        const guardTargets=targets.filter(u=>defending?u.i===10:onCity(u));
        return {x:p.x,y:p.y,capture:onCity(p)&&(!defending||!garrison.length),holdCity,
            guardTargets:guardTargets.map(u=>u.name),targets:targets.map(u=>u.name),
            // Distance pressure is a conservative positioning tie-breaker,
            // never a replacement for the actual mask's legal target check.
            commanderPressure:actor.i===mainGen?enemies.reduce((sum,u)=>sum+1/(1+distance(p,u)**2),0):0,
            objectiveDistance:Math.min(...(guards.length?guards:cities).map(c=>distance(p,c))),moveDistance:distance(p,actor)};
    });
    choices.sort((a,b)=> {
        const opportunity=Number(b.capture)-Number(a.capture)||
            Number(b.guardTargets.length>0)-Number(a.guardTargets.length>0)||
            Number(b.targets.length>0)-Number(a.targets.length>0);
        if(opportunity)return opportunity;
        if(a.targets.length&&b.targets.length)return a.commanderPressure-b.commanderPressure||
            b.targets.length-a.targets.length||a.objectiveDistance-b.objectiveDistance||a.moveDistance-b.moveDistance;
        return a.objectiveDistance-b.objectiveDistance||a.commanderPressure-b.commanderPressure||a.moveDistance-b.moveDistance;
    });
    return choices[0];
}

async function readAttackMask(cdp,actor) {
    const mask=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,size=Number(r[0]),u=d.g_GenPos[${actor.i}],p=d.g_Persons[${actor.id-1}];
        return {actorIndex:f.actorIndex,inputKind:f.inputKind,inputSeq:f.inputSeq,size,origin:{x:Number(r[1]),y:Number(r[2])},
            anchor:{x:Number(u.x),y:Number(u.y)},unitId:Number(d.g_FgtParam.GenArray[${actor.i}]),armType:baye.getArmType(${actor.id-1}),
            equip:[Number(p.Equip[0]),Number(p.Equip[1])],cells:Array.from({length:size*size},(_,i)=>Number(r[3+i]))};})()`);
    assert.equal(mask.inputKind,5,'attack mask is read only while the real attack AIM is waiting');
    assert.equal(mask.actorIndex,actor.i);assert.equal(mask.unitId,actor.id);
    mask.offsets=attackOffsets(mask);
    return mask;
}

async function cacheAttackMask(cdp,actor,selected,round) {
    const before=await evaluate(cdp,battleStateExpression),original=before.units.find(u=>u.i===actor.i);
    if(selected.inputKind===2) {
        const legal=await evaluate(cdp,moveTilesExpression);
        assert.ok(legal.some(p=>p.x===original.x&&p.y===original.y),'the general current tile is a real legal MOVE choice');
        await battleTile(cdp,'mask-probe-current-tile-'+actor.name,original.x,original.y);
        await waitBattle(cdp,3,'mask probe action '+actor.name);
    }
    const names=await evaluate(cdp,'baye.hd.menuItems().names');
    await menuChoice(cdp,names[0],5);
    const mask=await readAttackMask(cdp,actor);
    const probe={round,actor:actor.name,mask,before:original,after:null};
    report.attackMasks??=[];report.attackMasks.push(probe);
    await checkpoint(cdp,'battle-'+round+'-mask-'+actor.id,{attackMask:mask});
    await cancelBattleMenu(cdp,'mask-probe-cancel-aim-'+actor.name);await waitBattle(cdp,3,'mask probe returns ACTION');
    await cancelBattleMenu(cdp,'mask-probe-cancel-action-'+actor.name);await waitBattle(cdp,1,'mask probe returns PICK');
    const restored=await evaluate(cdp,battleStateExpression),after=restored.units.find(u=>u.i===actor.i);
    assert.equal(restored.fight.bout,before.fight.bout,'one mask probe does not advance the native battle day');
    assert.equal(restored.fight.over,0);assert.equal(after.active,0);
    assert.deepEqual({x:after.x,y:after.y,arms:after.arms},{x:original.x,y:original.y,arms:original.arms},'native ACTION cancel restores the general without spending troops');
    probe.after=after;
    return mask;
}

async function configureBattleSettings(cdp,round) {
    await battleSystem(cdp,'battle-settings-open-system');await waitBattle(cdp,6,'battle settings SYSTEM');
    const choices=[{index:2,field:'g_LookMovie',label:'战斗动画',choice:'不看'},
        {index:3,field:'g_MoveSpeed',label:'移动速度',choice:'快速'},
        {index:4,field:'g_LookEnemy',label:'敌军移动',choice:'不看'}];
    const before=await evaluate(cdp,'({lookMovie:Number(baye.data.g_LookMovie),moveSpeed:Number(baye.data.g_MoveSpeed),lookEnemy:Number(baye.data.g_LookEnemy)})');
    for(const choice of choices) {
        const system=await evaluate(cdp,'baye.hd.menuItems()');assert.equal(system.names[choice.index],choice.label);
        await menuChoice(cdp,system.names[choice.index],8);
        const setting=await evaluate(cdp,'baye.hd.menuItems()');assert.equal(setting.names[0],choice.choice);
        await menuChoice(cdp,setting.names[0]);
        await waitFor(cdp,'native battle setting ACK '+choice.field,`baye.data.${choice.field}===0&&baye.hd.fight().inputKind===6&&!BayeHdBattle.debugSnapshot().transaction`);
    }
    await cancelBattleMenu(cdp,'battle-settings-cancel-system');await waitBattle(cdp,1,'settings return real PICK');
    const after=await evaluate(cdp,'({lookMovie:Number(baye.data.g_LookMovie),moveSpeed:Number(baye.data.g_MoveSpeed),lookEnemy:Number(baye.data.g_LookEnemy)})');
    assert.deepEqual(after,{lookMovie:0,moveSpeed:0,lookEnemy:0});
    report.battleSettings??=[];report.battleSettings.push({round,before,after});
    await checkpoint(cdp,'battle-'+round+'-settings');
}

async function conquerBattle(cdp,round,defending=false) {
    const initial=await evaluate(cdp,battleStateExpression);
    assert.equal(initial.mode,defending?0:1,'the combat driver follows the actual native attack/defense mode');
    if(defending)assert.equal(initial.mainGen,10,'the real attacking commander is native index 10 in defense');
    const cities=await evaluate(cdp,cityTilesExpression);
    assert.ok(cities.length,'real C battle map contains a city terrain tile');
    report.objectives??=[];report.objectives.push({round,cities,defending});
    if (!liuBeiTransit) await configureBattleSettings(cdp,round);
    const masks=new Map();
    const maxSteps=Math.min(initial.fight.boutMax,30)*(initial.units.filter(u=>u.side==='player').length+1)+1;
    for(let step=0;step<maxSteps;step++) {
        const state=await evaluate(cdp,battleStateExpression);
        if(state.fight.over||!state.fight.active)break;
        assert.ok(state.fight.bout<=Math.min(state.fight.boutMax,30),'city capture stays within native battle duration');
        const actor=state.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![1,6,8].includes(u.state))
            .sort((a,b)=>b.arms-a.arms)[0];
        if(!actor) {await advanceTurn(cdp,round);continue;}
        let selected=await chooseGeneral(cdp,actor);
        if(!masks.has(actor.id)) {
            masks.set(actor.id,await cacheAttackMask(cdp,actor,selected,round));
            selected=await chooseGeneral(cdp,actor);
        }
        if(selected.inputKind===2) {
            const candidates=await evaluate(cdp,moveTilesExpression),target=chooseCampaignTile(candidates,state.units,actor,state.mainGen,cities,masks.get(actor.id).offsets,defending);
            assert.ok(target,'real legal unoccupied movement toward objective exists');
            report.tactics??=[];report.tactics.push({round,step,defending,bout:state.fight.bout,actor:actor.name,unitId:actor.id,
                maskInputSeq:masks.get(actor.id).inputSeq,legalCandidates:candidates.length,from:{x:actor.x,y:actor.y},target});
            await battleTile(cdp,'campaign-legal-move-'+actor.name,target.x,target.y);
            await waitBattle(cdp,3,'campaign action menu '+actor.name);
        }
        const moved=await evaluate(cdp,battleStateExpression),unit=moved.units.find(u=>u.i===actor.i);
        const standingCity=cities.some(p=>unit&&unit.x===p.x&&unit.y===p.y);
        if((defending||!standingCity)&&await attackIfPossible(cdp,actor,round,step,cities,masks,defending))continue;
        const names=await evaluate(cdp,'baye.hd.menuItems().names');
        await menuChoice(cdp,names[3]);
        await waitForGameProgress(cdp,'rest or actual city capture',`baye.hd.fight().over||baye.hd.fight().inputKind===1`,30000);
        if(standingCity)await checkpoint(cdp,'battle-'+round+'-city-action-'+step);
    }
    const terminal=await evaluate(cdp,battleStateExpression);
    if(defending)await waitFor(cdp,'native defense result','!baye.hd.fight().active&&[1,2].includes(baye.hd.fight().over)',30000);
    else {
        assert.notEqual(terminal.fight.over,2,'the real campaign cannot be counted as victory after a native defeat');
        await waitFor(cdp,'native campaign victory','!baye.hd.fight().active&&baye.hd.fight().over===1',30000);
    }
}

async function attackIfPossible(cdp,actor,round,step,cities,masks,defending=false) {
    const names=await evaluate(cdp,'baye.hd.menuItems().names');
    await menuChoice(cdp,names[0],5);
    const actualMask=await readAttackMask(cdp,actor);
    const old=masks.get(actor.id);
    if(JSON.stringify(old.offsets)!==JSON.stringify(actualMask.offsets)) {
        report.attackMaskChanges??=[];report.attackMaskChanges.push({round,step,actor:actor.name,before:old,after:actualMask});
    }
    masks.set(actor.id,actualMask);
    const onCity=u=>cities.some(c=>c.x===u.x&&c.y===u.y);
    const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.arms>0)
        .sort((a,b)=>Number(defending?b.i===10:onCity(b))-Number(defending?a.i===10:onCity(a))||a.arms-b.arms);
    if(!targets.length) {
        await cancelBattleMenu(cdp,'cancel-no-legal-enemy');await waitBattle(cdp,3,'no target returns action');return false;
    }
    const target=targets[0],before=await evaluate(cdp,battleStateExpression);
    assert.ok(attackCovers(actualMask.offsets,actualMask.anchor,target),'the final native AIM mask covers the actual chosen target');
    await battleTile(cdp,'campaign-attack-'+target.name,target.x,target.y);
    await waitForGameProgress(cdp,'campaign attack resolves','baye.hd.fight().over||baye.hd.fight().inputKind===1',30000);
    const after=await evaluate(cdp,battleStateExpression),enemy=after.units.find(u=>u.i===target.i);
    assert.ok(!enemy||enemy.arms<target.arms,'real campaign attack damages target');
    report.attacks??=[];report.attacks.push({round,step,defending,actor:actor.name,target:target.name,actualMask,before,after});
    await checkpoint(cdp,'battle-'+round+'-attack-'+step);
    return true;
}

async function advanceTurn(cdp,round) {
    const before=await evaluate(cdp,battleStateExpression);
    await battleSystem(cdp,'campaign-explicit-end-turn');
    await waitBattle(cdp,6,'campaign turn system');
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name);
    await waitForGameProgress(cdp,'campaign enemy turn',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.over||!s.transaction&&f.inputKind===1&&f.bout>${before.fight.bout};})()`,60000,
        {maxTimeout:240000,round,bout:before.fight.bout});
    const after=await evaluate(cdp,battleStateExpression);
    assert.ok(after.fight.over||after.fight.bout===before.fight.bout+1,'one player end advances one round');
    report.turns??=[];report.turns.push({round,before,after});
    await checkpoint(cdp,'battle-'+round+'-bout-'+after.fight.bout);
}

const defenseStateExpression=`(() => {
    const d=baye.data,p=d.g_FgtParam,people=(start,end)=>Array.from({length:end-start},(_,i)=>Number(p.GenArray[start+i]))
        .filter(id=>id>0&&id<0xfffe).map(id=>({pind:id-1,name:baye.getPersonName(id-1),arms:Number(d.g_Persons[id-1].Arms),belong:Number(d.g_Persons[id-1].Belong)}));
    return {mode:Number(p.Mode),cityIndex:Number(p.CityIndex),defenders:people(0,10),attackers:people(10,20)};
})()`;

async function liveDefenderMenu(cdp,description,previousSeq=null) {
    return waitFor(cdp,'actual native DEFENDERS and visible ownership '+description,`(() => {
        const menu=baye.hd.menuItems(),dialog=BayeHdDialog.debugSnapshot(),owner=dialog.defenseOwner,d=baye.data;
        if(!menu.active||menu.context!==5||menu.kind!==2||${previousSeq===null?'false':`menu.seq===${previousSeq}`}||
            !dialog.open||dialog.kind!=='defenders'||dialog.defenseRequest||!owner||owner.context!==5||owner.kind!==2||
            owner.seq!==menu.seq||Number(d.g_FgtParam.Mode)!==0||Number(d.g_FgtParam.CityIndex)!==owner.cityIndex||
            JSON.stringify(owner.names)!==JSON.stringify(menu.names))return false;
        if(${verifyDefenderTaps}) {
            const ticket=BayeHdDialog.getInputTicket();
            if(!BayeHdMobileCity.snapshot().dialogVisible||ticket?.ownerType!=='defenders'||ticket.menuSeq!==menu.seq)return false;
        }
        const panel=document.getElementById('hd-dialog');
        if(!panel.getBoundingClientRect().height)return false;
        const nodes=[...panel.querySelectorAll('[data-hd-defender-index]')];
        if(nodes.length!==menu.names.length||!nodes.length)return false;
        const city=d.g_Cities[owner.cityIndex],belong=baye.hd.realm().playerBelong;
        if(Number(city.Belong)!==belong)throw new Error('Native DEFENDERS must belong to an actual player city');
        const queue=Array.from({length:Number(city.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(city.PersonQueue)+i]));
        const persons=[],token=nodes[0].getAttribute('data-hd-defenders-owner');
        for(let index=0;index<menu.names.length;index++) {
            const name=menu.names[index],node=nodes.find(n=>Number(n.getAttribute('data-hd-defender-index'))===index);
            if(!node||node.disabled||node.getAttribute('data-hd-defender-name')!==name||
                Number(node.getAttribute('data-hd-defender-seq'))!==menu.seq||
                Number(node.getAttribute('data-hd-menu-context'))!==5||Number(node.getAttribute('data-hd-menu-kind'))!==2||
                !token||node.getAttribute('data-hd-defenders-owner')!==token)return false;
            const matches=queue.filter(pid=>baye.getPersonName(pid)===name);
            if(matches.length!==1)throw new Error('Defender name must resolve to exactly one true city PersonQueue ID: '+name);
            const pind=matches[0],p=d.g_Persons[pind];
            if(Number(p.Belong)!==belong)throw new Error('Native defender is not an actual allied city general: '+name);
            const arms=Number(p.Arms),thew=Number(p.Thew),stats=node.querySelector('.hd-defender-stats');
            if(menu.idsValid!==true||menu.ids[index]!==pind||!stats||
                stats.textContent!=='兵力 '+arms+' · 体力 '+thew||!stats.getBoundingClientRect().height){
                throw new Error('Defender stats for '+name+' (ID '+pind+'): expected '+arms+' troops and '+thew+
                    ' stamina; saw menu ID '+menu.ids[index]+' and text '+JSON.stringify(stats?.textContent));
            }
            persons.push({index,pind,name,arms,thew,belong:Number(p.Belong)});
        }
        const selected=Array.from({length:10},(_,i)=>Number(d.g_FgtParam.GenArray[i])).filter(id=>id>0&&id<0xfffe);
        if(JSON.stringify(selected)!==JSON.stringify(owner.selected))return false;
        return {menu,owner,token,persons,selected,cityIndex:owner.cityIndex};
    })()`);
}

function defenderSelector(owner,person) {
    return '#hd-dialog [data-hd-defender-index="'+person.index+'"]'+
        '[data-hd-defender-name='+JSON.stringify(person.name)+'][data-hd-defender-seq="'+owner.menu.seq+'"]'+
        '[data-hd-menu-context="5"][data-hd-menu-kind="2"][data-hd-defenders-owner='+JSON.stringify(owner.token)+']';
}

function incomingDefenseOrder(world,cityIndex,attackers) {
    const ids=attackers.map(p=>p.pind+1);
    const orders=world.orders.filter(order=>order.OrderId===27&&order.Object===cityIndex&&order.TimeCount===0);
    const exact=orders.filter(order=> {
        const bytes=world.fighters.slice(order.Person*20,order.Person*20+20),stored=[];
        for(let i=0;i<bytes.length;i+=2) {const id=bytes[i]+256*bytes[i+1];if(id>0&&id<0xfffe)stored.push(id);}
        return JSON.stringify(stored)===JSON.stringify(ids);
    });
    assert.equal(exact.length,1,'one real pending BATTLE order matches the native attacking GenArray IDs');
    return {order:exact[0],orderIndex:world.orders.indexOf(exact[0]),pendingOrders:orders,attackerIds:ids};
}

async function playNpcDefense(cdp,label,previous) {
    const first=await liveDefenderMenu(cdp,label),before=await evaluate(cdp,worldExpression),pending=await evaluate(cdp,defenseStateExpression);
    assert.equal(pending.mode,0);assert.equal(pending.cityIndex,first.cityIndex);assert.equal(first.selected.length,0,'native NPC defense starts with a cleared defending team');
    const queue=await readCityPersons(cdp,first.cityIndex),belong=before.realm.playerBelong;
    const ruler=before.realm.playerKing;
    // Keep the ruler in the besieged city. BeOccupied then handles captivity
    // when the playable defending army uses the original retreat command.
    const retreatForSuccession=defenseAfterSuccession&&!report.defenseCampaign.successions.length&&
        queue.some(p=>p.pind===ruler&&p.belong===belong)&&
        queue.some(p=>p.pind!==ruler&&p.belong===belong&&p.arms>0)&&
        before.cities.some(city=>city.i!==first.cityIndex&&city.Belong===belong);
    const armed=queue.filter(p=>p.belong===belong&&p.arms>0&&(!retreatForSuccession||p.pind!==ruler))
        .sort((a,b)=>Number(b.name==='张辽')-Number(a.name==='张辽')||b.arms-a.arms);
    const reinforcements=report.defenseCampaign?.reinforcements;
    const arrivals=reinforcements?.target===first.cityIndex?
        reinforcements.moves.map(({person})=>armed.find(p=>p.pind===person.pind)):[];
    const testsLimit=arrivals.length>0&&arrivals.every(Boolean)&&armed.length>10;
    const [tenth]=arrivals,leftInCity=arrivals.at(-1);
    const roster=testsLimit?[...armed.filter(p=>p!==tenth&&p!==leftInCity).slice(0,9),tenth]:armed.slice(0,10);
    assert.ok(roster.every(p=>first.persons.some(item=>item.pind===p.pind)),'every armed allied defender is offered by the real native selection menu');
    const round='defense-'+((report.extraDefenses?.length||0)+1),protectedTarget=report.marches?.[0]?.target;
    const previousFight=await evaluate(cdp,'baye.hd.fight()');
    const entry={label:round,source:label,cityIndex:first.cityIndex,protectedTarget,
        before,pending,previousFight,...incomingDefenseOrder(before,first.cityIndex,pending.attackers),selected:[],menuSeq:first.menu.seq};
    report.extraDefenses??=[];report.extraDefenses.push(entry);
    if(testsLimit) {
        assert.deepEqual(first.persons.filter(p=>p.arms>0).map(p=>p.pind).sort((a,b)=>a-b),armed.map(p=>p.pind).sort((a,b)=>a-b),
            'The original picker and HD list expose every one of the more than ten armed residents');
        for(const {order} of reinforcements.moves) {
            assert.ok(!before.orders.some(o=>o.OrderId===order.OrderId&&o.Person===order.Person&&
                o.City===order.City&&o.Object===order.Object),'The arrived reinforcement has no remaining move order');
        }
        entry.tenDefenders={candidates:first.persons,arrivals,leftInCity};
    }
    if(defenseSameMonth&&previous) {
        assert.deepEqual([before.year,before.month],[previous.before.year,previous.before.month],
            'Both incoming defenses interrupt the same original strategy month');
        assert.ok(entry.orderIndex>previous.orderIndex&&entry.order.Person!==previous.order.Person,
            'The next picker belongs to a distinct later incoming order and army slot');
        assert.ok(entry.menuSeq>previous.menuSeq,'The later incoming order owns a fresh native defender menu');
        assert.deepEqual(previous.before.orders[entry.orderIndex],entry.order,'The later attack was already pending during the first picker');
        assert.equal(previous.before.fighterIndex[entry.order.Person],1,'Both incoming armies were allocated in that strategy month');
        assert.deepEqual(before.orders[previous.orderIndex],{...previous.order,OrderId:255},'The previous order retired before the next picker');
        assert.equal(before.fighterIndex[previous.order.Person],0,'The previous army slot was released before the next picker');
        assert.equal(await evaluate(cdp,'BayeHdBattleNote.debugSnapshot().active'),false,'The previous result note retired before the next picker');
        const succession=report.defenseCampaign.successions.find(s=>s.defeat===previous.label&&s.choice.chosenId===ruler);
        if(ruler!==previous.before.realm.playerKing)assert.ok(succession,'The next picker belongs to the committed successor');
        entry.handoff={previous:previous.label,orderIndex:previous.orderIndex,armySlot:previous.order.Person,
            menuSeq:previous.menuSeq,successor:succession?.committed.receipt||null};
    }
    await checkpoint(cdp,round+'-native-selection',{defense:pending,incomingOrder:entry.order,candidates:first.persons});
    let previousSeq=null,lastSelectionInputEnd=null;
    for(const desired of roster) {
        const owner=await liveDefenderMenu(cdp,round+' '+desired.name,previousSeq),currentQueue=await readCityPersons(cdp,entry.cityIndex);
        const item=owner.persons.find(p=>p.pind===desired.pind&&p.name===desired.name);
        assert.ok(item,'the exact armed defender is still in the current native menu: '+desired.name);
        assert.equal(item.arms,desired.arms,'the native defender troops remain unchanged before selection');
        assert.deepEqual(owner.selected,entry.selected.map(p=>p.pind+1),'native selected defender IDs equal the acknowledged prefix');
        if(testsLimit&&entry.selected.length===9) {
            assert.ok(owner.persons.some(p=>p.pind===leftInCity.pind&&p.arms>0),'The unselected armed reinforcement is still available at the tenth pick');
            entry.tenDefenders.lastCandidates=owner.persons;
        }
        await checkpoint(cdp,round+'-select-'+entry.selected.length+'-ready',{defender:item});
        const inputOffset=verifyDefenderTaps?await evaluate(cdp,'__runtimeEngineInputs.length'):null;
        await click(cdp,defenderSelector(owner,item));
        const expected=entry.selected.map(p=>p.pind+1).concat(item.pind+1);
        await waitFor(cdp,'real defender GenArray ACK '+item.name,`JSON.stringify(Array.from({length:10},(_,i)=>Number(baye.data.g_FgtParam.GenArray[i])).filter(id=>id>0&&id<0xfffe))===${JSON.stringify(JSON.stringify(expected))}`);
        const remaining=await readCityPersons(cdp,entry.cityIndex);
        assert.deepEqual(remaining.map(p=>p.pind).sort((a,b)=>a-b),currentQueue.filter(p=>p.pind!==item.pind).map(p=>p.pind).sort((a,b)=>a-b),
            'native defensive selection removes exactly the named city general: '+item.name);
        const selection={...item,menuSeq:owner.menu.seq};
        if(inputOffset!==null) {
            const keys=await evaluate(cdp,`__runtimeEngineInputs.slice(${inputOffset}).map(input=>input.code)`);
            const delta=item.index-owner.menu.index;
            assert.deepEqual(keys,[...Array(Math.abs(delta)).fill(delta<0?34:35),39],
                'Each HD tap sends only the native cursor steps and one current defender confirmation');
            lastSelectionInputEnd=inputOffset+keys.length;
            selection.keys=keys;
        }
        entry.selected.push(selection);previousSeq=owner.menu.seq;
        await checkpoint(cdp,round+'-select-'+(entry.selected.length-1)+'-ack');
    }
    if(!testsLimit) {
        const menu=await evaluate(cdp,'baye.hd.menuItems()');
        if(menu.active&&menu.context===5&&menu.kind===2) {
            const owner=await liveDefenderMenu(cdp,round+' explicit finish',previousSeq);
            entry.finish='explicit-exit';
            await click(cdp,'#hd-dialog [data-hd-defenders-finish][data-hd-defender-seq="'+owner.menu.seq+'"]'+
                '[data-hd-defenders-owner='+JSON.stringify(owner.token)+']');
        } else entry.finish=entry.selected.length===10?'auto-capacity':'auto-exhausted';
    }
    const opening=await waitForGameProgress(cdp,'fresh native NPC defense PICK or immediate result',`(() => {
        const f=baye.hd.fight(),d=baye.data;
        if(f.inputSeq<=${previousFight.inputSeq}||f.cityIndex!==${entry.cityIndex}||d.g_FgtParam.Mode!==0||d.g_MainGenIdx!==10)return false;
        if(f.active===1&&f.over===0&&f.inputKind===1)return {phase:'pick',fight:f};
        return !f.active&&[1,2].includes(f.over)&&{phase:'instant',fight:f};
    })()`,60000);
    if(testsLimit) {
        assert.equal(opening.phase,'pick','The tenth confirmation starts a playable original battle');
        assert.equal(opening.fight.bout,1);
        await waitBattle(cdp,1,round+' playable HD after ten defenders');
        assert.equal(await evaluate(cdp,'__runtimeEngineInputs.length'),lastSelectionInputEnd,
            'The original ten-defender limit starts the battle without a separate finish input');
        assert.equal(await evaluate(cdp,`(() => {const menu=baye.hd.menuItems();
            return !!(menu.active&&menu.context===5&&menu.kind===2)||BayeHdDialog.getInputTicket()?.ownerType==='defenders';})()`),false,
            'Neither the original defender list nor its HD input owner remains active');
        const remaining=await readCityPersons(cdp,entry.cityIndex);
        assert.deepEqual(remaining.find(p=>p.pind===leftInCity.pind),leftInCity,
            'The unselected armed reinforcement stays in the actual city queue at battle start');
        entry.tenDefenders.remaining=remaining;
        entry.finish='auto-capacity';
    }
    if(opening.phase==='pick') {
        assert.ok(entry.selected.length,'A playable defense requires an actual selected army');
        entry.initial=await evaluate(cdp,battleStateExpression);
        assert.equal(entry.initial.fight.cityIndex,entry.cityIndex);
        assert.ok(entry.initial.fight.inputSeq>previousFight.inputSeq,'NPC defense starts a new native input generation after the prior result');
        assertDispatchedArmy(entry.initial,entry);
        const enemies=entry.initial.units.filter(p=>p.side==='enemy').map(p=>({pind:p.id-1,name:p.name,arms:p.arms}));
        assert.deepEqual(enemies,pending.attackers.map(p=>({pind:p.pind,name:p.name,arms:p.arms})),'the true NPC army retains its original order identities and troops');
        assert.equal(entry.initial.units.find(p=>p.i===10)?.id-1,pending.attackers[0].pind,'defense index 10 is the actual incoming commander');
        const cityTiles=await evaluate(cdp,cityTilesExpression),firstGuard=entry.initial.units.find(p=>p.side==='player');
        assert.ok(cityTiles.some(p=>p.x===firstGuard.x&&p.y===firstGuard.y),'the first real selected defender starts on the actual city tile');
        await checkpoint(cdp,round+'-battle-ready',testsLimit?{tenDefenders:entry.tenDefenders}:null);
        if(retreatForSuccession)entry.successionRetreat=await retreatBattle(cdp,round);
        else await conquerBattle(cdp,round,true);
    } else {
        entry.instantDefense=opening.fight;
        if(!entry.selected.length){
            assert.equal(opening.fight.over,2);
            entry.instantEmptyDefense=true;
        }
    }
    entry.terminal=await evaluate(cdp,battleStateExpression);entry.outcome=entry.terminal.fight.over;
    assert.ok([1,2].includes(entry.outcome),'NPC defense records only a real native victory or defeat');
    if(defenseScenario&&entry.initial) {
        entry.note=await recordBattleResultNote(cdp,round,{outcome:entry.outcome,kind:'defense',cityIndex:entry.cityIndex});
    }
    await checkpoint(cdp,round+'-terminal');
    if(entry.cityIndex===protectedTarget)assert.equal(entry.outcome,1,'the originally captured target must survive its real NPC defense before saving its occupation');
    return entry;
}

async function confirmDefenseSuccessor(cdp,label,defeat) {
    assert.equal(defeat?.outcome,2,'The original successor choice follows the observed defensive loss');
    const pickerSource=`(() => {
        const menu=baye.hd.menuItems(),ticket=BayeHdDialog.getInputTicket();
        if(menu.active!==1||menu.context!==5||menu.kind!==1||!menu.idsValid||ticket?.ownerType!=='successor'||
            ticket.menuSeq!==menu.seq||!BayeHdMobileCity.snapshot().dialogVisible)return null;
        return {menu,names:menu.ids.map(id=>baye.getPersonName(id)),world:${successionWorldExpression},
            keys:__runtimeEngineInputs.length};
    })()`;
    const picker=await waitFor(cdp,'current native and HD successor picker',pickerSource);
    const {world,menu,names}=picker,choice=verifyMobileSuccessorChoice({world,menu,names});
    assert.equal(choice.oldKing,defeat.before.realm.playerKing,'This defeat is the source of the current succession');
    const city=world.cities[defeat.cityIndex],residents=world.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons);
    assert.equal(city.Belong,defeat.pending.attackers[0].belong,'The attacker owns the city at the original successor choice');
    assert.equal(world.people[choice.oldKing].Belong,65535,'The old king was captured in the native defense settlement');
    assert.ok(residents.includes(choice.oldKing),'The old king is present in the lost city');
    const selector=`#hd-dialog [data-hd-successor-index="${choice.chosenIndex}"][data-hd-successor-seq="${menu.seq}"]`+
        `[data-hd-campaign-person="${choice.chosenId}"]`;
    await checkpoint(cdp,label+'-successor-picker');
    assert.deepEqual(await evaluate(cdp,pickerSource),picker,'The original successor owner and world remain current before touch');
    await click(cdp,selector);
    const during=await waitFor(cdp,'current original NewKingNote report',`(() => {
        const report=baye.hd.report(),ui=BayeHdDialog.debugSnapshot();
        return baye.data.g_PlayerKing===${choice.chosenId}&&report.active===1&&report.kind===1&&
            ui.open&&ui.kind==='report'&&ui.reportOwner?.seq===report.seq&&ui.reportOwner.inputSeq===report.inputSeq&&
            {report,world:${successionWorldExpression}};
    })()`);
    const keys=await evaluate(cdp,`__runtimeEngineInputs.slice(${picker.keys}).map(input=>input.code)`);
    assert.deepEqual(keys,[39],'One touch confirms the current native successor without other input');
    const reportVerdict=verifyMobileSuccessorReport({before:world,during:during.world,choice,report:during.report});
    await checkpoint(cdp,label+'-new-king-report');
    await acknowledgeCampaignReport(cdp,during.report);
    const committed=await waitFor(cdp,'synchronous native succession receipt',`__campaignSuccessions.find(({receipt})=>
        receipt.generation===${menu.generation}&&receipt.oldKing===${choice.oldKing}&&receipt.newKing===${choice.chosenId})`);
    const settlementVerdict=verifyMobileSuccessorSettlement({before:world,after:committed.world,choice,receipt:committed.receipt});
    report.defenseCampaign.successions.push({defeat:defeat.label,fightInputSeq:defeat.terminal.fight.inputSeq,
        picker,choice,keys,during,committed,reportVerdict,settlementVerdict});
}

async function settleToMap(cdp,label,{arrival=null,mapSeqBefore=null,nativeReports=null}={}) {
    const seen=new Set(),defenses=[];let deadline=Date.now()+150000;
    while(Date.now()<deadline) {
        const state=await evaluate(cdp,snapshotExpression);
        if(arrival&&!arrival.note) {
            const sample=await evaluate(cdp,battleResultNoteObservation);
            if(sample?.note.place.kind==='arrival'&&sample.city.index===arrival.following.target) {
                arrival.note=await captureBattleResultNote(cdp,'following-army',sample,
                    {outcome:1,kind:'arrival',cityIndex:arrival.following.target});
            }
        }
        if(!state.fight?.active&&state.march?.pick===1&&!state.march?.battlePick&&state.march.mapInputSeq!==mapSeqBefore&&
            state.overworld?.phase==='map'&&!state.dialog?.open) {
            await delay(400);
            const settled=await evaluate(cdp,snapshotExpression);
            if(!settled.fight?.active&&settled.march?.pick===1&&settled.march.mapInputSeq!==mapSeqBefore&&!settled.dialog?.open&&
                (!mobileCampaignInput||settled.mobile?.map.active&&settled.mobile.map.ownerType==='map')) {
                if(defenses.length) {
                    const after=await evaluate(cdp,worldExpression);
                    for(const defense of defenses) {
                        defense.after=after;defense.realmChanges=realmChanges(defense.before,after);
                        const city=after.cities.find(c=>c.i===defense.cityIndex);
                        if(defense.cityIndex===defense.protectedTarget)assert.equal(city.Belong,after.realm.playerBelong,'the actual captured city remains owned after all NPC defense and monthly reports');
                    }
                }
                return settled;
            }
        }
        const nativeMenu=state.menu;
        if(defenseScenario&&nativeMenu?.active&&nativeMenu.context===4&&nativeMenu.kind===1&&state.report?.text==='我军全军覆没') {
            throw new Error('The original campaign ended during '+label);
        }
        if(nativeMenu?.active&&nativeMenu.context===5&&nativeMenu.kind===2) {
            defenses.push(await playNpcDefense(cdp,label,defenses.at(-1)));
            // Full native combat has its own bounded action/turn waits. The
            // report settlement budget restarts only after that real result.
            deadline=Date.now()+150000;
            continue;
        }
        if(nativeMenu?.active&&nativeMenu.context===5&&nativeMenu.kind===1) {
            const token='successor:'+nativeMenu.seq;
            if(!seen.has(token)) {
                seen.add(token);
                const stage=label+'-successor-'+seen.size;
                if(verifyDefensiveSuccession)await confirmDefenseSuccessor(cdp,stage,defenses.at(-1));
                else {
                    await checkpoint(cdp,stage);
                    await click(cdp,'#hd-dialog [data-hd-successor-index="0"]');
                }
            }
        }
        const dialogue=state.dialog,nativeReport=state.report;
        if(dialogue?.open&&dialogue.kind==='report'&&!dialogue.pass&&
            nativeReport?.active===1&&nativeReport.inputSeq>0&&dialogue.reportOwner&&
            dialogue.reportOwner.seq===nativeReport.seq&&dialogue.reportOwner.inputSeq===nativeReport.inputSeq) {
            const token=nativeReport.seq+':'+nativeReport.inputSeq;
            if(!seen.has(token)) {
                seen.add(token);
                if (nativeReports) nativeReports.push({...nativeReport,
                    ownedCities:state.realm.cities.filter(city=>city.owned).map(city=>city.i)});
                await checkpoint(cdp,label+'-report-'+seen.size);
                await acknowledgeCampaignReport(cdp,nativeReport);
            }
        }
        await delay(200);
    }
    throw new Error('Timed out settling actual campaign reports to map: '+label);
}

async function advanceCampaignMonth(cdp,label,nativeReports) {
    await openFunctionMenu(cdp,label);
    const mapSeqBefore=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    await settleToMap(cdp,label,{mapSeqBefore,nativeReports});
    return evaluate(cdp,worldExpression);
}

function verifyCampaignDefenseSettlement(defense,settlements) {
    const {cityIndex,order,orderIndex,selected,terminal,after,pending,outcome}=defense;
    const matching=settlements.filter(s=>s.receipt.city===cityIndex&&s.receipt.over===outcome&&s.inputSeq===terminal.fight.inputSeq);
    assert.equal(matching.length,1,'Exactly one synchronous native settlement belongs to the completed defense');
    const settlement=matching[0],settledCity=settlement.world.cities.find(city=>city.i===cityIndex);
    if(outcome===1) {
        assert.equal(settledCity.Belong,settlement.receipt.playerKing+1,'Victory preserves ownership in native settlement');
        assert.equal(settledCity.Food,terminal.food.player+terminal.food.enemy,'Native settlement combines the two remaining provisions');
        const residents=settlement.world.personQueue.slice(settledCity.PersonQueue,settledCity.PersonQueue+settledCity.Persons);
        assert.ok(selected.every(person=>residents.includes(person.pind)),'The original winning defenders return to their city');
    } else {
        assert.equal(settledCity.Belong,pending.attackers[0].belong,'The incoming army takes ownership in the native defeat settlement');
    }
    assert.deepEqual(settlement.world.orders[orderIndex],order,'The matching incoming order is still present at native settlement');
    assert.deepEqual(after.orders[orderIndex],{...order,OrderId:255},'The original incoming order retires at month end');
    assert.equal(after.fighterIndex[order.Person],0,'The original incoming army slot is released');
    return settlement;
}

function staffedPlayerCity(world) {
    return world.cities.find(city=>city.Belong===world.realm.playerBelong&&world.personQueue
        .slice(city.PersonQueue,city.PersonQueue+city.Persons).some(id=>world.allPersons[id].Belong===city.Belong));
}

async function finishDefenseChain(cdp,campaign,chain,settlements) {
    const {before,after}=chain[0];
    assert.equal(after.year*12+after.month,before.year*12+before.month+1,'The full defensive chain settles in one strategy month');
    campaign.chain=chain.map((entry,index)=>{
        if(index>0)assert.equal(entry.handoff?.previous,chain[index-1].label,'The current picker follows the preceding settled defense');
        const settlement=verifyCampaignDefenseSettlement(entry,settlements);
        assert.deepEqual([settlement.world.year,settlement.world.month],[before.year,before.month]);
        const successor=campaign.successions.find(s=>s.defeat===entry.label);
        assert.equal(settlement.receipt.playerKing,successor?.choice.chosenId??entry.before.realm.playerKing);
        return {label:entry.label,cityIndex:entry.cityIndex,orderIndex:entry.orderIndex,armySlot:entry.order.Person,
            menuSeq:entry.menuSeq,outcome:entry.outcome,settlement};
    });
    campaign.chainMonth={year:before.year,month:before.month};
    const city=staffedPlayerCity(after);
    assert.ok(city,'A staffed player city remains on the genuine post-chain strategy map');
    campaign.cityStatus=await inspectMobileOwnedCity(cdp,city.i,after,'mobile-defense-chain');
    await checkpoint(cdp,'mobile-defense-chain-final-map');
}

async function defendCampaign(cdp) {
    const campaign=report.defenseCampaign={months:[]};
    await evaluate(cdp,`(() => {
        const observations=window.__campaignDefenseSettlements=[];
        window.addEventListener('baye-hd-battle-settled',event=>{
            const receipt=event.detail;
            if(receipt.mode===0)observations.push({receipt,inputSeq:baye.hd.fight().inputSeq,world:${worldExpression}});
        });
    })()`);
    if(verifyDefensiveSuccession) {
        campaign.successions=[];
        await evaluate(cdp,`(() => {
            const observations=window.__campaignSuccessions=[];
            window.addEventListener('baye-hd-successor-committed',({detail:receipt})=>{
                if(receipt.playerKing===receipt.newKing)observations.push({receipt,world:${successionWorldExpression}});
            });
        })()`);
    }
    const changan={origin:10,leaders:['李肃','侯成'],recruitments:2};
    if(defenseTenGenerals) {
        campaign.reinforcements=await moveGarrisonReinforcements(cdp);
    } else if(verifyDefensiveSuccession||mobileCampaignWidth===844&&!defenseAnyOutcome) {
        const wancheng={origin:20,leaders:['高顺'],recruitments:1};
        const garrisons=verifyDefenderTaps?[campaignPeriod===1?changan:winningFixture]:defenseAfterSuccession?[changan,wancheng]:
            [changan,{origin:15,leaders:['张辽','吕布'],recruitments:5},wancheng];
        campaign.garrisons=[];
        for(const fixture of garrisons) {
            const label='garrison-'+fixture.origin;
            const recruitment=await recruitArmy(cdp,fixture,label,fixture.leaders);
            const allocation=await allocateArmy(cdp,recruitment,label);
            assert.deepEqual([allocation.prepared.year,allocation.prepared.month],[recruitment.before.year,recruitment.before.month],
                'the garrison receives its native recruits before the strategy month advances');
            campaign.garrisons.push({...recruitment,...allocation});
        }
    } else {
        await prepareArmy(cdp,changan);
    }
    const inheritedBy=entry=>campaign.successions?.find(s=>s.choice.chosenId===entry.before.realm.playerKing&&
        s.choice.chosenId===entry.after.realm.playerKing&&s.fightInputSeq<entry.initial.fight.inputSeq&&
        s.settlementVerdict.cityIds.includes(entry.cityIndex));
    const completedDefense=()=>report.extraDefenses?.find(entry=>entry.initial&&entry.after&&
        (defenseTenGenerals?entry.tenDefenders:defenseAnyOutcome||entry.outcome===1&&
            entry.after.cities.find(city=>city.i===entry.cityIndex).Belong===entry.after.realm.playerBelong&&
            (!defenseAfterSuccession||inheritedBy(entry))));
    let chain=null;
    const completed=()=>defenseSameMonth?chain:completedDefense();
    const monthLimit=defenseTenGenerals?36:defenseSameMonth?18:12;
    for(let month=1;month<=monthLimit&&!completed();month++) {
        const label='defense-month-'+month,before=await evaluate(cdp,worldExpression);
        const after=await advanceCampaignMonth(cdp,label);
        assert.equal(after.year*12+after.month,before.year*12+before.month+1,'The original incoming orders settle within one month');
        campaign.months.push({label,year:before.year,month:before.month});
        if(defenseSameMonth) {
            const current=report.extraDefenses?.filter(entry=>entry.source===label)||[];
            if(current.length>1&&current.every(entry=>entry.initial&&entry.after&&entry.note))chain=current;
        }
    }
    if(defenseSameMonth) {
        assert.ok(chain,'No two playable native defenses shared a completed strategy month in '+campaign.months.length+' months');
        return finishDefenseChain(cdp,campaign,chain,await evaluate(cdp,'__campaignDefenseSettlements'));
    }
    const defense=completedDefense();
    const expectedResult=defenseTenGenerals?'ten-defender battle settled back to the map':defenseAnyOutcome?'defense settled back to the map':
        defenseAfterSuccession?'defense victory retaining an inherited city':'defense victory retaining its city';
    assert.ok(defense,'No native '+expectedResult+' after '+campaign.months.length+' original strategy months');
    const {cityIndex,after,outcome}=defense;
    const settlements=await evaluate(cdp,'__campaignDefenseSettlements');
    const settlement=verifyCampaignDefenseSettlement(defense,settlements);
    if(defenseAfterSuccession) {
        const succession=inheritedBy(defense),defeat=report.extraDefenses.find(entry=>entry.label===succession.defeat);
        const losses=settlements.filter(s=>s.receipt.city===defeat.cityIndex&&s.receipt.over===2&&s.inputSeq===succession.fightInputSeq);
        assert.equal(losses.length,1,'Exactly one original defeat settlement led to the verified succession');
        assert.equal(losses[0].receipt.playerKing,succession.choice.chosenId);
        assert.equal(settlement.receipt.playerKing,succession.choice.chosenId,'The same successor owns the later winning defense');
        assert.equal(settlement.receipt.generation,succession.committed.receipt.generation);
        assert.deepEqual(defeat.after.orders[defeat.orderIndex],{...defeat.order,OrderId:255},'The predecessor battle order has retired');
        assert.equal(defeat.after.fighterIndex[defeat.order.Person],0,'The predecessor battle allocation has been released');
        campaign.victorySuccession={defeat:defeat.label,cityIndex:defeat.cityIndex,loss:losses[0].receipt,
            successor:succession.committed.receipt};
    }
    if(outcome===1)campaign.victory=defense.label;
    Object.assign(campaign,{completed:defense.label,outcome,settlement});
    const defendedCity=after.cities.find(city=>city.i===cityIndex&&city.Belong===after.realm.playerBelong);
    const inspectionCity=defendedCity??(defenseTenGenerals?staffedPlayerCity(after):null);
    if(defenseTenGenerals)assert.ok(inspectionCity,'A staffed player city remains after the ten-defender battle settles');
    if(mobileCampaignInput&&inspectionCity) {
        campaign.cityStatus=await inspectMobileOwnedCity(cdp,inspectionCity.i,after,'mobile-defended');
        await checkpoint(cdp,'mobile-defended-return-map');
    } else if(defenseAnyOutcome) {
        await checkpoint(cdp,'defense-return-map');
    }
}

async function domesticBeforeMarch(cdp,cityIndex) {
    await openCity(cdp,cityIndex,'domestic');
    const before=await evaluate(cdp,worldExpression);
    await click(cdp,'#hd-city-menu [data-hd-root="0"]');
    await waitFor(cdp,'real domestic submenu',`baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2&&baye.hd.menuItems().names[0]==='开垦'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="0"]');
    const picker=await livePersonMenu(cdp,'cultivation'),person=picker.city.deepItems[0];
    assert.ok(person&&Number.isInteger(Number(person.pind)),'cultivation binds a genuine native general identity');
    await checkpoint(cdp,'domestic-person-picker');
    await click(cdp,personSelector(picker.menu,person));
    const oldFarming=before.cities.find(c=>c.i===cityIndex).Farming;
    await waitFor(cdp,'actual farming rises',`Number(baye.data.g_Cities[${cityIndex}].Farming)>${oldFarming}`);
    await checkpoint(cdp,'domestic-real-farming');
    await settleDomestic(cdp);
    const after=await evaluate(cdp,worldExpression);
    assert.ok(after.cities.find(c=>c.i===cityIndex).Farming>oldFarming,'explicit cultivation changes real C agriculture');
    assert.ok(await evaluate(cdp,'[0,7].includes(baye.hd.march().phase)&&!baye.hd.march().battlePick'),
        'Domestic work leaves no active march ownership');
    const orders=after.orders.filter(o=>o.OrderId===1&&o.City===cityIndex&&o.Person===person.pind);
    assert.equal(orders.length,1,'the native cultivation command has its own exact assigned general');
    assert.ok(!(await readCityPersons(cdp,cityIndex)).some(p=>p.pind===person.pind),'the cultivating general is genuinely busy outside the city selection queue');
    report.domestic={before,after,person,order:orders[0]};
    await checkpoint(cdp,'domestic-then-map');
}

async function settleDomestic(cdp) {
    const seen=new Set(),deadline=Date.now()+60000;
    while(Date.now()<deadline) {
        const state=await evaluate(cdp,snapshotExpression);
        if(state.march?.pick===1&&!state.march.battlePick&&!state.menu?.active&&!state.dialog?.open)return;
        if(state.report?.active===1&&state.report.inputSeq>0&&state.dialog?.open&&state.dialog.kind==='report'&&state.dialog.reportOwner&&
            state.dialog.reportOwner.seq===state.report.seq&&state.dialog.reportOwner.inputSeq===state.report.inputSeq) {
            const token='report:'+state.report.seq+':'+state.report.inputSeq;
            if(!seen.has(token)) {seen.add(token);await acknowledgeCampaignReport(cdp,state.report);}
        } else if(state.menu?.active&&state.menu.context===1) {
            const token='menu:'+state.menu.seq;
            if(!seen.has(token)) {
                seen.add(token);
                if(mobileCampaignInput)await click(cdp,'#hd-city-menu [data-hd-menu-back]');
                else await key(cdp,'Escape');
            }
        }
        await delay(180);
    }
    throw new Error('Domestic work did not return to native strategy map');
}

async function openFunctionMenu(cdp,label) {
    if(captiveScenario)return openCaptiveFunctionMenu(cdp,label);
    const mapOwner=`(() => {const m=baye.hd.march(),n=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();
        return m.pick===1&&!m.battlePick&&m.mapInputSeq>0&&!n.active&&!baye.hd.qty().active&&!baye.hd.report().active&&
            !baye.hd.fight().active&&!s.sending&&!s.queueLen&&{mapInputSeq:m.mapInputSeq,menuSeq:n.seq,
                cityOpen:s.open,inputCount:window.__runtimeEngineInputs.length};})()`;
    const owner=await waitFor(cdp,'actual strategy map before '+label,mapOwner,60000);
    if(mobileCampaignInput) {
        await click(cdp,'#hd-mobile-system-open');
    } else {
        // Recruitment can leave the local city pane open after native MAP resumes.
        if(owner.cityOpen)await action(cdp,'retire-map-city-shell-'+label,'BayeHdCityMenu.close({silent:true})');
        await action(cdp,'use-hd-system-'+label,`BayeHdSystemUi.setMode('hd')`);
        assert.deepEqual(await evaluate(cdp,mapOwner),{...owner,cityOpen:false},'Preparing the menu preserves native MAP input');
        await key(cdp,'Escape');
    }
    await waitFor(cdp,'native function menu '+label,`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active&&m.seq!==${owner.menuSeq}&&m.context===2&&m.kind===1&&s.open&&s.screen==='insystem'&&s.input&&s.input.screen==='insystem'&&!s.pending;})()`);
    assert.deepEqual(await evaluate(cdp,`__runtimeEngineInputs.slice(${owner.inputCount}).map(input=>input.code)`),[40],
        'Exactly one native VK_EXIT opens the strategy menu');
    await checkpoint(cdp,label+'-function-menu');
}

async function openCaptiveFunctionMenu(cdp,label) {
    await waitFor(cdp,'unowned native MAP before '+label,`(() => {const m=baye.hd.march(),n=baye.hd.menuItems(),q=baye.hd.qty(),r=baye.hd.report(),s=BayeHdCityMenu.debugSnapshot();return m.pick===1&&!m.battlePick&&m.mapInputSeq>0&&!n.active&&!q.active&&!r.active&&!baye.hd.fight().active&&!s.sending&&!s.queueLen;})()`,60000);
    const before=await evaluate(cdp,'__identitySample()');
    const entry={label,before,noInputRetry:true};report.strategyMenuEntries??=[];report.strategyMenuEntries.push(entry);
    // RecruitMake has returned to MAP, but the prior HD quantity/person pane
    // can still be open. Retire only that local shell before the one real ESC;
    // otherwise its key handler consumes ESC without opening FunctionMenu.
    if(before.state.cityUi.open){
        await action(cdp,'retire-map-city-shell-'+label,'BayeHdCityMenu.close({silent:true})');
    }
    const retired=entry.afterShellRetirement=await evaluate(cdp,'__identitySample()');
    assert.equal(retired.state.cityUi.open,false,'The local retired city shell is closed before native MAP input');
    assert.deepEqual(retired.native,before.native,'Local shell retirement preserves the exact native MAP owner');
    assert.deepEqual(retired.world,before.world,'Local shell retirement preserves all observed recruitment costs and orders');
    assert.deepEqual(await evaluate(cdp,'__identityKeys.slice('+before.state.keyCount+')'),[],'Shell retirement sends no native key');
    await action(cdp,'use-hd-system-'+label,"BayeHdSystemUi.setMode('hd')");
    const ready=entry.beforeEscape=await evaluate(cdp,'__identitySample()');
    assert.equal(ready.state.cityUi.open,false);assert.deepEqual(ready.native,before.native);assert.deepEqual(ready.world,before.world);
    assert.deepEqual(await evaluate(cdp,'__identityKeys.slice('+before.state.keyCount+')'),[],'Preparing the system UI sends no native key');
    entry.mapOwner={generation:ready.native.generation,mapInputSeq:ready.native.march.mapInputSeq,menuSeq:ready.native.menu.seq};
    await key(cdp,'Escape');
    entry.ack=await waitFor(cdp,'fresh native function menu '+label,`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot(),c=BayeHdCityMenu.debugSnapshot(),a=baye.hd.march();return m.active===1&&m.context===2&&m.kind===1&&m.seq!==${ready.native.menu.seq}&&m.names[0]==='策略结束'&&!a.pick&&!c.open&&s.open&&s.screen==='insystem'&&!s.pending&&s.input&&s.input.type==='menu'&&s.input.screen==='insystem'&&s.input.seq===m.seq&&s.input.context===m.context&&s.input.kind===m.kind&&s.input.index===m.index&&{menu:m,input:s.input};})()`);
    const after=entry.after=await evaluate(cdp,'__identitySample()');entry.keys=await evaluate(cdp,'__identityKeys.slice('+ready.state.keyCount+')');
    assert.deepEqual(entry.keys,[40],'Exactly one actual VK_EXIT opens FunctionMenu from its recorded native MAP ticket');
    assert.deepEqual(after.world,before.world,'Opening FunctionMenu does not execute any pending recruitment order or END');
    assert.equal(after.native.generation,before.native.generation);entry.accepted=true;
    await checkpoint(cdp,label+'-function-menu');
}

function campaignSavePair(cdp,slot) {
    return evaluate(cdp,`(() => {
        const slot=${slot},paths=[slot*2,slot*2+1].map(index=>'baye//data//sango'+index+'.sav');
        const [sav0,sav1]=paths.map(path=>BayeSaveStorage.readFile(path));
        return {sav0,sav1,slot:BayeSaveStorage.inspectSlot(slot),valid:BayeSaveStorage.validatePair(sav0,sav1),
            journal:localStorage.getItem('baye/save-transaction/'+slot),
            metadata:paths.map(path=>Object.fromEntries(['.lib','.name','.lib-id'].map(key=>[key,BayeSaveStorage.readMetadata(path+key)])))};
    })()`);
}

async function campaignRecordMenu(cdp,mode) {
    if(mobileCampaignInput)await waitMobileCampaignSystem(cdp,'saveload');
    return waitFor(cdp,'current native '+(mode===1?'save':'load')+' selector',`(() => {
        const r=baye.hd.record(),s=BayeHdSystemUi.debugSnapshot();
        return r.active&&r.mode===${mode}&&r.count===${mode===1?3:4}&&s.open&&s.screen==='saveload'&&
            s.recordMode===r.mode&&s.input?.seq===r.seq&&!s.pending&&{record:r,slots:s.saves};
    })()`);
}

async function chooseCampaignRecord(cdp,owner,slot) {
    const offset=await evaluate(cdp,'__runtimeEngineInputs.length');
    await click(cdp,`#hd-system-ui [data-hd-sys="${slot}"]`);
    await waitFor(cdp,'native record selection returns to strategy map',
        `!baye.hd.record().active&&baye.hd.march().pick===1&&!baye.hd.march().battlePick`,60000);
    const keys=await evaluate(cdp,`__runtimeEngineInputs.slice(${offset}).map(input=>input.code)`);
    assert.deepEqual(keys,[...Array(Math.abs(slot-owner.index)).fill(slot<owner.index?34:35),39],
        'Record selection uses only the original cursor steps and one confirm');
    return keys;
}

function campaignResidents(world, index) {
    const {PersonQueue,Persons} = world.cities[index];
    return world.personQueue.slice(PersonQueue,PersonQueue + Persons);
}

async function loadLiuBeiTransit(cdp) {
    const source = fs.realpathSync(liuBeiTransit), raw = fs.readFileSync(source), prior = JSON.parse(raw);
    assert.ok(prior.isolation?.cleaned && prior.sourceVerification?.runnerMatch &&
        prior.sourceVerification.drift.length === 0, 'The previous original campaign has authenticated sources');
    assert.deepEqual([prior.route.period,prior.route.king,prior.selectedLord.id],[2,'刘备',2]);
    assert.equal(prior.sources['baye.wasm'].sha256, report.sources['baye.wasm'].sha256);
    assert.equal(prior.actualLib.sha256, report.library.sha256);
    const fromWest = prior.scenario === 'west-transit';
    const continued = fromWest || prior.scenario === 'elite-transit';
    assert.ok(westTransit ? continued : !fromWest, 'Resume from a checkpoint on this original campaign route');
    assert.deepEqual([prior.route.origin,prior.destination],continued ? [12,fromWest?0:6] : [13,12]);
    const nanpi = prior.nanpiPreparation;
    const west = prior.westPreparation;
    const rival = prior.westRival;
    const westPrefix = west?.roadRequested ? 'west-road' : 'west-transit';
    const checkpoints = fromWest ? [
        ['west-rival-ready',westRival && rival?.readySave],
        ['west-rival-progress',westRival && rival?.progressSave],
        ['west-rival-attackers',westRival && rival?.attackersSave],
        ['west-rival-staged',westRival && rival?.stagedSave],
        ['west-search-ready',prior.westSearch?.readySave],
        ['west-search-progress',prior.westSearch?.progressSave],
        [westPrefix+'-ready',west?.readySave],
        [westPrefix+'-progress',west?.progressSave],
        ['west-road-linked',west?.linkedSave]
    ] : continued ? [
        ['nanpi-defender-ready',nanpi.readySave],
        ['nanpi-preparation-progress',nanpi.progressSave],
        ['puyang-occupied',nanpi.occupiedSave]
    ] : [['elite-officer-arrived',prior.elitePreparation.readySave]];
    const [prefix,save] = checkpoints.find(([,checkpoint]) => checkpoint) ?? [];
    assert.equal(save?.files.length, 2);
    const parts = save.files.map((f,i) => {
        assert.equal(f.file,prefix+'-sango'+i+'.sav');
        const bytes = fs.readFileSync(path.join(path.dirname(source),f.file));
        assert.deepEqual([bytes.length,sha(bytes)],[f.bytes,f.sha256]);
        return bytes.toString('hex');
    });
    await evaluate(cdp,"BayeHdSystemUi.setMode('hd')");
    await waitFor(cdp,'Original title before loading 刘备',`(() => {
        const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();
        return m.active===1&&m.context===4&&m.kind===1&&s.open&&s.screen==='title'&&!s.pending;
    })()`);
    const keyStart = await evaluate(cdp,'__runtimeEngineInputs.length');
    assert.equal(await evaluate(cdp,'BayeSaveStorage.inspectSlot(0).status'),'empty');
    assert.equal(await evaluate(cdp,'BayeSaveStorage.importSlot(0,'+
        JSON.stringify({sav0:parts[0],sav1:parts[1],lib:'libs/dat-mod.lib'})+')'),true);
    assert.equal(await evaluate(cdp,'__runtimeEngineInputs.length'),keyStart);
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    const menu = await campaignRecordMenu(cdp,2);
    const keys = await chooseCampaignRecord(cdp,menu.record,0);
    const pair = await campaignSavePair(cdp,0);
    assert.deepEqual([pair.sav0,pair.sav1],parts);
    const world = await evaluate(cdp,worldExpression);
    verifyOriginalSavePair({...pair,world:await evaluate(cdp,originalRewardWorldSource)});
    const rivalStage = prefix.startsWith('west-rival-');
    const expectedKing = rivalStage ? save.playerKing ?? 2 : 2;
    assert.deepEqual([world.period,world.realm.playerKing,world.year,world.month],[2,expectedKing,save.year,save.month]);
    const owner = expectedKing + 1;
    const origin = continued ? 12 : 13;
    const attackerCities = rivalStage ? world.cities : [world.cities[origin]];
    assert.ok(attackerCities.some(city=>city.Belong===owner && campaignResidents(world,city.i).includes(183)));
    assert.deepEqual([world.allPersons[183].Belong,world.allPersons[183].ArmsType],[owner,rivalStage && rival.attackers ? 5 : 4]);
    report.selectedLord = {id:2,name:'刘备'};
    report.actualLib = {preferred:'libs/dat-mod.lib',sha256:report.library.sha256};
    report.transitResume = {source:path.relative(root,source),sha256:sha(raw),save,keys,stage:prefix};
    await checkpoint(cdp,'transit-save-loaded');
    return {world,continued,rival:rivalStage ? rival : undefined};
}

async function saveLiuBeiCheckpoint(cdp, label, slot, world) {
    assert.equal(await evaluate(cdp,`BayeSaveStorage.inspectSlot(${slot}).status`),'empty');
    await openFunctionMenu(cdp,label+'-save');
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    const owner = await campaignRecordMenu(cdp,1);
    const keys = await chooseCampaignRecord(cdp,owner.record,slot);
    const pair = await campaignSavePair(cdp,slot);
    assert.equal(pair.valid,true);
    const after = await evaluate(cdp,worldExpression);
    assert.deepEqual(after,world,'Saving preserves the original campaign');
    verifyOriginalSavePair({...pair,world:await evaluate(cdp,originalRewardWorldSource)});
    const files = [pair.sav0,pair.sav1].map((hex,i) => {
        const file = label+'-sango'+i+'.sav', bytes = Buffer.from(hex,'hex');
        fs.writeFileSync(path.join(artifactDir,file),bytes,{flag:'wx'});
        return {file,bytes:bytes.length,sha256:sha(bytes)};
    });
    await checkpoint(cdp,label+'-saved');
    return {slot,year:after.year,month:after.month,files,keys,...(westRival ? {playerKing:after.realm.playerKing} : {})};
}

async function runEliteTransit(cdp) {
    const loaded = await loadLiuBeiTransit(cdp);
    await evaluate(cdp,"BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd');BayeHdBattle.setMode('hd');");
    const run = report.nanpiPreparation = {monthBudget:eliteTransitMonths,months:[]};
    let world = loaded.world;
    if (!loaded.continued) {
        assert.equal(world.cities[12].Belong,93);
        assert.ok(campaignResidents(world,6).includes(8));
        assert.deepEqual([world.allPersons[8].Belong,world.allPersons[8].Arms],[65535,0]);
        const recruitment = await recruitArmy(cdp,{origin:13,leaders:['通宵虫'],recruitments:3},
            'puyang-army',['通宵虫','张飞','刘备']);
        run.army = {...recruitment,...await allocateArmy(cdp,recruitment,'puyang-army')};
        const march = await dispatchMarch(cdp,13,12,'puyang-march',{generalNames:['通宵虫','张飞'],foodBudget:500});
        assert.deepEqual(march.selected.map(person => person.pind),[183,32]);
        await waitForGameProgress(cdp,'original 濮阳 battle', 'baye.hd.fight().active&&!baye.hd.fight().over&&baye.hd.fight().inputKind===1',60000);
        const initial = await evaluate(cdp,battleStateExpression);
        assertDispatchedArmy(initial,march);
        await conquerBattle(cdp,'puyang');
        const note = await recordBattleResultNote(cdp,'puyang',{outcome:1,kind:'attack',cityIndex:12});
        assert.equal(note.city.owner,93);
        await settleToMap(cdp,'puyang');
        world = await evaluate(cdp,worldExpression);
        assert.equal(world.cities[12].Belong,3);
        assert.equal(world.fighterIndex[march.order.slot],0);
        assert.ok(!world.orders.some(o => o.OrderId===27&&o.City===13&&o.Object===12));
        run.occupation = {year:world.year,month:world.month,march,note};
        run.occupiedSave = await saveLiuBeiCheckpoint(cdp,'puyang-occupied',1,world);
    }
    for (let month = 0; month <= eliteTransitMonths; month++) {
        const {year,month:date} = world, city = world.cities[6], officer = world.allPersons[8];
        assert.equal(world.cities[12].Belong,3);
        const army = campaignResidents(world,12);
        assert.ok(army.includes(183)&&world.allPersons[183].Belong===3&&world.allPersons[183].Arms>0);
        const resident = campaignResidents(world,6).includes(8);
        const sample = {year,month:date,cityBelong:city.Belong,resident,belong:officer.Belong,arms:officer.Arms,arm:officer.ArmsType};
        run.months.push(sample);
        if (city.Belong && city.Belong!==3 && resident && officer.Belong===city.Belong && officer.Arms>0) {
            assert.equal(await evaluate(cdp,'baye.hd.personArmType(8)'),4);
            run.defender = sample;
            run.readySave = await saveLiuBeiCheckpoint(cdp,'nanpi-defender-ready',2,world);
            return;
        }
        if (month === eliteTransitMonths) break;
        world = await advanceCampaignMonth(cdp,'nanpi-month-'+(month+1));
        assert.equal(world.year*12+world.month,year*12+date+1);
    }
    run.progressSave = await saveLiuBeiCheckpoint(cdp,'nanpi-preparation-progress',2,world);
    assert.fail('Original 吕布 has not yet joined the armed 南皮 garrison; resume from the progress save');
}

function westernInduceTarget(world, hanCity) {
    const owner = world.realm.playerBelong;
    const cityLimit = Math.floor(world.cities.filter(city=>city.Belong===owner).length / 2);
    const roadTargets = westRoad ? [22,10,26,hanCity??33,9,14,16,2]
        .map(city=>world.cities[city].Belong - 1) : [];
    const targets = [world.cities[0].Belong - 1,...roadTargets,15,7,66,14,57,9];
    return targets.find(id=>{
        if (id<0 || id===world.realm.playerKing || world.allPersons[id]?.Belong!==id+1) return false;
        const holdings = world.cities.filter(city=>city.Belong===id+1).length;
        return holdings>0 && holdings<=cityLimit;
    });
}

function westernDiplomats(world, targetId, costs) {
    const {playerKing,playerBelong} = world.realm;
    const minimumIQ = world.allPersons[targetId].IQ - 50;
    const used = new Set();
    return world.cities.filter(city=>city.Belong===playerBelong).flatMap(city=>{
        const residents = [...new Set(campaignResidents(world,city.i))].map(id=>world.allPersons[id])
            .filter(person=>person.Belong===playerBelong);
        const armed = residents.filter(person=>person.Arms>0).sort((a,b)=>b.Arms-a.Arms);
        const guard = armed.find(person=>person.i!==183) ?? armed[0] ?? residents[0];
        const capacity = Math.floor(city.Money / costs.money);
        return residents.filter(person=>person.i!==guard?.i && person.i!==playerKing &&
            (!westRoad || person.i!==9) &&
            person.Thew>=costs.thew && person.IQ>=minimumIQ && !used.has(person.i))
            .sort((a,b)=>b.IQ-a.IQ).slice(0,capacity).map(person=>{
                used.add(person.i);
                return {cityIndex:city.i,personId:person.i};
            });
    });
}

function westernOwnedRoads(world, links) {
    const owner = world.realm.playerBelong;
    if (world.cities[0].Belong!==owner) return new Map();
    const roads = new Map([[0,[0]]]), queue = [0];
    for (const city of queue) {
        for (const next of links[city]) {
            if (roads.has(next) || world.cities[next].Belong!==owner) continue;
            roads.set(next,[...roads.get(city),next]);
            queue.push(next);
        }
    }
    return roads;
}

async function runWestTransit(cdp) {
    let {world,rival} = await loadLiuBeiTransit(cdp);
    await evaluate(cdp,"BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd');BayeHdBattle.setMode('hd');");
    // Original IFACE resource 2, ConsumeThew and ConsumeMoney entries for INDUCE.
    assert.equal(report.library.sha256,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    assert.equal(await evaluate(cdp,'Number(baye.data.g_engineConfig.enable16bitConsumeMoney)'),0);
    const until = (...args) => waitFor(cdp,...args);
    const chooseCityItem = async (name, attribute, kind) => {
        const menu = await until('Original city menu for ' + name,`(() => {
            const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();
            return m.active===1&&m.context===1&&m.kind===${kind}&&s.open&&s.showHd&&!s.sending&&!s.queueLen&&m;
        })()`);
        const index = menu.names.indexOf(name);
        assert.ok(index>=0 && menu.names.lastIndexOf(name)===index);
        await click(cdp,`#hd-city-menu [${attribute}="${index}"]`);
        return {menu};
    };
    let dispatchNumber = 0;
    const ctx = {
        world:()=>evaluate(cdp,originalRewardWorldSource),
        evaluate:expression=>evaluate(cdp,expression),
        until,chooseCityItem,click:selector=>click(cdp,selector),
        checkpoint:name=>checkpoint(cdp,name),
        nativeKeys:'__runtimeEngineInputs.map(input=>input.code)',
        reopenDiplomacy:async (_label,cityIndex)=>{
            await openCity(cdp,cityIndex,'west-order-'+(++dispatchNumber)+'-city-'+cityIndex);
            await chooseCityItem('外交','data-hd-root',1);
        },
        reopenInterior:async (_label,cityIndex)=>{
            const name = westSearch || westRival ? 'west-interior-'+(++dispatchNumber)+'-city-'+cityIndex : 'west-han-xuan-'+cityIndex;
            await openCity(cdp,cityIndex,name);
            await chooseCityItem('内政','data-hd-root',1);
        },
        waitPlayerMap:label=>until(label,`(() => {
            const m=baye.hd.menuItems(),w=baye.hd.march();
            return w.pick===1&&!w.battlePick&&!m.active&&!baye.hd.report().active&&!baye.hd.fight().active&&w;
        })()`)
    };
    if (westSearch) return runWestSearch(cdp,ctx,world);
    if (westRival) {
        ctx.libBytes = fs.readFileSync(path.join(root,report.actualLib.preferred));
        return runWestRival(cdp,ctx,world,rival);
    }

    const costs = {money:50,thew:10};
    const owner = world.realm.playerBelong;
    assert.ok(!westRoad || world.cities[0].Belong===owner,'Read back an original 西凉 acquisition first');
    const links = westRoad ? await evaluate(cdp,`baye.hd.realm().cities.map(city=>baye.hd.cityLinks(city.i).map(link=>link.index))`) : null;
    const label = westRoad ? 'west-road' : 'west-transit';
    const run = report.westPreparation = {roadRequested:westRoad,monthBudget:westTransitMonths,costs,months:[]};
    for (let month=0; month<=westTransitMonths; month++) {
        assert.deepEqual([world.realm.playerKing,world.cities[12].Belong,world.cities[18].Belong],[2,owner,owner]);
        assert.ok(campaignResidents(world,12).includes(183) && world.allPersons[183].Arms>0);
        const xiapi = world.cities[18];
        assert.ok(world.goods.slice(xiapi.ToolQueue,xiapi.ToolQueue+xiapi.Tools).includes(0x8000|31));
        const hanCity = westRoad ? world.cities.find(city=>campaignResidents(world,city.i).includes(9))?.i : undefined;
        const roads = westRoad ? westernOwnedRoads(world,links) : null;
        const linked = westRoad && world.allPersons[9].Belong===owner && roads.has(12) && roads.has(18) && roads.has(hanCity);
        if (world.cities[0].Belong===owner && (!westRoad || linked)) {
            if (westRoad) {
                run.road = {puyang:roads.get(12),xiapi:roads.get(18),hanXuan:roads.get(hanCity),from:hanCity};
                if (hanCity!==0) {
                    run.linkedSave = await saveLiuBeiCheckpoint(cdp,'west-road-linked',2,world);
                    let moveMonth = 0;
                    await moveOriginalCampaignOfficer(ctx,hanCity,0,9,run.road,'west-han-xuan',async before=>{
                        const reports = [];
                        await advanceCampaignMonth(cdp,'west-han-xuan-month-'+(++moveMonth),reports);
                        const after = await ctx.world();
                        assert.equal(after.year*12+after.month,before.year*12+before.month+1);
                        return {after,reports};
                    });
                    world = await evaluate(cdp,worldExpression);
                }
                assert.ok(campaignResidents(world,0).includes(9));
                assert.deepEqual([world.cities[0].Belong,world.cities[12].Belong,world.cities[18].Belong,world.allPersons[9].Belong],
                    [owner,owner,owner,owner]);
                const finalRoads = westernOwnedRoads(world,links);
                assert.ok(finalRoads.has(12) && finalRoads.has(18),'The original roads remain owned after 韩玄 arrives');
                run.road.puyang = finalRoads.get(12);
                run.road.xiapi = finalRoads.get(18);
                run.road.arrived = {year:world.year,month:world.month,cityIndex:0,personId:9};
            }
            const officer = world.allPersons[184];
            run.west = {owner, residents:campaignResidents(world,0), mystic:{personId:184,
                resident:campaignResidents(world,0).includes(184),belong:officer.Belong,arm:officer.ArmsType}};
            run.readySave = await saveLiuBeiCheckpoint(cdp,label+'-ready',1,world);
            return;
        }
        if (month===westTransitMonths) break;
        const targetId = westernInduceTarget(world,hanCity);
        if (targetId===undefined) break;
        const before = world;
        const freeOrders = before.orders.filter(order=>order.OrderId===255).length;
        const diplomats = westernDiplomats(before,targetId,costs).slice(0,freeOrders);
        const monthRun = {year:before.year,month:before.month,targetId,target:before.allPersons[targetId].name,orders:[],reports:[]};
        run.months.push(monthRun);
        for (const {cityIndex,personId} of diplomats) {
            monthRun.orders.push(await dispatchOriginalInduce(ctx,cityIndex,personId,targetId,costs));
        }
        world = await advanceCampaignMonth(cdp,'west-month-'+(month+1),monthRun.reports);
        assert.equal(world.year*12+world.month,before.year*12+before.month+1);
        for (const {cityIndex,personId} of monthRun.orders) {
            assert.ok(!world.orders.some(order=>order.OrderId===19&&order.City===cityIndex&&
                order.Person===personId&&order.Object===targetId),'The actual 劝降 order retired');
        }
        if (monthRun.orders.length) assert.ok(monthRun.reports.some(r=>r.kind===2&&r.person===targetId));
        monthRun.acquired = world.cities.filter(city=>city.Belong===owner&&before.cities[city.i].Belong===targetId+1)
            .map(city=>({index:city.i,name:city.name}));
        if (monthRun.acquired.length) {
            assert.ok(monthRun.reports.some(r=>r.kind===2&&r.person===targetId&&
                monthRun.acquired.every(city=>r.ownedCities.includes(city.index))),
            'New original ownership is already visible during the target ruler’s report');
            await checkpoint(cdp,'west-acquired-month-'+(month+1));
        }
    }
    run.progressSave = await saveLiuBeiCheckpoint(cdp,label+'-progress',1,world);
    assert.fail(westRoad ? '韩玄 has not reached 西凉; resume from the progress save' :
        '西凉 is still outside the original 刘备 realm; resume from the progress save');
}

async function runWestSearch(cdp, ctx, world) {
    const cityIndex = 0, searcher = 9, person = 184;
    const owner = world.realm.playerBelong;
    assert.deepEqual([world.cities[cityIndex].name,world.allPersons[searcher].name,world.allPersons[person].name],
        ['西凉','韩玄','南方小鬼']);
    const run = report.westSearch = {cityIndex,searcher,person,monthBudget:westTransitMonths,months:[]};
    for (let month=0; month<=westTransitMonths; month++) {
        const residents = campaignResidents(world,cityIndex);
        const officer = world.allPersons[person];
        assert.deepEqual([world.cities[cityIndex].Belong,world.cities[12].Belong,world.cities[18].Belong,
            world.allPersons[searcher].Belong,world.allPersons[183].Belong,world.allPersons[183].ArmsType],
        [owner,owner,owner,owner,owner,4]);
        assert.ok(residents.includes(searcher) && residents.includes(person), 'The original searcher and mystic reside in 西凉');
        assert.ok(campaignResidents(world,12).includes(183) && world.allPersons[183].Arms>0);
        const xiapi = world.cities[18];
        assert.ok(world.goods.slice(xiapi.ToolQueue,xiapi.ToolQueue+xiapi.Tools).includes(0x8000|31));
        assert.ok(officer.Belong===0 || officer.Belong===owner);
        assert.deepEqual([officer.ArmsType,await ctx.evaluate(`baye.hd.personArmType(${person})`)],[5,5]);
        if (officer.Belong===owner) {
            run.recruited = {year:world.year,month:world.month,belong:officer.Belong,arm:officer.ArmsType,arms:officer.Arms};
            run.readySave = await saveLiuBeiCheckpoint(cdp,'west-search-ready',1,world);
            return;
        }
        if (month===westTransitMonths) break;

        const monthRun = {year:world.year,month:world.month,orders:[],reports:[]};
        run.months.push(monthRun);
        const settle = async before => {
            world = await advanceCampaignMonth(cdp,'west-search-month-'+(month+1),monthRun.reports);
            assert.equal(world.year*12+world.month,before.year*12+before.month+1);
            return {after:await ctx.world(),reports:monthRun.reports};
        };
        if (world.allPersons[searcher].Thew>=8) {
            const otherNeutral = residents.some(id=>id!==person && world.allPersons[id].Belong===0);
            const result = await searchOriginalCampaignCity(ctx,cityIndex,(eligible,limit)=>{
                assert.ok(eligible.includes(searcher),'The original Search list includes 韩玄');
                const others = otherNeutral ? [...new Set(eligible)].filter(id=>id!==searcher).slice(0,2) : [];
                return [searcher,...others].slice(0,limit);
            },settle);
            monthRun.orders = result.orders;
        } else {
            await settle(world);
        }
        if (world.allPersons[person].Belong===owner) {
            assert.ok(monthRun.orders.some(o=>o.actor===searcher));
            assert.ok(monthRun.reports.some(r=>r.kind===2 && r.person===searcher && r.text.endsWith('南方小鬼')),
                'The native discovery report names 南方小鬼 and 韩玄');
            assert.ok(monthRun.reports.some(r=>r.kind===2 && r.person===person), 'The original mystic gives his joining report');
        }
    }
    run.progressSave = await saveLiuBeiCheckpoint(cdp,'west-search-progress',1,world);
    assert.fail('南方小鬼 is still neutral in the original campaign; resume from the progress save');
}

async function observeWestRivalOrders(ctx, person) {
    await ctx.evaluate(`(() => {
        const hooks=baye.hooks,d=baye.data,orders=[];
        if(hooks.willExecuteOrder!==undefined||hooks.tacticStage4!==undefined)throw Error('Original policy callbacks are already in use');
        let active=null,error=null;
        const state=()=>{const p=d.g_Persons[${person}];return {belong:Number(p.Belong),arms:Number(p.Arms),loyalty:Number(p.Devotion)};};
        const finish=()=>{if(active){active.after=state();active=null;}};
        const beforeOrder=context=>{
            try {
                finish();
                const orderId=Number(context.OrderId),object=Number(context.Object);
                if((orderId===16||orderId===17)&&object===${person}) {
                    const actor=Number(context.Person),sourceBelong=Number(d.g_Persons[actor].Belong);
                    if(sourceBelong!==Number(d.g_PlayerKing)+1) {
                        active={orderId,object,actor,sourceBelong,cityIndex:Number(context.City),before:state()};
                        orders.push(active);
                    }
                }
            } catch(e){error=String(e);}
            return -1;
        };
        const afterPolicy=()=>{try{finish();}catch(e){error=String(e);}return -1;};
        hooks.willExecuteOrder=beforeOrder;hooks.tacticStage4=afterPolicy;
        window.__westRivalOrders=()=>{
            if(hooks.willExecuteOrder!==beforeOrder||hooks.tacticStage4!==afterPolicy)throw Error('Original policy observer changed');
            delete hooks.willExecuteOrder;delete hooks.tacticStage4;delete window.__westRivalOrders;
            return {orders,error,unfinished:active!==null};
        };
    })()`);
    return async () => {
        const trace = await ctx.evaluate('window.__westRivalOrders()');
        assert.equal(trace.error,null);
        assert.equal(trace.unfinished,false);
        return trace.orders;
    };
}

function westRivalOfficer(world, person) {
    const officer = world.allPersons[person];
    const home = world.cities.find(city=>city.Belong===officer.Belong && campaignResidents(world,city.i).includes(person));
    return {year:world.year,month:world.month,belong:officer.Belong,cityIndex:home?.i,
        satrap:home?.SatrapId,arm:officer.ArmsType,arms:officer.Arms,loyalty:officer.Devotion};
}

async function advanceWestRivalMonth(cdp, ctx, run, world, label) {
    const {person} = run;
    const before = westRivalOfficer(world,person), previousOwner = world.realm.playerBelong;
    const reports = [], readOrders = await observeWestRivalOrders(ctx,person);
    let orders;
    try {
        world = await advanceCampaignMonth(cdp,label,reports);
    } finally {
        orders = await readOrders();
    }
    const after = westRivalOfficer(world,person), owner = world.realm.playerBelong;
    assert.equal(after.year*12+after.month,before.year*12+before.month+1);
    run.months.push({...after,playerKing:world.realm.playerKing,reports,orders});
    if (owner!==previousOwner) {
        assert.ok(report.phases.some(phase=>phase.name.startsWith(label+'-successor-')), 'The native ruler changed through succession');
        (run.successions??=[]).push({year:after.year,month:after.month,from:previousOwner-1,to:owner-1});
    }
    if (before.belong===previousOwner && after.belong!==owner) {
        assert.ok(after.belong>0 && after.belong<=world.personCount);
        const order = orders.find(o=>[previousOwner,owner].includes(o.before.belong) && o.after.belong===after.belong);
        assert.ok(order,'The native order execution changed the actual officer’s allegiance');
        const declaration = reports.find(r=>r.kind===1 && r.text.includes('南方小鬼') && r.text.includes('被策反成为君主'));
        if (order.orderId===17) assert.ok(declaration,'The original engine announces the new ruler');
        run.defection = {...after,order,declaration};
    }
    return {world,reports};
}

async function prepareWestRivalAttackers(cdp, ctx, run, world) {
    const xiapi = 18, destination = 20, mystic = 183, elite = 8;
    assert.deepEqual([world.cities[xiapi].name,world.cities[destination].name],['下邳','宛城']);
    const travel = run.attackerTravel = {};
    let moveMonth = 0;
    const move = async (person, to, label) => {
        const origin = world.cities.find(city=>city.Belong===world.realm.playerBelong && campaignResidents(world,city.i).includes(person));
        assert.ok(origin,'The actual attacker resides in an owned city');
        if (origin.i===to) return;
        const evidence = travel[label] = {from:origin.i,to,person};
        await moveOriginalCampaignOfficer(ctx,origin.i,to,person,evidence,label,async ()=>{
            const settled = await advanceWestRivalMonth(cdp,ctx,run,world,'west-attacker-month-'+(++moveMonth));
            world = settled.world;
            return {after:await ctx.world(),reports:settled.reports};
        });
    };
    if (world.allPersons[mystic].ArmsType===4) {
        const stock = world.cities[xiapi];
        assert.ok(stock.Belong===world.realm.playerBelong && world.goods.slice(stock.ToolQueue,stock.ToolQueue+stock.Tools).includes(0x8000|31),
            'The original 太玄兵符 is ready in 下邳');
        await move(mystic,xiapi,'west-attacker-to-xiapi');
        run.token = await awardOriginalCampaignMysticToken(ctx,xiapi,mystic);
        world = await evaluate(cdp,worldExpression);
    }
    await move(mystic,destination,'west-mystic-to-wancheng');
    await move(elite,destination,'west-elite-to-wancheng');
    const owner = world.realm.playerBelong;
    const residents = campaignResidents(world,destination);
    assert.equal(world.cities[destination].Belong,owner);
    const party = [];
    for (const [person,name,arm] of [[elite,'吕布',4],[mystic,'通宵虫',5]]) {
        const officer = world.allPersons[person];
        assert.deepEqual([officer.name,officer.Belong,officer.ArmsType],[name,owner,arm]);
        assert.ok(residents.includes(person) && officer.Arms>0);
        assert.equal(await ctx.evaluate(`baye.hd.personArmType(${person})`),arm);
        party.push({person,name,arm,arms:officer.Arms});
    }
    run.attackers = {cityIndex:destination,party};
    run.attackersSave = await saveLiuBeiCheckpoint(cdp,'west-rival-attackers',2,world);
    return world;
}

async function runWestRival(cdp, ctx, world, prior) {
    const person = 184, from = 0, cityIndex = 21;
    const tool = {id:24,name:'绝影'};
    const owner = world.realm.playerBelong;
    const stage = report.transitResume.stage;
    assert.ok(stage==='west-search-ready' || stage.startsWith('west-rival-'), 'Read back a recruited original mystic');
    assert.deepEqual([world.cities[from].name,world.cities[cityIndex].name,world.allPersons[person].name],
        ['西凉','寿春','南方小鬼']);
    const run = report.westRival = {person,from,cityIndex,monthBudget:westTransitMonths,months:[],
        defection:prior?.defection,attackers:prior?.attackers,start:westRivalOfficer(world,person)};
    if (stage==='west-search-ready') {
        assert.deepEqual([run.start.cityIndex,run.start.belong,run.start.arm],[from,owner,5]);
        const links = await ctx.evaluate('baye.hd.realm().cities.map(city=>baye.hd.cityLinks(city.i).map(link=>link.index))');
        run.road = westernOwnedRoads(world,links).get(cityIndex);
        assert.ok(run.road, 'The original 西凉 road reaches 寿春');
        const destination = world.cities[cityIndex];
        assert.ok(world.goods.slice(destination.ToolQueue,destination.ToolQueue+destination.Tools).includes(0x8000|tool.id));
        run.transfer = {};
        let moveMonth = 0;
        await moveOriginalCampaignOfficer(ctx,from,cityIndex,person,run.transfer,'west-rival-transfer',async before=>{
            const reports = [];
            world = await advanceCampaignMonth(cdp,'west-rival-transfer-month-'+(++moveMonth),reports);
            assert.equal(world.year*12+world.month,before.year*12+before.month+1);
            return {after:await ctx.world(),reports};
        });
        const leaders = [world.allPersons[person].name];
        const recruitment = await recruitArmy(cdp,{origin:cityIndex,recruitments:1},'west-rival-troops',leaders);
        const {allocations} = await allocateArmy(cdp,{cityIndex,leaders},'west-rival-troops');
        run.troops = {recruitments:recruitment.recruitments,allocations};
        assert.equal(allocations[0].pind,person);
        run.loyalty = await lowerOriginalCampaignLoyalty(ctx,cityIndex,person,tool);
        world = await evaluate(cdp,worldExpression);
        run.staged = westRivalOfficer(world,person);
        assert.deepEqual([run.staged.cityIndex,run.staged.belong,run.staged.satrap,run.staged.arm,run.staged.loyalty],
            [cityIndex,world.realm.playerBelong,person+1,5,0]);
        assert.equal(run.staged.arms,allocations[0].after);
        if (!westRivalAttackers) run.stagedSave = await saveLiuBeiCheckpoint(cdp,'west-rival-staged',2,world);
    }
    if (westRivalAttackers) world = await prepareWestRivalAttackers(cdp,ctx,run,world);

    for (let month=0; month<=westTransitMonths; month++) {
        const officer = westRivalOfficer(world,person);
        assert.equal(officer.arm,5);
        if (officer.belong===world.realm.playerBelong) {
            assert.deepEqual([officer.cityIndex,officer.satrap,officer.loyalty],[cityIndex,person+1,0]);
            if (westTransitMonths===0) return;
        } else {
            assert.ok(run.defection && officer.belong===run.defection.belong, 'The original rival acquired the mystic');
            if (officer.cityIndex!==undefined && officer.arms>0) {
                assert.equal(await ctx.evaluate(`baye.hd.personArmType(${person})`),5);
                const links = await ctx.evaluate(`baye.hd.cityLinks(${officer.cityIndex}).filter(link=>baye.hd.realm().cities[link.index].owned)`);
                assert.ok(links.length,'At least one owned city can attack the original rival');
                run.rival = {...officer,attackFrom:links.map(link=>link.index)};
                run.readySave = await saveLiuBeiCheckpoint(cdp,'west-rival-ready',1,world);
                return;
            }
        }
        if (month===westTransitMonths) break;
        const settled = await advanceWestRivalMonth(cdp,ctx,run,world,'west-rival-month-'+(month+1));
        world = settled.world;
    }
    run.progressSave = await saveLiuBeiCheckpoint(cdp,'west-rival-progress',1,world);
    assert.fail('The original mystic has not taken the opposing field; resume from the progress save');
}

async function saveRefreshLoad(cdp) {
    const slot=2,captured=report.battles[0].plan.target;
    const before=await evaluate(cdp,worldExpression);
    await openFunctionMenu(cdp,'save');
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    const saveMenu=await campaignRecordMenu(cdp,1);
    await checkpoint(cdp,'save-empty-three-slots');
    assert.equal(await evaluate(cdp,'document.querySelectorAll("#hd-system-ui [data-hd-sys]").length'),3,'fresh profile exposes the three real save buttons');
    assert.ok(saveMenu.slots.every(s=>s.status==='empty'),'fresh profile contains no saved slots');
    // Slot 2 deliberately exercises a sparse file pair (sango4 + sango5).
    const saveKeys=await chooseCampaignRecord(cdp,saveMenu.record,slot);
    report.savedStorage=await evaluate(cdp,`Object.keys(localStorage).filter(k=>/sango[0-7]\\.sav$/.test(k)).sort().map(key=>({key,bytes:(localStorage.getItem(key)||'').length}))`);
    assert.equal(report.savedStorage.length,2,'one real slot creates its two file halves');
    assert.ok(report.savedStorage.every(s=>/sango[45]\.sav/.test(s.key)),'slot 2 maps to native filenames 4 and 5');
    assert.deepEqual(await evaluate(cdp,worldExpression),before,'saving does not mutate campaign state');
    const pair=await campaignSavePair(cdp,slot);
    assert.equal(pair.valid,true);assert.equal(pair.slot.canLoad,true);assert.equal(pair.journal,null);
    assert.deepEqual(pair.metadata[0],pair.metadata[1]);
    assert.equal(pair.metadata[0]['.lib'],'libs/dat-mod.lib');
    assert.equal(pair.metadata[0]['.lib-id'],'v1:414390:1d36da77:1e9c0477');
    const queue=await evaluate(cdp,'Array.from(baye.data.g_PersonsQueue,Number)');
    const verified=verifyOriginalSavePair({...pair,world:{period:before.period,king:before.realm.playerKing,
        year:before.year,month:before.month,people:before.allPersons,cities:before.cities,queue,goodsQueue:before.goods,
        fighters:before.fighters,fighterIndex:before.fighterIndex,orders:before.orders}});
    const saveLoad=report.saveLoad={slot,before,saveKeys,files:verified.files,checked:verified.checked};
    await checkpoint(cdp,'save-real-slot-two');
    if(mobileCampaignInput) {
        await domesticBeforeMarch(cdp,captured);
        assert.equal(report.domestic.after.month,before.month,'The post-save cultivation is in the saved month');
        assert.notDeepEqual(report.domestic.after,before,'Cultivation creates a real unsaved change');
        assert.deepEqual(await campaignSavePair(cdp,slot),pair,'The post-save order leaves the original saved pair intact');
        report.mobileLcdTouches=await evaluate(cdp,'__campaignLcdTouches');
    }
    await archiveEngineInputDocument(cdp,'before-refresh');
    await cdp.send('Page.reload',{ignoreCache:true});
    acknowledgedProgressReports.clear();
    if(mobileCampaignInput) {
        saveLoad.reloaded=await observeMobileCampaignDocument(cdp);
        assert.notEqual(saveLoad.reloaded.documentId,report.engineInputDocuments[0].documentId);
        await waitMobileCampaignSystem(cdp,'title');
    } else {
        const library=await waitForOriginalLibrary(cdp),recorder=await installEngineInputRecorder(cdp);
        saveLoad.reloaded={library,documentId:recorder.documentId};
        assert.notEqual(saveLoad.reloaded.documentId,report.engineInputDocuments[0].documentId);
        await evaluate(cdp,`BayeHdSystemUi.setMode('hd')`);
        for(let i=0;i<20;i++) {
            if(await evaluate(cdp,'baye.hd.menuItems().active&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1'))break;
            if(await evaluate(cdp,'baye.hd.movie().active'))await key(cdp,'Enter');
            else await delay(150);
        }
        await waitFor(cdp,'real refreshed title owner',`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active&&m.context===4&&m.kind===1&&s.open&&s.screen==='title'&&s.input&&!s.pending;})()`,60000);
    }
    assert.deepEqual(await campaignSavePair(cdp,slot),pair,'The saved bytes and metadata persist across a real refresh');
    await checkpoint(cdp,'load-refreshed-title');
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    const loadMenu=await campaignRecordMenu(cdp,2),slots=loadMenu.slots;
    assert.equal(slots.length,4,'load shows every native slot including auto slot');
    assert.deepEqual(slots.map(item=>item.canLoad),[false,false,true,false],'The sparse third slot is independently loadable');
    const rows=saveLoad.loadRows=await evaluate(cdp,`Array.from(document.querySelectorAll('#hd-system-ui [data-hd-sys]'),
        node=>({index:Number(node.dataset.hdSys),disabled:node.disabled,text:node.textContent}))`);
    assert.deepEqual(rows.map(row=>[row.index,row.disabled]),[[0,true],[1,true],[2,false],[3,true]]);
    assert.ok(rows[slot].text.includes(report.selectedLord.name)&&rows[slot].text.replace(/\s/g,'').includes(`${before.year}年${before.month}月`),
        'The visible load row identifies the stored ruler and date');
    await checkpoint(cdp,'load-sparse-four-slots');
    saveLoad.loadKeys=await chooseCampaignRecord(cdp,loadMenu.record,slot);
    if(!mobileCampaignInput)await evaluate(cdp,`(() => {BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd');BayeHdBattle.setMode('hd');})()`);
    await settleToMap(cdp,'load');
    const after=await evaluate(cdp,worldExpression);
    assert.deepEqual(after,before,'refresh and native load restore every city, player general, date and captured ownership');
    assert.deepEqual(await campaignSavePair(cdp,slot),pair,'Loading preserves the original saved pair');
    Object.assign(saveLoad,{after,slots});
    await checkpoint(cdp,'load-restored-campaign');
    const plan=await chooseMarchPair(cdp,false,mobileCampaignInput?captured:null);
    assert.ok(plan,'the loaded army can enter a subsequent legal campaign');
    const generalNames=mobileCampaignInput?[plan.generals[0].name]:plan.generals.map(p=>p.name);
    const march=await dispatchMarch(cdp,plan.origin,plan.target,'load-next',{generalNames,foodBudget:mobileCampaignInput?undefined:10});
    await waitForGameProgress(cdp,'real battle after loading','baye.hd.fight().active&&baye.hd.fight().inputKind===1',60000);
    await checkpoint(cdp,'load-next-battle');
    assertDispatchedArmy(await evaluate(cdp,battleStateExpression),march);
    await retreatBattle(cdp,2);
    if(mobileCampaignInput)await recordBattleResultNote(cdp,'load-next-retreat',{outcome:2,kind:'attack',cityIndex:plan.target});
    await settleToMap(cdp,'load-next-retreat');
    const settled=await evaluate(cdp,worldExpression);
    assert.equal(settled.cities.find(city=>city.i===captured).Belong,settled.realm.playerBelong,'The captured city remains in the player realm after the next campaign, including after native succession');
    assert.equal(settled.fighterIndex[march.order.slot],0,'The next campaign clears its fighter slot after retreat');
    assert.deepEqual(await campaignSavePair(cdp,slot),pair,'Playing after load preserves the explicit saved slot');
    saveLoad.next={plan,march,settled};
    await checkpoint(cdp,'load-next-retreat-map');
}

async function restartSamePage(cdp) {
    const before=await evaluate(cdp,worldExpression),oldSession=await evaluate(cdp,'baye.hd.march().session');
    await openFunctionMenu(cdp,'restart');
    await click(cdp,'#hd-system-ui [data-hd-sys="2"]');
    await waitFor(cdp,'real exit confirmation',`baye.hd.menuItems().active&&baye.hd.menuItems().context===2&&baye.hd.menuItems().kind===2`);
    await checkpoint(cdp,'restart-native-exit-confirm');
    await key(cdp,'Enter');
    await waitFor(cdp,'real same-page title owner',`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active&&m.context===4&&m.kind===1&&s.open&&s.screen==='title'&&!s.pending;})()`,60000);
    await checkpoint(cdp,'restart-real-title');
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    await waitFor(cdp,'real new period owner',`baye.hd.menuItems().active&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===2`);
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    const lordOwner=await waitFor(cdp,'actual second native lord input owner',`(() => {
        const menu=baye.hd.menuItems(),system=BayeHdSystemUi.debugSnapshot(),kings=baye.hd.kings();
        if(!menu.active||menu.context!==4||menu.kind!==3||!kings.count||menu.count!==kings.count||
            !system.open||system.screen!=='king'||system.pending||!system.input||
            system.input.screen!=='king'||system.input.seq!==menu.seq||system.input.context!==4||system.input.kind!==3||
            system.kings.length!==kings.kings.length||!system.kings.every((name,i)=>name===kings.kings[i].name))return false;
        const token='menu:'+menu.seq+':4:3',nodes=[...document.querySelectorAll('#hd-system-ui [data-hd-sys]')];
        if(nodes.length!==kings.count||nodes.some((node,i)=>node.getAttribute('data-hd-sys-owner')!==token||
            Number(node.getAttribute('data-hd-sys'))!==i||!node.textContent.startsWith(kings.kings[i].name)))return false;
        return {menu,system,kings,token};
    })()`);
    await checkpoint(cdp,'restart-native-lord-owner');
    const kings=lordOwner.kings,target=kings.kings.findIndex(k=>k.id===report.selectedLord.id&&k.name===report.selectedLord.name);
    assert.ok(target>=0,'real second game offers the exact originally selected lord');
    const inputStart=await evaluate(cdp,'window.__runtimeEngineInputs.length');
    await click(cdp,'#hd-system-ui [data-hd-sys="'+target+'"][data-hd-sys-owner='+JSON.stringify(lordOwner.token)+']');
    await waitFor(cdp,'actual second new-game map','baye.hd.march().pick===1&&!baye.hd.march().battlePick&&!baye.hd.fight().active',60000);
    const lordInputs=await evaluate(cdp,`window.__runtimeEngineInputs.slice(${inputStart})`);
    assert.equal(lordInputs.filter(input=>input.code===0x27).length,1,'the visible native lord choice sends one acknowledged Enter');
    assert.equal(await evaluate(cdp,'Number(baye.data.g_PlayerKing)'),kings.kings[target].id,'native lord confirmation chooses the exact displayed zero-based person ID');
    await settleToMap(cdp,'restart');
    const after=await evaluate(cdp,worldExpression);
    assert.equal(after.realm.ownedCount,report.campaignBefore.realm.ownedCount,'new game restores original number of cities');
    const originalCampaign=report.battles[0].plan;
    assert.equal(after.cities.find(c=>c.i===originalCampaign.target).Belong,report.campaignBefore.cities.find(c=>c.i===originalCampaign.target).Belong,'new game clears the exact city captured by the original campaign');
    assert.equal(await evaluate(cdp,'baye.hd.fight().over'),0,'new game clears previous battle result');
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),0,'new game leaves no old march phase');
    report.restart={before,after,oldSession,newSession:await evaluate(cdp,'baye.hd.march().session'),lordOwner,lordInputs};
    await checkpoint(cdp,'restart-clean-game-map');
    const march=await dispatchMarch(cdp,originalCampaign.origin,originalCampaign.target,'restart-march',{generalNames:winningFixture.leaders,foodBudget:10});
    await waitForGameProgress(cdp,'new march enters real fresh battle','baye.hd.fight().active&&baye.hd.fight().inputKind===1',60000);
    await checkpoint(cdp,'restart-fresh-battle');
    assertDispatchedArmy(await evaluate(cdp,battleStateExpression),march);
    await retreatBattle(cdp,2);
    await settleToMap(cdp,'restart-next-retreat');
    await checkpoint(cdp,'restart-next-retreat-map');
}
function copySavedCaptiveRun(profile) {
    const resultPath=fs.realpathSync(path.resolve(captiveResumeFlag.slice('--captive-resume='.length)));
    const relative=path.relative(fs.realpathSync(path.join(root,'build')),resultPath);
    assert.ok(!path.isAbsolute(relative)&&!relative.split(path.sep).includes('..')&&path.basename(resultPath)==='result.json');
    const bytes=fs.readFileSync(resultPath),prior=JSON.parse(bytes),origin=prior.isolation;
    const battle=prior.battles?.[0],save=prior.captiveSave;
    assert.ok(prior.scenario==='captives'&&prior.sourceVerification?.ok&&origin?.cleaned&&origin.httpClosed&&
        Number.isInteger(origin.httpPort)&&origin.httpPort>=1024&&origin.httpPort<=65535&&origin.httpPort!==8080);
    assert.ok(prior.battles.length===1&&battle.plan.origin===15&&battle.plan.target===16&&battle.terminal.fight.over===1&&
        prior.actualCaptives.captives.length>0&&save?.slot===0);
    assert.equal(prior.engineManifest.artifacts['baye.wasm'].sha256,report.engineManifest.artifacts['baye.wasm'].sha256);
    assert.deepEqual(save.saved.world,prior.actualCaptives.sample.world);

    const sourceProfile=path.join(path.dirname(resultPath),'private-browser-profile');
    assert.equal(path.relative(sourceProfile,origin.profile),'');
    const storagePath=path.join('Default','Local Storage','leveldb');
    const source=path.join(sourceProfile,storagePath),destination=path.join(profile,storagePath);
    fs.mkdirSync(destination,{recursive:true});
    for(const entry of fs.readdirSync(source,{withFileTypes:true})) {
        if(entry.isFile()&&entry.name!=='LOCK')fs.copyFileSync(path.join(source,entry.name),path.join(destination,entry.name),fs.constants.COPYFILE_EXCL);
    }
    Object.assign(report,{selectedLord:prior.selectedLord,battles:prior.battles,marches:prior.marches,
        actualCaptives:prior.actualCaptives,originalNativeCapacity:prior.originalNativeCapacity,
        captiveSave:{slot:save.slot,files:save.files,saved:save.saved},
        captiveResume:{result:path.relative(root,resultPath),sha256:sha(bytes),port:origin.httpPort}});
    return origin.httpPort;
}

async function mainCaptives(){
    assert.ok(!fs.existsSync(artifactDir),'Use a fresh captive evidence directory without earlier evidence');fs.mkdirSync(artifactDir,{recursive:true});
    let server,chrome,cdp,profile,chromeError,ownership,rootIdentity;const historical=new Map();
    captiveSampleOwned=async label=>{if(!chrome)return;try{const s=await snapshotOwnedChrome(chrome.pid,profile),r=s.owned.find(p=>p.ProcessId===chrome.pid),sameRoot=!rootIdentity||!!r&&r.CreationDate===rootIdentity.CreationDate&&r.ExecutablePath===rootIdentity.ExecutablePath&&r.CommandLine===rootIdentity.CommandLine;fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),...persistCaptiveOwnership(s,sameRoot)})+'\n');if(s.rootVerified&&sameRoot){ownership=s;rootIdentity||=r;for(const p of s.owned)historical.set(p.ProcessId+'|'+p.CreationDate,processIdentity(p));}}catch{fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),error:'Owned sampling failed; previous verified basis retained'})+'\n');}};
    const interrupt=()=>{report.interrupted=true;cdp?.close();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{
        assert.equal(process.platform,'win32','Captive owned-process isolation requires Windows');
        await prepareCaptiveSources();console.log('Frozen',Object.keys(report.sources).length,'sources; engine',report.nativeSourceCheck.aggregate);
        if(preflightOnly){report.ok=true;return;}
        assert.equal(typeof WebSocket,'function','Node 22+ native WebSocket is required');
        profile=path.join(artifactDir,'private-browser-profile');fs.mkdirSync(profile);
        server=await startServer(captiveResumeFlag?copySavedCaptiveRun(profile):0);
        const origin='http://127.0.0.1:'+server.address().port,debugPort=await unusedPort();assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);
        const binary=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(fs.existsSync(binary),'Current explicit Chrome executable exists');
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size=1920,1080','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
        chrome.on('error',e=>chromeError=e);chrome.on('exit',(code,signal)=>{report.chromeExit={code,signal,at:new Date().toISOString()};});
        report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};console.log('Private',JSON.stringify(report.isolation));
        let target;const deadline=Date.now()+15000;
        while(Date.now()<deadline){
            if(report.interrupted)throw Error('Interrupted');if(chromeError)throw chromeError;if(chrome.exitCode!==null||chrome.signalCode!==null)throw Error('Private Chrome exited');
            try{
                const list=await new Promise((resolve,reject)=>{const req=http.get('http://127.0.0.1:'+debugPort+'/json/list',res=>{let body='';res.setEncoding('utf8');res.on('data',part=>{body+=part;if(body.length>1024*1024)req.destroy(Error('CDP endpoint bound exceeded'));});res.on('end',()=>{try{assert.equal(res.statusCode,200);resolve(JSON.parse(body));}catch(e){reject(e);}});});req.setTimeout(1000,()=>req.destroy(Error('CDP endpoint timeout')));req.on('error',reject);});
                target=list.find(i=>i.type==='page');if(target)break;
            }catch(e){report.chromeEndpointProbeError={message:e.message,code:e.code||null,childExit:report.chromeExit||null};}
            await delay(100);
        }
        assert.ok(target,'Private Chrome target '+JSON.stringify(report.chromeEndpointProbeError||null));
        await captiveSampleOwned('launch-before-page');assert.ok(ownership?.rootVerified,'PID birth/executable/exact private profile verified before page');
        report.rootBirth=rootIdentity.CreationDate;report.isolation.rootIdentityVerified=true;report.isolation.rootIdentity=processIdentity(rootIdentity);
        cdp=await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled',e=>report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')}));
        cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening',e=>{report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});
        cdp.on('Fetch.requestPaused',e=>{const local=new URL(e.request.url).origin===origin;if(!local)report.blocked.push(e.request.url);cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');report.browser=await cdp.send('Browser.getVersion');
        await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`
            if(location.pathname==='/pc.html') {
                if(${!captiveResumeFlag})localStorage.clear();
                localStorage.setItem('baye/libpath','libs/dat-mod.lib');
                localStorage.setItem('baye/overworldMode',${JSON.stringify(captiveResumeFlag?'hd-map':'classic')});
                localStorage.setItem('baye/systemUiMode',${JSON.stringify(captiveResumeFlag?'hd':'classic')});
                localStorage.setItem('baye/cityMenuMode',${JSON.stringify(captiveResumeFlag?'hd':'classic')});
            } else if(location.pathname==='/m.html') {
                localStorage.setItem('baye/libpath','libs/dat-mod.lib');
                localStorage.setItem('baye/mobileOverworldMode','hd-map');
                localStorage.setItem('baye/mobileCityMenuMode','hd');
                localStorage.setItem('baye/mobileSystemUiMode','hd');
            }
        `});
        if(captiveResumeFlag) {
            await exerciseCaptiveSelection(cdp,await loadCaptiveWorld(cdp,origin));
        } else {
            report.viewport={width:captiveWidth,height:captiveWidth===1280?720:1080};
            await cdp.send('Emulation.setDeviceMetricsOverride',{...report.viewport,deviceScaleFactor:1,mobile:false});
            await cdp.send('Page.navigate',{url:origin+'/pc.html'});
            await smoke(cdp);
        }
        await archiveEngineInputDocument(cdp,'completed');
        assert.deepEqual(report.exceptions,[],'No uncaught browser exceptions');assert.deepEqual(report.dialogs,[],'No unexpected game dialogs');assert.deepEqual(report.requests.filter(r=>r.status>=400&&!r.expected),[],'Every requested game asset is frozen and available');
        report.captiveAccepted=report.personCaptivesAccepted===true;report.ok=report.accepted===true&&report.hdAccepted===true&&report.personCaptivesAccepted===true&&(!captiveOrder||report.captiveOrderAccepted===true);
        if(!report.ok)process.exitCode=1;
    }catch(e){
        report.ok=false;report.error=e.stack||String(e);console.error(report.error);process.exitCode=1;
        if(cdp){try{report.failureState=await evaluate(cdp,snapshotExpression);}catch{}try{report.failureSample=await evaluate(cdp,'window.__identitySample?__identitySample():null');}catch{}try{await archiveEngineInputDocument(cdp,'failure');}catch(error){report.engineInputCollectionError=error.message||String(error);}try{const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(png.data,'base64'),{flag:'wx'});}catch{}}
    }finally{
        process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await captiveSampleOwned('before-cleanup');
        if(cdp&&ownership?.rootVerified){try{await cdp.send('Browser.close');report.gracefulBrowserClose=true;}catch{report.gracefulBrowserClose=false;}await delay(750);}cdp?.close();
        if(ownership?.rootVerified){try{const p=await cleanupOwnedChrome(ownership);report.cleanup=persistCaptiveCleanup(p,ownership);if(!p.treeExited){report.ok=false;process.exitCode=1;}}catch{report.cleanup={treeExited:false,error:'Owned cleanup failed; private profile retained'};report.ok=false;process.exitCode=1;}}
        else if(chrome){report.cleanup={treeExited:false,error:'No verified ownership basis; broad stop refused'};report.ok=false;process.exitCode=1;}
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        report.serverClosed=!server||!server.listening;report.historicalRecordedIdentities=[...historical.values()];report.profileRetained=!!profile&&fs.existsSync(profile);report.directoriesDeleted=false;
        report.sourceVerification=verifyCaptiveSources();report.isolation={...report.isolation,cleaned:!chrome||report.cleanup?.treeExited===true,chromeExited:!chrome||report.cleanup?.treeExited===true,profileRetained:report.profileRetained,directoriesDeleted:false,httpClosed:!server||!server.listening,serverClosed:!server||!server.listening,user8080Touched:false};
        if(!report.sourceVerification.ok||!report.isolation.cleaned||!report.isolation.httpClosed){report.ok=false;process.exitCode=1;}
        for(const flag of ['accepted','identityAccepted','hdAccepted','captiveAccepted','personCaptivesAccepted'])report[flag]=report.ok===true&&report[flag]===true;
        if(captiveOrder)report.captiveOrderAccepted=report.ok===true&&report.captiveOrderAccepted===true;
        report.finishedAt=new Date().toISOString();for(const [name,value] of [['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])writeJsonAtomicSync(path.join(artifactDir,name),value);
        console.log('Finished',JSON.stringify({ok:report.ok,accepted:report.accepted,personCaptivesAccepted:report.personCaptivesAccepted,checkpoints:report.phases.length,sources:report.sourceVerification.count,artifactDir}));
    }
}

async function main() {
    if(captiveScenario)return mainCaptives();
    if (liuBeiTransit) {
        assert.ok(!fs.existsSync(path.join(artifactDir,'result.json')),'Use a new directory for original campaign evidence');
        report.runnerSha256 = sha(fs.readFileSync(fileURLToPath(import.meta.url)));
        const source = 'scripts/hd-reward-token-runtime-checks.mjs', bytes = fs.readFileSync(path.join(root,source));
        report.sources[source] = {source,bytes:bytes.length,sha256:sha(bytes)};
        if (westTransit) {
            const dependencies = ['hd-mobile-system-runtime-oracle','hd-city-person-navigation-checks'];
            if (westRival) dependencies.push('hd-mobile-equipment-runtime-oracle');
            for (const dependency of dependencies) {
                const source = 'scripts/'+dependency+'.mjs', bytes = fs.readFileSync(path.join(root,source));
                report.sources[source] = {source,bytes:bytes.length,sha256:sha(bytes)};
            }
        }
    }
    fs.mkdirSync(artifactDir, { recursive: true });
    if (typeof WebSocket !== 'function') throw new Error('Node 22+ is required for built-in WebSocket');
    if (staged) for (const filename of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.ok(fs.existsSync(path.join(root, 'build/wasm/src', filename)), 'Missing staged WASM file: ' + filename);
    }
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'baye-campaign-runtime-'));
    let server, chrome, cdp, chromeError;
    const interrupt = () => {
        report.interrupted = true;
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) chrome.kill('SIGTERM');
        if (server) server.closeAllConnections();
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
        server = await startServer();
        const origin = 'http://127.0.0.1:' + server.address().port;
        const debugPort = await unusedPort();
        if (liuBeiTransit) {
            assert.notEqual(server.address().port,8080);
            assert.notEqual(debugPort,8080);
            report.isolation = {httpPort:server.address().port,debugPort,profile,user8080Touched:false};
        }
        const candidates = ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
        const binary = process.env.CHROME || candidates.find((filename) => fs.existsSync(filename));
        assert.ok(binary, 'Set CHROME to a Chromium/Chrome executable');
        chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
            '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows', '--window-size=1920,1080', '--remote-debugging-port=' + debugPort,
            '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
        chrome.on('error', (error) => { chromeError = error; });
        let target;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (chromeError) throw chromeError;
            if (chrome.exitCode !== null) throw new Error('Chrome exited with ' + chrome.exitCode);
            try {
                const list = await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) }).then((res) => res.json());
                target = list.find((item) => item.type === 'page');
                if (target) break;
            } catch {}
            await delay(100);
        }
        assert.ok(target, 'Chrome DevTools started');
        cdp = await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled', (event) => {
            report.console.push({ type: event.type, text: event.args.map((arg) => arg.value ?? arg.description ?? '').join(' ') });
            if (report.console.length > 100) report.console.shift();
        });
        cdp.on('Runtime.exceptionThrown', (event) => report.exceptions.push(event.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening', (event) => {
            report.dialogs.push(event.message);
            cdp.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
        });
        cdp.on('Fetch.requestPaused', (event) => {
            const url=new URL(event.request.url),local=url.origin===origin;
            const missing=local&&missingOpeningStatusArt&&url.pathname==='/assets/hd-spe/status-27/picture-6.png';
            if(!local)report.blocked.push(event.request.url);
            if(missing)(report.missingOpeningStatusRequests??=[]).push(url.pathname);
            const allowed=local&&!missing;
            cdp.send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId: event.requestId } :
                { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
        });
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
            if (!sessionStorage.getItem('campaign-profile-initialized')) {
                localStorage.clear();
                sessionStorage.setItem('campaign-profile-initialized', '1');
            }
            localStorage.setItem('baye/libpath', 'libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode', 'classic');
            localStorage.setItem('baye/systemUiMode', 'classic');
            localStorage.setItem('baye/cityMenuMode', 'classic');
        ` });
        if(mobileCampaignWidth) {
            const viewport=report.mobileViewport={width:mobileCampaignWidth,height:mobileCampaignWidth===667?375:390};
            await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true,
                screenOrientation:{type:'landscapePrimary',angle:90}});
            await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
            report.browser=await cdp.send('Browser.getVersion');
            mobileCampaignInput=createMobileCampaignInputs({evaluate:source=>evaluate(cdp,source),
                until:(label,source,timeout)=>waitFor(cdp,label,source,timeout),
                touch:(type,points)=>captiveTouch(cdp,type,points),tap:point=>captiveTap(cdp,point),report});
            await cdp.send('Page.navigate',{url:origin+'/m.html#'+Math.floor(Date.now()/1000)});
            await smokeMobileCampaign(cdp);
        } else {
            await cdp.send('Page.navigate', { url: origin + '/pc.html' });
            await smoke(cdp);
        }
        await archiveEngineInputDocument(cdp,'completed');
        assert.deepEqual(report.exceptions, [], 'browser has no uncaught exceptions');
        assert.deepEqual(report.dialogs, [], 'game boot has no unexpected alert dialogs');
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = error.stack || String(error);
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression); } catch {}
            try { await archiveEngineInputDocument(cdp,'failure'); } catch (inputError) { report.engineInputCollectionError=inputError.message||String(inputError); }
            try { report.battleKeys=await evaluate(cdp,'window.__battleKeys'); } catch {}
            try { report.failureWorld=await evaluate(cdp,worldExpression); } catch (worldError) { report.failureWorldError=worldError.message||String(worldError); }
            try {
                const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                fs.writeFileSync(path.join(artifactDir, 'failure.png'), Buffer.from(screenshot.data, 'base64'));
            } catch {}
        }
        console.error(report.error);
        process.exitCode = 1;
    } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) {
            const stopped = new Promise((resolve) => chrome.once('exit', resolve));
            chrome.kill('SIGTERM');
            await Promise.race([stopped, delay(1500)]);
            if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([stopped, delay(1500)]); }
        }
        if (server) await new Promise((resolve) => server.close(resolve));
        // Chromium children may briefly finish profile writes after the parent exits.
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        if (liuBeiTransit) {
            const drift = Object.entries(report.sources).filter(([,m]) => {
                const filename = path.join(root,m.source);
                return !fs.existsSync(filename) || sha(fs.readFileSync(filename)) !== m.sha256;
            }).map(([name]) => name).concat(report.changedResponses ?? []);
            const runnerMatch = report.runnerSha256 === sha(fs.readFileSync(fileURLToPath(import.meta.url)));
            report.sourceVerification = {count:Object.keys(report.sources).length,drift,runnerMatch};
            report.isolation = {...report.isolation,cleaned:!fs.existsSync(profile)};
            if (drift.length || !runnerMatch) {
                report.ok = false;
                process.exitCode = 1;
            }
        }
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Real LIB/WASM campaign browser acceptance passed: ' + scenario);
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
