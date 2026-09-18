/**
 * 只读探测：枚举 baye.data 里和年月 / 光标 / 城坐标相关的键。
 * 不改 WASM。结果打到控制台，并交给 HD 壳做标定。
 */
(function (global) {
    function listProps(obj) {
        if (!obj) {
            return [];
        }
        if (obj._baye_properties && obj._baye_properties.length) {
            return obj._baye_properties.slice();
        }
        var keys = [];
        for (var k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k) && k.charAt(0) !== '_') {
                keys.push(k);
            }
        }
        return keys;
    }

    function unwrap(value) {
        if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value && typeof value.value !== 'object') {
            return value.value;
        }
        return value;
    }

    function readNumber(obj, name) {
        if (!obj || obj[name] === undefined || obj[name] === null) {
            return null;
        }
        var v = unwrap(obj[name]);
        v = Number(v);
        return isFinite(v) ? v : null;
    }

    function findFields(data, re) {
        return listProps(data).filter(function (name) {
            return re.test(name);
        });
    }

    function snapshotPositions(data) {
        var raw = data && data.g_CityPositions;
        var cities = data && data.g_Cities;
        var n = cities && cities.length ? cities.length : (raw && raw.length ? raw.length : 0);
        var rows = [];
        var minX = Infinity;
        var maxX = -Infinity;
        var minY = Infinity;
        var maxY = -Infinity;
        for (var i = 0; i < n; i++) {
            var pos = raw && raw[i];
            var x = pos ? readNumber(pos, 'x') : null;
            var y = pos ? readNumber(pos, 'y') : null;
            var name = null;
            try {
                if (window.baye && typeof baye.getCityName === 'function') {
                    name = baye.getCityName(i);
                }
            } catch (e) {}
            rows.push({ i: i, name: name, x: x, y: y });
            if (x !== null && y !== null) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
        return {
            count: n,
            minX: minX === Infinity ? null : minX,
            maxX: maxX === -Infinity ? null : maxX,
            minY: minY === Infinity ? null : minY,
            maxY: maxY === -Infinity ? null : maxY,
            rows: rows
        };
    }

    function pickFirstNumber(data, names) {
        for (var i = 0; i < names.length; i++) {
            var v = readNumber(data, names[i]);
            if (v !== null) {
                return { name: names[i], value: v };
            }
        }
        return null;
    }

    function run() {
        var data = window.baye && baye.data;
        if (!data) {
            console.log('[hd-overworld-probe] baye.data 尚未就绪');
            return null;
        }
        var report = {
            fields: listProps(data),
            dateLike: findFields(data, /year|month|date|pidx|time/i),
            cityLike: findFields(data, /city|cursor|focus|foucs|map|crt/i),
            year: pickFirstNumber(data, ['g_YearN', 'g_Year', 'YearN', 'g_DateYear', 'year']),
            month: pickFirstNumber(data, ['g_MonthN', 'g_Month', 'MonthN', 'g_DateMonth', 'month']),
            cursorCity: pickFirstNumber(data, [
                'g_CityCrt', 'g_CityCur', 'g_CurCity', 'g_CityIndex',
                'g_CrtCity', 'g_iCity', 'g_currentCity', 'g_CityId'
            ]),
            focus: {
                x: pickFirstNumber(data, ['g_FoucsX', 'g_FocusX', 'g_MapFocusX']),
                y: pickFirstNumber(data, ['g_FoucsY', 'g_FocusY', 'g_MapFocusY'])
            },
            mapScroll: {
                x: pickFirstNumber(data, ['g_MapSX', 'g_LandMapSX', 'g_CityMapSX']),
                y: pickFirstNumber(data, ['g_MapSY', 'g_LandMapSY', 'g_CityMapSY'])
            },
            playerKing: readNumber(data, 'g_PlayerKing'),
            period: readNumber(data, 'g_PIdx'),
            positions: snapshotPositions(data)
        };
        console.log('[hd-overworld-probe]', report);
        if (report.positions && report.positions.rows) {
            console.table(report.positions.rows);
        }
        return report;
    }

    global.BayeHdOverworldProbe = {
        run: run,
        listProps: listProps,
        findFields: findFields,
        readNumber: readNumber,
        pickFirstNumber: pickFirstNumber
    };
})(window);
