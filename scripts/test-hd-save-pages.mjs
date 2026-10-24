#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const storageSource = readFileSync(join(root, 'js/save-storage.js'), 'utf8');
const originalGameSource = readFileSync(join(root, 'js/original-game.js'), 'utf8');
const originalLibPath = 'libs/dat-mod.lib';
const originalCloudName = 'dat-mod.lib';
const originalIdentity = 'v1:414390:1d36da77:1e9c0477';
const inlineSource = page => [...readFileSync(join(root, page), 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1])).map(match => match[2]).join('\n');
function savePageSource(page) {
    const source = inlineSource(page);
    if (page !== 'pc.html') return source;
    // Execute the real PC cloud block independently of unrelated engine boot
    // and keyboard initialization. No page implementation is copied here.
    const start = source.indexOf('//云存档');
    assert.ok(start >= 0, 'PC cloud block must remain identifiable');
    return source.slice(start);
}
const filename = index => `baye//data//sango${index}.sav`;

// Packed fixtures follow the actual 0x95 two-file layout. Their custom payload
// differs so assertions can detect a new first half paired with an old second.
function pair(label = '') {
    const count = 3, fixed = 16 + count * 21 + 4000 + 1;
    const a = Buffer.alloc(fixed + 4 + label.length);
    a[0] = 0x95; a[1] = 1; a.writeUInt16LE(count, 2); a.writeUInt16LE(0, 4);
    a.writeUInt16LE(190, 6); a[11] = 1; a.writeUInt32LE(label.length, fixed);
    a.write(label, fixed + 4);
    const b = Buffer.alloc(30 + 600 + 200 * 14 + 2 * 37 + 4);
    b.fill(0xff, 630, 3430);
    b[0] = label.length;
    return [a.toString('hex'), b.toString('hex')];
}

function node(classes = [], tag = 'div') {
    return { classes, tag, attrs: {}, props: {}, children: [], parent: null, events: new Map(), text: '', html: '', value: '', css: {} };
}
function jquery() {
    const roots = new Map();
    for (const selector of ['#libs', '#tip', '#data', '#cover', '#use-short-url', '.online-save-msg', '.online-save-slots', '.no-login', '.avatar', '.user-info']) {
        roots.set(selector, node(selector[0] === '.' ? [selector.slice(1)] : []));
    }
    roots.get('#use-short-url').value = '0';
    class Collection {
        constructor(nodes = []) { this.nodes = nodes; }
        each(action) { this.nodes.forEach(action); return this; }
        attr(key, value) { if (value === undefined) return this.nodes[0]?.attrs[key]; return this.each(n => { n.attrs[key] = String(value); }); }
        prop(key, value) { if (value === undefined) return this.nodes[0]?.props[key]; return this.each(n => { n.props[key] = value; }); }
        text(value) { if (value === undefined) return this.nodes[0]?.text; return this.each(n => { n.text = String(value); n.html = ''; }); }
        html(value) { if (value === undefined) return this.nodes[0]?.html; return this.each(n => { n.html = String(value); n.text = ''; }); }
        val(value) { if (value === undefined) return this.nodes[0]?.value; return this.each(n => { n.value = String(value); }); }
        css(value) { return this.each(n => { Object.assign(n.css, value); }); }
        show() { return this.each(n => { n.props.hidden = false; }); }
        hide() { return this.each(n => { n.props.hidden = true; }); }
        empty() { return this.each(n => { n.children = []; n.value = ''; }); }
        on(type, selector, handler) {
            if (typeof selector === 'function') { handler = selector; selector = ''; }
            return this.each(n => { n.events.set(`${type}:${selector}`, handler); });
        }
        append(collection) {
            return this.each(n => {
                for (const child of collection.nodes) { n.children.push(child); child.parent = n; }
                if (!n.value && collection.nodes[0]?.tag === 'option') n.value = collection.nodes[0].attrs.value;
            });
        }
        find(selector) {
            const result = [];
            const visit = current => { for (const child of current.children) { if (child.classes.includes(selector.slice(1))) result.push(child); visit(child); } };
            this.nodes.forEach(visit); return new Collection(result);
        }
        parent() { return new Collection(this.nodes.map(n => n.parent).filter(Boolean)); }
        children() { return new Collection(this.nodes.flatMap(n => n.children)); }
        eq(index) { return new Collection(this.nodes[index] ? [this.nodes[index]] : []); }
    }
    function $(selector) {
        if (typeof selector === 'function') { selector(); return; }
        if (typeof selector !== 'string') return new Collection(selector ? [selector] : []);
        if (selector.startsWith('<option')) return new Collection([node([], 'option')]);
        if (selector.startsWith('<div>')) {
            const item = node();
            for (const [name, tag] of [['save-name', 'span'], ['upload', 'button'], ['download', 'button'], ['save-time', 'span']]) {
                const child = node([name], tag); child.parent = item;
                if (tag === 'button') child.props.disabled = true;
                item.children.push(child);
            }
            return new Collection([item]);
        }
        return new Collection(roots.has(selector) ? [roots.get(selector)] : []);
    }
    return { $, roots };
}

