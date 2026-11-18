#!/bin/sh
# Build the native GPUI client (perch-native) from this checkout, quit the running one, install it
# as /Applications/perch-native.app and open it. macOS only.
#
# The native client is a view onto a running core: it finds the one published in
# ~/.perch/daemon/core.json, which today is the Tauri app's (perch.app). So this does NOT touch
# /Applications/perch.app, the core's host and where the native client hands off files, changes and
# the rest. Keep running scripts/reinstall-desktop.sh for that one.
#
# The native client must run from this bundle: macOS attributes its system notifications to the
# bundle's identifier and icon (perch's bird, "Session finished"), as the Tauri app's. Run unbundled
# (target/release) it posts no notification at all.
#
# Needs Zig 0.16.x (ZIG=/path/to/zig, else Homebrew's zig@0.16 is used) and the ghostty submodule.
# Terminals live in perchd and survive the swap. `--quit` stops the running app and does nothing else.
set -eu
cd "$(dirname "$0")/.."

APP=/Applications/perch-native.app
EXE="$APP/Contents/MacOS/perch-native"
BUILT=target/release/perch-native
ID=dev.hwii.perch.native

# Exact argv match: only this app. The client has no Quit of its own yet, so stop it by signal.
app_pids() { pgrep -fx "$EXE" || true; }
gone_within() { # seconds
  i=0
  while [ -n "$(app_pids)" ] && [ "$i" -lt "$(($1 * 2))" ]; do sleep 0.5; i=$((i + 1)); done
  [ -z "$(app_pids)" ]
}
quit_app() {
  [ -n "$(app_pids)" ] || return 0
  echo "Quitting perch-native…"
  kill $(app_pids) 2>/dev/null || true
  gone_within 5 || { kill -9 $(app_pids) 2>/dev/null || true; gone_within 2; }
}
# `--quit` only stops the running app: no build, no install.
if [ "${1:-}" = --quit ]; then
  quit_app
  echo "perch-native is not running."
  exit 0
fi

[ -e third_party/ghostty/build.zig ] || git submodule update --init third_party/ghostty
if [ -z "${ZIG:-}" ] && [ -x /opt/homebrew/opt/zig@0.16/bin/zig ]; then
  ZIG=/opt/homebrew/opt/zig@0.16/bin/zig
fi
export ZIG="${ZIG:-zig}"

cargo build --release -p perch-native

# Assemble the bundle beside the build and sign it ad hoc. The identifier is its own, so it never
# shares grants with perch.app.
stage="$(mktemp -d)/perch-native.app"
mkdir -p "$stage/Contents/MacOS" "$stage/Contents/Resources"
cp "$BUILT" "$stage/Contents/MacOS/perch-native"
cp crates/perch-desktop/icons/icon.icns "$stage/Contents/Resources/icon.icns"
version="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"
cat > "$stage/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>perch-native</string>
  <key>CFBundleIdentifier</key><string>$ID</string>
  <key>CFBundleName</key><string>perch-native</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
EOF
codesign --force --sign - --identifier "$ID" "$stage"

quit_app

[ -d "$APP" ] && rm -rf "$APP"
ditto "$stage" "$APP"
rm -rf "$(dirname "$stage")"

# The core is perch.app's; without it the window has nothing to show until it starts.
core_pid="$(sed -n 's/.*"pid": *\([0-9]*\).*/\1/p' "$HOME/.perch/daemon/core.json" 2>/dev/null || true)"
if [ -z "$core_pid" ] || ! kill -0 "$core_pid" 2>/dev/null; then
  echo "Note: no running core found. Open /Applications/perch.app first; perch-native finds it by itself." >&2
fi

open "$APP"
echo "Installed and opened $APP"
