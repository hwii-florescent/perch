# Capability and stock-surface parity contract

## Evidence baseline and interpretation

Herdr-app comparison: [b721deda985270ec8256552692729a4add389b2a](https://github.com/herdrdev/herdr-app/tree/b721deda985270ec8256552692729a4add389b2a), 2026-11-08. Source/guide/declarations/tests were inspected; **no Herdr runtime was exercised**. A partially stale local checkout was checked against GitHub's three-commit diff; changed guide/agents/window/layout findings use the pinned revision.

Perch source baseline is the current working tree at `8a02934e...`, including user changes. Existing tests listed below are evidence of coverage intent, not a fresh passing run. **Every delivery row is pending implementation and runtime proof.** The executor adds test id, command result, client, source/API revision and retained artifact to each row. A checkbox may close only with observable evidence.

Parity means comparable customization capability and correct Perch behavior, not identical names or unsafe Herdr semantics. Existing Perch file editing, granular review and lifecycle safeguards must not regress. No missing required row may be silently moved into a non-goal.

## Shipped-surface inventory

Herdr has 21 shipped mod folders, three layouts, two file-backed themes and five app-owned frame modules at this revision. Source notation: `M(x)` is `defaults/mods/x/main.js`; frame is `defaults/frame/x/main.js`.

| ID | Herdr source and behavior | Perch implementation graph to expose | Phase | Required regression/evidence |
|---|---|---|---|---|
| S01 | M(workspace-chrome):1–32; brand, sidebar collapse/footer | App chrome, titlebar, sidebar controls | 2,4 | Clone moves chrome/actions; native drag/window controls still work |
| S02 | M(spaces):50–89,126–181,250–301; machine/worktree/repo navigation | Sidebar + WorkspaceOverview + context/launcher descendants | 2 | Stock/clone project, host, workspace, worktree, attention and order tests |
| S03 | M(agents):76–120,212–243; grouping/pins/subagents/navigation order | Status/agent views and family/navigation helpers | 2,3 | Alter grouping/order; preserve real status, pins and nested agents |
| S04 | M(tabs):14–69; select/rename/reorder/new work | TabBar + TabSplitMenu + launcher/rename presentation | 2 | Mixed resource tabs, preview/pin, split/reorder/close/rename |
| S05 | M(pane):1–60; pane title/focus/split/zoom/close | SplitCanvas/pane chrome + PaneContextMenu | 2,3 | Deep header/actions clone; same terminal/view identity |
| S06 | M(files):41–150; tree/read-only preview/watch | WorkspaceFiles/MobileFiles, file menus/editor/preview chrome | 3,5 | Explorer keyboard, drafts/conflicts, media/search plus remote scope |
| S07 | M(changes):60–207; diff and commit | WorkspaceGitReview/Pane + review descendants | 3 | Stage/unstage, safe discard/commit previews, comments and Context Bridge |
| S08 | M(workspace-status):1–30; machine/branch/status/key hint | StatusBar + full usage/status popovers | 2 | Branch/cost/context/zoom/usage refresh/redemption unchanged |
| S09 | M(new-menu):25–71; new terminal/agent/worktree | NewSessionDialog/NewTabLauncher/AgentPicker | 2,4 | Host-qualified launch, availability, numeric/keyboard choices |
| S10 | M(menu):28–104; context actions | Tab/terminal/pane/file/editor/project context menus | 2–4 | Clone global and nested caller, focus/keyboard/outside-dismiss retained |
| S11 | M(prompt):1–31; input/select/submit/cancel | Rename/prompt/forms throughout app | 2,4 | Replacement actually selected; Enter/Escape/IME and async state |
| S12 | M(confirm):1–21; destructive confirmation | ConfirmDialog + close/delete/review confirmations | 3,4 | Busy guard, correct target/authority, cancellation/focus |
| S13 | M(help):1–34; filter/group key help | Navigator/keybinding help/palette presentation | 4 | One command table; key scopes/reserved recovery remain |
| S14 | M(toast):1–18; actions/dismiss; root toast selector | Toast and root/global notification selection | 4 | Trigger via app + api.notify; timing/live-region/action parity |
| S15 | M(peek):1–44; live terminal header/keep | Live terminal overlay + selectable peek chrome | 3 | Peek transient, keep retained, park hides, process untouched |
| S16 | M(terminals-bar):94–95; alternate titlebar/tab picker | Cloneable alternative shell and navigation composition | 2,4 | Alternative layout retains target/focus/window commands |
| S17 | M(terminals-pane):1–34; alternate pane header | Cloneable pane header/frame source | 2 | Different interactions, same semantic actions/engine |
| S18 | M(picker):37–114; search/urgency/new-work | Navigator/picker/launcher reusable presentation | 2,4 | Search, keyboard, touch, new-work and target scope |
| S19 | M(worktree):107–228; create/open/remove checkout | WorktreeMenu + operations/dialogs | 2,4 | Real shared worktree service and removal guards |
| S20 | M(machine-add):114–140; actionable machine add | Existing Settings Hosts/MachineCheck presentation | 4 | Clone existing add/probe/install/login UI; no transport rewrite |
| S21 | M(win98):1–36 + kit.js:1–120; multi-file/multi-role alternate UI/assets | Arbitrary alternate JS/CSS layouts, reusable controls, fonts/images/sounds | 1,4 | Multi-file styled alternate shell with nested roles; games themselves are not required ports |
| S22 | frame(settings/palette/welcome/feedback/whatsnew) | All corresponding existing Perch settings/onboarding/help/permissions UI | 4 | Complete source/caller inventory, selectable clones; no new feedback/updater backend |
| S23 | Perch exceeds Herdr's default terminal UI | NativeCliChat + requests/composer/history/options/attachments | 3 | Clone presentation; preserve drafts, pending sends, approvals and provider controls |
| S24 | Perch phone client has no Herdr desktop equivalent | MobileHeader/Switcher/PaneShell/Files/KeyBar | 5 | Same module contract, touch/narrow/keyboard/relay runtime evidence |

## Mod/runtime capability matrix

| ID | Herdr contract/source | Required Perch capability | Phase | Closure test |
|---|---|---|---|---|
| C01 | Guide:793–800; relative imports and gpui-kit/base | Ordinary JS relative/static/lazy/circular modules and documented shared React/UI SDK | 1 | Real browser graph plus context/React identity; no external toolchain |
| C02 | Guide:189–215; src/mods.rs:99–269 | Complete shipped-source clone, provenance, ownership, id collision/no overwrite | 1,4 | Exact unmodified package; deep edits live; upgrade leaves clone bytes intact |
| C03 | Win98 reusable kit, controls/virtual lists/editor | Reusable stock primitives and composable list/input/scroll/Markdown/editor UI | 1–4 | Source can use same primitives without copying domain or hiding whole panel |
| C04 | Guide:808–825; render_tests.rs:269–313 | Package-wide content revisions, coherent imports/assets, last-good error behavior | 1 | Helper/CSS/font edits, same-length edit, lazy old revision and broken/deleted file |
| C05 | src/window.rs:1231–1329; guide:816–821 | Ownership distinct from visibility: hidden stack/tab copies retain appropriate state; layout switch disposes owned copies | 1,3,4 | Hide/show/zoom/layout switch with lifecycle counters and correct state |
| C06 | src/mods.rs:432–529,1173–1201 | Explicit instance/mod/shared persistence, atomic writes and corruption reporting | 1,4 | Two copies/viewers, restart, conflict and corrupt-state recovery |
| C07 | Guide:888–925; lifecycle_tests.rs:187–324 | Owned tasks/timers/subscriptions, bounded cleanup, stale async suppression | 1 | Dispose/load races, cleanup throws, late completion; external effects not replayed |
| C08 | Guide:129–160; herdr.d.ts:187–237,337–369 | Real terminals inside mod-authored layout blocks/floats/overlays and mod panes among terminals | 3 | Same process and correct input/resize observer authority |
| C09 | herdr.d.ts:43–69; show/peek/keep/park/pin distinct | Equivalent explicit presentation/adoption/hide/pin controls within Perch safety model | 2,3 | Explicit target IDs and disconnected/unknown ownership; no implicit restart |
| C10 | herdr.d.ts:337–380; window/movable.rs:1–85 | Named mod/layout overlays, anchored popups, framed/frameless keyed in-app windows, kept specs/positions | 3,4 | Focus/dismiss/drag/restore/layout ownership and responsive operation |
| C11 | Guide:217–267,354–416; layout_sync.rs | Cloneable layouts, row/column/stack/sizes/dividers/floats/looks, state reconciliation | 2,4 | Source edits override changed fields; unrelated click state preserved |
| C12 | Guide:484–532; src/keys.rs | Global/layout/terminal/mod scopes, typed args/send text/passthrough, reserved reset | 2,4 | Existing key scope/native close tests plus clone command registration |
| C13 | Guide:534–651; src/mods.rs:1012–1033 | One typed command path, explicit target semantics/errors, no success-on-queue ambiguity | 2–4 | Commands act on requested pane/tab/terminal, including hidden/remote targets |
| C14 | Guide:49–72; src/main.rs:87–94; control.rs:74–169 | Guide/types/discover/clone/select/check/status/DOM/screenshot/disable workflow | 1,4,5 | Real agent with only shipped tools; exact revision/instance reported |
| C15 | Guide:928–953,1000–1018; herdr.d.ts:9–29 | Browser networking, file/process/watch and platform integration through existing capabilities | 1,4,5 | Explicit unavailable capability; no relay privilege broadening/local fallback |
| C16 | Guide:93–111; mirror.rs/mirror_sync.rs | Host-qualified shared app data with viewer-local focus and unavailable-remote refusal | 2–5 | Two viewers/remote disconnect; retain existing Perch domain ownership |
| C17 | Herdr desktop only | Desktop/WebKit/browser/direct phone/relay phone all supported | 1,5 | Registered client matrix, relative base/PWA/API skew tests |
| C18 | Guide:49–61; recovery shortcut | Responsive reset plus core-side disable/safe relaunch for hung code | 1,4,5 | Parse/render/infinite-loop disposable test, stock recovery independent |
| C19 | Root terminal_menu/toast selectors; other host routes hard-code names | Explicit clone selection for every existing Perch global/nested UI route | 2–5 | Cloned implementation invoked through ordinary app action, not test-only mount |
| C20 | herdr.d.ts:84–274; complete reactive model queries | Typed layout tree, focused resource identities and terminal inventory including agents/subagents/hidden records; legacy projections unchanged | 1,3 | List/read/act without an on-screen DOM element; host/unknown state explicit |

## Important corrections and scope boundaries

- Herdr's frame files are rewritten on startup and are not ordinary mod.clone targets; some APIs require a frame identity. Perch's full-source goal can be stronger without copying their restriction.
- Herdr's root-only effective look is documented at guide:352; node schema support is not evidence that all cascading look works. Preserve Perch's existing useful look behavior.
- A cloned Herdr layout keeps references to original mods; a clone is not automatically a deep dependency fork.
- Current Herdr toast replacement is real at this SHA; older local reports miss it.
- Same-named Perch commands currently lack some explicit-target semantics. Show/peek/keep synonyms do not prove parity.
- Herdr process resurrection, machine transport/document implementation, updater, telemetry, feedback service and bundled games are unrelated product ports, not required here. Exposing comparable mod composition/data/actions is required.
- OS-owned prompts, terminal text rendering, CodeMirror internals and native browser compositor are host primitives. Their UI composition/chrome cannot be exempted wholesale.
- Generated gpui-kit.d.ts could not be exhaustively audited under vendor/runtime policy. UI capabilities above are corroborated by guide, host integration and shipped usage/test source, not a runtime execution.
- Pinning a Herdr baseline prevents a moving target. New upstream capabilities require an explicit scope update, not silent goal drift.

## Evidence ledger at completion

For each S/C id, append: source version; exposed package and selection route; shared service/engine boundary; stock/clone test id; client/transport; result; retained redacted evidence path. Unchecked rows remain release blockers. Source inspection alone closes none.

### Phase 2 entries (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.2.0, then 1.3.0 for the sidebar)

- **S08 partial, behavior proven.** Package `stock:status` (`packages/web/src/stock-ui/status/{main,usage}.tsx`), shown through `StockView name="status"` in App's window chrome and a layout's `status` block; selection `perch mod use stock:status <id>`. Shared boundary: `useStatusLine`, `usePlanUsage`, `refreshUsage`, `redeemUsageReset` in `sdk.ts`. Tests: `StatusBar.test.tsx` (stock source, redemption confirm/timeout/correlation), `stock-ui-clones.spec.ts` "status, tabs and pane headers ... clone ... use" (stock and clone refresh send exactly one forced `usage.get`). Chromium and WebKit pass. Open: the phone keeps its own usage block (Phase 5).
- **S04 partial.** Package `stock:tabs` (`stock-ui/tabs/{main,icons}.tsx`): strip, mixed resource tabs, preview/pin, dirty, rename, drag/reorder/split, the launcher and new file. Same e2e covers stock, the clone through `use`, and a deep edit (reversed strip, extra menu button on `runCommand("tab.menu")`); `mixed-tabs.spec.ts`, `workspace-tabs.spec.ts` W1/W3+ and `pane-splitting.spec.ts` run on the stock package. Open: `TabMenu`, `NewSessionMenu`, `NewFilePrompt` and `TabDragLayer` are still host-drawn components the package places (not editable source); S10/S09 nested menus are Phase 4.
- **S05 / S17 partial.** Package `stock:pane-header` (one instance per pane, `pane-header:<id>` / `pane-corner:<id>`), SplitCanvas keeps the pane, terminal and focus. The e2e proves headers, "Show beside", expand and a deep "Linked" edit on stock and clone. Open: `PaneContextMenu` is still host-drawn.
- **C13 partial.** Typed commands take explicit ids: `tab.close {id}` (same close guard), `tab.pin`, `tab.menu {id,x,y}`, `pane.unsplit {id}`, `pane.close {id}`; an unknown id throws (`modCommands.test.ts` "acts on an explicit tab"). Sidebar rows (SDK 1.3) name theirs too: `session.open/request_close/close/move`, `project.move/rename/close`, `workspace.open/focus/rename/pin/hide/restore/files/git`, `worktree.remove/cancel/retry/dismiss`, `host.select/enable/refresh`, `folder.select`, `quickchat.new`; a missing or wrong target throws (`modCommands.test.ts` "navigation commands act on the row they name"). `session.request_close` is the same close guard as the ×. Open: remote-target behavior of these commands is proven only through the existing remote sidebar specs, not a clone on a remote host.
- **C19 partial.** Core-owned `use` map (`layout-state.json`, `mods.set op:"use"`, `perch mod use`, `mods.state.uses`), guarded (stock ids of this build, esm packages only, off/broken falls back, mods off hides it): `layouts.rs` and `server/mods.rs` tests, `mod-root.test.tsx` StockView selection, e2e above. Applies to App chrome, LayoutRoot blocks, SplitCanvas headers and Perch's keybind-help opener; `mod:stock:<id>` blocks stay stock. DockviewShell's `ModPanel` resolves `mod:stock:` through the same core-listed catalog (no change needed). The sidebar now follows it too (`StockView name="sidebar"` in App and LayoutRoot). Open: the phone's switcher renders the sidebar body compiled in and does not follow `use` (owner decision: phones keep their own screens; Phase 5).
- **S02 partial, behavior proven (SDK 1.3.0).** Package `stock:sidebar` (`stock-ui/sidebar/{main,content,overview,folders,hosts,parts,icons}.tsx`, about 1580 lines) imports only React, react-dom and `@perch/sdk`; `Sidebar.tsx` and `components/WorkspaceOverview.tsx` are gone. Data and rules live once in `navigation.ts` behind `useHosts`, `useNavigation`, `useSessionFolders`, `useAddProject`, `useAddProjectRequest`, `pickFolder`, `nestSessions`; actions are typed commands (C13). Selection: `StockView` in App and LayoutRoot, `perch mod use stock:sidebar <id>`. Tests: `StatusSidebar.test.tsx`, `WorkspaceNavigation.test.tsx`, `chromeViews.test.tsx` render the stock source unchanged but for import paths; `sidebar.spec.ts` (15/15 alone), `nav`, `mixed-tabs`, `mods`, `keybindings` run on the stock package; `stock-ui-clones.spec.ts` "the sidebar runs from its stock package" proves stock and an untouched clone through `use` give the same rows, switching, By status, row menu and Add project; a deep edit (list label, a body button on `session.open`) changes only the clone and the stock files stay byte-identical; the phone's switcher keeps the stock body. Chromium and WebKit pass. Open: host-drawn parts the package places, not editable source: `SessionMenu` (the tab menu), `WorktreeMenu`, `InstructionsDialog`, `MemoryDialog`, `FolderBrowser`, `NewSessionMenu`, `ConfirmDialog`, `Dialog`, `Select`. A clone that splits projects and agents into separate layout blocks is possible with the same hooks but not demonstrated.
- **S03 (partial here, closed in Phase 5 entries).** Status grouping (By status, In one list), attention sort, pins, nesting of sub-sessions and Quickchat order come from `useNavigation` and are arranged in the package (`overview.tsx`); unit tests above cover them on the stock source. Open: the agents views of Phase 3 (S03's second owner) and a clone that regroups agents are not proven.

### Phase 3 entries (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.4.0)

- **S07 partial, behavior proven.** Package `stock:review` (`packages/web/src/stock-ui/review/{main,review}.tsx`) imports only React and `@perch/sdk`; `components/WorkspaceGitReview.tsx` and `WorkspaceGitReviewPane.tsx` are gone. Shown through `StockView name="review"` in the Files/Git drawer (`WorkspaceTools`), a review tab (`SplitCanvas`) and a docked panel (`DockviewShell`); selection `perch mod use stock:review <id>`. Shared boundary: `useGitReview` (one `gitReviewStore` state and action set per workspace; Context Bridge Ask agent only where the host offers it); preview-before-discard/commit, versioned comments and server revisions unchanged. Tests: `components/WorkspaceGitReview.test.tsx` (7 on the stock source; two new: draft, prepared packet and send-in-flight survive a replaced view with one send), `stock-ui-clones.spec.ts` "the review runs from its stock package…" (stock and an untouched clone through `use` show the same diff and create a core-kept comment; an unsent commit message survives the swap and the return to stock; a deep edit of the clone's entry and review file changes only the clone; stock files stay byte-identical; the phone's Git pane keeps the stock source), Chromium and WebKit. `workspace-review`, `workspace-git` and `context-bridge` specs run on the stock package (results in the phase-03 progress log). Open: the files surface (S06) is not a package; the phone follows `use` only in Phase 5.
- **S23 partial (state ownership only).** Native chat's draft, retry operation id, outbox and receipts moved out of `NativeCliChat.tsx` module Maps and component state into the host's `chatComposer.ts`, which also runs the send. Tests: `chatComposer.test.ts` (5: one send while one is in flight from any copy; a refused send retried with the same id, also after a page reload; an edit gets a new id; unconfirmed never replayed; an edit typed during flight kept) and `views/NativeCliChat.composer.test.tsx` (3, the real component: a remount mid-send shows the same pending send and cannot send again; two copies share one draft and one dispatch; a reload restores text and operation id). Mutations (dropping the in-flight guard; a fresh id per send) make them fail. Open: the chat presentation is not a package yet.
- **C20 partial.** `terminalRecords`, `layoutTree`, `focusInfo`, `readTerminalAt`, `sendTerminalAt` in `modApp.ts`, exposed as `api.terminalRecords/layoutTree/focus` (legacy, `perch-mod.d.ts`) and SDK `terminals/useTerminals/readTerminal/sendToTerminal/layoutTree/focus`: every session on every known host (agents, sub-sessions, hidden ones) with `<host>/<session>` targets and `running/exited/unknown/host-unavailable`; read/send work on terminals the keeper holds off screen. Tests: `modApp.test.ts` "queries over Perch's state, without a terminal on screen" (3). Open: a terminal this page never opened cannot be read from the page (only `perch daemon read`); provider-internal subagents (transcript rosters) have no terminal and are not listed.
- **C06 partial.** `useResourceState` (SDK 1.4): host-kept, resource-keyed state shared by every copy, in memory, bounded to 512 keys; the review uses it. Durable core-backed mod data (restart, corruption reporting) remains open.

### Phase 3 entries, second slice (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.5.0)

- **S06 partial, behavior proven.** Package `stock:files` (`packages/web/src/stock-ui/files/{main,files,explorerNav}.tsx`) imports only React and `@perch/sdk`; `components/WorkspaceFiles.tsx` is gone. Shown through `StockView name="files"` in the drawer (`WorkspaceTools`, explorer), a file tab (`SplitCanvas`, editor) and a docked panel (`DockviewShell`); the phone's `MobileFiles` renders the stock source compiled in. Shared boundary: `useWorkspaceFiles` (filesystemStore's tree, drafts, versions, conflicts, previews, search, Git decorations, Ask agent) and engines `CodeEditor`, `FileAsset`, `MarkdownPreview`, `FileEntryMenu`. Tests: `WorkspaceViewers.test.tsx`, `fileDecorations.test.tsx`, `stock-ui/files/explorerNav.test.ts` on the stock source; `stock-ui-clones.spec.ts` "the files surface runs from its stock package…" (stock and an untouched clone through `use` list and open the same file; an unsaved draft survives the swap, the phone and the return to stock; a deep edit of `files.js` changes only the clone; stock files byte-identical), Chromium and WebKit. Open: phone follows `use` only in Phase 5.
- **S23 partial, behavior proven.** Package `stock:chat` (`stock-ui/chat/`, its modules moved from `views/NativeCliChat.tsx` and `views/nativeChat/`) on `@perch/sdk`: `useNativeChat` (`chatSession.ts`: subscription, terminal binding and lease, outbox reconciliation, requests, options, history, find, menus) over `chatComposer.ts`; fixed `Markdown` (`views/nativeChat/ChatMarkdown.tsx`: DOMPurify, `SafeHtml`, `perch-ui` as data, link policy) and `CopyButton`. Tests: all moved component tests, `chat.composer.test.tsx` (3), `chat.links.test.tsx` (16), `sanitizers.test.tsx` (attack inputs: script, handlers, `javascript:`/`vbscript:`/`data:` links, SVG script/onload/animate, iframe/object/embed, forms, meta refresh, `perch-ui` strings, through `Markdown` streaming and not, and `MarkdownPreview`); `stock-ui-chat.spec.ts` (claude-haiku-4-5, model checked before the turn): an untouched clone shows the same chat and unsent draft, a deep edit of `chat.js` changes only the clone, a send started in the clone and carried through a swap back to stock is dispatched once, and the phone keeps the stock chat. Chromium only (the native config has no WebKit project). Open: style/class are still allowed in chat Markdown (see DECISIONS open question).
- **S15 partial.** `terminal.peek` is a transient overlay of the session's own view (`session:<id>` layout content) whose terminal is borrowed from the keeper and returned on close; `terminal.keep` closes the peek and shows the tab; `terminal.park`/`unkeep` puts the peek away and refuses without one. Tests: `modCommands.test.ts` (peek/keep/park/unknown id), `terminalKeeper.test.ts` (4: borrow moves the same view and returns it, the origin leaving first parks on release, a split still gets its own copy, a parked one is borrowed and parked again), `stock-ui-clones.spec.ts` "a live terminal moves into a peek…" (one `.terminal__host`, the same terminal id and history, typing reaches the same shell, back in the canvas after a click outside), Chromium and WebKit. Open: a remote session's terminal (legacy view) is not kept, so its peek is a second observer.
- **C08 partial, behavior proven for local terminals.** `LayoutContent` (`components/LayoutRoot.tsx`) draws layout nodes inside mod surfaces and the SDK `Layout`, with `BorrowTerminals` so terminals move instead of copying; `session:<id>` blocks are valid in core layout files (`layouts.rs` test). Same e2e as S15 (the package `Layout` part).
- **C09 partial.** Distinct show/peek/keep/park, `terminal.pin` and persistent `terminal.order` (device-local, reported as `order`), all by explicit session id and refusing unknown ids; nothing starts or restarts. Tests: `modCommands.test.ts` (order: validation, persistence, `inAgentOrder`, records). Open: host-qualified targets for these commands (they take session ids as before).
- **C10 partial.** `api.overlay/popup/window` take `{layout, width?, height?}` validated by `surfaceLayout` (allow-listed fields; no looks, floats or backgrounds; ids per the core's `plain_id`) and give focus back on close. Tests: `modUi.test.ts` (3).
- **C20 partial (unchanged).** Reading a terminal this page never opened still needs a core/daemon route.
- **C06 partial (unchanged).** Durable core-backed mod data is still open.

### Phase 3 rest and Phase 4 first slice (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.6.0)

- **C06 durable data, behavior proven at the core and SDK.** `mod_data.rs` (per package id in `mod-data/<id>/`, outside packages; content-hash revisions, expected-revision writes and deletes with 409, atomic serialised writes, symlink and traversal refusal, corrupt bytes kept in `.corrupt/`, 1 MiB/1000-key bounds), `POST /mods/data` (person or paired device only; mods-on and installed for user packages; stock screens always), relay allowlist entry `mods/data` (exact). SDK `useModData()`, legacy `api.data` (read/write/remove/list/watch). Tests: `mod_data.rs` (5, including 8 simultaneous writers with exactly one winner), `server/mods.rs` "mod data is the person's…" (round trip, 409, a clone starts empty and its folder holds no data, agent 403, no token 401, traversal 400, unknown 404, mods off), `relay/host.rs` allowlist test, `modData.test.ts` (4). Open: no e2e round trip through the relay (the allowlist and the transport list are unit-checked).
- **C20 complete for local terminals.** `POST /terminal/read` (person, any local session) and `POST /agent/terminal/read` (own session only), host-qualified targets, 501 for another host, 503 "unknown" when the daemon does not answer; SDK `fetchTerminal`, legacy `api.fetchTerminal`. Tests: `server/terminal_read.rs` (real daemon terminals: a person reads any, an agent only its own; target parsing), `modApp.test.ts` (never-opened terminal fetched from the core, ambiguous bare id refused, remote 501 passed through). Open: a remote host's never-opened terminal (refused, not proxied).
- **S15 / C08 remote.** A peek of a remote session borrows the tab's legacy terminal element (`lendTerminal`/`borrowLentTerminal`) or shows a placeholder; it never attaches a second viewer. Tests: `terminalKeeper.test.ts` (lend/borrow, nested, withdraw while borrowed), `views/AgentCliTerminal.test.tsx` (no `attachAgentCli`).
- **S12 confirmation, behavior proven.** `stock:confirm` (`stock-ui/confirm/`); `ConfirmDialog` (Perch's callers and the SDK's) is `StockRoute name="confirm"`. Tests: existing ConfirmDialog callers' vitests, `mod-root.test.tsx` StockRoute (live props and callbacks, one api), `stock-ui-clones.spec.ts` "the confirmation and the notifications…" (opened by a package through the SDK: stock, an untouched clone through `use`, an edit to the clone's cancel label, back to stock; Escape, outside click, focus, one dialog).
- **S14 notifications, behavior proven.** `stock:toast` (`stock-ui/toast/`) on `useNotifications`; `Toast` is `StockRoute name="toast"`. Same e2e (`api.notify` card, dismiss label edited in the clone only); `Toast.test.tsx` unchanged and passing.
- **C18 safe start.** A chosen copy that fails to load or render falls back to stock with a notice (`mod-root.test.tsx`); a person's package that stops the page while starting is turned off on the next load with a notification (`bootGuard.ts`, `mod-root.test.tsx` boot guard test, `stock-ui-clones.spec.ts` "a clone that stops the page…", Chromium only: Playwright cannot close a frozen WebKit page). Recovery in Settings > Mods (Turn on/off; Screens: Perch's own or a copy, Make my copy), `ModsSection.test.tsx`.
- **C19 partial.** Every `ConfirmDialog` and the notifications follow `use`, including nested openers (sidebar, chat, packages). Still hard-coded: the menus (session, worktree, tab, pane context, new-session), instructions/memory/folder dialogs, Select, launcher, new-file prompt, tab drag layer, Settings pages, onboarding, Navigator/palette, CloseAgentGuard and Context Bridge UI.
- **Agent loop.** `perch mod guide` (clone, use, edit, check, dom, do, undo), `perch mod clone` prints the copy's folder. Tests: `agent_cli.rs` "the mod guide uses only real commands"; `stock-ui-clones.spec.ts` "an agent with only the perch command…" (a scripted agent in a terminal session uses only `perch` and `sed`: guide, examples, clone, use, check, dom, edit, check, dom, do; the window shows the edit, stock bytes unchanged).
- **S22 open.** Settings pages, onboarding and help other than keybind help are not packages yet.