function harness(page, initial = {}, { libPath = 'libs/current.lib', deferredLogin = false } = {}) {
    const values = new Map(Object.entries({ 'baye/libpath': libPath, ...initial }));
    let writes = 0, failure = null;
    const localStorage = {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) {
            writes++;
            if (failure?.({ writes, key, op: 'set' })) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
            values.set(key, String(value));
        },
        removeItem(key) {
            writes++;
            if (failure?.({ writes, key, op: 'remove' })) throw new Error('Blocked');
            values.delete(key);
        }
    };
    const { $, roots } = jquery();
    const requests = { gets: [], posts: [], uploads: [], downloads: [], logins: [], indices: [] };
    const alerts = [];
    $.get = (url, callback) => {
        requests.gets.push({ url, callback });
        if (url.endsWith('libs.json')) callback([{ path: libPath, title: 'Selected LIB' }]);
        return { fail() { return this; } };
    };
    $.post = (url, data, callback) => { requests.posts.push({ url, data, callback }); return { fail() { return this; } }; };
    const sdk = {
        getUserInfo(callback) {
            requests.logins.push(callback);
            if (!deferredLogin) callback({ nickname: 'Fixture', sav_dir: 'fixture-dir', avatar: 'local-fixture.png' });
        },
        getSaveIndex(game, directory, callback) { requests.indices.push({ game, directory, callback }); callback([]); },
        uploadSave(game, mod, index, data, callback) { requests.uploads.push({ game, mod, index, data, callback }); },
        getSave(url, callback) { requests.downloads.push({ url, callback }); }
    };
    const context = vm.createContext({
        localStorage, $, BBKSDK: sdk, console, alert: text => alerts.push(String(text)),
        document: { body: {} }, navigator: { userAgent: 'save-pages-regression' },
        location: { pathname: '/get-sav.html', protocol: 'http:', hostname: 'localhost', port: '' },
        Spinner: class { spin() {} stop() {} }
    });
    context.window = context;
    // Import/export pages intentionally run without lcd.js, a WASM Module, or a
    // loaded LIB. This executes their real inline code and shared storage API.
    vm.runInContext(storageSource, context, { filename: 'js/save-storage.js' });
    vm.runInContext(originalGameSource, context, { filename: 'js/original-game.js' });
    vm.runInContext(savePageSource(page), context, { filename: page });
    return {
        context, values, $, roots, requests, alerts,
        fail(fn) { writes = 0; failure = fn; },
        clearFailure() { writes = 0; failure = null; },
        click(type, slot = 0) {
            const slots = roots.get('.online-save-slots'), button = slots.children[slot].children.find(n => n.classes.includes(type));
            if (!button.attrs['data-index']) button.attrs['data-index'] = String(slot + 1);
            if (type === 'download') button.attrs['data-url'] = 'fixture://save';
            slots.events.get(`click:.${type}`).call(button);
            return button;
        }
    };
}
function imported(h, slot, files, metadata = {}) {
    assert.equal(h.context.BayeSaveStorage.importSlot(slot, { sav0: files[0], sav1: files[1], ...metadata }), true);
}
function oldJournalValues(h, slot) {
    return new Map([...h.values].filter(([key]) => key.startsWith(filename(slot * 2)) || key.startsWith(filename(slot * 2 + 1))));
}
function tip(h) { const n = h.roots.get('#tip'); return n.text || n.html; }
function message(h) { return h.roots.get('.online-save-msg').text || h.alerts.at(-1) || ''; }

