# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What perch is

A personal agent-babysitting IDE: **Rust owns all logic and data** (agent runners, terminals, SQLite history, settings, host federation) behind a single axum HTTP+WS server; **TypeScript/React is a thin view** that connects over WebSocket. Two delivery modes, one core: the Tauri desktop app (`perch-desktop` boots the core in-process) and the plain web server (`perch-core` headless, used on devpods). `PLAN.md` is the authoritative phase-by-phase record — update it when a phase completes. `README.md` is stale (describes the retired Node server); `reference/node-server-spec/` is that old implementation kept as an executable spec, not shipped.

## Commands

```sh
# Rust core (builds everywhere, incl. headless devpods)
cargo build -p perch-core
cargo run -p perch-core -- --port 7788
#   flags: --port --headless --base-path --public-base-url --db-path --hosts-path
#   env fallbacks: PERCH_PORT, PERCH_BASE_PATH, PERCH_PUBLIC_BASE_URL, PERCH_DB, PERCH_HOSTS, PERCH_WEB_DIST

# Desktop shell (Mac only — needs webkit; NOT buildable on devpods)
cargo build -p perch-desktop
cargo run -p perch-desktop          # boots core on a free localhost port, opens window
PERCH_DESKTOP_TEST=1 ./target/debug/perch-desktop   # window hidden + unfocused (for automation)

# Web UI (output packages/web/dist is served by axum — rebuild after UI changes)
npm install && npm run build        # builds @perch/shared then @perch/web
npm run dev -w @perch/web           # Vite dev server for UI iteration

# Rust checks
cargo fmt --check && cargo clippy --workspace --all-targets

# e2e (Playwright, chromium, serial). Boots BOTH servers itself: :7799 (hub) and
# :7800 (isolated federated remote with /tmp db+hosts). Requires claude/codex CLI creds.
cd e2e && npm ci
npx playwright test                          # full suite
npx playwright test federation.spec.ts       # one spec
npx playwright test sidebar.spec.ts -g "4."  # one test
```

New e2e specs must be added to `testMatch` in `e2e/playwright.config.ts` or they won't run. Screenshots/traces land in `e2e/artifacts/` (wiped every run — put keepers elsewhere, e.g. `e2e/screenshots-federation/`, gitignored).

## Architecture

### Protocol parity (the #1 invariant)

The WS protocol is defined twice and must stay field-for-field identical: `crates/perch-core/src/protocol.rs` (serde, tagged by `type`, camelCase on the wire) ↔ `packages/shared/src/protocol.ts`. **Every protocol change touches both files.** `ServerMessage` also derives `Deserialize` because the hub parses remote perch replies as the same protocol (perch↔perch federation).

### perch-core modules

- `server.rs` — axum HTTP (serves `packages/web/dist`, base-path aware) + WS at `{base}/ws`. `AppState` holds registry, db, running-session set, two broadcast channels, model lists, settings/hosts stores, and the `HubManager`. `handle_message` is the single dispatch point for all client messages; hub routing branches sit at the top of session/terminal arms.
- `agent.rs` — headless runners: Claude via `claude -p --output-format stream-json` with `--session-id`/`--resume` continuity; Codex via fresh `codex exec --json` per turn. Read the doc comments before touching model handling.
- `terminal.rs` — portable-pty terminals. `terminal.create` with `agentAttach` spawns the *real interactive* CLI (`claude --resume <id> --model <alias>`) sharing the hosted conversation's context — this is CLI mode.
- `hub.rs` — federation. Per enabled host, a connection state machine: ssh health check → SSH tunnel (`ssh -A -L`, keeps a stable `~/.ssh/perch_auth_sock` symlink alive for remote auth) → auto-start remote perch via `tmux new-session -A -d -s perch-core` → WS client (`tokio-tungstenite`) through the tunnel. Routing: `remote_sessions`/`remote_terminals` maps pick the owning host; streaming replies go only to the initiating connection via `pending_unicast` (Session→Terminal key swap must happen under one lock); host state / session lists fan out to all connections via `hub_events_tx`. SSH is always the `ssh` CLI subprocess (corp-SSH-integrated) — never an ssh library crate.
- `boot.rs` — shared boot recipe used by both binaries (`boot()` with optional readiness oneshot reporting the bound addr; port 0 → `127.0.0.1:0` for the desktop). Also fixes up the process environment at startup, before anything can spawn a subprocess: `scrub_nested_agent_env()`, then `adopt_login_shell_path()` (runs `$SHELL -lic 'echo __PERCH_PATH__$PATH'` with a forced bare child PATH and a 5s timeout, then merges login entries first + current-PATH leftovers appended — so Finder/Dock launches still find brew tools and a shim dir can never shadow `/usr/bin/ssh`; escape hatch `PERCH_NO_LOGIN_PATH`), then `augment_path_with_local_bin()` as the final guarantee that claude/codex resolve.
- `db.rs` (rusqlite, `~/.perch/history.sqlite`), `registry.rs` (replay ring buffer), `settings.rs`/`hosts.rs` (`~/.perch/*.json`, all-`serde(default)`, atomic temp+rename writes), `models.rs` (codex list read at boot from the local `~/.codex/model-catalog.json` — path/default slug honour `~/.codex/config.toml`, static `CODEX_CATALOGUE` is the fallback; claude list is static aliases; still resolved once for the local host and never probed per host).

### Web UI (`packages/web`)

Zustand store (`store.ts`) is the single WS-driven state: sessions, host states/models keyed by `hostId` (`"local"` + federated hosts), settings. `Sidebar.tsx` groups host → project (cwd) → sessions. Hosted vs CLI mode toggle per chat: Hosted is structured chat; CLI is an xterm attached to the real CLI PTY. **Provider/model UI (ModelChip etc.) renders in Hosted mode only — zero model chrome in CLI mode (user decision).** The ModelChip popover is portal-rendered to escape dockview clipping.

## Constraints and gotchas

- **Repo control via `gh` only; read repo state from `.git/*` directly** (an exception exists for commit/push, but only when the user explicitly asks — never commit or push otherwise). Commits are authored as `hwii <116895905+hwii-florescent@users.noreply.github.com>` (set in local git config).
- **All UI/app testing must be headless/background** — never `--headed`/`--ui`, never a focused window. For the desktop app use `PERCH_DESKTOP_TEST=1` (hidden, unfocused).
- **Dated model snapshot IDs 404 on corp's GenAI proxy** (e.g. `claude-haiku-4-5-20251001`); always use aliases (`claude-haiku-4-5`) and always pass `--model` explicitly on CLI resume.
- e2e runs real agent turns; when the proxy is slow, turns overlap into later tests and cause rotating failures (multiple `.session-status--running` dots, idle-timeout misses). Re-run failing specs in isolation before treating a failure as a regression.
- Mac toolchain paths for non-interactive shells: node/npm at `~/.corp-node/bin`, cargo at `~/.cargo/bin`, claude/codex at `~/.local/bin`. npm needs the public registry (committed `.npmrc` handles it).
- devpod counterpart: `dev-personal.devpod-us-or`, repo at `/home/user/perch` (`source $HOME/.cargo/env` first). Only `perch-core` builds there. The hub normally auto-starts the remote perch in tmux session `perch-core`.
- `crates/perch-desktop/gen/` is tauri-build output (gitignored); don't hand-edit.
