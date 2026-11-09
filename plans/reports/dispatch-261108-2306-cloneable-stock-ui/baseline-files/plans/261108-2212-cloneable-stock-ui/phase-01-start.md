---
phase: 1
title: "Source packages, shared runtime and safe reload"
status: pending
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
| Create | /Users/hwiii/Github/perch/packages/web/scripts/export-stock-ui.mjs | Medium; deterministic graph export/check | Node self-check and artifact drift gate |
| Create | /Users/hwiii/Github/perch/packages/web/scripts/export-stock-ui.test.mjs | Small; real temp source graphs | Run directly with Node test runner |
| Create | /Users/hwiii/Github/perch/packages/web/src/mod-runtime.ts | Medium; shim/module loader and SDK bridge | Browser module integration tests |
| Create | /Users/hwiii/Github/perch/packages/web/src/mod-runtime.test.ts | Medium | Revision, import, singleton, auth and lifetime checks |
| Create | /Users/hwiii/Github/perch/packages/web/src/components/mod-root.tsx | Medium; React host/error boundary/commit | Mounted React regressions |
| Create | /Users/hwiii/Github/perch/packages/web/src/components/mod-root.test.tsx | Medium | Initial/later render, stale effects, disposal |
| Create | /Users/hwiii/Github/perch/crates/perch-core/src/stock_ui/ | Generated readable package tree | Exact clone and reproducibility tests |
| Create | /Users/hwiii/Github/perch/crates/perch-core/src/stock_ui_files.rs | Generated include_bytes catalog | Clean Cargo-only build |
| Create | /Users/hwiii/Github/perch/e2e/stock-ui-clones.spec.ts | Real stock/clone graph and relay gate now, expanded later | Phase 1 browser proof |
| Modify | /Users/hwiii/Github/perch/e2e/playwright.config.ts | Register new exact testMatch | No test-discovery dependency cycle |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/mods.rs | Package snapshots, digest, clone/catalog | Existing inline Rust mods tests |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/server/mods.rs | Auth package route and reports | Route/person/agent/disabled tests |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/server/mod.rs | Route, capability, scoped report state | Existing server tests |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/server/dispatch.rs | ModsList/ModsReport/ModsSet field dispatch | Optional-field/negotiation regression |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/protocol.rs | Additive optional package/report metadata | Protocol parity |
| Modify | /Users/hwiii/Github/perch/packages/shared/src/protocol.ts | Matching fields | Protocol parity |
| Modify | /Users/hwiii/Github/perch/packages/web/src/modApp.ts | Preserve legacy API; scoped lifecycle | Existing modApp tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/mods.ts | Package state/diagnostics/source URLs | Existing mods tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/components/ModView.tsx | Format dispatch to legacy or ModRoot | Existing mods e2e |
| Modify | /Users/hwiii/Github/perch/packages/web/src/relay/transport.ts | Exact package-route transport | Relay regressions |
| Modify | /Users/hwiii/Github/perch/crates/perch-core/src/relay/host.rs | Matching exact allowlist | Rust relay tests |
| Modify | /Users/hwiii/Github/perch/packages/web/src/main.tsx | SDK/loader bootstrap order only | Preserve dirty bootstrap changes |
| Modify | /Users/hwiii/Github/perch/packages/web/package.json | Export/check scripts; pinned loader | Build/test |
| Modify | /Users/hwiii/Github/perch/package-lock.json | Reproducible existing npm CI | npm ci/build |
| Modify if required by chosen install command | /Users/hwiii/Github/perch/pnpm-lock.yaml | Preserve repository's dual-lock policy | No package-manager migration |

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

- [ ] Source exporter and committed catalog reproducible from real TSX.
- [ ] Shared React/SDK and direct/relay module graphs work.
- [ ] Safe snapshots, auth, clone provenance and optional protocol fields tested.
- [ ] React errors, generation races, disposal and scoped diagnostics tested.
- [ ] Legacy mods and clean Cargo build remain working.

**Exit:** a stock module and its clone run identical real code through the same loader on direct WebKit and paired relay. If singleton/relay/ownership tests fail, stop migration and revise this phase; do not cut clients or reduce to slots.

## Risks, security and next phase

The loader dependency must be validated in production Vite/CSP, including its Wasm initialization if used. Same-realm trusted code can bypass helpers; document the recovery ceiling. Native engines must not mount in candidates. Phase 2 depends on this exit; Phase 3 adds the second real domain variant rather than a speculative plugin abstraction.
