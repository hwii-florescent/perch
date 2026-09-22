# Perch ADE Rework Specification

Status: implementation contract, draft v1

Date: 2026-09-07

Baseline: current `main` checkout (`15b161b`, `fix stacking/pane split bugs`)

This specification describes the required rework of the existing Perch app. It
is intentionally behavior-first: an implementation is complete only when a
user can perform the flows through the real app and the evidence is recorded.

## 1. Product direction

Perch becomes a local-first agent development environment for supervising a
fleet of coding agents in parallel.

The product should feel like an editor/workspace rather than a chat window:
projects and worktrees are the organizing unit; tabs and panes hold terminals,
chat, files, diffs, and browser views; agent state is visible at a glance; and
review feedback stays attached to the code that caused it.

The implementation combines:

- Orca's useful interaction model: project/worktree-scoped tabs, mixed panes,
  file explorer, editor, diff review, line comments, agent switching, CLI
  control, and a mobile companion.
- Herdr's useful runtime model: one small Rust-owned background server,
  server-owned persistent terminals, explicit agent state, reconnectability,
  remote attach, and bounded resource use.
- Perch's existing strengths: Rust as the source of truth, one Axum
  HTTP/WebSocket core, Tauri plus headless delivery, SQLite history,
  portable-pty/tmux persistence, SSH federation/direct hosts, Claude/Codex
  runners, dockview layouts, and an existing Playwright/Vitest/Rust test base.

The user authorizes adapting Orca's MIT-licensed catalog and launch logic
with attribution. Perch keeps its architecture and distinct visual system;
Orca branding, logos, exact CSS, and proprietary services are outside this
adaptation. The launcher should expose the same catalog of harness CLIs,
distinguish installed from available-to-install agents, support enabling and
disabling them, and launch a selected CLI in the active workspace directory.

## 2. Current state and gap statement

The current repository already has a Rust core and thin React client. It has
hosted structured chat, a real CLI mode, persistent local CLI sessions,
Claude/Codex runners, terminal panes and splits, session history, project-like
cwd grouping, SSH hub/direct hosts, headless phone access, Git worktree
list/create/remove, Git branch/ahead/behind status, responsive mobile chrome,
and substantial automated coverage.

The rework must close these product gaps:

- a cwd-derived project is not yet a durable first-class project/workspace
  entity;
- `fs.browse` currently serves directory selection, not a full file tree and
  file read/write/edit workflow;
- Git status and worktrees exist, but there is no complete source-control and
  branch-diff review surface;
- chat tool diffs are not a general worktree diff viewer;
- there is no persistent, line-anchored review comment model delivered back to
  an agent;
- terminal support needs a general agent/provider registry and clearer
  multi-agent lifecycle/state model;
- Chat/UI versus CLI is currently a global setting and must become a safe
  workspace/session/device interaction;
- browser/PWA access exists, but secure phone pairing and a mobile companion
  workflow are not a complete product contract;
- the current UI is terminal-dense and herdr-inspired but needs Orca-like
  project/worktree/editor/diff composition while remaining fast and RAM-aware.

## 3. Goals and non-goals

### Goals

- Make a project/worktree the stable unit of agent work.
- Make all agent changes inspectable, editable, diffable, and reviewable.
- Make the same server-owned session usable from Chat/UI, CLI, desktop,
  browser, and phone views.
- Make running many sessions cheap enough that users do not need to manually
  hunt for stuck agents or close the app to recover memory.
- Make every important action observable and recoverable after disconnects,
  reloads, host restarts, and mobile reconnection.

### Non-goals for this rework

- Replacing Rust with a Node/Electron backend.
- Building a cloud-hosted agent provider or changing users' model
  subscriptions.
- Implementing every external integration that Orca exposes (GitHub, Linear,
  Jira, Actions, marketplace) before the core workspace is solid.
- Turning the phone into a full desktop IDE. Mobile is a remote-control and
  review surface first; small file edits may be added only if they do not
  compromise safety or performance.
