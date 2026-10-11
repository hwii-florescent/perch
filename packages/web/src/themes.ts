/**
 * App palettes, based on Herdr's theme set and the original themes' UI colors.
 * Sources and role mappings: docs/THEMES.md. Foreground/comment colors are not
 * backgrounds: surface tokens must remain readable in menus and selected rows.
 * `resolveTheme` adapts low-contrast foregrounds for UI-sized text; `THEMES`
 * keeps the source colors. Terminal rendering still uses the server profile,
 * not these app tokens. The default name agrees with Rust's `default_theme()`.
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

/** perch's default look: monotone neutral greys, like a plain terminal
 * emulator (or Orca's default), with muted colors kept for status only.
 * `styles/base.css` `:root` tokens hold the same values. */
export const PERCH_DEFAULT: Palette = {
  accent: "#c8c8c8",
  panelBg: "#161616",
  surface0: "#262626",
  surface1: "#333333",
  surfaceDim: "#1c1c1c",
  overlay0: "#3a3a3a",
  overlay1: "#9b9b9b",
  text: "#d8d8d8",
  subtext0: "#9b9b9b",
  mauve: "#a993c9",
  green: "#7fb685",
  yellow: "#d3b46a",
  red: "#df8c8c",
  blue: "#7aa2d7",
  teal: "#7fb8b8",
  peach: "#d39a6a",
};

/**
 * Herdr's 18 built-in themes plus perch's neutral default. Named colors come
 * from the upstream palettes; surfaces use UI backgrounds, not syntax colors.
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
/** Catppuccin Mocha — herdr's own default theme. */
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
    accent: "#1e66f5", panelBg: "#eff1f5", surface0: "#e6e9ef", surface1: "#ccd0da",
    surfaceDim: "#e6e9ef", overlay0: "#9ca0b0", overlay1: "#8c8fa1", text: "#4c4f69",
    subtext0: "#6c6f85", mauve: "#8839ef", green: "#40a02b", yellow: "#df8e1d",
    red: "#d20f39", blue: "#1e66f5", teal: "#179299", peach: "#fe640b",
  },
  terminal: {
    accent: "#0000ee", panelBg: "#000000", surface0: "#121212", surface1: "#1c1c1c",
    surfaceDim: "#000000", overlay0: "#e5e5e5", overlay1: "#ffffff", text: "#e5e5e5",
    subtext0: "#e5e5e5", mauve: "#e5e5e5", green: "#00cd00", yellow: "#cdcd00",
    red: "#ff0000", blue: "#0000ee", teal: "#00cdcd", peach: "#cdcd00",
  },
  "tokyo-night": {
    accent: "#7aa2f7", panelBg: "#1a1b26", surface0: "#24283b", surface1: "#292e42",
    surfaceDim: "#1a1b26", overlay0: "#565f89", overlay1: "#697196", text: "#c0caf5",
    subtext0: "#a9b1d6", mauve: "#bb9af7", green: "#9ece6a", yellow: "#e0af68",
    red: "#f7768e", blue: "#7aa2f7", teal: "#7dcfff", peach: "#ff9e64",
  },
  "tokyo-night-day": {
    accent: "#2959aa", panelBg: "#e6e7ed", surface0: "#d6d8df", surface1: "#e1e2e8",
    surfaceDim: "#d6d8df", overlay0: "#c1c2c7", overlay1: "#707280", text: "#343b59",
    subtext0: "#4a5272", mauve: "#5a3e8e", green: "#485e30", yellow: "#8f5e15",
    red: "#942f2f", blue: "#2959aa", teal: "#006c86", peach: "#965027",
  },
  dracula: {
    accent: "#bd93f9", panelBg: "#282a36", surface0: "#343746", surface1: "#44475a",
    surfaceDim: "#21222c", overlay0: "#6272a4", overlay1: "#828cb4", text: "#f8f8f2",
    subtext0: "#d2d2dc", mauve: "#ff79c6", green: "#50fa7b", yellow: "#f1fa8c",
    red: "#ff5555", blue: "#8be9fd", teal: "#8be9fd", peach: "#ffb86c",
  },
  nord: {
    accent: "#88c0d0", panelBg: "#2e3440", surface0: "#3b4252", surface1: "#434c5e",
    surfaceDim: "#2e3440", overlay0: "#4c566a", overlay1: "#646e82", text: "#d8dee9",
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
    accent: "#4078f2", panelBg: "#fafafa", surface0: "#eaeaeb", surface1: "#e5e5e6",
    surfaceDim: "#f5f5f6", overlay0: "#a0a1a7", overlay1: "#686b77", text: "#383a42",
    subtext0: "#686b77", mauve: "#a626a4", green: "#50a14f", yellow: "#c18401",
    red: "#e45649", blue: "#4078f2", teal: "#0184bc", peach: "#986801",
  },
  solarized: {
    accent: "#268bd2", panelBg: "#002b36", surface0: "#073642", surface1: "#004454",
    surfaceDim: "#00212b", overlay0: "#586e75", overlay1: "#657b83", text: "#93a1a1",
    subtext0: "#839496", mauve: "#d33682", green: "#859900", yellow: "#b58900",
    red: "#dc322f", blue: "#268bd2", teal: "#2aa198", peach: "#cb4b16",
  },
  "solarized-light": {
    accent: "#268bd2", panelBg: "#fdf6e3", surface0: "#eee8d5", surface1: "#eee8d5",
    surfaceDim: "#eee8d5", overlay0: "#93a1a1", overlay1: "#586e75", text: "#657b83",
    subtext0: "#586e75", mauve: "#d33682", green: "#859900", yellow: "#b58900",
    red: "#dc322f", blue: "#268bd2", teal: "#2aa198", peach: "#cb4b16",
  },
  kanagawa: {
    accent: "#7e9cd8", panelBg: "#1f1f28", surface0: "#2a2a37", surface1: "#363646",
    surfaceDim: "#1f1f28", overlay0: "#727169", overlay1: "#87867d", text: "#dcd7ba",
    subtext0: "#c8c093", mauve: "#957fb8", green: "#76946a", yellow: "#c0a36e",
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
    subtext0: "#908caa", mauve: "#c4a7e7", green: "#31748f", yellow: "#f6c177",
    red: "#eb6f92", blue: "#31748f", teal: "#9ccfd8", peach: "#ebbcba",
  },
  "rose-pine-dawn": {
    accent: "#907aa9", panelBg: "#faf4ed", surface0: "#f2e9e1", surface1: "#fffaf3",
    surfaceDim: "#f2e9e1", overlay0: "#9893a5", overlay1: "#797593", text: "#575279",
    subtext0: "#797593", mauve: "#907aa9", green: "#286983", yellow: "#ea9d34",
    red: "#b4637a", blue: "#286983", teal: "#56949f", peach: "#d7827e",
  },
  vesper: {
    accent: "#ffc799", panelBg: "#101010", surface0: "#232323", surface1: "#282828",
    surfaceDim: "#101010", overlay0: "#5c5c5c", overlay1: "#7e7e7e", text: "#ffffff",
    subtext0: "#a0a0a0", mauve: "#ffd1a8", green: "#99ffe4", yellow: "#ffc799",
    red: "#ff8080", blue: "#b0b0b0", teal: "#66ddcc", peach: "#ffc799",
  },
};

