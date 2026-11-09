---
phase: 1
title: "Source packages, shared runtime and safe reload"
status: completed
priority: P1
effort: "8-12 engineering days"
dependencies: []
---

# Phase 1: Source packages, shared runtime and safe reload

## Goal and context

Deliver a production-capable module path before migrating stock UI. Read [design](design.md), [parity contract](parity-matrix.md), and [validation](validation.md). This is the detailed first phase of a deep plan; every later phase begins with its own current-tree scout.

The existing implementation serves one JS entry and stages imperative mounts. It is not safe to reuse that staging unmodified for controllers, terminals or React effect ownership. Source: `modApp.ts:419–490`, `mods.rs:185–194,396–418`, `server/mods.rs:140–150`.

## Requirements

- Plain editable JS, local module graph, CSS/assets, one shared React, no user build.
- Immutable shipped catalog and independent complete-package clones with provenance.
- Same runtime for shipped React packages and personal React packages; old imperative mods remain working.
- Authenticated direct and paired-relay loading, optional/defaulted protocol metadata, explicit old-client behavior.
- Revision/instance/viewer diagnostics and deterministic stale-load/disposal handling.
- State and resource ownership follow design.md; candidate preparation cannot start live work.

## File inventory

Paths are absolute. Sizes are rough change scope, not estimates of current line counts.

| Action | Path | Scope | Test impact |
|---|---|---|---|
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/scripts/export-stock-ui.mjs | Medium; deterministic graph export/check | Node self-check and artifact drift gate |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/scripts/export-stock-ui.test.mjs | Small; real temp source graphs | Run directly with Node test runner |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/mod-runtime.ts | Medium; shim/module loader and SDK bridge | Browser module integration tests |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/mod-runtime.test.ts | Medium | Revision, import, singleton, auth and lifetime checks |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/mod-root.tsx | Medium; React host/error boundary/commit | Mounted React regressions |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/mod-root.test.tsx | Medium | Initial/later render, stale effects, disposal |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/stock_ui/ | Generated readable package tree | Exact clone and reproducibility tests |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/stock_ui_files.rs | Generated include_bytes catalog | Clean Cargo-only build |
| Create | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/e2e/stock-ui-clones.spec.ts | Real stock/clone graph and relay gate now, expanded later | Phase 1 browser proof |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/e2e/playwright.config.ts | Register new exact testMatch | No test-discovery dependency cycle |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/mods.rs | Package snapshots, digest, clone/catalog | Existing inline Rust mods tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/server/mods.rs | Auth package route and reports | Route/person/agent/disabled tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/server/mod.rs | Route, capability, scoped report state | Existing server tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/server/dispatch.rs | ModsList/ModsReport/ModsSet field dispatch | Optional-field/negotiation regression |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/protocol.rs | Additive optional package/report metadata | Protocol parity |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/shared/src/protocol.ts | Matching fields | Protocol parity |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/modApp.ts | Preserve legacy API; scoped lifecycle | Existing modApp tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/mods.ts | Package state/diagnostics/source URLs | Existing mods tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/components/ModView.tsx | Format dispatch to legacy or ModRoot | Existing mods e2e |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/relay/transport.ts | Exact package-route transport | Relay regressions |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/crates/perch-core/src/relay/host.rs | Matching exact allowlist | Rust relay tests |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/src/main.tsx | SDK/loader bootstrap order only | Preserve dirty bootstrap changes |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/packages/web/package.json | Export/check scripts; pinned loader | Build/test |
| Modify | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/package-lock.json | Reproducible existing npm CI | npm ci/build |
| Modify if required by chosen install command | /Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s/pnpm-lock.yaml | Preserve repository's dual-lock policy | No package-manager migration |

Do not assume a new generic manager/service is needed. Prefer existing mods functions, host stores and layout state. Generated files are not manually maintained.

## Tasks and implementation steps