- Making an unbounded “infinite scrollback” promise in browser memory.

## 4. Architecture contract

### 4.1 Source of truth

`perch-core` remains authoritative for:

- projects, workspaces, sessions, panes, agent processes, terminal state,
  filesystem operations, Git operations, remote connections, pairing,
  persistence, permissions, and resource policy;
- authentication and authorization for remote clients;
- capability negotiation and protocol versioning;
- durable state and recovery after a UI reload or process restart.

The React/TypeScript client remains a thin view and interaction layer. It may
cache render state, but it must be able to reconstruct that state from a
server snapshot plus ordered events. No client-only state may be required to
recover an agent, terminal, worktree, comment, file edit, or project.

### 4.2 Protocol parity

Every protocol change updates both:

- `crates/perch-core/src/protocol.rs`
- `packages/shared/src/protocol.ts`

All request/response families use request IDs where an operation can overlap.
All new fields are optional/defaulted where possible so older clients fail
softly. Add a protocol parity test and a capability/version field before
shipping the first new family.

The target message families are:

| Family | Required operations |
| --- | --- |
| `project.*` | list, create/register, rename, update, archive, remove, focus |
| `workspace.*` | snapshot, focus, rename, layout get/set, sleep/wake |
| `session.*` | list, create, resume, subscribe, rename, archive/delete, mode get/set |
| `agent.*` | manifest/list, start, attach, stop, restart, status, prompt, wait |
| `terminal.*` | list, create, split, input, resize, read, observe, kill, hibernate |
| `fs.*` | tree/list, read, write, watch/change event, search, preview |
| `git.*` | status, diff, stage, unstage, discard with confirmation, branch refs, commit with confirmation |
| `review.*` | comment list/create/update/resolve, batch preview, send-to-agent |
| `worktree.*` | list, create, open, remove, status, retry/cancel |
| `pairing.*` | create code, exchange token, list/revoke device, capability/status |
| `notification.*` | unread/attention state and completion/request notifications |

Exact wire shapes may evolve during implementation, but the behavior and
ownership in this table are mandatory.

### 4.3 Domain model

The implementation must distinguish these records even if some are backed by
existing tables initially:

- **Project** — stable ID, display name, host ID, repository root, repo ID,
  default branch/ref, favorite/archive state, and project settings.
- **Workspace** — a visible project checkout/folder, usually a Git worktree;
  includes path, branch/ref, base ref, dirty state, start snapshot, and
  parent/child metadata when applicable.
- **Session** — one agent conversation or CLI session attached to one
  workspace; retains history, mode override, agent/provider, title, unread and
  attention state.
- **Agent** — a provider process and resumable session identity, with manifest,
  command, capabilities, state, last transition, and resource policy.
- **Pane/terminal** — a server-owned process/view target that can have zero or
  more read-only observers but at most one writable input/resize owner unless
  explicitly taken over.
- **File buffer** — path, workspace ID, content representation, encoding,
  external version/hash, dirty state, and save/conflict status.
- **Review comment** — workspace/session/agent ID, path, base revision, side,
  line range, body, status, anchor confidence, and timestamps.
- **Change snapshot** — turn/agent boundary, Git base, changed paths, and
  bounded diff metadata used to show “last agent changes” without storing
  unlimited duplicate file contents.

## 5. Functional requirements

### 5.1 Projects, sessions, and navigation

**PROJ-001 — First-class projects.** A user can register or create a project
from a local folder, existing repository, remote host folder, or worktree. A
project has a stable ID and remains the same project after app reloads,
branch changes, or session renames.

**PROJ-002 — Project-scoped sessions.** Sessions, terminals, files, diffs,
comments, and layouts are scoped to a workspace/project. Switching projects
must not leak tabs, comments, terminal input, or file buffers across projects.

**PROJ-003 — Project sidebar.** The desktop navigation groups host → project →
workspace/worktree → sessions/agents. It supports search/filter, active and
attention state, archived/sleeping state, unread state, branch and dirty
indicators, and a visible “new workspace/session” action.

