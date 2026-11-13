//! The description as GPUI elements: one gpui-kit builder chain per node, for a mod's `render()`. Every key the
//! description can carry has exactly one entry in `STYLE` (a key it does not know throws, so a new key cannot be
//! dropped silently), and the events a node asks for become the kit's handlers, which run the event through the
//! React tree (`handle.dispatch`) and ask for a new frame.
//!
//! Pointer events: the deepest node with a pointer handler takes a press (`cx.stop_propagation()`), and the DOM-shaped
//! event then bubbles through the React tree, so ancestors see it as on the web; its target is that node rather than
//! a plain child without handlers. A press also stores the node's box (`event.bounds`), which `getBoundingClientRect`
//! returns when the click that follows opens a menu under it. A press outside an overlay is a `pointerdown` on the
//! document (what a menu listens for to close).
//!
//! Ids: a node the parity table names has that name (`name` or `name:key`; a name for an element's own text is a box
//! around the text); another node that needs an id for its handlers or interaction styles gets `~`, its host id and its
//! `data-testid` (`~n12:workspace-organize-status`);
//! the rest get none. Display-none nodes are left out; a named node that is invisible or fully transparent (a
//! hover-only button at rest) keeps no name, as the page does not count it shown.
//!
//! Vertical lengths on device pixels: GPUI rounds every length to a device pixel, so fractional CSS lengths stacked in
//! a column lose up to half a device pixel each and the error adds up (WebKit lays out fractionally and snaps only
//! when painting). `snapColumns` gives every vertical length that stacks in a column, in document order, the
//! device-pixel value that keeps the running total nearest the exact CSS running total (the error carried to the next
//! length), and a box whose CSS height follows from its lengths that sum as its height. It works from the
//! description's CSS values and the window's scale only.
//!
//! `kit` is `{ div, image }` from `gpui-kit`; `files.icon(id, markup, color)` gives the element that draws an icon's
//! markup (`currentColor` as `color`; the mod's `perch-react` `Icon`), as gpui-kit's `svg()` and `image()` read
//! files through an asset source the host may not have. An icon does not follow a hover colour (it is drawn once
//! per colour it is described with).

import { ASCENT, DESCENT } from "./describe.mjs";

/** Description key -> how it is applied to a builder (`el[name](...)`). */
const STYLE = {
  display: (el, v) => (v === "hidden" ? el.hidden() : v === "flex" ? el.flex() : el.block()),
  flex_direction: (el, v) => el[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[v]](),
  flex_wrap: (el, v) => (v === "wrap" ? el.flex_wrap() : el.flex_nowrap()),
  items: (el, v) => el[`items_${v}`](),
  justify: (el, v) => el[`justify_${v}`](),
  self: (el, v) => (v === "auto" ? el : el[`self_${v}`]()),
  flex_grow: (el, v) => el.flex_grow(v),
  flex_shrink: (el, v) => el.flex_shrink(v),
  flex_basis: (el, v) => el.flex_basis(v),
  position: (el, v) => (v === "absolute" ? el.absolute() : el.relative()),
  overflow_x: (el, v) => (v === "hidden" ? el.overflow_x_hidden() : v === "scroll" ? el.overflow_x_scroll() : el),
  overflow_y: (el, v) => (v === "hidden" ? el.overflow_y_hidden() : v === "scroll" ? el.overflow_y_scroll() : el),
  visibility: (el, v) => (v === "invisible" ? el.invisible() : el.visible()),
  bg: (el, v) => el.bg(v),
  opacity: (el, v) => el.opacity(v),
  shadow: (el, v) => (v === "none" ? el.shadow_none() : el[`shadow_${v}`]()),
  cursor: (el, v) => el[`cursor_${v}`](),
  border_color: (el, v) => el.border_color(v),
  text_ellipsis: (el, v) => (v ? el.text_ellipsis() : el),
  underline: (el, v) => (v ? el.underline() : el),
  text_color: (el, v) => el.text_color(v),
  text_size: (el, v) => el.text_size(v),
  font_weight: (el, v) => el.font_weight(v),
  font_family: (el, v) => el.font_family(v),
  font_features: (el, v) => el.font_features(v),
  line_height: (el, v) => el.line_height(v),
  italic: (el, v) => (v ? el.italic() : el.not_italic()),
  whitespace: (el, v) => (v === "nowrap" ? el.whitespace_nowrap() : el.whitespace_normal()),
  text_align: (el, v) => el[`text_${v}`](),
  rounded: (el, v) => el.rounded(v),
};
// Lengths: a number is logical px; "N%" and "auto" go through as the kit takes them.
for (const key of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"]) {
  STYLE[key] = (el, v) => el[key](v);
}
export const STYLE_KEYS = Object.keys(STYLE);

