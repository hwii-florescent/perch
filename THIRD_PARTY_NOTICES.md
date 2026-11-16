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
  own classes. Orca's parent-claim reduction, recipient availability, Mention and panel are not ported.
- `crew_actions.rs` (with `server/crew_actions.rs`) and the row actions of `FamilyStrip.tsx`: the menu shape
  of `src/renderer/src/components/orchestration-crew/CrewRowMenu.tsx` (a default action beside a "more"
  menu of the others, each item disabled when not possible), on Perch's own classes. Which provider
  mechanism carries Steer and Interrupt, who may use them and the caps are Perch's own; Orca's menu items
  (Mention, Open its chat, Copy address) are not ported.
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

## Ghostty terminal engine (libghostty-vt)

`perchd`'s terminal screen is [Ghostty](https://github.com/ghostty-org/ghostty)'s
terminal engine, commit `291fd050b9e9c293c8adb6a140742649b7e42d3a`, vendored as the
`third_party/ghostty` git submodule and compiled with Zig by `crates/ghostty-sys`.
`crates/perchd/src/screen.rs` is Perch's own code, written against Ghostty's public C
headers. Ghostty is distributed under this notice:

MIT License

Copyright (c) 2024 Mitchell Hashimoto, Ghostty contributors

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

The static library Ghostty builds also contains code Ghostty fetches as Zig
dependencies (see `third_party/ghostty/pkg/*/build.zig.zon` for their pinned
sources), each under its own licence, which travels with that source:

