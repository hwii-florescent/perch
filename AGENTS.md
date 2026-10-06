# AGENTS.md

The only guidance file for coding agents in this repo (there is no `CLAUDE.md`).

## perch

A personal IDE for babysitting AI agents. **Rust owns all logic and data**
(`crates/perch-core`: one axum HTTP+WS server, SQLite). **React is a thin
view** (`packages/web`) talking to it over WebSocket. It ships two ways from the
same core: the Tauri desktop app (`crates/perch-desktop` runs the core
in-process) and a headless web server (`perch-core`). Terminals live in
**perchd** (`crates/perchd`), a detached PTY daemon, so they survive the app
quitting.

**Direction (2026-10-01):** a fast, lightweight agent IDE in Rust, **CLI
mode first**. perch is not a port of [Orca](https://github.com/stablyai/orca)
(cloned at `~/Github/orca`): it learns from Orca's design and invariants,
borrows what fits, and builds features Orca doesn't have. The Hosted/UI chat
surface is frozen: don't extend it.
- `docs/ARCHITECTURE.md`: the design and build order.
- `docs/ORCA-PARITY.md`: what perch has of Orca's features, as a reference
  list, not a spec to match.

## Commands

```sh
cargo test -p perch-core            # ~290 tests, a few seconds; add a substring to filter
cargo test -p perchd                # daemon unit + integration tests
npm install && npm run build        # builds packages/shared then packages/web → packages/web/dist (served by axum)
npm test                            # web unit tests (vitest)
cargo fmt --check && cargo clippy --workspace --all-targets   # expect exactly 5 existing warnings; add none
cargo run -p perch-core -- --port 7788     # flags/env: --db-path PERCH_DB, --hosts-path PERCH_HOSTS, PERCHD_DIR, PERCH_SETTINGS, --headless, --base-path
cargo run -p perch-desktop                 # macOS / Linux+webkit2gtk; PERCH_DESKTOP_TEST=1 = hidden, unfocused window
npm run build && (cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build)   # installers
scripts/reinstall-desktop.sh               # macOS: build perch.app, quit, install to /Applications, reopen (perchd keeps running)
cd e2e && npx playwright test <spec> [-g name]   # boots :7799 + :7800 itself; real agent turns
cd e2e && npx playwright test -c worktree-lifecycle.config.ts   # phase 3, own core on :7796
```

Releases: `.github/workflows/release.yml`. A `v*` tag drafts a GitHub release
with the macOS `.dmg`, the Linux `.deb/.rpm/.AppImage` and static
`perchd-linux-{x86_64,aarch64}`; `gh workflow run release.yml` is a dry run.
Windows is not ported.

## Code map

Read a module's `//!` header before changing it; the load-bearing details are
there, not here.

- **Server:** `server/mod.rs` (AppState, WS connection handling, background
  tasks; the transition bridge in `spawn_agent_turn_state_task` owns the
  sidebar's running/blocked sets). `server/dispatch.rs` routes every client
  message. `server/{session,terminal,agents,native_ui,workspace,git,fs,reviews,config}.rs`;
  `server/worktree_jobs.rs` runs background worktree creates (`worktree.job.*`).
- **Protocol:** `protocol.rs` ⇄ `packages/shared/src/protocol.ts`.
- **Agents:**
  - `agent_fleet.rs`: provider manifests and the `AgentLifecycleRegistry`
    state machine.
  - `agent_runtime.rs`: launches CLI panes.
  - `agent_persistence.rs`.
  - `agent.rs`: Hosted-mode `claude -p` / `codex exec` runners.
  - `agent_title.rs`: status from the OSC title, for CLIs with no native
    bridge (Orca's title rules).
  - `native_ui/`: observes each CLI's own events. Claude through per-launch
    `--settings` hooks written as files; Codex through its app-server; pi/omp
    through a socket; OpenCode.
- **Terminals:**
  - `terminal.rs`: agent PTYs, now served by perchd.
  - `workspace_terminals.rs`: shell panes.
  - `surfaces.rs`: canonical host-qualified Terminal/File/Diff resources and
    per-viewer presentation (capability `surface.v1`); one-time idempotent
    import of legacy session layouts and file tabs, originals kept.
  - `daemon.rs`: the runtime's perchd client. The daemon is the app binary
    re-run as `<exe> __perchd serve`.
  - `crates/perchd`: the socket protocol, history-log replay and vt100
    snapshots.
- **Remote:**
  - `hub.rs`: remote hosts. Mode `perch` is a full remote perch reached
    through an ssh tunnel. Mode `direct` needs only claude/codex + tmux on
    the host.
  - `detached.rs`: direct-mode turns in tmux.
  - `ssh.rs`: every remote call goes through it, always via the `ssh` CLI
    and never an ssh crate.
- **Data:**
  - `db/`: `~/.perch/history.sqlite`.
  - `settings.rs`, `hosts.rs`: `~/.perch/*.json`, written atomically.
  - `models.rs`: model lists, per host.
  - `worktree.rs`, `source_control.rs`, `review.rs`, `filesystem.rs`.
- **Other:**
  - `boot.rs`: startup. Adopts the login-shell PATH so Dock/Finder launches
    find brew tools, claude and codex.
  - `iterm_profile.rs` / `ghostty_profile.rs`: the user's terminal theme.
- **Web** (`packages/web/src`):
  - `store/index.ts`: the Zustand store, the single source of WS-driven state.
  - `xtermSetup.ts`: builds every terminal.
  - `agentTerminals.ts`: CLI panes.
  - `Sidebar.tsx` (Projects → Workspaces → sessions).
  - `viewer.ts`: a window's viewer id (Web Lock per window, restart reclaims
    the last free one); local tab/split/order keys and the window's session and
    project/workspace ids carry `@<viewerId>` (`perch.sessionId` stays a shared
    last-chosen hint for windows with none).
  - `components/WorkspaceTools.tsx`: the right drawer (file explorer / Git
    for the active workspace); `fileTabs.ts`: files open as top-row tabs.
  - `views/`: `Chat.tsx` is Hosted mode; `NativeCliChat.tsx` is UI mode
    over a CLI session.
  - `statusDot.ts`: status glyphs.

## Invariants

- **Protocol parity:** every protocol change edits both `protocol.rs` and
  `protocol.ts`, field for field. New fields are optional/defaulted. Older
  peers (perch↔perch federation parses the same types) must keep working.
- **Terminals:**
  - Always build them with `xtermSetup.ts::createPerchTerminal`, never
    `new Terminal()`.
  - `convertEol` stays `false`.
  - The theme and font come from the server's `terminalProfile` (the user's
    real terminal), never from perch's UI tokens.
  - Terminals render with WebGL, as Orca's do (decided with the user
    2026-10-04): box drawing joins up pixel-aligned, and a busy TUI costs
    WebKit ~10x less memory than with the DOM renderer. A lost context is
    replaced, never left on DOM. Automation (`navigator.webdriver`) keeps
    the DOM renderer, because the e2e specs read text from `.xterm-rows`
    and a canvas leaves it empty. Only a terminal with a box on screen
    holds a WebGL context (an `IntersectionObserver` in
    `createPerchTerminal`): parked ones and inactive Dockview tabs stay
    mounted but detached. `node e2e/memory/memory.mjs` (after
    `npm run build`) checks the peak footprint, context replacement and
    release, and that closed or evicted terminals are freed;
    workspace-tabs W6 checks tabs within a group.
  - Nothing cached past its view may close over it: a callback kept after
    a request settles (`agentTerminals.ts` `retired`) once held 128 dead
    xterms with their buffers. Cache plain data.
  - Terminals outlive their pane, like a native terminal's tabs
    (`terminalKeeper.ts`): switching sessions parks them with their full
    scrollback instead of rebuilding from the replay. The replay (perchd's
    default window, then an exact repaint of the screen and modes from
    `perchd::screen`) serves only a view's first open.
  - An agent PTY has one size, owned by the view holding the resize lease.
    The server sends it in-band (`terminal::pty_size_marker`, at each resize
    and at the head of every replay); other views follow it and never fit
    (`PersistentAgentTerminal.tsx`), or a narrower view garbles the CLI.
