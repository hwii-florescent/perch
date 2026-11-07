# What the real CLIs do: probes behind the native chat and sub-sessions (2026-11)

Dated snapshot of facts the code depends on and cannot show: behaviour of other
people's CLIs. Versions: Claude Code 2.1.318–2.1.319, Codex 0.166, Pi 1.5.0, OMP
18.16.0. They move; re-probe before relying on a line after an upgrade. Live turns
used only `claude-haiku-4-5` or `gpt-5.6-luna`; most probes used tmux with isolated
config dirs and no tokens. The slice 0 table (launch flags, env reach, queueing) is in
[claude-projects-subsessions-2026-11-06](claude-projects-subsessions-2026-11-06.md).

## Claude Code 2.1.319

### Transcript and hooks

- No `TodoWrite`. Tasks use `TaskCreate` (input `subject`, `description`; result
  "Task #N created successfully: …") and `TaskUpdate` (`taskId`, `status`).
- Interrupt rows: "[Request interrupted by user…]" user rows; 2 of 5 seen in 2.1.318
  lacked the `interruptedMessageId` marker, so match the two exact texts too.
- Skill = one user row `<command-message>x</command-message><command-name>/x</command-name>`;
  a built-in (`/plan`) = an envelope row plus a `<local-command-stdout>` row; `!ls` shows as typed.
- A delivered banner is recorded wrapped in `<pasted_content id="N">` lines.
- `UserPromptSubmit` carries `permission_mode`; `SessionStart` carries only `model`.
  `PostModelSwitch` fires (`to_model`). Nothing names effort.
- The Stop-hook snapshot can trail the hook that ends a turn; read the last message ~1.5 s later.
- Perch's hook files keep only the latest event per name, so concurrent subagents overwrite
  each other. The roster is read from `<session>/subagents/agent-<id>.meta.json` (`agentType`,
  `description`, `toolUseId`, `finished`) and `.jsonl` instead. `finished` is written before the
  child's last rows; a child's rows can be 85 KB.
- `SubagentStart` (`agent_id`, `agent_type`) and `SubagentStop` (+ `agent_transcript_path`,
  `last_assistant_message`, `background_tasks[]`) fire; an `Agent` call runs in the background.

### Typed commands

- `/model <alias|id>` and `/effort <level>` apply at once and **save the user's own default**
  (`model`, `modelSettings.<model>.effortLevel`). The alias `haiku` resolves to Haiku **5.5**
  (`claude-haiku-5-5`); only the id `claude-haiku-4-5` is 4.5.
- Permission mode has no command: Shift+Tab (`ESC [ Z`) cycles it. Default start:
  manual → accept edits → plan → auto → manual. With `--dangerously-skip-permissions` (what
  Perch uses): bypass → auto → manual → accept edits → plan → bypass. The footer names the mode
  (`⏸ manual mode on`, `⏵⏵ accept edits on`, `⏸ plan mode on`, `⏵⏵ auto mode on`,
  `⏵⏵ bypass permissions on`).
- Effort read-back: the `● high · /effort` indicator, else the newest `Set effort level to …` line
  still on screen (voided by a later `Set model to`). After a model switch no effort is drawn until
  one is set. Haiku 4.5 has none ("Effort not supported").
- A fresh Claude draws a placeholder in an empty prompt (`❯ Try "fix lint errors"`, dim, cursor
  on its first letter) unless `promptSuggestionEnabled` is false. The daemon's emulator
  (vt100 0.15) drops SGR 2, so the core recognises it by shape plus cursor position. Not covered:
  the dim suggestion Claude may draw after a turn still reads as a draft.
- ExitPlanMode already draws a numbered dialog: the plan between two `╌` rules, a solid rule, the
  question (wraps at 80 columns), a `ctrl+g to edit…` footer. Option 1's wording follows the
  permission mode.

**Mid-turn input.** Text submitted while a turn runs goes into Claude's own queue and is fed into
the running turn at its next step (transcript: `queue-operation enqueue`, then `remove` with
`reason: absorbed_mid_turn`, an `attachment` of type `queued_command`; one `Stop` for the turn;
`UserPromptSubmit` fires at submission, not absorption). Absorption waits for the running tool call
to end. A "steer" sent just after a turn ended starts a new turn instead.

**One-shot (reporter).** `--tools "" --no-session-persistence --disable-slash-commands
--strict-mcp-config --setting-sources ""` plus a one-line `--system-prompt`: 541 input tokens,
$0.0009, answer is fenced JSON, no session file. Not `--bare` (skips the keychain, so a login is
not found).

## Codex 0.166

- A busy `turn/start` is **not refused**: it joins the running turn. Idle delivery is the core's
  check alone. `turn/steer` takes `threadId`, `expectedTurnId`, `input` and answers `turnId`; a
  rejected steer does not drop the connection.
- `turn/completed` with `status: "interrupted"` marks an interrupt. `thread/settings/updated` and
  `thread/resume` carry model, effort, `approvalPolicy`, `sandbox(Policy)`, `approvalsReviewer`.
- `/model` is a two-step TUI list (model, then reasoning level; `enter` saves a default, `s` is
  session-only) over the account's own models. `/permissions` is numbered; "Full Access" asks
  "Enable full access?". No picker was built because auto-confirming a risk dialog was not approved.
- Reporter: `-m gpt-5.6-luna -s read-only --ephemeral` with features disabled prints only the final
  message; tokens on stderr (1,891 for a trivial prompt). `codex debug prompt-input` shows ~52 KB of
  model input by default, ~32 KB trimmed; the rest is Codex's own tool text. `gpt-6-luna` exists
  (`codex debug models`).
- Skills never listed until the parser stopped matching prose that named the heading.

## Pi 1.5.0 and OMP 18.16.0

- Both read the one-shot prompt from stdin. `pi --print --mode json --model <m> --thinking off
  --no-session --no-tools --no-extensions --no-skills --no-prompt-templates --no-context-files
  --no-mcp --offline` and `omp --print --mode json --model <m> --thinking off --no-session
  --no-tools --no-extensions --no-skills --no-rules --no-context-files --no-lsp --no-title`: 92 and
  214 input tokens, under $0.001, no session file. `--mode json` is used for its usage: the answer
  is the last `message_end` of role `assistant`; `stopReason` `error`/`aborted` is refused.
- Steer is `sendUserMessage(text, {deliverAs: "steer"})`, only while `!ctx.isIdle()`.
- `/model` only opens a TUI list; Orca applies an OMP model through its own extension command, which
  Perch's extension lacks. Their effort and mode have no read-back, so there is no picker.
- Pi/OMP `[messages...]` positional prompts were checked for option parsing only, not by a live turn.
