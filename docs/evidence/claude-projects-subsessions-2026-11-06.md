# Claude Projects, desktop sub-sessions and peers (2026-11-06)

Research behind the 2026-11-06 decisions in [DECISIONS](../DECISIONS.md) and the
Projects/sub-session slices in [ROADMAP](../ROADMAP.md). Dated snapshot, not a
requirement list. Local versions: Claude desktop 4.23118.0 (downloaded from the
release URL in the public Homebrew cask, unpacked, never installed or run), Claude
Code 2.1.319, codex-cli 0.166.0, Pi 1.5.0, OMP 18.16.0, Orca at `308b5000`. No model
prompts were sent. Line numbers refer to pretty-printed desktop bundles and are only
locators; bundle chunk names change every release.

## Claude desktop: how Code sessions and sub-sessions work

- **Transport.** A local Code session is the desktop's own pinned Claude CLI driven by
  the Agent SDK over stream-json (`--output-format stream-json --input-format
  stream-json --permission-prompt-tool stdio`, plus `--resume`, `--fork-session`,
  `--resume-session-at`). Not a PTY. Control requests used: `interrupt`
  (`cancel_queued`), `set_permission_mode`, `set_model`, effort via
  `apply_flag_settings`, `rewind_files {dry_run}`, `get_context_usage`, `stop_task`,
  `background_tasks`; streams `session_state_changed` (idle / requires_action /
  running), `commands_changed`, `post_turn_summary`.
- **Sub-sessions are "side sessions".** Tools come from in-process MCP servers (SDK
  type `sdk`, never on argv): `ccd_session` (`start_session`, `spawn_task`,
  `hand_off_to_session`, ...) and `ccd_session_mgmt` (`list_sessions`, `get_session`,
  `search_session_transcripts`, `send_message`, `stop_session`, `archive_session`,
  `set_session_model`, ...). `start_session` is deferred behind ToolSearch.
- **Prompt cost.** The parent's block on starting other sessions is ~13.5k chars of
  source; a child's ~2.5k (it tells the child that its first message is its task and
  that the first 400 characters of its report go back to the starter). Included only
  when the side-session toolset flag is on.
- **Reports.** On each child turn end the desktop queues a note on the parent
  (`queuedSideSessionNotes`, last 32): title, report (wrap-up recap else last
  message, 400 chars), `waitsOnUser`, branch, PR number.
- **Waking the parent.** `<side-sessions-event>` as an auto-continuation, only if the
  parent is idle with no pending permission or dialog and no child still working;
  stops after 10 wakes since the user's last message
  (`sideSessionWakesSinceUserMessage >= 10`).
- **Status is not a model claim.** "Needs the user" = permission broker or dialog
  broker has a pending request for that session; also working / failed / done, PR #n
  / idle. A one-line roster per linked session is appended, marked as status rather than instruction.
- **Authority.** Starting sessions is refused on turns opened by another session's
  message, an automated event or a delegated task (only the user's own words may start
  one); unattended sessions need a person present. Peer
  messages arrive as `<cross-session-message from="..." from-name="...">`, treated as
  data; receipts are delivered / queued (turn running) / undelivered(reason). Acting on
  a session the caller did not start asks the user; delete always asks.
- **Stop and archive.** Stop interrupts the non-archived descendants and marks them
  stopped until a person sends; archive refuses a working, pinned or visible session and
  takes children with it.
- **Shared context.** Desktop project instructions are appended to the system prompt
  as `<project_instructions>`, links capped at 2,000 chars; each session tree gets a
  notes folder.

## Claude Code Projects (beta; code.claude.com/docs/en/claude-projects)

Coordinator conversation that starts threads (cloud by default, local through Remote
Control). Instructions up to 16,000 chars sent to every new thread; memory files with a
`MEMORY.md` index; a library (100 files per pick, 10 folders). Threads load only root
`CLAUDE.md`, `.claude/CLAUDE.md` and `.claude/rules/`. Overview groups: Ready for review,
Waiting on you, Working, Landing, Idle, Resolved. Answers and approvals happen inside
the thread, not through the coordinator. 500 new threads per day. The CLI side is a
claude.ai Projects bridge (`/project`, `project_memory_*` tools) that needs a claude.ai
login: nothing Perch can drive.