/** Applies a style map to a builder (or to the style a `hover`/`focus`/`active` closure gets). */
export function applyStyle(el, style) {
  for (const [key, value] of Object.entries(style)) {
    const apply = STYLE[key];
    if (!apply) throw new Error(`the description key ${key} has no GPUI builder`);
    if (value !== null && value !== undefined) el = apply(el, value);
  }
  return el;
}

const point = (event) => ({ clientX: event?.position?.x ?? 0, clientY: event?.position?.y ?? 0 });

/** The engine id of a node: its parity name, else (when the engine needs one, for events and interaction styles)
 * `~`, the host element's id and its `data-testid` if any, which tests that read named elements leave out. */
function engineId(node, events, overlay) {
  if (node.name) return node.name;
  if (!(events.size || node.hover || node.focus || node.active || node.track_hover || overlay)) return null;
  const testId = node.meta?.attrs["data-testid"];
  return testId ? `~${node.id}:${testId}` : `~${node.id}`;
}

/** A node the engine draws (display none is left out, so it is neither laid out nor recorded). */
const drawn = (child) => child.style?.display !== "hidden";

/** One node and its subtree as builder chains. `unseen`: an ancestor is invisible or fully transparent, so its
 * named elements are not shown (the page counts them hidden) and carry no name. */
