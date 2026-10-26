/* Native city-menu rule reference; never authorizes or dispatches an order. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e', BYTES = 207195;
    var MENUS = {
        neizheng: {first:1,names:['开垦','招商','搜寻','治理','出巡','招降','处斩','流放','赏赐','没收','交易','宴请','输送','移动']},
        waijiao: {first:15,names:['离间','招揽','策反','反间','劝降']},
        junbei: {first:23,names:['侦察','征兵','分配','掠夺','出征']}
    };
    var HOOKS = ['cityMakeCommand','willOpenMenu','willChangeMenuSelection','onMenuIdle','willCloseMenu',
        'willAddOrder','willExecuteOrder','willGiveTool','willTakeOffTool'];
    var busy = false, epoch = 0;
    function uint(value,max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function identityKey(value) { return value && JSON.stringify([value.status,value.sha256,value.byteLength,value.generation]); }
    function read(cityIndex,kind) {
        if (busy) { epoch++; return null; }
        busy = true;
        var token = ++epoch;
        try {
            if (kind === undefined) { kind = 'neizheng'; }
            if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(MENUS,kind)) { return null; }
            var definition = MENUS[kind], names = definition.names, total = names.length;
            var b = global.baye, hd = b && b.hd, data = b && b.data, api = global.BayeHdLibIdentity, hex = global.dynLib;
            if (document.hidden || !uint(cityIndex,37) || !hd || !data || !api || typeof hd.ready !== 'function' ||
                typeof hd.menuItems !== 'function' || typeof api.read !== 'function' || typeof api.isCurrent !== 'function' ||
                typeof hex !== 'string' || hex.length !== BYTES*2) { return null; }
            var getMenu = hd.menuItems, getReady = hd.ready, getIdentity = api.read, isCurrent = api.isCurrent,
                cities = data.g_Cities, city = cities && cities[cityIndex], config = data.g_engineConfig, hooks = b.hooks,
                identity = getIdentity.call(api), library = identityKey(identity);
            if (!identity || identity.status !== 'ready' || identity.sha256 !== SHA || identity.byteLength !== BYTES ||
                !uint(identity.generation,0xffffffff) || !identity.generation || !cities || cities.length !== 38 || !city || !config) { return null; }
            function little(offset,size) {
                if (!uint(offset,BYTES-size)) { throw Error('Cost bounds'); }
                var value = 0;
                for (var i=0;i<size;i++) {
                    var byte = hex.slice((offset+i)*2,(offset+i+1)*2);
                    if (!/^[0-9a-f]{2}$/i.test(byte)) { throw Error('Invalid cost byte'); }
                    value += parseInt(byte,16)*Math.pow(256,i);
                }
                return value;
            }
            var base = little(4,4), length = little(base,4), count = little(base+6,2), fixed = little(base+8,4);
            if (little(base+4,2) !== 2 || count <= 10 || length < 14 || base+length > BYTES ||
                (fixed ? 14+count*fixed : 14+count*8) > length) { return null; }
            function span(item) {
                var offset = fixed ? 14+item*fixed : little(base+14+item*8,4), bytes = fixed || little(base+18+item*8,4);
                if (offset < (fixed ? 14 : 14+count*8) || offset+bytes > length) { throw Error('Invalid cost item'); }
                return {offset:base+offset,bytes:bytes};
            }
            var thewTable = span(9), moneyTable = span(10);
            function cost(table,command,width) {
                if ((command+1)*width > table.bytes) { throw Error('Truncated cost table'); }
                return little(table.offset+command*width,width);
            }
            function capture() {
                var menu = getMenu.call(hd), current = getIdentity.call(api), valid = isCurrent.call(api,identity), ready = getReady.call(hd);
                if (ready !== true || valid !== true || identityKey(current) !== library || identityKey(identity) !== library ||
                    !menu || menu.active !== 1 || menu.context !== 1 || menu.kind !== 2 || menu.count !== total ||
                    !uint(menu.seq,0xffffffff) || !menu.seq || !uint(menu.index,total-1) || !uint(menu.generation,0xffffffff) || !menu.generation ||
                    menu.detailGeneration !== menu.generation || !Array.isArray(menu.names) || JSON.stringify(menu.names) !== JSON.stringify(names)) { return null; }
                var hookValues = HOOKS.map(function (name) { return hooks && hooks[name]; });
                if (hookValues.some(function (fn) { return typeof fn === 'function' && Function.prototype.toString.call(fn) !== 'function () { return -1; }'; })) { return null; }
                var king = data.g_PlayerKing, period = data.g_PIdx,
                    flags = [config.enable16bitConsumeMoney,config.fixConsumeMoney,config.fixThewOverFlow];
                if (kind === 'waijiao') { flags.push(config.fixAlienateComsumeThew); }
                if (kind === 'junbei') { flags.push(config.armsPerMoney); }
                if (!uint(king,199) || !uint(period,4) || !period || city.Belong !== king+1 || !flags.every(function (v) { return uint(v,255); }) ||
                    kind === 'junbei' && !flags[3] ||
                    data.g_hdEngineReady !== 1 || data.g_hdDetailGeneration !== menu.generation || data.g_hdMapCity !== cityIndex+1 ||
                    data.g_hdMenuActive !== 1 || data.g_hdMenuContext !== 1 || data.g_hdMenuKind !== 2 || data.g_hdMenuSeq !== menu.seq ||
                    data.g_hdMenuCount !== total || data.g_hdMenuIndex !== menu.index || data.g_hdReportActive !== 0 ||
                    data.g_hdQtyActive !== 0 || data.g_hdHelpActive !== 0 || data.g_hdFightActive !== 0) { return null; }
                var rows = [], width = flags[0] ? 2 : 1;
                for (var index=0;index<total;index++) {
                    var command = index+definition.first, fee = command === 4 ? 0 : command, thew = 0, checkThew = 0, money = 0, variable = '', thewSubject = 'actor';
                    if (command <= 6) { thew = cost(thewTable,fee,1); checkThew = thew; money = command === 6 && !flags[1] ? 0 : cost(moneyTable,fee,width); }
                    if (command === 11 || command === 13) {
                        thew = checkThew = cost(thewTable,command,1); money = null; variable = command === 11 ? 'trade' : 'transfer';
                    }
                    if (command === 12) { money = cost(moneyTable,12,width); }
                    if (command === 14) { checkThew = cost(thewTable,14,1); thew = cost(thewTable,flags[2] ? 14 : 13,1); }
                    if (command >= 15 && command <= 19 && command !== 18 || command === 23) {
                        thew = checkThew = cost(thewTable,command,1); money = cost(moneyTable,command,width);
                        if (command === 15 && !flags[3]) { thewSubject = 'target'; }
                    }
                    if (command === 24) { thew = checkThew = cost(thewTable,24,1); money = null; variable = 'recruit'; }
                    if (command === 26) { thew = checkThew = cost(thewTable,24,1); }
                    if (command === 27) { money = cost(moneyTable,27,width); variable = 'march'; }
                    var checkMoney = command === 24 ? cost(moneyTable,24,width) : money, armsPerMoney = command === 24 ? flags[3] : null;
                    var text = variable === 'trade' ? '规则：体力 ' + thew + ' · 金钱随买卖数量' :
                        variable === 'transfer' ? '规则：体力 ' + thew + ' · 运送物资另计' :
                        checkThew !== thew ? '规则：体力检查 ' + checkThew + ' · 消耗 ' + thew : '规则：体力 ' + thew + ' · 金钱 ' + money;
                    if (thewSubject === 'target') { text = '规则：己将体力检查 ' + checkThew + ' · 敌将体力消耗 ' + thew + ' · 金钱 ' + money; }
                    if (command === 18) { text = '原版暂未实现'; }
                    if (command === 24) { text = '规则：体力 ' + thew + ' · 金钱检查 ' + checkMoney + ' · 每 ' + armsPerMoney + ' 兵 1 钱（余数不计）'; }
                    if (command === 27) { text = '规则：体力 0 · 金钱 ' + money + ' · 携带粮草另计'; }
                    rows.push({index:index,command:command,thew:thew,checkThew:checkThew,money:money,variable:variable,
                        thewSubject:thewSubject,checkMoney:checkMoney,armsPerMoney:armsPerMoney,implemented:command !== 18,text:text});
                }
                var owner = [king,period,city.Belong,menu.seq,menu.index,menu.generation,data.g_hdEngineReady,data.g_hdDetailGeneration,
                    data.g_hdMapCity,data.g_hdMenuActive,data.g_hdMenuContext,data.g_hdMenuKind,data.g_hdMenuSeq,data.g_hdMenuCount,
                    data.g_hdMenuIndex,data.g_hdReportActive,data.g_hdQtyActive,data.g_hdHelpActive,data.g_hdFightActive];
                if (global.baye !== b || b.hd !== hd || b.data !== data || data.g_Cities !== cities || cities.length !== 38 || cities[cityIndex] !== city ||
                    data.g_engineConfig !== config || b.hooks !== hooks || global.dynLib !== hex || hd.menuItems !== getMenu || hd.ready !== getReady ||
                    global.BayeHdLibIdentity !== api || api.read !== getIdentity || api.isCurrent !== isCurrent || document.hidden || token !== epoch) { return null; }
                if (data.g_hdCityInfoActive !== undefined && data.g_hdCityInfoActive !== 0) { return null; }
                return {key:JSON.stringify([kind,library,owner,flags,rows]),refs:hookValues,rows:rows};
            }
            function same(a,b) { return a && b && a.key === b.key && a.refs.every(function (v,i) { return v === b.refs[i]; }); }
            var first = capture(), second = capture(), final = capture();
            return same(first,second) && same(second,final) && token === epoch ? {cityIndex:cityIndex,kind:kind,rows:final.rows} : null;
        } catch (e) { return null; }
        finally { busy = false; }
    }
    global.BayeHdCityRules = {read:read};
})(window);
