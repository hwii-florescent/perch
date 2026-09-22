# Orca parity — CLI mode

Goal (user, 2026-09-22): make perch's **CLI mode** at least on par with
[Orca](https://github.com/stablyai/orca) (MIT), porting Orca's app logic into
perch's Rust core. Target: a fast, lightweight Rust Orca. The Hosted/UI chat
surface stays as it is for now.

Reference checkout: `~/Github/orca` (shallow clone of `564f1352`, 2026-09-22),
outside this repo. The user-facing spec is `docs/site/content/docs/**/*.mdx`
there; the logic lives in `src/main/*` (~850k lines of TS in the Electron main
process). Port behaviour, not code shape: Orca's module boundaries follow
Electron IPC, perch's follow `protocol.rs` ↔ `protocol.ts`.

Status: ✅ exists · 🟡 partial · ❌ missing. "Orca source" is where to read
the logic before porting. First pass from a grep survey — verify a row
against the code before building on it.

## Tier 1 — the core Orca loop (worktree → agent → watch → restore)

| Feature (Orca doc) | perch | Orca source |
|---|---|---|
| Worktree create: background with progress row, cancel, retry (`model/worktrees`) | 🟡 `worktree.rs` creates; no background progress/cancel | `main/git`, `main/runtime` |
| Start-from picker: base ref / local branch / SHA / remote branch | ❌ | `main/git` |
| Branch name derived from task name, explicit override | 🟡 verify | `main/git` |
| Shared paths, `.worktreeinclude` copies, shared dirs (APFS clone / symlink) | ❌ | `main/git`, `main/runtime` |
| Delete worktree + branch, preserved-branch review, archive, sleep, pin, rename, parent nesting | 🟡 archive/sleep exist | `main/runtime`, `main/persistence` |
| External (`git worktree add`) worktrees: show/hide | ❌ | `main/runtime` |
| Launch any supported CLI with autonomy flags; per-agent editable launch args + reset | 🟡 `agent_fleet.rs` manifests | `main/agent-launch`, `main/providers` |
| Status glyphs working / needs-you / done / blocked / idle from hooks + OSC title (`model/agents-sessions`) | 🟡 `AgentState` exists; hook coverage partial | `main/agent-hooks` (+ `server/`) |
| Restart chip keeps cwd (and account) | ✅ Restart CLI | `main/pty` |
| Agent-finished notification, unread state | 🟡 verify | `main/agent-hooks`, renderer |
| Tabs, splits right/down, per-worktree layout that persists (`model/tabs-panes-splits`) | 🟡 dockview; per-worktree persistence to verify | renderer |
| PTYs survive app quit; scrollback (incl. output while closed) restored; focused tab restored (`model/session-restore`) | 🟡 tmux persistence; scrollback restore to verify | `main/daemon`, `main/orcad` |
| Terminal: find in scrollback, link action popover, OSC 52, kitty keyboard, copy context | 🟡 search + OSC 52 exist; kitty, link popover, copy context missing | renderer, `main/pty` |
| Quick Commands (global/project, run in new tab or insert) | ❌ | `main/runtime`, renderer |
| Floating terminal | ❌ | renderer |
| Jump palette Cmd-J (recent agents by attention, worktrees, tabs, create-from-query) | 🟡 Navigator (Ctrl+K) | renderer |
| Quick Open Cmd-P (files, gitignored second pass) | ❌ | `main/runtime` |
| Agent dashboard kanban (Needs you / Working / Done / Idle) | ❌ | renderer, `main/agent-hooks` |
| Themes: Ghostty import, iTerm profile, Warp import | 🟡 iTerm + Ghostty profile | `main/ghostty`, `main/warp-themes` |

## Tier 2 — review and ship

| Feature | perch | Orca source |
|---|---|---|
| Diff vs start-from ref (`review/diff-viewer`) | 🟡 turn diffs + Git review | `main/git`, `main/source-control` |
| Annotate AI diff → send to agent (`review/annotate-ai-diff`) | ✅ review packets | `main/runtime` |
| Attribution (which agent changed which lines) | 🟡 per-turn capture | `main/agent-hooks` |
| Commit, push, open PR, wait on checks (`review/commit-push`) | 🟡 commit/push; no PR/checks | `main/github`, `main/source-control` |
| File explorer, editor with autosave, Markdown/image/PDF viewers, drag files into prompt (`editing/*`) | 🟡 file buffers + fs | `main/runtime`, renderer |

## Tier 3 — agent operations

| Feature | perch | Orca source |
|---|---|---|
| Hibernation (`agents/hibernation`) | ✅ | `main/runtime` |
| Usage tracking and rate-limit resets (`agents/usage-tracking`) | ❌ | `main/rate-limits`, `main/claude-usage`, `main/codex-usage` |
| Account hot-swap (`agents/codex-hot-swap`) | ❌ | `main/codex-accounts`, `main/claude-accounts` |
| Session history (`agents/session-history`) | 🟡 | `main/ai-vault` |
| Hooks memory (`agents/hooks-memory`) | ❌ | `main/agent-hooks`, `main/memory` |
| CLI that agents drive: worktree create, terminal read/wait/send (`cli/overview`, `cli/reference`) | ❌ | `src/cli`, `main/cli` |
| Orchestration, automations, worktree checkpoints, skills (`cli/*`) | ❌ | `main/automations`, `main/skills` |

## Tier 4 — integrations and remote

| Feature | perch | Orca source |
|---|---|---|
| SSH worktrees, auto-reconnect, port forwarding (`ssh`) | 🟡 hosts (perch/direct modes) | `main/ssh`, `main/ports` |
| Remote Orca server / paired clients (`remote-servers`) | 🟡 federation + pairing | `main/runtime`, `relay` |
| GitHub PRs/issues, Linear, Jira, GitLab (`review/*`) | ❌ | `main/github`, `main/linear`, `main/jira`, `main/gitlab` |

## Tier 5 — heavy surfaces (deferred until Tiers 1–4 are done — user, 2026-09-22)

| Feature | perch | Orca source |
|---|---|---|
| Embedded browser + Design Mode (`browser/*`) | ❌ | `main/browser` (42k lines) |
| Computer use, emulator, speech | ❌ | `main/computer`, `main/emulator`, `main/speech` |
| Native mobile app | 🟡 PWA + device pairing | `mobile/` |
