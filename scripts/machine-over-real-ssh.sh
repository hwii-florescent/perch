#!/bin/sh
# Runs the opt-in `machine_install` test over real OpenSSH: a throwaway user-mode sshd on
# 127.0.0.1:2299 (key login only) whose sessions run with a temp $HOME, so nothing of yours is touched.
# Stops the sshd and the ssh control master it created when done.
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd)
D=$(mktemp -d)
mkdir -p "$D/home"
cd "$D" || exit 1
ssh-keygen -q -t ed25519 -N '' -f hostkey
ssh-keygen -q -t ed25519 -N '' -f userkey
cp userkey.pub authorized_keys
cat > sshd_config <<CFG
Port 2299
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
  Port 2299
  IdentityFile $D/userkey
  IdentitiesOnly yes
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
CFG
printf '#!/bin/sh\nexec ssh -F %s/ssh_config "$@"\n' "$D" > ssh-wrapper
chmod 755 ssh-wrapper
/usr/sbin/sshd -f sshd_config -E "$D/sshd.log" || exit 1
sleep 1
(cd "$ROOT" && PERCH_MACHINE_SSH="$D/ssh-wrapper" PERCH_MACHINE_HOME="$D/home" \
  cargo test -p perch-core --test machine_install -- --ignored)
status=$?
# The test's ssh calls share a control master (~/.ssh/perch-cm/%C); close the one that reached our sshd.
for pid in $(lsof -nP -iTCP:2299 -sTCP:ESTABLISHED -a -c ssh -t 2>/dev/null); do kill "$pid" 2>/dev/null; done
kill "$(cat "$D/sshd.pid")" 2>/dev/null
rm -rf "$D"
exit $status
