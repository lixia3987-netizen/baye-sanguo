/* A native SEARCH overlay owns this read-only overview and one return key. */
(function (global) {
    var state = { open: false, owner: '', epoch: 0, native: null, data: null, showLcd: false,
        committed: '', pressed: null, paint: '', bound: false, timer: 0 };
    var keys = { 37: 0x24, 38: 0x22, 39: 0x25, 40: 0x23, 13: 0x27,
        27: 0x28, 32: 0x28, 70: 0x33, 83: 0x33, 72: 0x26 };
    function node(id) { return document.getElementById(id); }
    function integer(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }
    function token(value) { return value ? JSON.stringify([value.generation, value.seq, value.mapInputSeq]) : ''; }
    function readNative() {
        try {
            if (!global.baye || !baye.hd || !baye.hd.ready() || !baye.hd.miniMap || document.hidden ||
                !global.BayeHdOverworld || BayeHdOverworld.getMode() !== 'hd-map') { return null; }
            var value = baye.hd.miniMap(), march = baye.hd.march(), report = baye.hd.report(),
                menu = baye.hd.menuItems(), qty = baye.hd.qty(), fight = baye.hd.fight();
            if (!value || value.protocolVersion !== 1 || value.active !== 1 ||
                !integer(value.generation, 1, 0xffffffff) || value.generation !== value.detailGeneration ||
                !integer(value.seq, 1, 0xffffffff) || !integer(value.mapInputSeq, 1, 0xffffffff) ||
                !march || march.pick !== 1 || march.mapInputSeq !== value.mapInputSeq ||
                report && report.active || menu && menu.active || qty && qty.active || fight && fight.active) { return null; }
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
        var root = node('hd-mini-map'), on = state.open && !document.hidden;
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
    }
    function close() {
        state.epoch += 1;
        state.open = false; state.owner = ''; state.native = state.data = null;
        state.paint = ''; chrome();
    }
    function draw() {
        var canvas = node('hd-mini-map-canvas'), live = readNative();
        if (!live || token(live) !== state.owner) { close(); return; }
        var data = overview(live);
        if (!data) { state.data = null; state.showLcd = true; state.paint = ''; chrome(); return; }
        state.data = data;
        if (!canvas || document.hidden) { return; }
        var rect = canvas.getBoundingClientRect(), dpr = Math.min(global.devicePixelRatio || 1, 2);
        if (!rect.width || !rect.height) { return; }
        canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#16242b'; ctx.fillRect(0, 0, rect.width, rect.height);
        var scale = Math.min(rect.width / data.width, rect.height / data.height),
            x = (rect.width - data.width * scale) / 2, y = (rect.height - data.height * scale) / 2;
        ctx.drawImage(data.image, x, y, data.width * scale, data.height * scale);
        if (typeof data.paintEnvironment === 'function') {
            data.paintEnvironment(ctx, { x: x, y: y, w: data.width * scale, h: data.height * scale });
        }
        data.cities.forEach(function (city) {
            var cx = x + city.x * scale, cy = y + city.y * scale;
            var current = state.native.city1 === city.index + 1;
            ctx.beginPath(); ctx.arc(cx, cy, current ? 7 : 4, 0, Math.PI * 2);
            ctx.fillStyle = city.color; ctx.fill(); ctx.lineWidth = current ? 2.5 : 1;
            ctx.strokeStyle = current ? '#fff5ce' : '#0c1725'; ctx.stroke();
        });
    }
    function render() {
        var list = node('hd-mini-map-cities'), summary = node('hd-mini-map-summary'),
            body = node('hd-mini-map-content'), fallback = node('hd-mini-map-fallback');
        if (body) { body.hidden = !state.data; }
        if (fallback) { fallback.hidden = !!state.data; }
        var selected = state.data && state.data.cities.find(function (city) { return city.index + 1 === state.native.city1; });
        if (summary) { summary.textContent = state.data ? '全部 ' + state.data.cities.length + ' 座城池' +
            (selected ? ' · 当前位置：' + selected.name : ' · 当前游标未在城池上') : '请在经典画面查看当前小地图。'; }
        var signature = JSON.stringify([state.owner, state.data && state.data.generation,
            state.data && state.data.cities, state.native.city1]);
        if (list && state.paint !== signature) {
            list.textContent = '';
            if (state.data) { state.data.cities.forEach(function (city) {
                var item = document.createElement('li'), dot = document.createElement('span'), name = document.createElement('span');
                item.setAttribute('data-hd-mini-city', String(city.index));
                item.className = city.index + 1 === state.native.city1 ? 'is-current' : '';
                dot.className = 'hd-mini-map-dot'; dot.style.backgroundColor = city.color;
                name.textContent = city.name;
                var label = document.createElement('small'); label.textContent = city.kind === 'owned' ? '我方' :
                    city.kind === 'empty' ? '空城' : city.kind === 'unknown' ? '未知' : '他方';
                item.appendChild(dot); item.appendChild(name); item.appendChild(label); list.appendChild(item);
            }); }
            state.paint = signature;
            draw();
        }
    }
    function poll() {
        var value = readNative();
        if (!value) { if (state.open) { close(); } return; }
        var owner = token(value), data = overview(value);
        if (owner !== token(readNative())) { close(); return; }
        if (!state.open || owner !== state.owner) {
            state.owner = owner; state.committed = '';
            state.showLcd = !data; state.paint = '';
        }
        state.open = true; state.native = value; state.data = data;
        if (!data) { state.showLcd = true; }
        chrome(); render();
    }
    function returnKey(code, owner) {
        var live = readNative();
        if (!state.open || !owner || owner !== state.owner || owner !== token(live) ||
            state.committed === owner || !integer(code, 0, 255)) { return false; }
        state.committed = owner;
        chrome();
        // The native tpicflag consumes this one key solely to dismiss the map.
        if (global.sendKey) { sendKey(code); }
        else if (baye.sendKey) { baye.sendKey(code); }
        else { state.committed = ''; chrome(); return false; }
        return true;
    }
    function start() {
        if (state.bound || !node('hd-mini-map')) { return; }
        state.bound = true;
        // Registered on window before city/battle listeners. Repeats stay
        // consumed until C retires the exact overlay, never becoming movement.
        global.addEventListener('keydown', function (event) {
            var live = readNative();
            if (!live || event.isComposing || event.keyCode === 229 ||
                typeof global.bayeInputIgnored === 'function' && bayeInputIgnored(event)) { return; }
            var code = event.keyCode >= 48 && event.keyCode <= 57 ? 0x40 + event.keyCode - 48 : keys[event.keyCode];
            if (code == null) { return; }
            bayeConsumeKeyEvent(event); poll();
            if (!event.repeat) { returnKey(code, token(live)); }
        }, true);
        var root = node('hd-mini-map');
        root.addEventListener('pointerdown', function (event) {
            state.pressed = { owner: state.owner, epoch: state.epoch, target: event.target };
        });
        root.addEventListener('pointercancel', function () { state.pressed = null; });
        root.addEventListener('click', function (event) {
            var target = event.target.closest && event.target.closest('button'), pressed = state.pressed;
            state.pressed = null;
            poll();
            if (!target || pressed && (pressed.epoch !== state.epoch || pressed.owner !== state.owner ||
                !target.contains(pressed.target)) ||
                token(readNative()) !== state.owner || !state.open) { return; }
            if (target.id === 'hd-mini-map-return') { returnKey(0x28, state.owner); }
            if (target.id === 'hd-mini-map-classic' && state.data) { state.showLcd = !state.showLcd; chrome(); draw(); }
        });
        global.addEventListener('resize', function () { if (state.open) { poll(); draw(); } });
        document.addEventListener('visibilitychange', poll);
        state.timer = global.setInterval(poll, 180); poll();
    }
    global.BayeHdMiniMap = { start: start, poll: poll, onEngineMiniMap: poll,
        returnKey: returnKey, isOpen: function () { return state.open; },
        debugSnapshot: function () { return { open: state.open, owner: state.owner, native: state.native,
            presentationEpoch: state.epoch,
            showLcd: state.showLcd, complete: !!state.data, committed: state.committed === state.owner,
            cities: state.data ? state.data.cities : [] }; } };
})(window);
