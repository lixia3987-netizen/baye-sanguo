/* Read-only current-city arrangements. Queue membership is not a promise of future effects. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var LABELS = {0:'归队',1:'开垦',2:'招商',3:'搜寻',4:'治理',5:'出巡',6:'招降',11:'交易',
        13:'输送',14:'移动',15:'离间',16:'招揽',17:'策反',19:'劝降',23:'侦察',24:'征兵',26:'掠夺',27:'出征'};
    var busy = false, epoch = 0;
    function uint(value, max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function libraryKey(value) { return value && JSON.stringify([value.status,value.sha256,value.byteLength,value.generation]); }
    function read(cityIndex) {
        if (busy) { epoch++; return null; }
        busy = true;
        var token = ++epoch;
        try {
            var b = global.baye, hd = b && b.hd, api = global.BayeHdLibIdentity, data = b && b.data;
            if (document.hidden || !uint(cityIndex,37) || !hd || !data || !api ||
                typeof hd.ready !== 'function' || hd.ready() !== true || typeof hd.menuItems !== 'function' ||
                typeof b.getPersonCount !== 'function' || typeof b.getPersonName !== 'function' ||
                typeof b.getCityName !== 'function' || typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return null; }
            var cities = data.g_Cities, people = data.g_Persons, queue = data.g_OrderQueue, hooks = b.hooks;
            var city = cities && cities[cityIndex], getMenu = hd.menuItems, getCount = b.getPersonCount,
                getName = b.getPersonName, getCity = b.getCityName, getLibrary = api.read, isCurrent = api.isCurrent;
            var initial = getLibrary.call(api), identityKey = libraryKey(initial);
            if (!initial || initial.status !== 'ready' || initial.sha256 !== SHA || initial.byteLength !== 207195 ||
                !uint(initial.generation,0xffffffff) || !initial.generation || !cities || cities.length !== 38 || !city ||
                !people || people.length !== 2000 || !queue || queue.length !== 200) { return null; }
            function capture() {
                // All external callbacks precede the raw snapshot and its final reference seal.
                var menu = getMenu.call(hd), count = getCount.call(b), current = getLibrary.call(api), currentIdentity = isCurrent.call(api,initial);
                if (count !== 200 || currentIdentity !== true || libraryKey(current) !== identityKey || libraryKey(initial) !== identityKey ||
                    !menu || menu.active !== 1 || menu.context !== 1 || menu.kind !== 1 || menu.count !== 4 ||
                    !uint(menu.seq,0xffffffff) || !menu.seq || !uint(menu.index,3) ||
                    !uint(menu.generation,0xffffffff) || !menu.generation || menu.detailGeneration !== menu.generation ||
                    !Array.isArray(menu.names) || JSON.stringify(menu.names) !== '["内政","外交","军备","状况"]') { return null; }
                if (hooks && ['willAddOrder','willExecuteOrder','getPersonName','getCityName'].some(function (key) {
                    return typeof hooks[key] === 'function';
                })) { return null; }
                var king = data.g_PlayerKing, year = data.g_YearDate, month = data.g_MonthDate;
                if (!uint(king,199) || !uint(data.g_PIdx,4) || data.g_PIdx < 1 || !uint(year,65535) || year < 1 ||
                    !uint(month,12) || month < 1 || city.Belong !== king + 1 || data.g_hdEngineReady !== 1 ||
                    data.g_hdDetailGeneration !== menu.generation || data.g_hdMapCity !== cityIndex + 1 ||
                    data.g_hdMenuActive !== 1 || data.g_hdMenuContext !== 1 || data.g_hdMenuKind !== 1 ||
                    data.g_hdMenuSeq !== menu.seq || data.g_hdMenuCount !== 4 || data.g_hdMenuIndex !== menu.index ||
                    data.g_hdReportActive !== 0 || data.g_hdQtyActive !== 0 || data.g_hdHelpActive !== 0 || data.g_hdFightActive !== 0) { return null; }
                var raw = [], refs = [cities,city,people,queue], rows = [], personValues = [], armies = null, flags = null, armyUses = {};
                function actor(id) {
                    if (!uint(id,199) || !people[id] || !uint(people[id].Belong,65535)) { throw Error('Invalid order actor'); }
                    var person = people[id], belong = person.Belong;
                    refs.push(person); personValues.push([id,belong]);
                    return belong === king + 1;
                }
                // Empty slots have no meaningful payload; other fields may be uninitialized.
                for (var i = 0; i < 200; i++) {
                    var entry = queue[i], id = entry && entry.OrderId;
                    refs.push(entry);
                    if (!uint(id,255)) { return null; }
                    if (id === 255) { raw.push([255]); continue; }
                    var origin = entry.City, personId = entry.Person;
                    if (!uint(origin,255) || !uint(personId,65535)) { return null; }
                    raw.push([id,origin,personId]);
                    if (id === 27) { armyUses[personId] = (armyUses[personId] || 0) + 1; }
                }
                for (var slot = 0; slot < 200; slot++) {
                    var values = raw[slot];
                    if (values[0] === 255 || values[1] !== cityIndex) { continue; }
                    var command = values[0], executor = values[2], actors = [];
                    if (!Object.prototype.hasOwnProperty.call(LABELS,command)) { return null; }
                    if (command === 27) {
                        if (!uint(executor,29) || armyUses[executor] !== 1) { return null; }
                        if (!armies) {
                            var bytes = data.FIGHTERS, indices = data.FIGHTERS_IDX;
                            if (!bytes || bytes.length !== 600 || !indices || indices.length !== 30) { return null; }
                            refs.push(bytes,indices); armies = []; flags = [];
                            for (var a = 0; a < 600; a++) { if (!uint(bytes[a],255)) { return null; } armies.push(bytes[a]); }
                            for (var f = 0; f < 30; f++) { if (!uint(indices[f],255)) { return null; } flags.push(indices[f]); }
                        }
                        if (flags[executor] !== 1 || !(armies[executor*20] + armies[executor*20+1]*256)) { return null; }
                        var mine = true;
                        for (var member = 0; member < 10; member++) {
                            var offset = executor*20 + member*2, oneBased = armies[offset] + armies[offset+1]*256;
                            if (!oneBased) { continue; }
                            if (!uint(oneBased,200)) { return null; }
                            if (!actor(oneBased-1)) { mine = false; }
                            actors.push(oneBased-1);
                        }
                        if (!mine) { continue; }
                    } else {
                        if (!actor(executor)) { continue; }
                        actors.push(executor);
                    }
                    var destination = null, targetPerson = null, cargo = null;
                    if ([13,14,23,27].indexOf(command) >= 0) {
                        destination = queue[slot].Object;
                        if (!uint(destination,37) || !cities[destination]) { return null; }
                        values.push(destination); refs.push(cities[destination]);
                    }
                    if ([6,15,16,17,19].indexOf(command) >= 0) {
                        targetPerson = queue[slot].Object;
                        if (!uint(targetPerson,199) || !people[targetPerson]) { return null; }
                        // Object retains the selected person even if their allegiance later changes.
                        values.push(targetPerson); refs.push(people[targetPerson]);
                    }
                    // Other commands can leave these payloads uninitialized.
                    // Read cargo only after the local allied-actor filter.
                    if (command === 13) {
                        var food = queue[slot].Food, money = queue[slot].Money, arms = queue[slot].Arms;
                        if (!uint(food,65535) || !uint(money,65535) || !uint(arms,65535)) { return null; }
                        cargo = [food,money,arms]; values.push(food,money,arms);
                    }
                    rows.push({slot:slot,command:command,actors:actors,destination:destination,targetPerson:targetPerson,cargo:cargo});
                }
                var seal = [data.g_hdEngineReady,data.g_hdDetailGeneration,data.g_hdMapCity,data.g_hdMenuActive,
                    data.g_hdMenuContext,data.g_hdMenuKind,data.g_hdMenuSeq,data.g_hdMenuCount,data.g_hdMenuIndex,
                    data.g_hdReportActive,data.g_hdQtyActive,data.g_hdHelpActive,data.g_hdFightActive,
                    data.g_PlayerKing,data.g_PIdx,data.g_YearDate,data.g_MonthDate,city.Belong];
                if (global.baye !== b || b.hd !== hd || b.data !== data || global.BayeHdLibIdentity !== api ||
                    data.g_Cities !== cities || cities[cityIndex] !== city || data.g_Persons !== people || data.g_OrderQueue !== queue ||
                    cities.length !== 38 || people.length !== 2000 || queue.length !== 200 ||
                    hd.menuItems !== getMenu || b.getPersonCount !== getCount || b.getPersonName !== getName || b.getCityName !== getCity ||
                    api.read !== getLibrary || api.isCurrent !== isCurrent || b.hooks !== hooks || document.hidden || epoch !== token) { return null; }
                if (data.g_hdCityInfoActive !== undefined && data.g_hdCityInfoActive !== 0) { return null; }
                return {rows:rows,refs:refs,year:year,month:month,
                    key:JSON.stringify([identityKey,menu.seq,menu.index,menu.generation,seal,raw,personValues,armies,flags])};
            }
            function present(snapshot) {
                return snapshot.rows.map(function (row) {
                    var names = row.actors.map(function (id) { var name = getName.call(b,id);
                        if (typeof name !== 'string' || !name.trim() || name === '-') { throw Error('Missing actor name'); } return name; });
                    var text = names.join('、');
                    if (row.destination !== null) { var destinationName = getCity.call(b,row.destination);
                        if (typeof destinationName !== 'string' || !destinationName.trim() || destinationName === '-') { throw Error('Missing destination'); }
                        text += ' → ' + destinationName; }
                    if (row.targetPerson !== null) { var targetName = getName.call(b,row.targetPerson);
                        if (typeof targetName !== 'string' || !targetName.trim() || targetName === '-') { throw Error('Missing target name'); }
                        text += ' → ' + targetName; }
                    if (row.cargo !== null) { text += ' · 粮食 ' + row.cargo[0] + ' · 金钱 ' + row.cargo[1] + ' · 预备兵 ' + row.cargo[2]; }
                    return {slot:row.slot,command:row.command,label:LABELS[row.command],text:text,targetPerson:row.targetPerson};
                });
            }
            function same(a,b) { return a && b && a.key === b.key && a.refs.length === b.refs.length && a.refs.every(function (v,i) { return v === b.refs[i]; }); }
            var first = capture(); if (!first) { return null; }
            var rows = present(first), second = capture(); if (!same(first,second)) { return null; }
            var again = present(second), final = capture();
            if (!same(second,final) || JSON.stringify(rows) !== JSON.stringify(again) || token !== epoch) { return null; }
            return {cityIndex:cityIndex,year:first.year,month:first.month,rows:rows};
        } catch (e) { return null; }
        finally { busy = false; }
    }
    global.BayeHdCityPlans = {read:read};
})(window);
