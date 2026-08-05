/**
 * xtermSetup.ts — one place that decides how a perch terminal behaves, shared
 * by `views/Terminal.tsx` (plain shell) and `views/AgentCliTerminal.tsx` (CLI
 * mode's `claude --resume` / `codex` PTY).
 *
 * The goal is *emulator parity*: a pane here should render what the same
 * command renders in the user's own terminal. Both views used to hand-roll a
 * four-option `new Terminal({...})`, and the options they didn't set were the
 * bug:
 *
 *  1. `convertEol: true` rewrote every bare `\n` from the PTY into `\r\n`.
 *     Right for a dumb log pane, catastrophic for a full-screen TUI: the
 *     agent CLIs paint with absolute cursor moves and bare line feeds, so an
 *     implicit carriage return drags subsequent writes back to column 0 and
 *     rows land on top of each other. A real terminal never does this.
 *  2. Sizing followed a `window` resize listener, which never fires for the
 *     resizes that actually happen (dockview splitter drags, sidebar toggles),
 *     so the emulator kept whatever grid it was born with.
 *
 * ## Colours and font are the user's, not perch's
 *
 * An earlier pass synthesised an ANSI ramp from perch's UI theme tokens. That
 * was wrong on its face: the thing in this pane is the same `claude`/`codex`
 * the user runs in iTerm2, and its output is coloured by the *terminal's*
 * palette — substituting perch's palette silently restyles the agent's UI
 * into colours it never chose. `terminalProfile` now carries the user's real
 * iTerm2 profile (see `iterm_profile.rs`), and anything it doesn't specify
 * falls through to **xterm.js's own defaults**, never to a perch token.
 *
 * ## Scaling instead of reflowing
 *
 * The agent TUIs assume a conventional terminal width; below it they wrap
 * their panels and the layout falls apart. So a narrow pane shrinks the
 * *font* to keep `MIN_COLS` columns rather than handing the CLI fewer columns
 * — the pane gets smaller text showing the same layout, instead of a
 * correctly-sized but broken one. See `fitWithScaling`.
 *
 * Deliberately staying on xterm's DOM renderer rather than adding the WebGL
 * one: canvas renderers leave `.xterm-rows` empty, which would silently blind
 * every e2e assertion that reads terminal text out of the DOM.
 */
