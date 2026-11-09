# Cloneable stock UI: architecture and outcome contract

## Outcome

An agent can clone the actual shipped Perch interface source, deeply change its hierarchy, grouping, interactions, menus, dialogs and appearance, and immediately run the copy with its existing functionality intact. Deliver the complete Herdr-app customization surface across desktop, browser and paired phone, not merely a sidebar proof. Preserve Perch's project/workspace/session semantics and all existing functions.

## Confirmed constraints and non-goals

- Owner confirmed full **customization** parity, not unrelated Herdr product/runtime parity; plain JavaScript with no user build/compiler; independent user-owned copies; desktop/web/phone completion.
- React/Tauri, Rust core authority, existing daemon and remote identities remain. Do not add a second session, file, Git, provider or lifecycle implementation.
- Trusted mods retain the approved full-access model. This is not a sandbox, approval-system redesign, marketplace or automatic package installer.
- No GPUI migration, automatic upstream merge, package-manager consolidation or unrelated machine transport rewrite. Existing mods/slots/layouts/settings/drafts remain compatible.
- Bootstrap, authenticated transport, recovery, terminal/input/resize authority, durable file saves and provider-operation reconciliation are host responsibilities. Their presentation remains replaceable where relevant.
- Planning only in this delivery. Do not implement while authoring the plan. Existing dirty and untracked native-chat/sidebar work is baseline input, not disposable work.

## Evidence and current gaps

Perch baseline: working tree at `8a02934e9b3b7743f6377cb41ce6dedfd1cb1807`, including dirty files. Re-scout before each execution phase. Herdr comparison baseline: `herdrdev/herdr-app` commit `b721deda985270ec8256552692729a4add389b2a` (2026-11-08T21:25:59Z). The old local `/tmp/perch-herdr-app-reference` checkout is `7fe7ac34...`; never silently mix its lines with current sources. Neither source inspection nor the earlier parity report proves runtime parity.

| Evidence | Consequence |
|---|---|
| `docs/DECISIONS.md:50–64` | Current stock UI deliberately is not mods; clone examples are not stock source. This plan proposes superseding that choice, not claiming approval already exists. |
| `components/LayoutRoot.tsx:28–44`, `App.tsx:297–381` | Custom layout blocks coexist with compiled stock blocks; global dialogs and mobile have separate paths. |
| `Sidebar.tsx:841–937`, `components/WorkspaceOverview.tsx:329–658` | The usual sidebar is WorkspaceOverview, including ordering, attention, instructions/memory, host actions and worktrees. Legacy row slots miss it. |
| `modApp.ts:419–490`, `components/ModView.tsx:10–25` | One blob-imported imperative entry; no stock-size source graph, React error boundary or ordering fence for overlapping reloads. |
| `mods.rs:185–194`, `:396–418`, `:752–879` | Revision tracks manifest/entry metadata, source serves one JS entry, and examples/installed folders are cloneable. Reuse authorization, confinement and no-overwrite behavior. |
| `relay/transport.ts:21,80–88`, Rust `relay/host.rs:45,325–328` | `mods/file` is absent from both relay allowlists. The loader's relay helper is not proof that mods reach a paired relay phone. |
| `vite.config.ts:24–26`, `styles/index.css` | Tailwind generates CSS at release build; new utility strings written later do not generate styles. |
| `terminalKeeper.ts:1–10,65–115`, `SplitCanvas.tsx:25–47`, `surfaceSync.ts:1–18` | Presentation replacement must not duplicate or discard resource engines, terminal views, resize authority, drafts or synchronization. |
| `modHost.ts:65–89`, `viewer.ts:1–20` | Current shared mod state is browser-local; viewer identity already exists. Do not accidentally synchronize focus or use a module-global singleton as per-panel state. |
| `server/mod.rs:283`, `server/mods.rs:140–150` | Current load reports are keyed only by mod id. A second instance/viewer can overwrite another instance's error. |

All web paths above are under `packages/web/src/`; Rust paths are under `crates/perch-core/src/`.

## Trade-offs

