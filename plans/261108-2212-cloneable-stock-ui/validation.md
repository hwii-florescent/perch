# Validation and review log

## Owner validation — 2026-11-08

Trigger: material scope, authoring, upgrade and client choices before final architecture. Four questions asked; all four answered. No autonomous implementation requested.

1. **[Scope] Should “Herdr-level parity” cover the complete customization surface, while retaining Perch’s own project/session model rather than reproducing every unrelated Herdr feature?**
   - Options: Full customization parity (Recommended) | Full app feature parity.
   - Answer: **Full customization parity (Recommended)**.
   - Rationale: full UI/mod capability inventory is required; unrelated product/runtime ports are not.
2. **[Architecture] What source-editing experience should cloned stock UI provide?**
   - Options: Plain JS, no build (Recommended) | JSX/TSX, no external toolchain | JSX/TSX with CLI build.
   - Answer: **Plain JS, no build (Recommended)**.
   - Rationale: readable release-generated JS from stock TSX; no runtime compiler or user build.
3. **[Upgrade] What should happen to a customized clone when Perch updates its shipped panel?**
   - Options: Independent copy (Recommended) | Offer manual upstream comparison | Automatic merge.
   - Answer: **Independent copy (Recommended)**.
   - Rationale: copies are never overwritten; retain provenance/API requirements rather than adding merge machinery.
4. **[Clients] Where must the new mod-first UI work at completion?**
   - Options: Desktop, web, phone (Recommended) | Desktop and browser | Desktop only.
   - Answer: **Desktop, web, phone (Recommended)**.
   - Rationale: same contract plus responsive composition and capability reporting; paired relay included.

These decisions apply to design.md and all five phases. No custom free-text answer was supplied.

## Research provenance

- Perch tree: HEAD 8a02934e9b3b7743f6377cb41ce6dedfd1cb1807 plus existing dirty/untracked changes.
- Herdr: pinned b721deda985270ec8256552692729a4add389b2a, 2026-11-08T21:25:59Z. Older local reference 7fe7ac34... differs in seven paths over three commits; changed source was fetched/checked.
- Read-only Explore audit covered current stock UI/state/authority/source-selection and test paths.
- Read-only researcher audit covered 21 mods, 5 frames, 3 layouts and capability/ownership semantics. Final addendum and earlier full response were both read; the latter was recovered from retained output after a queued follow-up changed the final artifact.
- All runtime claims remain unverified. No app/core/daemon launch, test, paid turn, install or source-code change was performed for this plan.

## Red-team review

**Independent gate: blocked, not passed.** The Security Adversary, Failure Mode Analyst and Assumption Destroyer/Contract Verifier children all failed before returning findings. Provider error: “The ChatGPT user has reached their Subscription Sharing usage limit. Ask the user to try again after their usage limit resets or use an API key instead.” Workflow: `a89c98cd-e231-461f-b134-7fa3f4bc4dc3`. No reviewer findings or approval exist. The owner then said “keep going”; planning continued, not implementation or a silent provider/CLI substitution.

### Parent-led evidence review and dispositions

These are author corrections, not an independent red-team pass. Severity describes risk if the earlier draft were implemented unchanged.