import { Terminal, type ITerminalOptions, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import type { TerminalProfile } from "@perch/shared";

/** Columns the layout is kept at by scaling the font down. 80 is what the
 * agent CLIs (and essentially every TUI) treat as the minimum sane width. */
const MIN_COLS = 80;

/** Font size floor. Past this, shrinking further is unreadable, so a very
 * narrow pane (a phone) is allowed to fall back to ordinary reflow. */
const MIN_FONT_PX = 7;

/** Used only when the server couldn't read a terminal profile. Generic
 * monospace stack — not a perch-specific choice. */
const FALLBACK_FONT_FAMILY =
  'Menlo, Monaco, "Courier New", "DejaVu Sans Mono", "Liberation Mono", Consolas, monospace';
const FALLBACK_FONT_SIZE = 13;

export interface PerchTerminal {
  term: Terminal;
  /** Re-measure the container, rescale the font if needed, and resize the
   * emulator to match. Returns the new `{cols, rows}` when they changed, else
   * null — callers use that to avoid spamming `terminal.resize`. */
  fit: () => { cols: number; rows: number } | null;
  dispose: () => void;
}

/**
 * Build a terminal attached to `container` and keep it fitted to it.
 *
 * `onResize` fires only when the fitted grid actually changes, and is what
 * should be forwarded to the PTY.
 */
export function createPerchTerminal(
  container: HTMLElement,
  onResize: (cols: number, rows: number) => void,
  profile?: TerminalProfile | null,
): PerchTerminal {
  // The profile's font is the one the user's TUIs are designed around — for a
  // Nerd Font (powerline glyphs, icons) a substitute renders the wrong glyph
  // at the wrong width and knocks every following column out of alignment.
  // The generic stack is appended, never prepended, so it is only reached for
  // codepoints the chosen font lacks.
  const baseFontSize = profile?.fontSize ?? FALLBACK_FONT_SIZE;
  const fontFamily = profile?.fontFamily
    ? `"${profile.fontFamily}", ${FALLBACK_FONT_FAMILY}`
    : FALLBACK_FONT_FAMILY;

  const options: ITerminalOptions = {
    // See the module header: an emulator must not synthesise carriage
    // returns. The pty is in ONLCR mode already, so real newlines arrive as
    // `\r\n` on their own.
    convertEol: false,
    cursorBlink: true,
    cursorStyle: "block",
    fontSize: baseFontSize,
    fontFamily,
    // 1.0 = exactly the font's own line box, which is what a native terminal
    // uses. Anything larger breaks box-drawing characters into dashes.
    lineHeight: 1.0,
    letterSpacing: 0,
    scrollback: 10000,
    // iTerm2's "Esc+" behaviour — what makes Alt+B / Alt+F / Alt+Backspace
    // word motion work in the CLIs' composers.
    macOptionIsMeta: true,
    macOptionClickForcesSelection: true,
    drawBoldTextInBrightColors: true,
    allowProposedApi: true, // required by the Unicode 11 addon
  };
  // Only set `theme` when there is something real to say. Passing `{}` is not
  // the same as passing nothing to xterm, and the point here is to leave its
  // defaults alone rather than half-override them.
  if (profile?.theme && Object.keys(profile.theme).length > 0) {
    options.theme = profile.theme as ITheme;
  }

  const term = new Terminal(options);

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  // Unicode 11 width tables. Without this xterm uses its built-in Unicode 6
  // tables, which report the wrong width for most emoji and several
  // box-drawing/powerline ranges the agent CLIs use — and one wrong width
  // shifts the rest of the line by a cell.
  try {
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = "11";
  } catch {
    // Proposed-API addon; a version skew shouldn't take the pane down.
  }

  term.open(container);

  let lastCols = 0;
  let lastRows = 0;

  /** Advance width of one cell at `baseFontSize`, measured off-terminal.
   *
   * Measuring with a throwaway span rather than by fitting the terminal at
   * base size is the whole point of this being separate: see `fitWithScaling`.
   * Cached because the answer only depends on the font, which never changes
   * for the life of the terminal. */
  let cachedBaseCellWidth = 0;
  function baseCellWidth(): number {
    if (cachedBaseCellWidth > 0) return cachedBaseCellWidth;
    const probe = document.createElement("span");
    probe.style.cssText =
      `position:absolute;visibility:hidden;white-space:pre;top:-9999px;left:-9999px;` +
      `font-family:${fontFamily};font-size:${baseFontSize}px;line-height:1;letter-spacing:0`;
    probe.textContent = "W".repeat(100);
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width / 100;
    probe.remove();
    if (width > 0) cachedBaseCellWidth = width;
    return width;
  }

  /**
   * Fit, shrinking the font rather than surrendering columns.
   *
   * The size is *computed*, then applied once — deliberately not searched for
   * by fitting repeatedly. An earlier version reset the font to base, fitted,
   * then scaled down and fitted again, which meant every resize tick drove
   * `term.resize()` through an intermediate grid the PTY was never told
   * about. Each `resize` reflows xterm's buffer, so the agent's screen was
   * being reflowed to a shape it had not drawn for, mid-repaint — a good way
   * to corrupt a full-screen TUI, and one that would fire hardest during a
   * window drag when resizes come every frame. One measurement, one font
   * assignment, one fit.
   */
  function fitWithScaling(): void {
    const cell = baseCellWidth();
    const available = container.clientWidth;
    let size = baseFontSize;
    if (cell > 0 && available > 0) {
      const perColumnNeeded = available / MIN_COLS;
      if (perColumnNeeded < cell) {
        // Round down to a tenth: undershooting only makes the text slightly
        // smaller, overshooting leaves us a column short of the target.
        size = Math.max(
          MIN_FONT_PX,
          Math.floor(((baseFontSize * perColumnNeeded) / cell) * 10) / 10,
        );
      }
    }
    if (term.options.fontSize !== size) term.options.fontSize = size;
    fitAddon.fit();

    // The estimate is off by a couple of columns because `clientWidth`
    // includes the viewport scrollbar that FitAddon subtracts. Correct once,
    // using the *measured* column count, which is exact. At most two resizes
    // and only when scaling is active — and crucially both are in the same
    // direction, so the buffer is never reflowed through a wider intermediate
    // grid the way the old reset-to-base approach did.
    if (term.cols < MIN_COLS && size > MIN_FONT_PX && term.cols > 0) {
      const corrected = Math.max(
        MIN_FONT_PX,
        Math.floor(((size * term.cols) / MIN_COLS) * 10) / 10,
      );
      if (corrected < size) {
        term.options.fontSize = corrected;
        fitAddon.fit();
      }
    }
  }

  const fit = (): { cols: number; rows: number } | null => {
    // A pane inside a hidden dockview tab measures 0x0. Fitting that yields a
    // degenerate grid, and pushing it to the PTY makes the CLI reflow its
    // whole UI to ~1 column — damage that is done server-side and survives
    // the pane becoming visible again. Skip instead.
    if (container.offsetWidth === 0 || container.offsetHeight === 0) return null;
    try {
      fitWithScaling();
    } catch {
      return null;
    }
    const { cols, rows } = term;
    if (cols === lastCols && rows === lastRows) return null;
    lastCols = cols;
    lastRows = rows;
    onResize(cols, rows);
    return { cols, rows };
  };

  // Fit now, and again once webfonts settle: xterm derives its cell size by
  // measuring the font, so a measurement taken before the profile's font
  // loads is based on the fallback's metrics and leaves the grid slightly off.
  fit();
  if (document.fonts?.ready) void document.fonts.ready.then(() => fit());

  // Track the *container*, not `window` — see the module header. The rAF
  // coalesce matters because ResizeObserver fires per animation frame during
  // a drag, and each accepted fit sends a `terminal.resize` and makes the CLI
  // repaint; without it one splitter drag floods the PTY.
  let frame = 0;
  const observer = new ResizeObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fit();
    });
  });
  observer.observe(container);

  return {
    term,
    fit,
    dispose: () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      term.dispose();
    },
  };
}
