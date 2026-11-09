#!/bin/sh
# Runs the opt-in `machine_install` test over real OpenSSH: a throwaway user-mode sshd on a free
# 127.0.0.1 port (key login only) whose sessions run with a temp $HOME. The test process runs with a
# temp $HOME too, so its ssh control socket (~/.ssh/perch-cm) never lands in your real ~/.ssh.
# Stops the sshd and the ssh control master it created when done.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
# Short path: the control socket must fit macOS's ~104-byte sun_path.
D=$(mktemp -d /tmp/pm.XXXXXX)
# Whatever happens (failure, ctrl-C), stop what we started: the ssh control master the test left (asked
# politely over its own socket), then our sshd, then the temp dir.
cleanup() {
  set +e
  [ -f "$D/ssh_config" ] && ssh -F "$D/ssh_config" -o "ControlPath=$D/localhome/.ssh/perch-cm/%C" -O exit box >/dev/null 2>&1
  [ -f "$D/sshd.pid" ] && kill "$(cat "$D/sshd.pid")" 2>/dev/null
  rm -rf "$D"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
mkdir -p "$D/home" "$D/localhome"
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])') || exit 1
cd "$D" || exit 1
ssh-keygen -q -t ed25519 -N '' -f hostkey
ssh-keygen -q -t ed25519 -N '' -f userkey
cp userkey.pub authorized_keys
cat > sshd_config <<CFG
Port $PORT
ListenAddress 127.0.0.1
HostKey $D/hostkey
PidFile $D/sshd.pid
AuthorizedKeysFile $D/authorized_keys
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM no
StrictModes no
ForceCommand env HOME=$D/home /bin/sh -c "\$SSH_ORIGINAL_COMMAND"
CFG
cat > ssh_config <<CFG
Host box
  HostName 127.0.0.1
  Port $PORT
  IdentityFile $D/userkey
  IdentitiesOnly yes
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
CFG
printf '#!/bin/sh\nexec ssh -F %s/ssh_config "$@"\n' "$D" > ssh-wrapper
chmod 755 ssh-wrapper
/usr/sbin/sshd -f sshd_config -E "$D/sshd.log" || { cat "$D/sshd.log" >&2; exit 1; }
sleep 1
# Build first with the real HOME (cargo/rustup need it), then run the test binary with the temp one.
(cd "$ROOT" && cargo test -p perch-core --test machine_install --no-run --message-format=json > "$D/build.json") || exit 1
BIN=$(python3 -c 'import sys,json
for l in sys.stdin:
    try: m=json.loads(l)
    except ValueError: continue
    if m.get("executable") and m.get("target",{}).get("name")=="machine_install": print(m["executable"])' < "$D/build.json" | tail -1)
[ -x "$BIN" ] || { echo "could not build machine_install" >&2; exit 1; }
HOME="$D/localhome" PERCH_MACHINE_SSH="$D/ssh-wrapper" PERCH_MACHINE_HOME="$D/home" "$BIN" --ignored
