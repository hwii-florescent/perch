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

### Phase 3.2 — Session lifecycle & spawn-env fixes — ✅ done
- `boot.rs` `scrub_nested_agent_env()`: strips `CLAUDE_CODE_CHILD_SESSION`/`CLAUDECODE`/
  `CLAUDE_CODE_ENTRYPOINT`/`CLAUDE_CODE_SSE_PORT` at startup in both binaries — spawned claude CLIs
  no longer inherit nesting markers ("Transcript saving is off" warning gone when perch itself is
  launched from a Claude Code session).
- New-session project picker: `session.create` += `cwd?` (validated server-side, `~` expansion;
  error, not create, on bad path); per-host "+" opens a portal popover — known project dirs on that
  host / "No project" (home) / free-text path.
- No empty-session clutter: session rows are inserted lazily on first user message (or CLI attach);
  `list_sessions` excludes zero-message rows; a fresh blank session lives in memory only and never
  shows in any sidebar; "+" reuses the active empty session instead of stacking new ones.
- Archive: `sessions.archived` column (guarded ALTER migration), `session.archive` client message
  both protocol sides, hub-routed for remote sessions, broadcast via `session.updated`; sidebar ⋯
  menu Archive/Unarchive, hidden by default, "Show archived" footer toggle reveals dimmed rows;
  active session never yanked while open.
- e2e: new `sessions.spec.ts` (S1 picker, S2 blank invisible until first message across tabs, S3
  "+"×2 no dupes, S4 archive round-trip); all pre-existing specs reworked for the new lifecycle AND
  for running against an empty db (seed-by-sending pattern, relative counts, claude trust-prompt
  handling in CLI tests). Suite: 28 passed / 1 documented skip.
- **Milestone: fresh app shows a clean sidebar that only ever lists real conversations; new chats
  choose their project; sessions archive; CLI mode is warning-free under nested launches.** ✅
  verified (Playwright headless, 28/1).

### Phase 3 — Headless + phone integration — ✅ done
- Wire web build into axum static-serve; verify end-to-end via the gateway URL; reconnect/replay on
  refresh (ring buffer). **Milestone: fully usable from the phone browser.** ✅ verified.

### Phase 4 — herdr UI/feature parity — ✅ done
Ported the subset of herdr's UI/UX (theme system, status glyphs, workspace/tab/pane model,
keybindings, pane splitting, mobile layout, git status, toasts) identified as worth adapting in
`/tmp/herdr-parity-plan.md`'s gap analysis; items marked "skip" there (plugin system, JSON control
API, full worktree CRUD, screen-scraping agent detection, lifecycle hooks) are intentionally not
present — perch's existing architecture (native CLI spawn, structured headless events, SQLite
persistence, hub federation) already covers the same ground more robustly. Landed as sub-phases
4.0–4.6 below; each kept the protocol-parity invariant (`protocol.rs` ↔ `protocol.ts` field-for-field)
and was e2e-verified before the next started.

- **4.0 — Semantic theme tokens + theme system.** `styles.css` `:root` gained the 16-token semantic
  palette (`--accent/--panel-bg/--surface-0/--surface-1/--surface-dim/--overlay-0/--overlay-1/--text/
  --subtext-0/--mauve/--green/--yellow/--red/--blue/--teal/--peach`) with the old names (`--bg/
  --surface/--border/--muted/--danger`) kept as aliases so no component CSS broke; new
  `packages/web/src/themes.ts` (`Palette` type, `PERCH_DEFAULT`, `THEMES` table, `THEME_NAMES`,
  `applyTheme()`) ships **19 themes**: `perch` (default) plus the full 18-theme herdr catalogue
  (`catppuccin`, `catppuccin-latte`, `terminal`, `tokyo-night`, `tokyo-night-day`, `dracula`, `nord`,
  `gruvbox`, `gruvbox-light`, `one-dark`, `one-light`, `solarized`, `solarized-light`, `kanagawa`,
  `kanagawa-lotus`, `rose-pine`, `rose-pine-dawn`, `vesper`), transcribed verbatim from
  `herdr-analysis-report.md` §5.15's palette table — no scope reduction from the plan.
  Protocol: `SettingsData.theme: string` (default `"perch"`) and `SettingsPatch.theme?: string`
  added to both `protocol.rs`/`protocol.ts` and mirrored in `settings.rs`'s own `Settings`/
  `SettingsPatch`; `server.rs` passes it through `settings.get`/`settings.update`. `SettingsModal.tsx`
  gained a Theme section (click-to-preview + persist, checkmark on the active entry). `store.ts` calls
  `applyTheme("perch")` at module load (no flash-of-unstyled-content) and re-applies from
  `settings.current` on every settings push. Verified: `theme.spec.ts`.
