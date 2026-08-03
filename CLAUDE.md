# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What perch is

A personal agent-babysitting IDE: **Rust owns all logic and data** (agent runners, terminals, SQLite history, settings, host federation) behind a single axum HTTP+WS server; **TypeScript/React is a thin view** that connects over WebSocket. Two delivery modes, one core: the Tauri desktop app (`perch-desktop` boots the core in-process) and the plain web server (`perch-core` headless, used on devpods). Remote hosts come in two modes: `perch` (classic federation — the remote runs its own perch behind an ssh tunnel) and `direct` (nothing installed remotely except `claude`/`codex` + `tmux`; turns run detached over ssh and survive laptop sleep and perch restarts). `PLAN.md` is the authoritative phase-by-phase record — update it when a phase completes. `README.md` is stale (describes the retired Node server); `reference/node-server-spec/` is that old implementation kept as an executable spec, not shipped.

## Commands

```sh
# Rust core (builds everywhere, incl. headless devpods)
cargo build -p perch-core
cargo run -p perch-core -- --port 7788
#   flags: --port --headless --base-path --public-base-url --db-path --hosts-path
#   env fallbacks: PERCH_PORT, PERCH_BASE_PATH, PERCH_PUBLIC_BASE_URL, PERCH_DB, PERCH_HOSTS, PERCH_WEB_DIST
#   NOTE: there is NO --settings-path — every instance shares the real ~/.perch/settings.json.

# Rust tests / one test
cargo test -p perch-core
cargo test -p perch-core plan_write            # substring filter

# Desktop shell (Mac only — needs webkit; NOT buildable on devpods)
cargo build -p perch-desktop
cargo run -p perch-desktop          # boots core on a free localhost port, opens window
PERCH_DESKTOP_TEST=1 ./target/debug/perch-desktop   # window hidden + unfocused (for automation)

# Web UI (output packages/web/dist is served by axum — rebuild after UI changes)
npm install && npm run build        # builds @perch/shared then @perch/web
npm run dev -w @perch/web           # Vite dev server for UI iteration

# Rust checks
cargo fmt --check && cargo clippy --workspace --all-targets
#   fmt --check currently fails repo-wide on pre-existing hunks (hand-aligned const
#   tables); clippy has exactly 5 pre-existing warnings. Add zero new ones.

# e2e (Playwright, chromium, serial). Boots BOTH servers itself: :7799 (hub) and
# :7800 (isolated federated remote with /tmp db+hosts). Requires claude/codex CLI creds.
cd e2e && npm ci
npx playwright test                          # full suite
npx playwright test federation.spec.ts       # one spec
npx playwright test sidebar.spec.ts -g "4."  # one test
```

New e2e specs must be added to `testMatch` in `e2e/playwright.config.ts` or they won't run. Screenshots/traces land in `e2e/artifacts/` (wiped every run — put keepers elsewhere, e.g. `e2e/screenshots-federation/`, gitignored).

The web app is a PWA that self-updates: `main.tsx` registers the service worker via `virtual:pwa-register` with a 60s update poll, so after `npm run build` every open tab reloads itself onto the new bundle within ~a minute — no server restart needed for UI-only changes (the server reads `dist/` per request).

## Architecture

### Protocol parity (the #1 invariant)

The WS protocol is defined twice and must stay field-for-field identical: `crates/perch-core/src/protocol.rs` (serde, tagged by `type`, camelCase on the wire) ↔ `packages/shared/src/protocol.ts`. **Every protocol change touches both files.** `ServerMessage` also derives `Deserialize` because the hub parses remote perch replies as the same protocol (perch↔perch federation). New fields must be optional/defaulted so older peers keep working.

### perch-core modules

