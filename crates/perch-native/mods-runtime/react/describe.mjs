//! The description: the host tree after a commit, as the engine draws it. Each element's computed style
//! (`css.mjs`) becomes engine styles in the vocabulary of the GPUI kit (`div()` with `.flex()`, `.px(8)`,
//! `.text_color(...)`, `.hover(|s| ...)`), keyed so the engine maps each key to one builder call; a key's value says
//! which (`display: "flex"` is `.flex()`, `pt: 4` is `.pt(px(4))`, `w: "100%"`, `line_height: 1.3` a multiplier,
//! `line_height: "15px"` absolute). Everything CSS says that the engine cannot draw is listed in `unsupported`, with
//! the class that asked for it and the element; nothing is dropped silently.
//!
//! Node shapes (`id` is the host element's, the one `dispatch`/`hover`/`perch.bounds` take):
//! - `{ kind: "div", id, style, hover?, focus?, active?, tokens, events, track_hover?, meta, children }`
//! - `{ kind: "text", text, source? }` (`source`: the text before `text-transform`)
//! - `{ kind: "svg", id, markup, style, ... }` (tinted with the text colour) and `{ kind: "image", markup }` (as drawn)
//! - `{ kind: "input", id, value, placeholder, checked, input_type, style, ... }` (`value`: what the field holds,
//!   typed text included; `field_w`: a line field's content width when its content sizes it)
//! - `break_anywhere` on a node whose text breaks a word too long for its line anywhere (`overflow-wrap`)
//! - `blocks_pointer` on a node that takes pointer events under an ancestor that lets them through; `tabular` on one
//!   whose digits are tabular; `scrollbar` (its width) on a vertical scroller
//! - a node `mount` was given a parity table for (`options.names`) carries `name` (`name` or `name:key`, the engine
//!   id tests find it by) and, for a name that is the element's own text, `range_name`.
//! - letter-spaced text is a `div` (no `id`) around the run with the spacing as room after it.
//!
//! Text styles follow GPUI's inheritance: a node carries a text style when it sets one itself (so an ancestor's
//! hover colour does not reach it, as in CSS) or when the inherited value would differ (`line-height: normal`, a
//! multiplier under a new size). `tokens` names the theme token each colour came from.
import { Cascade, colorOut, evalLength, familyOut, lineHeightPx, splitTop, THEME_TOKENS } from "./css.mjs";
import { HostElement, HostText, MEASURE_TRIES, submits } from "./dom.mjs";
import { closest as closestBy, matchesComplex, parseSelector, querySelectorAll as queryBy } from "./selector.mjs";

export const SCHEMA = "perch-native-description/1";
/** The CSS display a node was computed with (kept off the serialised description). */
const DISPLAY = Symbol("display");

/** GPUI's default for every key the description sets (a variant that removes a key resets it to this). */
const DEFAULTS = {
  display: "block", flex_direction: "row", flex_wrap: "nowrap", items: "stretch", justify: "start", self: "auto",
  flex_grow: 0, flex_shrink: 1, flex_basis: "auto", position: "relative", overflow_x: "visible", overflow_y: "visible",
  visibility: "visible", bg: "#00000000", opacity: 1, shadow: "none", cursor: "default", border_color: "#00000000",
  text_ellipsis: false, underline: false,
};
const LENGTH_KEYS = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const key of LENGTH_KEYS) DEFAULTS[key] = /^(w|h|min_|max_|top|right|bottom|left)/.test(key) ? "auto" : 0;
DEFAULTS.rounded = 0;

/** Declarations with no visible effect in the engine (it behaves this way already, or they serve the browser). */
const INERT = new Set([
  "box-sizing", "-webkit-tap-highlight-color", "color-scheme", "accent-color", "user-select", "-webkit-touch-callout", "pointer-events",
  "overscroll-behavior", "text-indent", "word-spacing", "word-break", "font-style", "transition-timing-function", "transition-behavior",
  "transition-delay", "scrollbar-width", "scrollbar-color", "--tw-content", "container-type", "justify-items", "justify-self", "align-content",
  "outline-offset", "background-image",
]);
const OUTLINE = ["outline-style", "outline-width", "outline-color"];
/** Engine families for the CSS stacks the app uses. */
const SYSTEM = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i;
const MONO = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i;
/** A bare `system-ui` (a form control's own face, WebKit's `-webkit-small-control`) is CoreText's
 * `.AppleSystemUIFont`: the face `.SystemUIFont` resolves to, kept under its own name so a capture tells the two
 * requests apart. CoreText has no family named `system-ui`. */
const ENGINE_FAMILY = (family) =>
  MONO.test(family) ? "Menlo"
    : /^\s*system-ui\s*$/i.test(family ?? "") ? ".AppleSystemUIFont"
    : SYSTEM.test(family) ? ".SystemUIFont" : familyOut(family).split(",")[0].trim();

/** React's prop for each engine event a node asks for. */
const EVENTS = {
  click: ["onClick", "onClickCapture"], double_click: ["onDoubleClick"], context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"], mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"], key_down: ["onKeyDown", "onKeyUp"], focus: ["onFocus", "onBlur"], input: ["onChange", "onInput"],
};
const DOCUMENT_EVENTS = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" };

const label = (element) => {
  const testId = element.props["data-testid"];
  if (testId) return `${element.tagName}[data-testid="${testId}"]`;
  if (element.props.id) return `${element.tagName}#${element.props.id}`;
  const first = element.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? element.classList[0];
  if (first) return `${element.tagName}.${first}`;
  const parent = element.parentElement;
  return parent && parent.tagName !== "body" ? `${label(parent)} > ${element.tagName}` : element.tagName;
};

