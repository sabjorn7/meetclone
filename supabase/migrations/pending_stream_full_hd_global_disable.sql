-- OWNER MANUAL ONLY. Disable future Full HD saves/starts; never stop running Egress.
begin;
set local lock_timeout='3s';
update public.stream_video_quality_settings set full_hd_enabled=false where singleton;
commit;
