-- PENDING REVIEW — NOT APPLIED. Do not run until confirmed.
--
-- Adds a website link and a "book an appointment" link to the profile.
-- website_url shows as another icon next to the social links; booking_url
-- makes a "Записаться" button appear on the public profile.

begin;

alter table public.users
  add column if not exists website_url text,
  add column if not exists booking_url text;

commit;
