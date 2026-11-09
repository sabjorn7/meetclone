// Read-only reducer. Never retains SDP, ICE, addresses, tokens or raw stats.
const finite = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
const nonnegative = x => finite(x) !== null && x >= 0 ? x : null;
export const STATS_MAX_AGE_MS = 10000;
export const LAYER_STATES = { sending: 'Передаётся', disabled: 'Encoding отключён', idle: 'Кадры не отправляются', stale: 'Данные устарели', unknown: 'Неизвестно' };
const labels = { q: 'LOW (q)', h: 'MEDIUM (h)', f: 'HIGH (f)' };
export function summarizeVideoStats(report, previous = new Map(), { encodings = [], now = performance.timeOrigin + performance.now(), maxAgeMs = STATS_MAX_AGE_MS } = {}) {
    const next = new Map(), layers = [], matched = new Set();
    const values = [...(report?.values?.() || [])];
    const age = t => finite(t) !== null && now >= t - 500 ? Math.max(0, now - t) : null;
    for (const s of values) {
        if (s.type !== 'outbound-rtp' || (s.kind !== 'video' && s.mediaType !== 'video') || s.isRemote || !s.id) continue;
        const codec = report.get?.(s.codecId)?.mimeType?.toLowerCase();
        if (codec && /\/(rtx|red|ulpfec|flexfec)/.test(codec)) continue;
        let encoding = s.rid ? encodings.find(e => e.rid === s.rid) : undefined;
        if (!s.rid && Number.isInteger(s.encodingIndex)) encoding = encodings[s.encodingIndex];
        if (!s.rid && !encoding && encodings.length === 1) encoding = encodings[0];
        if (encoding) matched.add(encoding);
        const rid = s.rid || encoding?.rid || null;
        const old = previous.get(s.id);
        const same = old && old.rid === rid && old.ssrc === s.ssrc;
        const reset = ['bytesSent', 'framesSent'].some(k => nonnegative(s[k]) !== null && nonnegative(old?.[k]) !== null && s[k] < old[k]);
        const dt = same && !reset && finite(s.timestamp) !== null ? s.timestamp - old.timestamp : 0;
        const delta = field => dt > 0 && dt <= maxAgeMs && nonnegative(s[field]) !== null && nonnegative(old?.[field]) !== null && s[field] >= old[field] ? s[field] - old[field] : null;
        const bytes = delta('bytesSent'), frames = delta('framesSent');
        const sampleAgeMs = age(s.timestamp), fresh = sampleAgeMs !== null && sampleAgeMs <= maxAgeMs;
        const active = s.active === false || encoding?.active === false ? false : s.active === true || encoding?.active === true ? true : null;
        const state = !fresh ? 'stale' : active === false ? 'disabled' : frames === null ? 'unknown' : frames > 0 ? 'sending' : 'idle';
        let remote = s.remoteId ? report.get?.(s.remoteId) : values.find(r => r.type === 'remote-inbound-rtp' && r.localId === s.id);
        if (remote?.type !== 'remote-inbound-rtp' || (remote.localId && remote.localId !== s.id) || (remote.ssrc != null && s.ssrc != null && remote.ssrc !== s.ssrc) || (remote.kind || remote.mediaType) !== 'video') remote = null;
        const remoteAgeMs = age(remote?.timestamp), remoteFresh = remoteAgeMs !== null && remoteAgeMs <= maxAgeMs;
        const feedback = fresh && remoteFresh && active !== false;
        const fraction = nonnegative(remote?.fractionLost);
        next.set(s.id, { rid, ssrc: s.ssrc, timestamp: s.timestamp, bytesSent: finite(s.bytesSent), framesSent: finite(s.framesSent) });
        layers.push({ id: s.id, rid, label: labels[rid] || (rid ? `RID ${rid}` : 'Слой без RID'), state, active,
            width: state === 'sending' ? nonnegative(s.frameWidth) : null, height: state === 'sending' ? nonnegative(s.frameHeight) : null,
            fps: fresh && frames !== null ? frames * 1000 / dt : null, bitrate: fresh && bytes !== null ? bytes * 8000 / dt : null,
            sampleAgeMs, remoteAgeMs, remoteFresh: feedback,
            jitterMs: feedback && nonnegative(remote?.jitter) !== null ? remote.jitter * 1000 : null,
            rttMs: feedback && nonnegative(remote?.roundTripTime) !== null ? remote.roundTripTime * 1000 : null,
            lossPercent: feedback && fraction !== null && fraction <= 1 ? fraction * 100 : null,
            limitation: state === 'sending' && ['none', 'cpu', 'bandwidth', 'other'].includes(s.qualityLimitationReason) ? s.qualityLimitationReason : null });
    }
    for (const e of encodings) if (!matched.has(e)) layers.push({ id: `encoding:${e.rid ?? encodings.indexOf(e)}`, rid: e.rid || null, label: labels[e.rid] || 'Слой без RID', state: e.active === false ? 'disabled' : 'unknown', active: e.active ?? null });
    layers.sort((a,b) => ['q','h','f'].indexOf(a.rid) - ['q','h','f'].indexOf(b.rid) || a.id.localeCompare(b.id));
    return { layers, previous: next };
}
