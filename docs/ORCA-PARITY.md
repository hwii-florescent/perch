# Orca parity: CLI mode

Where perch stands against [Orca](https://github.com/stablyai/orca) on each
feature. The design is in `ARCHITECTURE.md`. Orca's user-facing spec is
`~/Github/orca/docs/site/content/docs/**/*.mdx`, and its logic is under
`src/main/*`.

✅ exists · 🟡 partial · ❌ missing. This was built from a grep survey, so
check a row against the code before building on it.

## Tier 1: the core loop (worktree → agent → watch → restore)

| Feature (Orca doc) | perch | Orca source |
|---|---|---|
| Worktree create: background with progress row, cancel, retry (`model/worktrees`) | ✅ `server/worktree_jobs.rs` (`worktree.job.*`): phase row, cancel undoes only what the job made, retry/dismiss. Local host only; remote hosts keep the synchronous `worktree.create` | `main/git`, `main/runtime` |
| Start-from picker: base ref / local branch / SHA / remote branch | ✅ `worktree.startFrom`: default `origin/HEAD`, remote refs fetched first, new branches `--no-track` | `main/git` |
| Branch name derived from task name, explicit override | ✅ Orca's slug, `-2`… past local/remote branches and taken paths. No branch-prefix setting | `main/git` |
| Shared paths, `.worktreeinclude` copies, shared dirs (APFS clone / symlink) | 🟡 `.worktreeinclude` (literal, gitignored paths) copied with clonefile; `orca.yaml` `worktree.sharedDirectories` symlinked and excluded. No per-user shared-paths setting | `main/git`, `main/runtime` |
| Delete worktree + branch, preserved-branch review, archive, sleep, pin, rename, parent nesting | ✅ `worktree.delete`: `branch -d`, unmerged commits reviewed before a guarded force delete; `workspace.pin`/`workspace.nest`, inline rename. No squash-merge detection, no live-agent check before delete, nesting only chosen at create in the UI | `main/runtime`, `main/persistence` |
| External (`git worktree add`) worktrees: show/hide | ✅ `workspace.visibility`: found on the git poll (`.git/worktrees` fingerprint), start hidden behind a Show card, CLI removal archives the row. No per-source visibility settings | `main/runtime` |
| Launch any supported CLI with autonomy flags; per-agent editable launch args + reset | 🟡 `agent_fleet.rs` manifests | `main/agent-launch`, `main/providers` |
| Status glyphs working / needs-you / done / blocked / idle from hooks + OSC title (`model/agents-sessions`) | ✅ Native bridges for Claude, Codex, Pi/OMP (ask tool, OMP approvals) and OpenCode (permission/question, incl. subagents); OSC title rules (`agent_title.rs`) for every other CLI. No "unverifiable" glyph | `main/agent-hooks` (+ `server/`), `shared/agent-title-status.ts` |
| Restart chip keeps cwd (and account) | ✅ Restart CLI | `main/pty` |
| Agent-finished notification, unread state | 🟡 done/blocked toasts + sound; native OS notifications in the desktop app; one reader policy (`server/session.rs`): unread = `unseen`, 30-minute decay = `stale`. No click-to-switch on desktop | `main/agent-hooks`, renderer `attention/` |
| Tabs, splits right/down, per-worktree layout that persists (`model/tabs-panes-splits`) | 🟡 dockview; per-worktree persistence to verify | renderer |
| PTYs survive app quit; scrollback (incl. output while closed) restored; focused tab restored (`model/session-restore`) | 🟡 perchd owns agent + workspace shells locally (survive runtime crash, scrollback replayed); remote hosts and focused-tab restore pending | `main/daemon`, `main/orcad` |
| Terminal: find in scrollback, link action popover, OSC 52, kitty keyboard, copy context | 🟡 search + OSC 52 exist; kitty, link popover, copy context missing | renderer, `main/pty` |
| Quick Commands (global/project, run in new tab or insert) | ❌ | `main/runtime`, renderer |
| Floating terminal | ❌ | renderer |
| Jump palette Cmd-J (recent agents by attention, worktrees, tabs, create-from-query) | 🟡 Navigator (Ctrl+K) | renderer |
| Quick Open Cmd-P (files, gitignored second pass) | ❌ | `main/runtime` |
| Agent dashboard kanban (Needs you / Working / Done / Idle) | ❌ | renderer, `main/agent-hooks` |
| Themes: Ghostty import, iTerm profile, Warp import | 🟡 iTerm + Ghostty profile | `main/ghostty`, `main/warp-themes` |

## Tier 2: review and ship

| Feature | perch | Orca source |
|---|---|---|
| Diff vs start-from ref (`review/diff-viewer`) | 🟡 turn diffs + Git review | `main/git`, `main/source-control` |
| Annotate AI diff → send to agent (`review/annotate-ai-diff`) | ✅ review packets | `main/runtime` |
| Attribution (which agent changed which lines) | 🟡 per-turn capture | `main/agent-hooks` |
| Commit, push, open PR, wait on checks (`review/commit-push`) | 🟡 commit/push; no PR/checks | `main/github`, `main/source-control` |
| File explorer, editor with autosave, Markdown/image/PDF viewers, drag files into prompt (`editing/*`) | 🟡 file buffers + fs | `main/runtime`, renderer |

## Tier 3: agent operations

| Feature | perch | Orca source |
|---|---|---|
| Hibernation (`agents/hibernation`) | ✅ | `main/runtime` |
| Usage tracking and rate-limit resets (`agents/usage-tracking`) | ❌ | `main/rate-limits`, `main/claude-usage`, `main/codex-usage` |
| Account hot-swap (`agents/codex-hot-swap`) | ❌ | `main/codex-accounts`, `main/claude-accounts` |
| Session history (`agents/session-history`) | 🟡 | `main/ai-vault` |
| Hooks memory (`agents/hooks-memory`) | ❌ | `main/agent-hooks`, `main/memory` |
| CLI that agents drive: worktree create, terminal read/wait/send (`cli/overview`, `cli/reference`) | ❌ | `src/cli`, `main/cli` |
| Orchestration, automations, worktree checkpoints, skills (`cli/*`) | ❌ | `main/automations`, `main/skills` |

## Tier 4: integrations and remote

| Feature | perch | Orca source |
|---|---|---|
| SSH worktrees, auto-reconnect, port forwarding (`ssh`) | 🟡 hosts (perch/direct modes) | `main/ssh`, `main/ports` |
| Remote Orca server / paired clients (`remote-servers`) | 🟡 federation + pairing | `main/runtime`, `relay` |
| GitHub PRs/issues, Linear, Jira, GitLab (`review/*`) | ❌ | `main/github`, `main/linear`, `main/jira`, `main/gitlab` |

## Tier 5: heavy surfaces (deferred until Tiers 1–4 are done)

| Feature | perch | Orca source |
|---|---|---|
| Embedded browser + Design Mode (`browser/*`) | ❌ | `main/browser` (42k lines) |
| Computer use, emulator, speech | ❌ | `main/computer`, `main/emulator`, `main/speech` |
| Native mobile app | 🟡 PWA + device pairing | `mobile/` |
