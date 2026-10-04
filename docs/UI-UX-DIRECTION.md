# Perch: a browser for development work

## Status and scope

**Opinionated design specification for approval. Not an implementation change.**

For the full product/technical proposal, read [PRODUCT-STRATEGY.md](PRODUCT-STRATEGY.md).
For what must actually ship before the differentiated public alpha, read
[PUBLIC-ALPHA.md](PUBLIC-ALPHA.md). This document supplies interaction detail;
not every viewer, visual change or later UX feature here is an alpha requirement.
The owner has directed that differentiation precede launch, not that every
specific interaction proposal below is already approved.

Research baseline: Perch commit `82eb210a438932f54fd3445fb2364fb0e1541b6b`, inspected on 2026-10-03. Orca reference checkout: `564f1352`. External documentation describes the versions available during this research; it is not a version-pinned compatibility guarantee.

This specification covers the desktop product, with constraints for the existing headless/browser client and phone. It does not reopen Hosted chat development. It proposes deliberate changes to some current UX invariants; those must be approved and reconciled with `AGENTS.md` before implementation.

### The decision in one paragraph

Perch is **a project browser with development capabilities**. Pick a project, open things in tabs, and return to them later. A terminal is a first-class tab; an agent is a terminal with useful, trustworthy metadata. Files and reviews are equally first-class. Isolated work is available when requested, not imposed on every task. The left sidebar answers **where**, the tab strip answers **what is open**, the canvas shows **the work**, and a small Needs You queue answers **what requires a decision**. None of these should become a dashboard.

### Decisions at a glance

| Question | Decision |
|---|---|
| Project | An explicitly added folder, Git repository or not, on a specific execution host. |
| Workspace | Keep the internal record; remove the word from primary user-facing UI. |
| Worktree | A Git-backed isolated context, revealed through an explicit action. |
| Context | Optional named place within a project; normally invisible when only the original folder is in use. |
| Session | An execution/conversation implementation detail, never the main navigation noun. |
| Tab / Surface | Users see **Tab**. Internally a surface presents a resource or runtime. |
| Sidebar | Projects and, when needed, one flat level of contexts. No repeated session/tab tree. |
| Tabs | One horizontal mixed-type strip for the active context. |
| Agents | Real CLI terminals, enhanced with identity and status; no new UI/CLI modes. |
| Cmd-K | Contextual actions and navigation to already-open work. |
| Cmd-P | Files and folders in the current context. |
| Cmd-J | No separate surface or default binding. |
| Dashboard | Do not build. Build a small Needs You queue. |
| Splits | Link existing tabs into a bounded split view; do not create tabs-inside-tabs. |
| Pins | Keep important tabs at the front and protect against casual closing. Not a persistence tier. |
| Persistence | All regular tabs restore. A live process, a resumable conversation and a reopened tab are different promises. |
| Explorer / Git | Optional right drawer for browsing and triage; full files and diffs use the canvas. |
| Visual identity | Neutral, quiet, system-sans chrome; authentic terminal typography inside terminals. |

---

## 1. Evidence, baseline and diagnosis

### Evidence labels

- **Observed:** read in source, published documentation, or an inspected screenshot/demo. Product documentation is evidence of its documented behavior, not a hands-on reliability test.
- **Interpretation:** a conclusion about the interaction cost or benefit of that behavior.
- **Recommendation:** the proposed Perch contract. Unless labeled otherwise, sections 2–14 are recommendations.

Research used source bodies, not just README descriptions. It also inspected Perch screenshot artifacts, official screenshots for Zen, Vivaldi, Conductor, Emdash and Zed, and four sequential frames of Orca's tab-split demo. The Perch artifacts are recent but not reproducibly tied to this exact commit; current source takes precedence where they disagree. Competitors were not installed or benchmarked. Arc's official pages blocked direct fetching; its findings have lower confidence and rely on search-indexed official documentation. Reported issues are regression examples, not assertions that a current release remains broken.

### What Perch actually does today

| Observed implementation | Consequence for this design |
|---|---|
| Rust/axum and SQLite own domain state; React renders WS-driven state. `perchd` owns local PTYs across app/core restarts. | Preserve the architecture. Restoration and attention must not become independent client-side guesses. |
| `Sidebar.tsx` wraps host selection and capability-dependent project navigation. `WorkspaceOverview.tsx` renders registered projects → workspaces → sessions, including nested worktrees. Legacy/remote fallback groups sessions by `(hostId, cwd)`. | There is more than one navigation path to migrate. Changing only the obvious sidebar branch would leave remote behavior inconsistent. |
| `TabBar.tsx` lists active-workspace sessions, then files. Sessions can be dragged and renamed; files are a separate list. | This is not yet a general tab system, even though both look like tabs. |
| `fileTabs.ts` persists file descriptors in localStorage per viewer, but resets active file on reload; session switching clears the active file. | A file is visually first-class but loses to session navigation/restoration. Unify identity and focus before adding more viewers. |
| `App.tsx` overlays the active file over `DockviewShell`. | File + terminal splits are not a uniform operation. The overlay is a transitional implementation to remove. |
| `DockviewShell.tsx` persists layouts against a session, flushes pending saves on switches, and reattaches stable pane IDs. A single pane hides its header. | Keep the layout engine and safeguards; move canonical layout ownership to context/viewer, without rewriting PTYs. |
| `WorkspaceTools.tsx` is an app-level Files/Git drawer scoped to the active workspace. Git is capability/context-dependent. | This is a good boundary. Keep browsing separate from execution and open full resources in the canvas. |
| `WorkspaceFiles.tsx` uses a bounded textarea editor, lazy tree, explicit Save, recoverable drafts, external-change conflicts, and a sandboxed HTML preview. Image/binary/oversized previews currently show messages rather than full viewers. Read-only entries are not generally treated as viewable files. | Do not describe a rich general-purpose file browser as already built. Separate **viewable** from **editable** capabilities. |
| `filesystem.rs` confines paths using root descriptors and `O_NOFOLLOW`, bounds reads, hashes versions and atomically saves files. | Rich viewers must preserve this safety boundary rather than bypass it through `file://` or broad filesystem grants. |
| `Navigator.tsx` searches session titles/cwds and includes launch commands. It is not a general file finder or a complete action system. | Reuse its overlay shell, replace its content model. |
| `statusDot.ts` maps blocked/working/unseen/idle to glyphs. Unseen is presented as done; stale working/blocked evidence reads as idle. | Execution, unread and uncertainty need separate semantics. A silence timeout must not imply a task finished. |
| Terminals inherit the user's terminal profile, keep `convertEol: false`, support native key encoding and obey a resize lease. | These are product quality, not implementation trivia. Preserve them under every layout change. |
| Closing a session deletes it and ends its agents/shells; quitting the app is different. Agent exit leaves a shell; shell exit closes the tab. | Browser vocabulary cannot silently change execution lifetime. Reopen needs an honest, limited contract. |
| The current status bar shows connection, session state, cwd, branch, and reported context/cost. | It can display session context even while another resource occupies the canvas. Make metadata follow the focused surface. |
| The current visual baseline uses monochrome tokens, monospace UI chrome and a 36px top row. | Retain neutrality, but use system-sans chrome and more legible row targets. Terminal style remains independent. |

Source anchors: [AGENTS](../AGENTS.md), [architecture](ARCHITECTURE.md), [parity inventory](ORCA-PARITY.md), [App](../packages/web/src/App.tsx), [Sidebar](../packages/web/src/Sidebar.tsx), [WorkspaceOverview](../packages/web/src/components/WorkspaceOverview.tsx), [TabBar](../packages/web/src/components/TabBar.tsx), [fileTabs](../packages/web/src/fileTabs.ts), [DockviewShell](../packages/web/src/dockview/DockviewShell.tsx), [WorkspaceTools](../packages/web/src/components/WorkspaceTools.tsx), [WorkspaceFiles](../packages/web/src/components/WorkspaceFiles.tsx), [filesystemStore](../packages/web/src/filesystemStore.ts), [filesystem service](../crates/perch-core/src/filesystem.rs), [selectors](../packages/web/src/store/selectors.ts), [Navigator](../packages/web/src/components/Navigator.tsx), [keybinds](../packages/web/src/keybinds.ts), [statusDot](../packages/web/src/statusDot.ts), [xtermSetup](../packages/web/src/xtermSetup.ts), [StatusBar](../packages/web/src/StatusBar.tsx), [base tokens](../packages/web/src/styles/base.css).

### Diagnosis

The principal problem is **competing ownership models**, not insufficient polish:

1. A project and its original workspace often repeat the same name.
2. Sessions appear in both sidebar and top tabs, but files appear only in one.
3. A terminal tab can contain another layout hierarchy while a file sits above that hierarchy.
4. Host, project, workspace, session and pane concepts leak into ordinary navigation.
5. Persistent host metadata, tiny subtitles and always-present file controls consume space without advancing the common task.
6. Completion, unread and attention are insufficiently distinguished.

The final UI should remove these ambiguities before acquiring more capabilities.

---

## 2. Product UX principles

### 1. Open things; do not configure a workflow first

The first successful action is opening a folder, file or terminal. No required worktree, model, account, orchestration or Git setup wizard. Detect installed agents, but do not make agents prerequisites for using Perch.

### 2. Give each region one question to answer

- Sidebar: Where does this work belong?
- Tabs: What have I left open here?
- Canvas: What am I using now?
- Drawer: What can I browse in this context?
- Needs You: What requires my action?

Do not repeat the full same inventory in two places.

### 3. Persistence is a promise, not an option users must discover

Switching projects and quitting the app preserve open work. Pins organize; they do not decide which work survives. Do not auto-archive, auto-settle or silently kill neglected tabs.

### 4. Never confuse observation with certainty

A quiet terminal is not necessarily idle. A finished turn is not necessarily successful. A disconnected host is not an exited process. Surface the uncertainty rather than inventing reassurance.

### 5. Reveal complexity at the point of benefit

Explain worktrees when the user asks for isolated work. Show Git when a repository exists. Show remote identity when execution is remote. Reveal advanced controls inside the relevant action, not in a permanent global toolbar.

### 6. Reading is safe; execution and destruction are deliberate

Opening a script must not run it. Previewing HTML must not grant it Perch's privileges. Dragging a file must not submit a prompt. Closing a live job must make the consequence legible. Recovery must never replay commands automatically.

### 7. Quiet does not mean undiscoverable

Neutral chrome, clear labels, keyboard access and contextual actions replace decoration—not usability. Every right-click action also exists through a visible menu or Cmd-K. Status always has a non-color meaning.

