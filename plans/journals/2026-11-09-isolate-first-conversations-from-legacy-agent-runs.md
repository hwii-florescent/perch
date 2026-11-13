---
title: Isolate first conversations from legacy agent runs
date: 2026-11-09
summary: "Prevent an unrecognized provider conversation from adopting a legacy tab's old children and queued reports."
---

# Isolate first conversations from legacy agent runs

## Cause

A surviving legacy terminal still used the tab ID as its run. Its first observed Pi conversation was treated like the first snapshot of a recorded launch, so it inherited children and notes from earlier work. Live Perch CLI output confirmed the stale association; two focused tests reproduced the ownership and delivery failures.

## Repair

`crates/perch-core/src/db/agent_runs.rs` now starts a fresh run for an unrecognized conversation on the legacy tab-ID fallback. Recorded-launch first snapshots, child conversation resets, known resumes and reconnects retain their existing behavior. No schema changes, live database edits, process stops or desktop reinstall.

Added ownership/resume and queued-report/message regressions; extended the actual old-database migration test and the launch-before-first-snapshot test. Updated `docs/ARCHITECTURE.md`.

## Verification

- Before repair: both `a_legacy_leads_first_conversation` regressions failed.
- After repair: both passed; `cargo test -p perch-core` passed 907 tests, with 2 intentional ignores.
- `cargo fmt --check`, `git diff --check` and the web TypeScript check passed.
- `cargo clippy -p perch-core --all-targets` completed with one warning in unchanged `db/mod.rs` test code; no new warning in the changed code.
- Active LSP checks found no errors. The unrelated cached ModsSection cascade is absent, and the TypeScript compiler passed.

## Limits

The installed app is unchanged. Already-recorded legacy conversation associations are not rewritten; after updating the core, a fresh conversation establishes the clean boundary. Existing children and reports remain for the person to manage. The earlier settings-input layout fix remains separate and uncommitted.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
