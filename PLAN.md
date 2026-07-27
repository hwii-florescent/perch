# perch — Personal AI IDE / Agent App: Full Plan (Rust / Tauri)

## Context

A personal IDE/agent app to **babysit coding agents from anywhere**, including your phone, built to
eventually ship in two flavors (corp-internal + open-source) that borrow the best of **Jean**
(Rust/Tauri native app: chat + terminal + diff + side panel) and **T3/t3code-internal** (web-first, devpod
gateway URLs, remote-ready).

**Product shape:** *Rust app core, TypeScript as the thin view + web-routing layer* — the Jean/Tauri
model. Rust owns all the logic and data (agents, terminals, git, devpod, SQLite) and exposes it over
a single WebSocket API. The TypeScript/React web app is *just the view*: it connects to that WS,
whether it's embedded in the native Tauri window (localhost) or opened from your phone (devpod
gateway URL). One Rust core, one TS view, two delivery modes.

## Why this shape (decision record)

- User wants a **Rust app** with **TS only for minimal routing of app data to the web resource**.
  That is exactly Tauri: Rust backend + web-tech frontend, plus a headless mode that serves the same
  web bundle for the phone.
- **Single WS transport** for both desktop and web (instead of Tauri IPC for desktop + WS for web):
  the Rust core always runs an axum HTTP+WS server; the Tauri window and the phone both connect over
  WS. Keeps TS purely view+routing and Rust the single source of truth.
- **Toolchain reality on this devpod:** Rust installs via `rustup` (verified reachable). `webkit2gtk`
  and a display are **absent** → the **Tauri desktop GUI is built/tested on the Mac**, while the
  **headless axum web mode builds & runs here** and is testable via the gateway URL.

## Repo structure (Cargo workspace + TS packages)

```
perch/
  Cargo.toml                      # Rust workspace
  crates/
    perch-core/                   # PURE Rust core — NO Tauri/webkit dep (builds headless on devpod)
      src/protocol.rs             #   serde types matching the WS contract (tagged by `type`)
      src/agent.rs                #   claude stream-json runner (AgentRunner trait + ClaudeRunner)
      src/terminal.rs             #   portable-pty terminals
      src/db.rs                   #   rusqlite history (~/.perch/history.sqlite)
      src/registry.rs             #   session registry + replay ring buffer
      src/status.rs               #   cwd + branch (parse .git/HEAD, no git shell-out)
      src/server.rs               #   axum HTTP (serve web dist / placeholder) + WS at {base}/ws
      src/lib.rs  src/main.rs     #   lib + headless binary entry
    perch-desktop/                # Tauri app (thin) — depends on perch-core; BUILT ON MAC
      src/main.rs                 #   boots core WS on localhost, opens Tauri window on the web app
      tauri.conf.json
  packages/
    shared/                       # TS WS protocol contract (mirrors protocol.rs) — REUSED
    web/                          # React/TS UI (chat/terminal/PWA), WS client — REUSED PLAN
  reference/node-server-spec/     # the old Node server, kept as an executable spec (not shipped)
```

An `integrations/corp/*` seam (in perch-core) keeps corp-specifics (corp-gateway, devpod gateway, corp-cli,
corp-SSH) swappable so the open-source split is a strip-out, not a rewrite.

## Rust dependencies (perch-core)
`tokio`, `axum`, `tower-http` (serve-dir), `serde`/`serde_json`, `rusqlite` (bundled sqlite),
`portable-pty`, `uuid`, `anyhow`, `tracing`. `perch-desktop`: `tauri` (+ webkit2gtk on Mac).

## WS protocol (defined in Rust `protocol.rs` + TS `shared`, kept field-for-field identical)
- Client→Server: `session.create`, `session.resume` (localStorage-backed, replays history), `session.subscribe`,
  `chat.send` (+`agent`, `model`), `chat.cancel`, `terminal.create` (+optional `agentAttach:
  {sessionId, agent}` to spawn the real interactive CLI instead of a shell), `terminal.input`,
  `terminal.resize`.
