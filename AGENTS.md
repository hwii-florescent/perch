# AGENTS.md

This file provides guidance to coding agents working in this repository. It is
the single source of project guidance; there is no separate `CLAUDE.md`.

## What perch is

A personal agent-babysitting IDE: **Rust owns all logic and data** (agent runners, terminals, SQLite history, settings, host federation) behind a single axum HTTP+WS server; **TypeScript/React is a thin view** that connects over WebSocket. Two delivery modes, one core: the Tauri desktop app (`perch-desktop` boots the core in-process) and the plain web server (`perch-core` headless, used on devpods). Remote hosts come in two modes: `perch` (classic federation — the remote runs its own perch behind an ssh tunnel) and `direct` (nothing installed remotely except `claude`/`codex` + `tmux`; turns run detached over ssh and survive laptop sleep and perch restarts). **Current direction (2026-09-22): a fast, lightweight Rust port of [Orca](https://github.com/stablyai/orca), CLI mode first; the Hosted/UI chat surface is frozen as-is.** `docs/ARCHITECTURE.md` is the target architecture and `docs/ORCA-PARITY.md` the feature gap matrix — both supersede the deleted goals/SPEC/PLAN/handoff files. `reference/node-server-spec/` is the retired Node implementation kept as an executable spec, not shipped.

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

# Desktop shell (macOS, or Linux with webkit2gtk-4.1; not on headless devpods)
cargo build -p perch-desktop
cargo run -p perch-desktop          # boots core on a free localhost port, opens window
PERCH_DESKTOP_TEST=1 ./target/debug/perch-desktop   # window hidden + unfocused (for automation)

# Installers (same step CI runs; output in target/release/bundle/)
npm run build && (cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build)
#   Releases: .github/workflows/release.yml — pushing a `v*` tag drafts a GitHub
#   release with the macOS .dmg, Linux .deb/.rpm/.AppImage and static Linux
#   perchd binaries (x86_64/aarch64 musl). Windows is not ported (backlog).

# Web UI (output packages/web/dist is served by axum — rebuild after UI changes)
npm install && npm run build        # builds @perch/shared then @perch/web
npm run dev -w @perch/web           # Vite dev server for UI iteration

# Rust checks
cargo fmt --check && cargo clippy --workspace --all-targets
#   fmt --check is clean (exit 0) — keep it that way; clippy has exactly 5
#   pre-existing warnings (agent.rs, hub.rs x2, protocol.rs, server.rs). Add zero new ones.

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
- `terminal.rs` — portable-pty terminals. `terminal.create` with `agentAttach` spawns the *real interactive* CLI (`claude --resume <id> --model <alias>`) sharing the hosted conversation's context — this is CLI mode. The waiter thread removes its own handle on child exit (dead PTYs must not linger). `apply_terminal_env` sets `TERM=xterm-256color`/`COLORTERM=truecolor`/UTF-8 `LANG` **after** copying the parent env, overriding it on purpose: a Finder/Dock launch has no `TERM` at all (the CLIs then assume a dumb tty and their TUIs degrade), and a terminal launch's `TERM` describes *that* terminal, not the xterm.js on the other end. The reader thread carries a partial trailing UTF-8 sequence across pty reads (`split_utf8_tail`) — decoding each 8 KiB read independently with `from_utf8_lossy` turned every glyph straddling a buffer boundary into U+FFFD and shifted the rest of the line; that was the long-standing "TUI renders garbled" bug.
- `iterm_profile.rs` — reads the user's iTerm2 default profile (font + full ANSI palette) via `plutil -extract "New Bookmarks".0` and ships it in `server.info` as `terminalProfile`. **perch must never substitute its own theme for a terminal's palette** — the pane runs the same CLI the user runs in iTerm2, and its output is coloured by the terminal; anything the profile doesn't specify falls through to xterm's stock defaults, never a perch token.
- `cli_title.rs` — CLI mode's stand-in for Hosted mode's first-user-message title. A CLI session never writes to `messages`, so it had no title; this reconstructs the first submitted prompt from the `terminal.input` keystroke stream (line-editor model: printables accumulate, backspace deletes, Ctrl-U/Ctrl-C abandon, Enter submits). The escape-sequence state machine lives on the struct because a `\x1b[` can be split across WS frames. Stored via `db.set_cli_title`, whose write-once `WHERE` clause is load-bearing — the in-memory state is gone after a restart, and without it the next prompt would look like the first.
- `hub.rs` — remote hosts, one connection task per enabled host. `perch` mode: ssh health check → SSH tunnel (`ssh -A -L`, stable `~/.ssh/perch_auth_sock` symlink) → auto-start remote perch via `tmux new-session -A -d -s perch-core` → WS client through the tunnel; tunnel children are wrapped in a `TunnelGuard` (RAII kill-on-drop). `direct` mode: prereq probe (+ remote codex catalogue fetch) → publish `host.info` → 120s re-probe; turns go through `detached.rs`, sessions live in the LOCAL db tagged with the host id. Routing: `remote_sessions`/`remote_terminals` maps pick the owning host; streaming replies go only to the initiating connection via `pending_unicast` (Session→Terminal key swap must happen under one lock); host state / session lists fan out via `hub_events_tx`. SSH is always the `ssh` CLI subprocess (corp-SSH-integrated) — never an ssh library crate.
- `ssh.rs` — bounded ssh primitives shared by hub/detached/commands: `run_remote` (ControlMaster multiplexing, `MaxSessions` fallback, tokio timeouts), remote file tail, `fetch_remote_codex_catalog`, `write_remote_bytes` (base64 over stdin). Everything that touches a remote goes through here.
- `commands.rs` — slash-command discovery for composer autocomplete: claude via the zero-cost `claude -p "/effort" … --no-session-persistence` probe (parses the `system/init` line's `slash_commands`/`skills`/`agents`), codex via `codex debug prompt-input` (parses the `### Available skills` block). Runs in the session cwd, locally or over ssh for direct hosts; process-global cache keyed host+cwd, 300s TTL. Serves `commands.list`.
- `uploads.rs` — attachment staging for the upload endpoint: per-session dirs, sanitized no-clobber filenames, 25MB cap, 24h sweep.
- `boot.rs` — shared boot recipe used by both binaries (`boot()` with optional readiness oneshot reporting the bound addr; port 0 → `127.0.0.1:0` for the desktop). Also fixes up the process environment at startup, before anything can spawn a subprocess: `scrub_nested_agent_env()`, then `adopt_login_shell_path()` (runs `$SHELL -lic 'echo __PERCH_PATH__$PATH'` with a forced bare child PATH and a 5s timeout, then merges login entries first + current-PATH leftovers appended — so Finder/Dock launches still find brew tools and a shim dir can never shadow `/usr/bin/ssh`; escape hatch `PERCH_NO_LOGIN_PATH`), then `augment_path_with_local_bin()` as the final guarantee that claude/codex resolve.
- `db.rs` (rusqlite, `~/.perch/history.sqlite`; `sessions.host_id` tags direct-host sessions; `list_sessions` returns sessions with ≥1 message **or** `cli_activity = 1` (shared `SESSION_VISIBILITY_FILTER`), so CLI-only sessions do appear in the nav — the old "CLI sessions are invisible" open item was closed in Phase 12, along with the `cli_title` column that gives them a title; `list_sessions` and its single-row twin `get_session_row` share one `SESSION_LIST_ROW_SELECT` const + `session_list_row_from_row` mapper **on purpose** — if they drift, a `session.updated` push starts disagreeing with `session.list` about the same row), `registry.rs` (replay ring buffer), `settings.rs`/`hosts.rs` (`~/.perch/*.json`, all-`serde(default)`, atomic temp+rename writes), `models.rs` (codex list read at boot from the local `~/.codex/model-catalog.json` — path/default slug honour `~/.codex/config.toml`, static `CODEX_CATALOGUE` is the fallback; claude list is static aliases). **Model lists are per host**: perch-mode hosts report their own via `server.info`; direct-mode hosts get their `~/.codex` config+catalogue `cat`ed back over ssh on every probe cycle (`ssh::fetch_remote_codex_catalog` → `models::parse_remote_codex_payload`, marker-delimited payload — keep the two in sync). Lists stay in catalogue best-first order; the host's configured default carries `isDefault` (clients preselect it, never reorder).

### Web UI (`packages/web`)

Zustand store (`store.ts`) is the single WS-driven state: sessions, host states/models keyed by `hostId` (`"local"` + federated hosts), settings. `chat.chunk` text is **rAF-coalesced** into one store write per frame; the invariant is that anything reading or replacing `messages` must call `flushChunkBuffer()` *synchronously first*, because `updateStreamingMessage` no-ops once `streamingMessageId` is cleared — so a late flush silently **drops** text rather than misapplying it. `handleServerMessage` flushes up front for every type except `chat.chunk`; `switchSession`/`createSessionOnHost`/`switchAwayFromActiveSession`/the disconnect handler each flush before resetting state. Add a flush to any new such path. `MessageBubble` is `memo`ised and its markdown is `useMemo`d — keep both, they are what make streaming O(n) instead of O(n²). `Sidebar.tsx` groups host → project (cwd) → sessions; the tab-bar `+` opens `NewSessionPopover` (agent picker, the active project's cwd, "No project", dir browser) and creates nothing until one is picked — a test that clicks `+` and then types is typing into the *previously active* session. The launcher's sessions are **CLI-owned**; a Hosted session comes from a plain `session.create`. Hosted vs CLI is resolved per session by `resolveSessionModeForView` from `session.mode` (`SessionModeControl`, scopes session/workspace/device); the global Settings → chat mode is only the legacy fallback for peers without the runtime capability. Hosted is structured chat; CLI is an xterm attached to the real CLI PTY (with an exited-state panel + Restart CLI when the process dies). **UI mode over a CLI-owned session renders `NativeCliChat`, not the Hosted composer** — so there is no `.chat__input textarea` and no model chip there, because the model belongs to the CLI. **Provider/model/effort UI renders in Hosted mode only — zero model chrome in CLI mode (user decision).** CLI mode does **not** mount a terminal until the session is explicitly started (`cliStartedSessions` locally, or `SessionSummary.cliStarted` from the server) — otherwise the blank session `ws.ts` mints on every connect spawns an agent in the default cwd on app open; unstarted sessions render `CliStartPanel` instead. **Every terminal is built by `xtermSetup.ts::createPerchTerminal`, never `new Terminal()` directly** — `convertEol` must stay `false` (true corrupts full-screen TUIs), the theme/font come from the server's `terminalProfile` (the user's real terminal) and **never** from perch's UI tokens, a narrow pane scales the font down to hold `MIN_COLS`=80 rather than reflowing (`fitWithScaling`), sizing is a container `ResizeObserver` and not a `window` listener, and 0x0 fits are skipped so a hidden dockview tab can't push a 1-column size to the pty. Do not add `@xterm/addon-webgl`: canvas renderers leave `.xterm-rows` empty and blind the e2e specs that read terminal text from the DOM. Chips/popovers are portal-rendered to escape dockview clipping. Archived sessions never render in the nav — they live only in Settings → Archived Sessions (grouped by host, Restore/Delete per row).

The Hosted composer (`views/Chat.tsx` + `components/SlashPopover.tsx`, `PlanCard.tsx`, `AttachmentBar.tsx`) carries three power features, all driven by helpers that already existed (`composerCommands.ts`, `attachments.ts`, `popoverPosition.ts`) — read those before changing the UI. **Slash autocomplete**: open-state is *derived* each render from `activeSigilToken(text, caret, sigil)`, never stored, so it can't desync from the textarea; its key handlers run *ahead* of the Enter-submits handler so Enter accepts a suggestion instead of sending; sigil is per-agent (`/` claude, `$` codex) and `CommandEntry.name` is bare, so the UI prepends it. **Plan mode**: the `composer-plan-toggle` is a standing mode, but "Approve & run" always sends `PLAN_APPROVAL_TEXT` with plan mode **off** regardless of the toggle, or the agent just replans; plan cards are claude-only. **Attachments**: chips are name-only *on purpose* — never add a thumbnail or `createObjectURL` preview, because only the staged server path may cross the wire and an e2e test asserts the DOM contains no `data:image` or >2000-char node. Markdown rendering lives in `markdown.ts` (not `Chat.tsx`) so `PlanCard` can share it without a circular import.

## Constraints and gotchas

- **This repo is PUBLIC and its history was sanitized on 2026-08-04. Never write employer-internal names into it.** Internal hostnames, registries, tooling and usernames were scrubbed from all 23 commits with `git filter-repo`, and the repo was **deleted and recreated** on GitHub to destroy the orphaned pre-scrub objects (a force-push alone left them fetchable by SHA — verified). Consequences you must respect:
  - **Every internal-looking identifier in these docs is a PLACEHOLDER, not a real value.** `dev-agent.devpod-us-or`, `*.internal.example.com`, `corp-sso`, `corp-node`, `corp-cli`, `corp-gateway`, `dev-user` are all fake. **Do not try to ssh to them, and do not "correct" them back to real values.** Real host names and ssh targets live in `~/.perch/hosts.json`, which is outside the repo — read them from there at runtime.
  - Use the same neutral vocabulary for anything new: `corp-*` for internal tooling, `*.internal.example.com` for internal hosts, `dev-*` for devpod names.
  - Pre-scrub commit SHAs (e.g. `3e4c548`, `f55155f`) no longer exist anywhere on GitHub. The originals are only in `~/perch-backup-20260804/perch-PRE-SCRUB-original.bundle` (local, gitignored-by-location).
  - `gh` now holds the `delete_repo` scope.
- **Repo control via `gh` only; read repo state from `.git/*` directly** (an exception exists for commit/push, but only when the user explicitly asks — never commit or push otherwise). Commits are authored as `hwii <116895905+hwii-florescent@users.noreply.github.com>` (set in local git config).
- **All UI/app testing must be headless/background** — never `--headed`/`--ui`, never a focused window. For the desktop app use `PERCH_DESKTOP_TEST=1` (hidden, unfocused).
- **All instances share `~/.perch/settings.json`** (no `--settings-path`). Tests that flip settings (e.g. chat mode) must restore them, even on failure. `--db-path`/`--hosts-path` do isolate.
- **Claude Code decorates what it accepts.** 2.1.278 wraps every bracketed
  paste — which is how `native_ui/claude.rs::prepare_input` submits — in
  `<pasted_content id="...">` tags with a random id. Never compare a hook's
  reported `prompt` to the sent text for equality; that silently broke every
  native Claude acknowledgement and made delivered review packets report
  "could not be confirmed". Only Claude infers acceptance this way — the other
  providers return an explicit `NativeEvent::Ack`. `/tmp/perch-native-<uid>/`
  survives fixture cleanup, so `*.UserPromptSubmit.event` is the ground truth
  for what the CLI actually received.
- **Dated model snapshot IDs 404 on corp's GenAI proxy** (e.g. `claude-haiku-4-5-20251001`); always use aliases (`claude-haiku-4-5`) and always pass `--model` explicitly on CLI resume.
- e2e runs real agent turns; when the proxy is slow, turns overlap into later tests and cause rotating failures (multiple `.session-status--running` dots, idle-timeout misses). Re-run failing specs in isolation before treating a failure as a regression.
- `ssh::tests::mux_control_path_stays_under_the_macos_sun_path_limit` is flaky in the full suite (another test mutates `HOME`; `control_dir()` is a `OnceLock`) — passes in isolation.
- Mac toolchain paths for non-interactive shells (verified 2026-08-04): node/npm at `/opt/homebrew/bin` (**`~/.corp-node` does not exist on this machine** — node is brew-installed), cargo at `~/.cargo/bin`, `claude` at `~/.local/bin`, `codex` at `/opt/homebrew/bin`. All are on the login-shell PATH, which `boot.rs` adopts, so subprocesses resolve them. npm needs the public registry (committed `.npmrc` handles it). Codex auth on this machine needs `corp-sso` (reachable via `/usr/local/bin/corp-sso`; the boot-time login-shell PATH covers it). There is no `~/.codex/model-catalog.json`, so the codex model list comes from the static `CODEX_CATALOGUE` fallback in `models.rs`. codex-cli 0.146.0 *does* cache its server-fetched list at `~/.codex/models_cache.json`, in exactly the shape `parse_codex_catalog` already reads — but perch is **not** wired to that filename **on purpose**: the list is hand-maintained so the picker can't change under you. Re-sync `CODEX_CATALOGUE` by hand against that file when codex ships new models (last synced 2026-08-04).
- Test devpod for direct mode: referred to here as `dev-agent.devpod-us-or` — **a placeholder, see the sanitization note above**; the real ssh target is in `~/.perch/hosts.json`. It has claude/codex in `~/.local/bin`, tmux, and a codex catalogue. Two older devpods (placeholders `dev-claude`/`dev-search`) are deleted; hosts.json entries pointing at them are stale.
- `crates/perch-desktop/gen/` is tauri-build output (gitignored); don't hand-edit.
