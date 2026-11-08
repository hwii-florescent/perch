# Decisions

Approved product choices and deferred alternatives. Newer decisions override
older proposals; approval is not proof of implementation. Current ownership
contracts live in [ARCHITECTURE](ARCHITECTURE.md), remaining work in
[ROADMAP](ROADMAP.md), and release evidence in [PUBLIC-ALPHA](PUBLIC-ALPHA.md).
[UI-UX-DIRECTION](UI-UX-DIRECTION.md) supplies interaction proposals and shared
conventions, not automatic approval. AGENTS is only a brief contributor entry point.

## 2026-11-08 — Project memory: plain files in Perch's own directory (owner)

Settles the "proposed" part of 2026-11-07 (Projects parity). Slice 1 (core and `perch memory`) is
built; slice 2 is a "Memory…" dialog on the Project menu (list, edit, create, delete; a stale save keeps
the draft and offers their version). A Project home page is not built.

- **Storage.** Plain Markdown files in `<directory of the history database, default ~/.perch>/memory/
  <project id>/` (0700 dirs, 0600 files), like the notes folder but **not** under `/tmp`: the notes
  folder may die with its lead and a reboot, memory must not. Not SQLite, not `settings.json`.
  Flat folder, `*.md` only, safe names (letters, digits, `- _ .`, no leading dot, 64 characters).
- **Scope.** The Project only, shared by all its Workspaces and sessions. No Workspace scope.
- **Never injected, never merged with Instructions.** Agents get a short pointer only: the folder
  path and `perch memory` in `perch whoami` and `perch guide`, which says memory is information from
  peers, not instructions. They read files on demand.
