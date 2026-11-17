# Automatic session diagnostics — local preparation, 17 November 2026

Working tree: `/private/tmp/mg-auto-diagnostics-20261116`, branch `feat/automatic-session-diagnostics-20261116`, baseline acb1496. No commit, deployment, receiver activation or production requests performed in this task.

## Implementation

The existing `sessionDiagnostic.js` owns the only trace: 240 events, 64 pending spans. Manual `?mg_loading_diag=1` keeps the panel, offline export and existing delivery behavior; automatic collection does not start in manual mode.

Ordinary documents initially retain a bounded trace while reading `/_t/session-diagnostic.json`. Disabled, invalid, unavailable configuration or an excluded sample clears the buffer and permanently disables recording/delivery for that document. Sampling uses one ephemeral random draw, no persistent client identifier. Enabled sampled documents recheck configuration at most once per minute while foreground and immediately before sending. Server-side enabled-file removal remains the immediate authoritative kill switch; client recording may persist until its next configuration check.

`sessionDiagnosticAuto.js` is the delivery/threshold policy for that same recorder. Existing errorLogger handlers feed fixed categories; no additional global error listeners. In automatic mode JS/Vue/rejection/critical-resource errors use only the new channel instead of legacy raw-message/identity-bearing errorLogger destinations, including on unsampled documents (where those reports are discarded). Other existing logger event types are unchanged; this does NOT make all historical diagnostic systems anonymous.

One monitor ticks each second only on sampled enabled documents. It measures foreground waiting for Auth, HTTP headers/body, route/unload and page loading. Ready-page optional Auth/HTTP is excluded. Completed page operations that leave loading=true remain observable until loading clears or navigation changes. Pending references are cleared on SPA navigation. Hidden time comes from the existing freezeGuard; hidden/wall-clock jumps reset accumulated ages, with a foreground grace period. No business operation is cancelled, retried, or repaired.

Transport uses native fetch captured before instrumentation, same-origin GET `/_l/session-v1?d=...`, credentials omitted, no Referer, no cache. This transport does not touch Supabase/n8n. Each diagnostic fetch has a 3-second deadline including config body consumption; no keepalive/sendBeacon dependency. Maximum three incident attempts per document, reserved before async permission checks; failed checks consume the budget too. No automatic retries/reconnect queue. Navigation+reason dedup and 10-second minimum interval. No report for successful normal work; configuration requests still occur.

Wire values use fixed numeric dictionaries exported by sessionDiagnosticAuto.js and the installed nginx grammar. At most 44 rows, payload <=1100 ASCII bytes. Row: stage-label-event-point-span-start-ms-outcome-status-loading. Loading: 0 unknown, 1 false, 2 true. Reason: 1 JS/Vue/rejection, 2 critical resource, 3 Auth wait, 4 HTTP/body wait, 5 page wait, 6 route/unload wait (7 reserved). Labels never include request arguments or URLs. Span IDs wrap at 9999; timing saturates at 9999999 ms. Build revision comes from git HEAD at Vite build time; a local dirty build is not a new production release.

## Validation

- session-diagnostic-auto.unit.mjs: 17 groups PASS, including 10000-error burst, numeric privacy/actual nginx regex compatibility, all wait classes, completed-loading=true, background/sleep, offline/500, hung config headers/body, kill switch, SPA cleanup and early error.
- session-diagnostic.unit.mjs: 11 groups PASS; real Supabase SDK lock, real router, request results/rejection identity and manual trace behavior.
- session-diagnostic.browser.mjs: 4 groups PASS, including mobile viewport/offline manual copy and actual automatic HTTP delivery with no Cookie/Referer.
- session-diagnostic.app.browser.mjs: 3 groups PASS against local build with external requests blocked and API mocks.
- auth-email-frontend.unit.mjs: 6 PASS. auth-email.browser.mjs: 26 PASS for registration, confirmation, password login and VK; synthetic credentials/mocked endpoints only. The same 26 scenarios also passed with --automatic-diagnostic, explicit Auth/router instrumentation and enabled local collector configuration.
- unified-checkout.unit.mjs: 16 PASS.
- unified-checkout.browser.mjs: 12 scenarios PASS after correcting the fixture to the actual direct-table coursesApi/AppHeader contract. The former RPC-only mock had no `.from()` and also asserted UI/checkout behaviors absent from this baseline. Real payment sources are unchanged. Test models Supabase query thenables and preview_promo, intercepts the provider before network, and verifies order creation/persistence/local redirect, failures, duplicates, removal, free enrollment, guest guard and responsive cart, with automatic diagnostics enabled. No real payments or database writes. The separate 16 RPC-checkout unit tests remain, but do not prove that the current header uses that RPC path.
- freezeGuard unit tests: 11 PASS.
- Vite build without SEO postbuild: PASS. No npm postbuild (it would read production).