---

## 3. Final information architecture

### Canonical hierarchy

```text
Perch
└── Project                         explicitly added folder + host
    └── Context                     original folder or linked checkout
        └── Tab                     user-owned open item
            └── Surface             typed presentation
                └── Resource        path, runtime, diff identity, URL, etc.

Context presentation
├── ordered tabs / pins
├── optional split sets             relationships between tabs, not owners
└── per-viewer focus, sizes, scroll and drawer state
```

A resource need not be a file. An agent terminal's resource is a runtime binding. An agent session is associated with that runtime, not a required parent of a file or layout.

### Vocabulary and visibility

| Internal concept | User-facing term | Visibility |
|---|---|---|
| Project record | Project; normally just its name | Always after explicitly added. |
| Original workspace | No extra noun; **Original** when disambiguation is needed | Hidden as a hierarchy level in the one-context case. |
| Linked workspace / Git worktree | Context; technical explanation says **Git worktree** | After creating or showing another context. |
| Session/conversation/runtime ID | None | Diagnostics, advanced resume details only. |
| Surface | Tab | Never say “Create Surface” to users. |
| PTY/view/resize lease | Terminal / Watching / Take control | Ownership detail only when another viewer controls it. |
| Host | Named machine | Remote suffix and execution confirmations; management in Settings. |
| Scratch project | Scratchpad | Secondary home action; sidebar row after first use. |

**Remove “Workspace” from primary copy.** Project, context, workspace and worktree are too many near-synonyms. Keep schema names during migration; a wholesale database rename has no user benefit.

### Context disclosure rules

- A non-Git folder has one original context. No branch or isolated-context controls.
- A Git project with only its original context displays a single project row.
- **New isolated context…** appears in that project's menu and Cmd-K. Its explanation: “Work on a separate copy without changing your current files. Uses a Git worktree; this is not a security sandbox.”
- Creating a second context reveals children: `Original`, `Fix checkout`, etc. Existing tabs stay under Original; nothing moves or restarts.
- Context rows are a **flat list**, never a parent/child task tree. Branch ancestry belongs in Git details, not navigation indentation.
- An explicitly used linked context never becomes anonymous merely because other contexts were hidden. Show its name in the active location control, even if only one row remains.
- Automatically discovered external worktrees stay out of the primary tree until opened. Project menu → **Other contexts…** lists them by name, branch and path. This is discovery, not silent project registration.
- A context containing a live runtime, an unsaved draft or unresolved attention cannot be fully hidden. Collapse its project instead, or explicitly stop/close the work first.
- Deleting the last linked context returns the original-only project to one row. It does not discard the original context's state.

### Ownership rules

- Resource identity includes execution host and context, not only a path string.
- A terminal's `cd` does not reparent its tab or project. Show current cwd in terminal details when needed.
- Dragging a live terminal to another context does not relocate its process. Reject that move and offer **New terminal in [context]** instead.
- **Open corresponding file in [context]** resolves and opens a separate resource; it never silently moves the original buffer.
- Projects on different hosts remain distinct, even if repository names match. Add a remote host suffix where ambiguity exists.
- For simple local use, host selection disappears. With remotes, projects remain reachable in one list; host is a filter/detail, not a mandatory outer hierarchy.
- An empty project/context stays selected. Closing its last tab never jumps to unrelated work.

### State ownership

Rust owns tab descriptors, lifecycle, supported actions, context membership, dirty buffers and attention facts. Persist presentation under an explicit viewer identity: selected context/tab, split geometry and sidebar/drawer preferences. Viewers must not fight over focus or resize leases. Another client can browse available live runtimes without automatically acquiring every local file-view tab or changing the desktop layout.

This preserves today's per-viewer convenience while eliminating separate incompatible restoration models. In the single-user product, closing an owned runtime tab ends that runtime globally; a watcher dismissing its view only detaches. The UI must label those actions differently.

---

## 4. Main window

### Layout decision

Keep **horizontal tabs**. Zen's lesson is scoped work and restrained chrome, not an obligation to copy vertical tabs. A vertical project → context → tab tree would either recreate today's nesting or compete with the file tree. One horizontal strip lets the sidebar remain shallow and optional.

```text
┌────────────────────────────────────────────────────────────────────┐
│ brand / location │ mixed tabs + new tab │ Needs You │ tools toggle │
├──────────────────┼─────────────────────────────────────────────────┤
│ projects         │                                                 │
│ optional contexts│                    canvas                       │
│                  │                                  optional drawer│
└──────────────────┴─────────────────────────────────────────────────┘
```

- One top row. Native traffic lights and drag region stay in the brand area.
- Sidebar: default 224px. Collapses completely, not to a second icon rail.
- Drawer: default 304px for Files/Changes. Closed initially; remembers user choice.
- Canvas: gets the space. Reviews open here rather than demanding a 760px drawer.
- Needs You control: count only when actionable items exist; reachable through menu/Cmd-K at zero.
- When the sidebar is hidden, the brand/location control shows `Project ▾`, plus context if non-original. It opens the same location picker, not a new navigation system.
- No permanent global status bar by default. Optional resource-local status at the bottom of the canvas; critical connection errors get an inline banner.

### A. Brand-new user

```text
┌─ ● ● ●  perch ─────────────────────────────────────────────────────┐
│                                                                    │
│                         Open your work                             │
│              A folder, a terminal, and room to think.               │
│                                                                    │
│                       [ Open project… ]                            │
│                       Start in Scratchpad                          │
│                                                                    │
│                 You can use Perch without an agent.                 │
└────────────────────────────────────────────────────────────────────┘
```

No empty project sidebar, host badge, provider selector or Git terminology. Open project uses a native folder picker on desktop and the existing host directory browser in web mode. Opening explicitly adds it. The next screen offers Terminal, installed agents and Browse files. No process starts merely because a project was selected.

### B. Project with one shell

```text
┌─ perch [☰]───────┬─[ >_ Terminal       × ]  + ────────────────[▥]──┐
│ atlas           │                                                 │
│ notes           │ ~/code/atlas $                                  │
│                 │                                                 │
│                 │                                                 │
│ + Open project  │                                                 │
└─────────────────┴─────────────────────────────────────────────────┘
```

No Original row, session row or idle dot. The terminal is immediately usable.

### C. Several agent tabs

```text
┌─ perch [☰]───────┬─[Claude ◌][Codex ·][Pi][Terminal] + ───────[▥]──┐
│ atlas           │                                                 │
│ notes           │                actual Claude CLI                │
│                 │                                                 │
│                 │                                                 │
└─────────────────┴─────────────────────────────────────────────────┘
```

Here `◌` means working and `·` means an unread event. Glyphs have labels in tooltips/accessibility names. Provider-specific controls stay in the CLI.

### D. Multiple contexts / worktrees

```text
┌─ perch [☰]───────┬─[Claude][checkout.ts][Terminal] + ──────────[▥]──┐
│ ▾ atlas         │                                                 │
│     Original    │                Fix checkout                     │
│   ▸ Fix checkout│                active work                      │
│     New search ?│                                                 │
│ notes           │                                                 │
└─────────────────┴─────────────────────────────────────────────────┘
```

`▸` here marks selection, not further nesting. Context names are task-readable. Branch/path appear in tooltip, location details and Changes, not a permanent second line.

### E. File opened

```text
┌─ perch [☰]───────┬─[Claude][ README.md       × ][Terminal] + ──[▥]──┐
│ atlas           │ README.md                     [Edit]       [⋯]  │
│ notes           │─────────────────────────────────────────────────│
│                 │ # Atlas                                         │
│                 │ Rendered project documentation                  │
│                 │                                                 │
└─────────────────┴─────────────────────────────────────────────────┘
```

Markdown opens as a document. Edit is local to this resource. Plain source files open in the text editor instead. No permanent Find field, version hash or Reload button.

### F. Split view

```text
┌─ perch [☰]───────┬─⟦[Claude][checkout.ts]⟧ [Terminal] + ─────[▥]──┐
│ atlas           │ Claude              ⋯│ checkout.ts            ⋯ │
│ notes           │─────────────────────┼───────────────────────────│
│                 │                     │                           │
│                 │    actual CLI       │       source file         │
│                 │                     │                           │
└─────────────────┴─────────────────────┴───────────────────────────┘
```

The bracket denotes a linked split set, not another tab hierarchy. Clicking either member restores the split and focuses that member. Clicking Terminal shows Terminal alone. Thin pane labels exist only while split.

### G. Agent needing attention

```text
┌─ perch [☰]───────┬─[Claude ?][README.md] + ─────[Needs You 1]─[▥]──┐
│ atlas         1 │                   ┌─────────────────────────────┐│
│ notes           │                   │ Needs You                   ││
│                 │                   │ ? Claude · atlas            ││
│                 │                   │   Choose a migration option ││
│                 │                   │                    [Open ↵] ││
│                 │                   │ Recent updates           ▸  ││
│                 │                   └─────────────────────────────┘│
└─────────────────┴─────────────────────────────────────────────────┘
```

Open focuses the actual question. No duplicated conversational UI or approval button without a verified provider bridge.

### H. File explorer opened

```text
┌─ perch [☰]───────┬─[Claude][logo.png] + ──────────────────────[▥]──┐
│ atlas           │                               │ Files  Changes ×│
│ notes           │                               │ atlas         ⋯ │
│                 │          image viewer         │ ▾ src           │
│                 │                               │   checkout.ts   │
│                 │                               │ ▸ assets        │
│                 │                               │ README.md       │
└─────────────────┴───────────────────────────────┴─────────────────┘
```

Files is a tree, not a miniature editor. The same browser can be opened as a full Folder tab for large directories or selection-heavy work.

### I. Git/review opened

```text
┌─ perch [☰]───────┬─[Claude][Changes         ×] + ─────────────[▥]──┐
│ ▾ atlas         │ Working changes ▾        [Review with agent] ⋯  │
│     Original    │───────────────────────────────┬─────────────────│
│   ▸ Fix checkout│ checkout.ts                   │ Files  Changes ×│
│                 │ - old behavior               │ 3 changed files │
│                 │ + new behavior               │ M checkout.ts   │
│                 │                              │ M checkout.test │
│                 │ comment on selection…        │ + notes.md      │
│                 │                              │ [Commit…]       │
└─────────────────┴──────────────────────────────┴─────────────────┘
```

The drawer is the queue of changed files and commit entry point; the canvas is the readable diff. Comparison scope is explicit: Working changes, Last agent turn when reliable, or Branch versus base. Never imply the working tree belongs exclusively to one agent.

