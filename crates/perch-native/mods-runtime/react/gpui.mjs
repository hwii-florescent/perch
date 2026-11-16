//! The description as GPUI elements: one gpui-kit builder chain per node, for a mod's `render()`. Every key the
//! description can carry has exactly one entry in `STYLE` (a key it does not know throws, so a new key cannot be
//! dropped silently), and the events a node asks for become the kit's handlers, which run the event through the
//! React tree (`handle.dispatch`) and ask for a new frame.
//!
//! Pointer events: the deepest node with a pointer handler takes a press (`cx.stop_propagation()`), and the DOM-shaped
//! event then bubbles through the React tree, so ancestors see it as on the web; its target is that node rather than
//! a plain child without handlers. A press also stores the node's box (`event.bounds`), which `getBoundingClientRect`
//! returns when the click that follows opens a menu under it. A press outside an overlay (its box and the absolute boxes
//! in it, a submenu past its edge) is a `pointerdown` on the
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
//! `kit` is `{ div, image }` from `gpui-kit`; `files.engine(engine, key)` gives the host's native element for an
//! engine slot (`perch-engine`); `files.icon(id, markup, color)` gives the element that draws an icon's
//! markup (`currentColor` as `color`; the mod's `perch-react` `Icon`), as gpui-kit's `svg()` and `image()` read
//! files through an asset source the host may not have. An icon is drawn once per colour it is described with; one
//! under a node whose own `hover:` changes the text colour is drawn twice, the hover copy shown by the engine while the
//! pointer is over that node (a hover group), so a hover never calls back into the script.

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

/** Nodes inside one that takes pointer events: a press on one is that node's, as the page's event target. */
const UNDER_POINTER = new WeakSet();
/** Nodes inside a scroll area: a scroll area among them takes the wheel itself (see `toGpui`). */
const IN_SCROLL = new WeakSet();

/** The node a press at `event` is on: the innermost node under `id` that recorded this press (`handle.pressed`),
 * else `id`. GPUI calls the innermost listener first, so the record is there when `id`'s listener runs. */
function pressTarget(handle, id, event) {
  const pressed = handle.pressed;
  const at = point(event);
  return pressed && pressed.x === at.clientX && pressed.y === at.clientY ? pressed.id : id;
}

/** The engine id of a node: its parity name, else (when the engine needs one, for events and interaction styles)
 * `~`, the host element's id and its `data-testid` if any, which tests that read named elements leave out. */
function engineId(node, events, overlay) {
  if (node.name) return node.name;
  if (!(events.size || node.hover || node.focus || node.active || (node.track_hover && layoutGroups.has(node.group)) || overlay)) return null;
  const testId = node.meta?.attrs["data-testid"];
  return testId ? `~${node.id}:${testId}` : `~${node.id}`;
}

/** Whether `node` holds text of its own, or text with a space in a column inside it, that the row it is in could
 * wrap. A single word in a column is the web's min-content width, so that item keeps it (a sidebar title). */
const holdsWrappingText = (node, nested = false) =>
  (node.children ?? []).some((c) =>
    c.kind === "text" ? !nested || /\s/.test(String(c.text ?? "").trim())
      : c.kind === "div" && c.style?.flex_direction !== "row" && c.style?.whitespace !== "nowrap" && holdsWrappingText(c, true));

/** A node the engine draws (display none is left out, so it is neither laid out nor recorded). */
const drawn = (child) => child.style?.display !== "hidden";

/** The hover groups some descendant shows or hides a box for (`group-hover:flex`): a change of layout, which GPUI
 * cannot draw from a hover inside the frame that finds it (the box would be painted without being laid out), so the
 * pointer over such a group is reported to the script, which describes the tree again. Every other group variant is
 * drawn by the engine alone. Set by `describeToGpui` for the tree it builds. */
let layoutGroups = new Set();
/** The overlay being built: its own box and every shown absolute box inside it, which may lie past its edge (a
 * submenu beside a menu). A press is outside the overlay only when it is outside all of them. */
let outside = null;
const LAYOUT_GROUPS = new WeakMap();
function groupsChangingLayout(node, out = new Set()) {
  let own = LAYOUT_GROUPS.get(node);
  if (!own) {
    own = new Set();
    for (const { group, style } of node.group_hover ?? []) if ("display" in style) own.add(group);
    for (const child of node.children ?? []) if (child.kind !== "text") for (const group of groupsChangingLayout(child)) own.add(group);
    LAYOUT_GROUPS.set(node, own);
  }
  for (const group of own) out.add(group);
  return out;
}

/** Retained subtrees, while the screen's tree is built (`describeToGpui`): `from`, what each node of the last build
 * became (its element's id in the view's live description and what it was built in, `key`); `clean`, the nodes whose
 * device-pixel overrides, theirs and their subtree's, are the last build's; `next`, the same for this build. */
let retain = null;

/** Everything around a node its elements are built from, besides the node (and its subtree) itself. */
const retainKey = (node, unseen, color, text, rowItem, hoverIcon, snapped) =>
  `${+unseen}|${color}|${text.text_size}|${text.line_height}|${text.whitespace}|${text.text_ellipsis}|${+rowItem}|${hoverIcon ? `${hoverIcon.group}|${hoverIcon.color}` : ""}|${+UNDER_POINTER.has(node)}|${+IN_SCROLL.has(node)}|${snapped.get(node)?.flex_basis ?? ""}`;

/** Whether `node` or a node under it is a scroll area, which keeps per-build state on the handle (`scrollIntoView`). */
const SCROLLERS = new WeakMap();
function holdsScroller(node) {
  let holds = SCROLLERS.get(node);
  if (holds === undefined) {
    holds = node.style.overflow_x === "scroll" || node.style.overflow_y === "scroll" || (node.children ?? []).some((c) => c.kind !== "text" && holdsScroller(c));
    SCROLLERS.set(node, holds);
  }
  return holds;
}

/** Adds to `clean` every node under `node` whose overrides in `now`, and its subtree's, are those in `before`; says
 * whether `node`'s are. */
