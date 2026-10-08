#!/usr/bin/env node
/** Real native miniature, confiscation and goods-detail browser acceptance.
 * --staged serves the manifest-bound candidate engine from build/wasm/src.
 * Uses only genuine player UI input and a private temporary profile. */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staged = process.argv.includes('--staged');
const artifactFlag = process.argv.indexOf('--artifact-dir');
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/details-runtime-smoke'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream' };
const report = { staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const servedAssets = new Map();

function nativeLibItem(resource, index) {
    const lib = servedAssets.get('libs/dat-mod.lib').data;
    const address = lib.readUInt32LE((resource - 1) * 4), end = address + lib.readUInt32LE(address);
    assert.equal(lib.readUInt16LE(address + 4), resource);
    assert.equal(lib.readUInt16LE(address + 12), 0, 'This independent native fixture reads unencrypted actual standard resources');
    const count = lib.readUInt16LE(address + 6), fixed = lib.readUInt32LE(address + 8);
    assert.ok(Number.isInteger(index) && index >= 1 && index <= count);
    const row = address + 14 + (index - 1) * 8;
    const offset = fixed ? address + 14 + (index - 1) * fixed : count === 1 ? address + 14 : address + lib.readUInt32LE(row);
    const length = fixed || (count === 1 ? end - address - 14 : lib.readUInt32LE(row + 4));
    assert.ok(offset >= address + 14 && offset + length <= end && end <= lib.length);
    return lib.subarray(offset, offset + length);
}

function nativeToolName(index, slotLength) {
    // GOODS_NAME=73, as defined by the actual native resource dictionary.
    const item = nativeLibItem(73, index + 1), zero = item.indexOf(0);
    const bytes = item.subarray(0, Math.min(zero < 0 ? item.length : zero, slotLength == null ? 31 : slotLength - 1));
    return new TextDecoder('gbk').decode(bytes);
}

function prepareServedAssets() {
    report.sources = {};
    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map', 'baye.build.json',
        ...fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js')&&n!=='baye.js')]) {
        const base = staged && name.startsWith('baye.') ? path.join(root, 'build/wasm/src') : path.join(root, 'js');
        const filename = path.join(base, name), data = fs.readFileSync(filename);
        const metadata = { source: path.relative(root, filename), bytes: data.length,
            sha256: crypto.createHash('sha256').update(data).digest('hex') };
        report.sources[name] = metadata;
        servedAssets.set('js/' + name, { data, metadata });
    }
    const files=['pc.html','css/hd-city-menu.css','css/hd-dialog.css','css/hd-overworld.css','css/hd-portraits.css','css/hd-minimap.css','libs/dat-mod.lib','assets/hd-overworld/manifest.json','assets/hd-overworld/china-lcc-cities.json','assets/hd-overworld/roads/adjacency.json','assets/hd-overworld/palette/factions.json','assets/hd-overworld/terrain/base_plains.jpg','assets/hd-portraits/manifest.json','assets/hd-portraits/refs/index.json'];
    for(const name of new Set(files)) {
        const data=fs.readFileSync(path.join(root,name));
        const metadata={source:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
        report.sources[name]=metadata;servedAssets.set(name,{data,metadata});
    }
    const manifest = JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));
    report.engineManifest=manifest;
    assert.ok(manifest.artifacts,'A manifest identifies all served engine bytes');
    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.equal(report.sources[name].bytes, manifest.artifacts[name].bytes, 'Engine artifact bytes match manifest: ' + name);
        assert.equal(report.sources[name].sha256, manifest.artifacts[name].sha256, 'Engine artifact hash matches manifest: ' + name);
    }
}

