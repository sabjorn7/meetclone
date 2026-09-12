-- S3 (/superadmin rebuild) — UGC report moderation RPCs + test fixtures. Run in Supabase Studio.
-- GREENFIELD: no existing report-handling UI on the platform. SECURITY DEFINER + admin gate +
-- open-queue guard (report must be status 'new'/'notified'). Two actions:
--   admin_dismiss_report(report)          -> status='dismissed' (no content change)
--   admin_delete_reported_message(report) -> HARD-delete the target message + status='actioned'
-- (Global user ban is intentionally NOT here — user_blocks is peer-only and there is no ban field;
--  that is a separate future phase.) VOLATILE.

-- ── RPCs ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_dismiss_report(p_report uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select status into v_status from public.stream_reports where id = p_report;
  if v_status is null then raise exception 'report not found' using errcode='P0002'; end if;
  if v_status not in ('new','notified') then
    raise exception 'report already handled (status=%)', v_status using errcode='22023';
  end if;
  update public.stream_reports set status='dismissed' where id = p_report;
  return jsonb_build_object('id', p_report, 'status', 'dismissed');
end $$;

create or replace function public.admin_delete_reported_message(p_report uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text; v_ttype text; v_tid text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select status, target_type, target_id into v_status, v_ttype, v_tid
    from public.stream_reports where id = p_report;
  if v_status is null then raise exception 'report not found' using errcode='P0002'; end if;
  if v_status not in ('new','notified') then
    raise exception 'report already handled (status=%)', v_status using errcode='22023';
  end if;
  if v_ttype <> 'message' then
    raise exception 'not a message report (target_type=%)', v_ttype using errcode='22023';
  end if;
  delete from public.messages where id = v_tid::uuid;   -- HARD delete (irreversible)
  update public.stream_reports set status='actioned' where id = p_report;
  return jsonb_build_object('id', p_report, 'status', 'actioned', 'deleted_message', v_tid);
end $$;

grant execute on function public.admin_dismiss_report(uuid)          to authenticated;
grant execute on function public.admin_delete_reported_message(uuid) to authenticated;


-- ── TEST FIXTURE (chat + message + report in one statement) ──────────────────
-- All owned by the admin. Returns the report id + the message id (target_id).
-- If chats/messages have a NOT NULL column without default, add it to the column list.
with c as (
  insert into public.chats (creator, is_group, title, users, sort_date, mod_date)
    values ('b689d683-f143-47db-a5b0-5940d7f52b02', true, '[ТЕСТ] чат модерации',
            array['b689d683-f143-47db-a5b0-5940d7f52b02']::uuid[], now(), now())
  returning id
), m as (
  insert into public.messages (creator, chat, text)
    select 'b689d683-f143-47db-a5b0-5940d7f52b02', c.id, '[ТЕСТ] сообщение для проверки модерации' from c
  returning id, chat
)
insert into public.stream_reports (reporter, target_type, target_id, target_user, surface, status, text_snapshot)
  select 'b689d683-f143-47db-a5b0-5940d7f52b02', 'message', m.id::text,
         'b689d683-f143-47db-a5b0-5940d7f52b02', 'chat', 'new', '[ТЕСТ] снимок жалобы' from m
  returning id as report_id, target_id as message_id;

-- Between the dismiss and delete tests, reopen the report:
--   update public.stream_reports set status='new' where id='<report-id>';

-- Verify at any time:
--   select id, status, target_type, target_id from public.stream_reports where id='<report-id>';
--   select id from public.messages where id='<message-id>';   -- gone after the delete test

-- CLEANUP after both tests (report + message[if left] + chat):
--   delete from public.stream_reports where id='<report-id>';
--   delete from public.messages where id='<message-id>';
--   delete from public.chats where title='[ТЕСТ] чат модерации';
