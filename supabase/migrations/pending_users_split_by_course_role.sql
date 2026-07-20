-- APPLIED.
--
-- Adds an optional p_role filter to users_split_by_course, used by /users to search
-- the user list. Backward compatible: new param has a DEFAULT, existing callers that
-- don't pass p_role are unaffected.
--
-- NOTE: CREATE OR REPLACE FUNCTION only replaces a function with the exact same
-- parameter signature. Adding p_role changes the signature, so without the DROP below
-- Postgres creates a second overload instead of replacing the original - which then
-- makes every 5-argument call (from the other pages sharing this same "list users"
-- widget) ambiguous between the two overloads. Drop the old signature first so only
-- the new (backward-compatible) one exists.

begin;

DROP FUNCTION IF EXISTS public.users_split_by_course(integer, integer, text, text, uuid[]);

CREATE OR REPLACE FUNCTION public.users_split_by_course(
  p_n integer DEFAULT 1,
  p_limit integer DEFAULT 20,
  p_name text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_course uuid[] DEFAULT NULL::uuid[],
  p_role text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_page int := greatest(coalesce(p_n,1), 1);
  v_limit int := greatest(coalesce(p_limit,20), 1);

  v_count_true bigint := 0;
  v_count_false bigint := 0;

  v_pages_true int := 0;
  v_pages_false int := 0;

  v_total_pages int := 0;
  v_total_records bigint := 0;

  v_user_true_full jsonb := '[]'::jsonb;
  v_user_false_full jsonb := '[]'::jsonb;

  v_user_true_page jsonb := '[]'::jsonb;
  v_user_false_page jsonb := '[]'::jsonb;

  v_is_course_filter bool := coalesce(array_length(p_course,1),0) > 0;
begin
  with base as (
    select u.id, u.email, u."Photo", u."Name", u.created_at
    from public.users u
    where (p_name  is null or u."Name"  ilike '%'||p_name||'%')
      and (p_email is null or u.email   ilike '%'||p_email||'%')
      and (p_role  is null or u.role    = p_role)
  ),
  marked as (
    select
      b.*,
      case
        when not v_is_course_filter then false
        else exists (
          select 1
          from public.user_course uc
          where uc."user" = b.id
            and uc.course = any (p_course)
        )
      end as has_course,
      (
        select uc2.id
        from public.user_course uc2
        where uc2."user" = b.id
          and (v_is_course_filter and uc2.course = any (p_course))
        order by uc2.created_at desc, uc2.id desc
        limit 1
      ) as user_course_id
    from base b
  )
  select
    (select count(*) from marked m where m.has_course),
    (select count(*) from marked m where not m.has_course),

    (select coalesce(
              jsonb_agg(jsonb_build_object(
                'id', mm.id,
                'email', mm.email,
                'photo', mm."Photo",
                'name', mm."Name",
                'created_at', mm.created_at,
                'user_course_id', mm.user_course_id
              ) order by mm.created_at desc, mm.id desc), '[]'::jsonb)
     from marked mm where mm.has_course),

    (select coalesce(
              jsonb_agg(jsonb_build_object(
                'id', mm.id,
                'email', mm.email,
                'photo', mm."Photo",
                'name', mm."Name",
                'created_at', mm.created_at,
                'user_course_id', mm.user_course_id
              ) order by mm.created_at desc, mm.id desc), '[]'::jsonb)
     from marked mm where not mm.has_course)
  into v_count_true, v_count_false, v_user_true_full, v_user_false_full;

  -- пагинация для каждого массива
  v_user_true_page := (
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    from jsonb_array_elements(v_user_true_full) with ordinality t(elem, ord)
    where ord > (v_page-1)*v_limit and ord <= v_page*v_limit
  );

  v_user_false_page := (
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    from jsonb_array_elements(v_user_false_full) with ordinality t(elem, ord)
    where ord > (v_page-1)*v_limit and ord <= v_page*v_limit
  );

  -- страницы
  v_pages_true  := case when v_count_true  > 0 then ceil(v_count_true  / v_limit::numeric)::int else 0 end;
  v_pages_false := case when v_count_false > 0 then ceil(v_count_false / v_limit::numeric)::int else 0 end;
  v_total_pages := greatest(v_pages_true, v_pages_false);

  v_total_records := coalesce(v_count_true,0) + coalesce(v_count_false,0);

  return jsonb_build_object(
    'current_page', v_page,
    'total_pages', v_total_pages,          -- максимальное из двух
    'total_pages_true', v_pages_true,      -- КОЛ-ВО страниц для user_true
    'total_pages_false', v_pages_false,    -- КОЛ-ВО страниц для user_false
    'total_records', v_total_records,
    'user_true', v_user_true_page,
    'user_false', v_user_false_page
  );
end;
$function$;

commit;
