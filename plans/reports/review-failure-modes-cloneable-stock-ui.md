# Red-team review: failure modes in the cloneable stock UI plan

Reviewer lens: Failure Mode Analyst. Scope: `plans/261108-2212-cloneable-stock-ui/` (plan, design, parity matrix, validation, phases 1–5), checked against the working tree at `8a02934` plus its dirty files. Owner decisions are taken as fixed and not reargued: full customization parity, plain JS with no build, independent clones, desktop+web+phone, and trusted mods with full access.

Method: I read the code behind every claim below. Web paths are under `packages/web/src/` and Rust paths under `crates/perch-core/src/` unless written otherwise. Two claims were checked by running something: the exporter's comment loss (FM-14) and the React version (FM-10). Nothing was built or launched, and no tests were run.

Calibration: the author's corrections R01–R05 in `validation.md` hold up against the code (`server/mods.rs:721-742` unfiltered `state_message`, `LayoutRoot.tsx:162,184-191`, `modApp.ts:460-476` mounts the new version before cleaning up the old). Every test path the phases name exists. The findings below are gaps that R01–R05 do not cover.

## Severity summary

| ID | Severity | Area |
|---|---|---|
| FM-01 | Critical | Every reload fully remounts the module's React tree, so presentation state and busy guards are lost and mount effects run again |
| FM-02 | High | Module-scope state becomes per-revision and per-copy; Phase 3 to 5 leaves two NativeCliChat instances live in one page |
| FM-03 | High | Safe mode / mods-off removes the stock-catalog path too |
| FM-04 | High | No reachable recovery when a selected clone hangs at boot |
| FM-05 | High | The relay exit gate cannot be met with the planned commands |
| FM-06 | High | Relay phone: version skew, cold start depends on the tunnel, failed fetches stay cached |
| FM-07 | High | Nested selection can't work through static relative imports, and phase order bakes copies into clones |
| FM-08 | High | Clone, multi-file edits and snapshots are not atomic |
| FM-09 | High | Last-good retention is not pinned and doesn't survive a core restart |
| FM-10 | High | Keeping hidden-instance state conflicts with React unmount; legacy instance ids are positional |
| FM-11 | High | Agent diagnostics and commands are broadcast, first answer wins, and every screen runs the command |
| FM-12 | Medium | Layout selection is core-global; phone layouts and old peers |
| FM-13 | Medium | Negotiation lifecycle across reconnects; `mods.open` for filtered ids |
| FM-14 | Medium | The proposed esbuild emit strips every comment and `//!` header |
| FM-15 | Medium | Generated catalog drift: no PR CI, e2e runs a stale dist against the embedded catalog |
| FM-16 | Medium | The SDK surface becomes every host import that independent clones pin |
| FM-17 | Medium | The DECISIONS amendment comes after the phases that contradict it |
| FM-18 | Medium | Plan paths point at the main checkout, not the execution worktree |
| FM-19 | Medium | e2e state contamination in an order-dependent shared hub |
| FM-20 | Medium | Unrealistic exit gates (single haiku deep edit, 100-cycle memory, iOS) |
| FM-21 | Low | New Tailwind utilities in clones are silently unstyled |
| FM-22 | Low | Existing `setShared` clobbers keys across windows and shares float placement |
| FM-23 | Low | Terminal handoff: CSS timing resize and second unkept terminal |

---

## FM-01 — Critical — Each reload remounts the whole tree, losing presentation state and in-flight guards

**Evidence.**
- Each revision is a new module URL, so the exported component is a new function each time. React treats a changed element type as unmount-plus-mount. There is no Fast Refresh in a no-build runtime.
- Restoring last-good through an error boundary also force-remounts. React's captured-error path unmounts the current children before reconciling.
- `views/NativeCliChat.tsx` holds 38 hook slots in presentation:
  - `outbox` useState at :174 tracks the "sending / delivered / unconfirmed" phase.
  - `pending`, `controlling` and `stopping` at :171-173.
- Mount effects there have protocol side effects:
  - :194-218 calls `openAgentTerminal(sessionId, …, 80, 24, …)`, then `takeControl()` when unowned, then `agent.ui.get`. Cleanup calls `opened.release()`.
  - :241-251 resets `pickupChecked`/`pickedUp` (useRef) and fires `agent.ui.draft` again. `pickedUp` feeds `replaces:` on the next prompt (:301).
  - :293-299: the draft is cleared only in `settled()`, after the reply arrives.
