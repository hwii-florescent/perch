---
phase: 2
title: "Cloneable navigation, tabs and pane chrome"
status: completed
priority: P1
effort: "6-9 engineering days"
dependencies: [1]
---

# Phase 2: Cloneable navigation, tabs and pane chrome

## Goal and phase scout

Make the real shipped navigation source cloneable, including WorkspaceOverview, its nested actions and alternate sidebar paths. Read [design](design.md) and [parity](parity-matrix.md). First re-scout all current callers and state lifetimes; the working tree's WorkspaceOverview and sidebar tests are already modified.

## File inventory

| Action | Absolute path | Rough scope | Test impact |
|---|---|---|---|
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/Sidebar.tsx | Large; actual/legacy navigation roots | Existing sidebar e2e |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/WorkspaceOverview.tsx | Large; full presentation graph | StatusSidebar tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/TabBar.tsx | Large; mixed resource tabs | Tab/order/close regressions |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/StatusBar.tsx | Medium; full usage/status graph | StatusBar tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/SplitCanvas.tsx | Narrow source selection, preserve engines | Pane/terminal continuity |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/dockview/DockviewShell.tsx | All registered panel adapters, including ModPanel | Docked and layout source parity |
| Modify narrowly if required | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/dockview/dockviewController.ts | Panel identity/selection, not a new controller | Same instance/resource identities |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/LayoutRoot.tsx | Builtin-name resolution | LayoutRoot tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/App.tsx | Compose source-selected chrome | App tests |
| Modify only shared actions that are missing | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/modCommands.ts | Explicit targets and stock-used actions | modCommands tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/mod-runtime.ts | Navigation SDK exports | Singleton/API tests |
| Regenerate | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/stock_ui/ | Navigation packages | Byte-identical clone assertions |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/StatusSidebar.test.tsx | Parametrize stock/clone | Preserve current added assertions |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/StatusBar.test.tsx | Parametrize stock/clone | Usage redemption/timeout |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/e2e/sidebar.spec.ts | Real clone behavior variant | Preserve known baseline failures |
| Extend | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/e2e/stock-ui-clones.spec.ts | Navigation acceptance atop Phase 1 loader proof | Already registered in main config |

Source-export roots may retain existing TSX paths to keep tests/imports stable. Do not create a second hand-maintained UI tree merely for naming.

## Requirements and steps

1. Inventory each source root's owned local state, nested menus, data selectors, actions and DOM markers. Include `SidebarContent`/legacy ProjectList and normal WorkspaceOverview, status/usage, agent launchers, host chooser and pane headers. Record all source-selection callers, including mobile consumers for later Phase 5 propagation.
2. Share existing `workspaceNav`, `workspaceTabs`, `sidebarOrder`, attention/status helpers, host actions and close guards. Keep presentation grouping, filtering, form state, touch long-press, keyboard selection, drag ordering, context-menu composition and display logic editable. Do not hide the whole sidebar behind a compiled controller.
3. Export complete navigation packages, including presentation descendants. Host boundary may expose safe semantic operations and reusable primitives, not an opaque compiled WorkspaceOverview. Eliminate source cycles between Sidebar/WorkspaceOverview and shared icon imports without changing behavior.
4. Resolve stock names such as sidebar/tabs/status through the same module catalog as clones, including DockviewShell's registered panel adapters and SplitCanvas's ModPane path. Provide supported selection for a clone in stock/custom layouts and the global navigation path. A cloned layout keeps references to shared modules unless the user explicitly clones/selects those modules; do not promise a recursive clone or silently share user-private state.
5. Preserve host-qualified project/workspace/session scope; organize-by-status/project; hidden/pinned/attention ordering; rename/delete/worktree; instructions/memory; provider readiness; disabled/disconnected/direct hosts; add-project native chooser and browser alternative.
6. Preserve mixed resource tab order, preview/pin semantics, dirty markers, focus, close authority, rename editing, pointer splitting/reordering and active-tab reveal. Preserve DOM markers relied on by tabDrag/native browser focus or deliberately migrate every consumer with a regression.
7. Preserve status context/cost, branch/connectivity, zoom and the **whole usage flow**, including reset confirmation, refresh timeout and result correlation. Existing narrow status slot does not supply all these operations.
8. Establish explicit pane/tab/terminal command targets where needed by a clone. Existing current-context-only implementations are not equivalent to a clone acting on its selected row. Use one typed command registry; do not invent private duplicate global shortcuts.
9. Prove deep modification: clone stock navigation, separate projects/agents into separately arranged blocks, change grouping and keyboard/touch order, and add an action using a shared command. Confirm stock source is not imported as an opaque substitute.
10. Run the same behavioral assertions against stock and untouched clone. Commit only when the clone retains every inventoried function. Transient hover/open menus may reset on edit; resource focus, in-flight work and persisted selections may not.

