#!/usr/bin/env bash
set -euo pipefail
# Must run only on a disposable local/CI Docker engine. No production endpoints/credentials.
cd "$(dirname "$0")/../.."
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo 'Docker Engine + Compose are required. No tools were installed.' >&2
  exit 2
fi
if [[ "${GITHUB_ACTIONS:-false}" != true && "${MG_AUTH_IT_ALLOW_LOCAL:-0}" != 1 ]]; then
  echo 'Set MG_AUTH_IT_ALLOW_LOCAL=1 only for an explicitly disposable local Docker engine.' >&2
  exit 2
fi
if [[ -n "${DOCKER_HOST:-}" && "$DOCKER_HOST" != unix://* ]]; then
  echo 'Refusing a remote Docker host for this isolated fixture.' >&2
  exit 2
fi
engine_endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
if [[ "$engine_endpoint" != unix://* ]]; then
  echo 'Refusing a remote Docker context for this isolated fixture.' >&2
  exit 2
fi
task_root="$(mktemp -d "${TMPDIR:-/tmp}/mg-auth-mail-it.XXXXXX")"
fixture_dir="$task_root/fixture"
project="mg-auth-mail-it-${GITHUB_RUN_ID:-local}-$$"
node tests/auth-email.integration/prepare.mjs "$fixture_dir"
compose=(docker compose --project-name "$project" --env-file "$fixture_dir/fixture.env" -f tests/auth-email.integration/compose.yml)
cleanup() { "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
diagnose() { "${compose[@]}" logs --no-log-prefix n8n auth rest db 2>&1 | node tests/auth-email.integration/diagnostics.mjs || true; }
trap cleanup EXIT
# Pull before starting the closed network. No runtime service is attached to an egress network.
"${compose[@]}" pull --quiet
"${compose[@]}" up -d db auth rest n8n fixture
if ! "${compose[@]}" run --rm driver node /tests/driver.mjs --wait-only; then diagnose; exit 1; fi
"${compose[@]}" exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'CREATE TRIGGER auth_it_profile_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fixture_create_profile();' >/dev/null
if ! "${compose[@]}" run --rm driver; then diagnose; exit 1; fi
mkdir -p "${MG_AUTH_IT_RESULTS_DIR:-$task_root/results}"
cp "$fixture_dir/out/results.json" "${MG_AUTH_IT_RESULTS_DIR:-$task_root/results}/results.json"
echo 'Isolated integration completed; only the redacted results.json is retained.'
