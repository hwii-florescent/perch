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
