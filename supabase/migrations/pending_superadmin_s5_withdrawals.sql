-- S5 (/superadmin) — withdrawal approve/reject RPCs + test fixture. Run in Supabase Studio.
-- SECURITY DEFINER + admin gate + atomic queue guard (only status='Запрошено').
-- NO bank details ever written to admin_money_log — only amount/status/ref_id.
-- Balance was already deducted at REQUEST time, so: approve = status mark only (no money moves —
-- the real transfer is done MANUALLY by the admin via bank); reject = refund Ammount += amount.

create or replace function public.admin_approve_withdrawal(p_sale uuid, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text; v_amount numeric; v_user uuid;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select status, amount, "user" into v_status, v_amount, v_user from public.sales where id = p_sale;
  if v_status is null then raise exception 'withdrawal not found' using errcode='P0002'; end if;
  if v_status <> 'Запрошено' then raise exception 'withdrawal already handled (status=%)', v_status using errcode='22023'; end if;
  -- guarded transition (also blocks a concurrent double-process)
  update public.sales
     set status='Подтверждено', admin_comment = coalesce(nullif(btrim(p_comment),''), admin_comment)
   where id = p_sale and status='Запрошено';
  if not found then raise exception 'withdrawal already handled (concurrent)' using errcode='22023'; end if;
  -- balance NOT touched (already deducted at request). Log without any bank PII.
  insert into public.admin_money_log (actor, action, target_user, field, old_value, new_value, amount, ref_id, reason)
    values (auth.uid(), 'withdrawal_approve', v_user, 'sales.status', 'Запрошено', 'Подтверждено', v_amount, p_sale, nullif(btrim(p_comment),''));
  return jsonb_build_object('id', p_sale, 'status', 'Подтверждено', 'amount', v_amount);
end $$;

create or replace function public.admin_reject_withdrawal(p_sale uuid, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text; v_amount numeric; v_user uuid;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select status, amount, "user" into v_status, v_amount, v_user from public.sales where id = p_sale;
  if v_status is null then raise exception 'withdrawal not found' using errcode='P0002'; end if;
  if v_status <> 'Запрошено' then raise exception 'withdrawal already handled (status=%)', v_status using errcode='22023'; end if;
  if v_user is null then raise exception 'cannot refund: withdrawal has no user' using errcode='22023'; end if;
  -- guarded transition
  update public.sales
     set status='Отклонено', back=true, admin_comment = coalesce(nullif(btrim(p_comment),''), admin_comment)
   where id = p_sale and status='Запрошено';
  if not found then raise exception 'withdrawal already handled (concurrent)' using errcode='22023'; end if;
  -- refund the reserved amount back to the author's balance (atomic with the status change)
  update public.users set "Ammount" = coalesce("Ammount",0) + coalesce(v_amount,0) where id = v_user;
  insert into public.admin_money_log (actor, action, target_user, field, old_value, new_value, amount, ref_id, reason)
    values (auth.uid(), 'withdrawal_reject', v_user, 'sales.status', 'Запрошено', 'Отклонено', v_amount, p_sale, nullif(btrim(p_comment),''));
  return jsonb_build_object('id', p_sale, 'status', 'Отклонено', 'refunded', v_amount);
end $$;

grant execute on function public.admin_approve_withdrawal(uuid, text) to authenticated;
grant execute on function public.admin_reject_withdrawal(uuid, text)  to authenticated;


-- ── TEST FIXTURE ─────────────────────────────────────────────────────────────
-- A withdrawal request on the safe non-selling account "Администратор" (Спикер, balance 0).
-- Fake [ТЕСТ] bank details. amount=100 → after the reject-refund test the balance goes 0→100,
-- which cleanup resets to 0. Returns the test withdrawal id.
insert into public.sales ("user", amount, status, name_bank, inn, kpp, bik, pc, kc)
values ('53c01323-9b49-4e03-946d-519cfcc97fcb', 100, 'Запрошено',
        '[ТЕСТ] Банк', 'TESTINN', 'TESTKPP', 'TESTBIK', 'TESTPC', 'TESTKC')
returning id;   -- ← note this test withdrawal id

-- Between the approve and reject tests, reopen the request:
--   update public.sales set status='Запрошено', back=false where id='<test-id>';
-- Verify:
--   select id, status, back, amount from public.sales where id='<test-id>';
--   select "Ammount" from public.users where id='53c01323-9b49-4e03-946d-519cfcc97fcb';
--   select action, amount, ref_id, reason from public.admin_money_log where ref_id='<test-id>' order by created_at;
-- CLEANUP after both tests:
--   delete from public.admin_money_log where ref_id='<test-id>';
--   delete from public.sales where id='<test-id>';
--   update public.users set "Ammount"=0 where id='53c01323-9b49-4e03-946d-519cfcc97fcb';  -- undo refund