## Scenario matrix and success criteria

| Priority | Scenario | Required evidence |
|---|---|---|
| Critical | WorkspaceOverview clone, not legacy-row demo | Full source graph plus real add/focus/rename/reorder/worktree actions |
| Critical | Owner close versus watcher dismiss | Same closeGuard path; process identity and ownership retained |
| Critical | Mixed file/session/browser/review tabs and pane clone | No hidden target becomes a different resource; dirty drafts retained |
| High | Agent-only/status ordering, touch long-press, keyboard launcher | Existing assertions run on stock and clone |
| High | Host unavailable or direct-mode limited | Explicit disabled/unavailable behavior; never local execution |
| High | Status usage refresh/reset action | Once-only request, timeout and correlation unchanged |
| Medium | Resize/rename/Escape/theme during reload | Source retains behavior, focus and documented transient-state rules |

## Verification

- `npm run test -w @perch/web -- src/components/StatusSidebar.test.tsx src/StatusBar.test.tsx src/App.test.tsx src/components/LayoutRoot.test.tsx src/sidebarOrder.test.ts src/tabDrag.test.ts src/modCommands.test.ts src/keybinds.scopes.test.tsx src/keybinds.close.test.tsx`
- `npm run build`
- `(cd e2e && npx playwright test stock-ui-clones.spec.ts sidebar.spec.ts workspace-tabs.spec.ts pane-splitting.spec.ts)`
- `(cd e2e && PERCH_E2E_WEBKIT=1 npx playwright test --project=webkit stock-ui-clones.spec.ts)`
- Document existing known failures separately with reproducible baseline evidence; never weaken assertions to make the migration green.

## Checklist and dependency map

