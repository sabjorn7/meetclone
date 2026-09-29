-- Optional "recording course" for PAID streams — same opt-in pattern as the group chat.
-- When enabled, creating a paid stream auto-creates a DRAFT course (empty — the author adds the
-- recording/video later). Every buyer of the stream ALSO gets a user_course row on that recording
-- course, so once the author publishes it, it appears in their «Мои курсы» automatically.
--
-- Reuses the stream-chat pattern verbatim:
--   streams.chat            ← tg_stream_create_chat          → streams.recording_course ← tg_stream_create_recording_course
--   tg_stream_bought_add_to_chat (buyer→chat)               → tg_stream_bought_grant_recording (buyer→2nd user_course)
-- Buyer signal is the SAME: a user_course INSERT on the stream's backing course.

-- 1) columns ------------------------------------------------------------------
alter table public.streams
  add column if not exists recording_course uuid,
  add column if not exists recording_course_enabled boolean not null default false;

-- 2) create the draft recording course on stream insert when opted in ---------
--    Course has NO required fields (only id/created_at auto-default). Draft defaults:
--    owner = author (shows in their /courses_manage), Title = «<эфир> — запись», Free=false,
--    Buy=false (bundle-only — NOT sold in the public catalog even after publish; access comes
--    with the stream purchase), Price=0, DurationLong=0 (lifetime recording access),
--    Category='Запись семинара' (matches the CoursesManagePage category enum), ModStatus='Черновик'.
create or replace function public.tg_stream_create_recording_course()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_course uuid;
begin
  if NEW.recording_course_enabled is not true or NEW.author is null then
    return NEW;
  end if;
  insert into public.course (owner, "Title", "Free", "Buy", "Price", "DurationLong", "Category", "ModStatus")
  values (NEW.author, coalesce(NEW.title, 'Трансляция') || ' — запись',
          false, false, 0, 0, 'Запись семинара', 'Черновик')
  returning id into v_course;
  NEW.recording_course := v_course;   -- BEFORE INSERT → stored on the stream row, no second write
  return NEW;
end $$;

drop trigger if exists trg_stream_create_recording_course on public.streams;
create trigger trg_stream_create_recording_course
  before insert on public.streams
  for each row execute function public.tg_stream_create_recording_course();

-- 3) grant the recording course to a buyer when their stream purchase settles --
--    Fires on the SAME signal as the chat add: a user_course INSERT on the stream's backing course.
--    Inserts a SECOND user_course row on the recording course. Idempotent (skip if already owned).
--    Recursion-safe: the inserted row's course is the recording course, which is never a
--    backing_course_id, so the re-fired trigger finds no stream → no-op (terminates at depth 1).
create or replace function public.tg_stream_bought_grant_recording()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_rec uuid;
begin
  select recording_course into v_rec
    from public.streams
   where backing_course_id = NEW.course and recording_course is not null
   limit 1;                          -- non-stream courses match nothing → no-op
  if v_rec is not null and NEW."user" is not null
     and not exists (select 1 from public.user_course where "user" = NEW."user" and course = v_rec) then
    insert into public.user_course ("user", course, "Free") values (NEW."user", v_rec, false);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_stream_bought_grant_recording on public.user_course;
create trigger trg_stream_bought_grant_recording
  after insert on public.user_course
  for each row execute function public.tg_stream_bought_grant_recording();

-- 4) delete_stream: on HARD delete (0 purchases) also drop the recording course, but ONLY if it is
--    still an untouched draft (ModStatus='Черновик') — mirrors the backing-course guard. If the
--    author already worked on / published it, keep it (don't destroy content). Since hard-delete
--    only runs with 0 purchases, no buyer ever loses access. Adds ONE marked block to the RPC.
create or replace function public.delete_stream(p_stream_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_stream public.streams%rowtype;
  v_purch  int := 0;
  v_action text;
begin
  select * into v_stream from public.streams where id = p_stream_id;
  if not found then
    raise exception 'Эфир не найден';
  end if;
  if v_stream.author is distinct from auth.uid() then
    raise exception 'Удалить эфир может только его автор';
  end if;

  if v_stream.backing_course_id is not null then
    select count(*) into v_purch from public.user_course where course = v_stream.backing_course_id;
  end if;

  if v_purch > 0 then
    update public.streams set hidden = true where id = p_stream_id;
    v_action := 'hidden';
  else
    delete from public.stream_chat where stream = p_stream_id;
    delete from public.chats where id = v_stream.chat;
    -- NEW: drop the recording course too, only while it's still an untouched draft
    if v_stream.recording_course is not null then
      delete from public.course where id = v_stream.recording_course and "ModStatus" = 'Черновик';
    end if;
    if v_stream.backing_course_id is not null then
      delete from public.shop   where course_id = v_stream.backing_course_id;
      delete from public.course where id = v_stream.backing_course_id and "ModStatus" = 'Черновик';
    end if;
    delete from public.streams where id = p_stream_id;
    v_action := 'deleted';
  end if;

  return jsonb_build_object('action', v_action, 'peertube_video_id', v_stream.peertube_video_id);
end $$;