| Approach | Load-bearing assumption | First failure condition | Decision |
|---|---|---|---|
| Continue small rendering slots | Requests stay local to one drawing | Changing an entire sidebar hierarchy or its behavior requires more host changes | Reject as the final architecture; preserve slots for compatibility. |
| Runtime JSX/TSX compiler or user build/watch | Compiler and deployment complexity is worth JSX authoring | Node/compiler setup or graph compilation becomes necessary to make a small live edit | User chose plain JS/no build instead. |
| Readable JS source packages with shared host React/services | Exported source owns the complete presentation graph and uses an adequate shared host API | A clone is only a wrapper around opaque stock code, or source export silently bundles a second React/service instance | Choose; make both conditions mechanical test failures. |
| GPUI plus scripted UI bridge | Native rendering itself solves a measured product problem worth migration | Recreating existing editor/terminal/browser/phone behavior dominates customization delivery | Not justified by this requirement; keep a native migration outside this plan. |

## Better approaches

**Release-time source export is better than manually rewriting all TSX as JavaScript.** The repository already has TypeScript, Vite/esbuild and shared React. Export readable, unminified per-file ESM JavaScript from the real stock presentation graph, preserving component boundaries and rewriting only declared host imports. Both stock and clones execute those exported files through the same loader. This keeps TSX maintenance and existing tests, avoids a runtime compiler/user build, and eliminates a second hand-maintained stock implementation. Cost: one explicit source-export step and dependency-boundary tests. Exported JS is editable implementation, not a wrapper, minified application bundle or source-map-only fiction.

## Target structure

```text
Repository TSX presentation + selected shared UI primitives
             | release/test source export (no user toolchain)
             v
Readable versioned JS modules + CSS/assets + typed SDK reference
             | embedded in core / same artifacts in desktop and web releases
             +---- shipped defaults (replaceable)
             +---- clone -> user folder (never overwritten)
                             |
              one package loader + one React host + one API contract
                             |
        layouts / panes / menus / dialogs / mobile composition
                             |
              existing stores/controllers/protocol adapters
                             |
                Rust core -> perchd / remote cores
```

Recovery is outside this replaceable graph. Resource engines are shared, not cloned. The implementation may organize source roots differently after the phase scout; that cannot change these boundaries.

## 1. Source, package and module resolution

1. Maintain one list of shipped UI roots and host-boundary exports. Build the reachable **presentation** graph, including nested views, menus, dialogs and presentation helpers; exclude test files, bootstrap, service singletons and OS/transport adapters. Fail exports on undeclared crossings instead of copying the whole app.
2. Export plain ESM `.js`, original symbol names, readable formatting, ordinary relative imports, CSS/assets and types. Do not minify or bundle React/domain services into a clone. Use the installed esbuild version through an explicit dev dependency if imported by the export script; do not rely on an accidental transitive executable.
3. Ship those exact files with headless core as well as desktop. The release exporter generates committed readable files under `crates/perch-core/src/stock_ui/` and a small `stock_ui_files.rs` include manifest. Rust embeds them with standard `include_bytes!`; no new Rust asset crate, build.rs, runtime Node or ignored `web/dist` input is needed. Generated files are never hand-maintained; the exporter has a deterministic `--check` gate against the current TSX sources. This is generated duplication, not a second authored implementation. Headless core and desktop use the same embedded catalog. Keep shipped packages immutable in the catalog instead of rewriting user folders on startup; cloning copies from that catalog.
4. `mod.json` gains optional format/API/origin metadata. Existing `(el, api) => cleanup?` entries remain the default legacy format; a React package explicitly opts in. A clone records shipped source id/version and required API, not copied credentials or machine-specific data.
5. Existing `perch mod clone` copies the complete shipped package, or a user package, with no-overwrite/validated-id behavior. Cloning is not automatic activation. Give an explicit command to select the clone in a named layout or replacement mapping. No id collision between defaults, examples and user code may silently shadow another source.
6. Package revision is a content digest of canonical relative paths and file bytes, including all JS/CSS/assets. Read a coherent bounded package snapshot and serve all graph requests from that revision. Do not read a new disk file under an old revision URL. Bound file count, individual/total bytes, path depth and retained snapshots; tests specify the selected constants. A vanished revision yields an explicit expired-revision failure and fresh load, not mixed bytes.
7. Use a production ESM loader, provisionally **es-module-shims in shim mode**, to handle local graphs, cycles, lazy imports, import.meta URLs and a shared `perch` SDK. Its fetch hook must use Perch's authenticated fetch/relay path for every module. Existing native browser imports do not honor a monkey-patched window.fetch. Do not write a regex import rewriter or a custom JS bundler.
8. Justification for this one runtime dependency: multiple native import maps are not supported across all current WKWebView versions, and native imports cannot directly traverse Perch's encrypted relay. `es-module-shims` documents shim-mode fetch hooks, cycles and dynamic imports. Pin and test a stable version; do not copy upstream benchmark numbers as Perch performance evidence. Prove the dependency works through the actual Vite/CSP/worker path before committing to the architecture.
9. Only relative package imports and declared `perch` SDK modules are a supported dependency contract. No automatic npm/CDN install. Trusted code can still use normal browser APIs; this is compatibility discipline, not a security boundary. Explicit asset helpers fetch the selected package/revision and manage object URLs, including CSS image/font references over relay. Document unsupported import forms as actionable errors.
10. Styles are ordinary editable CSS plus existing tokens/primitives. New Tailwind utility names are not runtime-generated. Keep stock generated CSS available and export additional package styles. Give styles a lifecycle, stable root selectors and deliberate global-style opt-in; do not promise CSS isolation in a trusted same-page model. Do not introduce Shadow DOM across existing terminal/drag/native-browser selectors without proven need.

