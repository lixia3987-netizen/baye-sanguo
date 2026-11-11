import assert from 'node:assert/strict';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';

const settingRows = [[2, 'movie'], [3, 'speed'], [4, 'enemy']];
const optionsSource = '({movie:baye.data.g_LookMovie,speed:baye.data.g_MoveSpeed,enemy:baye.data.g_LookEnemy})';
const systemRow = index => '#hd-system-ui [data-hd-sys="' + index + '"]';
const selectionKeys = (from, to) => [...Array(Math.abs(to - from)).fill(to < from ? 34 : 35), 39];

export async function runMobileBattleSettingsSaveChecks(c) {
  const {report,evaluate,until,checkpoint,button,buttonPoint,tap,readKeys,worldSource,mapReadySource,
    sendCdp,observeInputs,waitTitle,native,ready,menu,recordHud,startMarch,initial} = c;
  const width = report.battleSettingsSaveWidth;
  // The two runs distinguish the three stored fields and change each from its default at least once.
  const expected = width === 667 ? {movie:0,speed:1,enemy:0} : {movie:1,speed:0,enemy:0};
  const scenario = report.battleSettingsRoundtrip = {expected,changes:[],pageInputs:[]};
  const hudOptions = {settings:true,mobileFocus:true};
  const capture = label => checkpoint('battle-options-' + width + '-' + label);
  const codes = async offset => (await readKeys(offset)).map(key => key.code);
  const pageInputs = () => evaluate('({keys:__mobileMapKeys,touches:__mobileMapNativeTouches,events:__mobileMapEvents})');
  const options = () => evaluate(optionsSource);
  const identity = () => evaluate('BayeHdLibIdentity.read()');
  const world = () => evaluate(worldSource);
  const openBattleSystem = async label => {
    const before = await native();
    await button('[data-hd-battle-sys]');
    const after = await ready(6,label);
    assert.deepEqual(await codes(before.keys),[40]);
    return after;
  };
  const chooseBattleRow = async (index,label,kind) => {
    const before = await native();
    assert.equal(before.menu.active,1);
    await menu(index,label);
    if(kind !== undefined) await ready(kind,label);
    assert.deepEqual(await codes(before.keys),selectionKeys(before.menu.index,index),label);
  };
  const cancelSetting = async label => {
    const before = await native();
    await button('[data-hd-battle-cancel]');
    await ready(6,label);
    assert.deepEqual(await codes(before.keys),[40]);
  };

  assert.equal(initial.fight.cityIndex,9);
  assert.deepEqual(initial.settings,{movie:1,speed:1,enemy:1});
  await openBattleSystem('First original battle SYSTEM');
  const values = {...initial.settings};
  await recordHud('First original battle defaults',hudOptions);
  for(const [index,field] of settingRows) {
    await chooseBattleRow(index,'Open original '+field,8);
    const selector = await recordHud('Original '+field+' selector',hudOptions);
    assert.equal(selector.menu.index,values[field]);
    if(values[field] === expected[field]) {
      await cancelSetting('Keep original '+field);
    } else {
      await chooseBattleRow(expected[field],'Confirm original '+field,6);
      values[field] = expected[field];
    }
    const system = await recordHud('First battle '+field+' applied',hudOptions);
    assert.deepEqual(system.native.settings,values);
    scenario.changes.push({field,before:selector.native.settings[field],after:values[field]});
  }
  await capture('changed-settings');
  assert.deepEqual(await options(),expected);
  const battle = await evaluate('({generation:baye.data.g_hdDetailGeneration,city:baye.hd.fight().cityIndex,mode:baye.data.g_FgtParam.Mode})');
  await evaluate("window.__settingsSettlement=[];window.addEventListener('baye-hd-battle-settled',e=>__settingsSettlement.push({...e.detail}));true");
  await chooseBattleRow(1,'Request original retreat',7);
  await chooseBattleRow(0,'Confirm original retreat');
  await until('Original retreat and month return to strategy',mapReadySource,120000);
  const settlements = await evaluate('__settingsSettlement');
  scenario.retreat = settlements.filter(s=>s.generation===battle.generation&&s.city===battle.city&&s.mode===battle.mode);
  assert.equal(scenario.retreat.length,1,'One native settlement for this expedition');
  assert.equal(scenario.retreat[0].over,2);
  assert.deepEqual(await options(),expected,'Battle options survive the real strategy return');
  const afterRetreat = await world();
  assert.equal(afterRetreat.king,5,'The original ruler stayed at home');
  assert.equal(afterRetreat.orders[report.battleMarchVerdict.orderIndex].OrderId,255);

  const systemReady = screen => until('Current mobile HD '+screen,`(() => {
    const s=BayeHdSystemUi.debugSnapshot(),h=BayeHdMobileSystem.snapshot();
    return h.active&&s.open&&s.showHd&&!s.pending&&s.screen===${JSON.stringify(screen)}&&s.input;
  })()`);
  const chooseSystemRow = async (index,wait) => {
    const before = await evaluate('({input:BayeHdSystemUi.debugSnapshot().input,keys:__mobileMapKeys.length})');
    assert.ok(before.input);
    const point = await buttonPoint(systemRow(index));
    assert.ok(point.width>=44&&point.height>=44);
    await tap(point);
    await wait();
    assert.deepEqual(await codes(before.keys),selectionKeys(before.input.index,index));
  };
  const pair = () => evaluate(`(() => {
    const paths=['baye//data//sango0.sav','baye//data//sango1.sav'];
    const [sav0,sav1]=paths.map(path=>BayeSaveStorage.readFile(path));
    return {sav0,sav1,valid:BayeSaveStorage.validatePair(sav0,sav1),slot:BayeSaveStorage.inspectSlot(0),
      journal:localStorage.getItem('baye/save-transaction/0'),
      identities:paths.map(path=>BayeSaveStorage.readMetadata(path+'.lib-id'))};
  })()`);
  const verifySave = (raw,currentWorld) => {
    const {decoded,files,checked} = verifyOriginalSavePair({...raw,world:currentWorld});
    const {lookMovie,moveSpeed,lookEnemy} = decoded.header;
    assert.deepEqual({movie:lookMovie,speed:moveSpeed,enemy:lookEnemy},expected,'Options in the original binary save header');
    return {header:decoded.header,files,checked};
  };
  const openKeyOffset = await evaluate('__mobileMapKeys.length');
  await button('#hd-mobile-system-open');
  await systemReady('insystem');
  assert.deepEqual(await codes(openKeyOffset),[40]);
  await chooseSystemRow(1,()=>systemReady('saveload'));
  const saveOwner = await evaluate('baye.hd.record()');
  assert.equal(saveOwner.mode,1);assert.equal(saveOwner.count,3);
  await capture('save-slot');
  await chooseSystemRow(0,()=>until('Original SAVE returned to strategy',mapReadySource));
  const saved = await world(), raw = await pair(), original = await identity();
  assert.deepEqual(saved,afterRetreat);
  assert.equal(raw.valid,true);assert.equal(raw.slot.canLoad,true);assert.equal(raw.journal,null);
  assert.deepEqual(raw.identities,['v1:414390:1d36da77:1e9c0477','v1:414390:1d36da77:1e9c0477']);
  scenario.saved = {raw,proof:verifySave(raw,saved)};
  scenario.pageInputs.push(await pageInputs());

  const oldPage = await evaluate('performance.timeOrigin');
  await sendCdp('Page.reload',{ignoreCache:true});
  await until('Fresh browser document and original engine',`performance.timeOrigin!==${oldPage}&&window.baye&&baye.hd&&baye.hd.ready()`,60000);
  await observeInputs();
  await waitTitle();
  await systemReady('title');
  assert.deepEqual(await pair(),raw,'Reload leaves both native save halves and slot metadata intact');
  scenario.beforeLoad = await options();
  assert.notDeepEqual(scenario.beforeLoad,expected,'The fresh page has not already restored the saved options');
  await chooseSystemRow(1,()=>systemReady('saveload'));
  const loadOwner = await evaluate('baye.hd.record()');
  assert.equal(loadOwner.mode,2);assert.equal(loadOwner.count,4);
  await capture('load-slot');
  await chooseSystemRow(0,()=>until('Original LOAD returned to strategy',mapReadySource));
  const loaded = await world(), restoredIdentity = await identity();
  assert.equal(restoredIdentity.status,'ready');
  assert.equal(restoredIdentity.sha256,original.sha256);
  assert.deepEqual(await options(),expected,'Native LOAD restores the exact saved options');
  assert.deepEqual(await pair(),raw,'Native LOAD leaves the save pair intact');
  scenario.loaded = {options:await options(),proof:verifySave(raw,loaded)};

  scenario.secondMarch = await startMarch({single:true});
  const second = await ready(1,'Actual second expedition after native load');
  assert.equal(second.fight.cityIndex,9);assert.equal(second.fight.bout,1);
  assert.deepEqual(second.settings,expected);
  await openBattleSystem('Second original battle SYSTEM');
  scenario.secondSystem = await recordHud('Restored original options in the second battle',hudOptions);
  for(const [index,field] of settingRows) {
    await chooseBattleRow(index,'Reopen restored '+field,8);
    const selector = await recordHud('Restored '+field+' selector',hudOptions);
    assert.equal(selector.menu.index,expected[field],'The native selector opens on its restored value');
    await cancelSetting('Return from restored '+field);
  }
  await capture('restored-settings');
  assert.deepEqual(await options(),expected);
  assert.deepEqual(await pair(),raw);
  scenario.pageInputs.push(await pageInputs());
  report.nativeKeys = scenario.pageInputs.flatMap(page=>page.keys);
  report.nativeTouches = scenario.pageInputs.flatMap(page=>page.touches);
  report.trustedEvents = scenario.pageInputs.flatMap(page=>page.events);
  assert.equal(report.nativeTouches.length,0);
  assert.equal(report.exceptions.length,0);
  report.battleSettingsSaveAccepted = true;
  report.battleAccepted = true;
  report.ok = true;
  report.accepted = true;
  report.acceptedScope = ['Actual HD system row values and native setting confirmations',
    'Original retreat, strategy SAVE, refreshed browser title and native LOAD with the same original save pair',
    'Original second battle and the three restored selector indices'];
}
