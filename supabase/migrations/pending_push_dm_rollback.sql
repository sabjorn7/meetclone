-- pending_push_dm_rollback.sql — полный откат pending_push_dm.sql.
-- Снимает только наш DM-триггер и функции. on_message_notify / tg_notify_push не трогает.
drop trigger if exists trg_push_web_message_ins on public.messages;
drop function if exists public.trg_push_web_message();
drop function if exists public.push_notify_dm(uuid);
