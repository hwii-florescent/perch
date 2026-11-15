# Native client: where it stands and what is next

Updated 2026-11-15. This file replaces the two batch reports and their review reports, which were removed with
the rest of the old plans (all of it is in git history or the owner's Trash).

## Where the work is

- Integration branch `feat/native-mods` at `29935133`, worktree `/Users/hwiii/Github/perch-wt/native-mods`.
  It is 134 commits ahead of `main` and has nothing `main` lacks. Not merged, never pushed.
- The piece worktrees under `/Users/hwiii/Github/perch-wt/` (`a-input`, `b-engine`, `c-reference`, `d2-react`)
  are kept with their branches.
- Both batches are done: the mod engine; the sidebar, tabs, status bar, palette, pane header, dialogs, toasts
  and New session as mods; then 14 more screens and the window's behaviour. Acceptance passed on `29935133`
  (`npm test`, `cargo test` for core, perchd and native, fmt, clippy with only the two old warnings).
- The gate (`node e2e/native-parity/compare.mjs`, run by hand after the capture tests) passes 310 of 332
  states. Its full output is `gate-result-29935133.txt`.

## Decided 2026-11-15

- Mods in the native client are trusted code ([DECISIONS](../../docs/DECISIONS.md) 2026-11-15).
- The 22 failing states and the 4 leftovers below are noted and accepted for now, not chased.

## The 22 failing gate states

Side-by-side images (native beside web) are in `gate-failures/`.

| Screen / state (dark and light each) | States | Cause |
| --- | --- | --- |
| keybind-help `all`, `short-window` | 4 | Rows for the drawer, preview tab and file editor wait for those screens. |
| tabs `files-and-pages` | 2 | Needs file tabs. |
| pane-header `corner` | 2 | Needs file tabs. |
| status `usage`, `narrow-window` | 4 | GPUI rounds each text run's width up to a whole pixel (leftover 1). |
| phone-size `notice`, `pending`, `split-pane` | 6 | The × glyph's line is 19 px against the web's 18. |
| memory `memory-off` | 2 | The check box shrinks to 9.5 px in its row. |
| start `workspace-long-name` | 2 | The path hint wraps to 2 lines, the web's to 3. |

Two reference states cannot be produced natively at all: tab-menu `file-tab` (no file tabs) and start
`cli-error`. The six file-tab states should pass once file tabs exist.

## The 4 leftovers from the first batch

1. **Status bar text rounding.** GPUI rounds each text run's width up to a whole pixel
   (`vendor/gpui-pre/src/elements/text.rs:772`). The usage summary's six runs come out 3.42 px wider than the
   web's. Fix either by removing that rounding in the vendored `gpui-pre` (not one of herdr's patches) or by
   having the translator measure each text run and set its fractional width.
2. **How line height is compared.** GPUI rounds a text line height to whole pixels
   (`TextStyle::line_height_in_pixels` ends in `.round()`), so 12.9, 15.6, 16.25, 13.33 and 20.8 px are drawn
   at 13, 16, 16, 13 and 21. The gate compares the line height the mod asks for, which equals the web's. Both
   values are in every native JSON (`font.lineHeight`, `font.lineHeightDrawn`). Comparing drawn values would
   fail everything unless that `.round()` is removed.
3. **Commit trailers.** 29 commits on `feat/native-mods` carry `Co-Authored-By: Claude` and `Claude-Session`
   trailers, against the no-AI-references rule. Removing them means rewriting the branch's history and every
   commit id. Commits after the review carry none.
4. **Vendored GPUI or two deleted calls.** `gpui-pre` and `gpui-pre-macos` 0.3.8 are vendored with three herdr
   additions used only by shell code Perch never runs. Deleting two calls in the vendored shell would drop
   8.6 MB of vendored code and return to crates.io.

## Open: the native client cannot attach to the Tauri app's core

The native client finds its core through `<PERCHD_DIR>/core.json` and needs a token there
(`Core::discover`, `crates/perch-native/src/client.rs`). The desktop core keeps its token in memory by design
and only signs its own webview in with a one-use code (`crates/perch-desktop/src/main.rs`). The native client
can spend such a code, but nothing in production gives it one. So today it works only against a headless
`perch-core`, and `scripts/reinstall-desktop-native.sh` is wrong when it says it attaches to perch.app.
Fixing this (for example the Tauri app launching perch-native with a one-use code) changes the local
authority design of 2026-11-06 and needs the owner's decision. It is required before the native client can
become the main app.

## Differences from the Tauri app that remain by design or for now

- Resize mode shows no indicator; the web's only sign is a `[resize]` title prefix and the native window sets
  no title.
- Selecting a folder shows its newest session; there is no folder pin.
- An agent's session is not closed without asking when its shell ends (the safety contract forbids treating
  an unknown state as exit).
- Back and Forward record session tabs only, since there are no file tabs.
- Key help also lists Select all, and words New session differently (the native launcher picks the computer
  and offers no file).
- A mod that fails to load is shown in place, not as a toast.
- A person's own `folder-browser` or `worktree` mod does not replace the copy drawn inside the sidebar.
- Still refused: `project.home`, `workspace.files`, `workspace.git`, `agents.manage`.

Known risks: the engine cuts off a mod whose module takes over 5 s to load (seen once in a debug build under
load); `terminal_view`, the memory part of `mods_chrome_screens_window` and `mods_sidebar` each flaked once;
a 40-session sidebar takes about 550 ms to draw first in a release build.

## Next

1. Use the branch build by hand (it runs against an isolated headless core until the sign-in question above
   is settled).
2. Decide the sign-in hand-off with the Tauri app.
3. Merge `feat/native-mods` into `main` when satisfied.
4. Next batch: settings pages, then files and the editor, Git and review, chat and the browser. A screen stays
   a JavaScript screen where a native one costs too much or cannot look the same. CodeMirror needs a browser
   DOM, so the batch starts by deciding how the native window hosts it: a webview pane or a hand-off to the
   Tauri app.
5. The terminal rows still open are in `terminal-parity-checklist.md`.

Same rules as before for agents: `agent-rules.md`, contract `brief.md`, plan and status `plan.md`.
