
function hdDumpLast(reason) {
    var last = null;
    try {
        last = window.__bayeLastHdCall || (window.baye && baye.lastHdCall) || null;
    } catch (e) {}
    console.error('[hd-bridge] lastHdCall', reason || '', last ? JSON.stringify(last) : '(none)');
    return last;
}

function hdHookAbort() {
    try {
        if (typeof Module === 'undefined' || Module.__hdAbortHooked) {
            return;
        }
        Module.__hdAbortHooked = 1;
        var prev = Module.onAbort;
        Module.onAbort = function (what) {
            hdDumpLast('wasm abort ' + (what == null ? '' : String(what)));
            if (typeof prev === 'function') {
                return prev(what);
            }
        };
    } catch (e) {}
}

window.onerror = function(msg, url, line, col, error) {
   var extra = !col ? '' : '\ncolumn: ' + col;
   extra += !error ? '' : '\nerror: ' + error;
   var last = hdDumpLast('window.onerror ' + msg);
   extra += '\nlastHdCall: ' + (last && last.name ? (last.name + (last.detail ? ' ' + last.detail : '')) : '(none)');
   if (error && error.stack) {
       extra += '\nstack: ' + error.stack;
   }
   console.error('[baye] window.onerror', msg, url, line, extra);
   alert("Error: " + msg + "\nurl: " + url + "\nline: " + line + extra);
   return false;
};

if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('unhandledrejection', function(ev) {
        hdDumpLast('unhandledrejection');
        console.error('[baye] unhandledrejection', ev && ev.reason);
    });
}

Math._original_random = Math.random;
Math.random = function() {
    try {
        if (typeof wasmExports !== 'undefined' && wasmExports['bayeRand']) {
            return wasmExports['bayeRand']() % 65536 / 65536;
        }
        return Math._original_random();
    } catch {
        return 0;
    }
};

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex) {
        return this.indexOf(searchElement, fromIndex) >= 0;
    }
}

var    ValueTypeU8 = 0;
var    ValueTypeU16 = 1;
var    ValueTypeU32 = 2;
var    ValueTypeString = 3;
var    ValueTypeObject = 4;
var    ValueTypeArray = 5;
var    ValueTypeMethod = 6;
var    ValueTypeGBKBuffer = 7;

var gbkDecoder = new TextDecoder('GBK');
var gbkEncoder = new TextEncoder('GBK', { NONSTANDARD_allowLegacyEncoding: true });

function BayeObject() {
}

BayeObject.prototype.toString = function() {
    switch (this._type) {
    case ValueTypeU8:
        return 'U8(' + this.value + ')';
    case ValueTypeU16:
        return 'U16(' + this.value + ')';
    case ValueTypeU32:
        return 'U32(' + this.value + ')';
    case ValueTypeString:
        return 'String("' + this.value + '")';
    case ValueTypeObject:
        return 'Object';
    case ValueTypeArray:
        return 'Array[' + this.length + ']';
    case ValueTypeGBKBuffer:
        return 'GBKBuffer[' + this.length + ']';
    case ValueTypeMethod:
        return 'Method';
    }
};

function baye_bridge_value(value) {
    return baye_bridge_valuedef(_Value_get_def(value), _Value_get_addr(value));
}

function baye_bridge_description_for_value(jvalue, type) {
    switch (type) {
        case ValueTypeU8:
        case ValueTypeU16:
        case ValueTypeU32:
        case ValueTypeString:
            return {
                get: function() {
                    return jvalue.value.value;
                },
                set: function(value) {
                    jvalue.value.value = value;
                }
            };
            break;
        case ValueTypeArray:
            return {
                get: function() {
                    return jvalue.value;
                },
                set: function(value) {
                    var jv = jvalue.value;
                    var length = jv.length;
                    for(var i = 0; i < length && i < value.length; i++) {
                        jv[i] = value[i]
                    }
                }
            };
            break;
        case ValueTypeGBKBuffer:
            return {
                get: function() {
                    var addr = jvalue.value._addr;
                    var n = hdSafeStrLen(addr);
                    if (!n) {
                        return '';
                    }
                    var buffer = bayeU8Array(addr, n);
                    return gbkDecoder.decode(buffer);
                },
                set: function(value) {
                    var jv = jvalue.value;
                    var arr = gbkEncoder.encode('' + value);
                    var length = Math.min(jv.length - 1, arr.length);
                    for(var i = 0; i < length; i++) {
                        jv[i] = arr[i]
                    }
                    jv[length] = 0;
                }
            };
            break;
        case ValueTypeObject:
            return {
                get: function() {
                    return jvalue.value;
                },
                set: function(value) {
                    jvalue.value._baye_properties.forEach( name => {
                        if (value[name] !== undefined) {
                            jvalue.value[name] = value[name];
                        }
                    });
                }
            }
            break;
    }
}

var __bayeGetDepth = 0;
var BAYE_GET_DEPTH_MAX = 12;

function wrapBayeGet(fn) {
    if (typeof fn !== 'function') {
        return fn;
    }
    return function () {
        if (__bayeGetDepth > BAYE_GET_DEPTH_MAX) {
            return undefined;
        }
        __bayeGetDepth += 1;
        try {
            return fn.apply(this, arguments);
        } finally {
            __bayeGetDepth -= 1;
        }
    };
}

function cloneGetDesc(d) {
    var out = {};
    var k;
    for (k in d) {
        if (Object.prototype.hasOwnProperty.call(d, k)) {
            out[k] = k === 'get' ? wrapBayeGet(d[k]) : d[k];
        }
    }
    return out;
}

function defineProperty(obj, p, desc) {
    if (desc && typeof desc.get === 'function') {
        desc = cloneGetDesc(desc);
    }
    Object.defineProperty(obj, p, desc);
}

function defineProperties(obj, desc) {
    var out = {};
    var k;
    for (k in desc) {
        if (!Object.prototype.hasOwnProperty.call(desc, k)) {
            continue;
        }
        var d = desc[k];
        out[k] = (d && typeof d.get === 'function') ? cloneGetDesc(d) : d;
    }
    Object.defineProperties(obj, out);
}

function baye_bridge_valuedef_lazy(def, addr) {
    var obj = {
        get value() {
            if (__bayeGetDepth > BAYE_GET_DEPTH_MAX) {
                return undefined;
            }
            __bayeGetDepth += 1;
            try {
                if (this._value == undefined) {
                    this._value = baye_bridge_valuedef(def, addr);
                }
                return this._value;
            } finally {
                __bayeGetDepth -= 1;
            }
        }
    };
    return obj;
}

function baye_bridge_valuedef(def, addr) {
    var type = _ValueDef_get_type(def);
    var jsObj = new BayeObject();
    jsObj._def = def;
    jsObj._addr = addr;
    jsObj._type = type;

    switch (type) {
        case ValueTypeU8:
            defineProperty(jsObj, 'value', {
                get: function() {
                    if (!hdHeapOk(this._addr, 1)) {
                        return 0;
                    }
                    return _baye_get_u8_value(this._addr);
                },
                set: function(value) {
                    if (!hdHeapOk(this._addr, 1)) {
                        return 0;
                    }
                    if (value > 0xff) value = 0xff;
                    if (value < 0) value = 0;
                    return _baye_set_u8_value(this._addr, value);
                }
            });
            break;
        case ValueTypeU16:
            defineProperty(jsObj, 'value', {
                get: function() {
                    if (!hdHeapOk(this._addr, 2)) {
                        return 0;
                    }
                    return _baye_get_u16_value(this._addr);
                },
                set: function(value) {
                    if (!hdHeapOk(this._addr, 2)) {
                        return 0;
                    }
                    if (value > 0xffff) value = 0xffff;
                    if (value < 0) value = 0;
                    return _baye_set_u16_value(this._addr, value);
                }
            });
            break;
        case ValueTypeU32:
            defineProperty(jsObj, 'value', {
                get: function() {
                    if (!hdHeapOk(this._addr, 4)) {
                        return 0;
                    }
                    // WASM returns the U32 bit pattern through its i32 ABI.
                    return _baye_get_u32_value(this._addr) >>> 0;
                },
                set: function(value) {
                    if (!hdHeapOk(this._addr, 4)) {
                        return 0;
                    }
                    return _baye_set_u32_value(this._addr, value);
                }
            });
            break;
        case ValueTypeString:
            defineProperty(jsObj, 'value', {
                get: function() {
                    // TODO:
                    return this._addr;
                }
            });
            break;
        case ValueTypeObject:
            return baye_bridge_obj(def, addr);
        case ValueTypeArray:
        case ValueTypeGBKBuffer:
            var length = _ValueDef_get_array_length(def);
            jsObj.length = length;
            var subdef = _ValueDef_get_array_subdef(def);
            var subsize = _ValueDef_get_size(subdef);
            var properties = {};
            for (var i = 0; i < length; i++) {
                var item_value = baye_bridge_valuedef_lazy(subdef, addr + subsize * i);
                var desc = baye_bridge_description_for_value(item_value, _ValueDef_get_type(subdef));
                properties[i] = desc;
            }
            defineProperties(jsObj, properties);
            break;
        case ValueTypeMethod:
            return function() {
            };
    }
    return jsObj;
}