- [Google Highway](https://github.com/google/highway): Apache-2.0 or BSD-3-Clause.
- [simdutf](https://github.com/simdutf/simdutf): Apache-2.0 or MIT.
- [Wuffs](https://github.com/google/wuffs): Apache-2.0 or MIT.
- [uucode](https://github.com/jacobsandlund/uucode): MIT, with Unicode Data Files
  (Unicode License v3) and Bjoern Hoehrmann's UTF-8 decoder (MIT).
- Zig's compiler runtime (`compiler_rt`): MIT.

## herdr: libghostty-vt build configuration and terminal code

Licensed under the Apache License, Version 2.0
(<http://www.apache.org/licenses/LICENSE-2.0>); source
<https://github.com/herdrdev/herdr-app>, commit
`4c8c622d7965a6f6787f55b1896b70795fc68918`. Perch's copies are modified, and the
modified files carry a header saying so.

- `crates/ghostty-sys/build.rs` and `crates/ghostty-sys/src/lib.rs`: the Zig
  invocation flags and the bindgen configuration (header allow-lists, enum
  naming, the macOS SDK sysroot) and the lint allowances for the generated
  bindings. The Zig version check, the Rust-to-Zig target mapping and the
  submodule path are Perch's own.
- `crates/perch-native/src/terminal/vt.rs` (from `src/vt.rs`): the render-state
  frame read, the render-hold, OSC 52 and size-report callbacks, and the key and
  mouse encoder calls. Its theme, selection, search and link reads are in the
  files below; its paste encoding, replay muting and scroll reads are Perch's own.
- `crates/perch-native/src/terminal/keys.rs` (from `src/terminal.rs`): the table
  that maps GPUI key names to Ghostty keys, the shifted-punctuation table and the
  legacy control aliases.
- `crates/perch-native/src/terminal/scroll.rs` (from `src/terminal.rs`): the
  wheel and trackpad step accumulation.
- `crates/perch-native/src/terminal/select.rs`, `search.rs` and `links.rs` (from
  `src/vt.rs` and `src/links.rs`): the selection gesture model, the on-screen and
  scrollback search, and link detection. Perch's versions take the click time from
  the caller, report search progress, and find links with a scanner of their own.
- `crates/perch-native/src/terminal/fallback.rs` (from `src/terminal.rs`): the
  bundled-font icon lookup, the test for characters the configured font lacks, and
  the fitting of icons and oversize fallback glyphs to their cells.
- `crates/perch-native/src/terminal/layout.rs` (from `src/terminal.rs`): the
  re-centring of glyphs in a cell rounded to whole device pixels.
- `crates/perch-native/src/terminal/title.rs` (from `src/terminal.rs`): the removal of an
  agent's spinner from a title.
- `crates/perch-native/src/terminal/graphics.rs` (from `src/vt.rs`): the kitty
  graphics placement read, the Unicode-placeholder resolution and its geometry,
  the PNG decode hook and the BGRA conversion. Perch decodes PNGs with the `image`
  crate and reads the placeholder diacritic table from the Ghostty checkout at
  build time.
- `crates/perch-native/src/terminal/scrollbar.rs` (from `src/terminal.rs`): the
  thumb, lane and drag arithmetic of the scrollbar.
- `crates/perch-native/src/terminal/sprites.rs` (from `src/sprites.rs`): box
  drawing, block, braille and powerline characters drawn as shapes that fit their
  cell. Only the formatting and the module path differ.

## Symbols Nerd Font

`crates/perch-native/assets/fonts/SymbolsNerdFont-Regular.ttf` is the symbols-only
font from [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts), bundled by the native
terminal to draw the private-use icons a program prints (prompts, file trees) when the
configured font has none. Its license, which covers the Nerd Fonts patcher and the
collection, is MIT (Copyright (c) 2014 Ryan L McIntyre); the glyphs come from the
projects listed in the Nerd Fonts repository, each under its own license (mostly
SIL OFL 1.1, MIT and Apache-2.0). The license text is next to the font, in
`crates/perch-native/assets/fonts/LICENSE-SymbolsNerdFont.txt`. The file was copied
from herdr (commit `4c8c622d7965a6f6787f55b1896b70795fc68918`).

## Native mod engine: gpui-kit's shell, quickjs-jit-runtime and two GPUI crates

`vendor/` holds the native client's JavaScript mod engine, copied from herdr
(`https://github.com/herdrdev/herdr-app`, commit `4c8c622`, Apache-2.0), which vendors
it from its upstreams. Each copy keeps its upstream licence file and herdr's
`Vendored from ...` header; herdr's changes are marked `HERDR:` and Perch's `PERCH:`.

- `vendor/gpui-kit/` (`Cargo.toml`, `LICENSE-APACHE`, `crates/base`, `crates/fps`,
  `crates/shell` with `rquickjs-compat`): [longbridge/gpui-kit](https://github.com/longbridge/gpui-kit)
  at `1ccf011`, version 0.7.1, Apache-2.0 (Copyright 2024 - 2026 Longbridge); the
  `rquickjs-compat` facade is MIT. Perch's changes, each marked `PERCH:`:
  - `vendor/gpui-kit/Cargo.toml`: a header saying so.
  - `vendor/gpui-kit/crates/shell/Cargo.toml`, `vendor/gpui-kit/crates/shell/src/probe.rs`,
    `vendor/gpui-kit/crates/shell/src/materialize.rs` and the `probe` module in
    `vendor/gpui-kit/crates/shell/src/lib.rs`: test builds only (`render-test-support`), the
    laid-out box, colours and font of each named element.
  - `vendor/gpui-kit/crates/shell/src/lib.rs`: the window a host function is called from, for
    facts about it (its scale factor).
  - `vendor/gpui-kit/crates/shell/src/style.rs`: OpenType font features, by tag and as CSS
    `font-variant-numeric: tabular-nums` (`tnum`).
  - `vendor/gpui-kit/crates/shell/src/entities.rs` and
    `vendor/gpui-kit/crates/shell/src/materialize/components/scrollbar.rs`: a scroll request
    made before a scroll area's first layout waits for it, and one made after is taken in the
    same frame.
  - `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/entity_api.rs` and
    `vendor/gpui-kit/crates/shell/src/typings.rs`: a scroll handle's `item_bounds`, where a
    child was last laid out, for a script that anchors something to it.
  - `vendor/gpui-kit/crates/shell/src/watch.rs` and
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/lifecycle.rs`: a build that a reload
    replaces gets its final call (`View.close`) before it is released.
  - `vendor/gpui-kit/crates/shell/src/materialize.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs` and
    `vendor/gpui-kit/crates/shell/src/typings.rs`: `window_layer`, an element painted over the
    whole window from its top left wherever its parent sits, for what a screen in a region of the
    window portals (CSS `position: fixed`).
  - `vendor/gpui-kit/crates/shell/src/measure.rs` (new), the `measure` module in
    `vendor/gpui-kit/crates/shell/src/lib.rs`, `vendor/gpui-kit/crates/shell/src/materialize.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs` and
    `vendor/gpui-kit/crates/shell/src/typings.rs`: `measure`, the box an element was last laid
    out in, kept for a script that asked about it (`getBoundingClientRect`).
  - `vendor/gpui-kit/crates/shell/src/materialize.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs` and
    `vendor/gpui-kit/crates/shell/src/typings.rs`: `also_named`, more names a test reads an
    element's box by, beside its `id`.
  - `vendor/gpui-kit/crates/shell/src/file_image.rs` (new), the `file_image` module in
    `vendor/gpui-kit/crates/shell/src/lib.rs`, `vendor/gpui-kit/crates/shell/src/spec.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs` and
    `vendor/gpui-kit/crates/shell/src/materialize.rs`: an `image` whose source is an absolute
    path draws that file only when it is a regular file of at most 8 MiB inside the calling
    script's read grant, links resolved; anything else draws nothing and reads nothing.
  - `vendor/gpui-kit/crates/shell/src/measure.rs` and `vendor/gpui-kit/crates/shell/src/view.rs`:
    the boxes `measure` keeps are each script copy's own (by the policy it runs under), and go
    once the copy closes.
  - `vendor/gpui-kit/crates/shell/src/materialize.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs` and
    `vendor/gpui-kit/crates/shell/src/typings.rs`: hover groups, `group(name)` on an element and
    `group_hover(name, ...)` styles on a descendant, drawn while the pointer is over the group
    without calling the script.
  - `vendor/gpui-kit/crates/shell/src/engine/quickjs/sandbox.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs` and
    `vendor/gpui-kit/crates/shell/src/view.rs`: an event, timer or task that the time budget
    stops says so over its view, as a failed render does, instead of only being logged.
  - `vendor/gpui-kit/crates/shell/src/spec.rs`, `vendor/gpui-kit/crates/shell/src/snapshot.rs`,
    `vendor/gpui-kit/crates/shell/src/runtime.rs`,
    `vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs` and
    `vendor/gpui-kit/crates/shell/src/view.rs`: `reuse(id, generation)`, a subtree of the view's
    live description copied into the one being built, its handlers registered again, so an
    unchanged part is not described again.
  - `vendor/gpui-kit/crates/base/src/input/base/state.rs` and
    `vendor/gpui-kit/crates/base/src/input/base/undo_manager.rs`: `can_undo` and `can_redo`,
    whether undo or redo has anything to replay, for an editor's menu; `apply_external` and
    `map_external`, an edit from outside the editor (a store value) applied without an undo entry
    or a change event, the undo history mapped through it (what it overlaps is dropped).
- `vendor/quickjs-jit-runtime/`: the `jit` crate of
  [longbridge/quickjs-jit](https://github.com/longbridge/quickjs-jit) at `96593cd` with
  herdr's fix for longbridge/quickjs-jit#38, MIT (Copyright (c) 2020 Mees Delzenne,
  (c) 2025 Rquickjs Contributors). Perch only quiets its unused-code warnings
  (`vendor/quickjs-jit-runtime/Cargo.toml`).
- `vendor/gpui-pre/` and `vendor/gpui-pre-macos/`: the crates.io `gpui-pre` and
  `gpui-pre-macos` 0.3.8 (Zed's GPUI, Apache-2.0, Copyright 2022 - 2025 Zed Industries,
  Inc.), unchanged except for three of herdr's additions the shell names, each marked
  `PERCH:`: `AssetSource::image_resource` (a default method; nothing in this copy calls
  it; `vendor/gpui-pre/src/assets.rs`), `Application::with_activation_policy` and
  `ActivationPolicy::Prohibited` (`vendor/gpui-pre/src/app.rs`,
  `vendor/gpui-pre/src/platform.rs`, with its AppKit mapping in
  `vendor/gpui-pre-macos/src/platform.rs`). `vendor/gpui-pre/Cargo.toml` and
  `vendor/gpui-pre-macos/Cargo.toml` say so in a header, and the latter quiets lints. Herdr's
  other GPUI patches (idle wake, frame capture, terminal metrics, image cache) are not taken.

The shell also pulls `quickjs-jit` (MIT, with QuickJS-ng's MIT C sources) and
[LLRT](https://github.com/awslabs/llrt) modules (Apache-2.0) from git at the revisions
`vendor/gpui-kit/crates/shell/Cargo.toml` pins. Apache-2.0 and MIT code may be combined
into a GPL-3.0-only program; the licence texts stay beside each copy.

## React in the native mod runtime

`crates/perch-native/mods/react-runtime/runtime.mjs` (built from
`crates/perch-native/mods-runtime/react/` and compiled into the native client) bundles
[React](https://github.com/facebook/react) 19.2.8 (`react`, `react/jsx-runtime`),
`react-reconciler` 0.33.0 and `scheduler` 0.27.0, MIT, Copyright (c) Meta Platforms, Inc.
and affiliates. Each module keeps its `@license React` header in the bundle. `react-dom`
19.2.8 (MIT, the same copyright) runs only at build time: `react-dom/server` renders the
agent icons' SVG markup into `agent-icons.js`; none of its code ships. The bundle's own
`react-dom` is Perch's (`mods-runtime/react/react-dom.mjs`).
