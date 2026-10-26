/* Original found city goods. Hidden slots never reach the public inventory. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var busy = false, epoch = 0;
    function uint(value,max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function identityKey(value) { return value && JSON.stringify([value.status,value.sha256,value.byteLength,value.generation]); }
    function read(cityIndex) {
        if (busy) { epoch++; return null; }
        busy = true;
        var token = ++epoch;
        try {
            var b = global.baye, hd = b && b.hd, data = b && b.data, api = global.BayeHdLibIdentity;
            if (document.hidden || !uint(cityIndex,37) || !hd || !data || !api || typeof hd.ready !== 'function' ||
                typeof hd.menuItems !== 'function' || typeof b.getToolCount !== 'function' || typeof b.getToolName !== 'function' ||
                typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return null; }
            var getMenu = hd.menuItems, getReady = hd.ready, getCount = b.getToolCount, getName = b.getToolName,
                getIdentity = api.read, isCurrent = api.isCurrent, hooks = b.hooks, cities = data.g_Cities, queue = data.g_GoodsQueue,
                city = cities && cities[cityIndex], identity = getIdentity.call(api), library = identityKey(identity);
            if (!identity || identity.status !== 'ready' || identity.sha256 !== SHA || identity.byteLength !== 207195 ||
                !uint(identity.generation,0xffffffff) || !identity.generation || !cities || cities.length !== 38 || !city ||
                !queue || queue.length !== 2000) { return null; }
            function capture() {
                var menu = getMenu.call(hd), count = getCount.call(b), current = getIdentity.call(api),
                    valid = isCurrent.call(api,identity), ready = getReady.call(hd);
                if (ready !== true || count !== 33 || valid !== true || identityKey(current) !== library || identityKey(identity) !== library ||
                    !menu || menu.active !== 1 || menu.context !== 1 || menu.kind !== 1 || menu.count !== 4 ||
                    !uint(menu.seq,0xffffffff) || !menu.seq || !uint(menu.index,3) ||
                    !uint(menu.generation,0xffffffff) || !menu.generation || menu.detailGeneration !== menu.generation ||
                    !Array.isArray(menu.names) || JSON.stringify(menu.names) !== '["内政","外交","军备","状况"]') { return null; }
                var king = data.g_PlayerKing, period = data.g_PIdx;
                if (!uint(king,199) || !uint(period,4) || !period || city.Belong !== king+1 ||
                    data.g_hdEngineReady !== 1 || data.g_hdDetailGeneration !== menu.generation || data.g_hdMapCity !== cityIndex+1 ||
                    data.g_hdMenuActive !== 1 || data.g_hdMenuContext !== 1 || data.g_hdMenuKind !== 1 ||
                    data.g_hdMenuSeq !== menu.seq || data.g_hdMenuCount !== 4 || data.g_hdMenuIndex !== menu.index ||
                    data.g_hdReportActive !== 0 || data.g_hdQtyActive !== 0 || data.g_hdHelpActive !== 0 || data.g_hdFightActive !== 0) { return null; }
                var start = city.ToolQueue, length = city.Tools;
                if (!uint(start,2000) || !uint(length,2000) || start+length > 2000) { return null; }
                var raw = [], rows = [], positions = {}, total = 0;
                for (var i=0;i<length;i++) {
                    var packed = queue[start+i];
                    if (!uint(packed,65535)) { return null; }
                    raw.push(packed);
                    if (!(packed & 0x8000)) { continue; }
                    var id = packed & 0x7fff;
                    if (id >= 33) { return null; }
                    if (!Object.prototype.hasOwnProperty.call(positions,id)) {
                        positions[id] = rows.length; rows.push({id:id,count:0});
                    }
                    rows[positions[id]].count++; total++;
                }
                var owner = [king,period,city.Belong,start,length,menu.seq,menu.index,menu.generation,
                    data.g_hdEngineReady,data.g_hdDetailGeneration,data.g_hdMapCity,data.g_hdMenuActive,data.g_hdMenuContext,
                    data.g_hdMenuKind,data.g_hdMenuSeq,data.g_hdMenuCount,data.g_hdMenuIndex,
                    data.g_hdReportActive,data.g_hdQtyActive,data.g_hdHelpActive,data.g_hdFightActive];
                if (global.baye !== b || b.hd !== hd || b.data !== data || data.g_Cities !== cities || cities[cityIndex] !== city ||
                    data.g_GoodsQueue !== queue || cities.length !== 38 || queue.length !== 2000 ||
                    hd.menuItems !== getMenu || hd.ready !== getReady || b.getToolCount !== getCount || b.getToolName !== getName || b.hooks !== hooks ||
                    global.BayeHdLibIdentity !== api || api.read !== getIdentity || api.isCurrent !== isCurrent || document.hidden || token !== epoch) { return null; }
                return {key:JSON.stringify([library,owner,raw]),total:total,rows:rows};
            }
            function present(snapshot) {
                return snapshot.rows.map(function (row) {
                    var name = getName.call(b,row.id);
                    if (typeof name !== 'string' || !name.trim() || name === '-') { throw Error('Missing inventory name'); }
                    return {id:row.id,name:name,count:row.count};
                });
            }
            var first = capture(); if (!first) { return null; }
            var rows = present(first), second = capture();
            if (!second || first.key !== second.key) { return null; }
            var again = present(second), final = capture();
            if (!final || second.key !== final.key || JSON.stringify(rows) !== JSON.stringify(again) || token !== epoch) { return null; }
            return {cityIndex:cityIndex,total:first.total,rows:rows};
        } catch (e) { return null; }
        finally { busy = false; }
    }
    global.BayeHdCityInventory = {read:read};
})(window);
