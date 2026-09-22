# Perch Rework Goal

Status: in progress — completion remains unproven

This is the goal packet to pass to agents when starting the goal command. The
canonical implementation contract is [SPEC.md](SPEC.md). Do not treat this
file as permission to skip product behavior or verification.

## Resume guidance — 2026-09-16

Read the newest checkpoint in [handoff.md](handoff.md) first, then the current
[verification record](docs/ADE-REWORK-VERIFICATION.md), `AGENTS.md`, `PLAN.md`,
the protocol files and `SPEC.md`. The handoff contains the latest test-only
changes and investigations; older PASS tables are historical evidence, not
proof of current completion. Revalidate the worktree and any process handles.

- Preserve the entire objective below. V-07, V-10 and V-12 remain partial;
  broader provider/remote checks and measured resource budgets remain open.
- The Pi freeze investigation found a defect that produces exactly that
  symptom (a failed turn-history capture swallowed the live snapshot) and it
  is fixed, but the original run's evidence is gone, so it is **not proven**
  to have been that run's trigger. Keep watching for a recurrence rather than
  treating the question as closed.
- The September 16 checkpoint records WebKit native UI and native review
  passes for pi, omp, claude and codex. September 21 adds a two-pane OMP/Pi
  native update check. OpenCode was unavailable at that checkpoint; recheck
  installation before treating that old environment blocker as current.
- Every session created for testing must run on the cheapest model — haiku 4.5
  for claude, the luna slug for codex/pi/omp (user instruction, reaffirmed 2026-09-21).
  `e2e/cheapModel.ts` does this per fixture; do not reach for a global setting.
  Assert the actual selected model before the first prompt. An unknown or
  unexpected model must stop the test; never fall back to a costlier model.
  If quota prevents one provider's tests, preserve that missing evidence and
  advance independent work. Do not change global provider settings, disable
  user extensions, weaken assertions or substitute another provider as proof.
- WebKit launch and focused interactions now work. Do not carry forward the
  old blanket setup-blocker claim. A phone-sized loopback client does not
  prove secure pairing or the complete remote/mobile contract.
- Preserve failure evidence before rerunning: Playwright output directories
  and fixed-name screenshots are overwritten. Keep fixture cleanup confined
  to its own recorded processes. Commands and artifact paths are in the handoff.
- Finish with a requirement-by-requirement audit of `SPEC.md`, supported by
  observed interactions and measurements. Update the handoff, verification
  record and phase record after each completed slice; do not mark the goal
  complete merely because the focused tests pass.

## Objective

Rework the current Perch app into a fast, RAM-conscious agent development
workspace with Orca-like project/worktree orchestration and review workflows,
while preserving Perch's Rust-owned core, WebSocket protocol, Tauri desktop
shell, headless web delivery, remote hosts, persistent terminals, and existing
Claude/Codex behavior.

The finished product must let a user observe and direct several coding agents
working in parallel from one project, review and edit the files they changed,
leave line-level feedback for an agent, switch between a structured UI and the
real CLI terminal, and continue from a phone or another browser.

## Required outcomes

- A first-class project/workspace model groups worktrees, sessions, panes,
  files, diffs, comments, and agent activity under a stable project identity.
- The active project folder has a lazy file tree, safe file open/read/write,
  text editing, useful previews, external-change conflict handling, and tabs.
- Users can see branch state, staged/unstaged/untracked changes, the current
  agent's last-turn changes, and a serious line-numbered diff view.
- Users can add inline, line-anchored comments to diffs/files, batch unresolved
  comments, and send one coherent review packet to a selected agent.
- Users can create multiple persistent terminals and run multiple CLI agents
  side by side. Agent providers are discovered/configured rather than limited
  to one hard-coded runner.
- A session can switch between Chat/UI mode and raw CLI/terminal mode without
  spawning duplicate agents or losing context. The mode works on desktop and
  mobile, with a device default and a per-session override.
  UI mode is a web view of the same CLI-owned session, not a separate agent
  harness. Built-in integrations must include Claude Code, Codex, OMP, Pi,
  and OpenCode, as well as ordinary persistent shell terminals.