async function startServer() {
    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'pc.html';
            const snapshot = servedAssets.get(rel);
            if (snapshot) {
                report.requests.push({ url: url.pathname, status: 200, ...snapshot.metadata });
                res.writeHead(200, { 'Content-Type': mime[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(snapshot.data);
                return;
            }
            const base = staged && /^js\/baye\.(js|wasm|wasm\.map)$/.test(rel) ? path.join(root, 'build/wasm/src') : root;
            const filename = path.resolve(base, base === root ? rel : path.basename(rel));
            if (!filename.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
            fs.readFile(filename, (err, data) => {
                if (err) { report.requests.push({ url: url.pathname, status: 404 }); res.writeHead(404).end(); return; }
                if (/baye\.(js|wasm|wasm\.map)$/.test(filename) || /\.lib$/.test(filename)) {
                    report.requests.push({ url: url.pathname, status: 200, source: path.relative(root, filename), bytes: data.length });
                }
                res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(data);
            });
        } catch { res.writeHead(400).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
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

const snapshotExpression = `(() => {
    const api = window.baye, d = api && api.data;
    const read = (key) => { try { return d && d[key]; } catch { return null; } };
    return {
        ready: !!(api && api.hd && api.hd.ready()), engineReady: read('g_hdEngineReady'),
        fightMenuControl: read('g_hdFightMenuControl'), period: read('g_PIdx'), playerKing: read('g_PlayerKing'),
        menu: api && api.hd && api.hd.menuItems(), qty: api && api.hd && api.hd.qty(),
        movie: api && api.hd && api.hd.movie(), spe: api && api.hd && api.hd.spe(),
        fight: api && api.hd && api.hd.fight(), march: api && api.hd && api.hd.march(),
        system: window.BayeHdSystemUi && BayeHdSystemUi.debugSnapshot(),
        city: window.BayeHdCityMenu && BayeHdCityMenu.debugSnapshot(),
        dialog: window.BayeHdDialog && BayeHdDialog.debugSnapshot(),
        overworld: window.BayeHdOverworld && BayeHdOverworld.debugSnapshot(),
        goods: api && api.hd && api.hd.goods && api.hd.goods(),
        libraryIdentity: window.BayeHdLibIdentity && BayeHdLibIdentity.read(),
        battle: window.BayeHdBattle && BayeHdBattle.debugSnapshot(),
        miniMap: api && api.hd && api.hd.miniMap && api.hd.miniMap(),
        miniMapUi: window.BayeHdMiniMap && BayeHdMiniMap.debugSnapshot(),
        bodyClass: document.body.className, lastHdCall: window.__bayeLastHdCall
    };
})()`;

async function checkpoint(cdp, name) {
    const state = await evaluate(cdp, snapshotExpression);
    report.phases.push({ name, ...state });
    console.log('PASS', name);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(image.data, 'base64'));
    return state;
}

async function key(cdp, name) {
    report.inputs.push({ type:"key", key:name, at:new Date().toISOString() });
    const codes = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, h: 72, f: 70, s: 83, ' ': 32 };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await delay(180);
}

async function click(cdp, selector) {
    const point = await waitFor(cdp, 'visible unobstructed player control: ' + selector, `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block: 'center' });
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        const x=rect.x+rect.width/2,y=rect.y+rect.height/2,top=document.elementFromPoint(x,y);
        return top && (top===node||node.contains(top)) && {x,y,unobstructed:true,top:top.id};
    })()`);
    assert.ok(point, 'Visible click target: ' + selector);
    assert.ok(point.unobstructed, 'Click target is not covered: '+selector+' (top='+point.top+')');
    report.inputs.push({ type:"click", selector, at:new Date().toISOString() });
    const mousePoint={x:point.x,y:point.y};
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mousePoint, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mousePoint, button: 'left', clickCount: 1 });
    await delay(250);
}

const toolPane = '#hd-city-menu-tool-details';
const nativeStateSource = '(' + function (cityIndex, personIndex) {
    const d = baye.data, city = d.g_Cities[cityIndex], person = d.g_Persons[personIndex];
    const number = value => Number(value);
    const inventory = Array.from({ length: number(city.Tools) }, (_, i) => {
        const raw = number(d.g_GoodsQueue[number(city.ToolQueue) + i]);
        return { raw, discovered: !!(raw & 0x8000), tool: raw & 0x7fff };
    });
    return {
        cityIndex, personIndex, cityName: baye.getCityName(cityIndex), personName: baye.getPersonName(personIndex),
        city: Object.fromEntries(['Belong', 'Tools', 'ToolQueue', 'Persons', 'PersonQueue', 'Money', 'Food'].map(key => [key, number(city[key])])),
        person: Object.fromEntries(['Belong', 'Force', 'IQ', 'Devotion', 'Thew', 'Arms'].map(key => [key, number(person[key])])),
        equipment: [number(person.Equip[0]), number(person.Equip[1])], inventory,
        discovered: inventory.filter(item => item.discovered).map(item => item.tool)
    };
}.toString() + ')';

async function nativeState(cdp) {
    return evaluate(cdp, `${nativeStateSource}(${report.cityIndex},${report.personIndex})`);
}

async function menuOwner(cdp, kind, label) {
    return waitFor(cdp, label, `(() => {
        const m=baye.hd.menuItems();
        return m.active===1 && m.context===1 && m.kind===${kind} && m.seq>0 && m;
    })()`);
}

async function chooseCityItem(cdp, name, attribute, kind) {
    const menu = await menuOwner(cdp, kind, 'native city choice: ' + name);
    assert.equal(menu.names.filter(item => item === name).length, 1, 'An unambiguous actual menu choice: ' + name);
    const index = menu.names.indexOf(name);
    await click(cdp, `#hd-city-menu [${attribute}="${index}"]`);
    return { index, menu };
}

async function waitPlayerMap(cdp, label) {
    return waitFor(cdp, label, `(() => {
        const m=baye.hd.menuItems(),w=baye.hd.march(),r=baye.hd.report(),f=baye.hd.fight();
        return w.pick===1 && w.mapInputSeq>0 && !m.active && !r.active && !f.active && w;
    })()`);
}

async function reopenInterior(cdp, label) {
    await waitPlayerMap(cdp, label + ' native map wait');
    report.inputs.push({type:'player-map-action',action:'walkToCity',cityIndex:report.cityIndex,label});
    assert.ok(await evaluate(cdp, `BayeHdOverworld.walkToCity(${report.cityIndex})`));
    await menuOwner(cdp, 1, label + ' actual city root');
    await chooseCityItem(cdp, '内政', 'data-hd-root', 1);
    await menuOwner(cdp, 2, label + ' actual interior menu');
}

async function bootStrategy(cdp) {
    await waitFor(cdp, 'real initialized engine', 'window.baye && baye.hd && baye.hd.ready()', 60000);
    const skipped = new Set();
    for (let i = 0; i < 100; i++) {
        const current = await evaluate(cdp, '({menu:baye.hd.menuItems(),spe:baye.hd.spe()})');
        if (current.menu.active && current.menu.context === 4 && current.menu.kind === 1) break;
        if (current.spe.active && current.spe.kind === 1 && current.spe.skipEligible &&
            !skipped.has(current.spe.generation + ':' + current.spe.eventId)) {
            skipped.add(current.spe.generation + ':' + current.spe.eventId);
            await click(cdp, '#hd-spe-skip');
        } else await delay(150);
    }
    await waitFor(cdp, 'actual native title menu', 'baye.hd.menuItems().active && baye.hd.menuItems().context===4 && baye.hd.menuItems().kind===1');
    await click(cdp, '#hd-system-ui [data-hd-sys="0"]');
    await waitFor(cdp, 'actual period menu', 'baye.hd.menuItems().active && baye.hd.menuItems().context===4 && baye.hd.menuItems().kind===2');
    await click(cdp, '#hd-system-ui [data-hd-sys="0"]');
    const kings = await waitFor(cdp, 'actual period one lord menu', 'baye.data.g_PIdx===1 && baye.hd.kings().count>0 && baye.hd.kings()');
    assert.equal(kings.kings.filter(king => king.name === '董卓').length, 1);
    const index = kings.kings.findIndex(king => king.name === '董卓');
    report.lord = kings.kings[index];
    await click(cdp, `#hd-system-ui [data-hd-sys="${index}"]`);
    await waitFor(cdp, 'actual strategy map', 'baye.hd.march().pick && baye.hd.realm().ownedCount>0');
    const identity = await waitFor(cdp, 'actual loaded standard LIB identity', 'BayeHdLibIdentity.read().status==="ready" && BayeHdLibIdentity.read()');
    assert.equal(identity.sha256, report.sources['libs/dat-mod.lib'].sha256, 'The game uses the exact served dictionary bytes');
    report.libraryIdentity = identity;
    assert.equal(await evaluate(cdp, 'baye.getToolCount()'), 33, 'The real standard dictionary contains thirty-three goods records');
    // The persisted HD preference must wake its map loop after native startup.
    // No toolbar selection or private UI state assignment can rescue this check.
    const cities = await waitFor(cdp, 'current HD map native cities', `(() => {
        if(BayeHdOverworld.debugSnapshot().phase!=='map')return false;
        const cities=BayeHdOverworld.getCities();
        return cities.length===baye.hd.realm().total && cities.map(item=>({i:item.index,name:baye.getCityName(item.index),belong:Number(item.city.Belong)}));
    })()`);
    assert.equal(cities.filter(city => city.name === '洛阳').length, 1);
    const city = cities.find(city => city.name === '洛阳');
    report.cityIndex = city.i;
    assert.equal(city.belong, await evaluate(cdp, 'Number(baye.data.g_PlayerKing)+1'));
    report.presetMap = await evaluate(cdp, '({map:BayeHdOverworld.debugSnapshot(),menu:baye.hd.menuItems(),march:baye.hd.march(),bodyClass:document.body.className})');
    assert.equal(report.presetMap.map.phase, 'map');
    assert.equal(report.presetMap.map.hitsEnabled, true, 'The persisted HD map accepts genuine player city input without a toolbar rescue');
    assert.equal(report.presetMap.map.cityTotal, 38); assert.equal(report.presetMap.menu.active, 0);
    assert.equal(report.presetMap.march.pick, 1);
    await checkpoint(cdp, '00-preset-hd-map-native-ready');
    await miniMapSmoke(cdp);
    report.inputs.push({ type: 'player-map-action', action: 'walkToCity', cityIndex: report.cityIndex });
    assert.ok(await evaluate(cdp, `BayeHdOverworld.walkToCity(${report.cityIndex})`), 'A player can enter the actual owned city');
    await menuOwner(cdp, 1, 'real city root');
    const people = await evaluate(cdp, `(() => {
        const d=baye.data,c=d.g_Cities[${report.cityIndex}];
        return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
            .filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong)).map(id=>({id,name:baye.getPersonName(id)}));
    })()`);
    assert.equal(people.filter(person => person.name === '吕布').length, 1, 'The real owned native queue contains Lü Bu');
    report.personIndex = people.find(person => person.name === '吕布').id;
    report.nativeStart = await nativeState(cdp);
    const equipment = await evaluate(cdp, `[${report.nativeStart.equipment.map(id => `baye.getToolName(${id - 1})`).join(',')}]`);
    assert.deepEqual(equipment, ['方天画戟', '赤兔'], 'Lü Bu has the actual initial equipment used by this scenario');
    report.initialEquipmentNames = equipment;
    await checkpoint(cdp, '01-native-dongzhuo-luoyang');
}

const miniWorldExpression = `(() => {
    const d=baye.data,num=value=>Number(value),n=baye.hd.realm().total,people=baye.getPersonCount();
    const cityFields=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce',
        'PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms',
        'PersonQueue','Persons','ToolQueue','Tools'];
    const personFields=['OldBelong','Belong','Level','Force','IQ','Devotion','Character','Experience','Thew','ArmsType','Arms','Age'];
    return {period:num(d.g_PIdx),playerKing:num(d.g_PlayerKing),year:num(d.g_YearDate),month:num(d.g_MonthDate),
        mapCity:num(d.g_hdMapCity),mapInputSeq:num(d.g_hdMapInputSeq),pick:num(d.g_hdMapPick),
        cursor:Object.fromEntries(['x','y','setx','sety'].map(key=>[key,num(d.g_CityPos[key])])),
        cities:Array.from({length:n},(_,i)=>{const c=d.g_Cities[i];return {index:i,
            ...Object.fromEntries(cityFields.map(key=>[key,num(c[key])])),
            personQueue:Array.from({length:num(c.Persons)},(_,j)=>num(d.g_PersonsQueue[num(c.PersonQueue)+j])),
            inventory:Array.from({length:num(c.Tools)},(_,j)=>num(d.g_GoodsQueue[num(c.ToolQueue)+j]))};}),
        positions:Array.from({length:n},(_,i)=>({index:i,x:num(d.g_CityPositions[i].x),y:num(d.g_CityPositions[i].y)})),
        people:Array.from({length:people},(_,i)=>{const p=d.g_Persons[i];return {index:i,
            ...Object.fromEntries(personFields.map(key=>[key,num(p[key])])),equip:[num(p.Equip[0]),num(p.Equip[1])]};})};
})()`;

const miniObservationExpression = `(() => {
    const root=document.querySelector('#hd-mini-map'),stage=root&&root.querySelector('.hd-mini-map-stage'),
        list=document.querySelector('#hd-mini-map-cities'),canvas=document.querySelector('#hd-mini-map-canvas');
    const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const visible=node=>{if(!node)return {visible:false};const r=node.getBoundingClientRect();let styled=true;
        for(let p=node;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)styled=false;}
        const clipping=list&&list.contains(node)?list.getBoundingClientRect():{left:0,top:0,right:innerWidth,bottom:innerHeight};
        const x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);
        return {text:node.textContent,rect:rect(node),visible:!!(styled&&r.width&&r.height&&r.left>=clipping.left&&
            r.right<=clipping.right&&r.top>=clipping.top&&r.bottom<=clipping.bottom&&r.left>=0&&r.top>=0&&
            r.right<=innerWidth&&r.bottom<=innerHeight&&top&&(top===node||node.contains(top))),top:top&&(top.id||top.tagName)};};
    let bitmap=null;if(canvas){const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let different=0;for(let i=4;i<bytes.length;i+=4)if(bytes[i]!==bytes[0]||bytes[i+1]!==bytes[1]||bytes[i+2]!==bytes[2])different++;
        bitmap={width:canvas.width,height:canvas.height,differentPixels:different};}
    const cities=Array.from(list?list.querySelectorAll('[data-hd-mini-city]'):[],li=>({index:Number(li.getAttribute('data-hd-mini-city')),
        name:visible(li.querySelector('span:nth-of-type(2)')),ownership:visible(li.querySelector('small')),current:li.classList.contains('is-current')}));
    return {native:baye.hd.miniMap(),ui:BayeHdMiniMap.debugSnapshot(),viewport:{width:innerWidth,height:innerHeight},
        title:visible(document.querySelector('#hd-mini-map-title')),summary:visible(document.querySelector('#hd-mini-map-summary')),
        stage:stage&&rect(stage),list:list&&{...rect(list),scrollTop:list.scrollTop,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight},
        canvas:visible(canvas),bitmap,cities,controls:{back:visible(document.querySelector('#hd-mini-map-return')),
            classic:visible(document.querySelector('#hd-mini-map-classic'))}};
})()`;

async function observeMiniLcd(cdp) {
    return evaluate(cdp, `(() => {
        const canvas=document.querySelector('#lcd'),container=document.querySelector('.container.js-baye-pc-lcd'),board=document.querySelector('#hd-overworld-canvas');
        if(!canvas||!container)return {visible:false,missing:true};const r=canvas.getBoundingClientRect();let styled=true;
        for(let p=canvas;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)styled=false;}
        const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let different=0;
        for(let i=4;i<bytes.length;i+=4)if(bytes[i]!==bytes[0]||bytes[i+1]!==bytes[1]||bytes[i+2]!==bytes[2]||bytes[i+3]!==bytes[3])different++;
        const stacks=[0.25,0.5,0.75].map(part=>{const nodes=document.elementsFromPoint(r.left+r.width*part,r.top+r.height*part),
            lcdIndex=nodes.indexOf(canvas),boardIndex=nodes.indexOf(board),top=nodes[0];
            return {lcdIndex,boardIndex,top:top&&(top.id||top.tagName),unobstructed:top===canvas,
                aboveBoard:lcdIndex>=0&&(boardIndex<0||lcdIndex<boardIndex),nodes:nodes.map(node=>node.id||node.className||node.tagName)};});
        return {visible:!!(styled&&r.width&&r.height&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&stacks.every(s=>s.aboveBoard&&s.unobstructed)),
            containerVisibility:getComputedStyle(container).visibility,canvasVisibility:getComputedStyle(canvas).visibility,
            rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},stacks,
            bitmap:{width:canvas.width,height:canvas.height,differentPixels:different}};
    })()`);
}

async function miniMapSmoke(cdp) {
    // This observer forwards the original exports once. It records real input
    // crossing the native boundary; it neither replaces hooks nor fabricates C.
    await evaluate(cdp, `(() => {
        window.__miniNativeInputs={keys:[],touches:[]};
        let nativeKey=window._bayeSendKey;
        const observedKey=function(code){__miniNativeInputs.keys.push(code);const result=nativeKey(code);
            if(window._bayeSendKey!==observedKey){nativeKey=window._bayeSendKey;window._bayeSendKey=observedKey;}return result;};
        window._bayeSendKey=observedKey;baye.sendKey=observedKey;
        let nativeTouch=window._bayeSendTouchEvent;
        const observedTouch=function(kind,x,y){__miniNativeInputs.touches.push({kind,x,y});const result=nativeTouch(kind,x,y);
            if(window._bayeSendTouchEvent!==observedTouch){nativeTouch=window._bayeSendTouchEvent;window._bayeSendTouchEvent=observedTouch;}return result;};
        window._bayeSendTouchEvent=observedTouch;
    })()`);
    const before=await evaluate(cdp,miniWorldExpression);
    assert.equal(before.cities.length,38);assert.ok(before.people.length>0,'The native roster count is available');assert.equal(before.pick,1);
    const nativeCities=await evaluate(cdp, `Array.from({length:baye.hd.realm().total},(_,i)=>({index:i,name:baye.getCityName(i),
        engineX:Number(baye.data.g_CityPositions[i].x),engineY:Number(baye.data.g_CityPositions[i].y),belong:Number(baye.data.g_Cities[i].Belong)}))`);
    for(const city of nativeCities){const bytes=nativeLibItem(58,city.index+1),zero=bytes.indexOf(0);
        assert.equal(city.name,new TextDecoder('gbk').decode(bytes.subarray(0,zero<0?bytes.length:zero)), 'All native city names match the actually served resource 58');}
    const picture=nativeLibItem(75,1),nativePicture={width:picture.readUInt16LE(0),height:picture.readUInt16LE(2),count:picture.readUInt16LE(4),mask:picture[6]};
    assert.deepEqual(nativePicture,{width:84,height:64,count:1,mask:0},'The real resource header mask is distinct from gam_drawpic draw argument 1');
    report.miniMap={worldBefore:before,nativeCities,nativePicture,rounds:[],screens:[],
        touchScope:'PC touch on the HD return button sends one real native EXIT key. The PC classic LCD does not install native touch input; native touch consumption is covered separately by C fixtures, and mobile device acceptance remains pending.'};
    const inputCounts=()=>evaluate(cdp,'({keys:__miniNativeInputs.keys.length,touches:__miniNativeInputs.touches.length})');
    const stable=async label=>{assert.deepEqual(await evaluate(cdp,miniWorldExpression),before,label+' preserves every native city/person/inventory/date and cursor field');
        assert.equal(await evaluate(cdp,'baye.hd.menuItems().active'),0,label+' does not enter a city');};
    const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    let lastSeq=0;
    const opened=async label=>{
        await key(cdp,'f');
        const value=await waitFor(cdp,label+' actual native SEARCH owner', `(() => {
            const n=baye.hd.miniMap(),ui=BayeHdMiniMap.debugSnapshot();return n.active===1&&n.complete===1&&ui.open&&ui.complete&&{native:n,ui};})()`);
        assert.equal(value.native.protocolVersion,1);assert.equal(value.native.defaultDraw,1);assert.equal(value.native.custom,0);
        assert.equal(value.native.resourceId,75);assert.equal(value.native.imageIndex,0);assert.equal(value.native.width,nativePicture.width);assert.equal(value.native.height,nativePicture.height);assert.equal(value.native.mask,nativePicture.mask);
        assert.ok(value.native.seq>lastSeq);lastSeq=value.native.seq;
        assert.equal(value.native.generation,value.native.detailGeneration);assert.equal(value.native.mapInputSeq,before.mapInputSeq);
        assert.equal(value.native.cursorX,before.cursor.setx);assert.equal(value.native.cursorY,before.cursor.sety);
        assert.equal(value.native.viewX,before.cursor.x);assert.equal(value.native.viewY,before.cursor.y);assert.equal(value.native.city1,before.mapCity);
        assert.deepEqual(value.ui.cities.map(city=>({index:city.index,name:city.name,engineX:city.engineX,engineY:city.engineY,belong:city.belong})),nativeCities);
        for(const city of value.ui.cities)assert.equal(city.kind,city.belong===0?'empty':city.belong===before.playerKing+1?'owned':'neutral');
        assert.equal(value.ui.showLcd,false);await stable(label+' open');return value;
    };
    const screen=async(width,height,label)=>{
        const inputs=await inputCounts();
        await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(350);
        const nativeOwner=await evaluate(cdp,'baye.hd.miniMap()');
        let observation=await evaluate(cdp,miniObservationExpression);
        assert.ok(observation.title.visible&&observation.summary.visible&&observation.canvas.visible);
        assert.ok(observation.bitmap.differentPixels>1000,'The actual HD miniature canvas contains more than a flat fill');
        assert.ok(observation.controls.back.visible&&observation.controls.classic.visible);
        assert.ok(observation.controls.back.rect.height>=44&&observation.controls.classic.rect.height>=44);
        assert.ok(observation.stage.left>=0&&observation.stage.right<=width&&observation.stage.top>=0&&observation.stage.bottom<=height);
        assert.equal(observation.cities.length,38);
        const seen=new Set();
        for(let pass=0;pass<5;pass++){
            for(const city of observation.cities){assert.equal(city.name.text,nativeCities[city.index].name);
                assert.equal(city.ownership.text,nativeCities[city.index].belong===0?'空城':nativeCities[city.index].belong===before.playerKing+1?'我方':'他方');
                if(city.name.visible&&city.ownership.visible)seen.add(city.index);}
            if(seen.size===38)break;
            const r=observation.list,p={x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};
            report.inputs.push({type:'mini-map-list-scroll',...p,deltaY:420});
            await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:420});await delay(180);
            observation=await evaluate(cdp,miniObservationExpression);
        }
        assert.equal(seen.size,38,'Every actual city name and ownership label was visibly rendered and hit-tested');
        const defaultLcd=await observeMiniLcd(cdp);assert.equal(defaultLcd.visible,false);assert.equal(defaultLcd.containerVisibility,'hidden');
        await stable(label+' passive HD rendering');assert.deepEqual(await inputCounts(),inputs,'Resizing/rendering/real list scrolling sends no native input');
        await checkpoint(cdp,'00-mini-map-'+label+'-hd');
        await click(cdp,'#hd-mini-map-classic');await waitFor(cdp,'explicit miniature LCD','BayeHdMiniMap.debugSnapshot().showLcd===true');
        await delay(200);const classicLcd=await observeMiniLcd(cdp),classicHud=await evaluate(cdp,miniObservationExpression);
        assert.equal(classicLcd.visible,true,'The actual LCD is visible above the world canvas, not merely CSS-visible');
        assert.ok(classicLcd.bitmap.differentPixels>0,'The LCD contains the real native resource 75 frame');
        assert.equal(overlaps(classicLcd.rect,classicHud.stage),false,'Classic LCD is separate from the HD miniature card');
        assert.ok(classicHud.controls.back.visible&&classicHud.controls.classic.visible,'Both actual classic/return controls stay hit-testable');
        await stable(label+' classic comparison');assert.deepEqual(await inputCounts(),inputs,'Classic comparison sends no native key or touch');
        assert.deepEqual(await evaluate(cdp,'baye.hd.miniMap()'),nativeOwner,'Comparison preserves the exact actual native miniature capture');
        await checkpoint(cdp,'00-mini-map-'+label+'-classic');
        await click(cdp,'#hd-mini-map-classic');await waitFor(cdp,'hide miniature LCD','BayeHdMiniMap.debugSnapshot().showLcd===false');
        const restored=await observeMiniLcd(cdp);assert.equal(restored.visible,false);
        await stable(label+' restored HD');assert.deepEqual(await inputCounts(),inputs);
        report.miniMap.screens.push({width,height,seen:[...seen],hd:observation,defaultLcd,classicHud,classicLcd,restored});
    };
    for(const [i,closing] of ['ArrowRight','ArrowUp','ArrowDown','ArrowLeft','Enter','Escape','button','touch-button'].entries()){
        const label=String(i+1).padStart(2,'0')+'-'+closing,owner=await opened(label);
        if(i===0)await screen(1920,1080,'1080p');if(i===1)await screen(1280,720,'720p');
        const inputs=await inputCounts();
        if(closing==='button')await click(cdp,'#hd-mini-map-return');
        else if(closing==='touch-button'){
            await click(cdp,'#hd-mini-map-classic');await delay(150);
            assert.equal((await observeMiniLcd(cdp)).visible,true);assert.deepEqual(await inputCounts(),inputs);
            await click(cdp,'#hd-mini-map-classic');await waitFor(cdp,'HD miniature restored before touch button','BayeHdMiniMap.debugSnapshot().showLcd===false');
            const button=await evaluate(cdp,miniObservationExpression);assert.ok(button.controls.back.visible);
            assert.ok(button.controls.back.rect.width>=44&&button.controls.back.rect.height>=44);
            const rect=button.controls.back.rect,point={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2};
            report.inputs.push({type:'PC-HD-return-button-touch',...point,nativeMeaning:'one original EXIT key; no native LCD touch'});
            await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1,force:1,id:0}]});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            await delay(180);
            await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
        }else await key(cdp,closing);
        await waitFor(cdp,label+' original native miniature exit consumed', 'baye.hd.miniMap().active===0&&!BayeHdMiniMap.isOpen()&&baye.hd.march().pick===1&&!baye.hd.menuItems().active');
        await stable(label+' return');const afterInputs=await inputCounts();
        assert.equal(afterInputs.keys-inputs.keys,1,'The explicit dismissal crosses the native key boundary only once');
        assert.equal(afterInputs.touches-inputs.touches,0,'The PC miniature controls do not pretend to be native LCD touch input');
        assert.equal(await evaluate(cdp,'document.querySelector("#hd-mini-map").hidden'),true);
        report.miniMap.rounds.push({label,closing,owner,inputs,afterInputs,after:await evaluate(cdp,'baye.hd.miniMap()')});
        await checkpoint(cdp,'00-mini-map-'+label+'-consumed');
    }
    report.miniMap.worldAfter=await evaluate(cdp,miniWorldExpression);assert.deepEqual(report.miniMap.worldAfter,before);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await delay(200);
}

