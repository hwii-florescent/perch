# Machine-add-port closure

Status: implementation follow-up completed, reviewed and verified locally. The owner requested merging to main, deleting the active plan/worktree and closing this work. This is not certification of a published release or a real cross-OS remote.

## Delivered scope

The existing route-A commits already implement machine probe/install, SSH host suggestions, login, installed-core startup and CI core packaging. This follow-up adds the missing Intel macOS release target, isolates the real-SSH test's HOME/control socket and loopback port, and cleans up its control master, sshd and temporary directory on success or failure.

Parent review additionally fixed swallowed Cargo diagnostics/build failures and unchecked setup commands in the SSH script. A standalone assert-based regression (`scripts/check-machine-ssh-failure.py`) supplies an executable artifact followed by a failed build and proves that the build error remains visible, the artifact does not turn failure into success, and no fixture process/directory remains.

The active `plans/261108-2145-machine-add-port/plan.md` is retired by owner request. Accepted decisions remain in docs/DECISIONS.md: existing SSH tunnel and tmux, no `--via`/framed transport rewrite, and one-shot exec through SSH rather than through the remote core. No protocol or domain changes were added by this follow-up.

## Independently rerun checks

Base: `1bdc408bc0b2fa40c7641342d6e1afa85862dca5`, plus the reviewed machine patch. These results were rerun by the integrating parent in the isolated machine worktree on 2026-11-09, without temporary compile patches:

- `cargo build -p perch-core`: passed.
- `cargo test -p perch-core machine::`: five machine unit tests passed.
- `cargo test -p perch-core --test machine_install`: one passed; real-SSH case intentionally ignored here and exercised separately below.
- `cargo test -p perch-core --test protocol_parity`: two passed.
- `cargo fmt --check`: passed.
- `npm run test -w @perch/web -- src/components/MachineCheck.test.tsx`: three passed.
- `npm run build`: shared/web TypeScript and production build passed. npm emitted its existing `always-auth` configuration warning.
- `sh -n scripts/machine-over-real-ssh.sh`: passed.
- `sh scripts/machine-over-real-ssh.sh`: real OpenSSH loopback probe/upload test passed with temporary keys/HOMEs and cleanup; no private remote, installed daemon or real SSH configuration was used.
- `python3 scripts/check-machine-ssh-failure.py`: passed build-failure/cleanup regression; subsequent real-SSH success check passed again.
- Ruby stdlib YAML parse and target-matrix assertions: passed for Linux x86_64/aarch64 and macOS x86_64/aarch64. This does not run the workflow.
- Active LSP checks of the changed shell/Python files: two clean, no unsupported/inconclusive outcomes.
- `git diff --check`: passed before integration.

`cargo clippy -p perch-core --all-targets` completed with three existing warnings in unchanged Rust source: two type-complexity findings at server/mod.rs:283,285 and one cloned-reference finding at db/mod.rs:1386. The stricter `-- -D warnings` run failed on those same baseline warnings. No Rust source changed in this follow-up; they were not suppressed or repaired out of scope.

## Remaining release evidence limits

- The release CI job, including Intel macOS cross-compilation/architecture validation, has not been run. Local YAML/matrix validation is not CI success.
- Published checksummed core assets and installation from an actual release were not verified.
- No real or cross-OS remote host or interactive password login was exercised. Real loopback SSH and stand-in download tests do not prove those cases.
- Full e2e/full workspace suites and actionlint were not run; actionlint was absent. The focused checks above are the actual evidence.

No push, tag, release trigger or production-data migration is included. Unrelated main-checkout work and the separate stock-UI worktree must remain untouched. Unique machine-worktree backup files are retained under main `plans/reports/retained-261109-machine-add-backup/` before removal of that worktree.
