# Native terminal client: memory and terminal correctness against the Tauri app

Measured on 2026-11-12 from the worktree `/Users/hwiii/Github/perch-native-sidebar`, branch `feat/native-proof`
(builds made at `18461ad8`; the commits that add the measuring script and the fixtures sit on top of it and change
no product code). Measured facts and interpretation are kept apart: every number in "Measured" was printed by a
tool; "Interpretation" is my reading of them.

## Verdict

- Target "native at least 100 MB below Tauri with one terminal shown": **met by the estimate, not by a direct
  measurement.** Native, one terminal shown, is 44.0 MB (58.2 MB with the headless core it needs). Tauri with one
  terminal is estimated at 231.4 MB, so the difference is 187 MB without the core and 173 MB with it. The real
  Tauri app could only be measured idle (146.5 MB), because its window is hidden and cannot be driven without an
  input event, which the rules forbid. Even that idle figure, which can only be lower than the app with a terminal,
  is 102 MB above native with one terminal (44.0 MB) and 88 MB above native plus core (58.2 MB). So the 100 MB bar
  is met against the estimate with margin, met against the floor when the core is not counted, and missed against
  the floor when the core is counted.
- Terminal correctness: on seven stress streams the cell grids agree except for the differences listed in
  "Correctness"; the largest real defect found is in the daemon's repaint, not in either emulator.
- Important limit: the Mac was locked and its display asleep for the whole session. Nothing GPU-side was
  presented to a lit screen, so the native client's cost while actually drawing is **not measured**.

## Machine

Measured: Mac16,8 (Apple M4 Pro), 24 GB, macOS 27.2, built-in Liquid Retina XDR display 3024x1964 at 2x
(scale 1512x982 points). The console was locked (`IOConsoleLocked=Yes`), `CGDisplayIsAsleep=1`, the frontmost app
`loginwindow` for the whole session, before, during and after every launch.

## Method

Footprint is `footprint -p PID -j` (physical footprint, the number Activity Monitor calls Memory), summed over the
processes that belong to an app. Each state is a fresh process. It settles `SETTLE` seconds, then `SAMPLES` samples
are taken two seconds apart and the median is reported. All processes run with a scratch `HOME`, `PERCH_DB`,
`PERCH_HOSTS`, `PERCHD_DIR`, `PERCH_SETTINGS` and free ports under a temp directory; the owner's installed Perch,
daemon and `~/.perch` were not touched. Sessions are plain shells whose `.zshrc` runs a scripted driver (a static
colour screen; for the busy state a 256-colour alternate-screen redraw loop for 45 s). No agent was run.

States: a idle, nothing shown; b one terminal; c four terminals (three splits); d one busy full-screen colour TUI.

- **Native**: `perch-native` in test mode (`PERCH_NATIVE_TEST=1`), which never activates the app or takes key
  focus, with a headless `perch-core` and the scratch `perchd`. Measured with the window not shown at all
  (`PERCH_NATIVE_HIDDEN=1`) and ordered in at 1280x800 without focus. `CGWindowList` reported the shown window as
  `onscreen=true`, 1254x817.
- **Tauri, real**: `perch-desktop` in `PERCH_DESKTOP_TEST=1` (hidden window, embedded core). Footprint is the host
  process plus the three WebKit helpers (WebContent, GPU, Networking) that appeared after the launch. Only state a
  was reachable: the page starts a blank session on load and choosing a terminal needs a click. I tried driving it
  with a hidden mod (the page registers its `server.info` handler after `server.info` has already arrived, so
  `mods.list` is never sent), with settings and with the CLI (the embedded core publishes no token); none worked
  without an input event, so I stopped there.
