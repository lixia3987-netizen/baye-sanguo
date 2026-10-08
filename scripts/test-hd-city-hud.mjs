#!/usr/bin/env node
/** Read-only city/person HUD rendered from real native menu contracts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const standardHash = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const plain = value => JSON.parse(JSON.stringify(value));
function element(tagName = 'div') {
    const attrs = new Map(), classes = new Set(), listeners = new Map();
    let ownText = '';
    const item = { tagName: tagName.toUpperCase(), attrs, listeners, children: [], style: {}, hidden: false,
        parentElement: null, parentNode: null, scrollCalls: 0,
        setAttribute(key, value) { attrs.set(key, String(value)); },
        getAttribute(key) { return attrs.get(key) ?? null; },
        appendChild(child) {
            if (child.parentElement) child.parentElement.removeChild(child);
            this.children.push(child); child.parentElement = child.parentNode = this; return child;
        },
        removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentElement = child.parentNode = null; },
        insertBefore(child, other) {
            if (child.parentElement) child.parentElement.removeChild(child);
            this.children.splice(this.children.indexOf(other), 0, child); child.parentElement = child.parentNode = this;
        },
        scrollIntoView() { this.scrollCalls++; },
        addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
        querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
        querySelectorAll(selector) { return walk(this).filter(node => matches(node, selector)); },
        classList: { add(...names) { names.forEach(name => classes.add(name)); },
            remove(...names) { names.forEach(name => classes.delete(name)); },
            contains(name) { return classes.has(name); },
            toggle(name, on) { on ??= !classes.has(name); on ? classes.add(name) : classes.delete(name); } }
    };
    Object.defineProperties(item, {
        className: { get: () => [...classes].join(' '), set(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach(v => classes.add(v)); } },
        textContent: { get: () => ownText + item.children.map(child => child.textContent).join(''),
            set(value) { ownText = String(value); item.children.forEach(child => { child.parentElement = child.parentNode = null; }); item.children = []; } },
        innerHTML: { get: () => '', set(value) {
            assert.equal(value, '', 'HUD fixture does not silently parse untested HTML'); item.textContent = '';
        } }
    });
    return item;
}
function walk(node) { return node.children.flatMap(child => [child, ...walk(child)]); }
function matches(node, selector) {
    if (selector.startsWith('[')) return node.attrs.has(selector.slice(1, -1).split('=')[0]);
    if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return node.id === selector.slice(1);
    return node.tagName.toLowerCase() === selector.toLowerCase();
}

function harness() {
    const html = element('html'), body = element('body'); html.appendChild(body);
    const root = element(); root.id = 'hd-city-menu'; body.appendChild(root);
    const stage = element(); stage.className = 'hd-city-menu-stage'; root.appendChild(stage);
    const nodes = {};
    for (const id of ['hd-city-menu-title', 'hd-city-menu-sub', 'hd-city-menu-root',
        'hd-city-menu-sublist', 'hd-city-menu-status', 'hd-city-menu-deep']) {
        const node = element(); node.id = id; nodes[id] = node; stage.appendChild(node);
    }
    const lcdButton = element('button'); lcdButton.setAttribute('data-hd-menu-lcd', ''); stage.appendChild(lcdButton);
    const document = { documentElement: html, body, hidden: false,
        getElementById: id => [html, ...walk(html)].find(node => node.id === id) ?? null,
        querySelectorAll: selector => walk(html).filter(node => matches(node, selector)),
        querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
        createElement: element, addEventListener() {} };
    const keys = [], writes = [], names = new Map([[0, '君主甲'], [254, '主人二五四'], [599, '主人五九九'],
        [600, '很长的人物姓名甲乙丙丁戊己庚辛壬癸测试'], [601, '人物乙']]);
    const context = vm.createContext({ document, TextDecoder, TextEncoder,
        console: { log() {}, warn() {}, error() {} }, alert() {}, lcdBlur() {},
        Module: { HEAPU8: new Uint8Array(8192) }, addEventListener() {},
        setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
        localStorage: { getItem: key => key === 'baye/cityMenuMode' ? 'hd' : 'hd-map' },
        navigator: { userAgent: 'Node fixture' } });
    context.window = context;
    const bridge = read('js/bridge.js');
    for (const name of new Set(bridge.match(/\b_baye\w+/g))) context[name] = () => 0;
    context._bayeHdReady = () => 1; context._bayeGetPersonCount = () => 786;
    context._bayeSendKey = key => keys.push(key);
    vm.runInContext(bridge, context); context.baye_bridge_init();
    const city = { State: 0, Belong: 255, SatrapId: 600, FarmingLimit: 900, Farming: 300,
        CommerceLimit: 700, Commerce: 0, PeopleDevotion: 78, AvoidCalamity: 62,
        PopulationLimit: 500000, Population: 400000, Money: 532, Food: 1790,
        MothballArms: 975, Persons: 2, Tools: 3, PersonQueue: 7, ToolQueue: 11 };
    const person = { OldBelong: 0, Belong: 255, Level: 7, Force: 91, IQ: 88, Devotion: 67,
        Character: 4, Experience: 99, Thew: 0, ArmsType: 2, Arms: 1234,
        Equip: [0, 600], Tool1: 0, Tool2: 600, Age: 34 };
    const people = []; people.length = 786; people[600] = person;
    people[601] = { ...person, Equip: [1, 0], Belong: 255 };
    const queue = Array(7).fill(0).concat([600, 601]);
    const raw = { g_Cities: [city], g_Persons: people, g_PersonsQueue: queue,
        g_PlayerKing: 254, g_PIdx: 1, g_hdQtyActive: 0, g_asyncActionID: 0 };
    function readonly(value, path = '') {
        if (!value || typeof value !== 'object') return value;
        return new Proxy(value, { get(target, key) { return readonly(target[key], path + '.' + String(key)); },
            set(target, key) { writes.push(path + '.' + String(key)); throw new Error('engine write'); } });
    }
    context.baye.data = readonly(raw); context.baye.ensureData = () => context.baye.data;
    context.baye.getPersonName = index => names.get(index) ?? '';
    context.baye.getCityName = () => '长安'; context.baye.hdCityLimit = () => 1;
    const toolCalls = [];
    context.baye.getToolName = index => { toolCalls.push(index); return index === 0 ? '很长的装备名称甲乙丙丁' : ''; };
    const armCalls = [];
    context.baye.getArmType = index => { armCalls.push(index); throw new Error('U8 derived getter must not be used'); };
    const menu = { active: 1, context: 1, kind: 3, seq: 9, count: 2, index: 0,
        names: [names.get(600), names.get(601)] };
    const report = { active: 0 }, help = { active: 0 }, qty = { active: 0 };
    Object.assign(context.baye.hd, { ready: () => true, menuItems: () => menu, report: () => report,
        help: () => help, qty: () => qty, march: () => null, fight: () => null });
    let identity = { status: 'ready', generation: 1, sha256: standardHash }, current = true;
    context.BayeHdLibIdentity = { read: () => identity, isCurrent: value => current && value === identity };
    let source = read('js/hd-city-menu.js');
    source = source.replace(/\}\)\(window\);\s*$/, `
        global.__hud = { state: state, cityDetails: cityDetails, personDetails: personDetails,
            renderStatus: renderStatus, renderPersonDetails: renderPersonDetails,
            deepMenuOwner: deepMenuOwner, fillDeepList: fillDeepList, applyHighlight: applyHighlight,
            chooseRoot: chooseRoot, back: back, bind: bindUi,
            applyDocAttr: applyDocAttr, lcdPresentation: cityLcdPresentation, render: render };
    })(window);`);
    vm.runInContext(source, context, { filename: 'js/hd-city-menu.js' });
    const hud = context.__hud;
    Object.assign(hud.state, { open: true, cityIndex: 0, cityName: '长安', layer: 'deep',
        deepKind: 'person', wizardStep: 'none', idleIndex: 0 });
    hud.state.deepMenuOwner = hud.deepMenuOwner(menu);
    return { context, hud, nodes, root, lcdButton, document, city, person, people, queue, menu, names, report, help, qty,
        keys, writes, armCalls, toolCalls, setIdentity(value, isCurrent = true) { identity = value; current = isCurrent; } };
}

function rows(details) { return Object.fromEntries(details.groups.flatMap(group => group.rows)); }
test('city groups preserve all native attributes, zero values and actual limits; queue offsets stay out', () => {
    const h = harness(); h.hud.renderStatus();
    const details = plain(h.hud.state.cityDetails), values = rows(details);
    assert.deepEqual(details.groups.map(group => group.title), ['归属与城况', '民生与发展', '资源与军备']);
    assert.equal(values.归属, '主人二五四'); assert.equal(values.太守, '主人五九九');
    assert.equal(values['农业 / 上限'], '300 / 900'); assert.equal(values['商业 / 上限'], '0 / 700');
    assert.equal(values['人口 / 上限'], '400000 / 500000'); assert.equal(values.民忠, '78');
    assert.equal(values.防灾, '62'); assert.equal(values.金钱, '532'); assert.equal(values.粮食, '1790');
    assert.equal(values.预备兵, '975'); assert.equal(values.城内人物, '2'); assert.equal(values.城内道具, '3');
    assert.doesNotMatch(h.nodes['hd-city-menu-status'].textContent, /PersonQueue|ToolQueue|队列|偏移/);
    assert.equal(Object.keys(values).length, 13);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('missing, null or invalid city fields stay unread, while unowned and zero limits remain explicit', () => {
    const h = harness();
    delete h.city.Belong; delete h.city.SatrapId; h.city.Money = null; h.city.Food = false;
    h.city.Population = ''; h.city.FarmingLimit = 0; delete h.city.CommerceLimit;
    let values = rows(h.hud.cityDetails(h.city));
    assert.equal(values.归属, '归属未知'); assert.equal(values.太守, '未读取');
    assert.equal(values.金钱, '未读取'); assert.equal(values.粮食, '未读取');
    assert.equal(values['人口 / 上限'], '未读取 / 500000');
    assert.equal(values['农业 / 上限'], '300 / 0'); assert.equal(values['商业 / 上限'], '0 / 上限未读取');
    h.city.Belong = 0; h.city.SatrapId = 0; values = rows(h.hud.cityDetails(h.city));
    assert.equal(values.归属, '无主城'); assert.equal(values.太守, '未设');
});

test('unknown numeric city attributes are retained, without exposing queues', () => {
    const h = harness(); h.city.Arms = 98; h.city.CustomMetric = 42; h.city._internal = 8;
    const values = rows(h.hud.cityDetails(h.city));
    assert.equal(values.兵力, '98'); assert.equal(values.CustomMetric, '42');
    assert.equal(values._internal, undefined); assert.equal(values.PersonQueue, undefined);
});

test('person detail preserves all real attributes, long name, zero thew and high equipment ID', () => {
    const h = harness(); h.hud.renderPersonDetails();
    const detail = plain(h.hud.state.personDetail), values = rows(detail);
    assert.equal(detail.nativeIndex, 0); assert.equal(detail.personIndex, 600);
    assert.equal(detail.name, h.names.get(600));
    assert.equal(h.document.getElementById('hd-city-menu-person-name')?.textContent, h.names.get(600));
    assert.equal(values.归属, '主人二五四'); assert.equal(values.原归属, '未记录（0）');
    assert.equal(values.年龄, '34'); assert.equal(values.性格码, '4（武将：忠义）');
    for (const [label, value] of Object.entries({ 等级: '7', 武力: '91', 智力: '88', 忠诚值: '67', 经验: '99', 体力: '0', 兵力: '1234' }))
        assert.equal(values[label], value);
    assert.equal(values.基础兵种, '弓箭兵（码 2）'); assert.equal(values.装备一, '无');
    assert.equal(values.装备二, '道具编号 600（名称未读取）');
    assert.deepEqual(h.toolCalls, []); assert.deepEqual(h.armCalls, []);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('current captive, previous unknown allegiance and lord character are separate contracts', () => {
    const h = harness(); h.person.Belong = 65535; h.person.OldBelong = 65535;
    let values = rows(h.hud.personDetails(600, h.names.get(600)));
    assert.equal(values.归属, '俘虏'); assert.equal(values.原归属, '原归属未知（码 65535）');
    h.person.Belong = 601; values = rows(h.hud.personDetails(600, h.names.get(600)));
    assert.equal(values.归属, '君主 · ' + h.names.get(600));
    assert.equal(values.性格码, '4（君主：和平）');
    delete h.person.Belong; delete h.person.Thew; delete h.person.Character;
    delete h.person.Equip; delete h.person.Tool1; delete h.person.Tool2;
    values = rows(h.hud.personDetails(600, h.names.get(600)));
    assert.equal(values.归属, '归属未知'); assert.equal(values.体力, '未读取');
    assert.equal(values.性格码, '未读取'); assert.equal(values.装备一, '未读取'); assert.equal(values.装备二, '未读取');
});

test('known equipment is named through its actual ID and missing names retain the number', () => {
    const h = harness(); h.person.Equip = [1, 512];
    const values = rows(h.hud.personDetails(600, '人物'));
    assert.equal(values.装备一, '很长的装备名称甲乙丙丁（编号 1）');
    assert.equal(values.装备二, '道具编号 512（名称未读取）');
    assert.deepEqual(h.toolCalls, [0, 511]); assert.deepEqual(h.armCalls, []);
});

test('untrusted/pending/stale loaded LIB or Mod property hooks only expose raw enum codes', () => {
    const h = harness();
    for (const [identity, current] of [[{ status: 'pending', sha256: null }, true],
        [{ status: 'ready', sha256: 'mod' }, true], [{ status: 'ready', sha256: standardHash }, false]]) {
        h.setIdentity(identity, current);
        const values = rows(h.hud.personDetails(600, '人物'));
        assert.equal(values.性格码, '4'); assert.equal(values.基础兵种, '原始码 2');
        assert.equal(rows(h.hud.cityDetails(h.city)).城况, '原始码 0');
    }
    h.setIdentity({ status: 'ready', sha256: standardHash });
    let hookCalls = 0; h.context.baye.hooks = { getPersonPropertyValue() { hookCalls++; }, getCityPropertyDisplay() { hookCalls++; } };
    assert.equal(rows(h.hud.personDetails(600, '人物')).基础兵种, '原始码 2');
    assert.equal(rows(h.hud.personDetails(600, '人物')).性格码, '4');
    assert.equal(rows(h.hud.cityDetails(h.city)).城况, '原始码 0'); assert.equal(hookCalls, 0);
});

test('native person index and owner attributes survive the read-only detail layout', () => {
    const h = harness(); h.hud.fillDeepList();
    const buttons = h.document.querySelectorAll('[data-hd-deep]');
    assert.equal(buttons.length, 2);
    for (let i = 0; i < 2; i++) {
        assert.equal(buttons[i].getAttribute('data-hd-deep'), String(i));
        assert.equal(buttons[i].getAttribute('data-hd-deep-owner'), h.hud.state.deepMenuOwner.key);
        assert.equal(buttons[i].getAttribute('data-hd-menu-context'), '1');
        assert.equal(buttons[i].getAttribute('data-hd-menu-kind'), '3');
        assert.equal(buttons[i].getAttribute('data-hd-menu-seq'), '9');
        assert.equal(buttons[i].getAttribute('data-hd-deep-pind'), String(600 + i));
    }
    assert.equal(h.nodes['hd-city-menu-deep'].parentElement.id, 'hd-city-menu-person-layout');
    h.menu.index = 1; h.hud.state.idleIndex = 1; h.hud.applyHighlight();
    assert.equal(h.hud.state.personDetail.personIndex, 601);
    assert.equal(h.hud.state.personDetail.nativeIndex, 1);
    assert.equal(h.keys.length, 0); assert.equal(h.writes.length, 0);
});

test('stable native selection does not repeatedly scroll away manual inspection', () => {
    const h = harness(); h.hud.fillDeepList();
    const buttons = h.document.querySelectorAll('[data-hd-deep]');
    assert.equal(buttons[0].scrollCalls, 1);
    for (let i = 0; i < 4; i++) h.hud.fillDeepList();
    assert.equal(buttons[0].scrollCalls, 1);
    h.menu.index = 1; h.hud.state.idleIndex = 1; h.hud.applyHighlight();
    assert.equal(buttons[1].scrollCalls, 1);
});

test('native GetCityPersons filters an eleven-entry city queue to seven actors in its original order', () => {
    const h = harness();
    const native = read('vendor/iBaye/src/cityedit.c').match(/FAR U32 GetCityPersons\(U8 city, PersonID \*pqueue\)[\s\S]*?return\(count\);/)[0];
    assert.match(native, /p = g_PersonsQueue\[g_Cities\[city\]\.PersonQueue \+ i\];/);
    assert.match(native, /g_Persons\[p\]\.Belong == g_Cities\[city\]\.Belong[\s\S]*?pqueue\[count\] = p;[\s\S]*?count \+= 1;/);
    const expected = [600, 602, 603, 605, 606, 608, 610];
    h.city.Persons = 11;
    for (let i = 0; i < 11; i++) {
        const id = 600 + i;
        h.people[id] = { ...h.person, Belong: expected.includes(id) ? 255 : i === 4 ? 65535 : i === 7 ? 600 : 0 };
        h.names.set(id, '真实人物' + id);
        h.queue[7 + i] = id;
    }
    Object.assign(h.menu, { count: 7, index: 2, names: expected.map(id => h.names.get(id)) });
    h.hud.state.deepMenuOwner = h.hud.deepMenuOwner(h.menu);
    h.hud.state.idleIndex = 1; // Retained previous menu's cursor must not win.
    h.hud.fillDeepList();
    assert.deepEqual(Array.from(h.hud.state.deepItems, item => item.pind), expected);
    assert.equal(h.hud.state.idleIndex, 2);
    assert.equal(h.hud.state.personDetail.personIndex, 603);
    assert.equal(h.hud.state.personDetail.nativeIndex, 2);
    assert.equal(h.document.getElementById('hd-city-menu-person-name').textContent, '真实人物603');
    const buttons = h.document.querySelectorAll('[data-hd-deep]');
    assert.deepEqual(buttons.map((button, i) => button.classList.contains('is-idle') ? i : -1).filter(i => i >= 0), [2]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    h.menu.names.reverse(); h.hud.state.deepMenuOwner = h.hud.deepMenuOwner(h.menu); h.hud.fillDeepList();
    assert.ok(Array.from(h.hud.state.deepItems).every(item => item.pind === undefined));
    assert.equal(h.hud.state.personDetail, null);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('matched native owner index determines both highlighted actor and detail, including direct refresh', () => {
    const h = harness(); h.hud.state.idleIndex = 1; h.hud.fillDeepList();
    const buttons = h.document.querySelectorAll('[data-hd-deep]');
    assert.equal(h.hud.state.idleIndex, 0); assert.equal(h.hud.state.personDetail.nativeIndex, 0);
    assert.equal(buttons[0].classList.contains('is-idle'), true); assert.equal(buttons[1].classList.contains('is-idle'), false);
    h.menu.index = 1; // No onMenuIdle observer is needed to correct an old cursor.
    h.hud.applyHighlight();
    assert.equal(h.hud.state.idleIndex, 1); assert.equal(h.hud.state.personDetail.nativeIndex, 1);
    assert.equal(h.hud.state.personDetail.personIndex, 601);
    assert.equal(buttons[0].classList.contains('is-idle'), false); assert.equal(buttons[1].classList.contains('is-idle'), true);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('filtered/reordered/duplicate native names never infer a person by name', () => {
    for (const change of ['filtered', 'reordered', 'duplicate']) {
        const h = harness();
        if (change === 'filtered') { h.menu.names = [h.names.get(600)]; h.menu.count = 1; }
        if (change === 'reordered') h.menu.names.reverse();
        if (change === 'duplicate') { h.names.set(601, h.names.get(600)); h.menu.names[1] = h.menu.names[0]; }
        h.hud.state.deepMenuOwner = h.hud.deepMenuOwner(h.menu); h.hud.renderPersonDetails();
        assert.equal(h.hud.state.personDetail, null, change);
        assert.match(h.document.getElementById('hd-city-menu-person-details').textContent, /尚未关联/);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('report/help/quantity/owner change/pending input/hidden view retire person details', () => {
    for (const change of ['report', 'help', 'qty', 'owner', 'pending', 'hidden', 'closed', 'layer', 'goods']) {
        const h = harness(); h.hud.renderPersonDetails(); assert.ok(h.hud.state.personDetail);
        if (change === 'report') h.report.active = 1;
        if (change === 'help') h.help.active = 1;
        if (change === 'qty') h.qty.active = 1;
        if (change === 'owner') h.menu.seq++;
        if (change === 'pending') h.hud.state.deepSelectionPending = { seq: 9 };
        if (change === 'hidden') h.document.hidden = true;
        if (change === 'closed') h.hud.state.open = false;
        if (change === 'layer') h.hud.state.layer = 'status';
        if (change === 'goods') h.hud.state.deepKind = 'goods';
        h.hud.renderPersonDetails();
        assert.equal(h.hud.state.personDetail, null, change);
        assert.equal(h.document.getElementById('hd-city-menu-person-details').hidden, true, change);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('live attributes update under the same owner without changing the native queue', () => {
    const h = harness(); h.hud.renderPersonDetails();
    h.person.Thew = 55; h.person.Arms = 2345; h.hud.renderPersonDetails();
    assert.equal(rows(h.hud.state.personDetail).体力, '55'); assert.equal(rows(h.hud.state.personDetail).兵力, '2345');
    assert.equal(h.hud.state.personDetail.seq, 9); assert.equal(h.hud.state.personDetail.personIndex, 600);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('persistent portrait slot stays outside rebuilt fields and survives native highlight/attribute refresh', () => {
    const h = harness(); h.hud.fillDeepList();
    const pane = h.document.getElementById('hd-city-menu-person-details');
    const slot = h.document.getElementById('hd-city-menu-person-portrait');
    const fields = h.document.getElementById('hd-city-menu-person-fields');
    assert.deepEqual(pane.children.map(child => child.id), ['hd-city-menu-person-portrait', 'hd-city-menu-person-fields']);
    const portrait = element('figure'); portrait.id = 'hd-portrait'; slot.appendChild(portrait);
    h.menu.index = 1; h.hud.applyHighlight();
    assert.equal(h.hud.state.personDetail.personIndex, 601);
    assert.equal(h.document.getElementById('hd-city-menu-person-fields'), fields);
    assert.equal(h.document.getElementById('hd-city-menu-person-portrait'), slot);
    assert.equal(portrait.parentElement, slot);
    h.people[601].Thew = 42; h.hud.fillDeepList();
    assert.equal(rows(h.hud.state.personDetail).体力, '42'); assert.equal(portrait.parentElement, slot);
    assert.equal(fields.querySelector('h2').textContent, h.names.get(601));
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('known native list defaults LCD off despite stale map/dialog classes, and explicit inspection persists', () => {
    const h = harness(); h.document.body.classList.add('baye-hd-overworld-menu', 'baye-hd-dialog-lcd');
    h.context.BayeHdDialog = { debugSnapshot: () => ({ open: false, kind: 'help' }) };
    h.hud.fillDeepList();
    assert.equal(h.document.documentElement.getAttribute('data-baye-city-lcd'), 'off');
    assert.equal(h.document.body.classList.contains('baye-hd-city-menu-lcd'), false);
    h.hud.bind();
    const click = () => h.root.listeners.get('click').forEach(listener => listener({
        target: h.lcdButton, preventDefault() {}, stopPropagation() {} }));
    click();
    assert.equal(h.hud.state.showLcd, true); assert.equal(h.lcdButton.getAttribute('aria-pressed'), 'true');
    assert.equal(h.document.documentElement.getAttribute('data-baye-city-lcd'), 'on');
    for (let i = 0; i < 4; i++) { h.hud.fillDeepList(); h.hud.render(); }
    assert.equal(h.hud.state.showLcd, true); assert.equal(h.hud.lcdPresentation(), 'on');
    click(); h.hud.fillDeepList();
    assert.equal(h.hud.state.showLcd, false); assert.equal(h.lcdButton.textContent, '经典 LCD');
    assert.equal(h.hud.lcdPresentation(), 'off'); assert.equal(h.lcdButton.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('unknown native lists retain automatic LCD fallback without setting explicit inspection preference', () => {
    const h = harness(); h.hud.fillDeepList();
    h.menu.active = 0; h.menu.names = []; h.menu.count = 0; h.hud.fillDeepList();
    assert.equal(h.hud.lcdPresentation(), 'on'); assert.equal(h.hud.state.showLcd, false);
    assert.equal(h.document.body.classList.contains('baye-hd-city-menu-deep-empty'), true);
    assert.equal(h.hud.state.personDetail, null);
    assert.equal(h.document.getElementById('hd-city-menu-person-details').hidden, true);
    h.menu.active = 1; h.menu.names = [h.names.get(600), h.names.get(601)]; h.menu.count = 2;
    h.hud.fillDeepList(); assert.equal(h.hud.lcdPresentation(), 'off'); assert.equal(h.hud.state.showLcd, false);
    assert.equal(h.document.body.classList.contains('baye-hd-city-menu-deep-empty'), false);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('native report/help ownership passes LCD control through and retires correctly when it ends', () => {
    const h = harness(); h.hud.fillDeepList();
    for (const owner of [h.report, h.help]) {
        owner.active = 1; h.hud.fillDeepList();
        assert.equal(h.hud.lcdPresentation(), 'passthrough');
        assert.equal(h.document.documentElement.getAttribute('data-baye-city-lcd'), 'passthrough');
        owner.active = 0; h.hud.fillDeepList();
        assert.equal(h.hud.lcdPresentation(), 'off');
    }
    let dialog = { open: true, kind: 'report', pass: false };
    h.context.BayeHdDialog = { debugSnapshot: () => dialog };
    h.hud.applyDocAttr(); assert.equal(h.hud.lcdPresentation(), 'passthrough');
    dialog = { open: false, kind: 'report' }; h.document.body.classList.add('baye-hd-dialog-lcd');
    h.hud.applyDocAttr(); assert.equal(h.hud.lcdPresentation(), 'off');
    h.hud.state.layer = 'status'; h.hud.applyDocAttr(); assert.equal(h.hud.lcdPresentation(), 'off');
    h.hud.state.open = false; h.hud.applyDocAttr(); assert.equal(h.hud.lcdPresentation(), 'passthrough');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('read-only status entry and return preserve the real root owner and can open its next submenu', () => {
    const h = harness();
    const march = { phase: 0, mapCity: 1, pick: 0 };
    h.context.baye.hd.march = () => march;
    Object.assign(h.hud.state, { layer: 'root', deepKind: '', idleIndex: 2 });
    Object.assign(h.menu, { active: 1, context: 1, kind: 1, seq: 77, index: 2,
        count: 4, names: ['内政', '外交', '军备', '状况'] });
    const ownerBefore = structuredClone(h.menu);
    h.hud.chooseRoot(3);
    assert.equal(h.hud.state.layer, 'status');
    assert.deepEqual(h.menu, ownerBefore); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    h.hud.back();
    assert.equal(h.hud.state.layer, 'root'); assert.equal(h.hud.state.idleIndex, 2);
    assert.equal(h.hud.state.closingSub, false); assert.equal(h.hud.state.subKind, '');
    assert.deepEqual(h.menu, ownerBefore); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    assert.equal(h.hud.state.queue.length, 0); assert.equal(h.hud.state.lastExit, '');
    // Model the real C acknowledgement of Enter: it opens a new menu owner,
    // never a fabricated local submenu and never an EXIT back to map input.
    h.context.sendKey = key => {
        h.keys.push(key);
        assert.equal(key, 0x27);
        Object.assign(h.menu, { kind: 2, seq: 78, index: 0, count: 5,
            names: ['侦察', '征兵', '分配', '掠夺', '出征'] });
    };
    h.hud.chooseRoot(2);
    assert.equal(h.hud.state.layer, 'sub'); assert.equal(h.hud.state.subKind, 'junbei');
    assert.equal(h.menu.active, 1); assert.equal(h.menu.context, 1); assert.equal(h.menu.kind, 2);
    assert.equal(h.menu.seq, 78); assert.deepEqual(h.keys, [0x27]); assert.deepEqual(h.writes, []);
});