export function toGpui(node, kit, handle, files, overlay = false, unseen = false, color = null, text = {}, rowItem = false, snapped = new Map()) {
  if (node.kind === "text") return node.text;
  unseen ||= node.style.opacity === 0 || node.style.visibility === "invisible";
  if (unseen && (node.name || node.range_name)) node = { ...node, name: undefined, range_name: undefined };
  color = node.style.text_color ?? color;
  // An icon takes the colour of its text, hover included: a node whose own `hover:` changes the text colour
  // reports the pointer (`on_hover`), and while it is over the node its icons are drawn in the hover colour.
  const hoverIcons = !!node.hover?.text_color && hasIcon(node);
  if (hoverIcons && handle.hovered?.(node.id)) color = node.hover.text_color;
  text = { ...text };
  for (const key of ["text_size", "line_height", "whitespace", "text_ellipsis"]) if (node.style[key] !== undefined) text[key] = node.style[key];
  const events = new Set(node.events ?? []);
  let el;
  if (node.kind === "image" && !node.markup) el = kit.image(node.src);
  else el = kit.div();
  // An icon is a box with the icon drawn in it (`svg`: in the colour its text would have, `image`: as drawn).
  if (node.markup) el = el.child(files.icon(`~icon-${node.id}`, node.markup, node.kind === "svg" ? color : ""));
  const id = engineId(node, events, overlay);
  if (id) el = el.id(id);
  el = applyStyle(el, { ...node.style, ...snapped.get(node) });
  // CSS gives a flex item an automatic minimum width of its min-content width, which for text that can wrap is its
  // longest word, so the item shrinks and its text wraps; GPUI's minimum for text is the whole line. A shrinkable
  // row item holding wrappable text of its own therefore gets no minimum width.
  // ponytail: zero rather than the longest word (not measured here), so in a row too narrow for one word the item
  // can shrink further than on the web; measuring the longest word through the text system would close that.
  const wraps = text.whitespace !== "nowrap" && !text.text_ellipsis;
  if (rowItem && wraps && node.style.flex_shrink !== 0 && node.style.min_w === undefined && (node.children ?? []).some((c) => c.kind === "text")) el = el.min_w(0);
  for (const variant of ["hover", "focus", "active"]) if (node[variant]) el = el[variant]((s) => applyStyle(s, node[variant]));
  // `scrollIntoView()`: the scroll area holding the element shows the child it is in. ponytail: the kit's one
  // `ScrollHandle` (`kit.scroll`) serves the first scroll area asked; a second one would need a handle per area.
  if (kit.scroll && (node.style.overflow_x === "scroll" || node.style.overflow_y === "scroll")) {
    const target = handle.document?.scrollTarget;
    const at = target ? (node.children ?? []).filter(drawn).findIndex((child) => holds(child, target.id)) : -1;
    if (at >= 0 && (handle.scroller ?? node.id) === node.id) {
      handle.document.scrollTarget = null;
      handle.scroller = node.id;
      kit.scroll.scroll_to_item(at);
    }
    if (handle.scroller === node.id) el = el.track_scroll(kit.scroll);
  }

  const pointer = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((name) => events.has(name));
  if (pointer) {
    el = el.on_mouse_down("left", (event, cx) => {
      cx.stop_propagation?.();
      if (event.bounds) handle.setBounds(node.id, event.bounds);
      const at = { ...point(event), button: 0, buttons: 1, detail: event.click_count };
      handle.dispatch(node.id, "pointerdown", { ...at, pointerType: "mouse" });
      handle.dispatch(node.id, "mousedown", at);
      cx.notify();
    });
    el = el.on_mouse_down("right", (event, cx) => {
      cx.stop_propagation?.();
      if (event.bounds) handle.setBounds(node.id, event.bounds);
      handle.dispatch(node.id, "contextmenu", { ...point(event), button: 2 });
      cx.notify();
    });
    el = el.on_mouse_up("left", (event, cx) => {
      cx.stop_propagation?.();
      const at = { ...point(event), button: 0 };
      handle.dispatch(node.id, "pointerup", { ...at, pointerType: "mouse" });
      handle.dispatch(node.id, "mouseup", at);
      cx.notify();
    });
    el = el.on_click((event, cx) => {
      handle.dispatch(node.id, event.click_count === 2 && events.has("double_click") ? "dblclick" : "click", { detail: event.click_count, button: 0 });
      cx.notify();
    });
  }
  if (events.has("mouse_move")) el = el.on_mouse_move((event, cx) => { handle.dispatch(node.id, "pointermove", { ...point(event), pointerType: "mouse" }); cx.notify(); });
  if (node.track_hover || hoverIcons) el = el.on_hover((on, cx) => { handle.hover(node.id, on); cx.notify(); });
  if (overlay) el = el.on_mouse_down_out((event, cx) => { handle.dispatch(handle.document.body.id, "pointerdown", { ...point(event), pointerType: "mouse" }); handle.dispatch(handle.document.body.id, "mousedown", point(event)); cx.notify(); });
  // A name for the element's own text (a bare text node in the page) goes on a box around that text. A line of
  // text that cannot wrap sits in a box of the CSS line height: GPUI rounds a line height to whole pixels when it
  // lays text out, so without the box every line would add up to half a pixel. (Wrapping text keeps GPUI's height,
  // as its line count is not known here.)
  const line = text.whitespace === "nowrap" ? lineHeightPx(text) : null;
  const row = node.style.display === "flex" && !String(node.style.flex_direction ?? "row").startsWith("col");
  let ranged = !node.range_name;
  for (const child of (node.children ?? []).filter(drawn)) {
    let built = toGpui(child, kit, handle, files, false, unseen, color, text, row && child.style?.position !== "absolute", snapped);
    const own = !ranged && (child.kind === "text" || !child.meta);
    if (own || (child.kind === "text" && line)) {
      let box = kit.div();
      if (own) box = box.id(node.range_name);
      if (child.kind === "text" && line) box = box.h(snapped.get(child)?.h ?? line);
      built = box.child(built);
      ranged ||= own;
    }
    el = el.child(built);
  }
  return el;
}

/** Whether `node` is the host element `id` or holds it. */
const holds = (node, id) => node.id === id || (node.children ?? []).some((child) => child.kind !== "text" && holds(child, id));

/** Whether `node` or a node under it draws an icon. */
const hasIcon = (node) => !!node.markup || (node.children ?? []).some((child) => child.kind !== "text" && hasIcon(child));

/** The CSS line height in logical px of text styled `text` (a multiplier or `"Npx"`), or null when not known. */
export function lineHeightPx(text) {
  const lh = text.line_height;
  if (typeof lh === "string" && lh.endsWith("px")) return Number.parseFloat(lh);
  if (typeof lh === "number" && typeof text.text_size === "number") return lh * text.text_size;
  return null;
}

/** The whole description: the screen, then its overlays (absolute) above it, outside the screen's clip. */
export function describeToGpui(description, kit, handle, files, scale = 0) {
  const snapped = scale > 0 ? snapColumns([description.root, ...description.overlays], scale) : new Map();
  let layer = kit.div().relative().size_full().child(toGpui(description.root, kit, handle, files, false, false, null, {}, false, snapped));
  for (const overlay of description.overlays) layer = layer.child(toGpui(overlay, kit, handle, files, true, false, null, {}, false, snapped));
  return layer;
}

