#!/usr/bin/env python3
"""A failed Cargo build must stay visible, fail the SSH check, and clean up."""

import json
import os
import subprocess
import tempfile
from pathlib import Path

script = Path(__file__).with_name("machine-over-real-ssh.sh")
with tempfile.TemporaryDirectory(prefix="perch-machine-check-") as directory:
    fixture = Path(directory)
    recorded = fixture / "temp-path"
    cargo = fixture / "cargo"
    cargo.write_text(
        "#!/bin/sh\n"
        # Even an executable emitted before Cargo fails must never be run.
        f"printf '%s\\n' '{json.dumps({'target': {'name': 'machine_install'}, 'executable': '/usr/bin/true'})}'\n"
        "echo 'expected Cargo build failure' >&2\n"
        "exit 17\n"
    )
    mktemp = fixture / "mktemp"
    mktemp.write_text(
        "#!/bin/sh\n"
        'directory=$(/usr/bin/mktemp "$@") || exit 1\n'
        f"printf '%s\\n' \"$directory\" > '{recorded}'\n"
        'printf "%s\\n" "$directory"\n'
    )
    for executable in (cargo, mktemp):
        executable.chmod(0o755)
    result = subprocess.run(
        ["sh", str(script)],
        env={**os.environ, "PATH": f"{fixture}:{os.environ['PATH']}"},
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode != 0, "Cargo failure was swallowed"
    assert "expected Cargo build failure" in result.stderr, "build diagnostic was hidden"
    temporary = Path(recorded.read_text().strip())
    assert not temporary.exists(), "SSH fixture directory leaked"
    processes = subprocess.run(
        ["pgrep", "-f", str(temporary)], capture_output=True, text=True
    )
    assert processes.returncode == 1, "SSH fixture process leaked or process check failed"
print("PASS: build failure is visible, no stale executable runs, and SSH fixture is removed")