**PROJ-004 — Session restore.** A reload or reconnect restores the active
project, workspace, tabs/panes, mode selection, scroll positions where safe,
and any server-owned processes that are still alive. A stale record renders a
recoverable error and never silently spawns a duplicate agent.

**PROJ-005 — Attention states.** At minimum, the UI distinguishes `working`,
`blocked`, `done`, `idle`, `sleeping`, `error`, `offline`, and `unknown`. A
blocked/request state is more urgent than an idle state and is actionable from
the sidebar and mobile view.

### 5.2 Files and editing

**FILE-001 — Lazy file tree.** The active workspace exposes a collapsible tree
of directories and files rooted at the workspace path. Directories load on
demand, sort naturally with directories first, and refresh when the agent or
external process changes them. Never scan the entire repository on first
render.

**FILE-002 — Safe file open/read.** Clicking a text file opens a tab with a
stable path and server-provided content/version. Reads are bounded by a
configurable size limit and detect binary/unsupported/too-large files with a
useful preview or explanation. Path traversal, symlink escape, and access
outside the workspace are refused by the core.

**FILE-003 — Edit and save.** A user can edit a supported text file and save
it to the current workspace. Saves are atomic where practical, report success
or a clear error, update Git/file-tree state, and never silently overwrite a
newer external version.

**FILE-004 — External-change conflicts.** If an agent or another process
changes a file after it was opened, the UI shows the conflict with reload,
compare, and deliberate overwrite/merge choices. The conflict state survives a
reload until resolved.

**FILE-005 — Editor ergonomics.** The editor supports line numbers, search,
word wrap, keyboard navigation, syntax-aware highlighting where available,
copy path/relative path, and a visible dirty/conflict/save state. Choose a
memory-conscious editor implementation; do not add a large editor solely for
feature count without measuring its cost.

**FILE-006 — Useful previews.** Markdown, JSON, images, and other safe formats
may have lightweight previews. HTML preview must be isolated from the Perch
shell and clearly marked as workspace content. Previewing must not execute
workspace code in the privileged app context.

### 5.3 Git, diffs, and source control

**GIT-001 — Complete status.** For the active workspace, show branch/ref,
ahead/behind when available, staged, unstaged, untracked, ignored (when
requested), conflicted, and deleted/renamed files. Status refreshes after an
edit, save, agent turn, terminal command, worktree operation, reconnect, and
external filesystem event.

**GIT-002 — Branch/worktree diff.** A diff surface can compare the working
tree against the workspace start ref, current `HEAD`, another branch, or a
selected commit. It includes staged, unstaged, and untracked changes, file
tree navigation, line numbers for both sides, hunk counts, whitespace/wrap
controls, and a clear empty state.

**GIT-003 — Source-control actions.** Users can stage/unstage files and hunks,
discard changes only after explicit confirmation, and commit staged changes
only after explicit confirmation. The UI shows the exact target workspace and
changed paths before destructive or durable operations. Push/PR integration is
out of scope for the first slice unless already available on the host.

**GIT-004 — Agent change history.** Each agent turn records a bounded before /
after status summary and changed-path set. The session can open “last agent
changes” even after later turns, while large contents remain derived from Git
or disk rather than copied indefinitely into the database.

### 5.4 Inline review comments

**REVIEW-001 — Line comments.** On any diff line or editable file line, the
user can create a Markdown-capable comment anchored to the exact path, side,
line/range, workspace revision, and agent/session context. Keyboard and touch
actions are supported.

**REVIEW-002 — Comment lifecycle.** Comments can be edited, resolved,
reopened, deleted before sending, and displayed in a compact thread. The UI
clearly distinguishes unresolved, resolved, stale, and orphaned anchors.

**REVIEW-003 — Re-anchoring.** When a file changes, the core attempts to
re-anchor comments using surrounding context and reports confidence. It must
never silently move a comment to an unrelated line.

