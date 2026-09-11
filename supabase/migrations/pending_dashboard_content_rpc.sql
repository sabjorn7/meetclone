-- Ф3 dashboard content RPC — run manually in Supabase Studio (SQL editor).
-- SECURITY DEFINER with an internal admin gate (auth.uid() must be a users.role='admin'
-- OR users.superadmin=true) — the real protection since RLS is off project-wide.
--
--   admin_top_courses(p_from, p_to, p_limit) -> jsonb {
--     by_enroll:  [{course_id,title,owner,status,enroll_n}]   -- top courses by user_course
--                                                                enrollments created in range
--     by_revenue: [{course_id,title,revenue,sales_n}]         -- top courses by attributed sales
--                                                                (sales.position -> shop.course_id)
--   }
-- Status/count breakdowns are NOT here — those are plain non-money direct queries client-side.

create or replace function public.admin_top_courses(p_from date default null, p_to date default null, p_limit int default 8)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare v jsonb;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role = 'admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'by_enroll', coalesce((
      select jsonb_agg(t order by t.enroll_n desc)
      from (
        select c.id as course_id, c."Title" as title, coalesce(u."Name", '—') as owner,
               c."ModStatus" as status, count(uc.id)::int as enroll_n
        from public.course c
        join public.user_course uc on uc.course = c.id
          and (p_from is null or uc.created_at >= p_from)
          and (p_to   is null or uc.created_at <  (p_to + 1))
        left join public.users u on u.id = c.owner
        group by c.id, c."Title", u."Name", c."ModStatus"
        order by enroll_n desc
        limit greatest(p_limit, 0)
      ) t
    ), '[]'::jsonb),
    'by_revenue', coalesce((
      select jsonb_agg(t order by t.revenue desc)
      from (
        select c.id as course_id, c."Title" as title,
               coalesce(sum(s.price), 0) as revenue, count(*)::int as sales_n
        from public.sales s
        join public.shop sh on sh.id = s."position"
        join public.course c on c.id = sh.course_id
        where s."position" is not null and s.back is not true
          and (p_from is null or s.created_at >= p_from)
          and (p_to   is null or s.created_at <  (p_to + 1))
        group by c.id, c."Title"
        order by revenue desc
        limit greatest(p_limit, 0)
      ) t
    ), '[]'::jsonb)
  ) into v;

  return v;
end $$;

grant execute on function public.admin_top_courses(date, date, int) to authenticated;
