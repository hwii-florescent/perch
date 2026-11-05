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
- Local attention (By status sidebar view) and bounded Context Bridge (Claude direct send;
  other providers Copy).
- Browser tabs/drawer and desktop native child webviews; phone/PWA pairing and
  shared CLI input; terminal search, kitty keyboard, OSC 52, imported profiles,
  plan usage, spend estimates and usage alerts.

These are implementation facts, **not** a claim that D1–D3 or all failure,
security, performance and packaged-install gates have passed. Start with the
existing code/tests linked below; don't infer missing features from unchecked
release checkboxes.

## Remaining alpha work

Priority recommendation: remote workspace → Quick Open → explicit Run, with
resource/attention completion alongside them. This is not a dependency chain;
safety fixes land whenever needed.

### 1. Complete one managed remote workspace path

First slice implemented: host-qualified inventory and nests/worktrees, text
files/durable drafts/search, Git/review and canonical file/diff surfaces with
per-viewer presentation now route to their owning core. In-flight resource
requests fail with an unknown outcome on disconnect; drafts reconcile by
reading before retrying. Remote inventory stays visibly stale while offline.
An actual Linux resource/core-restart probe passed; this is **not full D3**
([evidence](evidence/remote-workspace-2026-10-23.md)).

Remaining:

- Complete persistent owned-shell/provider-runtime routing and incarnation/
  uncertain start/stop reconciliation. No blind mutation retry, queued
  keystrokes, duplicate launch or local fallback; test lost save acknowledgements.
- Relay remote background worktree jobs (synchronous worktree operations work).
- Add bounded authenticated remote media/download transport. It is explicitly
  unavailable today; OS-default opening remains local-only.
- Consent-based compatible-runtime install/update; preserve running execution.
- Prove D3 on an explicitly authorized actual Linux host, including cleanup.
  No host means blocked evidence, not a loopback substitute.

Start: `crates/perch-core/src/hub.rs`, `ssh.rs`,
`packages/web/src/surfaceSync.ts`, `e2e/remote-git.spec.ts`.

### 2. Workspace Quick Open and coherent actions

First slice implemented: typing in Navigator (Cmd-P) searches filenames in the
selected nest through `fs.search` (debounced, superseded searches cancel, skips
VCS/dependency/build folders, does not read .gitignore, 200-hit/20k-entry/2s
bounds, local and relayed remote cores). Remaining:

- Ranking/fuzzy matching, recent files, and an ignore policy that honours
  .gitignore (today a bounded breadth-first walk, not an index).
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

First slice implemented, **local only**: `> command` in Navigator confirms host,
folder and command, then `workspace.run.v1` starts a NEW owned terminal (the
command is one positional argument of a wrapper shell, never PTY input). The
request id is a durable one-shot admission (`workspace_runs`), so a lost reply,
core crash or deleted tab never re-runs it; an unknown outcome is reported, not
retried. Remote hosts are refused until owned remote runtimes exist (item 1).
Remaining: saved project commands, remote Run, a visible running/exited state in
Navigator.

### Also landed: place history and command marks

- Back/Forward (`navHistory.ts`): per-window, in-memory history of sessions,
  files, changes and pages. Ctrl-- / Ctrl-Shift-- on a Mac, Alt-Shift-Left/Right
  elsewhere, and mouse buttons 4/5. Closed places are skipped; it never starts or
  relaunches anything. Not persisted across reloads.
- OSC 133 command marks (`commandMarks.ts`): jump to the previous/next command
  and a scrollbar tick per failed one. Observe-only. Perch does **not** inject
  shell integration, so marks appear only for shells that already emit OSC 133
  and for a confirmed Run; opt-in zsh/bash/fish integration is the open follow-up.

### Also landed: three ways to reach a phone

Settings → Devices: same Wi-Fi, Tailscale (guided setup), and a relay you deploy
(`relay/`, free Cloudflare Worker; end-to-end sealed, phone needs only a browser
— [decision](DECISIONS.md)). Not yet verified: a deployed Worker, iOS Safari and
the PWA/home-screen path, real Cloudflare free-plan limits. A build can name a relay
(`PERCH_DEFAULT_RELAY`) to offer it as one "Remote access" switch; no hosted
relay is deployed yet. Open: a key-reset
button, flow control for big files, a pinned bootstrap so the relay operator
cannot swap the page, relay-aware push notifications.

