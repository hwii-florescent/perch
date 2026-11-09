# Red-team review: Assumption Destroyer / Contract Verifier — cloneable stock UI plan

Plan: `plans/261108-2212-cloneable-stock-ui/` (plan, design, parity-matrix, validation, phase-01..05).
Tree: HEAD `8a02934` plus dirty working tree. Read-only review; no source or plan edits.
Owner decisions treated as fixed: full customization parity, plain JS with no build, independent clones, desktop+web+phone, trusted full-access mods.

Web paths are under `packages/web/src/`, Rust paths under `crates/perch-core/src/`, unless written in full.

## What was verified as stated

All 61 existing files the plan names exist. All 21 named unit test files, `tests/protocol_parity.rs`, `examples/close_shortcut_probe.rs` and every named e2e spec/config exist. These line citations match the code: DECISIONS.md:50–64; LayoutRoot.tsx:28–44, 162, 184–191; ModView.tsx:10–25; modApp.ts:342–352, 396, 419–490, 460–476 (no generation fence; the next tree mounts before the old one is cleaned up); mods.rs:185–194 (revision = size+mtime of mod.json and entry only), 396–418, 752–879; relay/transport.ts:21, 80–88 and relay/host.rs:45, 325–328 (`mods/file` is in neither allowlist); server/mod.rs:283 and server/mods.rs:140–150 (reports keyed by mod id only); server/mods.rs:721–742, 779 (same unfiltered `state_message` on list and set); protocol.rs:1404–1406 (no client opt-in); dispatch.rs:293–310; DockviewShell.tsx:192–205; playwright.config.ts:34 (exact testMatch); native-composer.config.ts:4 (registers agent-mods.spec.ts); the dual npm/pnpm lockfile policy (TESTING.md:17). The CLI verbs the plan relies on already exist (agent_cli.rs:1002–1154: enable/disable, dom, examples, clone, do, status, shot, check).

The findings below are the claims that did **not** hold, or that hold but leave out something that matters.

## Findings

| ID | Sev | Finding |
|---|---|---|
| A01 | Critical | Module-level state in exported presentation files gets reset and duplicated |
| A02 | Critical | The "host boundary" is about the whole service layer, and that becomes a versioned public API |
| A03 | High | esbuild removes every comment, so its output is not the promised "readable" source |
| A04 | High | Vite-only constructs inside the stock graph cannot be emitted per file |
| A05 | High | Embedding the catalog in headless core does nothing useful and creates drift with no CI to catch it |
| A06 | High | The relay phone shell (SDK) and the core's catalog come from different deployments |
| A07 | High | `place` semantics: ModsHost would auto-open or hidden-mount stock packages |
| A08 | High | What safe mode / `PERCH_MODS=off` means for the stock catalog is not defined |
| A09 | High | Hashing whole packages in `scan()` hot paths |
| A10 | High | Loading many modules over the relay hits a 16-request pending cap; no latency budget |
| A11 | High | The relay gate names a harness that cannot exercise the relay |
| A12 | High | Phase inventories point at the main checkout, not this worktree |
| A13 | Medium | The parity matrix is missing real stock surfaces |
| A14 | Medium | Guide and types ship in the `perch` CLI binary, not the core |
| A15 | Medium | The DECISIONS supersession comes after the code that depends on it |
| A16 | Medium | The effort estimate does not match the measured scope |
| A17 | Medium | "Survives upgrades" has no fixture |
| A18 | Medium | Existing asset routes are not reused |
| A19 | Low | Proposed file names break the repo's naming convention |
| A20 | Low | jsdom unit tests cannot prove the shim loader |
| A21 | Low | Clone id shadowing already happens and the plan does not point to it |

### A01 — Critical — Module-level state in exported presentation files gets reset and duplicated

**Evidence.**
- `views/NativeCliChat.tsx:57–66`: `const drafts = new Map<string, Draft>()` holds `operationId`, with the comment "A lost acknowledgement never turns Retry into a new operation". `receiptsBySession` is a second module Map.
- `components/WorkspaceOverview.tsx:121–122`: `let heldTimer`, `let held`.
- `components/WorkspaceFiles.tsx:313`: `let wrapPreference`.
- `modApp.ts`: `let agentOrder`, `panesOnScreen`, `terminalText`.

**Failure scenario.** Every revision gets new module URLs, so every revision gets a fresh module instance. An edit to any file in the chat package resets `drafts`. A send whose acknowledgement was lost then retries under a new `operationId`, and the prompt is dispatched twice. The same split happens when compiled stock (kept for recovery and old peers) and the exported copy run side by side, or when two clones run: each has its own Map. The plan treats this as conditional, in Phase 3 step 5 ("if presentation currently owns their lifetime"). It does own it today.

