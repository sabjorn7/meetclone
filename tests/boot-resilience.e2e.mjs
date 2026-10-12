// Run: 1) npm run build  2) npx vite preview --port 4173  3) node tests/boot-resilience.e2e.mjs
// Standalone Playwright (not vitest). Chromium+WebKit. Verifies commits (a)/(b)/(c) boot resilience.
// Matches the WeWeb /feedback page by pageId prefix + wildcard hash → build-independent.

// Faithful boot-resilience tests against the PRODUCTION bundle (vite preview :4173), route
// /feedback/ (a non-overridden WeWeb page → exercises the modified wwPage resolver: import(chunk)
// + fetchData). DB writes (client_error_log) are mocked. Chromium + WebKit, UA MG-TEST.
import { chromium, webkit } from 'playwright';

const BASE = 'http://localhost:4173';
const ROUTE = '/feedback/';
const DATA = '**/data/e0700030-1298-41a8-92c9-42600360fda4.json*';
const CHUNK = '**/assets/e0700030-1298-41a8-92c9-42600360fda4-*.js';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) MG-TEST-bootres Safari/604.1';

function ctxOpts() { return { userAgent: UA, serviceWorkers: 'block' }; }

// "Hang" a request the way a throttled network does: keep the XHR genuinely in-flight, then abort
// LATER than the client's own timeout, so axios's 8s timeout fires first. (Never-answering a route
// leaves the request pre-dispatch in WebKit, so its XHR timeout never starts — a Playwright quirk,
// not product behaviour.)
async function hang(route, ms = 11000) {
    await new Promise(r => setTimeout(r, ms));
    await route.abort('timedout').catch(() => {}); // client already aborted at 8s → may be handled
}

async function wire(page) {
    const logs = []; const errs = []; const loads = { n: 0 }; const beacons = [];
    page.on('load', () => { loads.n++; }); // one per full main-frame document load (initial + reloads)
    await page.route('**/serviceworker.js', r => r.fulfill({ status: 204, body: '' }));
    await page.route('**/_l*', r => { try { const q = new URL(r.request().url()).searchParams; beacons.push({ t: q.get('t'), m: q.get('m') || '' }); } catch (e) {} r.fulfill({ status: 204, body: '' }); });
    await page.route('**/sb/rest/v1/client_error_log*', async r => {
        try { logs.push(JSON.parse(r.request().postData() || '{}')); } catch (e) { logs.push({ raw: r.request().postData() }); }
        r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });
    page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    return { logs, errs, loads, beacons };
}

// Count the boot-watchdog / load-error overlays currently in the DOM (must be ≤ 1 — they must not stack).
async function overlayCount(page) {
    return await page.evaluate(() => ['mg-load-error', 'mg-boot-msg'].filter(id => document.getElementById(id)).length).catch(() => -1);
}

async function waitMounted(page, maxMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
        const m = await page.evaluate(() => !!window.__mgMounted || ((document.getElementById('app') || {}).childElementCount || 0) > 1).catch(() => false);
        if (m) return Date.now() - t0;
        await page.waitForTimeout(100);
    }
    return null;
}
async function waitSelector(page, sel, maxMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
        const found = await page.$(sel).catch(() => null); // may throw mid-navigation (hard reload)
        if (found) return Date.now() - t0;
        await page.waitForTimeout(100);
    }
    return null;
}

