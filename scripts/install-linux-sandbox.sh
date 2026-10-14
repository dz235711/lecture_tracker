#!/usr/bin/env bash
# Give this checkout's Electron binary permission to create Chromium's sandbox.
set -euo pipefail
mode="${1:---print}"
executable="$(realpath "$(dirname "$0")/../node_modules/electron/dist/electron")"
if [[ ! -f "$executable" || ! -x "$executable" ]]; then
  printf '%s\n' 'Install the app dependencies before setting up desktop launching.' >&2
  exit 1
fi
# AppArmor treats glob/variable characters as policy syntax, even in quoted paths.
for character in '"' '\' '*' '?' '[' ']' '{' '}' '^' $'\n' $'\r' $'\t'; do
  if [[ "$executable" == *"$character"* ]]; then
    printf '%s\n' 'This folder name cannot be used in an exact AppArmor executable rule.' >&2
    exit 1
  fi
done
fingerprint="$(printf '%s' "$executable" | sha256sum)"
profile_name="lecture-tracker-${fingerprint:0:16}"
profile="$(printf '# Lecture Tracker sandbox permission; managed by setup-sandbox.sh\nabi <abi/4.0>,\ninclude <tunables/global>\n\nprofile %s "%s" flags=(unconfined) {\n  userns,\n}\n' "$profile_name" "$executable")"
if [[ "$mode" == --print ]]; then
  printf '%s\n' "$profile"
  exit 0
fi
if [[ "$mode" != --install || "$EUID" != 0 ]]; then
  printf '%s\n' 'Installation requires administrator authentication through ./setup-sandbox.sh.' >&2
  exit 1
fi
destination="/etc/apparmor.d/$profile_name"
if [[ -e "$destination" ]] && [[ "$(cat "$destination")" != "$profile" ]]; then
  printf '%s\n' "A different profile exists at $destination; it was not replaced." >&2
  exit 1
fi
temporary="$(mktemp /etc/apparmor.d/.lecture-tracker.XXXXXX)"
trap 'rm -f "$temporary"' EXIT
printf '%s\n' "$profile" > "$temporary"
/usr/sbin/apparmor_parser --skip-kernel-load --skip-cache "$temporary"
# Load first so a rejected rule never becomes a persistent installed profile.
/usr/sbin/apparmor_parser --replace --skip-cache "$temporary"
install -o root -g root -m 644 "$temporary" "$destination"
printf '%s\n' 'Secure desktop launching is enabled for Lecture Tracker.'
