---
title: Agent launch parity and conversation-scoped runs
status: implemented
created: 2026-11-09
---

# Agent launch parity and conversation-scoped runs

## Outcome and approved behavior

An agent launched through a Perch shell has the same Perch capabilities as one launched through
its picker. A fresh conversation owns a fresh family/run, not everything ever started in its tab.
This is approved scope, not a claim that the behavior is implemented.

The person selected all three lifecycle decisions on 2026-11-09:

1. Previous children keep running, visibly labeled as belonging to a previous run. A new lead
   cannot message, read, stop, steer or interrupt them as its own children, and their reports
   must not enter the new lead's conversation. The person can still open or stop them.
2. Explicitly resuming a known conversation restores its former Perch run and children.
   Reconnecting a surviving process after an app/core update preserves the current run.
3. A child using `/new` or `/clear` remains assigned to its original lead/run, retains the depth
   restriction, and distinguishes reports from its new conversation from its old conversation.

Normal exit followed by a fresh agent launch starts a fresh run, including a switch of harness.
Confirmed `/new` or `/clear` starts a fresh conversation boundary even when the OS process stays.
A typed, cancelled, rejected or failed command does not establish a boundary.

## Constraints and non-goals

- Rust owns run identity and authorization; React presents server facts.
- Keep terminal owner, process credential/incarnation, provider conversation and family run distinct.
- Credentials never appear in logs, prompts, terminal output, argv or durable plaintext storage.
- Bootstrap/credential issuance must be session-scoped and tied to a verified launch. An ordinary
  agent or nested tool invocation must not reset its run or acquire another session's authority.
- Unknown process/conversation state never authorizes replacement, detachment or credential rotation.
- Back up an existing database before changing its schema or backfilling data. Do not operate on the
  installed app database as a development probe. Preserve legacy family records through migration.
- Keep Rust/TypeScript protocol fields compatible, additive and optional for old peers.
- Preserve the preceding notification-cap removal. Do not replay old unconfirmed/undelivered mail.
- Do not add an orchestrator, kill old children automatically, reset OS processes for slash commands,
  or bypass the existing Claude process-ancestry/input safety guard.

## Evidence from the current implementation

- `agent_runtime.rs::launch_identity` issues credentials for a terminal runtime, not each typed agent.
  `in_shell` unsets credentials after a picker-launched agent exits, before entering its login shell.
- `shell_integration.rs::prepare_with` writes native provider shims and an `active` launch marker;
  `bridge_key`/`pty_key` distinguish a shell agent's bridge from the tab that owns its PTY.
  The shims do not issue per-invocation credentials. The foreground/ancestry guard prevents nested
  tool agents from stealing the enclosing agent's native status.
- `db/agent_identity.rs::issue` revokes the session's earlier incarnations. Authentication returns
  workspace, tab session, provider and credential incarnation; there is no logical conversation run.
- `db/sub_sessions.rs` stores `parent_incarnation`, but its lists, admission counts and spawn-key
  lookup use `parent_session_id`. The table's unique spawn key is also scoped to that session alone.
- `server/sub_sessions.rs::list`, `read` and `stop` select/authorize families by tab session.
- `db/agent_mail.rs::run_of` returns `COALESCE(parent_session_id, id)`, so a run currently means a tab.
  `enqueue_note` addresses the lead's currently live incarnation, not necessarily the one that owns
  the reporting child. This must change together with family authorization, not just UI labels.
- `server/crew.rs` builds family rows by the same tab-scoped lookup. Suggestions, message counters,
  idempotency, notes folders and queued mail also need the logical-run audit.
- `server/native_ui.rs::observe_runtime` sees provider conversation IDs, but only records continuation
  IDs for picker owners. Shell-agent observations must participate in the same run-boundary service
  without replacing the PTY owner's provider continuation.
- Claude's native observer follows `SessionStart` and its provider session ID. Pi/OMP's extension sees
  `session_start`, the session manager ID, and session shutdown. Verify real reset/resume semantics
  rather than assuming every provider uses the same event or that every context reset changes its ID.

## Approach and trade-offs

Use persistent logical runs and provider-confirmed conversation boundaries, independent of the
terminal's lifetime and the secret in an already-running process's environment. Reuse existing
incarnation/family/native-observation services and keep one shared Rust authorization path.

A label-only fix is smaller but fails first when an old child reports to the new lead or the new
lead invokes `perch stop` on a previous child. Rotating only process credentials fails on `/new`
because an already-running process keeps its environment and on explicit resume because a launch
credential is not durable conversation ownership. The logical-run approach requires a migration
and caller audit, but is the smallest approach that covers the approved semantics.

