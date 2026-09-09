import { getAudioContext, decodeAudio } from '@/_front/helpers/voicePlayback.js';

// Decode a recorded audio Blob (webm/opus from Chrome, mp4/aac from Safari, …)
// and re-encode to universal MP3 (mono, 64 kbps) so it plays in EVERY browser —
// fixing the Chrome↔Safari codec incompatibility. Decoding reuses the same Web
// Audio path the waveform player uses. Encoding runs in a worker.
//
// THROWS on failure so the caller can fall back to the original recording
// (which at least plays in the recording browser).
export async function encodeBlobToMp3(blob) {
    const ctx = getAudioContext();
    if (!ctx) throw new Error('no AudioContext');
    const buf = await decodeAudio(ctx, await blob.arrayBuffer());

    // downmix to mono
    const ch = buf.numberOfChannels;
    const len = buf.length;
    let pcm;
    if (ch <= 1) {
        pcm = buf.getChannelData(0).slice();
    } else {
        pcm = new Float32Array(len);
        for (let c = 0; c < ch; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < len; i++) pcm[i] += d[i] / ch;
        }
    }

    const worker = new Worker(new URL('./mp3Encoder.worker.js', import.meta.url), { type: 'module' });
    try {
        const mp3 = await new Promise((resolve, reject) => {
            worker.onmessage = (e) => (e.data.ok ? resolve(e.data.mp3) : reject(new Error(e.data.error)));
            worker.onerror = (e) => reject(e.error || new Error('mp3 worker error'));
            worker.postMessage({ pcm, sampleRate: buf.sampleRate, kbps: 64 }, [pcm.buffer]);
        });
        return new Blob([mp3], { type: 'audio/mpeg' });
    } finally {
        worker.terminate();
    }
}