- Server→Client: `session.created`, `session.history`, `chat.chunk`, `chat.thinking`, `chat.tool_use`,
  `chat.tool_result`, `chat.done` (usage: input/output tokens, costUsd, contextTokens),
  `terminal.created`, `terminal.data`, `terminal.exit`, `status.update`, `error`.

---

## Phases & Milestones

### Phase 0 — Rust workspace restructure + toolchain — ✅ done
- Install Rust via `rustup` (minimal, stable).
- Add `Cargo.toml` workspace + `crates/perch-core` + `crates/perch-desktop` skeletons.
- Move the existing Node server to `reference/node-server-spec/` (keep as spec; not shipped).
- Keep `packages/shared` + `packages/web`.
- **Milestone: `cargo build -p perch-core` compiles a headless skeleton.**

### Phase 1 — Rust core (`perch-core`) — ✅ done
- Port the verified Node behavior to Rust: `protocol.rs`, `agent.rs` (claude stream-json, multi-turn
  via `--session-id`/`--resume`, `--permission-mode bypassPermissions`), `terminal.rs`, `db.rs`,
  `registry.rs` (ring buffer), `status.rs`, `server.rs` (axum, base-path aware, flags
  `--port/--headless/--base-path/--public-base-url` + `PERCH_*` env).
- **Verify (Rust):** `cargo build` clean; boot headless on `:7788`; WS `session.create` round-trip;
  terminal `echo hi` round-trip; one real `claude` turn streams + persists to SQLite.
- **Milestone: Rust headless core talks to Claude + terminals over WS.** ✅ verified.

### Phase 2 — TS web UI (chat + terminal + PWA) — ✅ done
- `packages/web`: React + Vite, WS client + store, chat + terminal (xterm.js), status bar, PWA,
  base-path aware. Built to `packages/web/dist`, served by axum.
- **Milestone: open the gateway URL on desktop + phone; chat + terminal; install PWA.** ✅ verified.

### Phase 2.5 — Codex + model selection — ✅ done
- Added `CodexRunner` (fresh process per turn, `codex exec --json`), `AgentKind` (claude|codex) on
  the wire protocol, agent/model dropdowns in the chat UI, `claude-haiku-4-5`/`gpt-5.4-mini` verified
  working against corp's GenAI proxy (exact working model IDs — see `agent.rs` doc comments for the
  non-obvious gotchas, e.g. dated snapshot ids like `claude-haiku-4-5-20251001` 404 on the proxy).
- **Milestone: real "say hello" turns from both Claude and Codex, screenshotted.** ✅ verified.

### Phase 2.6 — Session persistence & resume — ✅ done
- `session.resume`/`session.history` protocol, SQLite persists both user *and* assistant turns,
  client resumes via `localStorage`-stored `sessionId` on every connect (not just first load), Claude
  `--resume` continuity survives a full page reload and a server restart.
- **Milestone: reload the page mid-conversation — history and Claude's context both survive.** ✅
  verified (Playwright-driven before/after/continuity screenshots).

### Phase 2.7 — Jean-style dockable shell + Hosted/CLI toggle — ✅ done
- Adopted (re-implemented, not copied) the pattern from Jean/T3Code's corp-internal forks (`jean-internal`,
  `t3code-internal`, researched read-only via Sourcegraph): a `dockview-react` panel shell replacing the tab
  bar, and a per-chat **Hosted/CLI mode toggle** — Hosted is the existing structured chat UI; CLI
  attaches the *real interactive* `claude`/`codex` CLI in a PTY, resumed from the same conversation
  (`claude --resume <id> --model <alias>`, `codex resume <thread-id> -m <model>`), so switching modes
  mid-conversation preserves full context both ways.
- Found and fixed a real bug during verification: CLI-mode resume without an explicit `--model` falls
  back to the transcript's recorded dated snapshot id, which the GenAI proxy rejects — fixed by
  passing the same model alias explicitly on resume (mirrors what headless turns always did).
