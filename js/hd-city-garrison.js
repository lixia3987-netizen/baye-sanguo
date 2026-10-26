/* Original current-city active roster; never reads hidden residents' details. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e', busy = false, epoch = 0;
    function uint(value,max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function optional(value,max) { return uint(value,max) ? value : null; }
    function identityKey(value) { return value && JSON.stringify([value.status,value.sha256,value.byteLength,value.generation]); }
    function read(cityIndex) {
        if (busy) { epoch++; return null; }
        busy = true;
        var token = ++epoch;
        try {
            var b = global.baye, hd = b && b.hd, data = b && b.data, api = global.BayeHdLibIdentity;
            if (document.hidden || !uint(cityIndex,37) || !hd || !data || !api || typeof hd.ready !== 'function' ||
                typeof hd.menuItems !== 'function' || typeof b.getPersonCount !== 'function' || typeof b.getPersonName !== 'function' ||
                typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return null; }
            var getMenu = hd.menuItems, getReady = hd.ready, getCount = b.getPersonCount, getName = b.getPersonName,
                getIdentity = api.read, isCurrent = api.isCurrent, cities = data.g_Cities, people = data.g_Persons,
                queue = data.g_PersonsQueue, city = cities && cities[cityIndex], hooks = b.hooks,
                lib = global.dynLib, identity = getIdentity.call(api), library = identityKey(identity);
            if (!identity || identity.status !== 'ready' || identity.sha256 !== SHA || identity.byteLength !== 207195 ||
                !uint(identity.generation,0xffffffff) || !identity.generation || !cities || cities.length !== 38 || !city ||
                !people || people.length !== 2000 || !queue || queue.length !== 2000 || typeof lib !== 'string' || lib.length !== 414390) { return null; }
            function capture() {
                var menu = getMenu.call(hd), count = getCount.call(b), current = getIdentity.call(api),
                    valid = isCurrent.call(api,identity), ready = getReady.call(hd), nameHook = hooks && hooks.getPersonName;
                if (ready !== true || count !== 200 || valid !== true || identityKey(current) !== library || identityKey(identity) !== library ||
                    typeof nameHook === 'function' || !menu || menu.active !== 1 || menu.context !== 1 || menu.kind !== 1 || menu.count !== 4 ||
                    !uint(menu.seq,0xffffffff) || !menu.seq || !uint(menu.index,3) || !uint(menu.generation,0xffffffff) || !menu.generation ||
                    menu.detailGeneration !== menu.generation || !Array.isArray(menu.names) || JSON.stringify(menu.names) !== '["内政","外交","军备","状况"]') { return null; }
                var king = data.g_PlayerKing, period = data.g_PIdx, start = city.PersonQueue, length = city.Persons;
                if (!uint(king,199) || !uint(period,4) || !period || city.Belong !== king+1 ||
                    !uint(start,2000) || !uint(length,2000) || start+length > 2000 ||
                    data.g_hdEngineReady !== 1 || data.g_hdDetailGeneration !== menu.generation || data.g_hdMapCity !== cityIndex+1 ||
                    data.g_hdMenuActive !== 1 || data.g_hdMenuContext !== 1 || data.g_hdMenuKind !== 1 ||
                    data.g_hdMenuSeq !== menu.seq || data.g_hdMenuCount !== 4 || data.g_hdMenuIndex !== menu.index ||
                    data.g_hdReportActive !== 0 || data.g_hdQtyActive !== 0 || data.g_hdHelpActive !== 0 || data.g_hdFightActive !== 0) { return null; }
                var raw = [], rows = [], refs = [];
                for (var i=0;i<length;i++) {
                    var slot = start+i, id = queue[slot], person = uint(id,199) && people[id];
                    if (!person || !uint(person.Belong,65535)) { return null; }
                    var belong = person.Belong; raw.push([slot,id,belong]); refs.push(person);
                    if (belong !== king+1) { continue; }
                    rows.push({id:id,queueSlot:slot,arms:optional(person.Arms,65535),thew:optional(person.Thew,255)});
                }
                var owner = [king,period,city.Belong,start,length,menu.seq,menu.index,menu.generation,
                    data.g_hdEngineReady,data.g_hdDetailGeneration,data.g_hdMapCity,data.g_hdMenuActive,data.g_hdMenuContext,
                    data.g_hdMenuKind,data.g_hdMenuSeq,data.g_hdMenuCount,data.g_hdMenuIndex,
                    data.g_hdReportActive,data.g_hdQtyActive,data.g_hdHelpActive,data.g_hdFightActive];
                if (global.baye !== b || b.hd !== hd || b.data !== data || global.dynLib !== lib || data.g_Cities !== cities || cities[cityIndex] !== city ||
                    data.g_Persons !== people || data.g_PersonsQueue !== queue || cities.length !== 38 || people.length !== 2000 || queue.length !== 2000 ||
                    hd.menuItems !== getMenu || hd.ready !== getReady || b.getPersonCount !== getCount || b.getPersonName !== getName ||
                    b.hooks !== hooks || hooks && hooks.getPersonName !== nameHook || global.BayeHdLibIdentity !== api ||
                    api.read !== getIdentity || api.isCurrent !== isCurrent || document.hidden || token !== epoch) { return null; }
                return {key:JSON.stringify([library,owner,raw,rows]),rows:rows,refs:refs};
            }
            function present(snapshot) {
                return snapshot.rows.map(function (row) {
                    var name = getName.call(b,row.id);
                    if (typeof name !== 'string' || !name.trim() || name === '-') { throw Error('Missing garrison name'); }
                    return {id:row.id,queueSlot:row.queueSlot,name:name,arms:row.arms,thew:row.thew};
                });
            }
            function same(a,b) { return a && b && a.key === b.key && a.refs.length === b.refs.length && a.refs.every(function (v,i) { return v === b.refs[i]; }); }
            var first = capture(); if (!first) { return null; }
            var rows = present(first), second = capture(); if (!same(first,second)) { return null; }
            var again = present(second), final = capture();
            if (!same(second,final) || JSON.stringify(rows) !== JSON.stringify(again) || token !== epoch) { return null; }
            return {cityIndex:cityIndex,rows:rows};
        } catch (e) { return null; }
        finally { busy = false; }
    }
    global.BayeHdCityGarrison = {read:read};
})(window);