test('real export page uses sparse slot first-file metadata and preserves wrong-LIB identity', () => {
    const h = harness('get-sav.html'), files = pair('third slot');
    imported(h, 2, files, { lib: '/mods/other.lib', name: 'Third source', identity: 'original-LIB-fingerprint' });
    const data = JSON.parse(h.context.dump(2));
    assert.deepEqual([data.sav0, data.sav1], files);
    assert.equal(data.name, 'Third source'); assert.equal(data.lib, '/mods/other.lib');
    assert.equal(data.identity, 'original-LIB-fingerprint');
    assert.equal(h.context.BayeSaveStorage.inspectSlot(2).status, 'wrong-lib');
    assert.equal(JSON.parse(h.context.dump(1)).sav0, null);
    h.context.upload(2);
    assert.deepEqual(JSON.parse(h.roots.get('#data').value), data);
    assert.equal(h.requests.posts.length, 0);
});

test('real export page sees a complete old pair and metadata after denied rollback and reload', () => {
    const h = harness('get-sav.html'), old = pair('original'), replacement = pair('replacement');
    imported(h, 1, old, { name: 'Old source', lib: '/mods/old.lib', identity: 'old-id' });
    h.fail(({ writes }) => writes >= 4);
    assert.equal(h.context.BayeSaveStorage.importSlot(1, { sav0: replacement[0], sav1: replacement[1], lib: '/mods/new.lib', name: 'New' }), false);
    assert.ok(h.values.has('baye/save-transaction/1'));
    for (const target of [h, harness('get-sav.html', Object.fromEntries(h.values))]) {
        const data = JSON.parse(target.context.dump(1));
        assert.deepEqual([data.sav0, data.sav1], old);
        assert.equal(data.name, 'Old source'); assert.equal(data.lib, '/mods/old.lib'); assert.equal(data.identity, 'old-id');
        target.context.upload(1);
        assert.deepEqual([JSON.parse(target.roots.get('#data').value).sav0, JSON.parse(target.roots.get('#data').value).sav1], old);
    }
});

test('real export page rejects empty and incomplete pairs before producing an export or cloud request', () => {
    const h = harness('get-sav.html');
    h.roots.get('#use-short-url').value = '1';
    h.context.upload(0); assert.match(tip(h), /不完整/); assert.equal(h.requests.posts.length, 0);
    h.values.set(filename(0), pair()[0]);
    h.context.upload(0); assert.match(tip(h), /不完整/); assert.equal(h.roots.get('#data').value, '');
    assert.equal(h.requests.posts.length, 0);
});

test('real export page JSON import commits both fourth-slot files and source identity', () => {
    const h = harness('get-sav.html'), files = pair('JSON import');
    h.context.loadSav(` \n${JSON.stringify({ sav0: files[0], sav1: files[1], name: 'Import source', lib: '/mods/source.lib', identity: 'source-id' })}\n `);
    assert.match(tip(h), /第4个存档位/);
    assert.deepEqual([h.context.BayeSaveStorage.readMetadata(filename(6)), h.context.BayeSaveStorage.readMetadata(filename(7))], files);
    for (const key of [filename(6), filename(7)]) {
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.name'), 'Import source');
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib'), '/mods/source.lib');
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib-id'), 'source-id');
    }
    assert.equal(h.context.BayeSaveStorage.inspectSlot(3).status, 'wrong-lib');
});