- Deliberately **not** done (scoped out, see below): ACP transport for Hosted mode; tmux-backed
  terminal persistence across server restarts (CLI-mode PTYs live for the browser tab's session only).
- **Milestone: toggle Hosted → CLI → Hosted mid-conversation, same context both directions; terminal
  panel opens docked below via toolbar icon.** ✅ verified (Playwright-driven, Claude round-trip:
  "remember 7" → CLI mode correctly answers "7" → back to Hosted still answers "7"; Codex fresh-CLI
  fallback with no prior thread also verified clean).

### Phase 2.8 — Session sidebar, agent status, environment header — ✅ done
- New WS protocol messages (kept field-for-field in `protocol.rs` + `packages/shared/protocol.ts`):
  `session.list` (client request + server response with `SessionSummary[]`: id, title = first-user-message
  snippet via SQL correlated subquery, cwd, createdAt, lastAgent?, lastModel?, status running|idle);
  `session.updated` (pushed on turn start/done/error/cancel and session create/resume);
  `server.info` (one-shot on connect: hostname, isSsh from `SSH_CONNECTION`, platform).
- Rust core: `HistoryDb::list_sessions()`; `status::get_server_info()`; `AppState` gained
  `running_sessions: Arc<Mutex<HashSet>>` + a `tokio::sync::broadcast` channel (capacity 64) so all
  connections' sidebars get live status (per-connection forwarder task rebuilds `SessionSummary` per
  event); `ConnState` refactored to hold `app: AppState`; `session.subscribe` skips ring-buffer replay
  for mid-turn sessions (documented v1 limitation: switching to a session mid-turn shows history only
  up to the last completed turn).
- Web UI: left `Sidebar.tsx` — env header with LOCAL/REMOTE/SSH badge (isSsh from server wins, else
  `window.location.hostname` decides local; hostname / platform / cwd / branch; "+ New session";
  session list with pulsing running dot, title snippet, agent·model, relative time,
  click-to-switch via existing `session.resume` path); store grew
  `sessions[]`/`serverInfo`/`listSessions`/`createSession`/`switchSession`; `App.tsx` `.app__body`
  row layout.
- Bug found & fixed during verification: env badge used the server's machine hostname for the locality
  check so it always showed REMOTE once `server.info` arrived — fixed to use `window.location.hostname`
  only.
- New committed Playwright e2e suite at `e2e/` (chromium; webServer boots
  `cargo run -p perch-core -- --port 7799`): 7 tests — env header LOCAL, first session active,
  + new session, chat turn flips indicator running→idle (real claude-haiku-4-5 turn), title snippet,
  session switch with history swap both ways, cross-tab live status via broadcast channel.
  All 7 green; screenshots in `e2e/artifacts/`.
- **Milestone: sidebar lists sessions with live agent status from any tab, click-to-switch preserves
  history, env header shows where the core runs.** ✅ verified (Playwright, 7/7).

### Phase 2.9 — Core UX: CLI/model sync, model catalogue, Codex-style UI, Settings — ✅ done
- CLI/Hosted sync fixes: `sessions` table gained `last_agent`/`last_model` (persisted on every turn
  via `update_session_last_model`, restored into the runner on resume) — fixes post-restart CLI attach
  spawning without `--model` (proxy 404 on dated snapshot ids); dead CLI PTYs evicted from
  `cliTerminalIds` on exit → fresh respawn on CLI re-entry; CLI attach errors surface as an
  in-terminal `.terminal__cli-error` banner (previously invisible); `key={sessionId-agent}` remount on
  `AgentCliTerminal`; model selector follows the active session (`switchSession` + `session.history`
  both set agent/model).
- Model catalogue: new `models.rs` static catalogue served via `server.info` `claudeModels`/`codexModels`
  (7 claude entries fable-5→haiku-4-5, 2 codex) — deliberately NOT version-gated per user decision;
  custom models merge from `~/.perch/settings.json`; client `availableModels` replaces the hardcoded
  `models.ts` list.
- Codex-style UI: sidebar Projects grouping keyed `(hostId="local", cwd)` (federation seam) with
  nested sessions + gear footer; assistant markdown via `marked`+`DOMPurify`; per-turn collapsible
  "Worked for Xs" (client-timed) wrapping thinking+tools; user bubbles Codex radius; agent-bar removed
  — compact `ModelChip` popover lives in the input row, HOSTED MODE ONLY (user decision: zero
  provider/model chrome in CLI mode); `ModeSwitch` always reachable; model-chip popover rendered via
  portal with click-time positioning (dockview clipping fix found during verification).