- Busy guards are caller-owned useState passed into `ConfirmDialog` `busy` (`components/ConfirmDialog.tsx:26,43,80-93`). Owners: `components/FileEntryMenu.tsx:136`, `components/Navigator.tsx:197`, `components/WorkspaceOverview.tsx:392`.
- The design promises "Preserve focus, drafts, scroll, expansion and selected resources" (design.md §3 table). Phase 2 step 10 says "resource focus, in-flight work and persisted selections may not [reset]". No phase provides a mechanism for this.

**Failure scenarios.**
1. An agent edits the chat clone while a prompt is `sending`. On remount, `outbox` is gone. The text comes back from `loadDraftText` (still saved until settle) and Send is enabled again. The new module has a fresh `drafts` Map (FM-02), so a new `operationId` is minted and a click sends the prompt twice.
2. A worktree removal or file delete is in flight and the busy guard resets on swap, so the destructive action can be confirmed a second time.
3. Every swap releases and re-acquires the agent-terminal binding and input lease. Another viewer can take input in the gap. The draft pickup runs again with `pickedUp` reset, so text typed in the TUI can be duplicated into the next prompt.

**Proposed correction (Phase 1 contract, enforced before Phase 2):**
- Add a **swap fence**. SDK `track(promise|operation)` (and host-tracked busy state) defers committing a new generation for that instance until tracked work settles. The deferral is bounded and shows "update waiting". This is far smaller than lifting every busy flag into host state.
- State the honest preservation contract: only host-held instance state survives a swap. Phases 2 and 3 must inventory, per surface, which state moves to host-held instance state (composer outbox, draft images and operation id, rename/new-worktree form text, expansion, selection) before export.
- Mount-effect idempotence regression: across N swaps, count binding opens/releases, `takeControl`, `agent.ui.draft` and `agent.ui.get`, and assert no change of input owner. Error-boundary restore is a remount and gets the same test.
- Drop "focus/scroll preserved" unless host restoration exists for it. Otherwise list it as transient.

## FM-02 — High — Module-scope state becomes per-revision and per-copy, with dual implementations from Phase 3 to Phase 5

**Evidence.**
- Module-scope state in presentation files:
  - `views/NativeCliChat.tsx:59` `const drafts = new Map`
  - `:66` `receiptsBySession`
  - `components/WorkspaceOverview.tsx:121-122` `heldTimer` / `held` (long-press state shared by every instance)
  - `components/WorkspaceFiles.tsx:313` `let wrapPreference`
- `views/AgentPane.tsx` (which renders NativeCliChat) is used by `components/SplitCanvas.tsx`, `dockview/DockviewShell.tsx` and `components/MobilePaneShell.tsx`.
- Phase 3 exports NativeCliChat; MobilePaneShell does not migrate until Phase 5.
- `responsive.ts:23-29` switches the desktop and mobile branches by matchMedia in the same page (`App.tsx:296`).

**Failure scenario.** From Phase 3 through Phase 5, one page holds a compiled NativeCliChat (mobile branch) and a catalog NativeCliChat (desktop branch), each with its own `drafts` Map. Resizing across the breakpoint, or rotating a tablet, drops in-memory attachments and operation ids. Each revision also starts with empty Maps, which compounds FM-01.

**Proposed correction.**
- The exporter fails on top-level mutable bindings in the presentation graph (`let`, `new Map/Set/WeakMap`, mutated object literals), with an allowlist for frozen constants.
- Move such state to host modules.
- Migrate **all** callers of an exported component in the same phase, or make the remaining compiled callers render the catalog version.
- Add this to Phase 3's preconditions with a breakpoint-crossing regression.

## FM-03 — High — Safe mode / mods-off removes the stock path

**Evidence.**
- `mods.rs:47-55`: `is_off()` covers `policy.off || PERCH_MODS=off`.
- `mods.rs:162-164`: `scan` returns empty when off. `layouts.rs:708,787` behaves the same way.
- `server/mods.rs:170-175` (`agent_dom`) and `server/mods.rs:219-221` (`mod do`) require scan membership or mods-on.
- Phase 5 step 3 removes the compiled stock path for "capable clients". Design §4 says stock defaults are "verified release artifacts" but never says how they are listed or loaded under safe mode.

