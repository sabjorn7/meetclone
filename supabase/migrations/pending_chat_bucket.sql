-- New PUBLIC 'chat' storage bucket for message attachments.
-- Consistent with the existing 'profile'/'club' buckets: public + unguessable UUID
-- object keys (Option A). The rest of the app is RLS-off / public-asset, so this
-- keeps parity; a private bucket + signed URLs is a documented future hardening step.
--
--  - file_size_limit = 25 MB — the DOCUMENT cap. The 10 MB IMAGE cap is a
--    stricter client-side check (bucket limit is a single number, so it holds the
--    larger of the two as the hard backstop).
--  - allowed_mime_types = the AUTHORITATIVE server-side allowlist (not a blacklist).
--    Note it excludes image/svg+xml and text/html on purpose — those render inline
--    from the storage origin and would be stored-XSS vectors.
--    The client uploads with an explicit contentType mapped from the file
--    EXTENSION (not the browser's guess), so docx/xlsx never arrive as
--    application/octet-stream and get wrongly rejected by this allowlist.
--
-- Run in Studio SQL editor. Idempotent (safe to re-run).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat', 'chat', true, 26214400,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip','application/x-zip-compressed'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects has RLS ENABLED; every bucket needs its own 4 policies or all
-- reads/writes fail. Mirror the 'profile' bucket's policy set (role public),
-- scoped to bucket_id='chat'. (INSERT/DELETE could later be tightened to
-- 'authenticated'/owner as a hardening step — kept public here for parity.)
drop policy if exists "chat_read"   on storage.objects;
drop policy if exists "chat_insert" on storage.objects;
drop policy if exists "chat_update" on storage.objects;
drop policy if exists "chat_delete" on storage.objects;

create policy "chat_read"   on storage.objects for select using      (bucket_id = 'chat');
create policy "chat_insert" on storage.objects for insert with check (bucket_id = 'chat');
create policy "chat_update" on storage.objects for update using      (bucket_id = 'chat');
create policy "chat_delete" on storage.objects for delete using      (bucket_id = 'chat');
