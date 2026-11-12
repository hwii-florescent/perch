#!/usr/bin/env bash
# Memory of the native client (perch-native) against the Tauri desktop app (perch-desktop) in
# the same four states, and the shared core/daemon cost, with no input event and no focus change.
#
#   scripts/measure-native-memory.sh [--build] [--apps tauri,native] [--states a,b,c,d]
#
# Release builds are expected in target/release (perch-core, perch-desktop, perch-native, and
# examples/measure_setup); --build makes them (needs ZIG, see docs/TESTING.md).
#
# States: a idle, nothing shown; b one terminal; c four split terminals; d one busy full-screen
# colour TUI. Physical footprint (`footprint`), summed over the app's own processes: the one
# process of the native client; the Tauri host plus the WebKit helpers that appeared after it was
# launched. Each state runs in a fresh process, settles SETTLE seconds, then takes SAMPLES samples
# (median reported). The desktop app embeds its own core and its test window is hidden, so the
# native client is measured both hidden and shown (ordered in, never key, app never activated).
#
# Everything is private: a scratch HOME, database, hosts, settings and terminal daemon per app,
# on free ports. The installed Perch and ~/.perch are never touched. Every process started here
# is tracked and stopped on exit; the scratch daemon's launchd job is unloaded.
#
# The desktop app's window is hidden and cannot be driven without an input event, so only its idle
# state is measured directly. States b-d of the web page are measured in Playwright's headless
# WebKit (the engine Tauri's webview runs) against a headless core, and the table adds the page's
# growth over its idle state to the real app's idle footprint as an estimate. Needs playwright-core
# (PW_DIR, default e2e/) and, for a browser build installed elsewhere, WEBKIT_RUN (its launcher).
#
# Env: SETTLE (10) SAMPLES (3) SAMPLE_GAP (2) BUSY_SECONDS (45) WINDOW (1280x800) PW_DIR WEBKIT_RUN
# KEEP=1 keeps the scratch directory and logs.

set -u -o pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
BIN=${PERCH_BIN_DIR:-$ROOT/target/release}
SETTLE=${SETTLE:-10}
SAMPLES=${SAMPLES:-3}
SAMPLE_GAP=${SAMPLE_GAP:-2}
BUSY_SECONDS=${BUSY_SECONDS:-45}
WINDOW=${WINDOW:-1280x800}
APPS=tauri,native
STATES=a,b,c,d
BUILD=0

while [ $# -gt 0 ]; do
  case "$1" in
    --build) BUILD=1 ;;
    --apps) APPS=$2; shift ;;
    --states) STATES=$2; shift ;;
    -h | --help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

log() { printf '%s\n' "$*" >&2; }
die() { log "error: $*"; exit 1; }
has() { case ",$2," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }

if [ "$BUILD" = 1 ]; then
  : "${ZIG:?set ZIG to a Zig 0.16 binary}"
  (cd "$ROOT/packages/web" && npx vite build) || die "web build"
  (cd "$ROOT" \
    && cargo build --release -p perch-core \
    && cargo build --release -p perch-desktop \
    && cargo build --release -p perch-native --example measure_setup \
    && cargo build --release -p perch-native) || die "cargo build"
fi
CORE=$BIN/perch-core
DESKTOP=$BIN/perch-desktop
NATIVE=$BIN/perch-native
SETUP=$BIN/examples/measure_setup
for f in "$CORE" "$DESKTOP" "$NATIVE" "$SETUP"; do
  [ -x "$f" ] || die "$f is missing; run with --build"
done

SCRATCH=$(mktemp -d "${TMPDIR:-/tmp}/perch-measure.XXXXXX") || die "no scratch directory"
SCRATCH=$(cd "$SCRATCH" && pwd -P)
PIDFILE=$SCRATCH/tracked.pids
FRONT_LOG=$SCRATCH/frontmost.log
RESULTS=$SCRATCH/results.tsv
: > "$PIDFILE"; : > "$FRONT_LOG"; : > "$RESULTS"
APP_DIRS=""

