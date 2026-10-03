-- ============================================================================
-- Promo codes — admin-managed discount codes applied at checkout.
--
-- Decisions (2026-10-03):
--  * Discount types: percent (0..100) OR fixed (₽). Chosen per code.
--  * Scope: 'all' (any course/stream/event) OR 'course' (bound to one course).
--    v1 per-product binding = COURSES only; streams/events are covered by 'all' codes.
--  * Limits: usage_limit (total activations, null = unlimited) + expires_at (null = no expiry).
--  * Deletion: manual only, from /superadmin.
--  * Discount is PROPORTIONAL — it reduces shop.price too, so n8n BuyCourse bills the
--    author's commission on the discounted price and the invariant
--    order.summ == Σ shop.price == amount charged stays intact.
--  * Redemption is counted on PAID orders via a trigger that reacts to order.paid
--    (mirrors order.event_id / trg_event_order_paid) — n8n BuyCourse is NOT touched.
--
-- Trust note (pre-existing, NOT introduced here): the charged amount is computed
-- client-side across the whole checkout today. preview_promo validates the code and
-- computes the authoritative discount server-side, and used_count only ever increments
-- on a real paid order carrying promo_code_id — but a hand-crafted request could still
-- bypass the UI, exactly as it can for any price today. Hardening the whole client-trust
-- model is out of scope for this feature.
-- ============================================================================

-- 1. Tables ------------------------------------------------------------------

create table if not exists public.promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text    not null,
  discount_type   text    not null check (discount_type in ('percent','fixed')),
  discount_value  numeric not null check (discount_value > 0),
  scope_type      text    not null default 'all' check (scope_type in ('all','course')),
  scope_course_id uuid,                         -- loose ref to course.id (RLS-off project style)
  usage_limit     integer check (usage_limit is null or usage_limit > 0),  -- null = unlimited
  used_count      integer not null default 0,
  expires_at      timestamptz,                  -- null = never expires
  created_at      timestamptz not null default now(),
  created_by      uuid,
  constraint promo_percent_range check (discount_type <> 'percent' or discount_value <= 100),
  constraint promo_scope_course  check (scope_type <> 'course' or scope_course_id is not null)
);
-- case-insensitive uniqueness of the code
create unique index if not exists promo_codes_code_key on public.promo_codes (upper(code));

-- Audit trail of actual redemptions (survives promo deletion: loose promo_id, no FK).
create table if not exists public.promo_redemptions (
  id                uuid primary key default gen_random_uuid(),
  promo_id          uuid not null,
  user_id           uuid,
  order_id          uuid,
  amount_discounted numeric,
  created_at        timestamptz not null default now()
);
create index if not exists promo_redemptions_promo_idx on public.promo_redemptions (promo_id);

-- BuyCourse-invisible markers on order (like order.event_id). BuyCourse never reads them.
alter table public."order" add column if not exists promo_code_id  uuid;
alter table public."order" add column if not exists promo_discount numeric;  -- ₽ discounted, for audit

-- Not REST-exposed: reachable only through the SECURITY DEFINER RPCs below
-- (keeps valid codes secret from regular users — no enumeration).
revoke all on public.promo_codes       from anon, authenticated;
revoke all on public.promo_redemptions from anon, authenticated;

-- 2. Admin RPCs (gate: role='admin' or superadmin) ---------------------------

create or replace function public.admin_list_promos()
  returns setof public.promo_codes
  language plpgsql security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  return query select * from public.promo_codes order by created_at desc;
end $$;

create or replace function public.admin_create_promo(
  p_code text, p_type text, p_value numeric, p_scope text,
  p_course_id uuid, p_limit integer, p_expires timestamptz
) returns jsonb
  language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_code text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  v_code := upper(btrim(coalesce(p_code,'')));
  if v_code = '' then raise exception 'code required' using errcode='22023'; end if;
  if p_type not in ('percent','fixed') then raise exception 'bad discount_type' using errcode='22023'; end if;
  if p_value is null or p_value <= 0 then raise exception 'discount_value must be > 0' using errcode='22023'; end if;
  if p_type = 'percent' and p_value > 100 then raise exception 'percent must be <= 100' using errcode='22023'; end if;
  if coalesce(p_scope,'all') not in ('all','course') then raise exception 'bad scope' using errcode='22023'; end if;
  if coalesce(p_scope,'all') = 'course' and p_course_id is null then
    raise exception 'course required for scope=course' using errcode='22023';
  end if;
  if p_limit is not null and p_limit <= 0 then raise exception 'limit must be > 0' using errcode='22023'; end if;
  if exists (select 1 from public.promo_codes where upper(code) = v_code) then
    raise exception 'code already exists' using errcode='23505';
  end if;

  insert into public.promo_codes
    (code, discount_type, discount_value, scope_type, scope_course_id, usage_limit, expires_at, created_by)
  values
    (v_code, p_type, p_value, coalesce(p_scope,'all'),
     case when coalesce(p_scope,'all') = 'course' then p_course_id else null end,
     p_limit, p_expires, auth.uid())
  returning id into v_id;

  insert into public.admin_money_log (actor, action, field, new_value, reason, ref_id)
  values (auth.uid(), 'promo_create', 'promo', v_code,
          p_type || ' ' || p_value::text || ' scope=' || coalesce(p_scope,'all'), v_id);

  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.admin_delete_promo(p_id uuid)
  returns jsonb
  language plpgsql security definer set search_path to 'public'
