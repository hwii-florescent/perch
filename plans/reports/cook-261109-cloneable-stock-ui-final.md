# Cloneable stock UI: final cook report

Date: 2026-11-09. Worktree: `use-the-ak-cook-skill-to-execute-the-cloneable-s`, uncommitted on `8a02934`, SDK 1.10.1.
Plan: [plan.md](../261108-2212-cloneable-stock-ui/plan.md). Evidence ledger:
[parity-matrix.md](../261108-2212-cloneable-stock-ui/parity-matrix.md) ("Phase 5 entries" and "Closing entry").
Commands and results: [phase 5 progress log](../261108-2212-cloneable-stock-ui/phase-05-parity-and-rollout.md#progress-log).

## Status

DONE_WITH_CONCERNS. Phases 1-4 are complete; phase 2's last three boxes closed in this pass. Phase 5's four boxes
are ticked: fault injection and the 100-edit counters closed in a later pass (item 9). Every parity row has a passing regression; the
host-owned boundary needs owner acceptance. Nothing was committed, pushed or released.

## Outcome against the plan's acceptance

| Acceptance | Result | Evidence |
|---|---|---|
| Every parity row cloneable or a justified host boundary, with a regression | Evidence complete; awaits owner acceptance of the boundary | Ledger walk S01-S24, C01-C20; S03, C14, C17 closed in the closing entry |
| Deep edits change navigation, nested dialog and chat while keeping behavior | Met | Regrouping copy (`stock-ui-clones`), nested dialog/select shells, chat/review clones, agent C14 run |
| Source/helper/CSS/assets reload coherently; stock and untouched clones pass identical assertions | Met | Phase 1 package tests, 100-edit test, `PERCH_E2E_STOCK_CLONES` matrix (stock 58 / clones 57 passed, same base failures) |
| Terminal authority, drafts, pending ops, identities, viewer isolation survive reload and faults | Met (native-chat pending ops in vitest only) | Stock/clone e2e; fault tests and `EDIT-CYCLES` in `stock-ui-clones`, the relay mid-fetch cut in `relay.check.mjs` |
| Agent-only guide/CLI flow without repository imports or user build | Met | `agent-mods.spec.ts`: status-bar copy, and the four-stage deep edit, passed twice with claude-haiku-4-5 |
| Copies survive upgrades; safe mode, recovery, old peers | Met | C02 upgrade test, `PERCH_MODS=off`, boot guard, phone opt-in/revoke, older page/core, base-path update test |

## Open items of this pass

1. **S03 regrouping clone.** "a sidebar copy regroups the sessions by agent, then project…" in Chromium and WebKit.
   SDK 1.10.1 makes `useTerminals` redraw on pins and order. Touch hold no longer clicks the menu item under the
   finger (also fixes responsive R9).
2. **C14 staged agent deep edit.** Four turns, one Haiku lead (banner checked), only `perch mod guide` and the CLI:
   regroup, fold by click/Enter/touch, nested dialog shell, chat composition; `perch mod check/dom` saved per stage,
   stock bytes unchanged, allowed imports only. Passed twice; the second needed two follow-up turns at stage 3.
   Guide step 4 now says to handle `onClick` only on buttons.
3. **C17.** The exporter runs inside `vite build`, so the service worker precaches `stock-ui/`. Under
   `/proxy/e2e/7799/` every request stays under the base, packages are never cached, offline stock loads, an edit is
   never stale, and a newer build is picked up on update. Phone: packages `no-store`, none cached, 401/403 after
   revoke.
4. **Phase 2 boxes 2-4.** Legacy folder-list unit test (`stock-ui/sidebar/content.test.tsx`, mutation-checked), the
   regrouping copies, and the existing-spec matrix on stock and untouched clones.
5. **paired-phone-flows.** The pristine baseline fails at the pairing gate (React #300) twice. The branch passes
   twice after three fixes. Recorded in `docs/TESTING.md`.
6. **Rollup circular re-export warnings.** Removed (0 warnings): `@perch/sdk` is a static import of `App.tsx`, and
   `LayoutContent` a static import in `sdk.ts`.
7. **Module-cache ceiling.** Documented in `docs/MOD-SDK.md` and `docs/ROADMAP.md`: 3 → 303 modules over 100 edits,
   cleared by reload, which is the accepted response.
8. **Statuses.** plan.md, phase 2 (completed), phase 5, the parity ledger, TESTING and ROADMAP updated.

9. **Fault injection and counters (later pass).** Six new `stock-ui-clones` tests and a relay mid-fetch cut cover
   bad assets, blocked storage, bad mod data, a revision dropped or expired mid-load, a core restart mid-swap, a
   relay drop and throwing cleanups. Each keeps the last good view or stock, says why, and loses no draft or shell.
   Three bugs were fixed. A throwing package effect cleanup unmounted the whole page; `packageReact` now reports it
   as disposal. An unreachable or no-longer-kept revision broke the copy until reload; `PackageUnavailable` now
   retries with fresh module URLs on the next mods list. The "last working version" note showed when none was.
   Over 100 edit cycles there was one of each live thing throughout, and modules grew by 4 per edit until reload.
   Details are in the last entry of the phase 5 log.

## Commands and results (this pass)

- `cargo test -p perch-core` 880 passed (+ integration ok); `cargo test -p perchd` 59 passed.
- `cargo fmt --check` clean (`rustfmt` on `agent_cli.rs` only); `cargo clippy --workspace --all-targets`: only the two
  existing warnings (`db/mod.rs:1371`, `perch-desktop/src/browser.rs:309`).
- `npm run build` ok, 0 warnings; `npm test` 146 files, 1309 passed; `npm run check:stock-ui -w @perch/web` 24 passed,
  201 files match. `npm ci` was not rerun (no dependency change since the earlier entry).
- Chromium `stock-ui-clones.spec.ts` 34/34; WebKit 33 passed, 1 skipped (Chromium-only frozen start).
- `node --experimental-strip-types e2e/relay.check.mjs`: passed in Chromium and with `PERCH_E2E_WEBKIT=1`.
- `agent-mods.spec.ts` deep edit (`-c native-composer.config.ts`): two passes, 6.7 and 5.7 min.
- Existing-spec matrix (Chromium): stock 58 passed, untouched clones 57 passed; same base failures (W2, sidebar 2d,
  N1, P1/P2 family).
- Phone set: `paired-phone-flows` two passes alone after its fixes.
- Later pass (faults and counters): `npm run build` ok, 0 warnings; `npm test` 146 files, 1317 passed;
  `check:stock-ui` 201 files match; `cargo test -p perch-core` 880 passed; `cargo fmt --check` clean; clippy only the
  two existing warnings; Chromium `stock-ui-clones` 40/40; WebKit 39 passed, 1 skipped; relay check passed in Chromium
  and WebKit.

## Remaining limitations

- Not covered by the fault work: a throwing class `componentWillUnmount`; a mount effect that throws may still let
  that revision count as rendered; a failed stock catalog fetch is not retried; core snapshot bytes are bounded by
  count (4 per package), not measured; native-chat pending operations are proven in vitest, not e2e.
- A core restart gives the same shell a new terminal id (the PID stays).
- `workspace-visual-qa` now fails later, at a `git-refresh` `:focus-visible` check whose code is unchanged from
  `8a02934` (the baseline never reaches it).
- `needs-you` N1 fails in both stock and clone modes: Claude Code 2.1.319 takes the Enter after the prompt as a
  newline.
- `device-pairing` keeps its known post-reload race.
- The precache grew to 296 entries, 5.5 MB, because the stock screens are now in it.
- The agent deep edit sometimes needs follow-up turns (bounded at two per stage, logged as `FOLLOW-UP`).
- The agent run does not itself disable and recover a copy; the C18 tests cover that.
- No release bundle was built; 322 older `perch-suite-*` temp dirs (33.5 MB, in `$TMPDIR`) remain because
  their ownership is unclear.

## Needs owner acceptance

- The host-owned list in `docs/DECISIONS.md`, entry 2026-11-09 "Terminal and dock chrome…": recovery and trust
  surfaces; terminal status text and the suggestions pill; remote and legacy terminal views; engines (dockview
  strip, browser page, file viewers, xterm, CodeMirror); desktop screens on phones stay Perch's own; placeholders.
- The stock screens in the service-worker precache (5.5 MB shell) instead of fetching them on demand.
- The guide line "handle onClick only" on buttons (agent-facing wording).
- Reload as the response to the module-cache growth (no eviction).

## Open questions

- Should a throwing class `componentWillUnmount` in a package also be caught? That needs a boundary per component.
- May the leftover `perch-suite-*` temp dirs be deleted?
- Registry: future plan; manifests already record id, publisher, version, API range, SHA-256 and install source.