**Correction.**
- Phase 1 exporter rule: fail when a presentation module has module-scope mutable bindings (`let`, or `new Map`/`Set`/class instances at top level).
- Phase 1 inventory: list every current case with file:line.
- Move NativeCliChat drafts and outbox identity to their existing owner (`composerDraft`/`chatSend`) **before** the first chat export. Make Phase 3 step 5 unconditional.
- Add a regression: edit an unrelated chat helper while a send is unconfirmed, then Retry. It must reuse the same operation id.

### A02 — Critical — The "host boundary" is about the whole service layer, and that becomes a versioned public API

**Evidence.** I measured the import graph from real sources (static and dynamic imports, type-only imports excluded):

| Root | Local files reached | TSX/TS lines |
|---|---|---|
| `App.tsx` | 229 of 233 non-test files | 35k |
| `WorkspaceOverview`/`Sidebar` | 79 | 15.6k |
| `MobilePaneShell` | 176 | — |
| `SettingsPage` | 95 | — |
| `TabBar` | 85 | — |
| `NativeCliChat` | 86 | — |
| `Toast` | 42 | — |

The WorkspaceOverview graph alone pulls in `store/index`, `ws`, `terminalKeeper`, `closeGuard`, `tabDrag`, `dockview/dockviewController`, `filesystemStore`, `surfaceSync`, `nativeUi`, `contextBridge`, `splitSets`, `fileTabs`, `viewer` and more. It also needs these npm packages: `clsx`, `tailwind-merge`, `class-variance-authority`, `zustand`, and for chat `marked`, `dompurify` and `@codemirror/*`.

**Failure scenario.** Every non-presentation import has to become a declared `perch` SDK export. Independent clones pin an "API range" (design §1.4). So dozens of internal module shapes freeze into a public contract, and any refactor of `closeGuard` or `fileTabs` breaks every user clone. Neither the 33–50 day estimate nor the compatibility section (design §6, risk 3) accounts for an SDK of roughly 60 modules plus 8 or more third-party libraries.

**Correction.**
- Make the first Phase 1 deliverable a machine-generated boundary report: presentation files, host modules, npm modules and per-root counts.
- Have the owner sign off on the resulting SDK surface and its stability policy (for example, re-export modules as-is with a declared "internal, may break" tier, versus a curated stable tier).
- Re-estimate after that report.

### A03 — High — esbuild removes every comment, so its output is not the promised "readable" source

**Evidence.** I ran a probe with the installed esbuild 0.25.12, `transformSync(loader:"tsx", jsx:"automatic")`. Line comments, JSDoc and intent comments were all removed, and `export function` was moved to a trailing `export { … }`. TypeScript 5.9.3 `transpileModule` (jsx `react-jsx`, ES2022), which is already a direct devDependency, kept every comment and kept export placement. Design §1.2 and Phase 1 step 3 prescribe esbuild plus a new explicit dev dependency.

**Failure scenario.** Agents edit uncommented, restructured JS. That runs against the repo's "read the module's header" norm (AGENTS.md) and against the "readable formatting / original symbol names" claim.

**Correction.** Use the installed `typescript.transpileModule` and drop the esbuild dependency. Either output is `jsx()` calls, not JSX; that is consistent with the owner's plain-JS choice, but the guide should say so.

### A04 — High — Vite-only constructs inside the stock graph cannot be emitted per file

**Evidence.**
- `components/AgentIcon.tsx:253`: `import.meta.glob(..., { query: "?url" })`. This file is in the WorkspaceOverview/Sidebar graph.
- `components/WorkspacePdf.tsx:3`: `pdf.worker.min.mjs?url`.
- CSS side-effect imports: `dockview/DockviewShell.tsx:15–16`, `views/Terminal.tsx:3`, `views/AgentCliTerminal.tsx:4`.
- JSON imports: `palettes/catppuccin.json` (in the sidebar graph).
- `main.tsx:48`: dynamic CSS import.

**Failure scenario.** A per-file TS→JS transform emits imports a browser cannot resolve, so the first stock export (navigation, Phase 2) fails, or the exporter quietly pulls the whole Vite pipeline back in.

**Correction.** The Phase 1 exporter enumerates and rejects these forms. Map each one to a declared host export (agent icon table, pdf worker URL, theme palettes) or a package asset. Add an exporter test fixture for each form.

### A05 — High — Embedding the catalog in headless core does nothing useful and creates drift with no CI to catch it