**Failure scenario.** Either safe mode yields no stock packages and the capable client has nothing to render, or safe mode runs the same loader and SDK. In the second case a loader or SDK regression, the most likely early failure, cannot be recovered with safe mode. Agent tooling (`mod dom`, `mod open`, `check`) also refuses to see shipped stock ids, because they are not in `mods/`.

**Proposed correction (Phase 1):**
- Safe mode means compiled stock from the web bundle with the package loader **not initialized**. The compiled stock is kept permanently; Phase 5 keeps it.
- Catalog listing is independent of user policy, and the catalog is not offered while safe mode is on.
- Agent routes are catalog-aware.
- Test recovery with a deliberately broken *loader*, not only a broken user module.

## FM-04 — High — Recovery from a hung clone at boot is unreachable

**Evidence.**
- `PERCH_MODS=off` is an environment variable read by the core (`mods.rs:53-55`), so it needs a core relaunch with that environment.
- `policy.off` is toggled in Settings > Mods (`components/SettingsPage.tsx:917`), which is inside the hung page.
- The person's terminals are inside the same webview. The phone has no CLI.
- Phase 5 step 6 proves "core-side disable plus fresh launch", but a clone that loops during boot hangs again on every launch until something outside the page disables it.

**Proposed correction (Phase 1 design, Phase 5 test):**
- A boot crash-loop marker: set "loading selection X / generation G" in storage before importing user packages, and clear it after the first commit plus an idle tick. If the marker is present at boot, skip user selections and show a recovery banner.
- A native desktop menu item "Reload without mods", handled in Rust and independent of the JS thread.
- A URL fragment (`#mods=off`) that is honored before the loader initializes, for web and the phone PWA.
- One regression per route.

## FM-05 — High — The relay gate can't be satisfied by the planned commands

**Evidence.**
- `e2e/playwright.config.ts:64-111` starts only the two direct cores (:7799 and :7800). It has no relay.
- The real relay is exercised only by `e2e/relay.check.mjs`. That check runs `wrangler dev` (:56), needs `npm install` in `relay/` and a built web app plus core, and picks WebKit through `PERCH_E2E_WEBKIT=1` (`docs/TESTING.md:411-428`).
- The Phase 1 exit ("paired relay") and Phase 5's relay rows rely on `npx playwright test stock-ui-clones.spec.ts`.

**Failure scenario.** The spec passes on direct transport while the relay allowlists (`relay/transport.ts:21`, `relay/host.rs:45,325-328`) and tunnel framing go untested. The gate is then closed on false evidence, or blocked with no route forward.

**Proposed correction.**
- Make the relay gate an extension of `e2e/relay.check.mjs`, or a sibling `e2e/relay-mods.check.mjs`. It loads a multi-file package with lazy/CSS/font/image through the tunnel, then revokes pairing and checks revision expiry.
- List its prerequisites in Phase 1 verification and make it the named exit command.

## FM-06 — High — Relay phone: version skew, tunnel-dependent first paint, sticky fetch failures

**Evidence.**
- The relay Worker serves the web bundle itself (`relay/wrangler.toml:8-10` assets `../packages/web/dist`; `relay/src/index.ts:48`). The planned catalog is embedded in the core (`stock_ui_files.rs`).
- Tunnel responses keep only content-type and content-disposition (`relay/transport.ts:118-123`), travel in 48 KiB frames (`relay/host.rs:55`), and bypass both the HTTP cache and the service worker precache (`vite.config.ts:58-66`).
- Presentation source is large: `components/*.tsx` is about 642 KB and `views/nativeChat` plus NativeCliChat about 151 KB.
- Today the phone shell, pairing and ConnectionDetails render from Worker assets with no host connection.

**Failure scenarios.**
1. When the Worker isn't redeployed with the core (the normal case after a desktop update), the phone's host SDK differs from the core's catalog.
2. Phone cold start needs hundreds of sealed round trips before first paint, and nothing renders while the host is offline.
3. One transient tunnel drop during a lazy import fails that revision URL. Module registries cache failed records per URL, so the dialog stays broken until the revision changes.