### 4. Finish resource actions, not a full editor

- Markdown preview and image zoom/dimensions/limits landed
  ([decision](DECISIONS.md)); still owed: real relay viewing and skipping the
  relay fetch for oversized files. Remaining: useful unknown-file fallbacks.
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

## Next: native UI mode, then Projects and sub-sessions

Owner direction 2026-11-05 ([decision](DECISIONS.md),
[research](evidence/agent-workspaces-2026-11-05.md)). Order: polish UI mode first;
each later step builds on it. Terminal stays the default for every agent; Chat
is opt-in per agent until the user changes it.

### 0. Native UI mode at Orca's level (first)

Today `NativeCliChat.tsx` (124 lines) renders hook/transcript snapshots and types
into a verified empty prompt. Learn from Orca's Chat UI and T3 Code:

- **Transport per provider.** Codex: the existing private app-server
  (`native_ui/codex.rs`). Claude: a structured stream-json session of the
  unmodified `claude` binary under the user's own login, as Orca does; Perch never
  sees or stores credentials. Others and remote hosts: today's terminal-backed
  view. Choose Chat or Terminal per agent; move a conversation between them by
  resuming it, one writer at a time (never two processes on one conversation).
- **Composer.** Enter queues as reorderable cards while a turn runs; Steer sends
  into the turn where supported; Stop; Rewind to a message (idle only); `/compact`;
  one slash/skill picker; `@file`; image paste; prompt recall. Model/effort are
  chosen before the session starts, not changed mid-session.
- **Send states.** Sending / Not sent (Retry) / unconfirmed after a restart,
  settled from the transcript; never resend a steer or an unproven message.
- **Approvals and questions in the UI.** Claude permission prompt tool and
  `AskUserQuestion`; Codex `requestApproval`. Number keys answer choices; answered
  cards stay as receipts. Phone policy decided before phones can approve.
- **Transcript.** Collapsed tool/thinking runs, inline diff cards, per-turn
  changed files (reuse `agent_change_snapshots`), context-use ring, message rail,
  find, a background-task strip, and subagent child rows (step 2).
- Restore open chats after a restart; offer to resume interrupted ones.

Done so far (2026-11-05): Hosted chat removed, one global Chat/Terminal switch
(Terminal default); composer's one round button (Send, Queue while working, Stop
in its place when the draft is empty, Esc stops, disabled reason as title) and
honest send states (pending copy in the transcript; an unconfirmed send is never
replayed and returns to the composer as a new message); one autocomplete menu
(`/command` at the start of a Claude message, `$skill` for Codex, `@file` for
every provider, from `commands.list` and `fs.search`); attach button, paste and
drop stage files on this computer and send their paths with the message (remote
sessions: not yet). Commands and skills come only from Claude and Codex today.
Not yet: queue cards, Steer, Rewind, `/compact` shortcut, prompt recall,
approvals, transcript features, Claude stream-json.

### 1. Projects: Birdhouse instructions and files