/** Records what the engine cannot draw: `kind` is `unsupported` (not drawn) or `approximated` (drawn otherwise). */
class Findings {
  constructor() { this.map = new Map(); }
  add(kind, property, value, source, element, note = "") {
    const key = `${kind}|${property}|${value}|${source}`;
    const entry = this.map.get(key);
    if (entry) { if (!entry.elements.includes(element) && entry.elements.length < 4) entry.elements.push(element); entry.count++; return; }
    this.map.set(key, { kind, property, value: String(value), class: source ?? null, elements: [element], count: 1, ...(note ? { note } : {}) });
  }
  list() { return [...this.map.values()].sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.property < b.property ? -1 : a.property > b.property ? 1 : 0)); }
}

const length = (l) => {
  if (l === undefined || l === null) return undefined;
  if (typeof l === "string") return l === "auto" || l === "none" || l === "normal" ? "auto" : undefined;
  if ("px" in l) return Math.round(Math.min(Math.max(l.px, -9999), 9999) * 100) / 100;
  if ("pct" in l) return `${Math.round(l.pct * 1000) / 1000}%`;
  return undefined;
};

/** The input types that are a line of text, and the content width a browser gives one sized by its content (20
 * characters, `size`'s default), in ems of its font. ponytail: measured in the web reference for the app's UI face;
 * another face gets the same width. The engine's text system could measure the face's average character instead. */
const TEXT_FIELD = /^(text|search|url|email|tel|password|number)$/;
const FIELD_EMS = 162.13 / 12.8;

/** The smallest fixed length among `min(...)`'s arguments, when one of them is fixed (a length with no percentage). */
function fixedBoundOf(value, fontSize) {
  const m = typeof value === "object" && /^min\((.*)\)$/.exec(String(value?.expr ?? "").trim());
  if (!m) return undefined;
  const fixed = splitTop(m[1], ",")
    .map((arg) => evalLength(arg.trim(), { fontSize }))
    .filter((at) => at && !at.pct && !at.num)
    .map((at) => at.px);
  return fixed.length ? Math.min(...fixed) : undefined;
}

/** Whether `value` is `calc(100% - m)` where `m` is the box's left and right margins together. */
function fillsLessMargins(value, v) {
  if (typeof value !== "object" || !value?.expr) return false;
  const at = evalLength(value.expr, { fontSize: v["font-size"] });
  const margins = (v["margin-left"]?.px ?? NaN) + (v["margin-right"]?.px ?? NaN);
  return !!at && !at.num && at.pct === 100 && Math.abs(at.px + margins) < 0.01;
}

/** The `[x, y]` a `transform: translate…()` or a `translate` declaration moves a box by, as text; `[]` for none,
 * null for a transform that is more than one translation. */
function translation(v) {
  const transform = v.transform;
  if (transform && transform !== "none") {
    const m = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(transform);
    const args = m && splitTop(m[2], ",").map((a) => a.trim());
    if (!args || args.length > (m[1] ? 1 : 2)) return null;
    if (m[1] === "X") return [args[0], "0"];
    if (m[1] === "Y") return ["0", args[0]];
    return [args[0], args[1] ?? "0"];
  }
  const translate = v.translate;
  if (translate && translate !== "none") {
    const parts = splitTop(String(translate).trim(), " ").filter(Boolean);
    if (parts.length > 3 || (parts[2] !== undefined && evalLength(parts[2], {})?.px)) return null;
    return [parts[0], parts[1] ?? "0"];
  }
  return [];
}

/** A box moved by a translation, which the engine has no transform for (a percentage is of the box's own fixed
 * size): an absolutely placed box by a margin on that side, a box in flow by a relative offset, which moves it
 * without moving what is around it, as a transform does. Anything else is reported. */
function shiftByTranslate(computed, s, report, inFlow = false) {
  const v = computed.values;
  const shift = translation(v);
  if (shift?.length === 0) return;
  const prop = v.transform && v.transform !== "none" ? "transform" : "translate";
  const ctx = { fontSize: v["font-size"] };
  const of = (text, size) => {
    const e = evalLength(text, ctx);
    if (!e || (e.unitless && e.num)) return undefined;
    if (!e.pct) return e.px;
    return typeof size === "number" ? e.px + (e.pct / 100) * size : undefined;
  };
  const dx = shift ? of(shift[0], s.w) : undefined, dy = shift ? of(shift[1], s.h) : undefined;
  if (dx === undefined || dy === undefined) {
    // An absolutely placed box sized by its content (`left: 50%; transform: translate(-50%)`, the way CSS centres
    // one): the percentage is of the box as laid out, which the description reads back (`laidOutShift`).
    const parts = !inFlow && shift ? shift.map((text) => evalLength(text, ctx)) : null;
    if (parts?.every((e) => e && !(e.unitless && e.num))) {
      s[SHIFT] = parts.map((e) => [e.px, e.pct ?? 0]);
      return;
    }
    report("unsupported", prop, v[prop], computed.sources[prop]);
    return;
  }
  if (inFlow) {
    if (dx) s.left = dx;
    if (dy) s.top = dy;
    return;
  }
  if (dx) s.ml = (s.ml ?? 0) + dx;
  if (dy) s.mt = (s.mt ?? 0) + dy;
}

/** Where `shiftByTranslate` leaves a translation that is a percentage of a content-sized box. */
const SHIFT = Symbol("perch.shift");

/** A translation by a percentage of `element`'s own size (`SHIFT`), as margins from the box the engine last laid it
 * out in (`HostDocument.measure`). Until there is one, or while its size moves, the tree is described again after the
 * next frame, at most `MEASURE_TRIES` times in a row; a box whose size held resets that count. */
function laidOutShift(element, style, shift) {
  const document = element.ownerDocument;
  const box = document?.measure?.(element) ?? null;
  if (box) {
    const [[xPx, xPct], [yPx, yPct]] = shift;
    const dx = xPx + (xPct / 100) * box.width, dy = yPx + (yPct / 100) * box.height;
    if (dx) style.ml = (typeof style.ml === "number" ? style.ml : 0) + dx;
    if (dy) style.mt = (typeof style.mt === "number" ? style.mt : 0) + dy;
  }
  const seen = box ? `${box.width}x${box.height}` : "";
  if (seen === element.shiftSeen) {
    element.shiftTries = 0;
  } else if ((element.shiftTries ?? 0) < MEASURE_TRIES && document?.retries) {
    element.shiftSeen = seen;
    element.shiftTries = (element.shiftTries ?? 0) + 1;
    document.retries.push(() => document.afterCommit?.());
  }
}

