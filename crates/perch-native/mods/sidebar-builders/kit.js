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
 * A text style: size, weight, line height in px and the colour. `lineHeight` is the CSS line height
 * and is what is asked for; GPUI draws the text with it rounded to a whole pixel (12.9 as 13, 15.6
 * as 16), which `line` and `lineRow` make up for in the box.
 */
export const text = (el, size, weight, lineHeight, color) =>
  el.text_size(size).font_weight(weight).line_height(`${lineHeight}px`).text_color(color);

/** CSS `line-height: 1.3` on the body, which every text outside a button inherits. */
export const body = (size) => size * 1.3;

/**
 * A line of text in a box of its CSS line height (GPUI's own line box is the rounded height, and
 * the text would sit at its top): the box is `lineHeight` plus the element's own vertical padding
 * `pad`, and the text is centred in it as the half-leading of CSS centres it. Not for rows.
 */
export const line = (el, size, weight, lineHeight, color, pad = 0) =>
  text(el, size, weight, lineHeight, color).h(lineHeight + pad).flex().flex_col().justify_center();

/** `line` for an element that is already a row (letter-spaced runs, badges). */
export const lineRow = (el, size, weight, lineHeight, color, pad = 0) =>
  text(el, size, weight, lineHeight, color).h(lineHeight + pad).items_center();

// ---- the column's running total ----------------------------------------------------------------
//
// GPUI rounds every authored length to a device pixel, each on its own, so a column of fractional
// CSS lengths (a 22.25 px header, a 2.4 px padding) loses up to a quarter pixel at every one and the
// losses add up. A browser keeps fractional layout and snaps only when it paints. `stack` gives the
// same property: the vertical lengths of the main column, asked for in document order, come back
// as device-pixel multiples chosen so that the column's running total stays as near as it can to
// the exact CSS running total (the error left by one length is carried into the next).

let pixels = 1;
let exact = 0;
let laid = 0;

/** Starts a column at its top; `scale` is the window's device pixels per logical pixel. */
export function beginFlow(scale) {
  pixels = scale > 0 ? scale : 1;
  exact = 0;
  laid = 0;
}

/** Starts another column (one that is not below what came before it) at its own top. */
export function restartFlow() {
  exact = 0;
  laid = 0;
}

/** The length to lay out for the next vertical CSS length of `length` px in the column. */
export function stack(length) {
  exact += length;
  const total = Math.round(exact * pixels + 1e-9) / pixels;
  const out = total - laid;
  laid = total;
  return out;
}

/** The lengths for several in a row, as an array. */
export const stacks = (...lengths) => lengths.map(stack);

/**
 * The children of a column with a CSS `gap`: `build(item, margin, index)` makes each one and
 * should put `margin` above it (0 for the first). Each is built after the gap above it is taken
 * from the running total and before the gap below it, which is document order.
 */
export const gapped = (items, gap, build) => items.map((item, i) => build(item, i ? stack(gap) : 0, i));

/** `gapped` for children that follow something else in the column: every one has the gap above it. */
export const below = (items, gap, build) => items.map((item, i) => build(item, stack(gap), i));

/**
 * `el` as a block of `content` px with `pt` and `pb` px of padding around it, all three taken from
 * the running total; the block is exactly their sum high. Returns the element.
 */
export function padded(el, pt, content, pb) {
  const [a, b, d] = stacks(pt, content, pb);
  return el.pt(a).pb(d).h(a + b + d);
}

/** `line`, with its box and its vertical padding taken from the running total. */
export const stackLine = (el, size, weight, lineHeight, color, pt = 0, pb = 0) =>
  padded(text(el, size, weight, lineHeight, color).flex().flex_col().justify_center(), pt, lineHeight, pb);

/** `lineRow`, with its box and its vertical padding taken from the running total. */
export const stackLineRow = (el, size, weight, lineHeight, color, pt = 0, pb = 0) =>
  padded(text(el, size, weight, lineHeight, color).items_center(), pt, lineHeight, pb);

// San Francisco's ascent and descent as fractions of the size (its `hhea` table, 1950 and 494 of 2048).
const ASCENT = 0.952;
const DESCENT = 0.241;

/** Where the baseline of a line of `size` px in a line box of `lineHeight` px is, from its top. */
export const baseline = (size, lineHeight) => (lineHeight - (ASCENT + DESCENT) * size) / 2 + ASCENT * size;

/**
 * CSS puts two texts of one row on a common baseline; GPUI has no baseline alignment. How far the
 * smaller text's line box moves down so that the baselines meet.
 */
export const baselineShift = (size, lineHeight, otherSize, otherLineHeight) =>
  Math.max(0, baseline(size, lineHeight) - baseline(otherSize, otherLineHeight));

/** A theme colour with an alpha, as `color-mix(in srgb, token N%, transparent)`. */
export const mix = (color, percent) => color + Math.round((percent / 100) * 255).toString(16).padStart(2, "0");

/** The theme token a session state is drawn in (the web's `agentStateColor`). */
export const stateColor = (t, section) => ({ needs: t.red, working: t.yellow, done: t.teal, idle: t.green })[section];

export const WORDS = { needs: "Needs you", done: "Done", working: "Working", idle: "Idle" };

/**
 * Letter-spaced text (GPUI has no letter-spacing): one box per character with `spacing` px after
 * each, as CSS adds it after the last character too. The characters are laid out one by one, so
 * kerning pairs are not applied (for capitals that costs nothing visible). GPUI rounds the measured
 * width of every text box up to a device pixel (half a pixel at scale 2), so each box is wider than
 * its glyph's advance, and there is no text measurement a mod could use to set the exact width.
 * `ROUNDING` takes that excess back from the gap; it is an empirical constant: 0.25 (the mean
 * excess of a round-up to half a pixel) leaves the host badge 2.1 to 2.7 px wider than the web's
 * (over the 2 px tolerance), 0.5 brings every run within it.
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
