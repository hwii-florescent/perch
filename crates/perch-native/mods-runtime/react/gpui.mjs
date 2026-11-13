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
//! `kit` is `{ div, svg, image }` from `gpui-kit`; `files.svg(markup)` gives an application path for an icon's
//! markup (`svg()` and `image()` take paths).

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

/** One node and its subtree as builder chains. */
export function toGpui(node, kit, handle, files, overlay = false) {
  if (node.kind === "text") return node.text;
  let el;
  if (node.kind === "svg") el = kit.svg(files.svg(node.markup));
  else if (node.kind === "image") el = kit.image(node.markup ? files.svg(node.markup) : node.src);
  else el = kit.div();
  el = applyStyle(el.id(node.id), node.style);
  for (const variant of ["hover", "focus", "active"]) if (node[variant]) el = el[variant]((s) => applyStyle(s, node[variant]));

  const events = new Set(node.events ?? []);
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
  if (node.track_hover) el = el.on_hover((on, cx) => { handle.hover(node.id, on); cx.notify(); });
  if (overlay) el = el.on_mouse_down_out((event, cx) => { handle.dispatch(handle.document.body.id, "pointerdown", { ...point(event), pointerType: "mouse" }); handle.dispatch(handle.document.body.id, "mousedown", point(event)); cx.notify(); });
  for (const child of node.children ?? []) el = el.child(toGpui(child, kit, handle, files));
  return el;
}

/** The whole description: the screen, then its overlays (absolute) above it, outside the screen's clip. */
export function describeToGpui(description, kit, handle, files) {
  let layer = kit.div().id("perch-react-layer").relative().size_full().child(toGpui(description.root, kit, handle, files));
  for (const overlay of description.overlays) layer = layer.child(toGpui(overlay, kit, handle, files, true));
  return layer;
}