### Phase 4 second slice (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.7.0)

Supersedes the "Open" notes of S02, S04, S05 and C19 above for the screens named here.

- **C19 / S04 / S05 / S09 / S10 / S13 / S18 / S19 routed, behavior proven.** Sixteen more stock screens, each a
  package on React and `@perch/sdk` only (`stock-ui/<name>/`), each opened through `StockRoute` from a thin host file
  that binds the data and Perch's actions: `dialog`, `select`, `tab-menu` (and the SDK's `SessionMenu`), `pane-menu`,
  `file-menu` (and `NewFilePrompt`), `new-session`, `launcher`, `navigator`, `folder-browser`, `worktree`,
  `instructions`, `memory`, `close-guard`, `tab-drag`, `onboarding`, `context-bridge`.
  - `stock-ui-clones.spec.ts` "the menus, pickers, launcher, Navigator, folder browser, onboarding and tab drag…":
    the tab menu, new-tab menu, launcher, Navigator, folder browser, onboarding and tab drag layer, each opened where
    Perch opens it: stock, untouched clones through `use` (the clone draws), an edit to each clone (only the clone
    carries it, stock bytes unchanged), and stock again.
  - Same spec, "Instructions, Memory, the worktree form and the file menu…": the same four steps for those, plus
    nested owners: an edited clone of `stock:dialog` is the shell of stock Instructions and of a cloned Instructions,
    and an edited clone of `stock:select` is the dropdown of the stock and the cloned worktree form.
  - Vitest: `stockRoutes.test.tsx` (close guard and docked pane menu bindings), `ContextBridge.test.tsx` (one send per
    capture stays with the host across a swapped copy), the existing tests of every moved screen, on the stock
    source.
  - Not in e2e: `pane-menu` (the docked pane menu shows only when a session's dock holds more than one panel, which
    the shell-only fixtures cannot make; the tiled panes use `stock:pane-header` and the tab menu), `close-guard`
    (needs a detected agent process, so a real agent start) and `context-bridge` (its spec needs its own core with a
    paid agent). Their bindings are unit-tested; the stock screens run in the existing `context-bridge.spec.ts`.
