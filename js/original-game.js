// The public game entrances load the dictionary original, independently of
// old version preferences or the shared LIB cache. Save files are untouched.
(function (global) {
    'use strict';
    var path = 'libs/dat-mod.lib', title = '三国霸业-词典原版';
    var expectedBytes = 207195;
    var expectedSha = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var loading = null;

    function hex(bytes) {
        var result = '';
        for (var i = 0; i < bytes.length; i++) result += bytes[i].toString(16).padStart(2, '0');
        return result;
    }
    // Web Crypto is unavailable on some LAN HTTP mobile previews. The same
    // SHA-256 verification still applies there, using the standard algorithm.
    function softwareSha(bytes) {
        var k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
        var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
        var padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
        padded.set(bytes); padded[bytes.length] = 128;
        var view = new DataView(padded.buffer);
        view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
        view.setUint32(padded.length - 4, (bytes.length * 8) >>> 0);
        var w = new Int32Array(64), rotate = function (x, n) { return (x >>> n) | (x << (32 - n)); };
        for (var offset = 0; offset < padded.length; offset += 64) {
            for (var i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4);
            for (var j = 16; j < 64; j++) {
                var x = w[j - 15], y = w[j - 2];
                w[j] = (w[j - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
                    w[j - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) | 0;
            }
            var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],v=h[7];
            for (var n = 0; n < 64; n++) {
                var t1 = (v + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^((~e)&g)) + k[n] + w[n]) | 0;
                var t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + ((a&b)^(a&c)^(b&c))) | 0;
                v=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
            }
            var result = [a,b,c,d,e,f,g,v];
            for (var m = 0; m < 8; m++) h[m] = (h[m] + result[m]) | 0;
        }
        return h.map(function (v) { return (v >>> 0).toString(16).padStart(8, '0'); }).join('');
    }
    function digest(bytes) {
        if (global.crypto && global.crypto.subtle) {
            return global.crypto.subtle.digest('SHA-256', bytes).then(function (result) { return hex(new Uint8Array(result)); });
        }
        return Promise.resolve(softwareSha(bytes));
    }
    function cache(method, value) {
        return new Promise(function (resolve) {
            var store, settled = false;
            var timer = global.setTimeout(function () { finish(null); }, 4000);
            function finish(result) {
                if (settled) return;
                settled = true; global.clearTimeout(timer);
                try { if (store && store.close) store.close(); } catch (e) {}
                resolve(result);
            }
            try {
                store = new global.IdbKvStore('baye');
                if (store.on) store.on('error', function () {});
                if (method === 'get') {
                    // The SDK creates an unhandled transaction.done rejection
                    // on open failure unless the readonly transaction has its
                    // own completion callback as well as the get callback.
                    store.transaction('readonly', function (error) { if (error) finish(null); })
                        .get('lib', function (error, data) { finish(error ? null : data); });
                }
                else store.set('lib', value, function (error) { finish(!error); });
            } catch (e) { finish(null); }
        });
    }
    function cachedBytes(value) {
        if (typeof value !== 'string' || value.length !== expectedBytes) return null;
        var bytes = new Uint8Array(value.length);
        for (var i = 0; i < value.length; i++) {
            var code = value.charCodeAt(i);
            if (code > 255) return null;
            bytes[i] = code;
        }
        return bytes;
    }
    async function fetchOriginal() {
        var controller = new global.AbortController();
        var timer = global.setTimeout(function () { controller.abort(); }, 15000);
        try {
            var response = await global.fetch(path, { cache: 'no-cache', signal: controller.signal });
            if (!response.ok) throw new Error('原版资源下载失败（' + response.status + '）');
            var bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length !== expectedBytes || await digest(bytes) !== expectedSha) throw new Error('原版资源校验失败');
            return bytes;
        } finally { global.clearTimeout(timer); }
    }
    function selectOriginal(data) {
        var storage = global.localStorage, oldPath = storage.getItem('baye/libpath'), oldName = storage.getItem('baye/libname');
        try {
            storage.setItem('baye/libname', title);
            storage.setItem('baye/libpath', path);
        } catch (error) {
            try {
                if (oldName === null) storage.removeItem('baye/libname'); else storage.setItem('baye/libname', oldName);
                if (oldPath === null) storage.removeItem('baye/libpath'); else storage.setItem('baye/libpath', oldPath);
            } catch (restoreError) {}
            throw new Error('无法保存原版启动设置，请检查浏览器存储空间');
        }
        global.dynLib = data;
        return data;
    }
    async function prepare() {
        var bytes = cachedBytes(await cache('get'));
        if (bytes && await digest(bytes) === expectedSha) return selectOriginal(hex(bytes));
        bytes = await fetchOriginal();
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        await cache('set', binary);
        return selectOriginal(hex(bytes));
    }
    global.BayeOriginalGame = Object.freeze({ path: path, title: title, sha256: expectedSha,
        saveIdentity: 'v1:414390:1d36da77:1e9c0477',
        load: function (ready, failed) {
            if (!loading) loading = prepare().catch(function (error) { loading = null; throw error; });
            return loading.then(function (data) { if (ready) ready(data); return data; }, function (error) {
                if (failed) failed(error);
                throw error;
            });
        }
    });
})(window);
