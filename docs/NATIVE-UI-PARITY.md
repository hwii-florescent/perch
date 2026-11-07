# Native UI parity with Orca

**Target changed 2026-11-06:** UI mode now aims at Claude desktop's Code tab
([decision](DECISIONS.md), ranked gaps in [ROADMAP](ROADMAP.md) step 0,
[evidence](evidence/claude-projects-subsessions-2026-11-06.md)). The rows below stay the
code reference for terminal-backed features; rows marked "structured only" are the
candidates for the later Claude stream-json mode.

Checklist for UI mode (Chat view over the user's real CLI). Source of truth is Orca's
terminal-backed ("bridge") chat, `src/renderer/src/components/native-chat/*` and the pure
logic in `src/shared/native-chat/*` (clone at `/tmp/orca-src`, commit `308b5000`).
Orca's docs call this form "a view over a running terminal agent": same design as ours.
Orca's *structured* chat (own engine, journal, stream-json/RPC) is a different product and is
out of scope; where a feature exists only there it is marked **structured only**.

How to use: pick a row, read the named Orca file, port the logic to Rust (`crates/perch-core`,
`//!` header, unit test) and keep React thin. Status: ✅ done · 🟡 partial · ⬜ missing ·
❓ Orca file not read yet (name only), read it before building.

Rule from AGENTS.md: domain logic lives in Rust. The transcript is projected by
`crates/perch-core/src/native_ui/transcript.rs`; `nativeChat/transcript.ts` only picks the
blocks off the snapshot (and shows an older core's messages unfolded).

## Engine (Rust) — what Orca keeps in `shared/native-chat`

| Area | Orca source | Perch |
| --- | --- | --- |
| Slash catalog per agent (Claude, Codex, Pi, OMP) | `input/native-chat-slash-commands.ts` | ✅ built-ins captured from each CLI's real `/` menu (`native_ui/slash_commands.json`, regenerate with `e2e/capture-slash-menu.py`; Orca's hand list was already stale: Codex 49 vs its 23, OMP 94 vs its 22) plus what the running CLI reports: Claude `init` (skills, plugin and project commands), Codex skills, Pi/OMP `getCommands()` (extensions, prompt templates, `skill:<name>`) over the bridge. Live-checked on all four |
| Agent profiles: skill prefix (`/` or `$`), `skill:` name prefix, which commands the host claims vs the agent expands | `native-chat-agent-profiles.ts` | ✅ sigils and per-sigil kinds (`menuTokens.ts`); host-claimed vs agent-expanded is `route()` |
| Skill discovery by scanning skill folders (shared roots, own, other agent's) | `shared/skills`, `native-chat-skill-visibility.ts`, `use-native-chat-skills.ts` | 🟡 names come from each CLI itself (more accurate than guessing roots); Claude gives no skill descriptions, so those rows have none; remote hosts: Claude/Codex probes only |
| Send classification: chat / command / unknown token; slash drafts get no user bubble | `native-chat-slash-commands.ts` (`classifyNativeChatSend`) | ✅ Rust `native_ui/typed.rs` `route()` (read in Orca: `classifyNativeChatSend`, `typeAgentTuiCommand`). Probed live first: a built-in sent as a message fired no Claude `UserPromptSubmit` (UI stuck "unconfirmed"), and on Codex `/status` and Pi `/session` it reached the model as prose and started a turn that ran shell tools. Now a built-in (any `/word` on Codex, whose skills are `$name`) is typed into the CLI's terminal, one PTY write per key (Claude: its confirmed paste path), refused while a turn runs, a dialog/draft is open, or a pager/overlay is up; skills, extension and project commands and unknown tokens stay messages. The reply carries `command: true`: no user bubble, a "Ran /x in the CLI" notice, output stays in CLI view. Live-checked on all four (`e2e/native-slash-send.spec.ts`). Ceilings (`ponytail:` in code): draft check reads the cursor row, overlay check knows two shapes (OMP titled box, Codex pager) |
| Command envelopes, host-answered commands (`/context`, `/clear`) | `native-chat-command-envelope.ts`, `use-native-chat-local-command-answer.ts` ❓ | 🟡 Claude's transcript envelopes (`native_ui/command_envelope.rs`): a skill row shows as `/name args`, a built-in's envelope and `<local-command-stdout>` rows and other harness-injected user turns are hidden, `!cmd` shows as typed; ⬜ host-answered `/context` and `/clear` (Orca's `surfaceNativeChatCommandOutputs`, `use-native-chat-local-command-answer.ts` not read) |
| Tool pairing (call ↔ result), folding, run header/sentence/outcome, tool identity, line labels, file targets | `tools/native-chat-tool-pairs.ts`, `-tool-icon.ts` (categories), `-tool-line-label.ts`, `-tool-summary.ts`, `-tool-run-sentence.ts`, `-tool-activity.ts`, `-tool-preview-prefix.ts` | ✅ Rust `native_ui/transcript.rs`: results pair with their call by id (unnamed ones with the oldest unanswered call; orphans keep a row); each call is a row with Orca's verb and target ("Edited changed.txt", "Ran cargo test", "Tried to read x"); state running / completed / failed / unfinished from the provider (Codex `status`, OpenCode `state.status`), then the result's error flag, then whether the turn runs; the run header is a sentence in the right tense ("Read 2 files and ran 3 commands"; a lone settled command reads as itself) with an "n failed" mark. Providers now send call ids and result links (`NativeUiTool.id/state`, `NativeUiMessage.toolCallId/isError`), and long input strings are shortened before the size cap so a path survives (Claude, Codex, Pi/OMP, OpenCode). Ceilings: no MCP identity, browser-command category, web-search result lists, exit code or duration (the bridges do not carry them); an input with nothing to name shows only the tool's name |
| Edit cards from tool input (`begin_patch`, edits, unified patch, LCS diff) | `tools/native-chat-edit-*.ts`, `native-chat-unified-patch.ts` | ✅ Claude: a landed `Edit`/`MultiEdit`/`Write` is a file card (verb, name, +n −m, "Diff truncated", Copy diff, rows opened on demand) read in Rust (`native_ui/edits.rs`); Claude's `toolUseResult.structuredPatch` rides on the result and gives true line numbers, a snippet pair gets none. Codex `file changes` and `apply_patch`/shell envelopes are read too (unit-tested, not live-checked: the live Codex run asks approval and its item shape varies). Pi/OMP `edit`/`write` keep the plain row (Orca's names are case-sensitive). A rejected or unanswered edit keeps its plain row; the whole history shares 4,000 card rows (newest win). Ceilings: input strings past 12 KiB are cut and the card says so; Orca's journal-only `Diff` tool is not ported |
| Turn diffs and per-turn rollup | `tools/native-chat-turn-diffs.ts`, `NativeChatTurnDiffRollup.tsx` | ✅ each turn with a landed edit call gets a rollup of its files (once each, totals, opening to the edits' cards; `native_ui/turn_diffs.rs`), drawn after the turn's last block; for the newest settled turn Git's changed-files card (`useLastTurnChanges`) replaces it. Counts what the agent's edit calls reported, not the disk; edits Perch reads no card for (Pi/OMP, shell) are absent. No reveal-in-transcript |
| Work runs, trailing run, live line, working suppression, terminal-turn resolution | `native-chat-work-run.ts`, `transcript/native-chat-live-line.ts`, `native-chat-terminal-turn.ts` | 🟡 runs, turn membership (`turn` = the user message that opened it) and the live line ("Running npm test", "Thinking", "Working…"; hidden while a person is needed) are Rust. Not ported: Stop-in-progress line, elapsed timer (bridges carry no per-message timestamps), Orca's lead/thought run rules (ours: consecutive thinking and calls) |
| Reasoning rows and ordering | `transcript/native-chat-reasoning-row.ts` | 🟡 folded into runs |
| Subagent sections/groups/summary | `transcript/native-chat-subagent-*.ts`, `NativeChatSubagentRun.tsx` | 🟡 Claude: one roster row per spawning turn ("Kicked off 2 subagents" → "Ran 2 subagents, completed"), children read from Claude's own `<session>/subagents/` files (`native_ui/subagents.rs`, live-checked on haiku). States: working, completed, status unavailable (no failed/stopped: the files do not say). ⬜ per-child transcript, tokens, live clock; Codex children (`parentThreadId`), Pi/OMP lifecycle events |
| Task list (TodoWrite style) parsed from frames, docked | `input/native-chat-task-list*.ts`, `NativeChatDockedTaskList.tsx` | 🟡 docked above the composer and read in Rust (`native_ui/tasks.rs`); a plan call's step reads as what it changed ("Completed X"). Claude 2.1.319 offers no `TodoWrite`, it keeps its list with `TaskCreate`/`TaskUpdate` (read from observed inputs and results, Perch's own); Codex plan updates are not surfaced by our bridge as calls; Pi/OMP not read (Orca reads neither) |
| Background tasks roster and strip | `shared/background-task-roster.ts`, `NativeChatBackgroundTasksStatus.tsx` | ⬜ (hooks; shares step 2) |
| Thread goal banner/chip (`/goal`) | `native-chat-thread-goal-*.ts`, `NativeChatThreadGoalBanner.tsx` | ⬜ |
| Pending sends, send order, clock skew, message order | `transcript/native-chat-pending-sends.ts`, `native-chat-send-order.ts` | 🟡 one pending copy, unconfirmed never replayed |
| Provider notices: retry runs, usage limit (+ auto-continue), provider exit, interrupted-continue, cut turn | `native-chat-provider-retry-runs.ts`, `native-chat-usage-limit-cut.ts`, `NativeChatUsageLimit*.tsx`, `NativeChatInterruptedContinue.tsx` | 🟡 the interrupted row only: Claude's injected interruption row and Codex's `interrupted` turn status become a quiet "Conversation interrupted" line (`native_ui/mod.rs`, no Continue button); ⬜ usage limit (we hit it in e2e and show nothing useful), retry runs, provider exit |
| Context usage summary and ring | `native-chat-context-usage*.ts`, `NativeChatContextUsageRing.tsx` | ✅ ring; ⬜ per-category breakdown and `/context` answer |
| Ask/question cards: multi-question, auto-advance, dismiss, resolution receipts | `input/native-chat-ask*.ts`, `NativeChatQuestionCard.tsx`, `native-chat-resolution-receipt.ts` | 🟡 single choice; receipts browser-only; no multi-select or typed answer |
| Approval envelope and card | `input/native-chat-approval-envelope.ts`, `NativeChatApprovalCard.tsx` | ✅ Claude, Codex; Claude's plan review (ExitPlanMode) is a card with the plan and the two choices that need no typed feedback (`dialog.rs`, live-checked); ⬜ OMP tool approvals and plan review (`omp-plan-review-prompt.ts`) |
| Permission mode labels/picker | `native-chat-permission-mode-labels.ts`, `NativeChatPermissionModePicker.tsx` | 🟡 Claude ✅: a picker (`nativeChat/OptionLabels.tsx`, `agent.ui.option`) steps Claude's own Shift+Tab cycle one key at a time under the input lease and shows only the mode its footer then names (`native_ui/option_pickers.rs`, live-checked with no tokens: `native-options.spec.ts`). Refused while a turn runs, a prompt is open or the prompt holds a draft. Codex: read-only label from its thread settings; ⬜ picker (`/permissions` is a numbered list, and Full Access adds a confirmation dialog Perch would have to answer: needs an owner call); Pi/OMP none |
| Session options (model, effort, mode) applied by agent commands in the terminal | `input/native-chat-session-option*.ts`, `NativeChatSessionOption*.tsx`, `NativeChatModelCombobox.tsx` | 🟡 Claude ✅ model and effort pickers (owner yes 2026-11-06): the CLI's own `/model <v>` and `/effort <v>` typed at an idle, verified-empty prompt under the input lease; the model reads back by the `PostModelSwitch` hook (or Claude's "Set model to" line), the effort by the footer indicator or Claude's "Set effort level to" line; a change the CLI never shows is "unconfirmed". Claude saves both as the user's defaults (each picker says so). No effort picker when nothing reads the effort back (Haiku 4.5, and after a model switch until one is set). Codex: label only (its `/model` is a two-step TUI list over the account's models: needs `model/list` and a decision on driving it); Pi/OMP: model label only (their `/model` opens a list; Orca's `/orca-model` extension command is not in Perch's extension). Orca's catalog for other CLIs, fast mode and its "dispatched" caption are not ported |
| Rewind (eligibility, copy, host) | `native-chat-rewind-*.ts`, `NativeChatRewindAction.tsx` | ⬜ |

## Where we are, and what is next

Done and live-checked on Claude, Codex, Pi, OMP (OpenCode has a bridge but no catalog or e2e):
composer menus and attachments, approvals and questions, collapsed runs, changed-files card,
find and rail, context ring, slash catalog, built-in slash commands sent to the terminal,
and chat for agents typed into a Terminal tab (`SHELL-AGENT-STATUS.md`, not an Orca feature).

Next slices, in this order. For each: read the named Orca files first (mark ❓ rows read),
probe the real CLIs before claiming a gap, build it in Rust with a unit test, run the relevant
live e2e, update this file, commit.

1. ~~Rust transcript projection.~~ Done, live-checked on Claude, Codex, Pi and OMP
   (`native-composer.spec.ts` changed-files step: live line, a settled call paired with its
   output, its turn, no failures, find through the core). Left over: the changed-files card still
   asks git for the newest turn (`useLastTurnChanges`; `transcript.ts` held none of it, the web
   keeps a one-line predicate), per-turn diffs and edit cards (rows above), tool icons, file
   links, question calls (`AskUserQuestion`, OMP `ask`) as their own transcript rows.
2. ~~Composer.~~ Done, live-checked on Claude, Codex, Pi and OMP (`native-composer.spec.ts`
   "terminal draft pickup" and "recall and draft"): prompt recall, draft persistence across
   reload, and picking up a draft typed in the terminal. Queue cards and Steer: not applicable to
   the terminal-backed chat (see the Composer table). Left over: multi-line or wrapped terminal
   drafts stay in the terminal (the empty-prompt refusal still applies to them), and staged
   files are not persisted.
3. **Provider notices.** Usage limit (we hit it in e2e and show nothing), retry, interrupted
   continue.
4. **Host-answered commands.** `/context` answer and "Ran /x" markers interleaved in the
   transcript (read `native-chat-command-envelope.ts`, `use-native-chat-local-command-answer.ts`
   fully; slice 2 only did the send).
5. Older-history paging for Codex, Pi, OMP and OpenCode (Claude's is done), remote-host attachments, OMP tool
   approvals and plan review, restore open chats after restart, rewind.
6. Then ROADMAP steps: SubagentStart/Stop hooks (also feeds the task strip and subagent rows),
   Projects, sub-sessions.

Known flakes, not regressions: OMP and Codex bridges sometimes fail to connect at e2e start
(`data-native-pid` never set); Codex and Pi accounts hit usage limits. Test setup:
`TESTING.md`; composer specs run with
`cd e2e && npx playwright test -c native-composer.config.ts <spec> --workers 1`
(`native-composer`, `native-terminal`, `native-slash-send`). Slash-menu data regenerates with
`e2e/capture-slash-menu.py`.

## Transcript view (React, thin)

| Area | Orca source | Perch |
| --- | --- | --- |
| Virtualized message list, row height estimate, windowing, older-history pagination and autoload | `NativeChatMessageList.tsx`, `native-chat-row-height-estimate.ts`, `native-chat-pagination.ts`, `use-native-chat-older-history-autoload.ts` | 🟡 older-history paging for Claude: a snapshot that is cut off carries `canLoadOlder`, an observer on the transcript's top asks (`agent.ui.older`), the core widens that session's window by 200 messages (and its byte and file-tail budgets) up to 528 and the longer snapshot follows; a failed or empty page stops the automatic loading and offers a button; the reader's place is kept. Codex (cursor `nextCursor`), Pi, OMP and OpenCode bridges send a fixed window from the CLI's own process and keep the "Showing recent messages" note. Not ported: virtualization and row-height estimates (the list is plain DOM) |
| Autoscroll, jump to latest, reader scroll, reveal latest | `native-chat-autoscroll.ts`, `NativeChatJumpToLatest.tsx` | 🟡 pill + follow |
| User message fold, prompt collapse/pill | `NativeChatUserMessageFold.tsx`, `NativeChatPromptCollapse.tsx` | ⬜ |
| Message grouping, timestamps, turn activity line, elapsed timer, working status | `native-chat-message-grouping.ts`, `NativeChatMessageTimestamp.tsx`, `NativeChatTurnActivityLine.tsx`, `NativeChatWorkingStatus.tsx` | 🟡 activity line (text from the core, no spinner); no grouping, timestamps or timer |
| Tool lines with icons, outputs, file targets, call counts; expandable runs | `NativeChatToolRun.tsx`, `NativeChatToolLine.tsx`, `NativeChatToolOutput.tsx`, `NativeChatToolIcon.tsx` | 🟡 verb + target rows, each opening to its input and paired output, failures in red; no icons, file links or highlighted commands |
| Diff card and diff view | `NativeChatDiffCard.tsx`, `NativeChatDiffView.tsx` | ✅ `DiffCard.tsx` (row view, gutter, gaps, copy); no syntax highlighting |
| Markdown: highlighted code blocks with copy, images, paced streaming | `NativeChatMarkdown.tsx`, `NativeChatCodeBlock.tsx`, `NativeChatPacedMarkdown.tsx` | 🟡 markdown yes; no copy button, no pacing |
| File links with existence check and open-in-pane; file reference pills | `native-chat-file-link*.ts`, `NativeChatFileReferencePill.tsx` | 🟡 a markdown link naming an existing file in the workspace becomes a pill that opens it in a file tab (`fs.links`, `native_ui/file_links.rs`; local and remote workspaces); an absent file or a link outside the workspace stays inert. Not done: opening at the line, `file:` links (the sanitizer strips them), paths in inline code, Orca's recheck after each turn, the composer's file-reference pill (that is the attachment chip) |
| Web/GitHub link peek and click behaviour | `NativeChatLinkPeek.tsx`, `NativeChatGitHubLinkPeek.tsx` | ⬜ |
| Message actions: copy, quote selection, context menu | `NativeChatCopyButton.tsx`, `NativeChatSelectionQuote.tsx`, `use-native-chat-context-menu.tsx` | 🟡 copy button on each finished message (hover or focus; copies the message's markdown, no Rust: Perch has no visual-directive or subagent-twin text to strip); no quote selection, no context menu |
| Find (with match navigation) and message rail | `NativeChatFindBar.tsx`, `NativeChatMessageRail.tsx` | ✅ basic; the core decides what matches (`agent.ui.find`, looks inside runs) |
| Font size / appearance settings | `use-native-chat-font-size.ts`, `native-chat-appearance*.ts` | ⬜ |
| Empty state, loading cue, session gate, retained transcript while reconnecting | `NativeChatEmptyState.tsx`, `NativeChatSessionGate.tsx`, `use-native-chat-retained-session.ts` | 🟡 |
| Inline visuals (Orca-specific) | `NativeChatInlineVisual.tsx` | not pursued |

## Composer

| Area | Orca source | Perch |
| --- | --- | --- |
| Rich prompt editor with pills for skills, files, images, pasted text | `NativeChatPromptEditor.tsx`, `NativeChatSkillPill.tsx`, `native-chat-pasted-text-*.ts` | 🟡 plain textarea + menu |
| Draft persistence across reload (IndexedDB journal), per tab | `native-chat-composer-draft-*.ts` | 🟡 text survives reload and restart (`composerDraft.ts`: localStorage per viewer, newest 50 chats, 7 days); staged files do not (a path on the host that may be gone) |
| Attachments: images, text files, pasted text as file, folders, drop from workspace, remote hosts | `use-native-chat-composer-attachments.ts`, `native-chat-paste-*.ts`, `NativeChatTextAttachments.tsx` | 🟡 images/files, local host only |
| Queued messages: cards, edit, reorder, delete; follow-up behaviour (queue vs steer) | `NativeChatQueuedMessage*.tsx`, `native-chat-follow-up-behavior.ts`, `native-chat-queued-edit-*.ts` | not applicable. Read in Orca: the cards, edit leases and reorder live in its **structured** session journal (`NativeChatStructuredSession`, `agent-session-journal/queued-message-*`), not the terminal-backed chat. Here the CLI owns its queue: a send during a turn goes to the CLI, which queues or steers it its own way (the button reads "Queue message"). A second queue in Perch would hide what the CLI really holds, so there are no cards |
| Prompt recall (sent prompt history) | `use-native-chat-composer-recall.ts`, `native-chat-sent-prompt-history.ts` | ✅ Up from an empty composer recalls the transcript's user prompts newest first, Down walks back and clears; in a multi-line recalled prompt the arrows move the caret until it reaches the edge; any edit ends recall (`composerDraft.ts`, unit-tested, live-checked on all four). Ceilings: slash commands have no transcript entry so are not recalled; a prompt sent with files recalls with their paths |
| Interrupt / stop | `use-native-chat-composer-interrupt.ts` | ✅ |
| Slash and `$` picker with descriptions and argument hints; `@` mention files | `NativeChatAutocompleteMenus.tsx`, `use-native-chat-composer-command-picker.ts`, `use-native-chat-mention-files.ts` | ✅ all four providers, descriptions and Pi's argument hints, whole list reachable (scrolls); no kind grouping or badges yet |
| Quick commands menu | `use-native-chat-quick-commands-menu.tsx` | ⬜ |
| Goal chip, permission picker, option pickers, context ring in actions row | `NativeChatComposerActions.tsx` | 🟡 ring; Claude's model, effort and mode pickers sit in the toolbar (rows above) |
| Dictation | `use-native-chat-dictation.ts` | not pursued |
| Pick up a draft typed in the terminal | `use-native-chat-terminal-draft-pickup.ts`, `readTerminalDraft` | ✅ Rust `native_ui/typed.rs` `read_draft` reads the CLI's input line from its screen, probed first with real CLIs in tmux (Claude, Pi, OMP draw it between two rules; Codex leads it with `›`; OMP titles the rule above it after a turn). Opening the chat once it is idle and ours reads it (`agent.ui.draft`) and the composer shows it; the next send carries `replaces`, and the core clears the line (Ctrl-U, which empties all four CLIs) only if it still holds exactly that, verifies it is empty, then sends, so the message replaces the draft instead of being appended (Claude previously refused). Fail-closed: a draft that wraps or has several lines, an overlay, a dialog or an unknown CLI is `Unreadable`, never picked up or cleared. Ceilings (`ponytail:`): Codex draws no rules, so a multi-line draft with the cursor on its first row reads as that row; a CLI's greyed suggestion text on an empty line would read as a draft |
| Composer notices (delivery, host outage, mobile hold) | `NativeChatComposerNotices.tsx`, `use-native-chat-host-outage-notice.ts` | 🟡 |

## Pane and navigation

| Area | Orca source | Perch |
| --- | --- | --- |
| Header: show terminal, settings, resume in CLI, copy session id | `NativeChatPaneHeader.tsx`, `NativeChatResumeInCliButton.tsx` | 🟡 mode switch |
| Toggle shortcut Chat ↔ Terminal | `use-native-chat-toggle-shortcut.ts` | ⬜ |
| Files dropped onto the pane | `NativeChatPaneFileDropSurface.tsx` | ✅ composer drop |
| Per-agent Chat/CLI choice (Orca) | Settings → Agents | decided: one global setting |
| Resume saved conversation in chat/terminal | tab/session history menus | ⬜ (ROADMAP: restore open chats) |
| Crew / agent messaging panel | `orchestration-crew/*` | ⬜ (ROADMAP step 3) |