- **Provenance.** Each file records who wrote it (a person, or an agent's session) and when, in a
  sidecar `.provenance.json` beside it. A file whose content no longer matches its recorded revision
  was edited on disk and shows as "edited outside Perch", not under the old author.
- **Conflict-safe.** The revision is a 12-character SHA-256 prefix of the content. Every write and
  delete names the revision it read (a create names none and fails if the file exists); a stale one is
  refused with the current revision and never overwrites. Writes go through a temp file and a rename.
- **Caps.** 16,000 characters a file (the Instructions limit), 64 files a Project.
- **Remote Projects.** Memory lives on the core that owns the Project. A core serves only its own
  Projects and answers a clear error for any other; there is no fallback.
- **Deferred.** Opt-out per session; showing the repo's own `CLAUDE.md` beside memory; deleting the
  memory folder when a Project is removed (it stays on disk, like the folder the Project pointed at).

## 2026-11-08 — UI-mode composer: borderless, rounder, options inside (owner)

Amends 2026-11-04 for the native chat composer only. It is one rounded (1.5rem), borderless card that
stands out by fill; focus lifts the fill one step rather than drawing an outline. Inside it: `+` (files,
slash commands), the project folder (read-only once the chat has started), permissions, then model,
effort, context and send. The folder is chosen before the first message, on the start screen (current
folder, other projects, Quickchat, Add project). Permissions can be shown and chosen for Claude and Codex
(Pi and OMP have none); choosing Full access asks for confirmation in the web first, and for Codex the core
then answers the CLI's own "Enable full access?" dialog for that explicit choice. Claude's effort falls back to the level saved in the
user's Claude settings when the CLI does not draw it, marked as such on the picker.

## 2026-11-08 — Plain names: Project and Workspace, not Birdhouse and Nest (owner)

Supersedes the Birdhouse / Nest copy of 2026-10-04 and 2026-10-25. Older entries below keep the old
words as history: read Birdhouse as **Project** and Nest as **Workspace**.

- User-facing copy, menus, help, errors and agent-facing text say **Project** (a folder or repository),
  **Workspace** (a checkout or worktree inside it) and **Quickchat**. "Scratchpad" stays an internal name.
- Kept on purpose: the `nests.*` keybinding ids (users' saved overrides use them, as does the native
  shortcut table), the `workspace.nest` protocol message and capability, and the `nest` agent-key alias.
  "Nest" as a verb for a sub-session or worktree under its parent is unchanged and is not copy.
- Internal names such as `orderedNests` or `NEST_JUMPS` were not churned; rename them when touched.

## 2026-11-08 — Sidebar: one tree, Project → Workspace → Session, attention-aware (owner)

Supersedes the two-section entry below and amends 2026-11-03 "By status replaces Needs You" and
2026-10-24/25 (session dots). Orca organizes (Project → Workspace → agents, group-by and sort kept apart);
Herdr tracks attention (rollups, priority, done-unseen). Perch keeps Orca's one structure and adds
Herdr's attention to it; a second list was tried and dropped (it repeated every chat and ate height).

- **One tree is the default** ("By project"). Under each workspace row, sessions that matter show as
  rows: Needs you, Done, Working, the open chat, and the lead of a shown sub-session. Idle ones fold into
  "+N idle" (click to open, "Hide idle" to fold). The open workspace lists all its chats. An unreachable
  host folds nothing: last-known states are not trusted to hide a chat.
- **A folded project** shows its most urgent state and how many chats are in it. No session dots.
- **Header chip** "N need(s) you" opens the next chat that needs you (same as Cmd-Shift-U). It counts
  reachable hosts only.
- **Organize menu:** By project (tree), By status (flat; Needs you, Done, Working, Idle; the old default),
  In one list (newest first, no drag). Under By project: **Sort by attention** (urgent projects and
  workspaces first, favourites and pinned workspaces stay first, no drag while on) and **Show active only**
  (hides projects/workspaces with nothing going on except the open one). Both are per viewer and off
  or on as saved: sort defaults to the core's order; active-only defaults to off.
- **By status stays organized by project:** each status section lists its chats under small project
  headings (the sidebar's project order, Quickchat last; the workspace name shows on the row when the
  project has several). Drag and Move stay within a project's chats in that section.
- **By status rows are compact:** the harness mark and the name on one line (the workspace, or why it
  needs you, muted after it); no state ring, since the section heading already says the state. Project
  headings carry a hover "+" (worktree menu for a git project, new session otherwise). A final **No
  sessions** section lists projects with no agent chat, each with its "+"; clicking one opens it.
- **By status reads in three levels, with no bands or rules.** A section heading is the state's colour as a
  dot (same tokens as the status ring: red Needs you, teal Done, yellow Working, hollow green Idle) before
  the label in full text colour, so contrast never depends on the hue and the state is named, not only
  coloured. Neutral sections (No sessions, Offline: last known) get a hollow grey dot. Space above a heading
  is the separator. A project line has a folder mark and its name in text colour; its chats sit one step in
  with a 2px gap, as the harness mark and a muted title. Rows are 36px on a phone and 24px on desktop.
- **A chat row says its state at the end, the way Herdr does:** "Needs you" and "Done" as a small tinted
  word, a quiet dot for Working, nothing for Idle; the harness mark has no state ring. A folded project
  shows the same badge for its most urgent state, with a count. An unreachable host shows none.
- **Agents only:** plain terminals get no sidebar row (they stay tabs). A terminal where an agent was
  started by hand is listed while that agent runs (observed `currentProviderId`). **Show terminals** in the
  Organize menu lists them too; it is per viewer, off by default. A session with no harness recorded
  (native chat) is listed.
- **Saved choices:** `status` and `list` keep meaning what they did; `project` and the retired
  `workspace` open the tree. The Compact/List session setting and the Sessions section are gone.
- **Phone:** the same tree and the same Organize menu; no separate switcher.
- Kept: a chat being read stays in Done until you leave it; "Offline: last known"; core-owned order,
  drag with landing line and Move up/down; Quickchat strip.
- Not done: blocked child promoting its parent's rank, a recent-activity sort (no reliable timestamp).
- Not verified: WebKit, the desktop app, a real phone, real agent turns (needs-you e2e was edited, not run).

## 2026-11-08 — Sidebar: Projects above Sessions, like Herdr's Spaces and Agents (owner) — superseded above

Amends 2026-11-03 "By status replaces Needs You" and the Organize menu (D6/D6a). Learned from Herdr
(Spaces + Agents lists in one sidebar) and Orca (grouping and sorting kept apart); not a port.

- **Desktop shows two sections at once:** *Projects* (the project/workspace tree, stable order, favourites
  first) above *Sessions*, each scrolling alone. The Sessions header folds the section and, folded,
  says how many chats need you. Session rows stay session-level: a workspace is never moved into a
  status bucket, because a workspace can hold a blocked, a working and a finished chat at once.
- **Sessions arrangements** (Organize menu): **By status** (default; Needs you, Done, Working, Idle),
  **By workspace** (a header per workspace in the sidebar's project order, with count, fold, and the most
  urgent state when folded) and **In one list** (newest first, no drag). **Projects only** hides the
  section; it is the old saved value `project`, so existing choices keep meaning what they did.
- **Context where grouping drops it:** a By status row names its project, plus the workspace when the
  project has several; By workspace rows leave it to the header. A Needs you row keeps the core's
  reason and certainty.
- **Phone unchanged:** no room for both, so it shows the projects or the sessions, as before.
- **Not done:** an aggregate state on a workspace row beyond the session dots already there, a pin or
  priority sort of sessions, and workflow stages (Todo/In review) for workspaces.
- Not verified: WebKit, the desktop app window, a real phone. Verified: unit tests, and headless
  Chromium for sidebar.spec 2b/2c/2e/2f (the Needs you spec was not re-run: it drives real agent turns).

## 2026-11-07 — Projects parity: persistent memory and a project home (owner)

Owner direction: Perch should have the same feature as Claude Code Projects (beta), not
only Instructions. Instructions alone duplicate `AGENTS.md`, which Claude and Codex both
read; they add privacy and per-Nest text, nothing else.

- **Persistent project memory is a must.** This lifts "no agent-written memory in the first
  cut" (2026-11-06): that was a first-cut deferral, listed as "Later", not a rejection.
  Design constraints stay as decided then: agent-written content never silently becomes
  trusted Instructions; scope and atomic, conflict-safe updates; provenance per file; a
  person can review, edit and delete. Proposed, to be settled when the slice starts: a
  per-Birdhouse memory folder with an index, never injected (only a short pointer), read
  by agents on demand like the notes folder.
- **Also in scope, in order:** a library of picked files and folders, a project home with an
  Overview grouped by state, branch/PR status per thread, and a review of the 4-live/8-total
  limits. Out of reach: cloud threads and the claude.ai `/project` bridge.
- **Unchanged:** the lead is an ordinary session the user picks; Perch hosts no model, planner
  or scheduler; no new noun for "Project" (it stays the Birdhouse) until the owner renames it.
- Steps and open questions: [ROADMAP](ROADMAP.md) "Projects parity". Nothing here is built.

## 2026-11-07 — Desktop shell is three full-height cards on a backdrop (owner)

The main view looked like the sidebars because every layer was the same shell color, and
the empty gutters between them had no edge. Decided after mockups on real screenshots.

- **Three cards, full height:** the sidebar, the main view (tab strip inside its top edge)
  and the drawer each run from the window's top to the status bar as rounded (12px)
  cards, 8px apart and 8px in from the window edge. Each card carries its own 44px head
  row: the sidebar toggle and traffic lights, the tabs, the Files/Git switch. The status
  bar sits on the backdrop. The phone layout is unchanged.
- **Backdrop, derived per theme:** cards and panes keep `--panel-bg`; only the backdrop is
  new. `backdropFor` (`themes.ts`) sets `--backdrop` in `applyTheme`: `panelBg` darkened
  toward black until it is 1.12:1 against it, or, for a shell already too dark
  (terminal, vesper), lightened toward the text color. Custom themes get one for free;
  it is not in `resolveTheme`, so the Rust-compared fixture is unchanged. In the glass
  app the backdrop and cards are the same 86% translucent mixes as before.
- **Split gaps** inside the main card show the backdrop, so panes still read as separate
  tiles.
- **Replaces** "no vertical rules, open shell-colored gutters" (Layout, below): the
  gutters are now backdrop-colored, still without rules. Compact seams, fine dividers and
  glass cards were considered; glass remains a possible later option.
- **Not verified:** the macOS app (the traffic lights are re-centred 8px lower in
  `glass.rs`, with the lights 8px further in and a 78px left padding, unchecked on a real window), WebKit, and the
  split-pane look with real split sets.

## 2026-11-07 — Suggested tasks, sender cards, `perch read`, inbound control (owner)

Closes the gaps against Claude desktop's sub-sessions (desktop doc: "Work across sessions",
"Start a task that Claude suggests").

- **Suggested-task cards.** `perch suggest` puts a card in the lead's chat with **Start**,
  **Do it here** (sends the task to the lead as a message), **Options** (provider, model,
  worktree, permissions) and **Start all** for several. A setting "Let leads start
  sub-sessions without asking" decides whether `perch spawn` starts directly (on a
  person-opened turn, as today) or becomes a card. Default changed to start directly
  (owner, 2026-11-08): a terminal-mode lead has no chat to show a card in.
- **Sender cards.** An incoming message shows in the receiver as a card titled with the
  sending session and a link back, not plain text.
- **`perch read <child>`.** The lead reads a bounded tail of its own child's transcript
  (recent turns, tool-run sentences, changed files) on demand. Own run only.
