# Native editor spike: findings

Question: can a GPUI app show a syntax-highlighted, editable code file comparable to Perch's CodeMirror editor?

Short answer: yes, today, for the cost of one dependency. `gpui-component =0.7.2` (crates.io, longbridge) ships a real code editor that compiles against `gpui-pre =0.3.8` on rustc 1.97.1, renders tree-sitter highlighting headlessly, and edits. It is not CodeMirror-complete, but the gap is small, enumerable and mostly additive.

Spike: branch `spike/native-editor` in `/Users/hwiii/Github/perch-native-editor-spike`, directory `spikes/native-editor/` (standalone Cargo project, own `[workspace]`, never merged). Commit `0a5f60e`. Proof images are committed: `spikes/native-editor/out/highlighted.png` and `out/scrolled.png`. Test: `cargo test --test highlighted_render` (custom `main`, `harness = false`, same recipe as `perch-native/tests/sidebar_render.rs`).

Legend: **Verified** = I ran it or read the source/registry data this session. **Belief** = inference, not tested.

## Routes evaluated

### (a) gpui-component / gpui-kit code editor: WORKED

Verified:

- `gpui-component` and `gpui-kit` are the same repo (`longbridge/gpui-kit`), versioned in lockstep, released weekly. The `gpui-pre` pin each version carries (crates.io dependency data, plus the downloaded 0.7.1 and 0.7.2 manifests):

  | gpui-component | gpui-pre |
  |---|---|
  | 0.6.6 | =0.3.6 |
  | 0.7.0 | =0.3.7 |
  | **0.7.1, 0.7.2** | **=0.3.8** |
  | 0.7.3 | =0.3.9 |
  | 0.8.0 | =0.3.9 |
  | 0.8.1 | =0.3.10 |
  | 0.9.0 | =0.3.11 |
  | 0.9.1 (latest, 2026-11-09) | =0.3.12 |

  So of the versions checked (0.6.6 and every 0.7.x to 0.9.1; pins only move forward), exactly two fit `=0.3.8`: 0.7.1 and 0.7.2. I used `=0.7.2`. `cargo tree -i gpui-pre` shows a single `gpui-pre 0.3.8` in the graph, so no duplicate GPUI types.
- It compiles clean on rustc 1.97.1 with Perch's root `Cargo.lock` copied in as the seed (so transitive versions match what already builds). Cold build wall-clock on this machine: about 50 s debug, 67 s release.
- The editor is not in the `gpui-component` crate itself. It is `gpui_base::input::EditorState` (crate `gpui-base`, Apache-2.0, ~11k-line `InputBaseState` engine), re-exported as `gpui_component::input::{Editor, EditorState}`. Enable one grammar with the `tree-sitter-rust` feature instead of all of them.
- Herdr's vendored copy (`perch-refs/herdr-app/vendor/gpui-kit`) contains only `base`, `fps` and `shell`. It has no `component` or editor crate, so it is **not** evidence that the editor compiles or that herdr uses it. It does confirm the `=0.3.8` pin pattern and that longbridge's own CI enforces exact pins (`script/check-gpui-pin.ts`).
- The headless recipe needed four things beyond the sidebar test, each found by failing without it:
  1. `gpui_component::init(cx)` and `Theme::change(ThemeMode::Dark, ..)` before opening a window.
  2. `Root` as the window's root view, wrapping the host view.
  3. The `EditorState` built inside `open_window`'s closure (it needs `&mut Window`).
  4. **Parse timing.** The first frame is unhighlighted. The tree-sitter adapter tries a 2 ms synchronous parse, then falls back to a background task behind a 150 ms debounce. The test must `run_until_parked()`, `advance_clock(400ms)`, `run_until_parked()` and then draw again. My first run without this rendered plain white text and the colour assertion failed, which is what proved the assertion is meaningful.

### (b) Minimal own view (tree-sitter + GPUI text system): NOT BUILT

Not needed, because (a) worked. Belief: it is feasible (`tree-sitter-highlight` ranges into `StyledText::with_highlights`, a `uniform_list` of lines), but you would be re-writing the editing engine (rope, selection, IME via `EntityInputHandler`, undo, wrap, scroll, cursor) that `gpui-base` already provides. That is the expensive half of an editor. Keep (b) only as the fallback if gpui-component's pin story breaks (see risks).

### (c) Lifting Zed's `editor` crate: NOT BUILT, assessed

Verified from `zed-industries/zed` `crates/editor/Cargo.toml` (main, fetched today):

- Licence `GPL-3.0-or-later`. No Zed `editor` snapshot is published on crates.io (`gpui-pre-editor` and `zed-editor` both return 404), unlike `gpui-pre`.
- Roughly 70 dependency entries, about 38 of them Zed-internal crates, including `project`, `workspace`, `language`, `multi_buffer`, `lsp`, `settings`, `theme`, `theme_settings`, `client`, `db`, `rpc`, `dap`, `git`, `fs`, `ui`, `telemetry`.

Belief: a standalone lift means vendoring or git-pinning a large slice of Zed at a revision that matches `gpui-pre 0.3.8`, with an unstable internal API and no snapshot guarantee. That is a rewrite-sized, ongoing-merge-sized commitment, so it should be rejected on entanglement rather than licence.

