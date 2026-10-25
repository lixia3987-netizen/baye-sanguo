/** Identity of the LIB bytes actually loaded by the engine.
 * Asset consumers decide which identities they support. A preferred URL is
 * never proof of content, and unrelated engine hooks do not change identity.
 */
(function (global) {
    'use strict';
    var MAX_BYTES = 32 * 1024 * 1024;

    function createIdentity(options) {
        options = options || {};
        var getHex = options.getHex || function () { return global.dynLib; };
        var initialized = false, source, generation = 0, listeners = [];
        var state = snapshot('unavailable', null, 0, 'lib-unavailable');

        function snapshot(status, hash, size, reason) {
            return Object.freeze({ status: status, generation: generation,
                sha256: hash, byteLength: size, reason: reason });
        }
        function publish(status, hash, size, reason) {
            state = snapshot(status, hash, size, reason);
            var notification = state, pendingListeners = listeners.slice();
            for (var i = 0; i < pendingListeners.length; i += 1) {
                try { pendingListeners[i](notification); } catch (e) { /* Independent consumers. */ }
            }
        }
        function currentSource(ticket, hex) {
            if (ticket !== generation) { return false; }
            // Retire an in-flight digest even when nobody polled after a LIB switch.
            read();
            return ticket === generation && source === hex;
        }
        function digest(bytes) {
            if (options.digest) { return options.digest(bytes); }
            return global.crypto && global.crypto.subtle ?
                global.crypto.subtle.digest('SHA-256', bytes) : null;
        }
        function read() {
            var hex;
            try { hex = getHex(); } catch (e) {
                if (!initialized || state.reason !== 'lib-read-failed') {
                    initialized = true; source = undefined; generation += 1;
                    publish('error', null, 0, 'lib-read-failed');
                }
                return state;
            }
            if (initialized && source === hex && state.reason !== 'lib-read-failed') { return state; }
            initialized = true; source = hex; generation += 1;
            if (hex == null || hex === '') {
                publish('unavailable', null, 0, 'lib-unavailable');
                return state;
            }
            if (typeof hex !== 'string' || hex.length % 2 !== 0) {
                publish('invalid', null, 0, 'invalid-lib-data');
                return state;
            }
            if (hex.length / 2 > MAX_BYTES) {
                publish('invalid', null, 0, 'lib-too-large');
                return state;
            }
            if (!/^[0-9a-f]+$/i.test(hex)) {
                publish('invalid', null, 0, 'invalid-lib-data');
                return state;
            }
            var size = hex.length / 2, bytes = new Uint8Array(size);
            for (var i = 0; i < size; i += 1) { bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16); }
            var ticket = generation;
            publish('pending', null, size, 'lib-verifying');
            if (ticket !== generation) { return state; }
            try {
                var pending = digest(bytes);
                if (!pending || typeof pending.then !== 'function') {
                    if (currentSource(ticket, hex)) {
                        publish('error', null, size, 'lib-verification-unavailable');
                    }
                } else {
                    // Use crypto's native promise. The engine replaces window.Promise.
                    pending.then(function (buffer) {
                        if (!currentSource(ticket, hex)) { return; }
                        if (Object.prototype.toString.call(buffer) !== '[object ArrayBuffer]' || buffer.byteLength !== 32) {
                            publish('error', null, size, 'lib-verification-failed');
                            return;
                        }
                        var digestBytes = new Uint8Array(buffer), hash = '';
                        for (var d = 0; d < digestBytes.length; d += 1) {
                            hash += ('0' + digestBytes[d].toString(16)).slice(-2);
                        }
                        publish('ready', hash, size, '');
                    }, function () {
                        if (currentSource(ticket, hex)) {
                            publish('error', null, size, 'lib-verification-failed');
                        }
                    });
                }
            } catch (e) {
                if (currentSource(ticket, hex)) { publish('error', null, size, 'lib-verification-failed'); }
            }
            return state;
        }
        function subscribe(callback) {
            if (typeof callback !== 'function') { throw new TypeError('Identity subscriber must be a function'); }
            listeners.push(callback);
            var subscribed = true;
            return function () {
                if (!subscribed) { return; }
                subscribed = false;
                var index = listeners.indexOf(callback);
                if (index !== -1) { listeners.splice(index, 1); }
            };
        }
        function isCurrent(candidate) {
            var latest = read();
            return !!candidate && candidate.generation === latest.generation &&
                candidate.status === latest.status && candidate.sha256 === latest.sha256;
        }
        return Object.freeze({ read: read, subscribe: subscribe, isCurrent: isCurrent });
    }

    var identity = createIdentity();
    global.BayeHdLibIdentity = Object.freeze({ read: identity.read,
        subscribe: identity.subscribe, isCurrent: identity.isCurrent, createIdentity: createIdentity });
})(window);
