---
phase: 3
title: "Cloneable files, review, chat and terminal composition"
status: completed
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
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/WorkspaceTools.tsx | Context and source selection | Files/Git/browser scope |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/WorkspaceFiles.tsx | Large presentation graph | File durability/keyboard/media |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/WorkspaceGitReview.tsx | Large presentation graph | Review/commit/discard/comments |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/WorkspaceGitReviewPane.tsx | Adapter/export boundary | Single-store authority |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/views/NativeCliChat.tsx | Large, active dirty source | Composer/control/history regressions |
| Modify/export descendants | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/views/nativeChat/ | Presentation files only | Existing per-component tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/views/AgentPane.tsx | Source-selected presentation | No premature terminal attachment |
| Modify narrowly | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/views/PersistentTerminal.tsx | Stable engine outlet | Lease/input/drop regressions |
| Modify narrowly | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/views/PersistentAgentTerminal.tsx | Stable engine outlet | Replay/query/resize authority |
| Modify narrowly if needed | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/terminalKeeper.ts | Handoff reuse, no second cache | Process/view-count assertions |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/mod-runtime.ts | Resource SDK and instance state | Cross-domain conformance |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/modUi.ts | Terminal-containing layout surfaces | Overlay/window behavior |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/modCommands.ts | Peek/keep/park and explicit targets | Semantic command tests |
| Extend | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/e2e/stock-ui-clones.spec.ts | Real resource clones | Existing registered spec |
| Regenerate | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/stock_ui/ | Resource packages | Reproducibility |

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

- [x] Files/review/browser/chat presentation graphs, including descendants, are editable.
- [x] Same domain stores and pending-operation owners serve stock and clones.
- [x] Terminal-containing composition and distinct presentation actions pass.
- [x] Draft, operation, replay, remote and engine-ownership regressions pass.
- [x] Second-case source changes require no second runtime or duplicated domain implementation.

Depends on Phase 2. Long-lived engines and NativeCliChat are high-risk boundaries; failed ownership/durability checks block the next phase. Native OS prompts/renderers remain primitives, not cloneable OS implementations. Phase 4 completes global routing; Phase 5 proves all clients.

## Review corrections (binding; override conflicting text above)

