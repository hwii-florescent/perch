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
import { WebLinksAddon } from "@xterm/addon-web-links";
import type { TerminalProfile } from "@perch/shared";
import { parseOsc52 } from "./osc52";
import { usePerchStore } from "./store";

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

/** The value that used to be hardcoded here, and is still what an absent /
 * invalid `settings.terminalScrollback` resolves to — an existing settings
 * file (no such field yet) must behave exactly as before. */
export const DEFAULT_SCROLLBACK = 10000;
/** xterm.js allocates scrollback eagerly (it's a ring buffer sized up front),
 * so an unbounded value from settings is a real browser-OOM vector, not just
 * a theoretical one. These bounds are generous on both ends: 100 lines is
 * still a usable pane, 200000 is far more than anyone scrolls back through
 * but nowhere near enough rows to be a meaningful allocation on its own. */
export const MIN_SCROLLBACK = 100;
export const MAX_SCROLLBACK = 200000;

/**
 * Clamp a candidate `terminalScrollback` setting to a sane range. Pure and
 * exported so it's unit-testable without constructing a Terminal.
 *
 * Absent, `NaN`, non-finite, or otherwise not-a-number input all resolve to
 * `DEFAULT_SCROLLBACK` — the exact value this file used to hardcode — rather
 * than being clamped into range, so a settings file that predates this field
 * (or a corrupt one) reproduces today's behaviour exactly instead of silently
 * becoming `MIN_SCROLLBACK`.
 */
export function clampScrollback(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return DEFAULT_SCROLLBACK;
  }
  return Math.min(MAX_SCROLLBACK, Math.max(MIN_SCROLLBACK, Math.floor(value)));
}

/**
 * Pick which of the profile's palettes to render with, given whether the OS
 * is currently in dark mode. Pure and exported so it's unit-testable without
 * `matchMedia` or a DOM.
 *
 * `themeDark`/`themeLight` only exist on terminals that define appearance-
 * specific palettes (iTerm2's `(Light)`/`(Dark)` profile variants, Ghostty's
 * light/dark pair) — the common case is a single palette, so an empty object
 * is treated exactly like an absent one and `theme` stays the fallback,
 * exactly as it was before these fields existed.
 */
export function selectTerminalTheme(
  profile: TerminalProfile | null | undefined,
  isDark: boolean,
): Record<string, string> | undefined {
  const scoped = isDark ? profile?.themeDark : profile?.themeLight;
  if (scoped && Object.keys(scoped).length > 0) return scoped;
  if (profile?.theme && Object.keys(profile.theme).length > 0) return profile.theme;
  return undefined;
}

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
    fontSize: baseFontSize,
    fontFamily,
    // 1.0 = exactly the font's own line box, which is what a native terminal
    // uses. Anything larger breaks box-drawing characters into dashes.
    lineHeight: 1.0,
    letterSpacing: 0,
    // Driven by settings.terminalScrollback (Settings → Terminal), clamped
    // client-side — see clampScrollback's doc comment for why. Reading the
    // store directly here (rather than threading it through every caller)
    // keeps `createPerchTerminal` the single place a Terminal is built.
    scrollback: clampScrollback(usePerchStore.getState().settings?.terminalScrollback),
    // iTerm2's "Esc+" behaviour — what makes Alt+B / Alt+F / Alt+Backspace
    // word motion work in the CLIs' composers.
    macOptionIsMeta: true,
    macOptionClickForcesSelection: true,
    drawBoldTextInBrightColors: true,
    allowProposedApi: true, // required by the Unicode 11 addon
  };
  // Cursor shape/blink: same discipline as the palette below. Only set when
  // the profile actually says something; absent means "leave xterm's own
  // default alone" rather than perch imposing block/no-blink of its own.
  if (profile?.cursorStyle) options.cursorStyle = profile.cursorStyle;
  if (profile?.cursorBlink !== undefined) options.cursorBlink = profile.cursorBlink;

  // Light/dark palette selection. `matchMedia` is guarded because this file
  // is unit-tested under vitest's default "node" environment (no DOM) — see
  // xtermSetup.test.ts, which only exercises the pure helpers above and never
  // calls this function. Only set `theme` when there is something real to
  // say: passing `{}` is not the same as passing nothing to xterm, and the
  // point is to leave its defaults alone rather than half-override them.
  const mql: MediaQueryList | null =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const initialTheme = selectTerminalTheme(profile, mql?.matches ?? false);
  if (initialTheme) options.theme = initialTheme as ITheme;

  const term = new Terminal(options);

  // Re-apply on OS appearance change so an already-open terminal picks up
  // the other palette live rather than only at next mount.
  const handleSchemeChange = (event: MediaQueryListEvent): void => {
    const theme = selectTerminalTheme(profile, event.matches);
    // `{}` here (not `undefined`) matches xterm's own DEFAULT_OPTIONS.theme,
    // so "nothing to say" reproduces the exact value xterm would have used
    // had `theme` never been set in the constructor options.
    term.options.theme = (theme ?? {}) as ITheme;
  };
  mql?.addEventListener("change", handleSchemeChange);

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

  // Clickable links. Opening directly (no confirmation dialog) is deliberate:
  // a click is itself the explicit user action, exactly like clicking a link
  // in iTerm2 or any other terminal — the CLIs' own output already contains
  // URLs a user is expected to open (docs, PR links, etc.), and interposing a
  // confirm() on every click would be friction with no real protection (the
  // same URL is right there in the scrollback either way). `noopener` denies
  // the new tab a `window.opener` back-reference to this app.
  term.loadAddon(
    new WebLinksAddon((_event, uri) => {
      window.open(uri, "_blank", "noopener");
    }),
  );

  // OSC 52 clipboard write. `vim "+y`, tmux copy-mode and many TUIs emit this
  // to push a yank into the *system* clipboard rather than relying on the
  // terminal's own mouse-selection clipboard; without a handler xterm has
  // nothing registered for OSC 52 and silently drops it. Only the write
  // direction is implemented — see osc52.ts's header for why read (`?`) is
  // refused rather than answered.
  //
  // Errors (parse failures, unsupported targets, an oversized payload, or a
  // `navigator.clipboard.writeText` rejection — which happens routinely: the
  // Clipboard API needs a secure context and, in most browsers, a recent user
  // gesture, and a PTY write is neither) must never throw back into xterm's
  // parser or spam the console once per rejected write. All are swallowed;
  // the return value is always `true` so the escape sequence itself is
  // consumed instead of falling through and rendering as garbage text.
  term.parser.registerOscHandler(52, (data) => {
    const result = parseOsc52(data);
    if (result.kind === "write") {
      navigator.clipboard?.writeText(result.text).catch(() => {
        // Swallow: a rejected clipboard write (no secure context, no recent
        // gesture, permission denied) is not something the pane can recover
        // from or usefully surface, and the alternative — throwing — would
        // take down xterm's parser for every subsequent write too.
      });
    }
    // read-ignored / unsupported-target / too-large / invalid: nothing to do,
    // by design (see osc52.ts). Always report handled so xterm doesn't print
    // the raw sequence as text.
    return true;
  });

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
      mql?.removeEventListener("change", handleSchemeChange);
      term.dispose();
    },
  };
}
