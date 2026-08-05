/**
 * themes.ts — herdr-parity theme system (Phase 0 + Phase 1).
 *
 * `Palette` is the 16-token semantic color system lifted from herdr
 * (`herdr-analysis-report.md` §5.15: `accent, panel_bg, surface0, surface1,
 * surface_dim, overlay0, overlay1, text, subtext0, mauve, green, yellow,
 * red, blue, teal, peach`). `THEMES` holds all 18 herdr built-in themes,
 * transcribed verbatim (RGB -> hex) from that report's palette table, plus
 * perch's own original look (`"perch"`) as a 19th, non-default entry.
 *
 * The default theme is `"catppuccin"` (Catppuccin Mocha) — herdr's own
 * default, see `reference/herdr/src/app/state.rs::Palette::catppuccin()`
 * and `AppState`'s default `theme_name` — so perch matches herdr's look out
 * of the box. See `default_theme()` in `crates/perch-core/src/{protocol,
 * settings}.rs` for the Rust side of this default, and `applyTheme()`'s
 * fallback below for the client-side one.
 *
 * `applyTheme(name)` sets each token as a CSS custom property on
 * `document.documentElement.style`, which is all `styles.css` needs since
 * every themed rule reads its color via `var(--token)`.
 */

export interface Palette {
  accent: string;
  panelBg: string;
  surface0: string;
  surface1: string;
  surfaceDim: string;
  overlay0: string;
  overlay1: string;
  text: string;
  subtext0: string;
  mauve: string;
  green: string;
  yellow: string;
  red: string;
  blue: string;
  teal: string;
  peach: string;
}

/** perch's own original look — the app's default before herdr-parity
 * restyling (see module doc above); kept as a selectable, non-default
 * theme. Matches the original hardcoded `:root` values in `styles.css`
 * before the token system existed. */
export const PERCH_DEFAULT: Palette = {
  accent: "#58e6a8",
  panelBg: "#0b0d10",
  surface0: "#14171c",
  surface1: "#1b1f26",
  surfaceDim: "#101317",
  overlay0: "#262b33",
  overlay1: "#3a4150",
  text: "#e6e6e6",
  subtext0: "#8a93a1",
  mauve: "#b58ee6",
  green: "#58e6a8",
  yellow: "#e6c458",
  red: "#e65858",
  blue: "#5898e6",
  teal: "#58c8e6",
  peach: "#e69858",
};

/**
 * All 18 herdr built-in themes, transcribed verbatim (RGB -> hex) from
 * `herdr-analysis-report.md` §5.15's palette table, plus `"perch"` as a
 * 19th, non-default entry (perch's own original look).
 *
 * Note on `terminal`: herdr's 16-color "terminal" theme is defined via named
 * ANSI colors (`Blue`, `Reset`, `DarkGray`, `Gray`, `White`, `LightRed`, …)
 * rather than literal RGB, because it's designed to inherit the *host
 * terminal's* own color scheme. There's no web equivalent of "inherit the
 * terminal's colors", so this entry maps each named color to its standard
 * xterm default-16-color hex value (a well-documented, widely-used mapping)
 * and maps `Reset` to a plain black background / light gray foreground —
 * the closest sane approximation of "whatever the terminal's default is".
 */
/** Catppuccin Mocha — herdr's own default theme (see module doc above),
 * and perch's default too. Kept as a standalone typed constant (rather than
 * read back out of `THEMES.catppuccin`) so `applyTheme`
 * below has a `Palette`-typed fallback: `Record<string, Palette>` indexing
 * (including `THEMES.catppuccin`) is always `Palette | undefined` under
 * `noUncheckedIndexedAccess`, which a `??` fallback can't itself resolve. */
export const CATPPUCCIN_DEFAULT: Palette = {
  accent: "#89b4fa", panelBg: "#181825", surface0: "#313244", surface1: "#45475a",
  surfaceDim: "#1e1e2e", overlay0: "#6c7086", overlay1: "#7f849c", text: "#cdd6f4",
  subtext0: "#a6adc8", mauve: "#cba6f7", green: "#a6e3a1", yellow: "#f9e2af",
  red: "#f38ba8", blue: "#89b4fa", teal: "#94e2d5", peach: "#fab387",
};

