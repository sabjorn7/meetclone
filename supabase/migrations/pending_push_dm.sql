-- pending_push_dm.sql — веб-push для личных/групповых сообщений /chats (событие direct_message).
-- Параллельно существующему мобильному on_message_notify (n8n/Expo) — его НЕ трогает.
-- Предпосылки: секрет push_config.push_send_key (есть) + edge web-push-send v3 (понимает direct_message).
-- pg_net уже установлен. Без ключа push_notify_dm тихо no-op. Все функции exception-safe.

-- 1) Обёртка DM: POST {event:'direct_message', message_id} в web-push-send.
create or replace function public.push_notify_dm(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  k text;
begin
  k := public.push_send_key();
  if k is null or k = '' then
    return;  -- ключ не настроен → тихо no-op
  end if;
  begin
    perform net.http_post(
      url     := 'https://app.meetgu.ru/sb/functions/v1/web-push-send',
      headers := jsonb_build_object('Content-Type','application/json','x-push-key', k),
      body    := jsonb_build_object('event','direct_message','message_id', p_message_id),
      timeout_milliseconds := 30000
    );
  exception when others then
    null;  -- сбой пуша НИКОГДА не ломает INSERT в messages
  end;
end;
$$;
revoke all on function public.push_notify_dm(uuid) from public, anon, authenticated;

-- 2) Триггерная функция (returns trigger), тоже exception-safe.
create or replace function public.trg_push_web_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  begin
    perform public.push_notify_dm(NEW.id);
  exception when others then
    null;
  end;
  return NEW;
end;
$$;
revoke all on function public.trg_push_web_message() from public, anon, authenticated;

-- 3) Триггер — тот же WHEN, что у on_message_notify (у него WHEN нет → без WHEN), AFTER INSERT ON messages.
drop trigger if exists trg_push_web_message_ins on public.messages;
create trigger trg_push_web_message_ins
  after insert on public.messages
  for each row
  execute function public.trg_push_web_message();
