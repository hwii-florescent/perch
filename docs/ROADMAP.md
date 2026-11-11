# What remains

Current planning entry point, audited 2026-11-07 at `3aa0afb` (source and doc
inspection, not a fresh acceptance run). Update this file when a gap closes; do
not keep another build order in architecture, research or the parity inventory.
Done slices are described by the code (module `//!` headers) and ARCHITECTURE, not here.

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
| [PROJECTS-WORKER-GUIDE](PROJECTS-WORKER-GUIDE.md) | Rules for the next slice, choices not to reverse, and what is not verified live. |
| [NATIVE-UI-PARITY](NATIVE-UI-PARITY.md) | Row-by-row checklist for the Chat view over the real CLI. |
| [BROWSER-INTEGRATION](BROWSER-INTEGRATION.md) | Unstarted plan for passkeys, popups and browser features. Not scheduled. |
| [SHELL-AGENT-STATUS](SHELL-AGENT-STATUS.md), [IME-MULTICHAR-INPUT](IME-MULTICHAR-INPUT.md) | Agents typed in Terminal tabs; multi-character IME input. |
| [MACOS-PERMISSIONS](MACOS-PERMISSIONS.md), [THEMES](THEMES.md) | Focused platform/theme references. |
| [evidence/](evidence/) | Dated research and probe records behind decisions. |
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

