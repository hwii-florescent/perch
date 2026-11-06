# Worker guide: Claude-desktop UI rows, Instructions and sub-sessions

Execution detail for the slices in [ROADMAP](ROADMAP.md) ("Perch's version of Claude
Projects and sub-sessions", slices 0–6) and step 0's Claude-desktop UI rows. The order
and the decisions live in ROADMAP and [DECISIONS](DECISIONS.md) (2026-11-06); this file
says **where the code comes from, where it goes and how to prove it**. Delete a section
when its slice lands. Research: [evidence](evidence/claude-projects-subsessions-2026-11-06.md).

**Status of the references.** Orca paths and line counts come from a read-only mapping at
`308b5000` (MIT licence checked in that clone) and are mostly unread bodies: read each
file in full before porting, and re-check the licence and notice at the commit you copy
from. Items written as "verify" or "probe" (Claude `TodoWrite` input in the transcript,
`structuredPatch`, ExitPlanMode's dialog shape, Pi subagent events, `--plugin-dir`,
the hidden `--append-system-prompt-file`) are hypotheses until checked at the start of
their slice.

## Rules for every slice

1. **Source policy.**
   - **Orca (MIT, `stablyai/orca` at `308b5000`): copy, then translate.** Domain logic
     goes to Rust in `crates/perch-core` with a `//!` header naming the Orca files and
     commit (as `native_ui/transcript.rs` does). React components may be copied and
     trimmed onto `components/ui/`. Port Orca's tests as Rust unit tests next to the
     code. Add each ported area to `THIRD_PARTY_NOTICES.md` (file list and commit),
     like the existing catalog and icon entries.
   - **Claude Code and Claude desktop (proprietary): behaviour only.** Implement from
     the behaviour spec below in our own code and words. Never copy bundle or binary
     code, prompt text or tool descriptions into the repo; keep reverse-engineering
     notes outside it.
   - **Features neither has** (marked *own* below): design and verify ourselves.
2. **Architecture.** Rust owns logic and state; web stays thin. New protocol fields
   are optional and mirrored field-for-field in `packages/shared/src/protocol.ts`; new
   message families are capability-gated in `foundation_capabilities()`
   (`server/mod.rs`). Read each touched module's `//!` header and its callers first.
3. **Before claiming a gap, probe the real CLI** (Claude 2.1.319, Codex 0.166, Pi 1.5,
   OMP 18.16, versions move). Zero-token first: `--help`, `codex debug prompt-input`,
   TUI screens in tmux without pressing Enter. Live turns only on `claude-haiku-4-5` or
   `gpt-5.6-luna`, banner checked first. Isolate `PERCH_DB`, `PERCH_HOSTS`,
   `PERCHD_DIR`, `PERCH_SETTINGS` ([TESTING](TESTING.md)).
4. **Each slice ends with:** `cargo test -p perch-core` (and `-p perchd` when touched),
   `npm test`, `cargo fmt --check`, `cargo clippy --workspace --all-targets` with no new
   warnings, the slice's e2e, docs updated (ROADMAP, NATIVE-UI-PARITY rows), one local
   commit. Never push.

## Fix first (found while mapping; small, blocking)

Landed (2026-11-06): `read_event` kept seven fields and dropped `tool_name`, so a
question hook never blocked the turn (reproduced with a hook-file fixture test, fixed);
hook events are registered per detected CLI version (Orca's floors, ported; the
"older Claude rejects the settings file" claim stays Orca's, not reproduced here;
`PostModelSwitch`'s floor is unmeasured). Still open: a live check that an
`AskUserQuestion` blocks over the real CLI (see the slice 0 table).

## Step 0 UI rows (between slices; Orca code exists)

Pattern: a pure Rust fn over `NativeUiMessage` → optional field on the snapshot →
thin component. Orca paths are under `src/`; "terminal" means Orca renders it in its
terminal-backed view (`renderer/src/components/native-chat/NativeChatResolvedView.tsx`).

| Order | Feature | Orca logic → Perch | Orca view | Orca tests to port | Data Perch has |
|---|---|---|---|---|---|
| 7 | Plan review | `shared/omp-plan-review-prompt.ts` (91, pure) → a shape in `native_ui/dialog.rs`; `main/pi/omp-plan-review-source.ts` → `pi-extension.ts` event | `NativeChatInteractiveCard.tsx` | `agent-status-omp-plan-review.test.ts` | probe Claude ExitPlanMode live: may already be a numbered dialog |
| 8 | Interrupted row | status text from `transcript-line-decoders-claude.ts:90`, `transcript-turn-lifecycle.ts` | row only, no Continue button | `transcript-interruption-message.test.ts` | transcript |
| 9 | Command envelope | `shared/native-chat/native-chat-command-envelope.ts` (50) → `typed.rs` | none | `native-chat-command-envelope.spec.ts` | Claude transcript `<command-name>` |
| 10 | Model/effort/mode labels | `shared/native-chat/input/native-chat-session-option-labels.ts`, `native-chat-permission-mode-labels.ts`; read-back from `SessionStart.model`/`PostModelSwitch`; Orca's banner reader `claude-terminal-session-options.ts` only as a fallback | `NativeChatPermissionModePicker.tsx`, `NativeChatModelCombobox.tsx` | `native-chat-session-option-*.test.ts`, `claude-terminal-session-options.test.ts` | typed commands through `typed.rs`. Showing pickers over a live session needs an owner yes (PARITY) |

Row 1 (copy button) landed 2026-11-06 in web only (`nativeChat/CopyButton.tsx`): Orca's
`native-chat-message-copy-text.ts` only strips text Perch's messages never carry (visual
directive lines, the subagent-group twin, a stopped label), so there is no Rust function.
Revisit it with row 2 of slice 2 if subagent groups put twin text into messages.

Row 2 (file links) landed 2026-11-06: `native_ui/file_links.rs` (Orca's href routing,
location parsing and path normalization, Unix only, with their tests), `fs.links` /
`fs.links.result` (capability `fs.links`, relayed to remote hosts like the other `fs.*`
requests), `nativeChat/fileLinks.ts` and the pill in `NativeMessage`. Orca's existence cache
(`native-chat-file-link-existence.ts`, renderer state tied to its runtime hosts) and the
markdown `file:` rewrite were not ported: the core answers per message once the turn
ends, and DOMPurify strips `file:` hrefs. Open gaps: opening at the line, inline-code paths.

Row 3 (docked task list) landed 2026-11-06: `native_ui/tasks.rs` (Orca's normalizer, diff,
sentences and per-tool predecessor rule, with their tests), `NativeUiTranscript.tasks`, the
step body of an accepted plan call, `nativeChat/DockedTasks.tsx`. **Probe result: Claude
2.1.319 has no `TodoWrite`**; haiku given "use your task tools" called `ToolSearch`, then
`TaskCreate` (input `subject`, `description`; result "Task #N created successfully: …") and
`TaskUpdate` (input `taskId`, `status`; result "Updated task #N status"). Those are read
as Perch's own, keyed by task number. `TodoWrite` input is now kept to 6 KiB (a clipped list
does not parse). Not done: Codex `turn/plan/updated` (the bridge does not surface it), the
frame projection, Pi/OMP lists.