Claude Code 2.1.224+ also has documented cross-session messaging (`ListAgents`,
`SendMessage`, per-session Unix socket on one machine, plain text, max 100 held,
`crossSessionInbound: refuse` to opt out). Its socket protocol is undocumented; not a
Perch contract.

## What the desktop UI has that a PTY view can or cannot match

Feasible over the attached terminal (hooks, transcript, typed commands): session
status and nested child rows, per-turn changes card, docked task list (TodoWrite /
TaskCreate), subagent rows (SubagentStart/Stop + sidechain transcripts), plan text box,
permission-mode and model/effort pickers as typed commands with a read-back,
`/compact`, notifications, fork (`--resume --fork-session`).
Needs stream-json: queue cards with Send now / steer receipts, rewind with file
restore and undo, token streaming, context breakdown, background-task stop.

## Skills and per-session reach (zero-token checks)

| CLI | Starting cost | Per-session skill without global install |
|---|---|---|
| Claude | name + description, 1% of window, 1,536 chars per entry | `--plugin-dir` (unverified) |
| Codex | name + description + path, 2% or 8,000 chars | **none**: `codex debug prompt-input` showed `--add-dir` and `skills.config` paths add nothing; only `CODEX_HOME`, `.agents/skills` up to repo root, `~/.agents/skills` |
| Pi | name + description + path | `--skill <path>` |
| OMP | name + description | `--config` overlay `skills.customDirectories` or `--plugin-dir` (unverified) |

`claude --help` 2.1.319 lists `--append-system-prompt` but not
`--append-system-prompt-file` (still in the binary). Codex `debug prompt-input` renders
the full model input without a model call: the zero-token check for Codex.

## Peers