- **CLI mode:**
  - It mounts no terminal until the session is started (`CliStartPanel`).
  - It shows no provider/model/effort UI; that chrome is Hosted-only.
  - The tab-bar `+` opens a harness picker scoped to the current workspace
    (or Chats with none selected), never asks for a project again, and creates
    nothing until a harness is chosen.
- **Workspace UX (decided with the user 2026-10-01, Orca-style; don't
  revert):**
  - **Pending replacement:** `docs/DECISIONS.md` (2026-10-04) approves
    Workspace→Nest and Project→Birdhouse copy, Chats→Scratchpad, a sessionless sidebar, guarded
    close of running work and Cmd-Shift-T reopen. Until a slice implements one,
    the rule below still holds; that slice rewrites it in the same commit.
  - Naming: Projects are folders; Workspaces are a project's checkout and
    its worktrees; sessions live under a workspace.
  - The right drawer (`WorkspaceTools.tsx`) holds the file explorer and Git
    only: no Terminal (terminals are tabs), and Git only for a git
    workspace. It is app-level, not part of a session's layout, and follows
    the clicked workspace. A clicked file opens as a top-row tab after the
    workspace's sessions (the Git drawer's "Open as tab" adds the review the
    same way), in one order shared by the strip, drag and the Ctrl+Space
    n/p/1-9 chords (`workspaceTabs.ts`, per viewer); the active file covers
    the main area while the session's panes stay mounted underneath, unless it
    is in a split set (`splitSets.ts`, `SplitCanvas.tsx`, per viewer): the
    members then share the canvas side by side while the strip stays one row.
    A set holds at most one terminal. `surfaceSync.ts` mirrors the strip,
    sets and open files/reviews to the core's surfaces (`surface.v1`, local
    workspaces only): the local stores stay live, a file with an unsaved draft
    gets its tab back when closed, and a viewer with no local tabs is
    restored from the core. The phone keeps the combined explorer+editor view. The
    `files`/`gitReview` panel kinds remain only so old saved layouts
    restore.
  - A tab is a terminal. Every CLI agent runs under
    `agent_runtime::in_shell`, so an exited agent leaves a login shell in
    the same pane. When that shell exits too (lifecycle `exited`, which
    hibernation's `sleeping` never is), the session closes itself like its
    tab's × (`PersistentAgentTerminal.tsx`); "Stop agent" does the same.
  - Closing a workspace's last terminal keeps the workspace: its open files
    and reviews stay tabs (the newest is shown), and with none left the
    workspace's start picker shows (`NoSessionPanel.tsx`), never another
    workspace's session. Clicking a workspace with no sessions
    never keeps showing another's either: it starts Settings → "Empty
    workspace opens" (`settings.emptyWorkspaceAgent`), else shows that
    workspace's start picker (`NoSessionPanel.tsx`).
  - Chats (`~/.perch/scratch`) is listed after the projects as a flat chat
    list (⌄ collapse, ⋯ Close all chats, ✎ new chat), with no scratch
    workspace row.
  - Tabs and pane groups are borderless (no pill outline, no group border);
    split groups share only dockview's sash.
  - One pane shows no pane header: the top-row tab names it. Splits show
    every group's header (`syncPaneHeaders` in `DockviewShell.tsx`).
    Right-clicking a session's top tab opens its pane menu (split, zoom,
    Stop agent). `Terminal` is a provider (`ProviderManifest::terminal`),
    listed last in the `+` picker so it is never the default.
  - UI/CLI is one global setting (`settings.chatMode`, default `"cli"`),
    changed only in Settings → Chat Mode and pushed to every connected
    client. There is no per-session, per-workspace or per-device mode and no
    switch in the session header (the server's per-session mode policy
    remains but the client doesn't use it). An agent with no UI surface
    (Terminal, or a CLI with no native bridge) is always CLI (`noUiSurface`
    in `Chat.tsx`). Switching to CLI resumes a session with Hosted history.
  - There is no Release control / Stop CLI bar: taking control takes the
    lease ("last actor drives"), and Stop agent is in the pane ⋯ menu.
  - The tab bar shows only the active workspace's sessions
    (`activeWorkspaceSessions` in `store/selectors.ts`), and `+` creates in
    that workspace's path. Selecting a tab focuses its terminal input or
    file editor once mounted (and after the session's layout restores),
    including keyboard navigation and tabs in a split. Ctrl+Space stays
    available in the file editor; ordinary form fields keep their input.
  - The default theme is `"perch"`: monotone neutral greys, color only for
    status. `styles/base.css` `:root`, `PERCH_DEFAULT` in `themes.ts` and Rust
    `default_theme()` must agree. The active tab and pane are marked in grey,
    not with an accent fill.
  - perch never archives: closing is deleting. Tab and session-row ×,
    the agent terminal exiting (the agent, then its login shell), "Close
    all sessions" and "Remove project" delete the sessions (their agents
    and shells are killed) and, for Remove project, the project. The folder
    and the agent's own transcript stay on disk; resuming is the CLI's
    (`claude --resume <id>`), and adding the folder again registers a fresh
    project. Closing a terminal pane ends its shell; only switching sessions
    leaves one running unseen. No process perch starts may outlive what the
    UI shows. (Archived workspaces are removed worktrees, a separate thing.)
  - A session starts only in a listed project's workspace or in Chats
    (`~/.perch/scratch`, `session::chats_pair`): "No project", and the blank
    session minted on connect, go to Chats. There is no "start in any
    folder" picker, and perch never registers a project implicitly ($HOME
    included); `+ Add` is the only way a folder becomes a project (a modal `Dialog`
    with the directory browser; the desktop app adds a "Browse folder…"
    button for the local host that opens the OS dialog only when clicked;
    never an inline sidebar form, never an automatic OS dialog). A session
    stays in the project it started in whatever its terminal cd's into.
  - Terminals behave like Ghostty/iTerm2: perch must never swallow or
    re-encode input. xterm (6.1 beta) answers the kitty keyboard protocol,
    so Ctrl/Shift+Enter reach CLIs that opt in; the only key perch keeps is
    the Ctrl+Space leader. Cmd combinations stay with the app and never reach
    the PTY (copy, paste, Cmd+F find, Cmd+K Navigator); Ctrl+F and Ctrl+K go
    to the PTY. Turn-review capture on Enter is best-effort and never
    blocks the keystroke.
  - One top row, three sections: brand ("perch" + the sidebar toggle, as
    wide as the sidebar so the tabs start above the main column), the tabs,
    then the drawer section: the Files/Git switch (`WorkspaceToolsTabs`,
    only while the drawer is open, as wide as the drawer) and the drawer
    toggle (a right-panel icon). Both toggles are borderless
    and transparent, filled only on hover. In the macOS app that row
    is also the title bar (overlay title bar, traffic lights in the brand
    section's 78px left padding, `data-tauri-drag-region`).
  - The sidebar collapses to nothing (not rendered; toggle in the top row,
    no footer button). The sidebar and drawer widths are user-resizable by
    dragging the dividers (`ResizeHandle.tsx`; per viewer, localStorage
    `perch.layout.*`).
  - Sessions sit under their project (`workspace-entry__sessions`). The Organize menu picks **Compact sessions** (default; `SessionDots`: one
    harness icon inside a tight status-colored circle per session on the row,
    click switches, right-click closes) or
    **Session list** (`perch.sidebar.sessionView`); the phone always lists. A
    project with one checkout shows no workspace row: its header carries the
    `workspace-entry` testid/`workspace-entry__button` class, and Files/Git
    are on the project menu. Rows are rounded, filled on hover/active
    (`surface-1`), focus is a 1px neutral ring, never an accent outline.
    Compact badges keep a 32px hit target, but selection/hover/focus hug the
    20px circular badge, never fill its square hit area. The compact badges
    sit in a faint bordered bar centered at 85% of the row width. The bar's
    border and blank space never select the workspace; the row's remaining
    background does, including the gutters beside the bar. Icons follow the
    observed foreground provider (`SessionSummary.currentProviderId`), not
    just the launcher; this display identity must never rewrite the saved
    launch/resume choice (`cliProviderId`).
  - Sidebar rows stay quiet: a project header is its name plus a `Chevron`
    (the whole row collapses it, per viewer) ⋯ (Rename, Copy path, Close all sessions, Remove project) and +
    (new workspace = the worktree create form). Workspace actions (Rename,
    Copy path/branch, Pin, Files, Git, Hide, Delete worktree) are in its
    right-click menu; only the phone switcher, which has no right-click,
    keeps them as buttons. A workspace shows a state only when it needs
    attention (pinned, dirty, sleeping), never "ready".
  - The status bar has no keybind hint, and ctx/cost appear only when a
    turn reports them. The Ctrl+Space leader still works (`?` lists it).
  - Shared UI primitives live in `components/ui/` (`Chevron`, `Dialog`,
    `menuPanel`/`menuItem`, `GHOST_BUTTON`): use them, don't restyle per
    call site. See UI-UX-DIRECTION.md Appendix E.
  - Settings is a full-window page (`SettingsPage.tsx`, opened by
    `settingsOpen`), not a popup: left section list, right cards of
    `SettingRow`s. The app stays mounted under it. Add project picks its
    host in the dialog.
  - Menus offer only what perch does. Don't add Orca items with no perch
    feature behind them (status columns, groups, icons, mark unread).
- **Store:** anything that reads or replaces `messages` calls
  `flushChunkBuffer()` first (see its doc comment). A late flush silently
  drops text.
- **Hosted composer (frozen):**
  - Attachment chips are name-only; e2e asserts there is no `data:image`.
  - "Approve & run" always sends with plan mode off.

## Rules and gotchas

- **The repo is PUBLIC** and its history was scrubbed on 2026-08-04. Never
  write employer-internal names.
  - `corp-*`, `*.internal.example.com`, `dev-*` (e.g.
    `dev-agent.devpod-us-or`) and `dev-user` are placeholders. Don't ssh to
    them and don't "correct" them.
  - Real hosts live only in `~/.perch/hosts.json`, outside the repo.
  - Before any push, scan `git diff origin/main..main` for internal names.
- **Git:**
  - Commit each verified slice locally as a checkpoint. Push only when the
    user asks.
  - Author: `hwii <116895905+hwii-florescent@users.noreply.github.com>`,
    already set in the local config.
  - Use `gh` for GitHub operations.
- **Test with cheap models only:** `claude-haiku-4-5` or `gpt-5.6-luna`.
  - Read the model from the CLI banner and verify it before the first
    prompt.
  - Start perch-core with `ANTHROPIC_MODEL=claude-haiku-4-5` so CLI panes
    inherit it.
  - Always use aliases, never dated snapshot ids (those 404 on the corp
    proxy).
- **Headless testing:**
  - Test headless only: no `--headed`, no focused windows.
  - Isolate state with `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR` and
    `PERCH_SETTINGS` pointed at a scratch dir.
  - Kill the probe's core and its `__perchd serve --dir <scratch>` daemon
    afterwards.
  - Without `PERCH_SETTINGS`, instances share `~/.perch/settings.json`; the
    e2e configs set it, but a test that changes settings still restores
    them, even on failure.
- **Claude specifics:**
  - The user's Claude runs in bypass-permissions mode, so no permission
    prompts appear. Use `AskUserQuestion` to exercise "needs you".
  - Claude wraps bracketed pastes in `<pasted_content id=…>`. Match a hook's
    `prompt` with `contains`, never equality.
- **e2e:**
  - A new spec must be added to `testMatch` in `e2e/playwright.config.ts`.
  - `e2e/artifacts/` is wiped on every run.
  - Real turns can overlap when the proxy is slow. Rerun a failing spec on
    its own before calling it a regression.
  - `ssh::tests::mux_control_path_…` is flaky in the full suite and passes
    on its own.
  - Each run starts clean: the webServers delete the e2e dbs and stop the
    e2e daemons before booting, so specs must create what they need
    (`e2e/projects.ts`: `startChat`, `addProject`).
  - `playwright.config.ts` points `PERCHD_DIR` at `/tmp/perch-e2e-perchd`
    for every core it starts. Never let tests use `~/.perch/daemon`: that
    is the installed app's daemon, and leaked test PTYs exhaust its fds
    ("dup of fd … failed") for the user's real app.
  - Known failures (as of 2026-10-02; the full run is otherwise green):
    - Every opencode spec: opencode is deliberately not installed on this
      Mac; don't install it.
    - agent-terminal-ownership can fail under load at "phone keeps control
      after reload". Leases are per connection, so the reloaded view can
      open before the server drops the old connection's lease, and it then
      comes up as a watcher.
    - paired-phone-flows intermittently gets "Delivery could not be
      confirmed" for the review packet (2 of 9 runs on 2026-10-02, cause not
      found; 3 of 3 passed at d14bf9f).