## Headless proof (verified)

`out/highlighted.png` is `crates/perch-native/src/client.rs` (435 lines) rendered at 1000x640 logical px (2x scale), dark default theme, showing line numbers, active-line highlight, indent guides, and tree-sitter colours. I read the image. Keywords (`use`, `pub`, `fn`, `let`, `impl`) are blue, types purple, constants and numbers amber, comments grey, function calls blue, strings green (clearly visible in `out/scrolled.png`, lines 32-63).

The test asserts colour presence from pixels, not a unique-colour count (anti-aliasing makes that meaningless). It takes each token class's colour from the active `HighlightTheme`, counts pixels within +/-12 per channel, and requires at least 4 distinct colours with at least 30 px each. The grey of comments is excluded from that count because the gutter shares it. Measured: keyword 4292 px, type 15218, number/constant 2690, function 547, property 363. That is 5 distinct colours, plus strings later (9533 px at the scrolled position).

Editing, verified headlessly: `EditorState::insert("// edited by the spike\n")` through the state API, redraw, pixel diff = 384,569 px changed (everything below shifts one line) and `out/scrolled.png`, rendered after the insert, still shows correct colours with the `format!` line one line lower than in the source. I did not open `edited.png` (not committed). `set_cursor_position` scrolls the target line into view.

Not verified: real keystroke dispatch (auto-close pairs, Enter auto-indent, Tab, undo/redo keys), IME composition, mouse selection, clipboard, the search panel UI. `insert()` goes through the same replace path but not the typed-key path. Source shows `auto_close.rs`, `indent.rs`, `undo_manager.rs`, `ime_marked_range` and `search.rs` exist.

## What the editor does today vs what the route gives vs what must be built

Today's reference: `packages/web/src/components/CodeEditor.tsx`, `editorSyntax.ts`, plus `editorKeymap.ts`, `editorDiff.ts`, `editorSearchPanel.ts` and the uncommitted `editorTyping.ts` in the main checkout.

| Capability | CodeEditor today | gpui-component gives | Must build |
|---|---|---|---|
| Languages | TS, TSX, JS, JSX, JSON, Rust, Python, Markdown, CSS, HTML, YAML, TOML, Shell, Go, Dockerfile; others plain | Tree-sitter grammars behind one cargo feature each: JSON (always), Rust, Python, Go, JS, TS, TSX, CSS, HTML, Bash, Markdown (+ inline), YAML, TOML and more (Verified: feature list in the 0.7.1 manifest; only Rust rendered) | Dockerfile (no grammar in the 0.7.x dependency list; Verified), extension-to-language mapping, JSX handling. Each grammar adds compile time and binary size. |
| Highlighting | Lezer, mapped to theme CSS vars | Tree-sitter, theme is Zed-compatible JSON (`HighlightTheme`) | Map Perch theme tokens to a `HighlightTheme` (mapping table of about 10 classes) |
| Themes | Every Perch theme through CSS vars, contrast-checked | Dark/light switch, custom `HighlightTheme` | Theme bridge from Perch themes; the spike used the default dark theme only |
| Large files | Skips highlight above 300,000 chars | Docs say "about 50K lines". Measured (single run) below | Decide a cap; it does not need to skip highlighting |
| Line numbers, active line, indent guides, soft wrap, folding | Yes (no folding, no guides) | Yes, builder flags (`line_number`, `soft_wrap`, `folding`, `indent_guides`) | Style to match |
| Search / replace | Custom panel (`editorSearchPanel.ts`), find and replace, selection matches | Built-in panel on by default (`searchable`), plus programmatic `set_search_query`, next/previous, replace one/all | Re-skin; confirm it matches today's key flow |
| Typing helpers | Auto-close pairs/quotes, overtype, auto-delete, Enter indent, re-indent on `}` (VS Code semantics) | `auto_close.rs`, `indent.rs`, `language_config` (`AutoClosingPair`, `IndentationRules`) | Verify behaviour against `editorTyping.ts` rules, per-language config for each grammar |
| Matching-bracket highlight | Yes | Not found by name search of `gpui-base` input source (bracket hits are auto-close pairs and the Enter-between-`{}` split, which does exist) | Build |
| Go to line | Yes | Not found; `set_cursor_position` exists | Small dialog plus call |
| Undo/redo | `history()`, parked per file (32 LRU) | Undo manager per `EditorState` | Keep one `EditorState` per open file to park it; port the LRU |
| External change (store echo) | Minimal diff via `externalChanges`, no history entry | `set_value` (clears history), `replace_all` (adds history), range replace via IME-style API | Port `editorDiff` onto range replacement without undo entry; may need a gpui-base patch |
| Draft ownership (`value`/`onChange` store contract) | Yes | `InputEvent::Change` event | Adapter; LF/CRLF handling (`detectEol`, `toLf`) must be re-built |
| Read-only | Yes | `Editor::readonly` | None |
| Context menu | Custom, with "Ask agent" | `Editor::context_menu` builder | Re-create menu items |
| Keymap | `editorKeymap.ts` | Action-based keymap (`Backspace`, `MoveToStart`, `Indent`, ...) | Bind Perch's shortcuts |
| IME / accessibility | Browser | Native `InputHandler` path (`ime_marked_range`) | Verify; no screen-reader story verified |
| Zoom | `--zoom` | Theme `mono_font_size` | Wire to the settings |
| LSP, completions, diagnostics | No | Present (`CompletionProvider`, `Diagnostic*`, hover, code actions) | Not needed |

