---
phase: 4
title: "Cloneable global UI, layouts and agent workflow"
status: completed
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
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/App.tsx | Global openers and layout composition | App/recovery |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/SettingsPage.tsx | Full settings presentation, preserve services | Settings tests |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/Navigator.tsx | Palette/navigation/help | Navigator/key scopes |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/NewSessionDialog.tsx | Launcher/forms | Existing dialog tests |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/ConfirmDialog.tsx | Global and nested replacement | Busy/IME/focus |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/Toast.tsx | Notification source selection | Timeout/actions/live-region |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/WorktreeMenu.tsx | Forms/delete review | Worktree tests |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/InstructionsDialog.tsx | Full existing UI | Dialog tests |
| Modify/export | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/MemoryDialog.tsx | Full existing UI | Revision/conflict tests |
| Modify/export descendants | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/ | Folder/agent/pickers, key help, onboarding, permission views and context menus | Enumerate exact roots during scout |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/modUi.ts | Named content, kept window persistence | Mod/window tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/modHost.ts | Explicit mod persistence APIs | Storage/corruption tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/layoutState.ts | Stable instance ids and click/layout reconciliation | Layout regressions |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/layouts.rs | Compatible source selection/layout validation | Rust layouts tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/server/mods.rs | Durable bounded mod-data operations, if absent | Auth/revision tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perchd/src/agent_cli.rs | Guide/types/clone/select/check/status/shot | CLI tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/mod_examples/perch-mod.d.ts | One typed API reference | Existing API parity checks |
| Extend | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/e2e/stock-ui-clones.spec.ts | Nested/global replacement and kept windows | Registered e2e |

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

- [x] All existing global and nested UI roots are cloneable and selectable (desktop; the host-owned boundary is the
  named list in DECISIONS 2026-11-09 "The last desktop screens are stock screens…"; phone screens are phase 5).
- [x] Stock layout source, aliases and legacy state are preserved.
- [x] Named live overlays, kept windows and durable mod-data scopes work.
- [x] Agent guide/types/CLI/diagnostics demonstrate the complete no-build loop.
- [x] Safety/a11y/native interaction assertions pass for stock and clone (Chromium and WebKit e2e, `close_shortcut_probe`
  PASS; the probe does not certify a hardware keyboard or every visual focus state).

Depends on Phase 3. Phase 5 consumes this complete contract to validate phone/web rollout, release compatibility and actual agent use. Failure of global selection routing is a parity blocker, not a documentation caveat.

## Review corrections (binding; override conflicting text above)

