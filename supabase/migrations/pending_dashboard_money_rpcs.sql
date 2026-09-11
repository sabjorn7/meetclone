-- Ф1 dashboard money RPCs — run manually in Supabase Studio (SQL editor).
-- Both are SECURITY DEFINER with an internal admin gate (auth.uid() must be a
-- users.role='admin' OR users.superadmin=true). RLS is off project-wide, so this
-- in-function check is what actually restricts money data to admins.
--
--   admin_revenue_daily(p_from, p_to)   -> table(d date, revenue numeric, orders bigint)
--        Real cash: paid orders (public."order".summ where paid), grouped by day.
--   admin_sales_by_author(p_from, p_to) -> jsonb array
--        Attribution: real sales rows (position not null, back not true), grouped by
--        author (sales."user") with role; gross=sum(price), accrued=sum(amount).

create or replace function public.admin_revenue_daily(p_from date default null, p_to date default null)
returns table(d date, revenue numeric, orders bigint)
language plpgsql security definer set search_path = public stable as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role = 'admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select o.created_at::date, coalesce(sum(o.summ), 0), count(*)::bigint
    from public."order" o
    where o.paid is true
      and (p_from is null or o.created_at >= p_from)
      and (p_to   is null or o.created_at <  (p_to + 1))
    group by o.created_at::date
    order by 1;
end $$;

create or replace function public.admin_sales_by_author(p_from date default null, p_to date default null)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare v jsonb;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role = 'admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(t order by t.gross desc), '[]'::jsonb) into v
  from (
    select s."user" as author_id, u."Name" as name, coalesce(u.role, '—') as role,
           count(*)::int as sales_n, coalesce(sum(s.price), 0) as gross, coalesce(sum(s.amount), 0) as accrued
    from public.sales s
    left join public.users u on u.id = s."user"
    where s."position" is not null and s.back is not true
      and (p_from is null or s.created_at >= p_from)
      and (p_to   is null or s.created_at <  (p_to + 1))
    group by s."user", u."Name", u.role
  ) t;
  return v;
end $$;

grant execute on function public.admin_revenue_daily(date, date)   to authenticated;
grant execute on function public.admin_sales_by_author(date, date) to authenticated;
