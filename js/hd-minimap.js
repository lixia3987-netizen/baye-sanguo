/* A native SEARCH overlay owns this read-only overview and one return key. */
(function (global) {
    var state = { open: false, owner: '', epoch: 0, native: null, data: null, showLcd: false,
        committed: '', pressed: null, paint: '', filter: 'all', query: '', editor: null, composing: false, source: '',
        bound: false, timer: 0, ownerData: null,
        grant: null, blocked: false, pointers: {}, focused: true, dispatch: false, retireReason: '' };
    var mobileHost = null;
    var FILTERS = { all: '全部', owned: '我方', neutral: '他方', empty: '空城' };
    var LIB_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var MINI_FIELDS = ['protocolVersion','active','complete','custom','defaultDraw','seq','generation','mapInputSeq',
        'resourceId','imageIndex','width','height','mask','cursorX','cursorY','viewX','viewY','viewWidth','viewHeight','city1'];
    var BLOCKERS = ['g_hdBattlePick','g_hdMenuActive','g_hdReportActive','g_hdQtyActive','g_hdFightActive',
        'g_hdHelpActive','g_hdRecordActive','g_hdMovieActive','g_hdSpeActive','g_hdSkillActive','g_hdAttackActive',
        'g_hdSkillResultActive','g_hdMakerActive','g_hdViewActive','g_hdGoodsActive','g_hdPersonPropertiesActive',
        'g_hdResultOwnerKind','g_hdResultOwnerValid'];
    var keys = { 37: 0x24, 38: 0x22, 39: 0x25, 40: 0x23, 13: 0x27,
        27: 0x28, 32: 0x28, 70: 0x33, 83: 0x33, 72: 0x26 };
    function node(id) { return document.getElementById(id); }
    function integer(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }
    function matchesFilter(city) {
        var term = state.query.trim().toLowerCase();
        return (state.filter === 'all' || city.kind === state.filter) &&
            (!term || typeof city.name === 'string' && city.name.toLowerCase().indexOf(term) >= 0);
    }
    function filterButton(target) {
        return !!target && Object.keys(FILTERS).some(function (key) { return target === node('hd-mini-map-filter-' + key); });
    }
    function searchTarget(target) { return !!target && target === node('hd-mini-map-search'); }
    function searchReady() {
        var input = node('hd-mini-map-search'), root = node('hd-mini-map');
        return !!(input && root && root.contains(input) && input.isConnected !== false && state.focused && !document.hidden &&
            state.open && state.data && !state.showLcd && state.committed !== state.owner && !input.disabled);
    }
    function editorTicket() { return {owner:state.owner,epoch:state.epoch,source:state.source}; }
    function validEditor(value) {
        return !!(value && state.editor === value && searchReady() && document.activeElement === node('hd-mini-map-search') &&
            value.owner === state.owner && value.epoch === state.epoch && value.source === state.source);
    }
    function clearSearch() {
        state.query = ''; state.editor = null; state.composing = false;
        var input = node('hd-mini-map-search');
        if (input) { input.value = ''; input.disabled = true; }
    }
    function retireForSearch(reason) {
        var oldPress = state.pressed;
        retireInput(reason);
        if (!mobileHost && oldPress && !searchTarget(oldPress.target)) { state.pressed = oldPress; }
    }
    function armSearch(event) {
        if (event.isTrusted !== true || event.repeat || event.isComposing || event.keyCode === 229) { return; }
        poll();
        if (!searchTarget(event.target) || !searchReady()) { return; }
        retireForSearch('search-focus'); state.editor = editorTicket();
    }
    function updateQuery(event) {
        var input = node('hd-mini-map-search'), editor = state.editor, value = input && input.value;
        if (event.isTrusted !== true || !searchTarget(event.target) || state.composing || event.isComposing) { return; }
        poll();
        if (!validEditor(editor) || typeof value !== 'string') { if (input) { input.value = state.query; } return; }
        value = value.slice(0,32);
        if (value !== state.query) {
            retireForSearch('search'); state.query = value; state.paint = ''; state.editor = editorTicket(); render();
        }
        if (input.value !== value) { input.value = value; }
    }
    function retireKeepingEditor(reason) {
        var keep = validEditor(state.editor);
        retireForSearch(reason);
        if (keep) { state.editor = editorTicket(); }
        else { state.editor = null; state.composing = false; }
        return keep;
    }
    function sourceKey(data) { return data ? JSON.stringify([data.generation,data.libraryGeneration,data.libSha256,data.cities]) : ''; }
    function adoptSource(data) {
        var next = sourceKey(data);
        if (next !== state.source) { retireForSearch('overview-data'); clearSearch(); state.source = next; state.paint = ''; }
    }
    function chooseFilter(value) {
        if (!Object.prototype.hasOwnProperty.call(FILTERS, value)) { return; }
        poll();
        if (!state.open || !state.data || state.committed === state.owner) { return; }
        var oldPress = state.pressed;
        retireInput('filter');
        // Keep an already pressed PC control stale until its release is seen.
        if (!mobileHost && oldPress && !filterButton(oldPress.target)) { state.pressed = oldPress; }
        state.filter = value; state.paint = '';
        render();
    }
    function cityInfoOwns() {
        var data = global.baye && baye.data, active = data ? data.g_hdCityInfoActive : undefined;
        return active !== undefined && active !== 0;
    }
    function token(value) { return value ? JSON.stringify(value._mobileKey ?
        [value.generation, value.seq, value.mapInputSeq, value._mobileKey, value._libraryGeneration] :
        [value.generation, value.seq, value.mapInputSeq]) : ''; }
    function mobileReading() {
        try {
            if (!mobileHost || !state.focused || document.hidden || typeof mobileHost.available !== 'function' ||
                !mobileHost.available() || typeof mobileHost.readNative !== 'function' || !global.baye || !baye.hd ||
                !baye.hd.ready() || !global.BayeHdLibIdentity) { return null; }
            function sample() {
                var identity = BayeHdLibIdentity.read(), receipt = mobileHost.readNative();
                if (!identity || identity.status !== 'ready' || identity.sha256 !== LIB_SHA || identity.byteLength !== 207195 ||
                    !integer(identity.generation, 1, 0xffffffff) || !BayeHdLibIdentity.isCurrent(identity) || !receipt ||
                    !receipt.data || receipt.data !== baye.data || typeof receipt.key !== 'string' || !receipt.key ||
                    receipt.libraryGeneration !== identity.generation || !receipt.native) { return null; }
                var data = receipt.data, native = {}, raw = {}, value = receipt.native;
                MINI_FIELDS.forEach(function (field) {
                    native[field] = value[field];
                    raw[field] = data['g_hdMiniMap' + (field === 'mapInputSeq' ? 'InputSeq' : field.charAt(0).toUpperCase() + field.slice(1))];
                });
                native.detailGeneration = value.detailGeneration;
                if (!MINI_FIELDS.every(function (field) { return integer(native[field], 0, 0xffffffff) && native[field] === raw[field]; }) ||
                    native.protocolVersion !== 1 || native.active !== 1 || !native.generation || !native.seq || !native.mapInputSeq ||
                    !['complete','custom','defaultDraw','mask'].every(function (field) { return integer(native[field], 0, 1); }) ||
                    !['resourceId','imageIndex','width','height'].every(function (field) { return integer(native[field], 0, 65535); }) ||
                    !['cursorX','cursorY','viewX','viewY','viewWidth','viewHeight'].every(function (field) { return integer(native[field], 0, 255); }) ||
                    !integer(native.city1, 0, 38) ||
                    native.detailGeneration !== native.generation || native.generation !== data.g_hdDetailGeneration ||
                    data.g_hdEngineReady !== 1 || data.g_hdMapPick !== 1 || data.g_hdMapInputSeq !== native.mapInputSeq ||
                    [0, 7].indexOf(data.g_hdMarchPhase) < 0 || !BLOCKERS.every(function (field) {
                        raw[field] = data[field]; return raw[field] === 0;
                    }) || (data.g_hdTransferProtocolVersion !== undefined || data.g_hdTransferActive !== undefined) &&
                    (data.g_hdTransferProtocolVersion !== 1 || data.g_hdTransferActive !== 0)) { return null; }
                ['g_hdEngineReady','g_hdDetailGeneration','g_hdMapPick','g_hdMapInputSeq','g_hdMarchPhase',
                    'g_hdTransferProtocolVersion','g_hdTransferActive'].forEach(function (field) { raw[field] = data[field]; });
                if (baye.data !== data || !BayeHdLibIdentity.isCurrent(identity) || !mobileHost.available() || cityInfoOwns()) { return null; }
                return {data: data, native: native, key: JSON.stringify([receipt.key, native, raw]), libraryGeneration: identity.generation};
            }
            var first = sample(), second = sample();
            if (!first || !second || first.data !== second.data || first.key !== second.key ||
                first.libraryGeneration !== second.libraryGeneration) { return null; }
            Object.defineProperty(second.native, '_mobileKey', {value: second.key});
            Object.defineProperty(second.native, '_mobileData', {value: second.data});
            Object.defineProperty(second.native, '_libraryGeneration', {value: second.libraryGeneration});
            return second.native;
        } catch (e) { return null; }
    }
    function readNative() {
        if (cityInfoOwns()) { return null; }
        if (mobileHost) { return mobileReading(); }
        try {
            if (!global.baye || !baye.hd || !baye.hd.ready() || !baye.hd.miniMap || document.hidden ||
                !global.BayeHdOverworld || BayeHdOverworld.getMode() !== 'hd-map') { return null; }
            var value = baye.hd.miniMap(), march = baye.hd.march(), report = baye.hd.report(),
                menu = baye.hd.menuItems(), qty = baye.hd.qty(), fight = baye.hd.fight();
            if (!value || value.protocolVersion !== 1 || value.active !== 1 ||
                !integer(value.generation, 1, 0xffffffff) || value.generation !== value.detailGeneration ||
                !integer(value.seq, 1, 0xffffffff) || !integer(value.mapInputSeq, 1, 0xffffffff) ||
                !march || march.pick !== 1 || march.mapInputSeq !== value.mapInputSeq ||
                report && report.active || menu && menu.active || qty && qty.active || fight && fight.active || cityInfoOwns()) { return null; }
            return value;
        } catch (e) { return null; }
    }
    function overview(value) {
        if (!value || value.complete !== 1 || value.custom !== 0 || value.defaultDraw !== 1 ||
            value.resourceId !== 75 || value.imageIndex !== 0 || value.width !== 84 || value.height !== 64 || value.mask !== 0) { return null; }
        var data = BayeHdOverworld.overviewData && BayeHdOverworld.overviewData();
        if (!data || data.cities.length !== 38 || data.libSha256 !==
            '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e' ||
            token(value) !== token(readNative())) { return null; }
        return data;
    }
    function chrome() {
        var root = node('hd-mini-map'), on = state.open && !document.hidden &&
            (!mobileHost || !!state.data && !state.showLcd);
        document.documentElement.setAttribute('data-baye-mini-map', on ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-mini-map-lcd', on && state.showLcd ? '1' : '0');
        if (root) {
            root.hidden = !on;
            root.setAttribute('aria-hidden', on ? 'false' : 'true');
            root.classList.toggle('is-classic', !!state.showLcd);
            root.classList.toggle('is-fallback', !state.data);
        }
        var toggle = node('hd-mini-map-classic');
        if (toggle) {
            toggle.textContent = state.showLcd ? '隐藏经典画面' : '经典画面';
            toggle.disabled = !state.data;
        }
        var back = node('hd-mini-map-return');
        if (back) { back.disabled = state.committed === state.owner; }
        var filters = node('hd-mini-map-filters');
        if (filters) { filters.hidden = !state.data; }
        var search = node('hd-mini-map-search'), searchWrap = node('hd-mini-map-search-wrap');
        var tools = node('hd-mini-map-tools');
        if (tools) { tools.hidden = !state.data; }
        if (searchWrap) { searchWrap.hidden = !state.open || !state.data || state.showLcd; }
        if (search) { search.disabled = !state.open || !state.data || state.showLcd || !state.focused || state.committed === state.owner; }
        Object.keys(FILTERS).forEach(function (key) {
            var button = node('hd-mini-map-filter-' + key);
            if (button) { button.disabled = !state.data || state.committed === state.owner; }
        });
    }
    function close() {
        state.epoch += 1;
        state.open = false; state.owner = ''; state.native = state.data = null; state.filter = 'all';
        clearSearch(); state.source = '';
        state.ownerData = null; state.grant = null;
        if (mobileHost) { state.pressed = null; }
        state.paint = ''; chrome();
    }
    function draw() {
        var canvas = node('hd-mini-map-canvas'), live = readNative();
        if (!live || token(live) !== state.owner || mobileHost && live._mobileData !== state.ownerData) { close(); return; }
        var data = overview(live);
        if (!data) { adoptSource(null); state.data = null; state.showLcd = true; state.paint = ''; chrome(); return; }
        adoptSource(data);
        state.data = data;
        if (!canvas || document.hidden) { return; }
        var rect = canvas.getBoundingClientRect(), dpr = Math.min(global.devicePixelRatio || 1, 2);
        // The mobile host reveals its CSS surface after this poll. Retry the
        // initial paint once layout becomes visible instead of caching a blank.
        if (!rect.width || !rect.height) { state.paint = ''; return; }
        canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
        var ctx = canvas.getContext('2d');
        ctx.globalAlpha = 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#16242b'; ctx.fillRect(0, 0, rect.width, rect.height);
        var scale = Math.min(rect.width / data.width, rect.height / data.height),
            x = (rect.width - data.width * scale) / 2, y = (rect.height - data.height * scale) / 2;
        ctx.drawImage(data.image, x, y, data.width * scale, data.height * scale);
        if (typeof data.paintEnvironment === 'function') {
            data.paintEnvironment(ctx, { x: x, y: y, w: data.width * scale, h: data.height * scale });
        }
        data.cities.forEach(function (city) {
            ctx.globalAlpha = matchesFilter(city) ? 1 : 0.2;
            var cx = x + city.x * scale, cy = y + city.y * scale;
            var current = state.native.city1 === city.index + 1;
            ctx.beginPath(); ctx.arc(cx, cy, current ? 7 : 4, 0, Math.PI * 2);
            ctx.fillStyle = city.color; ctx.fill(); ctx.lineWidth = current ? 2.5 : 1;
            ctx.strokeStyle = current ? '#fff5ce' : '#0c1725'; ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }
    function render() {
        var list = node('hd-mini-map-cities'), summary = node('hd-mini-map-summary'),
            body = node('hd-mini-map-content'), fallback = node('hd-mini-map-fallback');
        if (body) { body.hidden = !state.data; }
        if (fallback) { fallback.hidden = !!state.data; }
        var matches = state.data ? state.data.cities.filter(matchesFilter) : [];
        var search = node('hd-mini-map-search');
        if (search && !state.composing && !validEditor(state.editor)) { search.value = state.query; }
        var filters = node('hd-mini-map-filters');
        if (filters) { filters.hidden = !state.data; }
        Object.keys(FILTERS).forEach(function (key) {
            var button = node('hd-mini-map-filter-' + key);
            if (!button) { return; }
            var count = state.data ? state.data.cities.filter(function (city) { return key === 'all' || city.kind === key; }).length : 0;
            button.textContent = FILTERS[key] + '（' + count + '）';
            button.setAttribute('aria-pressed', state.filter === key ? 'true' : 'false');
            button.disabled = !state.data || state.committed === state.owner;
        });
        var selected = state.data && state.data.cities.find(function (city) { return city.index + 1 === state.native.city1; });
        if (summary) { summary.textContent = state.data ? '匹配 ' + matches.length + ' / ' + state.data.cities.length + ' 座城池' +
            (selected ? ' · 当前位置：' + selected.name : ' · 当前游标未在城池上') : '请在经典画面查看当前小地图。'; }
        var signature = JSON.stringify([state.owner, state.data && state.data.generation,
            state.data && state.data.cities, state.native.city1, state.filter, state.query]);
        if (list && state.paint !== signature) {
            list.textContent = state.data && !matches.length ? '暂无匹配城池' : '';
            list.setAttribute('aria-label', FILTERS[state.filter] + '城池');
            if (state.data) { matches.forEach(function (city) {
                var item = document.createElement('li'), dot = document.createElement('span'), name = document.createElement('span');
                item.setAttribute('data-hd-mini-city', String(city.index));
                item.className = city.index + 1 === state.native.city1 ? 'is-current' : '';
                dot.className = 'hd-mini-map-dot'; dot.style.backgroundColor = city.color;
                name.textContent = city.name;
                var label = document.createElement('small'); label.textContent = city.kind === 'owned' ? '我方' :
                    city.kind === 'empty' ? '空城' : city.kind === 'unknown' ? '未知' : '他方';
                item.appendChild(dot); item.appendChild(name); item.appendChild(label); list.appendChild(item);
            }); }
            if (mobileHost) { list.scrollTop = 0; }
            state.paint = signature;
            draw();
        }
    }
    function poll() {
        var value = readNative();
        if (!value) { if (state.open) { close(); } return; }
        var owner = token(value), data = overview(value);
        var after = readNative();
        if (owner !== token(after) || mobileHost && (!after || value._mobileData !== after._mobileData)) { close(); return; }
        if (!state.open || owner !== state.owner || mobileHost && state.ownerData !== value._mobileData) {
            state.epoch++; state.grant = null;
            if (mobileHost) { state.pressed = null; }
            state.owner = owner; state.committed = '';
            state.showLcd = !data; state.paint = ''; state.filter = 'all';
            clearSearch(); state.source = sourceKey(data);
        }
        adoptSource(data);
        state.ownerData = mobileHost ? value._mobileData : null;
        state.open = true; state.native = value; state.data = data;
        if (!data) { state.showLcd = true; state.filter = 'all'; }
        chrome(); render();
    }
    function returnKey(code, owner) {
        var live = readNative();
        if (!state.open || !owner || owner !== state.owner || owner !== token(live) ||
            state.committed === owner || !integer(code, 0, 255) || mobileHost &&
            (!state.dispatch || code !== 0x28 || !state.data || state.showLcd || live._mobileData !== state.ownerData)) { return false; }
        state.committed = owner;
        chrome();
        if (cityInfoOwns()) { return false; }
        // The native tpicflag consumes this one key solely to dismiss the map.
        if (global.sendKey) { sendKey(code); }
        else if (baye.sendKey) { baye.sendKey(code); }
        else { state.committed = ''; chrome(); return false; }
        return true;
    }
    function getInputTicket() {
        if (!mobileHost || !state.open || !state.data || state.showLcd || state.committed === state.owner) { return null; }
        var live = readNative();
        if (!live || token(live) !== state.owner || live._mobileData !== state.ownerData) { return null; }
        var result = {key: state.owner, epoch: state.epoch, libraryGeneration: live._libraryGeneration,
            generation: live.generation, seq: live.seq, mapInputSeq: live.mapInputSeq};
        Object.defineProperty(result, 'data', {value: state.ownerData});
        return Object.freeze(result);
    }
    function sameTicket(a, b) { return !!(a && b && a.data === b.data && a.key === b.key && a.epoch === b.epoch); }
    function retireInput(reason) {
        state.epoch++; state.pressed = state.grant = null; state.retireReason = reason || 'retired';
    }
    function mobileTarget(event) {
        var root = node('hd-mini-map'), target = event.target && event.target.closest && event.target.closest('button');
        return root && target && root.contains(target) && target.id === 'hd-mini-map-return' && !target.disabled ? target : null;
    }
    function geometry(target) {
        try {
            var r = target.getBoundingClientRect();
            return r && [r.left,r.top,r.width,r.height].every(Number.isFinite) && r.width >= 44 && r.height >= 44 ?
                [r.left,r.top,r.width,r.height] : null;
        } catch (e) { return null; }
    }
    function visible(target, x, y) {
        try {
            if (!target || target.isConnected === false || document.hidden) { return false; }
            for (var p = target; p; p = p.parentElement) {
                var style = global.getComputedStyle && getComputedStyle(p);
                if (p.hidden || style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) { return false; }
            }
            var hit = document.elementFromPoint(x, y);
            return hit === target || target.contains(hit);
        } catch (e) { return false; }
    }
    function bindMobileInput(root) {
        document.addEventListener('pointerdown', function (event) {
            if (!mobileHost) { return; }
            state.pointers[event.pointerId] = true;
            if (Object.keys(state.pointers).length > 1 || event.isPrimary === false) {
                state.blocked = true; retireInput('multiple-pointers');
            }
        }, true);
        root.addEventListener('pointerdown', function (event) {
            if (!mobileHost) { return; }
            if (searchTarget(event.target)) { return; }
            var target = mobileTarget(event), ticket = getInputTicket(), rect = target && geometry(target);
            state.grant = null;
            if (event.isTrusted !== true || event.isPrimary !== true || event.button !== 0 || !integer(event.pointerId, 0, 0xffffffff) || state.blocked ||
                !target || !rect || !ticket || !visible(target, event.clientX, event.clientY) ||
                !sameTicket(ticket, getInputTicket())) { retireInput('invalid-down'); return; }
            state.pressed = {target: target, ticket: ticket, id: event.pointerId, rect: rect, x: event.clientX, y: event.clientY};
        });
        document.addEventListener('pointermove', function (event) {
            if (!mobileHost || !state.pressed || state.pressed.id !== event.pointerId) { return; }
            var press = state.pressed;
            if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10 ||
                JSON.stringify(press.rect) !== JSON.stringify(geometry(press.target)) || !sameTicket(press.ticket, getInputTicket())) {
                retireInput('move-or-owner-change');
            }
        }, true);
        document.addEventListener('pointerup', function (event) {
            if (!mobileHost) { return; }
            var press = state.pressed, target = mobileTarget(event);
            if (press && press.id === event.pointerId) {
                state.pressed = null;
                if (event.isTrusted === true && event.isPrimary === true && event.button === 0 && !state.blocked &&
                    target === press.target && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 10 &&
                    JSON.stringify(press.rect) === JSON.stringify(geometry(target)) && visible(target, event.clientX, event.clientY) &&
                    sameTicket(press.ticket, getInputTicket())) { state.grant = {target: target, ticket: press.ticket,
                        rect: press.rect, at: Date.now()}; }
                else { retireInput('invalid-release'); }
            }
            delete state.pointers[event.pointerId];
            if (!Object.keys(state.pointers).length) { state.blocked = false; }
        }, true);
        document.addEventListener('pointercancel', function (event) {
            if (!mobileHost) { return; }
            delete state.pointers[event.pointerId]; retireInput('pointercancel');
            state.blocked = Object.keys(state.pointers).length > 0;
        }, true);
        document.addEventListener('lostpointercapture', function (event) {
            // Touch releases implicit capture between pointerup and click.
            // Only a lost capture during an unfinished press cancels its grant.
            if (mobileHost && (state.pressed || state.pointers[event.pointerId])) { retireInput('lost-capture'); }
        }, true);
        document.addEventListener('scroll', function () { retireKeepingEditor('scroll'); }, true);
        root.addEventListener('click', function (event) {
            if (!mobileHost) { return; }
            var target = mobileTarget(event), grant = state.grant; state.grant = null;
            if (!target) { return; }
            event.preventDefault(); event.stopPropagation();
            poll();
            if (!grant || grant.target !== target || event.isTrusted !== true || !(event.detail > 0) || state.blocked ||
                Date.now() - grant.at > 700 || !visible(target, event.clientX, event.clientY) ||
                JSON.stringify(grant.rect) !== JSON.stringify(geometry(target)) ||
                !sameTicket(grant.ticket, getInputTicket())) { return; }
            state.dispatch = true;
            try { returnKey(0x28, state.owner); } finally { state.dispatch = false; }
        });
    }
    function start() {
        if (state.bound || !node('hd-mini-map')) { return; }
        state.bound = true;
        // Registered on window before city/battle listeners. Repeats stay
        // consumed until C retires the exact overlay, never becoming movement.
        global.addEventListener('keydown', function (event) {
            if (searchTarget(event.target)) {
                if (!validEditor(state.editor)) { armSearch(event); }
                if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
                else if (event.stopPropagation) { event.stopPropagation(); }
                return;
            }
            var live = readNative();
            if (live && state.open && filterButton(event.target)) {
                // Enter/Space activate the local button; Tab keeps native focus navigation.
                if (!event.isComposing && event.keyCode !== 229 && [9, 13, 32].indexOf(event.keyCode) < 0 &&
                    (keys[event.keyCode] != null || event.keyCode >= 48 && event.keyCode <= 57)) { bayeConsumeKeyEvent(event); }
                return;
            }
            if (!live || event.isComposing || event.keyCode === 229 ||
                typeof global.bayeInputIgnored === 'function' && bayeInputIgnored(event)) { return; }
            var code = event.keyCode >= 48 && event.keyCode <= 57 ? 0x40 + event.keyCode - 48 : keys[event.keyCode];
            if (code == null) { return; }
            if (mobileHost && (!state.open || !state.data || state.showLcd)) { return; }
            bayeConsumeKeyEvent(event); poll();
            if (mobileHost) { return; }
            if (!event.repeat) { returnKey(code, token(live)); }
        }, true);
        global.addEventListener('keyup', function (event) {
            if (!searchTarget(event.target)) { return; }
            if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
            else if (event.stopPropagation) { event.stopPropagation(); }
        }, true);
        var root = node('hd-mini-map');
        var search = node('hd-mini-map-search');
        if (search) {
            search.addEventListener('focus',armSearch);
            search.addEventListener('blur',function () { state.editor = null; state.composing = false; search.value = state.query; });
            search.addEventListener('input',updateQuery);
            search.addEventListener('compositionstart',function (event) {
                if (event.isTrusted === true && searchTarget(event.target)) { state.composing = validEditor(state.editor); }
            });
            search.addEventListener('compositionend',function (event) {
                if (event.isTrusted !== true || !searchTarget(event.target)) { return; }
                var composing = state.composing; state.composing = false;
                if (composing) { updateQuery(event); }
                else { search.value = state.query; }
            });
        }
        Object.keys(FILTERS).forEach(function (key) {
            var button = node('hd-mini-map-filter-' + key);
            if (button) { button.addEventListener('click', function (event) {
                event.preventDefault(); event.stopPropagation(); chooseFilter(key);
            }); }
        });
        root.addEventListener('pointerdown', function (event) {
            if (searchTarget(event.target)) { armSearch(event); return; }
            if (mobileHost) { return; }
            state.pressed = { owner: state.owner, epoch: state.epoch, target: event.target };
        });
        root.addEventListener('pointercancel', function () { if (!mobileHost) { state.pressed = null; } });
        root.addEventListener('click', function (event) {
            if (mobileHost) { return; }
            var target = event.target.closest && event.target.closest('button'), pressed = state.pressed;
            state.pressed = null;
            poll();
            if (!target || pressed && (pressed.epoch !== state.epoch || pressed.owner !== state.owner ||
                !target.contains(pressed.target)) ||
                token(readNative()) !== state.owner || !state.open) { return; }
            if (target.id === 'hd-mini-map-return') { returnKey(0x28, state.owner); }
            if (target.id === 'hd-mini-map-classic' && state.data) {
                state.showLcd = !state.showLcd;
                if (state.showLcd) { retireInput('classic'); clearSearch(); }
                chrome(); draw();
            }
        });
        bindMobileInput(root);
        global.addEventListener('resize', function () {
            var editing = retireKeepingEditor('resize');
            if (mobileHost && !editing) { close(); }
            if (state.open) { poll(); draw(); }
        });
        ['orientationchange','pagehide','blur'].forEach(function (event) {
            global.addEventListener(event, function () {
                if (!mobileHost) { retireForSearch(event); }
                clearSearch();
                if (event === 'blur' || event === 'pagehide') { state.focused = false; }
                chrome();
                if (!mobileHost) { return; }
                retireInput(event); close();
            });
        });
        ['focus','pageshow'].forEach(function (event) {
            global.addEventListener(event, function () { state.focused = true; if (state.open || mobileHost) { poll(); } });
        });
        document.addEventListener('visibilitychange', function () {
            if (mobileHost) { retireInput('visibility'); close(); }
            poll();
        });
        state.timer = global.setInterval(poll, 180); poll();
    }
    global.BayeHdMiniMap = { start: start, poll: poll, onEngineMiniMap: poll,
        attachMobileHost: function (host) { close(); mobileHost = host || {}; state.focused = true;
            if (global.BayeHdLibIdentity && typeof BayeHdLibIdentity.subscribe === 'function' && !state.identityBound) {
                state.identityBound = true;
                BayeHdLibIdentity.subscribe(function () { if (mobileHost) { retireInput('identity'); close(); } });
            }
            start(); poll(); },
        retireInteraction: function (reason) { retireInput(reason); close(); },
        getInputTicket: getInputTicket,
        returnKey: returnKey, isOpen: function () { return state.open; },
        debugSnapshot: function () { return { open: state.open, owner: state.owner, native: state.native,
            presentationEpoch: state.epoch, mobileHost: !!mobileHost, retireReason: state.retireReason,
            showLcd: state.showLcd, complete: !!state.data, committed: state.committed === state.owner,
            filter: state.filter, query: state.query, matchingCities: state.data ? state.data.cities.filter(matchesFilter).length : 0,
            cities: state.data ? state.data.cities : [] }; } };
})(window);