function cleanSubtrees(node, now, before, clean) {
  let ok = sameValues(now.get(node), before.get(node));
  if (node.kind === "text") return ok;
  for (const child of node.children ?? []) if (!cleanSubtrees(child, now, before, clean)) ok = false;
  if (ok) clean.add(node);
  return ok;
}
function sameValues(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/** One node and its subtree as builder chains. `unseen`: an ancestor is invisible or fully transparent, so its
 * named elements are not shown (the page counts them hidden) and carry no name.
 *
 * A node of the screen's tree that is the last build's own node, in the same surroundings and with the same overrides
 * under it, is the last build's element (`kit.reuse`): the engine copies it, handlers included, from the view's live
 * description, and nothing under it is built again. The handlers it keeps read only that node, which is unchanged. */
export function toGpui(node, kit, handle, files, overlay = false, unseen = false, color = null, text = {}, rowItem = false, snapped = new Map(), hoverIcon = null) {
  if (node.kind === "text") return snapped.get(node)?.text ?? node.text;
  const key = retain && !overlay && !holdsScroller(node) ? retainKey(node, unseen, color, text, rowItem, hoverIcon, snapped) : null;
  if (key !== null && retain.clean.has(node)) {
    const was = retain.from.get(node);
    const kept = was?.key === key ? kit.reuse(was.id, retain.generation) : null;
    if (kept) {
      retain.next.set(node, { id: kept.__id, key });
      return kept;
    }
  }
  const built = buildGpui(node, kit, handle, files, overlay, unseen, color, text, rowItem, snapped, hoverIcon);
  if (key !== null) retain.next.set(node, { id: built.__id, key });
  return built;
}

function buildGpui(node, kit, handle, files, overlay, unseen, color, text, rowItem, snapped, hoverIcon) {
  const underPointer = UNDER_POINTER.has(node);
  unseen ||= node.style.opacity === 0 || node.style.visibility === "invisible" || node.style.display === "hidden";
  if (unseen && (node.name || node.range_name)) node = { ...node, name: undefined, range_name: undefined, also: undefined };
  // A colour of its own ends the hover colour of the node around it.
  if (node.style.text_color !== undefined) hoverIcon = null;
  color = node.style.text_color ?? color;
  // An icon takes the colour of its text, hover included: under a node whose own `hover:` changes the text colour, it
  // is also drawn in that colour, shown while the pointer is over the node (the node is a hover group for it).
  const hoverIcons = !!node.hover?.text_color && hasIcon(node);
  const group = node.group ?? (hoverIcons ? `~g${node.id}` : null);
  if (hoverIcons) hoverIcon = { group, color: node.hover.text_color };
  text = { ...text };
  for (const key of ["text_size", "line_height", "whitespace", "text_ellipsis"]) if (node.style[key] !== undefined) text[key] = node.style[key];
  const events = new Set(node.events ?? []);
  const region = overlay ? { count: 0, hits: new Set(), at: null } : !unseen && !node.pointer_none && node.style.position === "absolute" ? outside : null;
  const regionIndex = region ? region.count++ : -1;
  if (overlay) outside = region;
  let el;
  if (node.kind === "image" && !node.markup) el = kit.image(node.src);
  else el = kit.div();
  // An engine slot holds the host's element for its key, filling the box.
  if (node.kind === "engine") el = el.child(files.engine ? files.engine(node.engine, node.key) : kit.div());
  // An icon is a box with the icon drawn in it (`svg`: in the colour its text would have, `image`: as drawn).
  if (node.markup && node.kind === "svg" && hoverIcon && hoverIcon.color !== color) {
    // Both copies are laid out on the icon's box; the hover only changes which one is painted.
    const { group: over, color: hovered } = hoverIcon;
    const layer = () => kit.div().absolute().top(0).left(0).size_full();
    el = el
      .child(layer().group_hover(over, (s) => s.invisible()).child(files.icon(`~icon-${node.id}`, node.markup, color)))
      .child(layer().invisible().group_hover(over, (s) => s.visible()).child(files.icon(`~icon-${node.id}-hover`, node.markup, hovered)));
  } else if (node.markup) el = el.child(files.icon(`~icon-${node.id}`, node.markup, node.kind === "svg" ? color : ""));
  const id = engineId(node, events, !!region);
  if (id) el = el.id(id);
  // Its laid-out box is kept for the source, which measured it (`HostDocument.measure`).
  if (node.measure) el = el.measure(node.measure);
  // More parity names for the same element (two of the page's selectors find it).
  if (node.name && el.also_named) for (const name of node.also ?? []) el = el.also_named(name);
  el = applyStyle(el, { ...node.style, ...snapped.get(node) });
  // CSS gives a flex item an automatic minimum width of its min-content width, which for text that can wrap is its
  // longest word, so the item shrinks and its text wraps; GPUI's minimum for text is the whole line. A shrinkable
  // row item holding wrappable text, its own or in the columns inside it (a heading over a line), therefore gets no
  // minimum width.
  // ponytail: zero rather than the longest word (not measured here), so in a row too narrow for one word the item
  // can shrink further than on the web; measuring the longest word through the text system would close that.
  const wraps = text.whitespace !== "nowrap" && !text.text_ellipsis;
  if (rowItem && wraps && node.style.flex_shrink !== 0 && node.style.min_w === undefined && holdsWrappingText(node)) el = el.min_w(0);
  for (const variant of ["hover", "focus", "active"]) if (node[variant]) el = el[variant]((s) => applyStyle(s, node[variant]));
  // Hover groups, drawn by the engine from its hitboxes: no script runs when the pointer moves.
  if (group) el = el.group(group);
  for (const { group: over, style } of node.group_hover ?? []) {
    const { display: _layout, ...drawnStyle } = style;
    if (Object.keys(drawnStyle).length) el = el.group_hover(over, (s) => applyStyle(s, drawnStyle));
  }
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
    // Before any area asks, the first one drawn takes the handle, so its children's boxes are known.
    handle.scroller ??= node.id;
    if (handle.scroller === node.id && handle.document) {
      el = el.track_scroll(kit.scroll);
      // Where the engine laid its children out, for `getBoundingClientRect` (a menu anchored to one, opened by a key).
      const ids = (node.children ?? []).filter(drawn).map((child) => child.id);
      handle.document.itemBounds = (id) => (ids.includes(id) ? kit.scroll.item_bounds?.(ids.indexOf(id)) ?? null : null);
    }
  }

  // GPUI hands a wheel step to every scroll area under the pointer, so a list in a scrolling dialog would move the
  // dialog as well; the list takes the step alone.
  // ponytail: at the end of the inner area the step does not pass on to the outer one, as a browser's does; reading
  // the inner area's extent would allow that.
  const scroller = node.style.overflow_x === "scroll" || node.style.overflow_y === "scroll";
  // A box over the page takes the wheel as it takes the pointer: nothing behind a dialog's backdrop or a toast card
  // scrolls (GPUI hands a step to every scroll area under the pointer, covered or not).
  const covers = (overlay && !node.pointer_none) || node.blocks_pointer;
  if ((scroller && IN_SCROLL.has(node)) || covers) el = el.on_scroll_wheel((_event, cx) => cx.stop_propagation?.());
  // `onScroll`: a wheel step over a scroll area that listens is its `scroll` event. The boxes the listener reads
  // (`getBoundingClientRect`) are the last frame's, so they show the area one step behind.
  if (scroller && events.has("scroll")) el = el.on_scroll_wheel((_event, cx) => { handle.dispatch(node.id, "scroll", {}); cx.notify(); });
  if (scroller || IN_SCROLL.has(node)) for (const child of node.children ?? []) if (child.kind !== "text") IN_SCROLL.add(child);

  // A press on a text field puts the keyboard in it, as a browser does, and keeps its box (a list anchored to it).
  if (node.kind === "input" && !node.disabled) {
    el = el.on_mouse_down("left", (event, cx) => {
      if (event.bounds) handle.setBounds(node.id, event.bounds);
      handle.focus(node.id);
      cx.notify();
    });
  }
  // A click on a check box or radio button ticks it, as a browser does, and so does a click on the label around one.
  const box = node.kind === "input" ? node : node.meta?.tag === "label" ? tickBox(node) : null;
  if (box && !box.disabled && /^(checkbox|radio)$/.test(box.input_type)) el = el.on_click((_event, cx) => { cx.stop_propagation?.(); handle.toggle(box.id); cx.notify(); });
  const pointer = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((name) => events.has(name));
  if (pointer || underPointer) for (const child of node.children ?? []) if (child.kind !== "text") UNDER_POINTER.add(child);
  if (pointer) {
    el = el.on_mouse_down("left", (event, cx) => {
      cx.stop_propagation?.();
      if (event.bounds) handle.setBounds(node.id, event.bounds);
      const at = { ...point(event), button: 0, buttons: 1, detail: event.click_count };
      const target = pressTarget(handle, node.id, event);
      handle.pressed = null;
      handle.dispatch(target, "pointerdown", { ...at, pointerType: "mouse" });
      if (handle.dispatch(target, "mousedown", at)) handle.pressFocus?.(target);
      cx.notify();
    });
    el = el.on_mouse_down("right", (event, cx) => {
      cx.stop_propagation?.();
      if (event.bounds) handle.setBounds(node.id, event.bounds);
      const target = pressTarget(handle, node.id, event);
      handle.pressed = null;
      handle.dispatch(target, "contextmenu", { ...point(event), button: 2 });
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
  // A press on an element that takes pointer events in a stack that lets them through stops here, as on the web;
  // anywhere else in that stack it reaches what is beneath the screen.
  if (node.blocks_pointer && !pointer) {
    for (const button of ["left", "right"]) el = el.on_mouse_down(button, (_event, cx) => cx.stop_propagation?.());
  } else if (underPointer && !pointer) {
    // The innermost node under the press records it for the listener above (`pressTarget`).
    for (const button of ["left", "right"]) {
      el = el.on_mouse_down(button, (event) => {
        const at = point(event);
        if (handle.pressed?.x !== at.clientX || handle.pressed?.y !== at.clientY) handle.pressed = { id: node.id, x: at.clientX, y: at.clientY };
      });
    }
  }
  // A move redraws only when the source changed something (a commit asks for its own frame): a listener that only
  // reads the pointer (a long press measuring how far it moved) costs no new description.
  if (events.has("mouse_move")) el = el.on_mouse_move((event) => { handle.dispatch(node.id, "pointermove", { ...point(event), pointerType: "mouse" }); });
  if (node.track_hover && layoutGroups.has(node.group)) el = el.on_hover((on, cx) => { handle.hover(node.id, on); cx.notify(); });
  // GPUI calls each box's handler for a press outside that box; the press is the document's once every box of the
  // overlay has called it for the same point.
  if (region) {
    el = el.on_mouse_down_out((event, cx) => {
      const at = point(event);
      const where = `${at.clientX},${at.clientY}`;
      if (region.at !== where) { region.at = where; region.hits = new Set(); }
      region.hits.add(regionIndex);
      if (region.hits.size < region.count) return;
      region.at = null;
      handle.dispatch(handle.document.body.id, "pointerdown", { ...at, pointerType: "mouse" });
      handle.dispatch(handle.document.body.id, "mousedown", at);
      cx.notify();
    });
  }
  // A name for the element's own text (a bare text node in the page) goes on a box around that text. A line of
  // text that cannot wrap sits in a box of the CSS line height: GPUI rounds a line height to whole pixels when it
  // lays text out, so without the box every line would add up to half a pixel. (Wrapping text keeps GPUI's height,
  // as its line count is not known here.)
  // A text field shows what it holds on one line, or its placeholder (the app's: its text colour at half strength).
  if (node.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(node.input_type)) {
    const shown = node.value ? String(node.value) : String(node.placeholder ?? "");
    let line = kit.div().whitespace_nowrap().overflow_x_hidden();
    const lineHeight = lineHeightPx(text);
    if (lineHeight) line = line.h(lineHeight);
    if (!node.value && color) line = line.text_color(halfAlpha(color));
    if (shown) el = el.child(line.child(node.input_type === "password" && node.value ? "•".repeat([...shown].length) : shown));
    // Its width when its content sizes it (`field_w`), as an empty line: a stretched or narrower field is unaffected.
    if (node.field_w) el = el.child(kit.div().w(node.field_w).h(0));
  }
  const line = text.whitespace === "nowrap" ? lineHeightPx(text) : null;
  const row = node.style.display === "flex" && !String(node.style.flex_direction ?? "row").startsWith("col");
  let ranged = !node.range_name;
  // A column with a maximum height and none of its own (a palette that grows with its list up to a limit) is as tall
  // as its children's content, and a growing child with a zero or percentage basis (`flex-1`) shares out what the
  // limit leaves; GPUI would size the column from the zero basis, so such a child keeps its content size as its basis.
  // (A column stretched by its parent has a definite height, where the zero basis is right.)
  const indefinite = node.style.display === "flex" && String(node.style.flex_direction ?? "row").startsWith("col") && (node.style.h === undefined || node.style.h === "auto") && typeof node.style.max_h === "number";
  for (const child of (node.children ?? []).filter(drawn)) {
    const basis = child.style?.flex_basis;
    if (indefinite && child.style.flex_grow > 0 && (basis === 0 || (typeof basis === "string" && basis.endsWith("%")))) snapped.set(child, { ...snapped.get(child), flex_basis: "auto" });
    let built = toGpui(child, kit, handle, files, false, unseen, color, text, row && child.style?.position !== "absolute", snapped, hoverIcon);
    const own = !ranged && (child.kind === "text" || !child.meta);
    const lineBox = child.kind === "text" ? (snapped.get(child)?.h ?? line) : null;
    // A line laid on the row's device pixels (`snapRows`) has the width it was given and does not wrap in it.
    const lineWidth = child.kind === "text" ? snapped.get(child)?.w : undefined;
    if (own || lineBox || lineWidth !== undefined) {
      let box = kit.div();
      if (own) box = box.id(node.range_name);
      // A named run in a flex column is as wide as its glyphs, as the page's text range is, where its alignment puts
      // it (the anonymous box around it stretches; the range does not).
      if (own && !row && node.style.display === "flex") box = box[`self_${COLUMN_PLACE[text.text_align] ?? "start"}`]().max_w("100%");
      if (lineBox) box = box.h(lineBox);
      if (lineWidth !== undefined) box = box.w(lineWidth).flex_none().whitespace_nowrap();
      built = box.child(built);
      ranged ||= own;
    }
    el = el.child(built);
  }
  return el;
}

/** Where a text alignment puts a run across a column. */
const COLUMN_PLACE = { center: "center", right: "end", end: "end" };

/** `#rrggbb(aa)` at half its alpha. */
function halfAlpha(color) {
  const hex = String(color);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return color;
  const alpha = hex.length === 9 ? Number.parseInt(hex.slice(7), 16) : 255;
  return `${hex.slice(0, 7)}${Math.round(alpha / 2).toString(16).padStart(2, "0")}`;
}

/** Text with no place a line may break: one word of ASCII letters, digits and punctuation other than a hyphen, or a
 * single character (a mark such as ✓). */
const UNBREAKABLE = /^(?:[!-,.-~]+|\S)$/u;

/** The first check box or radio button under a label. */
const tickBox = (node) => {
  for (const child of node.children ?? []) {
    if (child.kind === "input" && /^(checkbox|radio)$/.test(child.input_type)) return child;
    const found = child.kind === "text" ? null : tickBox(child);
    if (found) return found;
  }
  return null;
};

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

/**
 * The whole description: the screen, then its overlays (absolute) above it, outside the screen's clip. A screen in a
 * region of the window (`windowLayer`) puts its overlays in a layer over the whole window, so that what it portals
 * (a dialog's backdrop, a popover placed from `getBoundingClientRect`) is laid out against the window as `fixed` is.
 */
export function describeToGpui(description, kit, handle, files, scale = 0, windowLayer = false) {
  const roots = [description.root, ...description.overlays];
  layoutGroups = new Set();
  outside = null;
  for (const root of roots) groupsChangingLayout(root, layoutGroups);
  const snapped = scale > 0 ? snapColumns(roots, scale) : new Map();
  if (scale > 0 && files.measure) snapRows(roots, scale, files.measure, snapped);
  scrollGutters(roots, snapped);
  shrinkWrapBases(roots, snapped);
  if (files.measure) breakLines(roots, files.measure, snapped);
  // The ids of the last build are those of the view's live description while its generation is the one they were
  // built in (a build that failed published nothing, and `reuse` refuses them).
  const keep = kit.reuse && kit.renderGeneration ? (handle.retained ??= { built: new Map(), overrides: new Map(), generation: -1 }) : null;
  const before = new Map(snapped);
  if (keep && description.root) {
    retain = { from: keep.built, generation: keep.generation, clean: new Set(), next: new Map() };
    cleanSubtrees(description.root, snapped, keep.overrides, retain.clean);
  }
  let layer;
  try {
    layer = kit.div().relative().size_full().child(toGpui(description.root, kit, handle, files, false, false, null, {}, false, snapped));
    if (keep) Object.assign(keep, { built: retain?.next ?? new Map(), overrides: before, generation: kit.renderGeneration() ?? -1 });
  } finally {
    retain = null;
  }
  let over = windowLayer && description.overlays.length ? kit.div().relative().size_full().window_layer() : layer;
  for (const overlay of description.overlays) over = over.child(toGpui(overlay, kit, handle, files, true, false, null, {}, false, snapped));
  return over === layer ? layer : layer.child(over);
}

// ---- device-pixel rows -----------------------------------------------------------------------------------------

/**
 * Device-pixel widths along rows, as `snapColumns` does for heights: GPUI rounds every authored length to a device
 * pixel and a text's width up to a whole pixel, so a row of chips (each `px-[0.55rem]` around a word) drifts from the
 * page by up to a pixel an item. An item's exact CSS width is known when it is content-sized and follows from text
 * that cannot wrap (`measure(text, font)`, its exact width) and authored lengths: a row sums its items with their
 * margins and gap, a block or column takes its widest child, inside padding and border; an explicit width is itself.
 * A row (`flex`, `row`, not wrapping, packed at its start) lays its padding, its items' margins and gap and its items'
 * widths on a running total, each the device-pixel value that keeps the total nearest the exact one; an item whose
 * width is not known (it grows, shrinks to fit, has an `auto` margin, holds wrapping or truncated text) keeps GPUI's
 * layout and the total restarts after it. Results go into `overrides` (`pl`, `pr`, `ml`, `mr`, `gap_x`, `w`; a text
 * line's `w`).
 */
export function snapRows(roots, scale, measure, overrides) {
  // As in `snapColumns`: a subtree's widths and overrides depend only on it and the font around it, kept across
  // builds while the scale and the text measure are the same.
  if (rowMemo.scale !== scale || rowMemo.measure !== measure) rowMemo = { scale, measure, widths: new WeakMap(), fonts: new WeakMap(), keys: new WeakMap(), visits: new WeakMap() };
  const { widths, fonts, keys, visits } = rowMemo;
  const journal = [];
  const merge = (node, values) => overrides.set(node, { ...overrides.get(node), ...values });
  const set = (node, values) => {
    journal.push(node, values);
    merge(node, values);
  };
  const FONT_KEYS = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];

  /** The exact CSS width of `node` when its content sizes it (NaN when not known), in font `font` around it. */
  function width(node, font, tabular) {
    if (node.kind === "text") {
      const one = font.whitespace === "nowrap" || UNBREAKABLE.test(node.text);
      if (!one || font.text_ellipsis || tabular || typeof font.text_size !== "number") return NaN;
      const w = measure(node.text, { size: font.text_size, weight: font.font_weight ?? 400, family: font.font_family ?? ".SystemUIFont", italic: !!font.italic });
      return Number.isFinite(w) ? w : NaN;
    }
    if (!drawn(node) || node.kind === "input" || node.kind === "engine" || node.markup) return explicitWidth(node);
    const key = `${font.text_size}|${font.font_weight}|${font.font_family}|${font.italic}|${font.whitespace}|${font.text_ellipsis}|${+tabular}`;
    if (keys.get(node) === key && widths.has(node)) return widths.get(node);
    keys.set(node, key);
    const own = { ...font };
    for (const k of FONT_KEYS) if (node.style[k] !== undefined) own[k] = node.style[k];
    // `text-overflow` is not inherited: an ellipsis cuts the text of the box that asks for it, not the text of the
    // boxes inside it (a path's crumbs, each a button, in a line that ends in an ellipsis).
    own.text_ellipsis = !!node.style.text_ellipsis;
    fonts.set(node, own);
    const s = node.style;
    const kids = (node.children ?? []).filter(inFlow);
    const kidWidths = kids.map((kid) => width(kid, own, tabular || !!node.tabular));
    let w = explicitWidth(node);
    if (!Number.isFinite(w) && s.w === undefined) {
      const outer = kids.map((kid, i) => kidWidths[i] + (kid.kind === "text" ? 0 : px(kid.style.ml) + px(kid.style.mr)));
      let content;
      if (!kids.length) content = 0;
      else if (isRow(node)) content = kids.some((kid) => kid.kind !== "text" && kid.style.flex_grow > 0) || s.flex_wrap === "wrap" ? NaN : outer.reduce((a, b) => a + b, 0) + px(s.gap_x) * (kids.length - 1);
      else content = Math.max(...outer);
      w = content + px(s.pl) + px(s.pr) + px(s.border_l) + px(s.border_r);
      if (typeof s.min_w === "number") w = Math.max(w, s.min_w);
      if (typeof s.max_w === "number") w = Math.min(w, s.max_w);
    }
    widths.set(node, w);
    return w;
  }
  const explicitWidth = (node) => (typeof node.style?.w === "number" ? node.style.w : NaN);

  const fresh = () => ({ exact: 0, laid: 0 });
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
  const isPackedRow = (node) => isRow(node) && node.style.flex_wrap !== "wrap" && (node.style.justify ?? "start") === "start";

  /** Lays `node`'s row out on device pixels, then every row under it. */
  function visit(node) {
    if (!node || node.kind === "text" || !drawn(node)) return;
    const key = keys.get(node);
    const kept = visits.get(node);
    if (kept && key !== undefined && kept.key === key) {
      for (let i = 0; i < kept.log.length; i += 2) {
        journal.push(kept.log[i], kept.log[i + 1]);
        merge(kept.log[i], kept.log[i + 1]);
      }
      return;
    }
    const start = journal.length;
    const kids = (node.children ?? []).filter(inFlow);
    if (isPackedRow(node) && kids.length > 1) {
      const gap = px(node.style.gap_x);
      const flow = fresh();
      // A gap goes into the items' margins, which a line of text has not: such a row keeps GPUI's gap.
      // Nor into an `auto` margin, which is not a length: the gap would be lost when the margin has no room.
      const carry = !(gap && kids.some((kid) => kid.kind === "text" || !Number.isFinite(px(kid.style.ml))));
      set(node, { border_l: stack(flow, px(node.style.border_l)), pl: stack(flow, px(node.style.pl)) });
      if (carry && gap) set(node, { gap_x: 0 });
      kids.forEach((kid, i) => {
        const before = (i && carry ? gap : 0) + (kid.kind === "text" ? 0 : px(kid.style.ml));
        if (kid.kind === "text") {
          if (before) Object.assign(flow, fresh());
        } else {
          const ml = stack(flow, before);
          if (Number.isFinite(ml)) set(kid, { ml });
        }
        // An item that grows, or shrinks with its content cut (overflow), fills what is left: its width is the row's.
        const own = kid.kind === "text" ? fonts.get(node) ?? {} : null;
        const w = kid.kind === "text" ? width(kid, own, !!node.tabular) : widths.get(kid);
        const fixed = kid.kind === "text" || !(kid.style.flex_grow > 0);
        if (fixed && Number.isFinite(w)) {
          const step = { w: stack(flow, w) };
          // A box sized by its own single-line text is that text's width rounded to a device pixel, which can be a
          // hair under what GPUI lays the text out in (it rounds a line's width up to a whole logical pixel): the
          // text would break a letter onto a second line, and a squeezed row would shrink the box below its text.
          // CSS gives such an item its content as its minimum, so it neither wraps nor shrinks.
          if (kid.kind !== "text" && typeof kid.style.w !== "number" && kid.style.min_w === undefined) {
            step.whitespace = "nowrap";
            step.flex_shrink = 0;
          }
          set(kid, step);
        } else Object.assign(flow, fresh());
        if (kid.kind !== "text") {
          const mr = stack(flow, px(kid.style.mr));
          if (Number.isFinite(mr)) set(kid, { mr });
        }
      });
    }
    for (const kid of node.children ?? []) if (kid.kind !== "text") visit(kid);
    if (key !== undefined) visits.set(node, { key, log: journal.slice(start) });
  }

  for (const root of roots) {
    if (!root) continue;
    width(root, {}, false);
    visit(root);
  }
}
/** `snapRows`' results by node, kept while the scale and the measure are the same. */
let rowMemo = { scale: 0, measure: null };

// ---- line breaks ----------------------------------------------------------------------------------------------

/** Where a line may break inside a run of text: after spaces, and after a hyphen between letters or digits. */
const BREAK_AFTER = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;

/**
 * The lines of text a browser lays out where a word too long for its line is broken anywhere (`break_anywhere`):
 * GPUI breaks such a word where the word starts and around punctuation a browser keeps together (a `/` in a path),
 * so where the box's content width is known the translator breaks the lines itself, as CSS does (at spaces and after
 * a hyphen inside a word, filling each line; a word longer than a line broken at the last character that fits), and
 * the text node's override `text` holds them, one per line, and the box is as tall as those lines in CSS. The width is known from authored widths down the tree:
 * a box's own number, or the content width of the column it is stretched across.
 */
export function breakLines(roots, measure, overrides) {
  const FONT_KEYS = ["text_size", "font_weight", "font_family", "italic", "line_height"];
  const n = (v) => (typeof v === "number" ? v : 0);
  const stretched = (node, parent) =>
    parent && isColumn(parent) && !isRow(parent) && node.style.position !== "absolute" && !["start", "center", "end"].includes(node.style.self) && !["start", "center", "end"].includes(parent.style.items);
  if (breakMemo.measure !== measure) breakMemo = { measure, walks: new WeakMap() };
  const journal = [];
  const put = (node, values) => {
    journal.push(node, values);
    overrides.set(node, { ...overrides.get(node), ...values });
  };
  // A subtree's lines depend only on it, the room it has and the font around it (kept while the measure is the same).
  const walk = (node, parent, room, font) => {
    if (!node || node.kind === "text" || !drawn(node)) return;
    const key = `${room}|${+stretched(node, parent)}|${font.text_size}|${font.font_weight}|${font.font_family}|${font.italic}|${font.line_height}`;
    const kept = breakMemo.walks.get(node);
    if (kept?.key === key) {
      for (let i = 0; i < kept.log.length; i += 2) put(kept.log[i], kept.log[i + 1]);
      return;
    }
    const start = journal.length;
    walkOnce(node, parent, room, font);
    breakMemo.walks.set(node, { key, log: journal.slice(start) });
  };
  const walkOnce = (node, parent, room, font) => {
    const s = node.style;
    let own = typeof s.w === "number" ? s.w : s.w === "100%" ? room : stretched(node, parent) ? room - n(s.ml) - n(s.mr) : NaN;
    if (typeof s.max_w === "number") own = Math.min(own, s.max_w);
    const content = own - n(s.pl) - n(s.pr) - n(s.border_l) - n(s.border_r);
    const mine = { ...font };
    for (const key of FONT_KEYS) if (s[key] !== undefined) mine[key] = s[key];
    const kids = node.children ?? [];
    if (node.break_anywhere && Number.isFinite(content) && content > 0 && typeof mine.text_size === "number" && kids.length && kids.every((kid) => kid.kind === "text")) {
      const style = { size: mine.text_size, weight: mine.font_weight ?? 400, family: mine.font_family ?? ".SystemUIFont", italic: !!mine.italic };
      const fits = (line) => measure(line.trimEnd(), style) <= content + 0.01;
      let count = 0;
      for (const kid of kids) {
        const lines = [];
        for (const paragraph of kid.text.split("\n")) {
          let line = "";
          for (const word of paragraph.split(BREAK_AFTER)) {
            if (fits(line + word)) { line += word; continue; }
            if (line) lines.push(line.trimEnd());
            line = "";
            for (const ch of word) {
              if (line && !fits(line + ch)) { lines.push(line); line = ""; }
              line += ch;
            }
          }
          lines.push(line.trimEnd());
        }
        const text = lines.join("\n");
        // A measure that fails (NaN) fits nothing: the text is left to GPUI.
        if (!lines.every((line) => !line || fits(line))) count = NaN;
        else if (text !== kid.text) put(kid, { text });
        count += lines.length;
      }
      // GPUI rounds the line height it lays text out with; the box keeps the CSS height of its lines.
      const line = lineHeightPx(mine);
      if (Number.isFinite(count) && line && s.h === undefined && kids.length === 1) {
        put(node, { h: count * line + n(s.pt) + n(s.pb) + n(s.border_t) + n(s.border_b) });
      }
    }
    for (const kid of kids) walk(kid, node, isRow(node) ? NaN : content, mine);
  };
  for (const root of roots) walk(root, null, NaN, {});
}

/** `breakLines`' results by node, kept while the measure is the same. */
let breakMemo = { measure: null };

// ---- shrink-to-fit ----------------------------------------------------------------------------------------------

/**
 * A box placed absolutely with no width is as wide as its content (CSS's shrink-to-fit), and a browser sizes a row
 * in it from its items' content even when they grow from a zero or percentage basis (`flex-1`); GPUI sizes it from
 * that basis, so such an item keeps its content size as its basis there. The row then has exactly its items' room,
 * and the item gets the same width either way. ponytail: a row clamped narrower (a `max-width`) shrinks every item
 * by its basis, where CSS would take the room from the growing item first.
 */
export function shrinkWrapBases(roots, overrides) {
  const walk = (node, wraps) => {
    if (!node || node.kind === "text" || !drawn(node)) return;
    const s = node.style;
    const own = s.position === "absolute" ? s.w === undefined && (s.left === undefined || s.right === undefined) : wraps && typeof s.w !== "number";
    if (own && isRow(node)) {
      for (const kid of node.children ?? []) {
        const basis = kid.kind === "text" ? undefined : kid.style.flex_basis;
        if (kid.kind !== "text" && kid.style.flex_grow > 0 && (basis === 0 || (typeof basis === "string" && basis.endsWith("%")))) overrides.set(kid, { ...overrides.get(kid), flex_basis: "auto" });
      }
    }
    for (const kid of node.children ?? []) walk(kid, own);
  };
  for (const root of roots) walk(root, false);
}

// ---- scrollbars ----------------------------------------------------------------------------------------------

/**
 * Room for the app's scrollbar in a vertical scroller whose content overflows (`node.scrollbar`, its width): the web
 * lays the content out beside the bar, so it is narrower by that much; the engine's bar takes no room. Whether the
 * content overflows is worked out from the CSS heights `snapColumns` knows: at least the scroller's content (a part
 * whose height is not known, wrapping text, counts as what is known of it) against the height it can have (its own
 * height or maximum, else what a column with a maximum or height leaves it beside its other children). When the room
 * is not known, or the content may fit, the scroller is left alone. The room goes into its right padding, in
 * `overrides` (the per-node styles `snapColumns` returned).
 */
export function scrollGutters(roots, overrides) {
  const heights = overrides.heights ?? new Map();
  const known = (node) => heights.get(node);
  /** At least how high `node` is: its known height, else what its known parts add up to (a wrapping text, whose
   * height is not known, counts as nothing). A lower bound is enough to tell that content overflows. */
  const least = (node) => {
    const h = known(node);
    if (Number.isFinite(h)) return h;
    if (node.kind === "text" || !drawn(node)) return 0;
    const s = node.style;
    const own = typeof s.min_h === "number" ? s.min_h : 0;
    const kids = (node.children ?? []).filter(inFlow);
    const outer = kids.map((kid) => least(kid) + (kid.kind === "text" ? 0 : Math.max(0, px(kid.style.mt) || 0) + Math.max(0, px(kid.style.mb) || 0)));
    const inner = !kids.length ? 0 : isRow(node) ? Math.max(...outer) : outer.reduce((a, b) => a + b, 0) + (s.display === "flex" ? (px(s.gap_y) || 0) * (kids.length - 1) : 0);
    const edges = [s.pt, s.pb, s.border_t, s.border_b].reduce((a, v) => a + (px(v) || 0), 0);
    return Math.max(own, inner + edges);
  };
  /** At least how high `node`'s content and padding are, unclamped. */
  const contentOf = (node) => {
    const kids = (node.children ?? []).filter(inFlow);
    if (!kids.length || isRow(node)) return NaN;
    return least({ ...node, style: { ...node.style, h: undefined, max_h: undefined, min_h: undefined } });
  };
  /** The height `node` may have, from its own lengths or its column parent's. */
  const roomOf = (node, parent) => {
    const s = node.style;
    if (typeof s.h === "number") return s.h;
    if (typeof s.max_h === "number") return s.max_h;
    if (!parent || !isColumn(parent) || isRow(parent)) return NaN;
    const ps = parent.style;
    const limit = typeof ps.h === "number" ? ps.h : typeof ps.max_h === "number" ? ps.max_h : NaN;
    const siblings = (parent.children ?? []).filter(inFlow);
    let others = 0;
    for (const sibling of siblings) {
      if (sibling === node) continue;
      const h = known(sibling);
      if (!Number.isFinite(h)) return NaN;
      others += h + (sibling.kind === "text" ? 0 : px(sibling.style.mt) + px(sibling.style.mb));
    }
    const gaps = ps.display === "flex" ? px(ps.gap_y) * Math.max(0, siblings.length - 1) : 0;
    return limit - px(ps.pt) - px(ps.pb) - px(ps.border_t) - px(ps.border_b) - others - gaps - px(s.mt) - px(s.mb);
  };
  const walk = (node, parent) => {
    if (!node || node.kind === "text" || !drawn(node)) return;
    if (node.scrollbar > 0 && node.style.overflow_y === "scroll") {
      const content = contentOf(node);
      const room = roomOf(node, parent);
      if (Number.isFinite(content) && Number.isFinite(room) && content > room + 0.01) {
        overrides.set(node, { ...overrides.get(node), pr: px(node.style.pr) + node.scrollbar });
      }
    }
    for (const child of node.children ?? []) walk(child, node);
  };
  for (const root of roots) walk(root, null);
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
  // What a subtree yields depends only on the subtree (description nodes are never changed) and what is around it:
  // its inherited text for its height, and for its placing the running total's distance from its last device pixel.
  // Both are kept across builds at one scale, so a build visits only the subtrees that are new or moved.
  if (columnMemo.scale !== scale) columnMemo = freshColumnMemo(scale);
  const { heights, texts, textKeys, visits, places } = columnMemo;
  const out = new Map();
  /** Every override of this pass in order, so a memoised visit can record its share and replay it. */
  const journal = [];
  const merge = (node, values) => {
    const was = out.get(node);
    out.set(node, was ? { ...was, ...values } : values);
  };
  // A length that is not a plain one (NaN) keeps its own value and restarts the total.
  const set = (node, values) => {
    let kept = null;
    for (const key in values) {
      if (Number.isFinite(values[key])) (kept ??= {})[key] = values[key];
    }
    if (!kept) return;
    journal.push(node, kept);
    merge(node, kept);
  };
  const replay = (log) => {
    for (let i = 0; i < log.length; i += 2) {
      journal.push(log[i], log[i + 1]);
      merge(log[i], log[i + 1]);
    }
  };

  /** The exact CSS height of `node` (NaN when not known), for text styled `text` around it. */
  function height(node, text) {
    // A line that cannot wrap: `nowrap`, or text with no place to break.
    if (node.kind === "text") return text.whitespace === "nowrap" || UNBREAKABLE.test(node.text) ? (lineHeightPx(text) ?? NaN) : NaN;
    const key = `${text.text_size}|${text.line_height}|${text.whitespace}|${text.text_ellipsis}`;
    if (textKeys.get(node) === key && heights.has(node)) return heights.get(node);
    let own = text;
    for (const k of TEXT_KEYS) if (node.style[k] !== undefined && node.style[k] !== own[k]) { if (own === text) own = { ...text }; own[k] = node.style[k]; }
    textKeys.set(node, key);
    texts.set(node, own);
    const s = node.style;
    const kids = (node.children ?? []).filter(inFlow);
    const kidHeights = kids.map((kid) => height(kid, own));
    let h;
    if (s.h !== undefined && s.h !== "auto") h = px(s.h);
    // An engine's content height is the host's, not known here.
    else if (node.kind === "engine") h = NaN;
    else if (node.kind === "input") {
      // A one-line field is its line box inside its padding and border.
      h = (node.input_type === "textarea" || node.input_type === "select" ? NaN : (lineHeightPx(own) ?? NaN)) + px(s.pt) + px(s.pb) + px(s.border_t) + px(s.border_b);
      if (s.min_h !== undefined) h = Math.max(h, px(s.min_h));
    } else {
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
    const key = textKeys.get(node);
    const kept = visits.get(node);
    if (kept && key !== undefined && kept.key === key) return replay(kept.log);
    const start = journal.length;
    for (const child of (node.children ?? []).filter((c) => c.kind !== "text" && drawn(c) && c.style.position === "absolute")) visit(child);
    if (isColumn(node) && !isRow(node)) {
      const flow = fresh();
      set(node, { border_t: stack(flow, px(node.style.border_t)), pt: stack(flow, px(node.style.pt)) });
      column(node, flow);
    } else for (const child of (node.children ?? []).filter(inFlow)) if (child.kind !== "text") visit(child);
    if (key !== undefined) visits.set(node, { key, log: journal.slice(start) });
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
        const h = height(kid, texts.get(node) ?? {});
        if (Number.isFinite(h)) set(kid, { h: stack(flow, h) });
        else Object.assign(flow, fresh());
        return;
      }
      set(kid, { mt: stack(flow, (i ? gap : 0) + px(kid.style.mt)) });
      if (Number.isFinite(heights.get(kid))) place(kid, flow);
      else if (wholeLines(kid)) {
        // Its lines are a whole number of pixels in CSS and in GPUI alike, so the total keeps its fraction across them.
        const s = kid.style;
        set(kid, { border_t: stack(flow, px(s.border_t)), pt: stack(flow, px(s.pt)) });
        set(kid, { pb: stack(flow, px(s.pb)), border_b: stack(flow, px(s.border_b)) });
      } else {
        visit(kid);
        Object.assign(flow, fresh());
      }
      set(kid, { mb: stack(flow, px(kid.style.mb)) });
    });
    return true;
  }

  /** A box holding only text that may wrap, in lines of a whole number of pixels, sized by them alone. */
  function wholeLines(node) {
    const s = node.style;
    const kids = (node.children ?? []).filter(inFlow);
    const line = lineHeightPx(texts.get(node) ?? {});
    return node.kind === "div" && !isRow(node) && kids.length > 0 && kids.every((kid) => kid.kind === "text") && Number.isInteger(line) && [s.h, s.min_h, s.max_h].every((v) => v === undefined || v === "auto");
  }

  /** A node whose height is known, at `flow`'s running total: its lengths on the total, its height their sum. What it
   * yields depends on the total only through its distance past the last device pixel (`flow.laid` is on one). */
  function place(node, flow) {
    const key = `${textKeys.get(node)}|${Math.round((flow.exact - flow.laid) * 1e6)}`;
    const kept = places.get(node);
    if (kept && kept.key === key) {
      replay(kept.log);
      flow.exact += kept.exact;
      flow.laid += kept.laid;
      return;
    }
    const start = journal.length;
    const [exact0, laid0] = [flow.exact, flow.laid];
    placeOnce(node, flow);
    places.set(node, { key, log: journal.slice(start), exact: flow.exact - exact0, laid: flow.laid - laid0 });
  }
  function placeOnce(node, flow) {
    const s = node.style;
    for (const child of (node.children ?? []).filter((c) => c.kind !== "text" && drawn(c) && c.style.position === "absolute")) visit(child);
    const start = flow.laid;
    const exactStart = flow.exact;
    set(node, { border_t: stack(flow, px(s.border_t)), pt: stack(flow, px(s.pt)) });
    const explicit = s.h !== undefined && s.h !== "auto";
    const content = heights.get(node) - px(s.pt) - px(s.pb) - px(s.border_t) - px(s.border_b);
    if (node.kind === "input") {
      // A field's line is drawn inside it, not described as a child.
      if (!explicit) stack(flow, content);
    } else if (isRow(node) || (explicit && (s.justify ?? "start") !== "start")) {
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
  // The exact CSS heights, for the scrollbar pass.
  Object.defineProperty(out, "heights", { value: heights });
  return out;
}

/** `snapColumns`' results by node, kept while the scale is the same (`heights`, `texts` and the inherited text they
 * were worked out for, `textKeys`; a content's overrides, `visits`; a placing's, by its total's residual, `places`). */
const freshColumnMemo = (scale) => ({ scale, heights: new WeakMap(), texts: new WeakMap(), textKeys: new WeakMap(), visits: new WeakMap(), places: new WeakMap() });
let columnMemo = freshColumnMemo(0);
