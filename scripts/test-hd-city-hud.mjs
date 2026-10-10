#!/usr/bin/env node
/** Read-only city/person/tool HUD rendered from real native menu contracts. */
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
    const documentListeners = new Map();
    const document = { documentElement: html, body, hidden: false,
        getElementById: id => [html, ...walk(html)].find(node => node.id === id) ?? null,
        querySelectorAll: selector => walk(html).filter(node => matches(node, selector)),
        querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
        createElement: element, addEventListener(type, listener) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(listener);
        } };
    const keys = [], writes = [], timers = [], intervals = [], names = new Map([[0, '君主甲'], [254, '主人二五四'], [599, '主人五九九'],
        [600, '很长的人物姓名甲乙丙丁戊己庚辛壬癸测试'], [601, '人物乙']]);
    const context = vm.createContext({ document, TextDecoder, TextEncoder,
        console: { log() {}, warn() {}, error() {} }, alert() {}, lcdBlur() {},
        Module: { HEAPU8: new Uint8Array(8192) }, addEventListener() {},
        setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval(fn) { intervals.push(fn); }, clearInterval() {},
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
    context.baye.getToolCount = () => 512;
    context.baye.getToolName = index => { toolCalls.push(index); return index === 0 ? '很长的装备名称甲乙丙丁' : ''; };
    const armCalls = [];
    context.baye.getArmType = index => { armCalls.push(index); throw new Error('U8 derived getter must not be used'); };
    const derivedCalls = [];
    const menu = { active: 1, context: 1, kind: 3, seq: 9, count: 2, index: 0,
        names: [names.get(600), names.get(601)] };
    const report = { active: 0 }, help = { active: 0 }, qty = { active: 0 };
    const goods = { active: 0 };
    Object.assign(context.baye.hd, { ready: () => true, menuItems: () => menu, report: () => report,
        help: () => help, qty: () => qty, march: () => null, fight: () => null, goods: () => goods,
        toolDetails: () => null, personArmType: id => { derivedCalls.push(id); return null; } });
    let identity = { status: 'ready', generation: 1, sha256: standardHash }, current = true;
    context.BayeHdLibIdentity = { read: () => identity, isCurrent: value => current && value === identity };
    let source = read('js/hd-city-menu.js');
    source = source.replace(/\}\)\(window\);\s*$/, `
        global.__hud = { state: state, cityDetails: cityDetails, personDetails: personDetails,
            renderStatus: renderStatus, renderPersonDetails: renderPersonDetails,
            renderToolDetails: renderToolDetails, renderPersonProperties: renderPersonProperties,
            deepMenuOwner: deepMenuOwner, fillDeepList: fillDeepList, applyHighlight: applyHighlight,
            chooseRoot: chooseRoot, chooseSub: chooseSub, back: back, bind: bindUi,
            applyDocAttr: applyDocAttr, lcdPresentation: cityLcdPresentation, render: render };
    })(window);`);
    vm.runInContext(source, context, { filename: 'js/hd-city-menu.js' });
    const hud = context.__hud;
    Object.assign(hud.state, { open: true, cityIndex: 0, cityName: '长安', layer: 'deep',
        deepKind: 'person', wizardStep: 'none', idleIndex: 0 });
    hud.state.deepMenuOwner = hud.deepMenuOwner(menu);
    return { context, hud, nodes, root, lcdButton, document, city, person, people, queue, menu, names, report, help, qty, goods,
        documentListeners, raw, keys, writes, timers, intervals, armCalls, derivedCalls, toolCalls, setIdentity(value, isCurrent = true) { identity = value; current = isCurrent; } };
}

function goodsHarness({custom = true} = {}) {
    const h = harness();
    Object.assign(h.hud.state, { deepKind: 'goods', deepStep: 0 });
    Object.assign(h.menu, { kind: 4, generation: 3, detailGeneration: 3, idsValid: true, ids: [2, 17],
        names: ['同名道具', '同名道具'], count: 2, index: 0 });
    Object.assign(h.goods, { active: 1, complete: 0, custom: custom ? 1 : 0, generation: 3, detailGeneration: 3,
        menuSeq: h.menu.seq, index: 0, tool: 2, name: '很长的真实道具名称甲乙丙丁戊己',
        propertyCount: 5, pageStart: 0, pageEnd: 3, properties: Array.from({length: 5}, (_, i) => ({
            index: i, title: i < 3 ? '实际属性' + i : '', value: i < 3 ? String(i) : '', captured: i < 3 })) });
    h.hud.fillDeepList(); h.hud.bind();
    return h;
}

function personPropertyHarness({count = 5, end = 3, custom = true} = {}) {
    const h = harness();
    Object.assign(h.menu, {generation: 3, detailGeneration: 3, idsValid: true, ids: [600, 601]});
    const props = {protocolVersion: 1, active: 1, complete: count === end ? 1 : 0,
        pageComplete: count > 0 && end > 0 ? 1 : 0, custom: custom ? 1 : 0, generation: 3, detailGeneration: 3,
        context: 1, kind: 3, menuSeq: h.menu.seq, paintSeq: 40, index: 0, person: 600,
        propertyCount: count, pageIndex: 0, pageStart: 0, pageEnd: end, name: h.names.get(600),
        properties: Array.from({length: count}, (_, index) => ({index,
            title: index < end ? '实际原生标题' + index : '', value: index < end ? '原生值' + index : '',
            captured: index < end, titleCaptured: index < end, valueCaptured: index < end,
            titlePaintSeq: index < end ? 40 : 0, valuePaintSeq: index < end ? 40 : 0}))};
    h.personProps = props; h.context.baye.hd.personProperties = () => plain(props);
    h.hud.fillDeepList(); h.hud.bind();
    return h;
}
function personPageButton(h, direction) {
    return h.document.querySelectorAll('[data-hd-person-page]').find(button => button.getAttribute('data-hd-person-page') === direction);
}
function paintPersonPage(h, {start = 3, end = 5, pageIndex = 1, paintSeq = 41} = {}) {
    Object.assign(h.personProps, {pageStart: start, pageEnd: end, pageIndex, paintSeq, pageComplete: 1});
    for (let i = start; i < end; i++) Object.assign(h.personProps.properties[i], {
        title: '实际原生标题' + i, value: '原生值' + i, captured: true, titleCaptured: true, valueCaptured: true,
        titlePaintSeq: paintSeq, valuePaintSeq: paintSeq});
    h.personProps.complete = h.personProps.properties.every(p => p.captured) ? 1 : 0;
    h.hud.fillDeepList();
}

