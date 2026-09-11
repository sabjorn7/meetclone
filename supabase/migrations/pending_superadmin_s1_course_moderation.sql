-- S1 (/superadmin rebuild) — course moderation RPCs + test fixtures. Run in Supabase Studio.
-- Both RPCs are SECURITY DEFINER with an internal admin gate (auth.uid() must be users.role='admin'
-- OR users.superadmin=true) — the real protection since RLS is off project-wide. Extra safety vs the
-- old WeWeb page: the transition is allowed ONLY from the moderation queue (Отправлено на модерацию /
-- На модерации), so a stale/wrong id can never publish an arbitrary draft.
--
-- These are VOLATILE (they mutate) — not STABLE.

-- ── RPCs ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_approve_course(p_course uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select "ModStatus" into v_status from public.course where id = p_course;
  if v_status is null then raise exception 'course not found' using errcode='P0002'; end if;
  if v_status not in ('Отправлено на модерацию','На модерации') then
    raise exception 'course not in moderation queue (status=%)', v_status using errcode='22023';
  end if;
  update public.course
     set "ModStatus"='Опубликовано', "Edit_Comment"='', "Edit_Lessons_Comment"=''
   where id = p_course;
  return jsonb_build_object('id', p_course, 'status', 'Опубликовано');
end $$;

create or replace function public.admin_return_course(p_course uuid, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_comment is null or btrim(p_comment) = '' then
    raise exception 'comment required' using errcode='22023';
  end if;
  select "ModStatus" into v_status from public.course where id = p_course;
  if v_status is null then raise exception 'course not found' using errcode='P0002'; end if;
  if v_status not in ('Отправлено на модерацию','На модерации') then
    raise exception 'course not in moderation queue (status=%)', v_status using errcode='22023';
  end if;
  update public.course
     set "ModStatus"='Отправлено на доработку', "Edit_Comment"=p_comment
   where id = p_course;
  return jsonb_build_object('id', p_course, 'status', 'Отправлено на доработку');
end $$;

grant execute on function public.admin_approve_course(uuid)      to authenticated;
grant execute on function public.admin_return_course(uuid, text) to authenticated;


-- ── TEST FIXTURE ─────────────────────────────────────────────────────────────
-- Create a safe test course owned by the admin, Free, no lessons, sitting in the queue.
-- (If course.id has no default, prepend  id => gen_random_uuid()  to the column list.)
insert into public.course ("Title", "Free", "owner", "ModStatus", "Category")
values ('[ТЕСТ] Модерация — не покупать', true,
        'b689d683-f143-47db-a5b0-5940d7f52b02', 'Отправлено на модерацию', 'Тест')
returning id;   -- ← note this id for verification

-- Between the two live-button tests, put the test course back into the queue:
--   update public.course set "ModStatus"='Отправлено на модерацию'
--     where "Title"='[ТЕСТ] Модерация — не покупать';

-- Verify current state at any time:
--   select id, "Title", "ModStatus", "Edit_Comment"
--     from public.course where "Title"='[ТЕСТ] Модерация — не покупать';

-- CLEANUP after both tests pass (removes the test course entirely):
--   delete from public.course where "Title"='[ТЕСТ] Модерация — не покупать';