### Concrete package shape (proposed contract)

```text
mods/my-navigation/
  mod.json       # format: react; entry: main.js; API range; cloned-from provenance
  main.js        # readable exported component implementation, editable directly
  project-row.js # ordinary relative import, editable directly
  style.css      # ordinary CSS, no runtime Tailwind compiler
  assets/        # optional images/fonts/sounds
```

The React entry exports a component; the host supplies layout props plus an instance/API context. Legacy entries keep `(el, api) => cleanup?`. The SDK exports React hooks, `createElement` (optionally aliased `h`), existing primitives and shared semantic services; it does not expose only a compiled `StockSidebar`. Generated entry JS and all local descendants are the actual executable implementation. Do not include editable-looking TSX files whose changes have no runtime effect.

## 2. Shared React and host API

- Expose the host's actual React/ReactDOM instance and reusable UI primitives through a fixed SDK bridge. Test referential identity and hooks under stock, clone, portal and legacy formats. Importing React twice, once through the native graph and once through a shim graph, must fail the test.
- Reuse existing stores, selectors, commands, `workspaceNav`, filesystem/Git/native-UI transports and native adapters. Give stock source and clones the same documented convenience API. Keep existing raw `api.store`/`socket` compatibility; do not pretend they are a sandbox or silently revoke access.
- Share semantic actions and protocol-sensitive operations; keep view-local organization, event handling, drag/keyboard policy, filtering, forms and menus in editable source. Do not conceal all useful behavior in a giant compiled `useSidebarController()`.
- Extract only ownership-sensitive controllers now embedded in presentation, especially native chat send/control reconciliation and resource attachment. A shared operation must have one owner, not one per sidebar, clone or render.
- Existing `Slot` consumers remain working. A slot is no longer the primary route to customize a whole stock surface.
- Add documented complete data queries where the current convenience API is narrower: a layout tree in addition to the existing layout name; host-qualified focused resource/pane/terminal identities; and terminal inventory including agents/subagents, hidden/off-screen terminals, labels and ownership/availability. Keep legacy `layout()`/`terminals()` behavior compatible. Explicit-target read/send/actions must use canonical services rather than requiring an on-screen DOM element; unsupported remote visibility is reported, never invented.
- Existing `components/ui/` exports include style functions/constants as well as real React controls; do not assume there is a pre-existing complete component library. Reuse both kinds through explicit SDK exports and native HTML/React composition. Only add a primitive when a concrete migrated stock view needs it.

## 3. State and identity

Separate four lifetimes:

| Kind | Owner and rule |
|---|---|
| Sessions, files/drafts, Git, provider operations | Existing core/services/stores. Never copy on clone/reload. Preserve unknown outcomes and operation ids. |
| Resource engine/view ownership | Existing terminal keeper, attachment/resize lease, native browser geometry and editor services; one active owner per permitted view. |
| View-local state | Viewer + layout/surface instance + module-id scope, stable across code revisions. Preserve focus, drafts, scroll, expansion and selected resources as required by existing behavior. Transient hover/open menus may close on swap. Never synchronize one phone/window's focus into another. |
| Mod-persistent/shared data | Explicit APIs distinguish per-instance, per-mod and shared durable state. Preserve existing localStorage shared values; provide durable core-backed mod data where Herdr's app-home persistence requires it, without merging presentation focus. Atomic bounded file writes, revisions and corruption reporting; no new database schema is presumed. |

Stable instance ids come from layout node/surface identity, not array position, source revision or the current content hash. Legacy layouts get a non-destructive migration. A second copy of the same mod must not share unsent form state accidentally. Existing state scopes remain preserved where documented, with deliberate changes recorded and tested.

