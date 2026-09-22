# perch architecture — a Rust Orca

Target architecture for porting [Orca](https://github.com/stablyai/orca) (MIT)
to perch's Rust core, **CLI mode first**. `docs/ORCA-PARITY.md` tracks the
feature gaps. The Hosted/UI chat surface is frozen as it is.

Orca reference: `~/Github/orca` (shallow clone of `564f1352`, 2026-09-22).
Its design notes in `docs/reference/*.md` are the best source for *why*.
This document names the Orca file behind each decision so the logic can be
read before it is ported. Port behaviour and invariants, not file layout.

## 1. What Orca is, structurally

| Orca process | Language | Owns | perch equivalent today |
|---|---|---|---|
| Electron main (`src/main`) = the **runtime** | TS/Node | RPC, git, worktrees, persistence, hook server, status store | `perch-core` (axum HTTP+WS) |
| Renderer (`src/renderer`) | React | UI only | `packages/web` (React, dockview, xterm) |
| **Terminal daemon** (`src/main/daemon`) | Node, detached | every local PTY, scrollback history files, headless emulator | none; `agent_tmux.rs` uses tmux for agent panes, and other PTYs die with the core |
| `orcad` (`src/main/orcad`) | Node | same runtime, headless | `perch-core --headless` |
| Relay (`src/relay`) | Node, deployed over ssh | remote PTYs, git, fs | `perch` host mode (full remote perch behind an ssh tunnel); `direct` mode (tmux over ssh) |
| `orca` CLI (`src/cli`) | Node | agent-facing control plane over RPC | none |
| Mobile (`mobile/`) | React Native | client | PWA + device pairing |

What makes Orca feel solid is three invariants. perch keeps all three:

1. **The daemon owns PTYs.** Quitting the app, crashing the runtime, or
   updating it never kills an agent. The runtime *adopts* a live daemon
   rather than replacing it (`orcad-operations.md`,
   `daemon-replacement-preflight.ts`).
2. **One status store per execution host.** Hooks, OSC sequences and
   process exits all write through one ingest path. Precedence is decided
   when the row is written, and every reader only projects it
   (`agent-status-store.md`).
3. **The execution host owns execution.** Nothing remote falls back to local.
   Losing contact yields `unverifiable`, never `exited`
   (`ssh-execution-boundary.md`).

## 2. Target process model

```
                ┌─────────────── browser / Tauri webview ───────────────┐
                │ packages/web  (thin view: xterm panes, sidebar, tabs) │
                └───────────────▲───────────────────────────────────────┘
                                │ WS  (protocol.rs ⇄ protocol.ts)
 agent CLIs ──hook POST──►┌─────┴──────────── perch-core (runtime) ─────────────┐
 perch CLI ──WS/HTTP─────►│ projects · worktrees · git · fs · status store      │
                          │ layout/tabs · quick commands · notifications · SQL  │
                          └─────▲──────────────────────────────▲────────────────┘
                                │ unix socket, versioned         │ ssh tunnel (perch host mode)
                          ┌─────┴──────── perchd ──────────┐    remote perch-core + perchd
                          │ PTYs · history logs · OSC scan │
                          │ headless screen · replay ring  │
                          └────────────────────────────────┘
```

**One binary, several roles.** `perch-core` gains subcommands instead of new
crates. Deployment, remote install and version matching then stay one
artifact:

| Subcommand | Role | Orca source |
|---|---|---|
| `perch-core` / `serve` (default) | runtime, as today | `src/main`, `src/main/orcad` |
| `perch-core daemon` | PTY daemon, spawned detached by the runtime | `src/main/daemon/daemon-entry.ts` |
| `perch-core hook <source>` | reads hook JSON on stdin and POSTs it to the runtime; replaces curl in hook scripts | `src/main/agent-hooks/hook-post-command.ts` |
| `perch-core <noun> <verb>` (e.g. `worktree create`, `terminal read`) | agent-facing CLI | `src/cli`, `docs/site/.../cli/reference.mdx` |

The desktop app (`perch-desktop`) keeps booting the runtime in-process, but
spawns `perchd` from its own executable (`current_exe() daemon`). Quitting the
window then leaves agents running, as Orca does.

## 3. perchd — the terminal daemon

Replaces `agent_tmux.rs` (local), `workspace_terminals.rs` and the PTY half of
`terminal.rs`. tmux remains only for `direct` remote hosts.

**Endpoint and lifecycle** (`daemon-spawner.ts`, `daemon-endpoint-*.ts`)
- Socket `~/.perch/daemon/daemon-v<N>.sock`, mode 0600, plus a PID record
  holding pid and process start time, so a recycled pid is never read as
  alive.
- `N` is a **semantic protocol version**, not a build hash. The runtime
  connects to the highest version it speaks. An older daemon that still owns
  live sessions is adopted, never replaced. It is retired only once it owns
  zero sessions.
- The runtime spawns it detached (`setsid`) and never stops it. The daemon
  exits by itself when it owns no sessions and no runtime has attached within
  an adoption window.
- Crash-loop guard: at most 5 spawns per 60 s rolling window, then terminal
  creation fails with a clear error (`daemon-respawn-throttle.ts`).

**Wire.** Length-prefixed frames over the socket. Control messages are JSON,
and output is raw bytes tagged with a session id and sequence number. A hello
handshake exchanges protocol version and capabilities
(`daemon-hello-protocol.ts`). Operations:

| Op | Purpose |
|---|---|
| `create {id, argv, cwd, env, cols, rows}` → `{pid}` | spawn a PTY; `id` is minted by the runtime (the pane key) |
| `attach {id, since_seq}` → replay + live stream | reattach after a runtime restart; replay from the ring or the history log |
| `input`, `resize`, `signal`, `kill` | control |
| `list` → sessions with `{pid, alive, exit_code, cwd, fg_process}` | census; source of `live`/`exited` verdicts |
| `snapshot {id}` → screen text + cursor | `terminal read`, cold restore, idle detection |
| `health` → version, pid, session count, self-test (spawn a real short PTY) | readiness (`daemon-health.ts`) |

**Per-session output pipeline** (`session-output-pipeline.ts`,
`terminal-history-*.ts`, `headless-emulator.ts`)
1. PTY read; carry a split trailing UTF-8 sequence across reads (the
   existing `split_utf8_tail` fix).
2. Append to an in-memory **replay ring** (bounded; the existing
   `registry.rs` idea).
3. Append to an **on-disk history log** `~/.perch/daemon/history/<id>.log`,
   size-capped with tail truncation. This is what makes scrollback survive a
   reboot (`model/session-restore.mdx`).
4. Feed a **headless screen** (`vt100` crate, the only new dependency) so
   `snapshot` answers without a client attached.
5. **OSC scan** in the same pass: OSC 0/2 title, OSC 7 cwd, OSC 9 / OSC 777
   notify, OSC 133 prompt marks, OSC 52 clipboard. Each becomes a typed event
   for the runtime. The scan is bounded and never blocks output.
6. Fan out to attached runtimes. A slow reader gets coalesced output and is
   never allowed to stall the PTY (`daemon-stream-backpressure.ts`).

**Environment injected into every PTY.** `PERCH_PANE_KEY`,
`PERCH_WORKTREE_ID`, `PERCH_TAB_ID`, `PERCH_HOOK_PORT`, `PERCH_HOOK_TOKEN`,
`PERCH_LAUNCH_TOKEN`, `PERCH_RUNTIME_URL`, plus the existing `TERM`,
`COLORTERM` and `LANG` overrides (`apply_terminal_env`). Mirrors Orca's
`ORCA_*` set.

## 4. Status store — one per execution host

Built on the existing `agent_fleet::AgentLifecycleRegistry` and
`agent_persistence.rs`. No parallel store (Orca: `src/main/agent-hooks/server/*`).

**Row** (keyed by pane key): `state` (`working | blocked | done | idle`, plus
the existing `sleeping | exited | error | reconnecting`), provider,
provider session id, last prompt, last tool, last assistant message, model,
`provenance` (hook | osc | exit | structured), `evidence_at`,
`restored_unconfirmed`.

**Producers.** All of them go through one `apply_status(event)`:
- **Hook ingest.** `POST /hook/<source>` on the runtime's port, loopback only,
  authenticated with `X-Perch-Hook-Token`. The pane key comes from the
  environment the hook inherited. perch installs *managed* hook entries into
  each provider's own config (`~/.claude/settings.json` hooks,
  `~/.codex/hooks.json`, and the pi/omp/opencode equivalents). They are
  marked as perch-owned so they can be updated and removed without touching
  the user's own hooks (`managed-agent-hook-registry.ts`,
  `managed-toml-ownership.ts`). This replaces `native_ui/claude.rs`'s
  file-drop events.
