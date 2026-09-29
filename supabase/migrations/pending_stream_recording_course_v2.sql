-- Recording course v2 — make it a real CATALOG course that auto-publishes when the stream ends.
-- Supersedes the v1 behaviour (hidden draft, Buy=false, manual fill). Requires v1 migration first.
--
-- Flow now:
--   stream create (recording_course_enabled) → draft course, Buy=true, Price = stream price (still
--     ModStatus='Черновик' → hidden from catalog + CoursePage guard until it has content).
--   buyer purchase → free user_course grant on the recording course (unchanged, tg_stream_bought_grant_recording).
--   stream ENDS → attach the replay video as a lesson + publish (Опубликовано) → shows in /all_course
--     as «Запись семинара» AND in «Мои курсы» of everyone who bought the stream. Moderation skipped
--     (author's own recording, per product decision). New viewers can buy it from the catalog at the
--     stream price; stream buyers already own it (their grant).

-- 1) create trigger: catalog-ready draft (Buy=true, Price = stream price) --------------------------
create or replace function public.tg_stream_create_recording_course()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_course uuid;
begin
  if NEW.recording_course_enabled is not true or NEW.author is null then
    return NEW;
  end if;
  insert into public.course (owner, "Title", "Free", "Buy", "Price", "DurationLong", "Category", "ModStatus")
  values (NEW.author, coalesce(NEW.title, 'Трансляция') || ' — запись',
          false, true, coalesce(NEW.price, 0), 0, 'Запись семинара', 'Черновик')
  returning id into v_course;                -- Buy=true + priced → catalog-ready once published;
  NEW.recording_course := v_course;          -- ModStatus stays Черновик → hidden until the stream ends
  return NEW;
end $$;

-- 2) publish the recording course when the stream ends --------------------------------------------
--    Fires once on the transition into status='ended', only if a recording course exists, is still a
--    draft, and the stream has a replay video. Attaches it as a lesson, carries the cover, publishes.
create or replace function public.tg_stream_ended_publish_recording()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_lesson uuid;
begin
  if NEW.status = 'ended' and OLD.status is distinct from 'ended'
     and NEW.recording_course is not null
     and NEW.peertube_video_id is not null
     and exists (select 1 from public.course where id = NEW.recording_course and "ModStatus" = 'Черновик')
  then
    insert into public.lessons ("Title", "Course", video_id)
    values ('Запись эфира', NEW.recording_course, NEW.peertube_video_id::text)
    returning id into v_lesson;
    update public.course
       set "Less_Id"   = array_append(coalesce("Less_Id", '{}'::uuid[]), v_lesson),
           cover       = coalesce(cover, NEW.cover_url),
           "ModStatus" = 'Опубликовано'
     where id = NEW.recording_course;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_stream_ended_publish_recording on public.streams;
create trigger trg_stream_ended_publish_recording
  after update on public.streams
  for each row execute function public.tg_stream_ended_publish_recording();
