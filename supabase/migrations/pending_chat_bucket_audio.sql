-- Add audio MIME types to the 'chat' bucket allowlist for voice messages.
-- MediaRecorder emits audio/webm (Chrome/Firefox/Edge) or audio/mp4 (Safari);
-- audio/ogg is a fallback. Still an ALLOWLIST — svg/html remain excluded.
--
-- The full 17-type array is set explicitly (not appended) so re-running is
-- idempotent and the final state is deterministic.
--
-- Run in Studio SQL editor (as postgres / storage-admin — storage.buckets is
-- owned by supabase_storage_admin and RLS-protected).

update storage.buckets
set allowed_mime_types = array[
  -- images
  'image/jpeg','image/png','image/webp','image/gif',
  -- documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip','application/x-zip-compressed',
  -- audio (voice messages)
  'audio/webm','audio/mp4','audio/ogg'
]
where id = 'chat';