Row 4 (edit cards) landed 2026-11-06: `native_ui/edits.rs` (Orca's normalizer, LCS, unified
patch and begin_patch, with the normalize tests; Perch's own tests for LCS, the prefix/suffix
fallback and the clipped-input flag), `NativeUiMessage.edit_patch` (Claude's
`toolUseResult.structuredPatch`, 40 hunks of 400 lines), `NativeUiToolLine.edit`,
`nativeChat/DiffCard.tsx`. Claude edit inputs are now kept up to 12 KiB per string (the
generic 300) and a string still cut sets `_perchClipped`, which the card turns into
"Diff truncated"; the history shares 4,000 card rows. Not ported: Orca's journal `Diff` tool
and bounded-text markers. Codex's `file changes` input (the bridge sends the `changes` array
itself) is read as `apply_patch`'s `changes`; unit-tested only. Row 5 builds on the cards
(`EditFile`).

Row 5 (per-turn diff rollup) landed 2026-11-06: `native_ui/turn_diffs.rs` (Orca's merge,
rename folding and totals, with the cases of its test that do not need the journal `Diff`
item), `NativeUiTranscript.turn_diffs` (each names the block it follows and its edits by
step id, so card rows are not sent twice), `nativeChat/TurnDiffRollup.tsx`. Git's
changed-files card (`useLastTurnChanges`) stays the truth for the newest settled turn and
replaces the rollup there; the rollup serves older turns and workspaces without Git. Not
ported: Orca's reveal target (scroll to the card), subagent sections.