/** The non-text engine styles of one computed style, plus what could not be expressed. */
function boxStyle(computed, report, viewport = null) {
  const v = computed.values;
  const s = {};
  const src = (prop) => computed.sources[prop];
  const own = (prop) => computed.sources[prop] !== undefined;
  const display = v.display;
  if (display === "none") s.display = "hidden";
  else if (display === "flex" || display === "inline-flex") s.display = "flex";
  else if (display === "grid" || display === "inline-grid") {
    // ponytail: a grid is drawn as a one-column flex column (every grid here is one column); real columns need
    // the engine's grid().
    s.display = "flex";
    s.flex_direction = "col";
    report("approximated", "display", display, src("display"), "one-column flex column");
    if (v["grid-template-columns"] && v["grid-template-columns"] !== "none") report("unsupported", "grid-template-columns", v["grid-template-columns"], src("grid-template-columns"));
  }
  if (computed.element.hidden) s.display = "hidden";
  const flexLike = s.display === "flex";
  if (flexLike && s.flex_direction !== "col") {
    const dir = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[v["flex-direction"]] ?? "row";
    s.flex_direction = dir;
  }
  if (flexLike) {
    if (v["flex-wrap"] === "wrap" || v["flex-wrap"] === "wrap-reverse") s.flex_wrap = "wrap";
    const grid = display === "grid" || display === "inline-grid";
    const items = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[v["align-items"]];
    if (items) s.items = items;
    let justify = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[v["justify-content"]];
    if (grid) {
      // `place-items: center` centres a grid's one column across (justify-items) and along (align-items).
      const across = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[v["justify-items"]];
      if (across) s.items = across;
      if (v["align-items"] === "center") justify = "center";
    }
    if (justify) s.justify = justify;
    const gapY = length(v["row-gap"]), gapX = length(v["column-gap"]);
    if (typeof gapY === "number" && gapY) s.gap_y = gapY;
    if (typeof gapX === "number" && gapX && !grid) s.gap_x = gapX;
  }
  // As a flex item.
  if (v["flex-grow"]) s.flex_grow = v["flex-grow"];
  if (v["flex-shrink"] !== 1) s.flex_shrink = v["flex-shrink"];
  const basis = length(v["flex-basis"]);
  if (basis !== undefined && basis !== "auto") s.flex_basis = basis;
  const self = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[v["align-self"]];
  if (self) s.self = self;

  for (const [key, prop] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const value = v[prop];
    const out = length(value);
    if (out === undefined && prop === "width" && fillsLessMargins(value, v)) {
      // `calc(100% - <the side margins>)` is the width a stretched box gets: the engine stretches it instead.
      // ponytail: right in a column (a block's children are one); a row has no stretch along it.
      s.self = "stretch";
      report("approximated", prop, value.expr, src(prop), "stretched across its parent, inside its margins");
      continue;
    }
    // `max-width: min(22rem, calc(100% - 1.5rem))`: the fixed bound alone.
    // ponytail: right while the parent is wider than that bound and the relative one's inset; a narrower parent
    // would need the parent's width, which is not known here.
    const fixed = out === undefined && /^max-/.test(prop) ? fixedBoundOf(value, v["font-size"]) : undefined;
    if (fixed !== undefined) {
      s[key] = fixed;
      report("approximated", prop, value.expr, src(prop), "the fixed bound of min()");
      continue;
    }
    if (out === undefined) {
      if (typeof value === "object" && value.expr) report("unsupported", prop, value.expr, src(prop), "no calc() in the engine");
      else if (typeof value === "string" && !["auto", "none"].includes(value)) report("unsupported", prop, value, src(prop));
      continue;
    }
    // `min-w-0` matters: a flex item's automatic minimum is its content, in the engine as in CSS.
    if (out !== "auto") s[key] = out;
  }
  const sides = ["top", "right", "bottom", "left"];
  for (const side of sides) {
    const short = side[0];
    for (const [prefix, prop] of [["p", "padding"], ["m", "margin"]]) {
      const value = v[`${prop}-${side}`];
      const out = length(value);
      if (out === undefined) { if (value?.expr) report("unsupported", `${prop}-${side}`, value.expr, src(`${prop}-${side}`), "no calc() in the engine"); continue; }
      if (out !== 0) s[`${prefix}${short}`] = out;
    }
  }
  const position = v.position;
  if (position === "absolute" || position === "fixed") {
    s.position = "absolute";
    if (position === "fixed") report("approximated", "position", "fixed", src("position"), "absolute in the overlay layer");
    for (const side of sides) {
      const out = length(v[side]);
      if (out !== undefined && out !== "auto") s[side] = out;
    }
    // A fixed box sized by its content is at most as wide as the window leaves it right of where it starts (CSS's
    // shrink-to-fit width); the engine's absolute box would run past the window's edge instead.
    if (position === "fixed" && viewport && s.w === undefined && s.right === undefined && typeof s.left === "number") {
      const room = viewport.width - s.left - (typeof s.ml === "number" ? s.ml : 0) - (typeof s.mr === "number" ? s.mr : 0);
      s.max_w = typeof s.max_w === "number" ? Math.min(s.max_w, room) : room;
    }
    shiftByTranslate(computed, s, report);
  } else if (position === "sticky") report("unsupported", "position", "sticky", src("position"));
  else if (translation(v)?.length !== 0) {
    // ponytail: a relative box's own `left`/`top` are not drawn, so its translation is its only offset.
    s.position = "relative";
    shiftByTranslate(computed, s, report, true);
  }
  if (v["z-index"] !== "auto" && own("z-index")) report("unsupported", "z-index", v["z-index"], src("z-index"), "paint order is tree order");

  for (const [axis, prop] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const value = v[prop];
    if (value === "hidden" || value === "clip") s[axis] = "hidden";
    else if (value === "auto" || value === "scroll") s[axis] = "scroll";
  }
  if (v.visibility === "hidden" || v.visibility === "collapse") s.visibility = "invisible";

  const bg = v["background-color"];
  if (bg?.unreadable) report("unsupported", "background-color", bg.unreadable, src("background-color"));
  else if (bg?.rgba && bg.rgba[3] > 0) s.bg = colorOut(bg);
  if (v["background-image"] && v["background-image"] !== "none") report("unsupported", "background-image", v["background-image"], src("background-image"));

  const widths = sides.map((side) => length(v[`border-${side}-width`]) || 0);
  const colors = [];
  sides.forEach((side, k) => {
    if (!widths[k]) return;
    s[`border_${side[0]}`] = widths[k];
    const style = v[`border-${side}-style`];
    if (style !== "solid") report("approximated", `border-${side}-style`, style, src(`border-${side}-style`), "drawn solid");
    const color = colorOut(v[`border-${side}-color`]);
    if (color) colors.push(color);
  });
  if (colors.length) {
    s.border_color = colors[0];
    if (colors.some((c) => c.value !== colors[0].value)) report("approximated", "border-color", colors.map((c) => c.value).join(" "), src("border-top-color"), "one border colour");
  }
  // A radius in percent is of the box's own size (`50%`: a dot). The engine takes lengths only, so a box of known size gets
  // its share of the shorter side, and one sized by its content the most a corner can round, which is what 50% makes of it.
  // ponytail: a percentage above 50% is the same as 50% in CSS too, so the cap holds; a box sized by `%` of its parent has no
  // size to take a share of here.
  const radius = (c) => {
    const out = length(v[`border-${c}-radius`]) || 0;
    if (typeof out !== "string") return out;
    const share = parseFloat(out) / 100;
    const sides = [s.w, s.h].filter((side) => typeof side === "number");
    if (out === "auto" || !(share > 0)) return 0;
    return sides.length ? Math.round(Math.min(share, 0.5) * Math.min(...sides) * 100) / 100 : 9999;
  };
  const corners = ["top-left", "top-right", "bottom-right", "bottom-left"].map(radius);
  if (corners.every((c) => c === corners[0])) { if (corners[0]) s.rounded = corners[0]; } else ["tl", "tr", "br", "bl"].forEach((c, k) => { if (corners[k]) s[`rounded_${c}`] = corners[k]; });

  if (v.opacity !== 1) s.opacity = Math.round(v.opacity * 1000) / 1000;
  const shadow = v["box-shadow"];
  if (shadow && shadow !== "none" && splitTop(shadow, ",").some((one) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(one.trim()))) {
    s.shadow = "lg";
    report("approximated", "box-shadow", shadow, src("box-shadow"), "the engine's large shadow preset");
  }
  if (v.cursor && v.cursor !== "auto" && !computed.inherited.has("cursor")) {
    const cursor = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[v.cursor];
    if (cursor) s.cursor = cursor;
    else report("unsupported", "cursor", v.cursor, src("cursor"));
  }
  if (v["text-overflow"] === "ellipsis") s.text_ellipsis = true;
  if (v["text-decoration-line"] === "underline") s.underline = true;
  else if (v["text-decoration-line"] && v["text-decoration-line"] !== "none") report("unsupported", "text-decoration-line", v["text-decoration-line"], src("text-decoration-line"));
  return s;
}

