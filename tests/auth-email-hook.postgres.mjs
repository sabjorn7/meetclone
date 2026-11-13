// Local disposable PostgreSQL only. No remote DB, application env files or network API calls.
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const exec = promisify(execFile);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'meetguru-auth-mail-pg-'));
const binaries = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
const db = path.join(work, 'db');
const port = String(45000 + crypto.randomInt(10000));
const args = ['-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-h', work, '-p', port, '-d', 'postgres', '-At'];
const sql = query => execFileSync(path.join(binaries, 'psql'), [...args, '-c', query], { encoding: 'utf8' }).trim();
const service = query => "set role service_role; set request.jwt.claim.role='service_role'; " + query;
let started = false;
try {
    execFileSync(path.join(binaries, 'initdb'), ['-D', db, '-U', 'postgres', '-A', 'trust', '--no-locale'], { stdio: 'pipe' });
    // Unix socket only: listen_addresses is empty; no external database can be contacted.
    execFileSync(path.join(binaries, 'pg_ctl'), ['-D', db, '-l', path.join(work, 'postgres.log'), '-o', `-k ${work} -p ${port} -c listen_addresses='' -c fsync=off`, '-w', 'start'], { stdio: 'pipe' });
    started = true;
    sql("create role anon; create role authenticated; create role service_role; create schema auth; create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;");
    execFileSync(path.join(binaries, 'psql'), [...args, '-f', new URL('../supabase/migrations/pending_auth_email_hook_dedup.sql', import.meta.url).pathname], { stdio: 'pipe' });
    const key = 'a'.repeat(64), owner = crypto.randomUUID();
    const results = await Promise.all(Array.from({ length: 16 }, () => exec(path.join(binaries, 'psql'), [...args, '-c', service(`select decision from public.claim_auth_email_delivery('${key}','${owner}');`)], { encoding: 'utf8' })));
    const decisions = results.map(r => r.stdout.trim().split('\n').at(-1));
    assert.equal(decisions.filter(x => x === 'send').length, 1);
    assert.equal(decisions.filter(x => x === 'blocked').length, 15);
    assert.equal(sql('select count(*) from auth_mail_private.delivery'), '1');
    console.log('PASS 16 concurrent claims: one sender, 15 blocked, one durable row');
    const mismatch = sql(service(`select count(*) from public.finish_auth_email_delivery('${key}','${crypto.randomUUID()}','accepted');`));
    assert.equal(mismatch.split('\n').at(-1), '0');
    assert.equal(sql(service(`select state from public.finish_auth_email_delivery('${key}','${owner}','accepted');`)).split('\n').at(-1), 'accepted');
    assert.equal(sql(service(`select decision from public.claim_auth_email_delivery('${key}','${crypto.randomUUID()}');`)).split('\n').at(-1), 'accepted');
    console.log('PASS owner check and committed accepted tombstone survive a new connection/retry');
    for (const role of ['anon', 'authenticated']) {
        assert.equal(sql(`select has_function_privilege('${role}','public.claim_auth_email_delivery(text,uuid)','execute');`), 'f');
        assert.equal(sql(`select has_function_privilege('${role}','public.finish_auth_email_delivery(text,uuid,text)','execute');`), 'f');
        assert.equal(sql(`select has_schema_privilege('${role}','auth_mail_private','usage');`), 'f');
    }
    assert.equal(sql("select has_table_privilege('service_role','auth_mail_private.delivery','select');"), 'f');
    let denied = false;
    try { sql("set role service_role; set request.jwt.claim.role='authenticated'; select * from public.claim_auth_email_delivery('" + 'b'.repeat(64) + "','" + owner + "');"); }
    catch { denied = true; }
    assert(denied); assert.equal(sql('select count(*) from auth_mail_private.delivery'), '1');
    console.log('PASS private schema, restricted GRANTs, and RPC authorization checks');
    for (const [i, state] of ['uncertain', 'failed'].entries()) {
        const k = String(i + 1).repeat(64);
        sql(service(`select * from public.claim_auth_email_delivery('${k}','${owner}');`));
        sql(service(`select * from public.finish_auth_email_delivery('${k}','${owner}','${state}');`));
        assert.equal(sql(service(`select decision from public.claim_auth_email_delivery('${k}','${crypto.randomUUID()}');`)).split('\n').at(-1), 'blocked');
    }
    console.log('PASS failed/uncertain attempts cannot be automatically sent a second time');
    console.log('Artifacts:', work);
} finally {
    if (started) execFileSync(path.join(binaries, 'pg_ctl'), ['-D', db, '-w', '-m', 'fast', 'stop'], { stdio: 'pipe' });
}