### Narrow windows and zoom

Below the width needed for a readable canvas plus rails, the drawer overlays instead of crushing the canvas; further narrowing collapses the sidebar. Preserve the user's preferred widths for later. Do not shrink terminal text to an unreadable size simply to retain four panes. Offer **Focus this pane**, keep hidden split membership intact, and preserve the resize-lease rules. Phone uses a location sheet and tab picker, not a shrunken desktop hierarchy.

---

## 5. Sidebar specification

### Inventory

1. Project rows in stable user-defined order.
2. One indented level of contexts only when disclosure rules require it.
3. Scratchpad after projects, after first use.
4. A quiet **Open project…** action at the end.

There is no permanent recent-project section duplicating the list. Recently removed/opened locations can appear in the Home/location picker, bounded to a short list and never auto-registered. No dedicated Settings footer band: Settings lives in the app menu and Cmd-K.

### Row anatomy

```text
[disclosure if children] [name........................] [attention] [⋯]
```

- 30px default row height; 16px context indentation.
- One line by default. A failed context creation can expand to show progress/error/retry.
- Project: plain name; no required logo or user-chosen color.
- Context: user name, or branch basename as fallback; `Original` for the source checkout.
- Active location: neutral fill plus shape/weight, not a colored stripe.
- Dirty checkout: small neutral modified marker when useful; do not call it “Needs You.”
- Unread: subtle weight/dot. Required action: count; at most one aggregate marker per row.
- Working: neutral activity glyph only where it helps identify background work. No repeated “ready,” “idle,” timestamps or zero counts.
- Remote: compact host suffix on the project; full host and path in details. Disconnection is an explicit exception state.
- Hover/focus: reveal only `⋯`. Do not make `+` mean “new worktree” in one row and “new terminal” in another.

### Interaction

- Click project: restore its last-used context and tab, or show that project's empty state.
- Click chevron: expand/collapse only; never switch work or stop execution.
- Click context: restore that context's view.
- Right-click: target the row without navigating or clearing unread.
- Keyboard: Up/Down rows; Left collapse/parent; Right expand/first child; Enter activate; Shift-F10 opens actions.
- Collapse does not clear attention; the project aggregates hidden children's action count.
- Drag project to reorder; drag context within its project. No cross-project reparenting of a checkout.
- No automatic activity-based reorder. The pointer's target must not move because an agent finished.

### Menus

**Project:** Open / New tab / Browse files / Changes when Git / New isolated context… when Git / Other contexts… when discovered / Rename display name / Copy path / Reveal in file manager when local / Remove from Perch…

**Context:** Open / New tab / Browse files / Changes / Rename display name / Copy path / Copy branch when present / Pin to top of project / Hide when safe / Stop running work… / Delete context… when linked.

Original cannot be deleted as a worktree. Removing a project removes registration and closes its runtime tabs after a scoped confirmation; it does not delete its folder. Deleting a linked context is separately destructive: show path, running work, unsaved files and unmerged commits; default to preserving the branch unless explicitly selected and validated. Recheck server-side at execution time.

Pins reorder within the existing list; do not create a duplicate global Favorites tree. No arbitrary sidebar folders, task nesting or status columns.

---

## 6. Tab system

### Types and titles

| Surface | Default title | Type affordance |
|---|---|---|
| Shell | Terminal, Terminal 2 | Terminal icon. |
| CLI agent | Claude, Codex, Pi, OpenCode, OMP | Small monochrome provider mark or terminal fallback. |
| Text/code | Basename | File-type icon. |
| Markdown/image/PDF/data/media | Basename | Format icon; renderer is not another navigation level. |
| Folder | Folder basename | Folder icon. |
| Review/diff | Changes or `file.ext · Diff` | Diff icon. |
| Log | Log name | Log icon and Follow state in content. |
| Web page/app preview | Page/app title | Globe; site icon allowed as content identity. |
| Run output | Task label, e.g. `Tests` | Terminal icon; command and cwd in details. |

User titles override automatic titles. Sanitize and bound untrusted OSC/page/agent titles. Do not rename tabs on every terminal redraw or cwd change. Disambiguate repeated filenames with the shortest useful parent path; show the full path/host in tooltip and Cmd-K results. Do not use generated LLM titles as required infrastructure.

### New tab

`+` and Cmd-T open a compact launcher scoped to the active context:

```text
New tab in atlas / Fix checkout
Terminal
Claude
Codex
Pi
──────────────
Open file…                         Cmd-P
Browse files
Open URL…                          when supported
Manage agents…
```

Terminal is first. Installed/enabled agents follow; preserve the user's recent choice as a convenience, never auto-execute on opening the launcher. Search filters actions/providers, not a second full file index. Dismissing creates nothing. With no project selected, explicitly offer Open project or Scratchpad.

### Order and overflow

- Any surface can sit anywhere among peers; no “sessions first, files afterward” rule.
- Pins precede regular tabs. New tabs open after the current tab/split set.
- Scroll horizontally rather than reduce every tab to an indistinguishable icon.
- Minimum useful width around 96px; ordinary maximum around 200px; full label on hover/focus.
- An overflow dropdown searches all tabs in this context, with the same identifiers/order as keyboard navigation.
- Do not wrap the strip into multiple rows.

### State

Execution status, unread and unsaved changes are distinct fields, not competing meanings of one boolean.

- Small leading type icon; adjacent execution glyph only for a non-idle state.
- Unread marker at title end, accompanied by accessible text.
- Unsaved draft marker for editable files; not reused for agent completion.
- Close button on active/hover/focused regular tab, with a stable hit area.
- Tooltip includes provider, context, state, and resource location where relevant.
- No pulsing tabs, colored provider fills or success-green idle terminals.

### Regular, pinned and preview tabs

**Regular:** persists automatically across app restarts until explicitly closed.

**Pinned:** same persistence, kept in the leading section with a readable label. No icon-only pin strip full of identical terminals. Bulk Close Others skips pins. Cmd-W on a pin does not kill work: briefly explain **Unpin to close** and offer that action. Explicit **Unpin and close…** follows the normal close guards.

**Preview:** only for passive file browsing. One replaceable preview tab per context; italic title plus **Keep open** action. Double-click, editing, pinning, explicit Enter/open, or splitting promotes it to regular. Never replace a dirty buffer, running terminal, review with draft comments, or a regular tab. No timer closes previews. An untouched preview need not restore after restart.

The distinction must be taught by behavior and a tooltip, not an onboarding lecture. Users can disable preview reuse later if needed; this is not a first-run setting.

### Splits: a view relationship, not another container level

- Drag an existing tab to a canvas edge, or choose **Split with…** and pick another open tab/new item.
- Link the two tabs into a split set. The strip shows a subtle group boundary; every member remains a normal tab.
- Clicking a member activates the set and focuses that pane. Clicking an unrelated tab shows that tab alone; returning restores the set.
- Support right/down arrangements and up to four visible surfaces. Four is a deliberate product ceiling, not a claim about Dockview's limits.
- Split sets may contain any supported surface types, but only one context. Cross-context comparisons use an explicitly scoped diff, not a hidden second execution context.
- **Unsplit this tab** removes the view relationship, not the tab or process. **Unsplit all** restores independent tabs.
- **Close tab** closes that resource/runtime according to its normal lifetime rules. Remaining panes expand. A one-member set dissolves.
- **Focus pane** temporarily zooms one member; restore returns exact proportions.
- A split does not clone a PTY or start another agent. **New terminal to the right** is an explicitly different action.
- Do not add per-pane tab strips. Thin labels/menus appear only in split mode.
- Existing legacy layouts with more than four panes must still restore without data loss. Preserve them in compatibility mode; new split creation obeys the ceiling.

### Tab grouping

Do not ship arbitrary named/colorized groups in the first final-direction release. Project and context already scope work; split sets cover the useful adjacent-view relationship. A new manual group level has not earned its complexity. If sustained use demonstrates dozens of unrelated tabs per context, introduce a single optional collapsible group level later—never groups within groups.

### Drag/drop

- In strip: reorder, with insertion marker; no accidental stack creation by hovering over a tab.
- To canvas edge: split, with explicit drop preview.
- Out of a split boundary into strip: unsplit without closing.
- File from explorer to strip/canvas: open a regular tab; to canvas edge: open in split.
- File over a tab: briefly activates the target only after a deliberate hover; releasing on an unsupported target does nothing and explains why.
- Runtime to another context: reject relocation; offer a new runtime in the destination.
- No tear-off multiwindow requirement in the initial scope. Unsupported drops must not lose tabs.
- Every drag operation has a menu/keyboard alternative.

### Close and reopen contract

| Action | Result |
|---|---|
| Switch tab/context | Work continues. View state is retained. |
| Close clean file/viewer | Close the view, not the file. |
| Close dirty file | Save / Discard / Cancel. Recovery draft remains until resolution is acknowledged. |
| Close idle shell | End the shell and remove the owned runtime tab. |
| Close working agent/job/server | Confirm the named running work will stop. If state is uncertain, use the same guard. |
| Agent turn completes | Keep the agent tab; completion is not process exit. |
| Agent program exits to shell | Same tab becomes an ordinary terminal, retaining its title if user-named. |
| Shell exits naturally | Close its runtime tab as today; preserve only permitted reopen metadata. |
| Quit/reload application | Keep owned runtimes and open tab records; reconnect on return. |
| Close watcher view | Detach that view; **Stop runtime for everyone…** is separate. |
| Close last tab | Context's New Tab state. Never switch to another project or quit implicitly. |

**Cmd-Shift-T is supported**, but must be truthful:

- Files/folders/URLs: reopen the descriptor with recoverable position/state.
- A closed runtime was ended. Reopen shows a stopped tab with **Start new shell** and, only when a valid provider token exists, **Resume agent conversation**.
- Never automatically re-execute the last command, rerun a script, or imply the old process survived.
- Keep a bounded, per-viewer closed-tab list: initially 20 descriptors, expiring after seven days. No terminal contents, prompt text, secrets or full command history in it. Removing a project clears its entries.
- This is navigation undo, not session archiving. Unsupported/stale paths show a recoverable error, not an empty substitute.

### Restoration

Persist order, pin state, split membership, active tab/member, view position and renderer choice. Reconcile live runtime IDs with the host before attaching. Lazy-mount inactive views while the daemon keeps executing. On host reboot/daemon loss, restore a stopped view and offer explicit resume; do not auto-start old jobs. On remote disconnect, keep **Disconnected / status unknown**, never fabricate an exit or silently run locally.

---

## 7. General-purpose file experience

