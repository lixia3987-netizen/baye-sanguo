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

function harness({sourceText} = {}) {
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
    const selectedHudSource = process.env.BAYE_HD_CITY_HUD_SOURCE;
    let source = sourceText !== undefined ? sourceText : selectedHudSource ? readFileSync(selectedHudSource, 'utf8') : read('js/hd-city-menu.js');
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

// Equipment-card fixtures use the original packed GOODS table and current
// full PERSON IDs. Legacy large-library/name-only fixtures above stay intact.
function originalEquipmentFixture() {
    const bytes = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    assert.equal(bytes.length, 207195);
    function name(resource, index) {
        const base = bytes.readUInt32LE((resource - 1) * 4), row = base + 14 + index * 8;
        const offset = bytes.readUInt32LE(row), length = bytes.readUInt32LE(row + 4);
        return new TextDecoder('gbk').decode(bytes.subarray(base + offset, base + offset + length)).replace(/\0.*$/s, '');
    }
    const base = bytes.readUInt32LE((66 - 1) * 4);
    assert.equal(bytes.readUInt16LE(base + 4), 66);
    assert.equal(bytes.readUInt32LE(base + 8), 33 * 66);
    return { personName: id => name(62, id), tools: Array.from({length: 33}, (_, index) => {
        const p = base + 14 + index * 66;
        return {index, name: name(73, index), standard: true, generation: 3,
            useFlag: bytes[p + 1], changeAttackRange: bytes[p + 32], attack: bytes[p + 62],
            iq: bytes[p + 63], move: bytes[p + 64], arm: bytes[p + 65]};
    }) };
}
function equipmentHarness(slots = [1, 23]) {
    const h = harness(), original = originalEquipmentFixture();
    h.tools = original.tools; h.personId = 20;
    h.context.baye.getPersonCount = () => 200;
    h.context.baye.getToolCount = () => h.tools.length;
    h.context.baye.getToolName = id => { h.toolCalls.push(id); return h.tools[id]?.name ?? ''; };
    h.context.baye.hd.toolDetails = id => { h.detailCalls.push(id); return h.tools[id] ? plain(h.tools[id]) : null; };
    h.context.baye.hd.personProperties = () => null;
    h.detailCalls = [];
    h.people[20] = h.person;
    h.people[19] = {...h.person, Equip: [0, 0], Tool1: 0, Tool2: 0};
    h.person.Equip = slots.slice(); h.person.Tool1 = slots[0]; h.person.Tool2 = slots[1];
    h.person.Belong = 1; h.people[19].Belong = 1;
    h.city.Belong = 1; h.city.SatrapId = 20; h.raw.g_PlayerKing = 0;
    h.queue.splice(7, 2, 20, 19);
    for (const id of [0, 19, 20]) h.names.set(id, original.personName(id));
    Object.assign(h.menu, {idsValid: true, ids: [20, 19], generation: 3, detailGeneration: 3,
        itemLen: 8, names: [h.names.get(20), h.names.get(19)], packedNames: [h.names.get(20), h.names.get(19)]});
    h.raw.g_hdDetailGeneration = 3;
    h.identity = {status: 'ready', sha256: standardHash, byteLength: 207195, generation: 1};
    h.setIdentity(h.identity);
    h.hud.state.deepMenuOwner = h.hud.deepMenuOwner(h.menu);
    h.renderEquipment = () => h.hud.renderPersonDetails();
    return h;
}
function equipmentCards(h) { return plain(h.hud.state.personDetail?.equipment ?? []); }
function visibleEquipmentNodes(h) {
    const pane = h.document.getElementById('hd-city-menu-person-details');
    return pane && !pane.hidden ? pane.querySelectorAll('.hd-city-menu-equipment-card') : [];
}
function assertNoEquipmentInput(h) { assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []); }
function assertEquipmentAbsent(h) {
    assert.deepEqual(equipmentCards(h), []); assert.equal(visibleEquipmentNodes(h).length, 0); assertNoEquipmentInput(h);
}

test('equipment cards copy both actual original slots, all six tool fields and names without changing native fields', () => {
    const h = equipmentHarness(), before = plain(h.raw); h.renderEquipment();
    assert.equal(h.hud.state.personDetail.personIndex, 20); assert.equal(h.hud.state.personDetail.name, '吕布');
    const cards = equipmentCards(h);
    assert.deepEqual(cards.map(c => [c.slot, c.toolIndex, c.name, c.generation, c.source]),
        [[0, 0, '方天画戟', 3, 'standard-tool-details'], [1, 22, '赤兔', 3, 'standard-tool-details']]);
    assert.deepEqual(cards[0].properties, {useFlag: 0, attack: 10, iq: 0, move: 0, arm: 0, changeAttackRange: 0});
    assert.deepEqual(cards[1].properties, {useFlag: 0, attack: 0, iq: 0, move: 3, arm: 0, changeAttackRange: 0});
    assert.deepEqual(cards[0].rows.map(r => [r.field, r.label, r.value]), [
        ['useFlag', '用法', '装备'], ['attack', '武力加成', '10'], ['iq', '智力加成', '0'],
        ['move', '移动加成', '0'], ['arm', '兵种变化', '无'], ['changeAttackRange', '攻击范围', '不改变']]);
    assert.deepEqual(plain(h.raw), before); assertNoEquipmentInput(h);
    const nodes = visibleEquipmentNodes(h); assert.equal(nodes.length, 2);
    assert.equal(nodes[0].tagName, 'ARTICLE'); assert.equal(nodes[0].children[0].textContent, '装备一 · 方天画戟');
    assert.equal(nodes[1].children[0].textContent, '装备二 · 赤兔');
    assert.equal(nodes[0].querySelectorAll('[data-hd-equipment-field]').length, 6);
    assert.equal(nodes.flatMap(n => n.querySelectorAll('button')).length, 0);
    assert.equal(nodes.flatMap(n => n.querySelectorAll('input')).length, 0);
    const originalRows = rows(plain(h.hud.state.personDetail));
    assert.equal(originalRows.装备一, '方天画戟（编号 1）'); assert.equal(originalRows.装备二, '赤兔（编号 23）');
});
for (const [slots, expected] of [[[1, 0], [[0, 0]]], [[0, 23], [[1, 22]]], [[0, 0], []]]) {
    test('equipment cards retain the actual slot position for ' + slots.join('/'), () => {
        const h = equipmentHarness(slots); h.renderEquipment();
        assert.deepEqual(equipmentCards(h).map(c => [c.slot, c.toolIndex]), expected);
        assert.equal(visibleEquipmentNodes(h).length, expected.length); assertNoEquipmentInput(h);
        assert.equal(rows(plain(h.hud.state.personDetail))[slots[0] ? '装备二' : '装备一'], '无');
    });
}
test('actual original conversion items retain use, arm and range semantics rather than index-derived labels', () => {
    const h = equipmentHarness([31, 33]);
    h.renderEquipment();
    assert.deepEqual(equipmentCards(h).map(c => c.rows.filter(r => ['useFlag', 'arm'].includes(r.field)).map(r => r.value)),
        [['使用', '极兵'], ['使用', '水军']]);
    h.person.Equip = [32, 0]; h.renderEquipment();
    assert.equal(equipmentCards(h)[0].rows.find(r => r.field === 'arm').value, '玄兵');
    // These represent well-formed bridge values, exercising the documented raw
    // range/arm mapping even where the current original table has zero range flags.
    h.tools[31].arm = 9; h.tools[31].changeAttackRange = 1; h.renderEquipment();
    assert.equal(equipmentCards(h)[0].rows.find(r => r.field === 'arm').value, '玄兵');
    assert.equal(equipmentCards(h)[0].rows.find(r => r.field === 'changeAttackRange').value, '改变（以战场为准）');
    for (const [arm, expected] of ['无', '水军', '玄兵', '极兵', '骑兵', '步兵', '弓箭兵', '水军', '极兵', '玄兵'].entries()) {
        h.tools[31].arm = arm; h.renderEquipment();
        assert.equal(equipmentCards(h)[0].rows.find(r => r.field === 'arm').value, expected);
    }
    h.tools[31].arm = 255; h.tools[31].changeAttackRange = 255; h.renderEquipment();
    assert.equal(equipmentCards(h)[0].rows.find(r => r.field === 'arm').value, '原始码 255');
    assert.equal(equipmentCards(h)[0].rows.find(r => r.field === 'changeAttackRange').value, '改变（以战场为准）');
    assertNoEquipmentInput(h);
});
test('equipment-card cache refreshes live tool values and slots while preserving the portrait and native names', () => {
    const h = equipmentHarness(); h.renderEquipment();
    const slot = h.document.getElementById('hd-city-menu-person-portrait'), figure = element('figure'); slot.appendChild(figure);
    h.tools[0].attack = 11; h.renderEquipment(); assert.equal(equipmentCards(h)[0].properties.attack, 11);
    h.person.Equip = [2, 0]; h.renderEquipment();
    assert.deepEqual(equipmentCards(h).map(c => c.name), ['七星刀']); assert.equal(figure.parentElement, slot);
    assert.equal(rows(plain(h.hud.state.personDetail)).装备一, '七星刀（编号 2）'); assertNoEquipmentInput(h);
});
test('the real standard population capacity may exceed the 200 current people without hiding valid equipment', () => {
    const h = equipmentHarness(); h.people.length = 2000; h.renderEquipment();
    assert.equal(equipmentCards(h).length, 2); assertNoEquipmentInput(h);
});
for (const [label, change] of [
    ['pending LIB', h => h.setIdentity({...h.identity, status: 'pending'})],
    ['custom LIB', h => h.setIdentity({...h.identity, sha256: 'custom'})],
    ['wrong LIB byte length', h => h.setIdentity({...h.identity, byteLength: 207194})],
    ['non-current LIB', h => h.setIdentity(h.identity, false)],
    ['non-original population', h => { h.context.baye.getPersonCount = () => 786; }],
    ['not-ready bridge', h => { h.context.baye.hd.ready = () => false; }],
    ['custom person hook', h => { h.context.baye.hooks = {getPersonPropertyValue() { throw Error('must not execute'); }}; }],
    ['custom tool hook', h => { h.context.baye.hooks = {getToolPropertyTitle() { throw Error('must not execute'); }}; }],
    ['zero tool count', h => { h.context.baye.getToolCount = () => 0; }],
    ['out-of-range slot', h => { h.person.Equip = [1, 34]; }],
    ['fractional slot', h => { h.person.Equip = [1, 1.5]; }],
    ['missing slot', h => { h.person.Equip = [1]; }],
    ['unproven native IDs', h => { h.menu.idsValid = false; }],
    ['incomplete packed names', h => { h.menu.packedNames.pop(); }],
    ['missing item length', h => { delete h.menu.itemLen; }],
    ['mismatched generation', h => { h.menu.generation = 4; }],
    ['wrong full menu count', h => { h.menu.count = 3; }],
    ['missing tool getter', h => { h.context.baye.hd.toolDetails = undefined; }],
    ['missing second tool', h => { h.tools[22] = null; }],
]) {
    test('equipment cards fail closed for ' + label + ' without removing original name rows', () => {
        const h = equipmentHarness(); change(h); h.renderEquipment(); assertEquipmentAbsent(h);
        if (h.hud.state.personDetail) assert.equal(rows(plain(h.hud.state.personDetail)).装备一,
            label === 'zero tool count' ? '道具编号 1（名称未读取）' : '方天画戟（编号 1）');
    });
}
for (const [field, value] of [['standard', false], ['index', 1], ['generation', 4], ['name', ''], ['name', '-'],
    ['useFlag', 2], ['attack', -1], ['iq', 256], ['move', 0.5], ['arm', '2'], ['changeAttackRange', null]]) {
    test('one invalid equipped tool ' + field + '=' + String(value) + ' suppresses the entire pair', () => {
        const h = equipmentHarness(); h.tools[22][field] = value; h.renderEquipment(); assertEquipmentAbsent(h);
    });
}
for (const [label, change] of [
    ['LIB generation', h => h.setIdentity({...h.identity, generation: 2})],
    ['detail generation', h => { h.raw.g_hdDetailGeneration++; }],
    ['menu sequence', h => { h.menu.seq++; }],
    ['menu focus', h => { h.menu.index = 1; }],
    ['full IDs order', h => { h.menu.ids.reverse(); }],
    ['packed name', h => { h.menu.packedNames[0] += '变'; }],
    ['slot replacement', h => { h.person.Equip[1] = 2; }],
    ['tool count', h => { h.tools.pop(); }],
    ['data identity', h => { h.context.baye.data = new Proxy(h.raw, {}); }],
    ['bridge identity', h => { h.context.baye = {...h.context.baye}; }],
    ['HD API identity', h => { h.context.baye.hd = {...h.context.baye.hd}; }],
    ['tool getter identity', h => { h.context.baye.hd.toolDetails = id => plain(h.tools[id]); }],
    ['getter reentry', h => h.hud.renderPersonDetails()],
]) {
    test('read-only tool getter reentry on ' + label + ' never publishes mixed equipment', () => {
        const h = equipmentHarness(); let first = true;
        const original = h.context.baye.hd.toolDetails;
        h.context.baye.hd.toolDetails = id => {
            const tool = original(id);
            if (first) { first = false; change(h); }
            return tool;
        };
        h.renderEquipment(); assertEquipmentAbsent(h);
    });
}
test('two same-owner reads must agree on every equipped tool field, including a missing second read', () => {
    for (const field of ['name', 'useFlag', 'attack', 'iq', 'move', 'arm', 'changeAttackRange', 'missing']) {
        const h = equipmentHarness(); let reads = 0;
        h.context.baye.hd.toolDetails = id => {
            const value = plain(h.tools[id]);
            if (id === 22 && ++reads === 2) {
                if (field === 'missing') return null;
                value[field] = field === 'name' ? '另一工具' : field === 'useFlag' ? 1 : value[field] + 1;
            }
            return value;
        };
        h.renderEquipment(); assertEquipmentAbsent(h);
    }
});
test('custom-native person properties expose no standard equipment cards even under a verified original LIB', () => {
    const h = equipmentHarness(), name = h.names.get(20);
    h.context.baye.hd.personProperties = () => ({protocolVersion: 1, active: 1, complete: 1, pageComplete: 1,
        custom: 1, generation: 3, detailGeneration: 3, context: 1, kind: 3, menuSeq: h.menu.seq,
        paintSeq: 40, index: 0, person: 20, propertyCount: 1, pageIndex: 0, pageStart: 0, pageEnd: 1, name,
        properties: [{index: 0, title: '自定义装备规则', value: '仅原生', captured: true,
            titleCaptured: true, valueCaptured: true, titlePaintSeq: 40, valuePaintSeq: 40}]});
    h.renderEquipment();
    assert.equal(h.hud.state.personDetail.corePresentation, 'custom-native');
    assertEquipmentAbsent(h); assert.equal(h.detailCalls.length, 0);
});
test('a tool snapshot exception and a report takeover retire cards rather than preserving an earlier pair', () => {
    for (const kind of ['exception', 'report']) {
        const h = equipmentHarness(); h.renderEquipment(); assert.equal(equipmentCards(h).length, 2);
        h.context.baye.hd.toolDetails = () => { if (kind === 'exception') throw Error('read unavailable'); h.report.active = 1; return plain(h.tools[0]); };
        h.renderEquipment(); assertEquipmentAbsent(h);
    }
});

