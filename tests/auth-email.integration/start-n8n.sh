#!/bin/sh
set -eu
# Fixture-local SQLite only. No production credentials or n8n API access.
if ! n8n import:workflow --input=/fixture-workflow.json >/tmp/fixture-import.log 2>&1; then
  echo fixture_n8n_import_failure
  node /fixture-diagnostics.mjs </tmp/fixture-import.log
  exit 1
fi
if ! n8n update:workflow --id=AuthEmailIntegrationFixture --active=true >/tmp/fixture-activate.log 2>&1; then
  echo fixture_n8n_activate_failure
  node /fixture-diagnostics.mjs </tmp/fixture-activate.log
  exit 1
fi
exec n8n start