First slice implemented: host-qualified inventory and workspaces/worktrees, text
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
selected workspace through `fs.search` (debounced, superseded searches cancel, skips
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

### 0. Native UI mode at Claude desktop's level (first)

**Target changed 2026-11-06 ([decision](DECISIONS.md)): Claude desktop's Code tab, not
Orca parity.** The transport stays the attached TUI for every provider. The desktop's
competence is mostly product design that works over it; a Claude-only stream-json
mode comes later, only for what needs it (queue cards with Send now, rewind with file
restore, streaming, context breakdown). Ranked gaps that work over the PTY
([evidence](evidence/claude-projects-subsessions-2026-11-06.md)): status and nested
child rows; per-turn changes card; subagent rows (SubagentStart/Stop hooks plus
sidechain transcripts); docked task list (TodoWrite/TaskCreate); permission-mode and
model/effort pickers sent as typed commands with a read-back; plan box; `/compact` and
compaction markers; fork (`--resume --fork-session`).

**Working list: [NATIVE-UI-PARITY.md](NATIVE-UI-PARITY.md)**, a row-by-row
checklist with Orca source files named (Orca stays the code reference for the
terminal-backed rows). Pick rows from it; the bullets below are the summary.

`NativeCliChat.tsx` renders hook/transcript snapshots and types into a verified
empty prompt. Learn from Orca's Chat UI and T3 Code:

- **Transport (decided 2026-11-05): attach to the user's real TUI.** UI mode
  reads and drives the same PTY process as Terminal (Claude hooks, Codex private
  app-server, Pi/OMP extension), so switching is instant and lossless and
  extension dialogs keep working. A headless stream-json/RPC chat (T3 Code's
  design, switch by resuming) is a possible later mode for Claude and Codex only;
  Perch never sees or stores credentials either way.
- **Composer.** Enter queues as reorderable cards while a turn runs; Steer sends
  into the turn where supported; Stop; Rewind to a message (idle only); `/compact`;
  one slash/skill picker; `@file`; image paste; prompt recall. Claude's model, effort and
  permission-mode pickers type the CLI's own command at an idle, verified prompt and show only what the
  CLI reads back (landed 2026-11-06; Codex, Pi and OMP have none yet, see [cli-probes](evidence/cli-probes-2026-11.md)).
- **Send states.** Sending / Not sent (Retry) / unconfirmed after a restart,
  settled from the transcript; never resend a steer or an unproven message.
- **Approvals and questions in the UI.** Claude permission prompt tool and
  `AskUserQuestion`; Codex `requestApproval`. Number keys answer choices; answered
  cards stay as receipts. Phones answer exactly like desktop (decided 2026-11-05).
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
Live-checked on Claude, Codex, Pi and OMP with cheap models
(`e2e/native-composer.spec.ts`): `@file` mention, image path and the command or
skill menu reach the agent. Found and fixed: Claude swallowed Enter when an image
path was pasted (Enter is now a separate write), and Codex 0.166 skills never
listed (the parser matched prose naming the heading).
Approvals and questions: the provider's own events say a turn is blocked (Claude
hooks, Codex app-server, OMP `ask`/approval events, Pi 1.5 `ui_prompt_start`,
which also covers dialogs from extensions the user installed). While blocked the
PTY screen is read (`native_ui/dialog.rs`) for a known choice list: numbered
(Claude, Codex, Pi extensions that copy Claude's dialog; one digit) or radio rows
in a box (OMP `ask`; arrow keys then Enter). The card's buttons or number keys
write those keys under the input lease, only if the screen still shows the same
prompt (`agent.ui.answer`, fingerprint `promptId`). Answered cards stay as
receipts. Typed answers, multi-select and any dialog shape not listed show
"waiting for you, switch to Terminal"; a new extension dialog needs one more
known shape in `dialog.rs`, never a guess. Orca does the same for Pi (state only,
no choices) and answers OMP plan reviews through an extension channel; T3 Code
owns Pi in RPC mode, which this attach-to-the-TUI design does not have.
Live-checked: Claude `AskUserQuestion`, Codex command approval, OMP `ask`, Pi
`ask_user_question` (when installed). Perch launches Claude and Codex with
approvals bypassed, so only questions appear by default. Claude's plan review
(ExitPlanMode) is a card with the plan (live-checked 2026-11-06); OMP tool approvals and
plan reviews are not yet shaped. Phones answer like desktop (decided
2026-11-05); they need the input lease like any other client.
Transcript: runs of thinking, tool calls and results fold into one expandable row
(open while the agent works); the last complete turn's changed files list under the
transcript with a lazy inline diff (`useLastTurnChanges`, `git.status` `lastAgentTurn`
plus `git.diff` compare); Cmd/Ctrl+F finds across messages and run contents; a
prompt rail jumps between user messages. Also fixed: a plain Claude launch read as
`claude-agent-teams` (same executable, last catalog entry won), which dropped its
native bridge.
Context ring (toolbar, amber from 70%, red from 90%, tooltip with tokens) for
Claude, Codex, Pi and OMP via `NativeUiSnapshot.context`: Codex reports it
(`thread/tokenUsage/updated`, `last.totalTokens` over `modelContextWindow`), Pi and
OMP report it through `ctx.getContextUsage()`, Claude gives only per-response usage
in its transcript, so its window is judged from the model id (200k for the older families, else 1M) and
the tooltip says "about". OpenCode has no source yet. Live-checked on Claude; the
Pi/OMP/Codex paths are unit-tested and wait on a run when their accounts are
under the usage limit.
Not yet: background-task strip (Orca feeds it from Claude hooks and structured
child work, the same SubagentStart/SubagentStop source step 2 needs, so it lands
there), queue cards, Steer, Rewind, `/compact` shortcut, prompt recall, Claude
stream-json (not needed for approvals now).

### 1. Instructions: Project and Workspace instructions and files

**Done 2026-11-06 for local Projects and Workspaces** (slice 1 below; ARCHITECTURE).
Not done: the read-only view of the repo's own `CLAUDE.md`/`AGENTS.md`, and remote
Projects. Claude and Codex both read `AGENTS.md`, so Instructions add only
privacy (not in the repo) and per-Workspace text; the missing half of Claude Projects
is persistent memory ("Projects parity" below).

Claude-classic-Projects style, stored **privately by Perch** per Project (and
Quickchat), not in the repo: shared instructions plus reference files/folders that
every new agent session there receives at launch. **Must work for Pi, OMP,
Claude and Codex** in the first cut; label other providers unsupported. Launch
flags (from each installed CLI's `--help`, 2026-11-05; recheck per version):

| Agent | Instructions (appended, never replacing the default prompt) | Reference folders |
|---|---|---|
| Claude | `--append-system-prompt-file <file>` (checked live 2026-11-06; 2.1.319 `--help` names it under `--bare`, and `--append-system-prompt <text>` works too; Claude also pins the prompt on resume, `--system-prompt-snapshot`) | `--add-dir` |
| Pi | `--append-system-prompt <file>` (text or file contents) | none: list paths in the instructions |
| OMP | `--append-system-prompt=<file>` | `--add-dir=` |
| Codex | `-c developer_instructions=…` (not `model_instructions_file`, which replaces the base prompt), passed to the shared app-server that builds each thread | none: the TUI refuses `--add-dir` with `--remote` (0.166), so list paths in the instructions |

Codex's Instructions text travels in argv (`-c developer_instructions=…`), so a local `ps`
can read it. Accepted: Instructions are shared context, not secrets (never put a credential
in them).

Only appended flags; never `--system-prompt` or `--no-context-files`, so repo
`AGENTS.md`/`CLAUDE.md` keep loading. Show the repo's own
`CLAUDE.md`/`AGENTS.md` and Claude memory beside it, read-only. No hosted
knowledge search. Remote Projects keep theirs on the owning core.

### 2. Observe native subagents and teams

Done for Claude's native subagents as roster rows (2026-11-06, `native_ui/subagents.rs`): read from Claude's per-session `subagents/`
files, not from hooks. Still open below: a read-only child transcript, Codex, Pi/OMP, teams.

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
  (any provider/model, same Workspace or a new worktree), a shared task list, messages
  and reports. Children are ordinary Perch sessions shown under their parent.
- **Child session from here.** User-started, optionally seeded through the
  Context Bridge (explicit send).
- **Agents take part through a `perch` CLI, not an MCP server** (no tool schemas in
  every context). They learn about it from a short appended pointer, not a skill
  (decided 2026-11-06; see the plan below). Built: `spawn`, `suggest`, `list`, `read`,
  `stop`, `send`, `inbox`, `cancel`, `steer`, `interrupt`, `report`, `guide`, `whoami`
  (not built, and not planned: `wait`, `tasks`). Authority is a per-session token in the
  launched environment, checked by the core; it only reaches its own run.
- **Reports.** Built as slice 8: a cheap model (Claude `haiku`, Codex `gpt-6-luna`)
  summarizes each finished child turn through the provider's own CLI and the user's
  login; the child's own `perch report` wins, else the last message.
- **Delivery.** Automatic within a run the user started, only into an idle,
  verified-empty prompt (or queued until idle); logged in both transcripts and
  the run view; pause/stop the run at any time. Never paste into a busy PTY,
  never auto-approve a permission. Bounded children, depth and messages per run.
- **Workstream changes:** one combined changed-files view across a run.

Start: `crates/perch-core/src/native_ui/`, `agent_fleet.rs`,
`server/agent_history.rs`, `context_bridge.rs`, `packages/web/src/views/NativeCliChat.tsx`.

#### Perch's version of Claude Projects and sub-sessions (decided 2026-11-06)

Anthropic's Claude Code Projects (public beta, claude.ai/code and the desktop app, not
the CLI; read from `code.claude.com/docs/en/claude-projects`) is a coordinator
conversation that starts a thread per task. Each thread is a separate session, usually
in the cloud on its own branch, optionally on your machine through Remote Control. Shared
instructions and memory, a file library and an Overview of what finished, what is ready
and what needs you sit around it. Its sub-sessions (desktop) let one session list, read,
message and archive others. Both live on Anthropic's side; Perch cannot drive them without
account credentials, and neither crosses providers. Perch builds its own version on its
own sessions, so Claude, Codex, Pi and OMP can work together. Steps 1 to 3 above are this
version; the slices below replace their implied order.

**Decided** (2026-11-05, settled 2026-11-06: [decision](DECISIONS.md),
[evidence](evidence/claude-projects-subsessions-2026-11-06.md))

- **No new noun.** "Project" stays the repository. Shared context is
  **Instructions** on a Project or Workspace; children are chats nested under their lead.
- **Coordinator: an ordinary lead session the user picks**, any provider. Perch never
  splits, assigns, retries or summarises work and hosts no model (no coordinator chat,
  scheduler, kanban or planner).
- **Built on ordinary Perch sessions** and the attached TUI, not structured/RPC chat.
- **Shared context, first cut:** Instructions (16,000-character cap, Anthropic's
  limit) plus reference folders, a snapshot pinned per launch with its provenance; a
  per-run notes folder of plain files that agents read on demand and that is never
  injected. No agent-written memory.
- **Agent entry: an appended pointer, not a skill.** Each Perch-launched session gets
  at most 300 characters through the same append flags as Instructions ("You are in
  Perch session X; run `perch guide` for coordination"); `perch guide` serves the full,
  version-matched text lazily. Only Perch sessions pay; nothing is installed into user
  skill folders. Codex has no per-session skill path, so a skill would need a global
  install. A skill may come later as an opt-in for agents started outside Perch.
- **One `perch` binary.** Agent commands at top level (`whoami`, `guide`, `spawn`,
  `list`, `send`, `inbox`, `report`, `stop`); perchd's current connect-only verbs move
  under `perch daemon …` and stay as aliases.
- **Who may spawn:** any turn of a lead (owner decision 2026-11-08; the person-opened-turn
  rule was dropped), bounded by per-run limits that are settings. Children cannot spawn
  (depth 1).
- **Same Workspace by default**; a child gets a worktree only with `perch spawn --worktree`.
- **Reports are claims, not proof.** Separate records for lifecycle (perchd/provider
  events), "needs you" (pending approval or question, never a model claim), delivery
  receipts, and the agent's own `perch report`. A Stop-hook last message (first 400
  characters) is a labelled fallback. Unknown or disconnected state stays unknown.
- **Messages:** a durable core queue; handed to the receiver at once: an idle one
  starts a turn (Pi/OMP prompt, Codex `turn/start`, for Claude an input-lease take plus
  verified-empty prompt in one step); a busy Pi/OMP takes it in its own follow-up queue;
  a busy Codex or Claude (no follow-up queue) gets it as a steer into the running turn
  (the paths `perch steer` uses). Receipts: delivered / queued in the agent / steered. The envelope names the sender and origin; bodies up to 2,000
  characters, longer ones go to the notes folder with a pointer; a leading `/` is
  neutralised so a message cannot run a command. A message never approves anything.
  Re-validated at delivery (incarnation, scope, cancellation); survives a restart
  without duplicating.
- **Credentials:** a token per session incarnation, stored hashed (like device tokens),
  allowed only operations on its own run, checked before any other credential; the
  core address comes from a 0600 discovery file. Unset in the post-exit login shell,
  revoked when the agent exits; a child never inherits its parent's. That agent's
  subprocesses can read it: scope, not secrecy, is the protection.
- **Limits, enforced in the core before dispatch:** 4 concurrent children, 8
  descendants per run, depth 1, 50 messages per run, 10 automatic wakes of the lead per
  human message.
- **Overview, first cut:** children nest under their lead in the sidebar (By status
  still shows Needs you), and the lead's chat has a compact family strip (state, waiting
  on you, last report). No tab or drawer, no decision gates: a lead asks in its own chat.