test('zero-based person zero and a fresh native highlight never inherit another person\'s equipment', () => {
    const h = equipmentHarness(); h.people[0] = {...h.person, Equip: [2, 0]};
    h.menu.ids = [0, 19]; h.menu.names[0] = h.names.get(0); h.menu.packedNames[0] = h.names.get(0); h.queue[7] = 0;
    h.hud.state.deepMenuOwner = h.hud.deepMenuOwner(h.menu); h.renderEquipment();
    assert.equal(h.hud.state.personDetail.personIndex, 0); assert.equal(equipmentCards(h)[0].name, '七星刀');
    h.menu.index = 1; h.renderEquipment(); assert.equal(h.hud.state.personDetail.personIndex, 19); assertEquipmentAbsent(h);
    h.menu.index = 0; h.renderEquipment(); assert.equal(equipmentCards(h)[0].toolIndex, 1); assertNoEquipmentInput(h);
});
test('equipment sampling keeps circular opaque native data out of diagnostic serialization', () => {
    const h = equipmentHarness(); h.raw.self = h.raw;
    h.raw.toJSON = () => { throw Error('native data must not be serialized'); };
    h.renderEquipment(); assert.equal(equipmentCards(h).length, 2);
    assert.doesNotThrow(() => JSON.stringify(h.context.BayeHdCityMenu.debugSnapshot())); assertNoEquipmentInput(h);
});
test('a menu getter changing the other equipment slot after its first read rejects the whole group', () => {
    const h = equipmentHarness(); let changed = false;
    h.context.baye.hd.menuItems = () => {
        if (!changed && /\bsample\b/.test(new Error().stack)) { changed = true; h.person.Equip[1] = 2; }
        return h.menu;
    };
    h.renderEquipment(); assert.equal(changed, true); assertEquipmentAbsent(h);
});
test('a lazy tool name getter cannot replace another equipped slot during the snapshot', () => {
    const h = equipmentHarness(); let changed = false;
    h.context.baye.hd.toolDetails = id => {
        const value = {...h.tools[id]};
        Object.defineProperty(value, 'name', {enumerable: true, get() {
            if (!changed) { changed = true; h.person.Equip[1] = 2; }
            return h.tools[id].name;
        }});
        return value;
    };
    h.renderEquipment(); assert.equal(changed, true); assertEquipmentAbsent(h);
});

// R03 decorative equipment coverage. Only the DOM namespace factory/faults are
// supplied here; every row/icon is produced by the normal person renderer.
function equipmentSvgDocument(h, mode) {
    h.svgCalls = [];
    h.equipmentFieldRewrites = 0;
    if (mode !== 'no-svg') {
        h.document.createElementNS = (namespace, tagName) => {
            h.svgCalls.push({namespace, tagName});
            if (mode === 'throws') throw Error('Controlled unavailable SVG creation');
            const node = element(tagName);
            node.namespaceURI = namespace;
            return node;
        };
    }
    if (mode === 'unknown-field') {
        // Change only the DOM field identity at its normal assignment boundary;
        // the measured native tool, displayed label/value and renderer stay real.
        const create = h.document.createElement;
        h.document.createElement = tagName => {
            const node = create(tagName), set = node.setAttribute;
            node.setAttribute = function (name, value) {
                if (name === 'data-hd-equipment-field' && value === 'attack') {
                    value = 'future-equipment-field';
                    h.equipmentFieldRewrites++;
                }
                return set.call(this, name, value);
            };
            return node;
        };
    }
    return h;
}

test('equipment semantic icons keep all six measured labels and values decorative through normal rendering', () => {
    const h = equipmentSvgDocument(equipmentHarness([1, 0]), 'available'), before = plain(h.raw);
    h.renderEquipment();
    const cards = equipmentCards(h), nodes = visibleEquipmentNodes(h);
    assert.equal(cards.length, 1); assert.equal(nodes.length, 1);
    const actual = nodes[0].querySelectorAll('[data-hd-equipment-field]');
    assert.equal(actual.length, 6);
    assert.deepEqual(actual.map(row => row.getAttribute('data-hd-equipment-field')),
        ['useFlag', 'attack', 'iq', 'move', 'arm', 'changeAttackRange']);
    for (const [index, row] of actual.entries()) {
        const expected = cards[0].rows[index], label = row.children[0], value = row.children[1];
        assert.equal(label.textContent, expected.label); assert.equal(value.textContent, expected.value);
        const icons = label.querySelectorAll('svg'); assert.equal(icons.length, 1);
        const icon = icons[0];
        assert.equal(icon.namespaceURI, 'http://www.w3.org/2000/svg');
        assert.equal(icon.getAttribute('aria-hidden'), 'true'); assert.equal(icon.getAttribute('focusable'), 'false');
        assert.equal(icon.getAttribute('data-hd-equipment-icon'), expected.field);
        assert.ok(icon.querySelectorAll('path').some(path => (path.getAttribute('d') || '').trim().length > 0));
        assert.equal(icon.querySelectorAll('title').length, 0); assert.equal(icon.getAttribute('aria-label'), null);
        assert.equal(icon.getAttribute('tabindex'), null);
        assert.ok([icon, ...walk(icon)].every(node => node.listeners.size === 0));
        for (const tag of ['button', 'input', 'a']) assert.equal(row.querySelectorAll(tag).length, 0);
    }
    assert.ok(h.svgCalls.length > 0, 'The production renderer actually requested namespace SVG nodes');
    assert.deepEqual(plain(h.raw), before); assertNoEquipmentInput(h);
});

test('equipment semantic icons retain text for unknown DOM fields, missing SVG and throwing SVG creation', () => {
    for (const mode of ['unknown-field', 'no-svg', 'throws']) {
        const h = equipmentSvgDocument(equipmentHarness([1, 0]), mode), before = plain(h.raw);
        assert.doesNotThrow(() => h.renderEquipment(), mode);
        const cards = equipmentCards(h), nodes = visibleEquipmentNodes(h);
        assert.equal(cards.length, 1, mode); assert.equal(nodes.length, 1, mode);
        const actual = nodes[0].querySelectorAll('[data-hd-equipment-field]'); assert.equal(actual.length, 6, mode);
        for (const [index, row] of actual.entries()) {
            const expected = cards[0].rows[index], label = row.children[0];
            assert.equal(label.textContent, expected.label, mode); assert.equal(row.children[1].textContent, expected.value, mode);
            const unknown = mode === 'unknown-field' && expected.field === 'attack';
            assert.equal(row.getAttribute('data-hd-equipment-field'), unknown ? 'future-equipment-field' : expected.field);
            const plainText = unknown || mode !== 'unknown-field';
            assert.equal(label.querySelectorAll('svg').length, plainText ? 0 : 1, mode);
            if (plainText) assert.equal(label.classList.contains('hd-city-menu-equipment-label'), false, mode);
        }
        if (mode === 'unknown-field') assert.equal(h.equipmentFieldRewrites, 1, 'The unknown identity fault actually reached one row');
        if (mode === 'no-svg') assert.equal(h.svgCalls.length, 0);
        else assert.ok(h.svgCalls.length > 0, mode + ' actually exercised the SVG factory');
        assert.deepEqual(plain(h.raw), before, mode); assertNoEquipmentInput(h);
    }
});

test('city resource semantic icons preserve five native fields and complete values through normal status rendering', () => {
    const h = equipmentSvgDocument(harness(), 'available');
    Object.assign(h.city, {Money: 65535, Food: 0, MothballArms: 43210, Persons: 200, Tools: 33, 金钱: 999});
    const before = plain(h.raw), menuBefore = plain(h.menu);
    h.hud.renderStatus();
    const details = h.hud.state.cityDetails, sections = h.nodes['hd-city-menu-status'].querySelectorAll('.hd-city-menu-info-group');
    assert.deepEqual(Object.keys(details), ['cityIndex', 'name', 'groups']);
    for (const group of details.groups) for (const row of group.rows) {
        assert.equal(Array.isArray(row), true); assert.equal(row.length, 2);
        assert.deepEqual(Reflect.ownKeys(row), ['0', '1', 'length'], 'Public DTO rows retain only their original two cells');
    }
    const resource = sections.find(section => section.children[0].textContent === '资源与军备');
    assert.ok(resource);
    const expected = [
        ['Money', '金钱', '65535'], ['Food', '粮食', '0'], ['MothballArms', '预备兵', '43210'],
        ['Persons', '城内人物', '200'], ['Tools', '城内道具', '33']
    ], actual = resource.querySelectorAll('.hd-city-menu-stat');
    assert.equal(actual.length, 5);
    assert.deepEqual(actual.map(row => row.getAttribute('data-hd-city-resource')), expected.map(row => row[0]));
    for (const [index, row] of actual.entries()) {
        const [field, title, value] = expected[index], label = row.children[0], number = row.children[1];
        assert.equal(label.textContent, title); assert.equal(number.textContent, value);
        const icons = label.querySelectorAll('svg'); assert.equal(icons.length, 1);
        const icon = icons[0];
        assert.equal(icon.namespaceURI, 'http://www.w3.org/2000/svg');
        assert.equal(icon.getAttribute('data-hd-city-resource-icon'), field);
        assert.equal(icon.getAttribute('aria-hidden'), 'true'); assert.equal(icon.getAttribute('focusable'), 'false');
        assert.equal(icon.getAttribute('tabindex'), null); assert.equal(icon.getAttribute('aria-label'), null);
        assert.equal(icon.querySelectorAll('title').length, 0);
        assert.ok(icon.querySelectorAll('path').some(path => (path.getAttribute('d') || '').trim().length > 0));
        assert.ok([icon, ...walk(icon)].every(node => node.listeners.size === 0));
        for (const tag of ['button', 'input', 'a']) assert.equal(row.querySelectorAll(tag).length, 0);
    }
    for (const section of sections.filter(section => section !== resource)) {
        assert.equal(section.querySelectorAll('svg').length, 0, 'Other city groups remain plain text');
        assert.equal(section.querySelectorAll('[data-hd-city-resource]').length, 0);
    }
    const extra = sections.find(section => section.children[0].textContent === '其他属性');
    assert.ok(extra); assert.equal(extra.querySelector('span').textContent, '金钱');
    assert.equal(extra.querySelector('strong').textContent, '999', 'A same-label unknown source field is not the native Money row');
    assert.deepEqual(plain(details.groups.find(group => group.title === '资源与军备').rows), expected.map(([, title, value]) => [title, value]));
    assert.equal(h.svgCalls.filter(call => call.tagName === 'svg').length, 5, 'The production status renderer requested all five icons');
    assert.deepEqual(plain(h.raw), before); assert.deepEqual(plain(h.menu), menuBefore); assertNoEquipmentInput(h);
});

