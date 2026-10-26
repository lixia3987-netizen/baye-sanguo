/* Current player battle context and native menu settings. Read-only; no input dispatch. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var busy = false, epoch = 0;
    function uint(value, max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function optional(value, max) { return uint(value,max) ? value : null; }
    function identityKey(value) { return value && JSON.stringify([value.status,value.sha256,value.byteLength,value.generation]); }
    function read(settings) {
        if (busy) { epoch++; return null; }
        busy = true;
        var token = ++epoch;
        try {
            var b = global.baye, hd = b && b.hd, data = b && b.data, api = global.BayeHdLibIdentity;
            if (document.hidden || !hd || !data || !api || typeof hd.ready !== 'function' || hd.ready() !== true ||
                typeof hd.fight !== 'function' || settings && typeof hd.menuItems !== 'function' ||
                typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return null; }
            var getFight = hd.fight, getMenu = settings ? hd.menuItems : null,
                getReady = hd.ready, getIdentity = api.read, isCurrent = api.isCurrent, param = data.g_FgtParam, hooks = b.hooks;
            var identity = getIdentity.call(api), library = identityKey(identity);
            if (!identity || identity.status !== 'ready' || identity.sha256 !== SHA || identity.byteLength !== 207195 ||
                !uint(identity.generation,0xffffffff) || !identity.generation || !param) { return null; }
            function capture() {
                // Read external observers before sealing native owner and status fields.
                var f = getFight.call(hd), menu = settings ? getMenu.call(hd) : null,
                    now = getIdentity.call(api), current = isCurrent.call(api,identity), ready = getReady.call(hd);
                if (!f || ready !== true || current !== true || identityKey(now) !== library || identityKey(identity) !== library ||
                    !settings && hooks && typeof hooks.didShowFightStateBar === 'function') { return null; }
                var owner = [f.active,f.over,f.inputKind,f.inputSeq,f.actorIndex,f.cityIndex];
                if (owner[0] !== 1 || owner[1] !== 0 || !uint(owner[2],10) || !uint(owner[3],0xffffffff) || !owner[3] ||
                    !uint(owner[4],255) || owner[4] > 19 && owner[4] !== 255 || !uint(owner[5],37) ||
                    data.g_hdEngineReady !== 1 || !uint(data.g_hdDetailGeneration,0xffffffff) || !data.g_hdDetailGeneration ||
                    !uint(data.g_PIdx,4) || !data.g_PIdx || data.g_FgtOver !== 0 ||
                    data.g_hdFightActive !== owner[0] || data.g_hdFightOver !== owner[1] ||
                    data.g_hdFightInputKind !== owner[2] || data.g_hdFightInputSeq !== owner[3] || data.g_hdFightActor !== owner[4] ||
                    param.CityIndex !== owner[5] || (param.Mode !== 0 && param.Mode !== 1) ||
                    data.g_hdReportActive !== 0 || data.g_hdHelpActive !== 0 || data.g_hdViewActive !== 0) { return null; }
                var value;
                if (settings) {
                    var names = menu && Array.isArray(menu.names) ? menu.names.slice() : null, namesKey = JSON.stringify(names);
                    if ((owner[2] !== 6 && owner[2] !== 8) || f.wait !== 0 || f.phase !== 0 ||
                        data.g_hdFightWait !== 0 || data.g_hdFightPhase !== 0 || !menu || menu.active !== 1 ||
                        menu.context !== 3 || menu.kind !== owner[2] || !uint(menu.seq,0xffffffff) || !menu.seq ||
                        !uint(menu.index,menu.count-1) || menu.count !== (owner[2] === 6 ? 5 : 2) ||
                        menu.generation !== data.g_hdDetailGeneration || menu.detailGeneration !== menu.generation ||
                        (owner[2] === 6 ? namesKey !== '["回合结束","全军撤退","战斗动画","移动速度","敌军移动"]' :
                            namesKey !== '["不看","观看"]' && namesKey !== '["快速","慢速"]') ||
                        data.g_hdMenuActive !== 1 || data.g_hdMenuContext !== 3 || data.g_hdMenuKind !== owner[2] ||
                        data.g_hdMenuSeq !== menu.seq || data.g_hdMenuIndex !== menu.index || data.g_hdMenuCount !== menu.count) { return null; }
                    value = {movie:optional(data.g_LookMovie,1),moveSpeed:optional(data.g_MoveSpeed,1),enemy:optional(data.g_LookEnemy,1),
                        actor:owner[4],kind:owner[2],inputSeq:owner[3],menuSeq:menu.seq,index:menu.index,names:names};
                } else {
                    var weather = optional(data.g_FgtWeather,5);
                    if (weather === 0) { weather = null; }
                    value = {weather:weather,food:optional(param.MProvender,65535),
                        day:optional(data.g_FgtBoutCnt,65535),limit:optional(data.g_FgtBoutMax,65535)};
                }
                var seal = [data.g_hdEngineReady,data.g_hdDetailGeneration,data.g_PIdx,data.g_FgtOver,
                    data.g_hdFightActive,data.g_hdFightOver,data.g_hdFightInputKind,data.g_hdFightInputSeq,data.g_hdFightActor,
                    data.g_hdReportActive,data.g_hdHelpActive,data.g_hdViewActive,param.CityIndex,param.Mode];
                if (global.baye !== b || b.hd !== hd || b.data !== data || data.g_FgtParam !== param || b.hooks !== hooks ||
                    global.BayeHdLibIdentity !== api || hd.fight !== getFight || settings && hd.menuItems !== getMenu ||
                    hd.ready !== getReady || api.read !== getIdentity || api.isCurrent !== isCurrent ||
                    document.hidden || epoch !== token) { return null; }
                return {value:value,key:JSON.stringify([library,owner,seal,value,settings ? [data.g_hdFightWait,data.g_hdFightPhase] : null])};
            }
            var first = capture(), second = capture(), final = capture();
            return first && second && final && first.key === second.key && second.key === final.key && token === epoch ? final.value : null;
        } catch (e) { return null; }
        finally { busy = false; }
    }
    global.BayeHdBattleStatus = {read:function () { return read(false); },readSettings:function () { return read(true); }};
})(window);