export const THEMES: Record<string, Palette> = {
  perch: PERCH_DEFAULT,
  catppuccin: CATPPUCCIN_DEFAULT,
  "catppuccin-latte": {
    accent: "#1e66f5", panelBg: "#eff1f5", surface0: "#ccd0da", surface1: "#bcc0cc",
    surfaceDim: "#e6e9ef", overlay0: "#9ca0b0", overlay1: "#8c8fa1", text: "#4c4f69",
    subtext0: "#6c6f85", mauve: "#8839ef", green: "#40a02b", yellow: "#df8e1d",
    red: "#d20f39", blue: "#1e66f5", teal: "#179299", peach: "#fe640b",
  },
  terminal: {
    accent: "#0000ee", panelBg: "#000000", surface0: "#000000", surface1: "#7f7f7f",
    surfaceDim: "#7f7f7f", overlay0: "#e5e5e5", overlay1: "#ffffff", text: "#e5e5e5",
    subtext0: "#e5e5e5", mauve: "#e5e5e5", green: "#00cd00", yellow: "#cdcd00",
    red: "#ff0000", blue: "#0000ee", teal: "#00cdcd", peach: "#cdcd00",
  },
  "tokyo-night": {
    accent: "#7aa2f7", panelBg: "#1a1b26", surface0: "#24283b", surface1: "#414868",
    surfaceDim: "#1a1b26", overlay0: "#565f89", overlay1: "#697196", text: "#c0caf5",
    subtext0: "#a9b1d6", mauve: "#bb9af7", green: "#9ece6a", yellow: "#e0af68",
    red: "#f7768e", blue: "#7aa2f7", teal: "#7dcfff", peach: "#ff9e64",
  },
  "tokyo-night-day": {
    accent: "#2e7de9", panelBg: "#e1e2e7", surface0: "#c4c8da", surface1: "#a8aecb",
    surfaceDim: "#d2d3da", overlay0: "#8990b3", overlay1: "#68709a", text: "#3760bf",
    subtext0: "#6172b0", mauve: "#7847bd", green: "#587539", yellow: "#8c6c3e",
    red: "#f52a65", blue: "#2e7de9", teal: "#118c74", peach: "#b15c00",
  },
  dracula: {
    accent: "#bd93f9", panelBg: "#282a36", surface0: "#44475a", surface1: "#6272a4",
    surfaceDim: "#282a36", overlay0: "#6272a4", overlay1: "#828cb4", text: "#f8f8f2",
    subtext0: "#d2d2dc", mauve: "#ff79c6", green: "#50fa7b", yellow: "#f1fa8c",
    red: "#ff5555", blue: "#8be9fd", teal: "#8be9fd", peach: "#ffb86c",
  },
  nord: {
    accent: "#88c0d0", panelBg: "#2e3440", surface0: "#3b4252", surface1: "#434c5e",
    surfaceDim: "#2e3440", overlay0: "#4c566a", overlay1: "#646e82", text: "#eceff4",
    subtext0: "#d8dee9", mauve: "#b48ead", green: "#a3be8c", yellow: "#ebcb8b",
    red: "#bf616a", blue: "#81a1c1", teal: "#8fbcbb", peach: "#d08770",
  },
  gruvbox: {
    accent: "#d79921", panelBg: "#282828", surface0: "#3c3836", surface1: "#504945",
    surfaceDim: "#282828", overlay0: "#928374", overlay1: "#a89984", text: "#ebdbb2",
    subtext0: "#d5c4a1", mauve: "#d3869b", green: "#b8bb26", yellow: "#fabd2f",
    red: "#fb4934", blue: "#83a598", teal: "#8ec07c", peach: "#fe8019",
  },
  "gruvbox-light": {
    accent: "#076678", panelBg: "#fbf1c7", surface0: "#ebdbb2", surface1: "#d5c4a1",
    surfaceDim: "#f2e5bc", overlay0: "#928374", overlay1: "#7c6f64", text: "#3c3836",
    subtext0: "#504945", mauve: "#8f3f71", green: "#79740e", yellow: "#b57614",
    red: "#9d0006", blue: "#076678", teal: "#427b58", peach: "#af3a03",
  },
  "one-dark": {
    accent: "#61afef", panelBg: "#282c34", surface0: "#2c313a", surface1: "#3e4451",
    surfaceDim: "#282c34", overlay0: "#5c6370", overlay1: "#737a87", text: "#abb2bf",
    subtext0: "#969ca8", mauve: "#c678dd", green: "#98c379", yellow: "#e5c07b",
    red: "#e06c75", blue: "#61afef", teal: "#56b6c2", peach: "#d19a66",
  },
  "one-light": {
    accent: "#4078f2", panelBg: "#fafafa", surface0: "#f0f0f1", surface1: "#e5e5e6",
    surfaceDim: "#f5f5f6", overlay0: "#a0a1a7", overlay1: "#686b77", text: "#383a42",
    subtext0: "#686b77", mauve: "#a626a4", green: "#50a14f", yellow: "#c18401",
    red: "#e45649", blue: "#4078f2", teal: "#0184bc", peach: "#986801",
  },
  solarized: {
    accent: "#268bd2", panelBg: "#002b36", surface0: "#073642", surface1: "#586e75",
    surfaceDim: "#002b36", overlay0: "#586e75", overlay1: "#657b83", text: "#93a1a1",
    subtext0: "#839496", mauve: "#d33682", green: "#859900", yellow: "#b58900",
    red: "#dc322f", blue: "#268bd2", teal: "#2aa198", peach: "#cb4b16",
  },
  "solarized-light": {
    accent: "#268bd2", panelBg: "#fdf6e3", surface0: "#eee8d5", surface1: "#93a1a1",
    surfaceDim: "#eee8d5", overlay0: "#93a1a1", overlay1: "#586e75", text: "#657b83",
    subtext0: "#839496", mauve: "#d33682", green: "#859900", yellow: "#b58900",
    red: "#dc322f", blue: "#268bd2", teal: "#2aa198", peach: "#cb4b16",
  },
  kanagawa: {
    accent: "#7e9cd8", panelBg: "#1f1f28", surface0: "#2a2a37", surface1: "#363646",
    surfaceDim: "#1f1f28", overlay0: "#727169", overlay1: "#87867d", text: "#dcd7ba",
    subtext0: "#c8c3aa", mauve: "#957fb8", green: "#76946a", yellow: "#c0a36e",
    red: "#c34043", blue: "#7e9cd8", teal: "#7fb4ca", peach: "#ffa066",
  },
  "kanagawa-lotus": {
    accent: "#4d699b", panelBg: "#f2ecbc", surface0: "#dcd5ac", surface1: "#c9cbd1",
    surfaceDim: "#d5cea3", overlay0: "#a09cac", overlay1: "#8a8980", text: "#545464",
    subtext0: "#43436c", mauve: "#624c83", green: "#6f894e", yellow: "#77713f",
    red: "#c84053", blue: "#4d699b", teal: "#4e8ca2", peach: "#cc6d00",
  },
  "rose-pine": {
    accent: "#c4a7e7", panelBg: "#191724", surface0: "#1f1d2e", surface1: "#26233a",
    surfaceDim: "#191724", overlay0: "#6e6a86", overlay1: "#908caa", text: "#e0def4",
    subtext0: "#c8c5dc", mauve: "#c4a7e7", green: "#31748f", yellow: "#f6c177",
    red: "#eb6f92", blue: "#31748f", teal: "#9ccfd8", peach: "#ea9a97",
  },
  "rose-pine-dawn": {
    accent: "#907aa9", panelBg: "#faf4ed", surface0: "#f2e9e1", surface1: "#fffaf3",
    surfaceDim: "#f2e9e1", overlay0: "#9893a5", overlay1: "#797593", text: "#464261",
    subtext0: "#797593", mauve: "#907aa9", green: "#286983", yellow: "#ea9d34",
    red: "#b4637a", blue: "#286983", teal: "#56949f", peach: "#d7827e",
  },
  vesper: {
    accent: "#ffc799", panelBg: "#1a1a1a", surface0: "#232323", surface1: "#282828",
    surfaceDim: "#101010", overlay0: "#5c5c5c", overlay1: "#7e7e7e", text: "#ffffff",
    subtext0: "#a0a0a0", mauve: "#ffd1a8", green: "#99ffe4", yellow: "#ffc799",
    red: "#ff8080", blue: "#b0b0b0", teal: "#66ddcc", peach: "#ffc799",
  },
};