function dispatch(h, type, target, options = {}) {
    h.root.listeners.get(type).forEach(listener => listener({target, preventDefault() {}, stopPropagation() {}, ...options}));
}
function pageButton(h, direction) {
    return h.document.querySelectorAll('[data-hd-tool-page]').find(button => button.getAttribute('data-hd-tool-page') === direction);
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

test('equipment names use the validated actual tool count for high IDs and never query invalid resources', () => {
    const h = harness(); h.person.Equip = [600, 601];
    h.context.baye.getToolCount = () => 600;
    h.context.baye.getToolName = id => { h.toolCalls.push(id); return id === 599 ? '真实高编号装备' : ''; };
    let values = rows(h.hud.personDetails(600, '人物'));
    assert.equal(values.装备一, '真实高编号装备（编号 600）'); assert.equal(values.装备二, '道具编号 601（名称未读取）');
    assert.deepEqual(h.toolCalls, [599]);
    for (const count of [0, null, false, '600', 1.5, NaN, -1, 2001]) {
        h.context.baye.getToolCount = () => count; h.toolCalls.length = 0;
        values = rows(h.hud.personDetails(600, '人物'));
        assert.equal(values.装备一, '道具编号 600（名称未读取）'); assert.deepEqual(h.toolCalls, []);
    }
    h.context.baye.getToolCount = () => { throw new Error('resource is unreadable'); };
    h.toolCalls.length = 0; h.hud.personDetails(600, '人物'); assert.deepEqual(h.toolCalls, []);
    delete h.context.baye.getToolCount; h.person.Equip = [512, 600]; h.toolCalls.length = 0;
    h.hud.personDetails(600, '人物'); assert.deepEqual(h.toolCalls, [511]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
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
    const h = personPropertyHarness({count: 2, end: 2}); h.document.body.classList.add('baye-hd-overworld-menu', 'baye-hd-dialog-lcd');
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
    const h = personPropertyHarness({count: 2, end: 2}); h.hud.fillDeepList();
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
    const h = personPropertyHarness({count: 2, end: 2}); h.hud.fillDeepList();
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

test('real U16 menu IDs identify reordered and duplicate-name persons without guessing names', () => {
    const h = harness(); h.people[601].Force = 33;
    Object.assign(h.menu, { generation: 8, detailGeneration: 8, idsValid: true, ids: [601, 600],
        names: ['同名人物', '同名人物'] });
    h.hud.fillDeepList();
    assert.deepEqual(Array.from(h.hud.state.deepItems, item => item.pind), [601, 600]);
    assert.equal(h.hud.state.personDetail.personIndex, 601); assert.equal(rows(h.hud.state.personDetail).武力, '33');
    assert.equal(h.document.querySelectorAll('[data-hd-deep]')[0].getAttribute('data-hd-deep-pind'), '601');
    h.menu.index = 1; h.hud.applyHighlight();
    assert.equal(h.hud.state.personDetail.personIndex, 600); assert.equal(rows(h.hud.state.personDetail).武力, '91');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('malformed claimed native IDs never fall back to a matching person name list', () => {
    for (const ids of [[600], [600, 65535], [600, '601'], [600, true]]) {
        const h = harness(); Object.assign(h.menu, { idsValid: true, ids, generation: 1, detailGeneration: 1 });
        h.hud.fillDeepList();
        assert.equal(h.hud.state.personDetail, null);
        assert.ok(Array.from(h.hud.state.deepItems).every(item => item.pind === undefined));
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('derived equipment arm passes the whole U16 person ID and retains the basic arm separately', () => {
    const h = harness(); h.context.baye.hd.personArmType = id => { h.derivedCalls.push(id); return 5; };
    let detail = h.hud.personDetails(600, '人物');
    assert.equal(rows(detail).基础兵种, '弓箭兵（码 2）'); assert.equal(rows(detail).装备后兵种, '玄兵（码 5）');
    assert.deepEqual(h.derivedCalls, [600]); assert.deepEqual(h.armCalls, []);
    h.setIdentity({status: 'ready', sha256: 'actual-mod'});
    assert.equal(rows(h.hud.personDetails(600, '人物')).装备后兵种, '原始码 5');
    for (const value of [null, 65535, '5', false, -1]) {
        h.context.baye.hd.personArmType = () => value;
        assert.equal(rows(h.hud.personDetails(600, '人物')).装备后兵种, '未读取');
    }
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('same-name goods use actual selected tool ID and preserve native captured values and unread pages', () => {
    const h = goodsHarness();
    const detail = plain(h.hud.state.toolDetail), buttons = h.document.querySelectorAll('[data-hd-deep]');
    assert.deepEqual(Array.from(h.hud.state.deepItems, item => item.toolIndex), [2, 17]);
    assert.equal(buttons[0].getAttribute('data-hd-deep-tool'), '2'); assert.equal(buttons[1].getAttribute('data-hd-deep-tool'), '17');
    assert.equal(detail.toolIndex, 2); assert.equal(detail.nativeIndex, 0); assert.equal(detail.generation, 3);
    assert.equal(detail.complete, false); assert.equal(detail.custom, true); assert.equal(detail.source, 'native-capture');
    assert.equal(rows(detail).实际属性0, '0'); assert.equal(rows(detail)['属性 4'], '未读取');
    assert.match(h.document.getElementById('hd-city-menu-tool-details').textContent, /原生已显示 3 \/ 5 项/);
    assert.equal(h.document.getElementById('hd-city-menu-tool-name').textContent, h.goods.name);
    assert.equal(h.document.getElementById('hd-city-menu-person-details').hidden, true);
    assert.equal(h.hud.lcdPresentation(), 'off');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('standard current raw tool fields supplement unread default properties, preserving real zero values', () => {
    const h = goodsHarness({custom: false}), calls = [];
    h.context.baye.hd.toolDetails = id => {
        calls.push(id); return {index: id, standard: true, generation: 3, name: '道具',
            attack: 0, iq: 0, move: 0, arm: 2, useFlag: 0, changeAttackRange: 1};
    };
    h.goods.properties.forEach(property => { property.captured = false; property.title = property.value = ''; });
    h.hud.renderToolDetails();
    const detail = plain(h.hud.state.toolDetail), values = rows(detail);
    assert.equal(detail.complete, true); assert.equal(detail.nativeComplete, false); assert.equal(detail.source, 'standard-raw');
    assert.equal(values.用法, '装备'); assert.equal(values.武力加成, '0'); assert.equal(values.智力加成, '0');
    assert.equal(values.移动加成, '0'); assert.equal(values.兵种变化, '玄兵'); assert.deepEqual(calls, [2]);
    assert.equal(values.改变攻击范围标志, '改变（码 1）');
    h.goods.complete = 1; h.goods.properties.forEach(property => { property.captured = true; }); h.hud.renderToolDetails();
    assert.equal(rows(h.hud.state.toolDetail).改变攻击范围标志, '改变（码 1）');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('custom properties, unknown libraries and live property hooks never substitute standard raw semantics', () => {
    for (const mode of ['custom', 'mod', 'hook', 'pending', 'stale']) {
        const h = goodsHarness({custom: mode === 'custom'}); let rawCalls = 0, hookCalls = 0;
        h.context.baye.hd.toolDetails = () => { rawCalls++; return {index: 2, standard: true, attack: 99, iq: 88, move: 1, arm: 2, useFlag: 0}; };
        if (mode === 'mod') h.setIdentity({status: 'ready', sha256: 'real-mod'});
        if (mode === 'pending') h.setIdentity({status: 'pending', sha256: null});
        if (mode === 'stale') h.setIdentity({status: 'ready', sha256: standardHash}, false);
        if (mode === 'hook') h.context.baye.hooks = {getToolPropertyValue() { hookCalls++; throw new Error('must not execute hook'); }};
        h.hud.renderToolDetails();
        assert.equal(h.hud.state.toolDetail.complete, false, mode); assert.equal(h.hud.state.toolDetail.source, 'native-capture', mode);
        assert.equal(rows(h.hud.state.toolDetail)['属性 4'], '未读取', mode);
        assert.equal(rawCalls, 0, mode); assert.equal(hookCalls, 0, mode); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('genuine captured blank and literal markup stay distinct from unread values', () => {
    const h = goodsHarness();
    h.goods.properties[0] = {index: 0, title: '<img src=x>', value: '<script>actual Mod text</script>', captured: true};
    h.goods.properties[1] = {index: 1, title: '', value: '', captured: true};
    h.hud.renderToolDetails();
    const values = rows(h.hud.state.toolDetail);
    assert.equal(values['<img src=x>'], '<script>actual Mod text</script>');
    assert.equal(values['属性 2（标题为空）'], '（空）'); assert.equal(values['属性 4'], '未读取');
    const pane = h.document.getElementById('hd-city-menu-tool-details');
    assert.equal(pane.querySelectorAll('img').length, 0); assert.equal(pane.querySelectorAll('script').length, 0);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('tool fields and controls persist when actual highlighted ID changes, without automatic pagination', () => {
    const h = goodsHarness(), pane = h.document.getElementById('hd-city-menu-tool-details');
    const fields = h.document.getElementById('hd-city-menu-tool-fields'), controls = h.document.getElementById('hd-city-menu-tool-controls');
    h.menu.index = 1; Object.assign(h.goods, {index: 1, tool: 17, name: '第二个同名道具的真实标题'});
    h.hud.fillDeepList();
    assert.equal(h.hud.state.toolDetail.toolIndex, 17); assert.equal(h.hud.state.idleIndex, 1);
    assert.equal(h.document.getElementById('hd-city-menu-tool-details'), pane);
    assert.equal(h.document.getElementById('hd-city-menu-tool-fields'), fields);
    assert.equal(h.document.getElementById('hd-city-menu-tool-controls'), controls);
    assert.equal(pane.parentElement.id, 'hd-city-menu-person-layout');
    assert.equal(pane.parentElement.classList.contains('has-tool-details'), true);
    for (let i = 0; i < 4; i++) h.hud.fillDeepList();
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('tool owner and generation loss, overlays and pending input retire details and preserve LCD fallback', () => {
    for (const mode of ['report', 'help', 'qty', 'seq', 'index', 'tool', 'generation', 'current-generation', 'ids',
        'ids-invalid', 'pending', 'request', 'queue', 'hidden', 'closed', 'layer', 'person']) {
        const h = goodsHarness(); assert.ok(h.hud.state.toolDetail, mode);
        if (mode === 'report') h.report.active = 1;
        if (mode === 'help') h.help.active = 1;
        if (mode === 'qty') h.qty.active = 1;
        if (mode === 'seq') h.menu.seq++;
        if (mode === 'index') h.menu.index = 1;
        if (mode === 'tool') h.goods.tool = 17;
        if (mode === 'generation') h.goods.generation++;
        if (mode === 'current-generation') h.goods.detailGeneration++;
        if (mode === 'ids') h.menu.ids.reverse();
        if (mode === 'ids-invalid') h.menu.idsValid = false;
        if (mode === 'pending') h.hud.state.deepSelectionPending = {};
        if (mode === 'request') h.hud.state.nativeMenuRequest = {};
        if (mode === 'queue') h.hud.state.queue = [0x27];
        if (mode === 'hidden') h.document.hidden = true;
        if (mode === 'closed') h.hud.state.open = false;
        if (mode === 'layer') h.hud.state.layer = 'status';
        if (mode === 'person') h.hud.state.deepKind = 'person';
        h.hud.renderToolDetails();
        assert.equal(h.hud.state.toolDetail, null, mode); assert.equal(h.document.getElementById('hd-city-menu-tool-details').hidden, true, mode);
        assert.equal(h.hud.state.toolPagePending, null, mode);
        if (['seq', 'index', 'tool', 'generation', 'current-generation', 'ids', 'ids-invalid'].includes(mode)) assert.equal(h.hud.lcdPresentation(), 'on', mode);
        if (['report', 'help'].includes(mode)) assert.equal(h.hud.lcdPresentation(), 'passthrough', mode);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('property page clicks send one native arrow and wait for the real page acknowledgement', () => {
    const h = goodsHarness(), next = pageButton(h, 'next'), previous = pageButton(h, 'prev');
    assert.equal(previous.disabled, true); assert.equal(next.disabled, false);
    dispatch(h, 'click', next); assert.deepEqual(h.keys, [0x25]); assert.ok(h.hud.state.toolPagePending);
    dispatch(h, 'click', next); h.hud.fillDeepList(); assert.deepEqual(h.keys, [0x25]);
    Object.assign(h.goods, {pageStart: 3, pageEnd: 5, complete: 1});
    h.goods.properties.forEach((property, index) => Object.assign(property, {title: '实际属性' + index, value: String(index), captured: true}));
    h.hud.fillDeepList(); assert.equal(h.hud.state.toolPagePending, null); assert.equal(next.disabled, true);
    assert.equal(previous.disabled, false); assert.equal(h.hud.state.toolDetail.nativeComplete, true);
    dispatch(h, 'click', next); assert.deepEqual(h.keys, [0x25]);
    dispatch(h, 'click', previous); assert.deepEqual(h.keys, [0x25, 0x24]);
    assert.equal(h.keys.includes(0x27), false); assert.deepEqual(h.writes, []);
});

test('pointer-owned stale page controls never send keys to another native selection or generation', () => {
    for (const mode of ['index', 'seq', 'generation', 'page', 'report']) {
        const h = goodsHarness(), next = pageButton(h, 'next');
        dispatch(h, 'pointerdown', next);
        if (mode === 'index') { h.menu.index = 1; Object.assign(h.goods, {index: 1, tool: 17}); }
        if (mode === 'seq') { h.menu.seq++; h.goods.menuSeq++; }
        if (mode === 'generation') { h.menu.generation++; h.menu.detailGeneration++; h.goods.generation++; h.goods.detailGeneration++; }
        if (mode === 'page') { h.goods.pageStart = 3; h.goods.pageEnd = 5; }
        if (mode === 'report') h.report.active = 1;
        h.hud.fillDeepList(); dispatch(h, 'click', next);
        assert.deepEqual(h.keys, [], mode); assert.deepEqual(h.writes, [], mode);
    }
});

test('reentrant read-only default or final input getters cannot publish or page a retired tool', () => {
    const h = goodsHarness({custom: false});
    h.context.baye.hd.toolDetails = () => {
        h.menu.detailGeneration = h.menu.generation = 4;
        return {index: 2, standard: true, attack: 1, iq: 2, move: 3, arm: 0, useFlag: 0};
    };
    h.hud.renderToolDetails(); assert.equal(h.hud.state.toolDetail, null);
    assert.equal(h.document.getElementById('hd-city-menu-tool-details').hidden, true);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    const input = goodsHarness(), next = pageButton(input, 'next');
    input.context.baye.hd.fight = () => { input.menu.seq++; return null; };
    dispatch(input, 'click', next); assert.deepEqual(input.keys, []); assert.deepEqual(input.writes, []);
});

test('same-name native menu ID changes retire an armed item click instead of confirming another tool', () => {
    const h = goodsHarness(), first = h.document.querySelectorAll('[data-hd-deep]')[0];
    dispatch(h, 'pointerdown', first); h.menu.ids.reverse(); h.goods.tool = 17; h.hud.fillDeepList();
    dispatch(h, 'click', h.document.querySelectorAll('[data-hd-deep]')[0]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('a report that restores the same native menu and page still retires an older pressed page button', () => {
    const h = goodsHarness(), next = pageButton(h, 'next');
    const oldOwner = next.getAttribute('data-hd-tool-page-owner');
    dispatch(h, 'pointerdown', next); h.report.active = 1; h.hud.fillDeepList();
    h.report.active = 0; h.hud.fillDeepList();
    assert.notEqual(next.getAttribute('data-hd-tool-page-owner'), oldOwner);
    dispatch(h, 'click', next); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    dispatch(h, 'pointerdown', next); dispatch(h, 'click', next); assert.deepEqual(h.keys, [0x25]);
});

test('cancelling a goods menu hides its side panel and retains the existing single native Exit', () => {
    const h = goodsHarness(); h.hud.state.subKind = 'neizheng';
    h.hud.back();
    assert.equal(h.hud.state.toolDetail, null); assert.equal(h.document.getElementById('hd-city-menu-tool-details').hidden, true);
    h.timers.shift()(); // Execute the existing queue delay, without advancing or mutating C state.
    assert.equal(h.hud.state.layer, 'sub'); assert.deepEqual(h.keys, [0x28]); assert.deepEqual(h.writes, []);
});

function backHarness({retired = false} = {}) {
    const h = harness();
    Object.assign(h.raw, {g_hdDetailGeneration: 3, g_hdMapInputSeq: 2, g_hdMapCity: 0,
        g_hdMenuSeq: 9, g_hdMenuActive: retired ? 0 : 1, g_hdQtyActive: 0,
        g_hdReportActive: 0, g_hdHelpActive: 0, g_hdFightActive: 0,
        g_hdMapPick: retired ? 1 : 0, g_hdBattlePick: 0, g_hdMarchPhase: 0,
        g_hdMarchSession: 0, g_hdMarchInputSeq: 0});
    Object.assign(h.menu, {active: retired ? 0 : 1, detailGeneration: 3,
        idsValid: true, ids: [600, 601]});
    h.backButton = element('button'); h.backButton.setAttribute('data-hd-menu-back', '');
    h.root.appendChild(h.backButton); h.hud.bind();
    return h;
}
function runBackQueue(h) {
    for (let i = 0; h.timers.length && i < 30; i++) h.timers.shift()();
    assert.equal(h.timers.length, 0, 'Back must not leave a repeating input task');
}

test('the real Back button closes a retired recruit pane on ordinary map input without any native key or world write', () => {
    const h = backHarness({retired: true}), world = structuredClone(h.raw);
    Object.assign(h.hud.state, {deepKind: 'person-qty', deepLabel: '征兵', campaignPick: false});
    h.context.BayeHdOverworld = {leaveMenu() { throw new Error('retired map cannot receive Exit'); }};
    dispatch(h, 'pointerdown', h.backButton); dispatch(h, 'click', h.backButton, {detail: 1});
    runBackQueue(h);
    assert.equal(h.hud.state.open, false); assert.deepEqual(h.keys, []);
    assert.deepEqual(h.raw, world); assert.deepEqual(h.writes, []);
});

test('same-owner person and submenu Back still deliver exactly one Exit despite a changed highlight', () => {
    for (const layer of ['deep', 'sub']) {
        const h = backHarness(); h.hud.state.layer = layer;
        if (layer === 'sub') Object.assign(h.menu, {kind: 2, idsValid: false});
        dispatch(h, 'pointerdown', h.backButton); h.menu.index = 1;
        dispatch(h, 'click', h.backButton, {detail: 1}); runBackQueue(h);
        assert.deepEqual(h.keys, [0x28], layer); assert.deepEqual(h.writes, []);
        assert.equal(h.hud.state.layer, layer === 'deep' ? 'sub' : 'root');
    }
});

test('the real poll retires a cancelled picker only after native map ACK and the Back queue has drained', () => {
    const h = backHarness(); h.context.BayeHdCityMenu.start();
    const poll = h.intervals.at(-1); let nativeAck = false;
    h.context.sendKey = key => {
        h.keys.push(key); nativeAck = true;
        Object.assign(h.raw, {g_hdMenuActive: 0, g_hdMapPick: 1}); h.raw.g_hdMapInputSeq++;
        h.menu.active = 0;
    };
    dispatch(h, 'click', h.backButton, {detail: 0});
    poll(); assert.equal(h.hud.state.open, true); assert.equal(nativeAck, false);
    h.timers.shift()(); // Original EXIT delivered; native command acknowledges map input.
    poll(); assert.equal(h.hud.state.open, true, 'Original queue still owns its ACK delay');
    runBackQueue(h); poll();
    assert.equal(h.hud.state.open, false); assert.equal(h.hud.state.closingSub, false);
    assert.deepEqual(h.keys, [0x28]); assert.deepEqual(h.writes, []);

    const initial = backHarness({retired: true}); initial.context.BayeHdCityMenu.start();
    initial.intervals.at(-1)();
    assert.equal(initial.hud.state.open, true, 'An untouched stale pane still waits for the player Back');
    assert.deepEqual(initial.keys, []); assert.deepEqual(initial.writes, []);

    const sub = backHarness(); sub.hud.state.layer = 'sub'; sub.menu.kind = 2;
    sub.context.BayeHdCityMenu.start();
    sub.context.sendKey = key => {sub.keys.push(key); sub.menu.kind = 1; sub.menu.seq++;};
    sub.hud.back(); runBackQueue(sub); sub.intervals.at(-1)();
    assert.equal(sub.hud.state.open, true); assert.equal(sub.hud.state.layer, 'root');
    assert.deepEqual(sub.keys, [0x28]); assert.deepEqual(sub.writes, []);
});

test('queued Back cannot send Exit after its native menu retires or its sequence, generation, context or IDs change', () => {
    for (const change of [h => {h.menu.active = 0; h.raw.g_hdMapPick = 1; h.raw.g_hdMenuActive = 0;},
        h => {h.menu.seq++;}, h => {h.menu.detailGeneration++;}, h => {h.menu.context = 2;},
        h => {h.menu.ids.reverse();}]) {
        const h = backHarness(); h.hud.back(); change(h); runBackQueue(h);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('menu Back refuses reports and HELP, and a queued Exit refuses quantity takeover of an unchanged submenu', () => {
    for (const queued of [false, true]) {
        const changes = [h => {h.report.active = 1;}, h => {h.help.active = 1;},
            h => {h.context.BayeHdMiniMap = {isOpen: () => true};}, h => {h.context.baye.hd.report = () => null;}];
        if (queued) changes.push(h => {h.qty.active = 1;});
        for (const change of changes) {
            const h = backHarness(); h.hud.state.layer = 'sub';
            Object.assign(h.menu, {kind: 2, idsValid: false});
            if (queued) h.hud.back(); change(h);
            if (!queued) h.hud.back();
            runBackQueue(h); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
        }
    }
    const h = backHarness(); h.hud.back();
    h.context.baye.hd.report = () => {h.menu.seq++; return {active: 0};};
    runBackQueue(h); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('a held Back button cannot act on a replacement menu or a different map wait', () => {
    for (const change of [h => {h.menu.seq++;}, h => {h.menu.detailGeneration++;},
        h => {h.menu.ids.reverse();}, h => {h.raw.g_hdDetailGeneration++;}]) {
        const h = backHarness(); dispatch(h, 'pointerdown', h.backButton); change(h);
        dispatch(h, 'click', h.backButton, {detail: 1}); runBackQueue(h);
        assert.equal(h.hud.state.layer, 'deep'); assert.equal(h.hud.state.open, true);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
    const h = backHarness({retired: true});
    h.context.baye.hd.march = () => ({phase: 0, session: 0, mapInputSeq: h.raw.g_hdMapInputSeq});
    dispatch(h, 'pointerdown', h.backButton); h.raw.g_hdMapInputSeq++;
    dispatch(h, 'click', h.backButton, {detail: 1});
    assert.equal(h.hud.state.open, true); assert.deepEqual(h.keys, []);
});

test('a cancelled Back pointer stays inert, while a fresh pointer or keyboard action can return normally', () => {
    for (const action of ['pointer', 'keyboard']) {
        const h = backHarness(); dispatch(h, 'pointerdown', h.backButton);
        dispatch(h, 'pointercancel', h.backButton); dispatch(h, 'click', h.backButton, {detail: 1});
        assert.equal(h.hud.state.layer, 'deep'); assert.deepEqual(h.keys, []);
        if (action === 'pointer') dispatch(h, 'pointerdown', h.backButton);
        dispatch(h, 'click', h.backButton, {detail: action === 'keyboard' ? 0 : 1}); runBackQueue(h);
        assert.deepEqual(h.keys, [0x28], action); assert.deepEqual(h.writes, []);
    }
    const h = backHarness(); dispatch(h, 'pointerdown', h.backButton);
    dispatch(h, 'click', h.root, {detail: 1});
    assert.equal(h.hud.state.layer, 'deep'); assert.deepEqual(h.keys, []);
});

test('missing or invalid native map flags and another active overlay cannot certify retirement', () => {
    for (const change of [h => {delete h.raw.g_hdDetailGeneration;}, h => {delete h.raw.g_hdMapInputSeq;},
        h => {delete h.raw.g_hdMenuActive;}, h => {h.raw.g_hdMenuActive = '0';},
        h => {h.raw.g_hdMapInputSeq = NaN;}, h => {h.raw.g_hdBattlePick = 1;},
        h => {h.raw.g_hdMarchPhase = 4;}, h => {h.raw.g_hdReportActive = 1;},
        h => {h.raw.g_hdHelpActive = 1;}, h => {h.raw.g_asyncActionID = 7;},
        h => {h.context.BayeHdMiniMap = {isOpen: () => true};},
        h => {h.context.BayeHdSystemUi = {isOpen() {throw new Error('unreadable');}};}]) {
        const h = backHarness({retired: true}); change(h); h.hud.back(); runBackQueue(h);
        assert.equal(h.hud.state.open, true); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('reentrant overlay reads cannot close a replacement map wait or native menu', () => {
    for (const change of [h => {h.raw.g_hdMapInputSeq++;}, h => {h.raw.g_hdDetailGeneration++;},
        h => {h.raw.g_hdMenuActive = 1;}]) {
        const h = backHarness({retired: true});
        h.context.BayeHdMiniMap = {isOpen() {change(h); return false;}};
        h.hud.back(); runBackQueue(h);
        assert.equal(h.hud.state.open, true); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
    for (const publicMenu of [false, true]) {
        const h = backHarness({retired: true}); let reads = 0;
        Object.defineProperty(h.raw, 'g_asyncActionID', {get() {
            if (++reads === 2) {
                h.raw.g_hdMenuActive = 1; h.raw.g_hdMenuSeq++;
                if (publicMenu) {
                    h.raw.g_hdMapPick = 0;
                    Object.assign(h.menu, {active: 1, kind: 1, seq: h.raw.g_hdMenuSeq});
                }
            }
            return 0;
        }});
        h.hud.back(); runBackQueue(h);
        assert.equal(h.raw.g_hdMenuActive, 1); assert.equal(h.raw.g_hdMenuSeq, 10);
        assert.equal(h.hud.state.open, true); assert.equal(h.hud.state.layer, 'deep');
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

// BEGIN R17 SEARCH INCREMENT: insert after existing backHarness/runBackQueue helpers.
// This drives the real production chooseSub/start poll/DOM input chain, not a copied controller.
const searchSubNames = ['开垦', '招商', '搜寻', '治理', '出巡', '招降', '处斩', '流放', '赏赐', '没收', '交易', '宴请', '输送', '移动'];
function searchHarness({ delayed = false } = {}) {
    const h = backHarness();
    h.context.baye.hd.march = () => ({phase: 0, session: 0, mapCity: 1, pick: h.raw.g_hdMapPick, mapInputSeq: h.raw.g_hdMapInputSeq});
    Object.assign(h.hud.state, { layer: 'sub', subKind: 'neizheng', deepKind: '', deepLabel: '', deepMenuOwner: null, idleIndex: 2 });
    Object.assign(h.menu, { active: 1, context: 1, kind: 2, seq: 30, generation: 3, detailGeneration: 3,
        count: searchSubNames.length, index: 2, names: [...searchSubNames], idsValid: false, ids: [] });
    Object.assign(h.raw, { g_hdMenuSeq: 30, g_hdMenuActive: 1 });
    h.context.sendKey = key => h.keys.push(key);
    h.hud.chooseSub(2);
    assert.equal(h.hud.state.deepKind, 'person', 'SEARCH must enter the production person route');
    assert.equal(h.hud.state.deepLabel, '搜寻'); assert.equal(h.hud.state.wizardStep, 'none');
    assert.deepEqual(h.keys, [0x27], 'The player command issues only the existing native Enter');
    h.keys.length = 0; h.timers.length = 0;
    h.context.BayeHdCityMenu.start(); h.poll = h.intervals.at(-1);
    h.publishPeople = ({ seq = 31, ids = [600, 601], names = ids.map(id => h.names.get(id)), index = 0 } = {}) => {
        Object.assign(h.menu, { active: 1, context: 1, kind: 3, seq, generation: 3, detailGeneration: 3,
            count: ids.length, index, names, idsValid: true, ids: [...ids] });
        Object.assign(h.raw, {g_hdMenuSeq: seq, g_hdMenuActive: 1});
    };
    if (!delayed) { h.publishPeople(); h.poll(); }
    return h;
}
function searchRow(h, index = 0) { return h.document.querySelectorAll('[data-hd-deep]')[index]; }
function armSearch(h, index = 0) {
    const target = searchRow(h, index); assert.ok(target, 'An actual native row must exist before arming');
    dispatch(h, 'pointerdown', target); return target;
}

test('SEARCH real poll waits for a delayed native person menu, then reads the full owned U16 IDs without another input', () => {
    const h = searchHarness({delayed: true});
    for (let i = 0; i < 4; i++) h.poll();
    assert.equal(h.hud.state.deepItems.length, 0); assert.equal(h.hud.state.personDetail, null);
    assert.equal(h.document.querySelectorAll('[data-hd-deep]').length, 0);
    assert.deepEqual(h.keys, []);
    h.people[700] = {...h.person, Belong: 0}; h.people[701] = {...h.person, Belong: 65535};
    h.people[777] = {...h.person, Force: 77}; h.names.set(777, '真实高ID人物');
    h.queue.splice(7, 2, 600, 700, 701, 777); h.city.Persons = 4;
    h.publishPeople({ids: [600, 777]}); h.poll();
    assert.deepEqual(Array.from(h.hud.state.deepItems, row => row.pind), [600, 777]);
    assert.equal(h.hud.state.personDetail.personIndex, 600);
    assert.equal(searchRow(h, 1).getAttribute('data-hd-deep-pind'), '777');
    assert.ok(h.hud.state.deepItems.every(row => ![700, 701].includes(row.pind)));
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('SEARCH exact native IDs survive reordered duplicate names and use current native index for the person fields', () => {
    const h = searchHarness(); h.people[601].Force = 33;
    h.publishPeople({ids: [601, 600], names: ['同名人物', '同名人物'], index: 1}); h.poll();
    assert.deepEqual(Array.from(h.hud.state.deepItems, row => [row.i, row.pind]), [[0, 601], [1, 600]]);
    assert.equal(h.hud.state.personDetail.personIndex, 600); assert.equal(rows(h.hud.state.personDetail).武力, '91');
    h.menu.index = 0; h.poll();
    assert.equal(h.hud.state.personDetail.personIndex, 601); assert.equal(rows(h.hud.state.personDetail).武力, '33');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('SEARCH malformed claimed full-ID lists never attach a person by matching names', () => {
    for (const ids of [[600], [600, 65535], [600, '601'], [600, true]]) {
        const h = searchHarness(); h.menu.ids = ids; h.poll();
        assert.equal(h.hud.state.personDetail, null);
        assert.ok(h.hud.state.deepItems.every(row => row.pind === undefined));
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('SEARCH old held rows cannot confirm after a new native sequence, detail generation or same-name ID reorder', () => {
    for (const change of [h => { h.menu.seq++; h.raw.g_hdMenuSeq++; },
        h => { h.menu.detailGeneration++; h.raw.g_hdDetailGeneration++; },
        h => { h.menu.ids.reverse(); h.menu.names.reverse(); }, h => { h.menu.context = 2; }]) {
        const h = searchHarness(), target = armSearch(h);
        change(h); dispatch(h, 'click', target, {detail: 1});
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('SEARCH genuine inactive picker on native report takeover cannot confirm its old row', () => {
    const h = searchHarness(), target = armSearch(h);
    h.menu.active = 0; h.raw.g_hdMenuActive = 0; h.report.active = 1; h.raw.g_hdReportActive = 1;
    h.poll(); dispatch(h, 'click', target, {detail: 1});
    assert.equal(h.hud.state.personDetail, null); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

for (const field of ['report', 'help']) {
    test('SEARCH active underlying picker retained by ' + field + ' cannot receive an old pressed Enter', () => {
        const h = searchHarness(), target = armSearch(h);
        h[field].active = 1; h.raw[field === 'report' ? 'g_hdReportActive' : 'g_hdHelpActive'] = 1;
        h.poll(); assert.equal(h.hud.state.personDetail, null);
        dispatch(h, 'click', target, {detail: 1});
        assert.deepEqual(h.keys, [], field + ' owns input even if the old native menu remains active');
        assert.deepEqual(h.writes, []);
    });
}

test('SEARCH a delayed native Down ACK followed by report takeover must never send pending Enter', () => {
    const h = searchHarness(), target = armSearch(h, 1);
    dispatch(h, 'click', target, {detail: 1});
    assert.deepEqual(h.keys, [0x23], 'Only one native Down, waiting for the actual highlighted index ACK');
    assert.ok(h.hud.state.nativeMenuRequest); assert.equal(h.hud.state.personDetail, null);
    h.menu.index = 1; h.report.active = 1; h.raw.g_hdReportActive = 1;
    runBackQueue(h);
    assert.deepEqual(h.keys, [0x23], 'No Enter may be sent to the report after its takeover');
    assert.deepEqual(h.writes, []);
});

test('SEARCH a normal current row selection follows the actual native Down ACK and sends exactly one Enter', () => {
    const h = searchHarness(), target = armSearch(h, 1);
    dispatch(h, 'click', target, {detail: 1});
    assert.deepEqual(h.keys, [0x23]); assert.ok(h.hud.state.nativeMenuRequest);
    h.menu.index = 1; runBackQueue(h);
    assert.deepEqual(h.keys, [0x23, 0x27]); assert.equal(h.hud.state.nativeMenuRequest, null);
    assert.ok(h.hud.state.deepSelectionPending, 'Retain the existing pending selection until native menu transition');
    assert.equal(h.hud.state.personDetail, null); assert.deepEqual(h.writes, []);
});

test('SEARCH Back delivers exactly one Exit, waits for native map ACK/queue drain and does not alter the world', () => {
    const h = searchHarness();
    h.context.sendKey = key => {
        h.keys.push(key);
        if (key === 0x28) { h.menu.active = 0; h.raw.g_hdMenuActive = 0; h.raw.g_hdMapPick = 1; h.raw.g_hdMapInputSeq++; }
    };
    const target = h.backButton; dispatch(h, 'pointerdown', target); dispatch(h, 'click', target, {detail: 1});
    assert.equal(h.hud.state.personDetail, null); assert.equal(h.hud.state.open, true);
    h.poll(); assert.equal(h.hud.state.open, true, 'No map ACK before the queued native Exit');
    runBackQueue(h); h.poll();
    assert.deepEqual(h.keys, [0x28]); assert.equal(h.hud.state.open, false); assert.deepEqual(h.writes, []);
});

test('SEARCH Back refuses a report-held picker and a queued Exit retires on seq/generation/ID changes', () => {
    for (const change of [h => { h.menu.seq++; h.raw.g_hdMenuSeq++; },
        h => { h.menu.detailGeneration++; h.raw.g_hdDetailGeneration++; }, h => { h.menu.ids.reverse(); },
        h => { h.report.active = 1; h.raw.g_hdReportActive = 1; }]) {
        const h = searchHarness(); h.hud.back(); change(h); runBackQueue(h);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
    const h = searchHarness(); h.report.active = 1; h.raw.g_hdReportActive = 1;
    h.hud.back(); assert.equal(h.hud.state.layer, 'deep'); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});
// END R17 SEARCH INCREMENT
// BEGIN R17 SEARCH EXTRA: append after the candidate's BEGIN/END increment.
// All tests use its actual production harness, native owner fixtures and public DOM handlers.
test('SEARCH quantity takeover retains its own input and cannot confirm a held person row', () => {
    const h = searchHarness(), target = armSearch(h);
    // Actual NumOperate owns input only after its person menu closes.
    h.menu.active = 0; h.raw.g_hdMenuActive = 0;
    Object.assign(h.qty, {active: 1, min: 0, max: 800, value: 100}); h.raw.g_hdQtyActive = 1;
    h.hud.renderPersonDetails(); assert.equal(h.hud.state.personDetail, null);
    // The inherited HUD mock deliberately rejects nonempty HTML. Capture only
    // the real quantity summary/control markup here; do not simulate its controls.
    const create = h.document.createElement; let qtyMarkup = '';
    h.document.createElement = tag => new Proxy(create(tag), {set(node, key, value) {
        if (key === 'innerHTML' && value !== '' && /^<p class="hd-city-menu-qty-summary">数量 /.test(value)) {
            assert.match(value, /^<p class="hd-city-menu-qty-summary">数量 <strong id="hd-city-qty-val">100<\/strong>/);
            assert.match(value, /<\/p><div class="hd-city-menu-qty-controls"><button/);
            assert.match(value, /data-hd-qty-ok/); qtyMarkup = value; node.textContent = ''; return true;
        }
        return Reflect.set(node, key, value);
    }});
    dispatch(h, 'click', target, {detail: 1});
    assert.ok(qtyMarkup, 'The real quantity owner is rendered instead of confirming the old person');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('SEARCH pending native selection cannot send Enter after quantity takes over before its Down ACK', () => {
    const h = searchHarness(), target = armSearch(h, 1);
    dispatch(h, 'click', target, {detail: 1}); assert.deepEqual(h.keys, [0x23]);
    h.menu.index = 1; h.menu.active = 0; h.raw.g_hdMenuActive = 0;
    Object.assign(h.qty, {active: 1, min: 0, max: 800, value: 100}); h.raw.g_hdQtyActive = 1;
    runBackQueue(h);
    assert.deepEqual(h.keys, [0x23]); assert.deepEqual(h.writes, []);
});

for (const change of ['seq', 'generation', 'report']) {
    test('SEARCH final engineSendKey read-only fight getter reentry into ' + change + ' retires the pending native Enter', () => {
        const h = searchHarness(), target = armSearch(h); let triggered = false;
        Object.defineProperty(h.raw, 'g_hdFightActive', {configurable: true, get() {
            // Target the actual final engineSendKey read after its earlier controller checks.
            // No copied gate logic: the VM's real stack identifies this boundary.
            if (!triggered && /at engineSendKey\b/.test(new Error().stack)) {
                triggered = true;
                if (change === 'seq') { h.menu.seq++; h.raw.g_hdMenuSeq++; }
                if (change === 'generation') { h.menu.detailGeneration++; h.raw.g_hdDetailGeneration++; }
                if (change === 'report') { h.report.active = 1; h.raw.g_hdReportActive = 1; }
            }
            return 0;
        }});
        dispatch(h, 'click', target, {detail: 1});
        assert.equal(triggered, true, 'The production final send boundary must actually be exercised');
        assert.deepEqual(h.keys, [], 'A getter retirement must be checked again immediately before native send');
        assert.deepEqual(h.writes, []);
        // The failed final send must not leave a committed key blocking a later real action.
        Object.defineProperty(h.raw, 'g_hdFightActive', {configurable: true, writable: true, value: 0});
        h.report.active = 0; h.raw.g_hdReportActive = 0;
        h.poll(); const fresh = armSearch(h);
        dispatch(h, 'click', fresh, {detail: 1});
        assert.deepEqual(h.keys, [0x27], 'A fresh current-owner player action remains usable after the refused final send');
        assert.deepEqual(h.writes, []);
    });
}

test('SEARCH confirmed person stays retired until a fresh complete native owner arrives and an old held pointer cannot confirm it', () => {
    const h = searchHarness(), first = armSearch(h);
    dispatch(h, 'click', first, {detail: 1}); assert.deepEqual(h.keys, [0x27]);
    assert.ok(h.hud.state.deepSelectionPending); assert.equal(h.hud.state.personDetail, null);
    const oldHeld = armSearch(h, 1);
    h.poll();
    assert.equal(h.hud.state.deepItems.length, 0); assert.equal(h.hud.state.deepMenuOwner, null);
    assert.equal(h.hud.state.personDetail, null); assert.deepEqual(h.keys, [0x27]);
    // Model the real C menu close/report and then reopening; no JS auto confirmation.
    h.menu.active = 0; h.raw.g_hdMenuActive = 0; h.report.active = 1; h.raw.g_hdReportActive = 1;
    h.poll(); assert.equal(h.hud.state.personDetail, null);
    h.report.active = 0; h.raw.g_hdReportActive = 0; h.menu.active = 1; h.raw.g_hdMenuActive = 1;
    h.poll(); assert.equal(h.hud.state.deepItems.length, 0, 'The old seq is not a fresh native list');
    h.publishPeople({seq: 32, ids: [601]}); h.poll();
    assert.deepEqual(Array.from(h.hud.state.deepItems, row => row.pind), [601]);
    assert.equal(h.hud.state.personDetail.personIndex, 601); assert.equal(h.hud.state.deepSelectionPending, null);
    const fresh = searchRow(h); assert.notEqual(fresh, oldHeld);
    dispatch(h, 'click', fresh, {detail: 1}); assert.deepEqual(h.keys, [0x27], 'Old press cannot confirm a different native owner');
    dispatch(h, 'pointerdown', fresh); dispatch(h, 'click', fresh, {detail: 1});
    assert.deepEqual(h.keys, [0x27, 0x27], 'Only a fresh player action can confirm the new owner');
    assert.deepEqual(h.writes, []);
});
// END R17 SEARCH EXTRA

// BEGIN R17 SEARCH EXTRA2: append after extra1; plain fresh snapshots expose reentry ordering.
for (const action of ['Enter', 'Arrow']) {
    for (const change of ['seq', 'ids']) {
        test('SEARCH final inactive report getter returning plain menu clones retires ' + action + ' on changed ' + change + ', then allows a fresh click', () => {
            const h = searchHarness();
            h.publishPeople({names: ['同名人物', '同名人物']}); h.poll();
            // Every public menu read is a distinct snapshot, as the real bridge returns.
            h.context.baye.hd.menuItems = () => plain(h.menu);
            const target = armSearch(h, action === 'Enter' ? 0 : 1); let triggered = false;
            h.context.baye.hd.report = () => {
                if (!triggered && /at engineSendKey\b/.test(new Error().stack)) {
                    triggered = true;
                    if (change === 'seq') { h.menu.seq++; h.raw.g_hdMenuSeq++; }
                    else { h.menu.ids.reverse(); }
                }
                return {active: 0}; // The read reenters a new owner without exposing an active report.
            };
            dispatch(h, 'click', target, {detail: 1});
            assert.equal(triggered, true, 'Exercise the actual final-send currentOwner check');
            assert.deepEqual(h.keys, [], 'Neither the old Arrow nor Enter may reach the replacement menu');
            assert.equal(h.hud.state.nativeMenuRequest, null);
            h.context.baye.hd.report = () => h.report;
            h.poll(); const fresh = armSearch(h);
            dispatch(h, 'click', fresh, {detail: 1});
            assert.deepEqual(h.keys, [0x27], 'Refusing the final send must not leave a false committed selection');
            assert.deepEqual(h.writes, []);
        });
    }
}
// END R17 SEARCH EXTRA2

// R18: exercise actual production native-property DOM and final key sending.
test('person native properties remain separate from all fifteen default core fields and the persistent portrait slot', () => {
    const h = personPropertyHarness({count: 13, custom: false}), pane = h.document.getElementById('hd-city-menu-person-properties');
    const core = h.document.getElementById('hd-city-menu-person-fields'), slot = h.document.getElementById('hd-city-menu-person-portrait');
    const figure = element('figure'); slot.appendChild(figure);
    assert.equal(core.querySelectorAll('.hd-city-menu-stat').length, 15);
    assert.equal(pane.querySelectorAll('.hd-city-menu-stat').length, 0);
    assert.equal(h.document.querySelectorAll('[data-hd-person-property]').length, 13);
    assert.equal(pane.parentElement, core.parentElement); assert.equal(pane.parentElement, slot.parentElement);
    assert.equal(h.hud.state.personProperties.personIndex, 600); assert.equal(h.hud.lcdPresentation(), 'off');
    h.person.Thew = 47; h.hud.fillDeepList();
    assert.equal(h.document.getElementById('hd-city-menu-person-properties'), pane);
    assert.equal(figure.parentElement, slot); assert.equal(rows(h.hud.state.personDetail).体力, '47');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    assert.match(read('css/hd-city-menu.css'), /person-property-controls button[^}]*min-height:\s*44px/);
});

test('unknown LIB and custom native twelve-property text is authoritative without extra property hooks or inferred labels', () => {
    const h = personPropertyHarness({count: 12}); h.setIdentity({status: 'ready', generation: 6, sha256: 'unknown'});
    let calls = 0; h.context.baye.hooks = {getPersonPropertyValue() { calls++; throw new Error('extra hook'); },
        getPersonPropertyTitle() { calls++; throw new Error('extra hook'); }};
    Object.assign(h.personProps.properties[0], {title: '<img onerror=evil>Mod实际标题', value: '真实原生中文\n0'});
    h.hud.fillDeepList();
    const text = h.document.getElementById('hd-city-menu-person-properties').textContent;
    assert.match(text, /<img onerror=evil>Mod实际标题/); assert.match(text, /真实原生中文/);
    assert.equal(h.hud.state.personProperties.custom, true); assert.equal(h.hud.state.personProperties.propertyCount, 12);
    assert.equal(h.hud.lcdPresentation(), 'off'); assert.equal(calls, 0); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('captured empty values differ from unread columns, and prior paint observations are labeled honestly', () => {
    const h = personPropertyHarness(); Object.assign(h.personProps.properties[0], {title: '原生空值属性', value: ''});
    h.hud.fillDeepList();
    const row = h.document.querySelectorAll('[data-hd-person-property]')[0];
    assert.match(row.textContent, /原生空值属性.*（空）.*当前页/);
    assert.equal(row.getAttribute('data-hd-person-property-title-paint-seq'), '40');
    assert.equal(row.getAttribute('data-hd-person-property-value-paint-seq'), '40');
    assert.match(h.document.querySelectorAll('[data-hd-person-property]')[4].textContent, /未读取/);
    paintPersonPage(h);
    assert.equal(h.hud.state.personProperties.complete, true); assert.equal(h.hud.state.personProperties.pageComplete, true);
    assert.equal(h.hud.state.personProperties.properties[0].current, false);
    assert.match(h.document.querySelectorAll('[data-hd-person-property]')[0].textContent, /此前读取/);
    assert.match(h.document.querySelectorAll('[data-hd-person-property]')[4].textContent, /当前页/);
    assert.equal(h.document.querySelectorAll('[data-hd-person-property]')[4].getAttribute('data-hd-person-property-value-paint-seq'), '41');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('actual duplicate-name U16 rows and current selected ID control native property identity', () => {
    const h = personPropertyHarness(); h.menu.names = ['同名人物', '同名人物']; h.menu.ids = [601, 600];
    h.menu.index = 1; h.personProps.index = 1; h.personProps.person = 600; h.personProps.name = '同名人物';
    h.hud.fillDeepList(); assert.equal(h.hud.state.personProperties.personIndex, 600);
    h.menu.index = 0; h.personProps.index = 0; h.personProps.person = 601; h.personProps.paintSeq = 42;
    for (const p of h.personProps.properties.slice(0, 3)) p.titlePaintSeq = p.valuePaintSeq = 42;
    h.hud.fillDeepList(); assert.equal(h.hud.state.personProperties.personIndex, 601);
    assert.equal(h.hud.state.personDetail.personIndex, 601); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('manual person paging sends one native key and requires a fresh paint and actual page ACK', () => {
    const h = personPropertyHarness(), next = personPageButton(h, 'next'), prev = personPageButton(h, 'prev');
    assert.equal(prev.disabled, true); dispatch(h, 'click', prev); assert.deepEqual(h.keys, []);
    dispatch(h, 'pointerdown', next); dispatch(h, 'click', next); assert.deepEqual(h.keys, [0x25]);
    assert.ok(h.hud.state.personPagePending); assert.equal(next.disabled, true);
    for (let i = 0; i < 3; i++) { h.hud.fillDeepList(); dispatch(h, 'click', next); }
    assert.deepEqual(h.keys, [0x25]); assert.equal(h.hud.state.personProperties.pageIndex, 0);
    // A native repaint of the same page is not a page ACK.
    h.personProps.paintSeq = 41; for (const p of h.personProps.properties.slice(0, 3)) p.titlePaintSeq = p.valuePaintSeq = 41;
    h.hud.fillDeepList(); assert.ok(h.hud.state.personPagePending); assert.equal(next.disabled, true);
    paintPersonPage(h, {paintSeq: 42}); assert.equal(h.hud.state.personPagePending, null);
    assert.equal(next.disabled, true); assert.equal(prev.disabled, false);
    dispatch(h, 'click', next); assert.deepEqual(h.keys, [0x25]);
    dispatch(h, 'pointerdown', prev); dispatch(h, 'click', prev); assert.deepEqual(h.keys, [0x25, 0x24]);
    paintPersonPage(h, {start: 0, end: 3, pageIndex: 0, paintSeq: 43});
    assert.equal(h.hud.state.personPagePending, null); assert.equal(prev.disabled, true); assert.deepEqual(h.writes, []);
});

test('zero columns, incomplete current paint and unsupported bridge retain LCD without inventing page inputs', () => {
    for (const change of [h => { h.personProps.pageComplete = 0; }, h => { delete h.context.baye.hd.personProperties; },
        h => { h.personProps.active = 0; }, h => { h.personProps.protocolVersion = 2; }]) {
        const h = personPropertyHarness(); change(h); h.hud.fillDeepList();
        assert.equal(h.hud.lcdPresentation(), 'on'); const next = personPageButton(h, 'next');
        if (next) dispatch(h, 'click', next); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
    const zero = personPropertyHarness({count: 0, end: 0});
    assert.equal(zero.hud.state.personProperties.pageComplete, false); assert.equal(zero.hud.lcdPresentation(), 'on');
    assert.equal(personPageButton(zero, 'next').disabled, true); assert.equal(personPageButton(zero, 'prev').disabled, true);
    assert.deepEqual(zero.keys, []);
});

test('person property protocol rejects stale owner, malformed revisions and false complete pages conservatively', () => {
    for (const change of [h => { h.personProps.context = 2; }, h => { h.personProps.kind = 4; },
        h => { h.personProps.menuSeq++; }, h => { h.personProps.generation++; }, h => { h.personProps.detailGeneration++; },
        h => { h.personProps.index = 1; }, h => { h.personProps.person = 601; }, h => { h.menu.ids = [600]; },
        h => { h.personProps.person = 65535; }, h => { h.personProps.paintSeq = 0; },
        h => { h.personProps.properties[0].titlePaintSeq = 39; }, h => { h.personProps.properties[0].captured = false; },
        h => { h.personProps.complete = 1; }, h => { h.personProps.properties[0].valuePaintSeq = '40'; },
        h => { h.personProps.properties[0].value = {}; }, h => { h.personProps.properties[0].title = ''; },
        h => { h.personProps.name = ''; }]) {
        const h = personPropertyHarness(); change(h); h.hud.fillDeepList();
        assert.equal(h.hud.state.personProperties, null); assert.equal(h.hud.lcdPresentation(), 'on');
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

for (const change of ['report', 'help', 'qty', 'hidden', 'classic', 'pending', 'queue', 'closed']) {
    test('person property '+change+' takeover retires an old held page and a fresh click stays usable', () => {
        const h = personPropertyHarness(), next = personPageButton(h, 'next'); dispatch(h, 'pointerdown', next);
        const old = next.getAttribute('data-hd-person-page-owner');
        if (change === 'report') h.report.active = 1;
        if (change === 'help') h.help.active = 1;
        if (change === 'qty') h.qty.active = 1;
        if (change === 'hidden') { h.document.hidden = true; h.documentListeners.get('visibilitychange').forEach(fn => fn()); }
        if (change === 'classic') h.context.localStorage.getItem = () => 'classic';
        if (change === 'pending') h.hud.state.deepSelectionPending = {seq: 9};
        if (change === 'queue') h.hud.state.queue.push({code: 0x23});
        if (change === 'closed') h.hud.state.open = false;
        h.hud.renderPersonDetails(); assert.equal(h.hud.state.personProperties, null);
        assert.equal(h.document.getElementById('hd-city-menu-person-properties').hidden, true);
        h.report.active = h.help.active = h.qty.active = 0; h.document.hidden = false;
        h.context.localStorage.getItem = key => key === 'baye/cityMenuMode' ? 'hd' : 'hd-map';
        h.hud.state.deepSelectionPending = null; h.hud.state.queue.length = 0; h.hud.state.open = true;
        h.hud.fillDeepList(); assert.notEqual(next.getAttribute('data-hd-person-page-owner'), old);
        dispatch(h, 'click', next, {detail: 1}); assert.deepEqual(h.keys, []);
        dispatch(h, 'pointerdown', next); dispatch(h, 'click', next, {detail: 1}); assert.deepEqual(h.keys, [0x25]);
        assert.deepEqual(h.writes, []);
    });
}

test('a cancelled person page press and a page-to-person cross-control click cannot confirm anyone', () => {
    const h = personPropertyHarness(), next = personPageButton(h, 'next');
    dispatch(h, 'pointerdown', next); dispatch(h, 'pointercancel', next); dispatch(h, 'click', next, {detail: 1});
    assert.deepEqual(h.keys, []);
    dispatch(h, 'pointerdown', next); dispatch(h, 'click', h.document.querySelectorAll('[data-hd-deep]')[0], {detail: 1});
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    dispatch(h, 'click', next, {detail: 0}); assert.deepEqual(h.keys, [0x25], 'Fresh keyboard activation is independent of a stale press');
});

for (const change of ['seq', 'generation', 'paint', 'report']) {
    test('person property final native send getter reentry into '+change+' sends zero keys, then permits a fresh click', () => {
        const h = personPropertyHarness(), next = personPageButton(h, 'next'); let triggered = false;
        h.context.baye.hd.menuItems = () => plain(h.menu);
        Object.defineProperty(h.raw, 'g_hdFightActive', {configurable: true, get() {
            if (!triggered && /at engineSendKey\b/.test(new Error().stack)) {
                triggered = true;
                if (change === 'seq') { h.menu.seq++; h.personProps.menuSeq++; }
                if (change === 'generation') { h.menu.generation++; h.menu.detailGeneration++; h.personProps.generation++; h.personProps.detailGeneration++; }
                if (change === 'paint') { h.personProps.paintSeq++; for (const p of h.personProps.properties.slice(0, 3)) p.titlePaintSeq = p.valuePaintSeq = h.personProps.paintSeq; }
                if (change === 'report') h.report.active = 1;
            } return 0;
        }});
        dispatch(h, 'pointerdown', next); dispatch(h, 'click', next, {detail: 1});
        assert.equal(triggered, true); assert.deepEqual(h.keys, []); assert.equal(h.hud.state.personPagePending, null);
        Object.defineProperty(h.raw, 'g_hdFightActive', {configurable: true, writable: true, value: 0}); h.report.active = 0;
        h.hud.fillDeepList(); dispatch(h, 'pointerdown', next); dispatch(h, 'click', next, {detail: 1});
        assert.deepEqual(h.keys, [0x25]); assert.deepEqual(h.writes, []);
    });
}

test('an inactive overlay getter replacing a cloned menu cannot page the former owner', () => {
    const h = personPropertyHarness(), next = personPageButton(h, 'next'); let triggered = false;
    h.context.baye.hd.menuItems = () => plain(h.menu);
    h.context.baye.hd.report = () => {
        if (!triggered && /at engineSendKey\b/.test(new Error().stack)) {
            triggered = true; h.menu.seq++; h.personProps.menuSeq++;
        } return {active: 0};
    };
    dispatch(h, 'pointerdown', next); dispatch(h, 'click', next, {detail: 1});
    assert.equal(triggered, true); assert.deepEqual(h.keys, []); assert.equal(h.hud.state.personPagePending, null);
    h.context.baye.hd.report = () => h.report; h.hud.fillDeepList();
    dispatch(h, 'pointerdown', next); dispatch(h, 'click', next, {detail: 1}); assert.deepEqual(h.keys, [0x25]);
    assert.deepEqual(h.writes, []);
});

test('cancelling the person property menu keeps the original single Exit and hides the persistent section', () => {
    const h = personPropertyHarness(); h.hud.state.subKind = 'neizheng'; h.hud.back();
    assert.equal(h.hud.state.personProperties, null); assert.equal(h.document.getElementById('hd-city-menu-person-properties').hidden, true);
    h.timers.shift()(); assert.deepEqual(h.keys, [0x28]); assert.deepEqual(h.writes, []);
});


test('the actual maximum property page never wraps right, and 255 columns remain explicit', () => {
    const h = personPropertyHarness({count: 255, end: 0});
    Object.assign(h.personProps, {paintSeq: 70, pageIndex: 254, pageStart: 254, pageEnd: 255, pageComplete: 1});
    Object.assign(h.personProps.properties[254], {title: '原生最后一列', value: '255列的真实值',
        captured: true, titleCaptured: true, valueCaptured: true, titlePaintSeq: 70, valuePaintSeq: 70});
    h.hud.fillDeepList(); assert.equal(h.hud.state.personProperties.propertyCount, 255);
    const next = personPageButton(h, 'next'); assert.equal(next.disabled, true);
    for (let i = 0; i < 3; i++) dispatch(h, 'click', next); assert.deepEqual(h.keys, []);
    dispatch(h, 'click', personPageButton(h, 'prev')); assert.deepEqual(h.keys, [0x24]); assert.deepEqual(h.writes, []);
});

test('read-only native property snapshot reentry cannot publish a mixed paint or changed menu', () => {
    for (const change of ['paint', 'seq']) {
        const h = personPropertyHarness(); let reads = 0;
        h.context.baye.hd.personProperties = () => {
            const captured = plain(h.personProps);
            if (++reads === 1) {
                if (change === 'paint') { h.personProps.paintSeq++; for (const p of h.personProps.properties.slice(0, 3)) p.titlePaintSeq = p.valuePaintSeq = h.personProps.paintSeq; }
                if (change === 'seq') { h.menu.seq++; h.personProps.menuSeq++; }
            }
            return captured;
        };
        h.hud.renderPersonProperties(); assert.equal(h.hud.state.personProperties, null);
        assert.equal(h.document.getElementById('hd-city-menu-person-properties').hidden, true);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('native property configuration and same-name ID replacement retire an armed page button', () => {
    for (const change of ['propertyCount', 'ids']) {
        const h = personPropertyHarness(), next = personPageButton(h, 'next'); dispatch(h, 'pointerdown', next);
        if (change === 'propertyCount') {
            h.personProps.propertyCount = 6;
            h.personProps.properties.push({index: 5, title: '', value: '', captured: false,
                titleCaptured: false, valueCaptured: false, titlePaintSeq: 0, valuePaintSeq: 0});
        } else { h.menu.ids.reverse(); h.menu.names = ['同名', '同名']; h.personProps.person = 601; h.personProps.name = '同名'; }
        h.hud.fillDeepList(); dispatch(h, 'click', next, {detail: 1}); assert.deepEqual(h.keys, []);
        dispatch(h, 'pointerdown', next); dispatch(h, 'click', next, {detail: 1}); assert.deepEqual(h.keys, [0x25]);
        assert.deepEqual(h.writes, []);
    }
});


function personModeHarness() {
    const h = personPropertyHarness();
    const storage = new Map([['baye/cityMenuMode', 'hd'], ['baye/overworldMode', 'hd-map']]);
    h.context.localStorage = {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value))};
    Object.assign(h.hud.state, {subKind: 'neizheng', deepLabel: '搜寻'});
    Object.assign(h.report, {seq: 0}); Object.assign(h.help, {seq: 0}); Object.assign(h.qty, {session: 2});
    const fight = {active: 0}, march = {phase: 0, session: 0, inputSeq: 0, origin: 255, selected: 0,
        mapCity: 1, mapInputSeq: 2, pick: 0, battlePick: 0};
    h.context.baye.hd.fight = () => fight; h.context.baye.hd.march = () => march;
    Object.assign(h.raw, {g_hdDetailGeneration: 3, g_hdMenuSeq: 9, g_hdMenuActive: 1,
        g_hdMenuContext: 1, g_hdMenuKind: 3, g_hdMapCity: 1, g_hdMapInputSeq: 2,
        g_hdMapPick: 0, g_hdBattlePick: 0, g_hdMarchPhase: 0, g_hdMarchSession: 0, g_hdMarchInputSeq: 0,
        g_hdReportActive: 0, g_hdHelpActive: 0, g_hdQtyActive: 0, g_hdFightActive: 0});
    h.backButton = element('button'); h.backButton.setAttribute('data-hd-menu-back', ''); h.root.appendChild(h.backButton);
    h.context.BayeHdCityMenu.start();
    return Object.assign(h, {storage, fight, march, poll: h.intervals.at(-1)});
}

test('real public classic-to-HD restores only the previously open same-owner PERSON menu with no engine writes or keys', () => {
    const h = personModeHarness(), initial = plain(h.raw);
    h.context.BayeHdCityMenu.setMode('classic');
    assert.equal(h.storage.get('baye/cityMenuMode'), 'classic'); assert.equal(h.hud.state.open, false);
    assert.equal(h.hud.state.personProperties, null); assert.ok(h.hud.state.personModeResume);
    h.context.BayeHdCityMenu.setMode('hd');
    assert.equal(h.hud.state.open, true); assert.equal(h.hud.state.deepKind, 'person'); assert.equal(h.hud.state.deepLabel, '搜寻');
    assert.equal(h.hud.state.personDetail.personIndex, 600); assert.equal(h.hud.state.personProperties.paintSeq, 40);
    assert.equal(h.hud.state.personModeResume, null); assert.equal(h.hud.lcdPresentation(), 'off');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []); assert.deepEqual(plain(h.raw), initial);
});

test('real mode restoration samples the native current highlight and page rather than restoring the old person or paint', () => {
    const h = personModeHarness(); h.context.BayeHdCityMenu.setMode('classic');
    h.menu.index = 1; Object.assign(h.personProps, {index: 1, person: 601, name: h.names.get(601)});
    paintPersonPage(h, {start: 3, end: 5, pageIndex: 1, paintSeq: 44});
    // The engine's native redraw occurred during classic mode; no local open is changed here.
    assert.equal(h.hud.state.open, false);
    h.context.BayeHdCityMenu.setMode('hd');
    assert.equal(h.hud.state.open, true); assert.equal(h.hud.state.personDetail.personIndex, 601);
    assert.equal(h.hud.state.idleIndex, 1); assert.equal(h.hud.state.personProperties.pageIndex, 1);
    assert.equal(h.hud.state.personProperties.paintSeq, 44); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

for (const change of ['seq', 'generation', 'ids', 'names', 'city', 'context', 'kind', 'inactive', 'missing-ids',
    'report', 'help', 'qty', 'fight', 'march', 'map-pick', 'missing-raw', 'report-ended', 'help-ended', 'qty-ended']) {
    test('real classic-to-HD refuses a retired PERSON owner after '+change, () => {
        const h = personModeHarness(); h.context.BayeHdCityMenu.setMode('classic');
        if (change === 'seq') { h.menu.seq++; h.raw.g_hdMenuSeq++; h.personProps.menuSeq++; }
        if (change === 'generation') { h.menu.generation++; h.menu.detailGeneration++; h.raw.g_hdDetailGeneration++; h.personProps.generation++; h.personProps.detailGeneration++; }
        if (change === 'ids') h.menu.ids.reverse();
        if (change === 'names') h.menu.names.reverse();
        if (change === 'city') { h.march.mapCity = 2; h.raw.g_hdMapCity = 2; }
        if (change === 'context') { h.menu.context = 2; h.raw.g_hdMenuContext = 2; }
        if (change === 'kind') { h.menu.kind = 2; h.raw.g_hdMenuKind = 2; }
        if (change === 'inactive') { h.menu.active = 0; h.raw.g_hdMenuActive = 0; }
        if (change === 'missing-ids') h.menu.idsValid = false;
        if (change === 'report') { h.report.active = h.raw.g_hdReportActive = 1; }
        if (change === 'help') { h.help.active = h.raw.g_hdHelpActive = 1; }
        if (change === 'qty') { h.qty.active = h.raw.g_hdQtyActive = 1; }
        if (change === 'fight') { h.fight.active = h.raw.g_hdFightActive = 1; }
        if (change === 'march') { h.march.phase = h.raw.g_hdMarchPhase = 1; }
        if (change === 'map-pick') { h.march.pick = h.raw.g_hdMapPick = 1; }
        if (change === 'missing-raw') delete h.raw.g_hdMenuContext;
        // Actual observers advance these tokens even if a report/help/quantity has ended before mode returns.
        if (change === 'report-ended') h.report.seq++;
        if (change === 'help-ended') h.help.seq++;
        if (change === 'qty-ended') h.qty.session++;
        h.context.BayeHdCityMenu.setMode('hd');
        assert.equal(h.hud.state.open, false); assert.equal(h.hud.state.personProperties, null);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    });
}

test('a report seen by the real classic poll permanently retires its previous restore ticket even after it closes', () => {
    const h = personModeHarness(); h.context.BayeHdCityMenu.setMode('classic');
    h.report.active = h.raw.g_hdReportActive = 1; h.poll(); assert.equal(h.hud.state.personModeResume, null);
    h.report.active = h.raw.g_hdReportActive = 0; h.context.BayeHdCityMenu.setMode('hd');
    assert.equal(h.hud.state.open, false); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

for (const control of ['property', 'person', 'back']) {
    for (const fresh of ['pointer', 'keyboard']) {
        test('real mode boundary retires an old '+control+' press and accepts a fresh '+fresh+' action', () => {
            const h = personModeHarness();
            const target = () => control === 'property' ? personPageButton(h, 'next') :
                control === 'person' ? h.document.querySelectorAll('[data-hd-deep]')[0] : h.backButton;
            dispatch(h, 'pointerdown', target());
            h.context.BayeHdCityMenu.setMode('classic'); h.context.BayeHdCityMenu.setMode('hd');
            assert.equal(h.hud.state.open, true);
            dispatch(h, 'click', target(), {detail: 1}); runBackQueue(h); assert.deepEqual(h.keys, []);
            if (fresh === 'pointer') dispatch(h, 'pointerdown', target());
            dispatch(h, 'click', target(), {detail: fresh === 'keyboard' ? 0 : 1}); runBackQueue(h);
            assert.deepEqual(h.keys, [control === 'property' ? 0x25 : control === 'person' ? 0x27 : 0x28]);
            assert.deepEqual(h.writes, []);
        });
    }
}

test('an initially closed HD menu or an unsupported workflow never manufactures a PERSON restore ticket', () => {
    for (const setup of [h => {h.hud.state.open = false;}, h => {h.hud.state.deepKind = 'person-qty';},
        h => {h.hud.state.layer = 'sub';}, h => {h.hud.state.nativeMenuRequest = {pending: true};},
        h => {h.hud.state.cityIndex = -1; h.march.mapCity = h.raw.g_hdMapCity = 0;}]) {
        const h = personModeHarness(); setup(h); h.context.BayeHdCityMenu.setMode('classic');
        assert.equal(h.hud.state.personModeResume, null); h.context.BayeHdCityMenu.setMode('hd');
        assert.equal(h.hud.state.open, false); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

test('fresh keyboard activation works with an old property, person or Back press still held across real mode restoration', () => {
    for (const control of ['property', 'person', 'back']) {
        const h = personModeHarness();
        const target = () => control === 'property' ? personPageButton(h, 'next') :
            control === 'person' ? h.document.querySelectorAll('[data-hd-deep]')[0] : h.backButton;
        dispatch(h, 'pointerdown', target());
        h.context.BayeHdCityMenu.setMode('classic'); h.context.BayeHdCityMenu.setMode('hd');
        assert.equal(h.hud.state.open, true);
        dispatch(h, 'click', target(), {detail: 0}); runBackQueue(h);
        assert.deepEqual(h.keys, [control === 'property' ? 0x25 : control === 'person' ? 0x27 : 0x28]);
        assert.deepEqual(h.writes, []);
    }
});

test('actual march mode restoration keeps its existing PERSONS path instead of using ordinary PERSON recovery', () => {
    const h = personModeHarness(); Object.assign(h.hud.state, {marchSession: 7, marchOriginIndex: 0, battleMake: true});
    Object.assign(h.march, {phase: 1, session: 7, origin: 0}); h.raw.g_hdMarchPhase = 1;
    h.context.BayeHdCityMenu.setMode('classic'); assert.equal(h.hud.state.personModeResume, null);
    h.context.BayeHdCityMenu.setMode('hd'); assert.equal(h.hud.state.open, true);
    assert.equal(h.hud.state.deepKind, 'person-city'); assert.equal(h.hud.state.deepLabel, '出征');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

for (const moment of ['owner-read', 'render']) {
    test('temporary getter reentry during actual mode '+moment+' cannot resurrect its previous PERSON pane', () => {
        const h = personModeHarness(); h.context.BayeHdCityMenu.setMode('classic'); let changed = false;
        h.context.baye.hd.menuItems = () => plain(h.menu);
        if (moment === 'owner-read') h.context.baye.hd.report = () => {
            if (!changed && h.storage.get('baye/cityMenuMode') === 'hd') {
                changed = true; h.menu.seq++; h.raw.g_hdMenuSeq++; h.personProps.menuSeq++;
            } return {...h.report};
        };
        else h.context.baye.getCityName = () => {
            if (!changed && h.storage.get('baye/cityMenuMode') === 'hd' && h.hud.state.open) {
                changed = true; h.menu.seq++; h.raw.g_hdMenuSeq++; h.personProps.menuSeq++;
            } return '长安';
        };
        h.context.BayeHdCityMenu.setMode('hd'); assert.equal(changed, true);
        assert.equal(h.hud.state.open, false); assert.equal(h.hud.state.personProperties, null);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    });
}

test('getter reentry in the final public setMode render retires the resumed PERSON pane with no native input', () => {
    const h = personModeHarness(); h.context.BayeHdCityMenu.setMode('classic'); let changed = false;
    h.context.baye.hd.menuItems = () => plain(h.menu);
    h.context.baye.getCityName = () => {
        const stack = new Error().stack;
        if (!changed && h.storage.get('baye/cityMenuMode') === 'hd' && h.hud.state.open &&
            /\bsetMenuMode\b/.test(stack) && !/\b(?:syncMode|resumePersonMode)\b/.test(stack)) {
            changed = true; h.menu.seq++; h.raw.g_hdMenuSeq++; h.personProps.menuSeq++;
        }
        return '长安';
    };
    h.context.BayeHdCityMenu.setMode('hd'); assert.equal(changed, true);
    assert.equal(h.hud.state.open, false); assert.equal(h.hud.state.personProperties, null);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('person property user labels stay readable while exact paint revisions remain in debug and DOM data', () => {
    const h = personModeHarness(); h.personProps.custom = 0; paintPersonPage(h);
    const text = h.document.getElementById('hd-city-menu-person-properties').textContent;
    assert.match(text, /当前页 2；累计已查看 5 \/ 5 项/); assert.match(text, /此前读取/);
    assert.doesNotMatch(text, /绘制代次|本次绘制|旧观察：标题/);
    assert.equal(h.context.BayeHdCityMenu.debugSnapshot().personProperties.paintSeq, 41);
    assert.equal(h.document.getElementById('hd-city-menu-person-properties-fields').getAttribute('data-hd-person-paint-seq'), '41');
    const row = h.document.querySelectorAll('[data-hd-person-property]')[0];
    assert.equal(row.getAttribute('data-hd-person-property-title-paint-seq'), '40');
    assert.equal(row.getAttribute('data-hd-person-property-value-paint-seq'), '40');
    assert.equal(h.document.getElementById('hd-city-menu-person-fields').querySelectorAll('.hd-city-menu-stat').length, 15);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('validated current custom properties replace fixed meanings while all fifteen raw fields remain diagnostic and portraits persist', () => {
    const h = personPropertyHarness({count: 12}); h.person.Age = 7;
    Object.assign(h.personProps.properties[0], {title: '兵种', value: '盾兵'});
    Object.assign(h.personProps.properties[1], {title: '武力', value: String(h.person.Force)});
    const slot = h.document.getElementById('hd-city-menu-person-portrait'), figure = element('figure');
    slot.appendChild(figure); h.hud.fillDeepList();
    const fields = h.document.getElementById('hd-city-menu-person-fields');
    assert.equal(fields.getAttribute('data-hd-person-core-presentation'), 'custom-native');
    assert.equal(fields.querySelectorAll('.hd-city-menu-stat').length, 0);
    assert.match(fields.textContent, /此版本使用自定义人物属性，请以原生人物属性为准/);
    assert.doesNotMatch(fields.textContent, /年龄|基础兵种/);
    const native = h.document.getElementById('hd-city-menu-person-properties');
    assert.match(native.textContent, /兵种盾兵/); assert.match(native.textContent, /武力91/);
    const detail = h.context.BayeHdCityMenu.debugSnapshot().personDetail;
    assert.equal(detail.groups.flatMap(group => group.rows).length, 15);
    assert.equal(rows(detail).年龄, '7'); assert.equal(rows(detail).武力, '91');
    assert.equal(detail.corePresentation, 'custom-native'); assert.equal(figure.parentElement, slot);
    assert.equal(h.hud.lcdPresentation(), 'off'); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('same-owner custom/default changes invalidate the fixed-field render cache without altering person identity or raw fields', () => {
    const h = personPropertyHarness({custom: false}), fields = h.document.getElementById('hd-city-menu-person-fields');
    const initial = plain(h.hud.state.personDetail), owner = h.hud.state.deepMenuOwner.key;
    assert.equal(fields.querySelectorAll('.hd-city-menu-stat').length, 15);
    for (const custom of [1, 0, 1]) {
        h.personProps.custom = custom; h.hud.fillDeepList();
        assert.equal(fields.querySelectorAll('.hd-city-menu-stat').length, custom ? 0 : 15);
        assert.equal(fields.getAttribute('data-hd-person-core-presentation'), custom ? 'custom-native' : 'default');
        assert.equal(h.hud.state.deepMenuOwner.key, owner); assert.equal(h.hud.state.personDetail.personIndex, initial.personIndex);
        assert.deepEqual(plain(h.hud.state.personDetail.groups), initial.groups);
        assert.equal(h.document.getElementById('hd-city-menu-person-fields'), fields);
    }
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('valid custom empty values and an unread current page never re-expose fixed semantic fields and keep LCD fallback', () => {
    const h = personPropertyHarness({count: 12});
    Object.assign(h.personProps.properties[0], {title: '实际空值', value: ''});
    h.personProps.pageComplete = 0; h.hud.fillDeepList();
    const fields = h.document.getElementById('hd-city-menu-person-fields');
    assert.equal(fields.getAttribute('data-hd-person-core-presentation'), 'custom-native');
    assert.equal(fields.querySelectorAll('.hd-city-menu-stat').length, 0);
    const native = h.document.getElementById('hd-city-menu-person-properties');
    assert.match(native.textContent, /实际空值（空）/); assert.match(native.textContent, /未读取/);
    assert.match(native.textContent, /当前页未完整读取，请查看经典 LCD/);
    assert.equal(h.hud.state.personProperties.properties[0].valueCaptured, true);
    assert.equal(h.hud.state.personProperties.properties[7].valueCaptured, false);
    assert.equal(h.hud.lcdPresentation(), 'on'); assert.equal(personPageButton(h, 'next').disabled, true);
    assert.equal(h.hud.state.personDetail.groups.flatMap(group => group.rows).length, 15);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('a retired custom person owner or report takeover hides both property and fixed-field presentations', () => {
    for (const change of ['seq', 'generation', 'report']) {
        const h = personPropertyHarness();
        if (change === 'seq') h.menu.seq++;
        if (change === 'generation') { h.menu.generation++; h.menu.detailGeneration++; }
        if (change === 'report') h.report.active = 1;
        h.hud.renderPersonDetails();
        assert.equal(h.hud.state.personDetail, null); assert.equal(h.hud.state.personProperties, null);
        assert.equal(h.document.getElementById('hd-city-menu-person-details').hidden, true);
        assert.equal(h.document.getElementById('hd-city-menu-person-properties').hidden, true);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});
