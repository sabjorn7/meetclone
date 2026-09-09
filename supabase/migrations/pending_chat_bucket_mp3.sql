-- Add audio/mpeg (MP3) to the 'chat' bucket allowlist. Voice messages are now
-- transcoded client-side to MP3 (universal playback incl. Safari), so the upload
-- MIME is audio/mpeg. Idempotent.
--
-- Run in Studio SQL editor (as postgres / storage-admin — storage.buckets is
-- owned by supabase_storage_admin and RLS-protected).

update storage.buckets
set allowed_mime_types = allowed_mime_types || array['audio/mpeg']
where id = 'chat' and not (allowed_mime_types @> array['audio/mpeg']);
