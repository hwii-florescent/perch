# Decisions

Dated product decisions, newest first. Each says what is approved, what is
deferred, and which `AGENTS.md` invariant it replaces **when the change is
implemented**. Until then `AGENTS.md` stays the truth for shipped behavior.
The proposal behind them is [UI-UX-DIRECTION.md](UI-UX-DIRECTION.md); the
Rust-side ownership contracts (viewer identity, runtime incarnation, dirty-buffer
recovery) are Linear PER-12, not decided here.

## 2026-10-05 — Visual polish pass

Decided with the owner. Spec: [UI-UX-DIRECTION.md Appendix D](UI-UX-DIRECTION.md).

- **Borderless panes and tabs.** Replaces the herdr-style 1px group border in
  `styles/dockview.css`. Splits keep one 1px sash.
- **No Refresh button** on the Projects header.
- **Add project** is a native folder dialog on desktop for a local host, else a
  modal directory browser. Never an inline sidebar form. Replaces "`+ Add`
  expands a form" in the sidebar. The rule "`+ Add` is the only way a folder
  becomes a project" is unchanged.
- **Files / Git switch moves to the top row** beside the drawer toggle. Replaces
  the "one top row, three sections" invariant in `AGENTS.md` when implemented.
- **Files tree** scrolls and follows the VS Code explorer look.
- **Organize sidebar** (header menu): By project (default) or In one list
  (every session, projects and Chats alike, as a flat list, newest first). This
  is a view choice, not a new data model: sessions stay under their projects.
- **Backlog:** "Sort chats by" (Last updated / Manual order). Needs a
  last-updated field on `SessionSummary` and drag-and-drop.

## 2026-10-04 — Shell navigation, vocabulary, close/restore (PER-6)

Decided with the owner.

### Approved (phased: each lands in its own slice, PER-7 onward)

| Area | Decision | Replaces in AGENTS.md |
|---|---|---|
| Roles | Sidebar answers *where*, tabs *what is open*, canvas *the work*, drawer *browses files/changes*. | Workspace UX: "A tab is a terminal"; drawer holds explorer and Git only (drawer unchanged; tabs generalize to files/diffs, PER-7). |
| Vocabulary | **Workspace → Nest** and **Project → Birdhouse** in user-facing copy (renamed by the owner after the first draft, which said Context and kept Project). A Birdhouse is an added folder on a host; a Nest is its original folder or a linked Git worktree. The original is labelled **Original** only when a Birdhouse has several Nests. Internal records, protocol, database and docs prose keep `project` / `workspace`. | "Naming: Projects are folders; Workspaces are…" |
| Vocabulary | **Chats → Scratchpad** (same `~/.perch/scratch`, no new store). | "Chats … is listed after the projects…" |
| Sidebar | Birdhouses, plus one flat level of Nests when a Birdhouse has more than one. No repeated session/tab list. Original row and local-only host block hidden when there is nothing to disambiguate. | "Sidebar … Projects → Workspaces → sessions" |
| Close: idle shell | Closing an idle shell still ends it immediately. | none |
| Close: running work | Closing a working agent, job or server asks first, naming the work. Uncertain state uses the same guard. | "closing is deleting" (immediate for everything) |
| Close: watcher | A viewer that does not own the runtime only detaches. **Stop runtime for everyone…** is a separate action. The UI labels the two differently. | "Closing a terminal pane ends its shell" |
| Reopen | Cmd-Shift-T reopens from a per-viewer list: 20 descriptors, 7 days, no terminal contents, prompt text or command history; cleared on Remove birdhouse. A closed runtime returns as a **stopped tab** with *Start new shell* and, only with a valid provider token, *Resume agent conversation*. Never re-run a command or imply the old process survived. | "perch never archives" (this is navigation undo of descriptors, not an archive of sessions) |
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
  monospace. Decide at Phase 8 (visual consolidation); style changes ship
  separately from behavior changes.

### Deferred

- Everything else in UI-UX-DIRECTION.md (Cmd-K/Cmd-P, Needs You, splits,
  pinning, viewers, Run/preview) follows its own phase and ticket (PER-7…11).

### Next

1. As each slice lands, rewrite the matching `AGENTS.md` invariant in the same commit.
2. PER-12 records viewer identity, runtime incarnation and dirty-buffer recovery; the close/reopen rules above depend on it before any schema change.