1. **Re-scout and baseline.** Read affected headers and list all consumers of `ModInfo`, `createSwapper`, `ModView`, `mods.report`, `modFileUrl`, `clone_example` and `authorize_request`. Include tests, CLI guide, server capability list and relay allowlists. Capture dirty-tree baseline and focused test results; do not overwrite user changes.
2. **Write real contract regressions first.** Use temporary packages with sibling/lazy/circular imports, CSS/image/font assets and a shared host hook; no fake successful loader. Add failure-after-render, two viewers/instances, old/new overlapping loads, cleanup that throws and stale callbacks.
3. **Release exporter.** Starting with a small shipped panel and a resource-shaped test component, export its actual TSX presentation graph as readable per-file JS. Use installed TypeScript parsing plus esbuild syntax transform, not regex import parsing. Classify host-boundary imports explicitly; retain relative presentation imports and normalize emitted extensions. Fail if React, a domain singleton, bootstrap or private undeclared module becomes embedded. Export CSS/assets/types and generate the Rust include manifest. Exact source input to output determinism must be testable with `--check`; do not add build.rs or ignored-dist dependencies.
4. **SDK bridge.** Initialize one shim-mode loader and fixed shared host namespace before packages load. A bridge exports the already-running React/ReactDOM objects (including emitted JSX-runtime functions where used), primitives and documented services; do not import a second React copy through a shimmed bundle. Prove useState/context/portals and same-store identity in a real browser. Keep all current `api.store/socket` access compatible. Inventory and type the complete query requirements in design.md: layout tree, focused resource identities and all terminal records, including hidden agents/subagents; old convenience projections remain unchanged. Implement missing queries once at existing services, not by scraping DOM.
5. **Package metadata and clone semantics.** Add opt-in React package format, API range, origin and cloned-from version with defaults for legacy entries. Add optional client accepted-formats/API fields to mods.list, remember the negotiated choice per ConnState, and filter both mods.list and mods.set replies/layout visibility for legacy clients. Server advertisement alone is insufficient. Extend existing no-overwrite clone operation to shipped catalog packages. Publish only supported API/version combinations. Keep defaults immutable, user folders untouched and id collisions explicit. Maintain old examples commands and old clients' imperative experience; test simultaneous old/new clients.
6. **Content snapshots.** Recursively inventory only supported source/assets, validating canonical paths and refusing traversal/symlink escapes. Use content digest, not metadata alone; test same-length edits with preserved timestamps. Define bounded file count, source/asset/total bytes, depth and retained snapshot count against measured exported sizes. Snapshot ids bind all reads, including lazy imports/assets; no current-disk fallback under an old revision. Runtime data lives outside source packages.
7. **Transport.** Add one exact `mods/package` route with id/revision/path query fields. The loader presents hierarchical virtual module URLs and resolves every graph fetch via authenticated fetch to that query route. Update both relay allowlists without allowing a broad prefix, mods exec or mods fs. Test person tokens, foreign origin, agent refusal, revoked pairing, mods-off and out-of-base paths. Never serialize tokens into module URLs/metadata.
8. **Styles/assets.** Provide managed package stylesheet and asset URL helpers; rewrite/resolve CSS asset URLs through a real parser or supported helper, not regex substitution. Reuse installed CSS tooling where needed. Plain CSS/token changes must work without Tailwind compilation. Revoke retired URLs/styles without removing resources still used by a retained live generation.
9. **React lifecycle and fences.** Scope each instance by stable viewer/layout/surface identity in a small host runtime instance table. Visibility changes park rendering/observations; layout or tab ownership releases instances. Hidden stacks/tabs retain owned state/tasks and keys route only to shown copies. Do not stage a second mounted React tree: its normal effects would run. Import/prepare and transition within one instance boundary; commit only the latest generation, cleaning old owned effects before activating new ones. Keep engines outside replaceable roots and restore last-good code with stable state if rendering fails. Error boundaries cover subsequent renders. Tracked SDK timers/commands/subscriptions/async work have bounded disposal and stale-result suppression; trusted bypasses are not a sandbox guarantee.
10. **State and diagnostics.** Preserve view-state keys across revisions; keep focus viewer-local and mod shared data explicitly shared. Extend load reports with optional instance/viewer context and capability negotiation; aggregate CLI status without last-writer-wins masking. A requested exact instance/revision cannot be satisfied by another viewer's success. Keep source-load, render, callback and disposal phases distinct.
11. **Integrate and document limits.** Connect format dispatch while preserving every legacy mod test. Measure module-cache growth across 100 edit cycles, live handler/engine counts and snapshot retention; set the documented ceiling/response. Do not claim arbitrary external-side-effect rollback or keyboard recovery from infinite loops.