| ID | Severity | Finding and evidence | Disposition in revised plan |
| --- | --- | --- | --- |
| R01 | High | Phase 1 required browser/relay proof but created its test only in Phase 2. Exact discovery is required by `e2e/playwright.config.ts:34`. | Create/register stock-ui-clones.spec.ts in Phase 1; Phase 2 extends it. Direct WebKit and actual authenticated relay are exit gates. |
| R02 | High | A server capability does not identify an old client's loader. `protocol.rs:1404–1406` has no client opt-in; `server/mods.rs:721–742,779–781` returns an unfiltered state on both list/set; `components/ModView.tsx:14–21` invokes the imperative loader. | Add optional accepted formats/API to mods.list, preserve negotiation per connection and filter both replies/layout visibility. Include `server/dispatch.rs:293–310` in the file/caller inventory. Test simultaneous old/new clients, without rewriting their shared files. |
| R03 | High | Hidden DOM is not retained logical ownership: `components/LayoutRoot.tsx:162,184–191` returns null for hidden nodes and renders only the active stack child; `components/ModView.tsx:14–16` stops on unmount. A separate dock path exists at `dockview/DockviewShell.tsx:192–205`. | Define stable host instance ownership separately from presentation visibility; retain hidden instance state/tasks and gate visible keys/engine observations. Add DockviewShell/controller caller coverage to Phase 2. |
| R04 | High | The convenience model is incomplete for full customization: `modApp.ts:342–352` lists only terminal-provider sessions and reads/sends through on-screen elements; `modApp.ts:396` returns a layout name, not its tree. | Require complete typed layout/focus/terminal inventory queries alongside backward-compatible convenience methods, explicit host-qualified targets and authoritative unavailable state. Add C20 and Phase 1/3 implementation and regression requirements. |
| R05 | High | Reusing imperative hidden staging can activate two trees: `modApp.ts:460–476` mounts the next implementation before cleaning up the old one. Normal React effects would run in a hidden mounted candidate. | Do not mount a second live React tree for validation. Import/prepare then transition through one instance boundary, retire owned effects before new activation, keep engines outside replaceable roots and restore last-good code using stable host state. Preserve the stated trusted-code/side-effect recovery ceiling. |

Evidence paths abbreviated above: web under `packages/web/src/`, Rust under `crates/perch-core/src/`. Each disposition has been checked across design, phase dependencies and parity requirements. None is claimed runtime-proven. Independent security/failure/assumption review must still adjudicate these contracts and any further findings before execution.

## Plan verification

- `ak plan validate plans/261108-2212-cloneable-stock-ui --json`: valid, no schema errors.
- `ak plan parse ... --json`: five pending phases, 25 unchecked implementation tasks, zero completed.
- Static local-link/inventory/command-path check: nine plan Markdown files, 22 local links, 76 unique inventory paths, zero missing/broken references after accounting for ten declared new files/directories and prior-phase outputs.
- Concrete existing test/config paths in command blocks were checked for existence; planned new tests/scripts are explicitly deliverables, not claimed executable today. No test was invoked or discovery/build/runtime success inferred from path existence.
- The first disposable checker incorrectly matched `.ts` prefixes in `.tsx` filenames and treated a prose Vite filename as an e2e config. Its corrected, command-block-scoped version passed; no project or skill code was changed to satisfy the checker.
- Generated Markdown edits returned clean Markdown diagnostics. Source/header/caller and final document reads, not stale graph-cache results, were used for these parent corrections.

## Whole-plan consistency sweep

Parent sweep completed across all nine documents: the same four owner decisions, stock/clone executable-source boundary, complete source-selection coverage, five sequential phases and 24 surface/20 runtime capability rows are consistent. Implementation checklists and parity delivery rows remain pending. The test dependency cycle was removed; no source-code changes or runtime verification were performed.

**Readiness: authored and parent-checked; independent review blocked. Not execution-ready.** The next action is to complete the independent gate using an authorized available provider, not to start Cook. After that review and any corrections, the owner may authorize phase-by-phase implementation. The journal is local history, not product decision authority.

## Independent review — 2026-11-08 (native Claude Code reviewers, Sonnet 5.5 session)

**Gate: review completed; plan NOT execution-ready until the owner decisions below are made.** Three fresh read-only reviewers returned reports (all claims cited to repo file:line):
- Security: [review-security-cloneable-stock-ui.md](../reports/review-security-cloneable-stock-ui.md) — 12 findings (3 High).
- Failure modes: [review-failure-modes-cloneable-stock-ui.md](../reports/review-failure-modes-cloneable-stock-ui.md) — 23 findings (1 Critical, 10 High).
- Assumptions/contracts: [review-assumptions-cloneable-stock-ui.md](../reports/review-assumptions-cloneable-stock-ui.md) — 21 findings (2 Critical, 10 High).

### Adjudication

