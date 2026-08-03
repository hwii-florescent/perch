# PLANS.md — follow-up work

Snapshot: 2026-08-03, branch `herdr-parity`. This file tracks work that was
deliberately stopped mid-stream or deferred; `PLAN.md` remains the phase-by-phase
record of completed work.

**Item 1 (Hosted-mode power features / composer UI) is DONE** — landed as Phase 7,
see `PLAN.md`. The section that used to sit here has been removed rather than
marked done; `PLAN.md` is the record.

## Open items

- **CLI-only sessions are invisible in the nav** — `db.rs::list_sessions`
  requires ≥1 hosted message; a CLI-mode-only session never qualifies. Needs a
  deliberate fix (loosening the query also surfaces the blank session minted on
  every connect — design first).
- **Detached recovery live-update wart** — a page attached during the
  few-second recovery window doesn't live-update until reopened (fresh pages
  always render correctly).
- **Tauri `Perch.app` bundle** — unblocked now that boot adopts the login-shell
  PATH; build the bundle and verify a Finder launch end-to-end (codex auth
  included).
- **hosts.json cleanup** — the two configured devpods were deleted by the user;
  replace with `dev-agent.devpod-us-or` (mode `direct`).
- **`codex` is not installed on this Mac** (2026-08-03) — absent from
  `~/.local/bin`, off PATH, and not visible to the login shell, contrary to
  CLAUDE.md's toolchain note. Every codex-dependent e2e test skips or fails
  until it's reinstalled (`chat-power.spec.ts` P4 skips cleanly by design).
  Environment drift, not a code defect.
- **Repo hygiene** — `cargo fmt --check` fails repo-wide on pre-existing hunks;
  `ssh::tests::mux_control_path_stays_under_the_macos_sun_path_limit` is flaky
  in the full suite (another test mutates `HOME`; `control_dir()` is a
  `OnceLock`) — fix the test-order race or the clipboard test.
- **jean-parity backlog** (earlier menu, untouched): @-file mentions, AI commit
  messages / PR descriptions, MCP support, GitHub #-issue mentions, worktree
  auto-cleanup.
