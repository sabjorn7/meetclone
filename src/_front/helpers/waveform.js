// Downsample decoded PCM samples to a small set of normalized bar amplitudes
// for a Telegram-style voice waveform. Pure + synchronous so it's unit-testable.
//
// `channelData` is a Float32Array (one channel from an AudioBuffer). Returns an
// array of `bars` numbers in [0,1] — peak amplitude per bucket, normalized so the
// loudest bar is 1 (a fully silent clip returns all zeros).
export function buildWaveform(channelData, bars = 56) {
    const n = channelData ? channelData.length : 0;
    if (!n || bars <= 0) return [];
    const block = Math.max(1, Math.floor(n / bars));
    const peaks = new Array(bars);
    let max = 0;
    for (let i = 0; i < bars; i++) {
        const start = i * block;
        const end = Math.min(start + block, n);
        let peak = 0;
        for (let j = start; j < end; j++) {
            const v = Math.abs(channelData[j]);
            if (v > peak) peak = v;
        }
        peaks[i] = peak;
        if (peak > max) max = peak;
    }
    const norm = max > 0 ? 1 / max : 0;
    for (let i = 0; i < bars; i++) peaks[i] *= norm;
    return peaks;
}
