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
const INJECT = SRC + '\nwindow.__fg = { guardedTimeout, wasFrozen, getHiddenMs, MAX_REARM_REPORTS };\n';

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

    await browser.close();

    const r = afterFreeze.rearms[0] || {};
    const out = {
        browser: name,
        A_freeze: { cb: afterFreeze.cb, rearmCount: afterFreeze.rearms.length, rearm0: r },
        A_normal: afterNormal,
        B_twoFreezes: twoFreezes,
        C_cancel_cb: afterCancel,
        pass:
            afterFreeze.cb === 0 &&                                   // A: frozen → cb deferred
            afterFreeze.rearms.length === 1 &&                        // A: exactly one rearm report
            typeof r.lateness === 'number' && r.lateness >= 2000 &&   // A: fields present + plausible
            typeof r.hiddenMs === 'number' && typeof r.clock === 'string' &&
            r.label === 'test' &&
            afterNormal.cb === 1 && afterNormal.rearms === 1 &&       // A: after normal window, cb ran, still 1 rearm
            twoFreezes.cb2 === 1 && twoFreezes.rearms2 === 1 &&       // B: only one re-arm then cb
            afterCancel === 0,                                        // C: cleared re-armed window never fired
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
