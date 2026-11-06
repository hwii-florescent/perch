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

Row 7 (plan review) landed 2026-11-06 for **Claude only**, by the answer that needed no new
machinery: Claude 2.1.319's ExitPlanMode already draws a numbered dialog, so `native_ui/dialog.rs`
learned its shape (the plan between two `╌` rules, a solid rule, the question, `ctrl+g to edit…`
footer) and the existing request card shows the plan as its detail with the choices that take no
typed text ("Tell Claude what to change" is dropped like the other typed choices). The question wraps
at 80 columns, so the parser joins its lines (found by the live run, not the first capture); option 1's
wording follows the session's permission mode, the digits stay the answer. Unit tests use the captured
screen, its wrapped form and a plan containing a markdown rule; live: `native-composer.spec.ts` claude
"plan review" (`/plan`, card, approve by hand). Not done: OMP's plan review (Orca's
`omp-plan-review-prompt.ts` and extension channel; no OMP screen captured), Pi, Codex plans, and a
plan that wraps or scrolls past the screen (only the visible part is shown).

Row 8 (interrupted row) landed 2026-11-06: Claude's injected "[Request interrupted by user…]"
user row (the `interruptedMessageId` marker Orca keys on, or, because 2 of 5 rows seen in 2.1.318
transcripts lack it, the two exact texts) becomes a `system` message "Conversation interrupted"
(`native_ui/claude.rs`, `INTERRUPTED_STATUS_TEXT` in `mod.rs`); Codex's `turn/completed` with
`status: "interrupted"` (the `TurnStatus` enum in the 0.166 app-server schema) leaves the same row.
The web draws it as a quiet centred line (`native-cli-status-row`), not a bubble, so recall and copy
never see it. No Continue button, as planned. Unit tests port Orca's two cases (Claude marker; the Codex
one as the app-server status). Live: `native-composer.spec.ts` claude "interrupted row" (stop a
`sleep 60`). Not done: Pi/OMP/OpenCode rows, usage-limit and auto-continue notices.