**Proposed correction.**
- Ship the byte-identical exported catalog inside the web dist, content-addressed by digest.
- The loader uses the local copy whenever the selected package's digest matches, and goes through the tunnel only for user packages.
- Add an SDK build-id handshake. On mismatch, fall back to compiled stock with a visible reason.
- Define a loader retry and registry-eviction policy for transport failures, as distinct from source errors.
- Pre-connection screens (pairing, ConnectionDetails, offline) stay compiled.

## FM-07 — High — Nested selection versus static imports; phase order bakes copies

**Evidence.**
- WorkspaceOverview statically imports `./WorktreeMenu`, `./ConfirmDialog`, `./InstructionsDialog`, `./MemoryDialog`, `./DirectoryBrowser` and `./TabSplitMenu` (its import list).
- Phase 2 exports these inside the navigation package. Phase 4 step 1 introduces the "slot-to-module selection map" afterwards.
- Parity S10, S12 and C19 require that a cloned confirm, menu or prompt reaches **nested** callers.
- `components/ui/setting-row.tsx:5` `SettingsQuery = createContext("")`. A provider in a package copy and a consumer from an SDK primitive (or the reverse) gets two context objects, so filtering silently fails with no error.

**Failure scenario.** Navigation clones made after Phase 2 (independent, never updated) carry private ConfirmDialog/WorktreeMenu copies. Selecting a confirm clone in Phase 4 never reaches them, so the parity rows fail permanently for existing user clones.

**Proposed correction (Phase 1):**
- Define selectable **roles** (confirm, prompt, menu, toast, worktree form, picker and so on) as SDK-resolved imports, for example `perch/roles/confirm`. The exporter rewrites cross-surface dialog imports to these.
- Phase 2 exports against those roles.
- The exporter classifies any module that creates or consumes a context as wholly host or wholly package, never split.

## FM-08 — High — Clone, multi-file edits and snapshots are not atomic

**Evidence.**
- `mods.rs:819` does a non-exclusive `to.exists()` check, then `copy_tree` writes straight into the final folder (`mods.rs:545`, :823-825).
- `clone_example` uses `create_dir_all` and writes file by file into the final folder (`mods.rs:863-871`).
- `server/mods.rs:786-821` rescans every 2 s and broadcasts `mods.changed`.
- Design §1.6 requires "a coherent bounded package snapshot", but it is taken from a directory that is changing.

**Failure scenarios.**
1. A clone of several hundred files is scanned half-copied, and clients load a partial graph.
2. A copy that fails leaves a partial folder, and that id is then "taken".
3. An agent writes `main.js` and then `helper.js`. A scan in between yields a *loadable but mixed* revision that commits, and its handlers run against mismatched helper contracts. That is worse than a load error.
4. Two concurrent clones race the existence check.

**Proposed correction.**
- Stage clones in a dot-temp sibling folder, then use an exclusive create and an atomic rename. The scanner ignores temp names.
- Quiescence rule: publish a revision only after its digest is identical on two consecutive scans, or after an explicit `perch mod reload` marker.
- Regressions for a half-copied clone, a two-file edit landing between scans, and concurrent clones.

## FM-09 — High — Last-good retention is unpinned and lost on core restart

**Evidence.**
- Design §1.6 bounds retained snapshots: "a vanished revision yields an explicit expired-revision failure and fresh load".
- Design §4 says to retain last-good "independently of in-memory module caches", but never says where the snapshot is stored or what pins it.
- Remote browsers and phones reconnect across core restarts.

**Failure scenarios.**
1. Agents iterate: N consecutive broken edits push the last-good out of a count-bounded store. A lazy import or asset from last-good then returns "expired". The "fresh load" goes to the newest, broken revision, so the view falls back to stock in the middle of an interaction.
2. After a core restart, live clients still run last-good R_k from memory, but every lazy request for R_k fails.

**Proposed correction.**
- Retention = a pinned set: the last-good and current revision per live instance, taken from the scoped reports in Phase 1 step 10. Unreferenced revisions go through LRU.
- Persist pinned snapshots under the core data folder, never in the source folder.
- Test: "10 broken edits, then a lazy import from last-good", and "core restart while a client holds last-good".

## FM-10 — High — Hidden-instance retention versus React unmount; positional legacy ids

