# What remains

Current planning entry point, refreshed against `8dae768` (source inspection,
not a fresh acceptance run). Update this file when a gap closes; do not keep
another build order in architecture, research or the parity inventory.

## Goal and reading map

**A lightweight, terminal-led workspace that brings back the same terminals,
files, changes and decisions—locally and remotely—without replacing your CLI
or editor.** Useful without an agent or Git; optional worktrees, no task ceremony.

| Document | Purpose |
|---|---|
| [ARCHITECTURE](ARCHITECTURE.md) | Current ownership, continuity and safety contracts. |
| [TESTING](TESTING.md) | Check commands, isolated probes and limitations. |
| [DECISIONS](DECISIONS.md) | Approved product choices; newest decision wins. |
| [PUBLIC-ALPHA](PUBLIC-ALPHA.md) | Bounded release contract and candidate evidence gates. |
| [PRODUCT-STRATEGY](PRODUCT-STRATEGY.md) | Long-term rationale, dated research and target designs. |
| [UI-UX-DIRECTION](UI-UX-DIRECTION.md) | Interaction proposals and shared UI conventions, not a ship-status list. |
| [CONTEXT-BRIDGE](CONTEXT-BRIDGE.md) | Implemented context handoff and safety limits. |
| [MACOS-PERMISSIONS](MACOS-PERMISSIONS.md), [THEMES](THEMES.md) | Focused platform/theme references. |
| [ORCA-PARITY](ORCA-PARITY.md) | Optional comparison, not requirements or priorities. |

## Already implemented: extend, do not rebuild

- Local detached PTYs; attach-only recovery, tri-state liveness, fail-closed
  persistent launch, bounded output stages and disclosed history gaps/failures.
- Mixed terminal/file/review strip, bounded splits, per-viewer local restoration,
  canonical Terminal/File/Diff descriptors and idempotent legacy import.
- Confined filesystem, durable drafts/conflicts, CodeMirror editing and drawer
  search; image/PDF/audio/video viewing, archive extraction and downloads.
- Local desktop Open in Default App / Reveal in Finder.
- Git/review/commit/push, anchored feedback packets, worktree lifecycle guards.
- Local Needs You / Welcome Back and bounded Context Bridge (Claude direct send;
  other providers Copy).
- Browser tabs/drawer and desktop native child webviews; phone/PWA pairing and
  shared CLI input; terminal search, kitty keyboard, OSC 52, imported profiles,
  plan-usage display.

These are implementation facts, **not** a claim that D1–D3 or all failure,
security, performance and packaged-install gates have passed. Start with the
existing code/tests linked below; don't infer missing features from unchecked
release checkboxes.

## Remaining alpha work

Priority recommendation: remote workspace → Quick Open → explicit Run, with
resource/attention completion alongside them. This is not a dependency chain;
safety fixes land whenever needed.

### 1. Complete one managed remote workspace path

The hub supports selected worktree/Git/review operations, not full remote
workspace metadata, filesystem, canonical surfaces or attention.

- Route host-qualified inventory, files/drafts, search and viewer presentation
  to their owning remote core; never interpret a remote path locally.
- Show remote nests/worktrees in the workspace UI, including background jobs.
- Reconcile runtime identity and uncertain start/save/stop after disconnect;
  no blind mutation retry, queued keystrokes, duplicate launch or local fallback.
- Consent-based compatible-runtime install/update; preserve running execution.
- Prove D3 on an explicitly authorized actual Linux host, including cleanup.
  No host means blocked evidence, not a loopback substitute.

Start: `crates/perch-core/src/hub.rs`, `ssh.rs`,
`packages/web/src/surfaceSync.ts`, `e2e/remote-git.spec.ts`.

### 2. Workspace Quick Open and coherent actions

- Fast bounded/cancellable file finder scoped to the selected nest, with explicit
  ignore/generated-file policy.
- Reuse Navigator's shell, but go beyond its current session/agent-launch list.
- Share targets/guards across menu, shortcut and palette entry points. Freeze
  the target while a menu is open; domain validation stays server-side.
- Finish session-free connect/browsing. Canonical files need no session parent,
  but today's WS client still resumes/creates a session when connecting.

Start: `packages/web/src/components/Navigator.tsx`, `keybinds.ts`, `ws.ts`,
`crates/perch-core/src/filesystem.rs`. Do not silently rebind existing shortcuts;
Cmd-P currently opens Navigator, not a file finder.

### 3. Explicit Run in a new owned terminal

Show host, cwd and a supported command, then run only on explicit confirmation.
Give execution a visible terminal owner. Cancel creates nothing. Do not paste
into a busy agent/shell, auto-run repository configuration or infer arbitrary
commands from filenames. Saved project commands can follow; a scheduler is not
needed for alpha.

### 4. Finish resource actions, not a full editor

- Safe rendered Markdown with source access and no implicit remote fetches.
- Image zoom/dimensions/decode limits and useful unknown/oversized fallbacks.
- Internal Open With / viewer choice beyond the existing OS-default opener.
- Explicit remote external-open (download/local copy or a remote-aware editor).
- Recheck source/draft distinctions, conflicts, trust boundaries and accessibility
  across existing viewers. Preserve the shipped Context Bridge.

Start: `packages/web/src/components/WorkspaceFiles.tsx`,
`WorkspaceFileAsset.tsx`, `FileEntryMenu.tsx`, `crates/perch-core/src/filesystem.rs`.

### 5. Extend attention across hosts

Local first slice is done. Remaining alpha work is verified remote question
navigation, host-disconnect/reconnect dedupe and honest unsupported states.
Per-user read state across devices, OS-notification deep links, provider question
text and snooze are deferred, not forgotten requirements of the first local slice.

Start: `crates/perch-core/src/server/attention.rs`, `db/attention.rs`,
`packages/web/src/attention.ts`, `e2e/needs-you.spec.ts`.

## Later, bounded additions

- **Honest reopen/resume:** stopped-tab UI and retained provider conversation ID.
  Cmd-Shift-T currently starts a fresh harness, not the previous conversation.
- **Thin PR workflow:** open PR, status/checks through existing tools, not a
  Git hosting or issue-management suite.
- **Scoped CLI:** list/read/open/notify and authorized mutations through core,
  not another runtime or orchestration engine.
- Saved runs; structured JSON/CSV/log viewers where useful; workspace-associated
  port forwarding/remote app preview; phone wide-terminal and delivery polish.
- Chat sorting/manual order; chrome font trial remains undecided.

## Release evidence still owed

[PUBLIC-ALPHA](PUBLIC-ALPHA.md) owns the actual gates: D1 mixed restored canvas,
D2 resource/action workflow, D3 real remote continuity, fault/security checks,
measured performance, differentiation with target users, and clean packaged
install/upgrade. Existing tests are starting points, not candidate certification.

Public README/demo, security/privacy/retention/support guidance and release
notes remain work. GPL-3.0-only and THIRD_PARTY_NOTICES already exist; review
distribution obligations rather than reopening license selection. Resolve the
npm/pnpm contributor workflow deliberately; do not delete a lockfile here.

## Not the goal

No parity chase, agent kanban, floating terminal, third navigation palette,
new Hosted chat, full IDE/debugger, account/quota manager, orchestration suite,
issue-tracker clone, computer use/design mode or speculative frontend rewrite.
Do not remove working features/data just because they are off the critical path.