Desktop Node microbenchmark: 100000 begin/end spans ~38–82 ms across runs (~0.38–0.82 microseconds/span); retained serialized snapshot ~24.5 KiB. This is not an iPhone CPU/heap measurement. Recorder objects/getter closures have additional overhead. At most one monitor timer plus bounded diagnostic request deadline timers; no event-by-event network delivery. Unsampled/disabled documents stop recording after config resolution. Selected visible documents make one config request/minute, plus up to three pre-send checks and reports.

## Remaining limitations / pilot gate

Local real WebKit 27.2 (Playwright 1.65.1 / engine build 2388) tested: 6 groups PASS for JS errors, resource 404, long waits, credentialless/private payload, no unexpected exceptions, manual offline panel and clipboard fallback. Physical iPhone/iOS Safari not available; desktop WebKit with a mobile viewport does not prove device suspension behavior. Sleep protection and rejected/absent network behavior tested with deterministic clocks. Fully blocked JS/main-bundle failure or full network outage may prevent any delivery; existing boot diagnostics remain relevant. Deliberately no replay of hidden/offline instantaneous errors. Long waits are evidence of delay, not proof of a root cause. Error storms and payload trimming lose detail. No attempt to identify users across documents. Public numeric collector can still receive fabricated numeric events; existing server limits apply.

Remaining release gate: review the final diff/build against current main before separately approved publication. The cart browser coverage gap and local WebKit check are now closed. Physical iPhone remains an explicit coverage limitation. No merge/push/deploy implied.

After separate approval: publish frontend while server remains disabled; verify ordinary pages have no panel and no incident delivery, then explicitly enable server configuration at sampleRate 0.01 (one percent of documents, not unique users). Check first valid anonymized snapshot, guard success, log growth and false positives. Do not increase traffic automatically. Kill switch: approved server control disable removes enabled flag first and sets config disabled; no frontend redeploy needed. Server commands were not run in this task.


## Final local checks (17 November)

Files changed in the closing task: tests/unified-checkout.browser.mjs (fixture corrected), tests/session-diagnostic.webkit.mjs (new), tests/session-diagnostic-rotation.linux.py (new), this document. No application, payment, guard or nginx source changes in this closing task.

Linux: disposable Lima VZ Ubuntu 26.04 arm64, 1 GiB RAM / 5 GiB sparse disk, no host directory mounts, logrotate 3.22.0, nginx absent. Nine checks PASS. All fixture paths relocated below a root-owned 0700 directory; guard logic and rotation directives unchanged. Only postrotate's nginx reopen action substituted with a touch marker. Verified >10MiB maxsize rotation, exact .1 bytes, next-cycle gzip with SHA256, root:adm 0640 creation, www-data:adm source acceptance, seven archive maximum, seven-day expiration, 80MiB budget disable, rejection of symlink/wrong group. Actual nginx log-descriptor reopening is not claimed tested. Final fixture: /root/mg-rotation-lab-4txraz26 in the local VM. Early test setup failures (Ubuntu /var/log parent permissions; an archive reappearing after a later rotation) were corrected in fixture paths/assertions only, without weakening production checks.

Auth/email/VK 26 browser scenarios repeated PASS with automatic diagnostics enabled; 6 email helpers, 16 payment units, 17 auto-diagnostic groups and 20 guard unit tests repeated PASS. Previously validated Vite production-mode build remains applicable: only tests/docs changed in this closing task.

Tools installed with approval outside project dependencies: Playwright under /private/tmp/mg-browser-tools-kFSaYv, matching WebKit browser cache; Lima via Homebrew. No package.json/package-lock changes. VM state under /private/tmp/mg-lima-20261117. No production access, nginx launches, collection activation or deployment.

Conclusion: local checks support publication of frontend with server collection OFF, subject to separate publication authorization and checking current-main integration. Enabling the 1% pilot remains a separate decision.


## Frontend release preparation

Release worktree: /private/tmp/mg-auto-diagnostics-release-20261117. Fetched origin/main = acb1496a3b815d8a07826e93ea7377b5a83f2ee8; frontend patch applies cleanly. Only recorder/policy/error routing, Vite release constant, frontend tests and this documentation included. Server control/configuration/rotation scripts excluded; tests use a frozen numeric receiver-contract fixture at tests/fixtures/session-diagnostic-wire-v1.json.

Repeated on main: 17 automatic groups, 11 recorder groups, 6 email helpers, 16 payment units, 26 Auth/email/VK browser checks with automatic mode enabled, 12 actual-cart browser checks, 4 diagnostic browser checks, 3 full-app smoke checks, 6 WebKit checks. All PASS. Full npm build + SEO postbuild (10 article / 138 course pages) and landing build PASS.

Pre-release server read: enabled flag absent, enabled=false, sampleRate=0, events.log=0 bytes, guard Result=success / ExecMainStatus=0. No server state changed.

Rollback anchor: acb1496a3b815d8a07826e93ea7377b5a83f2ee8, last successful Deploy App https://github.com/sabjorn7/meetclone/actions/runs/43863459666. Rollback after approval: revert the single automatic-diagnostics frontend release commit on current main and push the revert, which invokes the same Deploy App workflow. Keep the server collection disabled. No SQL, service restart or nginx change required; avoid reset/force-push so later unrelated work remains intact.