**Evidence.**
- `components/LayoutRoot.tsx:162` returns null for hidden nodes, and :184-191 renders only the active stack child, without a `key`.
- The design wants hidden copies to "retain owned instance state and tracked tasks" (design §3).
- React is 19.2.8 (`package-lock.json:6882-6883`), so `<Activity mode="hidden">` is available. It keeps state and runs effect cleanups.
- With Activity, `PersistentTerminal.tsx:111-123` cleanup calls `shown.hide()`, which parks the terminal (`terminalKeeper.ts:44-48`). That is the observation rule the plan wants.
- The design says hidden instances keep *tasks* running. Under Activity, effect-owned tasks stop while hidden.
- Ids fall back to position: `child.id ?? String(index)` (:150) and `node.id ?? path` (:63,164,185).

**Failure scenarios.**
1. Without a named mechanism, an implementer either keeps hidden trees fully mounted, so terminal and GPU observation keeps running while hidden, or unmounts them and loses state.
2. For id-less legacy nodes, inserting a node shifts identities, so instance A's form draft shows up in instance B.

**Proposed correction.**
- Specify Activity as the mechanism.
- State that only host-tracked tasks survive while hidden.
- Key stack children by child id.
- Id-less nodes get transient-only instance state, never rewritten user files, and a `perch mod check` warning.

## FM-11 — High — Diagnostics and commands are broadcast, first answer wins

**Evidence.**
- `server/mods.rs:166-167`: "The first screen to answer wins".
- `handle_snapshot` overwrites by request id and silently drops answers past 16 entries (`server/mods.rs:160-163`).
- `server/mods.rs:222-231` broadcasts `ModsSnapshotRequest{command}`, and every screen runs it: `mods.ts:100-101` calls `runCommand`.
- `status` and `shot` come from whichever screen answers first (`mods.ts:81-98`).
- C13 and C14 promise an exact pane, instance and revision, but the plan never targets a viewer.

**Failure scenario.** With desktop plus phone connected, `perch mod do tab.new` or a semantic action runs on both screens. A `shot` or `check` used as acceptance evidence comes from the wrong viewer.

**Proposed correction (Phase 1 step 10 and Phase 4 step 9):**
- Add an optional target viewer to `ModsSnapshotRequest`, capability-gated. The default is the most recently focused viewer, and the request is refused when that is ambiguous.
- The answer carries the viewer and instance.
- Old clients keep their current behavior.
- Two-viewer regression.

## FM-12 — Medium — Layout selection is core-global

**Evidence.**
- `layouts.rs:835-858`: one `layout-state.json` value for the whole core.
- `App.tsx:296`: the mobile branch takes precedence over any layout.
- Phase 5 step 1 wants phone-specific layouts.
- Any client's `mods.set op=layout id=""` resets the layout for everyone.

**Failure scenario.** Choosing a desktop clone layout either applies to phones or is ignored there, and nothing in the plan defines which. Old phones read a value meant for a new form factor.

**Proposed correction.** In Phase 4, add an optional per-form-factor selection. The legacy `layout` field keeps meaning desktop. Add old/new and phone/desktop tests. Record that this changes a persisted contract.

## FM-13 — Medium — Negotiation lifecycle

**Evidence.**
- Negotiation is per WebSocket `ConnState`. Clients reconnect often, especially over relay; `terminalKeeper.ts:75-77` drops every kept terminal on disconnect.
- The client lists only after `server.info` (`mods.ts:43-45`).
- `mods.open` is broadcast to every client (`protocol.rs:2640-2641`, `mods.ts:60`), including old clients for ids they were filtered from.

**Proposed correction.**
- Accepted formats are sent on every `mods.list`, which already happens after every `server.info`. Keep that invariant and test it across reconnects.
- Filter or ignore `mods.open` for unaccepted ids.
- Test an old client and a new client on one core across a reconnect.

## FM-14 — Medium — The esbuild emit destroys readability

**Evidence.** I ran both with the repository's installed tools on a small TSX sample:
- esbuild 0.25.12 `transformSync` (tsx, automatic JSX) dropped every `//` and `/** */` comment and moved `export` to a trailing block.
- TypeScript 5.9.3 `transpileModule` kept the comments and the export placement.