# ---- process tracking and cleanup ------------------------------------------------------------

track() { echo "$1 $2" >> "$PIDFILE"; }
alive() { kill -0 "$1" 2>/dev/null; }
gone() { ! alive "$1"; }

stop_pid() { # SIGTERM first, SIGKILL only if it ignores that.
  local pid=$1 i
  alive "$pid" || return 0
  kill -TERM "$pid" 2>/dev/null
  for i in $(seq 1 50); do alive "$pid" || return 0; sleep 0.1; done
  log "pid $pid ignored SIGTERM"; kill -KILL "$pid" 2>/dev/null
  for i in $(seq 1 20); do alive "$pid" || return 0; sleep 0.1; done
  return 1
}

daemon_tool() { # the scratch daemon's command line tool, aimed at that daemon only
  local dir=$1; shift
  env -i HOME="$dir/home" PATH="$PATH" "$CORE" __perchd "$@" --dir "$dir/daemon" --json
}

stop_daemon() { # release the shells this run started, then wait for the daemon to go
  local dir=$1 pid i
  [ -f "$dir/daemon/daemon-v1.pid" ] || return 0
  pid=$(cat "$dir/daemon/daemon-v1.pid" 2>/dev/null)
  daemon_tool "$dir" release --owner "measure:$dir" --reason "measurement teardown" > /dev/null 2>&1
  daemon_tool "$dir" cleanup --yes > /dev/null 2>&1
  if [ -n "$pid" ]; then
    for i in $(seq 1 100); do alive "$pid" || break; sleep 0.1; done
    alive "$pid" && log "daemon $pid is still running"
  fi
  local plist label
  for plist in "$dir"/daemon/*.plist; do
    [ -e "$plist" ] || continue
    label=$(basename "$plist" .plist)
    launchctl bootout "gui/$(id -u)/$label" 2> /dev/null
  done
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [ -n "${WATCHER:-}" ]; then kill "$WATCHER" 2>/dev/null; wait "$WATCHER" 2>/dev/null; fi
  # apps first, then cores, then the daemons
  local pid name
  while read -r name pid; do
    case "$name" in native-? | tauri-?) stop_pid "$pid" ;; esac
  done < <(sort -r "$PIDFILE")
  while read -r name pid; do
    case "$name" in core*) stop_pid "$pid" ;; esac
  done < <(sort -r "$PIDFILE")
  local dir
  for dir in $APP_DIRS; do stop_daemon "$dir"; done
  while read -r name pid; do
    case "$name" in tauri-helper-*) continue ;; esac
    alive "$pid" && log "STILL RUNNING: $name $pid"
  done < "$PIDFILE"
  if [ "${KEEP:-0}" = 1 ] || [ "$status" != 0 ]; then
    log "scratch kept at $SCRATCH"
  else
    rm -rf "$SCRATCH"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

# ---- frontmost app: logged, and any app of ours that takes it is stopped at once -------------

front_name() { lsappinfo info -only name "$(lsappinfo front)" 2>/dev/null | head -1; }
front_pid() { lsappinfo info -only pid "$(lsappinfo front)" 2>/dev/null | sed -n 's/.*"pid"=\([0-9]*\).*/\1/p'; }
echo "$(date +%T) start: $(front_name)" >> "$FRONT_LOG"
watch_front() {
  local base cur pid
  base=$(lsappinfo front)
  while :; do
    cur=$(lsappinfo front)
    if [ "$cur" != "$base" ]; then
      base=$cur; pid=$(front_pid)
      echo "$(date +%T) changed: $(front_name) pid=${pid:-?}" >> "$FRONT_LOG"
      if [ -n "$pid" ] && grep -q " $pid\$" "$PIDFILE"; then
        echo "$(date +%T) STOLEN by tracked pid $pid; stopping it" >> "$FRONT_LOG"
        kill -TERM "$pid" 2>/dev/null; touch "$SCRATCH/front-stolen"
      fi
    fi
    sleep 0.2
  done
}
watch_front & WATCHER=$!

# ---- measuring -------------------------------------------------------------------------------

footprint_mb() { # pids -> total physical footprint in MB (one decimal), sum of each process
  python3 -I - "$@" <<'PY'
import json, subprocess, sys, tempfile, os
total = 0
for pid in sys.argv[1:]:
    fd, path = tempfile.mkstemp(suffix=".json"); os.close(fd)
    try:
        subprocess.run(["footprint", "-p", pid, "-j", path], capture_output=True, check=True)
        total += json.load(open(path))["processes"][0]["footprint"]
    except Exception as e:
        print(f"footprint {pid}: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        os.unlink(path)
print(f"{total / 1048576:.1f}")
PY
}

webkit_pids() { # every WebKit helper process now running
  ps -axo pid=,command= | awk '/com\.apple\.WebKit\.(WebContent|GPU|Networking)/ && !/awk/ {print $1}' | sort -n
}

window_report() { # read-only: windows of these pids as the window server lists them, and the display
  local pids="$*"
  swift - $pids 2> /dev/null <<'SWIFT'
import CoreGraphics
import Foundation
let want = Set(CommandLine.arguments.dropFirst().compactMap { Int32($0) })
let list = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
for w in list {
    let pid = (w[kCGWindowOwnerPID as String] as? Int32) ?? 0
    if !want.contains(pid) { continue }
    let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
    print("  window pid=\(pid) onscreen=\((w[kCGWindowIsOnscreen as String] as? Bool) ?? false) layer=\(w[kCGWindowLayer as String] ?? 0) \(b["Width"] ?? 0)x\(b["Height"] ?? 0)")
}
print("  display asleep=\(CGDisplayIsAsleep(CGMainDisplayID())) scale=\(CGDisplayPixelsWide(CGMainDisplayID()))px/\(CGDisplayBounds(CGMainDisplayID()).width)pt")
SWIFT
}

breakdown() { # pids -> each process's footprint and its two largest categories
  local pid tmp
  for pid in "$@"; do
    tmp=$(mktemp "$SCRATCH/fp.XXXXXX")
    footprint -p "$pid" -j "$tmp" > /dev/null 2>&1 \
      && python3 -I -c "
import json, subprocess
p = json.load(open('$tmp'))['processes'][0]
top = sorted(p['categories'].items(), key=lambda kv: -(kv[1]['dirty'] + kv[1]['swapped']))[:3]
name = subprocess.run(['ps', '-o', 'comm=', '-p', '$pid'], capture_output=True, text=True).stdout.strip().split('/')[-1]
print(f\"    {name} [{p['pid']}] {p['footprint'] / 1048576:.1f} MB: \" + ', '.join(f\"{k} {(v['dirty'] + v['swapped']) / 1048576:.1f}\" for k, v in top))" >&2
    rm -f "$tmp"
  done
}

median() { python3 -I -c 'import sys,statistics;print(f"{statistics.median(float(x) for x in sys.argv[1:]):.1f}")' "$@"; }

wait_for() { # description, timeout seconds, command...
  local what=$1 limit=$2 i; shift 2
  for i in $(seq 1 $((limit * 10))); do "$@" && return 0; sleep 0.1; done
  log "timed out waiting for $what"; return 1
}

free_port() { python3 -I -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])'; }

# A minimal environment, so nothing of the person's shell (or of a Perch terminal this runs in)
# reaches the apps. PERCH_* names are set here and nowhere else.
run_env() { # dir -> env -i arguments
  local dir=$1
  echo "HOME=$dir/home USER=$(id -un) LOGNAME=$(id -un) SHELL=/bin/zsh LANG=en_US.UTF-8 TMPDIR=${TMPDIR:-/tmp/}" \
    "PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin" \
    "PERCH_DB=$dir/data/history.sqlite PERCH_HOSTS=$dir/data/hosts.json PERCH_DEVICES=$dir/data/devices.json" \
    "PERCHD_DIR=$dir/daemon PERCH_SETTINGS=$dir/data/settings.json PERCH_CLEANUP_OWNER=measure:$dir" \
    "PERCHD_IDLE_EXIT_SECS=1 PERCH_SKIP_RELAY=1"
}

new_app_dir() { # name -> a private state directory with the shell driver in place
  local dir=$SCRATCH/$1
  mkdir -p "$dir/home/measure/flags" "$dir/data" "$dir/daemon" "$dir/logs"
  APP_DIRS="$APP_DIRS $dir"
  # An interactive shell on a terminal runs the driver; the login-shell probe the core does at
  # start (no terminal) does not.
  echo '[[ -t 0 && -z "$PERCH_MEASURE" ]] && PERCH_MEASURE=1 exec /bin/bash "$HOME/measure/driver.sh"' \
    > "$dir/home/.zshrc"
  cat > "$dir/home/measure/driver.sh" <<DRIVER
#!/bin/bash
# What a measured shell shows: a static colour screen, then it waits for its busy flag and then
# redraws a full-screen 256-colour frame about every 50 ms for BUSY_SECONDS.
FLAGS="\$HOME/measure/flags"
n=1
until mkdir "\$FLAGS/ticket-\$n" 2>/dev/null; do n=\$((n+1)); done
printf '\033[2J\033[H\033[1mperch measure shell %s\033[0m\n' "\$n"
for c in \$(seq 0 255); do printf '\033[48;5;%sm  ' "\$c"; [ \$(( (c+1) % 32 )) = 0 ] && printf '\033[0m\n'; done
printf '\033[0m\n'
for i in \$(seq 0 63); do printf '\033[48;2;%s;%s;%sm ' \$((i*4)) \$((255-i*4)) 128; done; printf '\033[0m\n'
printf '\033[1mbold\033[0m \033[3mitalic\033[0m \033[4munderline\033[0m \033[9mstrike\033[0m \033[7minverse\033[0m\n'
printf '┌──────────┐ 日本語の文字 😀 ✓\n└──────────┘\n'
busy() {
  local end rows cols f=0
  end=\$((SECONDS + $BUSY_SECONDS))
  read -r rows cols < <(stty size)
  printf '\033[?1049h\033[?25l'
  while [ \$SECONDS -lt \$end ]; do
    awk -v f=\$f -v rows="\$rows" -v cols="\$cols" 'BEGIN {
      printf "\033[H"
      for (r = 1; r <= rows; r++) {
        for (c = 1; c <= cols; c += 2) printf "\033[48;5;%dm  ", (r * 7 + c * 3 + f * 5) % 256
        printf "\033[0m"; if (r < rows) printf "\r\n"
      }
    }'
    f=\$((f+1)); sleep 0.05
  done
  printf '\033[?1049l\033[?25h\033[0m'
}
touch "\$FLAGS/started-\$n"
while :; do
  if [ -f "\$FLAGS/busy-\$n" ]; then rm -f "\$FLAGS/busy-\$n"; busy; fi
  sleep 0.2
done
DRIVER
}

start_core() { # dir -> a headless core on a free port, waits for its published address
  local dir=$1
  local envs; envs=$(run_env "$dir")
  # shellcheck disable=SC2086
  env -i $envs PERCH_PORT="$(free_port)" "$CORE" --headless > "$dir/logs/core.log" 2>&1 &
  CORE_PID=$!
  track "core-$(basename "$dir")" "$CORE_PID"
  wait_for "the core's address" 30 test -s "$dir/daemon/core.json" || return 1
  wait_for "the core to answer" 10 python3 -I -c "
import json,socket,sys
a=json.load(open('$dir/daemon/core.json'))
socket.create_connection(('127.0.0.1',a['port']),1).close()" || return 1
}

stop_core() { stop_pid "$1" || die "core $1 would not stop"; }

make_sessions() { # dir count -> session ids in creation order, one second apart so shells take
  local dir=$1 count=$2 i out # their driver tickets in the same order
  : > "$dir/sessions"
  for i in $(seq 1 "$count"); do
    out=$(env -i HOME="$dir/home" PERCHD_DIR="$dir/daemon" PATH="$PATH" "$SETUP" create 1) || return 1
    echo "$out" >> "$dir/sessions"
    wait_for "shell $i to start" 20 test -e "$dir/home/measure/flags/started-$i" || return 1
  done
}

session_id() { sed -n "${2}p" "$1/sessions"; }

record() { # app state mb... -> a results line
  echo "$*" | tr ' ' '\t' >> "$RESULTS"
}

sample_state() { # label dir app_pid helpers... -> median MB; prints samples to stderr
  local label=$1 pids=$2 i mb list=""
  sleep "$SETTLE"
  for i in $(seq 1 "$SAMPLES"); do
    mb=$(footprint_mb $pids) || return 1
    list="$list $mb"
    [ "$i" -lt "$SAMPLES" ] && sleep "$SAMPLE_GAP"
  done
  log "  $label samples:$list MB"
  # shellcheck disable=SC2086
  breakdown $pids
  # shellcheck disable=SC2086
  median $list
}

# ---- one app, one state ----------------------------------------------------------------------

busy_on() { touch "$1/home/measure/flags/busy-$2"; }

native_script() { # state dir -> the script for the native client
  local state=$1 dir=$2
  case "$state" in
    a) echo "" ;;
    b) echo "open $(session_id "$dir" 1)" ;;
    c) echo "open $(session_id "$dir" 1); split right; split down; split right" ;;
    d) echo "open $(session_id "$dir" 2)" ;;
  esac
}

