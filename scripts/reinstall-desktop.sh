#!/bin/sh
# Build perch.app from this checkout, quit the running app, install the build
# to /Applications and open it again. macOS only.
#
# Terminals live in perchd (the same binary run as `__perchd serve`), which
# keeps running across the swap, so agents and shells survive, including the
# one running this script.
set -eu
cd "$(dirname "$0")/.."

APP=/Applications/perch.app
EXE="$APP/Contents/MacOS/perch-desktop"
BUILT=target/release/bundle/macos/perch.app

npm run build
(cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build --bundles app)

# macOS ties Full Disk Access and the other grants to the app's signing identity, and the
# daemon outliving this swap keeps the old one. A build signed differently (typically ad-hoc,
# from a checkout without the gitignored crates/perch-desktop/tauri.macos.conf.json) would
# drop the grants, so stop before touching the installed app. An installed ad-hoc app has no
# stable identity to protect. PERCH_ALLOW_IDENTITY_CHANGE=1 installs anyway.
requirement() { codesign -d -r- "$1" 2>&1 | sed -n 's/^designated => //p'; }
if [ -d "$APP" ] && [ "${PERCH_ALLOW_IDENTITY_CHANGE:-}" != 1 ]; then
  installed="$(requirement "$APP")"
  built="$(requirement "$BUILT")"
  case "$installed" in
    ""|*cdhash*) ;;
    *) if [ "$installed" != "$built" ]; then
      echo "Refusing to install: the new build is signed differently from the installed app, so macOS would ask for every permission again." >&2
      echo "  installed: $installed" >&2
      echo "  built:     ${built:-none}" >&2
      echo "Build from the checkout that has crates/perch-desktop/tauri.macos.conf.json, or set PERCH_ALLOW_IDENTITY_CHANGE=1." >&2
      exit 1
    fi ;;
  esac
fi

# Exact argv match: only the app, never its `__perchd serve` daemon.
app_pids() { pgrep -fx "$EXE" || true; }
gone_within() { # seconds
  i=0
  while [ -n "$(app_pids)" ] && [ "$i" -lt "$(($1 * 2))" ]; do sleep 0.5; i=$((i + 1)); done
  [ -z "$(app_pids)" ]
}
if [ -n "$(app_pids)" ]; then
  echo "Quitting perch…"
  # Backgrounded: a frozen app can leave osascript waiting forever.
  osascript -e 'tell application id "dev.hwii.perch" to quit' >/dev/null 2>&1 &
  gone_within 5 || { kill $(app_pids) 2>/dev/null || true; gone_within 5; } \
    || { kill -9 $(app_pids) 2>/dev/null || true; gone_within 2; }
fi

# Move the old bundle aside rather than overwriting it in place: the running
# daemon still executes the old binary, and rewriting that file under it would
# crash it. Unlinking is safe; the daemon keeps its inode.
if [ -d "$APP" ]; then
  old="$(mktemp -d)/perch.app"
  mv "$APP" "$old"
fi
ditto "$BUILT" "$APP"
[ -n "${old:-}" ] && rm -rf "$old"

open "$APP"
echo "Installed and opened $APP"