- **OSC events from perchd.** Titles and notify sequences, with per-provider
  rules (`server-claude-status-rules.ts`).
- **Process exit from perchd.** A certified exit for the current pid.

**Rules** (from `agent-status-store.md`)
- Precedence is decided at write time and recorded as `provenance`. A newer
  hook row beats OSC inference, and an exit beats both.
- A dismissal, a certified exit or a provider-session replacement removes the
  row everywhere. Transport loss removes nothing.
- The store is persisted to SQLite with a 7-day hydrate window. A hydrated
  non-done row is `restored_unconfirmed` and never counts as live.
- Fan out over WS: `agentStatus.snapshot` on connect, then `agentStatus.set`
  and `agentStatus.clear`. The sidebar, tab glyphs, dashboard, `perch ps` and
  mobile are all readers. The 30-minute idle decay and unread state are the
  only reader-side policy, and they live in one shared function.
- Notifications fire on the working→done and working→blocked transitions, not
  on polling (`notifications.mdx`).

## 5. Runtime domains (perch-core)

Each domain is a module with no protocol dependency, plus a thin `server/*`
adapter. That is the pattern `source_control.rs` and `filesystem.rs` already
follow.

| Domain | Module (existing → target) | Orca source |
|---|---|---|
| Projects / repos | `db/projects.rs`, `server/workspace.rs` | `main/persistence/tracking-repos`, `main/project-groups` |
| Worktrees: create in the background with progress/cancel/retry, start-from (base ref / branch / SHA / remote branch), branch naming, shared paths, `.worktreeinclude`, delete with preserved-branch review, sleep, archive, pin, rename, parent nesting, external worktree visibility | `worktree.rs` → grows | `main/git`, `main/runtime/rpc/methods/worktree*.ts`, `docs/reference/worktree-scan-fingerprint.md` |
| Agent launch: provider manifests, autonomy flags, per-agent launch-arg overrides, resume | `agent_fleet.rs`, `agent_runtime.rs`, `agent_catalog.rs` | `main/agent-launch`, `main/providers` |
| Status store + hook server | `agent_fleet.rs` registry + new `hooks/` | `main/agent-hooks` |
| Terminals (client of perchd) | `terminal.rs` → thin perchd client | `main/pty`, `main/daemon/client.ts` |
| Layout: tab groups, splits, focus, per worktree | new `db/layout.rs` | `main/runtime/rpc/methods/session-tabs*.ts` |
| Quick commands (global / project) | new `db/quick_commands.rs` | `terminal-quick-command-rpc-schema.ts` |
| Git / source control / review | `source_control.rs`, `review.rs`, `server/git.rs` | `main/git`, `main/source-control` |
| Files | `filesystem.rs`, `db/file_buffers.rs` | `rpc/methods/files*.ts` |
| Remote hosts | `hub.rs`, `ssh.rs`, `detached.rs` | `main/ssh`, `src/relay` |
| Devices / pairing | `devices.rs` | `rpc/methods/pairing.ts` |