async function emptyStockSmoke(cdp) {
    const before = await nativeState(cdp);
    assert.deepEqual(before.discovered, [], 'The initial city has no discovered goods available to give');
    await chooseCityItem(cdp, '内政', 'data-hd-root', 1);
    await chooseCityItem(cdp, '赏赐', 'data-hd-sub', 2);
    const actual = await waitFor(cdp, 'actual no-stock native report', `(() => {
        const r=baye.hd.report(),d=BayeHdDialog.debugSnapshot();
        return r.active && r.inputSeq>0 && d.open && d.kind==='report' && d.reportOwner && {report:r,dialog:d};
    })()`);
    assert.ok(actual.report.text, 'The native empty-stock result is exposed verbatim');
    assert.equal(await evaluate(cdp, '!!BayeHdCityMenu.debugSnapshot().toolDetail'), false, 'An empty list cannot reuse an old goods detail');
    assert.deepEqual(await nativeState(cdp), before, 'The empty result does not create stock or equipment');
    report.emptyStock = { native: before, ...actual };
    await checkpoint(cdp, '02-actual-empty-stock-report');
    await click(cdp, '#hd-dialog [data-hd-dlg-ok]');
    await waitPlayerMap(cdp, 'native map after empty-stock command returns');
}

async function rawTool(cdp, index) {
    const actual = await evaluate(cdp, `(() => {
        const t=baye.data.g_Tools[${index}];
        return {index:${index},count:baye.getToolCount(),name:baye.getToolName(${index}),
            ...Object.fromEntries(['useflag','changeAttackRange','at','iq','move','arm'].map(key=>[key,Number(t[key])]))};
    })()`);
    // GOODS_RESID=66 is one actual payload containing 66-byte GOODS records.
    const bytes = nativeLibItem(66, 1);
    assert.equal(bytes.length, actual.count * 66);
    const record = bytes.subarray(index * 66, (index + 1) * 66);
    for (const [key, offset] of [['useflag',1],['changeAttackRange',32],['at',62],['iq',63],['move',64],['arm',65]])
        assert.equal(actual[key], record[offset], 'Native GOODS binding agrees with the independent served LIB payload: '+key);
    assert.equal(actual.name, nativeToolName(index));
    return actual;
}

