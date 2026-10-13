#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source scripts/node.sh
exec "$LEDGER_NODE_BIN" scripts/start.mjs "$@"