**Evidence.**
- The release `core` job is cargo-only (`.github/workflows/release.yml:134`) and ships no web dist.
- Without a dist, core serves a placeholder page (`boot.rs:232–235`, `server/mod.rs:957`).
- The hub drops a remote host's `ModsState`/`ModsChanged` as host-private (`hub.rs:1609–1622`), so remote mods never render.
- `release.yml` is the **only** workflow; there is no PR CI.
- The design says both "release-time export" (§Better approaches) and "generated committed readable files under `crates/perch-core/src/stock_ui/`" (§1.3).

**Failure scenario.** Every TSX edit, including the active dirty native-chat work and concurrent sessions, has to regenerate committed artifacts. These will conflict, and nothing catches a stale catalog until a manual release, which then embeds old stock while the bundle ships new code. Adding a `--check` to the core job brings in exactly the Node prerequisite the design says to avoid.

**Correction.** Emit the catalog into `packages/web/dist/stock-ui/` during `npm run build`, as the same artifact as the SDK bundle. The core reads it from `web_dist_dir` to clone. This removes `stock_ui/`, `stock_ui_files.rs`, the `include_bytes!` manifest and the drift gate. If owner intent really requires headless clone support, state why, and add a PR workflow that runs `--check`.

### A06 — High — The relay phone shell (SDK) and the core's catalog come from different deployments

**Evidence.**
- `relay/wrangler.toml:8–12` serves `../packages/web/dist` from the user's Worker.
- DECISIONS.md:721: "the app itself comes from the relay's assets."
- relay/transport.ts:1–6: only the data routes are tunnelled.
- Phase 5 step 9 claims "desktop and web ship matching SDK/source versions"; the relay deployment is not part of that claim.

**Failure scenario.** A user upgrades the desktop but does not redeploy the Worker. The phone's host React/SDK is version N, while stock packages fetched through the tunnel are N+1. The result is missing SDK exports, or a graph that loads but is mixed and incompatible. The "API skew" mention in C17 does not name this cause.

**Correction.**
- Load shipped stock from the page's own origin (the same dist as its SDK), and load only user clones from the core.
- Add an SDK-version handshake that refuses incompatible clones explicitly.
- Add a Phase 5 test: old relay deploy against a new core.

### A07 — High — `place` semantics: ModsHost would auto-open or hidden-mount stock packages

**Evidence.**
- `components/ModsHost.tsx:19–20, 46`: every enabled mod with `place === "dock"` (the default when `mod.json` omits it, per the mods.rs:4 header) opens as a pane once per `id:revision`.
- `:62`: `place: "none"` mods are mounted hidden through `ModView`.

**Failure scenario.** A clone made by `perch mod clone` of a stock sidebar keeps the default dock placement and reopens as a pane on every agent edit. Marking stock packages `none` instead mounts a hidden, live second WorkspaceOverview or NativeCliChat, which runs effects. That is the duplicate-work blocker the design forbids.

**Correction.** Add a placement value such as `component`/`layout` for React packages: rendered only where a layout or opener selects it, and excluded from ModsHost. Add a regression covering an edited clone with neither auto-open nor a hidden mount.

### A08 — High — What safe mode / `PERCH_MODS=off` means for the stock catalog is not defined

**Evidence.** `scan()` returns nothing when the policy is off (mods.rs:158–165), and `source()` refuses (mods.rs:396–407). The design keeps compiled stock "only for verified recovery/older peers". It never says whether the catalog is served, or which stock runs, under safe mode.

**Failure scenario.** One of two outcomes:
- Safe mode also disables the catalog, and the user lands in a compiled path that Phase 5 step 3 calls non-primary and may let rot.
- Safe mode serves the catalog, and it is no longer "loads none".

**Correction.** Define it: safe mode renders compiled stock with no catalog or user code, and gets its own regression. Keep compiled stock covered by the same behavioral assertions, so the recovery path is not untested.

### A09 — High — Hashing whole packages in `scan()` hot paths

**Evidence.**
- `source()` runs a full `scan()` of every mod on **every** request (mods.rs:397–400).
- `spawn_watch` rescans every mod every 2 s (server/mods.rs:786–820).
- Design §1.6 makes the revision a digest of all file bytes.

**Failure scenario.** Loading one stock-sized graph means about 100 module requests. Each one reads and hashes every file of every mod, and the watcher does the same every 2 s. With several clones that is megabytes of hashing per second and per page load.

**Correction.** Use cheap stamps over all files for change detection and compute the digest only when stamps change. Serve every graph request from a cached snapshot keyed by revision, not from `scan()`. State the measured cost in Phase 1 step 11.

### A10 — High — Loading many modules over the relay hits a 16-request pending cap; no latency budget