- **Tauri, estimate for b-d**: the same page in Playwright's headless WebKit 2359 (viewport 1280x800, DPR 2, WebGL
  renderer, `navigator.webdriver` overridden so xterm.js does not fall back to the DOM renderer), driven with
  page-level key events against a headless core. `Tauri est. = real Tauri idle + (WebKit page in the state -
  WebKit page idle)`. The probe confirmed WebGL canvases of 2025x1440 (one terminal) and 496x1392 (each of four).

Commands (all release builds, `ZIG` set to the Zig 0.16 binary the repo notes require):

```sh
cd /Users/hwiii/Github/perch-native-sidebar
(cd packages/web && npx vite build)
cargo build --release -p perch-core -p perch-desktop
cargo build --release -p perch-native --example measure_setup
cargo build --release -p perch-native
# native, settled
SETTLE=20 SAMPLES=5 bash scripts/measure-native-memory.sh --apps native
# Tauri and the WebKit page, settled
SETTLE=20 SAMPLES=5 PW_DIR=<dir with playwright-core 1.65> \
  WEBKIT_RUN=$HOME/Library/Caches/ms-playwright/webkit-2359/pw_run.sh \
  bash scripts/measure-native-memory.sh --apps tauri
# the full matrix in one go (SETTLE=10, SAMPLES=3), as a cross-check
KEEP=1 PW_DIR=... WEBKIT_RUN=... bash scripts/measure-native-memory.sh
# correctness
cargo test -p perch-native
(cd packages/web && npx vitest run src/terminalVtParity.test.ts)
PERCH_PARITY_REPORT=<file> npx vitest run src/terminalVtParity.test.ts   # every difference as JSON
```

## Measured: memory

Physical footprint in MB, median of 5 samples after a 20 s settle (native: run of `--apps native`; Tauri and WebKit:
run of `--apps tauri`). "Tauri est." is the formula above. "native+core" adds the headless core (14.2 MB measured
after the busy state; the daemon, 13.3 MB, is shared by both apps and left out of both).

| State | Tauri real | WebKit page | Tauri est. | native, not shown | native, shown | native+core | Tauri est. - native shown | Tauri est. - native+core |
|---|---|---|---|---|---|---|---|---|
| a idle, nothing shown | 146.5 | 130.6 | 146.5 | 41.7 | 41.9 | 56.1 | 104.6 | 90.4 |
| b one terminal | not reachable | 215.5 | 231.4 | 43.7 | 44.0 | 58.2 | 187.4 | 173.2 |
| c four terminals | not reachable | 248.7 | 264.6 | 47.9 | 44.2 | 58.4 | 220.4 | 206.2 |
| d one busy TUI | not reachable | 450.5 | 466.4 | 47.8 | 43.8 | 58.0 | 422.6 | 408.4 |

Cross-check, the full matrix in one run with a 10 s settle and 3 samples: Tauri real idle 145.8; WebKit page
139.3 / 215.0 / 259.7 / 453.5 (a / b / c / d); native not shown 54.3 / 43.9 / 48.6 / 55.7, shown 46.4 / 43.9 /
44.3 / 47.9; core 14.1, daemon 13.4. The first samples of a short settle are higher (native a, not shown: 58.3
54.3 53.6), which is why the table above uses the longer settle. An earlier run with a 3 s settle gave native a
46.5 (not shown) and 50.5 (shown), one terminal 48.4 and 52.5, core 8.2 and daemon 3.4 before any output.

Where the footprint sits (one process each, from `footprint`, MB):

- Tauri idle, 146.5 total: host process 45.4 (Malloc Small 24.0, CG Image 8.0), WebKit WebContent 76.1
  (WebKit Malloc 35.1, graphics 32.2), WebKit GPU 15.0, WebKit Networking 9.6.
- WebKit page with one terminal: GPU 103.4 (IOSurface 79.2), WebContent 94.4 (WebKit Malloc 74.1), Networking 17.0.
- WebKit page with the busy TUI: GPU 321.7 (graphics 212.3, IOSurface 79.3), WebContent 110.5.
- Native, one process: about 44 total, IOSurface 16.0 in every state, Malloc Small 11 to 13, IOAccelerator 3.6 once
  a terminal exists.