### One resource, multiple ways to view it

**Open** chooses the safe useful default renderer. **Open With…** chooses another renderer or an installed external app. Renderer choice can be remembered explicitly per extension; do not silently mutate the OS association.

**Preview** means render without executing or saving. **Edit** changes to a text editing view. **Run** is an execution action with a separate contract. These must not be interchangeable labels.

| Resource | Default Open | Other useful actions / boundaries |
|---|---|---|
| Text/code | Text editor | Find, go to line, wrap, Save, Open externally, Ask agent. Syntax coloring where available; no promise of full IDE intelligence. |
| Markdown | Rendered document | Edit source, split source/preview, copy section link. Sanitize HTML; no automatic remote resource fetches. |
| Image | Fit-to-view image viewer | Zoom, actual size, dimensions, Copy image, compare versions. SVG must be rendered as inert content, never injected into app DOM. |
| PDF | Read-only document viewer | Page navigation, zoom, text search/selection when supported; restore page/offset. External fallback if platform viewer is unavailable. No PDF editor. |
| CSV/TSV | Read-only virtualized table | Search, sort, copy cells, raw text edit. Sorting changes the view only; no silent rewrite. No spreadsheet formulas. |
| JSON/JSONL | Structured read view, bounded | Collapse/search, raw text edit; JSONL may use line/log view. Parsing errors offer raw text instead of a blank pane. No automatic reformat on open. |
| Logs | Bounded tail/log viewer | Follow toggle, Pause, Find, copy selection. Scrolling upward pauses follow; show new-line count. Never force-scroll while reading. |
| HTML | Text source | Explicit sandboxed Preview; external browser or trusted app preview is a separate action. Opening never runs document scripts by default. |
| Archive | Metadata and, when implemented, bounded entry listing | Open externally initially. Extraction only by explicit destination/confirmation; block path traversal, links escaping destination and decompression bombs. No automatic extraction. |
| Audio/video | Native browser media controls where safely supported | Paused initially; no autoplay. Bounded/ranged access and external fallback for unsupported codecs. No editing suite. |
| Script | Text editor | Run… / Run in new terminal… after showing interpreter, command, cwd and host. Opening never executes. |
| Executable/binary | Information view | Size/type/path, Open externally where meaningful. Run only for an explicitly supported executable action with confirmation. No inferred shell command from filename. |
| Unknown file | Information view | Open With, Open externally, Copy path. Offer text only after bounded encoding/binary detection. |
| Directory | Folder browser tab | List/grid when justified by content, breadcrumb navigation, Open terminal here, Find in folder, Ask agent. Not a new project merely because it was opened. |
| Read-only file | Normal supported viewer | Edit disabled with reason. Viewing must not depend on writability. |
| Symlink | Link information | Show target; preserve current confinement policy. Do not follow links outside the authorized root as a convenience shortcut. |
| Oversized file | Bounded read-only preview | Explicit size/truncation notice, large-log strategy or external app. Never save truncated data as the full file. |

Do not build every specialized viewer in the first phase. All types have a safe initial behavior, including information view and external fallback; the architecture must not require a terminal/session parent for any of them.

### Files drawer versus Folder tab

**Files drawer:** compact tree of the active context, lazy loading, folder expansion and resource opening. It follows context, never the cwd of whichever shell happens to be active. Hidden/generated files are omitted by default; a discoverable Show hidden/ignored action and explicit path lookup make them reachable. Do not eagerly enumerate `node_modules` or follow symlink trees.

**Folder tab:** a full browsing surface rooted within the context, useful for screenshots, reports and unfamiliar trees. It has breadcrumbs and Back/Forward within that tab. It does not change the project/context when entering a subdirectory. Opening a file creates/activates its own tab.

Do not build both a full tree and a second full tree permanently. The drawer and Folder tab reuse data and selection primitives but serve different sizes of task.

### Pointer and keyboard contract

| Gesture | Files drawer tree | Folder tab list/grid |
|---|---|---|
| Single click file | Show replaceable preview; preserve tree focus. | Select. |
| Single click folder | Expand/collapse. | Select. |
| Double click file | Open/keep regular tab and focus it. | Open regular tab. |
| Double click folder | Open folder as regular tab. | Navigate into folder. |
| Enter on file | Open regular tab and focus it. | Open regular tab. |
| Enter on folder | Expand / enter children in tree. | Navigate into folder. |
| Space | Quick Look overlay where supported; Escape returns focus. | Same. |
| Right click | Target selection; no activation or execution. | Same. |
| Drag to tab strip | Open regular tab. | Same. |
| Drag within directory browser | Explicit move destination; modifier for copy; show operation before drop. | Same. |

These are two established interaction idioms, not two meanings within the same widget. Keyboard arrows follow tree or list semantics. Multi-select is available where operations support it; menus show counts and omit unsupported batch operations.

External OS drops into the file tree **copy into** the chosen context only after a destination preview; drops into the canvas **open** authorized resources rather than copy silently. Web clients must say **Upload** because they cannot infer a server path from a local File object. Remote transfers require explicit destination/size feedback. Cross-project arbitrary file access is not silently granted.

### Contextual actions

Group applicable actions consistently:

1. **Open:** Open, Open to the side, Open With…, Preview, Edit.
2. **Use:** Run…, Run in new terminal…, Ask agent about this….
3. **Locate/share:** Reveal in Finder / system file manager, Open externally, Copy relative path, Copy full path.
4. **Manage:** Rename…, Move…, Move to Trash / Delete….

Do not show a disabled forest of hypothetical capabilities. Hide genuinely unsupported actions; disable temporarily unavailable actions with an explanation. Local actions must not masquerade as remote actions: Reveal in Finder does not reveal a remote server path. Offer Download/Open local copy explicitly when supported.

Rename updates open resource descriptors after the server operation succeeds. Preserve dirty buffers and detect case-only/collision failures. Local deletion uses Trash where supported; permanent remote deletion must state that it cannot be undone. Check open dirty files and running references where knowable; never promise those checks find every external process.

### Run

- **Run…** resolves a known task/interpreter and shows its command, cwd, host and trust implications before first execution.
- **Run in new terminal…** uses the same resolver but explicitly allocates a new output tab. Run may reuse its prior **idle** run-output tab; it never injects commands into an occupied shell or agent prompt.
- Package tasks come from actual project manifests. Do not invent a command from a filename or automatically install dependencies.
- Repository-provided setup/tasks are untrusted until approved. Changed commands require renewed approval. Worktrees are not sandboxes.
- Every owned run has a visible tab/resource handle. Closing its last owner stops it after the appropriate guard. Switching away does not stop it.
- Multiple contexts can need different ports. If a port conflict is detected, report it; do not kill another context's server or silently reuse the wrong preview.

### Preview

- Passive documents use isolated viewers without scripts, host credentials or Tauri privileges.
- Relative HTML assets use bounded, context-authorized resource access. Missing permission is an explicit prompt; no blanket filesystem exposure.
- Active localhost apps use a separately isolated web-preview surface with visible URL, reload, history and Open externally.
- Embedded web content cannot access Perch's authenticated WS/API, privileged native commands or arbitrary `file://` resources. A same-origin unsandboxed iframe is not an acceptable implementation.
- External navigation, downloads, camera/mic and cross-host forwarding need explicit policies. If the isolation boundary is not ready, open externally; do not ship a misleading “secure preview.”
- Remote Preview requires an explicit tunnel or supported remote URL. Never reinterpret remote localhost as local localhost.

### Ask Agent About This

Select file, folder, text range, image or diff → **Ask agent about this…** → choose an available agent in the same context or start one.

Show exactly what will be supplied: path, selected lines, bounded excerpt or explicitly attached media. Choose saved disk content versus unsaved draft when they differ. Folders send a path and intent, not an automatic recursive upload. Sensitive files require deliberate inclusion; no background indexing upload.

Prepare a draft/reference for user review. Do not press Enter automatically or paste into a busy CLI. If a provider lacks a safe draft/attachment integration, offer **Copy context** and focus its terminal. Pending questions/permissions must be answered before preparing another input. This is a contextual handoff, not a new Hosted chat composer.

---

## 8. Agent UX

### Agents enhance terminals

Claude Code, Codex, Pi, OpenCode, OMP and future CLIs use the same surface contract. Identity is a small icon/label; interaction remains the actual CLI. There is no default model/effort selector in Perch chrome and no parallel “agent app” mode.

An agent launched manually in a shell can gain metadata when integration positively identifies it. Absence of a bridge is not an error; Perch remains a good terminal. Do not infer an agent solely because output mentions its name.

### State model

Keep three independent axes: **execution**, **attention**, **unread**. Connectivity/certainty qualifies execution.

| State | Presentation | Needs You? |
|---|---|---|
| Working | Neutral segmented ring; tooltip “Working.” No perpetual pulse. | No. |
| Idle | Type icon only; tooltip “Ready for input” when verified. | No. |
| Needs input | Amber question glyph; specific question summary when available. | Yes. |
| Permission required | Amber lock/approval glyph; concise reason. | Yes. |
| Blocked on dependency/tool | Waiting glyph and reason. | Only if the user can resolve it now. |
| Done | Quiet check in recent updates; tab becomes idle after acknowledgment. | No by default. |
| Error | Red error glyph and human-readable summary. | Yes when intervention is required. |
| Unread | Small independent marker on an unviewed event. | Not necessarily. |
| Disconnected | Disconnected glyph and “Status unknown”; last observation time in details. | One actionable reconnect item per host, not per pane. |
| Stale evidence | “Status not confirmed”; keep last-known state as qualified metadata. | No synthetic completion. |
| Sleeping | Neutral sleep glyph if explicitly suspended by a supported operation. | No; Resume is contextual. |

“Done” means the turn ended—not tests passed, changes are correct, or a PR is ready. “Review ready” requires an explicit review artifact or trusted event; a dirty working tree alone is insufficient.

Native bridge evidence outranks OSC/output heuristics. Retain Perch's single authoritative lifecycle path and add certainty/reason where the protocol supports it. Old peers fall back to conservative generic labels. Do not expose internal state-machine names as normal copy.

### Multiple agents sharing files

Creating a second editing agent in the same context shows a small nonblocking explanation: **These agents share files. Use a new isolated context for independent changes.** It offers the isolation action but does not force it. A worktree isolates checkout state, not ports, databases, external services or permissions.

### Completion, stop and restart

