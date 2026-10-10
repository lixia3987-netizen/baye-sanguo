// Controlled native ABI/DOM VM fixtures only; no native C, browser, touch or OS execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const source = readFileSync(new URL('../js/hd-mobile.js', import.meta.url), 'utf8');
const dictionary = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
const sha = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const counts = {ready: 0, bind: 0, cityName: 0, personName: 0, input: 0, writes: 0};
    const data = {
        g_hdEngineReady: 1, g_hdMapPick: 1, g_hdMapCity: 17, g_hdMapInputSeq: 8,
        g_hdDetailGeneration: 4, g_hdSpeGeneration: 4, g_hdBattlePick: 0, g_hdMarchPhase: 0,
        g_hdMenuActive: 0, g_hdReportActive: 0, g_hdQtyActive: 0, g_hdFightActive: 0,
        g_hdHelpActive: 0, g_hdRecordActive: 0, g_hdMovieActive: 0, g_hdSpeActive: 0,
        g_hdSkillActive: 0, g_hdAttackActive: 0, g_hdSkillResultActive: 0, g_hdMakerActive: 0,
        g_hdViewActive: 0, g_hdMiniMapActive: 0, g_hdGoodsActive: 0, g_hdPersonPropertiesActive: 0,
        g_hdResultOwnerKind: 0, g_hdResultOwnerValid: 0, g_hdMenuSeq: 12, g_hdReportSeq: 3,
        g_hdReportInputSeq: 6, g_hdQtySession: 4, g_hdQtyInputSeq: 2, g_hdFightInputSeq: 20,
        g_hdHelpInputSeq: 3, g_hdRecordSeq: 2, g_hdMarchSession: 5, g_hdMarchInputSeq: 11,
        g_PIdx: 4, g_YearDate: 236, g_MonthDate: 6,
        g_Cities: Array.from({length: 38}, (_, i) => ({Belong: i === 16 ? 1 : 0, Money: 0, Food: 0, MothballArms: 0})),
        g_Persons: Array.from({length: 2000}, () => ({Arms: 999}))
    };
    Object.assign(data.g_Cities[16], {Money: 2287, Food: 1115, MothballArms: 8680});
    let identity = {status: 'ready', generation: 2, sha256: sha, byteLength: dictionary.length, reason: ''};
    let isCurrent = true, engineReady = true;
    const subscribers = [], listeners = new Map(), timers = new Map(), elements = new Map();
    for (const id of ['hd-mobile-bar', 'hd-mobile-hud', 'hd-mobile-status', 'hd-mobile-city', 'hd-mobile-owner',
        'hd-mobile-date', 'hd-mobile-money', 'hd-mobile-food', 'hd-mobile-arms']) elements.set(id, {hidden: false, textContent: 'stale'});
    const document = {hidden: false, getElementById: id => elements.get(id) || null,
        addEventListener(name, callback) { const list = listeners.get(name) || []; list.push(callback); listeners.set(name, list); }};
    const window = {document, BayeHdLibIdentity: {
        read: () => identity, isCurrent: candidate => isCurrent && candidate.generation === identity.generation &&
            candidate.status === identity.status && candidate.sha256 === identity.sha256,
        subscribe(callback) { subscribers.push(callback); return () => subscribers.splice(subscribers.indexOf(callback), 1); }
    }, setInterval(fn, ms) { const id = timers.size + 1; timers.set(id, {fn, ms}); return id; },
    clearInterval(id) { timers.delete(id); },
    localStorage: new Proxy({}, {get() { throw new Error('storage read forbidden'); }, set() { throw new Error('storage write forbidden'); }}),
    baye: {data, hd: {ready() { counts.ready++; return engineReady; }},
        ensureData() { counts.bind++; return window.baye.data; },
        getCityName(index) { counts.cityName++; assert.equal(index, data.g_hdMapCity - 1); return index === 16 ? '许昌' : '巴郡'; },
        getPersonName(index) { counts.personName++; assert.equal(index, data.g_Cities[data.g_hdMapCity - 1].Belong - 1); return index === 0 ? '曹丕' : '刘璋'; },
        sendKey() { counts.input++; throw new Error('input forbidden'); }, clearScreen() { throw new Error('native drawing forbidden'); }}
    };
    vm.runInNewContext(source, {window});
    return {window, api: window.BayeHdMobile, data, counts, document, elements, timers, listeners,
        setIdentity(value) { identity = {...identity, ...value}; }, setCurrent(value) { isCurrent = value; },
        setReady(value) { engineReady = value; }, notifyIdentity() { subscribers.slice().forEach(fn => fn(identity)); },
        visibility(hidden) { document.hidden = hidden; for (const fn of listeners.get('visibilitychange') || []) fn(); }};
}
function hidden(f) {
    const value = f.api.refresh();
    assert.equal(value.visible, false);
    assert.equal(f.elements.get('hd-mobile-hud').hidden, true);
    assert.equal(f.elements.get('hd-mobile-status').textContent, '原版游戏');
    assert.equal(f.elements.get('hd-mobile-bar').hidden, false);
    for (const field of ['city', 'owner', 'date', 'money', 'food', 'arms']) assert.equal(f.elements.get('hd-mobile-' + field).textContent, '');
    return value;
}