Binary sizes (bytes): `perch-native` 21,404,000; `perch-desktop` 33,941,568 (embeds the web build and the core);
`perch-core` 24,060,000 (the headless core the native client talks to).

## Interpretation: memory

- The gap is the web engine. Tauri's cost is the WebKit helpers (about 101 MB idle, 69 percent of the app),
  and a terminal adds a WebGL canvas pair per terminal. Native has no helper processes and a flat profile from
  1 to 4 terminals (44.0 to 44.2 MB shown).
- The busy TUI costs the page 235 MB more than one idle terminal (GPU process graphics memory) and the native
  client nothing visible. Because the display was asleep, I cannot tell whether native skipped drawing frames or
  simply does not allocate more when it draws; its "shown" figures are therefore a floor for a lit screen.
- Not shown versus shown for native differ by up to 4 MB in either direction (c: 47.9 vs 44.2; a: 41.7 vs 41.9);
  I have no explanation and would treat it as noise-plus-allocator behaviour.
- The Tauri b-d figures are an estimate. Playwright's WebKit uses the `...Development` helper builds, not the
  system WKWebView, and a real window has a compositor surface the headless page does not. Either could move the
  estimate by tens of MB; the margin over the target is larger than that, the 4 MB native noise is not relevant to it.
- The native client needs its core as a separate process (14 MB) while Tauri embeds it in the host. Both are
  shown above; either way the target is met against the estimate.

## Measured: correctness

`crates/perch-native/tests/vt_xterm_fixtures.rs` builds seven streams (256-colour and true-colour grids, SGR styles,
box drawing and blocks, CJK, emoji, ZWJ, flags, combining marks and a wide character at the last column, 600 lines of
scrollback, an alternate-screen program with mouse and cursor modes, a kitty raw-pixel image, scroll regions, insert
and delete, tab stops and a soft-wrapped line). Each goes through the native `Vt` and through perchd's `Screen`
repaint (`restore_bytes_within`, the bytes an attach sends). The result is written to
`packages/web/src/terminalVtParity.fixtures.json` and the test fails when that file is stale
(`PERCH_UPDATE_FIXTURES=1` regenerates it). `packages/web/src/terminalVtParity.test.ts` feeds the same stream and
repaint through `createPerchTerminal` (xterm.js with the Unicode 11 addon, as the web and phone clients run it) and
compares every cell of the active buffer, history included and aligned to the bottom: text, width, foreground and
background (palette 0-15 resolved through the native theme, the default colours as tokens, inverse applied), bold,
italic, faint, underline, strike, plus blink and overline from xterm.js, cursor position, alternate-screen flag, row
count and image count. The default colours and the 16-colour palette are the same in both (`ffffff`/`000000` and the
xterm.js palette), so no colour difference below is a theme choice.

Four comparisons per case: native fed the stream against xterm.js fed the repaint (attach, the one requested),
native stream against xterm.js stream, native repaint against xterm.js repaint, native stream against native
repaint. Counts of differing cells:

| Case | attach | stream | replayed | repaint (native vs native) |
|---|---|---|---|---|
| colours and styles | 6 text, 13 flags | 6 text, 13 flags | 6 text, 13 flags | 0 |
| box drawing and symbols | 0 | 0 | 0 | 0 |
| CJK and emoji | 12 text | 14 text | 12 text | 0 |
| 600 lines of scrollback (601 rows, 571 of history) | 0 | 0 | 0 | 0 |
| alternate-screen TUI | 21 bg | 0 | 0 | 21 bg |
| kitty image | 1 image | 1 image | 0 | 1 image |
| cursor and regions | 0 | 0 | 0 | 0 |

Every difference, none left out:

