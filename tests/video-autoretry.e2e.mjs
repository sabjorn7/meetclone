// Run: node tests/video-autoretry.e2e.mjs   (needs playwright; no build/preview)
// Faithful harness of MyCoursePage's video auto-retry: iframe with a remount key, armStall (STALL_MS)
// + armAutoRetry (RETRY_MS) built on the REAL freezeGuard.guardedTimeout (exports stripped, injected).
// Thresholds scaled down (700ms / 1500ms) so the test is fast; logic is identical to the component.
// Playwright routes the "video host" iframe URL: first attempt hangs, the retry (bumped key) passes.
//   CASE 1: first hangs → auto-retry remounts once → second loads → NO stall telemetry.
//   CASE 2 (control): all attempts hang → one auto-retry, then stall fires exactly one video_load_timeout.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium, webkit } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FG = readFileSync(join(__dirname, '../src/_front/chrome/freezeGuard.js'), 'utf8')
    .replace(/export\s+(function|const)/g, '$1');

const HARNESS = `<!doctype html><html><body><iframe id="f" width="10" height="10"></iframe><script>
${FG}
window.__t = (function () {
  const RETRY_MS = 700, STALL_MS = 1500;
  let videoLoaded = false, videoReload = 0, autoRetried = false, stallFired = false;
  const telemetry = [];
  let stallTimer = null, autoRetryTimer = null;
  const f = document.getElementById('f');
  f.addEventListener('load', () => {
    // mirror onVideoLoaded: only count a real embed load (routed URL), not the initial about:blank
    if ((f.getAttribute('src') || '').indexOf('/video-embed') === 0) {
      videoLoaded = true;
      if (stallTimer) stallTimer.clear();
      if (autoRetryTimer) autoRetryTimer.clear();
    }
  });
  function mount() { f.setAttribute('src', '/video-embed?v=' + videoReload); }
  function armStall() {
    if (stallTimer) stallTimer.clear();
    stallTimer = guardedTimeout(() => {
      if (videoLoaded) return;
      stallFired = true; telemetry.push('video_load_timeout');
    }, STALL_MS, { label: 'video_load_timeout' });
  }
  function armAutoRetry() {
    if (autoRetryTimer) autoRetryTimer.clear();
    autoRetryTimer = guardedTimeout(() => {
      if (videoLoaded || autoRetried) return;
      autoRetried = true; videoLoaded = false; videoReload += 1; mount();
    }, RETRY_MS, { label: 'video_auto_retry' });
  }
  function startVideo() { videoLoaded = false; autoRetried = false; videoReload = 0; mount(); armStall(); armAutoRetry(); }
  return { startVideo, state: () => ({ videoLoaded, videoReload, autoRetried, stallFired, telemetry: telemetry.slice() }) };
})();
</script></body></html>`;

const wait = (p, ms) => p.waitForTimeout(ms);

async function runOn(name, bt) {
    const browser = await bt.launch();
    const out = { browser: name };

    // CASE 1: first attempt hangs, retry (v>=1) succeeds.
    {
        const ctx = await browser.newContext(); const page = await ctx.newPage();
        await page.route('**/video-embed**', (route) => {
            const v = Number(new URL(route.request().url()).searchParams.get('v') || '0');
            if (v === 0) { /* hang: never resolve */ return; }
            route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>embed ok</body></html>' });
        });
        await page.route('**/harness', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: HARNESS }));
        await page.goto('http://localhost/harness').catch(() => {});
        await page.evaluate(() => window.__t.startVideo());
        await wait(page, 1900); // past RETRY_MS(700) and STALL_MS(1500)
        out.case1 = await page.evaluate(() => window.__t.state());
        out.case1.pass = out.case1.videoLoaded === true && out.case1.autoRetried === true
            && out.case1.videoReload === 1 && out.case1.stallFired === false && out.case1.telemetry.length === 0;
        await ctx.close();
    }

    // CASE 2 (control): every attempt hangs → one retry, then stall fires exactly once.
    {
        const ctx = await browser.newContext(); const page = await ctx.newPage();
        await page.route('**/video-embed**', () => { /* always hang */ });
        await page.route('**/harness', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: HARNESS }));
        await page.goto('http://localhost/harness').catch(() => {});
        await page.evaluate(() => window.__t.startVideo());
        await wait(page, 1900);
        out.case2 = await page.evaluate(() => window.__t.state());
        out.case2.pass = out.case2.videoLoaded === false && out.case2.autoRetried === true
            && out.case2.videoReload === 1 && out.case2.stallFired === true
            && out.case2.telemetry.length === 1 && out.case2.telemetry[0] === 'video_load_timeout';
        await ctx.close();
    }

    await browser.close();
    out.pass = out.case1.pass && out.case2.pass;
    return out;
}

const results = [];
results.push(await runOn('chromium', chromium));
results.push(await runOn('webkit', webkit));
console.log(JSON.stringify(results, null, 2));
let bad = 0;
for (const r of results) { if (!r.pass) bad++; console.log(`${r.browser}: ${r.pass ? 'PASS' : 'FAIL'} (case1=${r.case1.pass} case2=${r.case2.pass})`); }
process.exit(bad === 0 ? 0 : 1);