- **Phone:** the same as desktop for viewing, messaging, stopping and answering a child
  (with the input lease). Spawning runs only on the local core; remote runs wait for
  owned remote runtimes (alpha item 1).
- **Provider terms:** recheck each release; allow the Codex app-server only on checked
  versions. A later Claude stream-json mode uses the user's own CLI and login, like the
  desktop app.

The ten questions these settle (as posed 2026-11-05; answers above):


1. **Who coordinates.** A normal session of any provider the user picks as lead
   (leaning yes; Perch never assigns, retries or summarises work), or a Perch-run
   coordinator chat (reverses "no coordinator chat"). Being an ordinary session does not
   by itself keep the old decision: the line is behavioural. A user-chosen session that
   spawns and messages children is fine; Perch deciding what to split, retrying or
   synthesising is not.
2. **What a Project holds.** Instructions only (as step 1), or also reference files, a
   shared memory file and a library. Memory needs a scope and atomic, conflict-safe
   updates, and agent-written memory or documents must never silently become trusted
   instructions. Size limit (Anthropic's is reportedly 16,000 characters; unconfirmed).
   One per Project or also per Workspace; can a session opt out.
3. **Naming.** "Project" already means a repository in the sidebar.
4. **Overview.** A drawer, a tab, or only child rows plus Needs You; whether a lead can
   ask the user a question (decision gates) in the first cut.
5. **Reports are claims, not proof.** An agent's `perch report` or a Stop-hook last
   message does not show the work finished, tests passed or a PR is ready. Keep lifecycle,
   task disposition, delivery receipts and reports as separate records; label the hook and
   last-message paths as fallbacks; unknown or disconnected state stays unknown.
6. **Message authority.** Agent-originated sends are not Context Bridge's reviewed,
   explicit send, so they need their own provenance and authorisation. Prefer a
   provider's own queue (Pi, Codex and OMP through the bridge) over typing into a PTY. For
   Claude, checking the prompt and taking the input lease must be one step, not two.
   Queued messages are re-validated at delivery for session incarnation, scope,
   cancellation and authority, and survive a restart without duplicating.
7. **Credentials.** A token per session incarnation, bound to explicit operations and
   targets; a child never inherits its parent's. Environment delivery is not isolation from
   that agent's subprocesses. Audit propagation through the launch bootstrap (it snapshots
   the core environment by default), tmux, resumed sessions, logs and remote launches.
