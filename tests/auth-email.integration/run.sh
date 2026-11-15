#!/usr/bin/env bash
set -euo pipefail
# Must run only on a disposable local/CI Docker engine. No production endpoints/credentials.
cd "$(dirname "$0")/../.."
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo 'Docker Engine + Compose are required. No tools were installed.' >&2
  exit 2
fi
task_root="$(mktemp -d "${TMPDIR:-/tmp}/mg-auth-mail-it.XXXXXX")"
fixture_dir="$task_root/fixture"
project="mg-auth-mail-it-${GITHUB_RUN_ID:-local}-$$"
node tests/auth-email.integration/prepare.mjs "$fixture_dir"
compose=(docker compose --project-name "$project" --env-file "$fixture_dir/fixture.env" -f tests/auth-email.integration/compose.yml)
cleanup() { "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
# Pull before starting the closed network. No runtime service is attached to an egress network.
"${compose[@]}" pull --quiet
"${compose[@]}" up -d db auth rest n8n fixture
"${compose[@]}" run --rm driver node /tests/driver.mjs --wait-only
"${compose[@]}" exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'CREATE TRIGGER auth_it_profile_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fixture_create_profile();' >/dev/null
"${compose[@]}" run --rm driver
mkdir -p "${MG_AUTH_IT_RESULTS_DIR:-$task_root/results}"
cp "$fixture_dir/out/results.json" "${MG_AUTH_IT_RESULTS_DIR:-$task_root/results}/results.json"
echo 'Isolated integration completed; only the redacted results.json is retained.'
