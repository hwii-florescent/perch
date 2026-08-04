# PLANS.md — follow-up work

Snapshot: 2026-08-04, branch `main`. This file tracks work that was
deliberately stopped mid-stream or deferred; `PLAN.md` remains the phase-by-phase
record of completed work.

**Item 1 (Hosted-mode power features / composer UI) is DONE** — landed as Phase 7,
see `PLAN.md`. The section that used to sit here has been removed rather than
marked done; `PLAN.md` is the record.

## Open items

- **Tauri `Perch.app` bundle** — unblocked now that boot adopts the login-shell
  PATH; build the bundle and verify a Finder launch end-to-end (codex auth
  included).
- **Cross-session event delivery is unfiltered on the server** (found 2026-08-03)
  — a detached turn outlives the connection that started it, so `DetachedSink::emit`
  broadcasts on `hub_events_tx` and the per-connection forwarder (`server.rs`,
  the `hub.subscribe_events()` task) relays every event to *every* client
  verbatim. A client viewing session A therefore receives session B's `chat.*`.
  The client now guards against this (`adoptStreamingMessage` returning false
  for a foreign session, plus the matching `chat.done` check), so nothing is
  user-visible — but the client is compensating for data it should never have
  been sent, and every future client has to remember the same guard. Fix it at
  the source: `AppState.session_viewers` is already a
  `HashMap<session_id, HashSet<connection_id>>`, so the forwarder can consult it
  and drop `chat.*` for sessions this connection isn't viewing. Correctness /
  architecture cleanup, not a live bug.
- **No `~/.codex/model-catalog.json` on this Mac** (2026-08-04) — codex itself is
  installed and working, but the catalogue file is absent, so `models.rs` silently
  falls back to the static `CODEX_CATALOGUE` and the codex model list is the
  built-in one rather than the account's real catalogue. Working as designed; noted
  so the fallback isn't mistaken for the live path.
- **jean-parity backlog** (earlier menu, untouched): @-file mentions, AI commit
  messages / PR descriptions, MCP support, GitHub #-issue mentions, worktree
  auto-cleanup.
