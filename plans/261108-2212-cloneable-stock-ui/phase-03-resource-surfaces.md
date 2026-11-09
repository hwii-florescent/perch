---
phase: 3
title: "Cloneable files, review, chat and terminal composition"
status: pending
priority: P1
effort: "8-12 engineering days"
dependencies: [2]
---

# Phase 3: Cloneable files, review, chat and terminal composition

## Goal and phase scout

Export real resource-facing UI while retaining a single owner for buffers, review transactions, provider operations and live resource engines. This is the credible second-case test of Phase 1's boundary, not permission to fork domain logic. Re-scout current native-chat work and every presenter/adapter caller before editing.

## File inventory

| Action | Absolute path | Rough scope | Test impact |
|---|---|---|---|
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/WorkspaceTools.tsx | Context and source selection | Files/Git/browser scope |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/WorkspaceFiles.tsx | Large presentation graph | File durability/keyboard/media |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/WorkspaceGitReview.tsx | Large presentation graph | Review/commit/discard/comments |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/WorkspaceGitReviewPane.tsx | Adapter/export boundary | Single-store authority |
| Modify | /Users/hwiii/Github/perch/packages/web/src/views/NativeCliChat.tsx | Large, active dirty source | Composer/control/history regressions |
| Modify/export descendants | /Users/hwiii/Github/perch/packages/web/src/views/nativeChat/ | Presentation files only | Existing per-component tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/views/AgentPane.tsx | Source-selected presentation | No premature terminal attachment |
| Modify narrowly | /Users/hwiii/Github/perch/packages/web/src/views/PersistentTerminal.tsx | Stable engine outlet | Lease/input/drop regressions |
| Modify narrowly | /Users/hwiii/Github/perch/packages/web/src/views/PersistentAgentTerminal.tsx | Stable engine outlet | Replay/query/resize authority |
| Modify narrowly if needed | /Users/hwiii/Github/perch/packages/web/src/terminalKeeper.ts | Handoff reuse, no second cache | Process/view-count assertions |
| Modify | /Users/hwiii/Github/perch/packages/web/src/mod-runtime.ts | Resource SDK and instance state | Cross-domain conformance |
| Modify | /Users/hwiii/Github/perch/packages/web/src/modUi.ts | Terminal-containing layout surfaces | Overlay/window behavior |
| Modify | /Users/hwiii/Github/perch/packages/web/src/modCommands.ts | Peek/keep/park and explicit targets | Semantic command tests |
| Extend | /Users/hwiii/Github/perch/e2e/stock-ui-clones.spec.ts | Real resource clones | Existing registered spec |
| Regenerate | /Users/hwiii/Github/perch/crates/perch-core/src/stock_ui/ | Resource packages | Reproducibility |

Existing filesystemStore, gitReviewStore, nativeUi, agentTerminals, surfaceSync, xtermSetup and Rust native_ui remain authorities. If the scout proves operation reconciliation currently lives in a view, extract that specific state machine at its existing module boundary; list its actual file and consumers before implementing. No speculative all-purpose controller service.

## Requirements and implementation steps