run_native() { # state dir hidden(0|1) -> median MB
  local state=$1 dir=$2 hidden=$3
  local envs script log_file pid before after
  envs=$(run_env "$dir"); script=$(native_script "$state" "$dir")
  log_file=$dir/logs/native-$state-hidden$hidden.log
  before=$(front_name)
  # shellcheck disable=SC2086
  env -i $envs PERCH_NATIVE_TEST=1 PERCH_NATIVE_SIZE="$WINDOW" PERCH_NATIVE_HIDDEN="$hidden" \
    PERCH_NATIVE_SCRIPT="$script" "$NATIVE" > "$log_file" 2>&1 &
  pid=$!
  track "native-$state" "$pid"
  wait_for "the script to finish" 120 grep -q "script done" "$log_file" || { cat "$log_file" >&2; return 1; }
  after=$(front_name)
  echo "$(date +%T) native $state hidden=$hidden launch: before=[$before] after=[$after]" >> "$FRONT_LOG"
  [ -e "$SCRATCH/front-stolen" ] && die "the native client took the frontmost app"
  [ "$state" = d ] && busy_on "$dir" 2
  local mb
  mb=$(sample_state "native $state hidden=$hidden" "$pid") || return 1
  [ "$hidden" = 0 ] && { echo "native $state windows:" >&2; window_report "$pid" >&2; }
  stop_pid "$pid" || die "native client $pid would not stop"
  echo "$mb"
}

