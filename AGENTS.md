# AGENTS.md

## What we are building

Perch is a lightweight, terminal-led project workspace: real shells and agents
beside files, changes and previews, with reliable local/remote continuity.
Terminal by default; a native UI mode is built on provider sessions. Learn from Orca, do not chase parity.
Keep the UI quiet and useful without an agent or Git.

- [Remaining work](docs/ROADMAP.md): current gaps and priorities.
- [Architecture](docs/ARCHITECTURE.md): ownership and safety contracts.
- [Testing](docs/TESTING.md): commands, isolated probes and known limitations.
- [Decisions](docs/DECISIONS.md): approved UX; older proposals are not approval.
- [Alpha contract](docs/PUBLIC-ALPHA.md): release gates, not a missing-feature list.
- [Native client](docs/NATIVE.md): GPUI client contracts; working in `crates/perch-native` means
  reading `crates/perch-native/AGENTS.md` first (script budgets, stock screens, tests).

## Architecture and constraints

- Rust owns domain logic/data: `crates/perch-core` (axum HTTP/WS + SQLite).
  `packages/web` is a thin React view; `crates/perch-desktop` embeds the same
  core in Tauri. Detached `crates/perchd` owns PTYs across app/core restarts.
  `crates/perch-native` is a GPUI client of the same core that runs the web's stock screens.
- Read the affected module's `//!` header and trace callers before changing it.
  Reuse existing services/components; keep domain logic out of React.
- Keep `crates/perch-core/src/protocol.rs` and
  `packages/shared/src/protocol.ts` field-for-field compatible. New fields
  default/optional; new message families capability-gated for older peers.
- Unknown runtime state is not exit. Never relaunch, destroy bookkeeping or
  fall back to local execution on uncertainty. Watcher close only detaches;
  owned stop must be confirmed before destructive cleanup.
- Use `createPerchTerminal` in `xtermSetup.ts`; preserve native input,
  `convertEol: false`, server terminal profile and resize authority.
  Context Bridge uses explicit send, never arbitrary PTY paste
  ([contract](docs/CONTEXT-BRIDGE.md)).
- UI changes follow [approved decisions](docs/DECISIONS.md) and reuse
  `components/ui/`. Preserve drafts and legacy layouts during migrations.

## Check your work

```sh
cargo test -p perch-core
cargo test -p perchd
npm ci && npm run build
npm test
cargo fmt --check
cargo clippy --workspace --all-targets  # no new warnings
cd e2e && npx playwright test <spec>   # may run real paid agent turns
```

Run relevant checks, not every suite for every edit. Nontrivial logic needs a
focused runnable regression. See [TESTING](docs/TESTING.md) before live probes:
headless or windowed; isolate `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR` and
`PERCH_SETTINGS`; never use the installed app's daemon. Clean up your processes.
Ask the owner before anything takes focus on their computer (activating a
window, posting keys, a foreground app).
Real agent turns use only `claude-haiku-4-5` or `gpt-5.6-luna`; verify the
banner before prompting. Do not install absent OpenCode to satisfy tests.

## Working as an agent

- Sub-sessions start with `perch spawn`, not a harness's own sub-agent tool. Pick the model by the
  work: Haiku for scouting and read-only search, Sonnet for contained fixes, small UI changes and
  mechanical work, Opus for audits, planning, open designs and bugs whose cause spans modules.
  The owner caps running sub-sessions at 8 (Settings > Sub-sessions).
- After the lead has reviewed changes (commits read, checks green), rebuild and relaunch the installed
  `/Applications/perch.app` without asking ([NATIVE](docs/NATIVE.md#the-installed-app)), and say so in
  the report. Do not reinstall the Tauri app unless asked. Never push unless asked.