test('city resource semantic icons retain original text without SVG or trusted standard city labels', () => {
    for (const mode of ['no-svg', 'throws', 'nonstandard', 'city-display-hook']) {
        const h = equipmentSvgDocument(harness(), mode === 'no-svg' || mode === 'throws' ? mode : 'available');
        let hookCalls = 0;
        if (mode === 'nonstandard') h.setIdentity({status: 'ready', sha256: 'different-library', generation: 1});
        if (mode === 'city-display-hook') h.context.baye.hooks = {
            getCityPropertyDisplay() { hookCalls++; throw Error('Decorative rendering must not execute a city display hook'); }
        };
        const before = plain(h.raw), menuBefore = plain(h.menu);
        assert.doesNotThrow(() => h.hud.renderStatus(), mode);
        const resource = h.nodes['hd-city-menu-status'].querySelectorAll('.hd-city-menu-info-group')
            .find(section => section.children[0].textContent === '资源与军备');
        assert.ok(resource, mode);
        const expected = [['Money', '金钱', '532'], ['Food', '粮食', '1790'], ['MothballArms', '预备兵', '975'],
            ['Persons', '城内人物', '2'], ['Tools', '城内道具', '3']], actual = resource.querySelectorAll('.hd-city-menu-stat');
        assert.equal(actual.length, 5, mode);
        for (const [index, row] of actual.entries()) {
            const [field, title, value] = expected[index], label = row.children[0];
            assert.equal(label.textContent, title, mode); assert.equal(row.children[1].textContent, value, mode);
            assert.equal(label.querySelectorAll('svg').length, 0, mode);
            assert.equal(label.classList.contains('hd-city-menu-resource-label'), false, mode);
            assert.equal(row.getAttribute('data-hd-city-resource'), mode === 'no-svg' || mode === 'throws' ? field : null, mode);
        }
        assert.deepEqual(plain(h.hud.state.cityDetails.groups.find(group => group.title === '资源与军备').rows),
            expected.map(([, title, value]) => [title, value]), mode);
        assert.equal(h.nodes['hd-city-menu-status'].querySelectorAll('svg').length, 0, mode);
        assert.equal(hookCalls, 0, mode);
        assert.equal(h.svgCalls.filter(call => call.tagName === 'svg').length, mode === 'throws' ? 5 : 0, mode);
        assert.deepEqual(plain(h.raw), before, mode); assert.deepEqual(plain(h.menu), menuBefore, mode); assertNoEquipmentInput(h);
    }
});

// Original selected-PERSON location. These fixtures exercise the normal
// production renderer; they neither export the location reader nor write C data.
let locationRomNames;
function originalLocationNames() {
    if (locationRomNames) return locationRomNames;
    const bytes = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    assert.equal(bytes.length, 207195);
    const decoder = new TextDecoder('gbk', {fatal: true});
    function name(resource, index) {
        const base = bytes.readUInt32LE((resource - 1) * 4), count = bytes.readUInt16LE(base + 6), fixed = bytes.readUInt32LE(base + 8);
        assert.equal(bytes.readUInt16LE(base + 4), resource); assert.ok(index < count);
        const row = base + 14 + index * 8, offset = fixed ? base + 14 + index * fixed : base + bytes.readUInt32LE(row), length = fixed || bytes.readUInt32LE(row + 4);
        const raw = bytes.subarray(offset, offset + length), end = raw.indexOf(0);
        return decoder.decode(end < 0 ? raw : raw.subarray(0, end));
    }
    locationRomNames = {people: Array.from({length: 200}, (_, id) => name(72, id)), cities: Array.from({length: 38}, (_, id) => name(58, id))};
    assert.deepEqual([locationRomNames.people[29], locationRomNames.people[139], locationRomNames.cities[4], locationRomNames.cities[30]], ['崔琰', '朵思大王', '晋阳', '云南']);
    return locationRomNames;
}
function locationHarness(personId = 139, {sourceText} = {}) {
    const oldSource = process.env.BAYE_HD_PERSON_LOCATION_SOURCE;
    const h = harness(sourceText !== undefined ? {sourceText} : oldSource ? {sourceText: readFileSync(oldSource, 'utf8')} : undefined), rom = originalLocationNames();
    // C PERSON_MAX is physical2000; the verified original ROM exposes logical200.
    h.people = Array.from({length: 2000}, () => ({...h.person, Belong: 0, OldBelong: 0, Equip: [0, 0], Tool1: 0, Tool2: 0}));
    h.people[29].Belong = 1; h.people[139].Belong = 4; h.people[143].Belong = 4;
    h.person = h.people[personId];
    h.cities = Array.from({length: 38}, () => ({...h.city, Belong: 0, SatrapId: 0, PersonQueue: 0, Persons: 0}));
    Object.assign(h.cities[4], {Belong: 1, PersonQueue: 5, Persons: 1});
    Object.assign(h.cities[30], {Belong: 4, PersonQueue: 100, Persons: 2});
    h.city = h.cities[4]; h.queue = Array(2000).fill(0); h.queue[5] = 29; h.queue[100] = 139; h.queue[101] = 143;
    Object.assign(h.raw, {g_Cities: h.cities, g_Persons: h.people, g_PersonsQueue: h.queue,
        g_engineConfig: {citiesCount: 38, enable16bitConsumeMoney: 0, fixAlienateComsumeThew: 0},
        g_PlayerKing: 0, g_PIdx: 4, g_hdEngineReady: 1, g_hdDetailGeneration: 3});
    // Real bridge objects retain identity. The legacy large-library fixture's
    // intentionally uncached proxies above are not changed by this new scope.
    const cache = new WeakMap();
    h.readonlyLocation = function readonly(value, at = '') {
        if (!value || typeof value !== 'object') return value;
        if (cache.has(value)) return cache.get(value);
        const proxy = new Proxy(value, {get(target, key) {return readonly(target[key], at + '.' + String(key));},
            set(target, key) {h.writes.push(at + '.' + String(key)); throw Error('location reader wrote native data');}});
        cache.set(value, proxy); return proxy;
    };
    h.context.baye.data = h.readonlyLocation(h.raw); h.context.baye.ensureData = () => h.context.baye.data;
    h.names.clear(); for (const [id, name] of rom.people.entries()) h.names.set(id, name);
    h.cityNames = rom.cities.slice(); h.cityNameCalls = [];
    h.context.baye.getCityName = id => {h.cityNameCalls.push(id); return h.cityNames[id] ?? '';};
    h.context.baye.getPersonCount = () => 200; h.context.baye.getToolCount = () => 33;
    h.context.baye.hd.personProperties = () => null;
    const ids = personId === 29 ? [29] : [139, 143], index = ids.indexOf(personId);
    Object.assign(h.menu, {active: 1, context: 1, kind: 3, seq: 9, count: ids.length, index,
        generation: 3, detailGeneration: 3, idsValid: true, ids,
        names: ids.map(id => rom.people[id]), packedNames: ids.map(id => rom.people[id].length === 4 ? rom.people[id].slice(0, 3) + '�' : rom.people[id]), itemLen: 8});
    h.identity = {status: 'ready', sha256: standardHash, byteLength: 207195, generation: 1}; h.setIdentity(h.identity);
    Object.assign(h.hud.state, {open: true, cityIndex: 4, cityName: '晋阳', layer: 'deep', deepKind: 'person', deepSelectionPending: null});
    h.hud.state.deepMenuOwner = h.hud.deepMenuOwner(h.menu);
    h.renderLocation = () => h.hud.renderPersonDetails();
    return h;
}
function locationNodes(h) {
    const pane = h.document.getElementById('hd-city-menu-person-details');
    return pane && !pane.hidden ? pane.querySelectorAll('[data-hd-person-location]') : [];
}
function assertLocation(h, cityIndex, {queueStart, queueCount, queueOffset} = {}) {
    const detail = h.hud.state.personDetail, id = h.menu.ids[h.menu.index], expectedCity = h.cities[cityIndex], nodes = locationNodes(h);
    assert.ok(detail); assert.equal(nodes.length, 1, 'one current selected-person location row');
    assert.deepEqual(plain(detail.location), {personIndex: id, cityIndex, name: h.cityNames[cityIndex], source: 'native-city-queue-first-match',
        libraryGeneration: 1, detailGeneration: 3, menuSeq: h.menu.seq, nativeIndex: h.menu.index,
        queueStart: queueStart ?? expectedCity.PersonQueue, queueCount: queueCount ?? expectedCity.Persons,
        queueOffset: queueOffset ?? expectedCity.PersonQueue + h.queue.slice(expectedCity.PersonQueue, expectedCity.PersonQueue + expectedCity.Persons).indexOf(id)});
    const row = nodes[0]; assert.equal(row.getAttribute('data-hd-person-location'), '1');
    assert.equal(row.getAttribute('data-hd-person-location-city'), String(cityIndex));
    assert.equal(row.children[0].textContent, '所在城市'); assert.equal(row.children[1].textContent, h.cityNames[cityIndex]);
    assert.equal(row.parentElement.parentElement.children[0].textContent, '身份与经历');
    assert.equal(detail.groups.flatMap(group => group.rows).length, 15, 'legacy raw core DTO stays fifteen fields');
    assert.ok(detail.groups.every(group => group.rows.every(row => row.length === 2)));
    for (const tag of ['button', 'a', 'input']) assert.equal(row.querySelectorAll(tag).length, 0);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    return row;
}
function assertLocationAbsent(h, reason) {
    assert.equal(h.hud.state.personDetail?.location ?? null, null, reason); assert.equal(locationNodes(h).length, 0, reason);
    assert.deepEqual(h.keys, [], reason); assert.deepEqual(h.writes, [], reason);
}
function installLocationNameFault(h, mutate) {
    const original = h.context.baye.getCityName; let called = false;
    h.context.baye.getCityName = function (id) {if (!called) {called = true; mutate(h);} return original(id);};
    return () => called;
}

test('person location normal rendering follows actual native IDs for allied and foreign current people', () => {
    for (const id of [29, 139, 143]) {
        const h = locationHarness(id), before = plain(h.raw), menu = plain(h.menu); h.renderLocation();
        assertLocation(h, id === 29 ? 4 : 30); assert.equal(h.hud.state.personDetail.personIndex, id);
        if (id !== 29) assert.notEqual(h.hud.state.personDetail.location.cityIndex, h.hud.state.cityIndex, 'foreign location is not the active menu origin');
        const heading = h.document.getElementById('hd-city-menu-person-name'); assert.equal(heading.textContent, h.names.get(id));
        const groups = h.document.getElementById('hd-city-menu-person-fields').querySelectorAll('.hd-city-menu-info-group');
        assert.equal(groups[0].querySelectorAll('.hd-city-menu-stat').length, 5);
        assert.equal(groups[0].querySelectorAll('span')[0].textContent, '归属');
        assert.deepEqual(plain(h.raw), before); assert.deepEqual(plain(h.menu), menu);
    }
});

test('person location preserves C first-city and first-offset semantics even under duplicate foreign prefixes', () => {
    const h = locationHarness(); Object.assign(h.cities[1], {Belong: 2, PersonQueue: 20, Persons: 3});
    h.queue[20] = 143; h.queue[21] = 139; h.queue[22] = 139;
    const before = plain(h.raw); h.renderLocation(); assertLocation(h, 1, {queueStart: 20, queueCount: 3, queueOffset: 21});
    assert.equal(h.hud.state.personDetail.ownership.value, 4, 'GetPersonCity does not filter by allegiance'); assert.deepEqual(plain(h.raw), before);
});

test('person location refreshes when only real city queues move the current person', () => {
    const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); const old = locationNodes(h)[0], owner = h.hud.state.deepMenuOwner.key, menu = plain(h.menu);
    h.queue[100] = 143; Object.assign(h.cities[31], {PersonQueue: 200, Persons: 1}); h.queue[200] = 139;
    const before = plain(h.raw); h.renderLocation(); assertLocation(h, 31);
    assert.notEqual(locationNodes(h)[0], old); assert.equal(h.hud.state.deepMenuOwner.key, owner); assert.deepEqual(plain(h.menu), menu); assert.deepEqual(plain(h.raw), before);
});

test('person location accepts city zero and withholds missing255 without guessing the active city or travel state', () => {
    const h = locationHarness(); Object.assign(h.cities[0], {PersonQueue: 30, Persons: 1}); h.queue[30] = 139;
    h.renderLocation(); assertLocation(h, 0); h.cities[0].Persons = 0; h.queue[100] = 143;
    const before = plain(h.raw); h.renderLocation(); assertLocationAbsent(h, 'no city queue contains the selected ID');
    assert.deepEqual(plain(h.raw), before); assert.equal(h.hud.state.cityIndex, 4);
    const fields = h.document.getElementById('hd-city-menu-person-fields'); assert.doesNotMatch(fields.textContent, /在途|正在移动|所在城市晋阳/);
});

test('person location withdraws for malformed original tables ranges and used IDs including data after the first match', () => {
    for (const [label, mutate] of [
        ['city count config', h => {h.raw.g_engineConfig.citiesCount = 37;}],
        ['city table length', h => {h.cities.length = 37;}], ['truncated physical person binding', h => {h.people.length = 200;}],
        ['queue ABI length', h => {h.queue.length = 1999;}], ['missing later city', h => {delete h.cities[37];}],
        ['negative later range', h => {h.cities[37].PersonQueue = -1;}],
        ['overflowing later range', h => {Object.assign(h.cities[37], {PersonQueue: 1999, Persons: 2});}],
        ['invalid used ID after match', h => {h.queue[101] = 200;}],
        ['invalid separate later ID', h => {Object.assign(h.cities[37], {PersonQueue: 1900, Persons: 1}); h.queue[1900] = 65535;}]
    ]) {
        const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); mutate(h); h.renderLocation(); assertLocationAbsent(h, label);
    }
});

test('person location requires complete current PERSON ownership and never uses name-only or retired tickets', () => {
    for (const [label, mutate] of [
        ['retired menu', h => {h.menu.active = 0;}], ['wrong context', h => {h.menu.context = 2;}],
        ['new sequence', h => {h.menu.seq++;}], ['generation', h => {h.menu.generation++; h.menu.detailGeneration++;}],
        ['name-only list', h => {h.menu.idsValid = false;}],
        ['native ID beyond original', h => {h.menu.ids[0] = 200;}], ['partial names', h => {h.menu.names = [h.menu.names[0]];}],
        ['report takeover', h => {h.report.active = 1;}], ['hidden document', h => {h.document.hidden = true;}]
    ]) {
        const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); mutate(h); h.renderLocation(); assertLocationAbsent(h, label);
    }
});