Measured, single runs, spike-only (1.88 MB, 50,025 lines made by repeating `client.rs` 115 times, with 1000x640 window, includes headless GPU render and PNG readback; not an interactive frame time):

| Build | Open (set text) | First render + parse | One edit + render |
|---|---|---|---|
| debug | 1.43 s | 1.26 s | 634 ms |
| release | 93 ms | 205 ms | 97 ms |

Highlighting still produced keyword pixels at 50k lines (4212 px), so a skip threshold like the web editor's 300,000 chars is probably unnecessary. Caveat: this is a single machine, one run each, and the keyword count is a sanity check, not proof the whole file highlighted. A real scroll/typing frame-time measurement is not done.

## Licence (partly belief)

- gpui-component, gpui-base: Apache-2.0 (Verified in their Cargo.toml and `LICENSE-APACHE`). `gpui-pre`: Apache-2.0 (Verified). Tree-sitter grammars are mostly MIT (belief). Apache-2.0 into a `GPL-3.0-only` project is fine (belief, standard compatibility).
- Zed `editor`: `GPL-3.0-or-later` (Verified). Combining it into `GPL-3.0-only` works by electing the "3.0" option (belief, not legal advice). Licence is therefore not the blocker; entanglement is.

## Effort estimate (rough, one engineer)

- Embed editor in `perch-native` for read plus edit of one file, Perch theme bridge, 6-8 languages, dirty tracking through the existing draft contract: **M** (1-2 weeks).
- Parity polish to today's CodeEditor: typing helpers verified against `editorTyping.ts`, search panel skin, matching brackets, go-to-line, context menu with Ask agent, per-file parked state, external-change merge, EOL handling, keymap: **M-L** (2-4 weeks), mostly small, independent pieces.
- Real interaction verification (keystrokes, IME, selection, clipboard, scroll perf) in an isolated headless harness: **S-M**, but needs a way to deliver keys without a window; not proven in this spike.
- Own view (route b) from scratch: **XL** (months for engine parity). Zed `editor` lift (route c): **XL** plus continuous merge cost.

## Risks

1. **Pin churn (main).** longbridge releases weekly and bumps the `gpui-pre` pin with it. Only 0.7.1 and 0.7.2 match `=0.3.8`, and 0.7.2 will not get fixes. Moving Perch's GPUI forward means moving `gpui-component` with it, and Perch has already found 0.3.10+ does not compile on stable rustc 1.97.1. Mitigation: pin both exactly and treat upgrades as a deliberate event. I did not test 0.7.3 on `gpui-pre 0.3.9`, and did not test whether 0.9.x compiles on 1.97.1.
2. **Large engine surface.** `gpui-base`'s `InputBaseState` is about 11k lines in a single file. Behavioural gaps (external-change merge without history, EOL handling) may need a fork or patch.
3. **Dependency weight.** The spike's normal dependency graph is about 559 crates, mostly GPUI itself; the editor adds `gpui-component`, `gpui-base`, `gpui-kit-assets` (icon and asset embedding), `tree-sitter`, `ropey 2.0.0-beta.1` (a beta) and one grammar per language.
4. **Headless parse timing.** Any visual test must advance the clock past the 150 ms parse debounce, or it will pass against plain text. Easy to get wrong silently.
5. **Real input not verified.** Typing behaviour is the part users notice most and I only checked it exists in source.
6. **Single maintainer ecosystem, pre-release GPUI.** Same risk class as the native client as a whole.

## Recommendation

Adopt route (a). Add `gpui-component =0.7.2` (features: the chosen tree-sitter grammars only) to `perch-native` with `gpui-pre =0.3.8` pinned exactly, and build the editor view on `EditorState`, one per open file. Do not start on route (b) or (c).

Before committing to parity, spend a short follow-up on the two unverified things that decide the experience: (1) drive real typed input (auto-close, Enter indent, undo) headlessly by dispatching actions on the entity, and (2) measure scroll and typing frame time in a release build on a large file. If either fails, fall back to route (b) using `gpui-base`'s engine concepts as a model.

Keep the spike branch (`spike/native-editor`) as a reference; it is not for merging.

## Unresolved questions

- Does `gpui-component 0.7.3` (pinned to `gpui-pre =0.3.9`) compile on rustc 1.97.1? Only matters if Perch moves off 0.3.8.
- Does the built-in search panel and its key flow match the web editor's, or does Perch need its own panel over `set_search_query`?
- Is there a Dockerfile grammar available from elsewhere, or is plain text acceptable there?
- Is `ropey 2.0.0-beta.1` (pinned exactly by gpui-component) acceptable in Perch's dependency policy?
