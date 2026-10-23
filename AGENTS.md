# AGENTS.md

## What we are building

Perch is a lightweight, terminal-led project workspace: real shells and agents
beside files, changes and previews, with reliable local/remote continuity.
CLI first; Hosted/UI chat is frozen. Learn from Orca, do not chase parity.
Keep the UI quiet and useful without an agent or Git.

- [Remaining work](docs/ROADMAP.md): current gaps and priorities.
- [Architecture](docs/ARCHITECTURE.md): ownership and safety contracts.
- [Testing](docs/TESTING.md): commands, isolated probes and known limitations.
- [Decisions](docs/DECISIONS.md): approved UX; older proposals are not approval.
- [Alpha contract](docs/PUBLIC-ALPHA.md): release gates, not a missing-feature list.

## Architecture and constraints

- Rust owns domain logic/data: `crates/perch-core` (axum HTTP/WS + SQLite).
  `packages/web` is a thin React view; `crates/perch-desktop` embeds the same
  core in Tauri. Detached `crates/perchd` owns PTYs across app/core restarts.
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
headless only; isolate `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR` and
`PERCH_SETTINGS`; never use the installed app's daemon. Clean up your processes.
Real agent turns use only `claude-haiku-4-5` or `gpt-5.6-luna`; verify the
banner before prompting. Do not install absent OpenCode to satisfy tests.

## Repository hygiene

This repo is public. Keep private hosts, credentials and employer details out
of files/history; sample hostnames are not probe targets. Before pushing,
review `git diff origin/main..main` for leaks. Commit each verified slice
locally; push/tag/publish only when asked. Leave unrelated user changes alone.