async function inspectGoods(cdp, label) {
    const state = await waitFor(cdp, 'actual captured goods pane: ' + label, `(() => {
        const menu=baye.hd.menuItems(),goods=baye.hd.goods(),detail=BayeHdCityMenu.debugSnapshot().toolDetail;
        const pane=document.querySelector(${JSON.stringify(toolPane)});
        return menu.active===1 && menu.context===1 && menu.kind===4 && goods.active && detail &&
            pane && !pane.hidden && {menu,goods,detail,text:pane.innerText,tool:baye.hd.toolDetails(goods.tool)};
    })()`);
    const { menu, goods, detail, tool } = state;
    assert.equal(menu.idsValid, true, 'Actual native IDs own this tool list');
    assert.equal(menu.ids.length, menu.count);
    assert.equal(menu.generation, menu.detailGeneration);
    assert.equal(goods.generation, goods.detailGeneration);
    assert.equal(goods.generation, menu.detailGeneration);
    assert.equal(goods.menuSeq, menu.seq); assert.equal(goods.index, menu.index);
    assert.equal(goods.tool, menu.ids[menu.index]); assert.equal(goods.name, nativeToolName(goods.tool));
    assert.deepEqual(menu.packedNames, menu.ids.map(id => nativeToolName(id, menu.itemLen)), 'Packed names retain their actual native byte slots');
    assert.deepEqual(menu.names, menu.ids.map(id => nativeToolName(id)), 'Authenticated native IDs provide complete user-facing tool names');
    assert.equal(detail.nativeIndex, menu.index); assert.equal(detail.toolIndex, goods.tool);
    assert.equal(detail.seq, menu.seq); assert.equal(detail.name, goods.name);
    assert.equal(detail.generation, goods.generation); assert.equal(detail.detailGeneration, menu.detailGeneration);
    assert.equal(detail.pageStart, goods.pageStart); assert.equal(detail.pageEnd, goods.pageEnd);
    assert.equal(detail.nativeComplete, Boolean(goods.complete), 'Raw supplemental fields do not count as native captures');
    assert.equal(detail.complete, detail.properties.every(property => property.read), 'Presentation completeness follows explicitly readable fields');
    assert.deepEqual(detail.properties.map(property => property.captured), goods.properties.map(property => property.captured));
    assert.equal(Boolean(detail.custom), false);
    const owner = JSON.parse(detail.ownerKey);
    assert.equal(owner.length, 7); assert.deepEqual(owner.slice(1, 5), [1, 4, menu.seq, menu.names]);
    assert.equal(owner[5], menu.detailGeneration); assert.deepEqual(owner[6], menu.ids);
    const raw = await rawTool(cdp, goods.tool);
    assert.equal(tool.index, raw.index); assert.equal(tool.name, raw.name); assert.equal(tool.standard, true);
    for (const [key, native] of [['attack', 'at'], ['iq', 'iq'], ['move', 'move'], ['arm', 'arm'], ['useFlag', 'useflag']])
        assert.equal(tool[key], raw[native], 'Safe tool API matches the real native record: ' + key);
    for (const property of goods.properties.filter(property => property.captured)) {
        assert.ok(property.title, 'A captured native property has its native title');
        assert.ok(state.text.includes(property.title), 'The pane displays the actual captured title');
        assert.ok(state.text.includes(property.value), 'The pane displays the actual captured value');
        const numeric = { 1: 'at', 2: 'iq', 3: 'move' }[property.index];
        if (numeric) assert.equal(Number(property.value), raw[numeric], 'Native captured value agrees with its independent record');
    }
    state.raw = raw;
    report.goodsPages ||= []; report.goodsPages.push({ label, ...state });
    return state;
}

