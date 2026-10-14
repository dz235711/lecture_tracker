#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" != Linux ]]; then
  printf '%s\n' 'This setup is only needed on Linux with restricted user namespaces.' >&2
  exit 1
fi
# Only this exact Electron executable receives user-namespace permission.
if [[ "$EUID" == 0 ]]; then
  exec /bin/bash scripts/install-linux-sandbox.sh --install
fi
exec pkexec /bin/bash "$PWD/scripts/install-linux-sandbox.sh" --install
