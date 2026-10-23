# Testing and development

## Normal checks

```sh
cargo test -p perch-core                 # add a substring for focused tests
cargo test -p perchd
npm ci && npm run build                  # shared + web; axum serves web/dist
npm test                                # Vitest
cargo fmt --check
cargo clippy --workspace --all-targets   # add no warnings
cargo run -p perch-core -- --port 7788
cargo run -p perch-desktop
```

These are the existing npm scripts/CI commands, not a decision to delete the
pnpm lockfile. Both lockfiles exist; package-manager consolidation remains open.
Do not maintain volatile test counts or an exact clippy-warning count here.

Run checks relevant to the changed behavior, with one focused regression for
nontrivial logic. A docs-only edit needs link/consistency and diff checks, not
paid turns. A build or empty diagnostic cache does not prove runtime correctness.

## Headless e2e

```sh
npm run build
cd e2e
npx playwright test <spec> [-g name]
npx playwright test -c worktree-lifecycle.config.ts
PERCH_E2E_WEBKIT=1 npx playwright test --project=webkit <spec>
```

- Headless only: no `--headed` or focused windows.
- Main config boots isolated cores on :7799/:7800; worktree lifecycle uses
  :7796. Other focused configs specify their own ports. Check the config before
  reusing a server: never point tests at the installed user's app.
- Specs may make **real paid agent turns**. Use only `claude-haiku-4-5` or
  `gpt-5.6-luna`; use aliases, not dated snapshot IDs. Set
  `ANTHROPIC_MODEL=claude-haiku-4-5` for probe cores and verify the actual
  CLI banner before the first prompt.
- Add new specs to the intended config's `testMatch`. Main config enumerates
  specs; a new filename alone is not enough.
- Runs start with clean test state; create your own project/chat via
  `e2e/projects.ts`. `e2e/artifacts/` is wiped each run: retain release
  evidence elsewhere.
- Prefer deterministic CLI fixtures for faults/performance. Rerun a failed
  real-turn spec alone before calling it a regression; slow turns can overlap.

Useful existing coverage (not a claim of a fresh passing run):
- `mixed-tabs.spec.ts`: mixed order/splits, restoration, drafts, two viewers.
- `workspace-recovery.spec.ts` and `workspace-files-durable.spec.ts`:
  core restart, draft/conflict recovery.
- `workspace-file-browser.spec.ts`: CodeMirror, media, read-only and extraction.
- `agent-terminal-ownership.spec.ts`, `terminal-width.spec.ts`: authority/size.
- `needs-you.spec.ts`: question persistence/resolution and navigation.
- `context-bridge.config.ts`: isolated Chromium/WebKit real Claude probe.
- `cd e2e && npx playwright test -c remote-workspace.config.ts`: isolated
  headless metadata/files/drafts/surfaces/reconnect plus `remote-git.spec.ts`
  Git/review/worktree checks, with no paid turns. Ports :7794/:7795 and all
  state live under `/tmp/perch-e2e-remote-workspace`; no existing server reuse.
  Loopback federation is **not** actual Linux-host D3 acceptance. The bounded
  [real Linux resource probe](evidence/remote-workspace-2026-10-23.md) is
  additional evidence, not runtime/D3 certification.

## Isolated manual probes

Point **all four** at scratch paths: `PERCH_DB`, `PERCH_HOSTS`,
`PERCHD_DIR`, `PERCH_SETTINGS`. Default settings and the default daemon
belong to the installed app. Leaked test PTYs can exhaust its file descriptors.
For a desktop probe, `PERCH_DESKTOP_TEST=1` creates a hidden, unfocused window.

Restore settings even on failure. Stop the probe core, its
`__perchd serve --dir <scratch>` daemon and its children afterwards. Scope
cleanup to your own paths/processes; do not use broad kill commands. Remote
probes need an explicitly authorized host and confirmed cleanup, never a
placeholder hostname or a private host discovered on this machine.

Claude normally bypasses permissions here: use `AskUserQuestion` to exercise
Needs You. Bracketed paste wraps the prompt in `<pasted_content …>`; hook
assertions match with `contains`, not equality.

## Rendering, performance and packaging

- `node e2e/memory/memory.mjs` after a web build checks footprint and WebGL
  context replacement/release and terminal disposal.
- `node e2e/visual/visual.mjs` checks Chromium/WebKit visual equivalence for
  style-only refactors. Intentional design changes need reviewed expectations,
  not an assertion of unchanged pixels.
- Production uses WebGL; WebDriver uses DOM for `.xterm-rows` assertions.
  Hidden-window measurements are not actual interactive presentation timing.
- Web builds update open clients through the service worker; allow about a
  minute. A core/desktop rebuild is needed for Rust changes.
- Desktop installers: `npm run build`, then
  `(cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build)`.
  `scripts/reinstall-desktop.sh` installs/reopens the user's macOS app:
  use only when that is intended, not as a test-isolation shortcut.
- Release workflow builds draft macOS/Linux packages and Linux daemon binaries.
  Build support is not packaged-install evidence. macOS is ad-hoc signed, not
  notarized. Do not publish/tag/push without instruction.

## Known limitations to recheck

Recorded 2026-10-02, not blanket exemptions for new failures:
- OpenCode is deliberately absent on this dev Mac; do not install it for tests.
- `paired-phone-flows` intermittently reports unconfirmed review delivery.
- `ssh::tests::mux_control_path_…` can fail in the full run and pass alone.

Alpha evidence must name candidate commit, platform/provider versions, command,
result, retained report and remaining limits; see [PUBLIC-ALPHA](PUBLIC-ALPHA.md).
