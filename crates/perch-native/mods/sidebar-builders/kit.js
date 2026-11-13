// Shared building blocks for the sidebar: the UI face, text styles, flex helpers, the colour of a
// state, and letter-spaced text. Tailwind's rem is 16 px; every number below is in logical pixels.
import { div } from "gpui-kit";

/** The system UI face (San Francisco). The web's `-apple-system, ... sans-serif` stack resolves to it. */
export const FONT = ".SystemUIFont";

/** The agent artwork's own colours, as the web draws them (they are the brands', not theme tokens). */
export const ART = { claude: "#D97757", tile: "#161616", black: "#000000", white: "#ffffff" };

/** A flex row / column whose items stretch across, as in CSS (gpui's `h_flex` centres them). */
export const row = () => div().flex().flex_row();
export const col = () => div().flex().flex_col();

/** Gives `el` its parity name: `name` or `name:key`. */
export const named = (el, name, key) => el.id(key == null ? name : `${name}:${key}`);

/**
 * A text style: size, weight and line height in px (gpui rounds a line height to whole pixels; the
 * web's 12.9 and 15.6 draw as 13 and 16), and the colour.
 */
export const text = (el, size, weight, lineHeight, color) =>
  el.text_size(size).font_weight(weight).line_height(`${lineHeight}px`).text_color(color);

/** A theme colour with an alpha, as `color-mix(in srgb, token N%, transparent)`. */
export const mix = (color, percent) => color + Math.round((percent / 100) * 255).toString(16).padStart(2, "0");

/** The theme token a session state is drawn in (the web's `agentStateColor`). */
export const stateColor = (t, section) => ({ needs: t.red, working: t.yellow, done: t.teal, idle: t.green })[section];

export const WORDS = { needs: "Needs you", done: "Done", working: "Working", idle: "Idle" };

/**
 * Letter-spaced text (GPUI has no letter-spacing): one box per character with `spacing` px after
 * each, as CSS adds it after the last character too. The characters are laid out one by one, so
 * kerning pairs are not applied (for capitals that costs nothing visible), and GPUI sizes each
 * single-character box about half a pixel wider than the glyph's advance, which already is most of
 * a 0.045em gap; `ROUNDING` takes that back so the run ends up as wide as the web's.
 */
const ROUNDING = 0.5;
export function spaced(label, spacing, size) {
  const gap = spacing - ROUNDING;
  return row().items_center().children([...label].map((ch) =>
    ch === " "
      ? div().w(size * 0.28 + gap)
      : div().mr(gap).child(ch)));
}

/** Runs a perch command; a rejection (a command this window lacks) is logged, never thrown. */
export function run(perch, id, args) {
  perch.run(id, args).catch((error) => console.log(`perch.run ${id}: ${error}`));
}
