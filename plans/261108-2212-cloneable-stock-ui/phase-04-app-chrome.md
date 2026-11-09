---
phase: 4
title: "Cloneable global UI, layouts and agent workflow"
status: pending
priority: P1
effort: "6-9 engineering days"
dependencies: [3]
---

# Phase 4: Cloneable global UI, layouts and agent workflow

## Goal and scout

Eliminate opaque global UI islands and provide the full authoring/state/window workflow. Merely cloning a dialog is insufficient if host callers still hard-code its old implementation. Re-scout every global opener and native integration before editing.

## File inventory

| Action | Absolute path | Rough scope | Test impact |
|---|---|---|---|
| Modify | /Users/hwiii/Github/perch/packages/web/src/App.tsx | Global openers and layout composition | App/recovery |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/SettingsPage.tsx | Full settings presentation, preserve services | Settings tests |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/Navigator.tsx | Palette/navigation/help | Navigator/key scopes |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/NewSessionDialog.tsx | Launcher/forms | Existing dialog tests |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/ConfirmDialog.tsx | Global and nested replacement | Busy/IME/focus |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/Toast.tsx | Notification source selection | Timeout/actions/live-region |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/WorktreeMenu.tsx | Forms/delete review | Worktree tests |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/InstructionsDialog.tsx | Full existing UI | Dialog tests |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/MemoryDialog.tsx | Full existing UI | Revision/conflict tests |
| Modify/export descendants | /Users/hwiii/Github/perch/packages/web/src/components/ | Folder/agent/pickers, key help, onboarding, permission views and context menus | Enumerate exact roots during scout |
| Modify | /Users/hwiii/Github/perch/packages/web/src/modUi.ts | Named content, kept window persistence | Mod/window tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/modHost.ts | Explicit mod persistence APIs | Storage/corruption tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/layoutState.ts | Stable instance ids and click/layout reconciliation | Layout regressions |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/layouts.rs | Compatible source selection/layout validation | Rust layouts tests |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/server/mods.rs | Durable bounded mod-data operations, if absent | Auth/revision tests |
| Modify | /Users/hwiii/Github/perch/crates/perchd/src/agent_cli.rs | Guide/types/clone/select/check/status/shot | CLI tests |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/mod_examples/perch-mod.d.ts | One typed API reference | Existing API parity checks |
| Extend | /Users/hwiii/Github/perch/e2e/stock-ui-clones.spec.ts | Nested/global replacement and kept windows | Registered e2e |

No separate updater, telemetry or feedback backend is required. Any existing Perch screen is still part of its source inventory, including desktop-only presentation. OS-owned dialogs remain platform primitives with capability reporting.

## Requirements and steps

