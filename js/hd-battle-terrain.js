/** Read-only terrain presentation for the verified dictionary LIB.
 * Native map bytes select a terrain category; these motifs never calculate
 * movement, defence, range, or skill eligibility. Static scenery is baked once
 * per visible-map change, with the live units and native masks drawn above it.
 */
(function (global) {
    var SUPPORTED_LIB = 'libs/dat-mod.lib';
    var SUPPORTED_SHA256 = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var KINDS = ['grass', 'plain', 'hill', 'forest', 'village', 'city', 'tent', 'river'];
    var LABELS = ['草地', '平原', '山地', '森林', '村庄', '城池', '营寨', '河流'];
    var COLORS = ['#354c3e', '#515443', '#53564e', '#29443b', '#5b5346', '#53525a', '#524d3c', '#2c505c'];

    function integer(value) { return typeof value === 'number' && isFinite(value) && value === Math.floor(value); }
    function category(index, raw) {
        return { kind: index == null ? 'unknown' : KINDS[index],
            label: index == null ? '未知地形' : LABELS[index], index: index, raw: raw == null ? null : raw };
    }
    function classifyTile(raw) {
        // Keep this boundary order identical to native FgtGetTerrain.
        if (!integer(raw) || raw <= 0 || raw > 255) { return category(null, raw); }
        if (raw > 15) { return category(raw === 41 ? 6 : 7, raw); }
        if (raw > 5) { return category(2, raw); }
        if (raw > 4) { return category(3, raw); }
        if (raw > 3) { return category(4, raw); }
        if (raw > 2) { return category(5, raw); }
        return category(raw > 1 ? 0 : 1, raw);
    }
    function dimensionsValid(snapshot) {
        return !!(snapshot && integer(snapshot.width) && snapshot.width > 0 && snapshot.width <= 255 &&
            integer(snapshot.height) && snapshot.height > 0 && snapshot.height <= 255 &&
            snapshot.stride === snapshot.width);
    }
    function createVerifier(options) {
        var source, identity = global.BayeHdLibIdentity;
        if (options && identity && identity.createIdentity) {
            identity = identity.createIdentity({ getHex: function () { return source; }, digest: options.digest });
        }
        function customHooks(hooks) {
            var names = ['drawMapUnit', 'getTerrainInfo', 'loadFightMap'];
            try {
                for (var i = 0; hooks && i < names.length; i += 1) {
                    if (typeof hooks[names[i]] === 'function') { return true; }
                }
            } catch (e) { return true; }
            return false;
        }
        function check(hex, hooks) {
            source = hex;
            var current = identity ? identity.read() :
                { status: 'unavailable', sha256: null, generation: 0, reason: 'lib-unavailable' };
            var verified = current.status === 'ready' && current.sha256 === SUPPORTED_SHA256 &&
                (options || hex === global.dynLib) && identity.isCurrent(current);
            var reason = current.status === 'ready' ? (verified ? '' : 'unrecognized-lib') : current.reason;
            var overridden = customHooks(hooks);
            return { verified: !!verified && !overridden,
                reason: overridden ? 'custom-terrain-hook' : reason, sha256: current.sha256,
                libPath: verified ? SUPPORTED_LIB : '', generation: current.generation };
        }
        return { check: check };
    }
    function inspect(snapshot, x, y) {
        var raw = null, inBounds = dimensionsValid(snapshot) && integer(x) && integer(y) &&
            x >= 0 && y >= 0 && x < snapshot.width && y < snapshot.height;
        if (inBounds && snapshot.tiles) {
            var offset = y * snapshot.stride + x;
            if (offset < snapshot.tiles.length) { raw = snapshot.tiles[offset]; }
        }
        var result = inBounds && snapshot.source === 'full' && snapshot.verified === true &&
            snapshot.libPath === SUPPORTED_LIB ? classifyTile(raw) : category(null, raw);
        result.x = x; result.y = y;
        return result;
    }
    function path(ctx, points, fill, stroke, width) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (var i = 1; i < points.length; i += 1) { ctx.lineTo(points[i][0], points[i][1]); }
        if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); }
    }
    function tree(ctx, x, y, size) {
        ctx.fillStyle = '#1c302c';
        ctx.fillRect(x - size * 0.07, y - size * 0.05, size * 0.14, size * 0.45);
        path(ctx, [[x, y - size * 0.58], [x + size * 0.4, y + size * 0.03],
            [x - size * 0.4, y + size * 0.03]], '#376354', '#426b56');
        path(ctx, [[x, y - size * 0.84], [x + size * 0.32, y - size * 0.19],
            [x - size * 0.32, y - size * 0.19]], '#416b55');
    }
    function house(ctx, x, y, w, h) {
        ctx.fillStyle = '#ac9c7b';
        ctx.fillRect(x, y, w, h);
        path(ctx, [[x - w * 0.13, y], [x + w * 0.5, y - h * 0.63],
            [x + w * 1.13, y]], '#625b58', '#c5a989', 1.2);
        ctx.fillStyle = '#534736';
        ctx.fillRect(x + w * 0.4, y + h * 0.42, w * 0.2, h * 0.58);
    }
    function tent(ctx, x, y, w, h) {
        path(ctx, [[x, y + h], [x + w * 0.5, y], [x + w, y + h]], '#b5a57e', '#d4c394', 1.2);
        path(ctx, [[x + w * 0.38, y + h], [x + w * 0.5, y + h * 0.38],
            [x + w * 0.63, y + h]], '#544834');
        path(ctx, [[x - w * 0.1, y + h], [x + w * 0.5, y], [x + w * 1.12, y + h]], null, '#796f51', 1);
    }
    function drawCell(ctx, x, y, w, h, cell) {
        var kind = cell.kind, variant = ((cell.x * 17 + cell.y * 31 + (cell.raw || 0)) & 3);
        var index = cell.index, s = Math.min(w, h);
        ctx.fillStyle = index == null ? ((cell.x + cell.y) % 2 ? '#1c2630' : '#19222b') : COLORS[index];
        ctx.fillRect(x, y, w + 0.5, h + 0.5);
        if (index == null) { return; }
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.76;
        if (kind === 'grass') {
            ctx.strokeStyle = '#728269'; ctx.lineWidth = Math.max(1, s * 0.012);
            for (var i = 0; i < 5; i += 1) {
                var gx = w * (0.13 + ((i * 3 + variant) % 8) * 0.1);
                var gy = h * (0.22 + ((i * 5 + variant) % 6) * 0.11);
                path(ctx, [[gx - s * 0.04, gy - s * 0.055], [gx, gy],
                    [gx + s * 0.015, gy - s * 0.085]], null, '#6e8769', Math.max(1, s * 0.012));
            }
        } else if (kind === 'plain') {
            for (var p = 0; p < 3; p += 1) {
                ctx.beginPath();
                ctx.moveTo(w * 0.04, h * (0.23 + p * 0.26));
                ctx.quadraticCurveTo(w * 0.42, h * (0.13 + p * 0.26), w * 0.94, h * (0.28 + p * 0.24));
                ctx.strokeStyle = '#70745b'; ctx.lineWidth = Math.max(1, s * 0.01); ctx.stroke();
            }
        } else if (kind === 'hill') {
            path(ctx, [[w * 0.04, h * 0.78], [w * (0.29 + variant * 0.02), h * 0.2],
                [w * 0.61, h * 0.78]], '#717463', '#929381', Math.max(1, s * 0.012));
            path(ctx, [[w * 0.39, h * 0.8], [w * 0.7, h * 0.36], [w * 0.96, h * 0.8]], '#646c5b', '#8b9079', 1);
            path(ctx, [[w * 0.18, h * 0.51], [w * (0.29 + variant * 0.02), h * 0.2],
                [w * 0.39, h * 0.45]], null, '#b0b0a0', Math.max(1, s * 0.015));
        } else if (kind === 'forest') {
            tree(ctx, w * 0.24, h * 0.58, s * 0.4);
            tree(ctx, w * 0.67, h * 0.43, s * 0.34);
            tree(ctx, w * 0.8, h * 0.82, s * 0.32);
        } else if (kind === 'village') {
            path(ctx, [[w * 0.09, h * 0.82], [w * 0.56, h * 0.65], [w * 0.91, h * 0.8]], null, '#968163', s * 0.05);
            house(ctx, w * 0.16, h * 0.48, w * 0.27, h * 0.26);
            house(ctx, w * 0.62, h * 0.4, w * 0.23, h * 0.23);
        } else if (kind === 'city') {
            ctx.fillStyle = '#8e8a80';
            ctx.fillRect(w * 0.1, h * 0.52, w * 0.8, h * 0.25);
            ctx.strokeStyle = '#c0b299'; ctx.lineWidth = Math.max(1, s * 0.018);
            ctx.strokeRect(w * 0.1, h * 0.52, w * 0.8, h * 0.25);
            house(ctx, w * 0.11, h * 0.38, w * 0.22, h * 0.34);
            house(ctx, w * 0.67, h * 0.38, w * 0.22, h * 0.34);
            ctx.fillStyle = '#494341'; ctx.fillRect(w * 0.44, h * 0.58, w * 0.12, h * 0.19);
            for (var b = 0; b < 5; b += 1) {
                ctx.fillStyle = '#b3a48d'; ctx.fillRect(w * (0.35 + b * 0.06), h * 0.48, w * 0.035, h * 0.07);
            }
        } else if (kind === 'tent') {
            tent(ctx, w * 0.12, h * 0.25, w * 0.34, h * 0.43);
            tent(ctx, w * 0.59, h * 0.43, w * 0.28, h * 0.36);
            path(ctx, [[w * 0.11, h * 0.86], [w * 0.87, h * 0.86]], null, '#a2946d', Math.max(1, s * 0.018));
        } else if (kind === 'river') {
            for (var wave = 0; wave < 4; wave += 1) {
                var wy = h * (0.17 + wave * 0.2);
                ctx.beginPath(); ctx.moveTo(0, wy);
                ctx.bezierCurveTo(w * 0.32, wy - h * 0.08, w * 0.57, wy + h * 0.09, w, wy);
                ctx.strokeStyle = wave % 2 ? '#65908d' : '#456c76';
                ctx.lineWidth = Math.max(1, s * 0.025); ctx.stroke();
            }
        }
        ctx.restore();
    }
    function visibleCells(board, snapshot) {
        var cells = [];
        for (var r = 0; r < board.rows; r += 1) {
            for (var c = 0; c < board.cols; c += 1) {
                cells.push(inspect(snapshot, c + board.viewOx, r + board.viewOy));
            }
        }
        return cells;
    }
    function drawBoard(ctx, board, cells) {
        var i = 0;
        for (var r = 0; r < board.rows; r += 1) {
            for (var c = 0; c < board.cols; c += 1) {
                drawCell(ctx, c * board.cw, r * board.ch, board.cw, board.ch, cells[i++]);
            }
        }
    }
    function createPainter(options) {
        var cached = null;
        function clear() { cached = null; }
        function makeCanvas() {
            if (options && options.createCanvas) { return options.createCanvas(); }
            return global.document && typeof global.document.createElement === 'function' ?
                global.document.createElement('canvas') : null;
        }
        function paint(ctx, board, snapshot) {
            if (global.document && global.document.hidden) { return false; }
            if (snapshot && snapshot.mode === 'classic') { clear(); return false; }
            if (!board || !integer(board.cols) || !integer(board.rows) || board.cols < 1 || board.rows < 1 ||
                !isFinite(board.cw) || !isFinite(board.ch) || board.cw <= 0 || board.ch <= 0) { return false; }
            var cells = visibleCells(board, snapshot), dpr = Math.max(1, Math.min(2, board.dpr || 1));
            var key = [board.cols, board.rows, board.cw, board.ch, board.viewOx, board.viewOy, dpr,
                snapshot && snapshot.width, snapshot && snapshot.height, snapshot && snapshot.stride,
                snapshot && snapshot.source, snapshot && snapshot.libPath, snapshot && snapshot.session,
                snapshot && snapshot.mode, snapshot && snapshot.verified, snapshot && snapshot.sha256,
                snapshot && snapshot.libGeneration].join('|');
            for (var i = 0; i < cells.length; i += 1) { key += '|' + cells[i].raw + ':' + cells[i].kind; }
            if (!cached || cached.key !== key) {
                var layer = cached && cached.canvas || makeCanvas(), layerCtx = layer && layer.getContext('2d');
                if (layerCtx) {
                    layer.width = Math.ceil(board.cols * board.cw * dpr);
                    layer.height = Math.ceil(board.rows * board.ch * dpr);
                    layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    drawBoard(layerCtx, board, cells);
                    cached = { key: key, canvas: layer };
                } else {
                    ctx.save(); ctx.translate(board.ox, board.oy); drawBoard(ctx, board, cells); ctx.restore();
                    return true;
                }
            }
            ctx.drawImage(cached.canvas, board.ox, board.oy, board.cols * board.cw, board.rows * board.ch);
            return true;
        }
        return { paint: paint, clear: clear };
    }
    var painter = createPainter(), verifier = createVerifier();
    global.BayeHdBattleTerrain = {
        classifyTile: classifyTile, inspect: inspect, createPainter: createPainter,
        createVerifier: createVerifier, verifyLib: verifier.check,
        paint: painter.paint, clear: painter.clear
    };
})(window);
