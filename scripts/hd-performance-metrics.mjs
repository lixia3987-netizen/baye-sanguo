export function summarizeSamples(samples) {
    if (!Array.isArray(samples) || samples.some(value => !Number.isFinite(value) || value < 0)) {
        throw new TypeError('Performance samples must be finite non-negative numbers');
    }
    if (!samples.length) return { count: 0, min: null, p50: null, p95: null, max: null };
    const sorted = samples.slice().sort((a, b) => a - b);
    const rank = percentile => sorted[Math.ceil(percentile * sorted.length) - 1];
    return { count: sorted.length, min: sorted[0], p50: rank(0.5), p95: rank(0.95), max: sorted.at(-1) };
}

export function summarizeFrames(timestamps, startedAt, endedAt) {
    if (!Array.isArray(timestamps) || !Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) {
        throw new TypeError('A frame window must have a positive measured duration');
    }
    if (timestamps.some((time, i) => !Number.isFinite(time) || time < startedAt || time > endedAt || (i && time < timestamps[i - 1]))) {
        throw new TypeError('Frame timestamps must be ordered within the measured window');
    }
    const intervals = timestamps.slice(1).map((time, i) => time - timestamps[i]);
    return { frames: timestamps.length, durationMs: endedAt - startedAt,
        callbacksPerSecond: timestamps.length * 1000 / (endedAt - startedAt), intervalsMs: summarizeSamples(intervals) };
}