**Durable state** stays in `~/.perch/history.sqlite`; perch does not copy
Orca's JSON store. Settings stay in `settings.json`. New tables: `worktree_meta`
(start-from ref, parent, pinned, sleeping, display name, linked item, created
by), `layout` (a per-worktree pane tree as JSON plus the focused tab),
`panes` (pane key → worktree, kind, argv, provider session), `agent_status`,
`quick_commands`.

## 6. Protocol

`protocol.rs` ⇄ `protocol.ts` parity stays the first invariant. Following
Orca's `remote-wire-compatibility.md`: a new field is optional; a new message
family is gated by a capability advertised in `server.info`, because an older
peer drops unknown messages silently. New families:

`worktree.{create,progress,cancel,delete,update,list}` ·
`layout.{get,set}` · `pane.{create,close,restart}` ·
`agentStatus.{snapshot,set,clear,dismiss}` · `quickCommand.{list,save,run}` ·
`notification.*`

## 7. Agent-facing CLI

`perch-core <noun> <verb>` connects to `$PERCH_RUNTIME_URL` with
`$PERCH_HOOK_TOKEN` (both injected into every PTY), so an agent inside perch
can drive perch. It covers the Orca verbs that CLI mode needs first:
`worktree create|list|ps|remove`, `terminal list|read|send|wait --for idle`,
`notify`. The full surface is in Orca's `cli/reference.mdx`. Remote hosts
proxy back to the owning runtime, as Orca's relay shim does.