test('verified original dictionary current map uses one-based city/owner and actual reserve troops', () => {
    assert.equal(dictionary.length, 207195);
    assert.equal(createHash('sha256').update(dictionary).digest('hex'), sha);
    const f = fixture(), value = f.api.init();
    assert.deepEqual(plain(value), {visible: true, status: '原版游戏', reason: '', cityIndex: 16, city: '许昌', owner: '曹丕',
        date: '236年6月', money: '2287', food: '1115', arms: '8680',
        ticket: {libraryGeneration: 2, generation: 4, speGeneration: 4, mapInputSeq: 8, mapCity: 17}});
    assert.equal(f.elements.get('hd-mobile-hud').hidden, false);
    assert.equal(f.elements.get('hd-mobile-arms').textContent, '8680');
    assert.equal(f.counts.input, 0);
});

test('native 2000-slot person capacity is not a HUD data dependency', () => {
    const f = fixture(), persons = f.data.g_Persons;
    assert.equal(persons.length, 2000);
    let reads = 0;
    Object.defineProperty(f.data, 'g_Persons', {get() { reads++; return persons; }});
    assert.equal(f.api.refresh().visible, true);
    assert.equal(reads, 0);
});

test('zero resources and unowned city are legitimate, without a ruler name call', () => {
    const f = fixture(); Object.assign(f.data.g_Cities[16], {Belong: 0, Money: 0, Food: 0, MothballArms: 0});
    const value = f.api.refresh();
    assert.equal(value.visible, true); assert.equal(value.owner, '无主');
    assert.equal(value.money, '0'); assert.equal(value.food, '0'); assert.equal(value.arms, '0');
    assert.equal(f.counts.personName, 0);
});

test('U16 maximum resources and full native year survive a long campaign', () => {
    const f = fixture(); Object.assign(f.data.g_Cities[16], {Money: 65535, Food: 65535, MothballArms: 65535, Belong: 200});
    f.data.g_YearDate = 65535; f.data.g_MonthDate = 12;
    const value = f.api.refresh();
    assert.equal(value.visible, true); assert.equal(value.date, '65535年12月'); assert.equal(value.arms, '65535');
});

for (const state of [{status: 'pending'}, {status: 'error'}, {sha256: '0'.repeat(64)}, {byteLength: 1}, {generation: 0}]) {
    test('unverified library never binds native data: ' + JSON.stringify(state), () => {
        const f = fixture(); f.setIdentity(state); hidden(f);
        assert.equal(f.counts.ready, 0); assert.equal(f.counts.bind, 0); assert.equal(f.counts.cityName, 0);
    });
}
test('a stale digest is rejected before native binding', () => {
    const f = fixture(); f.setCurrent(false); hidden(f); assert.equal(f.counts.ready, 0); assert.equal(f.counts.bind, 0);
});
test('ready false never binds the data object', () => {
    const f = fixture(); f.setReady(false); hidden(f); assert.equal(f.counts.bind, 0);
});

for (const key of ['g_hdBattlePick', 'g_hdMenuActive', 'g_hdReportActive', 'g_hdQtyActive', 'g_hdFightActive',
    'g_hdHelpActive', 'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive', 'g_hdAttackActive',
    'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdGoodsActive',
    'g_hdPersonPropertiesActive', 'g_hdResultOwnerKind', 'g_hdResultOwnerValid', 'g_hdMarchPhase']) {
    test('current native owner blocks the city HUD: ' + key, () => {
        const f = fixture(); assert.equal(f.api.refresh().visible, true); f.data[key] = 1; hidden(f);
    });
}
for (const [key, value] of [['g_hdMapPick', 0], ['g_hdMapCity', 0], ['g_hdMapCity', 39], ['g_hdMapInputSeq', 0],
    ['g_hdDetailGeneration', 0], ['g_hdSpeGeneration', 0], ['g_hdEngineReady', 0], ['g_PIdx', 0]]) {
    test('unknown/stale map ticket fails closed: ' + key + '=' + value, () => {
        const f = fixture(); f.data[key] = value; hidden(f); assert.equal(f.counts.cityName, 0);
    });
}