run_tauri() { # dir -> median MB of the idle desktop app (host process plus its WebKit helpers)
  local dir=$1 envs log_file pid before after known h helpers="" mb i
  envs=$(run_env "$dir"); log_file=$dir/logs/tauri-a.log
  known=$(webkit_pids | tr '\n' ' ')
  before=$(front_name)
  # shellcheck disable=SC2086
  env -i $envs PERCH_DESKTOP_TEST=1 "$DESKTOP" > "$log_file" 2>&1 &
  pid=$!
  track "tauri-a" "$pid"
  wait_for "the app's core" 60 grep -q "core ready" "$log_file" || { tail -5 "$log_file" >&2; return 1; }
  # the page connects and starts its blank session; the window itself stays hidden
  wait_for "the page to connect" 60 sqlite3 "$dir/data/history.sqlite" "select 1 from sessions limit 1" > /dev/null 2>&1
  after=$(front_name)
  echo "$(date +%T) tauri launch: before=[$before] after=[$after]" >> "$FRONT_LOG"
  [ -e "$SCRATCH/front-stolen" ] && die "the desktop app took the frontmost app"
  # WebKit services that were not running before the launch (launchd children, not the app's)
  sleep 3
  for h in $(webkit_pids); do case " $known " in *" $h "*) ;; *) helpers="$helpers $h" ;; esac; done
  for h in $helpers; do track "tauri-helper-a" "$h"; done
  echo "  tauri helpers:$(for h in $helpers; do printf ' %s=%s' "$h" "$(ps -o command= -p "$h" | sed 's|.*/||')"; done)" >&2
  mb=$(sample_state "tauri a" "$pid $helpers") || return 1
  echo "  tauri host process alone: $(footprint_mb "$pid") MB; helpers alone: $(footprint_mb $helpers) MB" >&2
  stop_pid "$pid" || die "desktop app $pid would not stop"
  for i in $(seq 1 100); do
    local left=""; for h in $helpers; do alive "$h" && left="$left $h"; done
    [ -z "$left" ] && break; sleep 0.1
  done
  echo "$mb"
}

