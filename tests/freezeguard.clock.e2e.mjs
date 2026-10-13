// Run: node tests/freezeguard.clock.e2e.mjs   (needs playwright; no build/preview needed)
// Drives guardedTimeout under a FAKE clock (page.clock) to simulate iOS tab-suspend: a jump makes an
// overdue timer fire with the wall/perf clock already past the deadline — exactly the real wake-up.
// Covers TZ 1.2:
//   A) frozen window re-arms ONCE (cb deferred, onRearm fired once with fields), then fires normally.
//   B) a SECOND freeze does NOT re-arm again (max one re-arm per handle).
//   C) clear() after a re-arm cancels the re-armed window → cb never fires ("успех отменяет 2-е окно").
// The module has no deps; we inject it with `export ` stripped so it runs as a classic script.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium, webkit } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, '../src/_front/chrome/freezeGuard.js'), 'utf8')
    .replace(/export\s+(function|const)/g, '$1');
// Faithful copy of bootResilience.withTimeout (the only logic it adds over guardedTimeout) so we can
// drive it under the fake clock without pulling in errorLogger/vue-router/supabase. Kept byte-identical
// in behaviour to src/_front/chrome/bootResilience.js::withTimeout.
const WITH_TIMEOUT = `
function withTimeout(promise, ms, label) {
    let handle;
    const timeout = new Promise((_, reject) => {
        handle = guardedTimeout(() => { const e = new Error('timeout:' + (label||'') + ':' + ms + 'ms'); e.isTimeout = true; reject(e); },
            ms, { label: label || 'timeout', onRearm: (i) => { (window.__wtRearms = window.__wtRearms || []).push(i); } });
    });
    return Promise.race([promise, timeout]).finally(() => { if (handle) handle.clear(); });
}
window.__withTimeout = withTimeout;
`;
const INJECT = SRC + '\nwindow.__fg = { guardedTimeout, wasFrozen, getHiddenMs, MAX_REARM_REPORTS };\n' + WITH_TIMEOUT;