- **Inbound control** per session: accept (default), hold for my approval, or refuse messages
  from other sessions; a refusal is reported to the sender.

## 2026-11-07 — Cheap-model reporter for sub-sessions (owner)

The expensive child model does not write reports. When a child's turn ends, Perch asks a
cheap model through the user's own CLI login (default Haiku for Claude children, gpt-5.6-luna
for Codex; Pi/OMP children use whichever is available; configurable, can be off) to summarise
a bounded slice of that turn into at most 400 characters plus a status (done, blocked, needs
you, failed), labelled with the model that wrote it. A child's own `perch report` still wins
when given; `perch guide` no longer asks for one. One call per child turn, capped input,
skipped over run limits, counted in spend estimates. A summary is a claim, not proof. Within
the 2026-11-05 allowance ("reporters default to Haiku 5.5"): Perch still never plans,
assigns or retries work.

## 2026-11-07 — Family strip actions: Message, Stop, Steer, Interrupt (owner)

- Each child row in the lead's family strip gets **Message**, **Stop**, **Steer** and
  **Interrupt**. Message is the default and keeps the slice 5 rule: queued, delivered only
  when the child is idle. Stop is the confirmed `perch stop`.
- **Steer** sends the text into the child's running turn, and **Interrupt** stops the
  current turn without ending the session. A person does both from the UI (desktop or phone,
  with the input lease rules). **The lead may steer and interrupt its own children** with
  `perch steer` and `perch interrupt` (a child cannot do either to anyone): `perch send` stays
  idle-only and queued messages stay the default; a steer is a message for the limits, keeps the
  envelope, the 2,000-character cap and the quoting, and never approves anything; neither is
  allowed while the child waits on a person's approval or answer; a lead's interrupts are capped at
  3 per child per person's message to it. Each uses the provider's own mechanism; a provider
  without a confirmable one shows the action disabled with the reason, never a PTY guess.
  *Built 2026-11-07:* Claude's own prompt queue proved to feed mid-turn text into the turn, so Steer
  is offered for Claude too (probe in evidence/cli-probes-2026-11.md).

## 2026-11-06 — Local authority, `perch list`, packaging, live pickers (owner)

- **No more tokenless loopback authority**, before slice 4. Every client of the core
  presents a token: a paired device, the core's own local UI (a per-launch token handed
  to its desktop webview and headless dev/e2e clients), or an agent (only `/agent/*`).
  An agent omitting its token gets nothing. `PERCH_REQUIRE_PAIRING` becomes moot.
  *Built 2026-11-06* (details and threat model in [ARCHITECTURE](ARCHITECTURE.md)): the desktop
  keeps its token in memory; a federation hub presents a remote core's token as a header
  (read over SSH); `PERCH_LOCAL_TOKEN` is a launcher/test hook only. Not a boundary against a
  same-user process that deliberately reads the user's files or environments.
- **`perch list` lists the caller's run** (lead and children). The daemon list is only
  `perch daemon list`; `ps`, `cleanup` and `release` keep their bare aliases.
- **Packaging now:** desktop and headless packages ship `perch` beside the core, with a
  check that a packaged launch can run `perch whoami`.
- **Live model/effort/permission-mode pickers: yes.** Port Orca's picker components;
  apply by typing the CLI's own command only at an idle, verified prompt under the input
  lease, and show the change only once read back. This replaces "no model chrome over a
  live session" (2026-11-05).

## 2026-11-06 — Claude desktop as the UI target; Projects and sub-sessions settled (owner)

Settles the open items of the 2026-11-05 direction below. Details and slice order in
[ROADMAP](ROADMAP.md) ("Perch's version of Claude Projects and sub-sessions");
research in [evidence](evidence/claude-projects-subsessions-2026-11-06.md).

- **UI target is Claude desktop's Code tab, not Orca parity.** The attached TUI stays
  the transport for every provider; build what works over it first (status and nested
  rows, per-turn changes, subagent rows, task list, typed pickers with read-back, plan
  box, compact). A Claude-only stream-json mode is a later addition for queue cards,
  rewind with file restore and streaming.
- **No new noun.** "Project" stays the Birdhouse. Shared context is **Instructions** on
  a Birdhouse or Nest; children are chats nested under their lead.
- **Shared context:** Instructions (16,000 characters) and reference folders, pinned
  per launch with provenance, plus a per-run notes folder that is never injected. No
  agent-written memory in the first cut.
- **Lead:** an ordinary session the user picks. Children may be started only during a
  turn a person opened; children cannot spawn (depth 1).
- **Agent entry:** a short appended pointer (at most 300 characters) in Perch-launched
  sessions and a lazy `perch guide`, not an installed skill. This narrows "CLI plus a
  skill" (2026-11-05): Codex has no per-session skill path.
- **One `perch` binary:** agent commands at top level; perchd's connect-only verbs move
  under `perch daemon` and keep aliases.
- **Overview:** nested child rows plus a family strip in the lead's chat; no tab, no
  decision gates.
- **Messages:** durable core queue, delivered only at idle, never steering; sender
  envelope, 2,000-character bodies with longer ones as notes-folder files, a leading `/`
  neutralised, never an approval.
- **Limits before dispatch:** 4 concurrent children, 8 descendants, depth 1, 50 messages
  per run, 10 automatic lead wakes per human message.
- **Credentials:** per-incarnation token, hashed, scoped to its run, checked before the
  loopback exemption, removed from the post-exit shell and revoked at exit.
- **Phone:** same as desktop for messaging, stopping and answering children; spawning on
  the local core only.

## 2026-11-05 — File drops also work in ordinary shells

Owner correction: dropping files must not depend on the saved launch provider.
Ordinary Terminal sessions and auxiliary shell panes accept the same file drops
as agent tabs, including after an agent is started manually inside the shell.
Keep writable-input checks, safe path quoting, no automatic Enter and explicit
Option/Alt intent for remote SCP transfers.

## 2026-11-05 — Native UI mode, Projects and Perch sub-sessions (owner direction)

Direction, not yet a detailed design; [ROADMAP](ROADMAP.md) holds the steps and
open questions, [research](evidence/agent-workspaces-2026-11-05.md) the evidence.

- **UI mode becomes fully native**, at Orca/T3 Code's level, beside real terminals.
  This replaces "no new UI/CLI modes" (UI-UX-DIRECTION) and the "chat mode is one
  global setting" constraint. The legacy Hosted chat was **removed**
  (runners, `chat.*`, `session.history`, model/effort plumbing, `hosted` mode);
  the new mode is built on provider sessions. Claude runs as the unmodified binary
  under the user's own login; Perch never handles credentials. **Terminal stays
  the default** for every agent until the user picks Chat.