Claude-classic-Projects style, stored **privately by Perch** per Birdhouse (and
Quickchat), not in the repo: shared instructions plus reference files/folders that
every new agent session there receives at launch. **Must work for Pi, OMP,
Claude and Codex** in the first cut; label other providers unsupported. Launch
flags (from each installed CLI's `--help`, 2026-11-05; recheck per version):

| Agent | Instructions (appended, never replacing the default prompt) | Reference folders |
|---|---|---|
| Claude | `--append-system-prompt-file <file>` | `--add-dir` |
| Pi | `--append-system-prompt <file>` (text or file contents) | none: list paths in the instructions |
| OMP | `--append-system-prompt=<file>` | `--add-dir=` |
| Codex | `-c developer_instructions=…` (not `model_instructions_file`, which replaces the base prompt); pass it to the shared app-server too | `--add-dir` |

Only appended flags; never `--system-prompt` or `--no-context-files`, so repo
`AGENTS.md`/`CLAUDE.md` keep loading. Show the repo's own
`CLAUDE.md`/`AGENTS.md` and Claude memory beside it, read-only. No hosted
knowledge search. Remote Birdhouses keep theirs on the owning core.

### 2. Observe native subagents and teams

Child rows under a session, with status, description, model and a read-only
transcript: Claude `SubagentStart`/`SubagentStop` hooks plus
`<session>/subagents/agent-*.jsonl` and `.meta.json` (undocumented; best effort);
Codex `parentThreadId`; Claude agent teams via `TeammateIdle`/`Task*` hooks and
`~/.claude/{teams,tasks}` when the user enabled them. Worktree subagents link to
their diff. Stop a child only where the provider offers it (Codex app-server,
Claude structured session).

### 3. Perch sub-sessions and orchestration

What Claude agent teams do, across providers: full sessions, not in-process
subagents, that a lead and the user can see, message and stop.

- **Runs you start.** A Perch-owned run graph: lead session, child sessions
  (any provider/model, same Nest or a new worktree), a shared task list, messages
  and reports. Children are ordinary Perch sessions shown under their parent.
- **Child session from here.** User-started, optionally seeded through the
  Context Bridge (explicit send).
- **Agents take part through a `perch` CLI plus one skill, not an MCP server**
  (no tool schemas in every context). Sketch: `perch spawn --agent --model
  --worktree --task`, `perch send`, `perch report --outcome --files`, `perch wait`,
  `perch tasks`. Authority is a per-session token in the launched environment,
  checked by the core; it only reaches its own run.
- **Reports.** A child's Stop hook files its last message as a report; optionally
  summarized by a cheap model (default Haiku 5.5) through the provider's own CLI
  and the user's login.
- **Delivery.** Automatic within a run the user started, only into an idle,
  verified-empty prompt (or queued until idle); logged in both transcripts and
  the run view; pause/stop the run at any time. Never paste into a busy PTY,
  never auto-approve a permission. Bounded children, depth and messages per run.
- **Workstream changes:** one combined changed-files view across a run.

Start: `crates/perch-core/src/native_ui/`, `agent_fleet.rs`,
`server/agent_history.rs`, `context_bridge.rs`, `packages/web/src/views/NativeCliChat.tsx`.

Open before building (ask the owner when the step starts):

- Codex app-server and Claude structured sessions: re-check provider terms at
  each release; Anthropic paused, not dropped, SDK subscription changes.
- Project instructions: one per Birdhouse or also per Nest; size limits; can a
  session opt out?
- Run UI: a run view in the drawer, a tab, or only child rows plus Needs You?
  Decision gates (lead asks the user) in the first cut?
- Remote and phone: may a phone approve, message or stop a child? Remote runs
  wait for owned remote runtimes (alpha item 1).

## Later, bounded additions

- **Honest reopen/resume:** stopped-tab UI and retained provider conversation ID.
  Cmd-Shift-T currently starts a fresh harness, not the previous conversation.
  The provider ID part is needed by step 0 (move/resume) and fork.
- From peers ([research](evidence/agent-workspaces-2026-11-05.md)): mark unread and
  a Dock badge; listening ports per Nest; "why this state" from the evidence
  source Perch already records; sleep idle Nests; review size/activity before
  worktree cleanup.
- **Thin PR workflow:** open PR, status/checks through existing tools, not a
  Git hosting or issue-management suite.
- **Scoped CLI:** list/read/open/notify and authorized mutations through core,
  not another runtime or orchestration engine.
- Saved runs; structured JSON/CSV/log viewers where useful; workspace-associated
  port forwarding/remote app preview; phone wide-terminal and delivery polish.
- Sort chats by last updated; chrome font trial remains undecided.

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
Hosted chat revival, full IDE/debugger, account switching / provider account manager,
scheduler or autonomous planner (orchestration is runs the user starts, above),
issue-tracker clone, computer use/design mode or speculative frontend rewrite.
Do not remove working features/data just because they are off the critical path.