as $$
declare v_code text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select code into v_code from public.promo_codes where id = p_id;
  if not found then raise exception 'promo not found' using errcode='P0002'; end if;

  delete from public.promo_codes where id = p_id;  -- redemptions kept (loose promo_id)

  insert into public.admin_money_log (actor, action, field, old_value, reason, ref_id)
  values (auth.uid(), 'promo_delete', 'promo', v_code, 'deleted', p_id);

  return jsonb_build_object('id', p_id, 'deleted', true);
end $$;

-- 3. User RPC: validate + compute the authoritative discount (read-only) ------
-- Reads the caller's OWN cart lines by id (owner = auth.uid(), status = 'cart') so the
-- prices are server-trusted, not taken from the client. Returns per-line new prices.

create or replace function public.preview_promo(p_code text, p_shop_ids uuid[])
  returns jsonb
  language plpgsql security definer set search_path to 'public'
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_uid uuid := auth.uid();
  v_cart_total numeric := 0;
  v_eligible_total numeric := 0;
  v_discount numeric := 0;
  v_factor numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  r record;
begin
  if v_uid is null then raise exception 'auth required' using errcode='42501'; end if;

  select * into v_promo from public.promo_codes where upper(code) = upper(btrim(coalesce(p_code,'')));
  if not found then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if v_promo.usage_limit is not null and v_promo.used_count >= v_promo.usage_limit then
    return jsonb_build_object('valid', false, 'reason', 'limit_reached');
  end if;

  for r in
    select id, coalesce(price,0) as price, course_id
    from public.shop
    where id = any(p_shop_ids) and owner = v_uid and status = 'cart'
  loop
    v_cart_total := v_cart_total + r.price;
    if v_promo.scope_type = 'all'
       or (v_promo.scope_type = 'course' and r.course_id = v_promo.scope_course_id) then
      v_eligible_total := v_eligible_total + r.price;
    end if;
  end loop;

  if v_eligible_total <= 0 then
    return jsonb_build_object('valid', false, 'reason', 'not_applicable');
  end if;

  if v_promo.discount_type = 'percent' then
    v_discount := round(v_eligible_total * v_promo.discount_value / 100, 2);
  else
    v_discount := least(v_promo.discount_value, v_eligible_total);  -- fixed, capped
  end if;
  v_factor := case when v_eligible_total > 0 then v_discount / v_eligible_total else 0 end;

  for r in
    select id, coalesce(price,0) as price, course_id
    from public.shop
    where id = any(p_shop_ids) and owner = v_uid and status = 'cart'
  loop
    if v_promo.scope_type = 'all'
       or (v_promo.scope_type = 'course' and r.course_id = v_promo.scope_course_id) then
      v_lines := v_lines || jsonb_build_object('shop_id', r.id, 'new_price', round(r.price * (1 - v_factor), 2));
    else
      v_lines := v_lines || jsonb_build_object('shop_id', r.id, 'new_price', r.price);
    end if;
  end loop;

  return jsonb_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'cart_total', v_cart_total,
    'eligible_total', v_eligible_total,
    'discount', v_discount,
    'new_total', v_cart_total - v_discount,
    'lines', v_lines
  );
end $$;

grant execute on function public.preview_promo(text, uuid[]) to authenticated;

-- 4. Count the redemption on payment (BuyCourse untouched) --------------------
-- Fires only on the paid-transition of an order that carries a promo. Increments
-- used_count while under the limit and records an audit row. Mirrors trg_event_order_paid.

create or replace function public.tg_order_paid_promo()
  returns trigger
  language plpgsql security definer set search_path to 'public'
as $$
begin
  update public.promo_codes
     set used_count = used_count + 1
   where id = new.promo_code_id
     and (usage_limit is null or used_count < usage_limit);

  insert into public.promo_redemptions (promo_id, user_id, order_id, amount_discounted)
  values (new.promo_code_id, new.owner, new.id, new.promo_discount);

  return new;
end $$;

drop trigger if exists trg_order_paid_promo on public."order";
create trigger trg_order_paid_promo
  after update on public."order"
  for each row
  when (new.paid is true and (old.paid is distinct from true) and new.promo_code_id is not null)
  execute function public.tg_order_paid_promo();

-- 5. Reload PostgREST schema cache so the new RPCs are callable over REST.
notify pgrst, 'reload schema';