1. Trace source callers through drawer, standalone tab, split/pane and mobile views. Reuse `useToolsContext` workspace/terminal-cwd/remote qualification instead of inferring scope from a path or active project.
2. Export file tree, explorer navigation, preview/editor chrome, Markdown/media/PDF presentation, search, file-entry/context menus, draft/conflict dialogs and Ask-agent entry points. CodeMirror/media engines may be SDK primitives; the surrounding file pane is editable. Preserve dirty buffers, expected versions, truncated-preview protection, save intents and external-change conflicts in existing services.
3. Export review list/diff/selection/composer/confirmation presentation. Reuse `gitReviewStore`, versioned comments, refs, comparison identities, preview-before-discard/commit and Context Bridge capture. Do not replace Perch's safer granular review with Herdr's git-add-all implementation.
4. Export native-chat composition, messages/code/diff/UI blocks, requests, attachments, options, menus, recall/find/history and related controls. Keep transcript projection/provider protocol in Rust; no mod-owned provider client or parser. All existing user-added native-chat work must be included, not replaced from HEAD.
5. Move pending send/control reconciliation, operation ids, acknowledgements and unsent drafts into their existing shared owner if presentation currently owns their lifetime. A code edit cannot resubmit an uncertain send or drop a provider approval. UI-local menus/organization remain editable; do not hide all chat behind a compiled presenter.
6. Define engine outlet ownership for xterm, native browser webviews and other resource surfaces. Candidate views show non-attached placeholders. Commit handoff reuses existing view/keeper where possible, preserves focus/geometry/resize authority and never launches/restarts a process. Duplicate terminal views are allowed only where existing observation rules explicitly permit them.
7. Add declarative layout content to overlays/popups/in-app windows so a mod can compose a **live** terminal beside arbitrary mod UI. Reuse LayoutRoot's node semantics rather than a second layout language. The overlay must return focus and release only its observation; it cannot accidentally own stop/resize authority.
8. Wire the complete terminal/resource queries from Phase 1 to explicit-target actions; reads/send/focus must not require an on-screen DOM terminal. Include hidden terminals and agent/subagent records where the owning service can authoritatively report them, with explicit unknown/unavailable state otherwise. Implement distinguishable terminal presentation actions: peek is transient; keep adopts/retains an intended presentation; park/unkeep hides/releases that presentation without stopping execution. Use Perch identities and authority, not Herdr's runtime resurrection semantics. Preserve explicit terminal pin behavior and expose persistent pin/order data needed by alternate panels; avoid process-local UI state masquerading as shared terminal metadata.
9. Deep-clone a Git-review or file panel and change its composition/interaction while proving the stable host contract does not change. Deep-clone chat to move composer/context/requests while exercising a pending operation and draft through reload.
10. Test disconnect, unknown execution state, remote project/workspace identity, watcher close, new/hidden terminal, attachment upload and replay. No fallback to local execution or implicit retry of uncertain work.

## Scenario matrix

| Priority | Scenario | Mechanical pass |
|---|---|---|
| Critical | Dirty editor reload/clone/core reconnect | Same buffer/version/draft survives; no truncated overwrite |
| Critical | Pending native send or approval during source replacement | Same operation id and outcome reconciliation; no duplicate dispatch |
| Critical | Live terminal moved into overlay and back | Same process; no extra input/resize owner or replay side effect |
| Critical | Remote unavailable/ambiguous ownership | Refusal/unknown displayed; no local fallback, restart or destructive cleanup |
| High | Review comments/stage/discard/commit/Context Bridge | Existing transaction and packet identities preserved |
| High | Drawer and resource tab clones coexist | Correct scope and deliberate independent view state |
| High | Peek/keep/park and pin ordering | Distinct documented presentation effects; execution unchanged |
| Medium | Media/PDF/Markdown/find/history/slash/file menus | Existing presentational functionality retained |

## Verification

- Run current filesystemStore, gitReviewStore, agentTerminals, fileTabs, splitSets, closeGuard and nativeChat test files selected by the scout; record their exact names in execution evidence.
- `npm run test -w @perch/web -- src/modCommands.test.ts src/modApp.test.ts src/fileTabs.test.ts src/splitSets.test.ts`
- `npm test`; `npm run build`; `cargo test -p perch-core native_ui`; `cargo test -p perchd`
- `(cd e2e && npx playwright test stock-ui-clones.spec.ts workspace-files-durable.spec.ts explorer-keyboard.spec.ts mixed-tabs.spec.ts agent-terminal-ownership.spec.ts)`
- `(cd e2e && npx playwright test -c native-composer.config.ts)`
- `(cd e2e && npx playwright test -c native-review.config.ts)`
- `(cd e2e && npx playwright test -c remote-workspace.config.ts)`
- These configurations may make real paid turns. Use only approved cheap models, verify actual banner and isolate all runtime paths per docs/TESTING.md.

## Checklist, risks and dependencies

- [ ] Files/review/browser/chat presentation graphs, including descendants, are editable.
- [ ] Same domain stores and pending-operation owners serve stock and clones.
- [ ] Terminal-containing composition and distinct presentation actions pass.
- [ ] Draft, operation, replay, remote and engine-ownership regressions pass.
- [ ] Second-case source changes require no second runtime or duplicated domain implementation.

Depends on Phase 2. Long-lived engines and NativeCliChat are high-risk boundaries; failed ownership/durability checks block the next phase. Native OS prompts/renderers remain primitives, not cloneable OS implementations. Phase 4 completes global routing; Phase 5 proves all clients.
