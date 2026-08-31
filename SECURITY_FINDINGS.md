# Security / correctness findings

Running list of security- and correctness-relevant findings and deferred work.

## Course access — time-limited access

### FIXED (client-side gate) — 2026-08-08
Time-limited course access (`user_course.end_period`) was written on purchase but **never enforced**: the client gate on `my_courses` and `course/{slug}` only checked that a `user_course` row existed, never comparing `end_period` to "now". RLS is disabled on `user_course`/`lessons`/`course`, there is no `pg_cron` cleanup and no expiry trigger — so expired paid courses stayed accessible forever. At time of fix: **846** genuinely time-limited accesses (across **323** users) were expired but still open.

Fix (client-only, mirrors the club `end_date > dayjs.now()` pattern; unified on the static `date()` "now" everywhere):
- `course/{slug}` (`290e681e`): buy-button label is now 3-way (active → "Уже в библиотеке", expired-owned → "Продлить", else "Купить"/"Добавить"). Purchase flow untouched.
- `my_courses` (`4f77bcf6`): the player-open handler no longer opens an expired card; a remaining-time badge shows days left / expired date; a "Продлить" pill appears on expired cards.
- The 846 expired rows were **left untouched** in the DB — the gate now filters them out by `end_period` automatically.

### RESOLVED — course renewal payment wired + tested (2026-08-08)
Renewal now runs a real payment charging `course.DurationPrice`, verified end-to-end.

n8n (`BuyCourse`, live) — two changes, validated on an isolated copy with a two-run test (first purchase → INSERT; renewal → UPDATE the same row, no duplicate) then applied to prod:
- **Billing from actual amount**: `Create_Sales.price/amount` now come from `shop.price` (the charged amount), not `course.Price`. So renewal records `DurationPrice`, first purchase records `Price`.
- **Upsert**: access write is now `getAll user_course by (user, course)` → IF exists → UPDATE `end_period` (= now + `DurationLong` months), else INSERT. Idempotent against duplicate Prodamus callbacks. New `end_period` counts from the payment date (no gap compensation — chosen for simplicity).

Client — `course/{slug}` buy button click gates on ACTIVE (alive → my_courses; expired-owned → pay flow); `shop`-insert sets `price = DurationPrice` on renewal (else `Price`) and `is_renewal = true` (audit flag on `shop`, migration `pending_shop_is_renewal.sql`); the `my_courses` "Продлить" pill now navigates to `course/{slug}` where the pay flow runs.

**OPEN follow-ups:**
- ~~**`DurationPrice = 0`/null → free renewal.**~~ **RESOLVED (2026-08-08):** when `DurationPrice <= 0`/null, the "Продлить" pill (my_courses) and the course/{slug} pay branch route to `/contacts` (support) instead of starting a 0 ₽ Prodamus order. Renewals with a real price and first purchases are unchanged. (No per-course message injected on /contacts — generic support page; add later if wanted.)
- ~~**`DurationLong = 0` ("без лимита") courses with a real expired `user_course` window**~~ **RESOLVED (2026-08-08):** the gate now treats the current `course.DurationLong == 0` as unlimited, so owners keep access regardless of an old expired window. This un-locked 145 accesses / 96 users across 18 courses that had been switched from time-limited to unlimited after purchase.
- **`shop.prolong` is dead** (hardcoded `12`, ignored by n8n — window comes from `course.DurationLong`); safe to remove later.

### OPEN — server-side enforcement deferred
The current fix is **client-side only**. Server-side enforcement (RLS on `user_course` filtering `end_period > now() OR end_period IS NULL`, and/or a scheduled `pg_cron` cleanup) is deferred to the broader security review. Until then, a crafted direct PostgREST/API call could still read expired rows.

## SF-1 — PeerTube system-account credentials in the client bundle

The whole platform uploads videos and creates live streams through ONE shared PeerTube "system" account,
whose token is cached in Supabase `Peertube_System`. Acquiring/rotating that token happens **client-side**,
so the account credentials are shipped to the browser: `client_id`/`client_secret`, and — for the
password-grant that heals an expired `refresh_token` — the account `username=upload` + password. These have
been publicly present in the deployed WeWeb page data (`courses_manage`) since before this redesign.

### Status — reproduced 1:1 in the hand-written rebuild, by necessity (2026-08-31)
The hand-written `/courses_manage` rebuild (`src/_front/streams/peertubeUpload.js`) **replicates the
password-grant bootstrap verbatim**, because it is genuinely required for reliability, not a hypothetical:
the shared `refresh_token` has expired in practice, and without the password heal, teacher course/video
uploads (and, transitively, stream token recovery — `peertubeLive.js` deliberately omits the password grant
and relies on this page healing the token) break periodically. Opening the page, or the first upload, heals
the token. Placing the same already-public credentials in this bundle does not meaningfully multiply the
exposure (they are the same values already served in the WeWeb page data).

**Root fix (OPEN, for a developer): move the PeerTube token exchange server-side** (n8n / edge function) so
neither the `client_secret` nor the upload account password ever reach the browser — Variant C. This remains
the correct remediation; the client-side replication is an accepted interim to preserve platform reliability.

## Payment regression — purchases not granting access (INCIDENT)

### FIXED (n8n) — 2026-08-14
The 2026-08-08 renewal rework (see "course renewal payment wired" above) replaced the access write in the n8n `BuyCourse` workflow with `getAll user_course by (user, course)` → `IF_Exists` → UPDATE/INSERT. In production the Supabase `getAll` node applied **only the `course` filter — the `user` condition was silently dropped**, so `GetUserCourse` returned **every** buyer of the course (e.g. 41 rows), not the current buyer's row.

