---
title: "Cloneable stock UI with Herdr-level customization"
description: "Make Perch's real shipped interface independently cloneable and deeply editable as live JavaScript across desktop, web and phone."
status: pending
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

**Mode:** deep; HOLD SCOPE. **Delivery:** plan only; implementation not started.
**Architecture:** [design and outcome contract](design.md).
**Completion authority:** [capability and stock-surface parity matrix](parity-matrix.md).
**Owner decisions and review:** [validation log](validation.md).

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Source packages, shared runtime and safe reload](phase-01-start.md) | Pending |
| 2 | [Cloneable navigation, tabs and pane chrome](phase-02-navigation.md) | Pending |
| 3 | [Files, review, chat and terminal composition](phase-03-resource-surfaces.md) | Pending |
| 4 | [Global UI, layouts and agent workflow](phase-04-app-chrome.md) | Pending |
| 5 | [Cross-client parity, recovery and release gates](phase-05-parity-and-rollout.md) | Pending |

Sequential dependencies: 1 → 2 → 3 → 4 → 5. Five phases separate high-risk loader, navigation, resource ownership, global routing and cross-client release gates; this is not a parallel file-ownership plan. Re-scout each phase before execution.

## Confirmed decisions

- Full customization surface; retain Perch's own domain and existing functions.
- Plain JS/CSS with no user compiler, bundler or app rebuild.
- Independent clones; provenance and compatibility, never automatic upstream merge.
- Desktop, browser and paired phone, including encrypted relay.
- Keep React/Tauri; export real stock TSX to readable modules at release time.
- Proposed loader dependency: pinned es-module-shims, subject to Phase 1 singleton/relay/CSP proof.

## Acceptance

- [ ] Every parity row has a cloneable implementation or a narrowly justified host-engine boundary, with a passing regression.
- [ ] Deep edits change real navigation, nested menu/dialog and chat/resource composition while retaining behavior.
- [ ] Source/helper/CSS/assets reload coherently; stock and untouched clones pass identical assertions.
- [ ] Terminal authority, drafts, pending operations, remote identities and viewer isolation survive reload and faults.
- [ ] Agent-only shipped-guide/CLI flow succeeds without repository imports or user build.
- [ ] Independent copies survive upgrades; safe-mode/recovery and old-peer compatibility work.

## Boundaries and dependencies

No renderer rewrite, sandbox/approval redesign, marketplace, automatic merges, package-manager migration, unrelated Herdr runtime feature port or automatic release. Reuse existing mod/layout services, stores, daemon, xterm, CodeMirror and native integrations.

The existing machine-add plan is not a prerequisite; use its current semantic services without taking over its deferred transport work. Preserve dirty native-chat/sidebar work. Follow [testing and isolation](../../docs/TESTING.md).

## Red Team Review

Three independent reviewers failed at the provider usage limit before producing findings. Parent-led evidence review corrected five material gaps: Phase 1 test sequencing, two-way format negotiation, hidden-instance ownership/source callers, complete resource queries, and React reload effect ownership. Findings and code evidence are recorded in [validation.md](validation.md). **Independent review remains blocked; this plan is not execution-ready.**

## Validation Log

Four material owner choices confirmed; see exact questions/answers in [validation.md](validation.md). Schema validation passed; parsing found five phases and 25 unchecked tasks. The parent consistency sweep and local link/inventory/command-path checks passed. The parity contract covers 24 stock surfaces and 20 runtime capabilities, all pending delivery. Source research and planning checks are not runtime verification.

## Handoff

Next complete independent evidence-backed review and adjudication, for example `/ak-plan red-team /Users/hwiii/Github/perch/plans/261108-2212-cloneable-stock-ui/plan.md` when the review provider is available. Do not rerun the failed route blindly.

Only after that gate and explicit implementation authorization, execute one phase at a time with `/ak-cook /Users/hwiii/Github/perch/plans/261108-2212-cloneable-stock-ui/plan.md`. No implementation is authorized by creating this plan. A local [session journal](../journals/2026-11-09-cloneable-stock-ui-planning-and-review-corrections.md) records the planning history; it does not approve the architecture or release.
