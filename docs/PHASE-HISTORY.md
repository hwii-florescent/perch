# Phase history

The full, phase-by-phase build record for perch. This is the long-form archive:
every phase's root causes, the things that were tried and rejected, and the
reasoning that would otherwise be re-derived later.

`PLAN.md` carries the one-line summary of each phase and is the file to read
first. Come here when you need to know *why* something is the way it is.

Nothing in here is current-state documentation — for how the system works
today, read `CLAUDE.md`.

---

## Phases

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

### Phase 10 — server-side event scoping + codex default — ✅ done
Two fixes found by auditing the environment rather than the code. **Zero protocol changes.**
- **`chat.*` is now scoped to the connections actually viewing a session.** A detached turn outlives
  the connection that started it, so `DetachedSink::emit` broadcasts on `hub_events_tx` and the
  per-connection forwarder relayed *every* event to *every* client. The web client had been patched
  to defend itself in Phase 9, but that left the client compensating for data it should never have
  received. New pure `should_forward_to_viewer(msg, conn_id, viewers)` consults the pre-existing
  `AppState.session_viewers` map and drops the six session-scoped variants (`chat.chunk`/`thinking`/
  `tool_use`/`tool_result`/`done`/`plan`) for connections not viewing that session.
- **The filter is deliberately fail-open** (`_ => true`): wrongly dropping a message breaks the
  sidebar / toasts / unseen dots, while wrongly forwarding one is merely the old behaviour. Every
  other variant — `session.*`, `host.*`, `workspace.git`, terminal, settings, worktree — forwards
  unconditionally, as does the bare `error` variant, which carries no session id to scope by.
- Verified all three delivery paths before trusting it, because only one of them is affected:
  local hosted chat goes `emit()` → `out_tx` **unicast**; perch-mode federated chat (all six
  variants, `ChatPlan` included) goes through `relay_unicast` — *neither touches this broadcast*.
  Only direct-mode detached turns do, and those sessions take the **local** `session.subscribe`
  branch (hub.rs: "no `remote_sessions` routing entry is ever created for them"), so
  `set_active_session` registers the viewer before any event arrives. A client switching in mid-turn
  is covered by registering as a viewer *before* the ring-buffer replay decision.
- **Codex's configured default model was being discarded.** `load_codex_models` parsed
  `~/.codex/config.toml` (yielding `model = "gpt-5.6-luna"` on this Mac), then hit
  `read_to_string(&catalog_path).ok()?` — an early return that threw the parsed default away when the
  catalogue file was missing, leaving the hardcoded `gpt-5.4-mini`. So perch preselected a model the
  user had not chosen. Now the static catalogue honours the configured slug: flagged in place if
  present, appended at the end if not (**never reordered** — the list keeps catalogue best-first
  order and only `isDefault` moves). No config or no `model` key → unchanged legacy behaviour.
- `parse_remote_codex_payload` had the same bug and was fixed identically. It matters more there:
  `hub.rs` substitutes the *local* machine's catalogue when the remote returns empty, so a direct
  host's configured default was being silently replaced by the laptop's.
- The missing-catalogue path now logs which default won; it was previously silent, which is why this
  went unnoticed. Note codex 0.146.0 writes no `model-catalog.json` at all on this Mac (searched
  `~/.codex`, `/Applications/Codex.app`, `~/.cache/codex-runtimes`), so the fallback is the permanent
  path here, not an edge case.
- Verified: `cargo test -p perch-core` **93/93** (82 + 11 codex + 6 filter), clippy at exactly the 5
  pre-existing warnings, `cargo fmt --check` clean, **full Playwright 93 tests / 91 passed / 2
  skipped / 0 failed**, and `federation.spec.ts` re-run in isolation **6/6** — E3 "remote hosted chat
  turn relayed through hub" is the test that would have caught over-filtering. Codex default
  confirmed over the wire: `gpt-5.6-luna` carries `isDefault`, list order intact.