**REVIEW-004 — Batch send.** “Send review notes to agent” creates one coherent
review packet containing every unresolved comment, paths, line ranges,
relevant snippets, current revision, and an explicit request to revise or
explain. The user chooses the target agent/session or starts a new one. The
packet is visible before send and comments remain available after send.

**REVIEW-005 — Agent visibility.** The selected agent receives review notes
through the same server-owned session path as normal prompts. A reconnect,
agent restart, or mobile send cannot duplicate a packet.

### 5.5 Terminals and multiple CLI agents

**AGENT-001 — Persistent terminals.** A user can create multiple terminal tabs
and split panes per workspace. Terminals are owned by the Rust runtime and
survive UI reloads and normal Perch restarts where the configured backend can
resume them. Terminal output is bounded in memory and can replay recent
scrollback after reconnect.

**AGENT-002 — Provider manifests.** Agent providers expose a manifest with
display name, executable/launch strategy, supported modes, resumability,
capabilities, status detection, and safe environment/argument handling.
Built-in providers include Claude Code, Codex, OMP (Oh My Pi), Pi, and
OpenCode, alongside ordinary persistent shell terminals. Their own CLI
configuration, tools, extensions, and authentication remain authoritative.
Adding another installed CLI should not require rewriting the
project/session model. Alpha/Beta fixture programs are test infrastructure,
not product providers or proof that these real integrations are complete.

**AGENT-003 — Multiple agents.** Users can run at least two different CLI
agents simultaneously, each visibly associated with its workspace/session,
terminal, provider, and branch. One agent cannot accidentally receive another
agent's input or workspace path.

**AGENT-004 — Agent status.** The core reports working, blocked/requesting
input, done, idle, sleeping, exited, error, and reconnecting states with the
reason and last transition. Status detection must be event-driven where
possible and must not require an aggressive polling loop.

**AGENT-005 — Safe hibernation.** Finished, resumable, non-focused agents may
be hibernated after a configurable idle window. Never hibernate a working,
blocked, actively typed, foreground, mobile-driven, or unsettled-orchestration
agent. Waking restores the same session where the provider supports it; an
unresumable agent shows a clear fresh-session fallback.

**AGENT-006 — CLI control.** A terminal can receive text/keys, resize, be
observed read-only, and be taken over only with explicit authority. Input and
resize ownership are visible. A terminal exit is recoverable and does not
leave a dead handle in the UI.

### 5.6 Chat/UI mode and CLI mode

**MODE-001 — Same session, two views.** A session can be viewed in structured
Chat/UI mode or raw CLI/terminal mode. Switching views attaches to the same
server-owned session and does not create a second provider session or lose
transcript/context.

UI mode is a web view and control surface for the CLI-owned session. Perch
does not supply another agent harness, system prompt, tool loop, or separate
conversation. UI prompts, approvals, cancellation, history, and status must
operate on the same live CLI session through its native control/event
interface or the owned terminal. A view change cannot replace the CLI with
a separate print/RPC runner or make users stop it to send a UI prompt.

**MODE-002 — Scope and persistence.** Support a device default plus a
per-session/workspace override. A mode change is persisted, reflected on
desktop and mobile, and safe when no terminal has started yet. Preserve the
existing gated-start behavior that prevents blank sessions from spawning
agents on app open.

**MODE-003 — Mobile interaction.** On narrow screens, mode switching is
available from the session view and from a long-press/session action sheet.
Terminal views provide touch-friendly scrolling, copy/paste, an accessory row
for awkward keys, and an explicit live-input mode so a user never types into
the wrong agent by accident.

### 5.7 Worktrees and simultaneous work

**WORKTREE-001 — Automatic creation.** From a project, a user can create a
new workspace/worktree with a name, branch, and start-from ref. Branch names
are safely slugified or explicitly entered. Creation runs in the background,
shows progress, and offers retry/cancel on failure.