- **C18 recovery on a phone, behavior proven.** `stock-ui-clones.spec.ts` "Settings > Mods never runs the person's
  copy…": with an edited `stock:select` copy chosen, Settings' other dropdowns are the copy and the Screens chooser
  is Perch's own; at phone width the same page puts Perch's own back and the copy is gone everywhere.
- **C06 relay round trip, behavior proven.** `e2e/relay.check.mjs`: a package on the paired phone writes and reads
  its data (`useModData`) through the sealed tunnel, and `mods/data` is never fetched from the relay directly.
- **S22 / C10 / C13 open.** Settings pages, the stock layout as an editable layout package (aliases, legacy state,
  migration), kept windows and window position, and command/keys authoring with conflict handling.

### Phase 4 third slice (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.8.0)

Supersedes the "Not in e2e" and "S22 / C10 / C13 open" notes of the second slice.

- **S22 / C19 Settings pages, behavior proven.** Nine stock screens `settings-general`, `-appearance`, `-agents`,
  `-keyboard`, `-terminal`, `-notifications`, `-hosts`, `-devices`, `-permissions` (`stock-ui/settings-*/`, React and
  `@perch/sdk` only), opened by `components/settingsRoutes.tsx` (and `KeybindingsSection`, `AgentCatalog`,
  `MacPermissions`) through `StockRoute`; engines stay in host files (`MachineCheck.tsx` `useMachineCheck`,
  `PhoneAccess.tsx` `usePhoneAccess`). The Settings frame and Settings > Mods stay host-owned (recovery). Drafts are
  `useResourceState` keys `settings:<page>:<field>`.
  - `stock-ui-clones.spec.ts` "a Settings page runs from its stock package…": an unsaved new-host name typed in stock
    survives the swap to an untouched clone (chosen while the page is open), an edit to the clone shows at once with
    the draft, stock bytes unchanged, back to stock with the draft and nothing saved; at phone width the page is
    Perch's own while the clone is chosen.
  - Vitest `settingsRoutes.test.tsx` (8): a chosen copy gets the props and its actions reach the store and socket;
    drafts survive unmount/remount and are not saved until Save/Add; package commands with their reason; a keyless
    package command can be given a key (this caught a crash: `commit` parsed the empty built-in key `""`).
