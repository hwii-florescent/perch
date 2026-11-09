---
title: Remove automatic lead notification cap
date: 2026-11-09
summary: Removed the per-run wake cutoff while preserving other run limits and terminal input safety.
---

# Remove automatic lead notification cap

## What happened
The affected lead and child both authenticated. Their inbox receipts attributed missing reports to the persisted ten-delivery cap, not identity loss after reinstall. A regression reproduced refusal at the eleventh report.

## Change and verification
Removed cap enforcement and the Settings control. Retained legacy saved/wire fields and historical counters for compatibility without enforcing them. Updated the CLI guide and current architecture/decision docs. Regression now delivers 102 reports, including coverage for old saved limits and counts.

Core and daemon suites, nine Settings UI tests, the production web build, formatting and diff checks passed. Clippy completed with warnings in untouched code; changed-path diagnostics reported no errors or warnings. The desktop was not reinstalled, and existing undelivered receipts were not replayed.

## Identity finding
Perch terminal-launch credentials and provider conversation IDs are separate. Agents typed into an original Terminal tab inherit its identity. A picker-launched agent's wrapper unsets credentials before opening its post-exit shell. A fresh conversation within the same process does not rotate Perch credentials or detach children.

## Next step
Reinstall the desktop build to activate the removal. Diagnose the separate Claude process-ancestry delivery hold if it persists.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
