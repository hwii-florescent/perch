# Proposed deferrals: native GPUI client

All 32 checklist rows marked "proposed deferral", gathered from `terminal-parity-checklist.md` (full evidence is
there, by ID). Rows that are the same thing under two IDs share a line, so there are 22 lines to decide.

Fill the last column with `approve` (ship without it for now, it stays on the roadmap) or `need better` (build it,
or come back with a better answer, before the branch counts as done). Add a note after it if you want a specific
choice.

"Recommend" is my suggestion, not a decision.

## Already decided

| IDs | Item | What is missing | Decision |
|---|---|---|---|
| A-20, A-21 | Grapheme clustering on from the start | Built, then reverted because xterm.js clients drifted. | **Build: on by default** (owner, 2026-11-12). Being re-applied. |

## Your choice: behaviour I did not want to pick for you

| IDs | Item | What happens today | What it takes | Recommend | Decision |
|---|---|---|---|---|---|
| A-41 | Spare height | Leftover pixels fall below the grid, as in the Tauri terminal. herdr centres the grid instead. | Pick top-aligned or centred; a few lines. | approve (keep top-aligned) | lets centres the same way as grid |
| A-112 | Click also sends the size | A click focuses the pane but does not resize the terminal. Resizing is done with Take control. | Pick whether a click resizes when this view holds the size; one line. | approve | what do you mean by this? resizing pane should be done by dragging the border line no? |
| A-201 | Attach hidden panes after 100 ms | A pane attaches once it has a real size; a pane never laid out waits. | Pick a fallback size and delay. | approve (a guessed size is worse than waiting) | approve |
| A-222 | Readline-style key defaults | Alt-Left/Right/Backspace send xterm sequences; Cmd-Left/Right/Backspace go to the app. Each can be bound by hand in `keys.json`. | Add default entries to the keymap. | need better if you use these keys in iTerm2 or Ghostty daily | not sure about this part, what do you mean by this? what needs to be done or wants to be done here |
| A-220, B-70 | Pinned terminals and agents | No pins. In Tauri pins are per device and Perch's own views ignore them. | Decide the native sidebar orders by pins; then a small pin store. | approve | approve to add pin features for workspace |
| A-90 | Paste a clipboard image into a remote terminal | Refused with a note to drop the file with Option held; Tauri does the same. | Allow a paste to copy a file to a remote host (changes a rule in ARCHITECTURE.md). | approve | approve |
| A-168 | Rejoin links a program broke across lines | Only soft-wrapped links are joined; Tauri does not rejoin either. | Port herdr's rejoin logic (sizeable). | approve | approve |
| B-39 | Wheel bursts for TUIs | Three lines per notch plus trackpad carry (Ghostty's model). Tauri adds a burst bonus up to nine rows. | Port the burst rule from `terminalTuiWheel.ts`. | approve; revisit if scrolling in TUIs feels slow | approve |

## No setting exists in the core yet

Each needs a new field in the core's settings (and `protocol.ts`), then a small change in the native client.

| IDs | Item | What happens today | Recommend | Decision |
|---|---|---|---|---|
| A-33, A-227 | Line height (0.8 to 2.0) | Fixed at 1. | approve | approve |
| A-35, A-36, A-226 | Ligatures (off by default) | No ligatures. | approve | approve |
| A-106, A-231 | Scroll speed (0.1 to 5) | Fixed speed. | approve | approve |
| A-219 | Right-click goes to the program or the menu | Goes to the program only when it takes the mouse; Shift-right-click always opens the menu. | approve | approve |
| A-225 | A terminal font size of its own | The size comes from the terminal profile (4 to 72) and scales with zoom. | approve | approve |

## GPUI 0.3.8 cannot do it

| IDs | Item | What happens today | What it takes | Recommend | Decision |
|---|---|---|---|---|---|
| A-31 | Cell height from the font's own tables | Cell height is ascent plus descent, rounded up. Some fonts may sit a pixel taller or shorter than in Ghostty. | GPUI exposing font tables, or reading the installed font file directly. | approve | approve |
| A-67, A-68, A-232, B-28 | Left and Right Option as Alt | The setting shows all five values; Auto and Off work; On, Left and Right behave as Auto. | GPUI reporting which Option key is down. | approve, or need better if you rely on one-sided Option | explain this part more, not sure what you want with this |

## Depends on parts that are still Tauri-only

| IDs | Item | What happens today | What it takes | Recommend | Decision |
|---|---|---|---|---|---|
| B-51 | Plain click on a link opens a Perch browser tab | Plain click selects; Cmd-click opens the default app. | A browser pane in the native window. | approve | approve |
| B-33 | `nav.back` on Ctrl-minus | Ctrl-minus goes to the program; there is no navigation history. | A navigation history first. | approve | approve |
| B-69 | Files and Git follow the shell's folder | The folder is read (for relative links) but nothing uses it as a scope. | Files and Git panes in the native window. | approve | native window needs to perform the same ability as current tauri, from UX appearances to features (our goal is that the files and git should at least perform the same way as vscode if not better) |
| A-214 | An alert brings a settled tab back | No settled tabs; attention shows as the red mark on the tab and sidebar row. | Settled tabs and lists (a product decision). | approve | approve |
| A-215 | Three terminal commands not registered | `terminal.right_click` (needs A-219), `terminal.pin` (needs A-220) and `terminal.open {place}` (here it is the sidebar row click and the New session command, not a command taking a place); the other eleven are registered and tested. | Follows A-219 and A-220, plus a choice on whether `terminal.open` should take a place. | approve | approve |
| A-216 | Kill also ends sub-agents | Kill ends this shell only. | A core request that ends a terminal with its sub-agents. | need better if you kill lead agents from the native client | distinguish sub-agents and subsessions. If you are talking about perch's own subsessions with a lead session, killing lead sessions only ends its own, not the subsessions. If it is the built in subagents of the harness, it should already be handled by the harness |

## Cannot be checked headlessly

| IDs | Item | What happens today | What it takes | Recommend | Decision |
|---|---|---|---|---|---|
| A-88 | Screenshot thumbnail staging | A dropped file types its path, but a macOS screenshot thumbnail lives in a folder macOS removes, so its path may be dead. | Copy the file to a temp folder first; must be checked by hand with a real screenshot. | approve | approve |

## Outcome (2026-11-12)

What was done with the decisions above. Branch `feat/native-gpui-ghostty`, now at `e10b8b16`.

| IDs | Outcome | Commit |
|---|---|---|
| A-20, A-21 | Built: graphemes cluster from the start. | `6b6151dd` |
| A-41 | Built: the grid is centred vertically, as herdr does; leftover width stays on the right. | `a8e9a11e` |
| A-112 | Settled as the Tauri app works: a click does not send the size; when a phone holds it, the pane offers "Take back this tab" and "Take back all tabs". | `2fc2b459` |
| A-222 | Built: Command with Left, Right and Backspace edit the line by default. Option with Left, Right and Backspace already sent what the xterm.js app sends. | `e1c30f7f` |
| A-67, A-68, A-232, B-28 | Built: Left and Right follow the Option key that is down. Not yet tried on a real keyboard. | `0c21871a` |
| A-216 | Not applicable: ending a lead ends only its own terminal. | none |
| A-220, B-70 | Still deferred for terminals and agents. Workspaces can now be pinned and unpinned (this computer's only). | `a2153972` |
| B-69 | Still deferred; the end goal (VS Code level or better) is on the roadmap. | `e10b8b16` |
| All rows marked approve | Deferred, on the roadmap. | none |

22 checklist rows remain deferred, all approved.