Phase 1 step 3 proposes "TypeScript parsing plus esbuild syntax transform". AGENTS.md requires reading `//!` headers. In addition, esbuild is only a transitive dependency.

**Proposed correction.** Emit with `typescript.transpileModule`, which is already an explicit dependency (`packages/web/package.json:50`), and drop esbuild from the exporter. Add a snapshot test that headers and JSDoc survive the export.

## FM-15 — Medium — Generated catalog drift and dist skew

**Evidence.**
- The only workflow is `.github/workflows/release.yml`; there is no PR CI.
- The e2e webServer runs `cargo build -p perch-core` against whatever `packages/web/dist` already exists (`e2e/playwright.config.ts:76`).
- The core serves dist from disk (`boot.rs:225-256`), while the catalog is embedded in the binary.

**Failure scenario.** A TSX edit without regeneration means vitest tests the new code while e2e tests the stale catalog, so "stock and clone run identical assertions" compares different code. A stale dist against a new catalog gives SDK skew in dev and tests. Parallel worktrees conflict in the generated files.

**Proposed correction.**
- `npm test` runs `export-stock-ui --check`.
- The fixture server refuses to start on catalog drift or an SDK build-id mismatch (the same id as FM-06).
- Document regenerating after a rebase.

## FM-16 — Medium — The SDK surface equals every host import that clones pin

**Evidence.** Counting relative host imports outside `ui/`: WorkspaceOverview crosses about 22 host modules (store, closeGuard, workspaceNav, keybinds, attention, fileTabs and more), NativeCliChat about 20, SettingsPage about 18. Independent clones never update.

**Failure scenario.** Any internal refactor (a rename, a signature change) breaks old clones at module link time. Worse, a semantic drift breaks them silently. Design §Risks says "keep last-good compatible behavior", but on a fresh boot after an upgrade no last-good exists.

**Proposed correction.**
- An SDK surface snapshot test (exported names plus `.d.ts`) that forces an API version bump.
- An N-1 test: the previous release's exported catalog runs against the new SDK.
- An incompatible clone falls back to stock for that selection, with a visible reason.

## FM-17 — Medium — Decision amendment ordering

**Evidence.**
- `docs/DECISIONS.md:50-64` is the currently approved contract: slots keep stock state, and examples are not shipped defaults.
- AGENTS.md says UI changes follow approved decisions.
- The amendment is scheduled at Phase 4 step 11 and Phase 5, after Phases 1–3 have built the opposite. `design.md:22` admits approval does not yet exist.

**Proposed correction.** Get the DECISIONS amendment approved by the owner and recorded before Phase 1 starts.

## FM-18 — Medium — The plan points at the wrong checkout

**Evidence.**
- 92 absolute `/Users/hwiii/Github/perch/...` paths across the phase and plan files. Frontmatter says `branch: main`.
- The work context is the worktree `~/.perch/worktrees/perch/use-the-ak-cook-skill-…`, which holds the same dirty native-chat and sidebar files as main.

**Failure scenario.** Cook running in the worktree edits main's dirty tree through absolute paths. The worktree branch diverges from the edits.

**Proposed correction.** Use repository-relative paths and branch-qualified execution.

## FM-19 — Medium — e2e contamination in an order-dependent shared hub

**Evidence.**
- `e2e/playwright.config.ts:24-34` has an ORDER-MATTERS testMatch, one shared hub state and `workers: 1`.
- Phase 2 modifies `sidebar.spec.ts`, which is second in that order and already dirty, to select clones.
- `mods.spec.ts:19-29` shows the cleanup pattern needed (removing `layout-state.json` and so on).

**Failure scenario.** A clone or layout left behind by a failed test changes the UI under every later spec, including wave2 T4's precondition.

**Proposed correction.**
- Append `stock-ui-clones.spec.ts` at the end of testMatch, with `afterEach` cleanup copied from mods.spec.
- Keep the clone variants out of `sidebar.spec.ts`; put the parametrized stock/clone runs in the new spec.

## FM-20 — Medium — Unrealistic exit gates