- Interrupt/Stop task operates on the running agent task only when a provider offers a reliable operation.
- **Close tab** ends its owned runtime.
- **Restart agent…** is explicit, preserves intended context, and discloses whether it starts a new conversation or resumes a recorded one.
- Never create a generic stop button that pretends arbitrary CLIs support the same protocol.
- No automatic cross-provider conversation resume promise.

---

## 9. Command system and keyboard navigation

### Two surfaces, not three

**Cmd-K: “What can I do, or where was I working?”**

Opens one action/navigation palette. The current selection is explicit in a small header: `Actions for checkout.ts`, `Actions for Claude`, or `atlas`.

Empty-query sections:

1. Applicable actions for the focused/selected item.
2. A small number of recent open tabs/contexts.
3. Global actions such as Open project, New tab, Needs You and Settings.

Typed input searches command names and already-open tabs/projects/contexts. Results are grouped and typed; a destructive command is never the default merely because it fuzzy-matches. Do not also crawl all files here. **Open file…** switches to Cmd-P's source in the same palette shell.

**Cmd-P: “Find something in this context.”**

Fuzzy filename/path search, current context clearly labeled. Empty query shows recent files. Prefer an existing open surface over a duplicate. Enter opens a regular tab; modified Enter offers Open to the side. Arrow selection never executes a file. Support path + line when meaningful. Ignored files use an explicit **Include ignored** second pass, with bounded results; never make a large hidden dependency tree the default search corpus.

**Cmd-J: no default action.** Neither a third jump palette nor a hidden terminal drawer is needed. Terminals are tabs; Cmd-K already switches work. Preserve user-defined bindings through migration, but do not promote another overlapping surface.

### One action vocabulary

Right-click, `⋯`, Cmd-K and shortcut labels call the same commands with the same target, enabled state and destructive guard. Right-clicking a background tab does not activate it, clear unread or change the palette's eventual execution target by accident.

Commands freeze the selected target when opened and revalidate on execution. Incoming events may update state but must not reorder a list underneath keyboard selection. Escape returns focus to the exact invoking element.

### Default desktop macOS shortcuts

| Shortcut | Action |
|---|---|
| Cmd-T | New tab launcher. |
| Cmd-W | Close active tab; pinned/dirty/running guards apply. In a modal, dismiss the modal first. |
| Cmd-Shift-T | Reopen last closed tab descriptor. |
| Cmd-1…8 / Cmd-9 | Nth / last tab in visible strip order, including mixed types. |
| Cmd-Shift-[ / ] | Previous/next tab in strip order. |
| Cmd-K | Actions and open-work navigation. |
| Cmd-P | Quick Open files/folders. |
| Cmd-Shift-P | Optional familiar alias to command-only filtering in the same Cmd-K shell. |
| Cmd-O | Open resource picker; folder selection explicitly offers Open as project. |
| Cmd-Shift-O | Open project folder. |
| Cmd-B | Toggle project sidebar. |
| Cmd-Shift-E | Open/focus Files drawer. |
| Cmd-Shift-G | Open/focus Changes, when Git is available. |
| Cmd-Shift-U | Open next actionable Needs You item; no-op feedback when empty. |
| Cmd-\ | Split with…; no silent process duplication. |
| Cmd-Option-Arrows | Focus neighboring split pane. |
| Cmd-F | Find within focused surface. |
| Cmd-S | Save focused editable file. |
| Cmd-, | Settings. |
| Ctrl-Space, ? | Shortcut help; existing leader remains available. |

Do not globally steal bare letters, Escape, Ctrl-F, Ctrl-K, Ctrl-J, Ctrl-P or Ctrl-Tab from a terminal/TUI. If an MRU switcher is offered on Ctrl-Tab, it is outside terminal focus unless explicitly remapped by the user. Preserve kitty keyboard encoding and native Ctrl/Shift-Enter behavior.

### Desktop Linux and hosted web

Browser tabs own Cmd/Ctrl-T, W, Shift-T and often numbered tab keys. A webpage cannot reliably override them. Advertise browser-style shortcuts in Tauri only where supported; **do not claim them as universal web shortcuts**.

Use the existing Ctrl-Space leader as the reliable cross-client namespace: `c` New Tab, `x` Close, `g` Actions, plus documented chords for Quick Open and Reopen. Bare Ctrl combinations in Linux terminals continue to reach the PTY; terminal-safe Ctrl-Shift alternatives may be offered where nonconflicting. Every action also has pointer access. Display platform/client-specific bindings, and test rather than assuming a PWA can reclaim browser-reserved keys.

### Accessibility

Roving focus for tabs; selected and focused are separate. Tree semantics for the sidebar/explorer. Arrow/Home/End behavior, Escape dismissal, visible focus and predictable focus restoration. Announce a new actionable event politely once, not every streamed output update. Menus must be fully operable without hover/right-click. Respect reduced motion, text zoom, high contrast and 44px touch targets in narrow/touch layouts.

---

## 10. Needs You: a queue, not a dashboard

### The question

**“What requires me right now?”** Not “What are all my agents doing?”

The top-row control opens a compact anchored panel, about 380–440px wide. At zero there is no count; the action remains in Cmd-K/app menu. The panel has **Needs You** and a collapsed **Recent updates** section—not a kanban board.

### Event admission

| Event | Queue policy | Delivery default |
|---|---|---|
| Agent question | Needs You until answered/resolved. | In-app marker; OS banner if away from Perch. |
| Permission request | Needs You until resolved. | Same, with non-sensitive wording. |
| Agent's actionable error | Needs You. | In-app; OS banner if away. |
| Perch-owned user-launched command failure | Needs You when action remains. | One event for the run. |
| Arbitrary nonzero shell command | No automatic inbox item without integration/user opt-in. | Terminal remains source of truth. |
| Failed command inside an agent's active repair loop | Usually no event; agent may recover. | Escalate only when the agent stops/asks. |
| Finished turn | Recent updates, unread if not viewed. | Silent by default; completion notifications opt-in. |
| Explicit review-ready artifact | Needs You only if user requested review notification; otherwise Recent updates. | Silent by default. |
| Dirty worktree | No queue entry. | Changes marker. |
| Host disconnected | One deduplicated reconnect item. | No storm of “agent errors.” |
| File conflict / failed save | Inline blocking feedback plus recoverable queue item if left unresolved. | Never hidden behind a transient toast. |

### Row contract

`reason glyph · concise reason · tab title` followed by `Project / Context`, age and one primary **Open** action. Open deep-links to the exact resource/pane and visible request. When exact prompt location cannot be identified, focus the terminal and say so; do not fabricate a question excerpt.

Order unresolved questions/permissions first, actionable failures next, requested reviews last; oldest first within each class. Do not reorder while the panel is being navigated. New items can show a small “New items” affordance.

### Read is not resolved

- Focusing the relevant surface acknowledges its unread event, not its underlying request.
- A question remains until the provider reports an answer/resolution.
- Opening the project is not equivalent to viewing every agent inside it.
- Restoring a background tab does not count as reading it.
- Recent completion clears unread when explicitly viewed.
- **Dismiss update** is available for informational events. Do not present “Mark done” as if it answers a live permission prompt.
- Optional **Remind me later** snoozes the notification, not execution state; snoozed unresolved work remains visibly waiting on its tab and appears in a small snoozed count.
- Dismissed/repeated events deduplicate by runtime + request/turn identity, not notification text alone.

Rust stores the event facts and resolution. Read/snooze state belongs to the user identity, shared across their paired clients; it is not cleared by background subscriptions. Native notifications deep-link back to the same event. At delivery time revalidate whether it already resolved. Prompt text is omitted from lock-screen notifications by default. No sound by default, no automatic window focus, no duplicate toast plus OS banner for the same visible event.

---

## 11. Design system

### Direction: quiet, not tiny

Preserve Perch's neutral palette. Change the chrome's monospace default to a platform system-sans stack. This is the main visual departure: the frame should feel like a lightweight desktop browser, while the terminal retains its own authentic personality.

| Token / behavior | Recommendation |
|---|---|
| Top row | 38px default, accommodating native title-bar requirements. |
| Tab control height | 30px within that row; no pill-card appearance. |
| Sidebar | 224px default; resizable roughly 180–320px. |
| Drawer | 304px default; resizable roughly 240–480px, limited by usable canvas width. |
| Project/context row | 30px; file tree row 26–28px. |
| Spacing | 4px base rhythm; 8px control gaps; 12–16px panel padding. |
| UI font | System sans, 13px normal; 12px secondary; 14px palette items. Avoid 9–10px operational labels. |
| Reading view | 15–16px, line height around 1.55, comfortable bounded measure. |
| Code | Monospace 13–14px default; independent editor preference. |
| Terminal | User terminal profile; never overwritten by UI fonts/colors. |
| Radius | 4px controls/tabs; 6–8px popovers/dialogs; no rounded panel-card grid. |
| Border | One subtle 1px separator where regions meet; no nested boxes around every item. |
| Shadow | Only floating menus/popovers/dialogs; none on permanent rails. |
| Hover | Neutral fill, no layout shift or extra borders changing geometry. |
| Active | Slightly stronger neutral fill and clear label weight. |
| Focus | Visible 2px contrasting ring/outline; never color alone. |
| Motion | 100–150ms opacity/position feedback; no startup spectacle, pulsing statuses or springy list reorder. Respect reduced motion. |
| Icons | One consistent 16px line-icon family. No emoji action buttons. |

Starting dark palette: keep `#161616` canvas/chrome family, subtle `#1c1c1c` surfaces, `#262626` hover, `#333333` selected, `#3a3a3a` separators, `#d8d8d8` primary text. Secondary interactive text needs measured contrast; today's `#7a7a7a` is not automatically acceptable on every surface. Target WCAG AA text contrast and 3:1 meaningful non-text contrast. Light/system themes use the same semantic roles, not a low-contrast inversion.

### Color semantics

- Neutral: selection, idle, ordinary working, paths, project identity.
- Amber: input/approval needed, recoverable warning.
- Red: failure, destructive confirmation and unresolved conflict.
- Muted cool marker: unread informational update if necessary; shape also identifies it.
- Green: brief successful operation or Git addition, not every idle terminal.
- Diff red/green stays inside diff content with +/- markers.

Provider brands, branch colors and arbitrary project colors must not dominate chrome. Content may have color; the application frame does not compete with it.

### What disappears unless needed

Host selector on local-only installations; Original context row; idle/ready labels; zero counters; branch/path subtitles; pane headers for a single view; drawer; empty Needs You badge; model/effort controls; permanent Find input; version hashes; disabled Git affordances in non-Git folders; global connection-success light; token/cost metrics.

### Status bar decision

