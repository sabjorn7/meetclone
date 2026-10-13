// Run: node tests/video-autoretry.e2e.mjs   (needs playwright; no build/preview)
// Faithful harness of MyCoursePage's video preconnect + auto-retry (REAL freezeGuard.guardedTimeout,
// exports stripped, injected). Thresholds scaled (700ms/1500ms); logic mirrors the component.
//   CASE 0: preconnectVideo → one <link rel=preconnect> (NO crossorigin) + one <link rel=dns-prefetch>,
//           idempotent (second call adds nothing).
//   CASE 1: first iframe attempt hangs → auto-retry remounts once → second loads → telemetry has
//           video_auto_retry + video_auto_retry_ok, NO video_load_timeout, stall not fired.
//   CASE 2 (control): every attempt hangs → one retry (video_auto_retry) then exactly one
//           video_load_timeout, NO video_auto_retry_ok.
// NB: the preconnectVideo / telemetry logic below is COPIED from MyCoursePage.vue — keep in sync.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium, webkit } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FG = readFileSync(join(__dirname, '../src/_front/chrome/freezeGuard.js'), 'utf8')
    .replace(/export\s+(function|const)/g, '$1');

const HARNESS = `<!doctype html><html><head></head><body><iframe id="f" width="10" height="10"></iframe><script>
${FG}
const PEERTUBE = 'https://video.meetgu.ru';
// --- copy of MyCoursePage preconnectVideo (keep in sync) ---
window.preconnectVideo = function () {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-mg-preconnect-video]')) return;
    const pc = document.createElement('link');
    pc.rel = 'preconnect'; pc.href = PEERTUBE; pc.setAttribute('data-mg-preconnect-video', '1');
    const dp = document.createElement('link');
    dp.rel = 'dns-prefetch'; dp.href = PEERTUBE; dp.setAttribute('data-mg-preconnect-video', '1');
    document.head.appendChild(pc); document.head.appendChild(dp);
  } catch (e) {}
};
window.__t = (function () {
  const RETRY_MS = 700, STALL_MS = 1500;
  let videoLoaded = false, videoReload = 0, autoRetried = false, stallFired = false;
  let videoStartTs = 0, autoRetryAtMs = null;
  const telemetry = [];
  const log = (t) => telemetry.push(t);
  let stallTimer = null, autoRetryTimer = null;
  const nowMs = () => (performance && performance.now ? performance.now() : Date.now());
  const f = document.getElementById('f');
  f.addEventListener('load', () => {
    if ((f.getAttribute('src') || '').indexOf('/video-embed') === 0) {
      videoLoaded = true;
      if (stallTimer) stallTimer.clear();
      if (autoRetryTimer) autoRetryTimer.clear();
      if (autoRetried && autoRetryAtMs != null) { log('video_auto_retry_ok'); autoRetryAtMs = null; }
    }
  });
  function mount() { f.setAttribute('src', '/video-embed?v=' + videoReload); }
  function armStall() {
    if (stallTimer) stallTimer.clear();
    stallTimer = guardedTimeout(() => { if (videoLoaded) return; stallFired = true; log('video_load_timeout'); }, STALL_MS, { label: 'video_load_timeout' });
  }
  function armAutoRetry() {
    if (autoRetryTimer) autoRetryTimer.clear();
    autoRetryTimer = guardedTimeout(() => {
      if (videoLoaded || autoRetried) return;
      autoRetried = true; autoRetryAtMs = Math.round(nowMs() - videoStartTs);
      log('video_auto_retry');
      videoLoaded = false; videoReload += 1; mount();
    }, RETRY_MS, { label: 'video_auto_retry' });
  }
  function startVideo() { videoLoaded = false; autoRetried = false; autoRetryAtMs = null; videoReload = 0; videoStartTs = nowMs(); mount(); armStall(); armAutoRetry(); }
  // manual «Обновить» — clears the auto-retry markers so a following load isn't logged as _ok
  function reloadVideo() { videoLoaded = false; videoReload += 1; autoRetried = false; autoRetryAtMs = null; mount(); armStall(); }
  return { startVideo, reloadVideo, state: () => ({ videoLoaded, videoReload, autoRetried, stallFired, telemetry: telemetry.slice() }) };
})();
</script></body></html>`;

const wait = (p, ms) => p.waitForTimeout(ms);

