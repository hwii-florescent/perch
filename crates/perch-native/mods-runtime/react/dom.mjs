//! The DOM, as much of it as a stock screen's source touches (the web reference's findings, section 9) and no more.
//! The renderer's host instances are `HostElement`s, so a `ref`, `event.currentTarget` and `event.target` are these
//! objects: `closest`, `contains`, `parentElement`, `children`, `dataset`, `getAttribute`, `getBoundingClientRect`.
//! `document` (with `body`, the portal target) and `window` keep listeners for the capture and bubble phases the
//! source registers; `localStorage`, timers, `window.location` and `navigator.clipboard` go to the `perch` host.
//!
//! `installGlobals(perch)` puts `window`, `document`, `localStorage`, `HTMLElement`, `DOMRect` and (where the engine
//! has none) `setTimeout`/`clearTimeout`/`queueMicrotask` on `globalThis`, so a module that names them as globals
//! runs unchanged.
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

export class HostText {
  constructor(text) {
    this.nodeType = 3;
    this.data = String(text);
    this.parentNode = null;
    this.hidden = false;
  }
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
  }
  touch() { this.version++; }
  get nodeName() { return this.tagName.toUpperCase(); }
  get parentElement() { return this.parentNode instanceof HostElement ? this.parentNode : null; }
  get children() { return this.childNodes.filter((n) => n instanceof HostElement); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get isDocumentRoot() { return !!this.ownerDocument && this.ownerDocument.documentElement === this; }
  get className() { return typeof this.props.className === "string" ? this.props.className : ""; }
  get classList() {
    const name = this.className;
    if (this.classCache?.name !== name) this.classCache = { name, list: name.split(/\s+/).filter(Boolean) };
    return this.classCache.list;
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
    let value = props[key];
    if (value === undefined && !name.includes("-")) {
      // React's camelCase spelling of plain attributes (`viewBox`, `strokeWidth`).
      const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      value = props[camel];
    }
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
    this.touch();
    return child;
  }
  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const at = this.childNodes.indexOf(before);
    child.parentNode = this;
    if (at < 0) this.childNodes.push(child);
    else this.childNodes.splice(at, 0, child);
    this.touch();
    return child;
  }
  removeChild(child) {
    const at = this.childNodes.indexOf(child);
    if (at >= 0) this.childNodes.splice(at, 1);
    child.parentNode = null;
    this.touch();
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
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const box = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.bounds;
    return box ? new DOMRect(box.x, box.y, box.width, box.height) : new DOMRect();
  }
  getClientRects() { return [this.getBoundingClientRect()]; }
  focus() { this.ownerDocument?.focus(this); }
  blur() { this.ownerDocument?.blur(this); }
  /** A field's text: what is being typed into it (`edit`, during the change event it causes), else its props'. */
  get value() { return this.edit ?? String(this.props.value ?? this.props.defaultValue ?? ""); }
  set value(text) { this.edit = String(text); }
  /** A box's tick: what a click just made it (`ticked`, during the change event it causes), else its props'. */
  get checked() { return this.ticked ?? !!(this.props.checked ?? this.props.defaultChecked); }
  set checked(on) { this.ticked = !!on; }
  // ponytail: the engine has no scroll offsets a script sets, so a row scrolled into view stays where the list has it.
  scrollIntoView() {}
  select() {}
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
  }
  createElement(tag) { return new HostElement(tag, {}, this); }
  focus(element) {
    if (this.activeElement && this.activeElement !== element) this.blur(this.activeElement);
    this.activeElement = element;
    element.state.focus = true;
    touchChain(element);
    // The engine moves the keyboard onto the screen when the source focuses one of its elements.
    this.perch?.focused?.(element);
  }
  blur(element) {
    element.state.focus = false;
    touchChain(element);
    if (this.activeElement === element) this.activeElement = this.body;
  }
  querySelectorAll(selector) { return queryBy(this.documentElement, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
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

function define(target, name, value) {
  Object.defineProperty(target, name, { value, configurable: true, writable: true, enumerable: false });
}

/** The browser globals a stock screen names, on `target` (default `globalThis`), bound to `perch`. Returns the
 * document and window it installed. Timers and `queueMicrotask` are installed only where the engine lacks them. */
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
  define(target, "document", document);
  define(target, "window", window);
  define(target, "localStorage", storage);
  define(target, "HTMLElement", HostElement);
  define(target, "Element", HostElement);
  define(target, "DOMRect", DOMRect);
  const navigator = target.navigator && typeof target.navigator === "object" ? target.navigator : {};
  if (!navigator.clipboard && perch.clipboard) {
    try { define(navigator, "clipboard", perch.clipboard); } catch { /* a frozen navigator keeps its own */ }
  }
  if (!target.navigator) define(target, "navigator", navigator);
  return { document, window };
}
