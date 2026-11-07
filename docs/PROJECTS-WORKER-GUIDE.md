# Worker guide: rules for Projects, sub-session and native-chat slices

How to build the next slice of [ROADMAP](ROADMAP.md) ("Projects parity", native UI mode)
without repeating earlier mistakes. What each landed slice does is in the code (module `//!`
headers) and [ARCHITECTURE](ARCHITECTURE.md); what the real CLIs do is in
[evidence/cli-probes-2026-11](evidence/cli-probes-2026-11.md). Earlier versions of this file
held a per-slice code map and plan; they are in git history before the audit commit that
trimmed them.

## Rules for every slice

1. **Source policy.**
   - **Orca (MIT, `stablyai/orca`, ported at `308b5000`): copy, then translate.** Domain logic
     goes to Rust in `crates/perch-core` with a `//!` header naming the Orca files and commit
     (as `native_ui/transcript.rs` does). React may be copied and trimmed onto `components/ui/`.
     Port Orca's tests as Rust unit tests. Add each ported area to `THIRD_PARTY_NOTICES.md`.
     Read each Orca file in full first and recheck its licence at the commit you copy from.
   - **Claude Code and Claude desktop (proprietary): behaviour only.** Implement from the
     observed behaviour in our own code and words. Never copy bundle or binary code, prompt text or
     tool descriptions; keep reverse-engineering notes outside the repo.
   - **Features neither has** (marked *own* in code headers): design and verify ourselves.
2. **Architecture.** Rust owns logic and state; web stays thin (pure Rust fn over the snapshot →
   optional field → thin component). New protocol fields are optional and mirrored field for field in
   `packages/shared/src/protocol.ts`; new message families are capability-gated in
   `foundation_capabilities()` (`server/mod.rs`). New routes call `authorize_request` or live under
   `/agent/*`; there is no "local, so allowed" path.
3. **Probe the real CLI before claiming a gap**, zero-token first: `--help`,
   `codex debug prompt-input`, a TUI screen in tmux without pressing Enter. Live turns only on
   `claude-haiku-4-5` or `gpt-5.6-luna`, banner checked first, isolated `PERCH_DB`, `PERCH_HOSTS`,
   `PERCHD_DIR`, `PERCH_SETTINGS` ([TESTING](TESTING.md)). Record version-bound findings in
   `evidence/`, not in a module header.
4. **Unknown is not exit, not failure, not absent.** An unconfirmed launch, stop, send or steer keeps
   counting against limits and is never retried or resent for the person. Receipts say so.
5. **A slice ends with** `cargo test -p perch-core` (and `-p perchd` if touched), `npm test`,
   `cargo fmt --check`, `cargo clippy --workspace --all-targets` with no new warnings, the slice's
   e2e if it has one, ROADMAP/ARCHITECTURE updated, and one local commit. Never push unprompted.

## Choices a later slice would otherwise reverse

- **Identity.** No `parent`/`run_id` column on `agent_identities`: the incarnation is the run id and
  the parent link is the session record's. perchd's incarnation is per PTY runtime, so it is not reused.
  A reattach never mints a token (the existing process keeps its environment); only a confirmed-absent
  terminal does.
- **Authority.** No tokenless local access: every route needs a device token, the core's local UI
  token, or (on `/agent/*` only) an agent token. The desktop signs in with a one-use code; headless
  cores publish the token in the 0600 `core.json`. A same-user process that reads the user's files or
  another process's environment is out of scope; that needs an OS sandbox. Federated desktop-app cores
  are unreachable over SSH (no token published).
- **`perch` shim.** The real binary sits beside the core. No binary beside the core means no shim, no
  identity and no pointer, with an `info` line saying why. The pointer is appended at each launch and is
  not stored in the pin.
- **Subagent roster** is read from Claude's `subagents/` files, not hooks (see the probes).
- **Fallback report** comes from the native bridge's snapshot, not the Stop hook: same text, all four
  providers, no new hook plumbing. It is absent after a core restart.
- **Steer and interrupt.** The lead may steer and interrupt its own children with the person's engine and
  receipts, but not while the child waits on a person; interrupts are capped at 3 per child per person's
  message; a steer counts toward the 50 messages. Esc in the lead's chat is not a stop.
- **Mail delivery rides the input lease an open view holds** (lease untouched), after the idle,
  empty-prompt and 2 s PTY-quiet checks. A composer draft lives in the browser and is not protected
  (owner decision 2026-11-07).
- **Inbound control** was designed without the owner's spec, choosing the safer reading each time: status
  notes and `perch interrupt` are not gated; a steer is refused rather than held; setting the mode needs no
  lease, Deliver and Discard do; a mode change sweeps `queued` mail, never what is held; `perch inbox` hides
  held, refused and discarded messages.
- **Reporter.** One call per child turn from the previous summary plus that turn's events, so cost stays
  flat. A child's own `perch report` of the turn wins over the summary, which wins over the last message.
  Changed files come from `turn_diffs`, not `agent_change_snapshots`. Existing installs keep their stored
  model; only an unset setting gets the new defaults (`haiku`, `gpt-6-luna`). Specs pin the cheap models via
  `e2e/cheapModel.ts::pinReporterModels`, which also turns on "start without asking".
- **Typed pickers (Claude only).** Refused while a turn runs, a question is open, the prompt holds a draft
  or the lease is not this client's; one change at a time; a change not seen in 8 s is `unconfirmed`.
  Codex, Pi and OMP have none (see the probes for why).
- **Row 1 (copy button)** is web-only: Orca's copy text strips only things Perch's messages never carry.

## Not verified live, or not done

Unit, HTTP or jsdom tests exist for all of these; none has run against a real CLI through Perch.

- **Receivers other than Claude:** mail delivery, steer, interrupt, and the Codex, Pi and OMP bridge paths.
- **Codex as a child** end to end (its quota ran out mid-run), a Codex reporter with `gpt-6-luna`, and Pi or
  OMP children summarised by their own harness.
- **`--worktree` spawn** (Rust test with a real repository only), and a lead's own `perch steer` and
  `perch interrupt`.
- **Suggested-task actions:** Do it here, Options, Start all. **Inbound control:** Deliver through a real
  receiver. **Strip:** "waiting on you", a lead with two children, and the phone layout.
- **Post-exit login shell** has no token (tested with a stand-in script); **SSH hosts'** `cat core.json`
  is unit-tested only.
- **Older-history paging** (Claude only): no live run, and the 528-message window ceiling exists because the
  tail is re-parsed on every change.
- **Packaging:** the Linux bundles were not built here; there is no headless package to hold `perch`.
- **Not ported or open:** OMP/Pi/Codex plan review, a per-subagent transcript and tokens, Codex children
  (`parentThreadId`), Pi/OMP lifecycle events, host-answered `/context` and `/clear`, background-task strip,
  queue cards, Steer-now, Rewind (the last four need a Claude stream-json mode), and a status word from the
  reporter that nothing reads yet.
- **Repo files in Instructions:** the repo's own `CLAUDE.md`/`AGENTS.md` are not shown beside them.