# The same web page in Playwright's headless WebKit (no window), driven with page-level key events
# only, against a headless core. WebKit is what Tauri's webview runs, so its WebContent/GPU/
# Networking footprint shows what the page costs in each state where the real app's hidden window
# cannot be driven without an input event.
write_webkit_driver() {
  cat > "$SCRATCH/webkit-driver.mjs" <<'JS'
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const [dir, state, flagDir] = process.argv.slice(2);
const require = createRequire(path.join(process.env.PW_DIR, "x.js"));
let pw;
for (const name of ["playwright-core", "@playwright/test"]) { try { pw = require(name); break; } catch {} }
if (!pw) { console.error("no playwright-core in " + process.env.PW_DIR); process.exit(3); }
const core = JSON.parse(fs.readFileSync(path.join(dir, "daemon/core.json"), "utf8"));
const browser = await pw.webkit.launch({ headless: true, ...(process.env.WEBKIT_RUN ? { executablePath: process.env.WEBKIT_RUN } : {}) });
const context = await browser.newContext({ viewport: { width: Number(process.env.VW), height: Number(process.env.VH) }, deviceScaleFactor: 2 });
// xtermSetup.ts draws with the DOM renderer under automation; the app draws with WebGL.
await context.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
await context.addCookies([{ name: "perch_local", value: core.localToken, domain: "127.0.0.1", path: "/" }]);
const page = await context.newPage();
page.on("pageerror", (e) => console.error("pageerror", String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${core.port}/`);
await page.waitForFunction(() => window.usePerchStore && window.usePerchStore.getState().serverInfo, null, { timeout: 30000 });
await page.waitForSelector(".sidebar", { timeout: 30000 });
const tiles = () => page.locator(".terminal__surface").count();
const want = { a: 0, b: 1, c: 4, d: 1 }[state];
let guard = 0;
while ((await tiles()) < want && guard++ < 12) {
  const before = await tiles();
  await page.keyboard.press("Control+Space");
  await page.keyboard.press("v");
  const t = Date.now();
  while ((await tiles()) <= before && Date.now() - t < 20000) await page.waitForTimeout(100);
}
if ((await tiles()) !== want) { console.error(`wanted ${want} terminals, have ${await tiles()}`); process.exit(4); }
await page.waitForTimeout(1500);
const probe = await page.evaluate(() => ({
  visibility: document.visibilityState, dpr: devicePixelRatio, inner: [innerWidth, innerHeight],
  terminals: document.querySelectorAll(".terminal__surface").length,
  canvases: [...document.querySelectorAll("canvas")].map((c) => `${c.width}x${c.height}`),
}));
console.log("PROBE " + JSON.stringify(probe));
console.log("READY");
while (!fs.existsSync(path.join(flagDir, "stop"))) await new Promise((r) => setTimeout(r, 200));
await browser.close();
JS
}

run_webkit() { # state dir -> median MB of the WebKit helper processes
  local state=$1 dir=$2 log_file known h helpers="" mb pid newest
  log_file=$dir/logs/webkit-$state.log
  rm -f "$dir/stop"
  known=$(webkit_pids | tr '\n' ' ')
  # shellcheck disable=SC2086
  env PW_DIR="${PW_DIR:-$ROOT/e2e}" WEBKIT_RUN="${WEBKIT_RUN:-}" VW="${WINDOW%x*}" VH="${WINDOW#*x}" \
    node "$SCRATCH/webkit-driver.mjs" "$dir" "$state" "$dir" > "$log_file" 2>&1 &
  pid=$!
  track "webkit-$state" "$pid"
  wait_for "the page" 120 grep -q "^READY" "$log_file" || { cat "$log_file" >&2; touch "$dir/stop"; return 1; }
  grep "^PROBE" "$log_file" >&2
  if [ "$state" = d ]; then
    newest=$(ls "$dir"/home/measure/flags | sed -n 's/^started-//p' | sort -n | tail -1)
    busy_on "$dir" "$newest"
  fi
  for h in $(webkit_pids); do
    case " $known " in *" $h "*) continue ;; esac
    ps -o command= -p "$h" | grep -Eq "WebKit\.(WebContent|GPU|Networking)" && helpers="$helpers $h"
  done
  echo "  webkit helpers:$(for h in $helpers; do printf ' %s=%s' "$h" "$(ps -o command= -p "$h" | sed 's|.*/||')"; done)" >&2
  mb=$(sample_state "webkit $state" "$helpers") || { touch "$dir/stop"; return 1; }
  touch "$dir/stop"
  wait_for "the driver to exit" 30 gone "$pid"
  stop_pid "$pid"
  echo "$mb"
}

# ---- run -------------------------------------------------------------------------------------

echo "$(date) machine: $(sysctl -n hw.model) $(sysctl -n machdep.cpu.brand_string), $(( $(sysctl -n hw.memsize) / 1073741824 )) GB, $(sw_vers -productName) $(sw_vers -productVersion)" >&2
log "display: $(system_profiler SPDisplaysDataType 2> /dev/null | sed -n 's/^ *Resolution: *//p' | head -1)"
log "console locked: $(ioreg -n Root -d1 | sed -n 's/.*IOConsoleLocked" = //p' | head -1)"
log "frontmost at start: $(front_name)"
log "scratch: $SCRATCH"
log "binary sizes (bytes): $(stat -f '%z %N' "$NATIVE" "$DESKTOP" "$CORE" | sed "s|$BIN/||" | tr '\n' ';')"

state_name() { case "$1" in a) echo "idle" ;; b) echo "one terminal" ;; c) echo "four splits" ;; d) echo "busy TUI" ;; esac; }
order_states() { local s; for s in a b d c; do has "$s" "$STATES" && printf '%s ' "$s"; done; } # c last: it makes sessions

if has native "$APPS"; then
  log "== native client (headless core + daemon)"
  D=$SCRATCH/native; new_app_dir native
  start_core "$D" || die "native core did not start"
  CORE_NATIVE=$CORE_PID
  make_sessions "$D" 2 || die "could not make sessions"
  for s in $(order_states); do
    for hidden in 1 0; do
      log "- native state $s hidden=$hidden"
      mb=$(run_native "$s" "$D" "$hidden") || die "native state $s failed"
      record native-hidden$hidden "$s" "$mb"
    done
  done
  log "- core and daemon footprint (native run, sessions idle)"
  DPID=$(cat "$D/daemon/daemon-v1.pid")
  core_mb=$(footprint_mb "$CORE_NATIVE") && daemon_mb=$(footprint_mb "$DPID") || die "core footprint"
  record core x "$core_mb"; record daemon x "$daemon_mb"
  stop_core "$CORE_NATIVE"
fi

if has tauri "$APPS"; then
  log "== desktop (Tauri) app, with its own embedded core, window hidden"
  D=$SCRATCH/tauri; new_app_dir tauri
  log "- tauri state a"
  mb=$(run_tauri "$D") || die "tauri state a failed"
  record tauri-hidden a "$mb"

  log "== the web page in headless WebKit (no window), against a headless core"
  D=$SCRATCH/webkit; new_app_dir webkit
  write_webkit_driver
  start_core "$D" || die "webkit core did not start"
  CORE_WEBKIT=$CORE_PID
  for s in $(order_states); do
    log "- webkit state $s"
    mb=$(run_webkit "$s" "$D") || die "webkit state $s failed"
    record webkit "$s" "$mb"
  done
  record core-webkit x "$(footprint_mb "$CORE_WEBKIT")"
  stop_core "$CORE_WEBKIT"
fi

# ---- table -----------------------------------------------------------------------------------

python3 -I - "$RESULTS" <<'PY'
import sys
rows = {}
for line in open(sys.argv[1]):
    app, state, mb = line.split()
    rows[(app, state)] = float(mb)
names = {"a": "idle, nothing shown", "b": "one terminal", "c": "four splits", "d": "one busy TUI"}
get = lambda app, s: rows.get((app, s))
core = rows.get(("core", "x"))
tauri_idle = get("tauri-hidden", "a")
webkit_idle = get("webkit", "a")
dash = lambda: f"{'-':>13}"
fmt = lambda v: f"{v:13.1f}" if v is not None else dash()
heads = ["Tauri app", "WebKit page", "Tauri est.", "native hid.", "native shown", "native+core", "est.-nat+core"]
print()
print("Physical footprint, MB, median of the samples")
print(f"{'state':22}" + "".join(f"{h:>13}" for h in heads))
for s in "abcd":
    tauri = get("tauri-hidden", s)
    webkit = get("webkit", s)
    est = None
    if tauri_idle is not None and webkit is not None and webkit_idle is not None:
        est = tauri_idle + (webkit - webkit_idle)
    nh, ns = get("native-hidden1", s), get("native-hidden0", s)
    nc = ns + core if ns is not None and core is not None else None
    diff = est - nc if est is not None and nc is not None else None
    if all(v is None for v in (tauri, webkit, nh, ns)):
        continue
    print(f"{names[s]:22}" + "".join(fmt(v) for v in (tauri, webkit, est, nh, ns, nc, diff)))
print()
print("Tauri app: the real perch-desktop (hidden test window) plus its WebKit helpers, its core inside; only the")
print("idle state can be reached without an input event. WebKit page: the same page in headless WebKit (WebContent,")
print("GPU, Networking). Tauri est. = Tauri app idle + (WebKit page - WebKit page idle). native: perch-native alone;")
print("native+core adds the headless core it needs. est.-nat+core is Tauri est. minus native shown plus core.")
if core is not None:
    print(f"Headless core {core:.1f} MB and daemon {rows.get(('daemon', 'x'), 0.0):.1f} MB (native run, two idle sessions).")
PY
echo
echo "frontmost app log:"; sed 's/^/  /' "$FRONT_LOG"
if [ -e "$SCRATCH/front-stolen" ]; then die "a tracked app took the frontmost app"; fi
