#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source scripts/node.sh
if [[ $# -eq 0 ]]; then exec "$LEDGER_NODE_BIN" scripts/desktop.mjs; fi
exec "$LEDGER_NODE_BIN" scripts/app.mjs "$@"
