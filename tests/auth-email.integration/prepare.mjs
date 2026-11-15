// Creates synthetic, ephemeral test credentials only; never reads application .env or MCP config.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { authEmailWorkflow } from '../../scripts/lib/auth-email-workflow.mjs';
const [directory] = process.argv.slice(2);
if (!directory || !path.isAbsolute(directory)) throw Error('Expected a new absolute fixture directory');
fs.mkdirSync(directory, { mode: 0o700 });
const secret = () => crypto.randomBytes(32).toString('hex');
const env = {
    MG_AUTH_IT_FIXTURE_DIR: directory,
    MG_AUTH_IT_DB_PASSWORD: secret(), MG_AUTH_IT_AUTH_DB_PASSWORD: secret(), MG_AUTH_IT_REST_DB_PASSWORD: secret(),
    MG_AUTH_IT_JWT_SECRET: secret(), MG_AUTH_IT_N8N_KEY: secret(), MG_AUTH_IT_PROVIDER_KEY: secret(),
    MG_AUTH_IT_HOOK_SECRET: 'v1,whsec_' + crypto.randomBytes(32).toString('base64'),
};
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role: 'service_role', aud: 'authenticated', iss: 'auth-email-isolated-fixture', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7200 });
env.MG_AUTH_IT_SERVICE_JWT = unsigned + '.' + crypto.createHmac('sha256', env.MG_AUTH_IT_JWT_SECRET).update(unsigned).digest('base64url');
fs.writeFileSync(path.join(directory, 'fixture.env'), Object.entries(env).map(([k, v]) => k + '=' + v).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
fs.mkdirSync(path.join(directory, 'init'), { mode: 0o755 });
fs.mkdirSync(path.join(directory, 'out'), { mode: 0o777 }); fs.chmodSync(path.join(directory, 'out'), 0o777);
const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password '${env.MG_AUTH_IT_REST_DB_PASSWORD}';
grant anon,authenticated,service_role to authenticator;
create role supabase_auth_admin login createrole password '${env.MG_AUTH_IT_AUTH_DB_PASSWORD}';
grant create on database postgres to supabase_auth_admin;
create schema auth authorization supabase_auth_admin;
create extension if not exists pgcrypto with schema public;
create extension if not exists "uuid-ossp" with schema public;
grant usage,create on schema public to supabase_auth_admin;
create function auth.role() returns text language sql stable as $$
select coalesce(nullif(current_setting('request.jwt.claim.role',true),''), nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')
$$;
create table public.fixture_profiles(user_id uuid primary key,email text,role text);
alter table public.fixture_profiles enable row level security;
revoke all on public.fixture_profiles from public,anon,authenticated;
grant select on public.fixture_profiles to service_role;
create function public.fixture_create_profile() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin insert into public.fixture_profiles(user_id,email,role) values(new.id,new.email,new.raw_user_meta_data->>'nickname'); return new; end $$;
`;
fs.writeFileSync(path.join(directory, 'init/10-bootstrap.sql'), bootstrap, { mode: 0o644, flag: 'wx' });
// The already-reviewed pending SQL is copied unchanged into a disposable DB, never production.
fs.copyFileSync(new URL('../../supabase/migrations/pending_auth_email_hook_dedup.sql', import.meta.url), path.join(directory, 'init/20-delivery-ledger.sql'));
fs.chmodSync(path.join(directory, 'init/20-delivery-ledger.sql'), 0o644);
const workflow = { ...authEmailWorkflow(), id: 'AuthEmailIntegrationFixture', active: false };
fs.writeFileSync(path.join(directory, 'workflow.json'), JSON.stringify(workflow), { mode: 0o644, flag: 'wx' });
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=MeetGuru isolated integration fixture',
    '-addext', 'subjectAltName=DNS:sb.meetgu.ru,DNS:n8n.meetgu.ru,DNS:api.unisender.com,DNS:app.meetgu.ru',
    '-addext', 'basicConstraints=critical,CA:TRUE', '-keyout', path.join(directory, 'ca.key'), '-out', path.join(directory, 'ca.crt')], { stdio: 'pipe' });
fs.chmodSync(path.join(directory, 'ca.key'), 0o600); fs.chmodSync(path.join(directory, 'ca.crt'), 0o644);
console.log('Prepared isolated fixture; no production settings or credentials read.');