Applied now: absolute inventory paths rewritten to the worktree (A12/FM path finding). All other findings are accepted as valid and must be folded into the phase documents before Phase 1; none is rejected. Accepted without owner input (plan edits pending): module-level draft/operation-id state must move to host-owned stores before the first reload (A01, FM-01, FM-02); hold code swap while tracked work is pending (FM-01); use TypeScript `transpileModule`, not esbuild, to keep `//!` headers (A03); handle Vite-only imports in the exporter (A04); one snapshot fetch per revision (A09, A10); relay harness is `e2e/relay.check.mjs` (A11, FM-05); stock gets its own id namespace and clones never shadow it (SEC-02); sanitizers (DOMPurify renderers) stay fixed built-ins (SEC-03); exact-lookup package serving with nosniff (SEC-08); stock must stay available in safe mode (A08, FM-03); decisions doc amended in Phase 1, not 4 (A15); parity matrix gains ContextBridge, browser pane, CloseAgentGuard, pairing, empty/recovery UI (A13); SHA-256 revision hash (SEC-10); stock packages must not auto-open or run hidden (A07).

### Owner decisions required (block execution)
1. SEC-01: may mods run on relay phones given credentials live in localStorage there? Opt-in per phone vs. revoke-on-disable.
2. SEC-06: may agents read/type into other sessions' terminals via `perch mod do`?
3. A02: is the large internal-module surface (79 files for the sidebar alone) an acceptable "may break" SDK tier under independent clones?
4. A05: is stock cloning needed on a headless remote core, or may the catalog ship only in web dist?
5. SEC-01-adjacent: 300-file/8 MiB clone cap vs. full stock packages.

## Owner decisions on review blockers — 2026-11-08 (23:28 ET, from the user)

Herdr evidence: pinned local reference `/private/tmp/perch-herdr-reference` @ ee5bfb5 (docs/next/CHANGELOG.md, src/app/api/plugins/).

| Review item | Owner answer | Herdr evidence / resulting rule |
| --- | --- | --- |
| SEC-01 (mods on relay phones) | Phone mods are made specifically for the phone; the phone does not reuse the desktop design. | Phone gets its own phone-form mod set/layout. Still to settle in the phase edit: the relay phone's `localStorage` credentials stay reachable by any phone mod, so keep phone mods opt-in per phone and never serve desktop mods there. |
| SEC-06 (agent terminal access) | Yes, if Herdr does it. | Herdr does: `pane read`, `pane send-keys`, `agent send-keys`, `pane wait-output` over its socket API (CHANGELOG lines 218, 294, 318, 335, 1288). Agents may read/send to terminals, but only through explicit host-qualified targets and the per-session token rule in ARCHITECTURE.md, with a regression for remote-id collisions. |
| A02 (SDK surface) | Base it on Herdr's. | The public mod surface is Herdr-style: a documented, versioned plugin/action/pane API, not the ~79 internal sidebar files. Internal modules are not a public contract. Phase 1 must reconcile this with "clone the real stock TSX graph" (stock exports may import only the documented surface or ship inside the clone). |
| A05 (headless remote core) | Stock cloning is for the current device only; remote hosts are for code editing and running sessions. | Catalog ships in web dist for the local device; the headless core does not embed or serve stock packages. Remote hosts are out of scope for clones. |
| Clone size cap | Copy Herdr's decision. | Herdr has no package-copy size cap (only plugin command output 64 KiB, 32 in flight, 120-char ids: `plugins/runtime.rs:11-12`, `manifest.rs:8-9`). Remove the 300-file/8 MiB clone cap for stock-sized packages; keep a sanity limit and the per-command output cap. |

Still pending after these answers: fold the accepted findings from the three review reports into the phase documents and re-check the gate before Phase 1.

## Owner decision — SDK scope (2026-11-08, 23:33 ET)

The user confirmed: use a small, versioned, Herdr-app-style API as the only public surface, because Perch must eventually exceed Herdr and support community plugins. A bridge exposing internal app modules (A02 option 2) is rejected. Shipped stock screens, user clones and community plugins use the same API; stock screens must stop importing app internals. The API grows per stock surface across phases; Phase 1 defines its core and proves one shipped panel runs on it alone. Community plugin sharing is folder/git install for now; a registry/marketplace remains a non-goal unless the owner says otherwise (question asked, unanswered).

## Owner decision — registry (2026-11-08)

A plugin registry is a future plan, not built now. The current design must not need refactoring to add it: packages carry a stable id, publisher/origin, version, API range, content digest and provenance in their manifest; installation goes through one source-agnostic install step (folder and git URL today, registry later behind the same step); installed packages record their source and digest; and nothing assumes a package came from a local folder. No registry UI, index or hosting is built in this plan.
