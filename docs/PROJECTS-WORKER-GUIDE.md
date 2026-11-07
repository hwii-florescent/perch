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
run). Pi/OMP/OpenCode: model only. Nothing in this row writes to a session; the owner said yes to
live pickers the same day, see "Row 10b landed" below (Claude's footer also shows the effort that
the hooks do not carry).

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
- **Closed by slice 3a (below):** the loopback exemption is gone, so an agent that omits its token
  gets nothing. What remains is the same-user limit written into ARCHITECTURE: an unsandboxed agent
  that goes looking in the user's files or another process's environment can still find
  credentials; that needs an OS sandbox, not another token.
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
- The guide text grows with each slice: slice 4 added `spawn`, `list` and `stop` and the spawn
  rules; slice 5 adds messages (messages never approve).

## Slice 3a landed (2026-11-06): no tokenless local authority

What later slices build on (the rule and the threat model are in ARCHITECTURE):

- `local_ui.rs` (`LocalUi`: token, single-use sign-in code, launcher-token check),
  `server::authorize_request` / `local_login` / `presented_tokens`, `server/local_authority.rs`
  (booted-core tests), `CoreAddress.local_token` (`perchd/agent_cli.rs`, never in `Debug`).
  Slice 4's new routes must call `authorize_request` (or be `/agent/*`); there is no
  "local, so allowed" path to add.
- **Callers traced.** The desktop webview (`perch-desktop/src/main.rs`: `LocalUi::in_process`,
  first navigation is the `local-login` link); the PWA's service worker would have answered that
  navigation with the app shell, so `/local-login` is in `navigateFallbackDenylist`. Hooks write
  files and never call the core; perchd and the shims never call it; the `perch` CLI uses agent
  tokens only; the relay host and the LAN listener were already non-local (they need a device
  token; a relay guest presenting the local token is refused, tested). The hub's connection to a
  federated core had no credential and relied on the remote's loopback exemption: see ARCHITECTURE
  (header on the upgrade; SSH hosts read the remote `core.json`; `directUrl` carries its own
  `?token=`, hidden from logs). Unit-tested in `hub.rs` and against a booted core
  (`server/local_authority.rs`); `e2e/federation.spec.ts`, `nav.spec.ts`, `remote-git.spec.ts`
  and `remote-workspace.spec.ts` use it through `directUrl`. **Not verified live over a real SSH
  host** (no host to use): the `cat core.json` command and its parse are unit-tested only.
- **E2E.** `e2e/localAuth.ts` (see TESTING): configs and `browser.newContext()` sites carry the
  cookie, Node clients the header or `?token=`.
- **Not done / limits.** A federated *desktop-app* core cannot be reached over SSH (it publishes no
  token). `directUrl` values are shown to every client in the host list, token included; only
  logs hide them. The pairing screen of a tokenless local browser says "open Settings → Devices"
  (a headless dev core has no such window); the printed `local-login` link is the way in.

## Slice 3b landed (2026-11-06): `perch` ships in the desktop bundle

`bundle.macOS.files` / `linux.{deb,rpm,appimage}.files` in `crates/perch-desktop/tauri.conf.json`
place `target/release/perch` beside the app executable, where `binary_beside` looks; the release
workflow and `scripts/reinstall-desktop.sh` build it before bundling. The check is
`e2e/packaged-perch.check.mjs` (TESTING): packaged `perch` found, runs outside a session, and
answers `perch whoami` inside a session of a core it sits beside. **Not done:** no headless package
exists in the repo (the release job ships only the desktop installers and the static `perchd`), so
there was nothing to put it in; the Linux bundles were not built here; the app itself was not
launched (it has no headless mode).

## Row 10b landed (2026-11-06): live pickers for **Claude**

