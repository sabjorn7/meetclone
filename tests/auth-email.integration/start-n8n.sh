#!/bin/sh
set -eu
# Fixture-local SQLite only. No production credentials or n8n API access.
n8n import:workflow --input=/fixture-workflow.json >/tmp/fixture-import.log 2>&1
n8n update:workflow --id=AuthEmailIntegrationFixture --active=true >/tmp/fixture-activate.log 2>&1
exec n8n start
