// Run: node tests/freezeguard.unit.mjs
// Pure-unit test of freezeGuard.wasFrozen (no browser). freezeGuard has NO imports and its visibility
// IIFE early-returns when `document` is undefined (node), so it imports cleanly here.
// Covers TZ 1.2f: wasFrozen at 1.9s / 2.1s on each clock, and Δhidden 0 / >0.
import { wasFrozen, getHiddenMs, MAX_REARM_REPORTS } from '../src/_front/chrome/freezeGuard.js';

let fail = 0;
function eq(name, got, want) {
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}  got=${got} want=${want}`);
}

// Threshold is >=2000 by EITHER wall/perf clock, OR Δhidden >=1000.
eq('wall 1.9s → not frozen', wasFrozen(1900, 0, 0), false);
eq('wall 2.1s → frozen',     wasFrozen(2100, 0, 0), true);
eq('wall exactly 2.0s → frozen', wasFrozen(2000, 0, 0), true);
eq('perf 1.9s → not frozen', wasFrozen(0, 1900, 0), false);
eq('perf 2.1s → frozen',     wasFrozen(0, 2100, 0), true);
eq('neither clock late, Δhidden 0 → not frozen', wasFrozen(1900, 1900, 0), false);
eq('Δhidden 999ms → not frozen', wasFrozen(0, 0, 999), false);
eq('Δhidden 1000ms → frozen',    wasFrozen(0, 0, 1000), true);
eq('Δhidden 1500ms alone → frozen', wasFrozen(500, 500, 1500), true);

// getHiddenMs with no document (node) → 0, never throws.
eq('getHiddenMs() === 0 in node', getHiddenMs(), 0);
eq('MAX_REARM_REPORTS === 3', MAX_REARM_REPORTS, 3);

console.log(fail === 0 ? '\nALL UNIT TESTS PASS' : `\n${fail} UNIT TEST(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