test('person location requires the current original library population and source identity', () => {
    for (const [label, mutate] of [
        ['unverified library', h => {h.setIdentity({...h.identity, status: 'pending'});}],
        ['different library', h => {h.setIdentity({...h.identity, sha256: 'different'});}],
        ['wrong library size', h => {h.setIdentity({...h.identity, byteLength: 207194});}],
        ['identity no longer current', h => {h.setIdentity(h.identity, false);}],
        ['non-original population', h => {h.context.baye.getPersonCount = () => 201;}]
    ]) {
        const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); mutate(h); h.renderLocation(); assertLocationAbsent(h, label);
    }
});

test('person location refuses source and getter reference replacement during city-name reading even if values agree', () => {
    for (const [label, mutate] of [
        ['config ref', h => {h.raw.g_engineConfig = {...h.raw.g_engineConfig};}],
        ['cities ref', h => {h.raw.g_Cities = h.cities.slice();}], ['queue ref', h => {h.raw.g_PersonsQueue = h.queue.slice();}],
        ['people ref', h => {h.raw.g_Persons = h.people.slice();}], ['selected person ref', h => {h.people[139] = {...h.people[139]};}],
        ['later city struct ref', h => {h.cities[37] = {...h.cities[37]};}],
        ['person-count function', h => {h.context.baye.getPersonCount = () => 200;}],
        ['city-name function', h => {h.context.baye.getCityName = id => h.cityNames[id] ?? '';}],
        ['identity reader function', h => {h.context.BayeHdLibIdentity.read = () => h.identity;}],
        ['identity current function', h => {h.context.BayeHdLibIdentity.isCurrent = value => value === h.identity;}],
        ['identity API object', h => {h.context.BayeHdLibIdentity = {...h.context.BayeHdLibIdentity};}]
    ]) {
        const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); const called = installLocationNameFault(h, mutate);
        h.renderLocation(); assert.equal(called(), true, label + ' fault actually ran'); assertLocationAbsent(h, label);
    }
});

test('person location rejects whole relevant queue or range drift during an otherwise matching city-name call', () => {
    for (const [label, mutate] of [
        ['matched range', h => {h.cities[30].Persons = 1;}], ['unselected later range', h => {h.cities[37].PersonQueue = 1900;}],
        ['current person changed during read', h => {h.menu.index = 1;}],
        ['used queue after first match', h => {h.queue[101] = 29;}],
        ['new earlier city match', h => {Object.assign(h.cities[1], {PersonQueue: 20, Persons: 1}); h.queue[20] = 139;}]
    ]) {
        const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); const called = installLocationNameFault(h, mutate);
        h.renderLocation(); assert.equal(called(), true, label); assertLocationAbsent(h, label);
    }
});

test('person location withholds same-owner reentrant city-name reads and recovers on the next clean render', () => {
    const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); const original = h.context.baye.getCityName;
    let reentered = false; h.context.baye.getCityName = function (id) {if (!reentered) {reentered = true; h.hud.renderPersonDetails();} return original(id);};
    const before = plain(h.raw); h.renderLocation(); assert.equal(reentered, true); assertLocationAbsent(h, 'one read cannot adopt its reentrant render');
    assert.deepEqual(plain(h.raw), before); h.context.baye.getCityName = original; h.renderLocation(); assertLocation(h, 30); assert.deepEqual(plain(h.raw), before);
});

test('person location withdraws on throwing or unusable city-name results without preserving a prior row', () => {
    for (const value of [null, '', ' ', '-']) {
        const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); h.context.baye.getCityName = () => value; h.renderLocation(); assertLocationAbsent(h, String(value));
    }
    const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); let called = false;
    h.context.baye.getCityName = () => {called = true; throw Error('native city name unavailable');};
    assert.doesNotThrow(() => h.renderLocation()); assert.equal(called, true); assertLocationAbsent(h, 'exception');
});

test('person location respects current custom-native semantics and relevant hooks without replaying either hook', () => {
    for (const hook of ['getPersonPropertyTitle', 'getPersonPropertyValue']) {
        const h = locationHarness(); h.renderLocation(); assertLocation(h, 30); let calls = 0;
        h.context.baye.hooks = {[hook]() {calls++; throw Error('extra native property hook');}};
        h.renderLocation(); assertLocationAbsent(h, hook); assert.equal(calls, 0);
    }
    const h = locationHarness(); h.renderLocation(); assertLocation(h, 30);
    const props = {protocolVersion: 1, active: 1, complete: 0, pageComplete: 1, custom: 1, generation: 3, detailGeneration: 3,
        context: 1, kind: 3, menuSeq: h.menu.seq, paintSeq: 40, index: h.menu.index, person: 139, propertyCount: 13,
        pageIndex: 0, pageStart: 0, pageEnd: 1, name: h.names.get(139), properties: Array.from({length: 13}, (_, index) => ({index,
            title: index === 0 ? '原生自定义标题' : '', value: index === 0 ? '原生自定义含义' : '', captured: index === 0,
            titleCaptured: index === 0, valueCaptured: index === 0, titlePaintSeq: index === 0 ? 40 : 0, valuePaintSeq: index === 0 ? 40 : 0}))};
    h.context.baye.hd.personProperties = () => plain(props); h.renderLocation(); assertLocationAbsent(h, 'current custom-native property table');
    assert.equal(h.hud.state.personDetail.corePresentation, 'custom-native'); assert.equal(h.hud.state.personDetail.groups.flatMap(g => g.rows).length, 15);
    assert.match(h.document.getElementById('hd-city-menu-person-properties').textContent, /原生自定义含义/);
});

// SURRENDER is the original target-first, actor-second ShowPersonControl loop.
// These are normal renderer/input tests with a controlled C publication model;
// the model never supplies a private JS role, approval flag or input ticket.
// Its captive rows are synthetic test data, not evidence of a real capture.
const surrenderSubNames = ['开垦', '招商', '搜寻', '治理', '出巡', '招降', '处斩', '流放', '赏赐', '没收', '交易', '宴请', '输送', '移动'];
const surrenderRawFields = ['g_hdEngineReady', 'g_hdMapPick', 'g_hdMapCity', 'g_hdMapInputSeq', 'g_hdBattlePick',
    'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex',
    'g_hdDetailGeneration', 'g_hdQtyActive', 'g_hdQtySession', 'g_hdQtyInputSeq', 'g_hdQtyLastKey',
    'g_hdQtyCursor', 'g_hdQtyStep', 'g_hdQtyReady', 'g_hdQtyMin', 'g_hdQtyMax', 'g_hdQtyValue',
    'g_hdMarchPhase', 'g_hdMarchSession', 'g_hdMarchInputSeq', 'g_hdMarchOrigin', 'g_hdMarchSelected',
    'g_hdMarchSeq', 'g_hdMarchOk', 'g_hdMarchCity', 'g_hdMarchObj', 'g_hdReportActive', 'g_hdReportSeq',
    'g_hdReportInputSeq', 'g_hdReportKind', 'g_hdReportPerson', 'g_hdHelpActive', 'g_hdHelpInputSeq',
    'g_hdFightActive', 'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive',
    'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdViewActive', 'g_hdMiniMapActive',
    'g_hdGoodsActive', 'g_hdPersonPropertiesActive', 'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];

function surrenderHarness({mobile = false, subIndex = 5, seq = 10, duplicate = false, singleActor = false} = {}) {
    const selectedSource = process.env.BAYE_HD_SURRENDER_SOURCE;
    const h = locationHarness(139, {sourceText: selectedSource ? readFileSync(selectedSource, 'utf8') : read('js/hd-city-menu.js')});
    const storage = new Map([['baye/cityMenuMode', 'hd'], ['baye/mobileCityMenuMode', 'hd'], ['baye/overworldMode', 'hd-map']]);
    h.context.localStorage = {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value))};
    h.context.innerWidth = mobile ? 844 : 1280; h.context.innerHeight = mobile ? 390 : 720;
    h.context.dynLib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url)).toString('hex');
    h.context.baye.hooks = {};
    h.raw.g_engineConfig.fixConsumeMoney = 0;
    h.context.bayeQtyNativeClosed = () => false;
    h.context.bayeQtyCloseInput = () => {};
    let nameReadHook = null;
    h.context.baye.getPersonName = id => {if (nameReadHook) nameReadHook(); return h.names.get(id) ?? '';};
    h.people[139].Belong = h.people[143].Belong = 65535;
    h.people[139].OldBelong = h.people[143].OldBelong = 4;
    h.people[139].Arms = h.people[143].Arms = 0;
    h.people[29].Belong = h.people[33].Belong = 1;
    h.people[29].Thew = h.people[33].Thew = 100;
    h.people[150].Belong = 0;
    h.queue.fill(0);
    const residents = singleActor ? [139, 29, 143, 150] : duplicate ? [139, 29, 139, 143, 33, 150] : [139, 29, 143, 33, 150];
    residents.forEach((id, index) => {h.queue[5 + index] = id;});
    Object.assign(h.cities[4], {Persons: residents.length, PersonQueue: 5, Belong: 1});
    Object.assign(h.cities[30], {Persons: 0, PersonQueue: 100});
    h.raw.g_OrderQueue = Array.from({length: 200}, () => ({OrderId: 255, City: 0, Person: 0, Object: 0, Money: 0, Food: 0, Arms: 0}));
    for (const field of surrenderRawFields) h.raw[field] = 0;
    Object.assign(h.raw, {g_hdEngineReady: 1, g_hdMapCity: 5, g_hdMapInputSeq: 40, g_hdDetailGeneration: 3,
        g_hdQtySession: 2, g_hdQtyLastKey: 65535, g_hdQtyStep: 1, g_hdMarchOrigin: 255,
        g_hdReportPerson: 65535, g_asyncActionID: 0});
    Object.assign(h.qty, {protocol: true, active: 0, session: 2, inputSeq: 0, lastKey: 65535,
        cursor: 0, step: 1, ready: 0, min: 0, max: 0, value: 0});
    Object.assign(h.report, {active: 0, seq: 0, inputSeq: 0, kind: 0, person: 65535, text: ''});
    Object.assign(h.help, {active: 0, seq: 0, inputSeq: 0});
    const march = {pick: 0, battlePick: 0, mapCity: 5, mapInputSeq: 40, phase: 0, session: 0, inputSeq: 0,
        origin: 255, selected: 0, seq: 0, ok: 0, city: 0, obj: 0};
    h.context.baye.hd.march = () => plain(march);
    h.context.baye.hd.fight = () => ({active: 0});
    let propertyPaint = 40;
    h.context.baye.hd.personProperties = () => {
        if (!h.menu.active || h.menu.kind !== 3) return null;
        const id = h.menu.ids[h.menu.index];
        return {protocolVersion: 1, active: 1, complete: 0, pageComplete: 1, custom: 0,
            generation: 3, detailGeneration: 3, context: 1, kind: 3, menuSeq: h.menu.seq,
            paintSeq: propertyPaint, index: h.menu.index, person: id, propertyCount: 13, pageIndex: 0, pageStart: 0, pageEnd: 1,
            name: h.names.get(id), properties: Array.from({length: 13}, (_, index) => ({index,
                title: index === 0 ? ' 归属 ' : '', value: index === 0 ? (h.people[id].Belong === 65535 ? '俘虏' : '曹丕') : '',
                captured: index === 0, titleCaptured: index === 0, valueCaptured: index === 0,
                titlePaintSeq: index === 0 ? propertyPaint : 0, valuePaintSeq: index === 0 ? propertyPaint : 0}))};
    };
    const next = n => n === 0xffffffff ? 1 : n + 1;
    const nativePending = [];
    let role = 'sub', error = null, freezeKey = false, actorCommits = 0, actorCommitEffect = null;
    function roleIds(which) {
        return h.queue.slice(h.city.PersonQueue, h.city.PersonQueue + h.city.Persons)
            .filter(id => h.people[id].Belong === (which === 'target' ? 65535 : h.city.Belong));
    }
    function publish(which, {menuSeq = h.menu.seq, index = 0, ids = null} = {}) {
        role = which;
        const active = which !== 'transition' && which !== 'map';
        const values = ids || (which === 'sub' ? [] : active ? roleIds(which) : []);
        const names = !active ? (h.menu.packedNames || h.menu.names).slice() : which === 'sub' ? surrenderSubNames.slice() : values.map(id => h.names.get(id));
        const count = active ? names.length : h.menu.count, currentIndex = active ? index : h.menu.index;
        Object.assign(h.menu, {active: active ? 1 : 0, context: active ? 1 : 0, kind: which === 'sub' ? 2 : active ? 3 : 0,
            seq: menuSeq, count, index: currentIndex,
            generation: 3, detailGeneration: 3, idsValid: active && which !== 'sub', ids: values.slice(),
            names, packedNames: names.map(name => name.length === 4 ? name.slice(0, 3) + '�' : name), itemLen: 8});
        Object.assign(h.raw, {g_hdMenuActive: h.menu.active, g_hdMenuContext: h.menu.context,
            g_hdMenuKind: h.menu.kind, g_hdMenuSeq: h.menu.seq, g_hdMenuCount: h.menu.count, g_hdMenuIndex: h.menu.index,
            g_hdPersonPropertiesActive: h.menu.kind === 3 ? 1 : 0, g_hdMapPick: which === 'map' ? 1 : 0});
        march.pick = h.raw.g_hdMapPick;
        if (active && which !== 'sub') propertyPaint = next(propertyPaint);
        if (which === 'map') {march.mapInputSeq = h.raw.g_hdMapInputSeq = next(h.raw.g_hdMapInputSeq);}
    }
    function consume(key) {
        if (freezeKey) return;
        if (key === 34 || key === 35) {
            nativePending.push(() => {h.menu.index += key === 34 ? -1 : 1; h.raw.g_hdMenuIndex = h.menu.index;}); return;
        }
        const old = h.menu.seq, before = role;
        if (key !== 39 && key !== 40) return;
        if (before === 'actor' && key === 39) {
            actorCommits++;
            if (!actorCommitEffect) return;
            actorCommitEffect(h.menu.ids[h.menu.index]);
        }
        publish('transition', {menuSeq: next(old)});
        if (before === 'target' && key === 39 && !roleIds('actor').length) {
            // Native SurrenderMake reaches its no-person report before MAP.
            Object.assign(h.raw, {g_hdReportActive: 1, g_hdReportKind: 1, g_hdReportPerson: 65535});
            Object.assign(h.report, {active: 1, kind: 1, person: 65535, text: '本城没有可执行命令的将领'});
            return;
        }
        if (before === 'sub' && key === 39) nativePending.push(() => publish('target', {menuSeq: next(next(old))}));
        else if (before === 'target' && key === 39) nativePending.push(() => publish('actor', {menuSeq: next(next(old))}));
        else if (before === 'actor' && key === 40) nativePending.push(() => publish('target', {menuSeq: next(next(old))}));
        else if (before === 'actor' && key === 39) nativePending.push(() => publish('target', {menuSeq: next(next(old))}));
        else if (before === 'target' && key === 40) nativePending.push(() => publish('map', {menuSeq: next(old)}));
        else assert.fail('unexpected controlled SURRENDER key ' + key + ' at ' + before);
    }
    h.sendStacks = [];
    h.context.sendKey = key => {h.keys.push(key); h.sendStacks.push(new Error('controlled send ' + key).stack); if (error) throw error; consume(key);};
    h.context.baye.sendKey = h.context.sendKey;
    h.backButton = element('button'); h.backButton.setAttribute('data-hd-menu-back', ''); h.root.appendChild(h.backButton);
    h.root.contains = node => node === h.root || walk(h.root).includes(node);
    const api = h.context.BayeHdCityMenu;
    publish('sub', {menuSeq: seq, index: subIndex});
    if (mobile) api.configureMobileHost({isAvailable: () => true});
    Object.assign(h.hud.state, {open: true, cityIndex: 4, cityName: h.cityNames[4], layer: 'sub', subKind: 'neizheng',
        deepKind: '', deepLabel: '', deepStep: 0, deepMenuOwner: null, deepSelectionPending: null, wizardStep: 'none'});
    api.start();
    const poll = h.intervals.at(-1);
    const event = {detail: 1, isPrimary: true, button: 0, pointerId: 7};
    function refresh() {poll(); h.hud.render();}
    function click(button) {assert.ok(button, 'a current rendered button exists'); dispatch(h, 'click', button, event);}
    function down(button) {assert.ok(button, 'a current rendered button exists'); dispatch(h, 'pointerdown', button, event); return button;}
    function press(button) {down(button); click(button);}
    function deep(index = 0) {
        return h.document.querySelectorAll('[data-hd-deep]').find(button => button.getAttribute('data-hd-deep') === String(index));
    }
    function timersOnce() {const tasks = h.timers.splice(0); for (const task of tasks) task();}
    function flush() {
        // Each modeled C publication is explicit. There is no auto-reset or
        // replay; production's own queued ACK continuation observes it next.
        const tasks = nativePending.splice(0); for (const task of tasks) task();
        timersOnce(); refresh();
    }
    function enter() {
        const button = h.document.querySelectorAll('[data-hd-sub]').find(node => node.getAttribute('data-hd-sub') === '5');
        press(button);
    }
    function world() {return plain({people: h.people, cities: h.cities, queue: h.queue, orders: h.raw.g_OrderQueue,
        player: h.raw.g_PlayerKing, period: h.raw.g_PIdx, config: h.raw.g_engineConfig});}
    return Object.assign(h, {api, storage, march, next, publish, roleIds, refresh, flush, timersOnce, enter,
        deep, down, click, press, back: () => press(h.backButton), poll, nativePending, world,
        stage: () => role, actorCommits: () => actorCommits,
        setActorCommitEffect(value) {actorCommitEffect = value;},
        setNameReadHook(value) {nameReadHook = value;},
        setSendError(value) {error = value;}, setFreezeKey(value) {freezeKey = value;}});
}
function surrenderPresentation(h) {return h.api.debugSnapshot().surrenderPresentation ?? null;}
function assertSurrender(h, role) {
    const p = surrenderPresentation(h), title = role === 'target' ? '招降 · 选择俘虏' : '招降 · 选择招降将领';
    assert.ok(p, 'source-bound SURRENDER presentation for ' + role);
    assert.equal(p.role, role); assert.equal(p.title, title); assert.equal(p.cityIndex, 4);
    assert.equal(p.menuSeq, h.menu.seq); assert.equal(p.detailGeneration, 3);
    assert.deepEqual(plain(p.ids), h.roleIds(role));
    const node = h.document.querySelectorAll('[data-hd-surrender-role]').find(item => item.getAttribute('data-hd-surrender-role') === role);
    assert.ok(node); assert.equal(node.tagName, 'P'); assert.equal(node.textContent, title);
    assert.equal(h.api.debugSnapshot().mobileHost, h.context.innerWidth === 844);
    if (!h.api.debugSnapshot().mobileHost) assert.equal(h.api.getInputTicket(), null, 'PC does not acquire a mobile adapter capability');
    return p;
}
function surrenderTarget(options) {
    const h = surrenderHarness(options); h.enter(); assert.deepEqual(h.keys, [39]);
    assert.equal(surrenderPresentation(h), null, 'no role is inferred before native target publication');
    h.flush(); assertSurrender(h, 'target'); return h;
}
function surrenderActor(options) {
    const h = surrenderTarget(options); h.press(h.deep(0));
    assert.deepEqual(h.keys, [39, 39]); assert.equal(surrenderPresentation(h), null);
    h.flush(); assertSurrender(h, 'actor'); return h;
}
function reopenSurrender(h) {
    h.api.close({silent: true}); h.refresh();
    h.api.setMode('classic'); h.api.setMode('hd'); h.refresh();
}