- [x] Full navigation/usage/tab/pane implementation exported and selected through one runtime. (Sidebar, status, tabs and pane headers are packages selected through `StockView`/`use`; the menus and dialogs they place became stock screens in phase 4, and the phone's header, switcher and panes in phase 5.)
- [x] Nested behavior and current/legacy navigation paths covered. (Nested: the dialog-shell and dropdown copies are used inside stock and cloned parents, `stock-ui-clones.spec.ts` "Instructions, Memory, the worktree form…"; Instructions opened from a sidebar copy's project menu inside a dialog-shell copy, agent-mods C14 stage 3. Current path: the project overview in every sidebar test. Legacy path: a host without `workspace.snapshot` gets the folder list, whose rows open their session through `session.open`, `stock-ui/sidebar/content.test.tsx` (mutation-checked).)
- [x] Deep stock clone demonstrably changes hierarchy and interactions. (`stock-ui-clones.spec.ts` "a sidebar copy regroups the sessions by agent, then project…": agent > project > session with pins first through `terminal.pin` (SDK 1.10.1 redraws `useTerminals` on pins and order), the copy's own Up/Down order, Perch's rows still switch, open their menu by right-click and touch hold; stock unchanged; Chromium and WebKit. Agent-made: agent-mods C14 stages 1-2, the same regrouping plus headings that fold by click, Enter and touch.)
- [x] Existing behavior matrix passes on stock and unmodified clone. (`PERCH_E2E_STOCK_CLONES` runs the existing specs on untouched copies, `e2e/stockClones.setup.ts`. sidebar, nav, workspace-tabs, mixed-tabs, pane-splitting, keybindings, responsive and needs-you, Chromium, 2026-11-09: stock 58 passed, clones of sidebar, tabs, status, pane-header, tab-menu, new-session, launcher, pane-menu, session-split and navigator 57 passed; the failures are the same set in both modes: W2 and sidebar 2d (base), needs-you N1 (Claude Code 2.1.319 takes the Enter typed after the prompt as a newline, so no question is asked, in both modes), and the order-dependent leader split (P1/P2 family, base; pane-splitting and sidebar on the clones alone: 17 passed, 2d failed). Serial specs skipped what followed a failure: 8 (stock), 9 (clones).)
- [x] Explicit command targeting and shared engine ownership verified. (Tabs, panes and every sidebar row command name their target and throw on a missing one; close guard, drag engine and the core-kept order stay shared: `modCommands.test.ts`, the stock/clone e2e.)

Phase 1 is prerequisite. Phase 3 uses the same package/runtime boundary for a resource-domain variant. Phase 4 owns making all global dialogs/settings replaceable, but any nested navigation dialog needed for Phase 2 must already be included in its package rather than left opaque.

## Review corrections (binding; override conflicting text above)

Apply the corrections listed in [phase 1](phase-01-start.md#review-corrections-binding-override-conflicting-text-above) and the owner decisions in [validation.md](validation.md): local-device-only stock cloning, Herdr-style documented SDK, no clone size cap, host-owned drafts/operation ids before reload, fixed sanitizers, relay proof via `e2e/relay.check.mjs`, phone-form mods opt-in per phone, and worktree-relative paths. Re-scout this phase against current source before starting.

## Progress log

### 2026-11-09 (uncommitted, on `8a02934`)

Done and proven:

- SDK 1.2.0 (`sdk.ts`, `perch-sdk.d.ts`, pinned in `sdk.test.ts`, documented in docs/MOD-SDK.md): status line and the whole plan-usage flow, workspace tabs, typed `runCommand`, tab drag, launcher/new-file, pane look and presentation helpers. Vite/vitest alias `@perch/sdk` to `src/sdk.ts`, so the app renders stock source directly.
- Stock packages `stock:status`, `stock:tabs`, `stock:pane-header` (TSX in `packages/web/src/stock-ui/`, exported by `scripts/export-stock-ui.mjs`). `StatusBar.tsx` and `components/TabBar.tsx` are gone; App, LayoutRoot and SplitCanvas show them through `StockView`, one instance per place.
- Selection: `perch mod use <stock:id> <id|stock>` and `mods.set op:"use"` write a core-owned `use` map beside the chosen layout; `StockView` shows the chosen clone only while it is on, esm and error-free. Decision recorded in docs/DECISIONS.md.
- Explicit targets for `tab.close`, `tab.pin`, `tab.menu`, `pane.unsplit`, `pane.close`.
- The stock tab menu now carries a session's message choices, as the sidebar row menu does (`mixed-tabs.spec.ts` asserted this and failed on the old TabBar too).

Not done (checklist stays open):

- Sidebar / WorkspaceOverview / legacy ProjectList are not packages (S02, S03); steps 1–3, 5 and 9 for navigation are open.
- Host-drawn parts placed by the packages: `TabMenu`, `NewSessionMenu`, `NewFilePrompt`, `TabDragLayer`, `PaneContextMenu`.
- `vite dev` has no `dist/stock-ui`, so the chrome shows its placeholders there; use `npm run build`.

Checks run: `cargo test -p perch-core` (871 pass), `cargo test -p perchd` (all pass), `cargo fmt --check`, clippy (only the 2 existing warnings in `db/mod.rs` and `perch-desktop/src/browser.rs`), `npm run build`, `npm test` (128 files, 1183 tests), `npm run check:stock-ui`, `stock-ui-clones.spec.ts` Chromium 4/4 and WebKit 4/4, `node --experimental-strip-types e2e/relay.check.mjs` (passes, including the stock screen from the relay's own assets), mods, keybindings, workspace-tabs, mixed-tabs, pane-splitting, sidebar, nav, responsive in Chromium.

Failures in that Chromium run, not from this phase's changes:

- `workspace-tabs.spec.ts` W2: leader `_` makes no split because W1's sessions are Quickchat sessions with no workspace, and `splitActiveTab` returns without one. P1 (the same leader path, in a workspace) passes alone.
- `pane-splitting.spec.ts` P1 fails only after other specs leave sessions; the whole spec passes alone (3/3).
- `responsive.spec.ts` R9: `row-menu` never opens. Likely cause, not proven: run from a git worktree, the switcher's first workspace is the main checkout's "perch main" row. This phase does not touch the sidebar, WorkspaceOverview or the hold code; MobileSwitcher only changed its usage import.

### 2026-11-09, the sidebar (uncommitted, on `8a02934`)

Done and proven:

- SDK 1.3.0, navigation (`navigation.ts` hooks, `sdk.ts`, `perch-sdk.d.ts`, pinned in `sdk.test.ts`, docs/MOD-SDK.md "Navigation (1.3)"): `useHosts`, `useNavigation`, `nestSessions`, `useSessionFolders`, `useAddProject`, `useAddProjectRequest`, `pickFolder`; `SessionDot`, `HostStateDot`, `SessionMenu`, `WorktreeMenu`, `InstructionsDialog`, `MemoryDialog`, `FolderBrowser`, `Dialog`, `ConfirmDialog`, `Select`, `menuItemClass`, `rowActionClass`, `buttonClass`, `beginReorderDrag`; `NewSessionMenu` takes `projects`. Listing, order, attention, the Done hold and Quickchat are computed once there, not in the screen.
- Typed row commands with explicit targets (`session.*`, `project.move`, `workspace.*`, `worktree.*`, `host.*`, `folder.select`, `quickchat.new`) in `modCommands.ts`, tested in `modCommands.test.ts`.
- Stock package `stock:sidebar` (`stock-ui/sidebar/`): the project tree, By status, In one list, Quickchat, Add project (native and browser folder pickers), row menus, drag and Move up/down, host chip and switcher, the legacy folder list for hosts without projects, and the gear. `Sidebar.tsx` and `components/WorkspaceOverview.tsx` are deleted; `NewSessionPopover` moved to `components/NewSessionPopover.tsx`. App and LayoutRoot show it through `StockView`; the phone's `MobileSwitcher` renders `stock-ui/sidebar/content.tsx` compiled in, so it keeps its own screen.
- Sidebar unit tests (`StatusSidebar`, `WorkspaceNavigation`, `chromeViews`, `StartFolder`, `NewTabLauncher`, `App`, `LayoutRoot`) changed only their import or mock paths. `mods.test.ts` mocks `./workspaceNav`, which `modCommands.ts` now imports and which syncs with the real store when it loads.
- `stock-ui-clones.spec.ts` "the sidebar runs from its stock package…": stock and an untouched clone through `use` give the same rows and order, switching, By status, the row menu and Add project; a deep edit (list label, a body button on `session.open`) changes only the clone and the stock files stay byte-identical; at phone width the switcher keeps the stock body. The status test now picks its split partner by id (leftover sessions from other specs made the "Show beside" match ambiguous), and presses Escape until its tab menu closes (in the suite the menu's listener can attach after the key). The whole file passes after mixed-tabs, pane-splitting and responsive (Chromium) and alone in WebKit (5/5).

Not done (checklist stays open):

- Host-drawn parts the package places: `SessionMenu`, `WorktreeMenu`, `InstructionsDialog`, `MemoryDialog`, `FolderBrowser`, `NewSessionMenu`, `ConfirmDialog`, `Dialog`, `Select`.
- Step 9's hierarchy change (projects and agents in separate layout blocks, regrouped keyboard/touch order) is possible with these hooks but not demonstrated; the existing behavior matrix runs on stock, not on an untouched clone.
- A row menu opened by right-click takes Escape only after its first paint (its listener is an effect); the e2e presses until it closes. Same structure as before the move.

Baseline check (task 7): a temporary worktree of `8a02934` with the 38 non-plan snapshot files (sha256 verified) fails `workspace-tabs` W2 and `responsive` R9 alone and in the suite, and `pane-splitting` P1 and `sidebar` 2d after other specs, exactly as this branch does. Recorded in docs/TESTING.md known failures; the temporary worktree and its processes are removed.

### 2026-11-09, reviewed at phase 5 (not committed)

Box 1 is ticked: the host-drawn menus and dialogs named as open became stock screens in phase 4 (parity ledger,
second slice), and the phone's own navigation screens are `stock:mobile-*` packages (phase 5). Boxes 2 to 4 stay
open: no clone that regroups projects and agents into separate blocks or changes keyboard/touch order is
demonstrated (box 3), and the existing navigation specs run on the stock packages, while an untouched clone is
checked only by the stock-ui-clones assertions, not by the whole existing matrix (box 4). The legacy navigation
paths of box 2 were not re-inventoried here.

### 2026-11-09, closing boxes 2-4 (not committed)

- Box 2: nested dialogs and dropdowns were already covered (stock-ui-clones); the legacy folder list had no test.
  `stock-ui/sidebar/content.test.tsx` renders the sidebar body for a host without `workspace.snapshot` (folder rows,
  a row opens its session through `session.open`) and with it (the overview); forcing the overview fails it.
- Box 3: the regrouping copy above (Chromium and WebKit) and the agent-made one (agent-mods C14, two passing runs).
  The touch hold on a row used to click the menu item under the finger on release; `longPress` now swallows that one
  release click and `RowMenu` closes on a capture `pointerdown` outside it (`stock-ui/sidebar/parts.test.tsx`,
  mutation-checked). The same fix closes responsive R9.
- Box 4: the two matrix runs above (logs kept outside the repo: `matrix-stock-keep.log`, `matrix-clone-keep.log`).