- **4.1 — Status glyph system (unseen/blocked).** `SessionSummary` gained `unseen: bool` and
  `blocked: bool` (both `#[serde(default)]`/optional, backward-compatible with older federated
  remotes) in both protocol files. Server: `AppState` gained `session_viewers` (session→viewing
  conn-ids), `unseen_sessions`, `blocked_sessions`; `ConnState.active_session_id` tracks what a
  connection is looking at; session subscribe/create/resume move viewer membership and clear
  `unseen`; turn completion marks a session unseen only if no connection is currently viewing it.
  Web: new `statusDot.ts` (`sessionDotState()`, mirrors herdr's `pane_agent_status(state, seen)`
  exactly: blocked > working > done(unseen) > idle) and `components/StatusDot.tsx`; `Sidebar.tsx` and
  `StatusBar.tsx` render it. The old pulsing `.session-status--running` animation was removed —
  herdr's dots are static; `.session-status`/`.agent-status-dot--*` in `styles.css` are static-only,
  confirmed no `@keyframes` remain on the status dot. Verified: `status-glyphs.spec.ts`.
- **4.2 — Workspace → Tab → Pane model.** New opaque-JSON protocol trio `session.layout.get` /
  `session.layout.set` (client→server) / `session.layout` (server→client) in both protocol files —
  the server never interprets the dockview `api.toJSON()` blob, only stores/echoes it. `db.rs` added
  a guarded `sessions.pane_layout TEXT` column migration plus `get_session_layout`/
  `set_session_layout` (UPDATE-only, matching the existing lazy-row-insert design from Phase 3.2's
  Fix 3 — a session row doesn't exist until its first message). `server.rs`'s `SessionLayoutSet`
  handler materializes the row first (`db.create_session`, `INSERT OR IGNORE`, cwd read from the
  in-memory `SessionRuntime` that's always populated by `session.create`/`subscribe`/`resume` before
  a layout can be set) so a pane rename/split on a still-blank session isn't a silent no-op — this
  was flagged as an open caveat going into the integration gate and was **confirmed correct in code**
  during this gate's audit: `list_sessions()`'s `WHERE EXISTS (SELECT 1 FROM messages ...)` filter
  means a materialized-but-still-message-less row stays invisible in the sidebar, so no ghost
  sessions are introduced. No code change was needed here. Both remote-routed through the hub the
  same way `chat.send`/`session.archive` are. Web: new `components/TabBar.tsx` (session strip scoped
  to the active project), `DockviewShell.tsx` fetches/restores/debounce-saves the active session's
  layout via `store.ts`'s `sessionLayouts`/`fetchSessionLayout`/`saveSessionLayout`. Verified:
  `workspace-tabs.spec.ts` (including a persisted-split round trip).
- **4.3 — Keybindings + Navigator (no protocol changes).** New `keybinds.ts` (`Ctrl+Space` leader
  chord + `Ctrl/Cmd+K` and plain `?` shortcuts, input/xterm-aware so typing never triggers a chord),
  `components/Navigator.tsx` (fuzzy session finder with state-filter chips, reuses `statusDot.ts`),
  `components/KeybindHelp.tsx` (searchable shortcut reference). `store.ts` gained
  `sidebarCollapsed`/`toggleSidebar()` and `switchSessionRelative(dir)`; `activeProjectSessions()`
  extracted as a shared export so `keybinds.ts` and `store.ts` scope "next/prev session" identically
  to `TabBar`. Verified: `keybindings.spec.ts` (K1–K5: Navigator open/filter/switch, help toggle,
  sidebar collapse, session cycling, pane keybinds).
- **4.4 — Pane context menu + mobile narrow-width collapse (no protocol changes).**
  `components/PaneContextMenu.tsx` (portal-rendered, same pattern as `ModelChip`'s popover) wired into
  `DockviewShell.tsx` for split/rename/zoom/close via dockview's native `addPanel`/`maximize`/
  `panel.api.close()`. New `responsive.ts` (`MOBILE_WIDTH_BREAKPOINT = 700`, `useIsMobileWidth()`);
  below it `App.tsx` swaps `Sidebar`+`TabBar` for new `components/MobileHeader.tsx` +
  `components/MobileSwitcher.tsx` (slide-over unifying sessions/projects/settings). Verified:
  `pane-splitting.spec.ts` (P1–P3, including a zoom/unzoom round trip through Phase 4.2's layout
  persistence) and `responsive.spec.ts` (R1–R2 collapse/switcher; desktop viewport unaffected).
- **4.5 — Git ahead/behind + toasts + blocked-state detection.** New `ServerMessage::WorkspaceGit
  {hostId, cwd, branch?, ahead, behind}` in both protocol files, hub-rewritten to the federated
  host's id before fan-out (`hub.rs`). `status.rs` added `get_ahead_behind()`, the one intentional
  `git` subprocess shell-out in the codebase (`git rev-list --left-right --count @{u}...HEAD` —
  ahead/behind against a remote-tracking branch isn't reconstructable from pure `.git/*` parsing);
  a background poll task in `server.rs` fingerprints `(cwd, branch)` to skip redundant subprocess
  calls and pushes on change. Blocked-state detection: `server.rs` scans CLI-attached terminal output
  (ANSI-stripped tail) against three regexes (`blocked_patterns()` — generic "do you want to proceed"/
  "would you like to"/"allow command?"/"action required" approval-prompt phrasing covering both
  claude's and codex's prompt styles) and maintains `blocked_sessions`, feeding Phase 4.1's `blocked`
  field. Web: `store.ts`'s `workspaceGit` map renders ahead/behind badges in `Sidebar.tsx`'s project
  headers; new `components/Toast.tsx` shows a dismissible toast, driven purely from
  `session.updated` running→idle transitions on a non-active session (no new protocol needed for
  toasts themselves). Verified: `workspace-git.spec.ts`, `toasts.spec.ts`; blocked-pattern matching
  verified via inline unit tests in `server.rs` against realistic ANSI-laden prompt text (documented
  as manual/unit-level verification only, consistent with this repo's existing tolerance for
  CLI-prompt-timing e2e flakiness).
- **4.6 — Final integration gate.** Consistency sweep across all of the above: `styles.css` checked
  for duplicate/conflicting selectors and stray raw hex (found none outside the pre-existing,
  deliberately theme-independent `.mode-switch` block and black-only `rgba(0,0,0,*)` shadows —
  no leftover pulsing status-dot CSS); `store.ts` fields/actions checked for naming consistency and
  dead code (none found — every new field/action added in 4.0–4.5 is consumed by at least one
  component); full protocol parity re-diffed field-for-field between `protocol.rs` and `protocol.ts`
  for every message touched (`SettingsData`/`SettingsPatch.theme`, `SessionSummary.unseen`/`blocked`,
  the `session.layout*` trio, `WorkspaceGit`) — all camelCase wire names match exactly. Full
  `testMatch` suite (54 tests incl. federation against the real devpod SSH host), `cargo clippy
  --workspace --all-targets`, `cargo build -p perch-core`, `cargo build -p perch-desktop`, and
  `npm run build` all run clean with no new warnings/failures attributable to this effort.
- **Milestone: herdr's theme/status/tab/keybind/pane/mobile/git/toast UX is ported into perch's
  Rust-core/thin-TS architecture with zero protocol drift and no regressions in the pre-existing
  suite.** ✅ verified.

### Phase 5.W — herdr Wave 2: git worktree management — ✅ done
The largest remaining herdr gap (Section B of the gap inventory; explicitly deferred as "full
worktree CRUD" in Phase 4's skip list, now landed).
- **Rust:** new `crates/perch-core/src/worktree.rs` — ports herdr's `src/worktree.rs`
  (`branch_to_path_slug`, `parse_worktree_list_porcelain`, new-vs-existing-branch `worktree add`
  command shapes, dirty detection, the forced-remove leftover-checkout recovery) onto async,
  timeout-bounded `tokio::process` git calls. Documented as the module-level exception to
  `status.rs`'s "never shell out to git" policy (mutating porcelain — reimplementing the linked
  worktree admin bookkeeping would be reimplementing git). Default checkout root
  `~/.perch/worktrees/<repo-name>/<branch-slug>` (perch's analog of `~/.herdr/worktrees`),
  overridable per create. 5 unit tests (porcelain parsing incl. bare/prunable/detached, slug
  sanitization incl. traversal collapse, default path, git error classification).
- **Protocol (both files, camelCase):** `worktree.list` / `worktree.create` / `worktree.remove`
  client messages and `worktree.list.result` / `worktree.done` / `worktree.error` server messages,
  plus the shared `WorktreeEntry` value type. Request-correlated by `requestId` exactly like
  `fs.browse`; hub-routed for federated hosts via a new single-shot `PendingKey::Worktree`.
- **Guard semantics:** removal of a dirty checkout is refused (`worktree.error { dirty: true }`)
  and the client escalates into a force confirmation — herdr's `force_confirmation` two-step, kept
  as attempt-then-escalate rather than a client-side pre-check so the guard always reflects the
  checkout at the moment of removal. The branch is never deleted with the worktree.
- **UI:** `components/WorktreeMenu.tsx`, mounted from the sidebar project header (branch-glyph
  button, rendered only when `workspaceGit[key].branch` proves the cwd is a git checkout).
  Portal popover lists every worktree (branch, path, `primary`/`dirty` badges), "Open" = create a
  session with that worktree as cwd (perch's analog of herdr opening a workspace on the checkout),
  "New worktree…" form (branch + new-branch checkbox + path prefilled from the server-reported
  default root), "Remove" via the shared `ConfirmDialog`. Store cache `worktrees[${hostId}:${repoPath}]`.
- **Keybind:** leader,`W` (capital — distinct from leader,`w`'s next-project jump, resolved by an
  exact-key lookup before the case-insensitive fallback) opens the active project's worktree menu.
- Also fixed a latent federation bug found while extending the same mechanism: forwarded
  `fs.browse` kept its `hostId`, so the receiving remote tried to route it onward to an unknown
  host instead of answering locally. Both `fs.browse` and `worktree.*` now forward host-stripped
  JSON (`strip_host_id`), matching what the `session.create` arm already did by hand.
- e2e: new `e2e/worktrees.spec.ts` (WT1 primary listed, WT2 create-on-new-branch lands on disk at
  the default location, WT3 Open starts a session in the worktree, WT4 clean remove, WT5 dirty
  guard then forced remove) against a throwaway temp-dir fixture repo. Verified green together
  with `sidebar`/`wave1`/`workspace-git` (21/21), alongside clean `cargo clippy --workspace
  --all-targets`, `cargo build -p perch-core`, `cargo build -p perch-desktop`, `npm run build`.

### Phase 6 — Detached mode (`mode: "direct"` hosts) — ✅ done

A second kind of remote host, alongside classic perch↔perch federation. A **direct** host needs
only `claude`/`codex` + `tmux` — **no perch, no Rust toolchain, no tunnel, no agent forwarding**.
perch drives the CLIs over `ssh` and runs every hosted turn *detached*, so a turn survives closing
the laptop **and** quitting (or crashing) perch.

- **Config**: `SshHost.mode` = `"perch"` (default, unchanged behaviour for every existing
  `hosts.json`) | `"direct"`; mirrored in `protocol.rs` ↔ `packages/shared/src/protocol.ts`,
  editable per host in Settings, badged `direct` in the sidebar's host switcher.
- **`ssh.rs`** — the one bounded-`ssh` plumbing layer both host modes share: `run_ssh_bounded`
  (lifted out of `hub.rs`), `run_remote`, stdin-fed `write_remote_file`, `shell_quote`, a
  one-round-trip host prereq/version probe, and the tail primitives (`stat_remote_file`,
  `TailCursor` = offset + inode + truncation check, `spawn_tail`).
- **`detached.rs`** — the runner. Launch is one bounded ssh that writes a `perch.meta` header
  line, then `bash -c 'set -m; nohup sh -c "<cli> < prompt >> run.jsonl" &'` (bash because zsh
  refuses `set -m` and dash silently leaves the job in the parent's process group), reading the
  real pgid back from `ps`. perch then follows `run.jsonl` with `tail -c +<offset> -F` over a
  keepalive'd ssh and feeds the lines to **`agent.rs`'s factored `ClaudeStreamParser` /
  `CodexStreamParser`** — the same parsers local turns use, which is what makes a detached turn
  render identically. Completion is in-band (`{"type":"result"}` / `turn.completed`, plus a
  synthetic `{"type":"perch.exit","code":N}` appended by the shell chain). Cancel is
  `kill -TERM -<pgid>` then `-KILL`. Recovery on startup is tri-state (alive → re-tail; dead +
  marker → finalize and scrape the provider session id; dead + no marker → crashed, with a
  fallback scrape of claude's own `~/.claude/projects/<slug>/<sessionId>.jsonl`). A
  per-run `active_tails` set is the single-tailer guard; `pending_cancels` covers
  cancel-before-spawn; run dirs older than 7 days are swept on host connect.
- **`hub.rs`** — `direct_connection_task`: probe → `Connected` with the static `models.rs`
  catalogue filtered to the CLIs actually present; no tunnel, no auto-start, periodic re-probe.
- **`db.rs`** — `sessions.host_id` (direct sessions live in the *local* DB tagged with their
  host) + a `detached_runs` table (pid, pgid, start-time identity, cursor, provider session id,
  status) as the durable half of recovery.
- **`server.rs`** — direct-host routing for session create/prompt/cancel/delete/list,
  `fs.browse` over ssh (real remote directory listing incl. `.git` detection — no typed-path
  fallback needed), and CLI mode as a local PTY running
  `ssh -tt <host> tmux new-session -A -s perch-cli-<id> '<cli resume>'`. Detached turns stream
  through a `TurnSink` implemented over `AppState`, so they are **not** cancelled when the WS
  connection that started them closes.
- **Verified end-to-end against a devpod** (isolated `:7806` + `/tmp` db/hosts): claude turn
  streams → second turn ("count 1→20") → `kill -9` of perch mid-turn → fresh perch recovers the
  session with the **complete** 1..20 output and `--resume` continuity intact (turn 3 answers
  "20") → cancel kills the whole process group with zero survivors → CLI mode attaches a live
  `claude` TUI in remote tmux. Codex verified on the same host, including `codex exec resume`
  thread continuity. e2e: new `detached.spec.ts` (mode select, direct badge, unreachable-host
  error, plus a devpod-gated full-turn test enabled with `PERCH_E2E_DIRECT_SSH_HOST`).
- **Known gap, by design**: headless `-p`/`exec` has no approval channel, so detached turns run
  `bypassPermissions`. Real approvals need CLI mode (or, for codex, a future app-server backend).

### Phase 7 — Hosted composer power features (UI) — ✅ done
The composer half of `PLANS.md` item 1. The Rust server, the WS protocol, the store layer and the
pure helpers had all landed in the previous pass (77 Rust unit tests green); only the React UI was
never built, leaving `Chat.tsx` importing `activeSigilToken`/`applyCommand`/`filterCommands`/
`uploadAttachment`/`PLAN_APPROVAL_TEXT` without using any of them. **This phase changed zero protocol
code** — `protocol.rs` ↔ `protocol.ts` were not touched, and neither was any Rust file. Every field
these features send already existed on both sides.
- **Slash / skill autocomplete**: new `components/SlashPopover.tsx` (presentational) + the state
  machine in `ChatView`. "Open" is *derived* per render from `activeSigilToken(text, caret, sigil)`
  rather than stored, so the menu can't drift out of sync with the textarea; the one piece of real
  state is `dismissedTokenStart` (Escape closes without touching the text). Sigil is per-agent
  (`/` claude, `$` codex) and `CommandEntry.name` is bare, so the UI prepends it. Keyboard handling
  sits *ahead* of the existing Enter-submits handler, so Enter accepts a suggestion instead of
  sending the turn while the popover is open. Positioned with the pre-existing
  `computeAnchoredPopoverStyle(..., { align: "left" })` and portal-rendered to escape dockview's
  `overflow:hidden`. Caret restore after `applyCommand` waits a frame — React controls the textarea,
  so `setSelectionRange` before the re-render would be clobbered.
- **Plan mode**: new `components/PlanCard.tsx` + a `composer-plan-toggle`. The message list branches
  on the existing `kind: "plan"` (the store already inserts plan cards *ahead* of the streaming
  bubble, so transcript order reflects what actually happened). "Approve & run" always sends
  `PLAN_APPROVAL_TEXT` with plan mode **off** regardless of the toggle's own state — otherwise the
  agent replies with another plan instead of executing — and `planApproved` spends the button while
  leaving the card as a record. The toggle is a standing mode, not one-shot. Plan cards are
  claude-only (2.1.x has no `ExitPlanMode`; `agent.rs` treats a `Write` under `/.claude/plans/` as
  the plan), so the toggle deliberately carries no agent-conditional logic and promises no card.
- **Attachments**: new `components/AttachmentBar.tsx` — attach button, hidden multi-file input, and
  drag-drop on `.chat__input`. Uploads go through the pre-existing `attachments.ts` helper (25 MB cap,
  `POST {base}upload`), partial failures keep their successes (`allSettled`), and Send is disabled
  while any upload is in flight. Chips are **name-only by design**: no `FileReader`, no
  `createObjectURL`, so the raw bytes never enter the DOM — the client-side half of the guarantee
  `strip_image_blocks` provides server-side. Only staged server paths reach `chat.send`. Staging is
  always local even for direct-mode hosts (`detached.rs` pushes to the remote run dir over ssh), so
  there is no host-conditional logic.
- Extracted `renderMarkdown` into a new `packages/web/src/markdown.ts`: PlanCard needs it and is
  itself imported by `Chat.tsx`, which would otherwise have made the two modules circular.
- e2e: new `e2e/chat-power.spec.ts` (added to `testMatch`) — P1 slash popover + ArrowDown/Enter
  accept; P2 plan round trip asserting on the **filesystem** (target file absent while the card
  shows, created after approval — a real check that `--permission-mode plan` suppressed the write);
  P3 attachment round trip asserting the reply names the colour **and** that the DOM contains no
  `data:image` and no attribute/text node over 2000 chars; P4 codex low-effort regression guard.
- Verified: P1/P2/P3 green against real claude turns; P4 skips cleanly because **codex is not
  installed on this Mac** (see `PLANS.md`). Additional headless UI verification against an isolated
  instance confirmed 40 real command rows in the popover, `/agents ` inserted with its trailing
  space, the plan card's markdown + Approve button, the staged chip with working ✕, and
  `data:image` absent from the DOM while staged. `cargo build` (both crates), `cargo clippy
  --workspace --all-targets` (exactly the 5 pre-existing warnings, zero new), `cargo test -p
  perch-core` (76/77 — the one failure is the documented `ssh::tests::mux_control_path…` test-order
  flake, which passes in isolation), and `npm run build` all clean. **Full Playwright suite: 93 tests,
  90 passed / 3 skipped / 0 failed** (5.4 min) — the skips are `cli-sync` A1 (unconditional,
  long-documented: a server-side CLI attach failure can't be forced without mocking), `chat-power` P4
  (codex not installed on this machine), and one content-dependent `chat-ui` skip that fires when a
  real turn happens to produce no tool call.
- **Milestone: the Hosted composer now offers slash/skill autocomplete, plan mode with an approval
  card, and file attachments — against a backend that already supported all three.** ✅ verified.

### Phase 8 — optimization pass — ✅ done
The preemptive items audited during Phase 7. No felt slowness had been reported, so the bar was:
measurably better *and* provably behaviour-preserving, or it doesn't ship. **Zero protocol changes**
— five files touched in total.
- **Streaming render** (`views/Chat.tsx`, `store.ts`): a single `chat.chunk` used to copy the whole
  `messages` array, re-render *every* bubble, and re-run `repairMarkdown` + `marked.parse` +
  `DOMPurify.sanitize` over each bubble's full text — O(transcript²) per turn. `MessageBubble` is now
  `memo`ised (default shallow comparator is correct because the store replaces `ChatMessage` objects
  immutably; `onCopyToInput` is a raw `useState` setter, so already stable), the markdown is behind a
  `useMemo` keyed on `[message.text, isStreaming]`, and `chat.chunk` text is coalesced into one store
  write per animation frame. **Measured: 65 → 4 `renderMarkdown` calls for one turn in an 18-message
  transcript (16×).**
- The rAF buffer's **load-bearing invariant**: anything that reads or replaces `messages` must flush
  it *synchronously* first, because `updateStreamingMessage` no-ops once `streamingMessageId` is
  cleared — a late flush drops text rather than misapplying it. `handleServerMessage` therefore
  flushes up front for every message type except `chat.chunk` itself, and `switchSession`,
  `createSessionOnHost`, `switchAwayFromActiveSession` and the disconnect handler each flush before
  resetting state. Backgrounded tabs stop firing rAF, which is safe *only* because of that rule:
  `chat.done` flushes on arrival.
- **Database access** (`db.rs`, `server.rs`): added the missing
  `messages(session_id, role, id)` index — the schema previously had exactly one index, on
  `detached_runs`, while `list_sessions()` ran a `WHERE EXISTS` plus three correlated subqueries all
  of that shape. **Measured on 200 sessions × 200 messages (40k rows): `list_sessions()` 354 ms → 0.60
  ms; `EXPLAIN QUERY PLAN` moves from `SCAN messages` ×3 to `SEARCH … USING INDEX`.** Verified the
  migration applies to *existing* databases (`migrate()` runs on every `open()`), not just fresh ones.
- Added `HistoryDb::get_session_row(id)` — the `session_events_tx` forwarder was running the entire
  `list_sessions()` query once per event *per connected client* only to `.find()` one row. The shared
  `SELECT` body and row-mapping function are factored into `SESSION_LIST_ROW_SELECT` /
  `session_list_row_from_row` so a `session.updated` push can never disagree with the same row in
  `session.list`. It deliberately keeps the `WHERE EXISTS` message filter: the old `.find()` over the
  filtered list already skipped messageless sessions, so dropping it would be an observable change.
- The git poll no longer shells out `git` per cwd every 5 s with **zero clients connected**. Gated on
  a `connected_clients: AtomicUsize` (decremented by an RAII `ConnCountGuard`, so no exit path can
  forget it), with a `Notify` that runs a prompt pass on connect — preserving the pre-existing
  "cache warm by first connect" property that `handle_socket` depends on.
- **Release profile**: added `[profile.release]` with `lto = "thin"` + `codegen-units = 1`.
  **Measured A/B on an identical source tree: 10,176,752 → 8,304,000 bytes (−1.79 MB, −18.4%)**, at
  roughly +60% build time.
- **`panic = "abort"` was planned and deliberately rejected.** There is no `catch_unwind` in the
  crate, so the planned check passed — but that check was aimed at the wrong risk. perch runs ~22
  long-lived `tokio::spawn` tasks (per connection, per terminal, per hub host) and unwraps mutex
  guards throughout; unwinding is what keeps a panic in one connection's task from taking down every
  other session and every in-flight agent turn. Availability of a long-lived server beats a marginal
  size win. Reasoning is recorded in a comment above the profile block.
- Verified: `cargo build` (both crates), `cargo clippy --workspace --all-targets` (exactly the 5
  pre-existing warnings, zero new), `cargo test -p perch-core` **78/78 green** (77 baseline + one new
  correctness test asserting `get_session_row` agrees field-for-field with `list_sessions`; timings
  are printed, never asserted, so the test can't go flaky on a loaded machine), `npm run build` clean.
  **Full Playwright suite: 93 tests, 91 passed / 2 skipped / 0 failed** (5.3 min) — one better than
  the Phase 7 baseline of 90/3, since a content-dependent `chat-ui` skip didn't fire. Plus a headless
  streaming smoke confirming a completed reply is exact and does not change after several idle frames
  (the direct test that the rAF buffer strands nothing). `~/.perch/settings.json` verified byte-
  identical after the suite.
- **Milestone: the two quadratic hot paths are gone and the server no longer works when nobody is
  watching — with no protocol change and no behaviour change.** ✅ verified.

### Phase 9 — open-item cleanup — ✅ done
The `PLANS.md` backlog items, minus the Tauri bundle (explicitly deferred). **Zero protocol changes.**
- **CLI-only sessions are now reachable in the nav.** Chat mode is global, and in CLI mode a session's
  activity is a real PTY — nothing is ever written to `messages` — so `list_sessions()`'s
  `WHERE EXISTS (... messages ...)` hid such sessions forever. The trap: `AgentCliTerminal` attaches
  its PTY *on mount*, so marking "has a CLI terminal" would have un-hidden the blank throwaway
  session perch mints on every connect — exactly the junk that filter exists to suppress. So the
  marker is **first keystroke** (`cli_activity` column, set from the `terminal.input` handler via the
  `terminal_agent_sessions` map that already existed for blocked-state bookkeeping), mirroring
  Hosted's first-user-message rule. Deduped through an `AppState` set so the per-keystroke hot path
  pays for the DB write + broadcast once per session; the flag is monotonic, so the set can't go
  stale. The predicate is factored into `SESSION_VISIBILITY_FILTER` shared by `list_sessions` and
  `get_session_row`, for the same anti-drift reason as `SESSION_LIST_ROW_SELECT`.
- Verified over the WS protocol directly rather than the UI (chat mode is a *client-side* setting, so
  the server behaves identically and the shared `settings.json` never had to be touched): after
  `agentAttach` with no keystroke the session is absent from `session.list`; after the first
  keystroke it is present, `cli_activity = 1`, and one `session.updated` is pushed so the sidebar
  updates live. Migration confirmed against a copy of the real `~/.perch/history.sqlite`.
- **Detached recovery live-update wart — root cause was broader than reported.** There is no
  `chat.start` message on the wire at all: the streaming bubble is minted *client-side* in `sendChat`
  by whichever page sent the turn. Any client that didn't initiate a turn therefore has
  `streamingMessageId === null`, and `updateStreamingMessage`'s early return silently discarded the
  entire turn. Recovery was just the most visible case (after a restart nobody holds a placeholder).
  Fixed with `adoptStreamingMessage(sessionId)`: mint-and-adopt a placeholder when an event arrives
  for the open session with nothing streaming. Adoption happens **before** the chunk is buffered —
  Phase 8's rAF flush applies through `updateStreamingMessage`, so buffering first would have thrown
  the text away.
- **Fixed an adjacent cross-session bug found while reviewing that.** The hub forwarder relays
  detached events to *every* connection with no session filter, and neither the chunk buffer nor
  `chat.done` checked which session an event belonged to — so session B's text could be appended into
  session A's bubble, and B's completion could end A's stream mid-turn. `adoptStreamingMessage`'s
  `false` return (and a matching guard in `chat.done`) now makes callers ignore foreign events.
  Pre-existing, not introduced by Phase 8. The server-side half is logged in `PLANS.md`.
- **Fixed the order-dependent `ssh::tests::mux_control_path…` flake** (reproduced: failed on run 3 of
  3, with a 121-byte path against a 100-byte limit). `control_dir()` memoises `$HOME` in a `OnceLock`
  while sibling tests repoint `$HOME` at a uuid-named temp dir, so whichever test won the race decided
  the cached value. Extracted a pure `control_dir_for_home()` and assert on that with a fixed
  realistic `$HOME`; a separate test still covers `mux_opts()`'s shape. **6/6 clean full-suite runs.**
- Verified: `cargo test -p perch-core` **82/82 green** (79 + 3 new), clippy at exactly the 5
  pre-existing warnings, `npm run build` clean, **full Playwright 93 tests / 91 passed / 2 skipped /
  0 failed**, `~/.perch/settings.json` byte-identical afterward.
- **Milestone: CLI-mode sessions are navigable, and a turn you didn't start now renders live instead
  of vanishing.** ✅ verified.

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

### Deferred out of Phase 8 — considered and not done
Each of these was examined during Phase 8 and left alone on purpose; the reasoning is here so it
isn't re-derived.
- **`spawn_blocking` for rusqlite** — every DB call still runs inline on a tokio worker behind a
  `std::sync::Mutex<Connection>`. Wrapping them would make the whole `HistoryDb` API async and ripple
  through every call site, adding real deadlock surface, for a local SQLite file that — now that it
  is indexed — answers in microseconds. Revisit only if a measurement shows actual runtime stalls.
- **Ring buffer holds cloned `ServerMessage`s including every `chat.chunk`** (500/session);
  `DetachedSink` additionally clones each chunk per connected client out of its `Arc`. Dropping
  chunks would shrink it a lot, but replaying them is how a reconnecting client rebuilds a mid-turn
  partial message — that's a design decision about reconnect semantics, not an optimization.
- **Structure/test gaps**: `server.rs` ~2700 lines, `store.ts` ~1500, `styles.css` ~4000; protocol
  parity is hand-maintained with no test asserting it; `registry.rs`, `hub.rs`, `protocol.rs`,
  `settings.rs`, `hosts.rs`, `status.rs`, `terminal.rs` have zero unit tests (`db.rs` gained one in
  Phase 8). Maintainability rather than speed — worth its own phase.
- Already optimized, leave alone: `terminalBus.ts` deliberately bypasses zustand for PTY bytes.

---

## How to run

**Devpod headless:**
```bash
source $HOME/.cargo/env
cd /home/user/perch
cargo run -p perch-core -- --port 7788
```
Phone access: run `devpod serve :7788/` on the devpod (with `DEVPOD_NAME` and `DEVPOD_REGION` exported); it assigns a port and prints the gateway URL (`https://devpod-gateway.internal.example.com/proxy/<user>/<assigned-port>/`). The old `/proxy/dev-personal/7788/` static path is no longer used.

**Mac desktop:**
```bash
cargo run -p perch-desktop   # boots core in-process on a free port, opens a window
```
`PERCH_DESKTOP_TEST=1` runs the window hidden and unfocused (for automation).

**Usual federation flow:** run the app locally, add devpod hosts in Settings; the hub auto-starts the remote perch in a tmux session and keeps it connected.

## Verification approach
- **Core:** cargo build + WS smoke test (session/terminal/chat) + real claude turn persisted to SQLite. ✅ done (Phase 1).
- **Web/phone:** gateway URL + chat + terminal + PWA install. ✅ done (Phase 2/3).
- **Desktop (Mac):** hidden-window launch via `PERCH_DESKTOP_TEST=1`; WebView auto-created session over WS. ✅ done (Phase 3.1).
- **Ongoing:** committed Playwright e2e suite in `e2e/` (hub `:7799` + federated remote `:7800`).

## Constraints
- Repo control via `gh` only; no `git`/arc shell-outs (read repo state from `.git/*`). No commit/push
  unless asked. Native app (webkit2gtk/display) is Mac-side; devpod covers the headless web path.
