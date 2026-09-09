import { describe, it, expect } from 'vitest';
import { buildWaveform } from './waveform.js';

describe('buildWaveform', () => {
    it('returns [] for empty or invalid input', () => {
        expect(buildWaveform(new Float32Array(0))).toEqual([]);
        expect(buildWaveform(null)).toEqual([]);
        expect(buildWaveform(new Float32Array(10), 0)).toEqual([]);
    });

    it('produces exactly `bars` values', () => {
        const data = new Float32Array(1000).map((_, i) => Math.sin(i));
        expect(buildWaveform(data, 40)).toHaveLength(40);
    });

    it('normalizes so the loudest bar is 1 and all values are in [0,1]', () => {
        const data = new Float32Array([0.1, 0.1, 0.5, 0.5, 0.25, 0.25]);
        const bars = buildWaveform(data, 3);
        expect(Math.max(...bars)).toBeCloseTo(1, 5);
        for (const b of bars) { expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(1); }
    });

    it('returns all zeros for pure silence (no divide-by-zero)', () => {
        const bars = buildWaveform(new Float32Array(200), 20);
        expect(bars).toHaveLength(20);
        expect(bars.every((b) => b === 0)).toBe(true);
    });
});
