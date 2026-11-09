-- OWNER MANUAL ONLY: global Full HD availability. Never run via deployment/MCP.
-- Existing actor authorization, RLS, reservations, capacity and media profiles are retained.
-- Compatible with the deployed scoped orchestrator; no orchestrator restart is required.
begin;
set local lock_timeout='3s';
select pg_advisory_xact_lock(78403191);
do $$begin
 if not exists(select 1 from public.stream_video_quality_settings where singleton and max_full_hd_live=1) then
  raise exception 'expected_one_full_hd_slot';
 end if;
end$$;
-- Compatibility name retained for the deployed server. No personal grants are consulted.
create or replace function public.stream_full_hd_test_allowed(p_stream_id uuid,p_owner_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.streams s cross join public.stream_video_quality_settings cfg
 where cfg.singleton and cfg.full_hd_enabled and s.id=p_stream_id and s.author=p_owner_id)
$$;
create or replace function public.guard_stream_video_quality() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare enabled boolean;
begin
 if new.video_quality='full_hd' then
  select full_hd_enabled into enabled from public.stream_video_quality_settings where singleton for share;
  if not coalesce(enabled,false) then raise exception 'full_hd_not_enabled'; end if;
 end if;
 return new;
end$$;
-- Historical grants remain private/inert; ownership changes no longer maintain them.
drop trigger if exists invalidate_stream_full_hd_owner on public.streams;

create or replace function public.reserve_stream_video_start_scoped(p_stream_id uuid,p_actor_id uuid,p_expected_quality text,p_expected_egress_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare s public.streams%rowtype; cfg public.stream_video_quality_settings%rowtype; reservation uuid;
begin
 perform pg_advisory_xact_lock(78403191);
 select * into s from public.streams where id=p_stream_id for update;
 if not found then raise exception 'stream_not_found'; end if;
 if p_actor_id is null or s.author is distinct from p_actor_id then raise exception 'not_owner'; end if;
 if s.video_quality is distinct from p_expected_quality or s.livekit_egress_id is distinct from p_expected_egress_id then raise exception 'stream_settings_changed'; end if;
 delete from public.stream_video_start_reservations where expires_at<now();
 if exists(select 1 from public.stream_video_start_reservations where stream_id=p_stream_id) then raise exception 'stream_start_in_progress'; end if;
 select * into cfg from public.stream_video_quality_settings where singleton for share;
 if p_expected_quality='full_hd' then
  if not coalesce(cfg.full_hd_enabled,false) then raise exception 'full_hd_not_enabled'; end if;
  if cfg.max_full_hd_live is null or (select count(*) from public.stream_video_runs r join public.streams t on t.id=r.stream_id and t.livekit_egress_id=r.egress_id where t.status='live' and r.ended_at is null and r.profile='full_hd')
   +(select count(*) from public.stream_video_start_reservations where profile='full_hd')>=cfg.max_full_hd_live then raise exception 'full_hd_capacity'; end if;
 end if;
 insert into public.stream_video_start_reservations(stream_id,profile,owner_id) values(s.id,p_expected_quality,p_actor_id) returning token into reservation;
 return reservation;
end$$;

create or replace function public.hold_stream_video_start(p_token uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare s public.streams%rowtype; r public.stream_video_start_reservations%rowtype; cfg public.stream_video_quality_settings%rowtype;
begin
 perform pg_advisory_xact_lock(78403191);
 select t.* into s from public.streams t join public.stream_video_start_reservations v on v.stream_id=t.id where v.token=p_token for update of t;
 select * into r from public.stream_video_start_reservations where token=p_token for update;
 if not found or r.expires_at<=now() then raise exception 'video_reservation_expired'; end if;
 if r.owner_id is distinct from s.author or r.profile is distinct from s.video_quality then raise exception 'stream_settings_changed'; end if;
 if r.profile='full_hd' then
  select * into cfg from public.stream_video_quality_settings where singleton for share;
  if not coalesce(cfg.full_hd_enabled,false) then raise exception 'full_hd_not_enabled'; end if;
 end if;
 update public.stream_video_start_reservations set expires_at='infinity'::timestamptz where token=p_token;
end$$;

create or replace function public.mark_stream_video_started_scoped(p_stream_id uuid,p_actor_id uuid,p_expected_quality text,p_expected_egress_id text,p_egress_id text,p_video_id uuid,p_reservation uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare s public.streams%rowtype; cfg public.stream_video_quality_settings%rowtype;
begin
 if p_expected_quality not in ('hd','full_hd') or p_expected_quality is null or nullif(p_egress_id,'') is null or p_video_id is null then raise exception 'bad_video_run'; end if;
 perform pg_advisory_xact_lock(78403191);
 select * into s from public.streams where id=p_stream_id for update;
 if not found then raise exception 'stream_not_found'; end if;
 if p_actor_id is null or s.author is distinct from p_actor_id then raise exception 'not_owner'; end if;
 if s.video_quality is distinct from p_expected_quality or s.livekit_egress_id is distinct from p_expected_egress_id then raise exception 'stream_settings_changed'; end if;
 perform 1 from public.stream_video_start_reservations where stream_id=p_stream_id and token=p_reservation and owner_id=p_actor_id and profile=p_expected_quality and expires_at>now() for update;
 if not found then raise exception 'video_reservation_expired'; end if;
 select * into cfg from public.stream_video_quality_settings where singleton for share;
 if p_expected_quality='full_hd' then
  if not coalesce(cfg.full_hd_enabled,false) then raise exception 'full_hd_not_enabled'; end if;
  if cfg.max_full_hd_live is null or (select count(*) from public.stream_video_runs r join public.streams t on t.id=r.stream_id and t.livekit_egress_id=r.egress_id where t.status='live' and r.ended_at is null and r.profile='full_hd')>=cfg.max_full_hd_live then raise exception 'full_hd_capacity'; end if;
 end if;
 insert into public.stream_video_runs(egress_id,stream_id,profile) values(p_egress_id,p_stream_id,p_expected_quality);
 update public.streams set livekit_egress_id=p_egress_id,peertube_video_id=p_video_id,mode='multi',status='live',livekit_room=p_stream_id::text where id=p_stream_id;
 delete from public.stream_video_start_reservations where token=p_reservation;
end$$;

-- CREATE OR REPLACE preserves current owners and EXECUTE grants. No RLS/ACL changes.
-- Old HD-only wrappers remain private/compatible; current server uses scoped RPCs.
update public.stream_video_quality_settings set full_hd_enabled=true where singleton;
notify pgrst, 'reload schema';
commit;
-- Read-only result: enabled=true; max=1; defaults remain hd.
select full_hd_enabled,max_full_hd_live from public.stream_video_quality_settings where singleton;