test('real export page legacy import uses fourth slot without fabricating source metadata', () => {
    const h = harness('get-sav.html'), files = pair('legacy import'), hex = files.join('_');
    imported(h, 3, pair('old'), { name: 'Old name', lib: '/mods/old.lib', identity: 'old-id' });
    h.context.loadSav(`${hex.length}/${hex}`);
    assert.match(tip(h), /第4个存档位/);
    assert.deepEqual([h.context.BayeSaveStorage.readMetadata(filename(6)), h.context.BayeSaveStorage.readMetadata(filename(7))], files);
    for (const key of [filename(6), filename(7)]) {
        for (const suffix of ['.name', '.lib', '.lib-id']) assert.equal(h.context.BayeSaveStorage.readMetadata(key + suffix), null);
    }
});

test('real export page malformed JSON and legacy pairs never replace an existing fourth slot', () => {
    const h = harness('get-sav.html'), files = pair('old');
    imported(h, 3, files, { lib: 'libs/current.lib', name: 'Original', identity: 'original-id' });
    const before = new Map(h.values), hex = files.join('_');
    for (const input of [
        JSON.stringify({ sav0: files[0] }), JSON.stringify({ sav0: '00GG', sav1: files[1] }),
        JSON.stringify({ sav0: files[0], sav1: files[1].slice(0, -2) }), '{invalid JSON',
        `${hex.length}/${hex}/ignored`, `${hex.length + 2}/${hex}`,
        `${hex.length + 1}/${hex}_`, `${hex.length}/${files[0]}_${files[1].slice(0, -2)}`
    ]) {
        h.context.loadSav(input); assert.match(tip(h), /载入失败/); assert.deepEqual(h.values, before);
    }
});

test('real export page reports transaction failure and retains the old fourth slot', () => {
    const h = harness('get-sav.html'), old = pair('old'), files = pair('new');
    imported(h, 3, old, { lib: '/mods/old.lib', name: 'Old' });
    h.fail(({ writes }) => writes >= 4);
    h.context.loadSav(JSON.stringify({ sav0: files[0], sav1: files[1], lib: '/mods/new.lib' }));
    assert.match(tip(h), /载入失败/); assert.doesNotMatch(tip(h), /已载入/);
    assert.deepEqual([h.context.BayeSaveStorage.readMetadata(filename(6)), h.context.BayeSaveStorage.readMetadata(filename(7))], old);
    assert.equal(h.context.BayeSaveStorage.readMetadata(filename(6) + '.name'), 'Old');
});

test('real cloud-code callback imports through the same transaction and does not report denied commit as success', () => {
    const h = harness('get-sav.html'), old = pair('old'), files = pair('cloud');
    imported(h, 3, old); h.fail(({ writes }) => writes >= 4);
    h.context.loadSav('fixture-code');
    assert.equal(h.requests.gets.length, 1); assert.equal(h.requests.gets[0].url, 'https://store.kvin.wang/kvstore/fixture-code');
    h.requests.gets[0].callback({ data: JSON.stringify({ sav0: files[0], sav1: files[1] }) });
    assert.match(tip(h), /载入失败/); assert.doesNotMatch(tip(h), /已载入/);
    assert.deepEqual([h.context.BayeSaveStorage.readMetadata(filename(6)), h.context.BayeSaveStorage.readMetadata(filename(7))], old);
});

