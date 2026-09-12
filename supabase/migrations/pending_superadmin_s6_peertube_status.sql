-- S6 (/superadmin) — PeerTube token STATUS (read-only diagnostic). Run in Supabase Studio.
-- Admin-gated SECURITY DEFINER, STABLE (no mutation). Returns ONLY status — the token and
-- refresh_token values NEVER leave the DB (only booleans has_token/has_refresh + expiry).
-- Token-refresh and clear-video actions intentionally stay on the WeWeb panel (secret + OAuth).

create or replace function public.admin_peertube_status()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v jsonb;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select jsonb_build_object(
    'next_update',         next_update,
    'next_refresh',        next_refresh,
    'updated_at',          created_at,
    'expired',             (next_update is null or next_update < now()),
    'expires_in_seconds',  case when next_update is null then null else round(extract(epoch from (next_update - now()))) end,
    'has_token',           (token is not null and length(token) > 0),
    'has_refresh',         (refresh_token is not null and length(refresh_token) > 0)
  ) into v
  from public."Peertube_System"
  order by next_update desc nulls last
  limit 1;
  return coalesce(v, jsonb_build_object('empty', true));
end $$;

grant execute on function public.admin_peertube_status() to authenticated;

-- Verify (as table owner in Studio it returns the row; via the app only an admin JWT passes the gate):
--   select public.admin_peertube_status();
