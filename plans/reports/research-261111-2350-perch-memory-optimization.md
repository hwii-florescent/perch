# Perch memory: what it costs and the ways to cut it

Researched 2026-11-11, 22:49–23:52 America/New_York. Measured on this Mac against HEAD `60dd2c7` (core built from the
working tree) and the installed app's own `web-dist`. All probes were isolated (scratch `PERCH_DB`, `PERCH_HOSTS`,
`PERCHD_DIR`, `PERCH_SETTINGS`, `HOME`), headless or a hidden test window, and were stopped afterwards. Memory is
macOS physical footprint (`footprint`), not RSS, unless stated.

## Outcome

Perch itself owns about 270 MB. The largest part is the terminal's WebGL drawing in WebKit. At Retina scale, showing
one terminal adds 75–140 MB depending on window size. At 1x scale it adds almost nothing, and CSS effects make no
difference. The next largest parts are WebKit's fixed cost (about 50 MB), the page's own code and data (about 60 MB),
and the Tauri host side (about 30 MB). Kept terminals are small (at most about 29 MB).

Ignoring difficulty, the biggest savings come from moving terminal drawing out of WebKit, or not drawing it while
Perch isn't visible. Bundle and host cleanups are worth tens of MB each.

## Contents

1. [Measurements](#measurements)
2. [Item 1: terminal graphics](#item-1-terminal-graphics)
3. [Item 2: WebKit's fixed cost](#item-2-webkits-fixed-cost)
4. [Item 3: page code and data](#item-3-page-code-and-data)
5. [Item 4: the desktop host process](#item-4-the-desktop-host-process)
6. [Item 5: kept terminals](#item-5-kept-terminals)
7. [All options ranked by saving](#all-options-ranked-by-saving)
8. [Next steps](#next-steps)
9. [Sources](#sources)
10. [Unresolved questions](#unresolved-questions)

## Measurements

The installed app, running (footprint):

| Process | Footprint | Notable regions |
|---|---|---|
| WebContent | 199 MB | 95 MB graphics, 72 MB WebKit Malloc, 9 MB JIT code, 4 MB WebAssembly |
| `perch-desktop` | 67 MB | 48 MB Malloc Small |

Headless WebKit, 1512×949 window at 2x, WebContent plus GPU process combined:

| Condition | Total | Notes |
|---|---|---|
| Blank page | 51–52 MB | WebKit's floor |
| Perch, no terminal shown | 110–134 MB | |
| Perch, one terminal shown (WebGL) | 200–220 MB | +85 to +98 MB; it lands in the GPU process |
| Same at 1x scale | 140 MB | The terminal is almost free at 1x |
| Same with blur, shadows, filters and transitions forced off | 216 MB | CSS effects cost nothing measurable |
| Same with the DOM renderer | 259 MB | Worse than WebGL even when idle |
| Terminal shown, 1000×650 / 1512×949 / 2000×1200 window | +75 / +98 / +141 MB | Grows with pixel area |
| Service worker on vs blocked, no terminal | 134 vs 134 MB | Adds a 17 MB Networking process |

Synthetic WebGL test in an empty page (2x):

| Step | Total |
|---|---|
| Empty page | 51 MB |
| First WebGL2 context (tiny 50×50 canvas) | 169 MB (+118 MB, one-off) |
| Second tiny context | 169 MB (+0) |
| Terminal-sized WebGL2 canvas (2490×1740 pixels) | +67 MB |
| A second one | +72 MB |
| Terminal-sized 2D canvas, drawn once | +40 MB |

The synthetic contexts redraw every frame, so they overstate an idle xterm. They show the shape of the cost: a large
one-off price for WebGL, then roughly three to four times the canvas's bytes per visible canvas. WebKit holds three
IOSurfaces per WebGL context for triple buffering ([WebKit change](https://lists.webkit.org/pipermail/webkit-changes/2023-April/286187.html)).

Other measurements:
- **Headless core:** 14 MB footprint (20–27 MB RSS), even with 10 sessions.
- **Empty-state desktop app** (hidden test window): 45 MB host footprint, against the user's real 67 MB.
- **Startup JS:** 2.1 MB main bundle, of which 32% runs at startup with a terminal shown.
- **JS heap (Chromium):** 8–12 MB.
- **Kept terminals:** 13 xterms with full 10,000-line scrollback hold 29 MB of JS heap.

## Item 1: terminal graphics

**What it is.** Perch shows one terminal with these canvases:
- xterm's WebGL canvas at device pixels (2490×1740, 16.5 MB a buffer),
- a full-size 2D canvas for link underlines (WebKit doesn't back it until something is drawn, so shrinking it saved
  nothing),
- one 512×512 glyph atlas page (about 1 MB).

The cost is the WebGL context plus WebKit's buffering of a Retina-sized drawing surface. It grows with window area
and with the number of terminals visible at once (splits). The glyph atlas and CSS are not significant.

**Options, biggest saving first:**

1. **Draw terminals natively, outside WebKit.** Put a libghostty (or other Metal) surface in an NSView beside or under
   the webview, as herdr does in a fully native app. This removes WebKit's WebGL entirely, which is about 85–140 MB per
   visible terminal today. A native Metal surface still needs its own drawables, so the net saving is smaller than the
   full figure. That is an estimate; I didn't measure it. libghostty's embedding API is not stable yet
   ([Ghostty embedding docs](https://www.mintlify.com/ghostty-org/ghostty/api/embedding)), and I found no prior art
   for stacking it with a Tauri webview.
2. **Drop terminal graphics while Perch isn't visible.** Today a context is dropped only when its terminal scrolls out
   of view (`xtermSetup.ts`, IntersectionObserver), not when the window is hidden, minimised or covered. This could
   save the whole terminal cost for as long as Perch is in the background. Not proven: after hiding the terminal in
   one probe, the total fell only 6 MB. I didn't confirm that the context was actually released in that run, so
   whether WebKit hands the memory back promptly is open.
3. **One shared WebGL canvas for all visible terminals.** Draw every visible pane into a single window-sized canvas,
   so the one-off cost and one set of buffers are paid once however many splits are open. With splits, this saves
   roughly 40–70 MB per extra visible terminal. It needs a custom renderer, since xterm.js has one canvas per terminal.
4. **Draw at a lower pixel ratio** (1x or 1.5x), always or only while Perch is unfocused. At 1x the terminal was
   almost free (140 MB vs 220 MB), but text is visibly softer on Retina.
5. **Rejected:**
   - The DOM renderer measured 40 MB worse even when idle, and `xtermSetup.ts` records 625–940 MB under a busy TUI.
   - xterm 6 removed the canvas renderer ([6.0.0 notes](https://newreleases.io/project/npm/@xterm/xterm/release/6.0.0)).
   - ghostty-web runs on WebAssembly plus WebGL2 ([coder/ghostty-web](https://github.com/coder/ghostty-web)), so it
     pays the same WebGL cost and saves no graphics memory.

## Item 2: WebKit's fixed cost

**What it is.** A blank page costs about 51 MB (WebContent plus GPU process). On top of that come a Networking
process (16–26 MB in the real app) and the webview's host-side share inside `perch-desktop` (see item 4). A macOS
comparison found the same pattern for Tauri in general: the WebKit helper processes, not the Rust side, make up most
of the cost ([Tauri vs SwiftUI on macOS](https://dev.to/hiyoyok/why-i-chose-tauri-v2-over-electron-for-my-macos-logcat-viewer-45k4)).

**Options:**

1. **A native UI** (GPUI, Rune or AppKit). This is the only way to remove the floor, saving about 50–90 MB plus the
   host-side webview share. It also removes item 1's WebKit cost. This is the GPUI question from earlier, and it
   still loses the web and phone client unless that is kept as a second client.
2. **Turn off the service worker in the desktop app.** It precaches 295 files (5.5 MB) and keeps a Networking
   process busy. It exists for the phone and web, while the desktop serves its files locally. Footprint without a
   terminal was the same either way (134 MB); the saving is the Networking process (about 17 MB) plus cache storage.
   This is an estimate.
3. **No WKWebView setting** that lowers the floor turned up in research. Apple's forums and WebKit's docs only cover
   measuring it and its limits ([WebKit memory inspection](https://docs.webkit.org/Infrastructure/MemoryInspection.html)).

## Item 3: page code and data

**What it is.** Perch's page adds about 60 MB to the WebContent process (76 MB vs 13 MB blank), mostly WebKit
Malloc. Only 8–12 MB of that is JS heap; the rest is parsed and compiled code, DOM and styles.

The main bundle is 2.1 MB, and 68% of it does not run at startup. By size:

| Part | Size | Share |
|---|---|---|
| xterm | 335 KB | 15.6% |
| dockview (docking layout) | 325 KB | 15.1% |
| Bundled stock screens | 311 KB | 14.5% |
| xterm WebGL addon | 247 KB | 11.5% |
| CodeMirror (view, state, language, lezer) | ~290 KB | 13% |
| Perch components | 138 KB | 6.4% |
| marked + dompurify | 69 KB | 3.2% |
| qrcode | 21 KB | 1.0% |

The stock screens are bundled statically for screens without a mod path (for example `ConfirmDialog`, `Navigator`,
`NewSessionDialog`, `FileEntryMenu`, `MacPermissions`). The sidebar, tabs and status screens are also fetched again as
mod packages at startup, so some screen code exists twice.

**Options:**

1. **Load on first use:**
   - CodeMirror, only when a file opens,
   - marked and dompurify, only when markdown shows,
   - qrcode, only when pairing,
   - the launcher, navigator, settings and permissions screens, only when opened,
   - xterm and its WebGL addon, only when the first terminal shows.

   That is about 0.8–1.2 MB less code at startup. I estimate 10–25 MB less memory; this needs measuring after the
   change.
2. **Use one path per stock screen.** Load a screen either as a bundled module or as a mod package, not both.
3. **A smaller layout engine** than dockview (325 KB) for the docking UI.
4. **Evict old mod revisions.** The loader keeps every revision it ran until the page reloads (`docs/MOD-SDK.md:72`).
   This only matters for people who edit mods.

## Item 4: the desktop host process

**What it is.** The headless core uses 14 MB. With the Tauri window added and empty state, the host process is 45 MB,
so about 31 MB is Tauri, AppKit and the webview's host side, including an 8 MB CG Image region. The user's real app
is 67 MB, so about 22 MB more comes from real data and uptime (Malloc Small 24 MB → 48 MB).

**Options:**

1. **Find the 22 MB of data growth.** Profile the host process's heap under realistic state with `heap`/`malloc_history`
   or a Rust allocator profiler. Likely suspects are in-memory session snapshots and transcript or replay caches;
   these are guesses, not checked.
2. **Find the 8 MB CG Image.** It is probably a full-resolution decoded image such as the app or tray icon. Not
   verified.
3. Running the core as a separate process doesn't reduce the total. Only a native UI removes the webview host share.

## Item 5: kept terminals

**What it is.** Perch keeps 12 hidden xterms plus the visible one (`terminalKeeper.ts:63`), with 10,000 lines of
scrollback and no byte cap. The worst case measured 29 MB of JS heap. Comparison:
- **Orca** keeps at most 4 hidden worktrees, for at most 15 minutes, with 5,000 lines by default. It "parks" other
  terminals by saving their screen content and unmounting the xterm (`terminal-hidden-worktree-retention.ts:31`).
- **herdr** keeps every terminal attached, each capped at 10,000 lines or 10 MB (`vt.rs:649`).

**Options:**

1. **Orca-style parking.** Save a hidden terminal's buffer and dispose its xterm, then restore it when shown. Hidden
   terminals then cost close to nothing, saving up to about 25 MB.
2. **A byte budget** across kept terminals instead of a count (the existing `ponytail:` note already suggests this).
3. **A time limit** on hidden terminals, or less scrollback for hidden ones.

## All options ranked by saving

Difficulty ignored, as requested.

| Rank | Option | Estimated saving | Evidence |
|---|---|---|---|
| 1 | Native UI instead of WebKit | ~150–250 MB | Floor, terminal graphics and webview host share measured; net native cost not measured |
| 2 | Native terminal surfaces beside the webview | Up to ~85–140 MB per visible terminal, minus native drawables | Measured cost; net saving not measured |
| 3 | Release terminal graphics while Perch is hidden | Up to ~85–140 MB while in the background | Cost measured; whether WebKit releases it promptly is not |
| 4 | One shared WebGL canvas for splits | ~40–70 MB per extra visible terminal | Synthetic test |
| 5 | Lower pixel ratio, at least while unfocused | ~80 MB | Measured (1x vs 2x) |
| 6 | Lazy-load editor, markdown, QR, screens, terminal code | ~10–25 MB | Estimate from bundle and coverage data |
| 7 | Find the desktop host's data growth and the CG Image | up to ~20–30 MB | Measured gap; cause not found |
| 8 | Desktop without service worker | ~10–20 MB | Networking process measured |
| 9 | Orca-style terminal parking or byte budget | up to ~25 MB | Measured worst case |

## Next steps

1. Prove option 3 before anything else. In a hidden-window desktop probe, measure the GPU process footprint before and
   after the window is hidden and the WebGL context is explicitly lost. This decides between options 2, 3 and 4.
2. Fix `e2e/memory/memory.mjs`, which currently fails: it times out waiting for `.xterm`, because its mocked sessions
   no longer show a terminal. It is the repo's own check for terminal graphics, and every graphics option needs it.
3. Profile the real `perch-desktop` heap to explain the 22 MB of data growth and the 8 MB CG Image.
4. Measure the lazy-loading saving with a quick experiment that removes CodeMirror, marked and the stock screens from
   the startup bundle, before committing to a refactor.

## Sources

- [WebKit: GPU process WebGL IOSurface reuse, three surfaces per context](https://lists.webkit.org/pipermail/webkit-changes/2023-April/286187.html)
- [WebKit bug 233328: WebGL IOSurface leak in the GPU process](https://bugs.webkit.org/show_bug.cgi?id=233328)
- [WebKit bug 269302: memory moving between GPU and WebContent processes](https://bugs.webkit.org/show_bug.cgi?id=269302)
- [WebKit docs: memory inspection with footprint](https://docs.webkit.org/Infrastructure/MemoryInspection.html)
- [xterm.js 6.0.0 release notes (canvas renderer removed)](https://newreleases.io/project/npm/@xterm/xterm/release/6.0.0)
- [xterm.js issue 5686: exploring libghostty](https://github.com/xtermjs/xterm.js/issues/5686)
- [coder/ghostty-web](https://github.com/coder/ghostty-web)
- [Ghostty embedding API](https://www.mintlify.com/ghostty-org/ghostty/api/embedding)
- [Tauri vs SwiftUI memory on macOS](https://dev.to/hiyoyok/why-i-chose-tauri-v2-over-electron-for-my-macos-logcat-viewer-45k4)
- Orca, local clone at `564f1352`: `src/renderer/src/components/terminal-pane/terminal-hidden-worktree-retention.ts`
- herdr-app, clone at `4c8c622`: `src/window.rs`, `src/vt.rs`

Probe scripts are in `/private/tmp/claude-501/-Users-hwiii-Github-perch/969a793b-cce1-4fa2-84f4-3d3a57c18fa0/scratchpad/`
(`webkit-matrix.mjs`, `gl-fixed.mjs`, `ablate.mjs`, `canvases.mjs`, `coverage.mjs`, `xterm-cost.mjs`).

## Unresolved questions

- Does WebKit return the GPU process memory promptly after a WebGL context is lost (option 3)?
- How much would a native Metal terminal surface itself cost, to give option 2's net saving?
- What makes up the real `perch-desktop`'s extra 22 MB of heap and its 8 MB CG Image?
- Is softer terminal text at a lower pixel ratio acceptable while Perch is unfocused (option 5)?