- **Milestone: a connection now receives only the sessions it is watching, and the codex picker
  honours the user's own config.** ✅ verified.

### Phase 11 — `perch.app` bundle — ✅ done
The last deferred `PLANS.md` item. **No source changes at all** — this phase is a build,
a verification, and two documents.
- `cargo tauri build` (tauri-cli 2.11.4, installed for this) produces
  `target/release/bundle/macos/perch.app` (~14 MB) and `perch_0.0.1_aarch64.dmg` (~5.3 MB).
  `npm run build` must run first — `frontendDist` points at `packages/web/dist`, so the app
  bundles a *snapshot* of the UI and the PWA self-update path does not apply to it.
- **The Finder-launch risk is the whole reason this was blocked, and it is now proven fixed.**
  A GUI launch inherits launchd's minimal `PATH`, not the shell's, which historically left
  `claude`/`codex` unreachable. Tested with `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin`:
  `boot.rs`'s `adopt_login_shell_path()` recovers both `~/.local/bin` (claude) and
  `/opt/homebrew/bin` (codex), the server binds an ephemeral port and answers HTTP 200, zero
  ERROR lines. Verified from the build tree *and* from the installed `/Applications/perch.app`.
- `/Applications/perch.app` was already present and is byte-identical to this build
  (`shasum` matched on the binary), carrying only `com.apple.provenance` — no
  `com.apple.quarantine`, so it launches locally without intervention.
- **Distribution is deliberately not done**, and the reasons are recorded in
  `docs/DISTRIBUTION.md` rather than rediscovered later: the repo is private (a cask needs a
  public URL), the app is ad-hoc signed rather than notarized (Homebrew drops
  Gatekeeper-failing casks from the official repo on 2026-09-01, and `--no-quarantine` is
  being removed from `brew`), and the build is arm64-only. A filled-in cask template sits at
  `packaging/homebrew/perch.rb`.
- **Universal build skipped on purpose.** It is the least important of the three blockers, and
  `brew install rust` ships only `aarch64-apple-darwin` (a test `--target x86_64-apple-darwin`
  compile fails with `can't find crate for std`), so it would mean adding rustup — keg-only
  because it conflicts with `rust`, and usable only by shadowing brew's toolchain on `PATH`,
  which `boot.rs` would then propagate to every subprocess. The cask declares
  `depends_on arch: :arm64` so an Intel user gets a clean refusal instead of a crash.
- **Milestone: perch is a double-clickable Mac app that finds the user's CLIs from a cold GUI
  launch.** ✅ verified.