No persistent global bar of repeated cwd/branch/status. Each active surface may show a compact 22px local status line only when relevant:

- Editor: line/column, language/encoding, unsaved/conflict state.
- Remote terminal: host and connection/control state; cwd on request.
- Media/document: page/zoom or dimensions where useful.
- Review: comparison base and stale-snapshot warning.

Reported token/cost data lives in agent details, not an always-on dashboard. Never show estimates as measured facts. Connection loss must remain visible even with all optional bars hidden.

---

## 12. Component architecture: evolve, do not replace

### Keep

- Rust core, SQLite, WS protocol, host-routing and capability negotiation.
- `perchd`, runtime identifiers, replay and terminal ownership.
- `xtermSetup.ts`, `agentTerminals.ts`, persistent terminal rendering, terminal search and profile import.
- Dockview as a layout engine; hide its unnecessary hierarchy from the product model.
- `ResizeHandle.tsx`, `DirectoryBrowser.tsx`, existing confirmation primitives.
- Filesystem confinement, versioned atomic writes and server-owned draft recovery.
- `gitReviewStore.ts`, review packets and existing diff/comment domain behavior.
- Existing `components/ui` tokens/menu styling and Tailwind migration discipline.

### Refactor

| Current module | New responsibility |
|---|---|
| `Sidebar.tsx` + `WorkspaceOverview.tsx` | Shallow ProjectNavigation with ContextRows, including capability-aware remote fallback. |
| `TabBar.tsx` + `fileTabs.ts` + `tabOrder.ts` | One SurfaceTabs projection of canonical descriptors/order; no file/session bifurcation. |
| `App.tsx` | Stable frame and panel coordination; no absolute file overlay masking session content. |
| `DockviewShell.tsx` | Context/viewer SurfaceCanvas; adapt legacy session layouts and expose bounded split sets. |
| `WorkspaceTools.tsx` | ContextDrawer containing Files or Changes lists; full resources open in canvas. |
| `WorkspaceFiles.tsx` | Separate FileTree, FolderBrowser, TextEditor and typed ResourceViewer composition, sharing data service. |
| `Navigator.tsx` | Palette shell shared by Actions/Open-work and Quick Open modes. |
| `PaneContextMenu.tsx` / row menus | Same action definitions as palette and shortcuts, with reliable keyboard behavior. |
| `statusDot.ts` | Presentation of separate execution, attention, unread and certainty facts. |
| `NoSessionPanel.tsx` / `CliStartPanel.tsx` | Home/NewTab states using project/tab vocabulary and no mandatory agent choice. |
| `StatusBar.tsx` | Optional focused-surface status, not global session status. |
| Store selectors/persistence | Single active location and surface projection, with compatibility adapters for older peers. |

### New primitives, only as needed

1. **Surface descriptor/capabilities:** stable ID, context/resource identity, title, kind and supported actions. A small typed union/registry, not a plugin marketplace.
2. **SurfaceHost:** lazy-mounts the registered renderer; owns view restoration, loading/error and unsupported-state presentation.
3. **Action definitions:** identifiers, target requirements, labels, guards and handlers shared by menus/palette/shortcuts. Domain validation still lives in Rust.
4. **AttentionItem/NeedsYouPanel:** authoritative event projection with acknowledgment separate from resolution.
5. **ResourceInfoView/OpenWithPicker:** safe universal fallback, so every future format does not require a bespoke failure experience.
6. **SplitSet adapter:** a product policy layer over existing Dockview, not a new layout engine.

Do not abstract every label, row and view before two real consumers need it. No universal “workspace framework,” speculative plugin API or duplicate client lifecycle state machine.

### Remove from the default experience

- Session rows duplicated under contexts.
- Project → original-workspace name duplication.
- Always-on local host/environment block.
- File-over-session overlay.
- Separate session-only ordering and keyboard cycling.
- Session-centric labels in menus/home.
- Always-visible empty status chrome and file metadata controls.
- Proposed agent kanban dashboard, third jump palette and floating terminal from the earlier roadmap.

Do not delete legacy Hosted/UI views or old protocol fields just to remove their exposure. Freeze and isolate them; preserve access to existing data and layouts during migration.

---

## 13. Migration plan

Each phase is independently reviewable. No combined style-system rewrite, navigation rewrite and runtime rewrite. A phase ships only after its stated acceptance check. Baseline memory, startup, keystroke latency and throughput must be measured, not assumed from visual simplicity.

| Phase | Changes | Dependencies | UX benefit | Technical risk / acceptance gate |
|---|---|---|---|---|
| 0. Ratify contracts | Approve vocabulary, runtime close guards, Scratchpad, split policy and per-viewer ownership. Update roadmap/invariants; capture current behavior and performance. | Product approval. | Avoids contradictory implementations. | Low code risk; high decision importance. Sign off every deliberate departure listed below. |
| 1. Simplify navigation | Hide original-only row; remove duplicated session list; stable project/context ordering; hide local-only host block; new copy and contextual menus. Existing tabs remain. | Phase 0; status access on tab/attention path retained. | Immediate reduction in depth and chrome. | Medium: local/remote fallback and empty-project routing. Must never show another project's session after last-tab close. |
| 2. Canonical tabs and restoration | Add versioned/capability-gated surface/layout records; migrate file descriptors and terminal references; unified mixed order/focus/close handling. | Existing IDs, draft service, viewer identity. | Tabs finally behave alike. | High: data/runtime loss. Migration must be idempotent, retain old records until validated, and support older peers. Never kill/relaunch a PTY during conversion. |
| 3. Shared navigation/actions | Cmd-K, Cmd-P, New Tab launcher, keyboard parity, context-menu target semantics. Retire separate navigator filters as primary attention UI. | Phase 2 descriptors; bounded Rust file search. | Fast, predictable access without another palette. | Medium: shortcut conflicts and large repositories. Verify Tauri + browser and terminal-focused cases separately. |
| 4. Needs You | Separate certainty/unread/attention projection; persistent actionable queue; native notification deep links and dedupe. | Runtime event identities; protocol capability; user read state. | Interruptions become useful rather than noisy. | High semantic risk: false completion/approval. Test native events, heuristics, stale evidence, disconnects and multiple viewers. |
| 5. Unified canvas and splits | Remove file overlay; context/viewer Dockview adapter; mixed split sets, pinning and safe reopen. | Phase 2 plus close/restore contract. | Agent + file + review in one coherent model. | High: resize leases, hidden views, legacy layout conversion. Restore existing oversized/nested layouts without dropping panes. |
| 6. Files and review | Safe Open With; Markdown/images/PDF first; Folder tab; full-canvas diffs; read-only support; move permanent editor tools into contextual controls. | SurfaceHost; bounded resource transport; existing file/review services. | Perch becomes useful beyond agents/code editing. | Medium–high: binary transport, memory and sandboxing. Unknown/oversized/remote files must fail safely and remain actionable. |
| 7. Explicit execution/preview | Known Run tasks, run-output ownership, contextual Ask Agent handoff; isolated localhost/web preview only after security gate. Add CSV/JSON/log viewers as justified. | Actions, surface lifecycle, trust policy and transport. | Short open → inspect → run → review loop. | High security/ownership risk. No auto-run, active-pane injection, secret upload or unowned process. External fallback until safe. |
| 8. Visual consolidation | System-sans chrome, tokens/density, local status, compact defaults, responsive/adaptive behavior. | Settled interaction model; existing Tailwind harness. | Cohesive browser-like finish without decorative complexity. | Medium regression risk. Intentionally approve new goldens; keep style-only refactors separate from visual changes. |

Some Phase 8 token work can accompany earlier approved UI slices; it must not obscure behavioral review. Specialized viewers do not block the core direction: safe external opening is a valid shipping state.

### Deliberate changes requiring invariant updates

- “A tab is a terminal” → a tab presents any supported resource/runtime.
- Sidebar sessions → tabs appear once, in the strip.
- Visible Workspace terminology → optional Context.
- `Chats` → Scratchpad for general non-project work; no new backing store required initially.
- Terminal last in provider picker → Terminal is the first generic tab choice.
- Session-owned layout → context/viewer presentation, retaining runtime IDs.
- Immediate closure of all runtime tabs → guard live/uncertain work; idle shell close remains immediate.
- Stop agent as close-only → distinguish supported interrupt from explicit runtime close.
- Green idle / stale means idle → neutral idle and qualified uncertainty.
- Always-on global status → optional resource-local status.
- Cmd-J/dashboard/floating terminal roadmap → removed in favor of Cmd-K/Needs You/terminal tabs.
- Monospace chrome → system sans; terminal profile untouched.

Do not infer these are implemented or already approved merely because this document exists.

### Non-negotiable regression checks

1. Open a non-Git folder and reach a shell without learning Git or selecting an agent.
2. First context creation reveals the hierarchy without moving/restarting original work.
3. Mixed tab drag order equals numbered/next-tab shortcut order.
4. Close final tab → same context empty state; no unrelated fallback.
5. Open file → split beside live agent → switch context → return → exact resource IDs and layout.
6. App/core restart reattaches the same surviving PTY; reboot restores a stopped view without replaying commands.
7. Dirty draft + external file change + crash retains both conflict evidence and user's draft.
8. Pinned close, running close and reopen have the documented distinct consequences.
9. Background restore/project focus cannot clear another tab's unread/question.
10. Disconnect never becomes success/exit or local execution fallback.
11. Multiple viewers cannot resize the same PTY competitively or overwrite each other's focus.
12. Malicious HTML/SVG, archive traversal, path races and oversized files remain confined/bounded.
13. Keyboard-only open project, new tab, quick open, split, answer attention and close work.
14. Browser-reserved shortcuts remain browser-owned; terminal controls reach the PTY unchanged.
15. No close/hide/migration path leaves a runtime without an owning open-work record.

### Usability and performance gates

These are proposed validation targets, not measured results:

- In a five-person first-use check, at least four can open a project and terminal without explanation; none must understand “session.”
- Users can identify which project/context they are editing, including in collapsed-sidebar and remote states.
- A question requiring action is found in one click from Needs You; a completion does not masquerade as a question.
- No user in the check expects Cmd-Shift-T to recover an already-killed process after reading the stopped-tab state.
- Test 1, 10 and 30 open tabs; 1 and 8 contexts; large filenames; disconnected hosts; keyboard-only and 200% UI zoom.
- Compare idle memory, cold-start-to-interactive, terminal latency and 100MB output throughput against Phase 0. Inactive viewers should not eagerly decode every PDF/image or mount every terminal.

---

## 14. What not to build

