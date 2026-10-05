-- Client-side error/diagnostics log. Insert-only for clients (anon + authenticated, incl. guests);
-- reads go through an admin-gated RPC (same pattern as the other admin tables — no one reads others' logs).
create table if not exists public.client_error_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text,     -- window_error | resource_error | unhandled_rejection | loading_timeout
  message    text,
  stack      text,
  url        text,
  user_agent text,
  user_id    uuid       -- null for guests
);
create index if not exists client_error_log_created_idx on public.client_error_log (created_at desc);

-- clients may INSERT only; they cannot read/update/delete.
revoke all    on public.client_error_log from anon, authenticated;
grant  insert on public.client_error_log to   anon, authenticated;

-- admin read (role='admin' or superadmin — same gate as admin_set_commission etc.)
create or replace function public.admin_list_client_errors(p_limit integer default 100, p_event_type text default null)
  returns setof public.client_error_log
  language plpgsql security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  return query
    select * from public.client_error_log
    where p_event_type is null or event_type = p_event_type
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 1000));
end $$;

notify pgrst, 'reload schema';