### Phase 11.1 — the bundle had no UI in it — ✅ fixed
Phase 11 shipped a bundle that booted and then showed the *placeholder* page ("Server is
running. No web client build found at this path"). Two bugs, one bad verification.
- **Root cause.** The desktop window uses `WebviewUrl::External` against the in-process axum
  server, so Tauri's embedded `frontendDist` is never consulted — axum serves the UI **from
  disk**. Nothing copied `packages/web/dist` into the `.app`, so `Contents/Resources/` held
  only `icon.icns`. Fix: `bundle.resources` in `tauri.conf.json` maps it to
  `Contents/Resources/web-dist`, and `resolve_web_dist_dir()` checks `../Resources/web-dist`
  first (before the dev-tree candidate, so a bundle can never resolve into a source checkout).
- **Second, pre-existing bug found while fixing the first.** The dev-tree candidate was
  `../../../packages/web/dist`, which from `<repo>/target/release` resolves to
  *`<parent-of-repo>`* — it had never matched. The dev tree only ever worked through the
  CWD-relative fallback, meaning `cargo run` from anywhere but the repo root served the
  placeholder too. Corrected to `../../`.
- **Why Phase 11 missed it: the verification was checking the wrong thing.** It asserted
  HTTP 200, and the placeholder page *is* an HTTP 200. Status code cannot distinguish the two.
  Re-verified properly: response body contains the app shell and zero occurrences of "No web
  client build found", `/assets/index-*.js` returns the full ~1.09 MB bundle, process launched
  from `/` under `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin` so neither the CWD fallback nor a
  rich PATH could mask the failure. Zero ERROR lines; `~/.local/bin` and `/opt/homebrew/bin`
  both present in the adopted PATH.
- `web_dist_from_exe_dir()` split out as a pure function with three unit tests (bundle layout,
  dev layout, no-match) so the path arithmetic is pinned instead of trusted.
- `/Applications/perch.app` replaced with the fixed build. Gate: 96 tests pass, `cargo fmt`
  clean, clippy still exactly 5 distinct warnings (both doc-list ones are in `agent.rs` /
  `server.rs`, untouched here).

### Phase 11.2 — public-repo sanitization + codex catalogue sync — ✅ done
Triggered by the repo going **public**. Two unrelated pieces of cleanup.

**History scrub.** A sweep found employer-internal identifiers not just in history but in
`HEAD`: internal hostnames (`PLAN.md`, `hosts.rs`), the internal npm registry (lockfile
history), the corp username, internal tooling names, and the internal AI-gateway provider
name. Three `git filter-repo --replace-text` passes rewrote all 23 commits, mapping everything
to neutral placeholders (`*.internal.example.com`, `corp-*`, `dev-*`).
- **Scope decision: prose and comments only, no refactor.** `herdr` (156 occurrences) and
  `devpod` (60) are woven through source, CSS class names, protocol fields and specs —
  renaming those is a refactor with regression risk, not a redaction, so they stayed. The
  codex model slugs (`gpt-5.6-sol`/`-terra`/`-luna`) also stayed: they are **real public codex
  models**, not internal names.
- **One claim corrected mid-flight:** the internal AI-gateway provider name (now
  `corp-gateway`) was first called functional and left in. It was not — `#[cfg(test)]` starts
  at `models.rs:546` and all three occurrences were test fixtures, so it was scrubbable, and
  was scrubbed. `gpt-5.6-terra` genuinely *is* functional (line 64, inside
  `CODEX_CATALOGUE`), which is why the model slugs were handled separately.
- **A force-push was not enough, and this is the reusable lesson.** After force-pushing the
  rewritten history, `gh api repos/…/contents/crates/perch-core/src/hosts.rs?ref=<old-sha>`
  still returned the real internal hostname — orphaned objects stay fetchable by SHA until
  GitHub GCs them. The repo was therefore **deleted and recreated**; the same call now returns
  422/404. Verified by fresh-cloning the published repo and scanning all 23 commits: zero hits
  for every scrubbed term.
- Backups (outside the repo, made before the destructive step):
  `~/perch-backup-20260804/` — `perch-PRE-SCRUB-original.bundle` (the real names, if ever
  needed), `perch-all-refs.bundle`, `perch-worktree.tar.gz`, `repo-metadata.json`.
- **Consequence for future work:** placeholders in the docs are not real values, and internal
  names must never be reintroduced. Recorded as the first bullet under "Constraints and
  gotchas" in `CLAUDE.md`.

**Codex catalogue sync.** `CODEX_CATALOGUE` had drifted from what codex actually serves:
dropped `gpt-5.4-nano` and `gpt-5.3-codex`, and swapped luna/terra to match codex's own
priority order (sol=1, terra=2, luna=3). Verified at runtime, not just by reading the
constant — the server logs `6 codex model(s)` with `default gpt-5.6-luna`, confirming the
`config.toml` default flows through `static_codex_catalogue()` instead of the hardcoded
`CODEX_FALLBACK_DEFAULT`.
- **Deliberately still hard-coded.** codex-cli 0.146.0 caches its server-fetched list at
  `~/.codex/models_cache.json` in *exactly* the shape `parse_codex_catalog` already reads, so
  wiring it up is a two-line change — **user decision not to**, so the picker cannot change
  underneath them. Re-sync by hand when codex ships new models. Noted in the module doc and
  `CLAUDE.md` so this isn't "helpfully" made dynamic later.
- Labels keep perch's space-separated style (`GPT-5.6 Sol`) rather than codex's hyphenated
  `display_name`, so runtime entries appended by `label_from_slug` match the built-ins.

### Phase 12 — CLI mode: emulator fidelity, gated start, session titles — ✅ done
Four user-reported CLI-mode complaints, all traced to distinct causes.

**1. The terminal didn't render what iTerm2 renders.** Both terminal views hand-rolled a
four-option `new Terminal({...})`; the options they *didn't* set were the bug. Consolidated
into `packages/web/src/xtermSetup.ts` (`createPerchTerminal`), now the only place a terminal
is configured.
- **`convertEol: true` was the headline fault** — it rewrites every bare `\n` into `\r\n`.
  Correct for a log pane, catastrophic for a full-screen TUI: the agent CLIs paint with
  absolute cursor moves and bare line feeds, so the implicit carriage return dragged writes
  back to column 0 and rows landed on top of each other. This is what "the text and options of
  model are bugged together" was — claude's model picker smearing into itself. Now `false`.
- **No ANSI palette.** `xtermThemeFromTokens` returned only `{background, foreground}`, so
  indexed colours fell back to xterm's stock ramp and selection highlights stopped separating
  from their own text. It now returns a full `ITheme` — 16-colour ramp, cursor, selection —
  derived from the same CSS tokens `applyTheme` sets. The bright ramp is computed by shifting
  *away from the background* (`shiftToward` + `isLight`), so light themes don't wash out.
- Unicode 11 widths (`@xterm/addon-unicode11`) — the CLIs draw with emoji and box-drawing
  glyphs, and one wrong width offsets the rest of the line. Plus scrollback 10000,
  `lineHeight: 1.0` (anything higher breaks box-drawing into dashes), `macOptionIsMeta` for
  Alt-word-motion in the composers.
- **Server side: the pty had no `TERM`.** Launched from Finder/Dock there is none in the
  environment at all, so the CLIs assumed a dumb tty. `terminal.rs::apply_terminal_env` now
  sets `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=perch` and a UTF-8 `LANG`
  hint *after* copying the parent env — deliberately overriding an inherited `TERM` too, since
  that describes the launching terminal, not the xterm.js instance rendering the bytes.
- **Deliberately not added: `@xterm/addon-webgl`.** Tried, then removed. Canvas renderers
  leave `.xterm-rows` empty, which would silently blind every e2e assertion that reads terminal
  text from the DOM (`chat-mode.spec.ts`, `cli-sync.spec.ts`). None of the faults above are
  throughput problems, so frames aren't worth that.

**2. Fixed 80x24 that broke on app resize.** Two causes. The refit listener was on `window`,
which never fires for the resizes that actually happen — dockview splitter drags, sidebar
toggles — so the emulator kept whatever grid it was born with. And `attachAgentCli` spawned
the CLI at a hardcoded 80x24, so its first frame was painted at the wrong width. Now a
`ResizeObserver` on the container (rAF-coalesced, since it fires per frame during a drag) and
the real measured `cols`/`rows` at attach. Fits are skipped when the container measures 0x0 —
a hidden dockview tab would otherwise push a degenerate 1-column size to the pty, and that
damage is server-side and survives the pane becoming visible again.

**3. CLI mode launched an agent before being asked to.** The transport mints a blank session
on every WS connect (`ws.ts`), and CLI mode reacted by spawning `claude --resume` into the
server's default cwd the moment the app opened. Now gated: the terminal mounts only for a
session that is either explicitly user-created this run (`cliStartedSessions`, armed by
`expectCliStart` in `createSessionOnHost` and consumed by the `session.created` handler) or
already carries `cliStarted` from the server. Everything else gets `CliStartPanel` — resume in
place, pick a known project, or browse. New protocol field `SessionSummary.cliStarted`
(`cli_started`, sourced from the existing `cli_activity` column) carries the durable half.

**4. Every CLI session was permanently "(new session)".** The auto-title is "first
`role='user'` row in `messages`", which a CLI session never has. New `cli_title.rs`
reconstructs the first submitted prompt from the `terminal.input` keystroke stream — a minimal
line-editor model (printables accumulate, backspace deletes, Ctrl-U/Ctrl-C abandon, Enter
submits) with a persistent escape-sequence state machine, since a `\x1b[` can be split across
WS frames. Stored in a new `cli_title` column, slotted into the title `COALESCE` below the
first-message title so a rename still wins.
- **Write-once is enforced in SQL**, not in the caller: the in-memory "already titled" set is
  gone after a restart, and without the `WHERE cli_title IS NULL OR cli_title = ''` guard the
  session's *next* prompt would look like its first.
- The `Option<CliTitleBuffer>` slot encodes vacant/buffering/settled in one map lookup, so an
  established session's keystrokes cost a lookup and nothing else on that hot path.
- Bare Enter (dismissing a trust prompt or menu) yields no title and keeps buffering, so the
  next real prompt still becomes one. Tab is dropped on purpose — in these TUIs it means
  "complete", not "insert a tab".

**Verified headless** against a real `claude` CLI on an isolated db: start panel with no pty
spawned → folder pick launches it → claude's TUI renders with correct borders/colours/columns
→ typing a prompt retitles the session in sidebar and tab bar → viewport resize reflows the
TUI cleanly. 106 core tests pass, clippy still at exactly its 5 pre-existing warnings.

### Phase 12.1 — CLI mode: the *actual* rendering bug, real terminal identity, scaling — ✅ done
Phase 12 fixed emulator *semantics* and the TUI still came out corrupted. Three further
causes, one of which was the real one all along.

**1. The corruption was in the byte path, not the emulator.** `terminal.rs`'s reader thread
decoded every 8 KiB pty read independently with `String::from_utf8_lossy`. A pty is a byte
stream with no regard for character boundaries, so a read constantly ends mid-glyph: the
truncated head became U+FFFD and the orphaned continuation bytes at the head of the *next*
read became one or two more. A replacement char is one cell wide where the box-drawing glyph
it ate was one and an emoji two, so every occurrence shifted the rest of the line — "lines
randomly rendered", random because it depended on where the buffer boundary happened to fall.
Fixed with a carry buffer (`split_utf8_tail`), which holds only a *truncated* trailing
sequence (≤3 bytes) and still decodes genuinely invalid bytes lossily so the stream can never
stall waiting for a completion that isn't coming. Four unit tests, including every cut
position of a 4-byte glyph.

**2. perch was restyling the agent's UI.** Phase 12 built the xterm theme by synthesising a
16-colour ANSI ramp from perch's own UI tokens. That is wrong on its face — the thing in the
pane is the same `claude`/`codex` the user runs in iTerm2, and its output is coloured by the
*terminal's* palette, so perch's palette silently repainted the agent's interface in colours
it never chose. New `iterm_profile.rs` reads the user's iTerm2 default profile (font + full
ANSI palette + cursor/selection) and ships it in `server.info` as `terminalProfile`; the
client hands it to xterm verbatim, and anything absent falls through to **xterm's own stock
defaults, never a perch token**. `xtermThemeFromTokens` was deleted rather than left around to
be reached for again, and `.terminal`'s padding/background went with it — a perch-coloured
inset framed the terminal in a colour the user's terminal never uses.
- **Font matters as much as colour.** The profile here is `MesloLGS-NF-Regular 13` — a Nerd
  Font. Substituting SF Mono renders powerline/icon glyphs at the wrong width and knocks every
  following column out of alignment, so the family is honoured and the generic stack is only
  *appended*.