**WORKTREE-002 — Isolation.** A worktree gets its own files, branch, session
set, panes, layout, agent terminals, file buffers, and review comments. Two
worktrees from one repo can run simultaneously without shared mutable state.

**WORKTREE-003 — Open/discover.** Existing Git worktrees, including ones
created outside Perch, can be discovered and opened. The UI identifies the
primary checkout, linked worktrees, detached heads, stale/prunable entries,
dirty state, host, and path.

**WORKTREE-004 — Safe removal.** The primary checkout cannot be removed from
the worktree action. Dirty child worktrees require explicit force confirmation
and explain what will be lost. Branch deletion is separate from folder removal
and defaults to preserving the branch.

**WORKTREE-005 — Background recovery.** If creation, remote setup, or agent
startup fails, the project remains usable, the failure is persisted, and the
user can retry without duplicating the worktree or agent.

### 5.8 Remote host and phone companion

**REMOTE-001 — Secure pairing.** A desktop/headless Perch host can create a
short-lived pairing code or link. A phone/browser exchanges it for a scoped
device token. Pairing is versioned, revocable, rate-limited, and never exposes
an unauthenticated filesystem or terminal endpoint.

**REMOTE-002 — Transport choices.** Support a direct LAN/Tailscale/gateway
path and keep transport behind an adapter so a relay can be used when the host
is not directly reachable. Use encrypted transport for any non-loopback
connection. The desktop/core remains the source of truth; the phone never
creates an independent agent session for a paired session.

**REMOTE-003 — Reconnect.** The phone reconnects after sleep, network loss,
host restart, or browser reload; it obtains a fresh snapshot and resumes event
streaming without duplicate prompts or terminal input. Stale tokens and
protocol mismatches have actionable error states.

**REMOTE-004 — Mobile capabilities.** A paired phone can:

- list hosts, projects, worktrees, sessions, and agent statuses;
- see recent terminal scrollback and open a session in Chat/UI or CLI view;
- send a prompt/reply, approve or answer a waiting agent, and stop/restart
  where authorized;
- browse the workspace file tree and open supported files/read-only;
- review Git status and diffs, inspect review comments, and add/send notes;
- create/open a worktree or session through the same guarded project flow;
- receive completion/attention notifications when the device allows them.

The phone is intentionally not required to be a full editor in the first
release. Any mobile write action must be explicit, bounded, and conflict-safe.

**REMOTE-005 — Device management.** Desktop and mobile can list, rename, and
revoke paired devices. The UI shows which device owns writable terminal input
and which devices are read-only observers.

### 5.9 Visual and interaction design

**UI-001 — Orca-like workspace composition.** Redesign the desktop shell around
these regions:

1. a compact project/worktree navigation rail with search, attention, branch,
   dirty, and host state;
2. a workspace tab strip whose tabs represent sessions, files, diffs,
   terminals, and other views for the active worktree;
3. a dockable center canvas supporting chat, editor, terminal, diff, and
   browser panes in one saved layout;
4. a lightweight context/inspector surface for agent state, source control,
   review comments, and actions;
5. a status/connection bar with host, branch, mode, and transport state.

The interface should be compact and information-rich like a developer tool,
but Perch must have its own visual language. Do not reproduce Orca screenshots
or exact selectors. Keep terminal palettes sourced from the user's terminal
profile; Perch UI tokens must not recolor a CLI pane.

**UI-002 — Visual system.** Use a restrained dark utility canvas, thin focus
rails, clear active-pane contrast, compact square-ish chrome, and a single
strong accent for focus/attention. Keep body/editor text readable, status
colors redundant with labels/icons, motion sparse, and loading/error/empty
states intentional. Preserve the current herdr-style low-radius, terminal
density where it supports the task, but make project/file/diff hierarchy more
legible than the current terminal-first shell.

**UI-003 — Responsive mobile shell.** At phone widths, use a focused single
pane, a session/project switcher, touch targets of at least 44 CSS px where
practical, bottom or sheet actions, safe-area support, and no horizontal
overflow. Mobile must not mount every desktop pane or editor buffer at once.