// ---- device-pixel columns -------------------------------------------------------------------------------------

const TEXT_KEYS = ["text_size", "line_height", "whitespace", "text_ellipsis"];
/** A length in logical px: 0 when unset, NaN when it is not a plain length (a percentage, `auto`). */
const px = (v) => (v === undefined || v === null ? 0 : typeof v === "number" ? v : NaN);
const isColumn = (node) => (node.style.display === "flex" ? node.style.flex_direction === "col" : true);
const isRow = (node) => node.style.display === "flex" && (node.style.flex_direction ?? "row") === "row";
const inFlow = (child) => child.kind === "text" || (drawn(child) && child.style.position !== "absolute");

/**
 * Device-pixel lengths for the description's columns (`roots`: the screen and its overlays), as style overrides by
 * node (`pt`, `pb`, `border_t`, `border_b`, `mt`, `mb`, `gap_y`, `h`; for a text node, its line box's `h`).
 *
 * A node's exact CSS height is known when it follows from authored lengths: an explicit height, or vertical padding
 * and border around its content, where a column (or block) stacks its children with their margins and gap and a row
 * takes its tallest child; a line of text that cannot wrap is its line height. It is not known for wrapping text,
 * percentages, `auto` margins, a growing or `flex_basis` child, a wrapping or baseline row, reversed flows and a block
 * whose children have vertical margins (which CSS collapses). A column's children are placed in document order on a
 * running total; a child whose height is not known is left as GPUI lays it out, its own content gets a fresh total,
 * and the total restarts after it. A row's children sit side by side and keep GPUI's own rounding.
 */