Row 6 (older-history paging) landed 2026-11-06 for **Claude only**: `NativeBridge::load_older`
raises a per-session window (`claude::WINDOW` 128 messages, `PAGE` 200, `MAX_WINDOW` 528; each
128 also allows another 192 KiB and 2 MiB of file tail), `agent.ui.older` and
`agent.ui.older.result` (`applied`/`exhausted`/`unchanged`/`failed`, Orca's names less
`superseded`), `NativeUiSnapshot.can_load_older`, `nativeChat/useOlderHistory.ts` and
`OlderHistoryRow.tsx`. Checked in-process with the real observer on hook files and a 300-row
transcript, and with browser unit tests; **no live paid run** (a real transcript past 128
messages needs about 65 turns or writing into `~/.claude`). Open: the window ceiling exists
because the tail is parsed again on every transcript change (an incremental reader would lift
it); Codex can page with `thread/turns/list` and its cursor; Pi, OMP and OpenCode would need
a window command in their extension or plugin.

Skip for the terminal-backed chat (Orca feeds them only from its structured journal):
usage-limit cut and auto-continue, provider retry runs, thread goal banner, background
task strip. They come back with the later Claude stream-json mode.

## Slice 0 results (landed 2026-11-06)

Table in the [evidence file](evidence/claude-projects-subsessions-2026-11-06.md). Nothing
contradicted the plan. What later slices must use: Claude `--append-system-prompt-file`
works (and Claude pins its own prompt on resume, `--system-prompt-snapshot`); Pi and OMP
take a file; Codex takes `-c developer_instructions=<text>` on the app-server; every
`PERCH_*` name, `_TOKEN` included, reached the shell tool of all four; Pi/OMP follow-ups
queue until the turn ends; **Codex does not refuse a busy `turn/start`** (it joins the
running turn), so idle delivery is the core's check alone.

## Slice 1 landed (2026-11-06): Instructions injection

What later slices build on:

- `instructions.rs` (pure: caps, `compose`, `Pinned`, `launch_args`), `db/instructions.rs`
  (tables `instructions`, `session_instructions`), `server/instructions.rs`
  (`instructions.get`/`set`/`state`, capability `instructions.v1`, local targets only).
- **The seam for the slice 3 pointer** is `agent_runtime::with_instructions`, which every
  launch path goes through (picker, wake/resume, Codex app-server) and
  `shell_integration::prepare_with` for agents typed into a shell. Append the pointer to
  the pin's text there; it must be pinned with the rest, and a session with no
  Instructions then still needs a pin row (today it keeps an empty one).
- **Codex has no per-thread folder flag through the shared app-server**: the TUI refuses
  `--add-dir` with `--remote` (0.166), so Codex's reference folders are listed in the
  `developer_instructions` text, like Pi's.
- **Codex's Instructions text travels in argv** (`-c developer_instructions=<text>`), so any
  local process can read it with `ps`. Accepted: Instructions are not secrets. Never put a
  credential in them.
- Not done: showing the repo's own `CLAUDE.md`/`AGENTS.md` and Claude memory beside the
  Instructions; remote Birdhouses (the dialog is local only; their core would own them).
- Live check: `e2e/instructions.spec.ts` (in `native-composer.config.ts`), one turn per
  provider quoting a marker from the Instructions and from the repo's own file.

## Slice 2: rows sub-sessions need