- **Orca:** `orca orchestration` CLI plus a bundled skill (description ~880 chars,
  stub 4.3k on trigger, guide via `orca skills get`). Worker preamble ~2.1k chars,
  pasted at start. Terminal delivery types only a pointer ("You have N orchestration
  messages. Run `orca orchestration check`"); it also types while a recognised agent
  is working. Caller ids "identify same-user callers, not credentials". Nested depth
  default 1; circuit breaker after 3 failed starts. `check` consumes mail.
- **T3 Code:** app-owned MCP server (`delegate_task`, `task_status`, `task_cancel`,
  `t3_thread_send`); per-provider-session bearer scoped to the parent thread, expiring;
  ~3.8k chars of injected instructions plus schemas.
- **vibe-kanban:** stdio MCP server, 34 tools, polling `get_execution`.

## Perch seams found

Launch seam: `server/terminal.rs` extra args → `agent_runtime.rs` argv →
`provider_environment.rs` bootstrap (snapshots the core environment, 0600 self-deleting
script). Gaps: loopback requests are fully trusted (an agent has full authority); no
core discovery file and a per-launch desktop port; the `perch` binary name is taken by
perchd's connect-only tool; `sessions` has no parent link and there is no session
incarnation; the post-exit login shell (`in_shell`) would inherit a token; the shell
shim and Codex app-server (`codex app-server --listen`, no flags) get no extra args;
Codex sends `turn/start` even while a turn runs (`turn/steer` unused); Pi has a native
follow-up queue; Claude only a PTY paste; Claude hook `EVENTS` omit SubagentStart/Stop
and drop `last_assistant_message`.

## Slice 0 feasibility spike (2026-11-06)

Claude 2.1.319, codex-cli 0.166.0, Pi 1.5.0, OMP 18.16.0, macOS. Run in a scratch
directory with a stub `perch` on `PATH` that prints `PERCH_SESSION` and, per name, only
*set* or *unset* (never a value). Banners checked first (Claude: Haiku 4.5). Live turns
only on `claude-haiku-4-5` and `gpt-5.6-luna`, one per row. Codex used a throwaway
`CODEX_HOME` (auth copied in, deleted after); Pi used a private agent dir with the real
auth symlinked and `--no-session -ne`; OMP ran `--no-session --no-extensions`. No product
code kept; no Perch core in the loop (the launch seam is what slice 1 and 3 add).

| # | Question | Provider | Result |
|---|---|---|---|
| 1a | Pointer reaches the model | Codex TUI flag | `codex -c developer_instructions='…' debug prompt-input x` shows it as the first block of the `developer` message (no model call); absent without the flag |
| 1b | | Codex shared app-server | `codex app-server -c developer_instructions=… --listen stdio://` accepts the flag (listed in its `--help`); one luna turn on a thread started with no per-thread override quoted the line verbatim. `thread/start` also takes `developerInstructions`/`config` per thread, an alternative seam. Zero-token check not possible: `thread/start` reports `instructionSources: []` either way |
| 1c | | Claude | `--append-system-prompt "$(cat f)"` and `--append-system-prompt-file f` both raised `/context` "System prompt" from 7.6k to 8k tokens for a 1.9 kB file (no prompt sent, no Enter on a prompt). The file flag is no longer hidden: 2.1.319 `--help` names it under `--bare`. One haiku turn quoted the pointer verbatim from a file-loaded prompt |
| 1d | | Pi | `--append-system-prompt <text>` and `<file path>` both quoted by one luna turn each (one earlier combined prompt answered NONE: model compliance, the repeat quoted it) |
| 1e | | OMP | `--append-system-prompt=<file>` quoted verbatim by one luna turn |
| 2 | Scope variable reaches the agent's shell tool | all four | `PERCH_SESSION` and every credential-shaped name (`PERCH_TOKEN`, `PERCH_AUTH_TOKEN`, `PERCH_SESSION_AUTH`, `PERCH_SECRET`, `PERCH_API_KEY`, `PERCH_SCOPE`, `PERCH_CAP`) reached `perch whoami` run by Claude (haiku, bypass permissions), Codex (luna, default sandbox and env policy, through `/bin/zsh -lc`), Pi and OMP. **Claude 2.1.319 did not scrub the `_TOKEN`/`_KEY` names** that Orca reports scrubbing from 2.1.310; keep `PERCH_TOKEN`, but `perch whoami` must name a missing variable as a possible provider scrub, and the scrub may depend on a mode or setting not exercised here (permission prompts, sandboxing) |
| 3a | Queue while busy | Pi | RPC `follow_up` during a running `bash` call (same queue as the bridge's `deliverAs: "followUp"`): the turn finished (FIRST_DONE), then the note ran as its own turn (SECOND_DONE) |
| 3b | | OMP | Identical to Pi |
| 3c | | Codex | **Not refused.** `turn/start` on a running thread returns a new in-progress turn id and the text joins the running turn (the reply merged both asks: "SECOND_DONE STEERED"); `turn/steer` is accepted too. So the core's own idle check is the only guard: slice 5 delivers to Codex only when the snapshot says idle, never relying on a refusal |
| 4 | New: Claude pins its own prompt | Claude | 2.1.319 adds `--system-prompt-snapshot <on\|off>` (default on): the first request's prompt, `--append-system-prompt` included, is recorded and resent as-is on resume even if the next launch passes different text, until compaction. Perch still pins the file and records provenance, but a wake cannot change what Claude sends |
| 5 | Fix-first: did the `tool_name` defect matter live? | Claude | `e2e/native-composer.spec.ts -g claude` (request-card step, `AskUserQuestion`) passes with and without the `read_event` fix: the question still blocks through another path (very likely `PermissionRequest`, which fires for the dialog). The defect was latent, not user-visible; the fix is kept |

**What changes in the next slices:** nothing contradicts the plan. Slice 1 may use the
Claude file flag (the 16,000-character text stays out of `argv`), Pi/OMP a file and Codex
`-c developer_instructions=<text>` (no file form exists short of `model_instructions_file`,
which replaces the base prompt). Slice 5 must not assume Codex refuses a busy send.
Caveats: single runs, and the Codex shell ran under the default read-only sandbox only.