**UI-004 — Accessibility.** All actions have keyboard paths on desktop, named
controls, visible focus, semantic status announcements, readable contrast,
reduced-motion support, and usable touch alternatives. Terminal output remains
inspectable as text; do not hide it behind a renderer that leaves the DOM or
accessibility tree empty.

## 6. Performance and RAM contract

Performance is a product requirement, not a final polish pass.

### 6.1 Runtime principles

- One core process per host; multiple UI clients share the same state.
- Lazy-load directories, files, diffs, history, and panes.
- Use bounded ring buffers for terminal scrollback and event replay; spill
  durable history to disk rather than retaining unlimited strings.
- Coalesce high-frequency terminal/chat/filesystem events with backpressure,
  but never reorder input, prompts, or review operations.
- Normalize client state and memoize/virtualize large lists and diff/file
  trees.
- Stop timers and subscriptions when no client or visible resource needs them.
- Hibernate safe idle agents and keep their resume metadata small.
- Avoid reading entire repositories, binary files, or huge diffs into the
  browser without an explicit request.
- Measure every new dependency and renderer. Do not add WebGL or a large IDE
  editor by default; any such change must show a memory/accessibility benefit
  on the actual WebKit and browser paths.

### 6.2 Initial budgets

Before the first performance change, collect a baseline using a fixed fixture
and record the host/OS/runtime. These are initial targets, not permission to
hide regressions:

| Budget | Target |
| --- | --- |
| Rust core idle RSS | ≤ 100 MiB with no active agent and one client |
| Rust core, 8 dormant sessions / 4 terminal panes | ≤ 180 MiB |
| Browser/Tauri client idle JS heap | ≤ 128 MiB after settling |
| Browser/Tauri client, 10 sessions / 4 visible panes | ≤ 256 MiB after settling |
| Idle CPU | ≤ 2% over a 60-second settled window per local core process |
| Local workspace tree open | ≤ 300 ms for a 1,000-entry directory after response arrives |
| Local text file open | ≤ 300 ms for a 1 MiB file, with larger files bounded/streamed |
| Local terminal input echo | ≤ 100 ms p95 on a settled client |
| Local terminal first visible output | ≤ 250 ms p95 after process output |

The acceptance report must include RSS/heap measurement method and fixture.
If a budget cannot be met, the agent must document the measured reason,
containment, and user-visible tradeoff; silently deleting functionality does
not count as optimization.

## 7. Security and safety

- Normalize and authorize every filesystem path on the server. Check symlink
  escapes and workspace ownership before read/write/delete.
- Treat rendered Markdown, HTML, SVG, images, terminal output, Git metadata,
  and agent tool results as untrusted content. Sanitize or isolate before
  rendering.
- Never send secret file contents to a phone, review packet, or agent solely
  because the file appears in a tree. Redact or require an explicit action for
  sensitive paths.
- Pairing tokens are short-lived on creation, stored securely, scoped to a
  device, revocable, and never logged in plaintext.
- Confirm destructive operations: overwrite external edits, discard changes,
  force-remove worktrees, kill agents, revoke devices, delete sessions, and
  commit/push.
- Keep terminal input authority visible and reject stale-client writes.
- Do not weaken existing public-repository sanitization or write internal
  hostnames/credentials into source, tests, screenshots, fixtures, or docs.

## 8. Suggested implementation phases

Each phase must leave the app buildable and verifiable. Update `PLAN.md` and
the relevant Rust/TypeScript tests when a phase is complete.

### Phase A — Baseline and contracts

- Capture current build/test/UI screenshots and performance baseline.
- Add capability/protocol version negotiation and parity fixtures.
- Define migrations and server snapshot/event ordering.
- Add a test fixture project with sentinel files, two fake/real CLI providers,
  an intentional dirty change, and a linked worktree.

### Phase B — Project/workspace model