Owner yes, 2026-11-06. `native_ui/option_pickers.rs` (Orca's Claude catalog: model aliases, effort
ladder, the `/model <v>` and `/effort <v>` templates, the picker rules that keep the running model
as a row and drop a one-choice effort, the guard that a value is a listed choice and never prose, and
`matchNativeChatCatalogModelId`; Orca's tracked-"dispatched" state and caption are **not** ported:
the picker shows only a value read back), `NativeUiOptions.pickers` (each `{id, label, current,
choices, settable, note}`, built when a snapshot goes to a viewer), `agent.ui.option` and
`agent.ui.option.result` (capability `agent.ui.options`; `outcome` `applied` or `unconfirmed`, a
refusal is an `error` with code `native_ui_option_failed`), `server/native_ui.rs` `option`/`apply_option`,
`nativeChat/OptionLabels.tsx` (`PickerSelect` on `components/ui/select.tsx`: Orca's combobox and
permission picker play the same role; none of their code is copied).

**Probed 2026-11-06 (Claude 2.1.319, Codex 0.166, tmux, no tokens, isolated config dirs and a dummy
API key):**
- Claude `/model <alias|id>` and `/effort <level>` take effect at once and answer `Set model to Haiku 5.5
  and saved as your default for new sessions` / `Set effort level to high (saved as your default for new
  sessions): …`. **Both write the user's own settings** (`model`, `modelSettings.<model>.effortLevel`);
  that is Claude's behaviour for its own command, so each picker carries the note "Claude also saves the
  pick as your default for new sessions" (the `/model` dialog offers `s` for session-only, but it is a
  list to navigate, not a command). The alias `haiku` is Haiku **5.5**; only the id `claude-haiku-4-5`
  is 4.5, so the model picker lists four aliases plus the running model's id.
- Permission mode has no command: Shift+Tab (`ESC [ Z`) steps a cycle that depends on how Claude was
  started (`manual → accept edits → plan → auto → manual`; with `--dangerously-skip-permissions`, which
  Perch uses: `bypass → auto → manual → accept edits → plan → bypass`). The footer names the mode
  (`⏸ manual mode on`, `⏵⏵ accept edits on`, `⏸ plan mode on`, `⏵⏵ auto mode on`, `⏵⏵ bypass permissions
  on`), so the core steps one key at a time, re-reads the footer after each, stops at the target, and
  gives up when the starting mode comes round again (a mode this session was not started with is not
  in the cycle).
- Read-back: the model by the `PostModelSwitch` hook (`to_model`; **it does fire** in 2.1.319, so the
  hook-reported model is current) or Claude's "Set model to" line; the mode by the footer; the effort by
  the `● high · /effort` indicator **or**, when a short notice ("auto mode unavailable for this model",
  "Image in clipboard") holds its slot, by the newest `Set effort level to …` line still on screen, voided by
  a `Set model to` line after it. After a model switch Claude draws no effort until one is set, so there
  is no effort picker then (seen live: it comes back once the person runs `/effort` in CLI view and the
  chat is reopened). Haiku 4.5 has none ("Effort not supported").
