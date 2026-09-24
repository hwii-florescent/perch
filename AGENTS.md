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
cargo test -p perch-core            # ~270 tests, a few seconds; add a substring to filter
cargo test -p perchd                # daemon unit + integration tests
npm install && npm run build        # builds packages/shared then packages/web → packages/web/dist (served by axum)
npm test                            # web unit tests (vitest)
cargo fmt --check && cargo clippy --workspace --all-targets   # expect exactly 5 existing warnings; add none
cargo run -p perch-core -- --port 7788     # flags/env: --db-path PERCH_DB, --hosts-path PERCH_HOSTS, PERCHD_DIR, --headless, --base-path
cargo run -p perch-desktop                 # macOS / Linux+webkit2gtk; PERCH_DESKTOP_TEST=1 = hidden, unfocused window
npm run build && (cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build)   # installers
cd e2e && npx playwright test <spec> [-g name]   # boots :7799 + :7800 itself; real agent turns
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
  message. `server/{session,terminal,agents,native_ui,workspace,git,fs,reviews,config}.rs`.
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
  - `Sidebar.tsx`.
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
  - Isolate state with `PERCH_DB`, `PERCH_HOSTS` and `PERCHD_DIR` pointed
    at a scratch dir.
  - Kill the probe's core and its `__perchd serve --dir <scratch>` daemon
    afterwards.
  - All instances share `~/.perch/settings.json`. A test that changes it
    must restore it, even on failure.
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