8. **Limits.** Children, depth, descendants, messages and turns are capped and enforced
   before dispatch; usage reported afterwards cannot stop runaway cost.
9. Remote and phone: may a phone approve, message or stop a child? Remote runs wait for
   owned remote runtimes (alpha item 1).
10. Codex app-server and Claude structured sessions: re-check provider terms each release;
    Anthropic paused, not dropped, SDK subscription changes.

**Slices, in order.** Source policy, checks and choices not to reverse:
[PROJECTS-WORKER-GUIDE](PROJECTS-WORKER-GUIDE.md).
One at a time; each ends with its check passing, docs updated and a local commit. Live turns only on `claude-haiku-4-5` or `gpt-5.6-luna`. Claude-desktop
UI rows from step 0 continue between slices.

0. **Feasibility spike. Done 2026-11-06** (table in the
   [evidence](evidence/claude-projects-subsessions-2026-11-06.md)). The pointer reaches
   all four models (Claude and Pi by text or file, OMP by file, Codex by
   `-c developer_instructions` on the TUI and the app-server); every `PERCH_*` name,
   `_TOKEN` included, reaches the agent's shell tool (Claude 2.1.319 did not scrub);
   Pi/OMP follow-ups queue until the turn ends; Codex does **not** refuse a busy
   `turn/start`, it joins the running turn, so idle delivery is the core's check alone.
   Nothing contradicted the plan.