**Claude subagents (port Orca's feed, MIT):**
- Add to `EVENTS`, version-gated: `SubagentStart` (2.0.43), `SubagentStop`,
  `TeammateIdle` (2.1.33), `PostCompact` (2.1.76), `Elicitation`/`ElicitationResult`.
  Orca list: `src/main/claude/claude-managed-hook-events.ts`.
- `read_event` today rejects every event with `agent_id`. Route those to a child
  roster keyed by `agent_id` instead (fields `agent_id`, `agent_type`,
  `transcript_path`; Stop/SubagentStop `background_tasks[]`; `is_interrupt`). Orca:
  `shared/agent-hook-listener/providers/claude-lifecycle-events.ts`, `claude-events.ts`,
  `claude-subagent-roster.ts`.
- Child transcript `<parent stem>/subagents/agent-<id>.jsonl` and `agent-<id>.meta.json`
  (`description`, `agentType`); Orca `ai-vault/scanners/claude/session-scanner-claude-subagents.ts`.
  Read-only, best effort, undocumented format.
- Rows: Orca `shared/native-chat/transcript/native-chat-subagent-{items,summary,group-header}.ts`
  and `renderer/.../native-chat-subagent-{sections,section-slots,live-frontier}.ts` →
  `native_ui/subagents.rs`; component `NativeChatSubagentRun.tsx`. Tests:
  `native-chat-subagent-items.test.ts`, `-summary.test.ts`,
  `native-chat-subagent-sections.test.ts`.

**Codex:** keep `primary()`; add a child roster from threads with `parentThreadId`;
names from the rollout's `session_meta.source.subagent.thread_spawn`
(Orca `shared/codex-subagent-identity.ts`).
**Pi/OMP:** subscribe to `task:subagent:lifecycle`, `subagent:async-started`,
`subagent:async-complete` in `pi-extension.ts` (Orca
`main/pi/agent-status-subagent-roster-source.ts`). Probe that Pi 1.5 emits them.

**Nested child rows** for Perch sessions use the same row component, fed by the
`parent_session_id` added in slice 4 (render the empty case now).

Check: Rust tests for roster routing (main events unchanged), transcript/meta parsing;
e2e on Claude haiku with one native subagent and one TodoWrite turn.

## Slice 3: identity and authority (*own* design; Orca ids are not credentials)

- **Incarnation:** new `agent_identity.rs`: one row per launch (`session_id`,
  `incarnation`, `parent`, `run_id`, `token_hash`, `revoked_at`). Reuse perchd's
  per-runtime incarnation where it exists.
- **Token:** random 32 bytes, SHA-256 stored like `devices.rs` `hash_token`. Mint in
  `agent_runtime.rs` before `provider_environment::prepare` (a clone of
  `manifest.environment.set`), never in perchd's `terminal_env`.
- **Auth:** a scoped-agent branch in `server/mod.rs` `authorize_request` **before** the
  loopback exemption. A request carrying an agent token gets only agent operations on
  its own run, even from loopback. Today any local process has full authority. Narrowing
  that for non-agent clients is a separate decision; record it, don't change it here.
- **Discovery:** 0600 file `<perch dir>/core.json` with the address. Desktop ports change
  per launch, so the CLI reads the file each call.
- **Leaks:** unset the token in `in_shell` (`agent_runtime.rs`) before the post-exit
  login shell, and revoke it on exit, stop or incarnation change. Never log it.
- **Binary:** `crates/perchd/src/bin/perch.rs` → subcommands. Move `ps`, `list`,
  `cleanup`, `release`, `serve`, `connect` under `perch daemon`, keeping the old verbs as
  aliases. Then `perch whoami`, `perch guide`, `perch report`.
- **`perch guide`:** our own text, kept in the binary so it matches its version.
  Orca's preamble (`src/main/runtime/orchestration/preamble.ts`) and guide headings
  (`src/cli/bundled-skill-guides.ts`, Recipe / Never / When you are woken / Safety) are
  MIT and may be adapted. Keep: ask, report a blocker or finish, nothing else; return to
  idle after reporting; no outside channels; a direct user instruction wins. Add: only
  person-started turns may spawn, children cannot spawn, reports are claims, messages
  never approve.
- Check: tests for cross-run refusal, stale incarnation refusal, a token from loopback
  getting no general authority, no token in the post-exit shell, alias verbs; live `perch
  whoami` from all four providers.

## Slice 4: spawn, list, stop, reports

**Orca to port with changes** (paths under `src/main/runtime/orchestration/`):
- Worker states incl. `start_unknown` / `stop_unknown` (`db/schema/create-core-tables-sql.ts`
  `worker_dispatches`) → `sub_sessions.rs`. Unknown stays unknown.
- Stop is confirmed before destructive cleanup (`db/worker-dispatch/worker-dispatch-stop.ts`).
- Depth check and its "do the work yourself" refusal (`src/shared/nested-worker-depth.ts`), fixed at 1.
- Report admission only (`worker-report-admission.ts`); **do not** port settlement:
  a report settles nothing.
- CLI verbs: `worker-start` → `perch spawn --agent --model [--worktree] --task`,
  `worker-list` → `perch list`, `worker-stop` → `perch stop`
  (`src/cli/specs/orchestration-worker-specs.ts`).
**Do not port:** tasks/DAG, gates, coordinator loop, circuit breaker, federation,
mutation-receipt ledger, auto-release.

**Claude-desktop behaviour to implement (spec, own code):**
- A child is told its first message is its task and that its report goes to the session
  that started it. Report = its own `perch report` if given, else the last assistant
  message (Stop / `last_assistant_message`), first 400 characters, labelled fallback.
- Parent link on the session record (`sessions.parent_session_id`); family = bounded walk.
- Spawning is refused on a turn not opened by a person (prompt ledger
  `prompt_operations` plus provider `UserPromptSubmit`/bridge events; a delivered
  message's operation is marked agent-originated).
- Stop interrupts every live descendant and marks it "stopped until a person sends".
- Status from Perch's own records: needs you = pending approval/question
  (attention service), never a model claim.
- Limits before dispatch: 4 concurrent, 8 descendants, depth 1.

Check: tests for duplicate spawn (idempotency key), each limit, spawn on an
agent-opened turn, stop confirmation, report truncation and labels; live, a haiku lead
spawns a luna child in the same Nest and reads its report.

## Slice 5: messaging

**Orca to port with changes:** sender envelope (`formatter.ts` `formatMessageBanner`);
custody until delivered (`structured-mail-custody.ts`); one message per turn through the
session's own queue (`structured-mailbox-pointer-delivery.ts`). Table `agent_mail`
(`messages` already exists in `db/mod.rs`).
**Changes from Orca:** idle-only (Orca also delivers to working agents,
`mailbox-owner.ts`); body inline ≤2,000 chars, longer goes to a notes file with a path;
neutralise a leading `/`; `inbox` reads without consuming; per-message idempotency key.
**Claude-desktop behaviour (spec):** queued notes on the lead (cap 32); the lead is woken
only when idle with no pending approval, question or working child, at most 10 times per
human message; a one-line status roster per child, marked as status rather than
instruction; peer text treated as data, never as the user; receipts delivered / queued /
undelivered with reason.
**Delivery per provider:** Pi/OMP follow-up through the bridge; Codex `turn/start` at idle;
Claude: take the input lease and verify the empty prompt in one step (extend
`server/context_bridge.rs` flow: `acquire_control_if_unowned`, `prepare_input`,
`reserve_prompt_operation`), confirmed only by `UserPromptSubmit`; never retried blindly.

Write restart, cancel, duplicate and lease-contention behaviour into ARCHITECTURE first.
Check: restart with queued mail delivers once; busy, approval-blocked and person-typing
prompts receive no bytes; 50-message and wake caps; `/`-leading body cannot run a command.

## Slice 6: family strip and notes folder

- Read model: Orca crew (`crew/crew-query.ts`, `crew-parent-relations.ts`,
  `crew-party-snapshot.ts`, `src/shared/orchestration-crew.ts`), with `status` split into
  lifecycle, needs-you, receipt and report fields. Push it through a capability-gated
  protocol family.
- UI: Orca `renderer/src/components/orchestration-crew/CrewRowView.tsx`, `CrewRowDetails.tsx`
  (MIT) adapted into nested sidebar rows and a compact strip in the lead's chat; most
  recent traffic first. No panel or tab.
- Notes folder per run under the private native dir, path given in `perch guide`; never
  injected.
- Check: e2e with a lead and two children showing working / waiting on you / reported;
  phone view shows the same and can stop and message with the input lease.