Better approaches: none established by inspection; no provider-independent environment mutation
can replace a persisted run boundary. Exact migration columns and launch handoff are implementation
choices that must be tested before deployment, not permissions to weaken the constraints above.

## Implementation sequence

### 1. Run persistence and shared authorization

- [ ] Add durable run/conversation identity plus an active binding for the terminal's current agent.
      Bind a child assignment to its original parent run, independently of its own conversation ID.
- [ ] Back up before migrating existing state. Adopt existing families into a preserved legacy run;
      ambiguous observations remain unknown, not silently adopted into a fresh conversation.
- [ ] Scope family lookup, child controls, report routing, messaging, counters, idempotency, suggestions
      and notes to the logical run. Audit every caller of the shared helpers, including boot/delete.
- [ ] Keep physical session history and previous children; expose previous-run membership separately
      from current-family authority. A person's explicit actions remain available.
- [ ] Test fresh run isolation, explicit resume restoration, cross-run refusal, child resets preserving
      their assignment, migration idempotency and database reopen.

### 2. Equivalent launch credentials and confirmed boundaries

- [ ] Give picker and shell launches the same per-agent issuance/end lifecycle, including an agent
      started in the login shell after a picker agent exits. Retire old invocation authority only on
      confirmed exit/replacement; preserve what is needed for the person's next verified launch.
- [ ] Keep launch bootstrap authority separate from ended-agent credentials. Exchange any secret only
      through private machine channels; never shell-evaluate credential output or put secrets in argv.
- [ ] Reuse native shims and the foreground marker without allowing nested/background tools to become
      the tab's owning agent or to change its family.
- [ ] Handle confirmed new/clear, exit/fresh launch, explicit resume and core reconnect centrally.
      No boundary is inferred from raw terminal input or user/model text alone.
- [ ] Trace Claude and Pi through the same contract, then Codex and OMP. Provider adapters only supply
      confirmed conversation/reset evidence; unsupported or uncertain evidence fails closed.
- [ ] Reconcile identities against the PTY owner's runtime key at boot, not the active harness name.

### 3. Previous-run presentation and verification

- [ ] Extend existing list/family/sidebar data additively to label previous-run children and identify
      the current run. The new agent does not receive historical members as current children.
- [ ] Preserve the person's ability to inspect/stop previous children without giving the new lead
      authority over them. Notify/refetch on confirmed run changes without leaking old reports.
- [ ] Update `perch guide`, whoami/list help, current architecture and the approved decisions doc.
- [ ] Use isolated headless deterministic fixtures first: typed versus picker launch; exit then same
      or different harness; new/clear then delayed old-child report; child new/clear; explicit resume;
      cancelled command; duplicate/reordered native snapshots; app/core restart; nested tool launch.
- [ ] Run focused Rust regressions, `cargo test -p perch-core`, `cargo test -p perchd`, protocol parity,
      relevant web tests, `npm run build`, `cargo fmt --check`, clippy and changed-path diagnostics.
      Real provider turns, if needed, use only the models and isolation in `docs/TESTING.md`.

## Acceptance criteria

- Both launch paths can authenticate and use the same supported Perch commands; an agent started
  after another exits gets its own valid invocation identity rather than inheriting ended authority.
- A new lead sees no previous child as its own and cannot act on one through any sibling API path.
- Delayed reports/messages from previous children never reach the new lead conversation.
- Previous children remain running and visibly attributed to their previous run; their history survives.
- Explicit resume restores exactly the known conversation's family, not the tab's latest family.
- A child reset remains a child of its original run and its reports identify the fresh conversation.
- Core/app restart keeps the current run, process and existing credentials; no duplicate launch occurs.
- Existing data migrates with a backup; no secrets are printed or newly stored as plaintext.

## Status

Implemented 2026-11-09: logical runs (`db/agent_runs.rs`), run-scoped authorization and mail, provider-confirmed
boundaries (`server/native_ui.rs`), launcher-based per-agent credentials (`/agent/launch`, `perch __launch`,
shim exchange), previous-run presentation, backup plus migration, guide/architecture/decisions updates.
Verified by focused Rust regressions, `cargo test -p perch-core` and `-p perchd`, protocol parity, `npm run build`,
`npm test`, `cargo fmt --check`; clippy shows no new warnings.

Live probe 2026-11-09: Claude (`/clear` = new id, `--resume` = same id) and Pi (`/new` = new file/id, `--session` =
same) behave as assumed; `e2e/agent-runs.spec.ts` passes end to end (fresh run on `/clear`, cross-run refusal, typed
`claude --resume` issued its own identity through the launcher and restored the first run and child).

Not done: Codex and OMP reset/resume traces; retiring a picker agent's identity at its exit (it ends at the next
launch's replacement or the runtime's exit, as before).