- **Styling is Tailwind v4** (no preflight): utilities in the TSX, shared
  primitives in `packages/web/src/components/ui/`, theme tokens as `:root` vars
  in `styles/base.css` (rewritten at runtime by `themes.ts`). `styles/*.css`
  only keeps the xterm and Dockview overrides, the markdown descendants and
  the git panel's resets. Utilities are layered, so an unlayered CSS rule beats
  them: never give an element both. `e2e/visual/visual.mjs` (headless Chromium + WebKit, fails closed) proves a
  refactor changed nothing; it is slow, so use it for style-only refactors, not
  for intentional UI changes.
- **UI builds:** after `npm run build`, open tabs update themselves within
  about a minute (a PWA service worker); no restart is needed.
- **Desktop notifications:** the web view doesn't deliver
  `window.Notification`. `tauri-plugin-notification` replaces it, and
  `crates/perch-desktop/capabilities/main.json` gives the loopback UI origin
  access to notifications only. `crates/perch-desktop/gen/` is build output.
- **Codex models:** the model list is the hand-maintained `CODEX_CATALOGUE`
  in `models.rs`, on purpose. Re-sync it by hand against
  `~/.codex/models_cache.json`.
- **This Mac:**
  - node/npm and codex are in `/opt/homebrew/bin`, cargo in `~/.cargo/bin`,
    claude in `~/.local/bin`.
  - Codex auth needs `corp-sso`.
  - Rust comes from Homebrew (there's no rustup), so it can't cross-compile
    for Linux; CI builds Linux.