function baye_bridge_obj(def, addr) {
    var jsObj = new BayeObject();
    var properties = {};

    var count = _ValueDef_get_field_count(def);
    var property_names = [];


    jsObj._def = def;
    jsObj._addr = addr;

    for (var i = 0; i < count; i++) {
        var field = _ValueDef_get_field_by_index(def, i);
        var cname = _Field_get_name(field);
        var name = UTF8ToString(cname);
        var field_value_addr = _Field_get_value(field);
        var value_def = _Value_get_def(field_value_addr);
        var value_offset = _Value_get_addr(field_value_addr);
        var field_value = baye_bridge_valuedef_lazy(value_def, addr + value_offset);

        var desc = baye_bridge_description_for_value(field_value, _Field_get_type(field));
        properties[name] = desc;
        property_names.push(name);
    }
    defineProperties(jsObj, properties);
    jsObj._baye_properties = property_names;
    return jsObj;
}

function hdHeapLen() {
    try {
        return (typeof Module !== 'undefined' && Module.HEAPU8 && Module.HEAPU8.length) || 0;
    } catch (e) {
        return 0;
    }
}

function hdHeapOk(ptr, len) {
    var heap = hdHeapLen();
    ptr = Number(ptr);
    len = Number(len);
    if (!heap || !isFinite(ptr) || !isFinite(len) || ptr <= 0 || len < 0) {
        return false;
    }
    return ptr < heap && (ptr + len) <= heap;
}

function hdNote(name, detail) {
    var rec = { name: String(name || ''), detail: detail == null ? '' : String(detail), t: Date.now() };
    try {
        window.__bayeLastHdCall = rec;
        if (window.baye) {
            baye.lastHdCall = rec;
        }
    } catch (e) {}
}