test('SURRENDER PC normal SUB entry follows captive target, actor cancellation, fresh target and MAP without business writes', () => {
    const h = surrenderTarget(), before = h.world(), oldButton = h.deep(0), targetSeq = h.menu.seq;
    assert.equal(h.hud.state.personDetail.personIndex, 139);
    assert.equal(h.hud.state.personDetail.ownership.kind, 'captive');
    h.press(oldButton); assert.equal(h.hud.state.layer, 'deep'); assert.equal(surrenderPresentation(h), null);
    h.flush(); assertSurrender(h, 'actor'); assert.equal(h.menu.seq, h.next(h.next(targetSeq)));
    assert.equal(h.hud.state.personDetail.personIndex, 29); assert.equal(h.actorCommits(), 0);
    h.back(); assert.equal(surrenderPresentation(h), null); assert.equal(h.hud.state.layer, 'deep', 'EXIT waits for the new target owner');
    h.flush(); assertSurrender(h, 'target');
    h.click(oldButton); assert.deepEqual(h.keys, [39, 39, 40], 'old target DOM cannot confirm the newly published target');
    h.back(); assert.equal(h.hud.state.layer, 'deep', 'target cancellation waits for native MAP');
    h.flush(); assert.equal(surrenderPresentation(h), null); assert.equal(h.api.isOpen(), false);
    assert.equal(h.march.pick, 1); assert.equal(h.menu.active, 0); assert.deepEqual(h.keys, [39, 39, 40, 40]);
    assert.equal(h.actorCommits(), 0); assert.deepEqual(h.world(), before); assert.deepEqual(h.writes, []);
    const classic = surrenderTarget(), classicWorld = classic.world(), classicSeq = classic.menu.seq;
    classic.api.setMode('classic');
    // A real classic target cancellation is observed, without fabricating a
    // private HD send/ACK receipt or replaying its EXIT through this model.
    classic.publish('map', {menuSeq: classic.next(classicSeq)});
    classic.api.setMode('hd'); classic.refresh();
    assert.equal(classic.api.isOpen(), false); assert.equal(surrenderPresentation(classic), null);
    assert.deepEqual(classic.keys, [39]); assert.deepEqual(classic.world(), classicWorld);
    classic.publish('sub', {menuSeq: classic.next(classic.next(classic.menu.seq)), index: 5});
    Object.assign(classic.hud.state, {open: true, cityIndex: 4, cityName: classic.cityNames[4], layer: 'sub', subKind: 'neizheng', deepKind: '', deepLabel: ''});
    classic.refresh(); classic.enter();
    assert.deepEqual(classic.keys, [39, 39], 'fresh classic return SUB entry sends one ENTER ' + JSON.stringify({
        layer: classic.hud.state.layer, deepKind: classic.hud.state.deepKind, open: classic.hud.state.open,
        nativeMenuRequest: classic.hud.state.nativeMenuRequest, nativeMenuCommit: classic.hud.state.nativeMenuCommit,
        subKind: classic.hud.state.subKind, menu: classic.menu, mapPick: classic.raw.g_hdMapPick}));
    classic.flush(); assertSurrender(classic, 'target');
    assert.deepEqual(classic.keys, [39, 39], 'the retired classic flow does not block a fresh normal SUB entry');
    assert.deepEqual(classic.writes, []);
});

test('SURRENDER explicitly configured mobile uses the same target-first flow and retains its own host boundary', () => {
    const h = surrenderTarget({mobile: true}), before = h.world();
    assert.equal(h.api.debugSnapshot().mobileHost, true);
    h.press(h.deep(0)); h.flush(); assertSurrender(h, 'actor');
    h.back(); h.flush(); assertSurrender(h, 'target'); h.back(); h.flush();
    assert.deepEqual(h.keys, [39, 39, 40, 40]); assert.equal(h.api.isOpen(), false);
    assert.equal(h.actorCommits(), 0); assert.deepEqual(h.world(), before); assert.deepEqual(h.writes, []);
});

test('SURRENDER cannot adopt an unbound PERSON menu or a label-only generic pane', () => {
    for (const mobile of [false, true]) {
        const h = surrenderHarness({mobile}); h.publish('target', {menuSeq: 12});
        Object.assign(h.hud.state, {layer: 'deep', deepKind: 'person', deepLabel: '招降'}); h.refresh();
        assert.equal(surrenderPresentation(h), null);
        assert.deepEqual(h.keys, [], 'a label and native IDs do not mint the private SURRENDER origin'); assert.deepEqual(h.writes, []);
    }
});

test('SURRENDER derives ordered native captive and allied IDs including legal duplicate queue entries', () => {
    const h = surrenderTarget({duplicate: true});
    assert.deepEqual(plain(assertSurrender(h, 'target').ids), [139, 139, 143]);
    assert.equal(h.deep(0).textContent.includes(h.names.get(139)), true);
    assert.equal(h.deep(1).textContent.includes(h.names.get(139)), true);
    h.press(h.deep(0)); h.flush(); assert.deepEqual(plain(assertSurrender(h, 'actor').ids), [29, 33]);
    assert.equal(h.actorCommits(), 0); assert.deepEqual(h.writes, []);
});

test('SURRENDER SUB index selection requires native arrow ACK before ENTER and rechecks the original source', () => {
    const h = surrenderHarness({subIndex: 4}); h.enter(); assert.deepEqual(h.keys, [35]);
    assert.equal(surrenderPresentation(h), null); assert.equal(h.stage(), 'sub');
    h.flush(); assert.deepEqual(h.keys, [35, 39]); assert.equal(surrenderPresentation(h), null);
    h.flush(); assertSurrender(h, 'target');
    const bad = surrenderHarness({subIndex: 4}); bad.enter(); assert.deepEqual(bad.keys, [35]);
    bad.raw.g_engineConfig = {...bad.raw.g_engineConfig}; bad.flush();
    assert.deepEqual(bad.keys, [35], 'config replacement between the acknowledged arrow and ENTER retires the request');
    assert.equal(surrenderPresentation(bad), null); assert.deepEqual(bad.writes, []);
});

test('SURRENDER pending accepted ENTER cannot be reused by close or classic/HD before native role ACK', () => {
    const h = surrenderTarget(), before = h.world(); h.setFreezeKey(true); h.press(h.deep(0));
    assert.deepEqual(h.keys, [39, 39]); assert.equal(surrenderPresentation(h), null);
    reopenSurrender(h); h.back(); const button = h.deep(0); if (button) h.press(button);
    assert.deepEqual(h.keys, [39, 39]); assert.equal(surrenderPresentation(h), null);
    assert.equal(h.actorCommits(), 0); assert.deepEqual(h.world(), before); assert.deepEqual(h.writes, []);
});

