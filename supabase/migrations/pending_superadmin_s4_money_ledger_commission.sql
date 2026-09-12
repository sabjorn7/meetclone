-- S4 foundation (/superadmin rebuild) — money-audit ledger + author-commission RPC.
-- Run in Supabase Studio. Variant A: build the audit ledger FIRST, then commission editing on top.
-- Principle (agreed): direct balance (Ammount) editing is NOT rebuilt here — too high-risk without
-- this ledger; it stays on the WeWeb page. This ledger is generic and reused by S5 (payouts).

-- ── 1) Generic money-audit ledger ────────────────────────────────────────────
-- Written ONLY inside SECURITY DEFINER RPCs, in the same transaction as the mutation
-- (so a money mutation can never happen without its audit row). NOT exposed via PostgREST:
-- revoked from anon/authenticated, so it is reachable only through admin-gated functions.
create table if not exists public.admin_money_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor       uuid not null,        -- admin who performed the action (auth.uid())
  action      text not null,        -- 'commission_change' | 'withdrawal_approve' | 'withdrawal_reject' | ...
  target_user uuid,                 -- the affected user
  field       text,                 -- e.g. 'authorCommission', 'Ammount', 'sales.status'
  old_value   text,                 -- previous value (stringified)
  new_value   text,                 -- new value (stringified)
  amount      numeric,              -- monetary delta (payouts/balance); null for commission
  ref_id      uuid,                 -- related row (e.g. sales withdrawal id in S5); null otherwise
  reason      text                  -- why (required at the RPC layer, not the table)
);
create index if not exists admin_money_log_target_idx on public.admin_money_log (target_user, created_at desc);
create index if not exists admin_money_log_action_idx on public.admin_money_log (action, created_at desc);

-- Hardening: the audit log must not be readable/writable directly by the API roles.
revoke all on public.admin_money_log from anon, authenticated;

-- ── 2) S4 RPC — set author commission (%) with audit ─────────────────────────
-- Admin-gated. Validates 0..100. Requires a reason. Future-only (n8n Create_Sales reads
-- authorCommission at sale time; past sales are untouched). Logs old→new atomically.
create or replace function public.admin_set_commission(p_user uuid, p_value numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old numeric;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_value is null or p_value < 0 or p_value > 100 then
    raise exception 'commission must be between 0 and 100 (got %)', p_value using errcode='22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason required' using errcode='22023';
  end if;
  select "authorCommission" into v_old from public.users where id = p_user;
  if not found then raise exception 'user not found' using errcode='P0002'; end if;
  if v_old is not distinct from p_value then
    raise exception 'commission unchanged (already %)', p_value using errcode='22023';
  end if;
  update public.users set "authorCommission" = p_value where id = p_user;
  insert into public.admin_money_log (actor, action, target_user, field, old_value, new_value, reason)
    values (auth.uid(), 'commission_change', p_user, 'authorCommission', v_old::text, p_value::text, btrim(p_reason));
  return jsonb_build_object('user', p_user, 'old', v_old, 'new', p_value);
end $$;

grant execute on function public.admin_set_commission(uuid, numeric, text) to authenticated;

-- ── Verify (after creating) ──────────────────────────────────────────────────
--   select * from public.admin_money_log order by created_at desc limit 10;   -- runs as table owner in Studio
-- Gate probe (should error 'forbidden' with no admin auth):
--   select public.admin_set_commission('<some-user>', 82, 'probe');
-- The happy-path (real change + audit row) is exercised once the S4 UI is built and an admin clicks it.
