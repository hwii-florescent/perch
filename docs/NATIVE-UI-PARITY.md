# Native UI parity with Orca

Checklist for UI mode (Chat view over the user's real CLI). Source of truth is Orca's
terminal-backed ("bridge") chat, `src/renderer/src/components/native-chat/*` and the pure
logic in `src/shared/native-chat/*` (clone at `/tmp/orca-src`, commit `308b5000`).
Orca's docs call this form "a view over a running terminal agent": same design as ours.
Orca's *structured* chat (own engine, journal, stream-json/RPC) is a different product and is
out of scope; where a feature exists only there it is marked **structured only**.

How to use: pick a row, read the named Orca file, port the logic to Rust (`crates/perch-core`,
`//!` header, unit test) and keep React thin. Status: ✅ done · 🟡 partial · ⬜ missing ·
❓ Orca file not read yet (name only), read it before building.

Rule from AGENTS.md: domain logic lives in Rust. Today `nativeChat/transcript.ts`
(`toBlocks`, `findBlocks`) and the changed-files logic are in the web package; they move to
the Rust projection below when it exists.

## Engine (Rust) — what Orca keeps in `shared/native-chat`

| Area | Orca source | Perch |
| --- | --- | --- |
| Slash catalog per agent (Claude, Codex, Pi, OMP) | `input/native-chat-slash-commands.ts` | ✅ built-ins captured from each CLI's real `/` menu (`native_ui/slash_commands.json`, regenerate with `e2e/capture-slash-menu.py`; Orca's hand list was already stale: Codex 49 vs its 23, OMP 94 vs its 22) plus what the running CLI reports: Claude `init` (skills, plugin and project commands), Codex skills, Pi/OMP `getCommands()` (extensions, prompt templates, `skill:<name>`) over the bridge. Live-checked on all four |
| Agent profiles: skill prefix (`/` or `$`), `skill:` name prefix, which commands the host claims vs the agent expands | `native-chat-agent-profiles.ts` | 🟡 sigils and per-sigil kinds done (`menuTokens.ts`); host-claimed vs agent-expanded is the send slice |
| Skill discovery by scanning skill folders (shared roots, own, other agent's) | `shared/skills`, `native-chat-skill-visibility.ts`, `use-native-chat-skills.ts` | 🟡 names come from each CLI itself (more accurate than guessing roots); Claude gives no skill descriptions, so those rows have none; remote hosts: Claude/Codex probes only |
| Send classification: chat / command / unknown token; slash drafts get no user bubble | `native-chat-slash-commands.ts` (`classifyNativeChatSend`) | ⬜ **next slice.** Probed: Claude built-ins (`/context`, `/compact`, `/help`, `/model`, `/resume`) fire no `UserPromptSubmit`, so a UI send ends "unconfirmed"; only Claude is typed into the PTY, Codex/Pi/OMP prompts go through app-server / `sendUserMessage`, so a built-in sent that way would reach the model as prose |
| Command envelopes, host-answered commands (`/context`, `/clear`) | `native-chat-command-envelope.ts`, `use-native-chat-local-command-answer.ts` ❓ | ⬜ |
| Tool pairing (call ↔ result), folding, run header/sentence/outcome, tool identity, line labels, file targets | `tools/native-chat-tool-*.ts` ❓ | 🟡 runs fold; no call↔result pairing, no per-tool lines or outcomes |
| Edit cards from tool input (`begin_patch`, edits, unified patch, LCS diff) | `tools/native-chat-edit-*.ts`, `native-chat-unified-patch.ts` ❓ | ⬜ (we show git diff of the last turn instead) |
| Turn diffs and per-turn rollup | `tools/native-chat-turn-diffs.ts`, `NativeChatTurnDiffRollup.tsx` | 🟡 last complete turn only, via git |
| Work runs, trailing run, live line, working suppression, terminal-turn resolution | `native-chat-work-run.ts`, `transcript/native-chat-live-line.ts`, `native-chat-terminal-turn.ts` ❓ | 🟡 |
| Reasoning rows and ordering | `transcript/native-chat-reasoning-row.ts` | 🟡 folded into runs |
| Subagent sections/groups/summary | `transcript/native-chat-subagent-*.ts`, `NativeChatSubagentRun.tsx` | ⬜ (ROADMAP step 2) |
| Task list (TodoWrite style) parsed from frames, docked | `input/native-chat-task-list*.ts`, `NativeChatDockedTaskList.tsx` | ⬜ |
| Background tasks roster and strip | `shared/background-task-roster.ts`, `NativeChatBackgroundTasksStatus.tsx` | ⬜ (hooks; shares step 2) |
| Thread goal banner/chip (`/goal`) | `native-chat-thread-goal-*.ts`, `NativeChatThreadGoalBanner.tsx` | ⬜ |
| Pending sends, send order, clock skew, message order | `transcript/native-chat-pending-sends.ts`, `native-chat-send-order.ts` | 🟡 one pending copy, unconfirmed never replayed |
| Provider notices: retry runs, usage limit (+ auto-continue), provider exit, interrupted-continue, cut turn | `native-chat-provider-retry-runs.ts`, `native-chat-usage-limit-cut.ts`, `NativeChatUsageLimit*.tsx`, `NativeChatInterruptedContinue.tsx` | ⬜ (we hit usage limits in e2e and show nothing useful) |
| Context usage summary and ring | `native-chat-context-usage*.ts`, `NativeChatContextUsageRing.tsx` | ✅ ring; ⬜ per-category breakdown and `/context` answer |
| Ask/question cards: multi-question, auto-advance, dismiss, resolution receipts | `input/native-chat-ask*.ts`, `NativeChatQuestionCard.tsx`, `native-chat-resolution-receipt.ts` | 🟡 single choice; receipts browser-only; no multi-select or typed answer |
| Approval envelope and card | `input/native-chat-approval-envelope.ts`, `NativeChatApprovalCard.tsx` | ✅ Claude, Codex; ⬜ OMP tool approvals and plan review (`omp-plan-review-prompt.ts`) |
| Permission mode labels/picker | `native-chat-permission-mode-labels.ts`, `NativeChatPermissionModePicker.tsx` | ⬜ |
| Session options (model, effort, mode) applied by agent commands in the terminal | `input/native-chat-session-option*.ts`, `NativeChatSessionOption*.tsx`, `NativeChatModelCombobox.tsx` | ⬜ (decided: chosen at start, no chrome over a live session; revisit now that Orca does it through `/model` in the terminal) |
| Rewind (eligibility, copy, host) | `native-chat-rewind-*.ts`, `NativeChatRewindAction.tsx` | ⬜ |

## Transcript view (React, thin)

| Area | Orca source | Perch |
| --- | --- | --- |
| Virtualized message list, row height estimate, windowing, older-history pagination and autoload | `NativeChatMessageList.tsx`, `native-chat-row-height-estimate.ts`, `native-chat-pagination.ts`, `use-native-chat-older-history-autoload.ts` | ⬜ (bridge caps 129 messages, no paging) |
| Autoscroll, jump to latest, reader scroll, reveal latest | `native-chat-autoscroll.ts`, `NativeChatJumpToLatest.tsx` | 🟡 pill + follow |
| User message fold, prompt collapse/pill | `NativeChatUserMessageFold.tsx`, `NativeChatPromptCollapse.tsx` | ⬜ |
| Message grouping, timestamps, turn activity line, elapsed timer, working status | `native-chat-message-grouping.ts`, `NativeChatMessageTimestamp.tsx`, `NativeChatTurnActivityLine.tsx`, `NativeChatWorkingStatus.tsx` | ⬜ |
| Tool lines with icons, outputs, file targets, call counts; expandable runs | `NativeChatToolRun.tsx`, `NativeChatToolLine.tsx`, `NativeChatToolOutput.tsx`, `NativeChatToolIcon.tsx` | 🟡 text rows |
| Diff card and diff view | `NativeChatDiffCard.tsx`, `NativeChatDiffView.tsx` | 🟡 plain `<pre>` |
| Markdown: highlighted code blocks with copy, images, paced streaming | `NativeChatMarkdown.tsx`, `NativeChatCodeBlock.tsx`, `NativeChatPacedMarkdown.tsx` | 🟡 markdown yes; no copy button, no pacing |
| File links with existence check and open-in-pane; file reference pills | `native-chat-file-link*.ts`, `NativeChatFileReferencePill.tsx` | ⬜ |
| Web/GitHub link peek and click behaviour | `NativeChatLinkPeek.tsx`, `NativeChatGitHubLinkPeek.tsx` | ⬜ |
| Message actions: copy, quote selection, context menu | `NativeChatCopyButton.tsx`, `NativeChatSelectionQuote.tsx`, `use-native-chat-context-menu.tsx` | ⬜ |
| Find (with match navigation) and message rail | `NativeChatFindBar.tsx`, `NativeChatMessageRail.tsx` | ✅ basic |
| Font size / appearance settings | `use-native-chat-font-size.ts`, `native-chat-appearance*.ts` | ⬜ |
| Empty state, loading cue, session gate, retained transcript while reconnecting | `NativeChatEmptyState.tsx`, `NativeChatSessionGate.tsx`, `use-native-chat-retained-session.ts` | 🟡 |
| Inline visuals (Orca-specific) | `NativeChatInlineVisual.tsx` | not pursued |

## Composer

| Area | Orca source | Perch |
| --- | --- | --- |
| Rich prompt editor with pills for skills, files, images, pasted text | `NativeChatPromptEditor.tsx`, `NativeChatSkillPill.tsx`, `native-chat-pasted-text-*.ts` | 🟡 plain textarea + menu |
| Draft persistence across reload (IndexedDB journal), per tab | `native-chat-composer-draft-*.ts` | 🟡 in-memory per session |
| Attachments: images, text files, pasted text as file, folders, drop from workspace, remote hosts | `use-native-chat-composer-attachments.ts`, `native-chat-paste-*.ts`, `NativeChatTextAttachments.tsx` | 🟡 images/files, local host only |
| Queued messages: cards, edit, reorder, delete; follow-up behaviour (queue vs steer) | `NativeChatQueuedMessage*.tsx`, `native-chat-follow-up-behavior.ts`, `native-chat-queued-edit-*.ts` | ⬜ |
| Prompt recall (sent prompt history) | `use-native-chat-composer-recall.ts`, `native-chat-sent-prompt-history.ts` | ⬜ |
| Interrupt / stop | `use-native-chat-composer-interrupt.ts` | ✅ |
| Slash and `$` picker with descriptions and argument hints; `@` mention files | `NativeChatAutocompleteMenus.tsx`, `use-native-chat-composer-command-picker.ts`, `use-native-chat-mention-files.ts` | ✅ all four providers, descriptions and Pi's argument hints, whole list reachable (scrolls); no kind grouping or badges yet |
| Quick commands menu | `use-native-chat-quick-commands-menu.tsx` | ⬜ |
| Goal chip, permission picker, option pickers, context ring in actions row | `NativeChatComposerActions.tsx` | 🟡 ring only |
| Dictation | `use-native-chat-dictation.ts` | not pursued |
| Pick up a draft typed in the terminal | `use-native-chat-terminal-draft-pickup.ts`, `readTerminalDraft` | ⬜ (we only send into an empty prompt) |
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
