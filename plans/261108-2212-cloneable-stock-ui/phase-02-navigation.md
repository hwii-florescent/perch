---
phase: 2
title: "Cloneable navigation, tabs and pane chrome"
status: pending
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
| Modify | /Users/hwiii/Github/perch/packages/web/src/Sidebar.tsx | Large; actual/legacy navigation roots | Existing sidebar e2e |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/WorkspaceOverview.tsx | Large; full presentation graph | StatusSidebar tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/TabBar.tsx | Large; mixed resource tabs | Tab/order/close regressions |
| Modify | /Users/hwiii/Github/perch/packages/web/src/StatusBar.tsx | Medium; full usage/status graph | StatusBar tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/SplitCanvas.tsx | Narrow source selection, preserve engines | Pane/terminal continuity |
| Modify | /Users/hwiii/Github/perch/packages/web/src/dockview/DockviewShell.tsx | All registered panel adapters, including ModPanel | Docked and layout source parity |
| Modify narrowly if required | /Users/hwiii/Github/perch/packages/web/src/dockview/dockviewController.ts | Panel identity/selection, not a new controller | Same instance/resource identities |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/LayoutRoot.tsx | Builtin-name resolution | LayoutRoot tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/App.tsx | Compose source-selected chrome | App tests |
| Modify only shared actions that are missing | /Users/hwiii/Github/perch/packages/web/src/modCommands.ts | Explicit targets and stock-used actions | modCommands tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/mod-runtime.ts | Navigation SDK exports | Singleton/API tests |
| Regenerate | /Users/hwiii/Github/perch/crates/perch-core/src/stock_ui/ | Navigation packages | Byte-identical clone assertions |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/StatusSidebar.test.tsx | Parametrize stock/clone | Preserve current added assertions |
| Modify | /Users/hwiii/Github/perch/packages/web/src/StatusBar.test.tsx | Parametrize stock/clone | Usage redemption/timeout |
| Modify | /Users/hwiii/Github/perch/e2e/sidebar.spec.ts | Real clone behavior variant | Preserve known baseline failures |
| Extend | /Users/hwiii/Github/perch/e2e/stock-ui-clones.spec.ts | Navigation acceptance atop Phase 1 loader proof | Already registered in main config |

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

- [ ] Full navigation/usage/tab/pane implementation exported and selected through one runtime.
- [ ] Nested behavior and current/legacy navigation paths covered.
- [ ] Deep stock clone demonstrably changes hierarchy and interactions.
- [ ] Existing behavior matrix passes on stock and unmodified clone.
- [ ] Explicit command targeting and shared engine ownership verified.

Phase 1 is prerequisite. Phase 3 uses the same package/runtime boundary for a resource-domain variant. Phase 4 owns making all global dialogs/settings replaceable, but any nested navigation dialog needed for Phase 2 must already be included in its package rather than left opaque.
