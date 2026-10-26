# Decisions

Approved product choices and deferred alternatives. Newer decisions override
older proposals; approval is not proof of implementation. Current ownership
contracts live in [ARCHITECTURE](ARCHITECTURE.md), remaining work in
[ROADMAP](ROADMAP.md), and release evidence in [PUBLIC-ALPHA](PUBLIC-ALPHA.md).
[UI-UX-DIRECTION](UI-UX-DIRECTION.md) supplies interaction proposals and shared
conventions, not automatic approval. AGENTS is only a brief contributor entry point.

## 2026-10-26 — Browser search preferences

Settings → General → Browser chooses Google (default), DuckDuckGo, Bing or Brave
for address-bar searches in tabs and the drawer. The choice is persisted by the
core and shared with connected viewers. Addresses keep their normal resolution:
HTTPS for bare public domains, HTTP for local development addresses, and an
explicit HTTP(S) scheme is preserved. Existing settings/older peers use Google.

Cmd+W also closes a browser page while that page has keyboard focus. A native page
is its own web view, so the desktop app's File > Close Tab menu item (Cmd+W) reports
which page, if any, holds focus and the UI closes that tab or drawer page. Only the
default Cmd+W binding is honoured there (a rebound or disabled Close Tab does nothing
from a page); an unreadable focus closes nothing. Unverified in a real window.

## 2026-10-25 — Explorer signals and compact status controls

Owner approved the Files/Git visual study, with restrained theme-derived file
icons and separate Git markers. This refines the right-hand explorer and Git
file rows; the left Birdhouse/Nest/session hierarchy and Git actions stay.

- File/folder icons recognize filename/extension conventions (including package
  manifests, libraries and config files); they do not analyze dependencies or
  infer package ownership. Search results and Git rows reuse the same icons.
  Desktop explorer text matches the organizer's 12px scale with compact rows;
  narrow/phone tree targets remain at least 44px. Birdhouse hover/selection
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
  layout shows the split. A tab whose pane is on screen has a subdued fill; the
  focused pane's tab has a stronger fill **and** heavier text; hidden tabs stay
  plain (`tabPaneState.ts`; fills mix `--text` into `--panel-bg`, readable in
  all 19 themes).
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
- **Layout:** soft separation (2026-10-24): no vertical rules, open shell-colored
  gutters, individually rounded panes 6px apart, no split marker in the strip
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