/** The OpenType feature tags (`"tnum,zero"`) of a `font-variant-numeric` value; `""` for normal, null for a keyword
 * with no tag here. */
const NUMERIC = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function numericFeatures(value) {
  if (!value || value === "normal") return "";
  const tags = String(value).trim().split(/\s+/).map((word) => NUMERIC[word]);
  return tags.every(Boolean) ? tags.join(",") : null;
}

/** The text styles a node's computed style asks for, before inheritance is taken into account. */
function textWanted(computed, measure) {
  const v = computed.values;
  const lh = v["line-height"];
  const color = colorOut(v.color);
  return {
    text_color: color,
    text_size: Math.round(v["font-size"] * 1000) / 1000,
    font_features: numericFeatures(v["font-variant-numeric"]) ?? "",
    font_weight: v["font-weight"],
    line_height: lh.factor !== undefined ? { factor: lh.factor } : { px: Math.round(lineHeightPx(v, measure) * 1000) / 1000 },
    font_family: ENGINE_FAMILY(v["font-family"]),
    italic: v["font-style"] === "italic" || v["font-style"] === "oblique",
    whitespace: v["white-space"] === "nowrap" || v["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[v["text-align"]] ?? "left",
  };
}
const lineHeightOf = (inheritedForm, size) => (inheritedForm.factor !== undefined ? inheritedForm.factor * size : inheritedForm.px);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Engine text keys from the wanted text style: those this node must set, given what it inherits in the engine. */
function textStyle(computed, wanted, inheritedText) {
  const s = {};
  const set = (key, cssProps) => cssProps.some((p) => !computed.inherited.has(p));
  for (const [key, props] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]]) {
    if (set(key, props) || !same(wanted[key], inheritedText[key])) s[key] = wanted[key];
  }
  const wantedPx = lineHeightOf(wanted.line_height, wanted.text_size);
  const inheritedPx = inheritedText.line_height ? lineHeightOf(inheritedText.line_height, wanted.text_size) : NaN;
  if (set("line_height", ["line-height"]) || !(Math.abs(wantedPx - inheritedPx) <= 0.001)) s.line_height = wanted.line_height;
  return s;
}
/** What a child inherits in the engine after this node's text keys. */
const inheritText = (parent, own) => ({ ...parent, ...own });

