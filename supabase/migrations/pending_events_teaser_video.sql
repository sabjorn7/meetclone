-- Event video teaser — mirrors the course teaser columns (PeerTube system account).
-- video_id = PeerTube video UUID (playback via embedUrl); resume_* = resumable-upload
-- checkpoints (parity with course/lessons). Idempotent. Run in Studio SQL editor.

alter table public.events
  add column if not exists video_id        text,
  add column if not exists video_size      bigint,
  add column if not exists resume_video_id text,
  add column if not exists resume_chunk    text,
  add column if not exists resume_name     text;
