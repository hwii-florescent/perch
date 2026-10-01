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

**Direction (2026-09-22):** a fast, lightweight Rust port of
[Orca](https://github.com/stablyai/orca) (cloned at `~/Github/orca`), **CLI
mode first**. The Hosted/UI chat surface is frozen: don't extend it.
- `docs/ARCHITECTURE.md`: the design and build order.
- `docs/ORCA-PARITY.md`: the feature gap matrix.

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
  - `components/WorkspaceTools.tsx`: the right drawer (Files / Git for the
    active workspace).
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
  - Never add `@xterm/addon-webgl`: canvas rendering empties `.xterm-rows`,
    which the e2e specs read.
- **CLI mode:**
  - It mounts no terminal until the session is started (`CliStartPanel`).
  - It shows no provider/model/effort UI; that chrome is Hosted-only.
  - The tab-bar `+` opens a picker and creates nothing until something is
    chosen.
- **Workspace UX (decided with the user 2026-10-01, Orca-style; don't
  revert):**
  - Naming: Projects are folders; Workspaces are a project's checkout and
    its worktrees; sessions live under a workspace.
  - Files and Git live only in the right drawer (`WorkspaceTools.tsx`):
    Files + Git, no Terminal (terminals are tabs), and Git only for a git
    workspace. It is app-level, not part of a session's layout, and follows
    the clicked workspace. Don't put them back as per-chat dockview panels;
    the `files`/`gitReview` panel kinds remain only so old saved layouts
    restore.
  - A tab is a terminal. Every CLI agent runs under
    `agent_runtime::in_shell`, so an exited agent leaves a login shell in
    the same pane. `Terminal` is a provider (`ProviderManifest::terminal`),
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
    that workspace's path.
  - The default theme is `"perch"`: monotone neutral greys, color only for
    status. `styles.css` `:root`, `PERCH_DEFAULT` in `themes.ts` and Rust
    `default_theme()` must agree. The active tab and pane are marked in grey,
    not with an accent fill.
  - Tab and session-row × archive the session (restorable from Settings).
    Removing a project archives it; re-registering the folder restores it.
  - One top row, three sections: brand ("perch" + the sidebar toggle, as
    wide as the sidebar so the tabs start above the main column), the tabs,
    then the drawer toggle (a right-panel icon). In the macOS app that row
    is also the title bar (overlay title bar, traffic lights in the brand
    section's 78px left padding, `data-tauri-drag-region`).
  - The sidebar collapses to nothing (not rendered; toggle in the top row,
    no footer button). The sidebar and drawer widths are user-resizable by
    dragging the dividers (`ResizeHandle.tsx`; per viewer, localStorage
    `perch.layout.*`).
  - Sidebar rows stay quiet: a project header is its name plus ⌄ (collapse,
    per viewer) ⋯ (Rename, Copy path, Archive chats, Remove project) and +
    (new workspace = the worktree create form). Workspace actions (Rename,
    Copy path/branch, Pin, Files, Git, Hide, Delete worktree) are in its
    right-click menu; only the phone switcher, which has no right-click,
    keeps them as buttons. A workspace shows a state only when it needs
    attention (pinned, dirty, sleeping), never "ready".
  - The status bar has no keybind hint, and ctx/cost appear only when a
    turn reports them. The Ctrl+Space leader still works (`?` lists it).
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
  - `playwright.config.ts` points `PERCHD_DIR` at `/tmp/perch-e2e-perchd`
    for every core it starts. Never let tests use `~/.perch/daemon`: that
    is the installed app's daemon, and leaked test PTYs exhaust its fds
    ("dup of fd … failed") for the user's real app.
  - Known failures, not regressions (as of 2026-10-01): Hosted-composer
    specs that use `model-chip`/`.chat__send` (W1, P3, nav N1, sidebar 2,
    workspace-git GB1; UI mode is NativeCliChat since 2e9c4b7);
    agent-terminal-ownership, workspace-recovery, workspace-review:226;
    native-providers (older pane expectations); agent-hibernation (greps a
    tmux log line the core stopped printing in 56e2c48); keybindings K1 (it
    drives the Hosted composer through the picker); every opencode spec
    (opencode is deliberately not installed on this Mac; don't install it).
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
