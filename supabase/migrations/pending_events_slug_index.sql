-- Path-based /event/<slug>: enforce slug uniqueness for by-slug lookup.
-- Partial (WHERE slug IS NOT NULL) so legacy null-slug rows don't collide before
-- they're backfilled. Slug generation is client-side (Cyrillic transliteration —
-- see eventsApi.slugify/uniqueEventSlug); backfill of existing events happens on
-- the /events_manage load. Idempotent. Run in Studio SQL editor.

create unique index if not exists events_slug_key
  on public.events (slug) where slug is not null;
