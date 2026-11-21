import { getSupabase } from '../chrome/headerAccount.js';
import { publicObjectHref } from './internalChatLinks.js';

const SPECS = {
    course: { table: 'course', select: 'id,slug,Title,Decription,cover,ModStatus,Buy', filters: { ModStatus: 'eq.Опубликовано', Buy: 'eq.true' }, public: r => r.ModStatus === 'Опубликовано' && r.Buy === true, title: 'Title', description: 'Decription', image: 'cover' },
    event: { table: 'events', select: 'id,slug,title,description,cover_url,status,starts_at', filters: { status: 'eq.published' }, public: r => r.status === 'published', title: 'title', description: 'description', image: 'cover_url' },
    club: { table: 'clubs', select: 'id,title,short_descr,label,active', filters: { active: 'eq.true' }, public: r => r.active === true, title: 'title', description: 'short_descr', image: 'label' },
    stream: { table: 'streams', select: 'id,title,description,cover_url,hidden,visibility,status', filters: { hidden: 'eq.false', visibility: 'eq.public' }, public: r => r.hidden === false && r.visibility === 'public', title: 'title', description: 'description', image: 'cover_url' },
    profile: { table: 'users', select: 'id,Name,Photo,Description,is_deleted', filters: { is_deleted: 'eq.false' }, public: r => r.is_deleted === false, title: 'Name', description: 'Description', image: 'Photo' },
};
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function plain(value, max) {
    return typeof value === 'string' ? value.slice(0, 6000).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
export function publicPreviewImage(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
        const u = new URL(value);
        // Only existing public Storage paths, never signed/private URLs or arbitrary hosts.
        if (u.protocol !== 'https:' || u.hostname !== 'sb.meetgu.ru' || u.port || u.username || u.password || u.search || u.hash || !u.pathname.startsWith('/storage/v1/object/public/')) return null;
        return u.href;
    } catch { return null; }
}
export function normalizePreview(target, row) {
    const spec = SPECS[target.type];
    if (!spec || !row || !UUID.test(row.id) || !spec.public(row)) return null;
    if ((target.field === 'id' ? row.id.toLowerCase() : row.slug) !== target.value) return null;
    const title = plain(row[spec.title], 150);
    if (!title) return null;
    const data = { type: target.type, href: publicObjectHref(target.type, row.id), title, description: plain(row[spec.description], 240), image: publicPreviewImage(row[spec.image]) };
    if (target.type === 'event' && typeof row.starts_at === 'string' && Number.isFinite(Date.parse(row.starts_at))) data.startsAt = new Date(row.starts_at).toISOString();
    const states = { scheduled: 'Запланирована', live: 'Идёт эфир', ended: 'Завершена' };
    if (target.type === 'stream' && Object.hasOwn(states, row.status)) data.status = states[row.status];
    return Object.freeze(data); // Never cache the raw row, identity, cookies or bearer session.
}
function anonymousKey() {
    const sb = getSupabase();
    const key = sb?.supabaseKey || sb?.auth?.headers?.apikey;
    if (typeof key !== 'string') return null;
    try {
        const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload)).role === 'anon' ? key : null;
    } catch { return null; }
}
export async function fetchPublicPreview(target, { signal, fetcher = globalThis.fetch } = {}) {
    const key = anonymousKey();
    const spec = SPECS[target.type];
    if (!spec || !key || !['id', 'slug'].includes(target.field) || (target.field === 'slug' && !['course', 'event'].includes(target.type))) return null;
    const params = new URLSearchParams({ select: spec.select, limit: '1', [target.field]: `eq.${target.value}`, ...spec.filters });
    const response = await fetcher(`/sb/rest/v1/${spec.table}?${params}`, {
        method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal,
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    // Bound response buffering as well as the normalized cache (large rich descriptions).
    let rows;
    if (response.body?.getReader) {
        const reader = response.body.getReader(), chunks = [];
        let size = 0;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > 262144) { await reader.cancel(); return null; }
                chunks.push(value);
            }
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
            rows = JSON.parse(new TextDecoder().decode(bytes));
        } finally { reader.releaseLock(); }
    } else rows = await response.json();
    return normalizePreview(target, Array.isArray(rows) ? rows[0] : null);
}

// Document-local bounded cache: shared promises coalesce repeated messages, no persistence.
export function createPreviewLoader(fetcher = fetchPublicPreview, { now = Date.now, timeoutMs = 4000 } = {}) {
    const cache = new Map(), queue = [];
    let active = 0;
    function pump() {
        while (active < 2 && queue.length) {
            const job = queue.shift(); active++;
            const controller = new AbortController();
            let timer;
            const deadline = new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs); });
            Promise.race([Promise.resolve().then(() => fetcher(job.target, { signal: controller.signal })), deadline])
                .catch(() => null).then(data => {
                    job.entry.until = now() + (data ? 60000 : 30000);
                    job.entry.pending = false;
                    job.resolve(data);
                }).finally(() => { clearTimeout(timer); active--; pump(); });
        }
    }
    return function load(target) {
        if (!target) return Promise.resolve(null);
        const old = cache.get(target.key);
        if (old && (old.pending || old.until > now())) return old.promise;
        if (queue.length >= 24) return Promise.resolve(null);
        for (const [key, value] of cache) if (!value.pending && (value.until <= now() || cache.size >= 128)) cache.delete(key);
        let resolve;
        const entry = { pending: true, until: 0, promise: new Promise(r => { resolve = r; }) };
        cache.set(target.key, entry);
        queue.push({ target, entry, resolve }); pump();
        return entry.promise;
    };
}
export const loadChatPreview = createPreviewLoader();
