---
title: "Cloneable stock UI with Herdr-level customization"
description: "Make Perch's real shipped interface independently cloneable and deeply editable as live JavaScript across desktop, web and phone."
status: completed
priority: P2
effort: "33-50 engineering days; planning estimate, not a commitment"
branch: main
tags: [feature, refactor, frontend, api]
blockedBy: []
blocks: []
created: 2026-11-08
---

# Cloneable stock UI with Herdr-level customization

## Overview

Agents clone the real shipped UI implementation, change structure and interactions, and run it live without a user build. Stock and clones execute the same readable JS modules and shared React/services. Preserve every existing Perch function and reach full Herdr-app **customization** parity, not unrelated product parity.

**Mode:** deep; HOLD SCOPE. **Delivery:** implemented through phase 5 in the uncommitted working tree on `8a02934` (SDK 1.10.1); not committed or released. Final report: [cook-261109-cloneable-stock-ui-final](../reports/cook-261109-cloneable-stock-ui-final.md).
**Architecture:** [design and outcome contract](design.md).
**Completion authority:** [capability and stock-surface parity matrix](parity-matrix.md).
**Owner decisions and review:** [validation log](validation.md).

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Source packages, shared runtime and safe reload](phase-01-start.md) | Completed |
| 2 | [Cloneable navigation, tabs and pane chrome](phase-02-navigation.md) | Completed |
| 3 | [Files, review, chat and terminal composition](phase-03-resource-surfaces.md) | Completed |
| 4 | [Global UI, layouts and agent workflow](phase-04-app-chrome.md) | Completed (desktop; host-owned list awaits owner acceptance) |
| 5 | [Cross-client parity, recovery and release gates](phase-05-parity-and-rollout.md) | In progress (all boxes ticked; box 1's host-owned boundary awaits owner acceptance) |

Sequential dependencies: 1 → 2 → 3 → 4 → 5. Five phases separate high-risk loader, navigation, resource ownership, global routing and cross-client release gates; this is not a parallel file-ownership plan. Re-scout each phase before execution.

## Confirmed decisions

- Full customization surface; retain Perch's own domain and existing functions.
- Plain JS/CSS with no user compiler, bundler or app rebuild.
- Independent clones; provenance and compatibility, never automatic upstream merge.
- Desktop, browser and paired phone, including encrypted relay.
- Keep React/Tauri; export real stock TSX to readable modules at release time.
- Proposed loader dependency: pinned es-module-shims, subject to Phase 1 singleton/relay/CSP proof.

## Acceptance

- [ ] Every parity row has a cloneable implementation or a narrowly justified host-engine boundary, with a passing regression. (Every row now has a passing regression, including S03 regrouping, C14's full deep edit and C17 base path/service worker; stays open until the owner accepts the host-owned list in DECISIONS 2026-11-09.)
- [x] Deep edits change real navigation, nested menu/dialog and chat/resource composition while retaining behavior. (Sidebar, tabs, nested `stock:dialog`/`stock:select` shells, chat and review clones; parity ledger phases 2-4.)
- [x] Source/helper/CSS/assets reload coherently; stock and untouched clones pass identical assertions. (Phase 1 package tests, 100-edit test, every stock-ui-clones test.)
- [x] Terminal authority, drafts, pending operations, remote identities and viewer isolation survive reload and faults. (Reload: the stock/clone e2e. Faults, phase 5: bad assets, blocked storage, bad mod data, a revision dropped or expired mid-load, a core restart mid-swap, a relay drop mid-fetch and throwing cleanups each keep the last good view or stock, say why and lose no draft or shell; 100 edits of a package holding a terminal, a draft, timers and tracked work keep one of each live. Chromium and WebKit. Native-chat pending operations are proven in vitest, not e2e.)
- [x] Agent-only shipped-guide/CLI flow succeeds without repository imports or user build. (Phase 5: claude-haiku-4-5 with only `perch mod guide` and the CLI clones, edits and verifies `stock:status` live, and in a staged four-turn run regroups a sidebar copy by agent, makes its groups fold by click/Enter/touch, edits the dialog shell a nested Instructions dialog uses and the chat it talks through; passed twice, stock bytes unchanged.)
- [x] Independent copies survive upgrades; safe-mode/recovery and old-peer compatibility work. (Phase 5: newer-catalog and API-range test, `PERCH_MODS=off` test, boot guard, phone opt-in/revoke, older page and older core.)

## Boundaries and dependencies

No renderer rewrite, sandbox/approval redesign, marketplace, automatic merges, package-manager migration, unrelated Herdr runtime feature port or automatic release. Reuse existing mod/layout services, stores, daemon, xterm, CodeMirror and native integrations.

The existing machine-add plan is not a prerequisite; use its current semantic services without taking over its deferred transport work. Preserve dirty native-chat/sidebar work. Follow [testing and isolation](../../docs/TESTING.md).

## Red Team Review

Three independent reviewers failed at the provider usage limit before producing findings. Parent-led evidence review corrected five material gaps: Phase 1 test sequencing, two-way format negotiation, hidden-instance ownership/source callers, complete resource queries, and React reload effect ownership. Findings and code evidence are recorded in [validation.md](validation.md). **Independent review completed 2026-11-08 (56 findings, see validation.md); corrections and owner decisions are appended to each phase. Re-confirm the gate before Phase 1.**

## Validation Log

Four material owner choices confirmed; see exact questions/answers in [validation.md](validation.md). Schema validation passed; parsing found five phases and 25 unchecked tasks. The parent consistency sweep and local link/inventory/command-path checks passed. The parity contract covers 24 stock surfaces and 20 runtime capabilities; their delivery evidence is the ledger in [parity-matrix.md](parity-matrix.md) (planning-time note: all were pending then). Source research and planning checks are not runtime verification.

## Handoff

Phases 1 to 5 were executed with `/ak-cook` in this worktree (uncommitted). What remains open is listed in the
phase 5 checklist and the [final report](../reports/cook-261109-cloneable-stock-ui-final.md); the host-owned boundary
in `docs/DECISIONS.md` (2026-11-09 entries) needs owner acceptance. No commit, push or release is authorized by this
plan. A local [session journal](../journals/2026-11-09-cloneable-stock-ui-planning-and-review-corrections.md) records
the planning history.

## Completion record (2026-11-09)

All five phases are delivered and every checklist box is ticked with passing regressions (see [final report](../reports/cook-261109-cloneable-stock-ui-final.md)). Delivery is complete under this plan's own definition: every parity row has a cloneable implementation with a passing regression or a narrowly justified host-engine boundary, recorded with evidence in docs/DECISIONS.md.

Owner decisions on the review items (2026-11-09, from the user): the host-owned boundary list in docs/DECISIONS.md is accepted; stock screens stay cached in the PWA shell; chat Markdown keeps `style`/`class`; the leftover `perch-suite-*` temp directories were deleted (328 removed from $TMPDIR). A throwing class `componentWillUnmount` in a package remains a documented limitation. Nothing is committed; review `git status` (a staged rename of components/ui/select.tsx beside an untracked route file) before committing.