**Evidence.**
- Phase 5 step 5 asks one haiku-4-5 or luna agent to deep-edit generated WorkspaceOverview (1373 TSX lines, more as `jsx()` JS), tabs, a nested dialog and chat composition, then inspect, disable and recover.
- The native-composer config allows 420 s per test (`e2e/native-composer.config.ts:5`).
- The current agent-mods verification, two much smaller turns, already had one failed command (`docs/TESTING.md:133-140`).
- Phase 1 sets a 100-cycle memory budget, but every edit re-instantiates the whole package graph because the revision is package-wide.
- The phone gate relies on Playwright WebKit, which is not the iOS app's WKWebView. The iOS probe needs a simulator GUI and live pairing environment (`docs/TESTING.md:374-384`), which conflicts with the headless and no-focus rules.

**Proposed correction.**
- Split agent acceptance into bounded, separately retried tasks, each with deterministic file and DOM assertions, plus one scripted CLI-only run proving the tooling loop.
- Use Merkle module URLs (a file's hash combined with its dependencies' hashes): graphs stay coherent and unchanged leaf modules are reused, so memory grows with what changed.
- Classify iOS app evidence explicitly as manual release sign-off.

## FM-21 — Low — New Tailwind utilities in clones

Stock source is written entirely in Tailwind utilities. An agent extending it will write new utilities, and they silently get no styles. The design acknowledges this but gives no detection.

**Correction.** `perch mod check` warns about class tokens that are not in the shipped CSS.

## FM-22 — Low — Existing shared-state clobber

**Evidence.**
- `modHost.ts:66-75` reads localStorage once and writes back the whole object, with no `storage` listener. Two windows overwrite each other's keys.
- Float placement is stored in shared (`modApp.ts:403`), which syncs presentation across windows and contradicts "never synchronize focus".

**Correction.** Phase 4 fixes this write model (per-key merge plus a storage listener, or per-viewer keys) before building durable mod data on it.

## FM-23 — Low — Terminal handoff timing

**Evidence.**
- `KeptTerminal.show` calls `fit()` (`terminalKeeper.ts:39-43`). Zero size is guarded (`xtermSetup.ts:739`), but an intermediate, pre-CSS size is not.
- `showTerminal` creates a second, unkept terminal when the existing one is still mounted (`terminalKeeper.ts:93-97`). Any commit path where the new view mounts before the old one's cleanup runs (separate roots, or staged mounts like `modApp.ts:460-476`) duplicates the attach.

**Correction.**
- Package CSS loads and applies before commit.
- ModRoot swaps within one React root and one commit.
- Assert zero PTY resizes per swap when geometry is unchanged, and one terminal view per key.

---

## Recommended plan changes, in order

1. Before Phase 1: approve and record the DECISIONS amendment (FM-17) and fix the plan's paths and branch (FM-18).
2. Phase 1 contract additions:
   - swap fence and preservation contract (FM-01)
   - exporter lints and role imports (FM-02, FM-07)
   - TypeScript emit (FM-14)
   - safe mode and boot recovery (FM-03, FM-04)
   - atomic clone and quiescent revisions (FM-08)
   - pinned retention (FM-09)
   - Activity-based hiding (FM-10)
   - viewer-targeted diagnostics (FM-11)
   - local catalog copy and SDK build-id (FM-06, FM-15)
   - the relay check as the exit command (FM-05)
3. Phase 3 precondition: NativeCliChat outbox, draft and operation id become host-owned, and all AgentPane callers migrate together (FM-01, FM-02).
4. Phase 4: per-form-factor layout selection (FM-12) and a fixed shared-state write model (FM-22).
5. Phase 5: bounded agent tasks, Merkle URLs, and explicit manual iOS sign-off (FM-20).

## Unresolved questions

- Should a code swap be deferred while work is in flight (my recommendation), or should all busy and form state be lifted into the host? The first is smaller, but it means clones may visibly lag their source.
- Does "phone" acceptance include the native iOS app shell, or only the PWA and relay in WebKit?
- Is a per-form-factor layout selection acceptable as a persisted contract change?

Status: DONE
Summary: Found 23 failure modes backed by code evidence: 1 critical, 10 high, 9 medium, 3 low. The most serious are that every reload fully remounts the React tree, which loses in-flight guards and can send a native prompt twice; safe mode and recovery are undefined once stock UI becomes packages; and the relay gate and relay-phone loading model don't hold up against the actual test harness and Worker-served bundle. The plan should not be executed until the Phase 1 contract additions above are adopted.
