-- PENDING REVIEW — NOT APPLIED. Do not run until confirmed.
--
-- Adds a self-service public username for profile links
-- (/profile_page?user=<username> instead of ?user=<uuid>).
--
-- Uniqueness is case-insensitive (lower(username)) so "Ivan" and "ivan"
-- can't both be taken, and NULL/unset usernames don't collide with each
-- other (partial index only covers non-null values).

begin;

alter table public.users
  add column if not exists username text;

create unique index if not exists users_username_key
  on public.users (lower(username))
  where username is not null;

commit;