1. **Instructions injection. Done 2026-11-06** (local Projects and Workspaces; remote ones
   and the read-only view of the repo's own `CLAUDE.md`/`AGENTS.md` are not done).
   Store per Project/Workspace, pin a snapshot
   per launch, record provenance; apply on wake/resume, the shell shim and the Codex
   app-server. Check: Rust unit tests for argv per provider and the snapshot; a live
   haiku/luna turn per provider quoting a marker from the instructions; repo
   `AGENTS.md`/`CLAUDE.md` still load.
2. **UI rows sub-sessions need:** status with nested child rows, subagent rows from
   SubagentStart/Stop hooks, docked task list. Check: unit tests on the Rust projection;
   e2e with a native Claude subagent and a TodoWrite turn.
3. **Identity and authority. Done 2026-11-06**: session
   incarnation, scoped hashed token in `PERCH_TOKEN`, discovery file `core.json`, the merged
   `perch` binary with `whoami`, `guide`, `report` and `perch daemon …` (old verbs still
   work), the pointer appended to every launch. Tests: a token cannot act outside its run
   or on any other route, a stale incarnation is refused, the post-exit shell has no
   token; live `perch whoami` from all four providers.
   **3a. Done 2026-11-06 — no tokenless local authority:** every route needs a device token,
   the core's local UI token (the desktop keeps it in memory and signs its webview in with a
   one-use code; headless/dev cores publish it in the 0600 `core.json`) or, on `/agent/*`
   only, an agent token; `PERCH_REQUIRE_PAIRING` is a no-op. Federation sends the remote's
   token as a header (SSH hosts read the remote `core.json`). Limit, written in ARCHITECTURE:
   not a boundary against a same-user process that reads the user's files or another
   process's environment (needs an OS sandbox); a federated desktop-app core is unreachable
   over SSH. **3b. Done 2026-11-06 — `perch` ships in the desktop bundle** (macOS and the Linux
   deb/rpm/AppImage `files` in `tauri.conf.json`; release workflow and `reinstall-desktop.sh`
   build it first; `e2e/packaged-perch.check.mjs`). Not done: there is no headless package to
   put it in (open question for the owner), and the Linux packages were not built here. Slice 4
   makes `perch list` the caller's run (decided); the daemon list becomes `perch daemon list`.