**Evidence.** relay/host.rs:52 sets `MAX_PENDING_REQUESTS = 16`. Each tunnelled request is sealed and fully buffered (DECISIONS.md:745). The plan's loader issues one fetch per module.

**Failure scenario.** The first phone paint of an exported stock shell needs dozens to 100+ sealed round trips, queued 16 at a time. The phone becomes much slower than today's single bundle, and nothing in the plan measures it.

**Correction.** Have the fetch hook fetch **one snapshot per package revision**: a single `mods/file?id&revision` response listing every file. Modules then resolve from memory. This also makes the snapshot atomic, which simplifies §1.6 (no server-side retained-revision table for partial reads). Add a phone first-paint budget to Phase 5.

### A11 — High — The relay gate names a harness that cannot exercise the relay

**Evidence.** Phases 1 and 5 require relay proof from `stock-ui-clones.spec.ts` under the main Playwright config. That config has no relay; it uses fixed core ports. The real relay harness is `e2e/relay.check.mjs`, which runs `wrangler dev` and needs `npm install` in `relay/` (TESTING.md:411–422). The plan never names it.

**Failure scenario.** The Phase 1 exit gate ("paired relay") either cannot run, or gets met by LAN pairing (`paired-phone-flows.spec.ts`), which skips the tunnel allowlist that is the actual risk.

**Correction.** Extend `e2e/relay.check.mjs` with module-graph, CSS/font/image and revocation cases, and list that command in the Phase 1 and Phase 5 verification sections.

### A12 — High — Phase inventories point at the main checkout, not this worktree

**Evidence.** Every phase file inventory uses `/Users/hwiii/Github/perch/...`, and so do the plan.md handoff commands. That path is the main checkout, currently on branch `main`, with its own copy of this plan.

**Failure scenario.** Cook, executed from this worktree, edits files on `main` in a different checkout. That breaks worktree isolation and the "preserve dirty work" constraint, because the dirty native-chat files exist in both trees.

**Correction.** Use repo-relative paths throughout, and name the execution worktree explicitly.

### A13 — Medium — The parity matrix is missing real stock surfaces

**Evidence.** Of the 105 non-test TSX files, these App-reachable surfaces map to no S row and no explicit boundary row:
- `ContextBridge.tsx`: a global overlay imported by App.tsx, and an AGENTS.md contract.
- `WorkspaceBrowser.tsx`/`DrawerBrowser.tsx`: the Phase 3 checklist says "browser", but neither file is in its inventory.
- `CloseAgentGuard.tsx`.
- `PairingGate.tsx`, `PhoneAccess.tsx`, `ConnectionDetails.tsx`.
- `TerminalSearchBar.tsx`.
- `CliStartPanel.tsx`, `NoSessionPanel.tsx`, `StartCard.tsx`, `AgentCatalog.tsx`.
- `TabDragLayer.tsx`, `SlashPopover.tsx`, `dockview/SessionSplitPopover.tsx`, `ModeSwitch.tsx`.
- `ModsSection.tsx`/`ModsHost.tsx`: the recovery surface, which must be declared non-replaceable.

**Failure scenario.** Phase 5's "all rows pass" closes while real UI stays opaque, or pairing/recovery UI gets made replaceable without anyone deciding to.

**Correction.** Generate the row inventory mechanically from the TSX roots. Each file gets an S row or an explicit host-boundary row (bootstrap, pairing, recovery) with a justification.

### A14 — Medium — Guide and types ship in the `perch` CLI binary, not the core

**Evidence.** agent_cli.rs:971: `const MOD_API = include_str!("../../perch-core/src/mod_examples/perch-mod.d.ts")`. That compiles the types into the perchd/`perch` binary. Shipped packages come from the core or the dist.

**Failure scenario.** An agent's `perch` CLI version differs from the running core/web. The agent then reads types that do not match the catalog it is cloning, which breaks the "only shipped tools" acceptance check in a way that is hard to diagnose.

**Correction.** Phase 4 step 9: serve guide and types from the running core, keyed to the catalog/SDK version. The CLI prints what the core returns.

### A15 — Medium — The DECISIONS supersession comes after the code that depends on it

**Evidence.** DECISIONS.md:50–64 ("Perch's own panes are not mods") is amended only in Phase 4 step 11 and Phase 5. Phase 1 already builds the superseding architecture. AGENTS.md says UI changes follow approved decisions.

**Correction.** Record the four owner answers from validation.md as a DECISIONS entry before Phase 1. Mark them "approved direction, not implemented".

### A16 — Medium — The effort estimate does not match the measured scope