- Settings: new `settings.rs`/`hosts.rs` (`~/.perch/settings.json` + `hosts.json`, all-`serde(default)`,
  atomic temp+rename writes); WS protocol `settings.get`/`update` (double-Option patch semantics),
  `hosts.list`/`upsert`/`delete` → `settings.current`/`hosts.list`/`hosts.updated`; `SettingsModal`
  (SSH hosts CRUD — connecting ships with federation; custom models per agent; default cwd, applied at
  server start).
- **Milestone: CLI mode survives restarts and model switches; model list is server-owned; UI is
  Codex-shaped with Projects sidebar, markdown chat, input-row model chip; settings modal manages
  custom models + saved SSH hosts.** ✅ verified (Playwright headless, 19 passed / 1 documented skip
  across sidebar, cli-sync, models, restyle, settings suites).

### Phase 3.0 — Hub federation — ✅ done
- New `hub.rs`: `HubManager` — per enabled host a connection state machine: health-check over ssh →
  SSH tunnel `ssh -A -L <local>:127.0.0.1:<port>` with `ExitOnForwardFailure`/`BatchMode` → auto-start
  remote perch via `tmux new-session -A -d -s perch-core` when down → poll via local tunnel port →
  `tokio-tungstenite` WS connect → connected; backoff 500 ms×2 cap 30 s; kill-on-drop tunnel guard;
  watch-channel shutdown; self-connection guard. Remote replies parsed as the same `ServerMessage`
  protocol (perch↔perch).
- Routing: `remote_sessions`/`remote_terminals` maps route session/terminal-scoped client messages to
  the owning host; streaming relayed to the originating connection via `pending_unicast` (Session→Terminal
  key swap under one lock; cleared on `chat.done`/`terminal.exit`/connection close); `host.info` +
  tagged `session.updated` + merged `session.list` broadcast to all connections via a second channel
  (`hub_events_tx`, full pre-built messages). `hosts.updated` now broadcast (was writer-only).
- Protocol: `SessionSummary.hostId` (default `"local"`), `session.create.hostId?`, new `host.info
  {hostId, name, state connecting|connected|error|disabled, error?, hostname?, platform?, isSsh?,
  claudeModels?, codexModels?}`, `SshHostEntry += directUrl?` (skip ssh; e2e/LAN) `+ remoteCmd?`
  (auto-start template, `{port}` placeholder). New flags `--db-path`/`PERCH_DB`,
  `--hosts-path`/`PERCH_HOSTS`.
- UI: sidebar host sections (Local first, then each configured host with live state dot incl. connecting
  pulse / error tooltip / disabled dimming), per-host "+ new session", per-host model lists feeding the
  chip (`hostModels[activeHostId]`), live host state in SettingsModal.
- Two real bugs found & fixed during verification: (1) `hosts.list` was never sent on WS connect so
  host sections only appeared after opening Settings; (2) remote auto-start ran with a minimal
  non-interactive PATH and a dead `SSH_AUTH_SOCK` — fixed by prepending `~/.local/bin` to PATH at
  perch startup AND having the tunnel ssh (`-A`) maintain a stable `~/.ssh/perch_auth_sock` symlink
  that the tmux-spawned perch exports, so claude's apiKeyHelper auths for as long as a tunnel lives.
- e2e: second isolated `webServer` :7800 (`direct_url` federation) + `federation.spec.ts` E1–E5
  (connected section, remote create, remote chat relay, remote CLI relay, disable/re-enable). Suite: 24
  passed / 1 documented skip.
- Real-devpod F4 verified end-to-end (headless): deploy → hub auto-start via tmux → tunnel →
  `devpod-pong` streamed through hub → kill remote → error→connecting→connected recovery in ~15 s with
  fresh tmux session. Screenshots in `e2e/screenshots-federation/`.
- **Milestone: one sidebar shows Local + devpod projects/sessions live; chat and CLI terminals route
  through hub-owned SSH tunnels; remote perch auto-starts and self-heals.** ✅ verified (two-instance
  Playwright + real devpod).