Row 9 (command envelope) landed 2026-11-06 for **Claude's transcript**: `native_ui/command_envelope.rs`
(Orca's envelope parser, its catalog-versus-skill split, the harness-injected-turn predicate and
`<bash-input>`, with their tests), applied in `native_ui/claude.rs` `messages()`. Seen in real 2.1.318
transcripts: a skill is one user row `<command-message>x</command-message><command-name>/x</command-name>`
(shown now as `/x args`, so the reply has its prompt and the sent text matches its transcript echo), a
built-in such as `/plan` is an envelope row plus a `<local-command-stdout>` row (both hidden; the
composer's "Ran /x in the CLI" notice remains), `!ls` shows as typed. Before this, those rows showed as
raw tags and a `/plan` output became the newest recalled prompt. The built-in names come from
`slash_commands.json` (Claude's captured menu), so a command newer than the capture shows as `/name`.
Not ported: Orca's `surfaceNativeChatCommandOutputs` (a reporting command's answer, e.g. `/context`,
stays hidden), the host-answered commands, and any non-Claude provider (Codex/Pi/OMP write no envelopes).
Live: the `native-composer.spec.ts` claude "command menu" check asserts the `/perchping` row.

Row 10 (model, effort, mode labels and read-back) landed 2026-11-06 **read-only**: `native_ui/
session_options.rs` (Orca's `labelFromModelId` with its test, the effort and mode wording, Claude's and
Codex's mode mapping), `NativeUiSnapshot.effort`/`permissionMode` (raw reports, optional),
`NativeUiSnapshot.options` (worded in the core when a snapshot goes to a viewer), `nativeChat/
OptionLabels.tsx`. The toolbar shows "Haiku 4.5" (the raw id stays in `data-model` and the title) and,
when reported, effort and mode as plain text. **What each provider reports (probed 2026-11-06):**
Claude 2.1.319 `UserPromptSubmit` hook input carries `permission_mode` (`acceptEdits` seen live;
`SessionStart` has none, so the mode is as of the latest prompt/tool hook) and nothing names effort
(the `SessionStart` input has only `model`; the banner reads "Haiku 4.5 · Claude Max" and effort
appears only in a user's own status line), so Claude shows no effort and Orca's banner reader
(`claude-terminal-session-options.ts`) was not ported. Codex 0.166's `thread/settings/updated` and
`thread/resume` carry `model`, `effort`/`reasoningEffort`, `approvalPolicy`, `sandbox(Policy)` and
`approvalsReviewer`; the mode is one of Orca's three policies or nothing (unit-tested; no live Codex
run). Pi/OMP/OpenCode: model only. **Pending the owner's yes (PARITY, DECISIONS "no model chrome over a
live session"): the pickers and typed `/model`, `/effort`, mode-cycle commands that change a running
session.** Nothing here writes to a session.

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

**Claude subagents: landed 2026-11-06 (roster rows).** `native_ui/subagents.rs` (Orca's state
vocabulary and precedence, header words, elapsed-clock anchor and sibling ordinals, with the cases
of `native-chat-subagent-{summary,items}.test.ts` that do not need Orca's journal rows),
`claude.rs` `subagent_roster` (reads `<session>/subagents/agent-<id>.meta.json` and `.jsonl`),
`NativeUiSnapshot.subagents` (raw) and `NativeUiTranscript.subagents` (one roster per spawning turn,
`after` the block holding the spawn call, matched by the meta file's `toolUseId`),
`nativeChat/SubagentRoster.tsx`. **Probed live (2.1.319, haiku):** an `Agent` call runs the child in
the background ("Backgrounded agent"); hooks `SubagentStart` (`agent_id`, `agent_type`) and
`SubagentStop` (plus `agent_transcript_path`, `last_assistant_message`, `background_tasks[]`) fire;
the meta file holds `agentType`, `description`, `toolUseId`, `finished`, `pickedEffortModel`.
**Deviation from the plan above:** the roster is read from those files, not from the hooks: Perch's
hook files keep only the latest event per name, so concurrent children would overwrite each other,
and the meta file carries Claude's own `finished` mark. So `SubagentStart/Stop` were not added to
`EVENTS`, and `read_event` still drops events carrying `agent_id`. A child is `completed` only when
`finished` and its last reply ended its turn (`end_turn`), `unverifiable` when finished without that,
or when unfinished and its files have been still for 10 minutes; Claude writes `finished` before the
child's last rows, so the roster is re-read as the child's transcript grows (found by the live run),
and its tail window is 1 MiB because a child's rows can be 85 KB. There is no `failed`/`stopped`
state: nothing in those files says it. Not done: per-child transcript view, token totals, a live
elapsed clock (a settled run shows its length), nested helpers, `TeammateIdle`/`PostCompact`/
`Elicitation` events, agent teams, the background-task strip.

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

## Slice 3 landed (2026-11-06): identity and authority (*own* design; Orca ids are not credentials)

What later slices build on:

- **Identity.** `agent_identity.rs` (pure: token mint and hash, the pointer text, the `perch`
  binary lookup, the `IdentityStore` trait), `db/agent_identity.rs` (table `agent_identities`:
  `incarnation`, `workspace_id`, `session_id`, `provider_id`, `token_hash`, `created_at`,
  `revoked_at`, `report`, `reported_at`). One row per *new* local launch of a Claude, Codex, Pi,
  OMP or Terminal session; issuing revokes the session's earlier rows. **Deviations from the
  plan:** no `parent`/`run_id` columns (the incarnation is the run id; the parent link is the
  session record's, slice 4); perchd's own incarnation is not reused (it is per PTY runtime, not
  per Perch launch); the token is two OS-random UUIDs (244 random bits), not raw bytes.
- **A reattach never mints.** `agent_runtime::launch_identity` issues only when perchd confirms the
  terminal is absent (`session_state == Exited`) and the attach may start a process; an existing
  process keeps the environment it started with, so minting for it would revoke its own token.
  Unknown is not absent.
- **Environment.** `PERCH_SESSION` and `PERCH_TOKEN`, set last by `provider_environment::prepare`
  (new `scoped` argument): no manifest rule or inherited value overrides them, and an identity the
  core itself inherited (started from an agent's shell) is removed from every child and from the
  core's own environment at boot. `in_shell` unsets both after the agent exits, before the
  person's login shell. **Not verified live:** the post-exit shell (unit-tested with a stand-in
  shell script).
- **Revocation.** On a confirmed exit (the exit listener's `!alive` branch, so also stop and
  hibernate), on the next launch of the session, when the session is deleted, and at boot for any
  run perchd confirms gone (by incarnation, so it cannot hit a launch that started meanwhile). A
  lost connection is not an exit.
- **Transport (decided by the supervisor).** `POST {base}agent/whoami` and `agent/report`,
  `Authorization: Bearer <token>`, JSON body naming `session`. `server/agent.rs`: only agent tokens
  (no device cookie, no loopback exemption), only local (no proxy header, no `Origin`), token and
  named session must match (cross-run refusal). `authorize_request` refuses a request that carries
  an agent token anywhere else (header, `?token=`, cookie), even from loopback. The CLI reads
  `<daemon dir>/core.json` (0600: `pid`, `port`, `basePath`; the daemon dir honours `PERCHD_DIR`,
  so isolated probes stay isolated) on every call and refuses a file whose pid is gone. The token
  is never in argv, output, logs or errors.
- **Still open, by instruction:** a local process *without* a token keeps full authority over every
  other route (the loopback exemption is unchanged). The slice's check "loopback no longer gives
  agents full authority" is therefore met only for token holders: they get less than anonymous
  local callers, which an agent can always become by omitting the token. Narrowing local access is a
  separate owner decision; see ROADMAP.
- **`perch` on the agent's PATH (decided by the supervisor).** The real binary is `perch` beside the
  core (`perchd/src/bin/perch.rs`; `binary_beside` also finds it from a test binary's `deps/`).
  `shell_integration::prepare` writes `bin/perch` into the session's private shim directory, which
  every launch already puts first on its PATH, as a two-line script that `exec`s the real binary by
  absolute path (never by PATH search, so it cannot run itself). No binary beside the core: no
  shim, **no identity and no pointer either**, and an `info` line says why; an old shim is removed.
  Tested for the typed-agent shim (all four providers read the pointer) and the shim itself; picker
  launch, wake/resume and the Codex app-server-backed TUI all go through `with_instructions` and
  `shell_integration::prepare` in one place. **Packaged builds must ship `perch` beside the core**
  (ARCHITECTURE); that is a packaging follow-up, not done.
- **The pointer** (`POINTER`, about 250 characters) is appended at each launch to whatever the
  session pinned, for Claude, Codex, Pi, OMP (file or Codex's `developer_instructions` argv) and for
  the shim of a Terminal session. It is **not stored in the pin** (a constant that depends on whether
  the binary exists now); the stored pin, its hash and the Instructions dialog are unchanged.
- **Binary.** `perch whoami [--json]`, `perch report <text>` (or stdin; at most 4,000 characters;
  the latest report is kept on the run and nothing reads it yet), `perch guide` (own text, in the
  binary). `perch daemon <verb>` runs the daemon verbs; the bare `ps`, `list`, `cleanup`, `release`,
  `serve`, `connect` remain aliases. **Decided (owner, 2026-11-06):** `perch list` lists the
  caller's run in slice 4; the bare `list` alias and `serve`/`connect` aliases go, the daemon list
  is `perch daemon list`; `ps`, `cleanup`, `release` keep their bare aliases.
- **Live check:** `e2e/instructions.spec.ts` (one extra `perch whoami` turn per provider, haiku and
  luna): the reply names the session, the session has exactly one live identity row, and no
  `perch_agent_` string reaches the chat, `ps` or the core log.
- The guide text still describes only `whoami`, `report` and `guide`; each later slice adds its
  verbs and the rules that go with them (only person-started turns may spawn, children cannot
  spawn, messages never approve).

## Slice 3a: no tokenless local authority (owner, 2026-11-06; before slice 4)

*Own* design. Today `authorize_request` (`server/mod.rs`) exempts loopback requests with no
proxy headers, so any local process, including an agent that omits its token, has full
authority. Change: every request presents a token.

- **Local UI token.** At boot the core mints a random per-launch token (never stored on disk
  except as below, never logged). The desktop app (`crates/perch-desktop`, in-process core)
  hands it to its own webview (e.g. as the `perch_device`-style cookie set on the first
  navigation, or an initialization script); trace how the desktop webview loads the UI first.
  Headless/dev: `npm run dev`, `target/debug/perch-core` and the e2e harness need a way in:
  the core writes the local UI token into the 0600 `core.json` (same dir as the `perch` CLI
  reads) and prints a one-time local URL with it; the e2e helpers read it from there. Paired
  devices keep their existing tokens and cookie.
- **Rule.** Every HTTP and WS route requires a device token, the local UI token, or (only on
  `/agent/*`) an agent token. Remove the loopback exemption; `PERCH_REQUIRE_PAIRING` becomes
  a no-op (keep accepting it). Pairing and `/pair` stay reachable as today.
- **Who else calls the core locally:** grep for every loopback client (perchd, shims, hook
  scripts, relay host, `perch` CLI, iOS dev, scripts in `e2e/`, `scripts/`), and give each
  the token path it needs. Hooks write files (no HTTP), so they are unaffected; verify.
- **Tests:** a booted-core test that a tokenless loopback request is refused on WS and every
  HTTP route, that the local UI token works, that an agent token works only on `/agent/*`;
  desktop dev launch and the e2e suite still connect. Update ARCHITECTURE, TESTING and the
  Slice 3 "Still open" note above.

## Slice 3b: ship `perch` in packages (owner, 2026-11-06)

Bundle the `perch` binary beside the core in the desktop app bundle and the headless package
(see `packaging/`, Tauri bundle config in `crates/perch-desktop`), so `binary_beside` finds it.
Check: build the package locally, launch it isolated, open one agent session and confirm a
`perch whoami` turn (or, zero-token, that the shim exists and `perch whoami` run in the session's
environment succeeds). Document in TESTING/PUBLIC-ALPHA.

## Row 10b: live model/effort/mode pickers (owner yes, 2026-11-06)

Port Orca's pickers: `NativeChatSessionOptionPickers.tsx`, `NativeChatModelCombobox.tsx`,
`NativeChatPermissionModePicker.tsx` (components), and the logic in
`shared/native-chat/input/native-chat-session-option-{commands,apply,state}.ts` and
`native-chat-pty-session-options.ts` to Rust (`native_ui/`), with their tests. Apply only at an
idle, verified-empty prompt under the input lease by typing the CLI's own command
(`/model`, `/effort`, permission-mode cycle, per provider; probe each CLI's command first);
the UI shows the new value only after read-back (`PostModelSwitch`, `SessionStart.model`,
Codex app-server events, screen); refused while a turn runs, a dialog is open or a draft is in
the prompt. Providers without a confirmable read-back show no picker for that option.

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