4. **Spawn, list, stop and reports. Done 2026-11-06**:
   `perch spawn|list|stop`, parent link (`sessions.parent_session_id`) and `sub_sessions`
   records, limits (4 live, 8 total, depth 1; since 2026-11-08 per-run settings, no person-turn rule) admitted in one
   transaction before anything starts, an idempotency key, stop confirmed by perchd, reports
   as labelled claims with a last-message fallback, bare `list`/`serve`/`connect` aliases
   gone, `perch guide` extended. Live: a haiku lead spawned a haiku child, read its report and
   stopped it. **Not verified:** a luna Codex child end to end (its quota was spent after it
   started) and `--worktree` live (Rust test only). Deleting a lead stops its live children first;
   Esc in the chat does not (it is not a stop).
5. **Messaging. Done 2026-11-07** (ARCHITECTURE "Messages"):
   `perch send|inbox|cancel`, the durable `agent_mail` queue, idle-only delivery per
   provider, receipts (queued / delivered / unconfirmed / undelivered with a reason),
   the 50-message and 10-wake caps, children's status notes to the lead. Live: a haiku
   lead (chat open) and a haiku child exchanged messages both ways. Delivery rides the
   input lease an open view holds, unchanged, after the idle, empty-prompt and 2 s PTY-quiet
   checks (owner decision 2026-11-07; a composer draft is browser-side and not protected).
   **Not verified live:** delivery to Codex, Pi or OMP receivers.
6. **Family strip and notes folder. Done 2026-11-07** (ARCHITECTURE
   "Family strip"): `crew.get`/`crew.state` (capability `crew.v1`), `parentSessionId` on sessions,
   children nested under their lead in the sidebar, a strip above the lead's composer (state, waiting on
   you, the last message's receipt, the agent's own report, newest traffic first), the run's notes folder
   named in `perch guide`. Live: the strip and the nested row beside a real haiku lead and child; working
   / waiting on you / reported are unit-tested, **"waiting on you" and the phone layout not run live**.

