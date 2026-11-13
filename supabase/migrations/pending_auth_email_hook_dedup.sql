-- PREPARED ONLY: requires separate approval and manual execution before hook activation.
-- Additive, private delivery ledger. Does not touch auth.users, profiles, orders or entitlements.
begin;
create schema if not exists auth_mail_private;
revoke all on schema auth_mail_private from public, anon, authenticated, service_role;
create table auth_mail_private.delivery (
    delivery_key text primary key check (delivery_key ~ '^[0-9a-f]{64}$'),
    owner uuid not null,
    state text not null check (state in ('sending','accepted','failed','uncertain')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table auth_mail_private.delivery enable row level security;
revoke all on auth_mail_private.delivery from public, anon, authenticated, service_role;
create index auth_email_delivery_created on auth_mail_private.delivery(created_at);

create function public.claim_auth_email_delivery(p_key text, p_owner uuid)
returns table(decision text)
language plpgsql security definer set search_path = pg_catalog as $$
declare inserted integer; existing_state text;
begin
    if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
    if p_key is null or p_key !~ '^[0-9a-f]{64}$' or p_owner is null then raise exception 'invalid_delivery'; end if;
    -- Local limits also bound waiting on a concurrent claim; no network calls inside this function.
    perform set_config('lock_timeout','250ms',true);
    insert into auth_mail_private.delivery(delivery_key,owner,state) values(p_key,p_owner,'sending')
        on conflict(delivery_key) do nothing;
    get diagnostics inserted = row_count;
    if inserted=1 then return query select 'send'::text; return; end if;
    select d.state into existing_state from auth_mail_private.delivery d where d.delivery_key=p_key;
    return query select case when existing_state='accepted' then 'accepted' else 'blocked' end;
end $$;

create function public.finish_auth_email_delivery(p_key text, p_owner uuid, p_state text)
returns table(state text)
language plpgsql security definer set search_path = pg_catalog as $$
begin
    if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
    if p_state not in ('accepted','failed','uncertain') or p_state is null then raise exception 'invalid_delivery_state'; end if;
    perform set_config('lock_timeout','250ms',true);
    return query update auth_mail_private.delivery d set state=p_state,updated_at=now()
        where d.delivery_key=p_key and d.owner=p_owner and d.state='sending' returning d.state;
end $$;
revoke all on function public.claim_auth_email_delivery(text,uuid) from public, anon, authenticated;
revoke all on function public.finish_auth_email_delivery(text,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_auth_email_delivery(text,uuid) to service_role;
grant execute on function public.finish_auth_email_delivery(text,uuid,text) to service_role;
comment on table auth_mail_private.delivery is 'Auth email transport deduplication only; no passwords, emails, tokens, or confirmation URLs.';
-- Retain tombstones at least as long as the maximum OTP lifetime + replay window.
-- With GOTRUE_MAILER_OTP_EXP <= 86400, an administrator may prune rows older than 48 hours.
-- Do not automatically retry an expired sending/uncertain row: the provider may have accepted it.
commit;
