# Third-party notices

Perch's original code is licensed under the GNU General Public License,
version 3 only (`GPL-3.0-only`); see [LICENSE](LICENSE). Third-party code,
dependencies, and assets retain their respective licenses and notices.

## Orca agent catalog and launch metadata

The provider names, executable mappings, documentation links, and default
arguments in `crates/perch-core/src/agent_catalog.json` are adapted from
[stablyai/orca](https://github.com/stablyai/orca), commit
`9aa0f7e77d366c23a3cc8de2da32ae550d397dc0`:

- `src/renderer/src/lib/agent-catalog.tsx`
- `src/shared/tui-agent-config.ts`
- `src/shared/tui-agent-permissions.ts`

Perch launches Claude Agent Teams with Claude's native in-process team mode;
it does not depend on Orca's application-specific pane wrapper.

## Orca harness and terminal icons

`packages/web/src/components/AgentIcon.tsx` and
`packages/web/src/assets/agent-icons/` adapt the SVG marks, generic terminal
icon and bundled favicons from Orca commit
`564f135248874ca3a710e3932c2395f5cbff0203`:

- `src/renderer/src/lib/agent-icon-glyphs.tsx`
- `src/renderer/src/components/status-bar/icons.tsx`
- `src/renderer/src/components/tab-bar/shell-icons.tsx`
- `src/shared/agent-icons/`
- `resources/openclaude-logo.png`

Brand marks remain the property of their respective owners. The Orca-derived
code and assets above are distributed under the following MIT notice.

MIT License

Copyright (c) 2026 Lovecast Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Orca native chat, hooks and orchestration ports

Rust ports in `crates/perch-core/src/native_ui/` and its siblings translate logic and
tests from [stablyai/orca](https://github.com/stablyai/orca), commit
`308b5000`, distributed under the MIT notice above (Copyright (c) 2026 Lovecast Inc.).
Each module's `//!` header names the files it follows:

- `native_ui/transcript.rs`: `src/shared/native-chat/` transcript and tool logic.
- `native_ui/claude.rs` hook version floors and `--version` parsing:
  `src/main/claude/claude-hook-event-versions.ts`, `claude-managed-hook-events.ts`.
- `native_ui/tasks.rs`: `src/shared/native-chat/input/native-chat-task-list{,-history}.ts` and
  `src/renderer/src/components/native-chat/native-chat-task-list-state.ts` (the
  `TaskCreate`/`TaskUpdate` reading is Perch's own).
- `native_ui/edits.rs`: `src/shared/native-chat/tools/native-chat-edit-{normalize,model,lcs,
  patch-files,cards}.ts`, `native-chat-unified-patch.ts`, `native-chat-begin-patch.ts`,
  `native-chat-diff.ts` (the parts they use), and `src/main/native-chat/
  transcript-line-decoders-claude.ts` (`structuredPatch`, in `native_ui/claude.rs`).
- `native_ui/subagents.rs`: `src/shared/native-chat/transcript/native-chat-subagent-{summary,
  group-header,items}.ts` and their tests; `packages/web/src/views/nativeChat/SubagentRoster.tsx`:
  layout and words of `NativeChatSubagentRun.tsx`.
- `native_ui/command_envelope.rs`: `src/shared/native-chat/native-chat-command-envelope.ts`,
  `src/shared/harness-injected-user-turns.ts`, `src/shared/claude-bash-input.ts` and their tests.
- `native_ui/session_options.rs`: `src/shared/model-id-label.ts` (and its test), the effort and
  permission-mode wording of `src/shared/native-chat/input/native-chat-session-option-labels.ts` and
  `src/renderer/src/components/native-chat/native-chat-permission-mode-labels.ts`, Claude's mode
  names from `src/main/claude/structured/claude-structured-init-proof.ts` and Codex's policies from
  `src/shared/codex-permission-policy.ts`.
- `native_ui/option_pickers.rs`: the Claude catalog of `src/shared/agent-session/options/
  agent-session-option-catalog-claude-codex.ts` (aliases, effort ladder, command templates),
  `src/shared/native-chat/input/native-chat-session-option-{snapshot,commands,state}.ts`
  (picker rules, `parseBuiltSessionOptionCommand`, `matchNativeChatCatalogModelId`) and the mode
  descriptions of `native-chat-permission-mode-labels.ts`. `packages/web/src/views/nativeChat/
  OptionLabels.tsx` takes the roles of `NativeChatModelCombobox.tsx` and
  `NativeChatPermissionModePicker.tsx` on Perch's own `Select`; no component code is copied.
- `sub_sessions.rs`: the worker states and the live set of `src/main/runtime/orchestration/types.ts`
  and `db/schema/create-core-tables-sql.ts`, the stop rules of `db/worker-dispatch/
  worker-dispatch-stop.ts` (a stop begins only from a running or unknown worker; an unconfirmed stop
  stays `stop_unknown`) and the depth refusal of `src/shared/nested-worker-depth.ts` and its test.
  Orca's tasks, gates, coordinator loop and report settlement are not ported; the limits and the
  turn rule are Perch's own.
- `agent_mail.rs` (with `db/agent_mail.rs`, `server/agent_mail.rs`): the message banner and its tests of
  `src/main/runtime/orchestration/formatter.ts`, the custody rule `structuredMailOwed` of
  `structured-mail-custody.ts` and the admit-once, never-resend delivery of
  `structured-mailbox-pointer-delivery.ts` with its test. Orca's priorities, threads, payloads and
  terminal pointer lane are not ported; idle-only delivery, quoting and the limits are Perch's own.
- `crew.rs` (with `server/crew.rs`): the row shape of `src/shared/orchestration-crew.ts`, the preview
  bound, section roles and pending-question rule of `src/main/runtime/orchestration/crew/
  crew-party-snapshot.ts` and the admitted-traffic, latest-per-peer and newest-first rules of
  `crew-query.ts`. `packages/web/src/views/nativeChat/FamilyStrip.tsx`: layout, wording and detail fields of
  `src/renderer/src/components/orchestration-crew/CrewRowView.tsx` and `CrewRowDetails.tsx`, on Perch's
  own classes. Orca's parent-claim reduction, recipient availability, Mention, row menu and panel are not
  ported.
- Interrupted row: `native_ui/claude.rs` (`interrupted`) and `native_ui/mod.rs`
  (`INTERRUPTED_STATUS_TEXT`) follow `src/main/native-chat/transcript-line-decoders-claude.ts`,
  `transcript-turn-markers.ts` and `src/shared/native-chat/native-chat-types.ts`.
- `native_ui/turn_diffs.rs`: `src/shared/native-chat/tools/native-chat-turn-diffs.ts`.
- `native_ui/file_links.rs`: `src/shared/native-chat/native-chat-href-routing.ts` and
  `src/shared/file-links/{file-link-location,explicit-file-link-target,
  file-link-path-normalization,file-uri-path}.ts`.
- `packages/web/src/views/nativeChat/CopyButton.tsx`: behaviour and labels of
  `src/renderer/src/components/native-chat/NativeChatCopyButton.tsx`.
- `packages/web/src/views/nativeChat/DiffCard.tsx`, `editRows.ts`: layout and copy text of
  `NativeChatDiffCard.tsx` and `native-chat-edit-cards.ts` (`nativeChatEditFilePatchText`);
  `TurnDiffRollup.tsx`: `NativeChatTurnDiffRollup.tsx`.
- `packages/web/src/views/nativeChat/useOlderHistory.ts`, `OlderHistoryRow.tsx`:
  `use-native-chat-older-history-autoload.ts`, `NativeChatOlderHistoryRow.tsx`; the page
  and outcome names in `native_ui/mod.rs` and `protocol.rs` follow `native-chat-pagination.ts`.

## PDF.js

PDF previews use [Mozilla PDF.js](https://github.com/mozilla/pdf.js), distributed
as `pdfjs-dist` under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
Copyright Mozilla Foundation and PDF.js contributors. The dependency retains
its copyright/license headers and includes the full license in its `LICENSE` file.

## Catppuccin palette

`packages/web/src/palettes/catppuccin.json` extracts the named Mocha/Latte hex
colors from `palette.json` in [catppuccin/palette](https://github.com/catppuccin/palette),
commit `07d02aa110ef9eb7e7427afca5c73ba9cf7f8ebd` (palette version 1.8.0).
Perch's semantic role mapping and accessibility adjustments are separate from
this upstream color data. The upstream data is distributed under this notice:

MIT License

Copyright (c) 2021 Catppuccin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