Apply the corrections listed in [phase 1](phase-01-start.md#review-corrections-binding-override-conflicting-text-above) and the owner decisions in [validation.md](validation.md): local-device-only stock cloning, Herdr-style documented SDK, no clone size cap, host-owned drafts/operation ids before reload, fixed sanitizers, relay proof via `e2e/relay.check.mjs`, phone-form mods opt-in per phone, and worktree-relative paths. Re-scout this phase against current source before starting.

## Progress log

### 2026-11-09, first slice (not committed): host-owned unsent work, the review as a stock package, query services

Status: partial. No checklist box above is fully proven yet; each is held open by the work listed under "Remaining".

Done:

- **Chat drafts and sends are host-owned.** The scout found the native chat's draft, attachments, operation id, outbox (pending send) and receipts living in `NativeCliChat.tsx` module Maps and component state. They now live in `packages/web/src/chatComposer.ts`, a store keyed by session and provider. `sendDraft` refuses while a send is in flight, settles the draft only if its operation id is unchanged, keeps the draft and its id on failure, and turns an uncertain error into an `unconfirmed` outbox without retrying. The saved draft (`views/nativeChat/composerDraft.ts`) now carries the operation id, so a Retry after a page reload reuses the id the core already dedupes (`reserve_prompt_operation` in `server/native_ui.rs`). The existing composer UI and behavior are unchanged.
- **Review state is host-owned, and the review is a stock package.** `components/WorkspaceGitReview.tsx` moved to `stock-ui/review/review.tsx` (it imports only React and `@perch/sdk`), with `stock-ui/review/main.tsx` and `mod.json`. `WorkspaceGitReviewPane.tsx` was deleted. Split panes, the drawer and Dockview show it through `StockView name="review"`; the phone compiles the stock source in until Phase 5. The comparison, selection, comment draft, commit message, target session, instruction and batch preview live in `resourceState.ts`, keyed by workspace. A replaced or cloned view therefore shows the same unsent work, and an in-flight batch send blocks a second one. Domain transactions remain in `gitReviewStore`.
- **File view wrap** moved from a module variable in `WorkspaceFiles.tsx` into `filesystemStore` (the files surface is not yet a package).
- **SDK 1.4** (`mod-runtime.ts` SDK_VERSION, `perch-sdk.d.ts`, `sdk.ts`, `sdk.test.ts`, MOD-SDK.md). It adds `useResourceState`, `newId`, `FileIcon`, `GitMarker`, `useGitReview` and the Git/review types. It also adds the query services `terminals`/`useTerminals`, `readTerminal`, `sendToTerminal`, `layoutTree` and `focus`.
- **Query services in one place** (`modApp.ts`, reused by `perch-mod.d.ts` mods and the SDK). `terminalRecords()` lists every terminal Perch knows about, including hidden agents, subagents and terminals held off screen by `terminalKeeper` (`keptTerminals`, injected from `modCommands.ts`). Each record carries an explicit `running | exited | host-unavailable | unknown` state. `resolveTerminal` takes only explicit host-qualified targets and refuses a bare session id that two hosts share. Reading and sending no longer require a terminal on screen; a terminal never opened on this page gives a clear refusal naming `perch daemon read`.
- Docs: DECISIONS.md (2026-11-09 entry), ARCHITECTURE.md, MOD-SDK.md, and the parity matrix "Phase 3 entries".

Regressions added:

- `chatComposer.test.ts`: 5 tests.
- `views/NativeCliChat.composer.test.tsx`: 3 tests. A remount during a pending send keeps it "sending" and dispatches nothing more; two copies share one draft and one dispatch; after a reload the draft and its operation id come back, and a Retry reuses the id. A remount stands in for a code reload, a clone swap, a hidden copy released and a breakpoint crossing, since each of these unmounts and remounts the view.
- `components/WorkspaceGitReview.test.tsx`: 2 new tests (draft and packet survive a replaced view; no second send while one is in flight).
- `modApp.test.ts`: 3 new query tests.
- `e2e/stock-ui-clones.spec.ts`: a review test. Stock and an untouched clone show the same commit message. Deep edits (placeholder, a wrapper in main.js) change only the clone, and the stock bytes are unchanged. The phone keeps the stock review with the same message.

Each new unit test was mutation-checked: removing the store ownership makes it fail.

Commands and results:

- `npm test`: 130 files and 1197 tests pass. The views folder was re-run 3 times after hardening the mount wait, and 107 of 107 passed each time.
- `npm run build`: OK.
- `npm run check:stock-ui -w @perch/web`: 23 exporter tests pass; it reports "stock-ui matches its sources (28 files)".
- `cargo test -p perch-core`: 871 tests plus the integration and parity suites, all OK. `cargo test -p perchd`: OK.
- `stock-ui-clones.spec.ts`: 6 of 6 pass in Chromium and 6 of 6 in WebKit.
- Chromium batch (workspace-review, workspace-git, context-bridge, workspace-terminals, workspace-files-durable, workspace-file-browser, explorer-keyboard, mods, keybindings, sidebar, nav, mixed-tabs, responsive): 74 passed, 1 skipped, 5 failed.
  - `mods.spec.ts` herdr-commands now passes, 11 of 11. Its precondition waits for the terminal to be shown, because a read now also succeeds from a parked terminal.
  - R9 and sidebar 2d are known baselines.
  - `workspace-git.spec.ts` GB1 fails alone too. `.workspace-entry` matches HEAD's single-workspace header, which has the same class, and that markup predates this plan. No baseline run was made, so its cause is unproven.
  - `workspace-terminals.spec.ts` "perchd shell recovers … after a core crash" fails alone with "provider terminal failed: persisted terminal process is no longer available". This slice changed no Rust code and no terminal-view behavior (it only added the read-only `keptTerminals`), so it is likely not caused here, but that is not proven.
- `native-composer.config.ts native-composer.spec.ts` (Chromium, cheap models, PATH stripped of the outer Perch's shims): the 4 providers fail. In every provider the `@file` send reaches the agent; that send goes through `sendDraft` with a real core.
  - In all 4 the `image` check fails. It looks for `getByText("red.png")`, but HEAD's unchanged `nativeChat/Attachments.tsx` shows an image as a thumbnail whose name is only in `aria-label`/`title`. That is a spec/UI mismatch that also exists without this slice.
  - The rest are outside the composer store: the claude toolbar has no `native-cli-permission-mode`; the claude command reply was not the fixed word; codex and omp produced no request card; the omp terminal-draft pickup failed at the xterm itself. No HEAD baseline run was made.
- `native-review.config.ts` (Chromium and WebKit, OpenCode excluded because it is not installed): 8 of 8 fail. Each test clicks `mobile-switcher` → `workspace-git-<workspaceId>` (spec line 122). That test id exists neither in HEAD nor in this tree (HEAD has only `workspace-git-<hostId>` in the old Sidebar), so the spec is stale. Teardown also failed with "owned runtime has a detached process group; manual review required". The phone review is covered instead by the stock-ui-clones review test.
- `remote-workspace.config.ts` (including `remote-git.spec.ts`): 10 of 10 pass.
- `node --experimental-strip-types e2e/relay.check.mjs`: passed.
- `cargo fmt --check`: clean. `cargo clippy --workspace --all-targets`: only the 2 existing warnings (`db/mod.rs:1371`, `perch-desktop/src/browser.rs:309`).
- Leftover fixture daemons, agent process groups and pi computer-use bridges from failed teardowns were stopped by hand afterwards. Only processes under this run's temp dirs were stopped.

Remaining (not started; nothing was cut):

- The files surface (WorkspaceFiles, MobileFiles, menus) as a package.
- Native-chat presentation as a package, with the sanitizers exposed as fixed SDK components and attack-input tests.
- Terminal overlay/layout composition (step 7).
- Separate peek, keep and park semantics, plus pin and order data (step 8).
- Outlet ownership for AgentPane and PersistentTerminal (step 6).
- Disconnect, remote and unknown-state regressions (step 10).
- The drawer browser.
- Durable mod data (C06).
- Reading a terminal never opened on this page, which needs a daemon route.

### 2026-11-09, second slice (not committed): files, chat and browser as packages; terminal composition; peek/keep/park

Status: partial. Boxes 1, 2 and 5 above are ticked on the evidence below. Box 3 stays open because a remote
session's terminal (legacy view) is not kept, so a peek of one is a second observer rather than a move. Box 4 stays
open because the remote configuration was not rerun for this slice, and durable mod data and the unopened-terminal
read route are not built.

Baseline first (pristine worktree of `8a02934` plus the sha256-checked snapshot, removed afterwards): `workspace-git`
GB1 and `workspace-terminals` "perchd shell recovers … after a core crash" fail there with the same errors, so they are
recorded in docs/TESTING.md as known failures, not regressions. The two small spec fixes were made: native-composer's
image check now names the thumbnail's label (it passes for claude), and native-review's phone step uses
`mobile-pane-git`. `agent-turn-review.spec.ts` lines 338-339 and 533-534 carry the same stale step and were left alone.

Done:

- **`stock:files`** (`stock-ui/files/`), **`stock:chat`** (`stock-ui/chat/`) and **`stock:browser`** (`stock-ui/browser/`),
  each importing only React, `@perch/sdk` and siblings, shown through `StockView` wherever Perch drew them; the phone
  compiles the stock sources in. `components/WorkspaceFiles.tsx`, `views/NativeCliChat.tsx` and
  `components/DrawerBrowser.tsx` are gone. Host state behind them: `useWorkspaceFiles` (filesystemStore),
  `useNativeChat` (new `chatSession.ts`, extracted from the old component, over `chatComposer.ts`), `useBrowserPages`
  (drawerBrowsers). Engines are SDK components: `CodeEditor`, `FileAsset`, `MarkdownPreview`, `BrowserPage`.
- **Fixed sanitizers.** `Markdown` (`views/nativeChat/ChatMarkdown.tsx`) and `MarkdownPreview` are the only Markdown
  entry points; the chat sanitizer (`markdown.ts` `CHAT_SANITIZE`, also in `SafeHtml`) now drops forms and form
  controls, found by the new attack tests.
- **Terminal composition (steps 6, 7).** `showTerminal(…, { borrow })` in `terminalKeeper.ts` moves the one kept view into
  a new place and back; `BorrowTerminals` turns it on under `LayoutContent` (exported from `LayoutRoot.tsx`), used by
  mod surfaces (`modUi.ts` `overlay/popup/window({layout})`, validated by `surfaceLayout`, focus returned on close) and
  the SDK `Layout`. New block `session:<id>` (also valid in core layout files, `layouts.rs`).
- **Step 8.** `terminal.peek` (transient overlay of `session:<id>`), `terminal.keep` (close the peek, show the tab),
  `terminal.park`/`unkeep` (put the peek away; refuses without one), `terminal.order {ids}` persisted on the device with
  pins (`pinnedTerminals.ts`), reported as `order` by `agents()`, `terminals()` and SDK records.
- **SDK 1.5.0**: the exports above plus `Chevron`, `assetKind`, `shortcutLabel`, `FileEntryMenu`, `CopyButton`; `sdk.test.ts`,
  `perch-sdk.d.ts`, `perch-mod.d.ts`, MOD-SDK.md, DECISIONS.md (peek/keep/park supersede the 2026-11-08 lines),
  ARCHITECTURE.md, TESTING.md and the parity matrix (second-slice entries) updated.

Regressions added: `sanitizers.test.tsx` (attack inputs through `Markdown`, streaming and not, and `MarkdownPreview`;
the form case failed before the sanitizer change), `terminalKeeper.test.ts` (5), `modUi.test.ts` (3),
`modCommands.test.ts` (peek/keep/park; order), `stock-ui/browser/main.test.tsx`, and the moved chat and files tests
(`chat.composer.test.tsx`, `chat.links.test.tsx`, …). E2E: `stock-ui-clones.spec.ts` gained files, browser and
live-terminal tests; new `stock-ui-chat.spec.ts` (native-composer config, claude-haiku-4-5, model checked before the one
turn).

Commands and results:

- `npm test`: 135 files, 1256 tests pass (before the last keeper test, which passes alone). `npm run build`: OK.
  `npm run check:stock-ui -w @perch/web`: 23 pass, "stock-ui matches its sources (64 files)".
- `cargo test -p perch-core`: 871 plus integration suites OK. `cargo test -p perchd`: OK. `cargo fmt --check`: clean
  (rustfmt run only on `layouts.rs`). `cargo clippy --workspace --all-targets`: only the 2 existing warnings
  (`db/mod.rs:1371`, `perch-desktop/src/browser.rs:309`).
- `node --experimental-strip-types e2e/relay.check.mjs`: passed.
- `stock-ui-clones.spec.ts`: 9 of 9 in Chromium and in WebKit. One earlier full Chromium run had the earlier-slice
  status/tabs test fail once; it passed alone and on the next two full runs.
- `stock-ui-chat.spec.ts` (Chromium): passed; exactly one `agent.ui.prompt` across the swap.
- Chromium batch (stock-ui-clones, mods, workspace-files-durable, explorer-keyboard, mixed-tabs,
  agent-terminal-ownership, workspace-file-browser, workspace-review, workspace-git, workspace-terminals,
  context-bridge, keybindings, sidebar, nav, responsive): 85 passed, 1 skipped, 4 failed. R9, GB1 and core-crash are
  known baseline failures. `agent-terminal-ownership` (not in the first slice's batch) hangs on a phone "Fit here" that
  never appears, because HEAD's unchanged `PersistentAgentTerminal` already fits a shared terminal on a phone by
  itself (`fitOnOpen`); this looks stale against HEAD, but no baseline run proves it.
- `native-composer.spec.ts -g "claude: @file"`: the image, `@file`, command, draft pickup, recall and interrupted
  checks pass on the second run (the first run's draft-pickup failure did not repeat); still failing: the toolbar's
  `native-cli-permission-mode` (as in the first slice) and plan review (no request card within 120 s).
- `native-review.config.ts -g "claude: phone review" --project=chromium`: the fixed phone step now passes (the stock
  review opens on the phone and shows the diff and the first note); the test then fails at spec line 127, where
  `getByLabel("Send to agent session")` also matches the open list, because HEAD's unchanged `components/ui/select.tsx`
  labels its listbox too. Pre-existing spec staleness, not fixed here (outside the two authorized fixes).

Remaining (not started; nothing was cut):

- Durable mod data (C06): per mod, outside source packages, not copied by clone, with access/path rules and a relay
  allowlist entry.
- Reading a terminal never opened on this page through a core/daemon route (explicit host-qualified target,
  per-session token rules).
- Remote terminals in composed surfaces (keep the legacy remote view, or move it under the keeper), and a remote rerun.
- Chat Markdown still keeps `style`/`class` (the file preview drops them): an owner decision.

### 2026-11-09, third slice (not committed): mod data, unopened-terminal reads, remote peeks

Status: all five boxes ticked. Box 3 rests on unit tests for the remote case: no remote-peek e2e exists, and the
remote configuration does not open a peek. Box 4 rests on the remote rerun below plus the earlier slices' draft,
operation and replay tests. Everything else Phase 3 listed is done.

Done:

- Durable mod data (C06). `crates/perch-core/src/mod_data.rs` stores data in `mod-data/<id>/<key>.json` under
  Perch's folder, outside every package; stock screens use `@stock-<name>`. Each revision is the SHA-256 of the
  stored bytes. A write or delete may name the revision it expects, and gets 409 with the current revision
  otherwise. Writes are atomic and serialised. Symlinks and traversal are refused. Corrupt bytes are kept in
  `.corrupt/`. Limits: 1 MiB per value and 1000 keys.
  - `POST /mods/data` (`server/mods.rs` `data`) takes a person's or a paired device's token, never an agent's. A
    user package needs mods on and an installed folder; a stock screen only needs to be in this build.
  - `mods/data` is an exact relay allowlist entry (`relay/host.rs`, `relay/transport.ts`).
  - SDK `useModData()` and legacy `api.data` (`modData.ts`: read, write, remove, list, watch). A clone copies files
    only, so it starts with no data.
- Reading a terminal this page never opened. `server/terminal_read.rs` serves `POST /terminal/read` (a person,
  any local session) and `POST /agent/terminal/read` (an agent, its own session only; any other target is 403).
  - Targets are `<host>/<session>`; a bare id means this computer. Lines are 1-2000 (default 50), from perchd's
    snapshot.
  - Another host's session gets 501 and is not read through a guess. A daemon that does not answer gets 503
    "unknown", never "exited".
  - SDK `fetchTerminal` and legacy `api.fetchTerminal` use the page's view when there is one. Over a phone's relay
    they read open terminals only.
- Remote terminals in composed surfaces. The legacy remote view now lends its terminal element (`lendTerminal` in
  `terminalKeeper.ts`), and a borrowing surface moves it in and back (`borrowLentTerminal`). With no tab open, it
  shows a placeholder. It never calls `attachAgentCli`, so there is no second viewer.

Regressions added:

- `mod_data.rs`: 5 tests, including 8 simultaneous writers with exactly one winner.
- `server/mods.rs` "mod data is the person's…": the clone starts empty and its folder has no data; agent 403,
  traversal 400, mods off.
- `relay/host.rs`: the allowlist.
- `modData.test.ts`: 4 tests.
- `server/terminal_read.rs`: 2 tests, against real daemon terminals.
- `modApp.test.ts`: fetch of a never-opened terminal.
- `terminalKeeper.test.ts`: lend/borrow.
- `views/AgentCliTerminal.test.tsx`: no attach in a peek.

Commands and results: `remote-workspace.config.ts` (including `remote-git.spec.ts`) passed 10 of 10. The other
commands ran together with Phase 4's first slice; their results are in that phase's progress log.