/** Description values: colours as `"#rrggbbaa"` with the token kept aside, line heights as GPUI takes them. */
function encode(style, tokens) {
  const out = {};
  for (const [key, value] of Object.entries(style)) {
    if (value && typeof value === "object" && "value" in value) {
      out[key] = value.value;
      if (value.token) tokens[key] = value.token;
    } else if (key === "line_height") out[key] = value.factor !== undefined ? Math.round(value.factor * 1000) / 1000 : `${value.px}px`;
    else if (key === "italic") { if (value) out.italic = true; } else out[key] = value;
  }
  if (out.italic === false) delete out.italic;
  return out;
}

/** The keys of `variant` that differ from `base` (a removed key resets to the engine default). */
function diff(base, variant) {
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(variant)])) {
    const a = base[key], b = variant[key];
    if (same(a, b)) continue;
    out[key] = b === undefined ? (key in DEFAULTS ? DEFAULTS[key] : null) : b;
  }
  return out;
}

/** What `computed` declares that the engine cannot draw and `boxStyle` did not already report. */
function reportDeclarations(computed, report) {
  const v = computed.values;
  for (const [prop, source] of Object.entries(computed.sources)) {
    if (prop.startsWith("--") || INERT.has(prop) || source.startsWith("ua:")) continue;
    const value = v[prop];
    switch (prop) {
      case "letter-spacing":
        if (value !== "normal" && !(value?.px === 0)) report("approximated", prop, value?.px !== undefined ? `${Math.round(value.px * 1000) / 1000}px` : value, source, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        if (value !== "normal" && numericFeatures(value) === null) report("unsupported", prop, value, source);
        break;
      case "text-transform":
        if (value !== "none") report("approximated", prop, value, source, "applied to the text in JS");
        break;
      case "transition-property": case "transition-duration": {
        const duration = v["transition-duration"];
        if (prop === "transition-property" && duration && splitTop(duration, ",").some((d) => parseFloat(d) > 0) && v["transition-property"] !== "none") {
          report("unsupported", "transition", `${v["transition-property"]} ${duration}`, source, "changes are instant (the engine animates only opacity and size)");
        }
        break;
      }
      case "-webkit-line-clamp":
        if (value !== "none") report("unsupported", prop, value, source, "no line clamp in the engine");
        break;
      case "-webkit-box-orient": case "overflow-wrap":
        if (prop === "overflow-wrap" && value !== "normal") report("approximated", prop, value, source, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style": case "outline-width": case "outline-color":
        if (v["outline-style"] !== "none" && prop === "outline-style") report("unsupported", "outline", `${length(v["outline-width"])}px ${v["outline-style"]} ${colorOut(v["outline-color"])?.value ?? ""}`.trim(), source, "no outline in the engine (no focus ring)");
        break;
      case "transform": case "translate":
        // A translation is drawn as a margin or an offset (`shiftByTranslate`), which reports what it cannot do.
        break;
      case "rotate": case "scale": case "animation": case "animation-name": case "filter": case "backdrop-filter":
      case "mask": case "-webkit-mask": case "clip-path": case "content": case "list-style": case "resize": case "appearance": case "-webkit-appearance":
      case "vertical-align": case "float": case "clear": case "order": case "aspect-ratio": case "object-fit": case "isolation": case "mix-blend-mode":
      case "will-change": case "contain": case "touch-action": case "caret-color": case "scroll-behavior": case "scrollbar-gutter": case "text-wrap":
      case "fill": case "stroke": case "stroke-width": case "grid-template-rows": case "grid-auto-flow": case "grid-column": case "grid-row":
        if (value && value !== "none" && value !== "auto" && value !== "normal" && value !== "initial") report("unsupported", prop, value, source);
        break;
      default:
        break;
    }
  }
}

/** An element's own part of the description (its styles, variants, events and attributes), which depends only on
 * it and its ancestors: computed once and reused until one of them changes (`HostElement.version`). */
function ownPart(element, parentComputed, inheritedText, ctx) {
  const where = label(element);
  const reports = [];
  const report = (kind, property, value, source, note) => reports.push([kind, property, value, source ?? "(user agent)", where, note]);
  const computed = ctx.cascade.compute(element, parentComputed);
  const tokens = {};
  const base = boxStyle(computed, report, ctx.viewport);
  const shift = base[SHIFT];
  reportDeclarations(computed, report);
  const wanted = textWanted(computed, ctx.measure);
  const ownText = textStyle(computed, wanted, inheritedText);
  const style = encode({ ...base, ...ownText }, tokens);
  const extra = {};
  // Interaction variants: the element's own `hover:`, `focus:`/`focus-visible:` and `active:` styles.
  const variantRules = ctx.cascade.matching(element, "*").filter((rule) => rule.states.subject.size);
  for (const [key, states] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!variantRules.some((rule) => states.some((state) => rule.states.subject.has(state)))) continue;
    const variant = ctx.cascade.compute(element, parentComputed, new Set(states));
    const vTokens = {};
    const vStyle = encode({ ...boxStyle(variant, () => {}), ...textStyle(variant, textWanted(variant, ctx.measure), inheritedText) }, vTokens);
    if (key === "focus") reportDeclarations(variant, report);
    const changed = diff(style, vStyle);
    if (Object.keys(changed).length) {
      extra[key] = changed;
      const changedTokens = Object.fromEntries(Object.entries(vTokens).filter(([k]) => k in changed));
      if (Object.keys(changedTokens).length) extra[`${key}_tokens`] = changedTokens;
    }
  }
  if (ctx.cascade.sheet.tracks(element, "hover")) extra.track_hover = true;
  // Digits drawn at one width (`tabular-nums`, which the engine cannot draw): the text's width is not the engine's.
  if (/tabular/.test(String(computed.values["font-variant-numeric"] ?? ""))) extra.tabular = true;
  // A word too long for its line is broken anywhere (`overflow-wrap: anywhere` / `break-word`).
  if (/^(anywhere|break-word)$/.test(String(computed.values["overflow-wrap"] ?? ""))) extra.break_anywhere = true;
  // A vertical scroller draws the app's scrollbar (`::-webkit-scrollbar`, `--scrollbar-size` wide) beside its content
  // when that overflows; the engine's scrollbars take no room, so the width is kept for the translator.
  if (base.overflow_y === "scroll") {
    const size = Number.parseFloat(computed.customs?.["--scrollbar-size"] ?? "");
    if (size > 0) extra.scrollbar = size;
  }
  // An element that takes pointer events again under one that lets them through (`pointer-events-auto` in a
  // `pointer-events-none` stack): a press on it stops there and does not reach what is beneath the screen.
  if (computed.values["pointer-events"] !== "none" && parentComputed?.values["pointer-events"] === "none") extra.blocks_pointer = true;
  const events = Object.entries(EVENTS).filter(([, props]) => props.some((p) => typeof element.props[p] === "function")).map(([name]) => name);
  // A form's submit button submits it on a click, with or without a handler of its own.
  if (!events.includes("click") && submits(element)) events.push("click");
  if (events.length) extra.events = events;
  return { computed, style, tokens, extra, meta: meta(element), reports, childText: inheritText(inheritedText, ownText), where, shift };
}

/** One described subtree. `chain` names the element's ancestors with their versions. */
function describeElement(element, parentComputed, inheritedText, ctx, chain = "") {
  const key = `${chain}/${element.id}.${element.version}`;
  let entry = ctx.cache.get(element);
  if (!entry || entry.key !== key) ctx.cache.set(element, (entry = { key, part: ownPart(element, parentComputed, inheritedText, ctx) }));
  const { computed, tokens, extra, reports, childText, where } = entry.part;
  for (const args of reports) ctx.findings.add(...args);
  const report = (kind, property, value, source, note) => ctx.findings.add(kind, property, value, source ?? "(user agent)", where, note);
  const style = { ...entry.part.style };
  if (entry.part.shift) laidOutShift(element, style, entry.part.shift);
  const node = { kind: "div", id: element.id, style, tokens, meta: entry.part.meta, ...extra };
  Object.defineProperty(node, DISPLAY, { value: computed.values.display });
  // An element the source measured keeps its laid-out box for it (`HostDocument.measure`).
  if (element.measured && element.ownerDocument?.measureKey) node.measure = element.ownerDocument.measureKey(element);

  const tag = element.tagName;
  if (tag === "svg") {
    node.kind = element.props["data-perch-image"] ? "image" : "svg";
    node.markup = svgMarkup(element);
    return node;
  }
  if (tag === "input" || tag === "textarea" || tag === "select") {
    node.kind = "input";
    node.input_type = tag === "input" ? String(element.props.type ?? "text") : tag;
    for (const key of ["placeholder", "checked", "disabled"]) if (element.props[key] !== undefined) node[key] = element.props[key];
    if (/^(checkbox|radio)$/.test(node.input_type)) node.checked = element.checked;
    if (tag !== "select") node.value = element.value;
    if (tag === "input" && TEXT_FIELD.test(node.input_type)) node.field_w = FIELD_EMS * computed.values["font-size"];
    // A text area with no height of its own is `rows` lines high (2 by default) and its padding and borders, as a
    // browser sizes it.
    if (tag === "textarea" && style.h === undefined) {
      const v = computed.values;
      const px = (x) => (x && typeof x === "object" && "px" in x ? x.px : 0);
      const border = (side) => (v[`border-${side}-style`] === "none" ? 0 : px(v[`border-${side}-width`]));
      const rows = Number(element.props.rows) > 0 ? Math.floor(Number(element.props.rows)) : 2;
      style.h = rows * lineHeightPx(v, ctx.measure) + px(v["padding-top"]) + px(v["padding-bottom"]) + border("top") + border("bottom");
    }
    return node;
  }
  if (tag === "img") {
    node.kind = "image";
    node.src = element.props.src ?? null;
    // The `width`/`height` attributes are the image's size where its style gives none, as a browser takes them.
    for (const [attr, key] of [["width", "w"], ["height", "h"]]) {
      const value = Number(element.props[attr]);
      if (style[key] === undefined && element.props[attr] != null && Number.isFinite(value)) style[key] = value;
    }
    return node;
  }

  const transform = computed.values["text-transform"];
  const kids = [];
  let inline = false, blockKids = false;
  for (const child of element.childNodes) {
    if (child instanceof HostText) {
      if (child.hidden || child.data === "") continue;
      inline = true;
      const last = kids[kids.length - 1];
      if (last?.kind === "text") {
        last.source = (last.source ?? last.text) + child.data;
        last.text = applyTransform(last.source, transform);
        if (last.text === last.source) delete last.source;
      } else {
        const text = applyTransform(child.data, transform);
        kids.push(text === child.data ? { kind: "text", text } : { kind: "text", text, source: child.data });
      }
      continue;
    }
    if (!(child instanceof HostElement)) continue;
    const described = describeElement(child, computed, childText, ctx, key);
    const childDisplay = described[DISPLAY];
    if (childDisplay === "inline" || childDisplay === "inline-block" || childDisplay === "inline-flex") inline = true;
    else if (childDisplay !== "none") blockKids = true;
    kids.push(described);
  }
  // An inline flex box sized by its content (a select's trigger) is as wide as its items' text; its text item (`flex-1 min-w-0
  // truncate`) only shares out the room the box has. The engine sizes the box from items that may shrink to nothing and
  // draws the text in a box of no width, so such an item keeps its content width and does not clip: the same width, and
  // ponytail: a box squeezed narrower than its text overflows instead of ending in an ellipsis.
  if (/(^|\s)inline-flex(\s|$)/.test(String(element.props?.className ?? "")) && style.w === undefined) {
    for (const kid of kids) {
      if (kid.style?.flex_grow && kid.style.min_w === 0 && kid.style.overflow_x === "hidden") {
        delete kid.style.min_w;
        delete kid.style.flex_grow;
        delete kid.style.flex_basis;
        delete kid.style.overflow_x;
        delete kid.style.overflow_y;
      }
    }
  }
  // A block holding inline content and elements: the engine has no inline formatting, so its inline children are
  // laid out as a row on the text baseline (one line; wrapping inline runs would need text runs in the engine).
  // Inline elements holding only text (a `<code>` in a sentence) cannot be a box in a row that wraps, and the engine has no
  // text runs: their text joins the sentence, in the sentence's own font.
  // ponytail: the inline element's own face (a monospace path) and colour are lost; wrapping needs engine text runs.
  if (!style.display && inline && kids.some((k) => k.kind !== "text") && kids.every((k) => k.kind === "text" || (k.kind === "div" && k[DISPLAY] === "inline" && !k.events?.length && k.children?.every((c) => c.kind === "text")))) {
    const text = kids.map((k) => (k.kind === "text" ? k.text : k.children.map((c) => c.text).join(""))).join("");
    report("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font");
    kids.splice(0, kids.length, { kind: "text", text });
  }
  const hasElements = kids.some((k) => k.kind !== "text");
  const only = kids.length === 1 && kids[0].kind !== "text" && /^inline-(block|flex)$/.test(kids[0][DISPLAY]) ? kids[0] : null;
  if (!style.display && only) {
    // One inline box alone on its line (a button in a plain div): CSS puts its baseline on the line's strut, the
    // block's own font and line height, which lowers it under a larger font. The engine has no line boxes: the box
    // is moved down by the strut's ascent less its own baseline.
    const child = ctx.cache.get(element.childNodes.find((n) => n.id === only.id))?.part.computed;
    const drop = child ? strutAscent(computed.values, ctx.measure) - ownBaseline(child.values, ctx.measure, only) : 0;
    style.display = "flex";
    style.flex_direction = "col";
    style.items = "start";
    if (drop > 0) only.style.mt = Math.round(((only.style.mt ?? 0) + drop) * 100) / 100;
    report("approximated", "display", `${computed.values.display} holding one ${only[DISPLAY]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!style.display && kids.length === 1 && (kids[0].kind === "svg" || kids[0].kind === "image") && kids[0][DISPLAY] === "inline" && typeof kids[0].style.h === "number") {
    // One inline image alone on its line (an icon in a plain span): it sits on the baseline of the line's strut, so
    // the line is as high as the strut's ascent or the image, whichever is taller, plus the strut's descent.
    const icon = kids[0];
    const ascent = strutAscent(computed.values, ctx.measure);
    const descent = lineHeightPx(computed.values, ctx.measure) - ascent;
    const round = (n) => Math.round(n * 100) / 100;
    style.display = "flex";
    style.flex_direction = "col";
    style.items = "start";
    if (ascent > icon.style.h) icon.style.mt = round((icon.style.mt ?? 0) + ascent - icon.style.h);
    if (descent > 0) icon.style.mb = round((icon.style.mb ?? 0) + descent);
    report("approximated", "display", `${computed.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!style.display && inline && hasElements) {
    style.display = "flex";
    style.flex_direction = blockKids ? "col" : "row";
    if (!blockKids) style.items = "baseline";
    // An inline box among blocks is on a line of its own, as wide as its content, not the column's width.
    else for (const kid of kids) if (kid.kind !== "text" && /^inline-(block|flex)$/.test(kid[DISPLAY]) && !kid.style.self) kid.style.self = "start";
    report("approximated", "display", `${computed.values.display} with inline content`, "(inline formatting)", blockKids ? "a column of its children" : "a row on the text baseline");
  }
  // Letter spacing: the engine has none. A spaced run keeps its glyphs together and gets the spacing WebKit adds
  // after each character as room after the run, so the run's box is as wide as the page's (the letters are not
  // spread). A row of single characters with gaps spreads them, but every character's box snaps to the device pixel
  // grid and the run comes out 2.7 to 5.8 px wider than the page's.
  const spacing = computed.values["letter-spacing"]?.px;
  if (spacing) {
    for (let i = 0; i < kids.length; i++) {
      const run = kids[i];
      if (run.kind !== "text") continue;
      const room = Math.round(spacing * [...run.text].length * 1000) / 1000;
      kids[i] = { kind: "div", style: { pr: room }, tokens: {}, children: [run] };
    }
  }
  node.children = kids;
  return node;
}

/** The parity table's key for an element (`e2e/native-parity/named-elements.json`, `key`). */
function keyOf(element, spec) {
  if (!spec) return null;
  const at = spec.self ? element : spec.closest ? closestBy(element, spec.closest) : spec.find ? queryBy(element, spec.find)[0] : null;
  let value = at?.getAttribute(spec.attr) ?? null;
  if (value && spec.strip && value.startsWith(spec.strip)) value = value.slice(spec.strip.length);
  return value;
}

/** Engine names for the elements a parity table names, from its selectors over the host tree: `name`, or
 * `name:key` for one of many. A `textRange` name is the element's own text (`range_name`), not the element. */
function nameElements(document, defs, nodes) {
  // One walk of the tree, each element tried against every selector, rather than a walk per selector: the same
  // names, a fraction of the visits. The first matching definition of a kind is the element's name; a later one
  // of the same kind is one more name for it (`also`), as the page's selectors each find it.
  const parsed = defs.map((def) => [def, parseSelector(def.selector)]);
  // An engine id names one element: a name with no key that matches again is `name@<n>` (its index in document
  // order, which the parity report reads back).
  const seen = new Map();
  const walk = (el) => {
    for (const element of el.children) {
      const node = nodes.get(element.id);
      if (node) {
        for (const [def, list] of parsed) {
          const slot = def.textRange ? "range_name" : "name";
          if ((def.textRange && node[slot] != null) || !list.some((steps) => matchesComplex(element, steps))) continue;
          const key = keyOf(element, def.key);
          const at = key == null ? (seen.get(def.name) ?? 0) : 0;
          if (key == null) seen.set(def.name, at + 1);
          const name = key != null ? `${def.name}:${key}` : at ? `${def.name}@${at}` : def.name;
          if (node[slot] == null) node[slot] = name;
          else (node.also ??= []).push(name);
        }
      }
      walk(element);
    }
  };
  walk(document.documentElement);
}

/** The UI face's ascent and descent per px of font size (San Francisco: the page's glyph run box is 1.1777 x the
 * size high). */
export const ASCENT = 0.9521;
export const DESCENT = 0.2256;
/** How far the baseline of a line in `values`' font sits below the line's top (half the leading, then the ascent). */
const strutAscent = (values, measure) => (lineHeightPx(values, measure) - (ASCENT + DESCENT) * values["font-size"]) / 2 + ASCENT * values["font-size"];
/** How far an inline box's first baseline sits below its top: its top padding and border, then its line's. A box
 * holding one icon (a "+" button) has the icon's bottom as its baseline, which is lower than its strut's when the
 * icon is the taller (`described`: the box as described, its icon already on its line). */
function ownBaseline(values, measure, described) {
  const px = (v) => (v && typeof v === "object" && "px" in v ? v.px : 0);
  const border = values["border-top-style"] === "none" ? 0 : px(values["border-top-width"]);
  const kids = described?.children ?? [];
  const icon = kids.length === 1 && (kids[0].kind === "svg" || kids[0].kind === "image") && typeof kids[0].style.h === "number" ? kids[0] : null;
  const line = icon ? Math.max(strutAscent(values, measure), (icon.style.mt ?? 0) + icon.style.h) : strutAscent(values, measure);
  return px(values["padding-top"]) + border + line;
}

const applyTransform =(text, transform) => (transform === "uppercase" ? text.toUpperCase() : transform === "lowercase" ? text.toLowerCase() : transform === "capitalize" ? text.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : text);

const ATTR_SKIP = new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
/** Tag, classes and attributes as the page would have them: for tests, devtools and selectors over the description. */
function meta(element) {
  const attrs = {};
  for (const [name, value] of Object.entries(element.props)) {
    if (ATTR_SKIP.has(name) || typeof value === "function" || value === undefined || value === null || typeof value === "object") continue;
    // As React writes them: `aria-*`/`data-*` keep "true"/"false", a boolean attribute is present or absent.
    const keeps = name.startsWith("aria-") || name.startsWith("data-");
    if (value === false && !keeps) continue;
    const attr = name === "htmlFor" ? "for" : name === "tabIndex" ? "tabindex" : name;
    attrs[attr] = typeof value === "boolean" ? (keeps ? String(value) : "") : String(value);
  }
  return { tag: element.tagName, classes: element.classList, attrs };
}

const SVG_ATTR = (name) => (name === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(name) ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
const escapeAttr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/** The `<svg>` subtree as markup the engine rasterises (`currentColor` is the node's text colour). */
export function svgMarkup(element) {
  if (element.props["data-perch-markup"]) return String(element.props["data-perch-markup"]);
  const write = (el) => {
    const attrs = [];
    for (const [name, value] of Object.entries(el.props)) {
      if (ATTR_SKIP.has(name) || typeof value === "function" || value === undefined || value === null || value === false || typeof value === "object") continue;
      if (name.startsWith("data-") || name.startsWith("aria-") || name === "focusable" || name === "role" || name === "title") continue;
      attrs.push(`${SVG_ATTR(name)}="${escapeAttr(value === true ? "" : value)}"`);
    }
    if (el.tagName === "svg" && !el.props.xmlns) attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
    const inner = el.childNodes.map((child) => (child instanceof HostText ? escapeAttr(child.data) : write(child))).join("");
    return `<${el.tagName}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${inner}</${el.tagName}>`;
  };
  return write(element);
}

/** The theme tokens as hex, from the host (`perch.theme()`: token name -> colour). */
function themeOf(perch) {
  const theme = perch.theme?.() ?? {};
  const out = {};
  for (const name of THEME_TOKENS) if (theme[name]) out[name] = theme[name];
  return out;
}

/** Nothing inherited at the top of a described tree: its root sets every text key, so nothing depends on the
 * engine's own defaults. */
const ENGINE_ROOT_TEXT = { font_features: "" };

/**
 * Describes the document for the engine: `root` (the screen's container) and `overlays` (what was portalled into
 * `document.body`, in order), the `document_events` the source listens for on `document`/`window`, and every
 * declaration the engine cannot draw (`unsupported`).
 */
export function describe(document, perch, sheet, kept = {}, names = null) {
  const theme = themeOf(perch);
  const viewport = perch.viewport?.() ?? { width: 1000, height: 800 };
  // What was computed for the last description is kept (`kept`) while the sheet, theme and window stay the same.
  const look = JSON.stringify([theme, viewport]);
  if (kept.look !== look || kept.sheet !== sheet) Object.assign(kept, { look, sheet, cache: new WeakMap(), cascade: new Cascade(sheet, { theme, viewport }), top: null });
  const { cascade, cache } = kept;
  const ctx = { cascade, cache, viewport, findings: new Findings(), measure: perch.lineHeight ? (size) => perch.lineHeight(size) : null };
  // <html> and <body> carry no state of their own here: computed once per look.
  kept.top ??= cascade.compute(document.body, cascade.compute(document.documentElement, null));
  const trees = document.body.children.map((child) => describeElement(child, kept.top, ENGINE_ROOT_TEXT, ctx));
  if (names?.length) {
    const nodes = new Map();
    const walk = (node) => { if (node.id) nodes.set(node.id, node); for (const child of node.children ?? []) walk(child); };
    trees.forEach(walk);
    nameElements(document, names, nodes);
  }
  const listening = new Set();
  for (const target of [document, document.defaultView]) {
    for (const { type } of target?.listeners ?? []) if (DOCUMENT_EVENTS[type]) listening.add(DOCUMENT_EVENTS[type]);
  }
  return { schema: SCHEMA, root: trees[0] ?? null, overlays: trees.slice(1), document_events: [...listening].sort(), unsupported: ctx.findings.list() };
}
