-- Chat file attachments (v1: ONE attachment per message; photo + document).
--
-- Design principle: an attachment is a PROPERTY of a `messages` row, not a new
-- entity. It therefore rides the existing per-message report/block moderation
-- path (stream_reports.target_type='message' / target_id=message.id) unchanged —
-- there is no separate, un-reviewed moderation surface.
--
-- Run in Studio SQL editor. Idempotent (safe to re-run).

alter table public.messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_type text,   -- 'image' | 'file' (render discriminator)
  add column if not exists attachment_name text,   -- original filename (shown for documents)
  add column if not exists attachment_size bigint;  -- bytes (for the size label)

-- Constrain the discriminator so the UI never sees an unknown attachment_type.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_attachment_type_chk') then
    alter table public.messages
      add constraint messages_attachment_type_chk
      check (attachment_type is null or attachment_type in ('image','file'));
  end if;
end $$;