1. **Flags (regional-indicator pairs).** Ghostty draws each regional indicator as a two-cell wide character, so a
   flag takes four cells; xterm.js with Unicode 11 draws each as one cell, so a flag takes two. Everything after a
   flag on the same row is shifted by two columns between the two clients (12 cells on the test row). Skin-tone
   modifiers, ZWJ sequences, VS16 emoji, CJK, fullwidth, halfwidth kana, combining marks, Thai and ambiguous-width
   characters matched, as did a wide character at the last column (wraps whole in both).
2. **Keycap sequences.** Fed the raw stream, xterm.js keeps U+FE0F in `1` + FE0F + U+20E3; Ghostty's cell text drops
   it (2 cells). After a repaint both lack it, so this is the daemon's repaint (and Ghostty) dropping VS16, visible
   only as cell text.
3. **Hidden text (SGR 8).** Ghostty makes the cell blank; xterm.js keeps the characters and marks them invisible
   (6 cells).
4. **Blink (SGR 5) and overline (SGR 53).** The native `Cell` has no such fields (`vt.rs`); xterm.js reports both
   (13 cells). The native client cannot draw either.
5. **Repaint paints too much background (alternate-screen TUI).** In the stream a row had two cells of 256-colour
   background followed by default-coloured blanks; perchd's repaint emits `ESC[48;5;238m` followed by nine spaces,
   so seven blank cells take the background (21 cells over three rows). This is in the bytes, so both clients show
   it after an attach (`attach` and `repaint` columns) and neither does when fed the stream. It is not an engine
   difference, it is the repaint. I did not trace it to the formatter in `crates/perchd/src/screen.rs` (not my files).
6. **Images.** The native client holds the kitty image placement from the stream (1 placement). The repaint carries
   no image, so after an attach there is none; xterm.js in this setup has no image support at all.
7. **Cursor representation.** After text in the last column xterm.js reports column `cols` (pending wrap) and
   Ghostty column `cols-1`; the test normalises this and it is not counted above.

Nothing here covers how glyphs are drawn (fonts, ligatures, box-drawing sprites, emoji presentation), selection,
mouse and key encoding or IME; no pixels were compared, only the cell grid.

## Limitations and not measurable

- The display was asleep and the machine locked. The frontmost log (`loginwindow` before and after every launch) shows
  no change, but under a lock screen it could not have changed, so it is weak evidence that no app took focus. The
  native client is built never to call `activate`, and its window options set `focus: false` in test mode.
- GPU presentation cost of the native client (swap chains, glyph atlas growth while drawing) is not measured.
- Tauri states b, c and d are estimates through headless WebKit (see Method), not the real app.
- Native and Tauri each ran their own core and database: "the same sessions" means the same scripted content, not the
  same session ids. Native state c is reached with three splits of the first terminal.
- Memory of the Tauri app was measured with its test window hidden; a shown window could add compositor memory.
- One machine, one display scale, one run of each setting except the cross-check.
- The owner's machine had other Perch processes running (other worktrees, the installed app and its daemon);
  none was touched, and each footprint is per process, so they cannot leak into the sums.

## Cleanup and process check

Every process started by the script was tracked and stopped; the two scratch daemons' launchd labels were not loaded
afterwards and the scratch directories were removed. After the last run no `perch-native`, `perch-desktop`,
`measure_setup`, WebKit helper or scratch daemon of mine remained; the processes still on the machine belong to other
sessions and worktrees and were not touched.

## Files

In `/Users/hwiii/Github/perch-native-sidebar` (branch `feat/native-proof`): `scripts/measure-native-memory.sh`,
`crates/perch-native/src/test_mode.rs`, `crates/perch-native/src/main.rs` (test mode),
`crates/perch-native/examples/measure_setup.rs`, `crates/perch-native/tests/vt_xterm_fixtures.rs`,
`packages/web/src/terminalVtParity.fixtures.json`, `packages/web/src/terminalVtParity.test.ts`.