- **C11 / S01 / S16 stock layout, behavior proven.** `stock:main` (`stock-ui/layouts/main.json`, exported verbatim
  by `export-stock-ui.mjs`, listed/cloned by `layouts::stock`/`clone_stock`, `clonedFrom` recorded). Perch as
  shipped is the recovery shell `StockWindow.tsx`, drawn from the same `window:*` parts.
  - `StockWindow.test.tsx`: the shipped file names the shell's parts in its order; a copy drawn by `LayoutRoot` gives
    the same window; an edit reorders it and the drawer stays the window's.
  - `layouts.rs` tests (stock listing, clone with provenance, no clobber); `ModsSection.test.tsx` (Make my copy,
    provenance line).
  - `stock-ui-clones.spec.ts` "Perch's window is the editable layout stock:main…": `perch mod layout stock:main` is
    the shell; Make my copy writes the file (equal to the shipped tree, `clonedFrom` with its version) and uses it;
    an edit moves the drawer left of the main card live; a broken edit falls back to the shell and Settings says
    why; fixed, it is used again; an unsaved file draft survives every switch.
- **C10 keyed and kept windows, behavior proven.** `modUi.ts`: keyed geometry persisted in `perch.modWindows`
  (one value, written whole, at most 64 keys, LRU), malformed storage left untouched and reported in Settings > Mods
  with Reset; `keep` windows owned by the shown layout (`setWindowOwner` from `App.tsx`).
  - `modUi.windows.test.ts` (5): restore across a fresh module, clamping onto a smaller screen, kept ownership and
    restart, survival of package disposal, × forgets, refusals before opening, the 64-key bound, four malformed
    values left byte-identical and reported, reset.
  - `stock-ui-clones.spec.ts` "a package's keyed window comes back…": a real mouse drag and corner resize are saved;
    after a reload the kept window reopens by itself and the keyed one reopens where it was; switching to Perch as
    shipped closes the kept window and back reopens it; a package edit leaves it open; its × forgets it across a
    reload.