test('SURRENDER unknown ENTER preserves the exact exception and consumed role through close and mode cycles', () => {
    for (const role of ['target', 'actor']) {
        const h = role === 'target' ? surrenderTarget() : surrenderActor();
        const original = new Error('unknown SURRENDER ' + role + ' ENTER transport'), before = h.keys.slice();
        h.setSendError(original); assert.throws(() => h.press(h.deep(0)), error => error === original);
        assert.deepEqual(h.keys, before.concat(39)); h.setSendError(null); reopenSurrender(h);
        h.back(); const button = h.deep(0); if (button) h.press(button);
        assert.deepEqual(h.keys, before.concat(39)); assert.equal(surrenderPresentation(h), null); assert.deepEqual(h.writes, []);
    }
});

test('SURRENDER pending and unknown EXIT from either role remain one-shot across public presentation retirement', () => {
    for (const role of ['target', 'actor']) for (const unknown of [false, true]) {
        const h = role === 'target' ? surrenderTarget() : surrenderActor(), before = h.keys.slice();
        const original = new Error('unknown SURRENDER ' + role + ' EXIT transport');
        if (unknown) h.setSendError(original); else h.setFreezeKey(true);
        if (unknown) assert.throws(() => h.back(), error => error === original); else h.back();
        assert.deepEqual(h.keys, before.concat(40)); h.setSendError(null); reopenSurrender(h); h.back();
        assert.deepEqual(h.keys, before.concat(40)); assert.equal(surrenderPresentation(h), null);
        assert.equal(h.actorCommits(), 0); assert.deepEqual(h.writes, []);
    }
});

test('SURRENDER true fresh actor and target ACKs retire consumed reservations without authorizing a stale menu', () => {
    const h = surrenderTarget(), original = new Error('unknown but later observed native target ENTER');
    const targetSeq = h.menu.seq; h.setSendError(original);
    assert.throws(() => h.press(h.deep(0)), error => error === original); h.setSendError(null);
    h.publish('actor', {menuSeq: h.next(h.next(targetSeq))}); h.refresh(); assertSurrender(h, 'actor');
    h.back(); h.flush(); assertSurrender(h, 'target');
    h.press(h.deep(0)); h.flush(); assertSurrender(h, 'actor'); h.back(); h.flush();
    h.back(); h.flush(); assert.deepEqual(h.keys, [39, 39, 40, 39, 40, 40]);
    assert.equal(h.actorCommits(), 0); assert.equal(h.api.isOpen(), false); assert.deepEqual(h.writes, []);
});

test('SURRENDER paired presses reject source, sender, queue, native owner and library drift before any new key', () => {
    const changes = {
        data(h) {h.context.baye.data = h.readonlyLocation({...h.raw});},
        config(h) {h.raw.g_engineConfig = {...h.raw.g_engineConfig};},
        cities(h) {h.raw.g_Cities = h.cities.slice();},
        queue(h) {h.raw.g_PersonsQueue = h.queue.slice();},
        'queue-content'(h) {h.queue[5] = 143;},
        'queue-range'(h) {h.city.Persons--;},
        sender(h) {h.context.sendKey = key => h.keys.push(key);},
        'engine-sender'(h) {h.context.baye.sendKey = key => h.keys.push(key);},
        library(h) {h.setIdentity({...h.identity, generation: 2});},
        'identity-reader'(h) {h.context.BayeHdLibIdentity.read = () => h.identity;},
        'identity-current'(h) {h.context.BayeHdLibIdentity.isCurrent = () => true;},
        'person-name-reader'(h) {h.context.baye.getPersonName = id => h.names.get(id) ?? '';},
        'person-count-reader'(h) {h.context.baye.getPersonCount = () => 200;},
        'hooks-object'(h) {h.context.baye.hooks = {};},
        'city-command'(h) {h.context.baye.hooks.cityMakeCommand = () => {assert.fail('custom command hook must not be replayed');};},
        hooks(h) {h.context.baye.hooks.getPersonPropertyValue = () => {throw Error('must not invoke custom hook');};},
        'native-seq'(h) {h.menu.seq = h.raw.g_hdMenuSeq = h.next(h.menu.seq);},
        'native-ids'(h) {h.menu.ids.reverse(); h.menu.names.reverse(); h.menu.packedNames.reverse();},
        'detail-generation'(h) {h.menu.generation = h.menu.detailGeneration = h.raw.g_hdDetailGeneration = 4;}
    };
    for (const [name, change] of Object.entries(changes)) {
        const h = surrenderTarget(), button = h.down(h.deep(0)), before = h.keys.slice();
        change(h); h.click(button);
        assert.deepEqual(h.keys, before, name); h.refresh();
        assert.equal(surrenderPresentation(h), null, name); assert.deepEqual(h.writes, [], name);
    }
});

test('SURRENDER rejects wrong role members, sequence jumps and active overlays rather than guessing a return', () => {
    for (const problem of ['allied-target', 'captive-actor', 'seq-jump', 'report', 'help', 'qty']) {
        const h = surrenderTarget(), before = h.keys.slice();
        if (problem === 'allied-target') h.publish('target', {ids: [29, 33]});
        if (problem === 'captive-actor' || problem === 'seq-jump') {
            h.press(h.deep(0)); before.push(39);
            h.nativePending.splice(0);
            h.publish('actor', {menuSeq: problem === 'seq-jump' ? h.next(h.menu.seq) + 2 : h.next(h.menu.seq),
                ids: problem === 'captive-actor' ? [139, 143] : [29, 33]});
        }
        if (problem === 'report') {h.raw.g_hdReportActive = h.report.active = 1;}
        if (problem === 'help') {h.raw.g_hdHelpActive = h.help.active = 1;}
        if (problem === 'qty') {h.raw.g_hdQtyActive = h.qty.active = 1;}
        h.refresh(); assert.equal(surrenderPresentation(h), null, problem); h.back();
        const button = h.deep(0); if (button) h.press(button);
        assert.deepEqual(h.keys, before, problem); assert.equal(h.actorCommits(), 0); assert.deepEqual(h.writes, [], problem);
    }
});

test('SURRENDER same-owner synchronous bridge reentry cannot publish or consume a partially read source', () => {
    for (const method of ['render-and-back', 'person-detail', 'person-properties', 'public-diagnostic']) {
        const h = surrenderTarget(); let reads = 0, inside = false;
        // The native name reader's original reference is installed before entry.
        // Its callback changes behavior without a replacement-ref shortcut.
        h.setNameReadHook(() => {
            if (inside) return;
            inside = true;
            try {
                reads++;
                if (method === 'render-and-back') {h.hud.render(); h.back();}
                if (method === 'person-detail') h.hud.renderPersonDetails();
                if (method === 'person-properties') h.hud.renderPersonProperties();
                if (method === 'public-diagnostic') h.api.debugSnapshot();
            } finally {inside = false;}
        });
        const traceLimit = Error.stackTraceLimit; Error.stackTraceLimit = 64;
        try {h.refresh();} finally {Error.stackTraceLimit = traceLimit;}
        assert.ok(reads > 0, method); assert.equal(surrenderPresentation(h), null, method);
        assert.deepEqual(h.keys, [39], method + '\n' + h.sendStacks.join('\n')); assert.deepEqual(h.writes, [], method);
        h.setNameReadHook(null); h.refresh(); assertSurrender(h, 'target'); assert.equal(h.actorCommits(), 0);
    }
});

test('SURRENDER actor confirmation can remove the final allied resident before a fresh captive target and its single EXIT', () => {
    for (const terminalKey of [40, 39]) {
        const h = surrenderActor({singleActor: true}), oldSeq = h.menu.seq;
        assert.deepEqual(h.roleIds('actor'), [29]);
        h.setActorCommitEffect(id => {
            // Model only C DelPerson's resident-list effect. This is not an actual
            // recruitment/order/fee result and earns no real business credit.
            const start = h.city.PersonQueue, count = h.city.Persons;
            const offset = h.queue.slice(start, start + count).indexOf(id); assert.ok(offset >= 0);
            for (let i = start + offset; i < start + count - 1; i++) h.queue[i] = h.queue[i + 1];
            h.queue[start + count - 1] = 0; h.city.Persons--;
        });
        h.press(h.deep(0)); assert.deepEqual(h.keys, [39, 39, 39]); assert.equal(surrenderPresentation(h), null);
        h.flush(); assert.equal(h.menu.seq, h.next(h.next(oldSeq))); assert.deepEqual(h.roleIds('actor'), []);
        assertSurrender(h, 'target'); assert.deepEqual(h.roleIds('target'), [139, 143]);
        if (terminalKey === 40) {h.back(); h.flush();}
        else {
            h.press(h.deep(0)); h.refresh(); assert.equal(surrenderPresentation(h), null); assert.equal(h.api.isOpen(), true);
            // Observe only the eventual C report completion/MAP publication.
            // No HD report ACK or report-success assertion is supplied here.
            Object.assign(h.raw, {g_hdReportActive: 0, g_hdReportKind: 0}); Object.assign(h.report, {active: 0, kind: 0, text: ''});
            h.publish('map'); h.refresh();
        }
        assert.equal(h.api.isOpen(), false); assert.equal(surrenderPresentation(h), null);
        assert.deepEqual(h.keys, [39, 39, 39, terminalKey]); assert.equal(h.actorCommits(), 1); assert.deepEqual(h.writes, []);
    }
});

// Real interval observation, without the fixture's refresh()/forced render.
// A DEPARTED march and inactive quantity/report retain their original payloads.
test('SURRENDER PC interval alone observes delayed PERSON ACK with retained departed-march report and quantity', () => {
    const h = surrenderHarness(), before = h.world();
    Object.assign(h.march, {phase: 7, session: 1, inputSeq: 12, origin: 15, selected: 3, seq: 1,
        ok: 0, city: 15, obj: 16, mapInputSeq: 7});
    Object.assign(h.raw, {g_hdMarchPhase: 7, g_hdMarchSession: 1, g_hdMarchInputSeq: 12, g_hdMarchOrigin: 15,
        g_hdMarchSelected: 3, g_hdMarchSeq: 1, g_hdMarchOk: 0, g_hdMarchCity: 15, g_hdMarchObj: 16, g_hdMapInputSeq: 7,
        g_hdReportSeq: 12, g_hdReportInputSeq: 26, g_hdReportKind: 2, g_hdReportPerson: 20,
        g_hdQtySession: 13, g_hdQtyInputSeq: 1, g_hdQtyLastKey: 39, g_hdQtyCursor: 3, g_hdQtyMin: 1,
        g_hdQtyMax: 1140, g_hdQtyValue: 1140});
    Object.assign(h.report, {active: 0, seq: 12, inputSeq: 26, kind: 2, person: 20, text: '许昌  出现  暴动，须尽快治理。'});
    Object.assign(h.qty, {active: 0, session: 13, inputSeq: 1, lastKey: 39, cursor: 3, min: 1, max: 1140, value: 1140});
    h.hud.state.consumedMarchSeq = 1;
    const reportBefore = plain(h.report), quantityBefore = plain(h.qty);
    function nativePublicationAndPoll() {
        const callbacks = h.nativePending.splice(0); assert.equal(callbacks.length, 1, 'one native publication');
        callbacks[0](); h.poll();
    }
    h.enter(); assert.deepEqual(h.keys, [39]); assert.equal(surrenderPresentation(h), null);
    nativePublicationAndPoll(); assertSurrender(h, 'target');
    assert.equal(h.hud.state.deepMenuOwner.seq, h.menu.seq); assert.equal(h.hud.state.personDetail.personIndex, 139);
    assert.equal(h.hud.state.personProperties.paintSeq, h.context.baye.hd.personProperties().paintSeq);
    h.press(h.deep(0)); assert.equal(surrenderPresentation(h), null);
    nativePublicationAndPoll(); assertSurrender(h, 'actor');
    assert.equal(h.hud.state.personDetail.personIndex, 29);
    h.back(); nativePublicationAndPoll(); assertSurrender(h, 'target');
    h.back(); nativePublicationAndPoll(); assert.equal(surrenderPresentation(h), null); assert.equal(h.api.isOpen(), false);
    assert.deepEqual(h.keys, [39, 39, 40, 40]); assert.deepEqual(h.world(), before); assert.deepEqual(h.writes, []);
    assert.deepEqual(plain(h.report), reportBefore); assert.deepEqual(plain(h.qty), quantityBefore);
    assert.equal(h.march.phase, 7); assert.equal(h.march.inputSeq, 12); assert.equal(h.actorCommits(), 0);
});

