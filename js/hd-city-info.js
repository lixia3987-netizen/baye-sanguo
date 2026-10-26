/* City details captured from the actual ShowCityPro page. No city getters. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var FIELDS = ['ProtocolVersion','Active','Complete','Custom','Wait','Seq','Session','Generation',
        'InputSeq','City','PropertyCount','PageStart','PageSize','RowCount'];
    var DTO = ['protocolVersion','active','complete','custom','wait','seq','session','generation',
        'inputSeq','cityIndex','propertyCount','pageStart','pageSize','rowCount'];
    function uint(v,max) { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max; }
    function number(v) { return v && typeof v === 'object' ? v.value : v; }
    function identityKey(v) { return v && JSON.stringify([v.status,v.sha256,v.byteLength,v.generation]); }
    function createController(env) {
        env = env || {};
        var win = env.window || global, doc = env.document || win.document;
        var epoch = 0, busy = false, press = null, pending = null, closing = null;
        var classic = null, current = null, lastSession = null, spent = null, started = false, timer = null;
        function node(id) { return doc && doc.getElementById(id); }
        function rawOwner() {
            try {
                var data = win.baye && win.baye.data, active = data && number(data.g_hdCityInfoActive);
                return active !== undefined && active !== 0;
            } catch (e) { return true; }
        }
        function retire() { epoch++; press = null; pending = null; current = null; }
        function mode() {
            var menu = win.BayeHdCityMenu, map = win.BayeHdOverworld;
            var value = menu && typeof menu.getMode === 'function' ? menu.getMode() : 'auto';
            if (value === 'classic') { return false; }
            return value === 'hd' || !map || typeof map.getMode !== 'function' || map.getMode() === 'hd-map';
        }
        function bytes(d,page) {
            var title = d.g_hdCityInfoTitleGbk, indices = d.g_hdCityInfoRowIndices, text = d.g_hdCityInfoRowText, result = [];
            function string(buffer,start,length) {
                if (!buffer || typeof buffer !== 'object') { throw Error('missing captured bytes'); }
                for (var i=0;i<length;i++) {
                    var value = number(buffer[start+i]);
                    if (!uint(value,255)) { throw Error('invalid captured byte'); }
                    result.push(value); if (!value) { return; }
                }
                throw Error('unterminated captured text');
            }
            string(title,0,64);
            if (!page || !uint(page.rowCount,32)) { throw Error('invalid rows'); }
            for (var i=0;i<page.rowCount;i++) {
                var index = indices && number(indices[i]);
                if (!uint(index,255)) { throw Error('invalid row index'); }
                result.push(index); string(text,i*128,128);
            }
            return {key:JSON.stringify(result),title:title,indices:indices,text:text};
        }
        function read() {
            if (busy) { retire(); return null; }
            busy = true;
            var token = epoch;
            try {
                var b = win.baye, hd = b && b.hd, d = b && b.data, api = win.BayeHdLibIdentity;
                if (!doc || doc.hidden || !d || !hd || typeof hd.cityInfo !== 'function' ||
                    typeof hd.ready !== 'function' || !api || typeof api.read !== 'function' ||
                    typeof api.isCurrent !== 'function') { return null; }
                var get = hd.cityInfo, ready = hd.ready, identify = api.read, isCurrent = api.isCurrent;
                var menuMode = win.BayeHdCityMenu, mapMode = win.BayeHdOverworld;
                var getMenuMode = menuMode && menuMode.getMode, getMapMode = mapMode && mapMode.getMode;
                var hooks = b.hooks, showHook = hooks && hooks.willShowCityInfo, propertyHook = hooks && hooks.getCityPropertyDisplay;
                var lib = win.dynLib, first = get.call(hd), source = bytes(d,first);
                var identity = identify.call(api), key = identityKey(identity);
                var enabled = mode(), valid = isCurrent.call(api,identity), engineReady = ready.call(hd);
                var second = get.call(hd), again = identify.call(api);
                if (!first || !second || JSON.stringify(first) !== JSON.stringify(second) ||
                    first.protocolVersion !== 1 || first.active !== 1 || first.wait !== 1 ||
                    !uint(first.seq,0xffffffff) || !first.seq || !uint(first.session,0xffffffff) || !first.session ||
                    !uint(first.inputSeq,0xffffffff) || !first.inputSeq || !uint(first.generation,0xffffffff) ||
                    !first.generation || first.generation !== first.detailGeneration || engineReady !== true ||
                    !identity || valid !== true || identity.status !== 'ready' || identity.sha256 !== SHA ||
                    identity.byteLength !== 207195 || !uint(identity.generation,0xffffffff) || !identity.generation ||
                    key !== identityKey(again) || typeof lib !== 'string' || lib.length !== 414390 ||
                    showHook || propertyHook || first.complete !== 1 || first.custom !== 0 || first.propertyCount !== 11 ||
                    !uint(first.cityIndex,37) || !uint(first.pageSize,32) || !first.pageSize ||
                    !uint(first.pageStart,10) || first.pageStart % first.pageSize ||
                    first.rowCount !== Math.min(first.pageSize,11-first.pageStart) ||
                    typeof first.title !== 'string' || !first.title.trim() || first.title.length > 63 ||
                    !Array.isArray(first.rows) || first.rows.length !== first.rowCount ||
                    first.rows.some(function (r,i) { return !r || r.index !== first.pageStart+i ||
                        typeof r.text !== 'string' || r.text.length > 127; })) { return null; }
                // Seal after every callback: neither a new page nor a LIB swap can
                // authorize a stale press. Bridge already seals the captured bytes.
                if (enabled !== mode()) { return null; }
                var finalSource = bytes(d,first);
                if (source.key !== finalSource.key || source.title !== finalSource.title || source.indices !== finalSource.indices ||
                    source.text !== finalSource.text || FIELDS.some(function (name,i) { return number(d['g_hdCityInfo'+name]) !== first[DTO[i]]; }) ||
                    number(d.g_hdDetailGeneration) !== first.generation || number(d.g_hdEngineReady) !== 1 ||
                    win.baye !== b || b.data !== d || b.hd !== hd || hd.cityInfo !== get || hd.ready !== ready ||
                    win.BayeHdLibIdentity !== api || api.read !== identify || api.isCurrent !== isCurrent ||
                    win.BayeHdCityMenu !== menuMode || win.BayeHdOverworld !== mapMode ||
                    menuMode && menuMode.getMode !== getMenuMode || mapMode && mapMode.getMode !== getMapMode ||
                    b.hooks !== hooks || hooks && (hooks.willShowCityInfo !== showHook || hooks.getCityPropertyDisplay !== propertyHook) ||
                    win.dynLib !== lib || identityKey(identity) !== key || token !== epoch || doc.hidden) { return null; }
                return {page:first,enabled:enabled,data:d,baye:b,hd:hd,get:get,ready:ready,api:api,
                    identify:identify,isCurrent:isCurrent,lib:lib,identity:key,epoch:token,
                    key:JSON.stringify([first,key,enabled,source.key]),source:source};
            } catch (e) { return null; }
            finally { busy = false; }
        }
        function same(a,b) {
            return a && b && a.key === b.key && a.data === b.data && a.baye === b.baye &&
                a.hd === b.hd && a.get === b.get && a.ready === b.ready && a.api === b.api &&
                a.identify === b.identify && a.isCurrent === b.isCurrent && a.lib === b.lib && a.epoch === b.epoch;
        }
        function session(s) { return s && [s.page.generation,s.page.session,s.identity].join(':'); }
        function available(s) { return s && s.enabled && classic !== session(s); }
        function setClass(name,value) { if (doc.body && doc.body.classList) { doc.body.classList.toggle(name,!!value); } }
        function render(s) {
            var root = node('hd-city-info'), owner = rawOwner(), open = available(s);
            setClass('hd-city-info-owner',owner); setClass('hd-city-info-hd',open);
            if (!root) { return; }
            root.hidden = !open; root.setAttribute('aria-hidden',open ? 'false' : 'true');
            if (!open) { return; }
            var title = node('hd-city-info-title'), page = node('hd-city-info-page'), rows = node('hd-city-info-rows');
            if (title) { title.textContent = s.page.title; }
            if (page) { page.textContent = '城池详情 · '+(Math.floor(s.page.pageStart/s.page.pageSize)+1)+' / '+Math.ceil(11/s.page.pageSize); }
            var contentKey = JSON.stringify([s.page.title,s.page.rows]);
            if (rows && rows.getAttribute('data-page') !== contentKey) {
                rows.textContent = '';
                s.page.rows.forEach(function (r) {
                    var row = doc.createElement('li'); row.textContent = r.text;
                    row.setAttribute('data-property',String(r.index)); rows.appendChild(row);
                });
                rows.setAttribute('data-page',contentKey); rows.scrollTop = 0;
            }
            Array.prototype.forEach.call(root.querySelectorAll('[data-hd-city-info-key]'),function (button) {
                var key = Number(button.getAttribute('data-hd-city-info-key'));
                button.disabled = !!pending || !!closing || key === 34 && s.page.pageStart === 0 ||
                    key === 35 && s.page.pageStart+s.page.pageSize >= 11;
            });
        }
        function poll() {
            var s = read(), now = session(s);
            if (s && lastSession !== now) { retire(); s = read(); now = session(s); lastSession = now; classic = null; closing = null; }
            if (!rawOwner()) { closing = null; classic = null; lastSession = null; pending = null; spent = null; }
            if (pending && s && (session(s) !== pending.session || s.page.inputSeq !== pending.inputSeq)) { pending = null; }
            current = s; render(s); return s;
        }
        function send(key,ticket) {
            if ([34,35,39,40].indexOf(key) < 0 || pending || closing) { return false; }
            var s = read();
            if (!available(s) || ticket && !same(ticket,s)) { return false; }
            var request = session(s)+':'+s.page.inputSeq;
            if (spent === request) { return false; }
            if (key === 34 && !s.page.pageStart || key === 35 && s.page.pageStart+s.page.pageSize >= 11) { return false; }
            var sendKey = s.baye.sendKey;
            if (typeof sendKey !== 'function' || !same(s,read()) || s.baye.sendKey !== sendKey) { return false; }
            pending = {session:session(s),inputSeq:s.page.inputSeq};
            spent = request;
            if (key === 39 || key === 40) { closing = session(s); }
            press = null; render(s);
            // Rendering can reenter another controller. Spend this receipt even
            // when that happens; a rejected dispatch is never replayed later.
            if (!same(s,read()) || s.baye.sendKey !== sendKey || doc.hidden) { return false; }
            try { sendKey.call(s.baye,key); return true; }
            catch (e) { /* A failed delivery is never automatically retried. */ return false; }
        }
        function consume(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) { e.stopImmediatePropagation(); } }
        function keyboard(e) {
            if (!e || e.isTrusted !== true || e.defaultPrevented || e.isComposing || doc.hidden) { return; }
            var target = e.target;
            for (var n=target;n;n=n.parentElement) {
                if (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName || '')) { return; }
            }
            var s = poll(); if (!available(s)) { return; }
            var key = {ArrowUp:34,ArrowLeft:34,ArrowDown:35,ArrowRight:35,Enter:39,Escape:40,' ':39}[e.key];
            var button = buttonFor(e);
            if (button && (e.key === 'Enter' || e.key === ' ')) {
                consume(e);
                if (e.repeat || button.disabled || pending) { return; }
                if (button.id === 'hd-city-info-classic') { classic = session(s); retire(); poll(); }
                else { send(Number(button.getAttribute('data-hd-city-info-key')),s); }
                return;
            }
            if (!key) { return; }
            consume(e); if (!e.repeat) { send(key,s); }
        }
        function rectangle(button) {
            var r = button.getBoundingClientRect();
            return r && r.width > 0 && r.height > 0 ? [r.left,r.top,r.width,r.height].join(':') : null;
        }
        function buttonFor(e) {
            var root = node('hd-city-info'), n = e && e.target;
            if (!root || !n || !root.contains(n)) { return null; }
            for (;n && n !== root;n=n.parentElement) {
                if (n.getAttribute && (n.hasAttribute('data-hd-city-info-key') || n.id === 'hd-city-info-classic')) { return n; }
            }
            return null;
        }
        function down(e) {
            press = null;
            if (e.isTrusted !== true || e.button !== undefined && e.button !== 0 || e.isPrimary === false) { return; }
            var b = buttonFor(e), s = poll(), rect = b && rectangle(b);
            if (!b || b.disabled || !available(s) || pending || !rect) { return; }
            press = {button:b,snapshot:s,rect:rect,id:e.pointerId,x:e.clientX,y:e.clientY};
            consume(e);
        }
        function up(e) {
            var p = press; press = null;
            if (!p || e.isTrusted !== true || e.pointerId !== p.id || buttonFor(e) !== p.button || p.button.disabled ||
                rectangle(p.button) !== p.rect || Math.abs(e.clientX-p.x) > 12 || Math.abs(e.clientY-p.y) > 12 ||
                !same(p.snapshot,read())) { return; }
            consume(e);
            if (p.button.id === 'hd-city-info-classic') { classic = session(p.snapshot); retire(); poll(); }
            else { send(Number(p.button.getAttribute('data-hd-city-info-key')),p.snapshot); }
        }
        function begin() {
            retire();
            ['BayeHdCityMenu','BayeHdOverworld','BayeHdMobileCity'].forEach(function (name) {
                var api = win[name], cancel = api && (api.retireInteraction || api.cancelInteraction);
                if (typeof cancel === 'function') { cancel.call(api,'city-info'); }
            });
            poll();
        }
        function start() {
            if (started) { return; } started = true;
            win.addEventListener('baye-hd-city-info',begin);
            win.addEventListener('keydown',keyboard,true);
            ['blur','pagehide','resize','orientationchange'].forEach(function (event) { win.addEventListener(event,function () { retire(); poll(); }); });
            doc.addEventListener('visibilitychange',function () { retire(); poll(); });
            doc.addEventListener('pointerdown',down,true); doc.addEventListener('pointerup',up,true);
            doc.addEventListener('pointercancel',function () { press = null; },true);
            doc.addEventListener('click',function (e) { if (buttonFor(e)) { consume(e); } },true);
            timer = win.setInterval(poll,90); poll();
        }
        return {start:start,poll:poll,read:read,retire:retire,send:send,keyboard:keyboard,
            pointerDown:down,pointerUp:up,isBlockingKeyboard:function () { return !!available(read()); },
            dispose:function () { retire(); if (timer != null) { win.clearInterval(timer); } }};
    }
    var controller;
    global.BayeHdCityInfo = {createController:createController,
        start:function () { if (!controller) { controller = createController(); } controller.start(); },
        isBlockingKeyboard:function () { return controller ? controller.isBlockingKeyboard() : false; }};
})(window);