7. **Family strip actions. Done 2026-11-07** (ARCHITECTURE "Family strip
   actions"): Message (default, idle-only, from the person), Steer, Interrupt and Stop on each worker row,
   `crew.act` / `crew.act.result` (capability `crew.actions.v1`) under the lead chat's input lease, receipts
   (`sent` / `confirmed` / `not confirmed`) never retried; the lead may steer and interrupt its own children
   (`perch steer`, `perch interrupt`; refused while the child waits on a person, interrupts capped at 3 per
   child per person's message). Claude steer is offered: its own queue feeds mid-turn text into the turn
   (probed, transcript-confirmed). Live: haiku lead and child, all four actions. **Not run live:** Codex,
   Pi, OMP, a lead's own steer or interrupt, the phone layout.

8. **Cheap-model reporter. Done 2026-11-07** (ARCHITECTURE "Cheap-model
   reporter"): when a child's turn ends, haiku (Claude children; Codex children use `gpt-5.6-luna`; Pi/OMP use
   whichever is installed) writes a 400-character summary from the child's **previous summary plus only that
   turn's events**, so cost stays flat; no periodic model call. A child's own `perch report` of the turn wins,
   else the summary, else the last message; the lead's note and the strip say `Summary by <model>`; settings
   to turn it off or change the models; counted in the spend estimate. Live: haiku lead and child, summary by
   haiku in the note and on the strip. **Not run live:** the Codex runner, Pi/OMP children.
   **8b. Done 2026-11-07** (`reporter.rs`): the model is a setting per harness, each run through
   that harness's own one-shot mode: Claude `haiku`, Codex `gpt-6-luna`, Pi and OMP `provider/model` with no
   default (unset: their children use Claude or Codex when installed, else the last message). Probed Pi and OMP
   with one haiku and one luna call each; the Codex and Claude defaults were checked without spending tokens.

9. **Suggested tasks, sender cards, `perch read`, inbound control** (DECISIONS 2026-11-07).
   **9a. Done 2026-11-07** (ARCHITECTURE "Suggested tasks"): `perch suggest` and, by default, `perch spawn` put a
   card in the lead's chat (Start, Do it here, Options, Start all, Dismiss); a person's click starts the
   sub-session through the same limits and checks as spawn. Setting "Let leads start sub-sessions without asking"
   (default off).
   **9b. Done 2026-11-07** (ARCHITECTURE "Sender cards"): a delivered banner in a user row is a card titled with
   the sender and a link back, for all four providers (parsed in Rust from the snapshot).
   **9c. Done 2026-11-07** (ARCHITECTURE "Reading a sub-session"): `perch read <child> [--turns N]`, lead only, own
   children only, default 2 and at most 5 turns, 8,000 characters, never tool output or file contents.
   **9d. Done 2026-11-07** (ARCHITECTURE "Inbound control"): per session accept / hold / refuse for messages and
   steers from other sessions (row menu and a card in the chat); held ones wait for Deliver or Discard, refused
   ones are `undelivered: refused`; a person's own messages and Perch's notes are never affected. Unit, HTTP and
   jsdom tests only; **no live run**. 9a-9c ran live once (`e2e/suggestions.spec.ts`, haiku lead and child): suggest,
   Start by click, sender card, `perch read`. Not run live: Do it here, Options, Start all, non-Claude receivers.

#### Projects parity (owner direction 2026-11-07; item 1 slice 1 built, rest not started)

Goal: the same feature set as Claude Code Projects (beta), built on Perch sessions and
across providers ([DECISIONS](DECISIONS.md) 2026-11-07, compared in the
[evidence](evidence/claude-projects-subsessions-2026-11-06.md)). Gaps, in order:

1. **Persistent project memory (a must).** Agent-written files plus an index, scoped to
   a Project, surviving the lead session (the per-run notes folder dies with its lead).
   Constraints carried over from the earlier decisions: separate from Instructions and
   never merged into the trusted prompt; contents not injected, only a short pointer or
   index (agents read files on demand); each file records who wrote it and when; people
   can review, edit and delete; atomic writes with a revision check so concurrent
   writers conflict instead of overwriting; what an agent reads there is information from
   a peer, not instructions. **Slice 1 built (2026-11-08):** `memory.rs`, `memory.*` messages
   (`memory.v1`), `perch memory list|read|write|delete`, tests; storage, scope, caps and
   conflict rules settled in [DECISIONS](DECISIONS.md) 2026-11-08. **Memory dialog built** (Project menu: list, edit, create, delete). **Not built:** the Project home page,
   opt-out per session, showing the repo's own `CLAUDE.md` memory beside it, cleanup when a Project is
   removed, and any live run (no agent has used `perch memory` yet).
2. **Library.** Pickable files and folders for a project (Claude: 100 files per pick, 10
   folders). Today only up to 16 reference-folder paths in Instructions.
3. **Project home.** (Layout decided 2026-11-10: a main-view tab per Project. **Built:** the grouped Overview data,
   `project.overview.get` and `projectOverview.ts`. **Not built:** the tab itself.) One place for Instructions, memory, library and threads, and an
   Overview grouped by state (Claude: Ready for review, Waiting on you, Working, Landing,
   Idle, Resolved). Today: nested child rows and the family strip. "No new noun" still
   holds unless the owner renames it.
4. **Branch/PR status per thread** (Claude's Landing state). **Built 2026-11-10 (strip only):** `thread_pr.rs`,
   `CrewRow.branch`/`pr` (`crew.pr.v1`), shown on the family strip. Not built: the Overview groups that use it
   (Ready for review, Landing). Overlaps "Thin PR workflow".
5. **Limits.** Claude allows 500 new threads a day; Perch caps a lead at 4 live and 8 in
   total. Revisit when memory and the project home exist.

Out of reach: cloud threads and the claude.ai `/project` bridge (needs a claude.ai
login Perch cannot drive); remote runs wait for owned remote runtimes (alpha item 1).

Later: Claude stream-json mode (queue cards, rewind, streaming); remote runs.

**Probed live first (2026-11-06):** see slice 0 above and the evidence table; nothing
there changed the plan.

## Later, bounded additions

- **Honest reopen/resume:** stopped-tab UI and retained provider conversation ID.
  Reopening a closed tab (no shortcut since Cmd-Shift-T became New session) starts a fresh harness, not the previous conversation.
  The provider ID part is needed by step 0 (move/resume) and fork.
- From peers ([research](evidence/agent-workspaces-2026-11-05.md)): mark unread and
  a Dock badge; listening ports per Workspace; "why this state" from the evidence
  source Perch already records; sleep idle Workspaces; review size/activity before
  worktree cleanup.
- **Thin PR workflow:** open PR, status/checks through existing tools, not a
  Git hosting or issue-management suite.
- **Scoped CLI beyond sub-sessions:** open/notify and other authorized mutations through
  core (`perch` already covers sessions, messages and reports), not another runtime or
  orchestration engine.
- **Editor syntax colors** (landed, `editorSyntax.ts`): the manual desktop/WebKit and IME
  pass and refreshed visual baselines were never done; Git review diffs are not highlighted.
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

**Cloneable stock UI (SDK 1.10):** the local device's screens, terminal and dock
chrome, browser toolbar and phone screens are clonable `stock:` packages with
regressions (`e2e/stock-ui-clones.spec.ts`, `e2e/relay.check.mjs`). Still owed:
owner acceptance of the host-owned boundary listed in [DECISIONS](DECISIONS.md)
(2026-11-09), a registry (future; manifests already record id, publisher,
version, API range, SHA-256 and install source). Fault injection (bad assets,
blocked storage, bad mod data, a revision dropped or expired mid-load, a core
restart mid-swap, a relay drop mid-fetch, throwing cleanups) and 100 edits of a
package holding a terminal, a draft, timers and tracked work are regressions;
one of each stays live. The page's module cache grows by one copy of a package's
modules per edited revision (4 per edit in that test) until the page reloads;
reloading is the accepted response ([MOD-SDK](MOD-SDK.md)). Not covered: a
throwing class `componentWillUnmount`, and a retry of the stock catalog fetch.

## Not the goal

No parity chase, agent kanban, floating terminal, third navigation palette,
Hosted chat revival, full IDE/debugger, account switching / provider account manager,
scheduler or autonomous planner (orchestration is runs the user starts, above),
issue-tracker clone, computer use/design mode or speculative frontend rewrite.
Do not remove working features/data just because they are off the critical path.