## Critical scenario matrix

| Priority | Scenario | Mechanical pass |
|---|---|---|
| Critical | Nested/lazy/circular source graph in WebKit and relay | Actual modules run; all bytes come from one revision; no CDN/Node |
| Critical | React shared bridge | Reference equality and real hooks/context pass; one store/engine |
| Critical | Two candidate loads resolve backwards | Newest requested revision remains committed |
| Critical | Candidate throws or unmounts before completion | Prior view remains or stock fallback appears; no live duplicate effects |
| Critical | Agent token/traversal/disabled/revoked token | Non-success response, no file bytes |
| High | CSS/font/image/helper edit and delete | Revision changes; live style/assets match; old valid view retained on failure |
| High | Two viewers and same-mod instances | Correct scoped reports and independent view state |
| High | Host API mismatch or old peer | Explicit compatible fallback; no accidental imperative call |
| Medium | Cleanup throws/storage unavailable/revision expired | Cleanup continues; readable error; no silent success |

## Verification

Commands run from repository root unless a subshell is shown. New tests/scripts listed here are deliverables, not currently existing commands.

- `node --test packages/web/scripts/export-stock-ui.test.mjs`
- `node packages/web/scripts/export-stock-ui.mjs --check`
- `npm run test -w @perch/web -- src/mod-runtime.test.ts src/components/mod-root.test.tsx src/modApp.test.ts src/mods.test.ts src/components/ModsHost.test.tsx`
- `cargo test -p perch-core mods`
- `cargo test -p perch-core --test protocol_parity`
- `npm run build`; then clean checkout/packaging CI proves `cargo test -p perch-core` has no Node/dist prerequisite.
- `(cd e2e && npx playwright test stock-ui-clones.spec.ts)` and `(cd e2e && PERCH_E2E_WEBKIT=1 npx playwright test --project=webkit stock-ui-clones.spec.ts)` must exercise real module graph and paired-relay behavior in this phase. Create/register the spec now; later phases extend it. Unit mocks or a test that bypasses the authenticated transport cannot close this loader gate.

## Checklist and exit

- [x] Source exporter and committed catalog reproducible from real TSX.
- [x] Shared React/SDK and direct/relay module graphs work.
- [x] Safe snapshots, auth, clone provenance and optional protocol fields tested.
- [x] React errors, generation races, disposal and scoped diagnostics tested.
- [x] Legacy mods and clean Cargo build remain working. (Phase 5: `cargo test -p perch-core` in a copy of the working tree with no Node modules, no web build and `node`/`npm`/`npx`/`pnpm` shimmed to fail, 880 passed; `mods.spec.ts` legacy mods pass.)

**Exit:** a stock module and its clone run identical real code through the same loader on direct WebKit and paired relay. If singleton/relay/ownership tests fail, stop migration and revise this phase; do not cut clients or reduce to slots.

## Risks, security and next phase

The loader dependency must be validated in production Vite/CSP, including its Wasm initialization if used. Same-realm trusted code can bypass helpers; document the recovery ceiling. Native engines must not mount in candidates. Phase 2 depends on this exit; Phase 3 adds the second real domain variant rather than a speculative plugin abstraction.

## Review corrections (binding; override conflicting text above)

Sources: [security](../reports/review-security-cloneable-stock-ui.md) (SEC), [failure modes](../reports/review-failure-modes-cloneable-stock-ui.md) (FM), [assumptions](../reports/review-assumptions-cloneable-stock-ui.md) (A); owner answers in [validation.md](validation.md).