### Phase 3.1 — Tauri desktop shell — ✅ done
- New `boot.rs` in `perch-core`: shared boot recipe extracted from `main.rs` —
  `boot(args, web_dist_dir, ready_tx?)` (db open honoring `--db-path`, registry, `server::run`);
  `resolve_web_dist_dir()` (`PERCH_WEB_DIST` env override → exe-relative
  `../../../packages/web/dist` → cwd fallback); `augment_path_with_local_bin()` moved here;
  headless binary is now a thin wrapper, behavior unchanged.
- `server.rs`: `ServerOptions.ready_tx: Option<oneshot::Sender<SocketAddr>>`; `run()` binds FIRST
  (so `HubManager` gets the real port) and fires `ready_tx` with the bound addr before serving;
  port 0 binds `127.0.0.1:0` (desktop), explicit ports keep `0.0.0.0`.
- `perch-desktop` implemented (Tauri v2, plain `cargo build`, no cargo-tauri CLI): spawns `boot()`
  with port 0 on a dedicated tokio runtime, blocks ≤10 s on the ready oneshot, prints
  `perch-desktop: core ready at http://127.0.0.1:<port>/`, then opens a `WebviewWindowBuilder`
  window at that External URL (1280×800, min 800×600, title "perch"). `PERCH_DESKTOP_TEST=1`
  builds the window `.visible(false).focused(false)` for automated checks. `PERCH_DB`/`PERCH_HOSTS`
  honored. `tauri.conf.json` moved to v2 schema (identifier `dev.hwii.perch`, windows created
  programmatically); minimal generated icon set (`icons/` PNGs + `icon.icns` via `iconutil`).
- Verified on Mac, all background/unfocused: both crates build clean; hidden-window launch against
  an isolated `/tmp` db — the WebView auto-created its own session over WS (proof the UI loaded
  inside the Tauri window); external WS `session.create` round-trip through the desktop binary OK;
  frontmost app never changed. Full e2e suite re-run: 21 passed / 1 documented skip / 2 failures
  confirmed GenAI-proxy latency flakes (haiku turns ~30 s that day; both tests pass in isolation in
  ~10 s — not a regression).
- **Milestone: `cargo run -p perch-desktop` boots the core in-process on a free localhost port and
  opens a native window on the same UI; test mode verifies it headlessly without stealing focus.**
  ✅ verified.

### Phase 3 — Headless + phone integration — ✅ done
- Wire web build into axum static-serve; verify end-to-end via the gateway URL; reconnect/replay on
  refresh (ring buffer). **Milestone: fully usable from the phone browser.** ✅ verified.

### Later phases (post v0.1)
- **ACP transport migration**: replace the headless `claude -p --output-format stream-json` /
  `codex exec --json` runners with real Agent Client Protocol (JSON-RPC over stdio to
  `claude-code-acp`/`codex-acp`), matching how jean-internal/t3code-internal do Hosted-mode chat. Separable from
  Phase 2.7's CLI-mode toggle, which doesn't depend on it.
- **tmux-backed CLI-terminal persistence**: let CLI-mode PTYs survive a server restart (today they
  live only for the browser tab's WS session) — swap the spawn mechanism inside `TerminalManager`
  for a tmux-attach, protocol surface unchanged.
- Side panel (file tree, fuzzy search, diff by branch / last changes); full status bar
  (context + cost); open-source vs corp-internal split.

---

## How to run (after Phase 1)
```bash
source $HOME/.cargo/env
cd /home/user/perch
cargo run -p perch-core -- --port 7788 --base-path /proxy/dev-personal/7788/
```
Phone (after Phase 2/3): `https://devpod-gateway.internal.example.com/proxy/dev-personal/7788/`.

## Verification approach
- **Core (this pass):** cargo build; headless boot; WS smoke test (session/terminal/chat); real
  claude turn persisted to SQLite.
- **Phone (Phase 2/3):** open gateway URL on desktop + phone; chat + terminal; PWA install; replay.
- **App (Phase 4, Mac):** launch Tauri; confirm it boots the embedded Rust core.

## Constraints
- Repo control via `gh` only; no `git`/arc shell-outs (read repo state from `.git/*`). No commit/push
  unless asked. Native app (webkit2gtk/display) is Mac-side; devpod covers the headless web path.