Maintain a small host-owned instance table in the existing mod runtime, keyed by that stable identity. Layout/surface ownership creates or releases an instance; DOM visibility only activates/parks its presentation. Hidden columns/inactive stacks/tabs/zoom retain owned instance state and tracked tasks as specified, while key routing and visible terminal/GPU observation follow visibility. Layout switches release layout-owned instances; pane instances follow their tabs. Do not use React unmount from a hidden Node as the ownership-release signal. No generic plugin lifecycle service is needed.

## 4. Reload, errors and effects

- Load/import/validate a candidate revision while the current revision remains visible. Fence generation, cancellation and instance disposal: an older slow load cannot replace a newer successful one or a disposed instance.
- Do not validate a revision by mounting a hidden second live React tree: normal useEffect/useLayoutEffect still run in such a tree. Import/validate first, then render/transition inside the existing per-instance host boundary, keeping shared engine owners outside replaceable presentation. Pure render preparation must not perform side effects. At commit, retire the old generation's owned effects before activating the new generation; stage SDK registrations and fence all async callbacks. A render failure restores the last-good module through the boundary, using stable host/view state rather than assuming its discarded React fiber survived. Later async/event errors are attributable only through guarded helpers. Shared engines hand off without a second terminal/input/resize owner.
- React error boundaries cover initial and later renders. SDK callbacks/async helpers report revision/instance errors; errors caught by those helpers are attributable. Arbitrary global side effects, untracked promises and infinite loops in trusted code are **not** transactionally reversible or fully containable.
- Dispose tracked subscriptions, timers, observers, styles, commands, overlays and object URLs once; finish cleanup despite one failing cleanup callback. Ignore stale async results. External filesystem/process effects already accepted are not rolled back or replayed automatically.
- `check`, DOM and screenshot diagnostics identify revision, instance, viewer/client, phase and first failure, rather than a global last report per id. Check success means the selected instance rendered the requested revision, not visual correctness or complete future callback coverage. Pending/unknown/expired are never success.
- Retain bounded last-good source snapshots independently of in-memory module caches. Native ESM caches cannot be fully unloaded; measure repeated reload growth and define a disclosed reload budget. Never automatically reload a viewer with unsaved/in-flight work to meet a memory target.
- The reset key works for a responsive thread. Core-side disable/safe-mode and relaunch are the recovery route for a hung page; settings/mod recovery must remain accessible without loading user modules. Stock defaults are verified release artifacts, not an arbitrary user-controlled folder.

## 5. All source-selection paths

The same source selection must reach:
- stock and custom desktop layouts; sidebar and WorkspaceOverview variants;
- mixed session/file/review/browser/mod tabs, pane chrome, drawer and standalone views;
- global openers: settings, navigator, new-session/worktree/folder/agent pickers, instructions/memory, confirms, key help, notifications and relevant permission/onboarding presentation;
- native-chat presentation and attachments/requests/history controls, without cloning provider runtimes;
- mobile header/switcher/pane shell, touch gestures and paired/relay clients.

The terminal text renderer, CodeMirror engine and platform-owned webview/OS prompts are host primitives, as Herdr also retains native terminal rendering. Their surrounding UI, menus, arrangement and interaction composition remain editable. Exempting an engine must never exempt the entire file pane, chat view or tab system.

## 6. Layouts, commands, capabilities and compatibility

- Ship the default desktop and phone compositions as cloneable layout/source packages, not a second hard-coded special case. Existing `sidebar`/`tabs`/etc. layout names resolve to shipped modules; preserve legacy layout data and per-viewer positions.
- Existing typed commands/SHORTCUTS remain one command path. Expose every action needed by stock source; test host qualification, hidden panes, keyboard scopes, IME, editable targets and native-browser forwarding. Add missing semantic actions once at their existing service boundary.
- Capability-gate package metadata/loading (`mods.package.v1`, proposed) and any new protocol families. Add client opt-in, not just server advertisement: a new client includes optional accepted formats/API information in `mods.list` only after seeing the server capability; absent fields mean legacy-only. Retain that choice in ConnState so both list and set replies are filtered. Older clients receive only legacy entries and compatible layouts/stock fallback, never React entries that their old imperative loader might execute. Filter presentation per connection without rewriting shared user files. Rust and TS fields remain field-for-field compatible and optional/defaulted. Test new/old clients concurrently against one core.
- SDK capabilities describe desktop-only actions and direct/relay/remote-host availability. Modules show unavailable actions explicitly; never fall back to executing locally or bypass authorizations. Client-restricted computer exec/files access remains restricted unless a separate approved capability supports it.
- Relay package source/assets must be carried through both exact allowlists and normal person authorization. Prefer one exact query-addressed `mods/package` route (`id`, `revision`, `path`) and a virtual hierarchical URL in the shim; the fetch hook translates nested module requests into that route. It must not put auth tokens in module URLs or saved source. Do not expose general mods/exec or mods/fs through relay merely to load UI. Test traversal, foreign origins, agent tokens, disabled mods and pairing revocation on every new route.
- Close the real command/composition gaps, not just names: explicit pane/tab/terminal targeting; a live terminal in a mod-authored layout/overlay; transient peek versus kept presentation versus park/unkeep; persistent keyed in-app windows. Use existing lifecycle and ownership services. Park hides a view, never destroys a process; unknown execution state never authorizes relaunch. Herdr's automatic terminal resurrection and remote transport design are not required product parity.