1. Route every global/nested opener through supported source selection. Inventory Settings sections, palette/help, confirms/prompts, session/worktree/folder/agent menus, instructions/memory, notifications, permissions and onboarding; show the mapping in parity-matrix.md. Avoid inventing a generic plugin/event framework: one explicit slot-to-module selection map at existing openers is sufficient.
2. Export each complete presentation graph. Stock and clones get the same semantic actions and data. Preserve safety confirmations, async busy/error state, keyboard/IME guards, focus restoration, outside/Escape dismiss, live regions, hover/focus-paused notification timeouts and command/session actions.
3. Make desktop stock composition a cloneable layout; keep a minimal verified recovery shell outside it. Existing `sidebar/tabs/canvas/files/git/status` names remain backward-compatible aliases to shipped source. Preserve legacy layout files/positions and root looks, window drag/titlebar/traffic-light/native-browser rules.
4. Distinguish immutable default layout from user copies. Cloning a layout does not deep-copy all referenced modules unless explicitly requested; clone relevant packages separately and select them deliberately. Show provenance in CLI/Settings, never overwrite independent copies or silently merge upstream changes.
5. Implement root/global source selection for terminal menu, toast, prompt, confirm, help and other existing openers. Missing/broken clone selection must visibly fall back to verified stock while retaining the chosen file and error. Do not copy Herdr's hard-coded routing limitations.
6. Complete in-app window behavior: keyed position, persisted kept window specification and selected-layout ownership. Restore the user's own data separately from a window's geometry. Layout switch/close/disposal follows explicit ownership; no independent OS window is implied. Persist atomically with bounded records; malformed state is preserved/reported rather than silently overwritten.
7. Make mod data lifetimes explicit: view-instance state versus durable per-mod data versus explicitly shared data. Reuse current localStorage values with non-destructive migration; persist needed mod data under a core-owned folder using existing filesystem patterns, not in JS source folders or a new schema by default. Define conflict/corruption handling and test simultaneous writers. Back up before any actual schema/data migration.
8. Finish command/keys authoring semantics: named targets/arguments, scoped mod commands, passthrough and explicit errors. Keep one SHORTCUTS/typed command path and preserve native accelerators/reserved keys. Do not make exact Herdr names a substitute for equivalent behavior.
9. Teach the complete CLI loop: discover shipped panels/types -> clone -> select -> edit local JS/CSS/helpers -> exact revision/instance check -> DOM and screenshot -> disable/reset. Retain old syntax where possible; new syntax must have CLI parse/guide tests. Command results are not treated as completed external operations unless their real protocol says so.
10. Document JS rather than JSX, ordinary CSS rather than runtime Tailwind, supported imports/assets, host capabilities and independent-copy upgrade costs. Include a source example with nested helper, typed JSDoc, private instance state and semantic actions.
11. Amend the owning decision/architecture docs to supersede stock-is-not-mods, while retaining trusted-code/no-sandbox, recovery and authority contracts. Add a truthful capability matrix, not an unsupported blanket parity claim.

## Scenario matrix

| Priority | Scenario | Mechanical pass |
|---|---|---|
| Critical | Clone confirm/menu/help/toast and trigger from stock host route | Selected clone actually opens; all existing actions and guards function |
| Critical | Source failure while Settings/recovery needed | Verified recovery accessible without executing user package |
| High | Window keep/position across app restart and layout switch | Bounded documented restoration; no copied private data |
| High | Two instances/viewers and simultaneous durable writes | Deliberate state scope, explicit conflict/corruption behavior |
| High | Layout edits versus remembered click overrides | Intentional source fields win; unchanged fields retain view state |
| High | Native menu/traffic lights/browser focus + custom overlay | No shortcut swallowing, focus stealing or incorrect geometry |
| Medium | Update shipped package | Independent clone bytes unchanged; provenance/API compatibility visible |

## Verification

- `npm run test -w @perch/web -- src/components/SettingsPage.test.tsx src/components/Navigator.test.tsx src/components/NewSessionDialog.test.tsx src/components/Toast.test.tsx src/components/FileEntryMenu.test.tsx src/components/InstructionsDialog.test.tsx src/components/MemoryDialog.test.tsx src/modApp.test.ts src/modCommands.test.ts src/keybinds.close.test.tsx`
- `cargo test -p perch-core layouts`; `cargo test -p perch-core mods`; `cargo test -p perchd agent_cli`
- `npm run build`
- `(cd e2e && npx playwright test stock-ui-clones.spec.ts mods.spec.ts keybindings.spec.ts toasts.spec.ts worktrees.spec.ts)`
- `cargo run -p perch-desktop --example close_shortcut_probe` only as the isolated non-activating native probe described in docs/TESTING.md; it does not certify hardware keyboard or all visual focus behavior.

## Checklist and dependencies

- [ ] All existing global and nested UI roots are cloneable and selectable.
- [ ] Stock layout source, aliases and legacy state are preserved.
- [ ] Named live overlays, kept windows and durable mod-data scopes work.
- [ ] Agent guide/types/CLI/diagnostics demonstrate the complete no-build loop.
- [ ] Safety/a11y/native interaction assertions pass for stock and clone.

Depends on Phase 3. Phase 5 consumes this complete contract to validate phone/web rollout, release compatibility and actual agent use. Failure of global selection routing is a parity blocker, not a documentation caveat.