/** Ordered list of theme names for the Settings UI. `"perch"` is listed
 * first (it's declared first in `THEMES` above) even though it's no longer
 * the default theme — reordering the list is cosmetic and out of scope for
 * the herdr-parity restyle; the default is controlled by `default_theme()`
 * in Rust and `applyTheme()`'s fallback below, not by list position. */
export const THEME_NAMES: string[] = Object.keys(THEMES);

const TOKEN_CSS_VARS: Record<keyof Palette, string> = {
  accent: "--accent",
  panelBg: "--panel-bg",
  surface0: "--surface-0",
  surface1: "--surface-1",
  surfaceDim: "--surface-dim",
  overlay0: "--overlay-0",
  overlay1: "--overlay-1",
  text: "--text",
  subtext0: "--subtext-0",
  mauve: "--mauve",
  green: "--green",
  yellow: "--yellow",
  red: "--red",
  blue: "--blue",
  teal: "--teal",
  peach: "--peach",
};

/** Set every semantic token as a CSS custom property on `<html>`. Falls
 * back to the default theme (catppuccin) for an unknown/unset theme name so
 * a stale or corrupted `settings.theme` value never leaves the app
 * unstyled. */
export function applyTheme(name: string): void {
  const palette = THEMES[name] ?? CATPPUCCIN_DEFAULT;
  const root = document.documentElement.style;
  for (const key of Object.keys(TOKEN_CSS_VARS) as (keyof Palette)[]) {
    root.setProperty(TOKEN_CSS_VARS[key], palette[key]);
  }
}