- **Scope (owner):** stock cloning is for the local device only. Remove `crates/perch-core/src/stock_ui/` and `stock_ui_files.rs` from the inventory; the catalog ships in web dist (A05, A06 skew). The headless core and remote hosts do not embed or serve stock packages. Phones get their own phone-form mod set, opt-in per phone (SEC-01).
- **Clone cap (owner, Herdr has none):** drop the 300-file/8 MiB cap for stock-sized packages; keep a sanity limit and measured bounds (step 6).
- **SDK (owner):** the public surface is a documented, versioned Herdr-style plugin/action/pane API; stock modules may import only that surface or ship inside the clone. Internal app modules are not a contract (A02).
- **Exporter:** use TypeScript `transpileModule`, not esbuild, so `//!` headers and comments survive (A03/FM). Handle Vite-only imports (`import.meta.glob` in `AgentIcon.tsx`, `?url` pdf worker, CSS/JSON imports) explicitly (A04). Fix generated-file drift with `--check` in CI (A05).
- **Module-level state first (A01, FM-01, FM-02):** before any reload work, move drafts, receipts and operation-id Maps (`NativeCliChat.tsx`, `WorkspaceOverview.tsx`, `WorkspaceFiles.tsx`, `modApp.ts`) into host-owned stores. Hold a code swap while a send or other tracked operation is pending. Never run two copies of a module that owns state.
- **Identity and safe mode (SEC-02, FM-03/04, A08):** stock lives in its own id namespace served only from built-in bytes; clones must take a different id and can never shadow stock. With `PERCH_MODS=off`, built-in stock still renders; a clone that hangs at boot is auto-disabled and a recovery path exists on the phone.
- **Loading (A09, A10, SEC-08):** one snapshot fetch per revision; serve by exact lookup in the snapshot file list with a fixed extension allowlist and `nosniff`; revision hash is SHA-256 (SEC-10); stock packages must not auto-open or mount hidden (A07).
- **Relay (A11, FM-05, SEC-04):** the relay gate uses `e2e/relay.check.mjs`, not the main Playwright config; the loader refuses any request it cannot send through the tunnel.
- **Fixed built-ins (SEC-03):** DOMPurify renderers (`markdown.ts`, `SafeHtml.tsx`, `uiBlocks.ts`) stay non-clonable with attack-input tests.
- **Agents (SEC-06):** terminal read/send for agents is allowed (Herdr does it) with explicit host-qualified targets and the per-session token rule.
- **Docs and parity (A13, A15):** amend `docs/DECISIONS.md` in this phase; add ContextBridge, browser pane, CloseAgentGuard, pairing screens, empty states and recovery UI to the parity matrix.
- **Paths (A12):** every path above is inside this worktree; never touch `/Users/hwiii/Github/perch`.

**SDK scope (owner, 2026-11-08):** one small versioned Herdr-style API serves stock screens, clones and community plugins; no internal-module bridge. Add to the exit gate: a shipped panel runs on that API alone, with no imports of app internals.

**Registry-ready (owner, 2026-11-08):** package manifest and install flow must be source-agnostic: stable id, publisher/origin, version, API range, SHA-256 digest and recorded install source (folder or git today). Build no registry, index or hosting, but add nothing that assumes a local folder origin.

## Progress log (2026-11-09; checklist above stays unchecked until Phase 1 exits)

Done and verified: core package snapshots, SHA-256 revisions, exact `mods/package` route with auth/410/404/nosniff, optional `format/api/entry/files/origin/clonedFrom` fields with per-connection `accepts` filtering of both `mods.list` and `mods.set`, exact relay allowlist entries, package clone with provenance (Rust, `cargo test -p perch-core` 862 passed); web loader `mod-runtime.ts` (es-module-shims 2.8.4 shim mode, virtual per-revision URLs, source hook, shared React/ReactDOM/JSX runtime), `components/mod-root.tsx` (import-then-swap, last-good revert, error boundary), `ModView` format dispatch, `accepts: ["esm"]` on `mods.list`. Proven in a real core: `e2e/stock-ui-clones.spec.ts` passes in Chromium and WebKit (nested, lazy and circular imports, real hooks, revision swap, broken edit keeps last good); `npm test` 1158 passed; legacy `mods.spec.ts` 11 passed.

Not done: exporter and stock catalog (web dist), SDK module `@perch/sdk`, CSS/asset handling, host-owned drafts/op-ids, instance table and hidden-instance ownership, scoped diagnostics, safe-mode stock, DECISIONS amendment, relay security headers (relay drops nosniff/CSP), fetch concurrency bound over the relay, install-source provenance, `pnpm-lock.yaml` (pnpm not installed here).

