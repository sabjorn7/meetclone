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
