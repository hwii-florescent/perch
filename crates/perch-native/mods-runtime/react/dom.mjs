//! The DOM, as much of it as a stock screen's source touches (the web reference's findings, section 9) and no more.
//! The renderer's host instances are `HostElement`s, so a `ref`, `event.currentTarget` and `event.target` are these
//! objects: `closest`, `contains`, `parentElement`, `children`, `dataset`, `getAttribute`, `getBoundingClientRect`.
//! `document` (with `body`, the portal target) and `window` keep listeners for the capture and bubble phases the
//! source registers; `localStorage`, timers, `window.location` and `navigator.clipboard` go to the `perch` host.
//!
//! `installGlobals(perch)` puts `window`, `document`, `localStorage`, `HTMLElement`, `DOMRect`, `getComputedStyle`
//! and (where the engine has none) `setTimeout`/`clearTimeout`/`queueMicrotask` on `globalThis`, so a module that
//! names them as globals runs unchanged. `window`, `document`, `localStorage` and `HTMLElement` read the record at
//! `globalThis[GLOBALS]`, which each mount sets to its own and a host running several screens in one script context
//! sets to the running screen's.
import { closest as closestBy, matches as matchesBy, querySelectorAll as queryBy } from "./selector.mjs";

let nextId = 1;

export class DOMRect {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x; this.y = y; this.width = width; this.height = height;
  }
  get left() { return this.x; }
  get top() { return this.y; }
  get right() { return this.x + this.width; }
  get bottom() { return this.y + this.height; }
  toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

/** Listener bookkeeping shared by elements, `document` and `window`. */
class Target {
  constructor() { this.listeners = []; }
  addEventListener(type, listener, options) {
    const capture = options === true || !!options?.capture;
    if (!this.listeners.some((l) => l.type === type && l.listener === listener && l.capture === capture)) this.listeners.push({ type, listener, capture });
  }
  removeEventListener(type, listener, options) {
    const capture = options === true || !!options?.capture;
    this.listeners = this.listeners.filter((l) => !(l.type === type && l.listener === listener && l.capture === capture));
  }
}

/** The clock the description's cache reads: every change to the tree takes the next tick. */
let clock = 0;
export const tick = () => ++clock;

export class HostText {
  constructor(text) {
    this.nodeType = 3;
    this.parentNode = null;
    this.chars = String(text);
    this.hide = false;
  }
  /** A text's change re-describes its element (`HostElement.mark`), not its style. */
  get data() { return this.chars; }
  set data(text) { this.chars = String(text); this.parentNode?.mark?.(); }
  get hidden() { return this.hide; }
  set hidden(on) { this.hide = on; this.parentNode?.mark?.(); }
  get parentElement() { return this.parentNode; }
  get textContent() { return this.data; }
}

/** One element the source created (`div`, `button`, `svg`, `path`, ...). React's props are kept as given;
 * attributes are derived from them on read. */