## 8. Web UI (CLI mode)

Keep React, dockview and xterm. Every terminal is still built by
`createPerchTerminal`, and the existing xterm rules in `AGENTS.md` stand.
Surfaces to build, in order: a sidebar of projects → worktrees with status
glyphs; a tab strip per worktree with splits and persisted boundaries; a
restart chip; the worktree create dialog with a start-from picker and a
progress row; Cmd-J jump palette; Cmd-P quick open; quick commands; floating
terminal; agent dashboard. The Hosted chat components stay untouched.

## 9. Performance budgets (to measure, not claims)

"Fast and lightweight" is the reason for the port, so each phase records:
runtime idle RSS, perchd RSS with 0 / 10 PTYs, cold start to first frame,
keystroke → echo latency through core + daemon, and output throughput
(`yes | head -c 100M`) without dropped bytes. Orca's `terminal-perf-*.md`
lists the equivalent budgets it tracks.

## 10. Build order

Each phase ends with fast checks (`cargo test`, `npm test`) plus one
`/bin/sh`-fixture integration test. A checkpoint commit follows every
verified slice. Real-model smoke runs use only Claude Haiku 4.5 or GPT-5.6
Luna.

1. **perchd.** Daemon, socket protocol, attach/replay, history log, headless
   snapshot, adoption. Move local agent and workspace terminals onto it and
   retire local tmux. *Done when:* killing the runtime leaves the shell
   running, and a new runtime reattaches with the scrollback intact.
2. **Status store + hooks.** Managed hook install for claude/codex, the
   `/hook` endpoint, OSC rules, WS fan-out, notifications. *Done when:* a
   fake agent script driving hooks and OSC produces working → blocked → done
   in the store and in the UI.
3. **Worktree lifecycle.** Everything in the Worktrees row of §5.
4. **Layout and restore.** Tabs, splits and focus persisted per worktree,
   restart chip, quick commands, floating terminal, and terminal extras
   (search, link popover, copy context, kitty keyboard).
5. **Navigation.** Cmd-J, Cmd-P, agent dashboard.
6. **Agent-facing CLI.**
7. Then Tier 2 (review/ship), Tier 3 (agent ops) and Tier 4 (integrations)
   from the parity matrix. Tier 5 is deferred.