async function confiscateSmoke(cdp) {
    await reopenInterior(cdp, 'reopen city to confiscate');
    await chooseCityItem(cdp, '没收', 'data-hd-sub', 2);
    const personMenu = await menuOwner(cdp, 3, 'real confiscation person menu');
    assert.equal(personMenu.idsValid, true);
    const selected = personMenu.names.indexOf('吕布');
    assert.ok(selected >= 0); assert.equal(personMenu.ids[selected], report.personIndex);
    await click(cdp, `#hd-city-menu [data-hd-deep="${selected}"]`);
    await menuOwner(cdp, 4, 'Lü Bu actual equipment menu');
    const equipment = await inspectGoods(cdp, 'actual-equipped-goods');
    assert.deepEqual(equipment.menu.ids, report.nativeStart.equipment.map(id => id - 1));
    assert.deepEqual(equipment.menu.ids.map(id => nativeToolName(id)), report.initialEquipmentNames);
    const index = equipment.menu.ids.indexOf(report.nativeStart.equipment[0] - 1);
    report.confiscatedTool = equipment.menu.ids[index];
    const before = await nativeState(cdp);
    await checkpoint(cdp, '03-native-equipped-goods');
    await click(cdp, `#hd-city-menu [data-hd-deep="${index}"]`);
    const speech = await waitFor(cdp, 'actual confiscation speech wait', `(() => {
        const r=baye.hd.report(),d=BayeHdDialog.debugSnapshot();
        return r.active && d.open && d.kind==='report' && d.reportOwner && {report:r,dialog:d};
    })()`);
    assert.equal(speech.report.person, report.personIndex);
    await checkpoint(cdp, '04-actual-confiscation-report');
    await click(cdp, '#hd-dialog [data-hd-dlg-ok]');
    await menuOwner(cdp, 3, 'native next confiscation person wait');
    const after = await nativeState(cdp);
    assert.deepEqual(after.equipment, [0, before.equipment[1]], 'Only the explicitly confiscated native equipment slot is cleared');
    const confiscated = await rawTool(cdp, report.confiscatedTool);
    assert.equal(after.person.Force, before.person.Force - confiscated.at, 'Native confiscation removes the equipment force bonus');
    assert.equal(after.person.IQ, before.person.IQ - confiscated.iq, 'Native confiscation removes the equipment intelligence bonus');
    assert.equal(after.person.Devotion, Math.max(0, before.person.Devotion - 20), 'The real confiscation speech applies its native loyalty cost');
    assert.equal(after.city.Tools, before.city.Tools + 1);
    assert.deepEqual(after.discovered, [report.confiscatedTool], 'Confiscation creates a real discovered inventory item');
    report.confiscation = { before, after, speech };
    await checkpoint(cdp, '05-real-equipment-and-inventory-change');
    await click(cdp, '#hd-city-menu [data-hd-menu-back]');
    await waitPlayerMap(cdp, 'native map after stopping confiscation');
}