export class HostElement extends Target {
  constructor(tag, props = {}, ownerDocument = null) {
    super();
    this.nodeType = 1;
    this.id = `n${nextId++}`;
    this.tagName = tag.toLowerCase();
    this.props = props;
    this.childNodes = [];
    this.parentNode = null;
    this.ownerDocument = ownerDocument;
    this.hidden = false;
    /** Interaction state the engine reports (`hover`) and the cascade reads for group variants. */
    this.state = { hover: false, focus: false, active: false };
    /** The last box the engine reported for this element (window coordinates, logical px). */
    this.bounds = null;
    /** Bumped when what its style depends on changes (props, children, interaction state); the description
     * recomputes an element whose own or an ancestor's version moved. */
    this.version = 0;
    /** The tick its attributes or interaction state last changed: a descendant whose rules read an ancestor
     * (`StyleSheet.depends`) is styled again after it. */
    this.attrStamp = 0;
    /** The tick anything in its subtree last changed: an unchanged subtree's description is kept whole. */
    this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() { this.version++; this.attrStamp = tick(); this.mark(); }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const at = tick();
    for (let n = this; n instanceof HostElement; n = n.parentNode) n.stamp = at;
  }
  /** Its children changed: its own style (`:empty`-like reads, `:has()` below) and every ancestor whose style asked what
   * lies below it (`:has()`, `selector.mjs`). Its descendants keep theirs: a sibling moving changes only the first and
   * last children's positions, which their own cache keys read. */
  touchWatchers() {
    this.version++;
    this.mark();
    for (let n = this.parentElement; n; n = n.parentElement) if (n.watchesDescendants) n.touch();
  }
  get nodeName() { return this.tagName.toUpperCase(); }
  get parentElement() { return this.parentNode instanceof HostElement ? this.parentNode : null; }
  get children() { return this.childNodes.filter((n) => n instanceof HostElement); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get isDocumentRoot() { return !!this.ownerDocument && this.ownerDocument.documentElement === this; }
  get className() { return typeof this.props.className === "string" ? this.props.className : ""; }
  get classList() {
    const name = this.className;
    if (this.classCache?.name !== name) {
      const list = name.split(/\s+/).filter(Boolean);
      this.classCache = { name, list, set: new Set(list) };
    }
    return this.classCache.list;
  }
  /** The classes as a set, for selector matching. */
  get classSet() {
    this.classList;
    return this.classCache.set;
  }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  get dataset() {
    const out = {};
    for (const [name, value] of Object.entries(this.props)) {
      if (name.startsWith("data-") && value != null && value !== false) out[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    }
    return out;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(name) {
    const props = this.props;
    if (name === "class") return this.className || null;
    if (name === "id") return props.id != null ? String(props.id) : null;
    if (name === "style") return null;
    const key = name === "for" ? "htmlFor" : name === "tabindex" ? "tabIndex" : name;
    const value = props[key];
    if (value === undefined || value === null || typeof value === "function") return null;
    if (typeof value === "boolean") {
      // `aria-*` and `data-*` keep "true"/"false"; a boolean DOM attribute is present or absent.
      if (name.startsWith("aria-") || name.startsWith("data-")) return String(value);
      return value ? "" : null;
    }
    return String(value);
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    this.touchWatchers();
    return child;
  }
  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const at = this.childNodes.indexOf(before);
    child.parentNode = this;
    if (at < 0) this.childNodes.push(child);
    else this.childNodes.splice(at, 0, child);
    this.touchWatchers();
    return child;
  }
  removeChild(child) {
    const at = this.childNodes.indexOf(child);
    if (at >= 0) this.childNodes.splice(at, 1);
    child.parentNode = null;
    this.touchWatchers();
    return child;
  }
  contains(node) {
    for (let n = node; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  matches(selector) { return matchesBy(this, selector); }
  closest(selector) { return closestBy(this, selector); }
  querySelectorAll(selector) { return queryBy(this, selector); }
  querySelector(selector) { return queryBy(this, selector)[0] ?? null; }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const box = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return box ? new DOMRect(box.x, box.y, box.width, box.height) : new DOMRect();
  }
  // The DOM's measurement properties, from the same boxes. An offset is from the parent's box (the nearest box the
  // engine lays this one out in); a scroll size is the box's own, as nothing is measured inside a scroller.
  get offsetWidth() { return this.getBoundingClientRect().width; }
  get offsetHeight() { return this.getBoundingClientRect().height; }
  get offsetLeft() { return this.getBoundingClientRect().x - (this.parentElement?.getBoundingClientRect().x ?? 0); }
  get offsetTop() { return this.getBoundingClientRect().y - (this.parentElement?.getBoundingClientRect().y ?? 0); }
  get offsetParent() { return this.parentElement; }
  get clientWidth() { return this.getBoundingClientRect().width; }
  get clientHeight() { return this.getBoundingClientRect().height; }
  get scrollWidth() { return this.getBoundingClientRect().width; }
  get scrollHeight() { return this.getBoundingClientRect().height; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  focus() { this.ownerDocument?.focus(this); }
  blur() { this.ownerDocument?.blur(this); }
  /** A field's text: what is being typed into it (`edit`, during the change event it causes), else its props'. */
  get value() { return this.edit ?? String(this.props.value ?? this.props.defaultValue ?? ""); }
  set value(text) { this.edit = String(text); }
  /** A box's tick: what a click just made it (`ticked`, during the change event it causes), else its props'. */
  get checked() { return this.ticked ?? !!(this.props.checked ?? this.props.defaultChecked); }
  set checked(on) { this.ticked = !!on; }
  /** Selection in a field: the caret stays at the end of its text, and the one selection kept is all of it
   * (`selectedAll`: the next character typed replaces the text). `select()` focuses the field first, as WebKit and
   * Chromium do: a source that only selects (the tab strip's rename) expects the keyboard there. */
  select() { this.focus(); this.selectedAll = true; }
  setSelectionRange(start, end) { this.selectedAll = start === 0 && end >= this.value.length && end > 0; }
  /** Asks the scroll area around this element to show it (`toGpui`, on the next frame: the engine scrolls by the
   * fewest pixels, as `{ inline: "nearest", block: "nearest" }`, whatever the options). */
  scrollIntoView() { if (this.ownerDocument) this.ownerDocument.scrollTarget = this; }
  /** `element.style`: a write (`el.style.transform = ...`, `setProperty`) is kept on the element over its props'
   * `style` until the source writes that property again, and the next frame draws it, as in a page; a read is the
   * written value, else the props'. */
  get style() {
    if (this.styleView) return this.styleView;
    const element = this;
    const name = (prop) => (String(prop).startsWith("--") ? String(prop) : String(prop).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
    const own = (key) => {
      const value = element.props.style?.[key];
      if (value === undefined || value === null || typeof value === "boolean") return "";
      return typeof value === "number" && value !== 0 ? `${value}px` : String(value);
    };
    const read = (key) => (element.inline && key in element.inline ? element.inline[key] : own(key));
    const write = (key, value) => {
      const text = value === undefined || value === null ? "" : String(value);
      if (read(key) === text) return;
      element.inline ??= {};
      if (text === own(key)) delete element.inline[key];
      else element.inline[key] = text;
      element.touch();
      element.ownerDocument?.restyled();
    };
    this.styleView = new Proxy({}, {
      get: (_, key) => {
        if (typeof key !== "string") return undefined;
        if (key === "setProperty") return (prop, value) => write(name(prop), value);
        if (key === "removeProperty") return (prop) => { const was = read(name(prop)); write(name(prop), ""); return was; };
        if (key === "getPropertyValue") return (prop) => read(name(prop));
        return read(key);
      },
      set: (_, key, value) => { if (typeof key === "string") write(key, value); return true; },
    });
    return this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() { return this.inline ? { ...this.props.style, ...this.inline } : this.props.style; }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() { return markup(this); }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(omit = []) { return markup(this, omit); }
}

/** Thrown by a measurement inside an effect when the box would be from a layout older than the tree (`measured`). */
const STALE = Symbol("perch.stale-layout");
/** How many times an effect is put off for a fresh layout before it runs with the boxes there are. */
export const MEASURE_TRIES = 3;
/** Whether a measurement now is inside an effect that may still be put off. */
let strict = false;

/** `effect` (a `useEffect` or `useLayoutEffect` body) as the runtime runs it. In a page an effect that measures reads
 * the layout of the tree it was committed with; here the engine lays the tree out after the commit, in the next frame.
 * So when the effect measures a box whose layout is older than the tree (`HostDocument.measure`), the effect stops
 * where it measured and runs again after the next frame has laid the tree out, up to `MEASURE_TRIES` times; after that
 * it runs with the boxes there are. Its cleanup is the run that finished.
 *
 * The rule for a screen's effect: measure first, then act. A put-off run stops at the measurement and the effect runs
 * again from its top, so whatever it did before measuring (a listener added, a question asked) is done once per run
 * and the put-off runs leave no cleanup. An effect that measures before it does anything runs its actions once. */
export function measured(effect) {
  return () => {
    let cleanup;
    let cancelled = false;
    const attempt = (tries) => {
      const outer = strict;
      strict = tries < MEASURE_TRIES;
      try {
        cleanup = effect();
      } catch (error) {
        const document = error?.[STALE];
        if (!document) throw error;
        document.retries.push(() => { if (!cancelled) attempt(tries + 1); });
      } finally {
        strict = outer;
      }
    };
    attempt(0);
    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
    };
  };
}

/** What this shim's markup begins with. There is no HTML parser: markup is a copy of a subtree that only the shim
 * writes (`markup`, an element's `outerHTML`) and reads back (`fromMarkup`, an element's `dangerouslySetInnerHTML`);
 * any other HTML is not drawn. */
export const MARKUP = "\u0001perch-dom:";
/** Props that are React's, not attributes, and so are not copied. */
const NOT_ATTRIBUTES = new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]);
/** An attribute's name as the prop that holds it. */
const PROP_OF = { class: "className", for: "htmlFor", tabindex: "tabIndex" };

/** `node` and its subtree as markup: each element its tag, its attribute props (no handlers, no `omit`ted attributes,
 * by their DOM names: `id`, `style`, `data-testid`) and its children, each text its text. */
export function markup(node, omit = []) {
  const skip = new Set(omit.map((name) => PROP_OF[name] ?? name));
  const copy = (n) => {
    if (!(n instanceof HostElement)) return { x: n.data, ...(n.hidden ? { h: 1 } : {}) };
    const p = {};
    for (const [key, value] of Object.entries(n.props)) {
      if (NOT_ATTRIBUTES.has(key) || skip.has(key) || value == null || typeof value === "function" || typeof value === "symbol") continue;
      p[key] = value;
    }
    return { t: n.tagName, p, c: n.childNodes.map(copy), ...(n.hidden ? { h: 1 } : {}) };
  };
  return MARKUP + JSON.stringify(copy(node));
}

/** The nodes `html` copies, made afresh in `document`; null when `html` is not this shim's markup. */
export function fromMarkup(html, document) {
  if (typeof html !== "string" || !html.startsWith(MARKUP)) return null;
  let tree;
  try { tree = JSON.parse(html.slice(MARKUP.length)); } catch { return null; }
  const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const build = (n) => {
    if (!plain(n)) throw new Error("not a node");
    let node;
    if (typeof n.x === "string") node = new HostText(n.x);
    else {
      if (typeof n.t !== "string" || !/^[a-z][a-z0-9-]*$/i.test(n.t) || !plain(n.p) || !Array.isArray(n.c)) throw new Error("not an element");
      node = new HostElement(n.t, n.p, document);
      for (const child of n.c) node.appendChild(build(child));
    }
    node.hidden = n.h === 1;
    return node;
  };
  try { return [build(tree)]; } catch { return null; }
}

/** `ResizeObserver`: the engine tells the description of no resizes, so an observer is never called back (its
 * screen reads boxes when it renders instead). */
export class HostResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** An in-memory `Storage` (the engine's own per-copy storage replaces it when it has one). */
export class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

/** An element and its ancestors changed (`:focus-within` reads the focused element's whole chain). */
function touchChain(element) {
  for (let n = element; n instanceof HostElement; n = n.parentElement) n.touch();
}

export class HostDocument extends Target {
  constructor(perch) {
    super();
    this.perch = perch;
    this.documentElement = new HostElement("html", {}, this);
    this.body = new HostElement("body", {}, this);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
    /** Effects put off until the next frame's layout (`measured`). */
    this.retries = [];
  }
  createElement(tag) { return new HostElement(tag, {}, this); }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(element) {
    const read = this.perch?.bounds;
    if (typeof read !== "function" || !this.measureKey) return null;
    if (!element.measured) {
      element.measured = true;
      element.touch();
      this.restyled();
    }
    const box = read(this.measureKey(element));
    if (strict && (!box || this.stale?.())) throw { [STALE]: this };
    return box ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    if (this.restyling) return;
    this.restyling = true;
    queueMicrotask(() => { this.restyling = false; this.afterCommit?.(); });
  }
  focus(element) {
    // Focusing the focused element changes nothing on screen, as in a browser: the tree is not described again (a
    // file tree focuses itself on every press, and describing it cost each click a whole tree).
    if (this.activeElement !== element || !element.state.focus) {
      if (this.activeElement && this.activeElement !== element) this.blur(this.activeElement);
      this.activeElement = element;
      element.state.focus = true;
      element.state.pointerFocus = false;
      touchChain(element);
      // What `:focus` and a field's caret show changed: described again, though nothing was committed (a field the
      // source focuses itself, in an effect).
      this.restyled();
    }
    // The engine moves the keyboard onto the screen when the source focuses one of its elements.
    this.perch?.focused?.(element);
  }
  blur(element) {
    element.state.focus = false;
    touchChain(element);
    this.restyled();
    if (this.activeElement === element) this.activeElement = this.body;
  }
  querySelectorAll(selector) { return queryBy(this.documentElement, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(id) { return queryBy(this.documentElement, "*").find((el) => el.props?.id === id) ?? null; }
}

export class HostWindow extends Target {
  constructor(perch, document) {
    super();
    this.perch = perch;
    this.document = document;
    this.location = { get hostname() { return perch.hostname ?? "localhost"; } };
  }
  get innerWidth() { return this.perch.viewport?.().width ?? 1000; }
  get innerHeight() { return this.perch.viewport?.().height ?? 800; }
  setTimeout(fn, ms, ...args) { return globalThis.setTimeout(fn, ms, ...args); }
  clearTimeout(id) { return globalThis.clearTimeout(id); }
}

/** Timers on the host's clock, for an engine without `setTimeout`. */
export function hostTimers(perch) {
  return {
    setTimeout: (fn, ms = 0, ...args) => perch.setTimeout(() => fn(...args), Math.max(0, Number(ms) || 0)),
    clearTimeout: (id) => { if (id !== undefined && id !== null) perch.clearTimeout(id); },
  };
}

/** Where `window`, `document` and `localStorage` are read from: `{ window, document, localStorage }`. */
export const GLOBALS = Symbol.for("perch.react.globals");

function define(target, name, value) {
  Object.defineProperty(target, name, { value, configurable: true, writable: true, enumerable: false });
}

/** The browser globals a stock screen names, on `target` (default `globalThis`), bound to `perch`. Returns the
 * document and window it made and `globals`, the record `window`, `document` and `localStorage` read now (put it at
 * `target[GLOBALS]` again before running code for this mount). Timers and `queueMicrotask` are installed only where
 * the engine lacks them. */
export function installGlobals(perch, target = globalThis) {
  const document = new HostDocument(perch);
  const window = new HostWindow(perch, document);
  document.defaultView = window;
  const storage = perch.storage ?? new MemoryStorage();
  if (typeof target.setTimeout !== "function") {
    if (typeof perch.setTimeout !== "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const timers = hostTimers(perch);
    define(target, "setTimeout", timers.setTimeout);
    define(target, "clearTimeout", timers.clearTimeout);
  }
  if (typeof target.queueMicrotask !== "function") define(target, "queueMicrotask", (fn) => { Promise.resolve().then(fn); });
  // A frame is the next turn of the host's clock (the engine draws after each).
  define(target, "requestAnimationFrame", (fn) => target.setTimeout(() => fn(Date.now()), 0));
  define(target, "cancelAnimationFrame", (id) => target.clearTimeout(id));
  // `HTMLElement` too: each mod folder evaluates its own copy of this runtime, so a source's `instanceof HTMLElement`
  // must name the class of the copy that made its elements.
  const globals = { document, window, localStorage: storage, HTMLElement: HostElement, Element: HostElement };
  for (const name of Object.keys(globals)) {
    Object.defineProperty(target, name, { get: () => target[GLOBALS]?.[name], configurable: true, enumerable: false });
  }
  target[GLOBALS] = globals;
  define(target, "DOMRect", DOMRect);
  define(target, "getComputedStyle", computedStyle);
  if (typeof target.ResizeObserver !== "function") define(target, "ResizeObserver", HostResizeObserver);
  const navigator = target.navigator && typeof target.navigator === "object" ? target.navigator : {};
  if (!navigator.clipboard && perch.clipboard) {
    try { define(navigator, "clipboard", perch.clipboard); } catch { /* a frozen navigator keeps its own */ }
  }
  if (!target.navigator) define(target, "navigator", navigator);
  return { document, window, globals };
}

/** `getComputedStyle(element)`: the cascade's values for it (`HostDocument.computed`, which a mount gives), by their
 * DOM names (`overflowY`, `position`) or through `getPropertyValue`. A keyword or number reads as its text; a value
 * the cascade keeps parsed (a length, a colour) and one it has not computed read as "". */
export function computedStyle(element) {
  const values = element?.ownerDocument?.computed?.(element) ?? {};
  const text = (name) => {
    const value = values[name];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
  return new Proxy({}, {
    get: (_, key) => {
      if (typeof key !== "string") return undefined;
      if (key === "getPropertyValue") return (name) => text(String(name));
      return text(key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
    },
  });
}

/** The form `element` submits, as a browser's default action does: a submit button's (a `<button>` whose type is not
 * `button` or `reset`), or a single-line text field's on Enter. `null` for anything else, or a disabled button. */
export function submits(element, enter = false) {
  const own = enter
    ? element?.tagName === "input" && isTextField(element)
    : element?.tagName === "button" && !/^(button|reset)$/.test(String(element.props.type ?? "submit")) && !element.props.disabled;
  if (!own) return null;
  for (let node = element.parentElement; node; node = node.parentElement) if (node.tagName === "form") return node;
  return null;
}

/** Whether `element` is a field a person types a line of text into. */
export const isTextField = (element) =>
  element?.tagName === "textarea" || (element?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(element.props.type ?? "")));