function hdEngineReady() {
    try {
        hdHookAbort();
        if (!hdHeapLen()) {
            return false;
        }
        if (typeof _bayeHdReady === 'function') {
            try {
                if (!_bayeHdReady()) {
                    return false;
                }
            } catch (e) {
                return false;
            }
        } else if (!(window.baye && baye.data)) {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function hdSafeStrLen(ptr) {
    if (!hdHeapOk(ptr, 1)) {
        return 0;
    }
    var heap = Module.HEAPU8;
    var n = 0;
    var max = Math.min(4096, heap.length - ptr);
    while (n < max && heap[ptr + n]) {
        n += 1;
    }
    return n;
}

function hdPersonLimit() {
    try {
        if (typeof _bayeGetPersonCount === 'function' && hdEngineReady()) {
            var n = Number(_bayeGetPersonCount()) || 0;
            if (n > 0 && n <= 2000) {
                return n;
            }
        }
        if (window.baye && baye.data && baye.data.g_Persons && baye.data.g_Persons.length) {
            return baye.data.g_Persons.length;
        }
    } catch (e) {}
    return 2000;
}

function hdCityLimit() {
    var n = 0;
    try {
        if (typeof _bayeGetCityCount === 'function' && hdEngineReady()) {
            var c = Number(_bayeGetCityCount()) || 0;
            if (c > 0 && c <= 64) {
                n = c;
            }
        }
    } catch (e) {}
    try {
        if (window.baye && baye.data) {
            if (baye.data.g_engineConfig && baye.data.g_engineConfig.citiesCount != null) {
                var cfg = Number(baye.data.g_engineConfig.citiesCount);
                if (cfg > 0 && cfg <= 64) {
                    n = n > 0 ? Math.min(n, cfg) : cfg;
                }
            }
            if (baye.data.g_Cities && baye.data.g_Cities.length) {
                var len = Number(baye.data.g_Cities.length) || 0;
                if (len > 0 && len <= 64) {
                    n = n > 0 ? Math.min(n, len) : len;
                }
            }
        }
    } catch (e) {}
    if (!n || n < 0 || n > 64) {
        return 0;
    }
    return n;
}

function hdSafeNameCall(kind, fn, index, max) {
    index = Number(index);
    if (!isFinite(index) || index < 0 || index >= max || index >= 0xfffe) {
        hdNote(kind, 'skip:' + index);
        return '';
    }
    if (!hdEngineReady() || typeof fn !== 'function') {
        hdNote(kind, 'not-ready:' + index);
        return '';
    }
    try {
        if (window.baye && baye.data && baye.data.g_PIdx != null) {
            var period = Number(baye.data.g_PIdx);
            if (isFinite(period) && period === 0) {
                hdNote(kind, 'no-period:' + index);
                return '';
            }
        }
    } catch (e) {}
    hdNote(kind, index);
    try {
        var addr = fn(index);
        if (!addr) {
            return '';
        }
        var n = hdSafeStrLen(addr);
        if (!n) {
            return '';
        }
        return gbkDecoder.decode(Module.HEAPU8.subarray(addr, addr + n));
    } catch (e) {
        console.warn('[hd-bridge]', kind, index, e && e.message ? e.message : e);
        return '';
    }
}

function bayeU8Array(caddr, length) {
    var heap = Module && Module.HEAPU8;
    if (!heap) {
        return new Uint8Array(0);
    }
    caddr = Number(caddr) || 0;
    length = Number(length) || 0;
    if (caddr < 0 || length < 0 || caddr >= heap.length) {
        return heap.subarray(0, 0);
    }
    if (caddr + length > heap.length) {
        length = heap.length - caddr;
    }
    return heap.subarray(caddr, caddr + length);
}

function bayeWrapFunctionS(innerf) {
    return function() {
        if (!hdEngineReady()) {
            return '';
        }
        var addr = innerf.apply(this, arguments);
        if (addr != 0) {
            var n = hdSafeStrLen(addr);
            if (!n) {
                return '';
            }
            return gbkDecoder.decode(bayeU8Array(addr, n));
        }
        return null;
    };
}

function range(start, stop, step) {
    if (typeof stop == 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step == 'undefined') {
        step = 1;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }

    return result;
}

function baye_bridge_init() {
    function Promise(fn) {
        _this = this
        var done = false;
        fn(function(x){
            if (typeof _this.onfulfilled == 'function') {
                if (!done) {
                    done = true
                    _this.onfulfilled(x)
                }
            }
        }, function(e){
            if (typeof _this.onrejected == "function") {
                if (!done) {
                    done = true
                    _this.onrejected(e)
                }
            }
        });
    }

    Promise.prototype.then = function(onfulfilled, onrejected) {
        this.onfulfilled = onfulfilled
        this.onrejected = onrejected
    };

    window.Promise = Promise;

    function wrapAsync(f) {
        return function() {
            var args = Array.from(arguments);
            var _this = this;
            return Promise(function(resolve, reject){
                args.push(resolve);
                f.apply(_this, args);
            });
        }
    }

    function truncate(s, n, pad) {
        var l = 0;
        var c = 0;
        for (var i = 0; i < s.length; i++) {
            var cs = s.charCodeAt(i) > 256 ? 2 : 1;
            if (l + cs <= n) {
                l += cs;
                c += 1;
            } else {
                break;
            }
        }
        var rv = s.slice(0, c);
        if (pad) {
            while (l < n) {
                rv += ' ';
                l += 1;
            }
        }
        return rv;
    }

    if (window.baye === undefined) {
        window.baye = {};
    }
    baye.debug = {};

    baye.getPersonName = function(i) {
        return hdSafeNameCall('getPersonName', _bayeGetPersonName, i, hdPersonLimit());
    };
    baye.getToolName = function(i) {
        return hdSafeNameCall('getToolName', _bayeGetToolName, i,
            typeof _bayeHdGetToolCount === 'function' ? baye.getToolCount() : 512);
    };
    baye.getToolCount = function () {
        if (!hdEngineReady() || typeof _bayeHdGetToolCount !== 'function') { return 0; }
        try {
            var count = _bayeHdGetToolCount();
            return hdIntegerValue(count, 0, 2000) == null ? 0 : count;
        } catch (e) { return 0; }
    };
    baye.getSkillName = function(i) {
        return hdSafeNameCall('getSkillName', _bayeGetSkillName, i, 256);
    };
    baye.getCityName = function(i) {
        return hdSafeNameCall('getCityName', _bayeGetCityName, i, hdCityLimit());
    };
    baye.hdCityLimit = hdCityLimit;
    baye.getPersonCount = function() {
        if (!hdEngineReady() || typeof _bayeGetPersonCount !== 'function') {
            hdNote('getPersonCount', 'not-ready');
            return 0;
        }
        hdNote('getPersonCount', '');
        try {
            var n = Number(_bayeGetPersonCount()) || 0;
            return (n > 0 && n <= 2000) ? n : 0;
        } catch (e) {
            return 0;
        }
    };
    baye.hdEngineReady = hdEngineReady;
    baye.hdNote = hdNote;

    baye._cbs = [];
    baye.pushCallback = function(cb) {
        if (baye.data.g_asyncActionID > 0)
            baye._cbs.push(cb ? cb : function(x){ return x; });
    }

    baye.callCallback = function() {
        var rv = baye._cbs.pop()();
        baye.pushCallback(baye.callback);
        return rv;
    }

    baye.callHook = function(name, context) {
        var rv = window.baye.hooks[name](context);
        baye.pushCallback(baye.callback);
        return rv;
    };

    baye.getCustomData = function() {
        var cstr = _bayeGetCustomData();
        if (cstr == 0) return null;
        return UTF8ToString(cstr);
    }

    baye.setCustomData = function(data) {
        var length = lengthBytesUTF8(data) + 1;
        var buffer = Module._bayeAlloc(length);
        stringToUTF8(data, buffer, length);
        _bayeSetCustomData(buffer);
        _free(buffer);
    }

    baye.alert = function(msg, then){
        baye.data.g_asyncActionID = 1;
        baye.data.g_asyncActionParams[0] = 3;
        baye.data.g_asyncActionStringParam = msg;
        baye.callback = then;
    };

    baye.asyncAlert = wrapAsync(baye.alert);

    baye.say = function(personIndex, msg, then){
        baye.data.g_asyncActionID = 2;
        baye.data.g_asyncActionParams[0] = personIndex;
        baye.data.g_asyncActionStringParam = msg;
        baye.callback = then;
    };

    baye.asyncSay = wrapAsync(baye.say);

    baye.delay = function(ticks, flag, then){
        baye.data.g_asyncActionID = 7;
        baye.data.g_asyncActionParams[0] = ticks;
        baye.data.g_asyncActionParams[1] = flag;
        setcb0(then);
    };

    baye.asyncDelay = wrapAsync(baye.delay);

    baye.playSPE = function(x, y, speid, index, flag, then){
        baye.data.g_asyncActionID = 8;
        baye.data.g_asyncActionParams[0] = speid;
        baye.data.g_asyncActionParams[1] = index;
        baye.data.g_asyncActionParams[2] = x;
        baye.data.g_asyncActionParams[3] = y;
        baye.data.g_asyncActionParams[4] = flag;
        setcb0(then);
    };

    baye.asyncPlaySPE = wrapAsync(baye.playSPE);

    baye.getNumber = function(min, max, then) {
        baye.data.g_asyncActionID = 9;
        baye.data.g_asyncActionParams[0] = min;
        baye.data.g_asyncActionParams[1] = max;
        baye.data.g_asyncActionParams[2] = max;
        setcb0(then);
    };

    baye.asyncGetNumber = wrapAsync(baye.getNumber);

    baye.getNumber2 = function(init, min, max, then) {
        baye.data.g_asyncActionID = 9;
        baye.data.g_asyncActionParams[0] = min;
        baye.data.g_asyncActionParams[1] = max;
        baye.data.g_asyncActionParams[2] = init;
        setcb0(then);
    };

    baye.asyncGetNumber2 = wrapAsync(baye.getNumber2);

    baye.enterBattle = function(then) {
        baye.data.g_asyncActionID = 10;
        setcb0(then);
    };

    baye.asyncEnterBattle = wrapAsync(baye.enterBattle);

    function setcb0(then) {
        if (then) {
            baye.callback = function() {
                return then(baye.data.g_asyncActionParams[0]);
            };
        } else {
            baye.callback = undefined;
        }
    }

    baye.choose = function(x, y, w, h, items, init, then){
        baye.data.g_asyncActionID = 3;
        baye.data.g_asyncActionParams[0] = x;
        baye.data.g_asyncActionParams[1] = y;
        baye.data.g_asyncActionParams[2] = w;
        baye.data.g_asyncActionParams[3] = h;
        baye.data.g_asyncActionParams[4] = init;

        var n = Math.floor(w / 6);
        var s = "";

        for (var i = 0; i < items.length; i++) {
            s += truncate(items[i], n, true);
        }

        baye.data.g_asyncActionStringParam = s;
        setcb0(then);
    };

    baye.asyncChoose = wrapAsync(baye.choose);

    baye.centerChoose = function(w, h, items, init, then) {

        var x = (baye.data.g_screenWidth - w) / 2;
        var y = (baye.data.g_screenHeight - h) / 2;

        return baye.choose(x, y, w, h, items, init, then);
    };

    baye.asyncCenterChoose = wrapAsync(baye.centerChoose);

    baye.choosePerson = function(items, init, then) {
        baye.data.g_asyncActionID = 4;
        baye.data.g_asyncActionParams[0] = items.length;
        baye.data.g_asyncActionParams[1] = init;

        for (var i = 0; i < items.length; i++) {
            baye.data.g_asyncActionU16ParamArray[i] = items[i];
        }
        setcb0(then);
    };

    baye.asyncChoosePerson = wrapAsync(baye.choosePerson);

    baye.chooseTool = function(items, init, then) {
        baye.data.g_asyncActionID = 5;
        baye.data.g_asyncActionParams[0] = items.length;
        baye.data.g_asyncActionParams[1] = init;

        for (var i = 0; i < items.length; i++) {
            baye.data.g_asyncActionU16ParamArray[i] = items[i];
        }
        setcb0(then);
    };

    baye.asyncChooseTool = wrapAsync(baye.chooseTool);

    baye.chooseCity = function(then) {
        baye.data.g_asyncActionID = 6;
        setcb0(then);
    };

    baye.asyncChooseCity = wrapAsync(baye.chooseCity);

    baye.makeBattle = function(city, then) {
        baye.data.g_asyncActionParams[0] = city;
        baye.data.g_asyncActionID = 11;
        setcb0(then);
    };

    baye.makeCommand = function(city, cmd, then) {
        baye.data.g_asyncActionParams[0] = city;
        baye.data.g_asyncActionParams[1] = cmd;
        baye.data.g_asyncActionID = 12;
        setcb0(then);
    };

    baye.sysMessage = function(then){
        baye.data.g_asyncActionID = 13;
        setcb0(function() {
            var msg = {
                "type": baye.data.g_asyncActionParams[0],
                "param": baye.data.g_asyncActionParams[1],
                "param2": {
                    "i32": baye.data.g_asyncActionParams[2],
                    "i16": {
                        "p0": baye.data.g_asyncActionParams[3],
                        "p1": baye.data.g_asyncActionParams[4],
                    }
                }
            };
            return then(msg);
        });
    };

    baye.getPersonByName = function(name) {
        var all = baye.data.g_Persons;
        for (var i = 0; i < all.length; i++) {
            if (baye.getPersonName(i) == name) {
                return all[i];
            }
        }
    };

    baye.getPersonIdByName = function(name) {
        var all = baye.data.g_Persons;
        for (var i = 0; i < all.length; i++) {
            if (baye.getPersonName(i) == name) {
                return i;
            }
        }
    };


    baye.getCityByPerson = function(person) {
        const cities = baye.data.g_Cities;
        for (var c = 0; c < cities.length; c++) {
            const j = cities[c].PersonQueue;
            for (var i = 0; i < cities[c].Persons; i++) {
                if (baye.data.g_PersonsQueue[j+i] == person)
                    return c;
            }
        }
        return 0xff;
    }


    baye.getCityByName = function(name) {
        var all = baye.data.g_Cities;
        var n = hdCityLimit() || (all && all.length ? Math.min(all.length, 64) : 0);
        for (var i = 0; i < n; i++) {
            if (baye.getCityName(i) == name) {
                return all[i];
            }
        }
    };

    baye.getFighterIndexByName = function(name) {
        var all = baye.data.g_FgtParam.GenArray;
        for (var i = 0; i < all.length; i++) {
            var index = all[i] - 1;
            if (index >= 0 && baye.getPersonName(index) == name) {
                return i;
            }
        }
    };

    baye.getFighterPositionByName = function(name) {
        var idx = baye.getFighterIndexByName(name);
        return baye.data.g_GenPos[idx];
    };

    baye.getPersonNameByID = function(id) {
        if (id == null || (typeof id !== 'number' && typeof id !== 'string') || id === '') { return '-'; }
        id = Number(id);
        var count = baye.getPersonCount();
        if (!isFinite(id) || Math.floor(id) !== id || id <= 0 || id > count || id >= 0xfffe) {
            hdNote('getPersonNameByID', 'skip:' + id);
            return "-";
        }
        return baye.getPersonName(id - 1) || '-';
    };

    // Person.Belong and City.Belong are U16 lord IDs (person index + 1).
    // Only a person's 0xffff is captive; cities never have a captive owner.
    function ownership(value, personIndex, city) {
        var unknown = { kind: 'unknown', value: null, personIndex: null, name: '', label: '归属未知' };
        if (value && typeof value === 'object' && 'value' in value) { value = value.value; }
        if (value == null || (typeof value !== 'number' && typeof value !== 'string') ||
            typeof value === 'string' && !value.trim()) { return unknown; }
        value = Number(value);
        if (!isFinite(value) || Math.floor(value) !== value || value < 0 || value > 0xffff) { return unknown; }
        unknown.value = value;
        if (value === 0) { return { kind: city ? 'unowned' : 'free', value: 0, personIndex: null,
            name: '', label: city ? '无主城' : '在野' }; }
        if (!city && value === 0xffff) { return { kind: 'captive', value: value, personIndex: null, name: '', label: '俘虏' }; }
        var count = baye.getPersonCount();
        if (!count || value > count || value >= 0xfffe) { return unknown; }
        var name = '';
        try { name = baye.getPersonName(value - 1) || ''; } catch (e) {}
        if (!name || name === '-') { return unknown; }
        var lord = !city && Number.isInteger(personIndex) && personIndex >= 0 && value === personIndex + 1;
        return { kind: lord ? 'lord' : 'owned', value: value, personIndex: value - 1, name: name,
            label: lord ? '君主 · ' + name : name };
    }
    baye.personOwnership = function(value, personIndex) { return ownership(value, personIndex, false); };
    baye.cityOwnership = function(value) { return ownership(value, null, true); };

    baye.printCity = function(i) {
        var city = baye.data.g_Cities[i];
        var people = baye.data.g_Persons;
        var queue = baye.data.g_PersonsQueue;

        var belong = baye.cityOwnership(city.Belong).label;

        console.log("--------" + baye.getCityName(i) + "--------");
        console.log("id: " + i);
        console.log("归属: " + belong);
        console.log("-");
        for (var qi = 0; qi  < city.Persons; qi++) {
            var pind = queue[city.PersonQueue + qi];
            var person = people[pind];
            var name = baye.getPersonName(pind);
            var belong = baye.personOwnership(person.Belong, pind).label;
            console.log(sprintf("%-10s 归属:%-10s", name, belong));
        }
        console.log("-");
        var queue = baye.data.g_GoodsQueue;
        var tools = baye.data.g_Tools;
        for (var qi = 0; qi  < city.Tools; qi++) {
            var tindex = queue[city.ToolQueue + qi];
            var tool = tools[pind];
            var name = baye.getToolName(pind);
            console.log(name);
        }
    };

    baye.printPeople = function () {
        for (var i = 0; i < 250; i++) {
            var p = baye.data.g_Persons[i];
            if (p.Level > 0) {
                console.log(sprintf('index: %03d name: %-08s 归属:%-08s', i, baye.getPersonName(i), baye.personOwnership(p.Belong, i).label));
            }
        }
    };

    baye.printAllCities = function() {
        var cities = baye.data.g_Cities;

        for (var i = 0; i < cities.length; i++) {
            baye.printCity(i);
        }
    };

    baye.getTerrainByGeneralIndex = function(index) {
        return _bayeFgtGetGenTer(index);
    };

    baye.putPersonInCity = function(city, person) {
        return _bayePutPersonInCity(city, person);
    };

    baye.putToolInCity = function(city, tool, hide) {
        return _bayePutToolInCity(city, tool, hide ? 1 : 0);
    };

    baye.deletePersonInCity = function(city, person) {
        return _bayeDeletePersonInCity(city, person);
    };

    baye.deleteToolInCity = function(city, tool) {
        return _bayeDeleteToolInCity(city, tool);
    };

    baye.getPersonByGeneralIndex = function(gIndex) {
        var pid = baye.data.g_FgtParam.GenArray[gIndex];
        return baye.data.g_Persons[pid - 1];
    };

    baye.moveHere = function(name) {
        var i = baye.getFighterIndexByName(name);
        var pd = baye.data.g_GenPos[i];
        pd.x = baye.data.g_FoucsX;
        pd.y = baye.data.g_FoucsY;
    };

    baye.getArmType = function(pindex) {
        return _bayeGetArmType(pindex);
    };

    baye.drawText = function (x, y, text, scr) {
        var gbkPtr = _bayeGetGBKBuffer();
        baye.data.g_asyncActionStringParam = text;
        return _bayeLcdDrawText(gbkPtr, x, y, scr);
    };

    baye.drawImage = function(x, y, resid, resitem, picIndex, scr) {
        _bayeLcdDrawImage(resid, resitem, picIndex, x, y, scr == 1 ? 0 : 1);
    };

    baye.clearRect = function(left, top, right, bottom, scr) {
        _bayeLcdClearRect(left, top, right, bottom, scr);
    };

    baye.revertRect = function(left, top, right, bottom, scr) {
        _bayeLcdRevertRect(left, top, right, bottom, scr);
    };

    baye.drawLine = function(startX, startY, endX, endY) {
        _bayeLcdDrawLine(startX, startY, endX, endY, 1);
    };

    baye.drawRect = function(left, top, right, bottom, scr) {
        _bayeLcdDrawRect(left, top, right, bottom, 1, scr);
    };

    baye.drawDot = function(x, y, color) {
        _bayeLcdDot(x, y, color);
    };

    baye.clearScreen = function() {
        baye.clearRect(0, 0, baye.data.g_screenWidth, baye.data.g_screenHeight);
    };

    baye.resizeScreen = function(width, height) {
        bayeResizeScreen(width, height);
    };

    baye.patchNames = function() {
        var l = baye.data.g_Persons.length;
        for (var i = 0; i < l; i++) {
            baye.data.g_Persons[i].name = baye.getPersonName(i);
        }

        l = baye.data.g_Tools.length;
        for (var i = 0; i < l; i++) {
            baye.data.g_Tools[i].name = baye.getToolName(i);
        }

        l = baye.data.g_Skills.length;
        for (var i = 0; i < l; i++) {
            baye.data.g_Skills[i].name = baye.getSkillName(i);
        }
    };

    baye.saveScreen = _bayeSaveScreen;

    baye.restoreScreen = _bayeRestoreScreen;
    baye.setFont = _bayeSetFont;
    baye.setFontEn = _bayeSetFontEn;
    baye.clearFontCache = _bayeClearFontCache;

    //计算将领在屏幕的像素位置
    baye.getFighterXY = function (index) {
        var ox = baye.data.g_GenPos[index].x - baye.data.g_MapSX;
        var oy = baye.data.g_GenPos[index].y - baye.data.g_MapSY;
        return {
            x: ox * 16,
            y: oy * 16
        };
    };
    baye.loadPeriod = _bayeLoadPeriod;
    baye.sendKey = _bayeSendKey;

    baye.None = 0xffff;
    baye.OK = 0;

    baye.VM_KEY =       0x05;		/* 按键 */
    baye.VM_TIMER =     0x06;		/* 定时到 */
    baye.VM_TOUCH =     0x10;		/* 触控事件 */

    baye.VK_PGUP =      0x20;
    baye.VK_PGDN =      0x21;
    baye.VK_UP =        0x22;
    baye.VK_DOWN =      0x23;
    baye.VK_LEFT =      0x24;
    baye.VK_RIGHT =     0x25;
    baye.VK_HELP =      0x26;
    baye.VK_ENTER =     0x27;
    baye.VK_EXIT =      0x28;
    baye.VK_INSERT =    0x30;
    baye.VK_DEL =       0x31;
    baye.VK_MODIFY =    0x32;
    baye.VK_SEARCH =    0x33;
    baye.VK_DIGIT0 =    0x40;

    baye.VT_TOUCH_DOWN =    0x01;
    baye.VT_TOUCH_UP =      0x02;
    baye.VT_TOUCH_MOVE =    0x03;
    baye.VT_TOUCH_CANCEL =  0x04;

    baye.blurScreen = lcdBlur;

    // for debug
    baye.debug = {};

    baye.debug.pa = function () {
        for (var i = 0; i < 20; i++) {
            var id = baye.data.g_FgtParam.GenArray[i];
            if (id) {
                console.log('' + i + ':' + baye.getPersonName(id-1));
            }
        }
    };

    baye.debug.reset = function () {
        baye.data.g_LookMovie = 0;
        for (var i = 0; i < 10; i++) {
            var id = baye.data.g_FgtParam.GenArray[i];
            if (id) {
                baye.data.g_GenPos[i].active = 0;
                baye.data.g_GenPos[i].hp = 100;
                baye.data.g_GenPos[i].mp = 100;
                baye.data.g_Persons[id-1].Arms = 10000;
            }
        }
    };

    // 调试, 移动指定任务到跟前来
    baye.debug.mv = function (i) {
        var pd = baye.data.g_GenPos[i];
        pd.x = baye.data.g_FoucsX;
        pd.y = baye.data.g_FoucsY;
    };

    baye.ensureData = function () {
        if (!hdHeapLen()) {
            hdNote('ensureData', 'no-heap');
            return null;
        }
        if (typeof _bayeHdReady === 'function') {
            try {
                if (!_bayeHdReady()) {
                    hdNote('ensureData', 'lib-not-ready');
                    return baye.data || null;
                }
            } catch (e) {
                hdNote('ensureData', 'ready-throw');
                return baye.data || null;
            }
        }
        if (baye.data) {
            return baye.data;
        }
        if (!hdEngineReady()) {
            hdNote('ensureData', 'not-ready');
            return null;
        }
        hdNote('ensureData', 'bind');
        if (typeof _bayeGetGlobal === 'function' && typeof baye_bridge_value === 'function') {
            try {
                baye.data = baye_bridge_value(_bayeGetGlobal());
            } catch (e) {
                console.warn('[hd-bridge] ensureData failed', e);
            }
        }
        return baye.data || null;
    };

    function hdReadNum(obj, name) {
        if (!obj || obj[name] == null) {
            return 0;
        }
        var v = obj[name];
        if (v && typeof v === 'object' && 'value' in v) {
            v = v.value;
        }
        v = Number(v);
        return isFinite(v) ? v : 0;
    }

    // New detail contracts never turn a missing field into person/tool zero.
    function hdIntegerValue(value, min, max) {
        if (value && typeof value === 'object' && 'value' in value) { value = value.value; }
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value &&
            value >= min && value <= max ? value : null;
    }
    function hdDetailNum(obj, name, max) {
        return hdIntegerValue(obj && obj[name], 0, max == null ? 0xffffffff : max);
    }
    function hdDetailText(obj, name, length) {
        var value = obj && obj[name];
        return typeof value === 'string' ? value.replace(/\u0000.*$/, '').slice(0, length) :
            hdDecodeSlice(value, 0, length);
    }
    var hdMenuNamesCache = null;

    function hdDecodePtr(ptr) {
        if (!ptr || !hdHeapOk(ptr, 1)) {
            return '';
        }
        try {
            var n = hdSafeStrLen(ptr);
            if (!n) {
                return '';
            }
            return gbkDecoder.decode(bayeU8Array(ptr, n)).replace(/\s+$/g, '');
        } catch (e) {
            return '';
        }
    }

    function hdDecodeSlice(bytes, start, len) {
        if (!bytes || !len) {
            return '';
        }
        var slice = [];
        var i;
        for (i = 0; i < len; i++) {
            var b = bytes[start + i];
            if (b == null || b === 0) {
                break;
            }
            slice.push(b);
        }
        while (slice.length && (slice[slice.length - 1] === 0 || slice[slice.length - 1] === 0x20)) {
            slice.pop();
        }
        if (!slice.length) {
            return '';
        }
        try {
            return gbkDecoder.decode(new Uint8Array(slice)).replace(/\s+$/g, '');
        } catch (e) {
            return '';
        }
    }

    baye.hd = {
        ready: hdEngineReady,
        report: function () {
            hdNote('hd.report', '');
            var d = baye.ensureData();
            var text = '';
            if (d && typeof d.g_hdReportGbk === 'string') {
                text = d.g_hdReportGbk;
            }
            if (!text && hdEngineReady() && typeof _bayeHdGetReport === 'function') {
                try {
                    text = hdDecodePtr(_bayeHdGetReport());
                } catch (e) {}
            }
            var seq = hdReadNum(d, 'g_hdReportSeq');
            if (!seq && hdEngineReady() && typeof _bayeHdGetReportSeq === 'function') {
                try { seq = Number(_bayeHdGetReportSeq()) || 0; } catch (e) {}
            }
            return {
                text: text,
                seq: seq,
                active: hdReadNum(d, 'g_hdReportActive'),
                inputSeq: hdReadNum(d, 'g_hdReportInputSeq'),
                kind: hdReadNum(d, 'g_hdReportKind'),
                person: hdReadNum(d, 'g_hdReportPerson')
            };
        },
        reportText: function () {
            var r = baye.hd.report();
            return r && r.text ? r.text : '';
        },
        record: function () {
            hdNote('hd.record', '');
            var d = baye.ensureData();
            return {
                active: hdReadNum(d, 'g_hdRecordActive'),
                mode: hdReadNum(d, 'g_hdRecordMode'),
                index: hdReadNum(d, 'g_hdRecordIndex'),
                count: hdReadNum(d, 'g_hdRecordCount'),
                seq: hdReadNum(d, 'g_hdRecordSeq')
            };
        },
        kings: function () {
            hdNote('hd.kings', '');
            var d = baye.ensureData();
            var list = [];
            var n = hdReadNum(d, 'g_hdKingCount');
            if (!n && hdEngineReady() && typeof _bayeHdGetKingCount === 'function') {
                try { n = Number(_bayeHdGetKingCount()) || 0; } catch (e) {}
            }
            var i;
            for (i = 0; i < n && i < 128; i++) {
                var id = hdReadNum(d && d.g_hdKingIds, i);
                if (d && d.g_hdKingIds && d.g_hdKingIds[i] != null && (id === 0 || !id)) {
                    id = Number(d.g_hdKingIds[i]);
                }
                var name = '';
                try {
                    name = baye.getPersonName(id) || '';
                } catch (e) {}
                if ((!name || name === '-') && d && typeof d.g_hdKingNames === 'string') {
                    name = d.g_hdKingNames.slice(i * 8, (i + 1) * 8).replace(/\s+$/g, '');
                }
                if ((!name || name === '-') && d && d.g_hdKingNames) {
                    name = hdDecodeSlice(d.g_hdKingNames, i * 8, 8);
                }
                list.push({ id: id, name: name });
            }
            return {
                count: n,
                index: hdReadNum(d, 'g_hdKingIndex'),
                currentId: hdReadNum(d, 'g_hdKingId'),
                kings: list
            };
        },
        fight: function () {
            hdNote('hd.fight', '');
            var d = baye.ensureData();
            var result = '';
            if (d && typeof d.g_hdFightResultGbk === 'string') {
                result = d.g_hdFightResultGbk;
            }
            if (!result && d && d.g_hdFightResultGbk) {
                result = hdDecodeSlice(d.g_hdFightResultGbk, 0, 64);
            }
            var tip = '';
            if (d && typeof d.g_hdFightTipGbk === 'string') {
                tip = d.g_hdFightTipGbk;
            }
            if (!tip && d && d.g_hdFightTipGbk) {
                tip = hdDecodeSlice(d.g_hdFightTipGbk, 0, 16);
            }
            return {
                active: hdReadNum(d, 'g_hdFightActive'),
                over: hdReadNum(d, 'g_hdFightOver'),
                wait: hdReadNum(d, 'g_hdFightWait'),
                phase: hdReadNum(d, 'g_hdFightPhase'),
                aimType: hdReadNum(d, 'g_hdFightAimType'),
                inputKind: hdReadNum(d, 'g_hdFightInputKind'),
                inputSeq: hdReadNum(d, 'g_hdFightInputSeq'),
                actorIndex: hdReadNum(d, 'g_hdFightActor'),
                tip: tip,
                skip: hdReadNum(d, 'g_hdFightSkip'),
                result: result,
                cityIndex: d && d.g_FgtParam ? hdReadNum(d.g_FgtParam, 'CityIndex') : null,
                mapW: hdReadNum(d, 'g_MapWid'),
                mapH: hdReadNum(d, 'g_MapHgt'),
                bout: hdReadNum(d, 'g_FgtBoutCnt'),
                boutMax: hdReadNum(d, 'g_FgtBoutMax'),
                focusX: hdReadNum(d, 'g_FoucsX'),
                focusY: hdReadNum(d, 'g_FoucsY')
            };
        },
        /* 词典原版 g_CitiesCount / citiesCount 恒为地图座数（38），不是己方城。
         * 攻城后看 ownedCount 与各城 Belong（马腾=playerBelong）。 */
        realm: function () {
            hdNote('hd.realm', '');
            var d = baye.ensureData();
            var king = hdReadNum(d, 'g_PlayerKing');
            var belong = (king != null && isFinite(king)) ? (king + 1) : 0;
            var n = hdCityLimit();
            if ((!n || n > 64) && d && d.g_Cities && d.g_Cities.length) {
                n = Math.min(Number(d.g_Cities.length) || 0, 64);
            }
            var cities = [];
            var owned = 0;
            var i;
            var playerName = '';
            try {
                if (belong && typeof baye.getPersonNameByID === 'function') {
                    playerName = baye.getPersonNameByID(belong) || '';
                }
            } catch (e) {}
            for (i = 0; i < n; i++) {
                var city = d && d.g_Cities ? d.g_Cities[i] : null;
                var ownerInfo = baye.cityOwnership(city ? city.Belong : null);
                var b = ownerInfo.value;
                var name = '';
                var owner = '';
                try {
                    if (typeof baye.getCityName === 'function') {
                        name = baye.getCityName(i) || '';
                    }
                } catch (e2) {}
                owner = ownerInfo.kind === 'owned' ? ownerInfo.name : '';
                var mine = !!(belong && b && b === belong);
                if (mine) {
                    owned += 1;
                }
                cities.push({ i: i, name: name, belong: b, owner: owner, owned: mine, ownership: ownerInfo });
            }
            return {
                playerKing: king,
                playerBelong: belong,
                playerName: playerName,
                ownedCount: owned,
                total: n,
                cities: cities
            };
        },
        cityLinks: function (city) {
            hdNote('hd.cityLinks', city);
            var d = baye.ensureData();
            city = city == null ? NaN : Number(city);
            if (isFinite(city) && city >= 0 && city < hdCityLimit() &&
                hdEngineReady() && typeof _bayeHdLoadCityLinks === 'function') {
                try { _bayeHdLoadCityLinks(city); } catch (e) {}
            } else if (isFinite(city)) {
                hdNote('hd.cityLinks', 'skip:' + city);
            }
            var links = [];
            var i;
            if (d && d.g_hdCityLinks) {
                for (i = 0; i < 8; i++) {
                    var id = hdReadNum(d.g_hdCityLinks, i);
                    if (!id && d.g_hdCityLinks[i] != null) {
                        id = Number(d.g_hdCityLinks[i]);
                    }
                    if (id && id !== 0xff && id < 0xfffe) {
                        var idx = id - 1;
                        var limit = hdCityLimit();
                        if (idx < 0 || !limit || idx >= limit) {
                            continue;
                        }
                        var name = '';
                        try { name = baye.getCityName(idx) || ''; } catch (e) {}
                        links.push({ id: id, index: idx, name: name });
                    }
                }
            }
            return links;
        },
        march: function () {
            hdNote('hd.march', '');
            var d = baye.ensureData();
            return {
                pick: hdReadNum(d, 'g_hdMapPick'),
                battlePick: hdReadNum(d, 'g_hdBattlePick'),
                mapCity: hdReadNum(d, 'g_hdMapCity'),
                mapInputSeq: hdReadNum(d, 'g_hdMapInputSeq'),
                ok: hdReadNum(d, 'g_hdMarchOk'),
                city: hdReadNum(d, 'g_hdMarchCity'),
                obj: hdReadNum(d, 'g_hdMarchObj'),
                time: hdReadNum(d, 'g_hdMarchTime'),
                seq: hdReadNum(d, 'g_hdMarchSeq'),
                phase: hdReadNum(d, 'g_hdMarchPhase'),
                session: hdReadNum(d, 'g_hdMarchSession'),
                origin: hdReadNum(d, 'g_hdMarchOrigin'),
                selected: hdReadNum(d, 'g_hdMarchSelected'),
                inputSeq: hdReadNum(d, 'g_hdMarchInputSeq')
            };
        },
        qty: function () {
            hdNote('hd.qty', '');
            var d = baye.ensureData();
            return {
                active: hdReadNum(d, 'g_hdQtyActive'),
                value: hdReadNum(d, 'g_hdQtyValue'),
                min: hdReadNum(d, 'g_hdQtyMin'),
                max: hdReadNum(d, 'g_hdQtyMax'),
                protocol: !!(d && d.g_hdQtySession != null && d.g_hdQtyInputSeq != null &&
                    d.g_hdQtyLastKey != null && d.g_hdQtyCursor != null &&
                    d.g_hdQtyStep != null && d.g_hdQtyReady != null),
                session: hdReadNum(d, 'g_hdQtySession'),
                inputSeq: hdReadNum(d, 'g_hdQtyInputSeq'),
                lastKey: hdReadNum(d, 'g_hdQtyLastKey'),
                cursor: hdReadNum(d, 'g_hdQtyCursor'),
                step: hdReadNum(d, 'g_hdQtyStep'),
                ready: hdReadNum(d, 'g_hdQtyReady')
            };
        },
        toolName: function (id) {
            try {
                if (typeof baye.getToolName === 'function') {
                    return baye.getToolName(id) || '';
                }
            } catch (e) {}
            return '';
        },
        personArmType: function (id) {
            if (hdIntegerValue(id, 0, hdPersonLimit() - 1) == null || !hdEngineReady() ||
                typeof _bayeHdGetArmType !== 'function') { return null; }
            try { return hdIntegerValue(_bayeHdGetArmType(id), 0, 255); }
            catch (e) { return null; }
        },
        toolDetails: function (id) {
            if (hdIntegerValue(id, 0, baye.getToolCount() - 1) == null || !hdEngineReady() ||
                typeof _bayeHdGetToolField !== 'function' || !window.BayeHdLibIdentity ||
                typeof BayeHdLibIdentity.read !== 'function' || typeof BayeHdLibIdentity.isCurrent !== 'function') { return null; }
            var identity;
            try { identity = BayeHdLibIdentity.read(); } catch (e) { return null; }
            if (!identity || identity.status !== 'ready' ||
                identity.sha256 !== '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e' ||
                !BayeHdLibIdentity.isCurrent(identity)) { return null; }
            if (baye.hooks && (baye.hooks.getToolPropertyTitle || baye.hooks.getToolPropertyValue)) { return null; }
            var generation = hdDetailNum(baye.ensureData(), 'g_hdDetailGeneration');
            if (!generation) { return null; }
            var fields = ['useFlag', 'attack', 'iq', 'move', 'arm', 'changeAttackRange'], result =
                {index: id, name: baye.getToolName(id), standard: true, generation: generation};
            try {
                for (var i = 0; i < fields.length; i++) {
                    var value = hdIntegerValue(_bayeHdGetToolField(id, i), 0, 255);
                    if (value == null) { return null; }
                    result[fields[i]] = value;
                }
            } catch (e) { return null; }
            return BayeHdLibIdentity.isCurrent(identity) &&
                hdDetailNum(baye.ensureData(), 'g_hdDetailGeneration') === generation ? result : null;
        },
        goods: function () {
            var d = baye.ensureData(), count = hdDetailNum(d, 'g_hdGoodsPropertyCount', 255), rows = [];
            if (count != null) {
                for (var i = 0; i < count; i++) {
                    var flags = hdDetailNum(d && d.g_hdGoodsPropertyFlags, i, 3);
                    rows.push({index: i, title: flags != null && (flags & 1) ?
                        hdDecodeSlice(d.g_hdGoodsPropertyTitles, i * 128, 128) : '',
                        value: flags != null && (flags & 2) ?
                        hdDecodeSlice(d.g_hdGoodsPropertyValues, i * 128, 128) : '', captured: flags === 3});
                }
            }
            return {active: hdDetailNum(d, 'g_hdGoodsActive', 1),
                complete: hdDetailNum(d, 'g_hdGoodsComplete', 1), custom: hdDetailNum(d, 'g_hdGoodsCustom', 1),
                generation: hdDetailNum(d, 'g_hdGoodsGeneration'), detailGeneration: hdDetailNum(d, 'g_hdDetailGeneration'),
                menuSeq: hdDetailNum(d, 'g_hdGoodsMenuSeq'), index: hdDetailNum(d, 'g_hdGoodsIndex', 65535),
                tool: hdDetailNum(d, 'g_hdGoodsTool', 65535), propertyCount: count,
                pageStart: hdDetailNum(d, 'g_hdGoodsPageStart', 255), pageEnd: hdDetailNum(d, 'g_hdGoodsPageEnd', 255),
                name: hdDetailText(d, 'g_hdGoodsNameGbk', 32), properties: rows};
        },
        view: function () {
            var d = baye.ensureData(), n = hdDetailNum(d, 'g_hdViewRowCount', 10),
                count = hdDetailNum(d, 'g_hdViewPointCount', 20), rows = [], points = [];
            var seq = hdDetailNum(d, 'g_hdViewSeq'), generation = hdDetailNum(d, 'g_hdViewGeneration'),
                inputSeq = hdDetailNum(d, 'g_hdViewInputSeq');
            for (var i = 0; n != null && i < n; i++) {
                rows.push({ slot: hdDetailNum(d.g_hdViewRowSlots, i, 19),
                    personIndex: hdDetailNum(d.g_hdViewRowPersons, i, 65534),
                    arms: hdDetailNum(d.g_hdViewRowArms, i, 65535),
                    name: hdDecodeSlice(d.g_hdViewRowNames, i * 32, 32),
                    text: hdDecodeSlice(d.g_hdViewRowText, i * 64, 64) });
            }
            for (var p = 0; count != null && p < count; p++) {
                points.push({ slot: hdDetailNum(d.g_hdViewPointSlots, p, 19),
                    personIndex: hdDetailNum(d.g_hdViewPointPersons, p, 65534),
                    x: hdDetailNum(d.g_hdViewPointX, p, 255), y: hdDetailNum(d.g_hdViewPointY, p, 255),
                    state: hdDetailNum(d.g_hdViewPointState, p, 255) });
            }
            var byteBuffers = n === 0 || n != null && d && typeof d.g_hdViewRowNames === 'object' &&
                d.g_hdViewRowNames != null && typeof d.g_hdViewRowText === 'object' && d.g_hdViewRowText != null;
            var current = byteBuffers && seq === hdDetailNum(d, 'g_hdViewSeq') && generation === hdDetailNum(d, 'g_hdViewGeneration') &&
                inputSeq === hdDetailNum(d, 'g_hdViewInputSeq') && generation === hdDetailNum(d, 'g_hdDetailGeneration');
            var value = { protocolVersion: hdDetailNum(d, 'g_hdViewProtocolVersion', 255),
                active: hdDetailNum(d, 'g_hdViewActive', 1), complete: current ? hdDetailNum(d, 'g_hdViewComplete', 1) : 0,
                custom: hdDetailNum(d, 'g_hdViewCustom', 1), seq: seq, generation: generation,
                detailGeneration: hdDetailNum(d, 'g_hdDetailGeneration'), inputSeq: inputSeq,
                force: hdDetailNum(d, 'g_hdViewForce', 1), pageStart: hdDetailNum(d, 'g_hdViewPageStart', 10),
                pageSize: hdDetailNum(d, 'g_hdViewPageSize', 255), totalCount: hdDetailNum(d, 'g_hdViewTotalCount', 10),
                rowCount: n, width: hdDetailNum(d, 'g_hdViewMapWidth', 255), height: hdDetailNum(d, 'g_hdViewMapHeight', 255),
                days: hdDetailNum(d, 'g_hdViewDays', 65535), playerMode: hdDetailNum(d, 'g_hdViewPlayerMode', 255),
                foodKnown: hdDetailNum(d, 'g_hdViewFoodKnown', 1), food: hdDetailNum(d, 'g_hdViewFood', 65535),
                leaderPerson: hdDetailNum(d, 'g_hdViewLeader', 65534),
                title: hdDetailText(d, 'g_hdViewTitleGbk', 64), daysText: hdDetailText(d, 'g_hdViewDaysGbk', 64),
                positionsText: hdDetailText(d, 'g_hdViewPositionsGbk', 64), factionText: hdDetailText(d, 'g_hdViewFactionGbk', 64),
                foodText: hdDetailText(d, 'g_hdViewFoodGbk', 64), rows: current ? rows : [], points: current ? points : [] };
            if (seq !== hdDetailNum(d, 'g_hdViewSeq') || generation !== hdDetailNum(d, 'g_hdViewGeneration') ||
                inputSeq !== hdDetailNum(d, 'g_hdViewInputSeq') || generation !== hdDetailNum(d, 'g_hdDetailGeneration')) {
                value.complete = 0; value.rows = []; value.points = [];
            }
            return value;
        },
        miniMap: function () {
            var d = baye.ensureData(), seq = hdDetailNum(d, 'g_hdMiniMapSeq'),
                generation = hdDetailNum(d, 'g_hdMiniMapGeneration'), inputSeq = hdDetailNum(d, 'g_hdMiniMapInputSeq');
            var value = { protocolVersion: hdDetailNum(d, 'g_hdMiniMapProtocolVersion', 255),
                active: hdDetailNum(d, 'g_hdMiniMapActive', 1), complete: hdDetailNum(d, 'g_hdMiniMapComplete', 1),
                custom: hdDetailNum(d, 'g_hdMiniMapCustom', 1), defaultDraw: hdDetailNum(d, 'g_hdMiniMapDefaultDraw', 1),
                seq: seq, generation: generation, detailGeneration: hdDetailNum(d, 'g_hdDetailGeneration'), mapInputSeq: inputSeq,
                resourceId: hdDetailNum(d, 'g_hdMiniMapResourceId', 65535), imageIndex: hdDetailNum(d, 'g_hdMiniMapImageIndex', 65535),
                width: hdDetailNum(d, 'g_hdMiniMapWidth', 65535), height: hdDetailNum(d, 'g_hdMiniMapHeight', 65535),
                mask: hdDetailNum(d, 'g_hdMiniMapMask', 1), cursorX: hdDetailNum(d, 'g_hdMiniMapCursorX', 255),
                cursorY: hdDetailNum(d, 'g_hdMiniMapCursorY', 255), viewX: hdDetailNum(d, 'g_hdMiniMapViewX', 255),
                viewY: hdDetailNum(d, 'g_hdMiniMapViewY', 255), viewWidth: hdDetailNum(d, 'g_hdMiniMapViewWidth', 255),
                viewHeight: hdDetailNum(d, 'g_hdMiniMapViewHeight', 255), city1: hdDetailNum(d, 'g_hdMiniMapCity1', 255) };
            if (seq !== hdDetailNum(d, 'g_hdMiniMapSeq') || generation !== hdDetailNum(d, 'g_hdMiniMapGeneration') ||
                inputSeq !== hdDetailNum(d, 'g_hdMiniMapInputSeq') || generation !== hdDetailNum(d, 'g_hdDetailGeneration')) value.complete = 0;
            return value;
        },
        help: function () {
            hdNote('hd.help', '');
            var d = baye.ensureData();
            var text = '';
            if (d && typeof d.g_hdHelpGbk === 'string') {
                text = d.g_hdHelpGbk;
            }
            if (!text && d && d.g_hdHelpGbk) {
                text = hdDecodeSlice(d.g_hdHelpGbk, 0, 1024);
            }
            var fields = [];
            for (var i = 0; i < 10; i++) { fields.push(hdDetailNum(d && d.g_hdHelpFields, i, 65535)); }
            return {
                active: hdReadNum(d, 'g_hdHelpActive'),
                seq: hdReadNum(d, 'g_hdHelpSeq'),
                text: text,
                protocolVersion: hdDetailNum(d, 'g_hdHelpProtocolVersion', 255),
                generation: hdDetailNum(d, 'g_hdHelpGeneration'), detailGeneration: hdDetailNum(d, 'g_hdDetailGeneration'),
                inputSeq: hdDetailNum(d, 'g_hdHelpInputSeq'), kind: hdDetailNum(d, 'g_hdHelpKind', 2),
                complete: hdDetailNum(d, 'g_hdHelpComplete', 1), person: hdDetailNum(d, 'g_hdHelpPerson', 65535),
                slot: hdDetailNum(d, 'g_hdHelpSlot', 255), x: hdDetailNum(d, 'g_hdHelpX', 255),
                y: hdDetailNum(d, 'g_hdHelpY', 255), terrain: hdDetailNum(d, 'g_hdHelpTerrain', 255),
                name: hdDetailText(d, 'g_hdHelpNameGbk', 32), arm: hdDetailText(d, 'g_hdHelpArmGbk', 16),
                state: hdDetailText(d, 'g_hdHelpStateGbk', 32), levelMax: hdDetailNum(d, 'g_hdHelpLevelMax', 1), fields: fields
            };
        },
        skills: function () {
            hdNote('hd.skills', '');
            var d = baye.ensureData();
            var count = hdReadNum(d, 'g_hdSkillCount') || 0;
            var names = [];
            var ids = [];
            var i;
            for (i = 0; i < count && i < 10; i++) {
                var id = 0;
                if (d && d.g_hdSkillIds) {
                    id = hdReadNum(d.g_hdSkillIds, i);
                    if (!id && d.g_hdSkillIds[i] != null) {
                        id = Number(d.g_hdSkillIds[i]);
                    }
                }
                ids.push(id);
                var name = '';
                if (d && d.g_hdSkillNameBytes) {
                    name = hdDecodeSlice(d.g_hdSkillNameBytes, i * 8, 8);
                }
                if (!name && d && d.g_hdSkillNames) {
                    name = hdDecodeSlice(d.g_hdSkillNames, i * 8, 8);
                }
                name = String(name || '').replace(/\u0000/g, '').replace(/\s+$/g, '');
                if (!name && id && typeof baye.getSkillName === 'function') {
                    try { name = baye.getSkillName(id - 1) || baye.getSkillName(id) || ''; } catch (e) {}
                    name = String(name || '').replace(/\u0000/g, '').replace(/\s+$/g, '');
                }
                names.push(name);
            }
            return {
                active: hdReadNum(d, 'g_hdSkillActive'),
                count: count,
                ids: ids,
                names: names
            };
        },
        movie: function () {
            hdNote('hd.movie', '');
            var d = baye.ensureData();
            return {
                active: hdReadNum(d, 'g_hdMovieActive'),
                id: hdReadNum(d, 'g_hdMovieId')
            };
        },
        spe: function () {
            hdNote('hd.spe', '');
            var d = baye.ensureData();
            var version = hdReadNum(d, 'g_hdSpeProtocolVersion'), nativeFrames = version === 2;
            function frames(name) {
                var bytes = [];
                for (var i = 0; i < 32; i++) {
                    var raw = hdReadNum(d && d[name], i);
                    bytes.push(raw == null ? null : raw);
                }
                return bytes;
            }
            function frame(name) { var value = hdReadNum(d, name); return value == null || value === 0xffff ? null : value; }
            function origin(name) { var value = hdReadNum(d, name); return value >= 0x8000 ? value - 0x10000 : value; }
            var length = hdReadNum(d, 'g_hdSpeResourceLength'), fingerprint = hdReadNum(d, 'g_hdSpeResourceFingerprint');
            var known = hdReadNum(d, 'g_hdSpeContextKnown') === 1;
            var actor = hdReadNum(d, 'g_hdSpeActorIndex'), target = hdReadNum(d, 'g_hdSpeTargetIndex');
            var endReasons = { 1: 'complete', 2: 'key', 3: 'missing-resource', 4: 'invalid-resource', 5: 'reset' };
            return {
                active: nativeFrames ? hdReadNum(d, 'g_hdSpeActive') : (hdReadNum(d, 'g_hdSpeActive') || hdReadNum(d, 'g_hdMovieActive')),
                id: nativeFrames ? hdReadNum(d, 'g_hdSpeId') : (hdReadNum(d, 'g_hdSpeId') || hdReadNum(d, 'g_hdMovieId')),
                kind: nativeFrames ? hdReadNum(d, 'g_hdSpeKind') : (hdReadNum(d, 'g_hdSpeKind') || (hdReadNum(d, 'g_hdMovieActive') ? 1 : 0)),
                x: nativeFrames ? origin('g_hdSpeOriginX') : hdReadNum(d, 'g_hdSpeX'),
                y: nativeFrames ? origin('g_hdSpeOriginY') : hdReadNum(d, 'g_hdSpeY'),
                startFrm: hdReadNum(d, 'g_hdSpeStartFrm'),
                endFrm: hdReadNum(d, 'g_hdSpeEndFrm'),
                seq: hdReadNum(d, 'g_hdSpeSeq'),
                protocolVersion: version,
                generation: hdReadNum(d, 'g_hdSpeGeneration'),
                eventId: hdReadNum(d, 'g_hdSpeEventId'),
                parentEventId: hdReadNum(d, 'g_hdSpeParentEventId'),
                depth: hdReadNum(d, 'g_hdSpeDepth'),
                resourceIndex: hdReadNum(d, 'g_hdSpeResourceIndex'),
                count: hdReadNum(d, 'g_hdSpeCount'),
                picmax: hdReadNum(d, 'g_hdSpePicmax'),
                resourceLength: length,
                resourceFingerprint: length > 0 && fingerprint != null ? 'fnv1a32:' + ('00000000' + (fingerprint >>> 0).toString(16)).slice(-8) + ':' + length : null,
                frameIndex: frame('g_hdSpeFrameIndex'),
                frameValid: hdReadNum(d, 'g_hdSpeFrameValid') === 1,
                protocolValid: hdReadNum(d, 'g_hdSpeProtocolValid') === 1,
                commitSeq: hdReadNum(d, 'g_hdSpeCommitSeq'),
                keyflag: hdReadNum(d, 'g_hdSpeKeyflag'),
                skipEligible: hdReadNum(d, 'g_hdSpeSkipEligible') === 1,
                visibleFrames: frames('g_hdSpeVisibleFrames'),
                contextKnown: known,
                skillId: known ? hdReadNum(d, 'g_hdSpeSkillId') : null,
                actorIndex: known && actor >= 0 && actor < 20 ? actor : null,
                targetIndex: known && target >= 0 && target < 20 ? target : null,
                lastEnd: { eventId: hdReadNum(d, 'g_hdSpeLastEndedId'), reason: endReasons[hdReadNum(d, 'g_hdSpeEndReason')] || null,
                    key: hdReadNum(d, 'g_hdSpeEndKey') },
                display: { generation: hdReadNum(d, 'g_hdSpeDisplayGeneration'), eventId: hdReadNum(d, 'g_hdSpeDisplayEventId'),
                    commitSeq: hdReadNum(d, 'g_hdSpeDisplayCommitSeq'), frameIndex: frame('g_hdSpeDisplayFrameIndex'),
                    frameValid: hdReadNum(d, 'g_hdSpeDisplayFrameValid') === 1, visibleFrames: frames('g_hdSpeDisplayVisibleFrames') }
            };
        },
        maker: function () {
            hdNote('hd.maker', '');
            var d = baye.ensureData(), limits = {
                ProtocolVersion: 255, Active: 1, Phase: 2, Custom: 1, ReturnEligible: 1, SourceValid: 1,
                Generation: 0xffffffff, Session: 0xffffffff, InputSeq: 0xffffffff, EventId: 0xffffffff, CommitSeq: 0xffffffff,
                ResourceFingerprint: 0xffffffff, ResourceLength: 0xffffffff, ResourceIndex: 0xffff,
                Count: 0xffff, Picmax: 0xffff, FrameIndex: 0xffff, OriginX: 0xffff, OriginY: 0xffff,
                StartFrm: 255, EndFrm: 255, EndReason: 5, EndKey: 255
            }, values = {}, bits = [], stable = true, completeBits = true, name, i;
            for (name in limits) if (Object.prototype.hasOwnProperty.call(limits, name))
                values[name] = hdDetailNum(d, 'g_hdMaker' + name, limits[name]);
            for (i = 0; i < 32; i++) {
                bits.push(hdDetailNum(d && d.g_hdMakerVisibleFrames, i, 255));
                if (bits[i] == null) completeBits = false;
            }
            // A snapshot must never mix a retired display with a newer wait.
            for (name in limits) if (Object.prototype.hasOwnProperty.call(limits, name) &&
                values[name] !== hdDetailNum(d, 'g_hdMaker' + name, limits[name])) stable = false;
            var neutral = { protocolVersion: values.ProtocolVersion, active: false, phase: null,
                generation: null, session: null, inputSeq: null, custom: false, returnEligible: false,
                sourceValid: false, speId: 6, resourceIndex: null, count: null, picmax: null, x: null, y: null,
                startFrm: null, endFrm: null, resourceLength: null, resourceFingerprint: null,
                scrollEnd: { reason: null, key: null }, display: { generation: null, eventId: null, commitSeq: null,
                    frameIndex: null, frameValid: false, visibleFrames: [] } };
            if (!stable || values.ProtocolVersion !== 1) return neutral;
            var owner = values.Active === 1 && values.Generation > 0 && values.Session > 0 && values.InputSeq > 0 &&
                (values.Phase === 1 || values.Phase === 2) && values.Custom != null && values.ReturnEligible != null;
            var source = owner && values.Phase === 2 && values.SourceValid === 1 && values.Custom === 0 && completeBits &&
                values.EventId > 0 && values.CommitSeq > 0 && values.ResourceLength > 0 && values.ResourceFingerprint != null &&
                values.ResourceIndex === 0 && values.Count > 0 && values.Count <= 255 && values.Picmax > 0 && values.Picmax <= 255 &&
                values.OriginX != null && values.OriginY != null && values.StartFrm != null && values.EndFrm != null &&
                values.EndFrm >= values.StartFrm && values.EndFrm < values.Count && values.FrameIndex != null &&
                values.FrameIndex >= values.StartFrm && values.FrameIndex <= values.EndFrm &&
                (values.EndReason === 1 || values.EndReason === 2);
            for (i = 0; source && i < 256; i++) if ((bits[i >> 3] & (1 << (i & 7))) &&
                (i < values.StartFrm || i > values.EndFrm || i >= values.Count)) source = false;
            function origin(value) { return value == null ? null : value >= 0x8000 ? value - 0x10000 : value; }
            return { protocolVersion: values.ProtocolVersion, active: owner,
                phase: owner ? { 1: 'scroll', 2: 'hold' }[values.Phase] : null,
                generation: values.Generation, session: values.Session, inputSeq: values.InputSeq,
                custom: values.Custom === 1, returnEligible: owner && values.Phase === 2 && values.ReturnEligible === 1,
                sourceValid: source, speId: 6, resourceIndex: values.ResourceIndex, count: values.Count, picmax: values.Picmax,
                x: origin(values.OriginX), y: origin(values.OriginY), startFrm: values.StartFrm, endFrm: values.EndFrm,
                resourceLength: values.ResourceLength,
                resourceFingerprint: values.ResourceLength > 0 && values.ResourceFingerprint != null ?
                    'fnv1a32:' + ('00000000' + values.ResourceFingerprint.toString(16)).slice(-8) + ':' + values.ResourceLength : null,
                scrollEnd: { reason: { 1: 'complete', 2: 'key', 3: 'missing-resource', 4: 'invalid-resource', 5: 'reset' }[values.EndReason] || null,
                    key: values.EndKey },
                display: { generation: values.Generation, eventId: values.EventId, commitSeq: values.CommitSeq,
                    frameIndex: values.FrameIndex == null || values.FrameIndex === 0xffff ? null : values.FrameIndex,
                    frameValid: source, visibleFrames: bits } };
        },
        menuItems: function () {
            hdNote('hd.menuItems', '');
            var d = baye.ensureData();
            var itemLen = hdReadNum(d, 'g_hdMenuItemLen');
            var count = hdReadNum(d, 'g_hdMenuCount');
            if (itemLen > 64) {
                itemLen = 64;
            }
            if (count > 2000) {
                count = 2000;
            }
            var names = [];
            var i;
            if (itemLen && count && d && d.g_hdMenuBytes) {
                for (i = 0; i < count; i++) {
                    names.push(hdDecodeSlice(d.g_hdMenuBytes, i * itemLen, itemLen));
                }
            } else if (d && typeof d.g_hdMenuGbk === 'string' && count) {
                var raw = d.g_hdMenuGbk;
                var step = Math.max(1, Math.floor(raw.length / count));
                for (i = 0; i < count; i++) {
                    names.push(raw.slice(i * step, (i + 1) * step).replace(/\s+$/g, ''));
                }
            }
            var kind = hdReadNum(d, 'g_hdMenuKind'), seq = hdReadNum(d, 'g_hdMenuSeq'),
                generation = hdDetailNum(d, 'g_hdDetailGeneration'), ids = [],
                limit = kind === 3 ? hdPersonLimit() : kind === 4 ? baye.getToolCount() : 0;
            var idsValid = hdReadNum(d, 'g_hdMenuActive') === 1 && (kind === 3 || kind === 4) &&
                count > 0 && count === names.length && count === hdDetailNum(d, 'g_hdMenuIdsCount', 2000) &&
                generation > 0 && generation === hdDetailNum(d, 'g_hdMenuIdsGeneration') &&
                seq > 0 && seq === hdDetailNum(d, 'g_hdMenuIdsSeq') && kind === hdDetailNum(d, 'g_hdMenuIdsKind', 4);
            if (idsValid) {
                for (i = 0; i < count; i++) {
                    var id = hdDetailNum(d && d.g_hdMenuIds, i, limit - 1);
                    if (id == null) { idsValid = false; break; }
                    ids.push(id);
                }
            }
            if (!idsValid) { ids = []; }
            var packedNames = names.slice();
            // Fixed native eight-byte observation slots can cut a GBK name in
            // half. Resolve the full native label only after the actual IDs
            // are proven; never recover identity by comparing names.
            if (idsValid) {
                var nameKey = JSON.stringify([generation, seq, kind, ids, packedNames]);
                if (!hdMenuNamesCache || hdMenuNamesCache.key !== nameKey) {
                    var fullNames = packedNames.slice();
                    for (i = 0; i < ids.length; i++) {
                        var fullName = '';
                        try { fullName = kind === 3 ? baye.getPersonName(ids[i]) : baye.getToolName(ids[i]); } catch (e) {}
                        if (typeof fullName === 'string' && fullName && fullName !== '-') { fullNames[i] = fullName; }
                    }
                    hdMenuNamesCache = {key: nameKey, names: fullNames};
                }
                if (generation === hdDetailNum(d, 'g_hdDetailGeneration') &&
                    seq === hdDetailNum(d, 'g_hdMenuSeq') && kind === hdDetailNum(d, 'g_hdMenuKind', 4) &&
                    hdDetailNum(d, 'g_hdMenuActive', 1) === 1 &&
                    generation === hdDetailNum(d, 'g_hdMenuIdsGeneration') &&
                    seq === hdDetailNum(d, 'g_hdMenuIdsSeq') &&
                    count === hdDetailNum(d, 'g_hdMenuCount', 2000) && count === hdDetailNum(d, 'g_hdMenuIdsCount', 2000) &&
                    kind === hdDetailNum(d, 'g_hdMenuIdsKind', 4) && ids.every(function (id, position) {
                        return id === hdDetailNum(d && d.g_hdMenuIds, position, limit - 1);
                    })) {
                    names = hdMenuNamesCache.names.slice();
                } else { idsValid = false; ids = []; hdMenuNamesCache = null; }
            } else { hdMenuNamesCache = null; }
            return {
                active: hdReadNum(d, 'g_hdMenuActive'),
                context: hdReadNum(d, 'g_hdMenuContext'),
                kind: kind,
                seq: seq,
                itemLen: itemLen,
                count: count,
                index: hdReadNum(d, 'g_hdMenuIndex'),
                names: names, packedNames: packedNames, ids: ids, idsValid: !!idsValid,
                generation: generation, detailGeneration: generation
            };
        }
    };
}