- Refused (nothing written) while a turn runs, a question or permission prompt is open, the prompt
  holds a draft (`claude::prepare_input`'s empty-prompt check) or the input lease is not this client's
  at the current generation; the lease is looked up again before every write, so another viewer
  taking input ends a change half way. One change at a time per core. A change the CLI never showed in
  8 s is `unconfirmed`, never assumed.
- **Found, then fixed (2026-11-06):** a fresh Claude draws a placeholder in an empty prompt (`❯ Try "fix lint errors"`)
  unless `promptSuggestionEnabled` is false. `empty_prompt` read that as a draft, so *every* send from the
  chat (not only pickers) was refused. Raw capture of 2.1.319: the example is drawn dim (SGR 2) and the cursor
  is parked on its first letter; the daemon's emulator (vt100 0.15) drops SGR 2 and the snapshot is plain text,
  so `claude::prompt_is_empty` / `example_placeholder` (also used by `typed::read_draft`) recognise it by shape
  (`Try "…"`, one quoted phrase) **and** the cursor on its first letter, on the prompt row. Typed text leaves
  the cursor at its end, so only a draft of exactly that shape moved back to its start (Ctrl-A) passes; every
  other text stays a draft. **Not covered:** the dim *suggestion* Claude may draw after a turn (any wording, same
  cursor spot) still reads as a draft; it needs the dim attribute, i.e. a terminal emulator that keeps SGR 2.
  The e2e now leaves `promptSuggestionEnabled` on.

**Not done, and why (an owner call each):**
- **Codex.** `/model` is a two-step TUI list (model, then "Select Reasoning Level"; `enter` saves a
  default, `s` is session-only) whose rows are the account's own models, so the choices need the
  app-server's `model/list`; `/permissions` is a numbered list, and "Full Access" is followed by an
  "Enable full access?" confirmation (`Yes, continue anyway`). Reading back works (`thread/settings/updated`,
  the footer `GPT-6-Luna medium`), but auto-confirming a risk dialog was not approved and no live
  Codex apply was run. No Codex picker.
- **Pi and OMP.** `/model` only opens a TUI list; Orca applies an OMP model through its own extension
  command (`/orca-model`), which Perch's extension does not have. Their effort and mode have no
  read-back. No picker.
- **Fast mode** (Orca's `/fast` toggle): no baseline to read back.

## Slice 4 landed (2026-11-06): spawn, list, stop, reports

The contract is in ARCHITECTURE ("Sub-sessions"). What later slices build on:

- **Files.** `sub_sessions.rs` (pure: Orca's worker states and stop rules, the depth text, Perch's own
  limits 4 / 8 / 1, the turn rule, task/model/key checks, the child's first message, the 400-character
  fallback), `db/sub_sessions.rs` (table `sub_sessions`, column `sessions.parent_session_id`;
  `reserve_sub_session` checks the key, the limits and the turn rule and writes both rows in one
  transaction), `server/sub_sessions.rs` (`spawn`, `list`, `stop`, `stop_children_of`, launch of the
  child), routes `/agent/spawn|list|stop` in `server/agent.rs`, verbs in `perchd/agent_cli.rs`.
  `AgentRuntimeAdapter` gained `turn_origin`, `note_agent_turn` (slice 5 calls it for every message it
  delivers) and `stop_confirmed`.
- **Spawn needs the lead to be Working/Blocked and its turn marked `Person`.** The mark is set when a
  person's Enter reaches an idle session (terminal), a chat send or a Context Bridge send records its
  boundary, and cleared by a new process. A person typing before a fresh launch has settled to idle
  (state still Working) is not marked, so that first turn cannot spawn; a core restart loses marks.
  Both fail closed. Not covered live: a refusal on a message-opened turn (nothing delivers messages
  until slice 5; unit-tested).
- **The task travels as the child's last command-line argument** (all four CLIs take a positional
  prompt and parse options after it, checked with `--version`), so no lease, no typing. Limit 3,000
  characters because Perch bounds an argument at 4 KiB. The text is visible in `ps`; it is a task, not
  a secret. Pi and OMP's `[messages...]` were checked only for option parsing, not by a live turn.
- **`--worktree`** makes a checkout of the lead's repository (`worktree::create` plus
  `workspace::register_created`, nested under the lead's Nest) after the record exists and moves the
  child into it; a failed checkout discards the child. Rust test with a real git repository
  (`spawn_worktree_places_the_child_in_a_checkout_under_the_leads_nest`: checkout exists as a linked
  worktree, the child's cwd and workspace are in it, it is nested under the lead's Nest in the same
  Birdhouse, a non-repository discards the child); the path is `place_in_worktree` in
  `server/sub_sessions.rs`. **No live run.**
- **Fallback report.** Taken from the native bridge's snapshot (the transcript's last assistant
  message), not the Stop hook's `last_assistant_message`: same text, works for all four providers, and
  needs no new hook plumbing. Shown only while the bridge is up (not after a core restart).
- **Stop.** Confirmed by perchd through `stop_confirmed`; the lead's own children only. A person's
  terminal kill of a lead also stops its live children, and so does deleting it (also archiving its
  Nest): `session::delete_session` calls `stop_children_of` first and keeps the lead if a child's stop
  is not confirmed (tested with a real process in the test daemon). The chat's interrupt (Esc) of a lead
  does **not** stop children: it is a keystroke into the lead's own prompt, not a stop (decided by the
  supervisor).