/** Ordered list of theme names for the Settings UI; `"perch"` (the default)
 * is first. */
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

function luminance(hex: string): number {
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return sum + weight * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  }, 0);
}

function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Keep upstream colors when readable; otherwise move only as far toward the
 * theme's foreground pole as needed for small operational text (4.5:1).
 * Check every surface, including selected/hovered rows.
 * ponytail: one foreground per token assumes uniformly light/dark built-in
 * surfaces. Mixed-surface custom themes would need per-surface foregrounds. */
export function resolveTheme(name: string) {
  const source = (Object.hasOwn(THEMES, name) ? THEMES[name] : undefined) ?? PERCH_DEFAULT;
  const light = luminance(source.panelBg) > 0.179;
  const backgrounds = [source.panelBg, source.surface0, source.surface1, source.surfaceDim];
  const palette = { ...source };
  const foregrounds = ["text", "subtext0", "overlay1", "accent", "mauve", "green", "yellow", "red", "blue", "teal", "peach"] as const;
  for (const key of foregrounds) {
    const rgb = [1, 3, 5].map((i) => parseInt(source[key].slice(i, i + 2), 16));
    for (let step = 0; step <= 100; step++) {
      const candidate = `#${rgb.map((v) => Math.round(v + ((light ? 0 : 255) - v) * step / 100).toString(16).padStart(2, "0")).join("")}`;
      if (backgrounds.every((bg) => contrast(candidate, bg) >= 4.5)) {
        palette[key] = candidate;
        break;
      }
    }
  }
  // Contrast is symmetric: panel-bg is also readable on these colored fills.
  return { ...palette, colorScheme: light ? "light" : "dark" };
}

/** Set every semantic token as a CSS custom property on `<html>`. Falls
 * back to the default theme (perch) for an unknown/unset theme name so
 * a stale or corrupted `settings.theme` value never leaves the app
 * unstyled. */
export function applyTheme(name: string): void {
  const palette = resolveTheme(name);
  const root = document.documentElement.style;
  for (const key of Object.keys(TOKEN_CSS_VARS) as (keyof Palette)[]) {
    root.setProperty(TOKEN_CSS_VARS[key], palette[key]);
  }
  root.setProperty("color-scheme", palette.colorScheme);
}
