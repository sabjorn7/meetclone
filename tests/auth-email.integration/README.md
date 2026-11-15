This is a disposable integration stack, not a production deployment.

Run `MG_AUTH_IT_ALLOW_LOCAL=1 bash tests/auth-email.integration/run.sh` on a local/disposable Docker Engine
with Compose, Node 20+ and OpenSSL. Nothing is installed by the script. The same
test runs in GitHub Actions only for pushes to `feat/auth-email-hook-20261113`
affecting the integration/transport files; it has read-only repository permission
and does not reference any GitHub repository secrets or deployment credentials.
Remote Docker hosts/contexts are rejected; CI uses the runner's local Unix-socket engine.

The stack runs real `supabase/gotrue:v2.171.0`, real n8n `1.90.2` (the version
reported by the production read-only health check), PostgreSQL 15 and PostgREST.
The existing pending ledger SQL is copied unchanged to the disposable PostgreSQL.
The fixture profile trigger tests creation/role preservation inside the actual
GoTrue transaction; it does not read or modify the production profile trigger.

All runtime containers use one Docker network with `internal: true`. No ports are
published and no Docker socket, home directory, application env or credentials
are mounted. The four real-looking domains in the workflow resolve ONLY to the
local fixture TLS router via network aliases. This allows the exact production
workflow host/path/redirect restrictions to be tested without changing them to
weaker localhost defaults. A short-lived fixture CA is trusted only inside these
containers. Image pulls happen before runtime; external application egress is
unavailable inside the test network.

The Unisender API is a contract mock, not a real sender. Its success replies cover
both the documented `error_checking=1` array and the legacy `result.email_id`
string shape observed in successful existing MeetGuru executions. No test email
is sent, and the real Unisender key is never read. This does not establish actual
provider latency, inbox delivery, quota or sender/list authorization.

The driver checks:

- Actual GoTrue signup -> signed native payload -> real n8n nodes -> provider
  mock -> real PostgREST ledger RPC -> exact 200 JSON `{}` reply -> native verify.
- Native SHA-224 token hashes (56 hex characters), proper verify URL, confirmed
  session and one profile with the original UUID and role metadata.
- Signup resend, server rate limit, token rotation, old-link invalidation and no
  duplicate profile; expired native tokens are rejected by GoTrue itself.
- Native Standard Webhooks signature, tampered original bytes, retries with new
  webhook IDs and no duplicate send after acceptance or ambiguous failures.
- Both provider success response formats, JSON errors, recipient errors, HTML,
  a slow provider, an unavailable claim/finish RPC, and native transaction rollback.
- GoTrue's real approximately-five-second HTTP-hook deadline. The proxy delays
  a successfully processed hook reply beyond that deadline; signup must fail and
  its profile must roll back even if external mail acceptance already happened.
- Empty response bodies are rejected by this GoTrue version, while JSON `{}` is
  accepted. This tests the actual GoTrue hook decoder rather than a mock decoder.
- Existing VK/ResetPw admin `generate_link(recovery)` and OTP verification shape
  against real GoTrue with confirmation enabled, without invoking Send Email Hook.
  No production workflow is imported or edited.

Only scenario labels, statuses and timings are printed. Hook bodies, HTML, tokens,
JWTs and signing/API/database secrets stay in fixture memory/private temporary
files; n8n execution retention is disabled. Raw container logs are not uploaded.
The only retained artifact is redacted `results.json` with versions and outcomes.
The script removes only its own Compose project's containers/volumes on exit.

The integration runner intentionally uses a 5-second resend interval and a
30-second token lifetime to exercise limits/expiry quickly. These settings exist
only in the isolated fixture and do not recommend changing production limits.
