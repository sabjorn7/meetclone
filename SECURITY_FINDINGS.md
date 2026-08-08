# Security / correctness findings

Running list of security- and correctness-relevant findings and deferred work.

## Course access — time-limited access

### FIXED (client-side gate) — 2026-08-08
Time-limited course access (`user_course.end_period`) was written on purchase but **never enforced**: the client gate on `my_courses` and `course/{slug}` only checked that a `user_course` row existed, never comparing `end_period` to "now". RLS is disabled on `user_course`/`lessons`/`course`, there is no `pg_cron` cleanup and no expiry trigger — so expired paid courses stayed accessible forever. At time of fix: **846** genuinely time-limited accesses (across **323** users) were expired but still open.

Fix (client-only, mirrors the club `end_date > dayjs.now()` pattern; unified on the static `date()` "now" everywhere):
- `course/{slug}` (`290e681e`): buy-button label is now 3-way (active → "Уже в библиотеке", expired-owned → "Продлить", else "Купить"/"Добавить"). Purchase flow untouched.
- `my_courses` (`4f77bcf6`): the player-open handler no longer opens an expired card; a remaining-time badge shows days left / expired date; a "Продлить" pill appears on expired cards.
- The 846 expired rows were **left untouched** in the DB — the gate now filters them out by `end_period` automatically.

### OPEN — course renewal payment is NOT wired
The "Продлить" button routes to the support/contacts page — it does **not** trigger a real payment yet. The correct renewal price is `course.DurationPrice` (populated on 50/52 time-limited courses, and ≠ `course.Price` in 49 of them — e.g. 2 900 ₽ renewal vs 14 900 ₽ full price), so charging `Price` would overcharge. Before activating a real renewal charge:
- Verify the **n8n** access-grant logic (the `shop` order carries a hardcoded `prolong:12`; n8n — outside this repo — sets/extends `user_course.end_period` after the Prodamus callback). Confirm how it computes the extended window and whether it updates vs inserts a row.
- Then wire the renewal to charge `DurationPrice` and land the user on a working payment flow, only once the grant side is confirmed. Paying for a renewal that does not actually extend access is worse than no button.

### OPEN — server-side enforcement deferred
The current fix is **client-side only**. Server-side enforcement (RLS on `user_course` filtering `end_period > now() OR end_period IS NULL`, and/or a scheduled `pg_cron` cleanup) is deferred to the broader security review. Until then, a crafted direct PostgREST/API call could still read expired rows.
