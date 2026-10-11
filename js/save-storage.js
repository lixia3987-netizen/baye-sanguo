// Shared local save storage for the game and import/export pages.
// A localStorage transaction uses one old-slot journal as its visibility
// barrier. Reads keep using that complete snapshot until both files and their
// metadata are written and the journal is removed. A failed rollback therefore
// remains safe after a reload, even when the storage backend keeps rejecting
// writes. The committed sango files retain their original names and hex format.
var BayeSaveStorage = (function () {
    var pending = null;
    var lastError = null;
    var identitySource = null, identityValue = null;
    var suffixes = ['', '.lib', '.name', '.lib-id'];
    function filename(index) { return 'baye//data//sango' + index + '.sav'; }
    function slotOf(key) {
        var match = /^baye\/+data\/+sango([0-7])\.sav$/.exec(key);
        return match ? Math.floor(Number(match[1]) / 2) : -1;
    }
    function journalKey(slot) { return 'baye/save-transaction/' + slot; }
    function keys(slot) {
        var result = [];
        for (var half = 0; half < 2; half++) {
            for (var i = 0; i < suffixes.length; i++) result.push(filename(slot * 2 + half) + suffixes[i]);
        }
        return result;
    }
    function error(code, cause) {
        lastError = { code: code, message: code === 'storage' ? '存储空间不足或不可写，原存档已保留。' : '存档数据不完整。' };
        if (cause && cause.name) lastError.name = String(cause.name);
        return false;
    }
    function readJournal(slot) {
        var raw = window.localStorage.getItem(journalKey(slot));
        if (!raw) return null;
        var record = JSON.parse(raw), list = keys(slot);
        if (!record || record.version !== 1 || record.slot !== slot || !record.values) throw new Error('Invalid save transaction');
        for (var i = 0; i < list.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(record.values, list[i]) ||
                (record.values[list[i]] !== null && typeof record.values[list[i]] !== 'string')) throw new Error('Invalid save transaction');
        }
        return record;
    }
    function committed(key) {
        var base = key.replace(/\.(lib-id|lib|name)$/, '');
        var slot = slotOf(base);
        if (slot >= 0) {
            var record = readJournal(slot);
            if (record) return record.values[key];
        }
        return window.localStorage.getItem(key);
    }
    function restore(record) {
        var list = keys(record.slot);
        for (var i = 0; i < list.length; i++) {
            var value = record.values[list[i]];
            if (value === null) window.localStorage.removeItem(list[i]);
            else window.localStorage.setItem(list[i], value);
        }
        window.localStorage.removeItem(journalKey(record.slot));
    }
    function identity() {
        if (typeof dynLib !== 'string' || !dynLib.length) return null;
        if (identitySource === dynLib) return identityValue;
        // Two independent 32-bit hashes plus length identify the exact loaded
        // LIB, including custom uploads which share the same path metadata.
        var first = 2166136261, second = 0x9e3779b9;
        for (var i = 0; i < dynLib.length; i++) {
            var code = dynLib.charCodeAt(i);
            first = Math.imul(first ^ code, 16777619);
            second = Math.imul(second ^ code, 2246822519);
        }
        identitySource = dynLib;
        identityValue = 'v1:' + dynLib.length + ':' + (first >>> 0).toString(16) + ':' + (second >>> 0).toString(16);
        return identityValue;
    }
    function libMatches(key) {
        var savedIdentity = committed(key + '.lib-id');
        var loadedIdentity = identity();
        if (savedIdentity && loadedIdentity && savedIdentity !== loadedIdentity) return false;
        var savedPath = committed(key + '.lib');
        var loadedPath = window.localStorage.getItem('baye/libpath');
        return !savedPath || savedPath === 'undefined' || savedPath === loadedPath;
    }
    function readFile(key) {
        try { return libMatches(key) ? committed(key) : null; }
        catch (cause) { error('storage', cause); return null; }
    }
    function prepare(slot, fourth, metadata) {
        if (pending || slot !== Math.floor(slot) || slot < 0 || slot > (fourth ? 3 : 2)) return error('invalid');
        lastError = null;
        try {
            var interrupted = readJournal(slot);
            if (interrupted) restore(interrupted);
            pending = { slot: slot, files: Object.create(null), lib: metadata.lib,
                name: metadata.name, identity: metadata.identity };
            return true;
        } catch (cause) { return error('storage', cause); }
    }
    function begin(slot) {
        try { return prepare(slot, false, { lib: window.localStorage.getItem('baye/libpath'),
            name: window.localStorage.getItem('baye/libname'), identity: identity() }); }
        catch (cause) { return error('storage', cause); }
    }
    function stage(key, value) {
        if (typeof value !== 'string' || !/^(?:[0-9a-fA-F]{2})*$/.test(value)) return error('invalid');
        var slot = slotOf(key);
        if (pending) {
            if (slot !== pending.slot || key !== filename(slot * 2) && key !== filename(slot * 2 + 1)) return error('invalid');
            pending.files[key] = value;
            return true;
        }
        // Existing single-file callers remain supported and receive errors.
        // The engine always uses the explicit two-file batch above.
        try {
            window.localStorage.setItem(key, value);
            var loaded = identity();
            if (loaded) window.localStorage.setItem(key + '.lib-id', loaded);
            return true;
        } catch (cause) { return error('storage', cause); }
    }
    function commit() {
        if (!pending) return error('invalid');
        var transaction = pending;
        pending = null;
        var first = filename(transaction.slot * 2), second = filename(transaction.slot * 2 + 1);
        if (!Object.prototype.hasOwnProperty.call(transaction.files, first) ||
            !Object.prototype.hasOwnProperty.call(transaction.files, second)) return error('invalid');
        var list = keys(transaction.slot), record = { version: 1, slot: transaction.slot, values: Object.create(null) };
        var journalWritten = false;
        try {
            for (var i = 0; i < list.length; i++) record.values[list[i]] = window.localStorage.getItem(list[i]);
            window.localStorage.setItem(journalKey(transaction.slot), JSON.stringify(record));
            journalWritten = true;
            for (var half = 0; half < 2; half++) {
                var key = filename(transaction.slot * 2 + half);
                window.localStorage.setItem(key, transaction.files[key]);
                var metadata = { '.lib': transaction.lib, '.name': transaction.name, '.lib-id': transaction.identity };
                for (var suffix in metadata) {
                    if (metadata[suffix] === null) window.localStorage.removeItem(key + suffix);
                    else window.localStorage.setItem(key + suffix, metadata[suffix]);
                }
            }
            window.localStorage.removeItem(journalKey(transaction.slot));
            lastError = null;
            return true;
        } catch (cause) {
            if (journalWritten) { try { restore(record); } catch (rollbackFailure) {} }
            return error('storage', cause);
        }
    }
    function abort() { pending = null; }
    function u16(hex, offset) { return parseInt(hex.slice(offset * 2, offset * 2 + 2), 16) + parseInt(hex.slice(offset * 2 + 2, offset * 2 + 4), 16) * 256; }
    function u32(hex, offset) { return (u16(hex, offset) + u16(hex, offset + 2) * 65536) >>> 0; }
    function byte(hex, offset) { return parseInt(hex.slice(offset * 2, offset * 2 + 2), 16); }
    function pairHeader(a, b, cityCount) {
        if (typeof a !== 'string' || typeof b !== 'string' ||
            !/^(?:[0-9a-fA-F]{2})+$/.test(a) || !/^(?:[0-9a-fA-F]{2})+$/.test(b) || a.length < 32) return null;
        var version = byte(a, 0), period = byte(a, 1), count = u16(a, 2);
        var fixed = 16 + count * 21 + (version >= 0x95 ? 4000 : 2000) + (version >= 0x94 ? 1 : 0);
        if (version < 0x90 || version > 0x95 || period < 1 || period > 4 || count < 1 || count > 2000 ||
            u16(a, 4) >= count || byte(a, 11) < 1 || byte(a, 11) > 12 || a.length / 2 < fixed) return null;
        if (version >= 0x94 && byte(a, fixed - 1) > 9) return null;
        if (version >= 0x95 && (a.length / 2 < fixed + 4 || u32(a, fixed) !== a.length / 2 - fixed - 4)) return null;
        if (a.length / 2 - fixed - (version >= 0x95 ? 4 : 0) > 8 * 1024 * 1024) return null;
        var base = 30 + (version >= 0x95 ? 600 : 300) + 200 * 14 + 4;
        var storedCities = (b.length / 2 - base) / 37;
        if (storedCities < 1 || storedCities > 255 || storedCities !== Math.floor(storedCities) ||
            cityCount && storedCities !== cityCount) return null;
        return { king: u16(a, 4), year: u16(a, 6), period: period };
    }
    function importSlot(slot, incoming) {
        if (!incoming || !pairHeader(incoming.sav0, incoming.sav1, 0)) return error('invalid');
        var metadata = {};
        for (var field of ['lib', 'name', 'identity']) {
            if (incoming[field] != null && typeof incoming[field] !== 'string') return error('invalid');
            metadata[field] = incoming[field] == null ? null : incoming[field];
        }
        if (!prepare(slot, true, metadata)) return false;
        pending.files[filename(slot * 2)] = incoming.sav0;
        pending.files[filename(slot * 2 + 1)] = incoming.sav1;
        return commit();
    }
    function inspectSlot(slot) {
        var result = { slot: slot, status: 'empty', canLoad: false, bytes: 0 };
        if (slot !== Math.floor(slot) || slot < 0 || slot > 3) { result.status = 'invalid'; return result; }
        try {
            var first = filename(slot * 2), second = filename(slot * 2 + 1);
            var a = committed(first), b = committed(second);
            result.libName = committed(first + '.name') || '';
            result.bytes = (typeof a === 'string' ? a.length / 2 : 0) + (typeof b === 'string' ? b.length / 2 : 0);
            if (!a && !b) return result;
            if (!a || !b) { result.status = 'incomplete'; result.error = '缺少存档文件'; return result; }
            if (!libMatches(first) || !libMatches(second)) { result.status = 'wrong-lib'; result.error = '存档属于其他游戏版本'; return result; }
            result.status = 'invalid';
            var cityCount = window.baye && window.baye.data && window.baye.data.g_engineConfig && Number(window.baye.data.g_engineConfig.citiesCount);
            var header = pairHeader(a, b, cityCount);
            if (!header) return result;
            result.status = 'ready'; result.canLoad = true;
            result.king = header.king; result.year = header.year; result.period = header.period;
            return result;
        } catch (cause) { result.status = 'invalid'; result.error = '无法读取存档'; return result; }
    }
    return { inspectSlot: inspectSlot, slots: function () { return [0, 1, 2, 3].map(inspectSlot); },
        validatePair: function (first, second) { return !!pairHeader(first, second, 0); },
        readFile: readFile, readMetadata: committed, importSlot: importSlot,
        begin: begin, stage: stage, commit: commit, abort: abort,
        lastError: function () { return lastError ? Object.assign({}, lastError) : null; } };
})();
window.BayeSaveStorage = BayeSaveStorage;
function bayeSaveBatchBegin(slot) { return BayeSaveStorage.begin(slot); }
function bayeSaveBatchCommit() { return BayeSaveStorage.commit(); }
function bayeSaveBatchAbort() { BayeSaveStorage.abort(); }