| Inspiration | Explicit non-goal for Perch |
|---|---|
| Orca | Feature parity as a roadmap; nested worktree/task trees; orchestration consoles; browser design mode/computer use; issue-system drawers; account/rate-limit dashboards; floating terminal; multiple overlapping jump surfaces. |
| Cursor | Another IDE with every editing/debugging feature, a mandatory assistant side panel, a second agent chat implementation, or a provider/model control surface duplicated above the CLI. |
| Warp | Reinterpreting ordinary terminal input into a separate composer; adopting command blocks as the core terminal model; cloud/shared workflow libraries as default navigation. Copy the ergonomic actions, not a new shell interaction contract. |
| Emdash | A task object required before opening a shell/file; worktree per tab by default; permanent Skills/MCP/automation/account chrome. |
| Conductor | Repository/worktree provisioning as mandatory onboarding; chat as the only central surface; forced task → PR → archive lifecycle. |
| Vivaldi | Its configuration breadth, stacked second tab row, colored groups, toolbar editors, gestures and rule engines. Borrow scope and tiling, not every organization mechanism at once. |
| Arc | Automatic archival of active development work; Favorites + Pins + Today as three mandatory persistence tiers; icon-only global essentials for context-bound terminals. |
| Zen | A separate browser-profile/container model projected onto every project; always-hidden controls that make first use guesswork. |
| cmux | A permanent stream of branch/PR/port/notification metadata on every row; attention rings around whole panes as the default; treating restoration of metadata as proof a process survived. |
| Linear | A project-management system, configurable workflow states, labels, assignees and inbox-zero work for ordinary agent completions. |
| Raycast | An extension marketplace or system-wide launcher. Perch's command context ends at its authorized work. |
| GitButler / GitKraken | Branch lanes, commit graph, stacked-branch model or full repository history as the default home. Use explicit comparison and safe context operations without requiring Git expertise. |
| VS Code / Zed | Activity-bar forests, duplicate Open Editors inventories, arbitrary nested editor groups, settings knobs for every visual decision, full LSP/debugger platform before the browsing/terminal experience is solved. |

Also do not build: automatic LLM tab naming as infrastructure; auto-running dropped files; recursive automatic agent attachments; a proprietary document store; a new PTY/layout engine; or generalized extension APIs merely because tabs may eventually host more types.

**Browser-like:** opening/closing/reopening tabs, scoped spaces, pins, mixed resources, history inside navigable resources, drop-to-split, restoration and simple empty states.

**Remain development-tool-like:** terminal fidelity, file buffers and conflict handling, explicit execution host/cwd, Git comparison bases, command execution trust, process lifetime and safe destructive operations.

---

## Appendix A. Product research: adopt, adapt, avoid

The observations below are specific documented patterns. The three judgments are recommendations for Perch, not claims that the source product is poorly designed for its own audience.

| Product / evidence | Observed pattern | Adopt | Adapt | Explicitly avoid |
|---|---|---|---|---|
| **Zen Browser** [Z1–Z2] | Workspaces scope tab sets; split view supports up to four tabs and explicit unsplit controls. | Focused scope with low permanent chrome. | Project/context switching and bounded split sets; keep location names visible enough for execution safety. | Profile/container complexity and copying vertical organization into an already-deep project tree. |
| **Vivaldi** [V1–V3] | Workspaces contain tabs/stacks/tiling; two-level and compact/accordion stacks exist; tabs can move through menus or drag/drop. | Multiple routes to the same action; tile existing work without reopening it. | One mixed strip and explicit split relationship. | Two tab rows, auto-stacking on ambiguous drag, organization settings explosion. |
| **Arc** [A1–A3] | Space-scoped pins; split views; auto-archive of ordinary tabs. | Clear separation of ongoing contexts. | Pins as stable placement/protection, not the only durable work. | Automatic disappearance; Favorites/Pinned/Today learning burden; implicit destructive analogy to archival. |
| **cmux** [C1–C2] | Native terminal-first workspaces, surface-targeted notifications and jump-to-unread. Its docs distinguish restored layout from arbitrary process checkpointing. | Real terminals and exact attention destinations. | Needs You with dedupe and honest runtime restoration. | Notification-ring spectacle and every workspace row becoming telemetry. |
| **Warp** [W1–W2] | Browser-like tab shortcuts, named groups/pins; blocks treat commands/output as units. | Cmd-T/W/Shift-T where the host permits; readable named terminals. | Explicit Run output with useful metadata, without parsing all terminal behavior into blocks. | Replacing the CLI interaction model or importing the workflow-library product. |
| **Zed** [ZD1–ZD2] | Lightweight file navigation; separate file finder; preview files promoted by editing/double-click; keyboard tree operations. | Fast path-based Quick Open and accessible file operations. | Preview only passive resources, with promotion on meaningful work. | Turning Perch into a full code-intelligence IDE or duplicating editor inventories. |
| **Conductor** [CO1–CO2] | Isolated workspace per stream of work; setup/run scripts; review comments handed back to agents. | Clear run context and review-feedback loop. | Optional isolated context and explicit Run commands. | Worktree provisioning as the first required step; chat-first permanent layout. |
| **Emdash** [E1–E2] | Task/worktree/agent creation; CLI tabs alongside files; task-scoped file drawer; worktrees can be disabled. | Co-location of actual CLI and relevant resources. | Remove mandatory task vocabulary and put generic tabs ahead of orchestration. | Sidebar plus/diff/PR/status density; Skills/MCP/automations as permanent chrome. |
| **T3 Code** [T1–T3] | Threads can share or create worktrees; Cmd-K searches connected work; explicit thread ordering; pin/settle/snooze lifecycle. | Stable order, explicit context choice, browser-reserved-shortcut honesty. | Unified open-work navigation without requiring a thread for every file. | Thread/model/mode as mandatory top-level architecture; auto-settlement as Perch's cleanup policy. |
| **Orca** [O1–O4] | Mixed resource tabs, per-worktree layouts, daemon restoration; separate Quick Open/Jump; background worktree creation and review handoffs. | Runtime invariants, progress/cancel/retry, resource tabs and existing review packet behavior. | Shallower context disclosure and two command entry points instead of expanding the inventory. | Worktree-native everywhere, nested context hierarchy and parity-driven feature accumulation. |
| **Linear** [L1] | Inbox distinguishes priority from other updates; item-scoped actions and keyboard navigation. | Actionable attention separated from information. | A small queue with source-driven resolution, not issue lifecycle states. | Badge inflation, subscriptions/configuration work, a full-screen task-management dashboard. |
| **Raycast** [R1–R2] | Selected item has a searchable Cmd-K action panel; Enter is the primary action; file search exposes Open With and Quick Look. | Contextual action vocabulary and shortcut discoverability. | Palette/menu action definitions shared inside Perch's scope. | Global machine indexing and launcher/extension platform ambitions. |
| **GitButler** [G1] | Branches page makes parallel branches/stacks and target branch explicit. | Clear comparison target. | Small Base/Head selector inside review, with plain-language scope. | Parallel/virtual branch model as the default project mental model. |
| **GitKraken** [GK1] | Worktrees can be created from branches, opened/switched from a left panel, and removed separately from branch deletion. | Specific destructive scope and visible checkout identity. | Advanced context actions without a default commit graph. | Git graph/WIP/agent-session dual interface as main navigation. |
| **VS Code** [VS1] | File preview reuse, editor groups, Quick Open and command palette; rich configurable rails. | Buffer safety, path-first search and established keyboard interactions. | One optional preview plus simple split sets. | Activity-bar forest, arbitrary nested groups and chrome configurable before it is understandable. |
| **Cursor** [CU1–CU2] | Live diff review, explicit stop/redirection, review requests and check-oriented workflow. | Review generated work before trusting it. | Existing diff comments → selected CLI agent, with exact resource context. | Building a second chat/agent interface or making every file action an AI action. |

### Visual findings

- **Perch artifacts:** one project repeats its name at the workspace level; the environment block and permanent file toolbar consume disproportionate space in a 900px-wide view. Source confirms the structure; artifact-specific text is not evidence of a current bug.
- **Zen workspace screenshot:** recognizable names carry context better than an icon-only rail. Adopt semantic scope, not decorative per-space themes.
- **Vivaldi two-level stack screenshot:** grouping adds a literal extra tab row. That is exactly the density cost Perch should avoid.
- **Conductor onboarding screenshot:** the workspace/setup checklist clearly explains isolation, but exposes branch, setup and review structure before any first task. Perch should move that explanation to the isolation action.
- **Emdash overview screenshot:** agent/file tabs and right explorer coexist naturally; line-count deltas, PR marks and permanent library controls crowd the left rail. Keep the former pattern, not the latter information density.
- **Zed project-panel screenshot:** a restrained frame and readable file content work well. Its large tree remains an editor-first choice, not a reason to make Perch's project sidebar another explorer.
- **Orca split demo frames:** context-menu split action leads to side-by-side web surfaces; a concrete resource relationship is clearer than teaching pane architecture first.

---

## Appendix B. Six-flow comparison

These are evaluations of documented paths, not timed usability measurements. “Not native” means the flow is outside the product's main remit; do not infer an absent feature from an incomplete documentation search.

