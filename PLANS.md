# PLANS.md — follow-up work

Snapshot: 2026-08-03, branch `herdr-parity`. This file tracks work that was
deliberately stopped mid-stream or deferred; `PLAN.md` remains the phase-by-phase
record of completed work.

**Item 1 (Hosted-mode power features / composer UI) is DONE** — landed as Phase 7,
see `PLAN.md`. The section that used to sit here has been removed rather than
marked done; `PLAN.md` is the record.

## Open items

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
- **Cross-session event delivery is unfiltered on the server** (found 2026-08-03)
  — the hub forwarder (`server.rs`, `hub.subscribe_events`) relays every
  detached-turn event to *every* connection regardless of which session it
  belongs to. The client now guards against this (`adoptStreamingMessage`
  returning false, plus the `chat.done` session check), so nothing is
  user-visible, but the correct long-term fix is to stop broadcasting a
  session's `chat.*` to clients that don't have it open.
- **jean-parity backlog** (earlier menu, untouched): @-file mentions, AI commit
  messages / PR descriptions, MCP support, GitHub #-issue mentions, worktree
  auto-cleanup.