test('real online page sparse upload uses complete journal-visible pair and original two-line protocol', () => {
    const seeded = harness('get-sav.html'), old = pair('original'), incoming = pair('replacement');
    imported(seeded, 2, old, { lib: originalLibPath, name: 'Third' });
    seeded.fail(({ writes }) => writes >= 4);
    assert.equal(seeded.context.BayeSaveStorage.importSlot(2, { sav0: incoming[0], sav1: incoming[1], lib: '/mods/new.lib' }), false);
    const h = harness('online-save.html', Object.fromEntries(seeded.values));
    assert.equal(h.roots.get('.online-save-slots').children[0].children[1].props.disabled, true);
    assert.equal(h.roots.get('.online-save-slots').children[2].children[1].props.disabled, false);
    const button = h.click('upload', 2);
    assert.equal(button.props.disabled, true); assert.equal(h.requests.uploads.length, 1);
    const request = h.requests.uploads[0];
    assert.equal(request.index, '3'); assert.equal(request.mod, originalCloudName); assert.equal(request.data, old.join('\n'));
    request.callback(JSON.stringify({ code: 0, data: 'fixture://uploaded', msg: 'Fixture timestamp' }));
    assert.equal(button.props.disabled, false); assert.equal(message(h), '上传成功');
});

test('real online SDK download commits the fixed original LIB path and no invented fingerprint', () => {
    const libPath = '/custom/catalog/source.lib', h = harness('online-save.html', {}, { libPath }), files = pair('download');
    const button = h.click('download', 1); assert.equal(button.props.disabled, true);
    h.requests.downloads[0].callback(`${files[0]}\r\n${files[1]}\r\n`);
    assert.equal(button.props.disabled, false); assert.equal(message(h), '导入成功');
    assert.deepEqual([h.context.BayeSaveStorage.readMetadata(filename(2)), h.context.BayeSaveStorage.readMetadata(filename(3))], files);
    for (const key of [filename(2), filename(3)]) {
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib'), originalLibPath);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib-id'), null);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.name'), null);
    }
    const upload = h.roots.get('.online-save-slots').children[1].children[1];
    assert.equal(upload.props.disabled, false); assert.equal(upload.attrs['data-index'], '2');
    h.click('upload', 1); assert.equal(h.requests.uploads[0].index, '2');
    assert.equal(h.requests.uploads[0].mod, originalCloudName);
    assert.equal(h.requests.uploads[0].data, files.join('\n'));
    assert.equal(h.values.get('baye/libpath'), libPath, 'cloud download must not rewrite prior selected-version preferences');
});

test('real online page loads only original cloud indices after late SDK login without a version catalog', () => {
    const h = harness('online-save.html', {}, { deferredLogin: true });
    assert.equal(h.roots.get('.online-save-slots').children.length, 3);
    assert.equal(h.requests.gets.length, 0);
    assert.equal(h.requests.indices.length, 0);
    h.requests.logins[0]({ nickname: 'Late login', sav_dir: 'late-dir', avatar: 'fixture.png' });
    assert.equal(h.requests.indices.length, 1); assert.equal(h.requests.indices[0].directory, 'late-dir');
    h.requests.indices[0].callback([
        { game: 'baye', mod_name: 'sc-mod.lib', index: 1, file: 'fixture://wrong-version' },
        { game: 'baye', mod_name: originalCloudName, index: 2, file: 'fixture://slot-2', time: 'Today' }
    ]);
    assert.equal(h.roots.get('.online-save-slots').children[0].children[2].props.disabled, true);
    const button = h.roots.get('.online-save-slots').children[1].children[2];
    assert.equal(button.props.disabled, false); assert.equal(button.attrs['data-index'], '2');
    assert.equal(button.attrs['data-url'], 'fixture://slot-2');
});

test('real online SDK malformed pair callbacks leave old saves unchanged', () => {
    const seeded = harness('get-sav.html'), old = pair('original');
    imported(seeded, 0, old, { lib: originalLibPath, name: 'Original' });
    for (const response of [null, old[0], `${old[0]}\n${old[1]}\nignored`, `00GG\n${old[1]}`, `${old[0]}\n${old[1].slice(0, -2)}`]) {
        const h = harness('online-save.html', Object.fromEntries(seeded.values)), before = new Map(h.values);
        h.click('download'); h.requests.downloads[0].callback(response);
        assert.notEqual(message(h), '导入成功'); assert.deepEqual(h.values, before);
    }
});

