---
phase: 5
title: "Cross-client parity, recovery and release gates"
status: pending
priority: P1
effort: "5-8 engineering days"
dependencies: [4]
---

# Phase 5: Cross-client parity, recovery and release gates

## Goal and phase scout

Close every [parity matrix](parity-matrix.md) row with runtime evidence, including paired phone, and remove the transitional stock-only path for capable clients. Re-scout mobile and relay contracts, release packaging and the complete new source-selection consumer list.

## File inventory

| Action | Absolute path | Rough scope | Test impact |
|---|---|---|---|
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/MobileHeader.tsx | Responsive source package | Phone navigation |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/MobileSwitcher.tsx | Touch/keyboard source package | Narrow-screen picker |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/MobilePaneShell.tsx | Cloneable phone composition | Engine/control continuity |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/MobileFiles.tsx | Resource presentation parity | Draft/file actions |
| Modify/export | /Users/hwiii/Github/perch/packages/web/src/components/MobileKeyBar.tsx | Soft keyboard/terminal actions | Native input preservation |
| Modify | /Users/hwiii/Github/perch/packages/web/src/App.tsx | Remove special stock branch for capable clients | Stock/phone/recovery |
| Modify | /Users/hwiii/Github/perch/packages/web/vite.config.ts | Source assets/PWA cache and production-loader needs | Production build/update |
| Modify | /Users/hwiii/Github/perch/.github/workflows/release.yml | Deterministic source catalog/clean binary checks | Release artifacts |
| Extend | /Users/hwiii/Github/perch/e2e/stock-ui-clones.spec.ts | Full semantic clone matrix | Chromium/WebKit |
| Modify | /Users/hwiii/Github/perch/e2e/agent-mods.spec.ts | Real agent deep stock clone | Approved cheap model |
| Modify | /Users/hwiii/Github/perch/e2e/playwright.config.ts | Ensure spec registration | Discovery |
| Modify | /Users/hwiii/Github/perch/docs/TESTING.md | Commands and evidence limits | Link/command checks |
| Modify | /Users/hwiii/Github/perch/docs/DECISIONS.md | Accepted mod-first contract | No false release certification |
| Modify | /Users/hwiii/Github/perch/docs/ARCHITECTURE.md | Final ownership/source contracts | Cross-reference check |
| Modify | /Users/hwiii/Github/perch/docs/ROADMAP.md | Evidence-backed remaining work | No unchecked parity claims |
| Create at execution | /Users/hwiii/Github/perch/docs/evidence/mod-first-ui/ | Redacted retained release evidence | Matrix row proof |

## Requirements and implementation steps

1. Export mobile header/switcher/panes/files/key bar and their descendants through the same JS/SDK contract, with phone-specific layouts composed from the shared system. Customization must not be a desktop-only branch. Retain touch long-press/reorder, narrow width, safe areas, software-keyboard/composer visibility and explicit file/exec capability differences.
2. Prove direct LAN and encrypted relay module/helper/lazy/CSS/font/image requests, including token revocation and reconnection. Test relative deployment base paths, cached PWA shell/new core version and selected source/API mismatch. Do not leak source requests to relay-origin static fallbacks or place credentials in URLs.
3. Ensure every new-client presentation entrypoint resolves the source selection: stock/custom layouts, global openers, mixed resource tabs, drawer, mobile and native chat. Retain compiled stock only for verified recovery/older peers where required; it is not the primary new-client path. Inventory all remaining compiled stock uses and justify each engine/recovery exception.
4. Expand real stock/untouched-clone behavior tests across all matrix families. Add a second simultaneous instance, two independent viewers and restart/update scenarios. Test cloned code stays byte-identical across an upgrade while shared compatible service fixes still apply.
5. Run a real approved agent from an isolated project using only shipped guide/types/CLI: clone and select WorkspaceOverview/tab UI, materially change grouping/hierarchy and one keyboard/touch interaction, change a nested dialog/menu and chat composition, inspect exact-instance diagnostics/screenshots, then disable and recover. No repository-source imports, hidden fixture API or user Node install may be required. A visual label change is insufficient.
6. Fault-inject parse/import/initial/later render failures, delayed stale generations, malformed assets, blocked capabilities, cleanup errors and interrupted network/source updates. For an infinite loop, use a disposable headless browser with a timeout and prove core-side disable plus fresh launch recovers; do not claim the hung thread can receive the reset key.
7. Measure 100 reload cycles with counters for active handlers/subscriptions/engines and core snapshot bytes; inspect browser memory slope with caveats. Report cache ceilings and stale-revision eviction. Never auto-reload over unsaved/in-flight work.
8. Confirm terminal process identity, dimension lease/native input, draft recovery/conflicts, native pending-operation reconciliation and remote unavailable behavior during the full flow. Reuse actual service invariants, not only DOM assertions.
9. Verify source catalog reproducibility and packaging from clean checkout. Headless core can serve/clone complete source without Node/web dist; desktop and web ship matching SDK/source versions. CI must test source artifact drift and both protocol types.
10. Amend parity-matrix.md with exact test id, command, revision/client and artifact per row. All rows must be passing or explicitly retained as blockers; do not redefine completion around unverified or unsupported functionality.
11. Document supported host API compatibility and independent-clone maintenance; remove obsolete blanket equivalence claims. Retain originals/drafts during migrations. No database changes without backup and a restore check.
12. Before release, independently review no-new-warnings and security/authority regressions. Preserve unrelated branch changes and stop on unexpected installed-app state access.