- `server.rs` — axum HTTP (serves `packages/web/dist`, base-path aware; `POST {base}upload?sessionId=&name=` stages chat attachments under `~/.perch/uploads/<sessionId>/`) + WS at `{base}/ws`. `AppState` holds registry, db, running-session set, two broadcast channels, model lists, settings/hosts stores, and the `HubManager`. `handle_message` is the single dispatch point for all client messages; hub/direct routing branches sit at the top of session/terminal arms.
- `agent.rs` — headless runners: Claude via `claude -p --output-format stream-json` with `--session-id`/`--resume` continuity; Codex via fresh `codex exec --json` per turn. `chat.send` knobs: `planMode` (claude `--permission-mode plan`, codex `--sandbox read-only`), `effort` (claude `--effort` + `MAX_THINKING_TOKENS=0` for "none"; codex `-c model_reasoning_effort=…`), `attachments` (claude: path list appended to the turn text; codex: images via repeatable `-i` before the mandatory `--`/`-` prompt separator). `ClaudeStreamParser` turns a `Write` to `*/.claude/plans/*` into `AgentEvent::Plan` (2.1.x has no ExitPlanMode; the plan IS that Write) and `strip_image_blocks` replaces base64 image blocks in tool results with `[image]` before anything reaches the WS/DB. Read the doc comments before touching model handling.
- `detached.rs` — direct-mode turn execution: launches the CLI on the remote inside tmux under `set -m`/`nohup` with output appended to `~/.perch-direct/<sessionId>/<turnId>/run.jsonl`, tails it with cursor+inode tracking, and recovers after perch restarts (tri-state: alive→re-tail, dead+exit-marker→finalize, dead+none→failed). The durability barrier (DB row before any remote work) and single-tailer CAS guard are load-bearing — read the module header before changing anything. Attachments are pushed into the run dir over ssh first.
- `terminal.rs` — portable-pty terminals. `terminal.create` with `agentAttach` spawns the *real interactive* CLI (`claude --resume <id> --model <alias>`) sharing the hosted conversation's context — this is CLI mode. The waiter thread removes its own handle on child exit (dead PTYs must not linger).
- `hub.rs` — remote hosts, one connection task per enabled host. `perch` mode: ssh health check → SSH tunnel (`ssh -A -L`, stable `~/.ssh/perch_auth_sock` symlink) → auto-start remote perch via `tmux new-session -A -d -s perch-core` → WS client through the tunnel; tunnel children are wrapped in a `TunnelGuard` (RAII kill-on-drop). `direct` mode: prereq probe (+ remote codex catalogue fetch) → publish `host.info` → 120s re-probe; turns go through `detached.rs`, sessions live in the LOCAL db tagged with the host id. Routing: `remote_sessions`/`remote_terminals` maps pick the owning host; streaming replies go only to the initiating connection via `pending_unicast` (Session→Terminal key swap must happen under one lock); host state / session lists fan out via `hub_events_tx`. SSH is always the `ssh` CLI subprocess (corp-SSH-integrated) — never an ssh library crate.
- `ssh.rs` — bounded ssh primitives shared by hub/detached/commands: `run_remote` (ControlMaster multiplexing, `MaxSessions` fallback, tokio timeouts), remote file tail, `fetch_remote_codex_catalog`, `write_remote_bytes` (base64 over stdin). Everything that touches a remote goes through here.
- `commands.rs` — slash-command discovery for composer autocomplete: claude via the zero-cost `claude -p "/effort" … --no-session-persistence` probe (parses the `system/init` line's `slash_commands`/`skills`/`agents`), codex via `codex debug prompt-input` (parses the `### Available skills` block). Runs in the session cwd, locally or over ssh for direct hosts; process-global cache keyed host+cwd, 300s TTL. Serves `commands.list`.
- `uploads.rs` — attachment staging for the upload endpoint: per-session dirs, sanitized no-clobber filenames, 25MB cap, 24h sweep.
- `boot.rs` — shared boot recipe used by both binaries (`boot()` with optional readiness oneshot reporting the bound addr; port 0 → `127.0.0.1:0` for the desktop). Also fixes up the process environment at startup, before anything can spawn a subprocess: `scrub_nested_agent_env()`, then `adopt_login_shell_path()` (runs `$SHELL -lic 'echo __PERCH_PATH__$PATH'` with a forced bare child PATH and a 5s timeout, then merges login entries first + current-PATH leftovers appended — so Finder/Dock launches still find brew tools and a shim dir can never shadow `/usr/bin/ssh`; escape hatch `PERCH_NO_LOGIN_PATH`), then `augment_path_with_local_bin()` as the final guarantee that claude/codex resolve.
- `db.rs` (rusqlite, `~/.perch/history.sqlite`; `sessions.host_id` tags direct-host sessions; `list_sessions` only returns sessions with ≥1 message — CLI-only sessions are invisible in the nav, a known open item), `registry.rs` (replay ring buffer), `settings.rs`/`hosts.rs` (`~/.perch/*.json`, all-`serde(default)`, atomic temp+rename writes), `models.rs` (codex list read at boot from the local `~/.codex/model-catalog.json` — path/default slug honour `~/.codex/config.toml`, static `CODEX_CATALOGUE` is the fallback; claude list is static aliases). **Model lists are per host**: perch-mode hosts report their own via `server.info`; direct-mode hosts get their `~/.codex` config+catalogue `cat`ed back over ssh on every probe cycle (`ssh::fetch_remote_codex_catalog` → `models::parse_remote_codex_payload`, marker-delimited payload — keep the two in sync). Lists stay in catalogue best-first order; the host's configured default carries `isDefault` (clients preselect it, never reorder).

### Web UI (`packages/web`)

Zustand store (`store.ts`) is the single WS-driven state: sessions, host states/models keyed by `hostId` (`"local"` + federated hosts), settings. `Sidebar.tsx` groups host → project (cwd) → sessions; the tab-bar `+` creates directly in the active project's cwd (dir browser only in blank state). Hosted vs CLI is a **global** setting (Settings → chat mode), not per chat: Hosted is structured chat; CLI is an xterm attached to the real CLI PTY (with an exited-state panel + Restart CLI when the process dies). **Provider/model/effort UI renders in Hosted mode only — zero model chrome in CLI mode (user decision).** Chips/popovers are portal-rendered to escape dockview clipping. Archived sessions never render in the nav — they live only in Settings → Archived Sessions (grouped by host, Restore/Delete per row).

The Hosted composer (`views/Chat.tsx` + `components/SlashPopover.tsx`, `PlanCard.tsx`, `AttachmentBar.tsx`) carries three power features, all driven by helpers that already existed (`composerCommands.ts`, `attachments.ts`, `popoverPosition.ts`) — read those before changing the UI. **Slash autocomplete**: open-state is *derived* each render from `activeSigilToken(text, caret, sigil)`, never stored, so it can't desync from the textarea; its key handlers run *ahead* of the Enter-submits handler so Enter accepts a suggestion instead of sending; sigil is per-agent (`/` claude, `$` codex) and `CommandEntry.name` is bare, so the UI prepends it. **Plan mode**: the `composer-plan-toggle` is a standing mode, but "Approve & run" always sends `PLAN_APPROVAL_TEXT` with plan mode **off** regardless of the toggle, or the agent just replans; plan cards are claude-only. **Attachments**: chips are name-only *on purpose* — never add a thumbnail or `createObjectURL` preview, because only the staged server path may cross the wire and an e2e test asserts the DOM contains no `data:image` or >2000-char node. Markdown rendering lives in `markdown.ts` (not `Chat.tsx`) so `PlanCard` can share it without a circular import.

## Constraints and gotchas

- **Repo control via `gh` only; read repo state from `.git/*` directly** (an exception exists for commit/push, but only when the user explicitly asks — never commit or push otherwise). Commits are authored as `hwii <116895905+hwii-florescent@users.noreply.github.com>` (set in local git config).
- **All UI/app testing must be headless/background** — never `--headed`/`--ui`, never a focused window. For the desktop app use `PERCH_DESKTOP_TEST=1` (hidden, unfocused).
- **All instances share `~/.perch/settings.json`** (no `--settings-path`). Tests that flip settings (e.g. chat mode) must restore them, even on failure. `--db-path`/`--hosts-path` do isolate.
- **Dated model snapshot IDs 404 on corp's GenAI proxy** (e.g. `claude-haiku-4-5-20251001`); always use aliases (`claude-haiku-4-5`) and always pass `--model` explicitly on CLI resume.
- e2e runs real agent turns; when the proxy is slow, turns overlap into later tests and cause rotating failures (multiple `.session-status--running` dots, idle-timeout misses). Re-run failing specs in isolation before treating a failure as a regression.
- `ssh::tests::mux_control_path_stays_under_the_macos_sun_path_limit` is flaky in the full suite (another test mutates `HOME`; `control_dir()` is a `OnceLock`) — passes in isolation.
- Mac toolchain paths for non-interactive shells: node/npm at `~/.corp-node/bin`, cargo at `~/.cargo/bin`, claude/codex at `~/.local/bin`. npm needs the public registry (committed `.npmrc` handles it). Codex auth on this machine needs `corp-sso` (reachable via `/usr/local/bin/corp-sso`; the boot-time login-shell PATH covers it).
- Test devpod for direct mode: `dev-agent.devpod-us-or` (claude/codex in `~/.local/bin`, tmux, codex catalogue present). Older `dev-claude`/`dev-search` devpods are deleted; hosts.json entries pointing at them are stale.
- `crates/perch-desktop/gen/` is tauri-build output (gitignored); don't hand-edit.
