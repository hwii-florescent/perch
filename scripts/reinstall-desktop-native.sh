#!/bin/sh
# Build the native GPUI client from this checkout and install it as THE Perch app,
# /Applications/perch.app, in place of the Tauri build. macOS only.
#
# The bundle holds:
#   Contents/MacOS/perch-native  the window (CFBundleExecutable)
#   Contents/MacOS/perch-core    the core; the window starts it when none is running, and the core
#                                runs the terminal daemon (`__perchd`) from a copy of this bundle
#   Contents/MacOS/perch         the CLI agents use inside Perch terminals
#   Contents/Resources/web-dist  the web build the core serves to the phone and browsers
#
# It keeps the Tauri app's identifier (dev.hwii.perch), Info.plist usage strings and signing identity
# (crates/perch-desktop/tauri.macos.conf.json), so macOS keeps its privacy grants and notifications.
# A build that would be signed differently stops before touching the installed app
# (PERCH_ALLOW_IDENTITY_CHANGE=1 installs anyway). The bundle it replaces is moved to
# ~/.perch/replaced-apps/, not deleted. Terminals live in perchd and survive the swap.
#
# Needs Zig 0.16.x (ZIG=..., else Homebrew's zig@0.16) and the ghostty submodule.
# `--quit` stops the running app and does nothing else; `--relay-only` only redeploys the relay
# (scripts/deploy-relay.sh, which a full install also runs; PERCH_SKIP_RELAY=1 skips it). scripts/reinstall-desktop.sh still builds the
# Tauri app, if it is ever needed back.
set -eu
cd "$(dirname "$0")/.."

APP=/Applications/perch.app
ID=dev.hwii.perch
OLD_NATIVE=/Applications/perch-native.app

# Exact argv match: the window only, never the core or its `__perchd` daemon (a core started by an
# older window keeps serving; the new window finds it through core.json).
app_pids() { pgrep -fx "$APP/Contents/MacOS/perch-native" || true; pgrep -fx "$APP/Contents/MacOS/perch-desktop" || true; pgrep -fx "$OLD_NATIVE/Contents/MacOS/perch-native" || true; }
gone_within() { # seconds
  i=0
  while [ -n "$(app_pids)" ] && [ "$i" -lt "$(($1 * 2))" ]; do sleep 0.5; i=$((i + 1)); done
  [ -z "$(app_pids)" ]
}
quit_app() {
  [ -n "$(app_pids)" ] || return 0
  echo "Quitting Perch…"
  kill $(app_pids) 2>/dev/null || true
  gone_within 5 || { kill -9 $(app_pids) 2>/dev/null || true; gone_within 2; }
}
if [ "${1:-}" = --quit ]; then
  quit_app
  echo "Perch is not running."
  exit 0
fi
# `--relay-only` redeploys the phone's web app from the current build and does nothing else.
if [ "${1:-}" = --relay-only ]; then
  exec sh scripts/deploy-relay.sh
fi

[ -e third_party/ghostty/build.zig ] || git submodule update --init third_party/ghostty
if [ -z "${ZIG:-}" ] && [ -x /opt/homebrew/opt/zig@0.16/bin/zig ]; then
  ZIG=/opt/homebrew/opt/zig@0.16/bin/zig
fi
export ZIG="${ZIG:-zig}"

npm run build
cargo build --release -p perch-native -p perch-core
cargo build --release -p perchd --bin perch

identity="$(sed -n 's/.*"signingIdentity": *"\([^"]*\)".*/\1/p' crates/perch-desktop/tauri.macos.conf.json 2>/dev/null || true)"
identity="${identity:--}"

stage="$(mktemp -d)/perch.app"
mkdir -p "$stage/Contents/MacOS" "$stage/Contents/Resources"
cp target/release/perch-native target/release/perch-core target/release/perch "$stage/Contents/MacOS/"
cp crates/perch-desktop/icons/icon.icns "$stage/Contents/Resources/icon.icns"
ditto packages/web/dist "$stage/Contents/Resources/web-dist"
version="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"
cat > "$stage/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>perch-native</string>
  <key>CFBundleIdentifier</key><string>$ID</string>
  <key>CFBundleName</key><string>perch</string>
  <key>CFBundleDisplayName</key><string>perch</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleIconFile</key><string>icon.icns</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppleEventsUsageDescription</key><string>perch lets tools you run automate other apps when you allow it.</string>
  <key>NSDesktopFolderUsageDescription</key><string>perch terminals and agents need your permission to work with files on your Desktop.</string>
  <key>NSDocumentsFolderUsageDescription</key><string>perch terminals and agents need your permission to work with files in Documents.</string>
  <key>NSDownloadsFolderUsageDescription</key><string>perch terminals and agents need your permission to work with files in Downloads.</string>
</dict></plist>
EOF
# Inner executables first, then the bundle, with the hardened runtime as the Tauri build was.
for exe in perch-core perch; do
  codesign --force --options runtime --sign "$identity" "$stage/Contents/MacOS/$exe"
done
codesign --force --options runtime --entitlements crates/perch-desktop/Entitlements.plist \
  --sign "$identity" --identifier "$ID" "$stage"

requirement() { codesign -d -r- "$1" 2>&1 | sed -n 's/^designated => //p'; }
if [ -d "$APP" ] && [ "${PERCH_ALLOW_IDENTITY_CHANGE:-}" != 1 ]; then
  installed="$(requirement "$APP")"
  built="$(requirement "$stage")"
  case "$installed" in
    ""|*cdhash*) ;;
    *) if [ "$installed" != "$built" ]; then
      echo "Refusing to install: the new build is signed differently from the installed app, so macOS would ask for every permission again." >&2
      echo "  installed: $installed" >&2
      echo "  built:     ${built:-none}" >&2
      exit 1
    fi ;;
  esac
fi

quit_app
# The core serves the web build of the bundle it started from, so a new install restarts it (the
# window starts the new one). Terminals live in perchd and survive; phones reconnect. `--quit` above
# leaves the core running, so the phone stays reachable with the window closed.
core_pids() { pgrep -fx "$APP/Contents/MacOS/perch-core" || true; }
if [ -n "$(core_pids)" ]; then
  echo "Restarting the core…"
  kill $(core_pids) 2>/dev/null || true
  i=0; while [ -n "$(core_pids)" ] && [ "$i" -lt 10 ]; do sleep 0.5; i=$((i + 1)); done
  [ -z "$(core_pids)" ] || kill -9 $(core_pids) 2>/dev/null || true
fi

# Move old bundles aside, never overwrite in place: a daemon may still run from one.
keep="$HOME/.perch/replaced-apps/$(date +%Y%m%d-%H%M%S)"
for old in "$APP" "$OLD_NATIVE"; do
  [ -d "$old" ] || continue
  mkdir -p "$keep"
  mv "$old" "$keep/"
done
ditto "$stage" "$APP"
rm -rf "$(dirname "$stage")"

# Launched in the background so it never takes focus from what the person is doing, and without a
# Perch terminal's identity when run from one.
env -u PERCH_SESSION -u PERCH_TOKEN -u PERCH_SHELL open -g "$APP"
echo "Installed and opened $APP (replaced bundles kept in $keep)"

# The phone's web app on the relay follows the same build (scripts/deploy-relay.sh; never fails this).
sh scripts/deploy-relay.sh
