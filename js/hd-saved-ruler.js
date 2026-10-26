/* Saved headers use zero-based people in their own period's original LIB. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var RESOURCES = [62,70,71,72], cache = null, busy = false, epoch = 0;
    function uint(value,max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function key(value) { return value && JSON.stringify([value.status,value.sha256,value.byteLength,value.generation]); }
    function parse(hex) {
        if (typeof hex !== 'string' || hex.length !== 414390 || !/^[0-9a-f]+$/i.test(hex)) { return null; }
        var bytes = new Uint8Array(207195), names = [], decoder = new TextDecoder('gbk',{fatal:true});
        for (var i=0;i<bytes.length;i++) { bytes[i] = parseInt(hex.slice(i*2,i*2+2),16); }
        function u16(at) {
            if (!uint(at,bytes.length-2)) { throw Error('LIB U16 boundary'); }
            return bytes[at]+bytes[at+1]*256;
        }
        function u32(at) {
            if (!uint(at,bytes.length-4)) { throw Error('LIB U32 boundary'); }
            return (u16(at)+u16(at+2)*65536)>>>0;
        }
        RESOURCES.forEach(function (resource) {
            var start = u32((resource-1)*4);
            if (!start || start > bytes.length-14) { throw Error('LIB resource address'); }
            var length = u32(start), count = u16(start+6), directory = 14+200*8;
            // The exact original has 200 variable-length names per period.
            if (u16(start+4) !== resource || count !== 200 || u32(start+8) !== 0 ||
                bytes[start+12] !== 0 || bytes[start+13] !== 0 || length < directory ||
                length > bytes.length-start) { throw Error('LIB name resource'); }
            var table = [];
            for (var id=0;id<200;id++) {
                var offset = u32(start+14+id*8), size = u32(start+18+id*8);
                if (offset < directory || offset > length || size > length-offset || size > 31) {
                    throw Error('LIB name item');
                }
                var payload = bytes.subarray(start+offset,start+offset+size), zero = payload.indexOf(0);
                var text = decoder.decode(zero < 0 ? payload : payload.subarray(0,zero));
                if (text.indexOf('\ufffd') >= 0) { throw Error('LIB name text'); }
                table.push(text.trim() ? text : null);
            }
            names.push(table);
        });
        return {source:hex,names:names};
    }
    function read(period,personId) {
        if (!uint(period,4) || !period || !uint(personId,199)) { return null; }
        if (busy) { epoch++; cache = null; return null; }
        busy = true;
        var ticket = ++epoch;
        try {
            var api = global.BayeHdLibIdentity, lib = global.dynLib;
            if (!api || typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { cache = null; return null; }
            var identify = api.read, current = api.isCurrent, identity = identify.call(api), stamp = key(identity);
            if (!identity || identity.status !== 'ready' || identity.sha256 !== SHA || identity.byteLength !== 207195 ||
                !uint(identity.generation,0xffffffff) || !identity.generation || current.call(api,identity) !== true) {
                cache = null; return null;
            }
            var candidate = cache && cache.source === lib ? cache : parse(lib);
            if (!candidate) { cache = null; return null; }
            var name = candidate.names[period-1][personId], again = identify.call(api), valid = current.call(api,identity);
            if (valid !== true || stamp !== key(again) || stamp !== key(identity) ||
                global.BayeHdLibIdentity !== api || api.read !== identify || api.isCurrent !== current ||
                global.dynLib !== lib || ticket !== epoch) { cache = null; return null; }
            cache = candidate;
            return name;
        } catch (e) { cache = null; return null; }
        finally { busy = false; }
    }
    global.BayeHdSavedRuler = {read:read};
})(window);