- Promote cwd groups to durable projects and workspaces.
- Preserve backward compatibility for existing sessions and host IDs.
- Add project/workspace snapshot, focus, archive/sleep, and restore behavior.
- Make layouts and agent state workspace-scoped.

### Phase C — Files and editor

- Add lazy file tree, safe read/write, version hashes, atomic save, conflict
  handling, text editor, and safe previews.
- Add file tabs and restore them per workspace.
- Add filesystem event invalidation with bounded subscriptions.

### Phase D — Git and review

- Add complete Git status, branch/base selection, staged/unstaged/untracked
  diff, source-control actions, and agent-turn change snapshots.
- Add line comments, re-anchoring, resolve/reopen, batch preview, and
  send-to-agent flow.

### Phase E — Agent fleet and mode model

- Add provider manifests, generic CLI terminal creation, status transitions,
  multiple agents, read-only observers, input ownership, and safe hibernation.
- Convert Chat/UI ↔ CLI from a global-only setting to device default plus
  session/workspace override while preserving existing compatibility.

### Phase F — Remote/mobile

- Add pairing/token management, transport adapter, reconnect snapshot, and
  mobile status/scrollback/mode/prompt/file/diff/review flows.
- Add device notifications and writable-input ownership safeguards.

### Phase G — Orca-like shell and performance hardening

- Redesign the desktop and mobile information architecture around project,
  worktree, tabs, mixed panes, and inspector/source-control surfaces.
- Run the bounded visual review and fix responsive, accessibility, loading,
  error, and empty-state defects.
- Measure budgets again with 1/4/8/10-session fixtures and remove leaks,
  duplicate subscriptions, unbounded buffers, and unnecessary work.

## 9. Verification contract

### 9.1 Required automated checks

Run the checks appropriate to the changed slice, then the complete suite before
claiming the goal:

```sh
cargo fmt --check
cargo test --workspace
cargo clippy --workspace --all-targets
npm run build
npm test
cd e2e && npx playwright test
```

Use the repository's existing WebKit/Chromium CLI-rendering config for terminal
changes. New e2e specs must be included in the configured `testMatch` and must
leave artifacts safe for this public repository.

Automated checks must cover protocol parity, path confinement, file version
conflicts, Git status/diff parsing, comment anchoring, duplicate prevention,
agent state transitions, terminal input ownership, persistence/reconnect,
worktree dirty guards, pairing authorization, and performance budgets.

### 9.2 Real UI and device verification gate

This gate is mandatory and cannot be replaced by a headless statement,
function call, HTTP 200, WebSocket reply, or process liveness.

The verifying agent is explicitly allowed to use Computer Use, the in-app or
included browser, Chrome/Safari/other available browser control, screenshots,
desktop app UI control, mobile emulators, terminals, and all other available
tools. Use the least invasive available tool, keep credentials/private data
out of artifacts, and do not perform external destructive actions without
authorization.

For every row below, record: environment, exact user actions, expected visible
state, observed visible state, screenshot/artifact path, command/log evidence,
and pass/fail/unverified disposition.

| ID | Real interaction acceptance |
| --- | --- |
| V-01 | Open the actual desktop/web app, create/register a project, and see it in the project navigation. Reload and confirm the same project identity. |
| V-02 | Create two worktrees from one project, open both, and verify separate paths/branches, sessions, tabs, and file changes. |
| V-03 | Start two different CLI providers/agents in separate persistent panes; type into one and verify only its pane/session changes. |
| V-04 | Switch Chat/UI ↔ CLI for the same session, send/observe a turn, reload, and verify no duplicate provider process or lost context. |
| V-05 | Expand a nested file tree, open a real text file, edit a sentinel value, save, reload the file, and verify the on-disk change and dirty/status update. |
| V-06 | Cause an external/agent edit to the open file and verify the visible conflict flow offers compare/reload/overwrite or merge without silent loss. |
| V-07 | Open branch/working-tree changes and verify staged, unstaged, untracked, rename/delete, line numbers, base selection, empty state, and last-agent-change summary. |
| V-08 | Add two inline comments on exact diff lines, edit/resolve one, preview the batch, send it to the selected agent, and verify the agent receives one coherent packet with anchors. |
| V-09 | Disconnect/restart the core or client and verify sessions, terminals, comments, file conflict state, project/worktree identity, and layout recover safely. |
| V-10 | Pair a phone/phone-sized client through the real pairing flow, reconnect after network/session interruption, and use status, scrollback, Chat/UI ↔ CLI, prompt, file tree, diff, and review-note flows. |
| V-11 | Inspect desktop at a normal wide viewport and mobile at a phone viewport. Verify no clipped controls, hidden focus, unreadable status, accidental horizontal scroll, or desktop-only dead end. |
| V-12 | Leave several finished agents/worktrees idle long enough for the configured resource policy, verify safe hibernation, then reopen and verify resume/fallback behavior. |

