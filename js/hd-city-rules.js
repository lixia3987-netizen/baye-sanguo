/* Native interior-menu rule reference; never authorizes or dispatches an order. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e', BYTES = 207195;
    var NAMES = ['开垦','招商','搜寻','治理','出巡','招降','处斩','流放','赏赐','没收','交易','宴请','输送','移动'];
    var HOOKS = ['cityMakeCommand','willOpenMenu','willChangeMenuSelection','onMenuIdle','willCloseMenu',
        'willAddOrder','willExecuteOrder','willGiveTool','willTakeOffTool'];
    var busy = false, epoch = 0;
    function uint(value,max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function identityKey(value) { return value && JSON.stringify([value.status,value.sha256,value.byteLength,value.generation]); }
    function read(cityIndex) {
        if (busy) { epoch++; return null; }
        busy = true;
        var token = ++epoch;
        try {
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
                    !menu || menu.active !== 1 || menu.context !== 1 || menu.kind !== 2 || menu.count !== 14 ||
                    !uint(menu.seq,0xffffffff) || !menu.seq || !uint(menu.index,13) || !uint(menu.generation,0xffffffff) || !menu.generation ||
                    menu.detailGeneration !== menu.generation || !Array.isArray(menu.names) || JSON.stringify(menu.names) !== JSON.stringify(NAMES)) { return null; }
                var hookValues = HOOKS.map(function (name) { return hooks && hooks[name]; });
                if (hookValues.some(function (fn) { return typeof fn === 'function' && Function.prototype.toString.call(fn) !== 'function () { return -1; }'; })) { return null; }
                var king = data.g_PlayerKing, period = data.g_PIdx,
                    flags = [config.enable16bitConsumeMoney,config.fixConsumeMoney,config.fixThewOverFlow];
                if (!uint(king,199) || !uint(period,4) || !period || city.Belong !== king+1 || !flags.every(function (v) { return uint(v,255); }) ||
                    data.g_hdEngineReady !== 1 || data.g_hdDetailGeneration !== menu.generation || data.g_hdMapCity !== cityIndex+1 ||
                    data.g_hdMenuActive !== 1 || data.g_hdMenuContext !== 1 || data.g_hdMenuKind !== 2 || data.g_hdMenuSeq !== menu.seq ||
                    data.g_hdMenuCount !== 14 || data.g_hdMenuIndex !== menu.index || data.g_hdReportActive !== 0 ||
                    data.g_hdQtyActive !== 0 || data.g_hdHelpActive !== 0 || data.g_hdFightActive !== 0) { return null; }
                var rows = [], width = flags[0] ? 2 : 1;
                for (var index=0;index<14;index++) {
                    var command = index+1, fee = command === 4 ? 0 : command, thew = 0, checkThew = 0, money = 0, variable = '';
                    if (command <= 6) { thew = cost(thewTable,fee,1); checkThew = thew; money = command === 6 && !flags[1] ? 0 : cost(moneyTable,fee,width); }
                    if (command === 11 || command === 13) {
                        thew = checkThew = cost(thewTable,command,1); money = null; variable = command === 11 ? 'trade' : 'transfer';
                    }
                    if (command === 12) { money = cost(moneyTable,12,width); }
                    if (command === 14) { checkThew = cost(thewTable,14,1); thew = cost(thewTable,flags[2] ? 14 : 13,1); }
                    var text = variable === 'trade' ? '规则：体力 ' + thew + ' · 金钱随买卖数量' :
                        variable === 'transfer' ? '规则：体力 ' + thew + ' · 运送物资另计' :
                        checkThew !== thew ? '规则：体力检查 ' + checkThew + ' · 消耗 ' + thew : '规则：体力 ' + thew + ' · 金钱 ' + money;
                    rows.push({index:index,command:command,thew:thew,checkThew:checkThew,money:money,variable:variable,text:text});
                }
                var owner = [king,period,city.Belong,menu.seq,menu.index,menu.generation,data.g_hdEngineReady,data.g_hdDetailGeneration,
                    data.g_hdMapCity,data.g_hdMenuActive,data.g_hdMenuContext,data.g_hdMenuKind,data.g_hdMenuSeq,data.g_hdMenuCount,
                    data.g_hdMenuIndex,data.g_hdReportActive,data.g_hdQtyActive,data.g_hdHelpActive,data.g_hdFightActive];
                if (global.baye !== b || b.hd !== hd || b.data !== data || data.g_Cities !== cities || cities.length !== 38 || cities[cityIndex] !== city ||
                    data.g_engineConfig !== config || b.hooks !== hooks || global.dynLib !== hex || hd.menuItems !== getMenu || hd.ready !== getReady ||
                    global.BayeHdLibIdentity !== api || api.read !== getIdentity || api.isCurrent !== isCurrent || document.hidden || token !== epoch) { return null; }
                return {key:JSON.stringify([library,owner,flags,rows]),refs:hookValues,rows:rows};
            }
            function same(a,b) { return a && b && a.key === b.key && a.refs.every(function (v,i) { return v === b.refs[i]; }); }
            var first = capture(), second = capture(), final = capture();
            return same(first,second) && same(second,final) && token === epoch ? {cityIndex:cityIndex,rows:final.rows} : null;
        } catch (e) { return null; }
        finally { busy = false; }
    }
    global.BayeHdCityRules = {read:read};
})(window);