test('real online SDK denied commit and rollback never display import success or expose a mixed pair', () => {
    const seeded = harness('get-sav.html'), old = pair('original'), incoming = pair('incoming');
    imported(seeded, 0, old, { lib: originalLibPath, name: 'Original', identity: 'old-id' });
    const h = harness('online-save.html', Object.fromEntries(seeded.values));
    const before = oldJournalValues(h, 0);
    h.fail(({ writes }) => writes >= 4);
    const button = h.click('download');
    h.requests.downloads[0].callback(incoming.join('\n'));
    assert.equal(button.props.disabled, false); assert.match(message(h), /原存档已保留/);
    assert.notEqual(message(h), '导入成功');
    assert.deepEqual([h.context.BayeSaveStorage.readMetadata(filename(0)), h.context.BayeSaveStorage.readMetadata(filename(1))], old);
    for (const [key, value] of before) assert.equal(h.context.BayeSaveStorage.readMetadata(key), value);
});

test('real online page refuses a stale upload action when a save has become incomplete', () => {
    const seeded = harness('get-sav.html'), files = pair();
    imported(seeded, 0, files, { lib: originalLibPath });
    const h = harness('online-save.html', Object.fromEntries(seeded.values));
    h.values.delete(filename(1)); h.click('upload');
    assert.match(message(h), /不完整/); assert.equal(h.requests.uploads.length, 0);
});

for (const page of ['online-save.html', 'pc.html']) {
    test(`${page} rejects old Mod and same-basename foreign paths without changing any save or identity`, () => {
        for (const lib of ['libs/sc-mod.lib', '/custom/dat-mod.lib', null]) {
            const seeded = harness('get-sav.html'), files = pair('foreign original-looking save');
            imported(seeded, 0, files, { lib, name: 'Retained source', identity: 'retained-source-id' });
            const h = harness(page, { ...Object.fromEntries(seeded.values), 'baye/libpath': lib || 'libs/sc-mod.lib' });
            const before = new Map(h.values);
            assert.equal(h.roots.get('.online-save-slots').children[0].children[1].props.disabled, true);
            // A stale button/handler must recheck both exact metadata paths.
            h.click('upload');
            assert.match(message(h), /原版/);
            assert.equal(h.requests.uploads.length, 0);
            assert.deepEqual(h.values, before);
        }
    });

    test(`${page} rechecks both file identities before a formerly enabled upload`, () => {
        const seeded = harness('get-sav.html'), files = pair('matching pair');
        imported(seeded, 0, files, { lib: originalLibPath, identity: originalIdentity });
        const h = harness(page, { ...Object.fromEntries(seeded.values), 'baye/libpath': 'libs/sc-mod.lib' });
        assert.equal(h.roots.get('.online-save-slots').children[0].children[1].props.disabled, false);
        h.values.set(filename(1) + '.lib', '/custom/dat-mod.lib');
        const before = new Map(h.values);
        h.click('upload');
        assert.match(message(h), /原版/);
        assert.equal(h.requests.uploads.length, 0);
        assert.deepEqual(h.values, before);
    });

    test(`${page} rejects same-path custom fingerprints and rechecks stale identity without mutating saves`, () => {
        const seeded = harness('get-sav.html'), files = pair('same path custom bytes');
        imported(seeded, 0, files, { lib: originalLibPath, identity: 'v1:414390:custom:content' });
        const rejected = harness(page, Object.fromEntries(seeded.values));
        const beforeRejected = new Map(rejected.values);
        assert.equal(rejected.roots.get('.online-save-slots').children[0].children[1].props.disabled, true);
        rejected.click('upload');
        assert.match(message(rejected), /原版/); assert.equal(rejected.requests.uploads.length, 0);
        assert.deepEqual(rejected.values, beforeRejected);

        imported(seeded, 0, files, { lib: originalLibPath, identity: originalIdentity });
        const stale = harness(page, Object.fromEntries(seeded.values));
        assert.equal(stale.roots.get('.online-save-slots').children[0].children[1].props.disabled, false);
        stale.values.set(filename(1) + '.lib-id', 'v1:414390:custom:content');
        const beforeStale = new Map(stale.values);
        stale.click('upload');
        assert.match(message(stale), /原版/); assert.equal(stale.requests.uploads.length, 0);
        assert.deepEqual(stale.values, beforeStale);
    });
}

