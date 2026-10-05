// Caching service worker — makes the app load reliably on flaky mobile networks: after one
// successful load, the big hashed bundle is served from cache, so a dropped connection stops
// producing white screens. Designed to NOT reintroduce the stale-index deploy race:
//   - navigations / HTML  -> NETWORK-FIRST (a fresh deploy always wins), cache fallback only when
//     the network fails (flaky net gets the last-good shell instead of a blank page).
//   - /assets/* hashed chunks -> CACHE-FIRST (immutable file names → safe to serve from cache
//     forever and persist across deploys; this is the ~2.8MB bundle that was stalling).
//   - /sb/* (Supabase API/storage), /data/*, and any non-GET -> BYPASS → always fresh from network.
// Every handler is defensive (never throws); on any cache error it falls through to the network.
const version = 271; // bumped by CI; changing it makes the SW byte-different so browsers update it
const CACHE = 'mg-shell';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(['/', '/index.html']).catch(() => {})).catch(() => {}),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        try {
            const keys = await caches.keys();
            // drop caches from any previous scheme; keep the current shell cache
            await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
        } catch (e) { /* ignore */ }
        try { await self.clients.claim(); } catch (e) { /* ignore */ }
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // never intercept writes
    let url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return;              // cross-origin → native
    if (url.pathname.startsWith('/sb/') || url.pathname.startsWith('/data/')) return; // always fresh

    // hashed static assets → cache-first (immutable)
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith((async () => {
            const cached = await caches.match(req).catch(() => null);
            if (cached) return cached;
            try {
                const res = await fetch(req);
                if (res && res.ok) { caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {}); }
                return res;
            } catch (e) {
                return cached || Response.error();
            }
        })());
        return;
    }

    // navigations / HTML → network-first, cache fallback (so new deploys win; flaky net still loads)
    if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        event.respondWith((async () => {
            try {
                const res = await fetch(req);
                if (res && res.ok) { caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {}); }
                return res;
            } catch (e) {
                const cached = (await caches.match(req).catch(() => null))
                    || (await caches.match('/index.html').catch(() => null))
                    || (await caches.match('/').catch(() => null));
                return cached || Response.error();
            }
        })());
        return;
    }
    // everything else → native (no respondWith)
});
