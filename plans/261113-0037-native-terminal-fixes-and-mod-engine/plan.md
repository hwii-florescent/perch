# Plan: native terminal fixes and the mod engine

Contract: `brief.md` (with its "Confirmed by the owner" section). Agent rules: `agent-rules.md`. Current state, open items and
what is next: `next-steps.md`. Integration branch `feat/native-mods` in `/Users/hwiii/Github/perch-wt/native-mods`;
each piece has its own worktree under `/Users/hwiii/Github/perch-wt/` and is merged in one at a time.

## Pieces

| # | Piece | Worktree / branch | Needs | Status |
|---|---|---|---|---|
| A1 | Terminal input bugs 1 to 3 (`/`, Unicode key text, click without a move) | `a-input` / `nm/input-bugs` | none | merged (bug 2 fixed; 1 and 3 are the tool's, pinned by tests) |
| A2 | Bugs 4 and 5 (palette key, session listing) and the keyless checks (find, links, tab close, settings) | `a-input` | A1 | merged (4 is not a bug; 5 fixed, cause inferred) |
| B1 | Vendor the gpui-kit shell and QuickJS; a mod host in `perch-native` with reload and last-good tests | `b-engine` / `nm/mod-engine` | none | merged (`gpui-pre` and `gpui-pre-macos` 0.3.8 vendored with three herdr additions) |
| B2 | The `perch` module: data, commands, theme tokens with `perch-sdk.d.ts` names; navigation parity with the web; the shared parity helper | `b-engine` | B1 | merged |
| B4 | Screen data and props equal to the web's in 59 fixture states; capture helper for screen mods | `b-engine` | B3, C2 | merged |
| B5 | Floating screens take the whole window, as the web's do | `b-engine` | B4 | merged |
| B3 | Screens: placing mods in the window, props in, results out, dismissal, and the data the chrome screens lacked | `b-engine` | B2 | merged |
| C2 | Web reference for the seven chrome screens | `c-reference` | C | merged (128 renderings) |
| C | WebKit reference: fixture data, named elements, boxes, colours, fonts, images, and the comparator | `c-reference` / `nm/web-reference` | none | merged |
| D1 | Sidebar, Way 1 (element builders) | `a-input` / `nm/sidebar-builders` | B2, C | merged, gate 10 of 10; not chosen, kept under tag `way1-sidebar-builders` |
| D2 | Sidebar, Way 2 (React renderer, Tailwind translator, DOM shim) | `d2-react` / `nm/sidebar-react` | C; engine phase needs B2 | gate 10 of 10 with 0 changed stock lines; chosen |
| E | Compare both ways, apply the decision rule, replace the Rust sidebar view | `d2-react` | D1, D2 | merged: Way 2 chosen, the Rust sidebar view is deleted, gate 10 of 10 rerun on the merged branch |
| F1 to F7 | Chrome as mods: tabs, status bar, palette, pane header and menu, dialogs, toasts, New session | `d2-react` (docked), `b-engine` (floating) | E | merged: every screen is a mod with its Rust view deleted; tabs 7 of 8, status 6 of 8, pane header 5 of 6 states pass, the rest all |
| G | Isolated review, fixes, acceptance commands, report | integration | all | done: review and two re-checks, fixes merged, acceptance passes at `4be06380`, report written |

## Acceptance

As in `brief.md`: the seven commands, each Part A bug with cause, failing test and fix (or cause and needed patch
when the fix is inside `gpui-pre`), reload and last-good tests, the comparison table with images and the decision,
each Part C screen as a passing mod with its Rust view deleted or listed as not done.

## Second batch: the rest of the Tauri chrome (asked by the owner 2026-11-13)

Goal: what the Tauri app's chrome offers and the native client lacks, small screens and window behaviour first.
Same rules as the first batch (`agent-rules.md`; the gate's rules; the web's stock source unchanged; two fix
rounds per screen, then listed as not done; no protocol change; nothing pushed). Integration stays
`feat/native-mods`. Commits carry no `Co-Authored-By` or session trailers.

| # | Piece | Worktree / branch | Needs | Status |
|---|---|---|---|---|
| H | Web reference (fixtures, named elements, renderings) for: tab-menu, select, tab-drag, session menu, keybind-help, launcher, start, folder-browser, instructions, memory, worktree, terminal-search, agent-control, phone-size | `c-reference` / `nm/web-reference` | none | done, merged (14 screens, 102 states) |
| I | Window behaviour: split with an existing session, show beside, tab drag and drop and reorder, the tab menu and session menu as mods, the commands the window still refuses, sidebar reorder | `b-engine` / `nm/mod-engine` | H for gates | done, merged at `29935133` |
| J | Screens: keybind help, launcher, start, folder browser with add project, instructions, memory, worktree; then what sits over a terminal (find bar, agent controls, phone size) | `d2-react` / `nm/sidebar-react` | H for gates | done, merged at `29935133` (gate 310 of 332) |
| K | Isolated review, fixes, acceptance commands, report | integration | H, I, J | done: review clean after fixes, acceptance passed on `29935133`; summary in `next-steps.md` |

Later, not in this batch: settings pages; files and the editor, Git and review, chat, browser. Where a native
equivalent costs too much or cannot look the same (the editor is CodeMirror, which needs a browser's DOM), the
screen stays a JavaScript screen; how the native window hosts such a screen is decided when that batch starts.