async function runOn(name, browserType) {
    const browser = await browserType.launch();
    const ctx = await browser.newContext({ userAgent: 'MG-TEST-freezeguard' });
    const page = await ctx.newPage();
    await page.clock.install();                 // fake Date / performance.now / setTimeout
    await page.goto('about:blank');
    await page.addScriptTag({ content: INJECT });

    // Arm a 15s guarded timer; record cb fires + rearm reports.
    await page.evaluate(() => {
        window.__cb = 0; window.__rearms = [];
        window.__h = window.__fg.guardedTimeout(
            () => { window.__cb++; },
            15000,
            { label: 'test', onRearm: (i) => window.__rearms.push(i) },
        );
    });

    // (A) FREEZE: jump 20s past arm → the 15s timer fires overdue (lateWall ~5s) → re-arm, no cb yet.
    await page.clock.fastForward(20000);
    const afterFreeze = await page.evaluate(() => ({ cb: window.__cb, rearms: window.__rearms.slice() }));

    // Re-armed window is due 15s after the (jumped) fire time. Advance 15s *smoothly* (runFor, not a
    // jump) so it fires on time → NOT frozen → cb runs.
    await page.clock.runFor(15000);
    const afterNormal = await page.evaluate(() => ({ cb: window.__cb, rearms: window.__rearms.length }));

    // (B) a SECOND handle, freeze it TWICE → only one re-arm, then it fires.
    await page.evaluate(() => {
        window.__cb2 = 0; window.__rearms2 = 0;
        window.__h2 = window.__fg.guardedTimeout(() => { window.__cb2++; }, 15000, { label: 't2', onRearm: () => window.__rearms2++ });
    });
    await page.clock.fastForward(20000); // 1st freeze → re-arm
    await page.clock.fastForward(20000); // 2nd freeze → must NOT re-arm again; fires cb instead
    const twoFreezes = await page.evaluate(() => ({ cb2: window.__cb2, rearms2: window.__rearms2 }));

    // (C) CANCEL: arm, freeze (→re-arm), then clear() → the re-armed window must be cancelled.
    await page.evaluate(() => {
        window.__cb3 = 0;
        window.__h3 = window.__fg.guardedTimeout(() => { window.__cb3++; }, 15000, { label: 't3', onRearm: () => {} });
    });
    await page.clock.fastForward(20000);     // re-arm
    await page.evaluate(() => window.__h3.clear());
    await page.clock.fastForward(60000);     // plenty for the re-armed window — must stay cancelled
    const afterCancel = await page.evaluate(() => window.__cb3);

    // D/E drive bootResilience.withTimeout. Fresh page so freezeGuard's module-global rearm-report
    // counter (capped 3/page, already spent by A/B/C) resets → the withTimeout onRearm fires.
    const ctx2 = await browser.newContext({ userAgent: 'MG-TEST-freezeguard' });
    const page2 = await ctx2.newPage();
    await page2.clock.install();
    await page2.goto('about:blank');
    await page2.addScriptTag({ content: INJECT });

    // (D) promise RESOLVES inside the re-armed window after a freeze → withTimeout resolves, NO timeout
    // error, exactly one re-arm, and the cleared handle never fires again.
    await page2.evaluate(() => {
        window.__wtRearms = []; window.__dRes = null; window.__dErr = null;
        window.__P = new Promise(res => { window.__resolveP = res; });
        window.__withTimeout(window.__P, 8000, 'data').then(v => { window.__dRes = v; }).catch(e => { window.__dErr = e.message; });
    });
    await page2.clock.fastForward(12000);                                  // freeze during the 8s window → re-arm
    const dFreeze = await page2.evaluate(() => ({ res: window.__dRes, err: window.__dErr, rearms: window.__wtRearms.length }));
    await page2.evaluate(() => window.__resolveP('OK'));                   // work completes in the re-armed window
    await page2.clock.runFor(10);
    const dDone = await page2.evaluate(() => ({ res: window.__dRes, err: window.__dErr, rearms: window.__wtRearms.length }));
    await page2.clock.fastForward(30000);                                 // cleared timer must never fire
    const dAfter = await page2.evaluate(() => ({ res: window.__dRes, err: window.__dErr, rearms: window.__wtRearms.length }));

    // (E) promise NEVER resolves → after the freeze re-arm, the 2nd window elapses on time → timeout
    // rejection, exactly one re-arm.
    await page2.evaluate(() => {
        window.__wtRearms = []; window.__eRes = null; window.__eErr = null;
        window.__withTimeout(new Promise(() => {}), 8000, 'data').then(v => { window.__eRes = v; }).catch(e => { window.__eErr = { msg: e.message, isTimeout: !!e.isTimeout }; });
    });
    await page2.clock.fastForward(12000);   // freeze → re-arm
    await page2.clock.runFor(8000);         // 2nd window on time → timeout reject
    await page2.clock.runFor(10);
    const eDone = await page2.evaluate(() => ({ res: window.__eRes, err: window.__eErr, rearms: window.__wtRearms.length }));
    await ctx2.close();

    await browser.close();

    const r = afterFreeze.rearms[0] || {};
    const out = {
        browser: name,
        A_freeze: { cb: afterFreeze.cb, rearmCount: afterFreeze.rearms.length, rearm0: r },
        A_normal: afterNormal,
        B_twoFreezes: twoFreezes,
        C_cancel_cb: afterCancel,
        D_resolve: { dFreeze, dDone, dAfter },
        E_timeout: eDone,
        pass:
            afterFreeze.cb === 0 &&                                   // A: frozen → cb deferred
            afterFreeze.rearms.length === 1 &&                        // A: exactly one rearm report
            typeof r.lateness === 'number' && r.lateness >= 2000 &&   // A: fields present + plausible
            typeof r.hiddenMs === 'number' && typeof r.clock === 'string' &&
            r.label === 'test' &&
            afterNormal.cb === 1 && afterNormal.rearms === 1 &&       // A: after normal window, cb ran, still 1 rearm
            twoFreezes.cb2 === 1 && twoFreezes.rearms2 === 1 &&       // B: only one re-arm then cb
            afterCancel === 0 &&                                      // C: cleared re-armed window never fired
            dFreeze.res === null && dFreeze.rearms === 1 &&           // D: frozen → re-armed once, not resolved yet
            dDone.res === 'OK' && dDone.err === null &&               // D: resolves in 2nd window, NO timeout error
            dAfter.rearms === 1 && dAfter.err === null &&             // D: cleared handle never fires again
            eDone.res === null && !!eDone.err && eDone.err.isTimeout === true && // E: times out after 2nd window
            /timeout/.test(eDone.err.msg) && eDone.rearms === 1,      // E: exactly one re-arm
    };
    return out;
}

const results = [];
results.push(await runOn('chromium', chromium));
results.push(await runOn('webkit', webkit));
console.log(JSON.stringify(results, null, 2));
let bad = 0;
for (const r of results) { if (!r.pass) bad++; console.log(`${r.browser}: ${r.pass ? 'PASS' : 'FAIL'}`); }
process.exit(bad === 0 ? 0 : 1);