Consequences (live ~2026-08-08 → 08-14):
- `IF_Exists` always saw rows → **always took the UPDATE branch**; the INSERT branch (which creates the buyer's `buy=true` row) never fired. **A buyer with no pre-existing row for the course paid but got no `buy=true` row → locked out** ("деньги списаны, курс закрыт").
- Each purchase also UPDATE-set `buy=true` + reset `end_period` on **all other** rows of that course → collateral `end_period` corruption.

Why it wasn't caught at release: the Aug-8 test on the isolated copy used a buyer who **already had** a `user_course` row, so the missing `user` filter still happened to update their row — the lock-out path (no prior row) was never exercised.

Fix: inserted a `PickBuyerRow` Code node between `GetUserCourse` and `IF_Exists` that narrows the items to exactly the buyer's `(user, course)` row (or empty) — restoring correct upsert semantics without relying on the n8n multi-condition filter. `Create_Sales → GetUserCourse → PickBuyerRow → IF_Exists → Update/Insert`. (Clean follow-up option: replace the 4-node subgraph with a single `grant_course_access(user, course, months, free)` Postgres upsert.)

**2026-08-16 — second iteration (pairedItem regression from the fix above).** The `PickBuyerRow` Code node returned items without `pairedItem` metadata, which broke every downstream `$('UsersBuyer').item` / `$('GetCourse').item` reference — i.e. both `Supabase5` (INSERT branch) and `UpdateUserCourse` (UPDATE branch) threw `ExpressionError: Missing pairedItem data`. So from 08-14 onward **no purchase completed the access write** — it just failed at a different node than before. Surfaced only on the first real purchase by a *new* buyer with no prior row (vladimirman, an unlimited `DurationLong=0` course → INSERT branch → `Supabase5` error, exec 6019). Fix: `PickBuyerRow` now returns `pairedItem: { item: 0 }` (the main chain is single-item), so `.item` resolves in both branches. Remediation: 1 lockout granted (vladimirman, 10000₽, manual INSERT); 2 renewals whose `end_period` never extended (irina, 2×900₽ on 08-15 — rows kept `buy=true` so they didn't show as lock-outs, but the paid extension silently didn't apply) were corrected by hand. Full paid-order-since-08-14 audit = exactly these 3, no others.

Lesson reinforced: **the same class of bug (purchase → no `buy=true`/no extension) slipped through twice in two days, each time caught only by a user complaint.** A test purchase after every `BuyCourse` edit is the cheap habit to adopt.

**Monitoring added — PaymentGuard (2026-08-16, live).** n8n workflow `PaymentGuard` (id `Er9qmggzerGKjHGQ`, active) runs every 10 min: reads DB view `payment_guard_tier1` (paid orders vs fresh paid `buy=true` grants over the last 90 min) and, on `anomaly` (paid orders ≥1 while grants = 0), emails `adv@meetgu.ru` via Unisender (Telegram is unreachable from the server). This is **Tier 1** (systemic — catches a fully-broken flow like both incidents above, independent of the flaky `order.course_positions → shop.course_id` mapping). The counter excludes club-subscription orders (`order.subscription = true`; added 2026-08-17 after such an order — a club renewal — caused a false positive), since those grant access via `club_subs`, not `user_course`. The `subscription` flag is a reliable marker: over 90 days, 112/112 subscription orders map to no course, 76/77 non-subscription orders map to a course.

⚠️ **KNOWN COVERAGE GAP (deliberate, temporary): club subscriptions are NOT monitored by PaymentGuard.** A paid club subscription that fails to activate in `club_subs` would go unnoticed. This is intentional, not an oversight: a naive club Tier keyed on `club_subs.created_at` would re-trigger the same false positive on renewals (which bump `end_date` on an existing row, old `created_at`). The correct club Tier needs `club_subs.updated_at` — bundled with the deferred `updated_at` work below.

Other known limits: Tier 1 uses `user_course.created_at` as the grant timestamp, so a 90-min window containing only course *renewals* of old rows can false-positive (harmless "check payments" email). **Deferred (one combined pass):** (a) add `updated_at` + trigger to **both** `user_course` and `club_subs` → eliminates the renewal false-positives, enables a precise per-buyer **Tier 2** course named-lockout alert AND a proper **club-subscription Tier**; (b) alert throttle/dedup (v1 re-emails every 10 min during an outage — acceptable).

Remediation:
- **Lock-outs:** of 18 `buy=false` paid-course rows since 08-08, only **1** was a genuinely-paid-and-locked buyer (`2732f06b`, unblocked); the rest were **abandoned checkouts** (the frontend inserts the `user_course` row on the "buy" click, before payment — normal). Verified against paid `order`s (and Prodamus) before granting.
- **Collateral:** **0** false grants (the INSERT branch never ran, so no non-buyer got a new `buy=true` row — only existing paid rows had `end_period` touched). **2** real shortenings restored (`db7acda5`, `067c8963`); 1 accidental *extension* left in place (don't remove a paying user's access); 2 one-day date-rounding diffs ignored.

**Detection gap / follow-up (deferred):** this ran wrong for ~6 days unnoticed because there is **no monitoring/alerting on the money flow**. A basic guardrail would have caught it same-day — e.g. an alert on "paid `order` (or `sales` row) with no corresponding `user_course.buy=true` within N minutes", or a daily anomaly check on purchase→grant conversion. Not a blocker; worth adding when basic business-metric monitoring is set up.