- **C12 package keys, behavior proven.** `keybinds.ts` `registerCommand` records `wanted`/`conflict` and never takes
  a key; `commands()` reports both.
  - `keybinds.test.ts`: reason for a plain and a taken key, the built-in keeps its key, removal on release.
  - `stock-ui-clones.spec.ts` "a package's command shows in Settings > Keyboard…": `mod+b` (Toggle sidebar's) is shown
    "Not set" with the reason; a key recorded on the row runs the command; removing the package removes the row.
- **C19 the three screens left out of e2e, behavior proven.**
  - `stock-ui-clones.spec.ts` "the docked pane menu…": a two-pane dock seeded through `session.layout.set`; stock,
    an untouched clone and stock again rename the pane through the menu; an edit marks only the clone.
  - Same spec, "the close-agent warning…": a real Claude CLI (Haiku 4.5 banner checked, never prompted); stock and
    the clone warn and Cancel keeps it; the edited clone's Stop ends the session and leaves the warning setting on.
  - `context-bridge.spec.ts` "the Ask agent dialog runs from its stock package…" (own core): stock and an untouched
    clone prepare the same editor capture and send nothing on Cancel; an edit shows only in the clone; through the
    clone one Haiku turn is delivered exactly once (`prompt_operations` delivered = 1); stock again.
- **C13 / C09 remote target, behavior proven.** `federation.spec.ts` E8: a remote Claude session created over the
  protocol (store `session.create` with the host, banner checked, never prompted) is peeked by a package through
  `terminal.peek`: the same xterm element moves into the peek and back (one xterm on the page), and nothing stops.
- **C18 phone recovery through the relay, behavior proven.** `e2e/relay.check.mjs`: with an edited `stock:select`
  copy chosen by the core, the paired phone's Settings > Mods (through the sealed tunnel) shows Perch's own
  dropdown, says "Showing your…", and choosing Perch's own clears `uses["stock:select"]` on the core.
- **Runs (this slice).** Chromium: the new tests, the whole `stock-ui-clones.spec.ts`, and `mods`, `keybindings`,
  `settings`, `sidebar`, `nav`, `mixed-tabs`, `workspace-tabs`, `responsive`, `phone-access`, `wave2`, `worktrees`,
  `theme`: 104 passed; failures only the documented base ones (R9, D3, 2d, X1, W2) and X2/W3, which fail at the same
  step as X1/W2 (W3 reads W2's saved split; X2 opens the split X1 cannot). WebKit: `stock-ui-clones.spec.ts` 20
  passed, 1 skipped (Chromium-only frozen start); `context-bridge` clone test; `federation.spec.ts` E1/E8; relay
  check. Not run: `close_shortcut_probe`, the whole `context-bridge.spec.ts` stock test (paid; unchanged code).
- **Still hard-coded at the end of this slice:** the five screens the closing slice below converts.

### Phase 4 closing slice (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.9.0)

Supersedes the third slice's "Still hard-coded" note.

- **C19 the last desktop screens, behavior proven.** Six new stock packages (React and `@perch/sdk` only, no SDK call
  at a source's top level): `stock:start` (`stock-ui/start/`, the empty-workspace start screen: connecting, home,
  workspace and CLI kinds; replaces `NoSessionPanel`, `CliStartPanel`, `StartCard`, `FolderPicker`),
  `stock:editor-menu`, `stock:terminal-search`, `stock:slash-popover` (also exported to the SDK as `SlashPopover`, which
  the stock chat uses, so a chat copy keeps the composer's menu), `stock:phone-size` and `stock:session-split` (the
  "Split with session" picker, found by the re-scout). Host routes: `components/StartScreen.tsx`,
  `EditorContextMenu.tsx` (`editorMenuProps` binds the CodeMirror commands), `TerminalSearchBar.tsx`,
  `SlashPopover.tsx`, `PhoneSizeNotice.tsx`, `dockview/SessionSplitPopover.tsx`; a phone keeps Perch's own (`exact`).
  - Vitest `desktopRoutes.test.tsx` (6): start kinds, actions and `exact` on a phone; the editor menu's undo,
    select-all, focus return and Ask agent against a real CodeMirror view; the find bar routes only when open; slash
    and phone-size props pass through; the stock slash popover keeps composer focus on mousedown; the split picker
    picks by id and ignores an unknown one. `stock-ui/start/card.test.tsx` and `StartFolder.test.tsx` (moved).
  - `stock-ui-clones.spec.ts`, each stock, an untouched clone (identical), an edited clone (only the clone changes),
    stock again: "the start screen, the editor menu and the terminal's find bar…" (the find bar types into its own
    input, the terminal keeps its text and input); "the phone-size notice…" (a phone paired through Settings > Devices
    with its own empty storage, so it is not the local device, takes the size; the device is revoked after); "Split
    with session…" (seeded two-pane dock; the edited clone's pick adds the session tab); "the slash popover…" (a real
    Claude CLI, Haiku 4.5 banner checked, never sent: `/` opens the menu, arrows move `aria-activedescendant`, a click
    puts the command in the composer, focus stays in the composer).
- **Host-owned boundary, by decision.** DECISIONS "2026-11-09 — The last desktop screens are stock screens; what
  Perch keeps, and why (SDK 1.9)" lists every remaining Perch-drawn surface with its reason: recovery and trust
  (pairing gate, connection details, Settings frame, Settings > Mods, mod-root/ModView/LayoutRoot notices, ModOverlay,
  StockWindow toggles), terminal authority chrome (PersistentTerminal toolbar, agent control chip and banners,
  TerminalSuggestions), engines (dockview tab and group header actions, the browser toolbar, file viewers), composed
  screens (MacPermissionSetup = `stock:dialog` + `stock:settings-permissions`), placeholders, and the phone's own
  screens (phase 5). This narrows the "cannot be exempted wholesale" line above to a named list; see open question
  in phase 4's log.
- **Runs (this slice).** Chromium `stock-ui-clones.spec.ts`: 24 passed, 1 failed ("Settings > Mods … on a phone",
  keyboard pick in the longer list; passed alone, 2 of 3 with `--repeat-each=3`, the third stopped earlier on the crash
  guard from a reload in a shared core). WebKit `stock-ui-clones.spec.ts`: 24 passed, 1 skipped (Chromium-only frozen
  start). `close_shortcut_probe`: PASS. Relay check passed.

### Phase 5 entries (2026-11-09, uncommitted working tree on `8a02934`, SDK 1.10.0)

Supersedes the "Terminal authority" and "Engines" items of the closing slice for the screens named here, and every
"phone keeps its own / Phase 5" note above. Tests named below are in `e2e/stock-ui-clones.spec.ts` unless another
file is given. Results of each run are in the "Runs" bullet at the end; a row counts as closed only with a pass there.

- **Row walk.** Every row now has a cloneable package with a stock/clone/edit regression, or a named host-owned part
  listed in DECISIONS 2026-11-09 "Terminal and dock chrome…" (needs owner acceptance):
  - S01, S16, S21, C11: `stock:main` layout and the multi-file package tests ("a package of ES modules…", "a
    package's CSS and assets…", "Perch's window is the editable layout stock:main…").
  - S02, S03, S04, S05, S17, S08: sidebar, tabs, pane headers, status tests (Phase 2). S03's agent regrouping: see
    the closing entry below.
  - S06, S07, S23: files, review, chat (Phase 3), with `stock:mobile-files` for the phone.
  - S09, S10, S11, S12, S13, S14, S18, S19, S20, S22: Phase 4 tests (menus, dialogs, Navigator, worktree form,
    Settings pages including Hosts' add/check).
  - S15, C08, C09: peek tests (Phase 3) and federation E8.
  - **S24 phone, new.** `stock:mobile-header`, `-switcher`, `-panes`, `-files`, `-keys`. Test "a phone runs the
    person's copy only on its own screens and only once turned on there…": a desktop never runs them; a phone paired
    through Settings > Devices with its own storage shows Perch's own until "Phone screens from my packages" is on,
    then each of the five copies (marked roots) and not the computer's `stock:status` copy; the choice survives a
    reload, off puts Perch's own back at once, and a revoked pairing shows the pairing gate and forgets the choice.
    `relay.check.mjs`: the same opt-in through the real relay, the phone's header package and its data load through
    the sealed tunnel, and the desktop's choice of a desktop screen is never run there. `ModsSection.test.tsx`
    covers the switch and the per-device wording.
  - **Terminal and dock chrome, new (C19).** `stock:terminal-toolbar`, `stock:dock-tab`, `stock:dock-actions`: "the
    shell toolbar and the dock's tabs and group buttons…" (stock, untouched clone, edited clone, stock: the tab menu
    renames, "Shell running", New shell adds a tab, the group's + adds a tab; the copies import only React,
    react-dom, `@perch/sdk` and their own files). `stock:browser-toolbar`: "the browser toolbar runs from its stock
    package…" (the typed address and its "Search for" suggestion survive the swap; Escape keeps the draft).
    `stock:agent-control`: "the agent terminal's chip…" (two views of one agent without shared typing: each takes
    control from the chip in turn, Perch moves the input lease, the other view's chip says "Another view is typing";
    stock, clone, edited clone, stock; stock bytes unchanged) and `stock-ui/agent-control/main.test.tsx` (the
    error line, exited and sleeping banners, Restart, Resume and Close on the stock source).
  - C01, C03, C04, C05, C07: Phase 1 package/runtime tests and the 100-edit test below.
  - **C02 upgrade, new.** "a customized copy survives a newer Perch…": a second core serves a web build whose
    `stock:status` is 9.1.0 (temporary copy, catalog revision recomputed with the exporter's `packageDigest`);
    Settings > Mods names the newer stock version and the copy's bytes are unchanged; a copy whose `api` is `^2`
    shows Perch's own with the range and version in the screen and in Settings > Mods; fixing the range runs the copy
    again. `mod-root.test.tsx` "shows stock, with the range…" (a mutation that kept the last good revision fails it).
    Provenance and the source-agnostic manifest (id, publisher, version, api, `installedFrom` with `sha256:`) are
    `server/mods.rs` tests; no registry exists (future plan).
  - C06, C10, C12, C13, C20: Phase 3/4 entries; C06's relay data round trip is in `relay.check.mjs`.
  - C14 agent flow: the scripted-agent test ("an agent with only the perch command…") and, new,
    `agent-mods.spec.ts` "an agent with only perch mod guide and the CLI copies Perch's status bar…" (claude-haiku-4-5,
    banner checked; stage 1 clone/use/check/dom, stage 2 a button that opens Settings through `runCommand`; stock
    bytes unchanged, only allowed imports). The full deep edit: see the closing entry below.
  - C15, C16: unchanged; local-only cloning (owner decision), remote screens stay Perch's own.
  - **C17 clients and versions, new.** Older page: `mods.list` without `accepts: ["esm"]` gets no packages
    (`server/mods.rs`). Older core: Settings > Mods says the computer's Perch is older and shows Perch's own
    (`ModsSection.test.tsx`). Page SDK vs. copy range: the C02 fallback. WebKit and relay runs below.
  - **C18 recovery, new.** `PERCH_MODS=off`: "a core started with PERCH_MODS=off…" (stock shown though a copy is
    chosen, `use` refused, Settings > Mods says so). Hung start: "a clone that stops the page…" plus the `pagehide`
    fix (a normal reload mid-start no longer counts as a freeze; `mod-root.test.tsx`, mutation-checked). Phone
    recovery: the phone opt-in test (off, revoke) and Settings > Mods on a phone (now deterministic: the keyboard
    pick waits for `aria-activedescendant`). Snapshot retention: `RETAINED_SNAPSHOTS = 4`, `server/mods.rs` test.
- **Module cache ceiling.** "100 edits of a package…": `MODULE-CACHE {"edits":100,"before":{"modules":3,"styles":1},
  "after":{"modules":303,"styles":1}}` (heap unchanged at Chromium's coarse 17.1 MB). The loader (es-module-shims
  registry) keeps every revision's modules for the page's life: growth is linear, one copy of the package's files
  per edited revision (3 here), styles stay one, one view. A reload clears it (asserted). Ceiling: bounded by edits
  per page session times package size; the response is to reload (no eviction API in the loader). Accepted for
  authoring; not a release blocker for normal use, where edits are rare.
- **Runs (2026-11-09).** Chromium, 12 specs: 97 passed; failures only documented base ones (R9, D3, W2, P1), the
  held-row step of `paired-phone-flows` (same menu as R9), and two test races fixed and rerun green (`mods` `hc`, the
  phone opt-in revoke). WebKit `stock-ui-clones.spec.ts`: 30 passed, 1 skipped, the start/editor/find test failed
  in the suite and passed twice alone after a test-race fix. Relay check: Chromium and WebKit passed. Real Haiku
  agent-only test: passed on the fourth run, after a guide fix (the first three wrote `api.run` from the single-file
  mod types). Full commands in the phase-05 progress log.
- **Still open (release blockers per this ledger):** owner acceptance of the host-owned list; fault injection
  (phase 5 step 6) and the 100-edit draft/terminal counters (step 7). S03, C14, C17 and phase 2 closed below; fault
  injection and the counters closed in the last entry.

### Closing entry (2026-11-09, uncommitted, SDK 1.10.1)

- **S03 closed.** `stock-ui-clones.spec.ts` "a sidebar copy regroups the sessions by agent, then project, with pins
  first and its own key order…": a copy adds `agents.js` and a "By agent" organize choice; agent > project > session,
  pins first (`terminal.pin`; SDK 1.10.1 redraws `useTerminals` on pins and order), the copy's own Up/Down order,
  each row keeps Perch's status dot, click switch, right-click and touch-hold menu; stock bytes unchanged. Chromium and
  WebKit pass. The agents views of Phase 3 are the chat/agent-control packages already in the ledger.
- **C14 closed.** `agent-mods.spec.ts` "an agent with only perch mod guide and the CLI regroups a sidebar copy by
  agent…" (`-c native-composer.config.ts`, claude-haiku-4-5, banner checked): four staged turns, sidebar regroup,
  fold by click/Enter/touch, nested dialog shell, chat composition; per stage the agent's saved `perch mod check` and
  `dom`, stock bytes and imports are asserted. Two passes (one needed two follow-up turns for stage 3's dom output).
  Disable/recover is covered by C18, not by the agent run.
- **C17 closed.** "under a proxy base path the stock screens and a person's copy load from that path; the service
  worker precaches…": base-path scope, every request under the base, `stock-ui/` precached and never
  `mods/package`/`mods/data`, offline stock (Chromium fetch, WebKit cache lookup), no stale copy, a newer build's
  stock screen and catalog after the worker's update. Phone: packages `no-store`, none cached, 401/403 after revoke.
- **Runs.** Chromium `stock-ui-clones` 34/34; WebKit 33 passed, 1 skipped; relay check Chromium and WebKit; the
  existing-spec matrix on stock 58 passed and on untouched clones 57 passed with the same base failures (phase 2
  log); commands in the phase 5 progress log.

### Fault injection and long-run counters (2026-11-09, uncommitted, SDK 1.10.1)

- **C04 / C06 / C07 / C08 faults, behavior proven.** `stock-ui-clones.spec.ts`: "a package that cannot load keeps its last good
  view…" (missing module, CSS naming a missing file, malformed JSON, a revision the core dropped mid-load: 410 then the
  newest loads), "a package's throwing cleanups are reported when it is replaced or closed…", "an expired revision
  says so…", "a core restart in the middle of a swap…" (same shell PID; the terminal id changes), "blocked storage and
  bad mod data…". Relay: `relay.check.mjs` cuts the phone's relay mid-fetch of a 60-file revision. Each fault shows a
  readable error, keeps the last good view or stock, reports no success for the bad revision, and loses no draft or
  shell. Fixes found by them: guarded package effect cleanups (`packageReact`), `PackageUnavailable` retry with fresh
  module URLs, the "last working version" note only when one is showing.
- **C07 / C08 counters, measured.** "100 edit cycles of a package that holds a live terminal…" `EDIT-CYCLES` at 0/25/50/75/100:
  mounted 1, commands 1, own and data-watch timers one each, object URLs 1, styles 1, terminals 1, xterms 1, intervals
  4, heap 18.2 MB flat (Chromium, coarse); loader modules 4 → 404, 4 per edit until reload (the ceiling, as in the
  module-cache entry). Draft and shell PID kept; tracked operations ran once each; 101 revisions rendered, none failed.
- **Not covered:** a throwing class `componentWillUnmount`; core snapshot bytes (bounded by count, 4 per package);
  native-chat pending operations (vitest only); no retry of a failed stock catalog fetch.
- **Runs.** Chromium `stock-ui-clones` 40/40; WebKit 39 passed, 1 skipped (after blocking the service worker in the two request-holding tests); relay check Chromium and WebKit.