test('missing owner field cannot be inferred as zero', () => {
    const f = fixture(); delete f.data.g_hdQtyActive; hidden(f);
});
for (const [field, value] of [['Money', -1], ['Food', 65536], ['MothballArms', NaN], ['Money', '5'], ['Food', null], ['Belong', 65535]]) {
    test('invalid native field is not coerced: ' + field + '=' + String(value), () => {
        const f = fixture(); f.data.g_Cities[16][field] = value; hidden(f);
    });
}
for (const [field, value] of [['g_YearDate', 65536], ['g_MonthDate', 0], ['g_MonthDate', 13], ['g_YearDate', 236.5]]) {
    test('invalid native date is rejected: ' + field + '=' + value, () => {
        const f = fixture(); f.data[field] = value; hidden(f);
    });
}

test('name call owner handoff clears all previously displayed fields', () => {
    const f = fixture(); f.api.init(); f.window.baye.getCityName = () => { f.data.g_hdMenuActive = 1; return '旧城'; };
    hidden(f); assert.equal(f.counts.personName, 1);
});
test('name call generation handoff is rejected even if map and names remain unchanged', () => {
    const f = fixture(); f.window.baye.getPersonName = () => { f.data.g_hdDetailGeneration++; return '曹丕'; }; hidden(f);
});
test('name call LIB replacement retires the original reading', () => {
    const f = fixture(); f.window.baye.getCityName = () => { f.setIdentity({generation: 3}); return '许昌'; }; hidden(f);
});
test('name call city resources changing causes a torn-read rejection', () => {
    const f = fixture(); f.window.baye.getPersonName = () => { f.data.g_Cities[16].Food--; return '曹丕'; }; hidden(f);
});
test('name call data rebinding never mixes old city and new world', () => {
    const f = fixture(); f.window.baye.getCityName = () => { f.window.baye.data = {...f.data}; return '许昌'; }; hidden(f);
});
test('name call map input sequence change fails closed', () => {
    const f = fixture(); f.window.baye.getCityName = () => { f.data.g_hdMapInputSeq++; return '许昌'; }; hidden(f);
});
test('a resource getter changing after its initial read cannot publish mixed fields', () => {
    const f = fixture(); let reads = 0;
    Object.defineProperty(f.data.g_Cities[16], 'Money', {get() { return ++reads === 1 ? 10 : 11; }}); hidden(f);
});
test('unavailable or invalid names do not display a partial city', () => {
    for (const name of ['', '-', 'bad\u0000name']) {
        const f = fixture(); f.window.baye.getCityName = () => name; hidden(f);
    }
});

test('mounting is idempotent, uses one 80ms timer and pauses immediately while hidden', () => {
    const f = fixture(); f.api.init(); f.api.init();
    assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].ms, 80);
    assert.equal(f.listeners.get('visibilitychange').length, 1);
    const count = f.counts.ready; f.visibility(true); hidden(f);
    assert.equal(f.timers.size, 0); assert.equal(f.counts.ready, count);
    f.visibility(false); assert.equal(f.api.snapshot().visible, true); assert.equal(f.timers.size, 1);
});
test('initial hidden document does not bind native data or start polling', () => {
    const f = fixture(); f.document.hidden = true; f.api.init(); hidden(f);
    assert.equal(f.counts.ready, 0); assert.equal(f.counts.bind, 0); assert.equal(f.timers.size, 0);
});
test('identity notifications retire a visible HUD without waiting for the next timer', () => {
    const f = fixture(); f.api.init(); f.setIdentity({status: 'pending', sha256: null, generation: 3}); f.notifyIdentity();
    assert.equal(f.api.snapshot().visible, false); assert.equal(f.elements.get('hd-mobile-city').textContent, '');
});
test('snapshot is immutable and does not perform native or storage reads', () => {
    const f = fixture(); const first = f.api.init(), counts = {...f.counts};
    assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first.ticket), true);
    assert.equal(f.api.snapshot(), first); assert.deepEqual(f.counts, counts);
});
test('pure model and sampler agree and preserve native data without input or writes', () => {
    const f = fixture(), before = JSON.stringify(f.data);
    for (const city of f.data.g_Cities) Object.freeze(city);
    Object.freeze(f.data.g_Cities); Object.freeze(f.data.g_Persons); Object.freeze(f.data);
    assert.equal(f.api.sample(f.window).visible, true);
    assert.equal(f.api.model({}).visible, false);
    for (let i = 0; i < 20; i++) assert.equal(f.api.refresh().visible, true);
    assert.equal(JSON.stringify(f.data), before); assert.equal(f.counts.input, 0);
});
test('missing UI nodes do not prevent safe sampling or create any nodes', () => {
    const f = fixture(); f.elements.clear(); assert.equal(f.api.init().visible, true); assert.equal(f.elements.size, 0);
});
