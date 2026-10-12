// Pass/fail test for the render-unblock fix (template.html). CHROMIUM ONLY — headless WebKit does
// not paint / fire rAF until `load`, so its paint timing is a headless artifact (see
// report-whitescreen-css-render-block.txt). Against the BUILT bundle (vite preview :4173),
// /feedback/. DB writes + beacons mocked; UA MG-TEST.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const ROUTE = '/feedback/';
const CSS = '**/assets/main-*.css';
const JS = '**/assets/main-*.js';
const UA = 'MG-TEST-whitescreen';

async function base(ctx) {
    const page = await ctx.newPage();
    await page.route('**/sb/rest/v1/client_error_log*', r => r.fulfill({ status: 201, body: '[]' }));
    await page.route('**/_l*', r => r.fulfill({ status: 204, body: '' }));
    return page;
}
async function fcp(page) { return await page.evaluate(() => { const p = (performance.getEntriesByType('paint') || []).find(x => x.name === 'first-contentful-paint'); return p ? Math.round(p.startTime) : null; }).catch(() => null); }
async function loadingVisible(page) { return await page.evaluate(() => { const e = document.getElementById('mg-boot-loading'); return !!e && e.offsetParent !== null; }).catch(() => false); }
const hang = async r => { await new Promise(x => setTimeout(x, 40000)); await r.abort('timedout').catch(() => {}); };

const out = {};
const browser = await chromium.launch();

// 2d-i: both hang, FIX ON → FCP ≤ ~6.5s AND #mg-boot-loading visible.
{
    const ctx = await browser.newContext({ userAgent: UA, serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const page = await base(ctx);
    await page.route(CSS, hang); await page.route(JS, hang);
    await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(7000);
    const f = await fcp(page), vis = await loadingVisible(page);
    out.fixOn = { fcp_ms: f, loadingVisible: vis, pass: f != null && f <= 6500 && vis === true };
    await ctx.close();
}

// 2d-ii: both hang, FIX STRIPPED (serve HTML without the 5s block) → FCP must NOT occur.
{
    const ctx = await browser.newContext({ userAgent: UA, serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const page = await base(ctx);
    await page.route(BASE + ROUTE, async r => {
        const resp = await r.fetch(); let html = await resp.text();
        html = html.replace(/var links = document\.querySelectorAll\('link\[rel="stylesheet"\][\s\S]*?\}, 5000\);/, '}, 5000);');
        await r.fulfill({ response: resp, body: html });
    });
    await page.route(CSS, hang); await page.route(JS, hang);
    await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(8000);
    const f = await fcp(page);
    out.fixStripped = { fcp_ms: f, pass: f == null };
    await ctx.close();
}

// 2b: CSS delayed 7s then arrives FULL (JS ok) → styles apply, CSS request count ≤2, mount ok.
{
    const ctx = await browser.newContext({ userAgent: UA, serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const page = await base(ctx);
    let cssReqs = 0, cssResp = 0;
    page.on('request', r => { if (/\/assets\/main-.*\.css/.test(r.url())) cssReqs++; });
    page.on('response', r => { if (/\/assets\/main-.*\.css/.test(r.url())) cssResp++; });
    await page.route(CSS, async r => { await new Promise(x => setTimeout(x, 7000)); await r.continue(); });
    const t0 = Date.now();
    await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
    // wait until the reattached sheet is applied (media back to 'all' and sheet loaded) or 20s
    let appliedAt = null;
    for (let i = 0; i < 200; i++) {
        const ok = await page.evaluate(() => { const l = document.querySelector('link[data-mg-reattached]') || document.querySelector('link[rel="stylesheet"][href*="main-"]'); return !!(l && l.sheet && l.media === 'all'); }).catch(() => false);
        if (ok) { appliedAt = Date.now() - t0; break; }
        await page.waitForTimeout(100);
    }
    const mounted = await page.evaluate(() => !!window.__mgMounted).catch(() => false);
    out.slowArrives = { cssRequests: cssReqs, cssResponses: cssResp, stylesAppliedAt_ms: appliedAt, mounted,
        pass: cssReqs <= 2 && appliedAt != null && mounted === true };
    await ctx.close();
}

// 2e: CSS never arrives, JS ok → app mounts UNSTYLED; overlay does NOT show (app mounted). Screenshot.
{
    const ctx = await browser.newContext({ userAgent: UA, serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const page = await base(ctx);
    await page.route(CSS, hang); // CSS hangs forever; JS loads normally
    await page.goto(BASE + ROUTE, { waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(17000); // past the 15s watchdog
    const r = await page.evaluate(() => ({ mounted: !!window.__mgMounted, overlay: !!document.getElementById('mg-boot-msg'), appKids: (document.getElementById('app') || {}).childElementCount || 0 })).catch(() => ({}));
    const shot = (process.env.SHOTS || '/tmp') + '/e-css-never-js-ok.png';
    await page.screenshot({ path: shot }).catch(() => {});
    out.cssNeverJsOk = { ...r, shot: shot.split('/').pop(), note: 'app mounts unstyled; no overlay because __mgMounted=true', pass: r.mounted === true && r.overlay === false };
    await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
console.log('\nALL_PASS=' + ['fixOn', 'fixStripped', 'slowArrives', 'cssNeverJsOk'].every(k => out[k] && out[k].pass));