- **Projects** are per-Birdhouse instructions and reference files stored privately
  by Perch and passed to agents at launch; the first cut must support Pi, OMP,
  Claude and Codex. No coordinator chat, no hosted RAG.
- **Sub-sessions** are full child sessions (like Claude agent teams, not
  in-process subagents) in runs the user starts: visible under their parent,
  messaging and reporting through Perch. Native subagents/teams are observed.
- **Agents reach Perch through a `perch` CLI plus a skill, not an MCP server**, to
  keep tool schemas out of every context (the skill became an appended pointer to
  `perch guide`, 2026-11-06). This narrows "no orchestration suite" to
  no scheduler, kanban or autonomous planner.
- Inter-agent messages are automatic within a user-started run, but only into an
  idle verified prompt; never into a busy PTY, never auto-approving permissions.
- Model and effort are picked when a session or child starts (reporters default
  to Haiku, set per harness since 2026-11-07); still no model chrome over a live session.

## 2026-11-05 — Real desktop apps as a switchable view: withdrawn (owner)

The 2026-11-04 plan to move the ChatGPT/Codex and Claude desktop apps' windows over
Perch's (and the later glued-window variant) is dropped. The native UI mode above
covers the need inside Perch; the never-committed code was deleted. Do not rebuild
window-overlay or window-gluing features.

## 2026-11-04 — Usage popover: plan usage, spend and alerts (owner)

Amends the earlier "report available facts, no accounting/quota product" stance.
The status-bar trigger is unchanged; the popover grows:

- **Plan usage:** plan names, model-scoped windows and, for Codex, banked
  rate-limit resets with a confirmed **Use one** redeem (it spends a paid credit,
  so never from a paired phone).
- **API-equivalent spend:** estimated from the agents' local logs at list prices
  (today / 7 days / 30 days, top models, the open Claude 5h block, burn rate, and
  30-day spend beside the plan price). An estimate, not a bill.
- **Alerts:** a plan window crossing a threshold (default 80%) and a daily spend
  budget (default off) arrive through the existing toast / system-notification
  path, not Needs You, which is session-scoped. Settings → Notifications → Usage.
- Data stays local: usage is never relayed to remote hosts. Still no account
  switching, billing or provider account management.

## 2026-11-04 — A native iPhone app, as a shell around the desktop's UI (owner)

Reverses "no native app" (2026-11-02) for iOS only. `ios/` is a small SwiftUI
app: a Connect screen (scan the pairing QR, or type the address and code from
Settings → Devices), then the paired desktop's own web UI in a full-screen
`WKWebView`. The UI is always served by the desktop (or its relay), so it never
drifts from the desktop's protocol and the web code stays the one phone UI.

- **Pairing is unchanged.** The app opens `address#pair=CODE` and the web
  `PairingGate` claims it; the device token stays the core's cookie (through
  a relay, the page's storage, as in a browser). The app keeps the link
  (without the code) in the Keychain; a relay link's key is in it. Wi-Fi and
  Tailscale pair by QR or typed address and code; a relay by QR only, since
  its key is never shown as text.
- **Bridge.** `window.webkit.messageHandlers.perchApp` (`web/src/nativeApp.ts`):
  `paste` returns the clipboard (plain-http pages cannot read it), `disconnect`
  forgets the computer and its website data. Settings shows **Change computer**
  only in the app. Other sites open in Safari.
- **Not included:** App Store/TestFlight, push notifications, background
  connections, Android, bundling the UI in the app. Dev builds only; free Apple
  ID signing expires after seven days.

## 2026-11-04 — One soft, borderless component language (owner)

- Every control follows the main shell: filled surfaces, **no borders or
  hairlines**, one 8px `--radius` (menus, dialogs, popovers, fields, buttons,
  badges, settings, the Git drawer). Fields are a `surface-0`/`surface-1` fill
  (one step off their container); focus is a 1px accent outline; hover and
  selected are fills, never a border colour or a left accent bar.
  `input, select, textarea` default to `border: 0` in `base.css`.
- Hosted chat was removed 2026-11-05; `ui/chat.ts`, `ui/composer.ts` and
  `chat.css` now only serve the native chat view.

## 2026-11-03 — By status replaces Needs You; the core owns sidebar order (owner)

- **By status** is the sidebar's default Organize view, shown as Needs you, Done,
  Working and Idle with counts. A chat being read stays in Done until you leave
  it. While the active host is disconnected its chats appear under "Offline: last
  known". By project and In one list remain; a saved choice is respected.
- **The Needs You button and panel are removed**, on desktop and phone. So are
  Recent updates, Welcome Back, Dismiss, changed-file chips, Review N files and
  the unread dot. The core attention service, `attention.v1` and read-on-view
  stay. Cmd/Alt-Shift-U shows the sidebar and opens the next chat needing you. A
  count sits on the existing control that opens the sidebar when it is hidden.
- **The phone reflects the desktop.** Project and chat order live in the owning
  core (`workspace_order`, capability `workspace.order.v1`), which narrows the
  per-viewer rule for order only. Focus, file-tab position and split geometry
  stay per viewer. A host without the capability keeps the default sort, with no
  drag and no local fallback.
