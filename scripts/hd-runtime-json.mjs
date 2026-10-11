// Bounded JSON serialization for large saved reports; never truncates arrays or samples values.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

function writeValuesAtomicSync(filename, values, { maxChunkBytes = 65536, space = 2 } = {}) {
    if (!Number.isInteger(maxChunkBytes) || maxChunkBytes < 16 || maxChunkBytes > 1048576) throw new RangeError('Invalid maxChunkBytes');
    const output = path.resolve(filename);
    if (fs.existsSync(output)) throw new Error('Refusing to overwrite ' + output);
    const temporary = output + '.partial-' + crypto.randomBytes(8).toString('hex');
    let fd = fs.openSync(temporary, 'wx'), bytes = 0, writes = 0, largestWriteBytes = 0, count = 0;
    const digest = crypto.createHash('sha256'), ancestors = new Set();
    const indent = typeof space === 'string' ? space.slice(0, 10) : ' '.repeat(Math.min(10, Math.max(0, Math.trunc(Number(space) || 0))));
    const pending = Buffer.allocUnsafe(maxChunkBytes); let pendingBytes = 0;
    const flush = () => {
        if (!pendingBytes) return;
        const part = pending.subarray(0, pendingBytes); let used = 0;
        while (used < part.length) { const n = fs.writeSync(fd, part, used, part.length - used); if (n <= 0) throw new Error('No JSON write progress'); used += n; }
        digest.update(part); bytes += part.length; writes++; largestWriteBytes = Math.max(largestWriteBytes, part.length); pendingBytes = 0;
    };
    const emit = text => {
        const data = Buffer.from(text); let used = 0;
        while (used < data.length) {
            const n = Math.min(data.length - used, maxChunkBytes - pendingBytes);
            data.copy(pending, pendingBytes, used, used + n); used += n; pendingBytes += n;
            if (pendingBytes === maxChunkBytes) flush();
        }
    };
    const string = text => {
        emit('"');
        for (let i = 0; i < text.length;) {
            let end = Math.min(text.length, i + 8192);
            if (end < text.length && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff && text.charCodeAt(end) >= 0xdc00 && text.charCodeAt(end) <= 0xdfff) end--;
            emit(JSON.stringify(text.slice(i, end)).slice(1, -1)); i = end;
        }
        emit('"');
    };
    const normalized = (holder, key) => {
        let v = holder[key];
        if (v !== null && ['object', 'function', 'bigint'].includes(typeof v)) { const toJSON = v.toJSON; if (typeof toJSON === 'function') v = toJSON.call(v, key); }
        if (v instanceof Number || v instanceof String || v instanceof Boolean) v = v.valueOf();
        if (Object.prototype.toString.call(v) === '[object BigInt]') throw new TypeError('Do not know how to serialize a BigInt');
        return v;
    };
    const line = depth => { if (indent) emit('\n' + indent.repeat(depth)); };
    const write = (v, depth) => {
        if (v === null) return emit('null');
        if (typeof v === 'string') return string(v);
        if (typeof v === 'number' || typeof v === 'boolean') return emit(JSON.stringify(v));
        if (typeof v !== 'object') throw new TypeError('Value is not JSON serializable');
        if (ancestors.has(v)) throw new TypeError('Converting circular structure to JSON');
        ancestors.add(v);
        const array = Array.isArray(v); emit(array ? '[' : '{'); let count = 0;
        const keys = array ? null : Object.keys(v), length = array ? v.length : keys.length;
        for (let i = 0; i < length; i++) {
            const key = array ? String(i) : keys[i]; let item = normalized(v, key);
            if (item === undefined || typeof item === 'function' || typeof item === 'symbol') { if (!array) continue; item = null; }
            if (count++) emit(','); line(depth + 1);
            if (!array) { string(key); emit(indent ? ': ' : ':'); }
            write(item, depth + 1);
        }
        if (count) line(depth); emit(array ? ']' : '}'); ancestors.delete(v);
    };
    try {
        for (const value of values) { write(normalized({ '': value }, ''), 0); emit('\n'); count++; }
        flush(); fs.fsyncSync(fd); fs.closeSync(fd); fd = null;
        // Exclusive link publishes only a closed complete file and fails if the target exists.
        fs.linkSync(temporary, output); fs.unlinkSync(temporary);
        return { path: filename, bytes, sha256: digest.digest('hex'), count, maxChunkBytes, largestWriteBytes, writes };
    } catch (error) {
        if (fd !== null) fs.closeSync(fd);
        error.partialFile = temporary; throw error; // Keep incomplete evidence; never publish it as result.json.
    }
}

export function writeJsonAtomicSync(filename, value, options) {
    return writeValuesAtomicSync(filename, [value], options);
}

export function writeReportAtomicSync(filename, report, { campaignThresholdItems = 128, maxChunkBytes = 65536 } = {}) {
    if (fs.existsSync(filename)) throw new Error('Refusing to overwrite ' + filename);
    if (!Number.isInteger(campaignThresholdItems) || campaignThresholdItems < 1) throw new RangeError('Invalid campaignThresholdItems');
    const observations = report.campaignObservations;
    if (!Array.isArray(observations) || observations.length < campaignThresholdItems) return { main: writeJsonAtomicSync(filename, report, { maxChunkBytes }), campaignObservations: null };
    const sidecar = filename + '.campaignObservations.ndjson';
    const saved = writeValuesAtomicSync(sidecar, observations, { maxChunkBytes, space: 0 });
    const reference = { schemaVersion: 1, storage: 'ndjson', ref: path.basename(sidecar), count: saved.count, bytes: saved.bytes, sha256: saved.sha256,
        scope: 'All original campaignObservations values, one complete JSON record per line, in original order. This field is a sidecar reference, not an inline array.' };
    // The original in-memory report is untouched. All other fields retain their original structure.
    const main = writeJsonAtomicSync(filename, { ...report, campaignObservations: reference }, { maxChunkBytes });
    return { main, campaignObservations: { ...reference, maxChunkBytes: saved.maxChunkBytes, largestWriteBytes: saved.largestWriteBytes } };
}

// Fully drain this iterator to validate count/bytes/SHA; never JSON.parse the whole sidecar.
export async function* readCampaignObservations(directory, reference) {
    if (reference?.storage !== 'ndjson' || path.basename(reference.ref) !== reference.ref) throw new Error('Invalid campaign sidecar reference');
    const source = fs.createReadStream(path.join(directory, reference.ref)), hash = crypto.createHash('sha256'); let bytes = 0, count = 0;
    source.on('data', b => { hash.update(b); bytes += b.length; });
    const lines = readline.createInterface({ input: source, crlfDelay: Infinity });
    try { for await (const line of lines) { if (!line.length) throw new Error('Empty NDJSON record'); count++; yield JSON.parse(line); } }
    finally { lines.close(); source.destroy(); }
    if (count !== reference.count || bytes !== reference.bytes || hash.digest('hex') !== reference.sha256) throw new Error('Campaign sidecar count/bytes/SHA mismatch');
}
