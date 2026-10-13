#!/usr/bin/env bash
# Shared runtime selection for the foreground server and app controls.
usable_node() {
  "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=15)?0:1)' >/dev/null 2>&1
}
if [[ -n "${LEDGER_NODE_BIN:-}" ]]; then
  if ! usable_node "$LEDGER_NODE_BIN"; then printf '%s\n' 'LEDGER_NODE_BIN must point to Node.js 24.15 or newer.' >&2; exit 1; fi
elif command -v node >/dev/null 2>&1 && usable_node "$(command -v node)"; then
  LEDGER_NODE_BIN="$(command -v node)"
elif [[ -x "${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]] && usable_node "${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; then
  LEDGER_NODE_BIN="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  printf '%s\n' 'Install Node.js 24.15 or newer, then try again.' >&2
  exit 1
fi
export PATH="$(dirname "$LEDGER_NODE_BIN"):$PATH"