async function goodsScreens(cdp) {
    report.goodsScreens = [];
    for (const [width, height] of [[1920, 1080], [1280, 720]]) {
        const before = await nativeState(cdp);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await delay(500);
        const scrollPoint = await evaluate(cdp, `(() => {const r=document.querySelector(${JSON.stringify(toolPane)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+40};})()`);
        report.inputs.push({type:'scroll',target:toolPane,direction:'up',...scrollPoint});
        await cdp.send('Input.dispatchMouseEvent', {type:'mouseWheel',...scrollPoint,deltaX:0,deltaY:-1200});
        await waitFor(cdp, 'tool heading at top after player scroll', `document.querySelector(${JSON.stringify(toolPane)}).scrollTop===0`);
        const geometry = await evaluate(cdp, `(() => {
            const pane=document.querySelector(${JSON.stringify(toolPane)}),stage=document.querySelector('#hd-city-menu .hd-city-menu-stage');
            const footer=document.querySelector('#hd-city-menu .hd-city-menu-footer');
            const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
            const visible=node=>{const r=node.getBoundingClientRect(),p=pane.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                let styled=true;for(let n=node;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)styled=false;}
                return {text:node.textContent,rect:rect(node),visible:!!(styled&&r.width&&r.height&&r.left>=p.left&&r.right<=p.right&&
                    r.top>=p.top&&r.bottom<=p.bottom&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&top&&(top===node||node.contains(top)))};};
            const rows=pane.querySelector('.hd-city-menu-info-group').querySelectorAll('.hd-city-menu-stat');
            return {pane:rect(pane),stage:rect(stage),footer:rect(footer),scrollWidth:pane.scrollWidth,clientWidth:pane.clientWidth,
                text:pane.innerText,lcdMode:document.documentElement.getAttribute('data-baye-city-lcd'),
                toolName:visible(document.querySelector('#hd-city-menu-tool-name')),
                visibleProperties:Array.from(rows,row=>({label:visible(row.querySelector('span')),value:visible(row.querySelector('strong'))})),
                oldPortraitVisible:!!document.querySelector('#hd-portrait:not([hidden])')};
        })()`);
        assert.ok(geometry.pane.width > 0 && geometry.pane.height > 0);
        assert.ok(geometry.stage.left >= 0 && geometry.stage.right <= width + 1);
        assert.ok(geometry.stage.top >= 0 && geometry.stage.bottom <= height + 1);
        assert.ok(geometry.footer.bottom <= height + 1);
        assert.ok(geometry.scrollWidth <= geometry.clientWidth + 2, 'Tool fields do not overflow horizontally');
        assert.equal(geometry.toolName.text, nativeToolName(report.confiscatedTool));
        assert.equal(geometry.toolName.visible, true, 'The full actual tool name is visibly rendered and unobstructed');
        assert.equal(geometry.visibleProperties.length, 5);
        assert.ok(geometry.visibleProperties.every(property=>property.label.visible&&property.value.visible), 'All five actual native property labels and values are visibly rendered');
        assert.equal(geometry.oldPortraitVisible, false, 'A preceding person report cannot survive inside a tool pane');
        assert.deepEqual(await nativeState(cdp), before, 'Resizing and passive rendering do not change real stock or equipment');
        report.goodsScreens.push({ width, height, geometry });
        await checkpoint(cdp, '08-goods-details-' + width + 'x' + height);
    }
}

