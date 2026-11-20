# Shortcut and window-behaviour audit: web against native

Date: 2026-11-15. Read-only: no code changed, nothing built or run, nothing committed.

- Web: `packages/web/src` in the worktree `/Users/hwiii/Github/perch-wt/native-mods` (`feat/native-mods`, `cb0d5e14`, clean).
- Native: `crates/perch-native` in the same worktree.
- Paths below are relative to that worktree. Line numbers come from reading that commit.
- Brief: `shortcut-audit-brief.md`. Rules: `agent-rules.md`.

## How to read this

Most stock screens are the web's own React code, run on the native React runtime: `crates/perch-native/mods/*` (tabs, sidebar, launcher, start, keybind help) and `mods/react-runtime/runtime.mjs`. A difference on those screens comes from one of two places:

1. The data and commands the window gives them (`mods/perch.rs`, `workspace.rs`, `sidebar.rs`).
2. The runtime's event and layout translation (`runtime.mjs`).

Rust-only surfaces (Navigator, the terminal, the pane header) are compared by behaviour.

## Counts

| Area | Same | Different | Missing | Refused |
|---|---|---|---|---|
| Shortcut bindings (114 rows from the web registry, `keybinds.ts`) | 86 | 18 | 10 | 0 |
| Commands `runCommand` accepts (82 names, `modCommands.ts`) | 55 | 0 | 27 | 0 |
| Mouse behaviours (9 listed below) | 4 | 1 | 1 | 0 (2 unresolved, 1 not on web) |

"Refused" means a native command that answers with an error. Every "missing" command gets `No command <name>.` from `workspace.rs` `run_command` (the fallback at `workspace.rs:2790`), and the same goes for the key-bound ones. Missing bindings in the table below have no key at all.

## 1. Shortcut bindings

Web registry: `keybinds.ts`. Native: `keymap.rs` (`SHORTCUTS`, `leader_target`), `actions.rs` (`ACTIONS`, `Nav::run`), `workspace.rs` (`run_command`).

### Global (12 rows: 11 same, 1 missing)

| Binding | Keys (mac) | Web | Native | Verdict |
|---|---|---|---|---|
| global.navigator | Cmd+P | keybinds.ts:104 | keymap.rs:102; workspace.rs:2102 `toggle_palette` | same |
| global.navigatorAlt | Cmd+K outside terminals | :105 | keymap.rs:106 | same |
| global.settings | Cmd+, | :106 | keymap.rs:111; workspace.rs:2575 | same |
| global.help | Cmd+/ | :107 | keymap.rs:112; workspace.rs:2103 | same |
| global.helpPlain | Shift+/ outside inputs | :189 | keymap.rs:114 | same |
| global.sidebar | Cmd+B | :108 | actions.rs:35; actions.rs:227 | same |
| global.drawer | Cmd+Shift+B (Alt+Shift+B) | :109, toggles the right drawer (files and Git) | keymap.rs `SHORTCUTS`; workspace.rs `run_command` toggles `shell.rs` `toggle_drawer`; Settings > Keyboard overrides it as other globals | same |
| global.needsYou | Cmd+Shift+U | :110 | actions.rs:37; actions.rs:231 (native adds `global.needsYouPrev`, actions.rs:43, with no key) | same |
| view.zoomIn / zoomInShift | Cmd+= / Cmd+Shift+= | :113-114 | keymap.rs:120, 122; workspace.rs:2611 | same |
| view.zoomOut / zoomReset | Cmd+- / Cmd+0 | :115-116 | keymap.rs:126-127; workspace.rs:2612-2613 | same |

### Tabs (17 rows: 13 same, 3 different, 1 missing)