Blocker for the relay gate: `node --experimental-strip-types e2e/relay.check.mjs` fails before reaching any package code. The paired phone page throws React error "Rendered fewer hooks than expected" at startup (blank page). It reproduces with this phase's three tracked web edits reverted, so it comes from the snapshotted baseline or main, not the loader. The check now logs phone page errors; the package proof step is written into it and has not run.

## Progress log (2026-11-09, second slice)

Done and verified: exporter `packages/web/scripts/export-stock-ui.mjs` (TypeScript `transpileModule`, per-file JS with comments kept and JSX props laid out one per line, AST-based specifier rewrite, refuses imports outside the screen folder, other npm packages, `import.meta.glob/env/hot`, `?url`-style, CSS/asset imports, `require` and computed `import()`; deterministic; `--check`) with `export-stock-ui.test.mjs` (17 tests on real temp graphs); it runs at the end of `npm run build` into `dist/stock-ui/` and `catalog.json`. `@perch/sdk` 1.0.0 (`src/perch-sdk.d.ts` contract, `src/sdk.ts` registered from `main.tsx`, `sdk.test.ts` pins the surface; `sdkSatisfies` api-range check in `mod-runtime.ts`); guide `docs/MOD-SDK.md`. The keybind help moved to `src/stock-ui/keybind-help/` on `@perch/sdk` alone and the app renders it from its exported package (`StockView`, same-origin fetch, mounted only while open). Core: `Place::Layout`, `version` on manifests and `clonedFrom`, `mods::stock` lists the served build's catalog as `stock:<id>` (also with mods off; drift from `catalog.json` is listed as an error), `mods::clone_stock` and `stock:` in `perch mod clone ... [--as id]` / `mods.set clone` / `perch mod examples`; the Rust and JS digests are pinned to the same value. e2e: stock and its untouched clone pass one shared assertion helper and a clone edit changes only the clone (Chromium and WebKit); the relay check now opens the stock screen on the phone from the Worker's assets. DECISIONS amended (2026-11-09 entry), ARCHITECTURE ownership note, TESTING command.

Still not done from the list above: CSS/asset handling in packages, host-owned drafts/op-ids, instance table, scoped diagnostics, a stock-replacement mapping (a clone shows only where a layout puts it), relay security headers, fetch concurrency over the relay, install-source provenance for `perch mod install`, `pnpm-lock.yaml`.

## Progress log (2026-11-09, third slice)

Done and verified:

- **Instances.** `mod-runtime.ts` holds a table of copies keyed by place (`layout:<layout>:<node>`, `pane:`, `dock:`, `overlay:`, `hidden:`, `stock:`). A copy owns its generation (component and `ModApi`), tracked operations, `useInstanceState` values and revision resources.
  - A layout copy is parked while hidden and released by `LayoutRoot` (`retainInstances`) when its node leaves; other copies end with their view.
  - A second view of one copy shows an error instead of running twice.
  - Keys go to the newest copy on screen (`routeCommand` in `modApp.ts`).
  - A swap is held up to `SWAP_HOLD_MS` (10 s) while `trackOperation` work is pending, then a `swap` warning is reported.
  - `ModApi.dispose` is idempotent, runs every cleanup and returns what threw. Afterwards late results never settle and nothing new opens.
  - The old API is disposed before the new tree's effects run.
  - Tests: `components/mod-root.test.tsx` (6: dispose and unmount before the new mount, at most one live tree, held swap, newest of reversed loads, render failure back to last good, parked layout copy kept then released, second view refused) and `modApp.test.ts` (four new lifetime tests).
- **Diagnostics.** `mods.report` gained `instance` and `phase` (`load`, `render`, `callback`, `disposal`, `swap`); `mods.snapshot(.request)` gained `viewer` and `instance` (optional; capability `mods.report.v2`; parity test passes).
  - The core assigns the viewer (connection id). `ModDiagnostics` in `server/mods.rs` keys reports by id, viewer, instance and revision, caps at 256 reports and 16 open questions with oldest-out, and drops a viewer's reports on disconnect.
  - `perch mod check` lists every copy. `check`/`dom` take `--viewer`/`--instance` and `do` takes `--viewer`; only the targeted viewer's answer counts.
  - Tests: three `diagnostics_tests` and an `agent_cli` flag test.
