# perch architecture: a Rust Orca

This is how perch ports [Orca](https://github.com/stablyai/orca) (MIT) into
Rust, CLI mode first. Feature gaps are tracked in `ORCA-PARITY.md`. The Orca
reference checkout is `~/Github/orca` (commit `564f1352`), and its
`docs/reference/*.md` explain *why* things are built the way they are. Port
behaviour and invariants, not Orca's file layout, which follows Electron IPC.

## Invariants carried over from Orca

1. **The daemon owns PTYs.** Quitting, crashing or updating the app never
   kills an agent. The runtime *adopts* a live daemon; it never replaces one.
2. **One status store per execution host.** Every signal (hooks, native
   events, OSC, process exit) writes through one path, and readers only
   display what it holds.
3. **The execution host owns execution.** Nothing remote falls back to local.
   Losing contact means `unverifiable`, never `exited`.

## Processes

| Orca | perch |
|---|---|
| Electron main (the runtime) | `perch-core`: axum HTTP+WS, SQLite |
| Renderer | `packages/web`: React, dockview, xterm |
| Terminal daemon | `perchd` ✅ |
| `orcad` (headless runtime) | `perch-core --headless` |
| Relay over ssh | host modes `perch` (a remote perch behind an ssh tunnel) and `direct` (tmux over ssh; moving to perchd, backlog) |
| `orca` CLI for agents | not built (phase 6) |
| Mobile | PWA + device pairing |

```
browser / Tauri web view (packages/web)
        │ WS  protocol.rs ⇄ protocol.ts
perch-core (runtime): projects · worktrees · git · fs · status · SQLite
        │ unix socket (framed)          │ ssh (host modes)
perchd: PTYs · history logs · vt100     remote perch / direct host
```

## perchd (built, phase 1)

- **Packaging:** `crates/perchd` depends only on portable-pty, vt100,
  serde_json and libc (no tokio or SQLite). The runtime spawns it as
  `<exe> __perchd serve`, a detached re-run of the app binary. A standalone
  `perchd` binary exists for remote hosts.
- **Endpoint:** `~/.perch/daemon/daemon-v<N>.sock`, mode 0600, one instance
  per directory via `flock`.
  - `N` is the protocol version.
  - A socket path too long for the OS limit falls back to
    `/tmp/perchd-<uid>-<hash>-v<N>.sock`.
  - The daemon exits after 60 s with no live sessions and no clients.
- **Wire** (`proto.rs`): frames of `[u32 len][kind]`.
  - `J` frames carry JSON requests and replies.
  - `D` frames carry `[u64 seq][id][raw bytes]`: terminal output, or input
    going the other way.
  - Ops: `hello`, `create`, `attach{since}`, `detach`, `resize`, `kill`
    (signals the process group), `remove`, `list`, `snapshot`, `health`.
- **Output path:** PTY → on-disk history log (the only replay source; capped
  at 8 MiB, keeping the newest half) → vt100 screen → subscribers.
  - An attach replays from any byte offset, then continues live.
  - A subscriber more than 16 MiB behind gets `Dropped` and must reattach
    from its last seq.
  - A restarted daemon reloads its sessions as exited but still replayable,
    and keeps them for 7 days.
- **Transport for remotes:** `perchd connect` bridges stdin/stdout to the
  socket, starting the daemon if needed. It's built and tested locally but
  not wired to ssh yet.

**Remote plan (1b, backlog).** Upload `perchd-linux-<arch>` (from the release
workflow) to `~/.perch/bin/perchd-v<N>` and run `ssh host … connect` through
the existing ControlMaster. CLI panes and Hosted turns on direct hosts then
become daemon sessions, and the tmux/`nohup`/`tail -F` code in `detached.rs`
is deleted. Blocked on having a test host.

## Status (phase 2)

- **Store:** `agent_fleet::AgentLifecycleRegistry` (states `working`,
  `blocked`, `done`, `idle`, `sleeping`, `exited`, `error`, `reconnecting`),
  persisted by `agent_persistence.rs`. There is no parallel store.
- **Producers**, strongest first; each one silences the ones below it:
  1. `native_ui/*` snapshots `{running, blocked}`:
     - Claude: per-launch hooks, `PermissionRequest` or
       `PreToolUse(AskUserQuestion)` → blocked.
     - Codex: app-server `activeFlags` `waitingOnApproval` /
       `waitingOnUserInput` → blocked.
     - Pi/OMP (`pi-extension.ts`): an ask tool in flight
       (`AskUserQuestion`/`request_user_input` for Pi, `ask` for OMP), or
       OMP's `tool_approval_requested` until `…_resolved` → blocked; the
       turn's `agent_end` clears both. Pi 0.84 has no event for an
       extension's own `ctx.ui` dialog, so those are not seen.
     - OpenCode (`opencode-plugin.mjs`): the TUI's pending
       `session.permission`/`session.question` for the session or any
       subagent session below it → blocked.
  2. Configured output markers (`StatusDetection::OutputPatterns`).
  3. The OSC title (`agent_title.rs`, Orca's `agent-title-status.ts` rules):
     working / permission / idle. The first classified title makes the
     title own status: repaints only count as activity, and an Enter no
     longer starts a turn (the title's working edge does). vt100 tracks the
     title in the runtime's own output path, so it works with or without
     perchd and with no view attached.
  4. Any output = working (the old fallback), plus the approval-prompt
     regex in `server/mod.rs::handle_socket` while a view is attached.
  5. Process exit.
- **Projection:** `server/mod.rs::spawn_agent_turn_state_task` turns
  lifecycle transitions into the sidebar's `running_sessions` and
  `blocked_sessions`. The UI (`statusDot.ts`) then draws glyphs and fires
  notifications on the running→idle and →blocked edges. In the desktop app
  those are native OS notifications via `tauri-plugin-notification`.
- **Reader policy** (`server/session.rs`, after Orca's
  `agent-attention-policy.ts` and `agent-status-freshness.ts`), one place:
  - Unread (`unseen`): a turn settles while no connection views the
    session; viewing it clears it. Blocked is not unread.
  - Decay (`stale`): running or blocked with no status evidence (lifecycle
    activity or transition: native snapshots, title changes, output) for 30
    minutes reads as idle. Display only: no unread, no notification, and a
    later real completion still notifies. Orca splits this into idle and
    "unverifiable" (PTY alive); perch shows idle for both.
- **Not built:** an HTTP `/hook` endpoint (the file-based hooks work);
  Orca's title normaliser and per-agent tracker quirks (Gemini/Grok display
  titles, the 3-second stale-working-title clear).

## Runtime domains

The pattern: a domain module with no protocol dependency, plus a thin
`server/*` adapter.

| Domain | perch module | Orca source |
|---|---|---|
| Projects | `db/projects.rs`, `server/workspace.rs` | `main/persistence`, `main/project-groups` |
| Worktrees (phase 3): background create with progress, cancel and retry; a start-from ref (branch, SHA or remote); branch naming; `.worktreeinclude` and shared dirs; delete with branch review; sleep, archive, pin, rename, nesting; showing external worktrees | `worktree.rs` | `main/git`, `main/runtime/rpc/methods/worktree*.ts` |
| Agent launch | `agent_fleet.rs`, `agent_runtime.rs`, `agent_catalog.rs` | `main/agent-launch`, `main/providers` |
| Terminals | `terminal.rs`, `workspace_terminals.rs`, `daemon.rs` | `main/pty`, `main/daemon` |
| Layout: tabs, splits and focus per worktree (phase 4) | new `db/layout.rs` | `rpc/methods/session-tabs*.ts` |
| Quick commands (phase 4) | new `db/quick_commands.rs` | `terminal-quick-command-rpc-schema.ts` |
| Git / review | `source_control.rs`, `review.rs`, `server/git.rs` | `main/git`, `main/source-control` |
| Files | `filesystem.rs`, `db/file_buffers.rs` | `rpc/methods/files*.ts` |
| Remote | `hub.rs`, `ssh.rs`, `detached.rs` | `main/ssh`, `src/relay` |

State lives in `~/.perch/history.sqlite` and `settings.json`; Orca's JSON
store isn't copied. **Protocol:** a new field is optional. A new message
family is gated behind a capability in `server.info`, because older peers drop
unknown messages silently. `worktree.*` is built; the planned
message families are `layout.*`, `pane.*` and `quickCommand.*`.

## Agent CLI (phase 6)

`perch-core <noun> <verb>`, connecting to `$PERCH_RUNTIME_URL` with a token
injected into every PTY. First commands: `worktree create|list|ps|remove`,
`terminal list|read|send|wait --for idle`, and `notify`. The reference is
Orca's `cli/reference.mdx`.

## UI (CLI mode)

Keep React, dockview and xterm (`createPerchTerminal` rules in AGENTS.md).
Build order:
1. ✅ Sidebar: projects → worktrees, with status glyphs.
2. A per-worktree tab strip with splits that persist.
3. ✅ Worktree create dialog with a start-from picker and progress.
4. Cmd-J.
5. Cmd-P.
6. Quick commands.
7. Floating terminal.
8. Agent dashboard.

## Budgets (measure, don't claim)

Each phase records:
- Runtime idle memory, and perchd memory with 0 and 10 PTYs.
- Cold start to first frame.
- Keystroke-to-echo latency.
- Output throughput (`yes | head -c 100M`) with no dropped bytes.

## Build order

Each phase ends with `cargo test` + `npm test`, one real probe, and a
checkpoint commit.

1. ✅ **perchd**, running local agents and shells. `kill -9` on the runtime
   → the shell survives → a new runtime reattaches with the same pid and
   scrollback.
   - 1b. Remote perchd. Backlog: no test host.
2. 🟡 **Status**: see above.
3. ✅ **Worktree lifecycle** (`e2e/worktree-lifecycle.config.ts`). Gaps
   are in the parity matrix's Tier 1.
4. **Layout and restore**, quick commands, floating terminal, terminal
   extras (link popover, copy context, kitty keyboard).
5. **Navigation**: Cmd-J, Cmd-P, dashboard.
6. **Agent CLI.**
7. Tiers 2–4 of the parity matrix. Tier 5 is deferred.
