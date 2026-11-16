#!/usr/bin/env bash
# Perf audit harness: isolated headless core, N plain shells, the native client in test mode
# (window ordered in, never key, app never activated) with PERCH_NATIVE_PERF=1.
#   audit.sh setup            -> core + sessions, prints SCR
#   audit.sh native <hidden> <scriptfile> <logname>  -> launches the client, prints pid
#   audit.sh stream <n> on|off
#   audit.sh teardown
set -u -o pipefail
WT=${WT:-$(cd "$(dirname "$0")/../.." && pwd)}
BIN=$WT/target/release
CORE=$BIN/perch-core; NATIVE=${NATIVE_BIN:-$BIN/perch-native}; SETUP=$BIN/examples/measure_setup
SCR=${SCR:-${TMPDIR:-/tmp/}perf-audit-run}
SESSIONS=${SESSIONS:-44}
log() { printf '%s\n' "$*" >&2; }
free_port() { python3 -I -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])'; }
wait_for() { local what=$1 limit=$2 i; shift 2; for i in $(seq 1 $((limit*10))); do "$@" && return 0; sleep 0.1; done; log "timed out: $what"; return 1; }
run_env() {
  echo "HOME=$SCR/home USER=$(id -un) LOGNAME=$(id -un) SHELL=/bin/zsh LANG=en_US.UTF-8 TMPDIR=${TMPDIR:-/tmp/}" \
    "PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin" \
    "PERCH_DB=$SCR/data/history.sqlite PERCH_HOSTS=$SCR/data/hosts.json PERCH_DEVICES=$SCR/data/devices.json" \
    "PERCHD_DIR=$SCR/daemon PERCH_SETTINGS=$SCR/data/settings.json PERCH_CLEANUP_OWNER=audit:$SCR" \
    "PERCHD_IDLE_EXIT_SECS=1 PERCH_SKIP_RELAY=1"
}

case "${1:-}" in
setup)
  rm -rf "$SCR"; mkdir -p "$SCR/home/measure/flags" "$SCR/data" "$SCR/daemon" "$SCR/logs" "$SCR/work"
  echo '[[ -t 0 && -z "$PERCH_MEASURE" ]] && PERCH_MEASURE=1 exec /bin/bash "$HOME/measure/driver.sh"' > "$SCR/home/.zshrc"
  cat > "$SCR/home/measure/driver.sh" <<'DRIVER'
#!/bin/bash
# Shell n: a short colour header; shell 1 also prints 20,000 lines of scrollback. While
# flags/stream-n exists it prints agent-like lines, 20 a second.
FLAGS="$HOME/measure/flags"
n=1
until mkdir "$FLAGS/ticket-$n" 2>/dev/null; do n=$((n+1)); done
printf '\033[1mperf shell %s\033[0m\n' "$n"
for c in $(seq 0 63); do printf '\033[48;5;%sm  ' "$c"; done; printf '\033[0m\n'
if [ "$n" = 1 ]; then
  awk 'BEGIN{for(i=0;i<20000;i++) printf "\033[3%dmline %06d\033[0m the quick brown fox jumps over the lazy dog %d\n", i%7+1, i, i*7}'
fi
touch "$FLAGS/started-$n"
i=0
while :; do
  if [ -e "$FLAGS/stream-$n" ]; then
    i=$((i+1))
    printf '\033[36m⏺\033[0m Reading \033[1msrc/file_%d.rs\033[0m (%d lines) … \033[2mthinking about the change %d\033[0m\n' $((i%97)) $((i*13%400)) "$i"
    sleep 0.05
  else
    sleep 0.5
  fi
done
DRIVER
  mkdir -p "$SCR/work/code"
  python3 -I - "$SCR/work/code" <<'PY'
import sys, pathlib
w = pathlib.Path(sys.argv[1])
line = 'fn item_{0}(x: u64) -> u64 {{ let s = "text {0}"; x.wrapping_mul({0}) + s.len() as u64 }} // {0}\n'
(w / "big.rs").write_text("".join(line.format(i) for i in range(10000)))
(w / "small.rs").write_text("".join(line.format(i) for i in range(200)))
PY
  (cd "$SCR/work/code" && git init -q && git add -A && git -c user.name=a -c user.email=a@localhost commit -qm f)
  envs=$(run_env)
  # shellcheck disable=SC2086
  env -i $envs ${CORE_ENV:-} PERCH_PORT="$(free_port)" "$CORE" --headless > "$SCR/logs/core.log" 2>&1 &
  echo $! > "$SCR/core.pid"
  wait_for "core" 30 test -s "$SCR/daemon/core.json" || exit 1
  sleep 1
  WS=$(env -i HOME="$SCR/home" PERCHD_DIR="$SCR/daemon" PATH="$PATH" "$SETUP" workspace "$SCR/work/code") || exit 1
  echo "$WS" > "$SCR/workspace"
  wait_for "shell 1" 30 test -e "$SCR/home/measure/flags/started-1" || exit 1
  : > "$SCR/sessions"
  for i in $(seq 2 "$SESSIONS"); do
    env -i HOME="$SCR/home" PERCHD_DIR="$SCR/daemon" PATH="$PATH" "$SETUP" create 1 >> "$SCR/sessions" || exit 1
    wait_for "shell $i" 20 test -e "$SCR/home/measure/flags/started-$i" || exit 1
  done
  log "setup done: workspace $WS, $(wc -l < "$SCR/sessions") sessions + 1"
  echo "$SCR"
  ;;
native)
  hidden=$2 script=$3 name=$4
  envs=$(run_env)
  # shellcheck disable=SC2086
  env -i $envs PERCH_NATIVE_TEST=1 PERCH_NATIVE_PERF=1 PERCH_NATIVE_SIZE="${WINDOW:-1280x800}" PERCH_NATIVE_HIDDEN="$hidden" \
    PERCH_NATIVE_SCRIPT_FILE="$script" ${EXTRA_ENV:-} "$NATIVE" > "$SCR/logs/$name.log" 2>&1 &
  echo $! | tee "$SCR/native-$name.pid"
  ;;
stream)
  if [ "$3" = on ]; then touch "$SCR/home/measure/flags/stream-$2"; else rm -f "$SCR/home/measure/flags/stream-$2"; fi
  ;;
teardown)
  for f in "$SCR"/native-*.pid; do [ -e "$f" ] && kill -TERM "$(cat "$f")" 2>/dev/null; done
  sleep 1
  [ -e "$SCR/core.pid" ] && kill -TERM "$(cat "$SCR/core.pid")" 2>/dev/null
  sleep 1
  if [ -f "$SCR/daemon/daemon-v1.pid" ]; then
    env -i HOME="$SCR/home" PATH="$PATH" "$CORE" __perchd release --owner "audit:$SCR" --reason teardown --dir "$SCR/daemon" --json > /dev/null 2>&1
    env -i HOME="$SCR/home" PATH="$PATH" "$CORE" __perchd cleanup --yes --dir "$SCR/daemon" --json > /dev/null 2>&1
    sleep 2
    dpid=$(cat "$SCR/daemon/daemon-v1.pid"); kill -0 "$dpid" 2>/dev/null && log "daemon $dpid still running"
  fi
  for plist in "$SCR"/daemon/*.plist; do [ -e "$plist" ] && launchctl bootout "gui/$(id -u)/$(basename "$plist" .plist)" 2>/dev/null; done
  ps -axo pid,command | grep "$SCR" | grep -v grep | head
  ;;
*) sed -n 2,8p "$0"; exit 2 ;;
esac