// The arranged-orders surface reads the original physical tables. Actors have
// already left the resident queue after C DelPerson; that is not a missing actor.
function plansHarness() {
    const h = harness(), cache = new WeakMap();
    h.people = Array.from({length: 2000}, () => ({Belong: 0}));
    for (const id of [0, 20, 22, 199]) h.people[id].Belong = 1;
    h.people[70].Belong = 2; h.people[71].Belong = 65535;
    h.cities = Array.from({length: 38}, () => ({...h.city, Belong: 2, SatrapId: 0, Persons: 0, PersonQueue: 0}));
    h.city = h.cities[0]; Object.assign(h.city, {Belong: 1, Persons: 1, PersonQueue: 10});
    h.queue = Array(2000).fill(0); h.queue[10] = 0;
    h.orders = Array.from({length: 200}, () => ({OrderId: 255, Person: 0, City: 0,
        Object: 0, Money: 0, Food: 0, Arms: 0, Consume: 0, TimeCount: 0}));
    h.fighterIndex = Array(30).fill(0); h.fighters = Array(600).fill(0);
    Object.assign(h.raw, {g_Cities: h.cities, g_Persons: h.people, g_PersonsQueue: h.queue,
        g_OrderQueue: h.orders, FIGHTERS_IDX: h.fighterIndex, FIGHTERS: h.fighters,
        g_engineConfig: {citiesCount: 38}, g_PlayerKing: 0, g_PIdx: 1, g_YearDate: 190, g_MonthDate: 1,
        g_hdEngineReady: 1, g_hdDetailGeneration: 3, g_hdMapCity: 1, g_hdMapPick: 0,
        g_hdMenuActive: 1, g_hdMenuContext: 1, g_hdMenuKind: 1, g_hdMenuSeq: 8,
        g_hdMenuCount: 4, g_hdMenuIndex: 3, g_hdReportActive: 0, g_hdHelpActive: 0,
        g_hdQtyActive: 0, g_hdFightActive: 0, g_hdMarchPhase: 0});
    h.readonlyPlans = function readonly(value, at = '') {
        if (!value || typeof value !== 'object') return value;
        if (cache.has(value)) return cache.get(value);
        const proxy = new Proxy(value, {get(target, key) {return readonly(target[key], at + '.' + String(key));},
            set(target, key) {h.writes.push(at + '.' + String(key)); throw Error('plans reader wrote native data');}});
        cache.set(value, proxy); return proxy;
    };
    h.context.baye.data = h.readonlyPlans(h.raw); h.context.baye.ensureData = () => h.context.baye.data;
    h.context.baye.hooks = {};
    h.context.dynLib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url)).toString('hex');
    h.context.baye.getPersonCount = () => 200; h.context.baye.hdCityLimit = () => 38;
    h.names.clear(); for (let id = 0; id < 200; id++) h.names.set(id, '人物' + id);
    h.names.set(0, '董卓'); h.names.set(20, '吕布'); h.names.set(22, '张辽');
    h.personCalls = []; h.cityCalls = []; let nameHook = null;
    h.context.baye.getPersonName = id => {h.personCalls.push(id); if (nameHook) nameHook(id); return h.names.get(id) ?? '';};
    h.context.baye.getCityName = id => {h.cityCalls.push(id); return id === 0 ? '洛阳' : id === 16 ? '许昌' : '城' + id;};
    Object.assign(h.menu, {active: 1, context: 1, kind: 1, seq: 8, generation: 3, detailGeneration: 3,
        count: 4, index: 3, names: ['内政', '外交', '军备', '状况'], idsValid: false, ids: []});
    h.identity = {status: 'ready', sha256: standardHash, byteLength: 207195, generation: 1}; h.setIdentity(h.identity);
    Object.assign(h.hud.state, {open: true, cityIndex: 0, cityName: '洛阳', layer: 'status', deepKind: '',
        deepMenuOwner: null, deepSelectionPending: null});
    h.renderPlans = () => h.hud.renderStatus();
    h.plan = (slot, orderId, person = 20, values = {}) => Object.assign(h.orders[slot], {OrderId: orderId, City: 0, Person: person}, values);
    h.army = (slot, personIds) => {
        h.fighterIndex[slot] = 1;
        for (let i = 0; i < 10; i++) {
            const id = personIds[i] == null ? 0 : personIds[i] + 1, offset = slot * 20 + i * 2;
            h.fighters[offset] = id & 255; h.fighters[offset + 1] = id >>> 8;
        }
    };
    h.nameHook = value => {nameHook = value;};
    vm.runInContext(read('js/hd-city-plans.js'), h.context, {filename: 'js/hd-city-plans.js'});
    return h;
}
function plansPane(h) {return h.nodes['hd-city-menu-status'].querySelector('[data-hd-city-plans]');}
function planRows(h) {
    const pane = plansPane(h); return pane ? pane.querySelectorAll('[data-hd-city-order]').map(row => {
        assert.equal(row.children[0].tagName, 'SPAN'); assert.equal(row.children[1].tagName, 'STRONG');
        return {slot: Number(row.getAttribute('data-hd-city-order')), order: Number(row.getAttribute('data-hd-city-order-id')),
            label: row.children[0].textContent, value: row.children[1].textContent};
    }) : [];
}
function assertPlansAbsent(h, reason) {
    assert.equal(plansPane(h), null, reason); assert.deepEqual(h.keys, [], reason); assert.deepEqual(h.writes, [], reason);
}