async function runOn(name, browserType) {
    const browser = await browserType.launch();
    const out = { browser: name };

    // T1: data.json hangs on 1st attempt (axios 8s timeout), succeeds on retry → mount ~8–10s.
    {
        const ctx = await browser.newContext(ctxOpts()); const page = await ctx.newPage();
        const { logs, errs } = await wire(page);
        let hits = 0;
        await page.route(DATA, async r => { hits++; if (hits === 1) { await hang(r); } else { await r.continue(); } });
        await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
        const mountedAt = await waitMounted(page, 15000);
        out.T1 = { mountedAt_ms: mountedAt, dataAttempts: hits, fetch_retry_logged: logs.some(l => l.event_type === 'fetch_retry'), errs,
            pass: mountedAt != null && mountedAt >= 6000 && mountedAt <= 12000 && hits >= 2 };
        await ctx.close();
    }

    // T2: data.json hangs on BOTH attempts → error screen ~16–18s; «Обновить» reloads (loads 1→2).
    {
        const ctx = await browser.newContext(ctxOpts()); const page = await ctx.newPage();
        const { errs, loads, beacons } = await wire(page);
        let hits = 0;
        await page.route(DATA, async r => { hits++; await hang(r, 12000); }); // each outlasts the 8s attempt
        await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
        const errAt = await waitSelector(page, '#mg-load-error', 30000);
        const btnText = await page.$eval('#mg-load-error button', b => b.textContent).catch(() => null);
        // (fix 1) exactly ONE overlay on screen — the 15s watchdog drew #mg-boot-msg first, showLoadError
        // must have removed it. (fix 2) after showLoadError the resolver returns → router.isReady resolves
        // → app.mount → __mgMounted=true; the #mg-load-error overlay must still be present (no flicker).
        await page.waitForTimeout(800);
        const overlays = await overlayCount(page);
        const mounted = await page.evaluate(() => !!window.__mgMounted).catch(() => null);
        const errStillThere = !!(await page.$('#mg-load-error').catch(() => null));
        const loadsBefore = loads.n;
        if (errAt != null) { await page.click('#mg-load-error button').catch(() => {}); await page.waitForTimeout(2500); }
        // Chromium reaches the screen at ~16s (2×8s, representative of prod HTTP/2). WebKit on the
        // test's HTTP/1.1 preview server serializes same-URL requests → ~24s; behaviour is identical.
        const bootLate = beacons.find(b => b.t === 'boot_late');
        const bootLateHasLe = !!bootLate && /(^|\s)le=1(\s|$)/.test(bootLate.m);
        out.T2 = { errorScreenAt_ms: errAt, dataAttempts: hits, btn: btnText, overlays, mounted, errStillThere,
            beaconTypes: [...new Set(beacons.map(b => b.t))], bootLate_m: bootLate && bootLate.m, bootLateHasLe,
            loadsBefore, loadsAfter: loads.n, errs,
            pass: errAt != null && errAt >= 14000 && errAt <= 26000 && btnText === 'Обновить' && overlays === 1
                && errStillThere && mounted === true && bootLateHasLe && loads.n > loadsBefore };
        await ctx.close();
    }

    // T3: page chunk 404 → EXACTLY one hard reload (loop-guard), then error screen (loads === 2).
    {
        const ctx = await browser.newContext(ctxOpts()); const page = await ctx.newPage();
        const { logs, errs, loads } = await wire(page);
        await page.route(CHUNK, r => r.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
        await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
        const errAt = await waitSelector(page, '#mg-load-error', 22000);
        await page.waitForTimeout(4000); // ensure NO further reload after the error screen
        const guardKeys = await page.evaluate(() => { try { return Object.keys(sessionStorage).filter(k => k.startsWith('mg_nav_reload:')); } catch (e) { return null; } }).catch(() => null);
        // Proof of "exactly one hard reload then error screen": exactly ONE loop-guard key is set
        // (allowHardReload returned true once, then false), AND the error screen appeared (which only
        // happens on the SECOND resolver pass, i.e. after the single reload). loadEvents is unreliable
        // here (a fast same-URL reload preempts the first 'load'), so it's informational only.
        out.T3 = { errorScreen: errAt != null, guardKeys, loadEvents_info: loads.n, chunk_retry_logged: logs.some(l => l.event_type === 'chunk_retry'), errs,
            pass: errAt != null && Array.isArray(guardKeys) && guardKeys.length === 1 && logs.some(l => l.event_type === 'chunk_retry') };
        await ctx.close();
    }

    // T6: normal load → fast mount, no error/overlay, data.json URL carries _wwcv. (reqCacheControl is
    // informational: WebKit/Safari adds its own Cache-Control on subresource fetches; the APP no longer
    // sets no-cache — Chromium shows null, which is the client-side proof of commit b.)
    {
        const ctx = await browser.newContext(ctxOpts()); const page = await ctx.newPage();
        const { errs } = await wire(page);
        let dataReqHeaders = null, dataUrl = null;
        page.on('request', r => { if (/\/data\/e0700030.*\.json/.test(r.url())) { dataReqHeaders = r.headers(); dataUrl = r.url(); } });
        await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
        const mountedAt = await waitMounted(page, 8000);
        await page.waitForTimeout(500);
        const hasErr = !!(await page.$('#mg-load-error'));
        const hasOverlay = !!(await page.$('#mg-boot-msg'));
        out.T6 = { mountedAt_ms: mountedAt, loadErr: hasErr, bootOverlay: hasOverlay, dataUrl_hasWwcv: /_wwcv=/.test(dataUrl || ''), reqCacheControl: (dataReqHeaders || {})['cache-control'] || null, errs,
            pass: mountedAt != null && mountedAt < 4000 && !hasErr && !hasOverlay && /_wwcv=/.test(dataUrl || '') };
        await ctx.close();
    }

    // Tc: unhandledrejection — (A) a rejection with a real .js stack frame is logged with "@ frame"
    // in the message; (B) a vue-router NavigationFailure is NOT logged.
    {
        const ctx = await browser.newContext(ctxOpts()); const page = await ctx.newPage();
        const { logs, errs } = await wire(page);
        await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
        await waitMounted(page, 8000);
        // (A) reject with a crafted stack that mimics the real /course_info rows (vue-router frame)
        await page.evaluate(() => {
            const e = new Error('framed boom');
            e.stack = 'Error: framed boom\n    at S (https://app.meetgu.ru/assets/vue-router-COiGpPKk.js:1:1024)\n    at l (https://app.meetgu.ru/assets/vue-router-COiGpPKk.js:1:5761)';
            Promise.reject(e);
        });
        await page.waitForTimeout(800);
        // (B) a real NavigationFailure: push cancelled by an immediate second push (unhandled)
        await page.evaluate(() => {
            const r = window.vm && (window.vm.config.globalProperties.$router || window.vm.$router);
            if (r) { const p1 = r.push('/about_meet'); r.push('/all_course'); p1.then(() => {}); } // leave p1 unhandled on reject
        }).catch(() => {});
        await page.waitForTimeout(1500);
        const rej = logs.filter(l => l.event_type === 'unhandled_rejection');
        const framed = rej.find(l => (l.message || '').includes('framed boom'));
        out.Tc = { rejections: rej.map(l => (l.message || '').slice(0, 90)),
            framedLoggedWithFrame: !!framed && /@ vue-router-COiGpPKk\.js:1:1024/.test(framed.message || ''),
            navFailureLogged: rej.some(l => /aborted|cancelled|redirect|Avoided/i.test(l.message || '')), errs,
            pass: !!framed && /@ vue-router-COiGpPKk\.js:1:1024/.test(framed.message || '') && !rej.some(l => /aborted|cancelled|redirect/i.test(l.message || '')) };
        await ctx.close();
    }

    await browser.close();
    return out;
}

const results = [];
results.push(await runOn('chromium', chromium));
results.push(await runOn('webkit', webkit));
console.log(JSON.stringify(results, null, 2));
const KEYS = ['T1', 'T2', 'T3', 'T6', 'Tc'];
for (const r of results) console.log(`${r.browser}: ` + KEYS.map(k => `${k}=${r[k] && r[k].pass ? 'PASS' : 'FAIL'}`).join(' '));
