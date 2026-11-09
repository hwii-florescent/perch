---
title: Cloneable stock UI planning and review corrections
date: 2026-11-09
summary: "Scoped full no-build customization parity, authored five phases, and retained the unavailable independent-review gate."
---

# Cloneable stock UI planning and review corrections

## What happened

Created the planning-only contract at `plans/261108-2212-cloneable-stock-ui/plan.md`. The owner confirmed full Herdr customization parity, plain JavaScript without a user build, independent copies, and desktop/browser/paired-phone support. Source research covered Perch's current dirty tree and a pinned Herdr revision; neither application was run.

## Decision

Keep React/Tauri and Rust/domain authority. Export actual stock presentation graphs as readable release-generated JS/CSS/assets; stock and clones use one runtime and shared host services. Reject opaque component wrappers, automatic copy upgrades, and renderer migration as solutions to UI ownership.

Parent review corrected a Phase 1 test dependency cycle, missing client opt-in for React formats, hidden-instance ownership, incomplete terminal/resource queries, and unsafe reuse of hidden-mounted reload staging. The revised matrix contains 24 surface and 20 runtime capability rows, all pending implementation.

## Verification and limitation

Plan schema validation passed; parsing found five phases and 25 unchecked implementation tasks. Static checking found 21 valid local links and 76 inventory paths, accounting for declared new files. A first disposable path checker matched `.ts` prefixes of `.tsx` and produced false positives; the corrected checker passed without changing application code.

Three independent reviewers failed with a provider Subscription Sharing usage-limit error and produced no findings. Parent review is not independent red-team approval. No application implementation, installs, app tests, paid agent turns, commits, pushes, database changes, or runtime probes were performed.

## Next steps

Complete independent security/failure/assumption review when an authorized provider is available, adjudicate findings, then explicitly authorize phase-by-phase implementation. Preserve existing sidebar/native-chat changes. The plan is not yet execution-ready.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