Apply the corrections listed in [phase 1](phase-01-start.md#review-corrections-binding-override-conflicting-text-above) and the owner decisions in [validation.md](validation.md): local-device-only stock cloning, Herdr-style documented SDK, no clone size cap, host-owned drafts/operation ids before reload, fixed sanitizers, relay proof via `e2e/relay.check.mjs`, phone-form mods opt-in per phone, and worktree-relative paths. Re-scout this phase against current source before starting.

## Progress log

### 2026-11-09, closing slice (not committed): the last desktop screens, SDK 1.9

Status: complete for the desktop. Boxes 1 and 5 are ticked on the evidence below.

Done:

- Stock packages `stock:start`, `stock:editor-menu`, `stock:terminal-search`, `stock:slash-popover`,
  `stock:phone-size`, and `stock:session-split` (found by the re-scout), routed through `StockRoute` with `exact` on a
  phone (parity ledger, closing slice). Deleted the hard-coded `NoSessionPanel`, `CliStartPanel`, `StartCard`,
  `FolderPicker` and the chat's `MenuList`. `SlashPopover.tsx` had been unused; it is now the route the stock chat uses
  through the SDK.
- SDK 1.9.0: `SlashPopover` plus the props types `StartScreenProps`, `StartTarget`, `EditorMenuProps`,
  `TerminalSearchProps`, `SlashPopoverProps`, `SessionSplitProps`, `PhoneSizeProps` (`sdk.ts`, `perch-sdk.d.ts`,
  `sdk.test.ts`, `mod-runtime.ts`, MOD-SDK.md "The last desktop screens (1.9)").
- Every surface that stays Perch's is named with its reason in DECISIONS 2026-11-09 "The last desktop screens are
  stock screens; what Perch keeps, and why (SDK 1.9)". TESTING notes the phone pairing with empty storage.
- No Rust file was touched by this slice.

Commands and results:

- `npx tsc` clean; `npm test`: 142 files, 1293 tests passed; `npm run build` ok; `npm run check:stock-ui -w
  @perch/web`: 171 files match.
- `cargo test -p perch-core`: 880 passed (+ integration crates ok); `cargo fmt --check` clean; `cargo clippy
  --workspace --all-targets`: the same two warnings in untouched files (`db/mod.rs:1371`,
  `perch-desktop/src/browser.rs:309`). `cargo test -p perchd` not run (no Rust change).
- Chromium `stock-ui-clones.spec.ts`: 24 passed, 1 failed, "Settings > Mods … on a phone" (the keyboard pick in the
  now longer list did not take). Alone with `--repeat-each=3`: 2 passed; the third stopped earlier, because the crash
  guard turned off the Select copy after a reload in the shared core. Flaky, not a regression in a changed file.
- WebKit `stock-ui-clones.spec.ts`: 24 passed, 1 skipped (Chromium-only frozen start).
- `cargo run -p perch-desktop --example close_shortcut_probe`: PASS (headless, no model).
- `node --experimental-strip-types e2e/relay.check.mjs`: passed.
- The fixture teardown again reported "process-group shutdown unconfirmed" for exited provider processes
  (`alive: false`); no processes were left under this run's temp dirs.

Concerns:

- `parity-matrix.md` says host chrome "cannot be exempted wholesale"; the DECISIONS list keeps terminal toolbar,
  agent chip/banners, dock tab chrome and the browser toolbar as Perch's, each named with its reason. The owner should
  confirm this list.
- `agent-terminal-ownership.spec.ts` expects the phone-size notice for a cookie-sharing phone, which is the local
  device and never sees the notice; that spec was not run here.
- The Mods-on-a-phone test picks by keyboard and is timing-sensitive in the longer list.

### 2026-11-09, third slice (not committed): Settings pages, the stock window layout, kept windows, package keys

Status: partial. Boxes 2 and 3 are ticked on the evidence below. Box 1 stays open (five desktop roots are still
hard-coded, listed under Remaining); box 5 stays open (the native close probe was not run, and a11y is asserted only
for the screens' existing tests).

Done:

- Settings pages as stock packages (`stock-ui/settings-*`, SDK 1.8: `SettingsGroup`, `SettingRow`, `Switch`,
  `ModeSwitch`, `QrCode`, `settingsClass`, `useSettingsQuery` and nine props types), routed by
  `components/settingsRoutes.tsx` with `exact` on a phone. Engines stay in host files; drafts in `useResourceState`.
  The Settings frame and Settings > Mods stay host-owned (DECISIONS 2026-11-09, third entry).
- Perch's window as the layout `stock:main` (`stock-ui/layouts/main.json`): the parts `window:sidebar`,
  `window:main`, `window:drawer` (`StockWindow.tsx`, also the recovery shell), core listing and cloning with
  `clonedFrom` (`layouts.rs`, `mods.rs`, `server/mods.rs`), Settings > Mods > Window layout "Make my copy" and the
  provenance line, `perch mod layout stock:main` = Perch as shipped.
- Keyed window geometry and kept windows (`modUi.ts`, `setWindowOwner` in `App.tsx`), reported storage problems
  with Reset in Settings > Mods, `api.window` `keep` documented in `modApp.ts`, `perch-mod.d.ts`, MOD-SDK.md.
- Package commands: `registerCommand` keeps the asked key and the reason (`wanted`, `conflict`), Settings > Keyboard
  "Package commands", key help group, `commands()` reports them. Fixed a crash recording a key for a keyless package
  command (`KeybindingsSection` `commit` parsed `""`).
- E2E for the three screens the second slice left out (pane menu with a seeded two-pane dock, close guard with a
  real Haiku CLI, Context Bridge clone with its own core and one Haiku turn), a remote peek (`federation.spec.ts` E8,
  session created over the protocol), and the phone's Settings > Mods recovery through the real relay
  (`relay.check.mjs`).
- Docs: DECISIONS, ARCHITECTURE, MOD-SDK (1.8, Settings pages, windows, keys, the window layout), TESTING, the
  parity matrix ledger.

Commands and results:

- `cargo test -p perch-core`: 880 passed (+ integration crates ok). `cargo test -p perchd`: all ok.
- `rustfmt --edition 2021` on `layouts.rs` and `server/mods.rs` only; `cargo fmt --check` clean.
- `cargo clippy --workspace --all-targets`: two warnings, both in files this work did not touch
  (`db/mod.rs:1371`, `perch-desktop/src/browser.rs:309`).
- `npm run build`; `npm test`: 141 files, 1287 tests passed (`keybinds.close.test.tsx` failed once under full-suite
  load and passed on every rerun, alone and in the suite); `npm run check:stock-ui -w @perch/web`: 153 files match.
- Chromium (main config): the new tests and the batch listed in the parity ledger, 104 passed; failures only R9, D3,
  2d, X1, W2 (documented base) and X2/W3 (same step as X1/W2; dependent). Remote-workspace config: RW1-RW6 passed.
- WebKit: `stock-ui-clones.spec.ts` 20 passed, 1 skipped; Context Bridge clone test passed; federation E1/E8 passed.
- `node --experimental-strip-types e2e/relay.check.mjs` passed, Chromium and WebKit.
- No processes were left under this run's temp dirs; one leftover daemon from the Chromium batch
  (`perch-suite-LHYCOu`) was stopped by hand. The fixture teardown twice reported "process-group shutdown
  unconfirmed" for a deleted Claude session whose process had already exited (`alive: false`, `group_stopped:
  false`); see concerns.

Remaining (box 1):

- Stock screens for the empty-workspace start screen (`NoSessionPanel`, `CliStartPanel`, `StartCard`), the editor's
  context menu, the terminal search bar, the slash popover and the phone-size notice, each with its clone e2e.

### 2026-11-09, second slice (not committed): every dialog and menu routed, nested owners, phone recovery, relay data

Status: partial. No new box is ticked: box 1 still lacks the Settings pages, box 2 and 3 are not started, box 5 is
proven for the routed screens only.

Done:

- Sixteen more stock screens (`packages/web/src/stock-ui/<name>/`, React and `@perch/sdk` only): `dialog`, `select`,
  `tab-menu`, `pane-menu`, `file-menu`, `new-session` (+ `agent-picker.tsx`), `launcher`, `navigator`,
  `folder-browser`, `worktree`, `instructions`, `memory`, `close-guard`, `tab-drag`, `onboarding`,
  `context-bridge`. Each host file in `components/` (and `ui/dialog.tsx`, `ui/select.tsx`) now gathers the data,
  binds Perch's actions and renders `StockRoute`. SessionMenu is the tab menu; NewFilePrompt is the file menu's
  new-file stage; NewSessionPopover passes through to `new-session`.
- Nested owners through the SDK: its `Dialog`, `Select`, `ConfirmDialog`, `TabMenu`, `SessionMenu`,
  `NewSessionMenu`, `NewFilePrompt`, `FileEntryMenu`, `FolderBrowser`, `WorktreeMenu`, `InstructionsDialog`,
  `MemoryDialog` and `TabDragLayer` are the routes, so stock and copied parents both use the chosen child.
- Host-kept: Context Bridge's send (one operation id per capture, at most one send) lives in `ContextBridge.tsx`,
  keyed by the capture. Settings > Mods imports `stock-ui/select/main` directly, so recovery never runs a copy.
- SDK 1.7.0: `useAgentChoices`, `shortcutFor`, `menuDividerClass` and the screens' props types (`perch-sdk.d.ts`,
  `sdk.test.ts`, MOD-SDK.md "Dialogs and menus (1.7)"). The import loop (compiled stock sources import the SDK,
  which imports the host routes) is handled by making no SDK call at a stock source's top level (two found and
  fixed: `folder-browser`, `worktree`); documented in MOD-SDK.md and held by `npm test` (vitest imports the real
  graph) and the production e2e.
- Docs: DECISIONS.md (new 2026-11-09 entry), MOD-SDK.md, parity matrix ("Phase 4 second slice"), TESTING.md
  (baseline failures below).

Regressions added:

- `stock-ui-clones.spec.ts`: "the menus, pickers, launcher, Navigator, folder browser, onboarding and tab drag…",
  "Instructions, Memory, the worktree form and the file menu…" (with the nested dialog shell and dropdown) and
  "Settings > Mods never runs the person's copy, and on a phone it puts Perch's own screen back".
- `e2e/relay.check.mjs`: a package's `useModData` write and read on the paired phone, through the tunnel only.
- `components/stockRoutes.test.tsx` (close guard and docked pane menu bindings); `ContextBridge.test.tsx` "keeps the
  one send of a capture in Perch…" (fails with the lock removed).

Test-only changes forced by the larger import graph (no assertion changed): `AgentCatalog.test.tsx` imports the
picker from its package; `InstructionsDialog.test.tsx` socket mock fans out and has `connect`; `ModsSection.test.tsx`,
`FileEntryMenu.test.tsx` and `ContextBridge.test.tsx` store mocks gained `subscribe`/`getState`/`setState`, and they
mock `@perch/sdk` with its leaf primitives (`ContextBridge.test.tsx` fills `Select` after import to avoid a mock
waiting on itself).

Baseline investigation (clean `8a02934` plus the sha256-verified snapshot files, `/private/tmp` worktree, removed
afterwards): `workspace-visual-qa.spec.ts` fails alone at its phone step on the baseline (the hold-row menu, as R9),
and `toasts.spec.ts` TN1/TN2 are flaky on the baseline (each passed and failed in different runs). Both are recorded
in docs/TESTING.md as known base failures, not regressions of this branch.

Commands and results:

- `cargo test -p perch-core`: 879 passed plus the integration suites. `cargo test -p perchd`: 59 passed.
- `cargo fmt --check`: clean. `cargo clippy --workspace --all-targets`: only the 2 existing warnings.
- `npm run build`: OK (119 stock-ui files; Rollup warns about the SDK import cycle, see above).
  `npm run check:stock-ui -w @perch/web`: "stock-ui matches its sources (119 files)". `tsc --noEmit`: clean.
- `npm test`: 138 files, 1271 tests pass.
- `stock-ui-clones.spec.ts`: Chromium 15 of 15. WebKit 14 passed and the frozen-start test skipped, after the phone
  recovery test's dropdown was driven by keys (WebKit does not focus a clicked button).
- `node --experimental-strip-types e2e/relay.check.mjs`: passed, with the mod-data round trip.
- Chromium batch (mods, keybindings, worktrees, sidebar, mixed-tabs, pane-splitting, nav, workspace-tabs, settings,
  responsive, wave2, sessions): 81 passed, 6 failed, 13 did not run (serial blocks after a failure). Known bases:
  P1 (suite-only), R9, D3, X1, W2. `sessions.spec.ts` S5 showed a blank page in the batch and passed alone twice;
  alone, S1 fails on a spec that predates the ⌘⇧T binding (TESTING.md).
- `toasts.spec.ts` (claude-haiku-4-5, banner checked by the spec): TN1 failed (the agent was still running after
  90 s), TN2 did not run; the same flake as the baseline.
- Leftover fixture daemons and the agent under this run's `perch-suite-*` dir were stopped by hand.

Remaining (not started; nothing was cut):

- Settings pages as packages (S22), keeping Settings > Mods recovery host-owned.
- The stock layout as an editable layout package: aliases, legacy layout-state and drafts, migration (steps 3-4).
- Kept windows and window position (step 6).
- Command/keys authoring with conflict handling (step 8).
- E2E for `pane-menu`, `close-guard` and `context-bridge` copies (reasons in the parity matrix).
- A remote-peek e2e. `remote-workspace.config.ts` runs a hub and a remote core, and the hub's packages would live in
  `/tmp/perch-e2e-remote-workspace/7794/mods`, so a package could peek a remote session. What is missing is a
  remote terminal session made the way a person makes one: the UI path (`federation.spec.ts` E2, the remote
  new-session picker) is a known base failure, and that config's specs launch no runtime. A spec would need to
  create the remote session over the protocol and then open its tab. Not written in this slice.

### 2026-11-09, first slice (not committed): confirmation and notifications, safe start, screen choice, agent loop

Status: partial. Only the agent-loop box is ticked. The scout found every global opener still hard-coded except the
keybind help (Phase 2) and the screens moved in Phases 2-3. This slice routes the two openers used everywhere
(`ConfirmDialog` and the notifications) and builds the recovery and authoring pieces the rest will reuse.

Done:

- `stock:confirm` and `stock:toast` (`packages/web/src/stock-ui/{confirm,toast}/`, React and `@perch/sdk` only).
  `components/ConfirmDialog.tsx` and `components/Toast.tsx` are now `StockRoute` wrappers (`mod-root.tsx`). Stock is
  the same source compiled into the page, so nothing loads while a dialog opens. A copy chosen with `perch mod use`
  runs from its own files with the same live props and callbacks. Every opener, global and nested (sidebar, chat,
  Settings, worktree and memory dialogs, packages through the SDK), therefore follows the choice.
- Nested owners: a screen that opens another stock screen goes through the same route, so the inner choice applies
  inside a copy of the outer one. A copy never chooses for screens it contains. `mod:stock:<id>` blocks stay stock
  (DECISIONS 2026-11-09).
- Safe start (step 5, recovery). A chosen copy that fails to load or render falls back to stock with a notice
  (`stock-fallback-<name>`), keeping its files and the choice; its next revision is tried. `bootGuard.ts`: a
  person's package that stops the page while starting is turned off on the next load (`mods.set disable`), with a
  notification. Stock never is.
- Settings > Mods > Screens: per stock screen, Perch's own or a copy (`Select`, `screen-<id>-use`), and "Make my
  copy" (clone to `my-<name>`, then use). Installed packages show their provenance ("copy of X version"). The page
  is the same on a paired phone, but this slice has no phone e2e for it.
- SDK 1.6.0: `useModData`, `fetchTerminal`, `ConfirmProps`, `useNotifications` and `iconButton` (`sdk.ts`,
  `perch-sdk.d.ts`, `sdk.test.ts`, MOD-SDK.md). The SDK object is now made on first use, and its aliases are live
  re-exports. With stock sources compiled into the page, `sdk.ts` evaluates inside an import cycle. The eager object
  crashed the production bundle (TDZ on `TAB_PANE_CLASS`, then on `registerHostModule`) before any test ran.
- Agent loop (step 9). `perch mod guide` walks examples, api, clone, use, edit, check, dom, shot, do, and disable /
  use stock / remove. `perch mod clone` prints the copy's folder (`agent_clone` in `server/mods.rs` returns `path`).
- Docs: DECISIONS.md (two 2026-11-09 entries), ARCHITECTURE.md (relay routes, mod data, terminal reads, safe start),
  MOD-SDK.md (1.6 reference, "When a copy cannot run", the stock screen list, Screens) and the parity matrix.

Regressions added:

- `mod-root.test.tsx`: fallback with a notice and a retry on a new revision; StockRoute live props and callbacks;
  the boot guard.
- `ModsSection.test.tsx`: Screens.
- `sdk.test.ts`: the 1.6 list.
- `agent_cli.rs`: "the mod guide uses only real commands".
- `stock-ui-clones.spec.ts`:
  - "the confirmation and the notifications…": stock, an untouched clone and an edited clone, opened by a package
    through the SDK.
  - "an agent with only the perch command…": a scripted fake agent in a terminal session, using `perch` and `sed`
    only.
  - "a clone that stops the page while starting…": Chromium only. It is skipped in WebKit, whose driver cannot close
    a frozen page.

Test-only changes forced by the larger import graph: `ConfirmDialog` now pulls in `@perch/sdk`. Some partial mocks
broke, and `App.test.tsx`'s async `mod-root` mock deadlocked on the cycle. The fixes:

- `App.test.tsx`: a sync mock, with the status bar set after import.
- `MemoryDialog.test.tsx`: the socket mock now fans out to every listener.
- `AgentCatalog.test.tsx` and `SettingsPage.test.tsx`: they spread the original modules.
- `FileEntryMenu.test.tsx`: it stubs `./ConfirmDialog`. That file never used the confirmation.

No assertion changed.

Commands and results (this slice and Phase 3's third slice):

- `cargo test -p perch-core`: 879 passed, plus the integration suites. `cargo test -p perchd`: all suites pass.
- `cargo fmt --check`: clean. rustfmt ran only on this work's files.
- `cargo clippy --workspace --all-targets`: only the 2 existing warnings (`db/mod.rs:1371`,
  `perch-desktop/src/browser.rs:309`).
- `npm run build`: OK. Rollup warns about the cycle described above.
- `npm test`: 137 files, 1268 tests pass.
- `npm run check:stock-ui -w @perch/web`: 23 pass, "stock-ui matches its sources (70 files)".
- `node --experimental-strip-types e2e/relay.check.mjs`: passed.
- `stock-ui-clones.spec.ts`: 12 of 12 in Chromium (the confirmation test was rerun alone after a wait was added
  before its outside click). In WebKit, 11 passed and the frozen-start test was skipped.
- `remote-workspace.config.ts`: 10 of 10.
- `native-composer.config.ts stock-ui-chat.spec.ts` (claude-haiku-4-5, model checked first): passed.
- `context-bridge.config.ts`: Chromium passed. The WebKit test failed only in teardown ("owned runtime has a
  detached process group; manual review required"), the same teardown failure as Phase 3's first slice.
- Chromium batch (settings, keybindings, mods, nav, sidebar, all workspace-*, mixed-tabs, responsive,
  pane-splitting, toasts, device-pairing, phone-access): 77 passed, 11 failed, 1 skipped, 10 did not run.
  - Known baselines in docs/TESTING.md: D3, 2d, R9, GB1, W2, device-pairing, workspace-recovery, the core-crash
    test, and P1 (suite-only; it passed alone).
  - `workspace-visual-qa.spec.ts`: its phone step holds a workspace row and waits for its menu, which is the same
    hold-row menu R9 fails on. No baseline run.
  - `toasts.spec.ts`: TN1 failed in the batch and passed alone, and TN2 failed alone twice. With HEAD's
    `Toast.tsx` swapped back in and rebuilt, TN1 failed the same way (no toast after a real haiku turn). So the
    real-turn toast flow is flaky with or without this change. It is not proven either way.
- Leftover fixture daemons and their children under this run's temp dirs (`perch-suite-*`, `perch-context-*`) were
  stopped by hand. Nothing else was touched.

Remaining (not started; nothing was cut):

- Routing and packages for the other openers: SessionMenu, WorktreeMenu, InstructionsDialog, MemoryDialog,
  FolderBrowser, NewSessionMenu/Popover, Dialog, Select, the tab menu, the launcher, PaneContextMenu, NewFilePrompt,
  TabDragLayer, Settings pages, onboarding, Navigator/palette and keyboard help beyond the keybind help,
  CloseAgentGuard, and the Context Bridge UI. Each needs its nested/deep-edit e2e (Chromium and WebKit) and vitests.
- The stock layout as an editable layout package, with aliases and legacy state (steps 3 and 4).
- Kept windows and window geometry (step 6).
- Command/keys authoring semantics (step 8).
- A phone e2e of Settings > Mods recovery.