If a required physical device, emulator, or browser control is unavailable,
the corresponding row is `UNVERIFIED` and the goal remains open. A screenshot
of a static page without performing the interaction is not evidence of a pass.

### 9.3 Visual QA

For the actual built UI, inspect one batched wide and narrow screenshot round,
fix material issues, and confirm once more. Check:

- project/worktree hierarchy and active state;
- tab/pane boundaries, focus, resize, and restore;
- editor/diff line alignment and comments;
- terminal text legibility and profile fidelity;
- status/blocked/error/offline/empty/loading states;
- keyboard focus and touch targets;
- memory-sensitive lazy loading and absence of duplicate panes.

Run the Impeccable detector once on changed UI targets when no hook is active.
If the work establishes a replacement visual world, finish by documenting the
shipped world in `DESIGN.md`; do not claim visual completion from tests alone.

## 10. Completion definition

The Perch rework goal is complete only when:

1. every required `PROJ`, `FILE`, `GIT`, `REVIEW`, `AGENT`, `MODE`,
   `WORKTREE`, `REMOTE`, and `UI` requirement has a working implementation;
2. no current Perch behavior listed in the architecture/current-state section
   regresses without a documented replacement decision;
3. automated checks pass with no newly introduced warnings or skipped
   acceptance tests;
4. all V-01 through V-12 rows are `PASS`, or a user explicitly accepts a
   written exception; `UNVERIFIED` is not completion;
5. performance budgets are measured on the fixed fixture and the result is
   recorded;
6. the final report links source changes, tests, screenshots, UI observations,
   memory measurements, known limitations, and any follow-up work.

## 11. Reference material

Behavioral inspiration used for this contract:

- [Orca repository](https://github.com/stablyai/orca)
- [Orca mobile companion](https://www.onorca.dev/docs/mobile)
- [Orca worktrees](https://www.onorca.dev/docs/model/worktrees)
- [Orca tabs, panes, and splits](https://www.onorca.dev/docs/model/tabs-panes-splits)
- [Orca file explorer](https://www.onorca.dev/docs/editing/file-explorer)
- [Orca editor/autosave](https://www.onorca.dev/docs/editing/monaco)
- [Orca diff viewer](https://www.onorca.dev/docs/review/diff-viewer)
- [Orca inline review](https://www.onorca.dev/docs/review/annotate-ai-diff)
- [Orca CLI](https://www.onorca.dev/docs/cli/overview)
- [Herdr repository](https://github.com/herdrdev/herdr)
- [Herdr persistence and remote access](https://herdr.dev/docs/persistence-remote/)
- [Herdr socket API](https://herdr.dev/docs/socket-api/)

Repository authorities:

- [`AGENTS.md`](AGENTS.md) — current architecture, invariants, commands, and
  repository safety rules.
- [`PLAN.md`](PLAN.md) — phase record and current Perch baseline.
- [`docs/TESTING.md`](docs/TESTING.md) — existing test strategy.
- [`docs/VERIFICATION-CHECKLIST.md`](docs/VERIFICATION-CHECKLIST.md) — current
  verification expectations.