export function snapColumns(roots, scale) {
  const out = new Map();
  // A length that is not a plain one (NaN) keeps its own value and restarts the total.
  const set = (node, values) => out.set(node, { ...out.get(node), ...Object.fromEntries(Object.entries(values).filter(([, v]) => Number.isFinite(v))) });
  const heights = new Map();
  const texts = new Map();

  /** The exact CSS height of `node` (NaN when not known), for text styled `text` around it. */
  function height(node, text) {
    if (node.kind === "text") return text.whitespace === "nowrap" ? (lineHeightPx(text) ?? NaN) : NaN;
    const own = { ...text };
    for (const key of TEXT_KEYS) if (node.style[key] !== undefined) own[key] = node.style[key];
    texts.set(node, own);
    const s = node.style;
    const kids = (node.children ?? []).filter(inFlow);
    const kidHeights = kids.map((kid) => height(kid, own));
    let h;
    if (s.h !== undefined && s.h !== "auto") h = px(s.h);
    else {
      const outer = kids.map((kid, i) => (kid.kind === "text" ? 0 : px(kid.style.mt) + px(kid.style.mb)) + kidHeights[i]);
      let content;
      if (isRow(node)) content = s.flex_wrap === "wrap" ? NaN : s.items === "baseline" ? baselineRow(kids, kidHeights, own) : Math.max(0, ...outer);
      else if (isColumn(node)) {
        const grows = kids.some((kid) => kid.kind !== "text" && (kid.style.flex_grow > 0 || kid.style.flex_basis !== undefined));
        const collapses = s.display !== "flex" && kids.some((kid) => kid.kind !== "text" && (px(kid.style.mt) || px(kid.style.mb)));
        content = grows || collapses ? NaN : outer.reduce((a, b) => a + b, 0) + (s.display === "flex" ? px(s.gap_y) * Math.max(0, kids.length - 1) : 0);
      } else content = NaN;
      h = content + px(s.pt) + px(s.pb) + px(s.border_t) + px(s.border_b);
      if (s.min_h !== undefined) h = Math.max(h, px(s.min_h));
      if (s.max_h !== undefined) h = Math.min(h, px(s.max_h));
    }
    heights.set(node, h);
    return h;
  }

  /** The first baseline of a line box of `text` below its top (half the leading, then the font's ascent). */
  const lineBaseline = (text) => (lineHeightPx(text) - (ASCENT + DESCENT) * text.text_size) / 2 + ASCENT * text.text_size;
  /** A row aligned on baselines: the deepest baseline plus the deepest part below one. Known when every item is a
   * single line of text (or a box holding only that, with its padding and border). */
  function baselineRow(kids, kidHeights, text) {
    let above = 0;
    let below = 0;
    for (const [i, kid] of kids.entries()) {
      const own = kid.kind === "text" ? text : texts.get(kid);
      const lines = kid.kind === "text" || (kid.children ?? []).filter(inFlow).every((c) => c.kind === "text");
      if (!lines || !Number.isFinite(kidHeights[i]) || typeof own.text_size !== "number") return NaN;
      const s = kid.kind === "text" ? {} : kid.style;
      const top = px(s.mt) + px(s.border_t) + px(s.pt) + lineBaseline(own);
      above = Math.max(above, top);
      below = Math.max(below, px(s.mt) + kidHeights[i] + px(s.mb) - top);
    }
    return above + below;
  }

  const fresh = () => ({ exact: 0, laid: 0 });
  /** The device-pixel length that keeps `flow`'s running total nearest its exact total after `length`. */
  const stack = (flow, length) => {
    if (!Number.isFinite(length)) {
      Object.assign(flow, fresh());
      return NaN;
    }
    flow.exact += length;
    const total = Math.round(flow.exact * scale + 1e-9) / scale;
    const step = total - flow.laid;
    flow.laid = total;
    return step;
  };

  /** `node`'s own content, not placed in a column: its children on a fresh total (a column) or each on its own. */
  function visit(node) {
    if (node.kind === "text" || !drawn(node)) return;
    for (const child of (node.children ?? []).filter((c) => c.kind !== "text" && drawn(c) && c.style.position === "absolute")) visit(child);
    if (isColumn(node) && !isRow(node)) {
      const flow = fresh();
      set(node, { border_t: stack(flow, px(node.style.border_t)), pt: stack(flow, px(node.style.pt)) });
      column(node, flow);
    } else for (const child of (node.children ?? []).filter(inFlow)) if (child.kind !== "text") visit(child);
  }

  /** `node`'s in-flow children, stacked on `flow` from its content top; false when they could not be (each child
   * then lays out its own content and `flow` has not moved). */
  function column(node, flow) {
    const kids = (node.children ?? []).filter(inFlow);
    const gap = node.style.display === "flex" ? px(node.style.gap_y) : 0;
    // A gap carried into the children's margins needs every child to be a box (a line of text has no margin).
    if (gap && kids.some((kid) => kid.kind === "text")) {
      for (const kid of kids) if (kid.kind !== "text") visit(kid);
      return false;
    }
    if (gap) set(node, { gap_y: 0 });
    kids.forEach((kid, i) => {
      if (kid.kind === "text") {
        const h = heights.get(kid) ?? height(kid, texts.get(node) ?? {});
        if (Number.isFinite(h)) set(kid, { h: stack(flow, h) });
        else Object.assign(flow, fresh());
        return;
      }
      set(kid, { mt: stack(flow, (i ? gap : 0) + px(kid.style.mt)) });
      if (Number.isFinite(heights.get(kid))) place(kid, flow);
      else {
        visit(kid);
        Object.assign(flow, fresh());
      }
      set(kid, { mb: stack(flow, px(kid.style.mb)) });
    });
    return true;
  }

  /** A node whose height is known, at `flow`'s running total: its lengths on the total, its height their sum. */
  function place(node, flow) {
    const s = node.style;
    for (const child of (node.children ?? []).filter((c) => c.kind !== "text" && drawn(c) && c.style.position === "absolute")) visit(child);
    const start = flow.laid;
    const exactStart = flow.exact;
    set(node, { border_t: stack(flow, px(s.border_t)), pt: stack(flow, px(s.pt)) });
    const explicit = s.h !== undefined && s.h !== "auto";
    const content = heights.get(node) - px(s.pt) - px(s.pb) - px(s.border_t) - px(s.border_b);
    if (isRow(node) || (explicit && (s.justify ?? "start") !== "start")) {
      for (const child of (node.children ?? []).filter(inFlow)) if (child.kind !== "text") visit(child);
      if (!explicit) stack(flow, content);
    } else if (!column(node, flow) && !explicit) stack(flow, content);
    if (explicit) {
      // The content inside an explicit height does not move its bottom.
      flow.exact = exactStart + heights.get(node);
      flow.laid = Math.round(flow.exact * scale + 1e-9) / scale;
      set(node, { h: flow.laid - start });
      return;
    }
    set(node, { pb: stack(flow, px(s.pb)), border_b: stack(flow, px(s.border_b)) });
    set(node, { h: flow.laid - start });
  }

  for (const root of roots) {
    height(root, {});
    visit(root);
  }
  return out;
}