- **CSS and assets.** The SDK is 1.1.0 (`assetUrl`, `useInstance`, `useInstanceState`). Each revision's assets become object URLs (build URLs for stock), and its CSS `url()`s are rewritten with `@csstools/css-tokenizer` (`@import` and unknown files refused).
  - One `<style data-mod-package data-mod-revision>` is on the page while shown. URLs are revoked when the last generation or last-good reference goes.
  - The exporter now ships `import "./x.css"` (plus its `url()` files) and default asset imports (as `assetUrl`). It refuses CSS modules and other import forms.
  - Tailwind limitation documented in MOD-SDK.
  - Tests: `mod-runtime.test.ts` (10), `export-stock-ui.test.mjs` (23), and a new e2e case in Chromium and WebKit (blob background and img, revision swap retires the old style).
- **Relay.** The host forwards `contentTypeOptions` and `contentSecurityPolicy` on `mods/package` (relay test asserts them). `relayRequest` refuses a non-tunnel URL, and the loader never falls back to a plain fetch.
  - At most `MAX_RELAY_FETCHES` = 8 package fetches at once (host limit 16), with a unit test.
  - The loader emulates `nosniff` by extension.
  - `relay.check.mjs` now loads 20 helpers, CSS and an asset through the tunnel and passes in Chromium and WebKit, so the earlier startup blocker no longer reproduces.
- **Provenance.** `perch mod install` writes `installedFrom {kind: git|folder, location, commit, digest: sha256:…}` through one `install_from` step. The manifest takes optional `id` (install folder) and `publisher`, and a clone drops all three. Test: `install_records_its_source_and_digest_and_a_clone_drops_them`.
- **pnpm-lock.yaml.** Regenerated with `npx --yes pnpm@10 install --lockfile-only --ignore-scripts` (pnpm 10.34.9). The old file was a 24-line root-only stub.
  - pnpm 10 fetched `@perch/shared` (`"*"`) from the registry (404), so `pnpm-workspace.yaml` now sets `linkWorkspacePackages: true`.
  - `--frozen-lockfile` reproduces it.

Checks: `cargo test -p perch-core` 870 + parity 2 passed; `cargo test -p perchd` 37 + integration passed; `cargo fmt --check` clean; clippy with no new warnings (two existing ones in unchanged `db/mod.rs`, `perch-desktop/browser.rs`); `npm run build`; `npm test` 1180 passed; `check:stock-ui`; Playwright `stock-ui-clones` (Chromium and WebKit, 3 each), `mods.spec` and `keybindings.spec` (16); `relay.check.mjs` in Chromium and WebKit.

Checklist: the first four boxes are ticked on the evidence above. The catalog ships in web dist per the owner scope correction and is reproduced by `--check`. "Clean Cargo build" stays open, because no clean-checkout or packaging CI run was done here.

Still not done (not in this slice): host-owned drafts and op-ids in `NativeCliChat`/`WorkspaceOverview`/`WorkspaceFiles`, a clone that hangs at boot being auto-disabled with phone recovery, stock-replacement mapping, and the 100-edit module-cache measurement (step 11). es-module-shims keeps every imported revision's modules in its registry, so that growth is unmeasured.

## Progress log (2026-11-09, closed in phase 5)

The last box is ticked. Clean Cargo build: the tracked and new files of the working tree (no `node_modules`, no web
build output) were copied to `/tmp/perch-clean-src` and `cargo test -p perch-core` ran there with a fresh build
directory and `node`, `npm`, `npx` and `pnpm` replaced by scripts that fail loudly: 880 passed, 1 ignored, no Node
call. Legacy mods: `mods.spec.ts` (Chromium) passes, including the herdr-style `hc` test after a fix that picks the
shell its split opened rather than the first live session. The module-cache growth left open above is measured in
phase 5 (3 modules per edited revision, linear, cleared by a reload).