## Acceptance evidence

1. Every stock surface in [parity-matrix.md](parity-matrix.md) has a cloneable implementation graph and a mapped regression; no opaque wrapper passes.
2. One real agent changes WorkspaceOverview grouping and touch/keyboard navigation, tab interaction, a nested menu/dialog and native-chat composition while retaining existing actions. It uses only shipped guide/types/CLI, not repository imports or a Node install.
3. Stock and unmodified clones run the same behavioral assertions. Clone edits survive app upgrades and never modify shipped defaults.
4. Local helper JS, lazy import, CSS, font/image and deletion edits reload as complete revisions, including over paired relay/WebKit.
5. Live terminal process identity, input/resize authority, durable file drafts/conflicts, pending provider operations and remote ownership survive swaps and fault recovery without duplicate work.
6. Two instances and two viewers remain isolated where intended; explicit persistent/shared data survives restart without synchronizing focus.
7. Failure, stale-load, teardown, safe-mode and external side-effect limits are tested and documented honestly.
8. Source export and binaries work from a clean build/release; old mods/layouts/clients retain their documented behavior.

## Extension trace: sidebar and Git review

The existing sidebar and Git review are real variants, not hypothetical plugins. Both need observable host-qualified data, actions, editable nested presentation, state identity and error/reload handling. A sidebar clone changes its own JS/CSS and layout reference, not session lifecycle services. A Git-review clone changes review UI and interactions, but `gitReviewStore`, versioned comments, discard/commit previews and Context Bridge identities stay unchanged. Prove this with a second resource-surface clone in Phase 3; if it requires another copy of domain logic or a new renderer-specific loader, stop and repair the shared boundary rather than adding a factory.

## Risks and pre-decided responses

- **Loader/shim cannot preserve singleton/cycles/relay:** Phase 1 stops before migration. Re-evaluate a maintained loader or release-generated self-contained presentation package; do not silently cut phone or imports.
- **Source exporter traverses service side effects:** Fail its boundary test, move only the owning seam, retain one source of truth. Do not inline the whole app into every clone.
- **API fix breaks old independent clone:** Declared API compatibility failure is visible; keep its files and last-good compatible behavior. Additive changes default; breaking changes require a recorded adapter or owner decision, not automatic merge.
- **Mounted candidate duplicates native/provider work:** Release blocker; change commit/engine handoff before proceeding. Visual success is insufficient.
- **Unbounded caches or snapshots:** Measure and enforce storage/retention limits with explicit expired errors; report browser module-cache ceilings rather than promising unload.
- **Active unrelated changes move paths/contracts:** Re-scout and reconcile before each phase; never regenerate user work from HEAD.

## Sources

- [Pinned Herdr guide](https://github.com/herdrdev/herdr-app/blob/b721deda985270ec8256552692729a4add389b2a/defaults/AGENTS.md)
- [Pinned Herdr default layout](https://github.com/herdrdev/herdr-app/blob/b721deda985270ec8256552692729a4add389b2a/defaults/layouts/main.json)
- [Pinned Herdr spaces mod](https://github.com/herdrdev/herdr-app/blob/b721deda985270ec8256552692729a4add389b2a/defaults/mods/spaces/main.js)
- [ES Module Shims: shim mode, hooks and cycles](https://github.com/guybedford/es-module-shims/blob/main/README.md)
- [Multiple import maps compatibility](https://caniuse.com/mdn-html_elements_script_type_importmap_multiple_import_maps)
- [Perch architecture](../../docs/ARCHITECTURE.md), [decisions](../../docs/DECISIONS.md), [testing](../../docs/TESTING.md)
