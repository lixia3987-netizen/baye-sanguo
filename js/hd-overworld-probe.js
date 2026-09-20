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

    function walkNumbers(obj, prefix, out, depth) {
        if (!obj || typeof obj !== 'object' || depth > 3) {
            return;
        }
        var names = listProps(obj);
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            if (!name || name.charAt(0) === '_') {
                continue;
            }
            var path = prefix ? prefix + '.' + name : name;
            var raw = obj[name];
            var num = readNumber(obj, name);
            if (num !== null && (typeof raw === 'number' || (raw !== null && raw !== undefined && typeof raw !== 'object'))) {
                out.push({ path: path, name: name, value: num });
                continue;
            }
            if (raw && typeof raw === 'object' && typeof raw.length !== 'number') {
                walkNumbers(raw, path, out, depth + 1);
            }
        }
    }

    function snapshotPositions(data) {
        var raw = data && data.g_CityPositions;
        var cities = data && data.g_Cities;
        var n = 0;
        try {
            if (window.baye && typeof baye.hdCityLimit === 'function') {
                n = baye.hdCityLimit() || 0;
            }
        } catch (e) {}
        if (!n) {
            n = cities && cities.length ? Math.min(cities.length, 64) : (raw && raw.length ? Math.min(raw.length, 64) : 0);
        }
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
            var belong = null;
            try {
                if (window.baye && typeof baye.getCityName === 'function') {
                    name = baye.getCityName(i);
                }
            } catch (e) {}
            if (cities && cities[i]) {
                belong = readNumber(cities[i], 'Belong');
            }
            rows.push({ i: i, name: name, x: x, y: y, belong: belong });
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

    function guessDate(data) {
        var nums = [];
        walkNumbers(data, '', nums, 0);
        var years = [];
        var months = [];
        for (var i = 0; i < nums.length; i++) {
            var item = nums[i];
            var n = item.name || '';
            if (/year|nian/i.test(n) && item.value >= 180 && item.value <= 300) {
                years.push(item);
            } else if (/month|yue/i.test(n) && item.value >= 1 && item.value <= 12) {
                months.push(item);
            } else if (!/year|month|day|date/i.test(n) && item.value >= 184 && item.value <= 280) {
                years.push({ path: item.path, name: item.name, value: item.value, weak: true });
            }
        }
        return {
            years: years,
            months: months,
            year: years.length ? years[0] : null,
            month: months.length ? months[0] : null
        };
    }

    function scanCityLinkFields(data) {
        var cities = data && data.g_Cities;
        var n = cities && cities.length ? cities.length : 0;
        var fieldHits = [];
        var edges = [];
        var seen = {};
        var re = /exit|link|road|out|neighbor|adjacent|gate|pass|round/i;
        function addEdge(a, b, field) {
            a = Number(a);
            b = Number(b);
            if (!isFinite(a) || !isFinite(b) || a === b || a < 0 || b < 0 || a >= n || b >= n) {
                return;
            }
            var lo = Math.min(a, b);
            var hi = Math.max(a, b);
            var key = lo + '-' + hi;
            if (seen[key]) {
                return;
            }
            seen[key] = true;
            edges.push({ a: lo, b: hi, field: field });
        }
        if (!n) {
            return { fieldHits: fieldHits, edges: edges };
        }
        var i;
        for (i = 0; i < n; i++) {
            var city = cities[i];
            var names = listProps(city);
            var f;
            for (f = 0; f < names.length; f++) {
                var name = names[f];
                if (!re.test(name)) {
                    continue;
                }
                var raw = city[name];
                fieldHits.push({ city: i, field: name, kind: raw && typeof raw.length === 'number' ? 'array' : typeof raw });
                if (raw && typeof raw.length === 'number') {
                    var k;
                    for (k = 0; k < raw.length; k++) {
                        var v = readNumber(raw, k);
                        if (v === null && raw[k] !== undefined) {
                            v = Number(raw[k]);
                        }
                        addEdge(i, v, name);
                    }
                } else {
                    var one = readNumber(city, name);
                    addEdge(i, one, name);
                }
            }
        }
        return { fieldHits: fieldHits, edges: edges };
    }

    function tileNeighborEdges(positions) {
        var rows = positions && positions.rows ? positions.rows : [];
        var edges = [];
        var i;
        var j;
        for (i = 0; i < rows.length; i++) {
            for (j = i + 1; j < rows.length; j++) {
                if (rows[i].x === null || rows[j].x === null) {
                    continue;
                }
                var dx = Math.abs(rows[i].x - rows[j].x);
                var dy = Math.abs(rows[i].y - rows[j].y);
                if (Math.max(dx, dy) <= 1) {
                    edges.push({ a: rows[i].i, b: rows[j].i, dx: dx, dy: dy });
                }
            }
        }
        return edges;
    }

    function run() {
        var data = window.baye && baye.data;
        if (!data) {
            console.log('[hd-overworld-probe] baye.data 尚未就绪');
            return null;
        }
        var city0 = data.g_Cities && data.g_Cities[0] ? listProps(data.g_Cities[0]) : [];
        var pos0 = data.g_CityPositions && data.g_CityPositions[0] ? listProps(data.g_CityPositions[0]) : [];
        var nums = [];
        walkNumbers(data, '', nums, 0);
        var interesting = nums.filter(function (item) {
            return (item.value >= 180 && item.value <= 300) ||
                (/month|year|date|pidx|city|cursor|foucs|focus/i.test(item.name) && item.value < 10000);
        });
        var report = {
            fields: listProps(data),
            interestingNumbers: interesting,
            dateLike: findFields(data, /year|month|date|pidx|time|nian|yue/i),
            cityLike: findFields(data, /city|cursor|focus|foucs|map|crt/i),
            cityObjectFields: city0,
            positionObjectFields: pos0,
            dateGuess: guessDate(data),
            year: pickFirstNumber(data, ['g_YearDate', 'g_YearN', 'g_Year', 'YearN', 'g_DateYear', 'year', 'g_PYear']),
            month: pickFirstNumber(data, ['g_MonthDate', 'g_MonthN', 'g_Month', 'MonthN', 'g_DateMonth', 'month', 'g_PMonth']),
            yearDate: readNumber(data, 'g_YearDate'),
            monthDate: readNumber(data, 'g_MonthDate'),
            cityXY: {
                x: readNumber(data, 'g_CityX'),
                y: readNumber(data, 'g_CityY')
            },
            cursorCity: pickFirstNumber(data, [
                'g_CityCrt', 'g_CityCur', 'g_CurCity', 'g_CityIndex',
                'g_CrtCity', 'g_iCity', 'g_currentCity', 'g_CityId', 'g_CityIdx'
            ]),
            focus: {
                x: pickFirstNumber(data, ['g_CityX', 'g_FoucsX', 'g_FocusX', 'g_MapFocusX']),
                y: pickFirstNumber(data, ['g_CityY', 'g_FoucsY', 'g_FocusY', 'g_MapFocusY'])
            },
            mapScroll: {
                x: pickFirstNumber(data, ['g_MapSX', 'g_LandMapSX', 'g_CityMapSX']),
                y: pickFirstNumber(data, ['g_MapSY', 'g_LandMapSY', 'g_CityMapSY'])
            },
            cityPos: {
                x: data.g_CityPos ? readNumber(data.g_CityPos, 'x') : null,
                y: data.g_CityPos ? readNumber(data.g_CityPos, 'y') : null,
                setx: data.g_CityPos ? readNumber(data.g_CityPos, 'setx') : null,
                sety: data.g_CityPos ? readNumber(data.g_CityPos, 'sety') : null
            },
            cityCursorRange: data.g_cityCursorRange || null,
            playerKing: readNumber(data, 'g_PlayerKing'),
            period: readNumber(data, 'g_PIdx'),
            positions: snapshotPositions(data),
            wasmRoadSymbols: ['SearchRoad', 'AttackCityRoad', 'GetRoundSelfCity', 'GetRoundEnemyCity'],
            wasmRoadExported: typeof wasmExports !== 'undefined' && !!(wasmExports.SearchRoad || wasmExports.AttackCityRoad),
            cityLinks: scanCityLinkFields(data)
        };
        report.tileNeighborEdges = tileNeighborEdges(report.positions);
        report.linkLikeFields = findFields(data, /exit|link|road|pass|gate|adjacent|neighbor/i);
        global.BayeHdOverworldProbe.last = report;
        console.log('[hd-overworld-probe]', report);
        if (report.positions && report.positions.rows) {
            console.table(report.positions.rows);
        }
        if (report.cityLinks && report.cityLinks.fieldHits && report.cityLinks.fieldHits.length) {
            console.log('[hd-overworld-probe] city link fields', report.cityLinks);
        } else {
            console.log('[hd-overworld-probe] no Exit/Link fields on g_Cities; tile-neighbor edges', report.tileNeighborEdges.length);
        }
        return report;
    }

    global.BayeHdOverworldProbe = {
        run: run,
        listProps: listProps,
        findFields: findFields,
        readNumber: readNumber,
        pickFirstNumber: pickFirstNumber,
        walkNumbers: walkNumbers,
        guessDate: guessDate,
        scanCityLinkFields: scanCityLinkFields,
        tileNeighborEdges: tileNeighborEdges,
        last: null
    };
})(window);