**Evidence.** The plan estimates 33–50 days. The scope covers 105 TSX roots, a 229-file graph, a new loader dependency, two-way protocol negotiation, relay routing, the SDK of A02, durable mod data, CLI and documentation, on three clients. Phase 4 alone (all global UI, layouts, kept windows, durable data, CLI loop, docs) is given 6–9 days.

**Correction.** Make Phase 1 an explicit go/no-go spike that outputs the A02 boundary report and real per-surface export cost. Re-estimate Phases 2–5 from that before authorizing them.

### A17 — Medium — "Survives upgrades" has no fixture

**Evidence.** plan.md acceptance item 6 and Phase 5 step 4 require clone bytes to stay intact across an app upgrade "while shared compatible service fixes still apply". No phase creates an N/N+1 catalog or SDK fixture.

**Correction.** Phase 1 adds a test fixture with a version-N stock package and a version-N+1 SDK, covering compatible, additive and breaking cases. Phase 5 runs it against a real build.

### A18 — Medium — Existing asset routes are not reused

**Evidence.**
- `GET mods/file` already takes query params `id` plus `font`, `icon` or `sound` (server/mods.rs:283–340; mods.rs:233–300).
- Fonts are capped at 8 per mod, and "a changed file keeps the font it first loaded until the page reloads" (mods.ts:164–178).
- The plan adds a new `mods/package` route and new asset helpers instead.

**Correction.** Extend `mods/file` with `path` and `revision`. That keeps one exact allowlist entry on both relay sides. Make package CSS fonts replace the fixed `fonts/` loader rather than run alongside it, and handle its "kept until reload" limit.

### A19 — Low — Proposed file names break the repo's naming convention

The new files `mod-runtime.ts` and `mod-root.tsx` break the repo's camelCase/PascalCase convention (`modApp.ts`, `modHost.ts`, `ModView.tsx`). Use `modRuntime.ts` and `ModRoot.tsx`.

### A20 — Low — jsdom unit tests cannot prove the shim loader

`mod-runtime.test.ts` is described as "browser module integration tests". Vitest/jsdom cannot execute shim-mode ESM graphs, and Phase 1 already says unit mocks cannot close the gate. Label it as unit-level only.

### A21 — Low — Clone id shadowing already happens and the plan does not point to it

`clone_example` checks `EXAMPLES` before installed mods (mods.rs:835–843). A user mod named like an example cannot be cloned by its own id. A stock catalog adds many more such names. Cite this code in Phase 1 step 5 and add a test.

## Acceptance-criteria coverage (plan.md → phase checklists)

| Acceptance | Delivered by | Gap |
|---|---|---|
| 1. Every row cloneable with a regression | P5 checklist 1 | Rows are incomplete (A13) |
| 2. Deep nav / menu / chat edits | P2 s9, P3 s9, P5 s5 | Covered |
| 3. Coherent reload; stock and clone give identical assertions | P1, P5 s4 | Relay harness (A11), skew (A06) |
| 4. Authority, drafts and pending ops survive | P3, P5 s8 | A01 breaks drafts/ops at the first chat export |
| 5. Agent-only shipped-guide flow | P4 s9, P5 s5 | Types version source (A14) |
| 6. Upgrades, safe mode, old peers | P1 s5, P5 | No upgrade fixture (A17); safe mode undefined (A08) |

## Recommended plan corrections, in priority order

1. A01: exporter fails on module-scope state; move chat operation identity first.
2. A02/A16: Phase 1 becomes a spike with a generated boundary report, an owner-approved SDK tiering, and a re-estimate.
3. A05/A06: catalog lives in web dist (same origin as the SDK). Delete the committed `stock_ui/` and include manifest.
4. A07/A08: new placement value; explicit safe-mode semantics.
5. A09/A10/A18: one snapshot response per revision over the extended `mods/file`; cached digests.
6. A03/A04: TypeScript `transpileModule`; exporter rejects Vite-only forms.
7. A11/A12: real relay harness; repo-relative paths.
8. A13–A15, A17: inventory completeness, types served by the core, DECISIONS entry first, upgrade fixture.

## Unresolved questions

- Does the owner require cloning stock on a headless remote core? (This decides A05.)
- Is a two-tier SDK, with internal modules exposed as "may break", acceptable under "independent clones"? (A02)

Status: DONE
Summary: Every cited file and line range checks out. The real blockers are architectural assumptions: module-level state in presentation files breaks the chat send-identity invariant on reload, the host boundary is about the whole service layer, and headless embedding and relay asset skew are unaddressed. There is also an esbuild readability contradiction, ModsHost `place` side effects, the relay harness and the absolute paths into the main checkout. The plan needs these corrections before Cook.
