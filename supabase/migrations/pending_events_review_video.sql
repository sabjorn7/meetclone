-- Event video REVIEWS — one video per event (the organizer stitches multiple
-- testimonials into a single clip). Mirrors the teaser columns with a review_
-- prefix (same PeerTube system account + resumable upload). Idempotent.
-- Run in Studio SQL editor.

alter table public.events
  add column if not exists review_video_id        text,
  add column if not exists review_video_size      bigint,
  add column if not exists review_resume_video_id text,
  add column if not exists review_resume_chunk    text,
  add column if not exists review_resume_name     text;
