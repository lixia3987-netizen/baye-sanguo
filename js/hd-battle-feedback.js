/** Native-mask feedback only. The engine still confirms movement and skills;
 * painting and inspecting these snapshots never send an input or call a hook.
 */
(function (global) {
    function integer(value) { return typeof value === 'number' && isFinite(value) && value === Math.floor(value); }
    function byte(value) { return integer(value) && value >= 0 && value <= 255; }
    function validBounds(bounds) { return !!(bounds && integer(bounds.width) && integer(bounds.height) &&
        bounds.width > 0 && bounds.height > 0 && bounds.width <= 255 && bounds.height <= 255); }
    function inside(bounds, x, y) { return validBounds(bounds) && integer(x) && integer(y) &&
        x >= 0 && y >= 0 && x < bounds.width && y < bounds.height; }
    function result(status, raw, index, px, py) {
        return { status: status, raw: raw == null ? null : raw, index: index == null ? null : index,
            px: px == null ? null : px, py: py == null ? null : py };
    }
    function validMove(mask) { return !!(mask && byte(mask.originX) && byte(mask.originY) &&
        byte(mask.useX) && byte(mask.useY) && mask.values && mask.values.length >= 225); }
    function validAim(mask) { return !!(mask && integer(mask.size) && mask.size >= 1 && mask.size <= 15 &&
        byte(mask.originX) && byte(mask.originY) && mask.values && mask.values.length >= mask.size * mask.size); }
    function lookupMove(mask, x, y, bounds) {
        if (!validBounds(bounds) || !integer(x) || !integer(y)) { return result('unknown'); }
        if (!inside(bounds, x, y)) { return result('out'); }
        if (!validMove(mask)) { return result('unknown'); }
        // FgtGenMove assigns these differences to U8 before indexing 15 x 15.
        var px = (x - mask.originX + mask.useX) & 255;
        var py = (y - mask.originY + mask.useY) & 255;
        if (px >= 15 || py >= 15) { return result('out', null, null, px, py); }
        var index = py * 15 + px, raw = mask.values[index];
        return result(byte(raw) ? (raw <= 128 ? 'in' : 'out') : 'unknown', raw, index, px, py);
    }
    function lookupAim(mask, x, y, bounds) {
        if (!validBounds(bounds) || !integer(x) || !integer(y)) { return result('unknown'); }
        if (!inside(bounds, x, y)) { return result('out'); }
        if (!validAim(mask)) { return result('unknown'); }
        var px = (x - mask.originX) & 255, py = (y - mask.originY) & 255;
        if (px >= mask.size || py >= mask.size) { return result('out', null, null, px, py); }
        var index = py * mask.size + px, raw = mask.values[index];
        return result(byte(raw) ? (raw === 1 ? 'in' : 'out') : 'unknown', raw, index, px, py);
    }
    function build(snapshot) {
        snapshot = snapshot || {};
        var out = { active: false, reason: '', kind: '', inputSeq: snapshot.inputSeq,
            actorIndex: snapshot.actorIndex, actorValid: false,
            bounds: snapshot.bounds ? { width: snapshot.bounds.width, height: snapshot.bounds.height } : null,
            view: snapshot.view ? { x: snapshot.view.x, y: snapshot.view.y, width: snapshot.view.width, height: snapshot.view.height } : null,
            mask: null, cells: [], focus: null, rangedUnits: [] };
        function retire(reason) { out.reason = reason; return out; }
        if (snapshot.visible !== true || snapshot.hidden || snapshot.classic || snapshot.mode === 'classic') { return retire('not-visible'); }
        if (snapshot.reportActive || snapshot.menuActive) { return retire('native-owner'); }
        if (snapshot.ready !== true || snapshot.wait !== true || !snapshot.active || snapshot.over ||
            !integer(snapshot.inputSeq) || snapshot.inputSeq <= 0) { return retire('not-ready'); }
        if (snapshot.inputKind !== 2 && snapshot.inputKind !== 5) { return retire('not-range-input'); }
        if (snapshot.inputKind === 5 && snapshot.aimType !== 0 && snapshot.aimType !== 1) { return retire('unknown-aim'); }
        var actor = snapshot.actor, bounds = snapshot.bounds, view = snapshot.view;
        if (!integer(snapshot.actorIndex) || snapshot.actorIndex < 0 || snapshot.actorIndex >= 20 || !actor ||
            actor.i !== snapshot.actorIndex || actor.side !== 'player' || actor.active !== 0 ||
            !integer(actor.state) || actor.state < 0 || actor.state > 7 || actor.state === 1 || actor.state === 6 ||
            !inside(bounds, actor.x, actor.y)) { return retire('invalid-actor'); }
        out.actorValid = true;
        if (!view || !integer(view.x) || !integer(view.y) || !integer(view.width) || !integer(view.height) ||
            view.x < 0 || view.y < 0 || view.width < 1 || view.height < 1 || view.width > 255 || view.height > 255) { return retire('invalid-view'); }
        out.kind = snapshot.inputKind === 2 ? 'move' : (snapshot.aimType === 1 ? 'skill' : 'attack');
        var mask = out.kind === 'move' ? snapshot.move : snapshot.aim;
        if (!(out.kind === 'move' ? validMove(mask) : validAim(mask))) { return retire('mask-unavailable'); }
        out.mask = { originX: mask.originX, originY: mask.originY,
            useX: out.kind === 'move' ? mask.useX : null, useY: out.kind === 'move' ? mask.useY : null,
            size: out.kind === 'move' ? 15 : mask.size };
        var lookup = out.kind === 'move' ? lookupMove : lookupAim;
        function cell(x, y) { return lookup(mask, x, y, bounds); }
        for (var y = Math.max(0, view.y); y < Math.min(bounds.height, view.y + view.height); y += 1) {
            for (var x = Math.max(0, view.x); x < Math.min(bounds.width, view.x + view.width); x += 1) {
                var value = cell(x, y);
                out.cells.push({ x: x, y: y, status: value.status, raw: value.raw, index: value.index,
                    edges: { north: value.status === 'in' && cell(x, y - 1).status !== 'in',
                        east: value.status === 'in' && cell(x + 1, y).status !== 'in',
                        south: value.status === 'in' && cell(x, y + 1).status !== 'in',
                        west: value.status === 'in' && cell(x - 1, y).status !== 'in' } });
            }
        }
        var units = snapshot.units || [];
        for (var i = 0; i < units.length; i += 1) {
            var unit = units[i];
            if (!unit || !integer(unit.i) || unit.i < 0 || unit.i >= 20 ||
                !integer(unit.state) || unit.state < 0 || unit.state >= 8 ||
                (unit.side !== 'player' && unit.side !== 'enemy') || !inside(bounds, unit.x, unit.y)) { continue; }
            if (out.kind !== 'move' && cell(unit.x, unit.y).status === 'in' &&
                (out.kind === 'skill' || unit.side === 'enemy')) {
                out.rangedUnits.push({ i: unit.i, x: unit.x, y: unit.y, side: unit.side });
            }
        }
        var focus = snapshot.focus;
        if (focus && integer(focus.x) && integer(focus.y)) {
            var focused = cell(focus.x, focus.y), label, targetIndex = null;
            if (!inside(bounds, focus.x, focus.y)) { label = '超出战场'; }
            else if (focused.status === 'unknown') { label = '范围数据未知'; }
            else if (focused.status !== 'in') { label = out.kind === 'move' ? '不可移动' : (out.kind === 'skill' ? '不在计谋射程内' : '不在射程内'); }
            else if (out.kind === 'move') { label = actor.x === focus.x && actor.y === focus.y ? '可移动 · 原地' : '可移动'; }
            else {
                for (i = 0; i < out.rangedUnits.length; i += 1) {
                    if (out.rangedUnits[i].x === focus.x && out.rangedUnits[i].y === focus.y) { targetIndex = out.rangedUnits[i].i; break; }
                }
                if (targetIndex != null) { label = out.kind === 'skill' ? '射程内目标' : '射程内敌将'; }
                else { label = out.kind === 'skill' ? '计谋射程内 · 空地' : '射程内 · 请选择敌将'; }
            }
            out.focus = { x: focus.x, y: focus.y, status: focused.status, raw: focused.raw, index: focused.index,
                label: label, targetIndex: targetIndex };
        }
        out.active = true;
        return out;
    }
    var COLORS = { move: { wash: 'rgba(74,186,214,0.18)', line: '#69c9e1' },
        attack: { wash: 'rgba(225,151,57,0.18)', line: '#eac16a' },
        skill: { wash: 'rgba(154,126,218,0.20)', line: '#b3a0eb' } };
    function paint(ctx, board, feedback) {
        if (!feedback || !feedback.active || !board || (global.document && global.document.hidden)) { return false; }
        var color = COLORS[feedback.kind];
        if (!color) { return false; }
        ctx.save();
        ctx.setLineDash([]);
        for (var i = 0; i < feedback.cells.length; i += 1) {
            var cell = feedback.cells[i];
            if (cell.status !== 'in') { continue; }
            var x = board.ox + (cell.x - board.viewOx) * board.cw;
            var y = board.oy + (cell.y - board.viewOy) * board.ch;
            ctx.fillStyle = color.wash; ctx.fillRect(x + 1, y + 1, board.cw - 2, board.ch - 2);
            ctx.strokeStyle = color.line; ctx.lineWidth = 2.5; ctx.beginPath();
            if (cell.edges.north) { ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + board.cw - 1, y + 1); }
            if (cell.edges.east) { ctx.moveTo(x + board.cw - 1, y + 1); ctx.lineTo(x + board.cw - 1, y + board.ch - 1); }
            if (cell.edges.south) { ctx.moveTo(x + 1, y + board.ch - 1); ctx.lineTo(x + board.cw - 1, y + board.ch - 1); }
            if (cell.edges.west) { ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1, y + board.ch - 1); }
            ctx.stroke();
        }
        ctx.strokeStyle = color.line; ctx.lineWidth = 3;
        for (i = 0; i < feedback.rangedUnits.length; i += 1) {
            var unit = feedback.rangedUnits[i];
            if (unit.x < board.viewOx || unit.y < board.viewOy || unit.x >= board.viewOx + board.cols || unit.y >= board.viewOy + board.rows) { continue; }
            var inset = Math.min(7, board.cw * 0.14, board.ch * 0.14);
            var ux = board.ox + (unit.x - board.viewOx) * board.cw + inset;
            var uy = board.oy + (unit.y - board.viewOy) * board.ch + inset;
            var w = board.cw - inset * 2, h = board.ch - inset * 2, arm = Math.min(15, w * 0.2, h * 0.2);
            ctx.beginPath();
            ctx.moveTo(ux, uy + arm); ctx.lineTo(ux, uy); ctx.lineTo(ux + arm, uy);
            ctx.moveTo(ux + w - arm, uy); ctx.lineTo(ux + w, uy); ctx.lineTo(ux + w, uy + arm);
            ctx.moveTo(ux, uy + h - arm); ctx.lineTo(ux, uy + h); ctx.lineTo(ux + arm, uy + h);
            ctx.moveTo(ux + w - arm, uy + h); ctx.lineTo(ux + w, uy + h); ctx.lineTo(ux + w, uy + h - arm);
            ctx.stroke();
        }
        var focus = feedback.focus;
        if (focus && inside(feedback.bounds, focus.x, focus.y) && focus.x >= board.viewOx && focus.y >= board.viewOy &&
            focus.x < board.viewOx + board.cols && focus.y < board.viewOy + board.rows) {
            ctx.strokeStyle = focus.status === 'in' ? color.line : '#9b9fac'; ctx.lineWidth = 4;
            ctx.strokeRect(board.ox + (focus.x - board.viewOx) * board.cw + 4,
                board.oy + (focus.y - board.viewOy) * board.ch + 4, board.cw - 8, board.ch - 8);
        }
        // The strip lies above the board and to the right of the mode toolbar.
        var right = board.ox + board.cols * board.cw, left = right - 350;
        ctx.fillStyle = 'rgba(16,22,32,0.94)'; ctx.fillRect(left, 10, 350, 50);
        ctx.fillStyle = color.line; ctx.fillRect(left + 12, 20, 5, 30);
        ctx.textAlign = 'left'; ctx.fillStyle = '#e8edf3'; ctx.font = '600 18px BayeUI, sans-serif';
        var title = feedback.kind === 'move' ? '移动范围 · 可确认位置' :
            (feedback.kind === 'skill' ? '计谋射程 · 范围内将领' : '攻击射程 · 射程内敌将');
        ctx.fillText(title, left + 28, 29, 310);
        ctx.fillStyle = color.line; ctx.font = '16px BayeUI, sans-serif';
        ctx.fillText(focus ? '当前格：' + focus.label : '选择战场位置', left + 28, 49, 310);
        ctx.restore();
        return true;
    }
    global.BayeHdBattleFeedback = { lookupMove: lookupMove, lookupAim: lookupAim, build: build, paint: paint };
})(window);