| Binding | Keys (mac) | Web | Native | Verdict |
|---|---|---|---|---|
| tabs.new | Cmd+T | :119; `requestNewTab`; the "+" menu with Terminal, New browser, New file (`stock-ui/tabs/main.tsx:191-200`) | keymap.rs:129; workspace.rs:2629 bumps `new_tab_asks`; the tab mod's popover, which offers agents only (see R2) | **same** after the fix run: Terminal, New browser, New file listed; the two this window has no view for are refused with the reason |
| tabs.close | Cmd+W | :120; `closeCurrent`: browser, then file, then split terminal, then session (guarded) | keymap.rs:134; workspace.rs:2655 closes the shown tab only | **different** (no file or browser tabs natively) |
| sessions.new | Cmd+Shift+T | :121; launcher with Terminal, New browser, New file | actions.rs:48; actions.rs:233; workspace.rs:2108 opens the launcher with agents only (see R2) | **same** after the fix run (Terminal listed; New browser and New file refused with the reason) |
| tabs.keepOpen | Cmd+Alt+Enter | :122; pins the preview file tab | none; no preview tabs natively | **missing** (decision: no preview tabs natively) |
| tabs.jump1 to tabs.jump8 | Cmd+1..8 (Alt+1..8) | :128 | keymap.rs:138-145; workspace.rs:2764 | same (8 rows); fix run: past the last tab now jumps to the last, as the web's `Math.min`, instead of an error |
| tabs.last | Cmd+9 | :130 | keymap.rs:146; workspace.rs:2644 | same |
| tabs.next / tabs.prev | Cmd+Shift+] / [ (Ctrl+PageDown / PageUp) | :131-132 | keymap.rs:147-148; workspace.rs:2636, 2640 | same (2 rows) |
| nav.back / nav.forward | Ctrl+- / Ctrl+Shift+- | :135-136 | keymap.rs:151, 156; workspace.rs:2473-2474 | same (2 rows) |

### Workspaces, "nests" in the web ids (14 rows: 2 same, 12 different)

| Binding | Keys (mac) | Web | Native | Verdict |
|---|---|---|---|---|
| nests.prev / nests.next | Ctrl+Shift+Up / Down | :139-140; `stepNest` (`workspaceNav.ts:76-85`) | actions.rs:54, 59; actions.rs:243-244; `step_workspace` actions.rs:349-368; `go_to` actions.rs:312-321 | **same** after the fix run (an empty workspace opens its start page) |
| nests.jump1 to nests.jump9 | Ctrl+Shift+1..9 | :143; `jumpToNest` | actions.rs:64-104; actions.rs:246; `jump_workspace` actions.rs:371-377 | **same** after the fix run (R3, 9 rows) |
| nests.scratchpad | Cmd+Shift+N | :147; `newScratchpad` is silent when there is no Quickchat (`workspaceNav.ts:94-102`) | actions.rs:52, 238; workspace.rs:2422-2427 shows the error `There is no Quickchat on this computer.` | fix run: opens the Quickchat start page before the first quickchat (R1). The web is silent there, but the web always has a Quickchat (its transport makes one on connect), so this is what the web shows in practice. **Decision** if silence is wanted |
| nests.new | Cmd+N | :145; worktree menu on create | keymap.rs:103; workspace.rs:2478 | same |
| nests.addBirdhouse | Cmd+O | :146 | keymap.rs:104; workspace.rs:2477 | same |

### Panes (10 rows: all same)

| Binding | Keys (mac) | Web | Native | Verdict |
|---|---|---|---|---|
| panes.splitRight / splitDown | Cmd+D / Cmd+Shift+D | :150-151 | keymap.rs:160, 162; workspace.rs:2691-2692 | same |
| panes.prev / panes.next | Cmd+[ / Cmd+] | :152-153 | keymap.rs:166-167; workspace.rs:2701, 2697 (`tabs.cycle`, the shown split's tabs) | same |
| panes.zoom | Cmd+Shift+Enter | :154 | keymap.rs:169; workspace.rs:2705 | same |
| panes.focus.left / right / up / down | Cmd+Alt+arrow | :157 | keymap.rs:174-189; workspace.rs:2709-2712 | same (4 rows) |

### Terminal (6 rows: all same)

terminal.find (:161, keymap.rs:196, workspace.rs:3506), terminal.clear (:162, 198, 3507), terminal.scrollTop (:163, 202, 3522), terminal.scrollBottom (:164, 204, 3523), terminal.prevCommand (:166, 209, 3514), terminal.nextCommand (:167, 214, 3518). Native runs them in `terminal_command`, so a rebound key never reaches the program.

### File editor (9 rows: all missing)

editor.save, find, replace, replaceAlt, findNext, findPrevious, findNextAlt, findPreviousAlt, gotoLine (`keybinds.ts:170-180`). No file editor natively. Files are out of scope (brief non-goals).

### Navigator and folder browser (6 rows: all same keys)

navigator.next, nextAlt, previous, previousAlt (`keybinds.ts:182-185`; `keymap.rs:409-427`, scope Navigator). directory.use, useAlt (`keybinds.ts:186-187`; `keymap.rs:433-439`). The Navigator is still a Rust view; the folder browser is a mod.

### Leader (36 rows: 33 same, 3 different)

| Binding | Keys | Web | Native | Verdict |
|---|---|---|---|---|
| leader.arm | Ctrl+Space | :191 | keymap.rs:254; workspace.rs:1888 | same |
| leader follow-ups navigator, help, sidebar, settings, nextTab, previousTab, splitRight, splitDown, zoom, nextPane, focus.h/j/k/l (14 rows) | g ? b s n p v Shift+- z o h j k l | `keybinds.ts:192-200` (table) | keymap.rs:259-309; `leader_target` keymap.rs:485-499 | same |
| leader.close | x | :192-200 → `tabs.close` | keymap.rs:271; `leader_target` keymap.rs:491 → `tabs.close` | **different** (inherits tabs.close) |
| leader.jump1 to jump8 | 1..8 | :203 | keymap.rs:314-321 → `tabs.jump` | same (8 rows) |
| leader.jump9 | 9 | :203 → `jumpToNthWorkspaceTab(9)`: the 9th tab, or the last when there are fewer | keymap.rs:322; `leader_target` keymap.rs:516 `jump9 => tabs.last` | **same** after the fix run (`leader.jump9`: the 9th tab, or the last) |
| leader.nextProject | w | :204 | keymap.rs:324; workspace.rs:2475 `next_project` | same (behaviour not compared in depth) |
| leader.worktree | Shift+W | :205 | keymap.rs:330; workspace.rs:2478 | same |
| leader.newSession | c | :206 → `newSessionInCurrentProject`: creates a session in the current project at once, no launcher | keymap.rs:336; `leader_target` keymap.rs:500 → `sessions.new` → launcher | **same** after the fix run (a terminal in the project on screen, no launcher) |
| leader.swapNext | Shift+] | :207 | keymap.rs:342; workspace.rs:2725 | same |
| leader.grow / leader.shrink | Shift+= / - | :208-209 | keymap.rs:348, 354; workspace.rs:2471-2472 | same |
| leader.swap.left/down/up/right | Shift+h/j/k/l | :211 | keymap.rs:360-378; `leader_target` keymap.rs:517-521 → `pane.swap:dir` (workspace.rs:2721) | same (4 rows) |
| leader.resize | r | :214 | keymap.rs:384; workspace.rs:2470 | same |

### Resize mode (4 rows: all same)

resize.left/down (shrink) and resize.up/right (grow) (`keybinds.ts:212`; `keymap.rs:390-403`; `workspace.rs:2471-2472`).

### Native only (no web row)

- Keys: terminal.copy (Cmd+C, keymap.rs:221), terminal.paste (Cmd+V, 226), terminal.selectAll (Cmd+A, 231). The web does these through the browser and xterm; the keybind help has a "Copy / paste" row.
- No key: global.needsYouPrev (actions.rs:43), sidebar.organize (actions.rs:109), app.palette (keymap.rs:545).
- Native terminal-only commands without a key: scrollPageUp, scrollPageDown, takeControl, takeBack, takeBackAll, kill (keymap.rs:218-252).

### Cmd+Shift+P

Neither client binds it. The web has no such row in `keybinds.ts`; the native test asserts it resolves to nothing (keymap.rs:1327). So Part A item 4 is a decision for the owner, not a parity gap.

## 2. Commands (`runCommand` / `TYPED_COMMANDS`, `modCommands.ts`)

Of the 82 web command names, native handles 55 by name (`workspace.rs` `run_command` arms, the `OWN` list in `mods/perch.rs` around line 1610, or `sidebar run_action`). Behaviour was not compared for each.

Native has no handler for 27. Each answers `No command <name>.`:

- ~~agent.next, agent.prev~~ (fix run: handled)
- ~~app.help, key.bind~~ (fix run: handled; key.bind refuses what the web's `bindableCombo` refuses)
- layout.clone, float, hide, reset, resize, select, set, show, stack, switch, toggle (11). The layout system is not built natively (keymap.rs:1-20 says so).
- mod.clone, mod.open. Mods on the native side are outside this run (brief: `perch mod` CLI support is out of scope).
- project.home, tab.pin, terminal.open, terminal.order, terminal.pin
- window.close, window.maximize, window.minimize. These are desktop window controls; no native equivalent.
- workspace.files, workspace.git (these need the drawer)

Native-only: pane.swapNext and the terminal.* names listed under "Native only" above.

## 3. Mouse behaviour

| Behaviour | Web (file) | Native (file) | Verdict |
|---|---|---|---|
| Tab drag to reorder, from the focused tab | `tabDrag.ts` pointer drag; `stock-ui/tabs/main.tsx:135` `onPointerDown` on every tab | Left press reaches the React host (`runtime.mjs:14071`); the window owns the drag: `tab.beginDrag` (workspace.rs:2347), `drag_moved` (workspace.rs:1042), `drag_ended` (workspace.rs:1082) | **same** after the fix run: the strip owns the press (`app_owns_titlebar_drag`), any tab drags (R4) |
| Tab drop on the strip (reorder) | `tabDrag.ts` `commit` | `drag_ended` → `Drop::Strip` (workspace.rs:1093) | same |
| Tab drop on a pane's side (split) | `tabDrag.ts` `planDrop`, `dropTab` | `Drop::Pane` (workspace.rs:1061, 1096), `drop_beside` (tabs.rs:478), zone box in `tab-drag` mod; headless test `tests/mods_floating_window.rs` `tab_drag` (661-790) asserts `tab-drop-zone:right` and the split | **same**: implemented and tested; the fix run adds the left zone from an unfocused tab |
| Context menu on a tab | `stock-ui/tabs/main.tsx:137` `onContextMenu` → `openMenu` | `runtime.mjs:14075` right press → `contextmenu`; `tab.menu` (workspace.rs:2389) | same |
| Double-click to rename a tab | `stock-ui/tabs/main.tsx:141` `onDoubleClick` | `runtime.mjs:14081` dispatches `dblclick` when click count is 2 and the node listens for it | same (not reported; not run) |
| Middle-click close on a tab | none on the web: the tab strip has no middle-click handler | the runtime maps only left and right presses (`runtime.mjs:14071-14079`) | **not on web** |
| Middle-click on a file row (pin) | `stock-ui/files/files.tsx:153` `onAuxClick` | no middle button in the runtime; files out of scope | **missing** (out of scope) |
| Wheel on the tab strip | no wheel handler; the strip is `overflow-x-auto` | `overflow-x: auto` → GPUI scroll (`runtime.mjs:9360-9364`, `13989`); `on_scroll_wheel` only stops propagation (`14058`) | **unresolved**: should scroll; not run |
| Sidebar drag to reorder | `stock-ui/sidebar/overview.tsx` `beginReorderDrag` | `followPointer` (`runtime.mjs:~286-317`) → `pointer.follow` (workspace.rs:2375) | same |

Counts: same 4 (context menu, double-click, strip reorder, sidebar drag). Different 1 (focused-only drag). Missing 1 (files middle-click pin). Unresolved 2 (split drop, wheel). Not on web 1 (tab middle-click close).

## 4. The owner's reports, with causes

### R1. Quickchat section missing until its first session exists (web shows it)

**Status: cause not proven.**

Facts from the code:

- The Chats (Quickchat) project row is created by the core only on the first Quickchat session (`crates/perch-core/src/server/session.rs:594-598` `chats_pair` and `publish_project_pair`). On a fresh database there is no row, and neither client can show the section.
- Native builds the section from `store.projects`, filled by `project.list` (`crates/perch-native/src/client.rs:461`; `sidebar.rs:607-615`). The Quickchat is the one project whose path ends in `/.perch/scratch` (`sidebar.rs:1249`, `navigation.rs:918-925`).
- `project.list` excludes archived rows (`db/projects.rs` `list_projects`, `archived = 0`). The web reads `workspace.snapshot` (`client.rs:1565`; `packages/web/src/store/index.ts:1826`), whose query (`list_projects_locked`, `db/projects.rs:832`) does not filter archived rows.
- The native sidebar ignores `projects` inside a `WorkspaceSnapshot`, reading only `workspaces` (`sidebar.rs:629-633`).

Two checks that decide it:

1. On a copy of the owner's database (not the live one): `select id, path, archived from projects where path like '%/.perch/scratch'`. If the row is archived, the two clients disagree by design of the queries.
2. Compare the two replies (`project.list` and `workspace.snapshot`) for that row.

Fix once known: make both clients read the same project set, or make native apply `projects` from the snapshot. Small.

### R2. "+", Cmd+T and Cmd+Shift+T offer agents only, not Terminal, New browser or New file

**Status: Terminal cause proven; the browser and file extras not proven.**

Terminal (proven):

- The native agent list drops the terminal manifest. `sidebar.rs:739-744` filters `m.id != TERMINAL_PROVIDER` before storing `store.providers`.
- The React choices come from `perch.rs:1045-1048` → `agent_choices` (`perch.rs:1535-1575`), which reads that list. So `useAgentChoices` never sees Terminal.
- The web's `AgentPicker.tsx:16-18` filters only on `available`, `enabled`, `cli` and `interactiveTerminal`. The core's terminal manifest passes that (`agent_fleet.rs:560-580`, `InteractiveTerminal` at line 576), and the web test fixtures show it listed.
- The Rust sidebar adds Terminal for its own list (`sidebar.rs:1034`), so the rule is only wrong for the React surfaces.

New browser and New file (not proven):

- Both the tab "+" menu (`stock-ui/tabs/main.tsx:197-200`) and the launcher (`stock-ui/launcher/main.tsx:70-73`) add the two extras only when a workspace exists. Native: `mods/tabs/tabs/main.js:204-207` and `crates/perch-native/mods/launcher/launcher/main.js:80-81`.
- Native's tab workspace is `view.workspace_id` (`perch.rs:428-450`), which is the focused workspace or the shown session's. The launcher's is `landing_workspace` (`workspace.rs:1382-1394`, `sidebar/navigation.rs:393-404`).
- Either can be empty when the shown session has no workspace record, or nothing is focused. Which one the owner hit is not known. Check: press Cmd+T with a project's session shown and with the start page shown, and read the `workspace` field of the tab props.

### R3. Switching workspace by shortcut does not work

**Status: cause proven for workspaces with no sessions.**

- `go_to` sets the workspace and returns `Outcome::Nothing` when the workspace has no sessions (`actions.rs:312-321`). `Nav::run` then reports handled and nothing opens (`ui.rs:133-143`).
- The web's `navigateToWorkspace` opens an empty workspace (`openEmptyWorkspace`, `workspaceNav.ts:46-56`) and remembers each workspace's last session (`lastWorkspaceSession`).
- `stops()` uses the selected host, not the active host (`actions.rs:271-278`). The web uses `activeHostId` (`workspaceNav.ts:68-73`). The web also puts Chats last and skips hidden workspaces; the native does neither in `stops()` (not verified in code).

Fix: `go_to` should open the workspace's start page when it has no session, the same as the web's `openEmptyWorkspace`. Small to medium.

### R4. A tab can be dragged only when it is the focused tab

**Status: cause not proven; the test gap is proven.**

- The only native drag test presses `alpha`, which is the shown tab (`tests/mods_floating_window.rs:661-690`, `select(rig, "alpha")` then `rig.center("tab:alpha")`). No test presses an unfocused tab.
- The web's drag is the same code (`tabDrag.ts` via `beginSlideDrag`). The window gets the press and the strip's entry boxes (`tab.beginDrag` with `entries`, workspace.rs:2347-2374).
- Candidate causes, not yet tested: the strip's `[data-tab-entry]` boxes are read through `getBoundingClientRect`, which returns a zero box until the engine lays the element out (`runtime.mjs:418-421`); or the first press on an unfocused tab re-renders the strip before the drag starts.

Check: copy the `tab_drag` case and press `bravo`. Fail point shows the cause.

### R5. Dropping a tab on a pane's side to split is not implemented

**Status: not confirmed as missing. Code and a headless test exist.**

- Drop geometry and the split: `drag_moved` (workspace.rs:1042-1080), `drag_ended` with `Drop::Pane` (workspace.rs:1096-1103), `can_drop` and `drop_beside` (tabs.rs:458-495), the zone box drawn by `mods/tab-drag/tab-drag/main.js:25-44`.
- The test `tab_drag` in `tests/mods_floating_window.rs` asserts the right zone is drawn and that the drop splits (around lines 747-790).
- The test drags only the focused tab (R4), so a split of an unfocused tab is untested.

Not run here. Need the owner's steps, or a run of that test on this build, to tell whether this is a real-pointer failure or a state failure.

### R6. After the last tab closes, keyboard focus stays on the closed terminal

**Status: cause from the code; GPUI behaviour not run.**

- `render` moves focus only when a terminal is shown (`workspace.rs:4245-4251`, `self.terminal()`, which is `tabs.active()`'s view) or when a modal is up (`workspace.rs:4252-4255`).
- After the last tab goes, `terminal()` is `None` and no modal is open. Nothing moves focus, so the removed terminal keeps the window's focus.

Fix: when no terminal and no modal, focus `screen_focus`. Small; add a headless test that closes the last tab and asserts focus.

### R7. The start page's "Quickchat" heading clips its last letter

**Status: cause proven by the mechanism.**

- The heading uses `tracking-[-0.02em]` (`stock-ui/start/card.tsx:7` `START_NAME`; the native copy is `mods/start/start/card.js:5`). The card then adds `overflow-hidden` and ellipsis (`card.js:36`).
- The runtime turns letter-spacing into right padding of `tracking × characters` (`runtime.mjs:9592-9598`: `pr: Math.round(h × chars)`).
- For a negative value the padding is negative. The text keeps its untracked width, which is wider than the box the web sized, so the last glyph falls outside the `overflow-hidden` box and is clipped.
- Other stock text with tracking has the same risk: sidebar, keybind help, worktree and tab-drag (`grep` finds `tracking` in those mods).

Fix: keep the text box at the tracked width (use `textWidth` in `mods-runtime`, which already measures exact widths), or apply negative tracking in the text run. Small to medium. The source is `mods-runtime/react`; the built `mods/react-runtime/runtime.mjs` is generated from it.

## 5. Ranked fix list

Settings column: "yes" means the fix or its check depends on the Settings port.

| # | Fix | Where | Size | Settings | Owner item |
|---|---|---|---|---|---|
| 1 | Keep Terminal in the agent choices | `sidebar.rs:739-744` | S (one filter change and a test) | yes: the terminal manifest's `enabled` (Settings > Agents) | R2 (three surfaces) |
| 2 | Empty workspace opens its start page on a shortcut | `actions.rs:312-321`, `:271-278` | S-M | no | R3 (13 rows) |
| 3 | Keep the tracked width of text with negative letter-spacing | `mods-runtime/react` (`runtime.mjs:9592-9598`) | S-M | no | R7 |
| 4 | Focus the window when no terminal is shown | `workspace.rs:4245-4256` | S + test | no | R6 |
| 5 | Make `project.list` and `workspace.snapshot` agree on the Chats row (after the DB check) | `db/projects.rs`, `client.rs:461`, `sidebar.rs:629-633` | S-M, after check | no | R1 |
| 6 | New browser and New file in the "+" and launcher (after the check) | `perch.rs:428-450`, `workspace.rs:1382-1394` | S, after check | no | R2 |
| 7 | Let an unfocused tab start a drag (after a repro) | `tests/mods_floating_window.rs` and the drag path | M, after repro | no | R4 |
| 8 | Split drop (no fix until a repro) | `workspace.rs:1042-1103` | unknown | no | R5 |
| 9 | `leader.newSession` creates in the current project, as the web does | `keymap.rs:336, 500` | S | no | leader.newSession |
| 10 | `leader.jump9` jumps to the 9th tab, or the last when fewer | `keymap.rs:322, 516` | S | no | leader.jump9 |
| 11 | Fixture test fails on a missing id (today it skips them) | `keymap.rs:1592-1596` | S | no | test gap |
| 12 | ~~`global.drawer` (Cmd+Shift+B) when a drawer exists~~ done | `keymap.rs`, `workspace.rs` | done | yes: a default that Settings > Keyboard can change | global.drawer |
| 13 | `tabs.keepOpen` (Cmd+Alt+Enter) | none | decision: no preview tabs natively | yes: keyboard | tabs.keepOpen |
| 14 | `agent.next`, `agent.prev`, `app.help` | `workspace.rs` `run_command` | S each | no | commands |
| 15 | `key.bind` | `workspace.rs` `run_command` | S | yes: writes `settings.keybindings` | commands |
| 16 | `nests.scratchpad` silent without a Quickchat, as the web | `workspace.rs:2422-2427` | S | no | nests.scratchpad |
| 17 | Wheel on the tab strip: confirm, then fix if broken | `runtime.mjs:9360-9364`, `14049-14058` | unknown | no | mouse |
| 18 | Native app menu (Edit, File with Close Tab, View, Window) | none | M; a decision | no | out of scope |
| 19 | Layouts, mods and `workspace.files/git`, `terminal.open/order/pin`, `project.home`, `tab.pin` | not built | out of this run | partly | commands |

Not on the list: `window.*` (desktop controls, no native equivalent), editor keys (files out of scope), `tabs.close`'s file and browser order (no such tabs natively), and middle-click on tabs (the web has none).

## 6. Unresolved and not checked

- Nothing was run. Every cause above is from reading the code at `cb0d5e14`.
- R1, R2 (extras), R4, R5 and the wheel need a headless run or the owner's database. The checks are in each item.
- Behaviour of `leader.nextProject`, `tabs.close` and the ordering of workspaces was not compared step by step.
- The Settings port changes the agent `enabled` flags and the keybinding overrides. Re-check items 1, 12 and 15 after it merges.

## Checked by the lead, 2026-11-15

- R2 and R3 confirmed in the code: `sidebar.rs` drops `TERMINAL_PROVIDER` from the choices, and `actions.rs`
  `go_to` returns `Outcome::Nothing` for a workspace with no sessions.
- R1 cause found in the trial core's database: the Quickchat project ("Chats", `~/.perch/scratch`) is not archived;
  it **does not exist until the first quickchat is made** (its `created_at` is the moment the owner made the first
  one, two hours after the first project). The web shows the Quickchat heading with its + before any exists; the
  native sidebar draws the section only from an existing scratch project. Fix: draw the section always, as the web.
- Side finding: the trial core's scratch folder is `~/.perch/scratch`, the installed app's, even with all four
  `PERCH_*` overrides. The scratch path does not follow the isolation variables.

## Fix run, 2026-11-15 (`nm/fix-run`)

Counts after the run: bindings 100 same, 3 different (tabs.close and leader.close: no file or browser tabs natively;
nests.scratchpad: a decision), 11 missing (global.drawer and tabs.keepOpen, which the window has nothing for, and the
9 editor keys, out of scope). Commands: 59 of 82 handled; the 23 left are layouts, mods, window controls, `workspace.files/git`,
`project.home`, `tab.pin`, `terminal.open/order/pin` (not built, out of this run). Mouse: R4 and R5 same; wheel on the
strip still not run.