async function rewardBrowseSmoke(cdp) {
    await reopenInterior(cdp, 'reopen city to browse inventory');
    await chooseCityItem(cdp, '赏赐', 'data-hd-sub', 2);
    const first = await inspectGoods(cdp, 'actual-inventory-first-page');
    assert.deepEqual(first.menu.ids, [report.confiscatedTool]);
    const before = await nativeState(cdp), seen = new Set();
    let current = first;
    while (current.goods.pageEnd < current.goods.propertyCount) {
        assert.ok(!seen.has(current.goods.pageStart), 'Native property paging makes progress');
        seen.add(current.goods.pageStart);
        const start = current.goods.pageStart, end = current.goods.pageEnd, seq = current.menu.seq;
        await click(cdp, '#hd-city-menu [data-hd-tool-page="next"]');
        await waitFor(cdp, 'actual next native property page', `baye.hd.goods().menuSeq===${seq} && baye.hd.goods().pageStart===${end} && baye.hd.goods().pageStart>${start}`);
        current = await inspectGoods(cdp, 'actual-inventory-next-page');
        assert.equal(current.menu.index, first.menu.index); assert.equal(current.menu.seq, first.menu.seq);
        assert.deepEqual(await nativeState(cdp), before, 'Browsing properties does not grant or remove any item');
    }
    assert.equal(current.goods.complete, 1, 'All actual native property pages were captured');
    assert.ok(current.goods.properties.every(property => property.captured));
    assert.equal(current.goods.properties.length, current.goods.propertyCount);
    assert.ok(seen.size > 0, 'The scenario genuinely exercised a multi-page native goods view');
    await checkpoint(cdp, '06-native-property-capture-complete');
    while (current.goods.pageStart > 0) {
        const start = current.goods.pageStart, seq = current.menu.seq;
        await click(cdp, '#hd-city-menu [data-hd-tool-page="prev"]');
        await waitFor(cdp, 'actual previous native page', `baye.hd.goods().menuSeq===${seq} && baye.hd.goods().pageStart<${start}`);
        current = await inspectGoods(cdp, 'actual-inventory-previous-page');
        assert.equal(current.menu.seq, first.menu.seq); assert.equal(current.goods.tool, first.goods.tool);
        assert.deepEqual(await nativeState(cdp), before);
    }
    await checkpoint(cdp, '07-native-properties-returned');
    await goodsScreens(cdp);
    await click(cdp, '#hd-city-menu [data-hd-menu-back]');
    await waitPlayerMap(cdp, 'native map after cancelling reward');
    const after = await nativeState(cdp);
    assert.deepEqual(after, before, 'Cancelling real reward browsing preserves all native inventory and person values');
    await waitFor(cdp, 'old tool pane and owner retire', `(() => {
        const s=BayeHdCityMenu.debugSnapshot(),p=document.querySelector(${JSON.stringify(toolPane)});
        return !s.toolDetail && (!p || p.hidden) && !baye.hd.goods().active;
    })()`);
    report.cancelledReward = { before, after, result: 'cancelled-without-giving' };
    await checkpoint(cdp, '09-real-reward-cancelled-no-grant');
}