test('real PC cloud upload uses the complete journal-visible original pair independently of the old preference', () => {
    const seeded = harness('get-sav.html'), old = pair('PC original'), replacement = pair('PC replacement');
    imported(seeded, 2, old, { lib: originalLibPath, name: 'Third original', identity: originalIdentity });
    seeded.fail(({ writes }) => writes >= 4);
    assert.equal(seeded.context.BayeSaveStorage.importSlot(2, {
        sav0: replacement[0], sav1: replacement[1], lib: '/mods/replacement.lib'
    }), false);
    const h = harness('pc.html', { ...Object.fromEntries(seeded.values), 'baye/libpath': 'libs/sc-mod.lib' });
    h.click('upload', 2);
    assert.equal(h.requests.uploads.length, 1);
    assert.equal(h.requests.uploads[0].game, 'baye');
    assert.equal(h.requests.uploads[0].mod, originalCloudName);
    assert.equal(h.requests.uploads[0].index, '3');
    assert.equal(h.requests.uploads[0].data, old.join('\n'));
    h.requests.uploads[0].callback(JSON.stringify({ code: 0, data: 'fixture://original', msg: 'Today' }));
    assert.equal(message(h), '上传成功');
});

test('real PC cloud download commits a validated original pair through the shared transaction', () => {
    const seeded = harness('get-sav.html'), old = pair('old PC source'), incoming = pair('new original');
    imported(seeded, 1, old, { lib: '/mods/old.lib', identity: 'old-source-id', name: 'Old source' });
    const h = harness('pc.html', { ...Object.fromEntries(seeded.values), 'baye/libpath': 'libs/sc-mod.lib' });
    const button = h.click('download', 1);
    h.requests.downloads[0].callback(`${incoming[0]}\r\n${incoming[1]}\r\n`);
    assert.equal(button.props.disabled, false); assert.equal(message(h), '导入成功');
    for (let i = 0; i < 2; i++) {
        const key = filename(2 + i);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key), incoming[i]);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib'), originalLibPath);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib-id'), null);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.name'), null);
    }
    assert.equal(h.values.get('baye/libpath'), 'libs/sc-mod.lib');
    h.click('upload', 1);
    assert.equal(h.requests.uploads[0].mod, originalCloudName);
    assert.equal(h.requests.uploads[0].data, incoming.join('\n'));
});

test('real PC cloud malformed and denied downloads preserve the complete previous pair and metadata', () => {
    const seeded = harness('get-sav.html'), old = pair('preserved PC'), incoming = pair('incoming PC');
    imported(seeded, 0, old, { lib: originalLibPath, name: 'Old original', identity: 'old-id' });
    for (const response of [null, old[0], `${old[0]}\n${old[1]}\nignored`, `00GG\n${old[1]}`, `${old[0]}\n${old[1].slice(0, -2)}`]) {
        const h = harness('pc.html', Object.fromEntries(seeded.values)), before = new Map(h.values);
        h.click('download'); h.requests.downloads[0].callback(response);
        assert.notEqual(message(h), '导入成功'); assert.deepEqual(h.values, before);
    }
    const h = harness('pc.html', Object.fromEntries(seeded.values)), before = oldJournalValues(h, 0);
    h.fail(({ writes }) => writes >= 4);
    h.click('download'); h.requests.downloads[0].callback(incoming.join('\n'));
    assert.match(message(h), /原存档已保留/); assert.notEqual(message(h), '导入成功');
    for (const [key, value] of before) assert.equal(h.context.BayeSaveStorage.readMetadata(key), value);
});
