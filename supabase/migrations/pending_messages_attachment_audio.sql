-- Voice messages: allow attachment_type='audio' (v1: webm/mp4/ogg recordings).
-- Reuses the existing attachment_* columns so a voice message is just a message
-- row and rides the existing report/block moderation path unchanged.
--
-- Run in Studio SQL editor. Idempotent (safe to re-run).

alter table public.messages drop constraint if exists messages_attachment_type_chk;
alter table public.messages
  add constraint messages_attachment_type_chk
  check (attachment_type is null or attachment_type in ('image','file','audio'));
