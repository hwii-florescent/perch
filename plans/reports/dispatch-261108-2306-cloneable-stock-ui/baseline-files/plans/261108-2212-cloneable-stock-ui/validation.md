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