- **Guide.** `perch guide` now teaches `spawn`, `list`, `stop` and the rules (person's turn only,
  depth 1, 4 / 8, stop what you no longer need, what a report or a fallback is worth). The bare `list`,
  `serve` and `connect` aliases of `perch` are gone (`perch daemon list|serve|connect`); `perchd`
  itself is unchanged.
- **Live** (`e2e/sub-sessions.spec.ts`, TESTING): the first run, with a luna Codex child, got as far as
  the child receiving its task and running `gpt-5.6-luna` in the lead's Nest, then the child's turn hit
  Codex's usage limit (`task_complete … usage_limit_exceeded` in its rollout), so its report and the
  stop were not exercised. The second, with a haiku Claude child (`PERCH_E2E_CHILD=claude`), passed: the
  lead spawned it during a person's turn, the child reported, the lead read the report back through
  `perch list` and stopped it, and the core confirmed the stop. **Codex as a child is therefore not
  verified end to end.**

## Slice 5 landed (2026-11-07): messaging

The contract is in ARCHITECTURE ("Messages", written before the code). What later slices build on:

- **Files.** `agent_mail.rs` (pure: the banner, quoting, caps, admission, the idle-only rule
  `wait_reason`, Orca's "owed" rule, the note and roster wording), `db/agent_mail.rs` (tables `agent_mail`
  and `agent_mail_wakes`; admission, the key, the limits and the row in one transaction; the atomic
  `queued` to `delivering` claim; `unconfirmed` at boot), `server/agent_mail.rs` (routes `/agent/send|inbox|
  cancel`, the delivery engine `pass` over a `World` trait with the real `AppWorld`, `note_child`, the loop
  `run_deliveries` every 2 s or when something is queued), verbs `send`, `inbox`, `cancel` in
  `perchd/agent_cli.rs`. `AgentRuntimeAdapter` gained `record_agent_turn_boundary`, a person-turn listener
  (resets a lead's wakes) and an exit listener (a confirmed exit notes the lead).
- **Orca** (`308b5000`, header of `agent_mail.rs`): the banner, the custody ("owed") rule and the
  claim-once pointer delivery, with the cases of their tests. Not ported: priorities, threads, payloads,
  the terminal pointer lane, journal parking. Changed: idle-only, quoted bodies, notes-folder files,
  `unconfirmed`.
- **Receipts** are the four words of the guide; `unconfirmed` (bytes may have arrived, never resent) is
  Perch's addition to the three the owner named, because unknown is not failure.
- **Status notes** (`note_child`): a child's finished turn, a block on a person or a confirmed exit queues
  one note for the lead (a newer one from the same child replaces a queued one); a lead's waiting notes
  go in one roster prompt. Found live: the bridge's snapshot can trail the hook that ends the turn, so the
  last message is read 1.5 s later, and a finished turn is noted even with nothing to quote.
- **Notes folder.** `native_ui::notes_dir(run)`, `/tmp/perch-native-<uid>/notes/<run>/`, 0700. Slice 6 only
  has to name it in `perch guide`; today it holds the files of long messages.
- **Live** (`e2e/agent-mail.spec.ts`, TESTING): a haiku lead spawned a haiku child; with the chat window
  open on the lead, the child's message and its status note reached the lead (Claude path, confirmed by
  `UserPromptSubmit`), then the lead's message reached the idle child and it acted on it. **Found live,
  then decided by the owner:** an open view holds the input lease, and a first version that never wrote
  while a view held it left mail queued forever. Delivery now rides the holder's current lease inside
  `AgentRuntimeAdapter::dispatch_under_current_lease` (lease untouched, tested) and also needs a 2 s quiet
  window on the PTY (`input_quiet_for`, stamped in `prepare_input`, unknown = recent); a composer draft
  lives in the browser and is not protected (ARCHITECTURE "Lease contention"). **Not verified live:**
  Codex, Pi and OMP as receivers (their bridge path is unit-tested through the `World` trait only).

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