## Scenario matrix

| Priority | Scenario | Mechanical pass |
|---|---|---|
| Critical | Same source contract desktop/browser/phone/relay | All selected clones execute and retain functionality, not merely fit screen |
| Critical | Two viewers + same-mod duplicate instances + restart | Intentional state sharing only; stable resource identities |
| Critical | Hung user module recovery | External disable and fresh isolated launch load verified stock |
| Critical | Draft/pending operation/terminal during 100 edits | No lost work, duplicate dispatch or process restart |
| High | Old client/core and version mismatch | Negotiated legacy path or explicit incompatibility; no unknown-format execution |
| High | App upgrade/PWA cached SDK and independent clone | No overwrite, no mixed incompatible graph, visible next action |
| High | Touch/soft keyboard/narrow layout/a11y | Existing behavior preserved and focused new assertions pass |
| Medium | Cache/storage/network limits | Bounded explicit failures; retention budgets documented |

## Verification

Follow docs/TESTING.md: headless only, private HOME and PERCH_DB/PERCH_HOSTS/PERCHD_DIR/PERCH_SETTINGS, no installed daemon. Existing configs provide isolation; verify any new spawn uses fixtureRuntimeEnv. Retain evidence outside e2e/artifacts before another run wipes it.

- `node packages/web/scripts/export-stock-ui.mjs --check`
- `cargo test -p perch-core`; `cargo test -p perchd`
- `npm ci && npm run build`; `npm test`
- `cargo fmt --check`; `cargo clippy --workspace --all-targets` (no new warnings).
- `(cd e2e && npx playwright test stock-ui-clones.spec.ts mods.spec.ts responsive.spec.ts paired-phone-flows.spec.ts)`
- `(cd e2e && PERCH_E2E_WEBKIT=1 npx playwright test --project=webkit stock-ui-clones.spec.ts)`
- `(cd e2e && npx playwright test -c native-composer.config.ts agent-mods.spec.ts --workers 1)` runs the real-agent acceptance. The existing config explicitly registers this spec (`native-composer.config.ts:4`); confirm discovery before a paid turn. Keep paid-agent tests out of the ordinary deterministic clone spec.
- Real agent turns use only `claude-haiku-4-5` or `gpt-5.6-luna`; verify actual banner before prompting. Do not install absent OpenCode.
- Native desktop smoke/probes must obey headless/non-activation restrictions. Browser screenshots do not prove OS child-webview focus, compositor capture or hardware IME; retain such limitations for explicit manual release sign-off.

## Checklist, exit and risks

- [ ] All parity rows have runtime evidence on their required clients.
- [ ] Agent deep-clone workflow succeeds without repository imports or user build.
- [ ] All resource/authority/durability and failure/recovery gates pass.
- [ ] Clean source/build/release and old-peer compatibility gates pass.
- [ ] Docs state actual capabilities and remaining release limitations truthfully.

Depends on Phase 4. Completion requires the full requested customization scope, not just Phase 2's sidebar. No automatic release, commit or push is authorized by this planning request.
