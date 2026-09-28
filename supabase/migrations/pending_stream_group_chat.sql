-- Optional group chat for PAID streams — reuses the EVENTS group-chat mechanism verbatim:
-- the shared `chats` table + add_chat_to_users trigger (so members see it in /chats like any chat).
-- Opt-in per stream via streams.chat_enabled (the create form checkbox). NOT a new chat system.
--
-- Mirror of events:
--   events.chat  ← tg_event_create_chat (BEFORE INSERT)        → streams.chat ← tg_stream_create_chat
--   tg_event_order_paid (order.event_id → add buyer to chat)   → tg_stream_bought_add_to_chat
--     (streams settle via a user_course row on the backing course, so the buyer signal is that INSERT)

-- 1) columns ------------------------------------------------------------------
alter table public.streams
  add column if not exists chat uuid,
  add column if not exists chat_enabled boolean not null default false;

-- speeds up the per-purchase lookup in tg_stream_bought_add_to_chat
create index if not exists idx_streams_backing_course on public.streams (backing_course_id);

-- 2) create the group chat on stream insert when opted in (mirrors tg_event_create_chat) ----
create or replace function public.tg_stream_create_chat()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_chat uuid;
begin
  if NEW.chat_enabled is not true or NEW.author is null then
    return NEW;                       -- opt-out or no author → no chat, streams.chat stays null
  end if;
  insert into public.chats (users, read, title, creator, forced_group, mod_date, sort_date)
  values (array[NEW.author], array[NEW.author], coalesce(NEW.title, 'Трансляция'),
          NEW.author, true, now(), now())
  returning id into v_chat;
  NEW.chat := v_chat;                 -- BEFORE INSERT → stored on the stream row, no second write
  return NEW;
end $$;

drop trigger if exists trg_stream_create_chat on public.streams;
create trigger trg_stream_create_chat
  before insert on public.streams
  for each row execute function public.tg_stream_create_chat();

-- 3) add a buyer to the stream's group chat when their purchase settles ---------------------
--    (n8n BuyCourse inserts a user_course row on the stream's backing course). Idempotent —
--    only if the stream opted into a chat AND the buyer isn't already a member. Mirrors the
--    add-member append in tg_event_order_paid (touch only users + read; keep sort/mod date).
create or replace function public.tg_stream_bought_add_to_chat()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_chat uuid;
begin
  select chat into v_chat
    from public.streams
   where backing_course_id = NEW.course and chat is not null
   limit 1;                           -- non-stream courses match nothing → no-op
  if v_chat is not null and NEW."user" is not null then
    update public.chats
       set users = array_append(coalesce(users, '{}'::uuid[]), NEW."user"),
           read  = array_append(coalesce(read,  '{}'::uuid[]), NEW."user")
     where id = v_chat
       and not (NEW."user" = any(coalesce(users, '{}'::uuid[])));
  end if;
  return NEW;
end $$;

drop trigger if exists trg_stream_bought_add_to_chat on public.user_course;
create trigger trg_stream_bought_add_to_chat
  after insert on public.user_course
  for each row execute function public.tg_stream_bought_add_to_chat();

-- 4) hard-delete cleanup: drop the linked group chat too (trg_remove_chat_from_users clears
--    users.chats). Only the marked line is added to the existing delete_stream RPC.
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
    delete from public.chats where id = v_stream.chat;   -- NEW: drop the group chat (if any)
    if v_stream.backing_course_id is not null then
      delete from public.shop   where course_id = v_stream.backing_course_id;
      delete from public.course where id = v_stream.backing_course_id and "ModStatus" = 'Черновик';
    end if;
    delete from public.streams where id = p_stream_id;
    v_action := 'deleted';
  end if;

  return jsonb_build_object('action', v_action, 'peertube_video_id', v_stream.peertube_video_id);
end $$;