async function runOn(name, bt) {
    const browser = await bt.launch();
    const out = { browser: name };
    const serveHarness = (page) => page.route('**/harness', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: HARNESS }));

    // CASE 0: preconnect links — no crossorigin + a dns-prefetch, idempotent.
    {
        const ctx = await browser.newContext(); const page = await ctx.newPage();
        await serveHarness(page);
        await page.goto('http://localhost/harness').catch(() => {});
        await page.evaluate(() => { window.preconnectVideo(); window.preconnectVideo(); }); // twice → idempotent
        out.case0 = await page.evaluate(() => {
            const pc = [...document.querySelectorAll('link[rel="preconnect"][data-mg-preconnect-video]')];
            const dp = [...document.querySelectorAll('link[rel="dns-prefetch"][data-mg-preconnect-video]')];
            return {
                preconnectCount: pc.length, dnsPrefetchCount: dp.length,
                preconnectHasCrossorigin: pc.some((l) => l.hasAttribute('crossorigin') || !!l.crossOrigin),
                hrefOk: pc.every((l) => l.href.indexOf('video.meetgu.ru') >= 0),
            };
        });
        out.case0.pass = out.case0.preconnectCount === 1 && out.case0.dnsPrefetchCount === 1
            && out.case0.preconnectHasCrossorigin === false && out.case0.hrefOk === true;
        await ctx.close();
    }

    // CASE 1: first attempt hangs, retry (v>=1) succeeds.
    {
        const ctx = await browser.newContext(); const page = await ctx.newPage();
        await page.route('**/video-embed**', (route) => {
            const v = Number(new URL(route.request().url()).searchParams.get('v') || '0');
            if (v === 0) return; // hang
            route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>embed ok</body></html>' });
        });
        await serveHarness(page);
        await page.goto('http://localhost/harness').catch(() => {});
        await page.evaluate(() => window.__t.startVideo());
        await wait(page, 1900);
        out.case1 = await page.evaluate(() => window.__t.state());
        const t = out.case1.telemetry;
        out.case1.pass = out.case1.videoLoaded === true && out.case1.autoRetried === true && out.case1.videoReload === 1
            && out.case1.stallFired === false
            && t.includes('video_auto_retry') && t.includes('video_auto_retry_ok') && !t.includes('video_load_timeout');
        await ctx.close();
    }

    // CASE 2 (control): every attempt hangs → one retry, then stall; no _ok.
    {
        const ctx = await browser.newContext(); const page = await ctx.newPage();
        await page.route('**/video-embed**', () => { /* always hang */ });
        await serveHarness(page);
        await page.goto('http://localhost/harness').catch(() => {});
        await page.evaluate(() => window.__t.startVideo());
        await wait(page, 1900);
        out.case2 = await page.evaluate(() => window.__t.state());
        const t = out.case2.telemetry;
        out.case2.pass = out.case2.videoLoaded === false && out.case2.autoRetried === true && out.case2.videoReload === 1
            && out.case2.stallFired === true
            && t.includes('video_auto_retry') && t.includes('video_load_timeout') && !t.includes('video_auto_retry_ok');
        await ctx.close();
    }

    // CASE 3: auto-retry fires (both auto attempts hang), then a MANUAL reload loads → NO _ok
    // (manual «Обновить» must not be attributed to the silent auto-retry).
    {
        const ctx = await browser.newContext(); const page = await ctx.newPage();
        await page.route('**/video-embed**', (route) => {
            const v = Number(new URL(route.request().url()).searchParams.get('v') || '0');
            if (v <= 1) return; // v=0 (first) and v=1 (auto-retry) hang; v=2 (manual reload) succeeds
            route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>embed ok</body></html>' });
        });
        await serveHarness(page);
        await page.goto('http://localhost/harness').catch(() => {});
        await page.evaluate(() => window.__t.startVideo());
        await wait(page, 900);                               // auto-retry has fired (v=1, hangs)
        await page.evaluate(() => window.__t.reloadVideo()); // user clicks «Обновить» → v=2 loads
        await wait(page, 1000);                              // past STALL_MS from start; manual load done
        out.case3 = await page.evaluate(() => window.__t.state());
        const t = out.case3.telemetry;
        out.case3.pass = out.case3.videoLoaded === true && out.case3.videoReload === 2
            && t.includes('video_auto_retry') && !t.includes('video_auto_retry_ok');
        await ctx.close();
    }

    await browser.close();
    out.pass = out.case0.pass && out.case1.pass && out.case2.pass && out.case3.pass;
    return out;
}

const results = [];
results.push(await runOn('chromium', chromium));
results.push(await runOn('webkit', webkit));
console.log(JSON.stringify(results, null, 2));
let bad = 0;
for (const r of results) { if (!r.pass) bad++; console.log(`${r.browser}: ${r.pass ? 'PASS' : 'FAIL'} (case0=${r.case0.pass} case1=${r.case1.pass} case2=${r.case2.pass} case3=${r.case3.pass})`); }
process.exit(bad === 0 ? 0 : 1);