| Product | 1. Open project | 2. Context/worktree | 3. New tab/item | 4. Switch ongoing work | 5. Respond to attention | 6. Open/review/run file |
|---|---|---|---|---|---|---|
| Zen | Workspace is the closest topic scope, not a disk project. | Create workspace; containers separately isolate web identity, not files. | Ordinary browser tab. | Sidebar/workspace switching. | Site/browser signals, not agent semantics. | Web/document navigation, not project execution. **Lesson:** first-use scope can be simple without hiding all context. |
| Vivaldi | Workspace groups related browsing. | Create named workspace; no Git checkout. | Normal tab, optional stack. | Workspace menu/Quick Commands; stacks and tiling. | Browser attention, not a required-action agent queue. | Web content and saved sessions, not a coding file workflow. **Lesson:** powerful scope, too many organization variants for Perch. |
| Arc | Space rather than folder. | New Space separates browsing sets. | Command bar/new tab. | Space-scoped sidebar/pins. | Browser signals; no coding-state inference. | Web resources; archive/reopen navigation. **Lesson:** persistence semantics must be simpler and safer for processes. |
| cmux | Initial workspace is a ready terminal. | Workspace contains terminal/browser surfaces; Git context is contextual metadata. | Terminal/browser surface. | Vertical workspace navigation. | Surface-targeted notifications/jump to unread. | Use CLI/external tools/browser. **Lesson:** fastest terminal-first entry, supplement rather than replace it with a file browser. |
| Warp | Start in shell cwd. | Tabs/panes/configurations, not mandatory Git isolation. | Cmd-T/new terminal. | Tabs/pins/groups. | Command output is organized into blocks; do not equate every block failure with user attention. | Commands operate files; blocks help inspect output. **Lesson:** useful terminal ergonomics without making Perch a new shell. |
| Zed | Open folder/project. | Worktree semantics are not the main file-panel navigation lesson here. | Open file or terminal/pane. | Tabs, panes, MRU/file finder. | Diagnostics/editor context; agent-specific flow not evaluated here. | Preview/edit/search and terminal execution. **Lesson:** quick open and buffer behavior are worth adopting. |
| Conductor | Import repository. | Create isolated workspace as core workflow. | Start agent/chat, terminal or resource in that workspace. | Sidebar streams of work. | Return to agent/checks/review. | Run scripts, terminal, full diff and inline feedback. **Lesson:** coherent review loop, excessive mandatory setup for generic browsing. |
| Emdash | Add project. | Add Task from branch/issue/PR, generally backed by worktree. | Agent/conversation and related file tabs. | Project/task sidebar and pins. | Agent task state and review. | CLI, diff view, explorer and app browser. **Lesson:** mixed surfaces work; task-first onboarding is optional complexity for Perch. |
| T3 Code | Choose/add project or no-project thread. | New thread may use New worktree or an existing one. | Thread-centric creation. | Cmd-K and ordered/pinned threads. | Questions/approvals, limits, snooze and subagent signals. | File context, terminal, Git actions and review. **Lesson:** consistent server identity; avoid importing the whole thread lifecycle. |
| Orca | Add project/repository. | Create workspace/worktree with base/name. | Mixed-tab omnibox. | Worktree sidebar, Cmd-J and per-worktree layouts. | Live attention metadata and notifications. | Cmd-P, viewers, diff comments, terminal/browser. **Lesson:** closest functional reference; reduce its navigational concepts rather than imitate its silhouette. |
| Linear | Open team/project scope; not a disk folder. | Issue/project scope, not checkout. | Open work item rather than terminal tab. | Search, lists and views. | Priority Inbox with contextual actions. | Not a file runner. **Lesson:** study triage, not development IA. |
| Raycast | Search file/folder; not a persistent coding project. | Selected-item scope, not Git context. | Launch/open a resource or command. | Search recent/indexed items. | Contextual action selection, not agent monitoring. | Open With, Quick Look, file actions, Open in Terminal. **Lesson:** one selected object exposes useful verbs. |
| GitButler | Open repository. | Apply/manage parallel branches and stacks. | Open branch/change view rather than generic tab workflow. | Branches page and workspace target. | Inspect integration/conflict state. | Review branch changes; not a generic media/run surface. **Lesson:** comparisons need an explicit base, but branch machinery should stay optional. |
| GitKraken | Open repository. | Create/open worktree from branch/left panel. | Repository/worktree tab. | Left panel or graph checkout path. | Git/agent-session status when using those views. | Graph/WIP/diff workflow, external development tools as needed. **Lesson:** safe scope labeling, not graph-first home. |
| VS Code | Open folder/workspace. | Folder/workspace + Git tooling; not inherently one task per worktree. | Open editor/terminal; file preview on browse. | Quick Open, tabs and editor groups. | Diagnostics/notifications; extensions add agent semantics. | Full editor, diff and integrated terminal/tasks. **Lesson:** excellent file mechanics; avoid copying all surrounding chrome. |
| Cursor | Open code project. | Agent/local/cloud context depends on workflow. | File or agent conversation. | Editor tabs and agent context. | Review/stop/respond through agent UI. | Live diffs, checks and explicit review. **Lesson:** keep feedback close to changes without making a second agent application. |

### Perch's target six-flow loop

1. **Open project:** Open project → choose folder → project selected → choose Terminal, installed agent or Browse files. No wizard, automatic clone or background command.
2. **Create context:** project menu → New isolated context → name → Create. Explain isolation, show base/advanced only as needed; progress/cancel/retry remain visible without blocking the app.
3. **Create tab:** Cmd-T/+ → choose thing. Context already known. No process until selection is confirmed.
4. **Switch work:** click tab/context/project or Cmd-K. Restore view, never restart execution. Location stays legible.
5. **Respond:** Needs You → Open → exact CLI/resource. Resolve in its native interaction; queue clears from real evidence.
6. **Open/review/run:** Cmd-P or Files → safe renderer → contextual Edit/Run/Ask/Changes. Execution requires an explicit verb; review uses the canvas.

---

## Appendix C. Research references and reliability lessons

### Browser patterns

- **Z1:** [Zen Workspaces](https://docs.zen-browser.app/user-manual/workspaces), including official workspace screenshots.
- **Z2:** [Zen Split View](https://docs.zen-browser.app/user-manual/split-view).
- **V1:** [Vivaldi Workspaces](https://help.vivaldi.com/desktop/tabs/workspaces/).
- **V2:** [Vivaldi Tab Stacks](https://help.vivaldi.com/desktop/tabs/tab-stacks/), including two-level-stack screenshot.
- **V3:** [Vivaldi Tab Tiling](https://help.vivaldi.com/desktop/tabs/tab-tiling/) and [Saved Sessions](https://help.vivaldi.com/desktop/tabs/session-management/).
- **A1:** [Arc Spaces](https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas).
- **A2:** [Arc Pinned Tabs](https://resources.arc.net/hc/en-us/articles/19231060187159-Pinned-Tabs-Tabs-you-want-to-stick-around) and [Split View](https://resources.arc.net/hc/en-us/articles/19335393146775-Split-View-View-Multiple-Tabs-at-Once).
- **A3:** [Arc Auto Archive](https://resources.arc.net/hc/en-us/articles/19228855311127-Auto-Archive-Clean-as-you-go). Arc pages were search-indexed evidence; direct fetch was forbidden.

### Terminal, editor and agent products

- **C1:** [cmux Getting Started and restoration caveat](https://cmux.com/docs/getting-started).
- **C2:** [cmux notifications: targeted delivery, focus/read behavior and navigation](https://github.com/manaflow-ai/cmux/blob/main/docs/notifications.md).
- **W1:** [Warp Tabs](https://docs.warp.dev/terminal/windows/tabs).
- **W2:** [Warp Blocks](https://docs.warp.dev/terminal/blocks/).
- **ZD1:** [Zed Project Panel](https://zed.dev/docs/project-panel), including official screenshot and preview/file-operation behavior.
- **ZD2:** [Zed Finding and Navigating](https://zed.dev/docs/finding-navigating).
- **CO1:** [Conductor First Workspace](https://www.conductor.build/docs/first-workspace), including setup screenshot and isolation warning.
- **CO2:** [Conductor Workflow](https://www.conductor.build/docs/concepts/workflow).
- **E1:** [Emdash Tasks](https://emdash.com/docs/tasks).
- **E2:** [Emdash Overview](https://emdash.com/docs), including task/CLI/file screenshot.
- **T1:** [Official T3 Code repository](https://github.com/pingdotgg/t3code). A search result initially pointed to another repository; findings here use the official repository instead.
- **T2:** [T3 Working with threads](https://github.com/pingdotgg/t3code/blob/main/docs/user/thread-sidebar.md).
- **T3:** [T3 Keybindings](https://github.com/pingdotgg/t3code/blob/main/docs/user/keybindings.md) and [Project settings](https://github.com/pingdotgg/t3code/blob/main/docs/user/project-settings.md).
- **O1:** [Orca tabs/panes/splits source documentation](https://github.com/stablyai/orca/blob/564f1352/docs/site/content/docs/model/tabs-panes-splits.mdx).
- **O2:** [Orca worktrees](https://github.com/stablyai/orca/blob/564f1352/docs/site/content/docs/model/worktrees.mdx) and [Quick Open / Jump Palette](https://github.com/stablyai/orca/blob/564f1352/docs/site/content/docs/model/quick-open.mdx).
- **O3:** [Orca session restoration](https://github.com/stablyai/orca/blob/564f1352/docs/site/content/docs/model/session-restore.mdx) and [file viewers](https://github.com/stablyai/orca/blob/564f1352/docs/site/content/docs/editing/viewers.mdx).
- **O4:** [Orca tab-split video asset](https://github.com/stablyai/orca/blob/564f1352/docs/site/public/docs/videos/tab-split.mp4), inspected as four sequential frames from the local reference checkout.
- **VS1:** [VS Code User Interface](https://code.visualstudio.com/docs/editing/getting-started/userinterface), especially preview tabs, editor groups and command palette.
- **CU1:** [Cursor Reviewing and Testing](https://cursor.com/learn/reviewing-testing). An older `/docs/en/agent/review`-style result was stale; this current guide supports the review findings.
- **CU2:** [Cursor Quickstart](https://cursor.com/docs/get-started/quickstart).

### Action, attention and Git patterns

- **L1:** [Linear Inbox](https://linear.app/docs/inbox).
- **R1:** [Raycast Action Panel](https://manual.raycast.com/action-panel).
- **R2:** [Raycast File Search](https://manual.raycast.com/file-search).
- **G1:** [GitButler Branches Page](https://docs.gitbutler.com/features/branch-management/branch-lanes).
- **GK1:** [GitKraken Worktrees](https://help.gitkraken.com/gitkraken-desktop/worktrees/).

### Issue reports as regression prompts—not current-product verdicts

- [Zen #10388](https://github.com/zen-browser/desktop/issues/10388): reported pinned split restoration across new windows. **Lesson:** pin state, split membership and window/viewer identity must be restored together. The report was closed; do not cite it as proof the present product is broken.
- [cmux #4370](https://github.com/manaflow-ai/cmux/issues/4370): reported restored unread-ring acknowledgment behavior. **Lesson:** explicit viewing, restored background state and underlying resolution are separate transitions.
- [T3 Code #3753](https://github.com/pingdotgg/t3code/issues/3753) and [#1714](https://github.com/pingdotgg/t3code/issues/1714): reports involving thread/worktree binding and external checkout identity. **Lesson:** UI labels cannot substitute for canonical host/context/resource identity; changing a shell cwd is not moving all associated resources.

### Final browser-comprehension test

A new user should be able to say:

> “These are my projects. This one has a separate copy for an experiment. These tabs are what I left open. That question mark needs an answer. Opening a file is safe; Run starts something. Closing a running terminal stops it. Quitting Perch does not close my work.”

If a future feature requires a more complicated explanation before these six statements remain true, it belongs behind an explicit advanced action—or outside Perch.
