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
//! `kit` is `{ div, image }` from `gpui-kit`; `files.icon(id, markup, color)` gives the element that draws an icon's
//! markup (`currentColor` as `color`; the mod's `perch-react` `Icon`), as gpui-kit's `svg()` and `image()` read
//! files through an asset source the host may not have. An icon does not follow a hover colour (it is drawn once
//! per colour it is described with).

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
export function toGpui(node, kit, handle, files, overlay = false, unseen = false, color = null, text = {}, rowItem = false) {
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
  el = applyStyle(el, node.style);
  // CSS gives a flex item an automatic minimum width of its min-content width, which for text that can wrap is its
  // longest word, so the item shrinks and its text wraps; GPUI's minimum for text is the whole line. A shrinkable
  // row item holding wrappable text of its own therefore gets no minimum width.
  // ponytail: zero rather than the longest word (not measured here), so in a row too narrow for one word the item
  // can shrink further than on the web; measuring the longest word through the text system would close that.
  const wraps = text.whitespace !== "nowrap" && !text.text_ellipsis;
  if (rowItem && wraps && node.style.flex_shrink !== 0 && node.style.min_w === undefined && (node.children ?? []).some((c) => c.kind === "text")) el = el.min_w(0);
  for (const variant of ["hover", "focus", "active"]) if (node[variant]) el = el[variant]((s) => applyStyle(s, node[variant]));

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
    let built = toGpui(child, kit, handle, files, false, unseen, color, text, row && child.style?.position !== "absolute");
    const own = !ranged && (child.kind === "text" || !child.meta);
    if (own || (child.kind === "text" && line)) {
      let box = kit.div();
      if (own) box = box.id(node.range_name);
      if (child.kind === "text" && line) box = box.h(line);
      built = box.child(built);
      ranged ||= own;
    }
    el = el.child(built);
  }
  return el;
}

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
export function describeToGpui(description, kit, handle, files) {
  let layer = kit.div().relative().size_full().child(toGpui(description.root, kit, handle, files));
  for (const overlay of description.overlays) layer = layer.child(toGpui(overlay, kit, handle, files, true));
  return layer;
}