- **`plutil -extract "New Bookmarks".0`, not `-convert`.** Converting the whole plist fails
  with "Invalid object in plist for JSON format" (data blobs live among the non-profile
  settings); the profile subtree alone is pure dicts/strings/numbers. Only unsuffixed colour
  keys are read — the `(Light)`/`(Dark)` variants are only authoritative when the profile's
  separate-light-dark-colours flag is on.

**3. Narrow panes now scale instead of reflowing.** The agent TUIs assume a conventional
width and wrap their panels into nonsense below it. `fitWithScaling` keeps `MIN_COLS = 80` by
shrinking the *font* — cell width is near-linear in font size, so the corrected size is
computed directly rather than searched for (≤3 passes, only to absorb xterm's pixel
quantisation), with a 7px floor so a phone degrades to ordinary reflow rather than
unreadability.

**Verified live, headless, against the real `claude` CLI on Haiku 4.5** — including `/model`,
the exact menu that used to smear into itself. Wide: `MesloLGS NF` 13px, background
`rgb(30,30,46)` (= the profile's `#1e1e2e`), 0 replacement chars. Narrow (720px viewport):
font auto-scaled to 9.5px, layout held at 81 columns, 0 replacement chars. Restoring width
returned the font to 13px. 115 core tests pass, clippy still exactly 5 pre-existing warnings,
`cargo fmt` clean.

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


### Phase 12.2 — verifying in the right browser engine — ✅ done
Phase 12.1's verification passed while the shipped app was still visibly wrong, and the reason
is worth keeping: **it ran only in headless Chromium.** The desktop app renders in WebKit
(WKWebView). Font matching, glyph fallback and sub-pixel cell metrics all differ between the
two, and a terminal emulator is *entirely* a question of whether each character lands in
exactly one cell — so Chromium-only was never evidence about the app.
- `e2e/cli-rendering.spec.ts` + `cli-rendering.config.ts` now run the same three checks under
  **both** engines, with WebKit at `deviceScaleFactor: 2` to mirror a Retina display. Assertions
  are structural (uniform row height, uniform row step, no row taller than its step, zero
  U+FFFD, typed text not sharing a row with a box rule) rather than text-matching, because the
  symptom being guarded against is *overlap*, not wrong characters.
- Screenshots are written to `e2e/screenshots-cli-rendering/<engine>/` — rendering is the one
  thing an assertion only partly describes. They are **gitignored**: they capture a real agent
  session, so claude's banner puts the account email, machine name and home directory in the
  frame, and this repo is public. Image content is also not something a later `git filter-repo`
  pass can be trusted to catch, which is exactly the mistake Phase 11.2 had to recover from.
- The spec saves and restores the developer's real `~/.perch/settings.json` `chatMode`, since
  that setting is global and not isolated by `--db-path`.
- **Single-resize fit.** `fitWithScaling` used to reset the font to base, fit, then scale down
  and fit again — driving `term.resize()` through an intermediate grid the PTY was never told
  about, on every resize tick. Each resize reflows xterm's buffer, so the agent's screen was
  reflowed to a shape it had not drawn for, mid-repaint. Now the size is computed from an
  off-terminal measurement and applied once, with at most one bounded correction (both in the
  same direction) to absorb the viewport scrollbar the estimate can't see.
- **PLAN.md was 933 lines.** The phase detail moved here; PLAN.md keeps a one-line-per-phase
  table and points at this file.
- **Outcome: user-confirmed fixed** in the installed `/Applications/perch.app`. The images that
  originally reported the breakage turned out to predate the UTF-8 carry fix and the terminal
  profile — both landed in a later build than the one that was installed at the time. The
  lesson stands regardless: verify in the engine the user runs, and rebuild + reinstall the
  bundle before asking whether a fix worked.
