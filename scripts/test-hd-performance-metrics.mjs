import assert from 'node:assert/strict';
import { summarizeSamples, summarizeFrames } from './hd-performance-metrics.mjs';

assert.deepEqual(summarizeSamples([]), { count: 0, min: null, p50: null, p95: null, max: null });
const samples = [100, 1, 10, 2, 3, 4, 5, 6, 7, 8];
assert.deepEqual(summarizeSamples(samples), { count: 10, min: 1, p50: 5, p95: 100, max: 100 });
assert.equal(samples[0], 100, 'summaries preserve raw sample order');
assert.deepEqual(summarizeSamples([0]), { count: 1, min: 0, p50: 0, p95: 0, max: 0 });
assert.throws(() => summarizeSamples([NaN]), TypeError);
assert.throws(() => summarizeSamples([-1]), TypeError);
assert.throws(() => summarizeSamples([Infinity]), TypeError);
const frames = summarizeFrames([10, 30, 50], 0, 100);
assert.equal(frames.callbacksPerSecond, 30, 'rate uses measured wall window, not interval average');
assert.equal(frames.intervalsMs.p95, 20);
assert.deepEqual(summarizeFrames([], 0, 100).intervalsMs, summarizeSamples([]));
assert.throws(() => summarizeFrames([50, 10], 0, 100), TypeError);
assert.throws(() => summarizeFrames([110], 0, 100), TypeError);
assert.throws(() => summarizeFrames([], 10, 10), TypeError);
console.log('HD performance metrics: 13 checks passed');
