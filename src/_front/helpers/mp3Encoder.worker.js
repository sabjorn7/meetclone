// Web Worker: encode mono PCM (Float32) → MP3 (universal, plays in every browser
// incl. Safari). Runs off the main thread so the UI stays responsive on long clips.
import { Mp3Encoder } from '@breezystack/lamejs';

function toInt16(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

self.onmessage = (e) => {
    const { pcm, sampleRate, kbps = 64 } = e.data; // pcm: mono Float32Array (downmixed on main thread)
    try {
        const enc = new Mp3Encoder(1, sampleRate, kbps);
        const samples = toInt16(pcm);
        const BLOCK = 1152; // MPEG frame size
        const chunks = [];
        for (let i = 0; i < samples.length; i += BLOCK) {
            const buf = enc.encodeBuffer(samples.subarray(i, i + BLOCK));
            if (buf.length) chunks.push(buf);
        }
        const tail = enc.flush();
        if (tail.length) chunks.push(tail);
        let total = 0;
        for (const c of chunks) total += c.length;
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { out.set(c, off); off += c.length; }
        self.postMessage({ ok: true, mp3: out.buffer }, [out.buffer]);
    } catch (err) {
        self.postMessage({ ok: false, error: String(err) });
    }
};