- Projects can create/open/remove isolated Git worktrees automatically, with
  branch naming, background progress, dirty guards, retryable failures, and
  safe simultaneous work.
- A phone can securely pair with a running Perch host and monitor/steer the
  same project sessions: status, recent scrollback, Chat/UI versus CLI view,
  prompts, file tree, diffs/source control, and reconnect after interruption.
- The desktop UI adopts Orca's information architecture—projects/worktrees at
  the edge, tabs and mixed panes in the workspace, editor/diff/terminal views,
  and compact agent state—with distinct Perch branding and assets; MIT-licensed
  source may be adapted with attribution as authorized below.
- Herdr-inspired runtime behavior is preserved or improved: one lightweight
  Rust-owned background runtime, server-owned terminals, bounded buffers,
  reconnectability, explicit working/blocked/done/idle states, and hibernation
  of safe idle agents.

## Rules for agents

1. Read `AGENTS.md`, `PLAN.md`, the current protocol files, and `SPEC.md`
   before changing code. Treat the existing Rust/TypeScript protocol parity as
   load-bearing: protocol changes update Rust and TypeScript together.
2. Work in small, reviewable phases. Keep existing hosted chat, CLI mode,
   tmux persistence, federation/direct hosts, worktrees, dockview layouts,
   mobile responsive behavior, and current tests working unless the spec
   explicitly replaces a behavior.
3. Keep Rust authoritative for filesystem, Git, agents, terminals, remote
   connections, persistence, security, and resource management. React is a
   view and interaction layer, not a second runtime or source of truth.
4. Do not add an Electron-sized runtime, unbounded in-memory file/terminal
   buffers, eager scans of entire repositories, duplicate agent processes, or
   a renderer that makes terminal text inaccessible to tests and assistive
   technology.
5. The user explicitly authorizes adapting Orca's open-source catalog and
   launch logic under its MIT license, with attribution. Keep a distinct
   Perch visual identity and retain the applicable third-party notices.
6. Keep destructive actions explicit. Never silently discard file edits,
   comments, Git changes, branches, worktrees, credentials, or paired devices.
7. Update the phase record and add focused tests for every completed slice.

## Non-negotiable verification

Agents may use Computer Use, the included/in-app browsers, Chrome or other
available browser control, screenshots, terminals, direct WebSocket inspection,
and every other available tool needed to verify the product. They must use
those tools when a requirement depends on the real UI, browser, desktop shell,
remote connection, or mobile layout.

Unit tests, type checks, HTTP status codes, WebSocket calls, headless smoke
tests, and a process that stays alive are necessary evidence only. They are not
proof that the app works. A goal cannot be marked complete until the real
interaction has been performed and the observed result has been recorded for
each acceptance criterion. If a physical phone, emulator, or controllable
browser is unavailable, mark that requirement unverified/blocked; do not infer
success from a headless statement.

At minimum, the final verification must exercise the real app end to end:

1. create or open a project and an isolated worktree;
2. start at least two different CLI agents/terminals in the same project;
3. switch Chat/UI ↔ CLI and reload/reconnect without losing the agent/session;
4. open and edit a sentinel file, observe the actual Git/agent diff, add an
   inline comment, and send the batched note to an agent;
5. restart or disconnect the host and confirm safe state recovery;
6. pair/connect from a phone-sized or real remote client and perform the
   mobile status, mode-switch, scrollback, prompt, file, and diff flows;
7. inspect desktop and narrow mobile screenshots for layout, focus, overflow,
   loading, error, and empty states;
8. collect exact commands, observed UI states, screenshots, and unresolved
   issues in the verification report.

The completion standard and requirement-by-requirement test matrix are in
`SPEC.md`.

## Reference behavior

- [Orca](https://github.com/stablyai/orca) — multi-agent worktrees, panes,
  mobile companion, file explorer, diffs, inline review, and CLI automation.
- [Herdr](https://github.com/herdrdev/herdr) — lightweight Rust runtime,
  persistent server-owned terminals, state reporting, and remote attach.
