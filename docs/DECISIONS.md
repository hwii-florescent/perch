# Decisions

Approved product choices and deferred alternatives. Newer decisions override
older proposals; approval is not proof of implementation. Current ownership
contracts live in [ARCHITECTURE](ARCHITECTURE.md), remaining work in
[ROADMAP](ROADMAP.md), and release evidence in [PUBLIC-ALPHA](PUBLIC-ALPHA.md).
[UI-UX-DIRECTION](UI-UX-DIRECTION.md) supplies interaction proposals and shared
conventions, not automatic approval. AGENTS is only a brief contributor entry point.

## 2026-10-21 — Needs You + Welcome Back (first slice)

Implements UI-UX-DIRECTION §10 for the local host. Contracts are in
`server/attention.rs`, `db/attention.rs` and ARCHITECTURE.

- **Shipped:** durable `attention_events`; questions (until answered),
  failures (until the next turn), finished turns and exits (Recent updates,
  only when unwatched, coalesced). Read ≠ resolved. Certainty labelled
  (`verified` / `heuristic` / `unconfirmed`). Top-row bell + anchored panel,
  Welcome Back line on load or after 10 minutes hidden, Cmd/Alt+Shift+U.
  Rows open the agent, its changed files or the workspace review.
- **Deferred:** relaying a remote host's events (remote hosts appear only as
  "offline" in Welcome Back), per-user read state across paired devices
  (read is server-wide today), snooze, OS-notification deep links, and
  provider question text (rows say "Waiting for you" rather than invent it).
  The existing toasts/sound are unchanged.

## 2026-10-05 — Visual polish pass

Decided with the owner. Spec: [UI-UX-DIRECTION.md Appendix D](UI-UX-DIRECTION.md).

- **Borderless panes and tabs.** Replaces the herdr-style 1px group border in
  `styles/dockview.css`. Splits keep one 1px sash.
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
- **Backlog:** "Sort chats by" (Last updated / Manual order). Needs a
  last-updated field on `SessionSummary` and drag-and-drop.

## 2026-10-04 — Shell navigation, vocabulary, close/restore (PER-6)

Decided with the owner.

### Approved (phased; later decisions above take precedence)

The 2026-10-05 compact-session choice supersedes the sessionless-sidebar row
below. Naming is approved for phased adoption, not a reason to rename schemas.

| Area | Decision | Original behavior / migration note |
|---|---|---|
| Roles | Sidebar answers *where*, tabs *what is open*, canvas *the work*, drawer *browses files/changes*. | Workspace UX: "A tab is a terminal"; drawer holds explorer and Git only (drawer unchanged; tabs generalize to files/diffs, PER-7). |
| Vocabulary | **Workspace → Nest** and **Project → Birdhouse** in user-facing copy (renamed by the owner after the first draft, which said Context and kept Project). A Birdhouse is an added folder on a host; a Nest is its original folder or a linked Git worktree. The original is labelled **Original** only when a Birdhouse has several Nests. Internal records, protocol, database and docs prose keep `project` / `workspace`. | "Naming: Projects are folders; Workspaces are…" |
| Vocabulary | **Chats → Scratchpad** (same `~/.perch/scratch`, no new store). | "Chats … is listed after the projects…" |
| Sidebar | Birdhouses, plus one flat level of Nests when a Birdhouse has more than one. No repeated session/tab list. Original row and local-only host block hidden when there is nothing to disambiguate. | "Sidebar … Projects → Workspaces → sessions" |
| Close: idle shell | Closing an idle shell still ends it immediately. | none |
| Close: running work | Closing a working agent, job or server asks first, naming the work. Uncertain state uses the same guard. **2026-10-05 owner:** any agent session (not a terminal) asks on tab ×, Cmd+W and sidebar close, with a "Don't show again" option (Settings turns it back on). | "closing is deleting" (immediate for everything) |
| Close: watcher | A viewer that does not own the runtime only detaches. **Stop runtime for everyone…** is a separate action. The UI labels the two differently. | "Closing a terminal pane ends its shell" |
| Reopen | Cmd-Shift-T reopens from a per-viewer list: 20 descriptors, 7 days, no terminal contents, prompt text or command history; cleared on Remove birdhouse. A closed runtime returns as a **stopped tab** with *Start new shell* and, only with a valid provider token, *Resume agent conversation*. Never re-run a command or imply the old process survived. **Shipped first cut (2026-10-05):** reopening starts a fresh session of the same harness in the same nest; the stopped-tab screen and *Resume agent conversation* wait for the core to keep the provider token. | "perch never archives" (this is navigation undo of descriptors, not an archive of sessions) |
| Empty Nest | Closing the last tab shows that Nest's New Tab / home state. Never another Birdhouse's or Nest's session, never quitting. | already an invariant; kept |
| Per-viewer focus | Selected Nest/tab, split geometry and sidebar/drawer state are per viewer. Viewers never fight over focus or the PTY resize lease. | already an invariant; kept |
| Restored resources | A resource whose runtime or file is gone restores as a placeholder with a recoverable error and an explicit action, never an empty substitute. | new |

### Kept as is (must survive every slice)

- No implicit project registration; `+ Add` is the only way a folder becomes a Birdhouse.
- No process starts when a picker is cancelled.
- No unrelated fallback after the last tab closes.
- Hosted chat stays frozen. Terminals keep the user's terminal profile and native key encoding.

### Undecided — trial first

- **Chrome font.** Proposal: system-sans UI chrome. Owner wants a side-by-side
  trial of system-sans vs a Nerd Font before choosing. Until then chrome stays
  monospace. Decide in a separate visual trial; style changes ship separately
  from behavior changes.

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
  one global setting, not per-session/device. Hosted/UI remains frozen.
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
- **Layout:** borderless tabs/panes, sash-only split boundaries, no header for
  a lone pane. Pointer-based tab dragging, not HTML5 OS drag-and-drop. A new
  split set has at most four tabs on one axis; retain older saved layouts.
- **Quiet UI:** neutral Perch theme, color for status, no accent-filled active
  panes or speculative menu actions. Shared tokens/defaults must agree across
  Rust and web. Use Tailwind v4 and shared UI primitives (UI-UX Appendix E),
  not competing unlayered CSS on the same element. Font change still needs the
  trial above. Settings is a page; Add project is a modal with an explicitly
  clicked native Browse option, never an automatic OS dialog.
- **Phone:** reuse desktop resource components; one header, active pane and
  Session/Files/Git bottom bar, with quick keys for writable terminals. No
  second mobile IDE/sidebar; keep 44px touch targets and honest unpaired/
  unreachable/reconnecting states.
- **Identity and attention:** observed foreground harness changes only display
  identity, never saved launch/resume choice. Viewing a question does not
  resolve it; uncertainty is labelled and never upgraded by silence.