test('arranged city plans show ordinary actors and all nonzero army members in exact queue order', () => {
    const h = plansHarness();
    h.plan(3, 24); h.plan(7, 13, 22, {Object: 16}); h.army(2, [20, null, 22, 20, null, null, null, null, null, 199]);
    h.plan(170, 27, 2, {Object: 16});
    const before = plain(h.raw), menu = plain(h.menu); h.renderPlans();
    assert.equal(plansPane(h)?.tagName, 'SECTION');
    assert.match(plansPane(h).querySelector('h3').textContent, /^本月已安排事务（3）$/);
    assert.deepEqual(planRows(h), [{slot: 3, order: 24, label: '征兵', value: '吕布'},
        {slot: 7, order: 13, label: '输送', value: '张辽 → 许昌'},
        {slot: 170, order: 27, label: '出征', value: '吕布、张辽、吕布、人物199 → 许昌'}]);
    assert.equal(h.queue.slice(h.city.PersonQueue, h.city.PersonQueue + h.city.Persons).includes(20), false);
    for (const tag of ['button', 'input', 'a']) assert.equal(plansPane(h).querySelectorAll(tag).length, 0);
    assert.deepEqual(plain(h.raw), before); assert.deepEqual(plain(h.menu), menu);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('arranged plans exclude foreign cities, other allegiances and empty slots before reading their names', () => {
    const h = plansHarness(); h.plan(4, 1); h.plan(5, 1); // Repeated native slots remain separate rows.
    h.plan(6, 3, 70, {City: 1}); h.plan(7, 3, 70); h.plan(8, 6, 71); h.plan(9, 3, 72);
    h.plan(10, 255, 73); h.plan(171, 27, 29, {City: 1, Object: 16});
    h.army(2, [20, 70]); h.plan(170, 27, 2, {Object: 16});
    h.renderPlans();
    assert.deepEqual(planRows(h).map(row => [row.slot, row.order, row.value]), [[4, 1, '吕布'], [5, 1, '吕布']]);
    for (const hiddenId of [70, 71, 72, 73]) assert.equal(h.personCalls.includes(hiddenId), false, String(hiddenId));
    h.city.Belong = 2; h.renderPlans(); assertPlansAbsent(h, 'the selected city is no longer owned');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('arranged plans use only order-relevant fields and never invent countdowns or pending resource amounts', () => {
    const labels = [[0, '归队'], [1, '开垦'], [2, '招商'], [3, '搜寻'], [4, '治理'], [5, '出巡'], [6, '招降'],
        [11, '交易'], [13, '输送'], [14, '移动'], [15, '离间'], [16, '招揽'], [17, '策反'], [19, '劝降'],
        [23, '侦察'], [24, '征兵'], [26, '掠夺']];
    const h = plansHarness(); let unusedReads = 0;
    labels.forEach(([id], slot) => {
        const order = h.plan(slot, id, 20, {Object: 16});
        for (const field of ['Money', 'Food', 'Arms', 'Consume', 'TimeCount', ...([6, 13, 14, 15, 16, 17, 19, 23].includes(id) ? [] : ['Object'])]) {
            Object.defineProperty(order, field, {get() {unusedReads++; throw Error('unused original field read');}, configurable: true});
        }
    });
    for (const field of ['Person', 'City', 'Object'])Object.defineProperty(h.orders[199], field, {
        get() {unusedReads++; throw Error('empty slot metadata read');}, configurable: true});
    h.renderPlans();
    assert.deepEqual(planRows(h).map(row => [row.order, row.label, row.value]), labels.map(([id, label]) =>
        [id, label, '吕布' + ([13, 14, 23].includes(id) ? ' → 许昌' : [6, 15, 16, 17, 19].includes(id) ? ' → 人物16' : '')]));
    assert.equal(unusedReads, 0); assert.doesNotMatch(plansPane(h).textContent, /TimeCount|倒计时|剩余.*月|Money|Food|Arms/);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    const empty = plansHarness(); empty.renderPlans();
    assert.ok(plansPane(empty)); assert.match(plansPane(empty).textContent, /本月已安排事务（0）/);
    assert.match(plansPane(empty).textContent, /暂无/); assert.deepEqual(planRows(empty), []);
});

test('arranged plans withdraw torn queue/source reads and synchronous name-reader reentry, then recover cleanly', () => {
    const seed = plansHarness(); seed.plan(2, 24); seed.renderPlans();
    assert.equal(planRows(seed).length, 1);
    const lastNameCall = seed.personCalls.filter(id => id === 20).length; assert.ok(lastNameCall >= 2);
    const mutations = [h => {h.orders[199].OrderId = 1; h.orders[199].Person = 22;},
        h => h.orders[2].OrderId = 3, h => h.people[20].Belong = 2,
        h => h.raw.g_OrderQueue = h.orders.slice(), h => h.raw.g_Persons = h.people.slice(),
        h => h.context.baye.data = h.readonlyPlans({...h.raw}),
        h => h.people.pop(), h => h.cities.pop(), h => h.orders.push({OrderId: 255}),
        h => h.identity.generation++, h => h.identity.sha256 = 'changed-library',
        h => h.raw.g_MonthDate++, h => h.raw.g_PlayerKing = 1,
        h => {h.raw.g_hdMenuSeq++; h.menu.seq++;}, h => h.raw.g_hdMapCity = 2];
    for (const mutate of mutations) {
        const h = plansHarness(); h.plan(2, 24); let calls = 0, fired = false;
        h.nameHook(id => {if (id === 20 && ++calls === lastNameCall) {fired = true; mutate(h);}});
        h.renderPlans(); assert.equal(fired, true); assertPlansAbsent(h, 'last name callback changed the observed source');
    }
    const h = plansHarness(); h.plan(2, 24); let reentered = false;
    h.nameHook(id => {if (id === 20 && !reentered) {reentered = true; h.renderPlans();}});
    h.renderPlans(); assert.equal(reentered, true); assertPlansAbsent(h, 'synchronous render reentry');
    h.nameHook(null); h.renderPlans(); assert.equal(planRows(h).length, 1);
    Object.assign(h.hud.state, {open: false}); h.renderPlans(); assertPlansAbsent(h, 'closed city shell');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('arranged plans reject malformed local orders and ambiguous or incomplete native armies as a whole', () => {
    const mutations = [h => delete h.raw.FIGHTERS_IDX, h => delete h.raw.FIGHTERS,
        h => h.fighterIndex.pop(), h => h.fighters.pop(), h => h.fighterIndex[2] = 0, h => h.fighterIndex[2] = 2,
        h => {h.fighters[40] = h.fighters[41] = 0;}, h => h.fighters[40] = -1,
        h => {h.fighters[42] = 201; h.fighters[43] = 0;},
        h => h.people[22].Belong = null,
        h => h.orders[170].Person = 30, h => h.plan(171, 27, 2, {Object: 16}),
        h => h.orders[170].Object = 38, h => h.orders[2].OrderId = 20,
        h => h.orders[2].Person = 200, h => h.names.set(20, ''),
        h => h.orders.pop(), h => h.people.pop(), h => h.cities.pop(),
        h => h.context.baye.getPersonCount = () => 2000];
    for (const mutate of mutations) {
        const h = plansHarness(); h.plan(2, 24); h.army(2, [20, 22]); h.plan(170, 27, 2, {Object: 16});
        mutate(h); h.renderPlans(); assertPlansAbsent(h, 'invalid local plan or native army');
        assert.equal(h.personCalls.includes(70), false, 'enemy army members are not resolved to hidden names');
    }
});

test('arranged person-target orders show exact zero-based targets independently of their present allegiance', () => {
    const h = plansHarness(), entries = [[2, 6, 71], [4, 15, 70], [6, 16, 0], [8, 17, 72], [10, 19, 199]];
    h.people[199].Belong = 3;
    for (const [slot, command, target] of entries) h.plan(slot, command, 20, {Object: target});
    h.plan(12, 13, 22, {Object: 16}); h.army(2, [20, 22]); h.plan(170, 27, 2, {Object: 16});
    const before = plain(h.raw), menu = plain(h.menu); h.renderPlans();
    assert.deepEqual(planRows(h).map(row => [row.slot, row.value]), [[2, '吕布 → 人物71'], [4, '吕布 → 人物70'],
        [6, '吕布 → 董卓'], [8, '吕布 → 人物72'], [10, '吕布 → 人物199'], [12, '张辽 → 许昌'], [170, '吕布、张辽 → 许昌']]);
    const dto = h.context.BayeHdCityPlans.read(0); assert.ok(dto);
    assert.deepEqual(plain(dto.rows.map(row => [row.slot, row.targetPerson])),
        [[2, 71], [4, 70], [6, 0], [8, 72], [10, 199], [12, null], [170, null]]);
    assert.deepEqual(plain(h.raw), before); assert.deepEqual(plain(h.menu), menu);
    for (const belong of [0, 1, 4, 65535]) {
        h.people[70].Belong = belong; h.renderPlans();
        assert.equal(planRows(h).find(row => row.slot === 4)?.value, '吕布 → 人物70', 'a queued target is not re-filtered as an allied actor');
    }
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('arranged person-target payloads stay unread for other cities, other actors, empty slots and unrelated commands', () => {
    const h = plansHarness(); h.plan(2, 16, 20, {Object: 70});
    h.plan(3, 16, 20, {City: 1}); h.plan(4, 6, 70); h.plan(5, 19, 71);
    h.plan(6, 255); h.plan(7, 24, 22);
    let unusedTargets = 0;
    for (const slot of [3, 4, 5, 6, 7]) Object.defineProperty(h.orders[slot], 'Object', {
        get() {unusedTargets++; throw Error('excluded or unrelated order target was read');}, configurable: true});
    h.renderPlans();
    assert.deepEqual(planRows(h).map(row => [row.slot, row.value]), [[2, '吕布 → 人物70'], [7, '张辽']]);
    const dto = h.context.BayeHdCityPlans.read(0); assert.ok(dto);
    assert.deepEqual(plain(dto.rows.map(row => row.targetPerson)), [70, null]);
    assert.equal(unusedTargets, 0); assert.equal(h.personCalls.includes(71), false);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('arranged person targets withdraw malformed or torn references, names and reentrant callbacks as a whole', () => {
    const invalid = [h => delete h.orders[2].Object, h => h.orders[2].Object = null,
        h => h.orders[2].Object = false, h => h.orders[2].Object = '70', h => h.orders[2].Object = -1,
        h => h.orders[2].Object = 200, h => h.orders[2].Object = 1.5,
        h => h.people[70] = undefined, h => h.names.set(70, ''), h => h.names.set(70, '-'), h => h.names.set(70, '   ')];
    for (const change of invalid) {
        const h = plansHarness(); h.plan(2, 16, 20, {Object: 70}); h.renderPlans(); assert.equal(planRows(h).length, 1);
        change(h); h.renderPlans(); assertPlansAbsent(h, 'invalid person target cannot leave a partial plan pane');
    }
    const seed = plansHarness(); seed.plan(2, 16, 20, {Object: 70}); seed.renderPlans();
    const last = seed.personCalls.filter(id => id === 70).length; assert.ok(last >= 2);
    const drifts = [h => h.orders[2].Object = 71, h => h.people[70] = {...h.people[70]},
        h => h.names.set(70, '更新姓名'), h => h.raw.g_Persons = h.people.slice(),
        h => {const name = h.context.baye.getPersonName; h.context.baye.getPersonName = id => name(id); }];
    for (const change of drifts) {
        const h = plansHarness(); h.plan(2, 16, 20, {Object: 70}); let calls = 0, fired = false;
        h.nameHook(id => {if (id === 70 && ++calls === last) {fired = true; change(h);}});
        h.renderPlans(); assert.equal(fired, true); assertPlansAbsent(h, 'last target-name callback changed the observed source');
    }
    for (const from of ['target-name', 'target-object']) {
        const h = plansHarness(); h.plan(2, 16, 20, {Object: 70}); let reentered = false;
        const enter = () => {if (!reentered) {reentered = true; h.renderPlans();}};
        if (from === 'target-name') h.nameHook(id => {if (id === 70) enter();});
        else Object.defineProperty(h.orders[2], 'Object', {get() {enter(); return 70;}, configurable: true});
        h.renderPlans(); assert.equal(reentered, true); assertPlansAbsent(h, from + ' synchronous reentry');
        h.nameHook(null); Object.defineProperty(h.orders[2], 'Object', {value: 70, writable: true, configurable: true});
        h.renderPlans(); assert.equal(planRows(h)[0]?.value, '吕布 → 人物70');
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});

// Inventory uses only found city-queue instances. Equipment and undiscovered
// IDs are deliberately outside this read-only status surface.
function inventoryHarness() {
    const h = plansHarness();
    h.goods = Array(2000).fill(0xffff); h.raw.g_GoodsQueue = h.goods;
    Object.assign(h.city, {ToolQueue: 40, Tools: 0});
    h.inventoryNames = new Map(Array.from({length: 33}, (_, id) => [id, '道具' + id]));
    h.inventoryNameCalls = []; let nameHook = null, toolCount = 33;
    h.context.baye.getToolCount = () => toolCount;
    h.context.baye.getToolName = id => {
        h.inventoryNameCalls.push(id); if (nameHook) nameHook(id); return h.inventoryNames.get(id) ?? '';
    };
    h.inventoryNameHook = value => {nameHook = value;}; h.inventoryToolCount = value => {toolCount = value;};
    h.inventory = (values, start = 40) => {
        Object.assign(h.city, {ToolQueue: start, Tools: values.length});
        values.forEach((value, index) => {h.goods[start + index] = value;});
    };
    h.renderInventory = () => h.hud.renderStatus();
    vm.runInContext(read('js/hd-city-inventory.js'), h.context, {filename: 'js/hd-city-inventory.js'});
    h.readInventory = (cityIndex = 0) => {
        const value = h.context.BayeHdCityInventory.read(cityIndex); return value === null ? null : plain(value);
    };
    return h;
}
function inventoryPane(h) {return h.nodes['hd-city-menu-status'].querySelector('[data-hd-city-inventory]');}
function inventoryRows(h) {
    const pane = inventoryPane(h); return pane ? pane.querySelectorAll('[data-hd-city-tool]').map(row => {
        assert.equal(row.children[0].tagName, 'SPAN'); assert.equal(row.children[1].tagName, 'STRONG');
        return {id: Number(row.getAttribute('data-hd-city-tool')), count: Number(row.getAttribute('data-hd-city-tool-count')),
            name: row.children[0].textContent, value: row.children[1].textContent};
    }) : [];
}
function assertInventoryAbsent(h, reason) {
    assert.equal(inventoryPane(h), null, reason); assert.deepEqual(h.keys, [], reason); assert.deepEqual(h.writes, [], reason);
}

test('discovered city inventory preserves full names, first occurrence and per-ID quantities without counting hidden duplicates', () => {
    const h = inventoryHarness(), lastName = '三十二号完整道具名称甲乙丙丁戊己庚辛壬癸';
    h.inventoryNames.set(0, '零号完整道具'); h.inventoryNames.set(32, lastName);
    h.inventoryNames.set(1, '同名道具'); h.inventoryNames.set(2, '同名道具');
    h.inventory([0x8020, 32, 0x8000, 0x8020, 0x8001, 0x8002, 0x7fff, 0, 0x8001]);
    h.cities[1].ToolQueue = 300; h.cities[1].Tools = 2; h.goods[300] = 0x8009; h.goods[301] = 0x8020;
    const before = plain(h.raw), menu = plain(h.menu); h.renderInventory();
    assert.equal(inventoryPane(h)?.tagName, 'SECTION'); assert.equal(inventoryPane(h).getAttribute('data-hd-city-inventory'), '1');
    assert.equal(inventoryPane(h).querySelector('h3').textContent, '已发现城内道具（6件）');
    assert.deepEqual(inventoryRows(h), [{id: 32, name: lastName, count: 2, value: '2 件'},
        {id: 0, name: '零号完整道具', count: 1, value: '1 件'}, {id: 1, name: '同名道具', count: 2, value: '2 件'},
        {id: 2, name: '同名道具', count: 1, value: '1 件'}]);
    assert.deepEqual(h.readInventory(), {cityIndex: 0, total: 6, rows: [{id: 32, name: lastName, count: 2},
        {id: 0, name: '零号完整道具', count: 1}, {id: 1, name: '同名道具', count: 2}, {id: 2, name: '同名道具', count: 1}]});
    assert.deepEqual([...new Set(h.inventoryNameCalls)], [32, 0, 1, 2]);
    for (const id of [32, 0, 1, 2]) assert.ok(h.inventoryNameCalls.filter(value => value === id).length >= 2);
    for (const tag of ['button', 'input', 'a']) assert.equal(inventoryPane(h).querySelectorAll(tag).length, 0);
    assert.doesNotMatch(inventoryPane(h).textContent, /32767|65535|未发现|隐藏|TimeCount/);
    assert.deepEqual(plain(h.raw), before); assert.deepEqual(plain(h.menu), menu);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});

test('empty, hidden-only, foreign and out-of-range inventory never ask for hidden names or equipment attributes', () => {
    for (const [values, start] of [[[], 40], [[], 2000], [[0, 32, 0x7fff], 40]]) {
        const h = inventoryHarness(); h.inventory(values, start); let outsideReads = 0, propertyReads = 0;
        h.context.baye.hd.toolDetails = () => {propertyReads++; throw Error('inventory does not inspect tool properties');};
        for (const field of ['Equip', 'Tool1', 'Tool2']) Object.defineProperty(h.people[0], field, {
            get() {propertyReads++; throw Error('equipped tools are not city inventory');}, configurable: true});
        for (const offset of [0, 1999]) Object.defineProperty(h.goods, offset, {
            get() {outsideReads++; throw Error('another range was inspected');}, configurable: true});
        h.renderInventory();
        assert.ok(inventoryPane(h)); assert.equal(inventoryPane(h).querySelector('h3').textContent, '已发现城内道具（0件）');
        assert.match(inventoryPane(h).textContent, /本城暂无已发现的道具。/); assert.deepEqual(inventoryRows(h), []);
        assert.deepEqual(h.readInventory(), {cityIndex: 0, total: 0, rows: []});
        assert.deepEqual(h.inventoryNameCalls, []); assert.equal(outsideReads, 0); assert.equal(propertyReads, 0);
        assert.doesNotMatch(inventoryPane(h).textContent, /32767|65535|未发现|隐藏|库存3/);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
    const foreign = inventoryHarness(); foreign.inventory([0x8000]); foreign.city.Belong = 2;
    foreign.renderInventory(); assert.equal(foreign.readInventory(), null); assertInventoryAbsent(foreign, 'selected city is not player owned');
    assert.deepEqual(foreign.inventoryNameCalls, []);
    const other = inventoryHarness(); other.inventory([0x8000]);
    other.cities[1].ToolQueue = 300; other.cities[1].Tools = 1; other.goods[300] = 0x8009;
    assert.equal(other.readInventory(1), null, 'a public read cannot inspect a city other than the current ROOT owner');
    other.hud.state.cityIndex = 1; other.renderInventory(); assertInventoryAbsent(other, 'HD city and native current city disagree');
    assert.deepEqual(other.inventoryNameCalls, []);
});

test('city inventory rejects invalid found IDs, bounds and torn sources, then recovers after read-only reentry', () => {
    const invalid = [h => h.inventory([0xffff]), h => h.inventory([0x8021]), h => h.inventory([-1]),
        h => h.inventory([65536]), h => h.inventory(['32768']), h => h.inventory([NaN]),
        h => h.city.ToolQueue = -1, h => h.city.ToolQueue = 1.5, h => h.city.ToolQueue = '40',
        h => h.city.ToolQueue = 65536, h => h.city.Tools = -1, h => h.city.Tools = 1.5,
        h => h.city.Tools = '1', h => h.city.Tools = 65536,
        h => {h.city.ToolQueue = 1999; h.city.Tools = 2;}, h => {h.city.ToolQueue = 2000; h.city.Tools = 1;},
        h => h.goods.pop(), h => h.goods.push(0), h => h.cities.pop(), h => delete h.raw.g_GoodsQueue,
        h => h.inventoryToolCount(32), h => h.inventoryToolCount(34), h => h.inventoryToolCount('33')];
    for (const change of invalid) {
        const h = inventoryHarness(); h.inventory([0x8000]); change(h); h.renderInventory();
        assert.equal(h.readInventory(), null); assertInventoryAbsent(h, 'invalid inventory is not published as an empty list');
    }
    const seed = inventoryHarness(); seed.inventory([0x8000]); seed.renderInventory();
    const last = seed.inventoryNameCalls.filter(id => id === 0).length; assert.ok(last >= 2);
    const drifts = [h => h.goods[40] = 0, h => h.goods[40] = 0x8020, h => h.city.ToolQueue++, h => h.city.Tools++,
        h => h.raw.g_GoodsQueue = h.goods.slice(), h => h.raw.g_Cities = h.cities.slice(),
        h => h.cities[0] = {...h.city}, h => h.context.baye.data = h.readonlyPlans({...h.raw}),
        h => h.identity.generation++, h => h.identity.sha256 = 'changed-library',
        h => {h.raw.g_hdMenuSeq++; h.menu.seq++;}, h => h.raw.g_hdMenuIndex = 0,
        h => h.raw.g_hdMapCity = 2, h => h.city.Belong = 2, h => h.inventoryNames.set(0, '更新道具名'),
        h => h.context.baye.getToolCount = () => 33,
        h => {const name = h.context.baye.getToolName; h.context.baye.getToolName = id => name(id);},
        h => h.context.baye.hooks = {}];
    for (const change of drifts) {
        const h = inventoryHarness(); h.inventory([0x8000]); let calls = 0, fired = false;
        h.inventoryNameHook(id => {if (id === 0 && ++calls === last) {fired = true; change(h);}});
        h.renderInventory(); assert.equal(fired, true); assertInventoryAbsent(h, 'last name callback changed the sampled inventory');
    }
    const h = inventoryHarness(); h.inventory([0x8000]); let reentered = false;
    h.inventoryNameHook(() => {if (!reentered) {reentered = true; h.renderInventory();}});
    h.renderInventory(); assert.equal(reentered, true); assertInventoryAbsent(h, 'synchronous status render reentry');
    h.inventoryNameHook(null); h.renderInventory();
    assert.deepEqual(inventoryRows(h), [{id: 0, name: '道具0', count: 1, value: '1 件'}]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});