async function main() {
    fs.mkdirSync(artifactDir, { recursive: true });
    prepareServedAssets();
    assert.equal(typeof WebSocket, 'function', 'Node 22+ is required for native CDP');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'baye-details-runtime-'));
    let server, chrome, cdp, chromeError;
    const interrupt = () => {
        report.interrupted = true;
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) chrome.kill('SIGTERM');
        if (server) server.closeAllConnections();
    };
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    try {
        server = await startServer();
        const origin = 'http://127.0.0.1:' + server.address().port;
        const debugPort = await unusedPort();
        const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'];
        const binary = process.env.CHROME || candidates.find(filename => fs.existsSync(filename));
        assert.ok(binary, 'Set CHROME to a Chromium executable');
        chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
            '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows', '--window-size=1920,1080', '--remote-debugging-port=' + debugPort,
            '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
        chrome.on('error', error => { chromeError = error; });
        let target;
        for (let i = 0; i < 150; i++) {
            if (chromeError) throw chromeError;
            if (chrome.exitCode !== null) throw new Error('Chrome exited with ' + chrome.exitCode);
            try {
                const list = await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) }).then(res => res.json());
                target = list.find(item => item.type === 'page'); if (target) break;
            } catch {}
            await delay(100);
        }
        assert.ok(target, 'Private Chrome DevTools started');
        cdp = await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled', event => {
            report.console.push({ type: event.type, text: event.args.map(arg => arg.value ?? arg.description ?? '').join(' ') });
            if (report.console.length > 100) report.console.shift();
        });
        cdp.on('Runtime.exceptionThrown', event => report.exceptions.push(event.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening', event => {
            report.dialogs.push({ type: event.type, message: event.message });
            cdp.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
        });
        cdp.on('Fetch.requestPaused', event => {
            const local = new URL(event.request.url).origin === origin;
            if (!local) report.blocked.push(event.request.url);
            cdp.send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId: event.requestId } :
                { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
        });
        await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
            localStorage.clear();
            localStorage.setItem('baye/libpath','libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode','hd-map');
            localStorage.setItem('baye/cityMenuMode','hd');
            localStorage.setItem('baye/systemUiMode','hd');
        ` });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        await bootStrategy(cdp); await emptyStockSmoke(cdp); await confiscateSmoke(cdp); await rewardBrowseSmoke(cdp);
        report.nativeEnd = await nativeState(cdp);
        assert.deepEqual(report.exceptions, [], 'No uncaught browser exceptions');
        assert.deepEqual(report.dialogs, [], 'No unexpected native or browser dialogs');
        report.ok = true;
    } catch (error) {
        report.ok = false; report.error = error.stack || String(error); process.exitCode = 1;
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression); } catch {}
            try { report.failureMiniWorld = await evaluate(cdp, miniWorldExpression); } catch {}
            try { report.failureMiniInputs = await evaluate(cdp, 'window.__miniNativeInputs || null'); } catch {}
            try { if (Number.isInteger(report.cityIndex) && Number.isInteger(report.personIndex)) report.failureNative = await nativeState(cdp); } catch {}
            try {
                const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
                fs.writeFileSync(path.join(artifactDir, 'failure.png'), Buffer.from(image.data, 'base64'));
            } catch {}
        }
        console.error(report.error);
    } finally {
        process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) {
            const stopped = new Promise(resolve => chrome.once('exit', resolve));
            chrome.kill('SIGTERM'); await Promise.race([stopped, delay(1500)]);
            if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([stopped, delay(1500)]); }
        }
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()), 'Cleanup stays inside the actual OS temp directory');
        assert.ok(path.basename(profile).startsWith('baye-details-runtime-'), 'Cleanup targets only this private browser profile');
        fs.rmSync(profile, { recursive: true, force: true });
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Real native miniature and goods-detail browser acceptance passed');
    }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