- **Reordering** uses native drag with a landing line, plus Move up/down in row
  menus; drag is off in the compact phone layout. Favourites stay first. A chat
  move writes only the workspaces it touches, so other tab strips do not change.
  Unlisted chats default to their strip order (oldest first). Tab strips stay
  oldest first; Quickchat and By status show that order mirrored, newest first
  (like Orca's sidebar), and a move is mirrored back into strip order before it
  is written, so a first drag cannot flip the strips. In one list stays strictly
  newest first, with no drag. Nest order is not reorderable.
- **Markdown files** get a Source/Preview toggle that renders the draft. Nothing
  remote is fetched: images and media become text placeholders. Relative images
  use the confined local file route, and show placeholders on remote hosts and
  relay pages. Images get zoom, Fit, 100%, pan, dimensions and a 50 MiB limit.

Verified by unit tests and headless Chromium, including a two-viewer reorder. Not
verified: live cross-host reorder, WebKit, real relay viewing, phone-width touch
targets and the desktop app. On a relay, an oversized file is still fetched into
memory before the viewer shows its fallback.

## 2026-11-02 — Three ways to reach a phone; the relay is one you deploy (approved)

**Decision.** Settings → Devices offers, side by side: the same Wi-Fi, Tailscale
(with setup guidance when it is missing), and a **relay** you run yourself.
Nothing is on by default and any can be used without the others. This replaces
the proposal below: no Perch-hosted service, no Noise handshake, no native app.

- **Relay.** `relay/` is a small Cloudflare Worker (free plan, one Durable
  Object per room, WebSocket Hibernation) that routes opaque frames and serves
  the web app as static assets. The user deploys it and pastes its address.
  The core dials out to it (`crates/perch-core/src/relay/`), so client
  isolation and NAT stop mattering and the phone needs only a browser.
- **Keys.** The core makes a 32-byte key and a host secret once (`relay.json`,
  mode 0600). The room id is the SHA-256 of the host secret, so the relay stores
  nothing and a phone that knows only the room id cannot become the host. The
  key travels in the link's `#fragment`, which a browser never sends.
- **Sealing.** AES-256-GCM per frame; a hello exchange adds fresh nonces from
  both sides, and every frame's AAD binds both nonces, the direction and a
  per-direction counter. A relay can drop a session but not read, forge, replay,
  reorder or reflect a frame. Rust and browser seal the same bytes
  (`wire.fixture.json`).
- **Authority is unchanged.** Tunnelled requests are marked `x-perch-relay` so
  `local_request` treats them as remote: the paired-device token is checked on
  every request and `/pair` is still how a phone gets one. Only the five data
  routes are reachable; the app itself comes from the relay's assets.
- **Phone side.** `packages/web/src/relay/` replaces `fetch` of those routes
  and the `/ws` socket only when the page was opened from a relay link. Media,
  PDFs and downloads are fetched through the tunnel into object URLs.

**One switch for users who do not want to deploy.** A build can name a relay
(`PERCH_DEFAULT_RELAY`, build time or environment; never committed). When it
does, Settings → Devices shows **Remote access** as one switch that points the
relay setting at it; "Use your own relay instead" stays. The maintainers who
name it run it and are trusted with the page the phone loads, as with other
tools' hosted relays. A shared relay needs Cloudflare's paid Workers plan
(the free plan's request limits are per account), and per-room abuse limits
beyond the current 16 phones per room and 1 MiB per frame.

**Known limits, stated plainly.**

- The relay also serves the page that holds the key, so whoever controls the
  relay's deployment can ship code that leaks it. That is why the relay is one
  you deploy, not one shared with strangers. A pinned or signed bootstrap is
  future work.
- The link has no reset button yet; deleting `relay.json` rotates the key and
  invalidates every relay link (pairing tokens stay valid on the LAN).
- No flow control beyond bounded queues: large files cross the relay slowly and
  whole in memory.
- Turning Wi-Fi access off while the relay is on leaves already-open Wi-Fi
  sockets until they reconnect.
- Verified: Rust unit and in-process tests, a real `wrangler dev` Worker with a
  real core and a real browser (`e2e/relay.check.mjs`). Not verified: a deployed
  Worker, iOS Safari, Cloudflare's free-plan limits under real use.

## 2026-10-28 — Perch Relay: reach a phone without Tailscale (superseded 2026-11-02)

**Problem.** A paired phone reaches the desktop directly: the same Wi-Fi or
Tailscale (`server/phone_access.rs`). Many campus, office and apartment networks
keep Wi-Fi clients apart, and Tailscale needs an install and sign-in on both
devices. T3 Code (T3 Connect) and Orca (Orca Relay) solve this with a hosted
service both sides dial out to, plus accounts and native apps.

**Proposal.** An optional relay, off by default, that only carries ciphertext.

- **Pairing.** Settings → Devices → "Reach from anywhere". The QR carries the
  relay URL, a random 128-bit rendezvous id, the desktop's X25519 public key and
  the existing one-time pairing code. Nothing about the pairing reaches the
  relay except the rendezvous id.
- **Transport.** Desktop and phone each open an outbound WSS to the relay; it
  joins the two sockets by rendezvous id and splices frames. Neither side
  accepts inbound connections, so client isolation and NAT stop mattering.
- **End-to-end encryption.** Noise `XX` (X25519, ChaCha20-Poly1305) inside the
  WSS. The phone pins the desktop key from the QR; the desktop records the
  phone's key with its device entry. The relay sees IPs, timing and sizes, never
  terminal bytes, files or tokens. Revoking a device (existing `device.revoke`)
  also forgets its key and drops its relay session.
- **No accounts in v1.** The desktop proves it owns a rendezvous id with a
  signature from its key; the relay stores only ids, public keys and limits.
- **Same semantics as a direct connection.** A relay drop is a disconnect:
  unknown runtime state, never exit; no queued keystrokes, no blind retries.
  Direct LAN/Tailscale is preferred whenever it answers.

**Where the phone's code comes from (the hard part).** A web page served by
the relay could be replaced with one that reads everything, which defeats the
encryption. That is why Orca and T3 ship native apps. Proposed instead: a tiny,
auditable bootstrap page on a static origin separate from the relay (a pinned
release on the project's site). Its service worker does the Noise handshake and
fetches the real UI bundle *from the desktop* through the tunnel, so the UI is
always the paired desktop's own version. The trusted surface is the bootstrap
(a few hundred lines), not the relay or the whole app. `ws.ts` gets a transport
shim, because a service worker cannot proxy WebSockets. A native app stays a
later option, not a prerequisite.

**Running it.**

- One open-source Rust binary, `perch-relay` (axum, in-memory state), that
  anyone can self-host; the desktop takes a relay URL setting.
- A project-run default instance (Cloudflare Workers + Durable Objects or one
  small VM). Limits: frame size, per-rendezvous bandwidth, idle timeout,
  connection rate per IP. Needs a privacy note (what metadata exists, retention:
  none beyond live sessions) and an owner for cost and abuse.

**Phases.** (1) `perch-relay` + Noise tunnel, tested with a self-hosted relay and
a phone that first loaded the UI over LAN/Tailscale; (2) bootstrap origin, so a
first pairing needs no direct path; (3) project-hosted default instance;
(4) Web Push for Needs You (iOS 16.4+ home-screen PWAs), if wanted.

**Alternatives considered.** Embedding Tailscale: `tailscale-rs` is official
Rust but an experimental preview with auth-key-only sign-in and no
Serve/Funnel/HTTPS; `libtailscale` (Go tsnet) adds a Go runtime to every build;
either way the phone still needs the Tailscale app. Tailscale Funnel / Cloudflare
Quick Tunnels: TLS ends at the provider and Perch's shells sit on a public URL
behind pairing alone. Native mobile app: largest scope, second codebase, store
review. Accounts (T3/Orca style): unnecessary when the QR already exchanges keys.

**Open questions.** Who runs and pays for the default instance; whether a relay
is compatible with "Hosted is frozen" (it is transport, not hosted chat);
whether phones on both direct and relay paths should switch automatically
(proposed: prefer direct, fall back to relay, show which in the header).

## 2026-10-27 — Browser continuity, tab identity and address suggestions (proposed, awaiting approval)

A browser tab or drawer page remembers the address it last showed, so a restart
reopens that page (fresh load: back/forward history, scroll and form state are
not kept). Its tab shows the page's own title and favicon (globe until known or
when the icon fails to load); the tab strip, not the webview, owns that text.
The favicon address is read from the page (`<link rel=icon>`, else
`/favicon.ico`) and loaded by the UI directly, so no third party sees the sites.

The address bar behaves like other browsers: focus selects the address; typing
or ↓ opens a list: the typed action first (go / search, exactly what Enter
did before) then history matches by prefix, frequency and recency (empty bar: recent pages); ↑/↓ choose,
Enter opens, Esc closes the list then restores the address; × removes an entry;
Settings → General → Browser clears history.

History is owned by the core (`browser_history` in its SQLite database, capability
`browser.history.v1`), like other browsers keep theirs: shared by every window and
phone of this core, kept across webview-storage resets, capped at 5000 pages. The
core validates and ranks it; the UI only asks. Only plain http(s) addresses are
stored, never fragments (they can carry tokens) or perch's own addresses (pairing
links). Query strings are kept, as other browsers do, so a token passed in one is
remembered too; every paired phone of this core can read the history. It stays on the local core: it is the user's, not a remote workspace's.
Without the capability (an older core) the bar simply has no suggestions. The
per-tab last address/title/icon stays in per-window storage, like open file tabs.

Search suggestions follow Firefox's composition and Vivaldi's consent. The list is
the typed action first (Firefox's "heuristic" row), up to 4 engine suggestions, then
3 history rows (all the room for history when suggestions are off or empty). Like
Vivaldi (and Brave) they are **off by default**, because everything typed, even if
it never becomes a search, is sent to the engine; Settings \u2192 Browser \u2192 Search
suggestions turns them on. The core asks the selected engine's OpenSearch suggestion
endpoint (capability `browser.suggest.v1`, via `curl` like `usage.rs`): no cookies,
referrer or account, 3 s, size-bounded, at most 4 lookups in flight, after a 150 ms
typing pause. Address-shaped input (a scheme, or one dotted word) is never sent.
Not done: Firefox's "previous searches" (clock) rows, tail suggestions and
per-engine suggest-URL editing. The dropdown hides the native page while open,
like menus and dialogs. Title/favicon reading is verified by the native probe
(`close_shortcut_probe`); the dropdown's look is unverified in a real window.

## 2026-10-26 — Browser search preferences

Settings → General → Browser chooses Google (default), DuckDuckGo, Bing or Brave
for address-bar searches in tabs and the drawer. The choice is persisted by the
core and shared with connected viewers. Addresses keep their normal resolution:
HTTPS for bare public domains, HTTP for local development addresses, and an
explicit HTTP(S) scheme is preserved. Existing settings/older peers use Google.

Cmd+W also closes a browser page while that page has keyboard focus. A native page
is its own web view, so the desktop app's File > Close Tab menu item (Cmd+W) reports
which page, if any, holds focus and the UI closes that tab or drawer page. With no page
focused (or focus unreadable) the menu sends nothing; the main view's own key handler
owns that case. Only the default Cmd+W binding is honoured from a page (a rebound or
disabled Close Tab does nothing there). Unverified in a real window.

## 2026-10-25 — Explorer signals and compact status controls

Owner approved the Files/Git visual study, with restrained theme-derived file
icons and separate Git markers. This refines the right-hand explorer and Git
file rows; the left Birdhouse/Nest/session hierarchy and Git actions stay.

- File/folder icons recognize filename/extension conventions (including package
  manifests, libraries and config files); they do not analyze dependencies or
  infer package ownership. Search results and Git rows reuse the same icons.
  Desktop explorer matches VS Code's 13px text and 22px rows, with 8px
  indentation per level, including narrow drawers. Phone viewports (≤700px), not drawer width,
  enable tree targets of at least 44px. Collapsing a folder keeps the cursor
  highlight for keyboard navigation; it does not select/open a file. Birdhouse hover/selection
  uses the same neutral `surface-1` fill as session rows.
- Git markers use the existing core snapshot: M modified, U untracked, A added,
  D deleted, R renamed, C copied, T type changed, ! merge conflict, ? unknown.
  A mixed marker such as M/M distinguishes index and working-tree changes;
  accessible descriptions spell out both states. Folders summarize descendant
  changes with a quiet dot. Deleted files remain in Git, not phantom tree rows.
- Badges are snapshots, not live diagnostics: refresh on opening/reconnecting,
  file-tree refresh and existing Git actions. A loading label identifies refresh;
  unavailable Git hides badges without claiming a clean tree. No ignored status
  is guessed from a folder name.
- Warning/error diagnostics in the study were illustrative. A real compiler or
  linter source, counts and editor squiggles are not part of this implementation.
- Needs You is a compact bell with its actionable count or unread dot, no visible
  text label. Accessible name/title, keyboard shortcut, upward panel, Welcome
  Back and attention semantics remain. It has no distinct resting fill or
  attention-colored text; hover uses the normal neutral button fill. Bell/count
  and usage share the vertical center of the compact bar. Phone targets remain
  at least 44px.

## 2026-10-25 — Glass shell, system UI font, Birdhouse/Nest/Scratchpad

Owner-approved follow-up to the soft separation below, from the v3–v5 visual
studies. Layout, glass and Needs You are desktop only; the system font and
Birdhouse/Nest/Scratchpad copy also apply on the phone, whose layout is unchanged.
Style changes still ship separately from behavior changes.

- **System UI font for chrome.** Tabs, sidebar, status bar, panels and menus use
  the system sans stack (`--font-ui`). Monospace stays for the terminal (server
  profile), editor, diffs, code and keycaps. Settles the old "Chrome font" trial.
- **Glass on macOS.** The desktop app's window is transparent with native
  vibrancy behind one translucent shell layer (`--shell-bg`, a mix of the
  theme's own `--panel-bg`). Panes, menus, dialogs and the terminal stay opaque.
  Web mode and Windows/Linux keep the opaque shell with the identical layout.
  Under Reduce Transparency macOS draws the vibrancy layer solid, so the shell is
  effectively opaque (to confirm on a Mac). Costs the `macos-private-api`
  Tauri feature, which Mac App Store review rejects (not a distribution channel).
- **Native browser pages are rounded all round** (8px, WKWebView layer from Rust),
  replacing the "square at the bottom" limit below. Unverified on a real Mac.
- **Status bar matches the v4 study:** 26px high, 10px chrome type and 9px
  usage type. Connection dot, actual host name (Local for local), path, branch
  icon and branch sit left; optional zoom/context/cost recede at narrow widths.
  Needs You sits left of Claude/Codex usage, followed by a connection check
  (not an agent-success indicator). Harness identity stays in tabs/sidebar.
- **Sidebar:** Nests sit inside their Birdhouse. Compact mode puts up to three
  session chips inline at the Nest row's right end (more wrap to their own
  line); Session list mode expands only the active Nest. Both modes and the
  Organize menu stay. Section labels are small caps; the title row is 44px.
- **Copy:** Birdhouse / Nest / Scratchpad (2026-10-04) now ships in the UI.
- **Needs You panel:** quiet filled rows on the sidebar's fills, a tinted kind
  dot instead of a glyph, one action per row.
- **Per-pane header** (agent icon, name, state) on tiled sessions only; a lone
  pane has none. The drawer ends with a branch footer (change counts later).
- **Session list correction:** one full-row selection, including the sibling
  close action; no selected parent card around selected child rows. Titles
  truncate, parents stay quiet, close reveals on hover or focus-within and
  stays available on touch. Applies to grouped, flat and Scratchpad lists.
  This follows familiar conversation-list hierarchy (T3 Code's thread rows,
  ChatGPT/Claude), without copying their additional data model or features.
- **Browser toolbar matches v4:** 43px toolbar, 28px inset address field,
  consistent SVG chevrons/reload and external-link icon, no divider. The
  address uses a neutral globe rather than claiming verified security. The
  mock's bookmark star is omitted until bookmarks exist; no dead controls.

## 2026-10-24 — Soft separation desktop shell

Owner-approved amendment to the 2026-10-05 layout choices below, from a
synthetic study (not code). Desktop only; the phone layout is unchanged.

- **Open gutters, no rules.** No full-height lines between the sidebar, canvas
  and drawer, in the top row, or above the status bar. The canvas floats in the
  shell color with 8px gutters at its sides (the column resize handles, or a
  margin where a column is closed) and 6px below. Handles show a short pill only
  on hover, drag or keyboard focus.
- **Soft corners and separate panes.** One `--radius-pane` (8px) for tabs,
  sidebar rows, drawer controls and canvas panes. Each pane is rounded and
  clipped on its own; split panes are 6px apart (sash in the gap) instead of one
  shared 1px sash. Files, reviews and browsers use `surface-dim` inside so a
  pane reads against the shell. A pane never shrinks below 48px of visible width.
  **Browser limit:** on desktop a browser page is a native child webview that
  CSS cannot round or clip, so a native browser pane is rounded at the top
  (toolbar) and square at the bottom (page). Other panes, and the web/iframe
  browser, are rounded on all four corners. Unverified in WKWebView.
- **No split marker in the tab strip.** The split glyph/underline is gone; the
  layout shows the split. Only the focused pane's tab has a fill **and** heavier
  text; all unfocused tabs stay plain, including other panes in the visible split
  (owner refinement, 2026-11-06). `tabPaneState.ts` mixes `--text` into
  `--panel-bg` for the focused fill, readable in all 19 themes.
- **Needs You moves to the status bar.** A fixed 124px slot at its right end
  (bell, "Needs You", count or unread dot); the panel opens upward. Path, branch
  and usage truncate before the slot. The top row no longer carries a bell.
  Shortcut, Welcome Back and semantics are unchanged. Initially 34px high;
  corrected to the v4 study's 26px in the follow-up above.
- **No "perch" wordmark** beside the sidebar toggle. The drawer's header column
  is exactly the drawer's width. The sidebar has no duplicate bottom Add action
  to remove.

## 2026-10-21 — Needs You + Welcome Back (first slice)

Implements UI-UX-DIRECTION §10 for the local host. Contracts are in
`server/attention.rs`, `db/attention.rs` and ARCHITECTURE.

- **Shipped:** durable `attention_events`; questions (until answered),
  failures (until the next turn), finished turns and exits (Recent updates,
  only when unwatched, coalesced). Read ≠ resolved. Certainty labelled
  (`verified` / `heuristic` / `unconfirmed`). Anchored panel from a bell (now the
  status bar, 2026-10-24; first the top row), Welcome Back line on load or after
  10 minutes hidden, Cmd/Alt+Shift+U. Rows open the agent, its changed files or the workspace review.
- **Deferred:** relaying a remote host's events (remote hosts appear only as
  "offline" in Welcome Back), per-user read state across paired devices
  (read is server-wide today), snooze, OS-notification deep links, and
  provider question text (rows say "Waiting for you" rather than invent it).
  The existing toasts/sound are unchanged.

## 2026-10-05 — Visual polish pass

Decided with the owner. Spec: [UI-UX-DIRECTION.md Appendix D](UI-UX-DIRECTION.md).

- **Borderless panes and tabs.** Replaces the herdr-style 1px group border in
  `styles/dockview.css`. Splits keep one 1px sash (2026-10-24: now a gap between
  rounded panes).
- **No Refresh button** on the Projects header.
- **Add project** is a native folder dialog on desktop for a local host, else a
  modal directory browser. Never an inline sidebar form. Replaces "`+ Add`
  expands a form" in the sidebar. The rule "`+ Add` is the only way a folder
  becomes a project" is unchanged.
- **Files / Git switch moves to the top row** beside the drawer toggle.
  The current drawer also offers Browser; this is not a second tab strip.
- **Files tree** scrolls and follows the VS Code explorer look.
- **Organize sidebar** (header menu): By project (default) or In one list
  (every session, projects and Chats alike, as a flat list, newest first). This
  is a view choice, not a new data model: sessions stay under their projects.
- **Sessions stay under their projects, compact by default** (owner,
  2026-10-05). This amends the 2026-10-04 "sessionless sidebar". Organize menu
  also picks **Compact sessions** (default: one status dot per session on the
  project/workspace row; blocked / working / done) or **Session list** (the
  original rows). A project with one checkout has no workspace row of its own
  (the project row stands in; Files/Git move to the project menu). The phone
  keeps full rows. Strip states are neutral: hover and active are a rounded
  `surface-1` fill, focus is a 1px neutral ring; no hairlines between rows.
- **Backlog:** "Sort chats by" Last updated. Needs a last-updated field on
  `SessionSummary`. Manual order shipped 2026-11-03.

## 2026-10-04 — Shell navigation, vocabulary, close/restore (PER-6)

Decided with the owner.

### Approved (phased; later decisions above take precedence)

The 2026-10-05 compact-session choice supersedes the sessionless-sidebar row
below. Naming is approved for phased adoption, not a reason to rename schemas.

| Area | Decision | Original behavior / migration note |
|---|---|---|
| Roles | Sidebar answers *where*, tabs *what is open*, canvas *the work*, drawer *browses files/changes*. | Workspace UX: "A tab is a terminal"; drawer holds explorer and Git only (drawer unchanged; tabs generalize to files/diffs, PER-7). |
| Vocabulary | **Workspace → Nest** and **Project → Birdhouse** in user-facing copy (renamed by the owner after the first draft, which said Context and kept Project). A Birdhouse is an added folder on a host; a Nest is its original folder or a linked Git worktree. The original is labelled **Original** only when a Birdhouse has several Nests. Internal records, protocol, database and docs prose keep `project` / `workspace`. | "Naming: Projects are folders; Workspaces are…" |
| Vocabulary | **Chats → Scratchpad** (no new store). New Scratchpad sessions start in `~/` like a normal terminal (owner amendment); `~/.perch/scratch` remains the workspace's bookkeeping/file scope. Existing sessions retain their original cwd for resume continuity. | "Chats … is listed after the projects…" |
| Sidebar | Birdhouses, plus one flat level of Nests when a Birdhouse has more than one. No repeated session/tab list. Original row and local-only host block hidden when there is nothing to disambiguate. | "Sidebar … Projects → Workspaces → sessions" |
| Close: idle shell | Closing an idle shell still ends it immediately. | none |
| Close: running work | Closing a working agent, job or server asks first, naming the work. Uncertain state uses the same guard. **2026-10-05 owner:** any agent session (not a terminal) asks on tab ×, Cmd+W and sidebar close, with a "Don't show again" option (Settings turns it back on). | "closing is deleting" (immediate for everything) |
| Close: watcher | A viewer that does not own the runtime only detaches. **Stop runtime for everyone…** is a separate action. The UI labels the two differently. | "Closing a terminal pane ends its shell" |
| Reopen | **Superseded (2026-11):** Cmd-Shift-T now opens the centered keyboard-only New session dialog (project → agent/terminal/browser/file, `NewSessionDialog.tsx`); the sidebar's New session button opens the same dialog and no shortcut reopens a closed tab yet. Cmd-T keeps the tab strip's "+" launcher. Formerly: Cmd-Shift-T reopens from a per-viewer list: 20 descriptors, 7 days, no terminal contents, prompt text or command history; cleared on Remove birdhouse. A closed runtime returns as a **stopped tab** with *Start new shell* and, only with a valid provider token, *Resume agent conversation*. Never re-run a command or imply the old process survived. **Shipped first cut (2026-10-05):** reopening starts a fresh session of the same harness in the same nest; the stopped-tab screen and *Resume agent conversation* wait for the core to keep the provider token. | "perch never archives" (this is navigation undo of descriptors, not an archive of sessions) |
| Empty Nest | Closing the last tab shows that Nest's New Tab / home state. Never another Birdhouse's or Nest's session, never quitting. | already an invariant; kept |
| Per-viewer focus | Selected Nest/tab, split geometry and sidebar/drawer state are per viewer. Viewers never fight over focus or the PTY resize lease. | already an invariant; kept |
| Restored resources | A resource whose runtime or file is gone restores as a placeholder with a recoverable error and an explicit action, never an empty substitute. | new |

### Kept as is (must survive every slice)

- No implicit project registration; `+ Add` is the only way a folder becomes a Birdhouse.
- No process starts when a picker is cancelled.
- No unrelated fallback after the last tab closes.
- Terminals keep the user's terminal profile and native key encoding.

### Undecided — trial first

None. (The chrome font was decided 2026-10-25: system UI sans.)

### Follow-up

Mixed local tabs/splits, per-viewer restoration and local Needs You have since
landed. Quick Open, Run, richer reopen and remote continuity remain in ROADMAP;
do not interpret the original phase/ticket sequence as today's backlog.
Update the affected product/architecture contract with behavior changes, not a
component-by-component catalogue in AGENTS.

## Product constraints to preserve

These summarize intentional choices previously buried in AGENTS. They are not
an exhaustive description of every component or a fresh acceptance result.

- **Workspace scope:** only explicit Add registers a folder. Sessions stay in
  their original project regardless of terminal cwd. The launcher is scoped to
  the selected nest/Scratchpad; cancel starts nothing. Closing the last tab
  stays there. No mandatory Git, agent, model/account wizard or task object.
- **CLI-first:** no provider/model/effort chrome over a live CLI. Chat mode is
  one global setting, not per-session/device. Superseded 2026-11-05: Hosted is removed; Chat is the native view.
  Terminal is currently last in the harness picker; the older Terminal-first
  proposal is not approval to reorder it.
- **Close:** confirm agent close (with a user-controlled warning preference);
  distinguish owner stop-for-everyone from watcher dismissal. No hidden managed
  execution or lost drafts. Reopen/resume limitations above remain explicit.
- **Navigation:** one mixed strip for the active nest; drawer browses Files/Git/
  Browser, not another terminal layout. Selecting a tab focuses its content.
  Compact sidebar sessions remain approved, not a sessionless sidebar rewrite.
- **Files:** single click previews, double click/explicit open pins; editing
  protects a preview. Explorer arrows only move/fold, Space previews preserving
  list focus, Enter opens pinned and focuses the editor. External open uses the
  on-disk file, never silently saves a draft. Preserve this distinction.
- **Layout:** soft separation (2026-10-24; gutters are backdrop-colored since the
  2026-11-07 card shell): no vertical rules, open gutters, individually rounded panes 6px apart, no split marker in the strip
  (fills and weight show visible/focused panes), no header for a lone pane.
  Native browser pages are rounded from Rust (2026-10-25). Pointer-based tab
  dragging, not HTML5 OS drag-and-drop. A new split set has at most four tabs
  on one axis; retain older saved layouts.
- **Quiet UI:** neutral Perch theme, color for status, no accent-filled active
  panes or speculative menu actions. Shared tokens/defaults must agree across
  Rust and web. Use Tailwind v4 and shared UI primitives (UI-UX Appendix E),
  not competing unlayered CSS on the same element. Chrome is system UI sans,
  mono only for code (2026-10-25). Settings is a page; Add project is a modal with an explicitly
  clicked native Browse option, never an automatic OS dialog.
- **Phone:** reuse desktop resource components; one header, active pane and
  Session/Files/Git bottom bar, with quick keys for writable terminals. No
  second mobile IDE/sidebar; keep 44px touch targets and honest unpaired/
  unreachable/reconnecting states.
- **Identity and attention:** observed foreground harness changes only display
  identity, never saved launch/resume choice. Viewing a question does not
  resolve it; uncertainty is labelled and never upgraded by silence.
