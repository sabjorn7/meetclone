-- ============================================================================
-- ОТКАТ (выполнить, чтобы полностью снять этот шаг):
--   drop function if exists public.upsert_cheatsheet(uuid, jsonb, text);
--   drop function if exists public.get_cheatsheet(uuid);
--   drop table    if exists public.cheatsheet;
--   notify pgrst, 'reload schema';
-- ============================================================================

-- ============================================================================
-- «Конспект курса» (cheatsheet) — ШАГ 1: таблица + доступ ТОЛЬКО через RPC.
--
-- Модель доступа (RLS включён, политик НЕТ, прямые гранты сняты → к таблице
-- напрямую не может никто из anon/authenticated; читать/писать — только через
-- SECURITY DEFINER функции, которые владеет postgres и обходит RLS):
--   get_cheatsheet(course_id)  — чтение: автор курса и админ видят любой статус
--     (в т.ч. draft); купившие/бесплатно-записанные — только status='reviewed'
--     и только пока доступ не истёк (зеркалит access-gate MyCoursePage).
--   upsert_cheatsheet(...)     — запись: только автор курса или админ.
-- Роль админа: по реальным данным сейчас только 'admin' (1 юзер); 'superadmin'
--   оставлен для будущего (в users.role его сегодня нет).
-- ============================================================================

-- 1. Таблица -----------------------------------------------------------------
create table if not exists public.cheatsheet (
  course_id   uuid primary key,                         -- один конспект на курс (loose ref, RLS-off стиль проекта)
  sections    jsonb       not null default '{}'::jsonb, -- {"algorithms":[{title,body,lesson}],"faq":[...],"apply":[...]}
  status      text        not null default 'draft' check (status in ('draft','reviewed')),
  version     integer     not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- RLS включён БЕЗ политик + сняты прямые гранты → прямой доступ закрыт всем,
-- кроме SECURITY DEFINER функций ниже (владелец postgres обходит RLS).
alter table public.cheatsheet enable row level security;
revoke all on table public.cheatsheet from anon, authenticated;

-- 2. Чтение (SECURITY DEFINER) ------------------------------------------------
create or replace function public.get_cheatsheet(p_course_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_free   boolean;
  v_dur    numeric;
  v_admin  boolean;
  v_access boolean;
  v_row    public.cheatsheet%rowtype;
begin
  select owner, "Free", coalesce("DurationLong", 0)
    into v_owner, v_free, v_dur
    from public.course
   where id = p_course_id;
  if v_owner is null then
    return null;                                  -- курса нет
  end if;

  select exists(
    select 1 from public.users
     where id = v_uid and role in ('admin', 'superadmin')
  ) into v_admin;

  -- доступ купившего С УЧЁТОМ СРОКА: исключаем, если доступ ограничен по времени
  -- (DurationLong<>0), end_period задан, это не "пожизненный" (end_period ≠ дата создания)
  -- и срок уже истёк. Зеркалит проверку в MyCoursePage.
  select (
    v_free or exists(
      select 1
        from public.user_course uc
       where uc.course = p_course_id
         and uc."user" = v_uid
         and not (
               v_dur <> 0
           and uc.end_period is not null
           and uc.end_period::date <> uc.created_at::date
           and uc.end_period < now()
         )
    )
  ) into v_access;

  select * into v_row from public.cheatsheet where course_id = p_course_id;
  if v_row.course_id is null then
    return null;                                  -- конспекта ещё нет
  end if;

  if v_uid = v_owner or v_admin then
    return to_jsonb(v_row);                       -- автор/админ — любой статус (включая draft)
  elsif v_access and v_row.status = 'reviewed' then
    return to_jsonb(v_row);                       -- купившие/бесплатные — только reviewed и в сроке
  end if;
  return null;                                    -- нет доступа / ещё draft
end $$;

-- 3. Запись (SECURITY DEFINER, только автор/админ) ----------------------------
create or replace function public.upsert_cheatsheet(p_course_id uuid, p_sections jsonb, p_status text default null)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_admin boolean;
begin
  select owner into v_owner from public.course where id = p_course_id;
  if v_owner is null then raise exception 'course not found'; end if;

  select exists(
    select 1 from public.users where id = v_uid and role in ('admin', 'superadmin')
  ) into v_admin;

  if not (v_uid = v_owner or v_admin) then
    raise exception 'forbidden';
  end if;
  if p_status is not null and p_status not in ('draft', 'reviewed') then
    raise exception 'bad status';
  end if;

  insert into public.cheatsheet (course_id, sections, status, version, updated_at, updated_by)
  values (p_course_id, p_sections, coalesce(p_status, 'draft'), 1, now(), v_uid)
  on conflict (course_id) do update
     set sections   = excluded.sections,
         status     = coalesce(p_status, public.cheatsheet.status),
         version    = public.cheatsheet.version + 1,
         updated_at = now(),
         updated_by = v_uid;

  return (select to_jsonb(c) from public.cheatsheet c where c.course_id = p_course_id);
end $$;

-- 4. Гранты на функции: не public/anon, только authenticated ------------------
revoke execute on function public.get_cheatsheet(uuid)                 from public, anon;
grant  execute on function public.get_cheatsheet(uuid)                 to   authenticated;
revoke execute on function public.upsert_cheatsheet(uuid, jsonb, text) from public, anon;
grant  execute on function public.upsert_cheatsheet(uuid, jsonb, text) to   authenticated;

-- 5. Перечитать схему PostgREST, чтобы RPC стали видны по REST.
notify pgrst, 'reload schema';
