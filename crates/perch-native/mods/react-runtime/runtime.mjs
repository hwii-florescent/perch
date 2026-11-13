function Dd(n, i) {
  for (var o = 0; o < i.length; o++) {
    const s = i[o];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const c in s)
        if (c !== "default" && !(c in n)) {
          const d = Object.getOwnPropertyDescriptor(s, c);
          d && Object.defineProperty(n, c, d.get ? d : {
            enumerable: !0,
            get: () => s[c]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
//! A small CSS selector engine over the renderer's host elements (`dom.mjs`). It serves three callers with one
//! grammar: the DOM shim (`closest`, `matches`, `querySelectorAll`), the style cascade (every rule of the app's
//! compiled stylesheet, `css.mjs`) and the tests (the web reference's named-element selectors).
//!
//! Supported: type, `*`, `.class`, `#id`, `[attr]`, `[attr=v]`, `[attr^=v]`, `[attr$=v]`, `[attr*=v]`, `[attr~=v]`,
//! `:first-child`, `:last-child`, `:only-child`, `:nth-child(n)`, `:not()`, `:is()`, `:where()`, `:root`, the state pseudo-classes
//! (`:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:enabled`, `:checked`), and the
//! descendant and child combinators. Anything else (`+`, `~`, `:has()`, pseudo-elements, ...) throws a
//! `SelectorError`, so a caller can skip a rule it cannot evaluate instead of guessing.
//!
//! An element is anything with `tagName` (lower case), `getAttribute(name)`, `parentElement` and `children`
//! (elements only). State pseudo-classes ask `options.state(element, name, isSubject)`; without it they never match.
class Se extends Error {
}
const Pp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), th = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), eh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Pp]);
function Co(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, o, s) => o ? String.fromCodePoint(parseInt(o, 16)) : s);
}
function pi(n, i) {
  let o = i;
  for (; o < n.length; ) {
    const s = n[o];
    if (s === "\\") {
      o += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(s)) {
      o++;
      continue;
    }
    break;
  }
  if (o === i) throw new Se(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [Co(n.slice(i, o)), o];
}
function ah(n, i) {
  let o = 1;
  for (let s = i; s < n.length; s++) {
    const c = n[s];
    if (c === "\\") {
      s++;
      continue;
    }
    if (c === '"' || c === "'") {
      if (s = n.indexOf(c, s + 1), s < 0) break;
      continue;
    }
    if (c === "(") o++;
    else if (c === ")" && --o === 0) return s;
  }
  throw new Se(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Ko(n) {
  const i = [];
  let o = 0, s = 0;
  for (let c = 0; c < n.length; c++) {
    const d = n[c];
    if (d === "\\") {
      c++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (c = n.indexOf(d, c + 1), c < 0) break;
      continue;
    }
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (i.push(n.slice(s, c).trim()), s = c + 1);
  }
  return i.push(n.slice(s).trim()), i.filter(Boolean);
}
function nh(n, i) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let s = !1;
  for (; i < n.length; ) {
    const c = n[i];
    if (c === "*") {
      o.tag = "*", i++, s = !0;
      continue;
    }
    if (c === ".") {
      const [d, p] = pi(n, i + 1);
      o.classes.push(d), i = p, s = !0;
      continue;
    }
    if (c === "#") {
      const [d, p] = pi(n, i + 1);
      o.id = d, i = p, s = !0;
      continue;
    }
    if (c === "[") {
      const d = n.indexOf("]", i);
      if (d < 0) throw new Se(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(i + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!f) throw new Se(`cannot read the attribute selector [${p}]`);
      const _ = f[3] ?? f[4] ?? f[5];
      o.attrs.push({ name: Co(f[1]).toLowerCase(), op: f[2] ?? null, value: _ === void 0 ? null : Co(_) }), i = d + 1, s = !0;
      continue;
    }
    if (c === ":") {
      if (n[i + 1] === ":") throw new Se(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = pi(n, i + 1);
      i = p;
      const f = d.toLowerCase();
      if (n[i] === "(") {
        if (!th.has(f)) throw new Se(`:${f}() is not supported`);
        const _ = ah(n, i + 1), x = n.slice(i + 1, _).trim();
        if (i = _ + 1, f === "nth-child") {
          if (!/^\d+$/.test(x)) throw new Se(`:nth-child(${x}) is not supported (only a number)`);
          o.pseudos.push({ name: f, n: Number(x) });
        } else
          o.pseudos.push({ name: f, list: Ko(x).map(Vo) });
      } else {
        if (!eh.has(f)) throw new Se(`:${f} is not supported`);
        o.pseudos.push({ name: f });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !s) {
      const [d, p] = pi(n, i);
      o.tag = d.toLowerCase(), i = p, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new Se(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [o, i];
}
function Vo(n) {
  const i = [];
  let o = 0, s = null;
  for (n = n.trim(); o < n.length; ) {
    const [c, d] = nh(n, o);
    i.push({ compound: c, combinator: s }), o = d;
    let p = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, p = !0;
    if (o >= n.length) break;
    const f = n[o];
    if (f === ">")
      for (s = ">", o++; n[o] === " "; ) o++;
    else {
      if (f === "+" || f === "~") throw new Se(`the ${f} combinator is not supported`);
      if (p) s = " ";
      else throw new Se(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new Se("empty selector");
  return i;
}
const Lu = /* @__PURE__ */ new Map();
function Oi(n) {
  let i = Lu.get(n);
  return i || (i = Ko(n).map(Vo), Lu.set(n, i)), i;
}
function Ud(n) {
  const i = [0, 0, 0], o = (s) => {
    i[0] += s[0], i[1] += s[1], i[2] += s[2];
  };
  for (const { compound: s } of n) {
    s.id && i[0]++, i[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && i[2]++;
    for (const c of s.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const d = c.list.map(Ud).sort((p, f) => f[0] - p[0] || f[1] - p[1] || f[2] - p[2])[0];
          o(d);
        } else i[1]++;
  }
  return i;
}
function lh(n, { name: i, op: o, value: s }) {
  const c = n.getAttribute(i);
  if (c == null) return !1;
  if (o === null) return !0;
  switch (o) {
    case "=":
      return c === s;
    case "^=":
      return s !== "" && c.startsWith(s);
    case "$=":
      return s !== "" && c.endsWith(s);
    case "*=":
      return s !== "" && c.includes(s);
    case "~=":
      return c.split(/\s+/).includes(s);
    case "|=":
      return c === s || c.startsWith(`${s}-`);
    default:
      return !1;
  }
}
function hi(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function ih(n, i, o, s) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const c = n.classList ?? [];
    for (const d of i.classes) if (!c.includes(d)) return !1;
  }
  for (const c of i.attrs) if (!lh(n, c)) return !1;
  for (const c of i.pseudos)
    switch (c.name) {
      case "first-child":
        if (hi(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (hi(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = hi(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (hi(n).indexOf(n) !== c.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((d) => An(n, d, o, s))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((d) => An(n, d, o, s))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, c.name, s)) return !1;
    }
  return !0;
}
function An(n, i, o, s = !0) {
  const c = (d, p, f) => {
    const { compound: _, combinator: x } = i[p];
    if (!ih(d, _, o, f)) return !1;
    if (p === 0) return !0;
    if (x === ">") return !!d.parentElement && c(d.parentElement, p - 1, !1);
    for (let A = d.parentElement; A; A = A.parentElement) if (c(A, p - 1, !1)) return !0;
    return !1;
  };
  return c(n, i.length - 1, s);
}
function rh(n, i, o = {}) {
  return (typeof i == "string" ? Oi(i) : i).some((c) => An(n, c, o));
}
function Bd(n, i, o = {}) {
  return An(n, i, o);
}
function fl(n, i, o = {}) {
  const s = Oi(i), c = [], d = (p) => {
    for (const f of p.children)
      s.some((_) => An(f, _, o)) && c.push(f), d(f);
  };
  return d(n), c;
}
function qd(n, i, o = {}) {
  const s = Oi(i);
  for (let c = n; c; c = c.parentElement) if (s.some((d) => An(c, d, o))) return c;
  return null;
}
//! The DOM, as much of it as a stock screen's source touches (the web reference's findings, section 9) and no more.
//! The renderer's host instances are `HostElement`s, so a `ref`, `event.currentTarget` and `event.target` are these
//! objects: `closest`, `contains`, `parentElement`, `children`, `dataset`, `getAttribute`, `getBoundingClientRect`.
//! `document` (with `body`, the portal target) and `window` keep listeners for the capture and bubble phases the
//! source registers; `localStorage`, timers, `window.location` and `navigator.clipboard` go to the `perch` host.
//!
//! `installGlobals(perch)` puts `window`, `document`, `localStorage`, `HTMLElement`, `DOMRect` and (where the engine
//! has none) `setTimeout`/`clearTimeout`/`queueMicrotask` on `globalThis`, so a module that names them as globals
//! runs unchanged. `window`, `document` and `localStorage` read the record at `globalThis[GLOBALS]`, which each
//! mount sets to its own and a host running several screens in one script context sets to the running screen's.
let oh = 1;
class jo {
  constructor(i = 0, o = 0, s = 0, c = 0) {
    this.x = i, this.y = o, this.width = s, this.height = c;
  }
  get left() {
    return this.x;
  }
  get top() {
    return this.y;
  }
  get right() {
    return this.x + this.width;
  }
  get bottom() {
    return this.y + this.height;
  }
  toJSON() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}
class Xo {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, o, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners.some((d) => d.type === i && d.listener === o && d.capture === c) || this.listeners.push({ type: i, listener: o, capture: c });
  }
  removeEventListener(i, o, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === i && d.listener === o && d.capture === c));
  }
}
class Zo {
  constructor(i) {
    this.nodeType = 3, this.data = String(i), this.parentNode = null, this.hidden = !1;
  }
  get parentElement() {
    return this.parentNode;
  }
  get textContent() {
    return this.data;
  }
}
class ke extends Xo {
  constructor(i, o = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${oh++}`, this.tagName = i.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof ke ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((i) => i instanceof ke);
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get isDocumentRoot() {
    return !!this.ownerDocument && this.ownerDocument.documentElement === this;
  }
  get className() {
    return typeof this.props.className == "string" ? this.props.className : "";
  }
  get classList() {
    const i = this.className;
    return this.classCache?.name !== i && (this.classCache = { name: i, list: i.split(/\s+/).filter(Boolean) }), this.classCache.list;
  }
  get textContent() {
    return this.childNodes.map((i) => i.textContent).join("");
  }
  get dataset() {
    const i = {};
    for (const [o, s] of Object.entries(this.props))
      o.startsWith("data-") && s != null && s !== !1 && (i[o.slice(5).replace(/-([a-z])/g, (c, d) => d.toUpperCase())] = String(s));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const o = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return o.id != null ? String(o.id) : null;
    if (i === "style") return null;
    let c = o[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (c === void 0 && !i.includes("-")) {
      const d = i.replace(/-([a-z])/g, (p, f) => f.toUpperCase());
      c = o[d];
    }
    return c == null || typeof c == "function" ? null : typeof c == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(c) : c ? "" : null : String(c);
  }
  hasAttribute(i) {
    return this.getAttribute(i) !== null;
  }
  appendChild(i) {
    return i.parentNode && i.parentNode.removeChild(i), i.parentNode = this, this.childNodes.push(i), this.touch(), i;
  }
  insertBefore(i, o) {
    i.parentNode && i.parentNode.removeChild(i);
    const s = this.childNodes.indexOf(o);
    return i.parentNode = this, s < 0 ? this.childNodes.push(i) : this.childNodes.splice(s, 0, i), this.touch(), i;
  }
  removeChild(i) {
    const o = this.childNodes.indexOf(i);
    return o >= 0 && this.childNodes.splice(o, 1), i.parentNode = null, this.touch(), i;
  }
  contains(i) {
    for (let o = i; o; o = o.parentNode) if (o === this) return !0;
    return !1;
  }
  matches(i) {
    return rh(this, i);
  }
  closest(i) {
    return qd(this, i);
  }
  querySelectorAll(i) {
    return fl(this, i);
  }
  querySelector(i) {
    return fl(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return i ? new jo(i.x, i.y, i.width, i.height) : new jo();
  }
  getClientRects() {
    return [this.getBoundingClientRect()];
  }
  focus() {
    this.ownerDocument?.focus(this);
  }
  blur() {
    this.ownerDocument?.blur(this);
  }
  /** A field's text: what is being typed into it (`edit`, during the change event it causes), else its props'. */
  get value() {
    return this.edit ?? String(this.props.value ?? this.props.defaultValue ?? "");
  }
  set value(i) {
    this.edit = String(i);
  }
  /** A box's tick: what a click just made it (`ticked`, during the change event it causes), else its props'. */
  get checked() {
    return this.ticked ?? !!(this.props.checked ?? this.props.defaultChecked);
  }
  set checked(i) {
    this.ticked = !!i;
  }
  /** Selection in a field: the caret stays at the end of its text, and the one selection kept is all of it
   * (`selectedAll`: the next character typed replaces the text). */
  select() {
    this.selectedAll = !0;
  }
  setSelectionRange(i, o) {
    this.selectedAll = i === 0 && o >= this.value.length && o > 0;
  }
  /** Asks the scroll area around this element to show it (`toGpui`, on the next frame: the engine scrolls by the
   * fewest pixels, as `{ inline: "nearest", block: "nearest" }`, whatever the options). */
  scrollIntoView() {
    this.ownerDocument && (this.ownerDocument.scrollTarget = this);
  }
}
class sh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class ch {
  constructor(i = {}) {
    this.map = new Map(Object.entries(i));
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(i) {
    return this.map.has(i) ? this.map.get(i) : null;
  }
  setItem(i, o) {
    this.map.set(i, String(o));
  }
  removeItem(i) {
    this.map.delete(i);
  }
  clear() {
    this.map.clear();
  }
}
function Wu(n) {
  for (let i = n; i instanceof ke; i = i.parentElement) i.touch();
}
class uh extends Xo {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new ke("html", {}, this), this.body = new ke("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new ke(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Wu(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, Wu(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return fl(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(i) {
    return fl(this.documentElement, "*").find((o) => o.props?.id === i) ?? null;
  }
}
class dh extends Xo {
  constructor(i, o) {
    super(), this.perch = i, this.document = o, this.location = { get hostname() {
      return i.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(i, o, ...s) {
    return globalThis.setTimeout(i, o, ...s);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function Yd(n) {
  return {
    setTimeout: (i, o = 0, ...s) => n.setTimeout(() => i(...s), Math.max(0, Number(o) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
const Fu = Symbol.for("perch.react.globals");
function qe(n, i, o) {
  Object.defineProperty(n, i, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function mh(n, i = globalThis) {
  const o = new uh(n), s = new dh(n, o);
  o.defaultView = s;
  const c = n.storage ?? new ch();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = Yd(n);
    qe(i, "setTimeout", f.setTimeout), qe(i, "clearTimeout", f.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && qe(i, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), qe(i, "requestAnimationFrame", (f) => i.setTimeout(() => f(Date.now()), 0)), qe(i, "cancelAnimationFrame", (f) => i.clearTimeout(f));
  const d = { document: o, window: s, localStorage: c };
  for (const f of Object.keys(d))
    Object.defineProperty(i, f, { get: () => i[Fu]?.[f], configurable: !0, enumerable: !1 });
  i[Fu] = d, qe(i, "HTMLElement", ke), qe(i, "Element", ke), qe(i, "DOMRect", jo), typeof i.ResizeObserver != "function" && qe(i, "ResizeObserver", sh);
  const p = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      qe(p, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || qe(i, "navigator", p), { document: o, window: s, globals: d };
}
function Mo(n, i = !1) {
  if (!(i ? n?.tagName === "input" && Gd(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let s = n.parentElement; s; s = s.parentElement) if (s.tagName === "form") return s;
  return null;
}
const Gd = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Iu = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Iu?.setTimeout == "function") {
  const n = Yd(Iu);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Jo(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var wo = { exports: {} }, ut = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var $u;
function fh() {
  if ($u) return ut;
  $u = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), _ = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), A = Symbol.for("react.lazy"), H = Symbol.for("react.activity"), k = Symbol.iterator;
  function b(v) {
    return v === null || typeof v != "object" ? null : (v = k && v[k] || v["@@iterator"], typeof v == "function" ? v : null);
  }
  var S = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, w = Object.assign, z = {};
  function q(v, G, tt) {
    this.props = v, this.context = G, this.refs = z, this.updater = tt || S;
  }
  q.prototype.isReactComponent = {}, q.prototype.setState = function(v, G) {
    if (typeof v != "object" && typeof v != "function" && v != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, v, G, "setState");
  }, q.prototype.forceUpdate = function(v) {
    this.updater.enqueueForceUpdate(this, v, "forceUpdate");
  };
  function E() {
  }
  E.prototype = q.prototype;
  function N(v, G, tt) {
    this.props = v, this.context = G, this.refs = z, this.updater = tt || S;
  }
  var j = N.prototype = new E();
  j.constructor = N, w(j, q.prototype), j.isPureReactComponent = !0;
  var D = Array.isArray;
  function T() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function U(v, G, tt) {
    var $ = tt.ref;
    return {
      $$typeof: n,
      type: v,
      key: G,
      ref: $ !== void 0 ? $ : null,
      props: tt
    };
  }
  function J(v, G) {
    return U(v.type, G, v.props);
  }
  function at(v) {
    return typeof v == "object" && v !== null && v.$$typeof === n;
  }
  function et(v) {
    var G = { "=": "=0", ":": "=2" };
    return "$" + v.replace(/[=:]/g, function(tt) {
      return G[tt];
    });
  }
  var Mt = /\/+/g;
  function Kt(v, G) {
    return typeof v == "object" && v !== null && v.key != null ? et("" + v.key) : G.toString(36);
  }
  function Tt(v) {
    switch (v.status) {
      case "fulfilled":
        return v.value;
      case "rejected":
        throw v.reason;
      default:
        switch (typeof v.status == "string" ? v.then(T, T) : (v.status = "pending", v.then(
          function(G) {
            v.status === "pending" && (v.status = "fulfilled", v.value = G);
          },
          function(G) {
            v.status === "pending" && (v.status = "rejected", v.reason = G);
          }
        )), v.status) {
          case "fulfilled":
            return v.value;
          case "rejected":
            throw v.reason;
        }
    }
    throw v;
  }
  function K(v, G, tt, $, P) {
    var it = typeof v;
    (it === "undefined" || it === "boolean") && (v = null);
    var xt = !1;
    if (v === null) xt = !0;
    else
      switch (it) {
        case "bigint":
        case "string":
        case "number":
          xt = !0;
          break;
        case "object":
          switch (v.$$typeof) {
            case n:
            case i:
              xt = !0;
              break;
            case A:
              return xt = v._init, K(
                xt(v._payload),
                G,
                tt,
                $,
                P
              );
          }
      }
    if (xt)
      return P = P(v), xt = $ === "" ? "." + Kt(v, 0) : $, D(P) ? (tt = "", xt != null && (tt = xt.replace(Mt, "$&/") + "/"), K(P, G, tt, "", function(Oa) {
        return Oa;
      })) : P != null && (at(P) && (P = J(
        P,
        tt + (P.key == null || v && v.key === P.key ? "" : ("" + P.key).replace(
          Mt,
          "$&/"
        ) + "/") + xt
      )), G.push(P)), 1;
    xt = 0;
    var Jt = $ === "" ? "." : $ + ":";
    if (D(v))
      for (var dt = 0; dt < v.length; dt++)
        $ = v[dt], it = Jt + Kt($, dt), xt += K(
          $,
          G,
          tt,
          it,
          P
        );
    else if (dt = b(v), typeof dt == "function")
      for (v = dt.call(v), dt = 0; !($ = v.next()).done; )
        $ = $.value, it = Jt + Kt($, dt++), xt += K(
          $,
          G,
          tt,
          it,
          P
        );
    else if (it === "object") {
      if (typeof v.then == "function")
        return K(
          Tt(v),
          G,
          tt,
          $,
          P
        );
      throw G = String(v), Error(
        "Objects are not valid as a React child (found: " + (G === "[object Object]" ? "object with keys {" + Object.keys(v).join(", ") + "}" : G) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return xt;
  }
  function nt(v, G, tt) {
    if (v == null) return v;
    var $ = [], P = 0;
    return K(v, $, "", "", function(it) {
      return G.call(tt, it, P++);
    }), $;
  }
  function lt(v) {
    if (v._status === -1) {
      var G = v._result;
      G = G(), G.then(
        function(tt) {
          (v._status === 0 || v._status === -1) && (v._status = 1, v._result = tt);
        },
        function(tt) {
          (v._status === 0 || v._status === -1) && (v._status = 2, v._result = tt);
        }
      ), v._status === -1 && (v._status = 0, v._result = G);
    }
    if (v._status === 1) return v._result.default;
    throw v._result;
  }
  var B = typeof reportError == "function" ? reportError : function(v) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var G = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof v == "object" && v !== null && typeof v.message == "string" ? String(v.message) : String(v),
        error: v
      });
      if (!window.dispatchEvent(G)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", v);
      return;
    }
    console.error(v);
  }, Y = {
    map: nt,
    forEach: function(v, G, tt) {
      nt(
        v,
        function() {
          G.apply(this, arguments);
        },
        tt
      );
    },
    count: function(v) {
      var G = 0;
      return nt(v, function() {
        G++;
      }), G;
    },
    toArray: function(v) {
      return nt(v, function(G) {
        return G;
      }) || [];
    },
    only: function(v) {
      if (!at(v))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return v;
    }
  };
  return ut.Activity = H, ut.Children = Y, ut.Component = q, ut.Fragment = o, ut.Profiler = c, ut.PureComponent = N, ut.StrictMode = s, ut.Suspense = _, ut.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, ut.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(v) {
      return g.H.useMemoCache(v);
    }
  }, ut.cache = function(v) {
    return function() {
      return v.apply(null, arguments);
    };
  }, ut.cacheSignal = function() {
    return null;
  }, ut.cloneElement = function(v, G, tt) {
    if (v == null)
      throw Error(
        "The argument must be a React element, but you passed " + v + "."
      );
    var $ = w({}, v.props), P = v.key;
    if (G != null)
      for (it in G.key !== void 0 && (P = "" + G.key), G)
        !h.call(G, it) || it === "key" || it === "__self" || it === "__source" || it === "ref" && G.ref === void 0 || ($[it] = G[it]);
    var it = arguments.length - 2;
    if (it === 1) $.children = tt;
    else if (1 < it) {
      for (var xt = Array(it), Jt = 0; Jt < it; Jt++)
        xt[Jt] = arguments[Jt + 2];
      $.children = xt;
    }
    return U(v.type, P, $);
  }, ut.createContext = function(v) {
    return v = {
      $$typeof: p,
      _currentValue: v,
      _currentValue2: v,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, v.Provider = v, v.Consumer = {
      $$typeof: d,
      _context: v
    }, v;
  }, ut.createElement = function(v, G, tt) {
    var $, P = {}, it = null;
    if (G != null)
      for ($ in G.key !== void 0 && (it = "" + G.key), G)
        h.call(G, $) && $ !== "key" && $ !== "__self" && $ !== "__source" && (P[$] = G[$]);
    var xt = arguments.length - 2;
    if (xt === 1) P.children = tt;
    else if (1 < xt) {
      for (var Jt = Array(xt), dt = 0; dt < xt; dt++)
        Jt[dt] = arguments[dt + 2];
      P.children = Jt;
    }
    if (v && v.defaultProps)
      for ($ in xt = v.defaultProps, xt)
        P[$] === void 0 && (P[$] = xt[$]);
    return U(v, it, P);
  }, ut.createRef = function() {
    return { current: null };
  }, ut.forwardRef = function(v) {
    return { $$typeof: f, render: v };
  }, ut.isValidElement = at, ut.lazy = function(v) {
    return {
      $$typeof: A,
      _payload: { _status: -1, _result: v },
      _init: lt
    };
  }, ut.memo = function(v, G) {
    return {
      $$typeof: x,
      type: v,
      compare: G === void 0 ? null : G
    };
  }, ut.startTransition = function(v) {
    var G = g.T, tt = {};
    g.T = tt;
    try {
      var $ = v(), P = g.S;
      P !== null && P(tt, $), typeof $ == "object" && $ !== null && typeof $.then == "function" && $.then(T, B);
    } catch (it) {
      B(it);
    } finally {
      G !== null && tt.types !== null && (G.types = tt.types), g.T = G;
    }
  }, ut.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, ut.use = function(v) {
    return g.H.use(v);
  }, ut.useActionState = function(v, G, tt) {
    return g.H.useActionState(v, G, tt);
  }, ut.useCallback = function(v, G) {
    return g.H.useCallback(v, G);
  }, ut.useContext = function(v) {
    return g.H.useContext(v);
  }, ut.useDebugValue = function() {
  }, ut.useDeferredValue = function(v, G) {
    return g.H.useDeferredValue(v, G);
  }, ut.useEffect = function(v, G) {
    return g.H.useEffect(v, G);
  }, ut.useEffectEvent = function(v) {
    return g.H.useEffectEvent(v);
  }, ut.useId = function() {
    return g.H.useId();
  }, ut.useImperativeHandle = function(v, G, tt) {
    return g.H.useImperativeHandle(v, G, tt);
  }, ut.useInsertionEffect = function(v, G) {
    return g.H.useInsertionEffect(v, G);
  }, ut.useLayoutEffect = function(v, G) {
    return g.H.useLayoutEffect(v, G);
  }, ut.useMemo = function(v, G) {
    return g.H.useMemo(v, G);
  }, ut.useOptimistic = function(v, G) {
    return g.H.useOptimistic(v, G);
  }, ut.useReducer = function(v, G, tt) {
    return g.H.useReducer(v, G, tt);
  }, ut.useRef = function(v) {
    return g.H.useRef(v);
  }, ut.useState = function(v) {
    return g.H.useState(v);
  }, ut.useSyncExternalStore = function(v, G, tt) {
    return g.H.useSyncExternalStore(
      v,
      G,
      tt
    );
  }, ut.useTransition = function() {
    return g.H.useTransition();
  }, ut.version = "19.2.8", ut;
}
var Pu;
function Qd() {
  return Pu || (Pu = 1, wo.exports = fh()), wo.exports;
}
var ct = Qd();
const ph = /* @__PURE__ */ Jo(ct), uv = /* @__PURE__ */ Dd({
  __proto__: null,
  default: ph
}, [ct]);
var _o = { exports: {} }, ul = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var td;
function hh() {
  if (td) return ul;
  td = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function o(s, c, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), c.key !== void 0 && (p = "" + c.key), "key" in c) {
      d = {};
      for (var f in c)
        f !== "key" && (d[f] = c[f]);
    } else d = c;
    return c = d.ref, {
      $$typeof: n,
      type: s,
      key: p,
      ref: c !== void 0 ? c : null,
      props: d
    };
  }
  return ul.Fragment = i, ul.jsx = o, ul.jsxs = o, ul;
}
var ed;
function gh() {
  return ed || (ed = 1, _o.exports = hh()), _o.exports;
}
var kt = gh();
const bh = /* @__PURE__ */ Jo(kt), dv = /* @__PURE__ */ Dd({
  __proto__: null,
  default: bh
}, [kt]);
var So = { exports: {} }, ko = { exports: {} }, zo = { exports: {} }, Eo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ad;
function vh() {
  return ad || (ad = 1, (function(n) {
    function i(K, nt) {
      var lt = K.length;
      K.push(nt);
      t: for (; 0 < lt; ) {
        var B = lt - 1 >>> 1, Y = K[B];
        if (0 < c(Y, nt))
          K[B] = nt, K[lt] = Y, lt = B;
        else break t;
      }
    }
    function o(K) {
      return K.length === 0 ? null : K[0];
    }
    function s(K) {
      if (K.length === 0) return null;
      var nt = K[0], lt = K.pop();
      if (lt !== nt) {
        K[0] = lt;
        t: for (var B = 0, Y = K.length, v = Y >>> 1; B < v; ) {
          var G = 2 * (B + 1) - 1, tt = K[G], $ = G + 1, P = K[$];
          if (0 > c(tt, lt))
            $ < Y && 0 > c(P, tt) ? (K[B] = P, K[$] = lt, B = $) : (K[B] = tt, K[G] = lt, B = G);
          else if ($ < Y && 0 > c(P, lt))
            K[B] = P, K[$] = lt, B = $;
          else break t;
        }
      }
      return nt;
    }
    function c(K, nt) {
      var lt = K.sortIndex - nt.sortIndex;
      return lt !== 0 ? lt : K.id - nt.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      n.unstable_now = function() {
        return d.now();
      };
    } else {
      var p = Date, f = p.now();
      n.unstable_now = function() {
        return p.now() - f;
      };
    }
    var _ = [], x = [], A = 1, H = null, k = 3, b = !1, S = !1, w = !1, z = !1, q = typeof setTimeout == "function" ? setTimeout : null, E = typeof clearTimeout == "function" ? clearTimeout : null, N = typeof setImmediate < "u" ? setImmediate : null;
    function j(K) {
      for (var nt = o(x); nt !== null; ) {
        if (nt.callback === null) s(x);
        else if (nt.startTime <= K)
          s(x), nt.sortIndex = nt.expirationTime, i(_, nt);
        else break;
        nt = o(x);
      }
    }
    function D(K) {
      if (w = !1, j(K), !S)
        if (o(_) !== null)
          S = !0, T || (T = !0, et());
        else {
          var nt = o(x);
          nt !== null && Tt(D, nt.startTime - K);
        }
    }
    var T = !1, g = -1, h = 5, U = -1;
    function J() {
      return z ? !0 : !(n.unstable_now() - U < h);
    }
    function at() {
      if (z = !1, T) {
        var K = n.unstable_now();
        U = K;
        var nt = !0;
        try {
          t: {
            S = !1, w && (w = !1, E(g), g = -1), b = !0;
            var lt = k;
            try {
              e: {
                for (j(K), H = o(_); H !== null && !(H.expirationTime > K && J()); ) {
                  var B = H.callback;
                  if (typeof B == "function") {
                    H.callback = null, k = H.priorityLevel;
                    var Y = B(
                      H.expirationTime <= K
                    );
                    if (K = n.unstable_now(), typeof Y == "function") {
                      H.callback = Y, j(K), nt = !0;
                      break e;
                    }
                    H === o(_) && s(_), j(K);
                  } else s(_);
                  H = o(_);
                }
                if (H !== null) nt = !0;
                else {
                  var v = o(x);
                  v !== null && Tt(
                    D,
                    v.startTime - K
                  ), nt = !1;
                }
              }
              break t;
            } finally {
              H = null, k = lt, b = !1;
            }
            nt = void 0;
          }
        } finally {
          nt ? et() : T = !1;
        }
      }
    }
    var et;
    if (typeof N == "function")
      et = function() {
        N(at);
      };
    else if (typeof MessageChannel < "u") {
      var Mt = new MessageChannel(), Kt = Mt.port2;
      Mt.port1.onmessage = at, et = function() {
        Kt.postMessage(null);
      };
    } else
      et = function() {
        q(at, 0);
      };
    function Tt(K, nt) {
      g = q(function() {
        K(n.unstable_now());
      }, nt);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(K) {
      K.callback = null;
    }, n.unstable_forceFrameRate = function(K) {
      0 > K || 125 < K ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < K ? Math.floor(1e3 / K) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return k;
    }, n.unstable_next = function(K) {
      switch (k) {
        case 1:
        case 2:
        case 3:
          var nt = 3;
          break;
        default:
          nt = k;
      }
      var lt = k;
      k = nt;
      try {
        return K();
      } finally {
        k = lt;
      }
    }, n.unstable_requestPaint = function() {
      z = !0;
    }, n.unstable_runWithPriority = function(K, nt) {
      switch (K) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          K = 3;
      }
      var lt = k;
      k = K;
      try {
        return nt();
      } finally {
        k = lt;
      }
    }, n.unstable_scheduleCallback = function(K, nt, lt) {
      var B = n.unstable_now();
      switch (typeof lt == "object" && lt !== null ? (lt = lt.delay, lt = typeof lt == "number" && 0 < lt ? B + lt : B) : lt = B, K) {
        case 1:
          var Y = -1;
          break;
        case 2:
          Y = 250;
          break;
        case 5:
          Y = 1073741823;
          break;
        case 4:
          Y = 1e4;
          break;
        default:
          Y = 5e3;
      }
      return Y = lt + Y, K = {
        id: A++,
        callback: nt,
        priorityLevel: K,
        startTime: lt,
        expirationTime: Y,
        sortIndex: -1
      }, lt > B ? (K.sortIndex = lt, i(x, K), o(_) === null && K === o(x) && (w ? (E(g), g = -1) : w = !0, Tt(D, lt - B))) : (K.sortIndex = Y, i(_, K), S || b || (S = !0, T || (T = !0, et()))), K;
    }, n.unstable_shouldYield = J, n.unstable_wrapCallback = function(K) {
      var nt = k;
      return function() {
        var lt = k;
        k = nt;
        try {
          return K.apply(this, arguments);
        } finally {
          k = lt;
        }
      };
    };
  })(Eo)), Eo;
}
var nd;
function yh() {
  return nd || (nd = 1, zo.exports = vh()), zo.exports;
}
/**
 * @license React
 * react-reconciler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ld;
function xh() {
  return ld || (ld = 1, (function(n) {
    n.exports = function(i) {
      function o(t, e, a, l) {
        return new nf(t, e, a, l);
      }
      function s() {
      }
      function c(t) {
        var e = "https://react.dev/errors/" + t;
        if (1 < arguments.length) {
          e += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var a = 2; a < arguments.length; a++)
            e += "&args[]=" + encodeURIComponent(arguments[a]);
        }
        return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function d(t) {
        var e = t, a = t;
        if (t.alternate) for (; e.return; ) e = e.return;
        else {
          t = e;
          do
            e = t, (e.flags & 4098) !== 0 && (a = e.return), t = e.return;
          while (t);
        }
        return e.tag === 3 ? a : null;
      }
      function p(t) {
        if (d(t) !== t)
          throw Error(c(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(c(188));
          return e !== t ? null : t;
        }
        for (var a = t, l = e; ; ) {
          var r = a.return;
          if (r === null) break;
          var u = r.alternate;
          if (u === null) {
            if (l = r.return, l !== null) {
              a = l;
              continue;
            }
            break;
          }
          if (r.child === u.child) {
            for (u = r.child; u; ) {
              if (u === a) return p(r), t;
              if (u === l) return p(r), e;
              u = u.sibling;
            }
            throw Error(c(188));
          }
          if (a.return !== l.return) a = r, l = u;
          else {
            for (var m = !1, y = r.child; y; ) {
              if (y === a) {
                m = !0, a = r, l = u;
                break;
              }
              if (y === l) {
                m = !0, l = r, a = u;
                break;
              }
              y = y.sibling;
            }
            if (!m) {
              for (y = u.child; y; ) {
                if (y === a) {
                  m = !0, a = u, l = r;
                  break;
                }
                if (y === l) {
                  m = !0, l = u, a = r;
                  break;
                }
                y = y.sibling;
              }
              if (!m) throw Error(c(189));
            }
          }
          if (a.alternate !== l) throw Error(c(190));
        }
        if (a.tag !== 3) throw Error(c(188));
        return a.stateNode.current === a ? t : e;
      }
      function _(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = _(t), e !== null) return e;
          t = t.sibling;
        }
        return null;
      }
      function x(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = x(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function A(t) {
        return t === null || typeof t != "object" ? null : (t = fu && t[fu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function H(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === cf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case dn:
            return "Fragment";
          case Yr:
            return "Profiler";
          case du:
            return "StrictMode";
          case Qr:
            return "Suspense";
          case Kr:
            return "SuspenseList";
          case Xr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case un:
              return "Portal";
            case va:
              return t.displayName || "Context";
            case mu:
              return (t._context.displayName || "Context") + ".Consumer";
            case Gr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Vr:
              return e = t.displayName || null, e !== null ? e : H(t.type) || "Memo";
            case ya:
              e = t._payload, t = t._init;
              try {
                return H(t(e));
              } catch {
              }
          }
        return null;
      }
      function k(t) {
        return { current: t };
      }
      function b(t) {
        0 > pn || (t.current = Ir[pn], Ir[pn] = null, pn--);
      }
      function S(t, e) {
        pn++, Ir[pn] = t.current, t.current = e;
      }
      function w(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Up(t) / Bp | 0) | 0;
      }
      function z(t) {
        var e = t & 42;
        if (e !== 0) return e;
        switch (t & -t) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
            return 64;
          case 128:
            return 128;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
            return t & 261888;
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return t & 3932160;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return t & 62914560;
          case 67108864:
            return 67108864;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 0;
          default:
            return t;
        }
      }
      function q(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, u = t.suspendedLanes, m = t.pingedLanes;
        t = t.warmLanes;
        var y = l & 134217727;
        return y !== 0 ? (l = y & ~u, l !== 0 ? r = z(l) : (m &= y, m !== 0 ? r = z(m) : a || (a = y & ~t, a !== 0 && (r = z(a))))) : (y = l & ~u, y !== 0 ? r = z(y) : m !== 0 ? r = z(m) : a || (a = l & ~t, a !== 0 && (r = z(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function E(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function N(t, e) {
        switch (t) {
          case 1:
          case 2:
          case 4:
          case 8:
          case 64:
            return e + 250;
          case 16:
          case 32:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return e + 5e3;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return -1;
          case 67108864:
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function j() {
        var t = Wl;
        return Wl <<= 1, (Wl & 62914560) === 0 && (Wl = 4194304), t;
      }
      function D(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function T(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, a, l, r, u) {
        var m = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var y = t.entanglements, R = t.expirationTimes, Q = t.hiddenUpdates;
        for (a = m & ~a; 0 < a; ) {
          var Z = 31 - ge(a), V = 1 << Z;
          y[Z] = 0, R[Z] = -1;
          var L = Q[Z];
          if (L !== null)
            for (Q[Z] = null, Z = 0; Z < L.length; Z++) {
              var mt = L[Z];
              mt !== null && (mt.lane &= -536870913);
            }
          a &= ~V;
        }
        l !== 0 && h(t, l, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(m & ~e));
      }
      function h(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var l = 31 - ge(e);
        t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | a & 261930;
      }
      function U(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var l = 31 - ge(a), r = 1 << l;
          r & e | t[l] & e && (t[l] |= e), a &= ~r;
        }
      }
      function J(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : at(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function at(t) {
        switch (t) {
          case 2:
            t = 1;
            break;
          case 8:
            t = 4;
            break;
          case 32:
            t = 16;
            break;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            t = 128;
            break;
          case 268435456:
            t = 134217728;
            break;
          default:
            t = 0;
        }
        return t;
      }
      function et(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function Mt(t) {
        if (typeof Kp == "function" && Vp(t), be && typeof be.setStrictMode == "function")
          try {
            be.setStrictMode($n, t);
          } catch {
          }
      }
      function Kt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Tt(t) {
        if (to === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            to = e && e[1] || "", qu = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + to + t + qu;
      }
      function K(t, e) {
        if (!t || eo) return "";
        eo = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var l = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var V = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(V.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(V, []);
                    } catch (mt) {
                      var L = mt;
                    }
                    Reflect.construct(t, [], V);
                  } else {
                    try {
                      V.call();
                    } catch (mt) {
                      L = mt;
                    }
                    t.call(V.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (mt) {
                    L = mt;
                  }
                  (V = t()) && typeof V.catch == "function" && V.catch(function() {
                  });
                }
              } catch (mt) {
                if (mt && L && typeof mt.stack == "string")
                  return [mt.stack, L.stack];
              }
              return [null, null];
            }
          };
          l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var r = Object.getOwnPropertyDescriptor(
            l.DetermineComponentFrameRoot,
            "name"
          );
          r && r.configurable && Object.defineProperty(
            l.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var u = l.DetermineComponentFrameRoot(), m = u[0], y = u[1];
          if (m && y) {
            var R = m.split(`
`), Q = y.split(`
`);
            for (r = l = 0; l < R.length && !R[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < Q.length && !Q[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === R.length || r === Q.length)
              for (l = R.length - 1, r = Q.length - 1; 1 <= l && 0 <= r && R[l] !== Q[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (R[l] !== Q[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || R[l] !== Q[r]) {
                      var Z = `
` + R[l].replace(" at new ", " at ");
                      return t.displayName && Z.includes("<anonymous>") && (Z = Z.replace("<anonymous>", t.displayName)), Z;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          eo = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? Tt(a) : "";
      }
      function nt(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return Tt(t.type);
          case 16:
            return Tt("Lazy");
          case 13:
            return t.child !== e && e !== null ? Tt("Suspense Fallback") : Tt("Suspense");
          case 19:
            return Tt("SuspenseList");
          case 0:
          case 15:
            return K(t.type, !1);
          case 11:
            return K(t.type.render, !1);
          case 1:
            return K(t.type, !0);
          case 31:
            return Tt("Activity");
          default:
            return "";
        }
      }
      function lt(t) {
        try {
          var e = "", a = null;
          do
            e += nt(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (l) {
          return `
Error generating stack: ` + l.message + `
` + l.stack;
        }
      }
      function B(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Yu.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: lt(e)
          }, Yu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: lt(e)
        };
      }
      function Y(t, e) {
        gn[bn++] = Pn, gn[bn++] = Il, Il = t, Pn = e;
      }
      function v(t, e, a) {
        ze[Ee++] = Ve, ze[Ee++] = Xe, ze[Ee++] = xa, xa = t;
        var l = Ve;
        t = Xe;
        var r = 32 - ge(l) - 1;
        l &= ~(1 << r), a += 1;
        var u = 32 - ge(e) + r;
        if (30 < u) {
          var m = r - r % 5;
          u = (l & (1 << m) - 1).toString(32), l >>= m, r -= m, Ve = 1 << 32 - ge(e) + r | a << r | l, Xe = u + t;
        } else
          Ve = 1 << u | a << r | l, Xe = t;
      }
      function G(t) {
        t.return !== null && (Y(t, 1), v(t, 1, 0));
      }
      function tt(t) {
        for (; t === Il; )
          Il = gn[--bn], gn[bn] = null, Pn = gn[--bn], gn[bn] = null;
        for (; t === xa; )
          xa = ze[--Ee], ze[Ee] = null, Xe = ze[--Ee], ze[Ee] = null, Ve = ze[--Ee], ze[Ee] = null;
      }
      function $(t, e) {
        ze[Ee++] = Ve, ze[Ee++] = Xe, ze[Ee++] = xa, Ve = e.id, Xe = e.overflow, xa = t;
      }
      function P(t, e) {
        S(wa, e), S(tl, t), S(Pt, null), t = mf(e), b(Pt), S(Pt, t);
      }
      function it() {
        b(Pt), b(tl), b(wa);
      }
      function xt(t) {
        t.memoizedState !== null && S($l, t);
        var e = Pt.current, a = ff(e, t.type);
        e !== a && (S(tl, t), S(Pt, a));
      }
      function Jt(t) {
        tl.current === t && (b(Pt), b(tl)), $l.current === t && (b($l), ta ? Ka._currentValue = mn : Ka._currentValue2 = mn);
      }
      function dt(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Rn(B(e, t)), ao;
      }
      function Oa(t, e) {
        if (!le) throw Error(c(175));
        fp(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || dt(t, !0);
      }
      function Ra(t) {
        for (te = t.return; te; )
          switch (te.tag) {
            case 5:
            case 31:
            case 13:
              Ne = !1;
              return;
            case 27:
            case 3:
              Ne = !0;
              return;
            default:
              te = te.return;
          }
      }
      function Ae(t) {
        if (!le || t !== te) return !1;
        if (!yt) return Ra(t), yt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Eu(t.type) && !Zl(t.type, t.memoizedProps)) && At && dt(t) : e !== 3 && (e !== 5 || Eu(t.type) && !Zl(t.type, t.memoizedProps)) && At && dt(t), Ra(t), e === 13) {
          if (!le) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          At = vp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          At = bp(t);
        } else
          At = Vt && e === 27 ? np(
            t.type,
            At
          ) : te ? zu(t.stateNode) : null;
        return !0;
      }
      function Oe() {
        le && (At = te = null, yt = !1);
      }
      function ua() {
        var t = _a;
        return t !== null && (de === null ? de = t : de.push.apply(
          de,
          t
        ), _a = null), t;
      }
      function Rn(t) {
        _a === null ? _a = [t] : _a.push(t);
      }
      function da(t, e, a) {
        ta ? (S(Pl, e._currentValue), e._currentValue = a) : (S(Pl, e._currentValue2), e._currentValue2 = a);
      }
      function Le(t) {
        var e = Pl.current;
        ta ? t._currentValue = e : t._currentValue2 = e, b(Pl);
      }
      function Ui(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Bi(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var m = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var y = u;
              u = r;
              for (var R = 0; R < e.length; R++)
                if (y.context === e[R]) {
                  u.lanes |= a, y = u.alternate, y !== null && (y.lanes |= a), Ui(
                    u.return,
                    a,
                    t
                  ), l || (m = null);
                  break t;
                }
              u = y.next;
            }
          } else if (r.tag === 18) {
            if (m = r.return, m === null) throw Error(c(341));
            m.lanes |= a, u = m.alternate, u !== null && (u.lanes |= a), Ui(m, a, t), m = null;
          } else m = r.child;
          if (m !== null) m.return = r;
          else
            for (m = r; m !== null; ) {
              if (m === t) {
                m = null;
                break;
              }
              if (r = m.sibling, r !== null) {
                r.return = m.return, m = r;
                break;
              }
              m = m.return;
            }
          r = m;
        }
      }
      function nn(t, e, a, l) {
        t = null;
        for (var r = e, u = !1; r !== null; ) {
          if (!u) {
            if ((r.flags & 524288) !== 0) u = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var m = r.alternate;
            if (m === null) throw Error(c(387));
            if (m = m.memoizedProps, m !== null) {
              var y = r.type;
              ve(r.pendingProps.value, m.value) || (t !== null ? t.push(y) : t = [y]);
            }
          } else if (r === $l.current) {
            if (m = r.alternate, m === null) throw Error(c(387));
            m.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ka) : t = [Ka]);
          }
          r = r.return;
        }
        t !== null && Bi(
          e,
          t,
          a,
          l
        ), e.flags |= 262144;
      }
      function hl(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ve(
            ta ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Ha(t) {
        Va = t, aa = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function It(t) {
        return Po(Va, t);
      }
      function gl(t, e) {
        return Va === null && Ha(t), Po(t, e);
      }
      function Po(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(c(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function qi() {
        return {
          controller: new Zp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Hn(t) {
        t.refCount--, t.refCount === 0 && Jp(Lp, function() {
          t.controller.abort();
        });
      }
      function bl() {
      }
      function Ge(t) {
        t !== vn && t.next === null && (vn === null ? ti = vn = t : vn = vn.next = t), ei = !0, no || (no = !0, Om());
      }
      function ln(t, e) {
        if (!lo && ei) {
          lo = !0;
          do
            for (var a = !1, l = ti; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var m = l.suspendedLanes, y = l.pingedLanes;
                  u = (1 << 31 - ge(42 | t) + 1) - 1, u &= r & ~(m & ~y), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, ls(l, u));
              } else
                u = vt, u = q(
                  l,
                  l === Ct ? u : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Qa
                ), (u & 3) === 0 || E(l, u) || (a = !0, ls(l, u));
              l = l.next;
            }
          while (a);
          lo = !1;
        }
      }
      function ts() {
        es();
      }
      function es() {
        ei = no = !1;
        var t = 0;
        Xa !== 0 && _f() && (t = Xa);
        for (var e = ce(), a = null, l = ti; l !== null; ) {
          var r = l.next, u = as(l, e);
          u === 0 ? (l.next = null, a === null ? ti = r : a.next = r, r === null && (vn = a)) : (a = l, (t !== 0 || (u & 3) !== 0) && (ei = !0)), l = r;
        }
        Xt !== 0 && Xt !== 5 || ln(t), Xa !== 0 && (Xa = 0);
      }
      function as(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var m = 31 - ge(u), y = 1 << m, R = r[m];
          R === -1 ? ((y & a) === 0 || (y & l) !== 0) && (r[m] = N(y, e)) : R <= e && (t.expiredLanes |= y), u &= ~y;
        }
        if (e = Ct, a = vt, a = q(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l = t.callbackNode, a === 0 || t === e && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && $r(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || E(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && $r(l), et(a)) {
            case 2:
            case 8:
              a = Gp;
              break;
            case 32:
              a = Pr;
              break;
            case 268435456:
              a = Qp;
              break;
            default:
              a = Pr;
          }
          return l = ns.bind(null, t), a = Fl(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && $r(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function ns(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Ln() && t.callbackNode !== a)
          return null;
        var l = vt;
        return l = q(
          t,
          t === Ct ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l === 0 ? null : (Yc(t, l, e), as(t, ce()), t.callbackNode != null && t.callbackNode === a ? ns.bind(null, t) : null);
      }
      function ls(t, e) {
        if (Ln()) return null;
        Yc(t, e, !0);
      }
      function Om() {
        Cf ? jf(function() {
          (gt & 6) !== 0 ? Fl(
            Uu,
            ts
          ) : es();
        }) : Fl(
          Uu,
          ts
        );
      }
      function Yi() {
        if (Xa === 0) {
          var t = yn;
          t === 0 && (t = Jl, Jl <<= 1, (Jl & 261888) === 0 && (Jl = 256)), Xa = t;
        }
        return Xa;
      }
      function Rm(t, e) {
        if (el === null) {
          var a = el = [];
          io = 0, yn = Yi(), xn = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return io++, e.then(is, is), e;
      }
      function is() {
        if (--io === 0 && el !== null) {
          xn !== null && (xn.status = "fulfilled");
          var t = el;
          el = null, yn = 0, xn = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Hm(t, e) {
        var a = [], l = {
          status: "pending",
          value: null,
          reason: null,
          then: function(r) {
            a.push(r);
          }
        };
        return t.then(
          function() {
            l.status = "fulfilled", l.value = e;
            for (var r = 0; r < a.length; r++) (0, a[r])(e);
          },
          function(r) {
            for (l.status = "rejected", l.reason = r, r = 0; r < a.length; r++)
              (0, a[r])(void 0);
          }
        ), l;
      }
      function Gi() {
        var t = Za.current;
        return t !== null ? t : Ct.pooledCache;
      }
      function vl(t, e) {
        e === null ? S(Za, Za.current) : S(Za, e.pool);
      }
      function rs() {
        var t = Gi();
        return t === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: t
        };
      }
      function yl(t, e) {
        if (ve(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), l = Object.keys(e);
        if (a.length !== l.length) return !1;
        for (l = 0; l < a.length; l++) {
          var r = a[l];
          if (!Xp.call(e, r) || !ve(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function os(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function ss(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(bl, bl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, us(t), t;
          default:
            if (typeof e.status == "string") e.then(bl, bl);
            else {
              if (t = Ct, t !== null && 100 < t.shellSuspendCounter)
                throw Error(c(482));
              t = e, t.status = "pending", t.then(
                function(l) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "fulfilled", r.value = l;
                  }
                },
                function(l) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "rejected", r.reason = l;
                  }
                }
              );
            }
            switch (e.status) {
              case "fulfilled":
                return e.value;
              case "rejected":
                throw t = e.reason, us(t), t;
            }
            throw Ja = e, wn;
        }
      }
      function Da(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ja = a, wn) : a;
        }
      }
      function cs() {
        if (Ja === null) throw Error(c(459));
        var t = Ja;
        return Ja = null, t;
      }
      function us(t) {
        if (t === wn || t === ai)
          throw Error(c(483));
      }
      function xl(t) {
        var e = al;
        return al += 1, _n === null && (_n = []), ss(_n, t, e);
      }
      function Dn(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function wl(t, e) {
        throw e.$$typeof === of ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
          c(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function ds(t) {
        function e(M, C) {
          if (t) {
            var O = M.deletions;
            O === null ? (M.deletions = [C], M.flags |= 16) : O.push(C);
          }
        }
        function a(M, C) {
          if (!t) return null;
          for (; C !== null; )
            e(M, C), C = C.sibling;
          return null;
        }
        function l(M) {
          for (var C = /* @__PURE__ */ new Map(); M !== null; )
            M.key !== null ? C.set(M.key, M) : C.set(M.index, M), M = M.sibling;
          return C;
        }
        function r(M, C) {
          return M = Pe(M, C), M.index = 0, M.sibling = null, M;
        }
        function u(M, C, O) {
          return M.index = O, t ? (O = M.alternate, O !== null ? (O = O.index, O < C ? (M.flags |= 67108866, C) : O) : (M.flags |= 67108866, C)) : (M.flags |= 1048576, C);
        }
        function m(M) {
          return t && M.alternate === null && (M.flags |= 67108866), M;
        }
        function y(M, C, O, X) {
          return C === null || C.tag !== 6 ? (C = Dr(O, M.mode, X), C.return = M, C) : (C = r(C, O), C.return = M, C);
        }
        function R(M, C, O, X) {
          var ot = O.type;
          return ot === dn ? Z(
            M,
            C,
            O.props.children,
            X,
            O.key
          ) : C !== null && (C.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === ya && Da(ot) === C.type) ? (C = r(C, O.props), Dn(C, O), C.return = M, C) : (C = Kl(
            O.type,
            O.key,
            O.props,
            null,
            M.mode,
            X
          ), Dn(C, O), C.return = M, C);
        }
        function Q(M, C, O, X) {
          return C === null || C.tag !== 4 || C.stateNode.containerInfo !== O.containerInfo || C.stateNode.implementation !== O.implementation ? (C = Ur(O, M.mode, X), C.return = M, C) : (C = r(C, O.children || []), C.return = M, C);
        }
        function Z(M, C, O, X, ot) {
          return C === null || C.tag !== 7 ? (C = Ga(
            O,
            M.mode,
            X,
            ot
          ), C.return = M, C) : (C = r(C, O), C.return = M, C);
        }
        function V(M, C, O) {
          if (typeof C == "string" && C !== "" || typeof C == "number" || typeof C == "bigint")
            return C = Dr(
              "" + C,
              M.mode,
              O
            ), C.return = M, C;
          if (typeof C == "object" && C !== null) {
            switch (C.$$typeof) {
              case Vl:
                return O = Kl(
                  C.type,
                  C.key,
                  C.props,
                  null,
                  M.mode,
                  O
                ), Dn(O, C), O.return = M, O;
              case un:
                return C = Ur(
                  C,
                  M.mode,
                  O
                ), C.return = M, C;
              case ya:
                return C = Da(C), V(M, C, O);
            }
            if (Xl(C) || A(C))
              return C = Ga(
                C,
                M.mode,
                O,
                null
              ), C.return = M, C;
            if (typeof C.then == "function")
              return V(M, xl(C), O);
            if (C.$$typeof === va)
              return V(
                M,
                gl(M, C),
                O
              );
            wl(M, C);
          }
          return null;
        }
        function L(M, C, O, X) {
          var ot = C !== null ? C.key : null;
          if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
            return ot !== null ? null : y(M, C, "" + O, X);
          if (typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case Vl:
                return O.key === ot ? R(M, C, O, X) : null;
              case un:
                return O.key === ot ? Q(M, C, O, X) : null;
              case ya:
                return O = Da(O), L(M, C, O, X);
            }
            if (Xl(O) || A(O))
              return ot !== null ? null : Z(M, C, O, X, null);
            if (typeof O.then == "function")
              return L(
                M,
                C,
                xl(O),
                X
              );
            if (O.$$typeof === va)
              return L(
                M,
                C,
                gl(M, O),
                X
              );
            wl(M, O);
          }
          return null;
        }
        function mt(M, C, O, X, ot) {
          if (typeof X == "string" && X !== "" || typeof X == "number" || typeof X == "bigint")
            return M = M.get(O) || null, y(C, M, "" + X, ot);
          if (typeof X == "object" && X !== null) {
            switch (X.$$typeof) {
              case Vl:
                return M = M.get(
                  X.key === null ? O : X.key
                ) || null, R(C, M, X, ot);
              case un:
                return M = M.get(
                  X.key === null ? O : X.key
                ) || null, Q(C, M, X, ot);
              case ya:
                return X = Da(X), mt(
                  M,
                  C,
                  O,
                  X,
                  ot
                );
            }
            if (Xl(X) || A(X))
              return M = M.get(O) || null, Z(C, M, X, ot, null);
            if (typeof X.then == "function")
              return mt(
                M,
                C,
                O,
                xl(X),
                ot
              );
            if (X.$$typeof === va)
              return mt(
                M,
                C,
                O,
                gl(C, X),
                ot
              );
            wl(C, X);
          }
          return null;
        }
        function ee(M, C, O, X) {
          for (var ot = null, Rt = null, st = C, _t = C = 0, Ft = null; st !== null && _t < O.length; _t++) {
            st.index > _t ? (Ft = st, st = null) : Ft = st.sibling;
            var St = L(
              M,
              st,
              O[_t],
              X
            );
            if (St === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && St.alternate === null && e(M, st), C = u(St, C, _t), Rt === null ? ot = St : Rt.sibling = St, Rt = St, st = Ft;
          }
          if (_t === O.length)
            return a(M, st), yt && Y(M, _t), ot;
          if (st === null) {
            for (; _t < O.length; _t++)
              st = V(M, O[_t], X), st !== null && (C = u(
                st,
                C,
                _t
              ), Rt === null ? ot = st : Rt.sibling = st, Rt = st);
            return yt && Y(M, _t), ot;
          }
          for (st = l(st); _t < O.length; _t++)
            Ft = mt(
              st,
              M,
              _t,
              O[_t],
              X
            ), Ft !== null && (t && Ft.alternate !== null && st.delete(
              Ft.key === null ? _t : Ft.key
            ), C = u(
              Ft,
              C,
              _t
            ), Rt === null ? ot = Ft : Rt.sibling = Ft, Rt = Ft);
          return t && st.forEach(function(Ta) {
            return e(M, Ta);
          }), yt && Y(M, _t), ot;
        }
        function cl(M, C, O, X) {
          if (O == null) throw Error(c(151));
          for (var ot = null, Rt = null, st = C, _t = C = 0, Ft = null, St = O.next(); st !== null && !St.done; _t++, St = O.next()) {
            st.index > _t ? (Ft = st, st = null) : Ft = st.sibling;
            var Ta = L(M, st, St.value, X);
            if (Ta === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Ta.alternate === null && e(M, st), C = u(Ta, C, _t), Rt === null ? ot = Ta : Rt.sibling = Ta, Rt = Ta, st = Ft;
          }
          if (St.done)
            return a(M, st), yt && Y(M, _t), ot;
          if (st === null) {
            for (; !St.done; _t++, St = O.next())
              St = V(M, St.value, X), St !== null && (C = u(
                St,
                C,
                _t
              ), Rt === null ? ot = St : Rt.sibling = St, Rt = St);
            return yt && Y(M, _t), ot;
          }
          for (st = l(st); !St.done; _t++, St = O.next())
            St = mt(
              st,
              M,
              _t,
              St.value,
              X
            ), St !== null && (t && St.alternate !== null && st.delete(St.key === null ? _t : St.key), C = u(St, C, _t), Rt === null ? ot = St : Rt.sibling = St, Rt = St);
          return t && st.forEach(function($p) {
            return e(M, $p);
          }), yt && Y(M, _t), ot;
        }
        function Ia(M, C, O, X) {
          if (typeof O == "object" && O !== null && O.type === dn && O.key === null && (O = O.props.children), typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case Vl:
                t: {
                  for (var ot = O.key; C !== null; ) {
                    if (C.key === ot) {
                      if (ot = O.type, ot === dn) {
                        if (C.tag === 7) {
                          a(
                            M,
                            C.sibling
                          ), X = r(
                            C,
                            O.props.children
                          ), X.return = M, M = X;
                          break t;
                        }
                      } else if (C.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === ya && Da(ot) === C.type) {
                        a(
                          M,
                          C.sibling
                        ), X = r(C, O.props), Dn(X, O), X.return = M, M = X;
                        break t;
                      }
                      a(M, C);
                      break;
                    } else e(M, C);
                    C = C.sibling;
                  }
                  O.type === dn ? (X = Ga(
                    O.props.children,
                    M.mode,
                    X,
                    O.key
                  ), X.return = M, M = X) : (X = Kl(
                    O.type,
                    O.key,
                    O.props,
                    null,
                    M.mode,
                    X
                  ), Dn(X, O), X.return = M, M = X);
                }
                return m(M);
              case un:
                t: {
                  for (ot = O.key; C !== null; ) {
                    if (C.key === ot)
                      if (C.tag === 4 && C.stateNode.containerInfo === O.containerInfo && C.stateNode.implementation === O.implementation) {
                        a(
                          M,
                          C.sibling
                        ), X = r(
                          C,
                          O.children || []
                        ), X.return = M, M = X;
                        break t;
                      } else {
                        a(M, C);
                        break;
                      }
                    else e(M, C);
                    C = C.sibling;
                  }
                  X = Ur(O, M.mode, X), X.return = M, M = X;
                }
                return m(M);
              case ya:
                return O = Da(O), Ia(
                  M,
                  C,
                  O,
                  X
                );
            }
            if (Xl(O))
              return ee(
                M,
                C,
                O,
                X
              );
            if (A(O)) {
              if (ot = A(O), typeof ot != "function")
                throw Error(c(150));
              return O = ot.call(O), cl(
                M,
                C,
                O,
                X
              );
            }
            if (typeof O.then == "function")
              return Ia(
                M,
                C,
                xl(O),
                X
              );
            if (O.$$typeof === va)
              return Ia(
                M,
                C,
                gl(M, O),
                X
              );
            wl(M, O);
          }
          return typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint" ? (O = "" + O, C !== null && C.tag === 6 ? (a(M, C.sibling), X = r(C, O), X.return = M, M = X) : (a(M, C), X = Dr(O, M.mode, X), X.return = M, M = X), m(M)) : a(M, C);
        }
        return function(M, C, O, X) {
          try {
            al = 0;
            var ot = Ia(
              M,
              C,
              O,
              X
            );
            return _n = null, ot;
          } catch (st) {
            if (st === wn || st === ai) throw st;
            var Rt = o(29, st, null, M.mode);
            return Rt.lanes = X, Rt.return = M, Rt;
          } finally {
          }
        };
      }
      function _l() {
        for (var t = Sn, e = oo = Sn = 0; e < t; ) {
          var a = Te[e];
          Te[e++] = null;
          var l = Te[e];
          Te[e++] = null;
          var r = Te[e];
          Te[e++] = null;
          var u = Te[e];
          if (Te[e++] = null, l !== null && r !== null) {
            var m = l.pending;
            m === null ? r.next = r : (r.next = m.next, m.next = r), l.pending = r;
          }
          u !== 0 && ms(a, r, u);
        }
      }
      function Sl(t, e, a, l) {
        Te[Sn++] = t, Te[Sn++] = e, Te[Sn++] = a, Te[Sn++] = l, oo |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Qi(t, e, a, l) {
        return Sl(t, e, a, l), kl(t);
      }
      function Ua(t, e) {
        return Sl(t, null, null, e), kl(t);
      }
      function ms(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, u = t.return; u !== null; )
          u.childLanes |= a, l = u.alternate, l !== null && (l.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - ge(a), t = u.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), u) : null;
      }
      function kl(t) {
        if (50 < sl)
          throw sl = 0, xo = null, Error(c(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Ki(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Vi(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function ma(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function fa(t, e, a) {
        var l = t.updateQueue;
        if (l === null) return null;
        if (l = l.shared, (gt & 2) !== 0) {
          var r = l.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = kl(t), ms(t, null, a), e;
        }
        return Sl(t, l, e, a), kl(t);
      }
      function Un(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, U(t, a);
        }
      }
      function Xi(t, e) {
        var a = t.updateQueue, l = t.alternate;
        if (l !== null && (l = l.updateQueue, a === l)) {
          var r = null, u = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var m = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              u === null ? r = u = m : u = u.next = m, a = a.next;
            } while (a !== null);
            u === null ? r = u = e : u = u.next = e;
          } else r = u = e;
          a = {
            baseState: l.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: u,
            shared: l.shared,
            callbacks: l.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Bn() {
        if (so) {
          var t = xn;
          if (t !== null) throw t;
        }
      }
      function qn(t, e, a, l) {
        so = !1;
        var r = t.updateQueue;
        Sa = !1;
        var u = r.firstBaseUpdate, m = r.lastBaseUpdate, y = r.shared.pending;
        if (y !== null) {
          r.shared.pending = null;
          var R = y, Q = R.next;
          R.next = null, m === null ? u = Q : m.next = Q, m = R;
          var Z = t.alternate;
          Z !== null && (Z = Z.updateQueue, y = Z.lastBaseUpdate, y !== m && (y === null ? Z.firstBaseUpdate = Q : y.next = Q, Z.lastBaseUpdate = R));
        }
        if (u !== null) {
          var V = r.baseState;
          m = 0, Z = Q = R = null, y = u;
          do {
            var L = y.lane & -536870913, mt = L !== y.lane;
            if (mt ? (vt & L) === L : (l & L) === L) {
              L !== 0 && L === yn && (so = !0), Z !== null && (Z = Z.next = {
                lane: 0,
                tag: y.tag,
                payload: y.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, cl = y;
                L = e;
                var Ia = a;
                switch (cl.tag) {
                  case 1:
                    if (ee = cl.payload, typeof ee == "function") {
                      V = ee.call(
                        Ia,
                        V,
                        L
                      );
                      break t;
                    }
                    V = ee;
                    break t;
                  case 3:
                    ee.flags = ee.flags & -65537 | 128;
                  case 0:
                    if (ee = cl.payload, L = typeof ee == "function" ? ee.call(Ia, V, L) : ee, L == null) break t;
                    V = qr({}, V, L);
                    break t;
                  case 2:
                    Sa = !0;
                }
              }
              L = y.callback, L !== null && (t.flags |= 64, mt && (t.flags |= 8192), mt = r.callbacks, mt === null ? r.callbacks = [L] : mt.push(L));
            } else
              mt = {
                lane: L,
                tag: y.tag,
                payload: y.payload,
                callback: y.callback,
                next: null
              }, Z === null ? (Q = Z = mt, R = V) : Z = Z.next = mt, m |= L;
            if (y = y.next, y === null) {
              if (y = r.shared.pending, y === null)
                break;
              mt = y, y = mt.next, mt.next = null, r.lastBaseUpdate = mt, r.shared.pending = null;
            }
          } while (!0);
          Z === null && (R = V), r.baseState = R, r.firstBaseUpdate = Q, r.lastBaseUpdate = Z, u === null && (r.shared.lanes = 0), za |= m, t.lanes = m, t.memoizedState = V;
        }
      }
      function fs(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function ps(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            fs(a[t], e);
      }
      function hs(t, e) {
        t = ia, S(li, t), S(kn, e), ia = t | e.baseLanes;
      }
      function Zi() {
        S(li, ia), S(kn, kn.current);
      }
      function Ji() {
        ia = li.current, b(kn), b(li);
      }
      function pa(t) {
        var e = t.alternate;
        S(Bt, Bt.current & 1), S(ye, t), Ce === null && (e === null || kn.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Li(t) {
        S(Bt, Bt.current), S(ye, t), Ce === null && (Ce = t);
      }
      function gs(t) {
        t.tag === 22 ? (S(Bt, Bt.current), S(ye, t), Ce === null && (Ce = t)) : ha();
      }
      function ha() {
        S(Bt, Bt.current), S(ye, ye.current);
      }
      function fe(t) {
        b(ye), Ce === t && (Ce = null), b(Bt);
      }
      function zl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Lr(a) || Wr(a)))
              return e;
          } else if (e.tag === 19 && (e.memoizedProps.revealOrder === "forwards" || e.memoizedProps.revealOrder === "backwards" || e.memoizedProps.revealOrder === "unstable_legacy-backwards" || e.memoizedProps.revealOrder === "together")) {
            if ((e.flags & 128) !== 0) return e;
          } else if (e.child !== null) {
            e.child.return = e, e = e.child;
            continue;
          }
          if (e === t) break;
          for (; e.sibling === null; ) {
            if (e.return === null || e.return === t) return null;
            e = e.return;
          }
          e.sibling.return = e.return, e = e.sibling;
        }
        return null;
      }
      function Ht() {
        throw Error(c(321));
      }
      function Wi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ve(t[a], e[a])) return !1;
        return !0;
      }
      function Fi(t, e, a, l, r, u) {
        return na = u, ft = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, rt.H = t === null || t.memoizedState === null ? Ku : co, Wa = !1, u = a(l, r), Wa = !1, zn && (u = vs(
          e,
          a,
          l,
          r
        )), bs(t), u;
      }
      function bs(t) {
        rt.H = ll;
        var e = Nt !== null && Nt.next !== null;
        if (na = 0, qt = Nt = ft = null, ii = !1, nl = 0, En = null, e) throw Error(c(300));
        t === null || Yt || (t = t.dependencies, t !== null && hl(t) && (Yt = !0));
      }
      function vs(t, e, a, l) {
        ft = t;
        var r = 0;
        do {
          if (zn && (En = null), nl = 0, zn = !1, 25 <= r) throw Error(c(301));
          if (r += 1, qt = Nt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          rt.H = Vu, u = e(a, l);
        } while (zn);
        return u;
      }
      function Dm() {
        var t = rt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Yn(e) : e, t = t.useState()[0], (Nt !== null ? Nt.memoizedState : null) !== t && (ft.flags |= 1024), e;
      }
      function Ii() {
        var t = ri !== 0;
        return ri = 0, t;
      }
      function $i(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Pi(t) {
        if (ii) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ii = !1;
        }
        na = 0, qt = Nt = ft = null, zn = !1, nl = ri = 0, En = null;
      }
      function re() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return qt === null ? ft.memoizedState = qt = t : qt = qt.next = t, qt;
      }
      function Ut() {
        if (Nt === null) {
          var t = ft.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Nt.next;
        var e = qt === null ? ft.memoizedState : qt.next;
        if (e !== null)
          qt = e, Nt = t;
        else {
          if (t === null)
            throw ft.alternate === null ? Error(c(467)) : Error(c(310));
          Nt = t, t = {
            memoizedState: Nt.memoizedState,
            baseState: Nt.baseState,
            baseQueue: Nt.baseQueue,
            queue: Nt.queue,
            next: null
          }, qt === null ? ft.memoizedState = qt = t : qt = qt.next = t;
        }
        return qt;
      }
      function El() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Yn(t) {
        var e = nl;
        return nl += 1, En === null && (En = []), t = ss(En, t, e), e = ft, (qt === null ? e.memoizedState : qt.next) === null && (e = e.alternate, rt.H = e === null || e.memoizedState === null ? Ku : co), t;
      }
      function Nl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Yn(t);
          if (t.$$typeof === va) return It(t);
        }
        throw Error(c(438, String(t)));
      }
      function tr(t) {
        var e = null, a = ft.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var l = ft.alternate;
          l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (e = {
            data: l.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = El(), ft.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = sf;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Tl(t) {
        var e = Ut();
        return er(e, Nt, t);
      }
      function er(t, e, a) {
        var l = t.queue;
        if (l === null) throw Error(c(311));
        l.lastRenderedReducer = a;
        var r = t.baseQueue, u = l.pending;
        if (u !== null) {
          if (r !== null) {
            var m = r.next;
            r.next = u.next, u.next = m;
          }
          e.baseQueue = r = u, l.pending = null;
        }
        if (u = t.baseState, r === null) t.memoizedState = u;
        else {
          e = r.next;
          var y = m = null, R = null, Q = e, Z = !1;
          do {
            var V = Q.lane & -536870913;
            if (V !== Q.lane ? (vt & V) === V : (na & V) === V) {
              var L = Q.revertLane;
              if (L === 0)
                R !== null && (R = R.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }), V === yn && (Z = !0);
              else if ((na & L) === L) {
                Q = Q.next, L === yn && (Z = !0);
                continue;
              } else
                V = {
                  lane: 0,
                  revertLane: Q.revertLane,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }, R === null ? (y = R = V, m = u) : R = R.next = V, ft.lanes |= L, za |= L;
              V = Q.action, Wa && a(u, V), u = Q.hasEagerState ? Q.eagerState : a(u, V);
            } else
              L = {
                lane: V,
                revertLane: Q.revertLane,
                gesture: Q.gesture,
                action: Q.action,
                hasEagerState: Q.hasEagerState,
                eagerState: Q.eagerState,
                next: null
              }, R === null ? (y = R = L, m = u) : R = R.next = L, ft.lanes |= V, za |= V;
            Q = Q.next;
          } while (Q !== null && Q !== e);
          if (R === null ? m = u : R.next = y, !ve(u, t.memoizedState) && (Yt = !0, Z && (a = xn, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = m, t.baseQueue = R, l.lastRenderedState = u;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function ar(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(c(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, u = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var m = r = r.next;
          do
            u = t(u, m.action), m = m.next;
          while (m !== r);
          ve(u, e.memoizedState) || (Yt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, l];
      }
      function ys(t, e, a) {
        var l = ft, r = Ut(), u = yt;
        if (u) {
          if (a === void 0)
            throw Error(c(407));
          a = a();
        } else a = e();
        var m = !ve(
          (Nt || r).memoizedState,
          a
        );
        if (m && (r.memoizedState = a, Yt = !0), r = r.queue, ir(_s.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || m || qt !== null && qt.memoizedState.tag & 1) {
          if (l.flags |= 2048, rn(
            9,
            { destroy: void 0 },
            ws.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), Ct === null) throw Error(c(349));
          u || (na & 127) !== 0 || xs(l, e, a);
        }
        return a;
      }
      function xs(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = ft.updateQueue, e === null ? (e = El(), ft.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function ws(t, e, a, l) {
        e.value = a, e.getSnapshot = l, Ss(e) && ks(t);
      }
      function _s(t, e, a) {
        return a(function() {
          Ss(e) && ks(t);
        });
      }
      function Ss(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ve(t, a);
        } catch {
          return !0;
        }
      }
      function ks(t) {
        var e = Ua(t, 2);
        e !== null && se(e, t, 2);
      }
      function nr(t) {
        var e = re();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Wa) {
            Mt(!0);
            try {
              a();
            } finally {
              Mt(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: We,
          lastRenderedState: t
        }, e;
      }
      function zs(t, e, a, l) {
        return t.baseState = a, er(
          t,
          Nt,
          typeof l == "function" ? l : We
        );
      }
      function Um(t, e, a, l, r) {
        if (Ml(t)) throw Error(c(485));
        if (t = e.action, t !== null) {
          var u = {
            payload: r,
            action: t,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(m) {
              u.listeners.push(m);
            }
          };
          rt.T !== null ? a(!0) : u.isTransition = !1, l(u), a = e.pending, a === null ? (u.next = e.pending = u, Es(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function Es(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var u = rt.T, m = {};
          rt.T = m;
          try {
            var y = a(r, l), R = rt.S;
            R !== null && R(m, y), Ns(t, e, y);
          } catch (Q) {
            lr(t, e, Q);
          } finally {
            u !== null && m.types !== null && (u.types = m.types), rt.T = u;
          }
        } else
          try {
            u = a(r, l), Ns(t, e, u);
          } catch (Q) {
            lr(t, e, Q);
          }
      }
      function Ns(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            Ts(t, e, l);
          },
          function(l) {
            return lr(t, e, l);
          }
        ) : Ts(t, e, a);
      }
      function Ts(t, e, a) {
        e.status = "fulfilled", e.value = a, Cs(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Es(t, a)));
      }
      function lr(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, Cs(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function Cs(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function js(t, e) {
        return e;
      }
      function Ms(t, e) {
        if (yt) {
          var a = Ct.formState;
          if (a !== null) {
            t: {
              var l = ft;
              if (yt) {
                if (At) {
                  var r = ep(
                    At,
                    Ne
                  );
                  if (r) {
                    At = zu(r), l = ap(r);
                    break t;
                  }
                }
                dt(l);
              }
              l = !1;
            }
            l && (e = a[0]);
          }
        }
        a = re(), a.memoizedState = a.baseState = e, l = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: js,
          lastRenderedState: e
        }, a.queue = l, a = Ws.bind(
          null,
          ft,
          l
        ), l.dispatch = a, l = nr(!1);
        var u = cr.bind(
          null,
          ft,
          !1,
          l.queue
        );
        return l = re(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = Um.bind(
          null,
          ft,
          r,
          u,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function As(t) {
        var e = Ut();
        return Os(e, Nt, t);
      }
      function Os(t, e, a) {
        if (e = er(
          t,
          e,
          js
        )[0], t = Tl(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Yn(e);
          } catch (m) {
            throw m === wn ? ai : m;
          }
        else l = e;
        e = Ut();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (ft.flags |= 2048, rn(
          9,
          { destroy: void 0 },
          Bm.bind(null, r, a),
          null
        )), [l, u, t];
      }
      function Bm(t, e) {
        t.action = e;
      }
      function Rs(t) {
        var e = Ut(), a = Nt;
        if (a !== null)
          return Os(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function rn(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = ft.updateQueue, e === null && (e = El(), ft.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function Hs() {
        return Ut().memoizedState;
      }
      function Cl(t, e, a, l) {
        var r = re();
        ft.flags |= t, r.memoizedState = rn(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function jl(t, e, a, l) {
        var r = Ut();
        l = l === void 0 ? null : l;
        var u = r.memoizedState.inst;
        Nt !== null && l !== null && Wi(l, Nt.memoizedState.deps) ? r.memoizedState = rn(e, u, a, l) : (ft.flags |= t, r.memoizedState = rn(
          1 | e,
          u,
          a,
          l
        ));
      }
      function Ds(t, e) {
        Cl(8390656, 8, t, e);
      }
      function ir(t, e) {
        jl(2048, 8, t, e);
      }
      function qm(t) {
        ft.flags |= 4;
        var e = ft.updateQueue;
        if (e === null)
          e = El(), ft.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Us(t) {
        var e = Ut().memoizedState;
        return qm({ ref: e, nextImpl: t }), function() {
          if ((gt & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Bs(t, e) {
        return jl(4, 2, t, e);
      }
      function qs(t, e) {
        return jl(4, 4, t, e);
      }
      function Ys(t, e) {
        if (typeof e == "function") {
          t = t();
          var a = e(t);
          return function() {
            typeof a == "function" ? a() : e(null);
          };
        }
        if (e != null)
          return t = t(), e.current = t, function() {
            e.current = null;
          };
      }
      function Gs(t, e, a) {
        a = a != null ? a.concat([t]) : null, jl(
          4,
          4,
          Ys.bind(null, e, t),
          a
        );
      }
      function rr() {
      }
      function Qs(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Wi(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Ks(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Wi(e, l[1]))
          return l[0];
        if (l = t(), Wa) {
          Mt(!0);
          try {
            t();
          } finally {
            Mt(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function or(t, e, a) {
        return a === void 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = qc(), ft.lanes |= t, za |= t, a);
      }
      function Vs(t, e, a, l) {
        return ve(a, e) ? a : kn.current !== null ? (t = or(t, a, l), ve(t, e) || (Yt = !0), t) : (na & 42) === 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? (Yt = !0, t.memoizedState = a) : (t = qc(), ft.lanes |= t, za |= t, e);
      }
      function Xs(t, e, a, l, r) {
        var u = ea();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var m = rt.T, y = {};
        rt.T = y, cr(t, !1, e, a);
        try {
          var R = r(), Q = rt.S;
          if (Q !== null && Q(y, R), R !== null && typeof R == "object" && typeof R.then == "function") {
            var Z = Hm(
              R,
              l
            );
            Gn(
              t,
              e,
              Z,
              pe(t)
            );
          } else
            Gn(
              t,
              e,
              l,
              pe(t)
            );
        } catch (V) {
          Gn(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: V },
            pe()
          );
        } finally {
          Lt(u), m !== null && y.types !== null && (m.types = y.types), rt.T = m;
        }
      }
      function Zs(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: mn,
          baseState: mn,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: We,
            lastRenderedState: mn
          },
          next: null
        };
        var a = {};
        return e.next = {
          memoizedState: a,
          baseState: a,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: We,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function sr() {
        return It(Ka);
      }
      function Js() {
        return Ut().memoizedState;
      }
      function Ls() {
        return Ut().memoizedState;
      }
      function Ym(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = pe();
              t = ma(a);
              var l = fa(e, t, a);
              l !== null && (se(l, e, a), Un(l, e, a)), e = { cache: qi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Gm(t, e, a) {
        var l = pe();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t) ? Fs(e, a) : (a = Qi(t, e, a, l), a !== null && (se(a, t, l), Is(a, e, l)));
      }
      function Ws(t, e, a) {
        var l = pe();
        Gn(t, e, a, l);
      }
      function Gn(t, e, a, l) {
        var r = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Ml(t)) Fs(e, r);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var m = e.lastRenderedState, y = u(m, a);
              if (r.hasEagerState = !0, r.eagerState = y, ve(y, m))
                return Sl(t, e, r, 0), Ct === null && _l(), !1;
            } catch {
            } finally {
            }
          if (a = Qi(t, e, r, l), a !== null)
            return se(a, t, l), Is(a, e, l), !0;
        }
        return !1;
      }
      function cr(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: Yi(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t)) {
          if (e) throw Error(c(479));
        } else
          e = Qi(
            t,
            a,
            l,
            2
          ), e !== null && se(e, t, 2);
      }
      function Ml(t) {
        var e = t.alternate;
        return t === ft || e !== null && e === ft;
      }
      function Fs(t, e) {
        zn = ii = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Is(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, U(t, a);
        }
      }
      function ur(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : qr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function $s(t, e, a, l, r, u, m) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, u, m) : e.prototype && e.prototype.isPureReactComponent ? !yl(a, l) || !yl(r, u) : !0;
      }
      function Ps(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && uo.enqueueReplaceState(e, e.state, null);
      }
      function Ba(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = qr({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function Al(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (l) {
          setTimeout(function() {
            throw l;
          });
        }
      }
      function tc(t, e, a) {
        try {
          var l = t.onCaughtError;
          l(a.value, {
            componentStack: a.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function dr(t, e, a) {
        return a = ma(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Al(t, e);
        }, a;
      }
      function ec(t) {
        return t = ma(t), t.tag = 3, t;
      }
      function ac(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = l.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            tc(e, a, l);
          };
        }
        var m = a.stateNode;
        m !== null && typeof m.componentDidCatch == "function" && (t.callback = function() {
          tc(e, a, l), typeof r != "function" && (Ea === null ? Ea = /* @__PURE__ */ new Set([this]) : Ea.add(this));
          var y = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: y !== null ? y : ""
          });
        });
      }
      function Qm(t, e, a, l, r) {
        if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          if (e = a.alternate, e !== null && nn(
            e,
            a,
            r,
            !0
          ), a = ye.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Ce === null ? Gl() : a.alternate === null && Dt === 0 && (Dt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Rr(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Rr(t, l, r)), !1;
            }
            throw Error(c(435, a.tag));
          }
          return Rr(t, l, r), Gl(), !1;
        }
        if (yt)
          return e = ye.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== ao && (t = Error(c(422), { cause: l }), Rn(
            B(t, a)
          ))) : (l !== ao && (e = Error(c(423), {
            cause: l
          }), Rn(
            B(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = B(l, a), r = dr(
            t.stateNode,
            l,
            r
          ), Xi(t, r), Dt !== 4 && (Dt = 2)), !1;
        var u = Error(c(520), { cause: l });
        if (u = B(u, a), rl === null ? rl = [u] : rl.push(u), Dt !== 4 && (Dt = 2), e === null) return !0;
        l = B(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = dr(a.stateNode, l, t), Xi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Ea === null || !Ea.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = ec(r), ac(
                  r,
                  t,
                  a,
                  l
                ), Xi(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, l) {
        e.child = t === null ? Qu(e, null, a, l) : La(
          e,
          t.child,
          a,
          l
        );
      }
      function nc(t, e, a, l, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in l) {
          var m = {};
          for (var y in l)
            y !== "ref" && (m[y] = l[y]);
        } else m = l;
        return Ha(e), l = Fi(
          t,
          e,
          a,
          m,
          u,
          r
        ), y = Ii(), t !== null && !Yt ? ($i(t, e, r), Fe(t, e, r)) : (yt && y && G(e), e.flags |= 1, $t(t, e, l, r), e.child);
      }
      function lc(t, e, a, l, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !Hr(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, ic(
            t,
            e,
            u,
            l,
            r
          )) : (t = Kl(
            a.type,
            null,
            l,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !vr(t, r)) {
          var m = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : yl, a(m, l) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(u, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function ic(t, e, a, l, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (yl(u, l) && t.ref === e.ref)
            if (Yt = !1, e.pendingProps = l = u, vr(t, r))
              (t.flags & 131072) !== 0 && (Yt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return mr(
          t,
          e,
          a,
          l,
          r
        );
      }
      function rc(t, e, a, l) {
        var r = l.children, u = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), l.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (u = u !== null ? u.baseLanes | a : a, t !== null) {
              for (l = e.child = t.child, r = 0; l !== null; )
                r = r | l.lanes | l.childLanes, l = l.sibling;
              l = r & ~u;
            } else l = 0, e.child = null;
            return oc(
              t,
              e,
              u,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && vl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? hs(e, u) : Zi(), gs(e);
          else
            return l = e.lanes = 536870912, oc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              l
            );
        } else
          u !== null ? (vl(e, u.cachePool), hs(e, u), ha(), e.memoizedState = null) : (t !== null && vl(e, null), Zi(), ha());
        return $t(t, e, r, a), e.child;
      }
      function Qn(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function oc(t, e, a, l, r) {
        var u = Gi();
        return u = u === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && vl(e, null), Zi(), gs(e), t !== null && nn(t, e, l, !0), e.childLanes = r, null;
      }
      function Ol(t, e) {
        return e = Hl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function sc(t, e, a) {
        return La(e, t.child, null, a), t = Ol(
          e,
          e.pendingProps
        ), t.flags |= 2, fe(e), e.memoizedState = null, t;
      }
      function Km(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (yt) {
            if (l.mode === "hidden")
              return t = Ol(e, l), e.lanes = 536870912, Qn(null, t);
            if (Li(e), (t = At) ? (t = dp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = iu(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw dt(e);
            return e.lanes = 536870912, null;
          }
          return Ol(e, l);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var m = u.dehydrated;
          if (Li(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = sc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (Yt || nn(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Yt || r) {
            if (l = Ct, l !== null && (m = J(l, a), m !== 0 && m !== u.retryLane))
              throw u.retryLane = m, Ua(t, m), se(l, t, m), mo;
            Gl(), e = sc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, le && (At = rp(m), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = Ol(e, l), e.flags |= 4096;
          return e;
        }
        return t = Pe(t.child, {
          mode: l.mode,
          children: l.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Rl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(c(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function mr(t, e, a, l, r) {
        return Ha(e), a = Fi(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = Ii(), t !== null && !Yt ? ($i(t, e, r), Fe(t, e, r)) : (yt && l && G(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function cc(t, e, a, l, r, u) {
        return Ha(e), e.updateQueue = null, a = vs(
          e,
          l,
          a,
          r
        ), bs(t), l = Ii(), t !== null && !Yt ? ($i(t, e, u), Fe(t, e, u)) : (yt && l && G(e), e.flags |= 1, $t(t, e, a, u), e.child);
      }
      function uc(t, e, a, l, r) {
        if (Ha(e), e.stateNode === null) {
          var u = hn, m = a.contextType;
          typeof m == "object" && m !== null && (u = It(m)), u = new a(l, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = uo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = l, u.state = e.memoizedState, u.refs = {}, Ki(e), m = a.contextType, u.context = typeof m == "object" && m !== null ? It(m) : hn, u.state = e.memoizedState, m = a.getDerivedStateFromProps, typeof m == "function" && (ur(
            e,
            a,
            m,
            l
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (m = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), m !== u.state && uo.enqueueReplaceState(
            u,
            u.state,
            null
          ), qn(e, l, u, r), Bn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          u = e.stateNode;
          var y = e.memoizedProps, R = Ba(a, y);
          u.props = R;
          var Q = u.context, Z = a.contextType;
          m = hn, typeof Z == "object" && Z !== null && (m = It(Z));
          var V = a.getDerivedStateFromProps;
          Z = typeof V == "function" || typeof u.getSnapshotBeforeUpdate == "function", y = e.pendingProps !== y, Z || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (y || Q !== m) && Ps(
            e,
            u,
            l,
            m
          ), Sa = !1;
          var L = e.memoizedState;
          u.state = L, qn(e, l, u, r), Bn(), Q = e.memoizedState, y || L !== Q || Sa ? (typeof V == "function" && (ur(
            e,
            a,
            V,
            l
          ), Q = e.memoizedState), (R = Sa || $s(
            e,
            a,
            R,
            l,
            L,
            Q,
            m
          )) ? (Z || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = Q), u.props = l, u.state = Q, u.context = m, l = R) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          u = e.stateNode, Vi(t, e), m = e.memoizedProps, Z = Ba(a, m), u.props = Z, V = e.pendingProps, L = u.context, Q = a.contextType, R = hn, typeof Q == "object" && Q !== null && (R = It(Q)), y = a.getDerivedStateFromProps, (Q = typeof y == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (m !== V || L !== R) && Ps(
            e,
            u,
            l,
            R
          ), Sa = !1, L = e.memoizedState, u.state = L, qn(e, l, u, r), Bn();
          var mt = e.memoizedState;
          m !== V || L !== mt || Sa || t !== null && t.dependencies !== null && hl(t.dependencies) ? (typeof y == "function" && (ur(
            e,
            a,
            y,
            l
          ), mt = e.memoizedState), (Z = Sa || $s(
            e,
            a,
            Z,
            l,
            L,
            mt,
            R
          ) || t !== null && t.dependencies !== null && hl(t.dependencies)) ? (Q || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(l, mt, R), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            l,
            mt,
            R
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = mt), u.props = l, u.state = mt, u.context = R, l = Z) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return u = l, Rl(t, e), l = (e.flags & 128) !== 0, u || l ? (u = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && l ? (e.child = La(
          e,
          t.child,
          null,
          r
        ), e.child = La(
          e,
          null,
          a,
          r
        )) : $t(t, e, a, r), e.memoizedState = u.state, t = e.child) : t = Fe(
          t,
          e,
          r
        ), t;
      }
      function dc(t, e, a, l) {
        return Oe(), e.flags |= 256, $t(t, e, a, l), e.child;
      }
      function fr(t) {
        return { baseLanes: t, cachePool: rs() };
      }
      function pr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= we), t;
      }
      function mc(t, e, a) {
        var l = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, m;
        if ((m = u) || (m = t !== null && t.memoizedState === null ? !1 : (Bt.current & 2) !== 0), m && (r = !0, e.flags &= -129), m = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (yt) {
            if (r ? pa(e) : ha(), (t = At) ? (t = mp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = iu(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw dt(e);
            return Wr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var y = l.children;
          return l = l.fallback, r ? (ha(), r = e.mode, y = Hl(
            { mode: "hidden", children: y },
            r
          ), l = Ga(
            l,
            r,
            a,
            null
          ), y.return = e, l.return = e, y.sibling = l, e.child = y, l = e.child, l.memoizedState = fr(a), l.childLanes = pr(
            t,
            m,
            a
          ), e.memoizedState = fo, Qn(null, l)) : (pa(e), hr(e, y));
        }
        var R = t.memoizedState;
        if (R !== null && (y = R.dehydrated, y !== null)) {
          if (u)
            e.flags & 256 ? (pa(e), e.flags &= -257, e = gr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ha(), e.child = t.child, e.flags |= 128, e = null) : (ha(), y = l.fallback, r = e.mode, l = Hl(
              { mode: "visible", children: l.children },
              r
            ), y = Ga(
              y,
              r,
              a,
              null
            ), y.flags |= 2, l.return = e, y.return = e, l.sibling = y, e.child = l, La(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = fr(a), l.childLanes = pr(
              t,
              m,
              a
            ), e.memoizedState = fo, e = Qn(null, l));
          else if (pa(e), Wr(y))
            m = Pf(y).digest, l = Error(c(419)), l.stack = "", l.digest = m, Rn({ value: l, source: null, stack: null }), e = gr(
              t,
              e,
              a
            );
          else if (Yt || nn(
            t,
            e,
            a,
            !1
          ), m = (a & t.childLanes) !== 0, Yt || m) {
            if (m = Ct, m !== null && (l = J(
              m,
              a
            ), l !== 0 && l !== R.retryLane))
              throw R.retryLane = l, Ua(t, l), se(m, t, l), mo;
            Lr(y) || Gl(), e = gr(
              t,
              e,
              a
            );
          } else
            Lr(y) ? (e.flags |= 192, e.child = t.child, e = null) : (t = R.treeContext, le && (At = op(
              y
            ), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = hr(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ha(), y = l.fallback, r = e.mode, R = t.child, u = R.sibling, l = Pe(R, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = R.subtreeFlags & 65011712, u !== null ? y = Pe(
          u,
          y
        ) : (y = Ga(
          y,
          r,
          a,
          null
        ), y.flags |= 2), y.return = e, l.return = e, l.sibling = y, e.child = l, Qn(null, l), l = e.child, y = t.child.memoizedState, y === null ? y = fr(a) : (r = y.cachePool, r !== null ? (R = ta ? Ot._currentValue : Ot._currentValue2, r = r.parent !== R ? { parent: R, pool: R } : r) : r = rs(), y = {
          baseLanes: y.baseLanes | a,
          cachePool: r
        }), l.memoizedState = y, l.childLanes = pr(
          t,
          m,
          a
        ), e.memoizedState = fo, Qn(t.child, l)) : (pa(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (m = e.deletions, m === null ? (e.deletions = [t], e.flags |= 16) : m.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function hr(t, e) {
        return e = Hl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Hl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function gr(t, e, a) {
        return La(e, t.child, null, a), t = hr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function fc(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), Ui(t.return, e, a);
      }
      function br(t, e, a, l, r, u) {
        var m = t.memoizedState;
        m === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: r,
          treeForkCount: u
        } : (m.isBackwards = e, m.rendering = null, m.renderingStartTime = 0, m.last = l, m.tail = a, m.tailMode = r, m.treeForkCount = u);
      }
      function pc(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, u = l.tail;
        l = l.children;
        var m = Bt.current, y = (m & 2) !== 0;
        if (y ? (m = m & 1 | 2, e.flags |= 128) : m &= 1, S(Bt, m), $t(t, e, l, a), l = yt ? Pn : 0, !y && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && fc(t, a, e);
            else if (t.tag === 19)
              fc(t, a, e);
            else if (t.child !== null) {
              t.child.return = t, t = t.child;
              continue;
            }
            if (t === e) break t;
            for (; t.sibling === null; ) {
              if (t.return === null || t.return === e)
                break t;
              t = t.return;
            }
            t.sibling.return = t.return, t = t.sibling;
          }
        switch (r) {
          case "forwards":
            for (a = e.child, r = null; a !== null; )
              t = a.alternate, t !== null && zl(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), br(
              e,
              !1,
              r,
              a,
              u,
              l
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && zl(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            br(
              e,
              !0,
              a,
              null,
              u,
              l
            );
            break;
          case "together":
            br(
              e,
              !1,
              null,
              null,
              void 0,
              l
            );
            break;
          default:
            e.memoizedState = null;
        }
        return e.child;
      }
      function Fe(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), za |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (nn(
              t,
              e,
              a,
              !1
            ), (a & e.childLanes) === 0)
              return null;
          } else return null;
        if (t !== null && e.child !== t.child)
          throw Error(c(153));
        if (e.child !== null) {
          for (t = e.child, a = Pe(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Pe(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function vr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && hl(t)));
      }
      function Vm(t, e, a) {
        switch (e.tag) {
          case 3:
            P(
              e,
              e.stateNode.containerInfo
            ), da(e, Ot, t.memoizedState.cache), Oe();
            break;
          case 27:
          case 5:
            xt(e);
            break;
          case 4:
            P(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            da(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, Li(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (pa(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? mc(
                t,
                e,
                a
              ) : (pa(e), t = Fe(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            pa(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (l = (a & e.childLanes) !== 0, l || (nn(
              t,
              e,
              a,
              !1
            ), l = (a & e.childLanes) !== 0), r) {
              if (l)
                return pc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), S(Bt, Bt.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, rc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            da(e, Ot, t.memoizedState.cache);
        }
        return Fe(t, e, a);
      }
      function hc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Yt = !0;
          else {
            if (!vr(t, a) && (e.flags & 128) === 0)
              return Yt = !1, Vm(
                t,
                e,
                a
              );
            Yt = (t.flags & 131072) !== 0;
          }
        else
          Yt = !1, yt && (e.flags & 1048576) !== 0 && v(e, Pn, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = Da(e.elementType), e.type = t, typeof t == "function")
                Hr(t) ? (l = Ba(t, l), e.tag = 1, e = uc(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = mr(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Gr) {
                    e.tag = 11, e = nc(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Vr) {
                    e.tag = 14, e = lc(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  }
                }
                throw e = H(t) || t, Error(c(306, e, ""));
              }
            }
            return e;
          case 0:
            return mr(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return l = e.type, r = Ba(
              l,
              e.pendingProps
            ), uc(
              t,
              e,
              l,
              r,
              a
            );
          case 3:
            t: {
              if (P(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(c(387));
              var u = e.pendingProps;
              r = e.memoizedState, l = r.element, Vi(t, e), qn(e, u, null, a);
              var m = e.memoizedState;
              if (u = m.cache, da(e, Ot, u), u !== r.cache && Bi(
                e,
                [Ot],
                a,
                !0
              ), Bn(), u = m.element, le && r.isDehydrated)
                if (r = {
                  element: u,
                  isDehydrated: !1,
                  cache: m.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = dc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== l) {
                  l = B(
                    Error(c(424)),
                    e
                  ), Rn(l), e = dc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (le && (At = ip(
                    e.stateNode.containerInfo
                  ), te = e, yt = !0, _a = null, Ne = !0), a = Qu(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Oe(), u === l) {
                  e = Fe(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                $t(t, e, u, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Ue)
              return Rl(t, e), t === null ? (a = Tu(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : yt || (e.stateNode = Ap(
                e.type,
                e.pendingProps,
                wa.current,
                e
              )) : e.memoizedState = Tu(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return xt(e), t === null && Vt && yt && (l = e.stateNode = Ru(
                e.type,
                e.pendingProps,
                wa.current,
                Pt.current,
                !1
              ), te = e, Ne = !0, At = sp(
                e.type,
                l,
                At
              )), $t(
                t,
                e,
                e.pendingProps.children,
                a
              ), Rl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && yt && (Cp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = l = At) && (l = cp(
              l,
              e.type,
              e.pendingProps,
              Ne
            ), l !== null ? (e.stateNode = l, te = e, At = lp(l), Ne = !1, r = !0) : r = !1), r || dt(e)), xt(e), r = e.type, u = e.pendingProps, m = t !== null ? t.memoizedProps : null, l = u.children, Zl(r, u) ? l = null : m !== null && Zl(r, m) && (e.flags |= 32), e.memoizedState !== null && (r = Fi(
              t,
              e,
              Dm,
              null,
              null,
              a
            ), ta ? Ka._currentValue = r : Ka._currentValue2 = r), Rl(t, e), $t(t, e, l, a), e.child;
          case 6:
            return t === null && yt && (jp(
              e.pendingProps,
              Pt.current
            ), (t = a = At) && (a = up(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, te = e, At = null, t = !0) : t = !1), t || dt(e)), null;
          case 13:
            return mc(t, e, a);
          case 4:
            return P(
              e,
              e.stateNode.containerInfo
            ), l = e.pendingProps, t === null ? e.child = La(
              e,
              null,
              l,
              a
            ) : $t(t, e, l, a), e.child;
          case 11:
            return nc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return $t(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return $t(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return $t(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return l = e.pendingProps, da(e, e.type, l.value), $t(
              t,
              e,
              l.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, l = e.pendingProps.children, Ha(e), r = It(r), l = l(r), e.flags |= 1, $t(t, e, l, a), e.child;
          case 14:
            return lc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return ic(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return pc(
              t,
              e,
              a
            );
          case 31:
            return Km(t, e, a);
          case 22:
            return rc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ha(e), l = It(Ot), t === null ? (r = Gi(), r === null && (r = Ct, u = qi(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: l,
              cache: r
            }, Ki(e), da(e, Ot, r)) : ((t.lanes & a) !== 0 && (Vi(t, e), qn(e, null, null, a), Bn()), r = t.memoizedState, u = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), da(e, Ot, l)) : (l = u.cache, da(e, Ot, l), l !== r.cache && Bi(
              e,
              [Ot],
              a,
              !0
            ))), $t(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 29:
            throw e.pendingProps;
        }
        throw Error(c(156, e.tag));
      }
      function Re(t) {
        t.flags |= 4;
      }
      function Dl(t) {
        Ke && (t.flags |= 8);
      }
      function gc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function yr(t, e, a, l) {
        if (ne)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Zr(t, a.stateNode);
            else if (!(a.tag === 4 || Vt && a.tag === 27) && a.child !== null) {
              a.child.return = a, a = a.child;
              continue;
            }
            if (a === e) break;
            for (; a.sibling === null; ) {
              if (a.return === null || a.return === e)
                return;
              a = a.return;
            }
            a.sibling.return = a.return, a = a.sibling;
          }
        else if (Ke)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var u = r.stateNode;
              a && l && (u = Su(
                u,
                r.type,
                r.memoizedProps
              )), Zr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && l && (u = ku(
                u,
                r.memoizedProps
              )), Zr(t, u);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                u = r.child, u !== null && (u.return = r), yr(t, r, !0, !0);
              else if (r.child !== null) {
                r.child.return = r, r = r.child;
                continue;
              }
            }
            if (r === e) break;
            for (; r.sibling === null; ) {
              if (r.return === null || r.return === e)
                return;
              r = r.return;
            }
            r.sibling.return = r.return, r = r.sibling;
          }
      }
      function bc(t, e, a, l) {
        var r = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var m = u.stateNode;
              a && l && (m = Su(
                m,
                u.type,
                u.memoizedProps
              )), wu(t, m);
            } else if (u.tag === 6)
              m = u.stateNode, a && l && (m = ku(
                m,
                u.memoizedProps
              )), wu(t, m);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), bc(t, u, !0, !0), r = !0;
              else if (u.child !== null) {
                u.child.return = u, u = u.child;
                continue;
              }
            }
            if (u === e) break;
            for (; u.sibling === null; ) {
              if (u.return === null || u.return === e)
                return r;
              u = u.return;
            }
            u.sibling.return = u.return, u = u.sibling;
          }
        return r;
      }
      function vc(t, e) {
        if (Ke && gc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = xu();
          bc(l, e, !1, !1), t.pendingChildren = l, Re(e), $f(a, l);
        }
      }
      function xr(t, e, a, l) {
        if (ne)
          t.memoizedProps !== l && Re(e);
        else if (Ke) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = gc(t, e)) || u !== l) {
            var m = Pt.current;
            u = If(
              r,
              a,
              u,
              l,
              !t,
              null
            ), u === r ? e.stateNode = r : (Dl(e), hu(
              u,
              a,
              l,
              m
            ) && Re(e), e.stateNode = u, t && yr(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function wr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? kf(e, l) : zf(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Jr(e, l))
            if (bu(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Vc()) t.flags |= 8192;
            else
              throw Ja = ni, ro;
        } else t.flags &= -16777217;
      }
      function yc(t, e) {
        if (Rp(e)) {
          if (t.flags |= 16777216, !Ou(e))
            if (Vc()) t.flags |= 8192;
            else
              throw Ja = ni, ro;
        } else t.flags &= -16777217;
      }
      function Ul(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? j() : 536870912, t.lanes |= e, Cn |= e);
      }
      function Kn(t, e) {
        if (!yt)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var a = null; e !== null; )
                e.alternate !== null && (a = e), e = e.sibling;
              a === null ? t.tail = null : a.sibling = null;
              break;
            case "collapsed":
              a = t.tail;
              for (var l = null; a !== null; )
                a.alternate !== null && (l = a), a = a.sibling;
              l === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : l.sibling = null;
          }
      }
      function jt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, l = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= l, t.childLanes = a, e;
      }
      function Xm(t, e, a) {
        var l = e.pendingProps;
        switch (tt(e), e.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return jt(e), null;
          case 1:
            return jt(e), null;
          case 3:
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Le(Ot), it(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ae(e) ? Re(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ua())), vc(t, e), jt(e), null;
          case 26:
            if (Ue) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (Re(e), u !== null ? (jt(e), yc(
                e,
                u
              )) : (jt(e), wr(
                e,
                r,
                null,
                l,
                a
              ))) : u ? u !== t.memoizedState ? (Re(e), jt(e), yc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, ne ? u !== l && Re(e) : xr(
                t,
                e,
                r,
                l
              ), jt(e), wr(
                e,
                r,
                u,
                l,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Jt(e), a = wa.current, r = e.type, t !== null && e.stateNode != null)
                ne ? t.memoizedProps !== l && Re(e) : xr(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return jt(e), null;
                }
                t = Pt.current, Ae(e) ? Oa(e, t) : (t = Ru(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Re(e));
              }
              return jt(e), null;
            }
          case 5:
            if (Jt(e), r = e.type, t !== null && e.stateNode != null)
              xr(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return jt(e), null;
              }
              if (u = Pt.current, Ae(e))
                Oa(e, u), Sp(
                  e.stateNode,
                  r,
                  l,
                  u
                ) && (e.flags |= 64);
              else {
                var m = gf(
                  r,
                  l,
                  wa.current,
                  u,
                  e
                );
                Dl(e), yr(m, e, !1, !1), e.stateNode = m, hu(
                  m,
                  r,
                  l,
                  u
                ) && Re(e);
              }
            }
            return jt(e), wr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ne ? a !== l && Re(e) : Ke && (a !== l ? (t = wa.current, a = Pt.current, Dl(e), e.stateNode = gu(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = wa.current, a = Pt.current, Ae(e)) {
                if (!le) throw Error(c(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                pp(
                  t,
                  a,
                  e,
                  l
                ) || dt(e, !0);
              } else
                Dl(e), e.stateNode = gu(
                  l,
                  t,
                  a,
                  e
                );
            }
            return jt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = Ae(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(c(318));
                  if (!le) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  hp(t, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return jt(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ae(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!le) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  gp(r, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), r = !1;
              } else
                r = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
            }
            return fe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), u = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), u !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Ul(e, e.updateQueue), jt(e), null);
          case 4:
            return it(), vc(t, e), t === null && xf(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Le(e.type), jt(e), null;
          case 19:
            if (b(Bt), l = e.memoizedState, l === null) return jt(e), null;
            if (r = (e.flags & 128) !== 0, u = l.rendering, u === null)
              if (r) Kn(l, !1);
              else {
                if (Dt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = zl(t), u !== null) {
                      for (e.flags |= 128, Kn(l, !1), t = u.updateQueue, e.updateQueue = t, Ul(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        lu(a, t), a = a.sibling;
                      return S(
                        Bt,
                        Bt.current & 1 | 2
                      ), yt && Y(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && ce() > ol && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = zl(u), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Ul(e, t), Kn(l, !0), l.tail === null && l.tailMode === "hidden" && !u.alternate && !yt)
                    return jt(e), null;
                } else
                  2 * ce() - l.renderingStartTime > ol && a !== 536870912 && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              l.isBackwards ? (u.sibling = e.child, e.child = u) : (t = l.last, t !== null ? t.sibling = u : e.child = u, l.last = u);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = ce(), t.sibling = null, a = Bt.current, S(
              Bt,
              r ? a & 1 | 2 : a & 1
            ), yt && Y(e, l.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return fe(e), Ji(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Ul(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && b(Za), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(Ot), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function Zm(t, e) {
        switch (tt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Le(Ot), it(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Jt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (fe(e), e.alternate === null)
                throw Error(c(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (fe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(c(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return b(Bt), null;
          case 4:
            return it(), null;
          case 10:
            return Le(e.type), null;
          case 22:
          case 23:
            return fe(e), Ji(), t !== null && b(Za), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(Ot), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function xc(t, e) {
        switch (tt(e), e.tag) {
          case 3:
            Le(Ot), it();
            break;
          case 26:
          case 27:
          case 5:
            Jt(e);
            break;
          case 4:
            it();
            break;
          case 31:
            e.memoizedState !== null && fe(e);
            break;
          case 13:
            fe(e);
            break;
          case 19:
            b(Bt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            fe(e), Ji(), t !== null && b(Za);
            break;
          case 24:
            Le(Ot);
        }
      }
      function Vn(t, e) {
        try {
          var a = e.updateQueue, l = a !== null ? a.lastEffect : null;
          if (l !== null) {
            var r = l.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                l = void 0;
                var u = a.create, m = a.inst;
                l = u(), m.destroy = l;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (y) {
          wt(e, e.return, y);
        }
      }
      function ga(t, e, a) {
        try {
          var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
          if (r !== null) {
            var u = r.next;
            l = u;
            do {
              if ((l.tag & t) === t) {
                var m = l.inst, y = m.destroy;
                if (y !== void 0) {
                  m.destroy = void 0, r = e;
                  var R = a, Q = y;
                  try {
                    Q();
                  } catch (Z) {
                    wt(
                      r,
                      R,
                      Z
                    );
                  }
                }
              }
              l = l.next;
            } while (l !== u);
          }
        } catch (Z) {
          wt(e, e.return, Z);
        }
      }
      function wc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            ps(e, a);
          } catch (l) {
            wt(t, t.return, l);
          }
        }
      }
      function _c(t, e, a) {
        a.props = Ba(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (l) {
          wt(t, e, l);
        }
      }
      function Xn(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var l = Wn(t.stateNode);
                break;
              case 30:
                l = t.stateNode;
                break;
              default:
                l = t.stateNode;
            }
            typeof a == "function" ? t.refCleanup = a(l) : a.current = l;
          }
        } catch (r) {
          wt(t, e, r);
        }
      }
      function Qe(t, e) {
        var a = t.ref, l = t.refCleanup;
        if (a !== null)
          if (typeof l == "function")
            try {
              l();
            } catch (r) {
              wt(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (r) {
              wt(t, e, r);
            }
          else a.current = null;
      }
      function Sc(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          Yf(l, e, a, t);
        } catch (r) {
          wt(t, t.return, r);
        }
      }
      function _r(t, e, a) {
        try {
          Gf(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          wt(t, t.return, l);
        }
      }
      function kc(t) {
        return t.tag === 5 || t.tag === 3 || (Ue ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && fn(t.type) : !1) || t.tag === 4;
      }
      function Sr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || kc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && fn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function kr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Kf(a, t, e) : Bf(a, t);
        else if (l !== 4 && (Vt && l === 27 && fn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (kr(t, e, a), t = t.sibling; t !== null; )
            kr(t, e, a), t = t.sibling;
      }
      function Bl(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Qf(a, t, e) : Uf(a, t);
        else if (l !== 4 && (Vt && l === 27 && fn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Bl(t, e, a), t = t.sibling; t !== null; )
            Bl(t, e, a), t = t.sibling;
      }
      function zc(t, e, a) {
        t = t.containerInfo;
        try {
          _u(t, a);
        } catch (l) {
          wt(e, e.return, l);
        }
      }
      function Ec(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Dp(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          wt(t, t.return, l);
        }
      }
      function Jm(t, e) {
        for (pf(t.containerInfo), Wt = e; Wt !== null; )
          if (t = Wt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Wt = e;
          else
            for (; Wt !== null; ) {
              t = Wt;
              var a = t.alternate;
              switch (e = t.flags, t.tag) {
                case 0:
                  if ((e & 4) !== 0 && (e = t.updateQueue, e = e !== null ? e.events : null, e !== null))
                    for (var l = 0; l < e.length; l++) {
                      var r = e[l];
                      r.ref.impl = r.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((e & 1024) !== 0 && a !== null) {
                    e = void 0, l = t, r = a.memoizedProps, a = a.memoizedState;
                    var u = l.stateNode;
                    try {
                      var m = Ba(
                        l.type,
                        r
                      );
                      e = u.getSnapshotBeforeUpdate(
                        m,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (y) {
                      wt(l, l.return, y);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ne && Ff(t.stateNode.containerInfo);
                  break;
                case 5:
                case 26:
                case 27:
                case 6:
                case 4:
                case 17:
                  break;
                default:
                  if ((e & 1024) !== 0)
                    throw Error(c(163));
              }
              if (e = t.sibling, e !== null) {
                e.return = t.return, Wt = e;
                break;
              }
              Wt = t.return;
            }
      }
      function Nc(t, e, a) {
        var l = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Ie(t, a), l & 4 && Vn(5, a);
            break;
          case 1:
            if (Ie(t, a), l & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (m) {
                  wt(a, a.return, m);
                }
              else {
                var r = Ba(
                  a.type,
                  e.memoizedProps
                );
                e = e.memoizedState;
                try {
                  t.componentDidUpdate(
                    r,
                    e,
                    t.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (m) {
                  wt(
                    a,
                    a.return,
                    m
                  );
                }
              }
            l & 64 && wc(a), l & 512 && Xn(a, a.return);
            break;
          case 3:
            if (Ie(t, a), l & 64 && (l = a.updateQueue, l !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Wn(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                ps(l, t);
              } catch (m) {
                wt(a, a.return, m);
              }
            }
            break;
          case 27:
            Vt && e === null && l & 4 && Ec(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (l & 4) Sc(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  yp(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (m) {
                  wt(a, a.return, m);
                }
              }
            }
            l & 512 && Xn(a, a.return);
            break;
          case 12:
            Ie(t, a);
            break;
          case 31:
            Ie(t, a), l & 4 && Cc(t, a);
            break;
          case 13:
            Ie(t, a), l & 4 && jc(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = tf.bind(
              null,
              a
            ), tp(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || la, !l) {
              e = e !== null && e.memoizedState !== null || Gt, r = la;
              var u = Gt;
              la = l, (Gt = e) && !u ? $e(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Ie(t, a), la = r, Gt = u;
            }
            break;
          case 30:
            break;
          default:
            Ie(t, a);
        }
      }
      function Tc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Tc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Sf(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, a) {
        for (a = a.child; a !== null; )
          zr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function zr(t, e, a) {
        if (be && typeof be.onCommitFiberUnmount == "function")
          try {
            be.onCommitFiberUnmount($n, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ue) {
              Gt || Qe(a, e), He(
                t,
                e,
                a
              ), a.memoizedState ? ju(a.memoizedState) : a.stateNode && Au(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Gt || Qe(a, e);
              var l = Qt, r = ue;
              fn(a.type) && (Qt = a.stateNode, ue = !1), He(
                t,
                e,
                a
              ), Hu(a.stateNode), Qt = l, ue = r;
              break;
            }
          case 5:
            Gt || Qe(a, e);
          case 6:
            if (ne) {
              if (l = Qt, r = ue, Qt = null, He(
                t,
                e,
                a
              ), Qt = l, ue = r, Qt !== null)
                if (ue)
                  try {
                    Xf(Qt, a.stateNode);
                  } catch (u) {
                    wt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Vf(Qt, a.stateNode);
                  } catch (u) {
                    wt(
                      a,
                      e,
                      u
                    );
                  }
            } else
              He(
                t,
                e,
                a
              );
            break;
          case 18:
            ne && Qt !== null && (ue ? Ep(
              Qt,
              a.stateNode
            ) : zp(Qt, a.stateNode));
            break;
          case 4:
            ne ? (l = Qt, r = ue, Qt = a.stateNode.containerInfo, ue = !0, He(
              t,
              e,
              a
            ), Qt = l, ue = r) : (Ke && zc(
              a.stateNode,
              a,
              xu()
            ), He(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            ga(2, a, e), Gt || ga(4, a, e), He(
              t,
              e,
              a
            );
            break;
          case 1:
            Gt || (Qe(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && _c(
              a,
              e,
              l
            )), He(
              t,
              e,
              a
            );
            break;
          case 21:
            He(
              t,
              e,
              a
            );
            break;
          case 22:
            Gt = (l = Gt) || a.memoizedState !== null, He(
              t,
              e,
              a
            ), Gt = l;
            break;
          default:
            He(
              t,
              e,
              a
            );
        }
      }
      function Cc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            wp(t);
          } catch (a) {
            wt(e, e.return, a);
          }
        }
      }
      function jc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            _p(t);
          } catch (a) {
            wt(e, e.return, a);
          }
      }
      function Lm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Xu()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Xu()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function ql(t, e) {
        var a = Lm(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = ef.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ae(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], u = t, m = e;
            if (ne) {
              var y = m;
              t: for (; y !== null; ) {
                switch (y.tag) {
                  case 27:
                    if (Vt) {
                      if (fn(y.type)) {
                        Qt = y.stateNode, ue = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = y.stateNode, ue = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = y.stateNode.containerInfo, ue = !0;
                    break t;
                }
                y = y.return;
              }
              if (Qt === null) throw Error(c(160));
              zr(u, m, r), Qt = null, ue = !1;
            } else zr(u, m, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Mc(e, t), e = e.sibling;
      }
      function Mc(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ae(e, t), oe(t), l & 4 && (ga(3, t, t.return), Vn(3, t), ga(5, t, t.return));
            break;
          case 1:
            ae(e, t), oe(t), l & 512 && (Gt || a === null || Qe(a, a.return)), l & 64 && la && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (Ue) {
              var r = Be;
              if (ae(e, t), oe(t), l & 512 && (Gt || a === null || Qe(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Mp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Mu(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Cu(
                  r,
                  u,
                  t.memoizedProps
                ) : l !== u ? (l === null ? a.stateNode !== null && Au(a.stateNode) : ju(l), u === null ? Mu(
                  r,
                  t.type,
                  t.stateNode
                ) : Cu(
                  r,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && _r(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ae(e, t), oe(t), l & 512 && (Gt || a === null || Qe(a, a.return)), a !== null && l & 4 && _r(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ae(e, t), oe(t), l & 512 && (Gt || a === null || Qe(a, a.return)), ne) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  yu(r);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, _r(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (po = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ae(e, t), oe(t), l & 4 && ne) {
              if (t.stateNode === null)
                throw Error(c(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                qf(r, a, l);
              } catch (V) {
                wt(t, t.return, V);
              }
            }
            break;
          case 3:
            if (Ue ? (Op(), r = Be, Be = Fr(e.containerInfo), ae(e, t), Be = r) : ae(e, t), oe(t), l & 4) {
              if (ne && le && a !== null && a.memoizedState.isDehydrated)
                try {
                  xp(e.containerInfo);
                } catch (V) {
                  wt(t, t.return, V);
                }
              if (Ke) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  _u(l, a);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
            }
            po && (po = !1, Ac(t));
            break;
          case 4:
            Ue ? (a = Be, Be = Fr(
              t.stateNode.containerInfo
            ), ae(e, t), oe(t), Be = a) : (ae(e, t), oe(t)), l & 4 && Ke && zc(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ae(e, t), oe(t);
            break;
          case 31:
            ae(e, t), oe(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 13:
            ae(e, t), oe(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (mi = ce()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var m = a !== null && a.memoizedState !== null, y = la, R = Gt;
            if (la = y || r, Gt = R || m, ae(e, t), Gt = R, la = y, oe(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || m || la || Gt || qa(t)), ne)) {
              t: if (a = null, ne)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ue && e.tag === 26) {
                    if (a === null) {
                      m = a = e;
                      try {
                        u = m.stateNode, r ? Zf(u) : Lf(
                          m.stateNode,
                          m.memoizedProps
                        );
                      } catch (V) {
                        wt(m, m.return, V);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      m = e;
                      try {
                        var Q = m.stateNode;
                        r ? Jf(Q) : Wf(Q, m.memoizedProps);
                      } catch (V) {
                        wt(m, m.return, V);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      m = e;
                      try {
                        var Z = m.stateNode;
                        r ? Np(Z) : Tp(m.stateNode);
                      } catch (V) {
                        wt(m, m.return, V);
                      }
                    }
                  } else if ((e.tag !== 22 && e.tag !== 23 || e.memoizedState === null || e === t) && e.child !== null) {
                    e.child.return = e, e = e.child;
                    continue;
                  }
                  if (e === t) break t;
                  for (; e.sibling === null; ) {
                    if (e.return === null || e.return === t)
                      break t;
                    a === e && (a = null), e = e.return;
                  }
                  a === e && (a = null), e.sibling.return = e.return, e = e.sibling;
                }
            }
            l & 4 && (l = t.updateQueue, l !== null && (a = l.retryQueue, a !== null && (l.retryQueue = null, ql(t, a))));
            break;
          case 19:
            ae(e, t), oe(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            ae(e, t), oe(t);
        }
      }
      function oe(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, l = t.return; l !== null; ) {
              if (kc(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (ne) {
              if (a == null) throw Error(c(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, u = Sr(t);
                    Bl(t, u, r);
                    break;
                  }
                case 5:
                  var m = a.stateNode;
                  a.flags & 32 && (yu(m), a.flags &= -33);
                  var y = Sr(t);
                  Bl(t, y, m);
                  break;
                case 3:
                case 4:
                  var R = a.stateNode.containerInfo, Q = Sr(t);
                  kr(
                    t,
                    Q,
                    R
                  );
                  break;
                default:
                  throw Error(c(161));
              }
            }
          } catch (Z) {
            wt(t, t.return, Z);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Ac(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Ac(e), e.tag === 5 && e.flags & 1024 && Tf(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Nc(t, e.alternate, e), e = e.sibling;
      }
      function qa(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ga(4, e, e.return), qa(e);
              break;
            case 1:
              Qe(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && _c(
                e,
                e.return,
                a
              ), qa(e);
              break;
            case 27:
              Vt && Hu(e.stateNode);
            case 26:
            case 5:
              Qe(e, e.return), qa(e);
              break;
            case 22:
              e.memoizedState === null && qa(e);
              break;
            case 30:
              qa(e);
              break;
            default:
              qa(e);
          }
          t = t.sibling;
        }
      }
      function $e(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var l = e.alternate, r = t, u = e, m = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              $e(
                r,
                u,
                a
              ), Vn(4, u);
              break;
            case 1:
              if ($e(
                r,
                u,
                a
              ), l = u, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (Q) {
                  wt(l, l.return, Q);
                }
              if (l = u, r = l.updateQueue, r !== null) {
                var y = l.stateNode;
                try {
                  var R = r.shared.hiddenCallbacks;
                  if (R !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < R.length; r++)
                      fs(R[r], y);
                } catch (Q) {
                  wt(l, l.return, Q);
                }
              }
              a && m & 64 && wc(u), Xn(u, u.return);
              break;
            case 27:
              Vt && Ec(u);
            case 26:
            case 5:
              $e(
                r,
                u,
                a
              ), a && l === null && m & 4 && Sc(u), Xn(u, u.return);
              break;
            case 12:
              $e(
                r,
                u,
                a
              );
              break;
            case 31:
              $e(
                r,
                u,
                a
              ), a && m & 4 && Cc(r, u);
              break;
            case 13:
              $e(
                r,
                u,
                a
              ), a && m & 4 && jc(r, u);
              break;
            case 22:
              u.memoizedState === null && $e(
                r,
                u,
                a
              ), Xn(u, u.return);
              break;
            case 30:
              break;
            default:
              $e(
                r,
                u,
                a
              );
          }
          e = e.sibling;
        }
      }
      function Er(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Hn(a));
      }
      function Nr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Hn(t));
      }
      function De(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Oc(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function Oc(t, e, a, l) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && Vn(9, e);
            break;
          case 1:
            De(
              t,
              e,
              a,
              l
            );
            break;
          case 3:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Hn(t)));
            break;
          case 12:
            if (r & 2048) {
              De(
                t,
                e,
                a,
                l
              ), t = e.stateNode;
              try {
                var u = e.memoizedProps, m = u.id, y = u.onPostCommit;
                typeof y == "function" && y(
                  m,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (R) {
                wt(e, e.return, R);
              }
            } else
              De(
                t,
                e,
                a,
                l
              );
            break;
          case 31:
            De(
              t,
              e,
              a,
              l
            );
            break;
          case 13:
            De(
              t,
              e,
              a,
              l
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, m = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? De(
              t,
              e,
              a,
              l
            ) : Zn(
              t,
              e
            ) : u._visibility & 2 ? De(
              t,
              e,
              a,
              l
            ) : (u._visibility |= 2, on(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && Er(m, e);
            break;
          case 24:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && Nr(e.alternate, e);
            break;
          default:
            De(
              t,
              e,
              a,
              l
            );
        }
      }
      function on(t, e, a, l, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, m = e, y = a, R = l, Q = m.flags;
          switch (m.tag) {
            case 0:
            case 11:
            case 15:
              on(
                u,
                m,
                y,
                R,
                r
              ), Vn(8, m);
              break;
            case 23:
              break;
            case 22:
              var Z = m.stateNode;
              m.memoizedState !== null ? Z._visibility & 2 ? on(
                u,
                m,
                y,
                R,
                r
              ) : Zn(
                u,
                m
              ) : (Z._visibility |= 2, on(
                u,
                m,
                y,
                R,
                r
              )), r && Q & 2048 && Er(
                m.alternate,
                m
              );
              break;
            case 24:
              on(
                u,
                m,
                y,
                R,
                r
              ), r && Q & 2048 && Nr(m.alternate, m);
              break;
            default:
              on(
                u,
                m,
                y,
                R,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Zn(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, l = e, r = l.flags;
            switch (l.tag) {
              case 22:
                Zn(a, l), r & 2048 && Er(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Zn(a, l), r & 2048 && Nr(
                  l.alternate,
                  l
                );
                break;
              default:
                Zn(a, l);
            }
            e = e.sibling;
          }
      }
      function Ya(t, e, a) {
        if (t.subtreeFlags & Nn)
          for (t = t.child; t !== null; )
            Rc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Rc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ya(
              t,
              e,
              a
            ), t.flags & Nn)
              if (t.memoizedState !== null)
                Hp(
                  a,
                  Be,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Jr(r, t)) && vu(a, l, r, t);
              }
            break;
          case 5:
            Ya(
              t,
              e,
              a
            ), t.flags & Nn && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Jr(r, t)) && vu(a, l, r, t));
            break;
          case 3:
          case 4:
            Ue ? (l = Be, Be = Fr(
              t.stateNode.containerInfo
            ), Ya(
              t,
              e,
              a
            ), Be = l) : Ya(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = Nn, Nn = 16777216, Ya(
              t,
              e,
              a
            ), Nn = l) : Ya(
              t,
              e,
              a
            ));
            break;
          default:
            Ya(
              t,
              e,
              a
            );
        }
      }
      function Hc(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Jn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Wt = l, Uc(
                l,
                t
              );
            }
          Hc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Dc(t), t = t.sibling;
      }
      function Dc(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Jn(t), t.flags & 2048 && ga(9, t, t.return);
            break;
          case 3:
            Jn(t);
            break;
          case 12:
            Jn(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Yl(t)) : Jn(t);
            break;
          default:
            Jn(t);
        }
      }
      function Yl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Wt = l, Uc(
                l,
                t
              );
            }
          Hc(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ga(8, e, e.return), Yl(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Yl(e));
              break;
            default:
              Yl(e);
          }
          t = t.sibling;
        }
      }
      function Uc(t, e) {
        for (; Wt !== null; ) {
          var a = Wt;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              ga(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var l = a.memoizedState.cachePool.pool;
                l != null && l.refCount++;
              }
              break;
            case 24:
              Hn(a.memoizedState.cache);
          }
          if (l = a.child, l !== null) l.return = a, Wt = l;
          else
            t: for (a = t; Wt !== null; ) {
              l = Wt;
              var r = l.sibling, u = l.return;
              if (Tc(l), l === a) {
                Wt = null;
                break t;
              }
              if (r !== null) {
                r.return = u, Wt = r;
                break t;
              }
              Wt = u;
            }
        }
      }
      function Tr(t) {
        var e = yf(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = Mf(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function Cr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case oi:
            if (t.type === e.value) return !0;
            break;
          case si:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, u = t[a++], m = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !In(l)) {
                  for (; m != null && Cr(l, m); )
                    u++, m = e[u];
                  if (u === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (l = l.child; l !== null; )
                      t.push(l, u), l = l.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ci:
            if ((a === 5 || a === 26 || a === 27) && Rf(t.stateNode, e.value))
              return !0;
            break;
          case di:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Of(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ui:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function jr(t) {
        switch (t.$$typeof) {
          case oi:
            return "<" + (H(t.value) || "Unknown") + ">";
          case si:
            return ":has(" + (jr(t) || "") + ")";
          case ci:
            return '[role="' + t.value + '"]';
          case di:
            return '"' + t.value + '"';
          case ui:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function Bc(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], u = r.tag, m = t[l++], y = e[m];
          if (u !== 5 && u !== 26 && u !== 27 || !In(r)) {
            for (; y != null && Cr(r, y); )
              m++, y = e[m];
            if (m === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, m), r = r.sibling;
          }
        }
        return a;
      }
      function Mr(t, e) {
        if (!Fn) throw Error(c(363));
        t = Tr(t), t = Bc(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var l = t[a++], r = l.tag;
          if (r === 5 || r === 26 || r === 27)
            In(l) || e.push(l.stateNode);
          else
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
        }
        return e;
      }
      function pe() {
        return (gt & 2) !== 0 && vt !== 0 ? vt & -vt : rt.T !== null ? Yi() : wf();
      }
      function qc() {
        if (we === 0)
          if ((vt & 536870912) === 0 || yt) {
            var t = Ll;
            Ll <<= 1, (Ll & 3932160) === 0 && (Ll = 262144), we = t;
          } else we = 536870912;
        return t = ye.current, t !== null && (t.flags |= 32), we;
      }
      function se(t, e, a) {
        (t === Ct && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null) && (sn(t, 0), ba(
          t,
          vt,
          we,
          !1
        )), T(t, a), ((gt & 2) === 0 || t !== Ct) && (t === Ct && ((gt & 2) === 0 && (Fa |= a), Dt === 4 && ba(
          t,
          vt,
          we,
          !1
        )), Ge(t));
      }
      function Yc(t, e, a) {
        if ((gt & 6) !== 0) throw Error(c(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || E(t, e), r = l ? Im(t, e) : Or(t, e, !0), u = l;
        do {
          if (r === 0) {
            Tn && !l && ba(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Wm(a)) {
              r = Or(t, e, !1), u = !1;
              continue;
            }
            if (r === 2) {
              if (u = e, t.errorRecoveryDisabledLanes & u)
                var m = 0;
              else
                m = t.pendingLanes & -536870913, m = m !== 0 ? m : m & 536870912 ? 536870912 : 0;
              if (m !== 0) {
                e = m;
                t: {
                  var y = t;
                  r = rl;
                  var R = le && y.current.memoizedState.isDehydrated;
                  if (R && (sn(y, m).flags |= 256), m = Or(
                    y,
                    m,
                    !1
                  ), m !== 2) {
                    if (ho && !R) {
                      y.errorRecoveryDisabledLanes |= u, Fa |= u, r = 4;
                      break t;
                    }
                    u = de, de = r, u !== null && (de === null ? de = u : de.push.apply(
                      de,
                      u
                    ));
                  }
                  r = m;
                }
                if (u = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              sn(t, 0), ba(t, e, 0, !0);
              break;
            }
            t: {
              switch (l = t, u = r, u) {
                case 0:
                case 1:
                  throw Error(c(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  ba(
                    l,
                    e,
                    we,
                    !ka
                  );
                  break t;
                case 2:
                  de = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(c(329));
              }
              if ((e & 62914560) === e && (r = mi + 300 - ce(), 10 < r)) {
                if (ba(
                  l,
                  e,
                  we,
                  !ka
                ), q(l, 0, !0) !== 0) break t;
                ra = e, l.timeoutHandle = bf(
                  Gc.bind(
                    null,
                    l,
                    a,
                    de,
                    fi,
                    bo,
                    e,
                    we,
                    Fa,
                    Cn,
                    ka,
                    u,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Gc(
                l,
                a,
                de,
                fi,
                bo,
                e,
                we,
                Fa,
                Cn,
                ka,
                u,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Ge(t);
      }
      function Gc(t, e, a, l, r, u, m, y, R, Q, Z, V, L, mt) {
        if (t.timeoutHandle = Qa, V = e.subtreeFlags, V & 8192 || (V & 16785408) === 16785408) {
          V = Ef(), Rc(
            e,
            u,
            V
          );
          var ee = (u & 62914560) === u ? mi - ce() : (u & 4194048) === u ? Zu - ce() : 0;
          if (ee = Nf(
            V,
            ee
          ), ee !== null) {
            ra = u, t.cancelPendingCommit = ee(
              Fc.bind(
                null,
                t,
                e,
                u,
                a,
                l,
                r,
                m,
                y,
                R,
                Z,
                V,
                null,
                L,
                mt
              )
            ), ba(t, u, m, !Q);
            return;
          }
        }
        Fc(
          t,
          e,
          u,
          a,
          l,
          r,
          m,
          y,
          R
        );
      }
      function Wm(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var l = 0; l < a.length; l++) {
              var r = a[l], u = r.getSnapshot;
              r = r.value;
              try {
                if (!ve(u(), r)) return !1;
              } catch {
                return !1;
              }
            }
          if (a = e.child, e.subtreeFlags & 16384 && a !== null)
            a.return = e, e = a;
          else {
            if (e === t) break;
            for (; e.sibling === null; ) {
              if (e.return === null || e.return === t) return !0;
              e = e.return;
            }
            e.sibling.return = e.return, e = e.sibling;
          }
        }
        return !0;
      }
      function ba(t, e, a, l) {
        e &= ~go, e &= ~Fa, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - ge(r), m = 1 << u;
          l[u] = -1, r &= ~m;
        }
        a !== 0 && h(t, a, e);
      }
      function Qc() {
        return (gt & 6) === 0 ? (ln(0), !1) : !0;
      }
      function Ar() {
        if (bt !== null) {
          if (Et === 0)
            var t = bt.return;
          else
            t = bt, aa = Va = null, Pi(t), _n = null, al = 0, t = bt;
          for (; t !== null; )
            xc(t.alternate, t), t = t.return;
          bt = null;
        }
      }
      function sn(t, e) {
        var a = t.timeoutHandle;
        a !== Qa && (t.timeoutHandle = Qa, vf(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, Ar(), Ct = t, bt = a = Pe(t.current, null), vt = e, Et = 0, xe = null, ka = !1, Tn = E(t, e), ho = !1, Cn = we = go = Fa = za = Dt = 0, de = rl = null, bo = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - ge(l), u = 1 << r;
            e |= t[r], l &= ~u;
          }
        return ia = e, _l(), a;
      }
      function Kc(t, e) {
        ft = null, rt.H = ll, e === wn || e === ai ? (e = cs(), Et = 3) : e === ro ? (e = cs(), Et = 4) : Et = e === mo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, xe = e, bt === null && (Dt = 1, Al(
          t,
          B(e, t.current)
        ));
      }
      function Vc() {
        var t = ye.current;
        return t === null ? !0 : (vt & 4194048) === vt ? Ce === null : (vt & 62914560) === vt || (vt & 536870912) !== 0 ? t === Ce : !1;
      }
      function Xc() {
        var t = rt.H;
        return rt.H = ll, t === null ? ll : t;
      }
      function Zc() {
        var t = rt.A;
        return rt.A = Fp, t;
      }
      function Gl() {
        Dt = 4, ka || (vt & 4194048) !== vt && ye.current !== null || (Tn = !0), (za & 134217727) === 0 && (Fa & 134217727) === 0 || Ct === null || ba(
          Ct,
          vt,
          we,
          !1
        );
      }
      function Or(t, e, a) {
        var l = gt;
        gt |= 2;
        var r = Xc(), u = Zc();
        (Ct !== t || vt !== e) && (fi = null, sn(t, e)), e = !1;
        var m = Dt;
        t: do
          try {
            if (Et !== 0 && bt !== null) {
              var y = bt, R = xe;
              switch (Et) {
                case 8:
                  Ar(), m = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ye.current === null && (e = !0);
                  var Q = Et;
                  if (Et = 0, xe = null, cn(t, y, R, Q), a && Tn) {
                    m = 0;
                    break t;
                  }
                  break;
                default:
                  Q = Et, Et = 0, xe = null, cn(t, y, R, Q);
              }
            }
            Fm(), m = Dt;
            break;
          } catch (Z) {
            Kc(t, Z);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Va = null, gt = l, rt.H = r, rt.A = u, bt === null && (Ct = null, vt = 0, _l()), m;
      }
      function Fm() {
        for (; bt !== null; ) Jc(bt);
      }
      function Im(t, e) {
        var a = gt;
        gt |= 2;
        var l = Xc(), r = Zc();
        Ct !== t || vt !== e ? (fi = null, ol = ce() + 500, sn(t, e)) : Tn = E(
          t,
          e
        );
        t: do
          try {
            if (Et !== 0 && bt !== null) {
              e = bt;
              var u = xe;
              e: switch (Et) {
                case 1:
                  Et = 0, xe = null, cn(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (os(u)) {
                    Et = 0, xe = null, Lc(e);
                    break;
                  }
                  e = function() {
                    Et !== 2 && Et !== 9 || Ct !== t || (Et = 7), Ge(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Et = 7;
                  break t;
                case 4:
                  Et = 5;
                  break t;
                case 7:
                  os(u) ? (Et = 0, xe = null, Lc(e)) : (Et = 0, xe = null, cn(t, e, u, 7));
                  break;
                case 5:
                  var m = null;
                  switch (bt.tag) {
                    case 26:
                      m = bt.memoizedState;
                    case 5:
                    case 27:
                      var y = bt, R = y.type, Q = y.pendingProps;
                      if (m ? Ou(m) : bu(y.stateNode, R, Q)) {
                        Et = 0, xe = null;
                        var Z = y.sibling;
                        if (Z !== null) bt = Z;
                        else {
                          var V = y.return;
                          V !== null ? (bt = V, Ql(V)) : bt = null;
                        }
                        break e;
                      }
                  }
                  Et = 0, xe = null, cn(t, e, u, 5);
                  break;
                case 6:
                  Et = 0, xe = null, cn(t, e, u, 6);
                  break;
                case 8:
                  Ar(), Dt = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            $m();
            break;
          } catch (L) {
            Kc(t, L);
          }
        while (!0);
        return aa = Va = null, rt.H = l, rt.A = r, gt = a, bt !== null ? 0 : (Ct = null, vt = 0, _l(), Dt);
      }
      function $m() {
        for (; bt !== null && !qp(); )
          Jc(bt);
      }
      function Jc(t) {
        var e = hc(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function Lc(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = cc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              vt
            );
            break;
          case 11:
            e = cc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              vt
            );
            break;
          case 5:
            Pi(e);
          default:
            xc(a, e), e = bt = lu(e, ia), e = hc(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function cn(t, e, a, l) {
        aa = Va = null, Pi(e), _n = null, al = 0;
        var r = e.return;
        try {
          if (Qm(
            t,
            r,
            e,
            a,
            vt
          )) {
            Dt = 1, Al(
              t,
              B(a, t.current)
            ), bt = null;
            return;
          }
        } catch (u) {
          if (r !== null) throw bt = r, u;
          Dt = 1, Al(
            t,
            B(a, t.current)
          ), bt = null;
          return;
        }
        e.flags & 32768 ? (yt || l === 1 ? t = !0 : Tn || (vt & 536870912) !== 0 ? t = !1 : (ka = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = ye.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Wc(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Wc(
              e,
              ka
            );
            return;
          }
          t = e.return;
          var a = Xm(
            e.alternate,
            e,
            ia
          );
          if (a !== null) {
            bt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            bt = e;
            return;
          }
          bt = e = t;
        } while (e !== null);
        Dt === 0 && (Dt = 5);
      }
      function Wc(t, e) {
        do {
          var a = Zm(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, bt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            bt = t;
            return;
          }
          bt = t = a;
        } while (t !== null);
        Dt = 6, bt = null;
      }
      function Fc(t, e, a, l, r, u, m, y, R) {
        t.cancelPendingCommit = null;
        do
          Ln();
        while (Xt !== 0);
        if ((gt & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (u = e.lanes | e.childLanes, u |= oo, g(
            t,
            a,
            u,
            m,
            y,
            R
          ), t === Ct && (bt = Ct = null, vt = 0), jn = e, Na = t, ra = a, vo = u, yo = r, Ju = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, af(Pr, function() {
            return eu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = rt.T, rt.T = null, r = ea(), Lt(2), m = gt, gt |= 4;
            try {
              Jm(t, e, a);
            } finally {
              gt = m, Lt(r), rt.T = l;
            }
          }
          Xt = 1, Ic(), $c(), Pc();
        }
      }
      function Ic() {
        if (Xt === 1) {
          Xt = 0;
          var t = Na, e = jn, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = rt.T, rt.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Mc(e, t), hf(t.containerInfo);
            } finally {
              gt = r, Lt(l), rt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function $c() {
        if (Xt === 2) {
          Xt = 0;
          var t = Na, e = jn, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = rt.T, rt.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Nc(t, e.alternate, e);
            } finally {
              gt = r, Lt(l), rt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Pc() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Yp();
          var t = Na, e = jn, a = ra, l = Ju;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, jn = Na = null, tu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Ea = null), et(a), e = e.stateNode, be && typeof be.onCommitFiberRoot == "function")
            try {
              be.onCommitFiberRoot(
                $n,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (l !== null) {
            e = rt.T, r = ea(), Lt(2), rt.T = null;
            try {
              for (var u = t.onRecoverableError, m = 0; m < l.length; m++) {
                var y = l[m];
                u(y.value, {
                  componentStack: y.stack
                });
              }
            } finally {
              rt.T = e, Lt(r);
            }
          }
          (ra & 3) !== 0 && Ln(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === xo ? sl++ : (sl = 0, xo = t) : sl = 0, le && kp(), ln(0);
        }
      }
      function tu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Hn(e)));
      }
      function Ln() {
        return Ic(), $c(), Pc(), eu();
      }
      function eu() {
        if (Xt !== 5) return !1;
        var t = Na, e = vo;
        vo = 0;
        var a = et(ra), l = 32 > a ? 32 : a;
        a = rt.T;
        var r = ea();
        try {
          Lt(l), rt.T = null, l = yo, yo = null;
          var u = Na, m = ra;
          if (Xt = 0, jn = Na = null, ra = 0, (gt & 6) !== 0)
            throw Error(c(331));
          var y = gt;
          if (gt |= 4, Dc(u.current), Oc(
            u,
            u.current,
            m,
            l
          ), gt = y, ln(0, !1), be && typeof be.onPostCommitFiberRoot == "function")
            try {
              be.onPostCommitFiberRoot($n, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), rt.T = a, tu(t, e);
        }
      }
      function au(t, e, a) {
        e = B(a, e), e = dr(t.stateNode, e, 2), t = fa(t, e, 2), t !== null && (T(t, 2), Ge(t));
      }
      function wt(t, e, a) {
        if (t.tag === 3)
          au(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              au(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Ea === null || !Ea.has(l))) {
                t = B(a, t), a = ec(2), l = fa(e, a, 2), l !== null && (ac(
                  a,
                  l,
                  e,
                  t
                ), T(l, 2), Ge(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function Rr(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new Ip();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (ho = !0, r.add(a), t = Pm.bind(null, t, e, a), e.then(t, t));
      }
      function Pm(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Ct === t && (vt & a) === a && (Dt === 4 || Dt === 3 && (vt & 62914560) === vt && 300 > ce() - mi ? (gt & 2) === 0 && sn(t, 0) : go |= a, Cn === vt && (Cn = 0)), Ge(t);
      }
      function nu(t, e) {
        e === 0 && (e = j()), t = Ua(t, e), t !== null && (T(t, e), Ge(t));
      }
      function tf(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), nu(t, a);
      }
      function ef(t, e) {
        var a = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var l = t.stateNode, r = t.memoizedState;
            r !== null && (a = r.retryLane);
            break;
          case 19:
            l = t.stateNode;
            break;
          case 22:
            l = t.stateNode._retryCache;
            break;
          default:
            throw Error(c(314));
        }
        l !== null && l.delete(e), nu(t, a);
      }
      function af(t, e) {
        return Fl(t, e);
      }
      function nf(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Hr(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function Pe(t, e) {
        var a = t.alternate;
        return a === null ? (a = o(
          t.tag,
          e,
          t.key,
          t.mode
        ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
      }
      function lu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Kl(t, e, a, l, r, u) {
        var m = 0;
        if (l = t, typeof t == "function") Hr(t) && (m = 1);
        else if (typeof t == "string")
          m = Ue && Vt ? Nu(t, a, Pt.current) ? 26 : Du(t) ? 27 : 5 : Ue ? Nu(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Du(t) ? 27 : 5;
        else
          t: switch (t) {
            case Xr:
              return t = o(31, a, e, r), t.elementType = Xr, t.lanes = u, t;
            case dn:
              return Ga(
                a.children,
                r,
                u,
                e
              );
            case du:
              m = 8, r |= 24;
              break;
            case Yr:
              return t = o(12, a, e, r | 2), t.elementType = Yr, t.lanes = u, t;
            case Qr:
              return t = o(13, a, e, r), t.elementType = Qr, t.lanes = u, t;
            case Kr:
              return t = o(19, a, e, r), t.elementType = Kr, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case va:
                    m = 10;
                    break t;
                  case mu:
                    m = 9;
                    break t;
                  case Gr:
                    m = 11;
                    break t;
                  case Vr:
                    m = 14;
                    break t;
                  case ya:
                    m = 16, l = null;
                    break t;
                }
              m = 29, a = Error(
                c(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), l = null;
          }
        return e = o(m, a, e, r), e.elementType = t, e.type = l, e.lanes = u, e;
      }
      function Ga(t, e, a, l) {
        return t = o(7, t, l, e), t.lanes = a, t;
      }
      function Dr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function iu(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Ur(t, e, a) {
        return e = o(
          4,
          t.children !== null ? t.children : [],
          t.key,
          e
        ), e.lanes = a, e.stateNode = {
          containerInfo: t.containerInfo,
          pendingChildren: null,
          implementation: t.implementation
        }, e;
      }
      function lf(t, e, a, l, r, u, m, y, R) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = D(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = D(0), this.hiddenUpdates = D(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = m, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = R, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function ru(t, e, a, l, r, u, m, y, R, Q, Z, V) {
        return t = new lf(
          t,
          e,
          a,
          m,
          R,
          Q,
          Z,
          V,
          y
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = qi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Ki(u), t;
      }
      function ou(t) {
        return t ? (t = hn, t) : hn;
      }
      function su(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = f(e), t = t !== null ? _(t) : null, t === null ? null : Wn(t.stateNode);
      }
      function cu(t, e, a, l, r, u) {
        r = ou(r), l.context === null ? l.context = r : l.pendingContext = r, l = ma(e), l.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (l.callback = u), a = fa(t, l, e), a !== null && (se(a, t, e), Un(a, t, e));
      }
      function uu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Br(t, e) {
        uu(t, e), (t = t.alternate) && uu(t, e);
      }
      var ht = {}, rf = Qd(), he = yh(), qr = Object.assign, of = Symbol.for("react.element"), Vl = Symbol.for("react.transitional.element"), un = Symbol.for("react.portal"), dn = Symbol.for("react.fragment"), du = Symbol.for("react.strict_mode"), Yr = Symbol.for("react.profiler"), mu = Symbol.for("react.consumer"), va = Symbol.for("react.context"), Gr = Symbol.for("react.forward_ref"), Qr = Symbol.for("react.suspense"), Kr = Symbol.for("react.suspense_list"), Vr = Symbol.for("react.memo"), ya = Symbol.for("react.lazy"), Xr = Symbol.for("react.activity"), sf = Symbol.for("react.memo_cache_sentinel"), fu = Symbol.iterator, cf = Symbol.for("react.client.reference"), Xl = Array.isArray, rt = rf.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, uf = i.rendererVersion, df = i.rendererPackageName, pu = i.extraDevToolsConfig, Wn = i.getPublicInstance, mf = i.getRootHostContext, ff = i.getChildHostContext, pf = i.prepareForCommit, hf = i.resetAfterCommit, gf = i.createInstance;
      i.cloneMutableInstance;
      var Zr = i.appendInitialChild, hu = i.finalizeInitialChildren, Zl = i.shouldSetTextContent, gu = i.createTextInstance;
      i.cloneMutableTextInstance;
      var bf = i.scheduleTimeout, vf = i.cancelTimeout, Qa = i.noTimeout, ta = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ne = i.supportsMutation, Ke = i.supportsPersistence, le = i.supportsHydration, yf = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var xf = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Lt = i.setCurrentUpdatePriority, ea = i.getCurrentUpdatePriority, wf = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var _f = i.shouldAttemptEagerTransition, Sf = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var kf = i.maySuspendCommit, zf = i.maySuspendCommitOnUpdate, Jr = i.maySuspendCommitInSyncRender, bu = i.preloadInstance, Ef = i.startSuspendingCommit, vu = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var Nf = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var mn = i.NotPendingTransition, Ka = i.HostTransitionContext, Tf = i.resetFormInstance;
      i.bindToConsole;
      var Cf = i.supportsMicrotasks, jf = i.scheduleMicrotask, Fn = i.supportsTestSelectors, Mf = i.findFiberRoot, Af = i.getBoundingRect, Of = i.getTextContent, In = i.isHiddenSubtree, Rf = i.matchAccessibilityRole, Hf = i.setFocusIfFocusable, Df = i.setupIntersectionObserver, Uf = i.appendChild, Bf = i.appendChildToContainer, qf = i.commitTextUpdate, Yf = i.commitMount, Gf = i.commitUpdate, Qf = i.insertBefore, Kf = i.insertInContainerBefore, Vf = i.removeChild, Xf = i.removeChildFromContainer, yu = i.resetTextContent, Zf = i.hideInstance, Jf = i.hideTextInstance, Lf = i.unhideInstance, Wf = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var Ff = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var If = i.cloneInstance, xu = i.createContainerChildSet, wu = i.appendChildToContainerChildSet, $f = i.finalizeContainerChildren, _u = i.replaceContainerChildren, Su = i.cloneHiddenInstance, ku = i.cloneHiddenTextInstance, Lr = i.isSuspenseInstancePending, Wr = i.isSuspenseInstanceFallback, Pf = i.getSuspenseInstanceFallbackErrorDetails, tp = i.registerSuspenseInstanceRetry, ep = i.canHydrateFormStateMarker, ap = i.isFormStateMarkerMatching, zu = i.getNextHydratableSibling, np = i.getNextHydratableSiblingAfterSingleton, lp = i.getFirstHydratableChild, ip = i.getFirstHydratableChildWithinContainer, rp = i.getFirstHydratableChildWithinActivityInstance, op = i.getFirstHydratableChildWithinSuspenseInstance, sp = i.getFirstHydratableChildWithinSingleton, cp = i.canHydrateInstance, up = i.canHydrateTextInstance, dp = i.canHydrateActivityInstance, mp = i.canHydrateSuspenseInstance, fp = i.hydrateInstance, pp = i.hydrateTextInstance, hp = i.hydrateActivityInstance, gp = i.hydrateSuspenseInstance, bp = i.getNextHydratableInstanceAfterActivityInstance, vp = i.getNextHydratableInstanceAfterSuspenseInstance, yp = i.commitHydratedInstance, xp = i.commitHydratedContainer, wp = i.commitHydratedActivityInstance, _p = i.commitHydratedSuspenseInstance, Sp = i.finalizeHydratedChildren, kp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var zp = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var Ep = i.clearSuspenseBoundaryFromContainer, Np = i.hideDehydratedBoundary, Tp = i.unhideDehydratedBoundary, Eu = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var Cp = i.validateHydratableInstance, jp = i.validateHydratableTextInstance, Ue = i.supportsResources, Nu = i.isHostHoistableType, Fr = i.getHoistableRoot, Tu = i.getResource, Cu = i.acquireResource, ju = i.releaseResource, Mp = i.hydrateHoistable, Mu = i.mountHoistable, Au = i.unmountHoistable, Ap = i.createHoistableInstance, Op = i.prepareToCommitHoistables, Rp = i.mayResourceSuspendCommit, Ou = i.preloadResource, Hp = i.suspendResource, Vt = i.supportsSingletons, Ru = i.resolveSingletonInstance, Dp = i.acquireSingletonInstance, Hu = i.releaseSingletonInstance, Du = i.isHostSingletonType, fn = i.isSingletonScope, Ir = [], pn = -1, hn = {}, ge = Math.clz32 ? Math.clz32 : w, Up = Math.log, Bp = Math.LN2, Jl = 256, Ll = 262144, Wl = 4194304, Fl = he.unstable_scheduleCallback, $r = he.unstable_cancelCallback, qp = he.unstable_shouldYield, Yp = he.unstable_requestPaint, ce = he.unstable_now, Uu = he.unstable_ImmediatePriority, Gp = he.unstable_UserBlockingPriority, Pr = he.unstable_NormalPriority, Qp = he.unstable_IdlePriority, Kp = he.log, Vp = he.unstable_setDisableYieldValue, $n = null, be = null, ve = typeof Object.is == "function" ? Object.is : Kt, Bu = typeof reportError == "function" ? reportError : function(t) {
        if (typeof window == "object" && typeof window.ErrorEvent == "function") {
          var e = new window.ErrorEvent("error", {
            bubbles: !0,
            cancelable: !0,
            message: typeof t == "object" && t !== null && typeof t.message == "string" ? String(t.message) : String(t),
            error: t
          });
          if (!window.dispatchEvent(e)) return;
        } else if (typeof process == "object" && typeof process.emit == "function") {
          process.emit("uncaughtException", t);
          return;
        }
        console.error(t);
      }, Xp = Object.prototype.hasOwnProperty, to, qu, eo = !1, Yu = /* @__PURE__ */ new WeakMap(), gn = [], bn = 0, Il = null, Pn = 0, ze = [], Ee = 0, xa = null, Ve = 1, Xe = "", Pt = k(null), tl = k(null), wa = k(null), $l = k(null), te = null, At = null, yt = !1, _a = null, Ne = !1, ao = Error(c(519)), Pl = k(null), Va = null, aa = null, Zp = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(a, l) {
            t.push(l);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(a) {
            return a();
          });
        };
      }, Jp = he.unstable_scheduleCallback, Lp = he.unstable_NormalPriority, Ot = {
        $$typeof: va,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ti = null, vn = null, no = !1, ei = !1, lo = !1, Xa = 0, el = null, io = 0, yn = 0, xn = null, Gu = rt.S;
      rt.S = function(t, e) {
        Zu = ce(), typeof e == "object" && e !== null && typeof e.then == "function" && Rm(t, e), Gu !== null && Gu(t, e);
      };
      var Za = k(null), wn = Error(c(460)), ro = Error(c(474)), ai = Error(c(542)), ni = { then: function() {
      } }, Ja = null, _n = null, al = 0, La = ds(!0), Qu = ds(!1), Te = [], Sn = 0, oo = 0, Sa = !1, so = !1, kn = k(null), li = k(0), ye = k(null), Ce = null, Bt = k(0), na = 0, ft = null, Nt = null, qt = null, ii = !1, zn = !1, Wa = !1, ri = 0, nl = 0, En = null, Wp = 0, ll = {
        readContext: It,
        use: Nl,
        useCallback: Ht,
        useContext: Ht,
        useEffect: Ht,
        useImperativeHandle: Ht,
        useLayoutEffect: Ht,
        useInsertionEffect: Ht,
        useMemo: Ht,
        useReducer: Ht,
        useRef: Ht,
        useState: Ht,
        useDebugValue: Ht,
        useDeferredValue: Ht,
        useTransition: Ht,
        useSyncExternalStore: Ht,
        useId: Ht,
        useHostTransitionStatus: Ht,
        useFormState: Ht,
        useActionState: Ht,
        useOptimistic: Ht,
        useMemoCache: Ht,
        useCacheRefresh: Ht
      };
      ll.useEffectEvent = Ht;
      var Ku = {
        readContext: It,
        use: Nl,
        useCallback: function(t, e) {
          return re().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Ds,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Cl(
            4194308,
            4,
            Ys.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Cl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Cl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = re();
          e = e === void 0 ? null : e;
          var l = t();
          if (Wa) {
            Mt(!0);
            try {
              t();
            } finally {
              Mt(!1);
            }
          }
          return a.memoizedState = [l, e], l;
        },
        useReducer: function(t, e, a) {
          var l = re();
          if (a !== void 0) {
            var r = a(e);
            if (Wa) {
              Mt(!0);
              try {
                a(e);
              } finally {
                Mt(!1);
              }
            }
          } else r = e;
          return l.memoizedState = l.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, l.queue = t, t = t.dispatch = Gm.bind(
            null,
            ft,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = re();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = nr(t);
          var e = t.queue, a = Ws.bind(
            null,
            ft,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: rr,
        useDeferredValue: function(t, e) {
          var a = re();
          return or(a, t, e);
        },
        useTransition: function() {
          var t = nr(!1);
          return t = Xs.bind(
            null,
            ft,
            t.queue,
            !0,
            !1
          ), re().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = ft, r = re();
          if (yt) {
            if (a === void 0)
              throw Error(c(407));
            a = a();
          } else {
            if (a = e(), Ct === null)
              throw Error(c(349));
            (vt & 127) !== 0 || xs(l, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Ds(_s.bind(null, l, u, t), [
            t
          ]), l.flags |= 2048, rn(
            9,
            { destroy: void 0 },
            ws.bind(
              null,
              l,
              u,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = re(), e = Ct.identifierPrefix;
          if (yt) {
            var a = Xe, l = Ve;
            a = (l & ~(1 << 32 - ge(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ri++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Wp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: sr,
        useFormState: Ms,
        useActionState: Ms,
        useOptimistic: function(t) {
          var e = re();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = cr.bind(
            null,
            ft,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: tr,
        useCacheRefresh: function() {
          return re().memoizedState = Ym.bind(
            null,
            ft
          );
        },
        useEffectEvent: function(t) {
          var e = re(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((gt & 2) !== 0)
              throw Error(c(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, co = {
        readContext: It,
        use: Nl,
        useCallback: Qs,
        useContext: It,
        useEffect: ir,
        useImperativeHandle: Gs,
        useInsertionEffect: Bs,
        useLayoutEffect: qs,
        useMemo: Ks,
        useReducer: Tl,
        useRef: Hs,
        useState: function() {
          return Tl(We);
        },
        useDebugValue: rr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Vs(
            a,
            Nt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Tl(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Yn(t),
            e
          ];
        },
        useSyncExternalStore: ys,
        useId: Js,
        useHostTransitionStatus: sr,
        useFormState: As,
        useActionState: As,
        useOptimistic: function(t, e) {
          var a = Ut();
          return zs(a, Nt, t, e);
        },
        useMemoCache: tr,
        useCacheRefresh: Ls
      };
      co.useEffectEvent = Us;
      var Vu = {
        readContext: It,
        use: Nl,
        useCallback: Qs,
        useContext: It,
        useEffect: ir,
        useImperativeHandle: Gs,
        useInsertionEffect: Bs,
        useLayoutEffect: qs,
        useMemo: Ks,
        useReducer: ar,
        useRef: Hs,
        useState: function() {
          return ar(We);
        },
        useDebugValue: rr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Nt === null ? or(a, t, e) : Vs(
            a,
            Nt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = ar(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Yn(t),
            e
          ];
        },
        useSyncExternalStore: ys,
        useId: Js,
        useHostTransitionStatus: sr,
        useFormState: Rs,
        useActionState: Rs,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Nt !== null ? zs(a, Nt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: tr,
        useCacheRefresh: Ls
      };
      Vu.useEffectEvent = Us;
      var uo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = pe(), r = ma(l);
          r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (se(e, t, l), Un(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = pe(), r = ma(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (se(e, t, l), Un(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = pe(), l = ma(a);
          l.tag = 2, e != null && (l.callback = e), e = fa(t, l, a), e !== null && (se(e, t, a), Un(e, t, a));
        }
      }, mo = Error(c(461)), Yt = !1, fo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, la = !1, Gt = !1, po = !1, Xu = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, ue = !1, Be = null, Nn = 8192, Fp = {
        getCacheForType: function(t) {
          var e = It(Ot), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return It(Ot).controller.signal;
        }
      }, oi = 0, si = 1, ci = 2, ui = 3, di = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var il = Symbol.for;
        oi = il("selector.component"), si = il("selector.has_pseudo_class"), ci = il("selector.role"), ui = il("selector.test_id"), di = il("selector.text");
      }
      var Ip = typeof WeakMap == "function" ? WeakMap : Map, gt = 0, Ct = null, bt = null, vt = 0, Et = 0, xe = null, ka = !1, Tn = !1, ho = !1, ia = 0, Dt = 0, za = 0, Fa = 0, go = 0, we = 0, Cn = 0, rl = null, de = null, bo = !1, mi = 0, Zu = 0, ol = 1 / 0, fi = null, Ea = null, Xt = 0, Na = null, jn = null, ra = 0, vo = 0, yo = null, Ju = null, sl = 0, xo = null;
      return ht.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ua(t, 67108864);
          e !== null && se(e, t, 67108864), Br(t, 67108864);
        }
      }, ht.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = pe();
          e = at(e);
          var a = Ua(t, e);
          a !== null && se(a, t, e), Br(t, e);
        }
      }, ht.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = z(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - ge(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ge(t), (gt & 6) === 0 && (ol = ce() + 500, ln(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ua(t, 2), e !== null && se(e, t, 2), Qc(), Br(t, 2);
        }
      }, ht.batchedUpdates = function(t, e) {
        return t(e);
      }, ht.createComponentSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, ht.createContainer = function(t, e, a, l, r, u, m, y, R, Q) {
        return ru(
          t,
          e,
          !1,
          null,
          a,
          l,
          u,
          null,
          m,
          y,
          R,
          Q
        );
      }, ht.createHasPseudoClassSelector = function(t) {
        return { $$typeof: si, value: t };
      }, ht.createHydrationContainer = function(t, e, a, l, r, u, m, y, R, Q, Z, V, L, mt) {
        return t = ru(
          a,
          l,
          !0,
          t,
          r,
          u,
          y,
          mt,
          R,
          Q,
          Z,
          V
        ), t.context = ou(null), a = t.current, l = pe(), l = at(l), r = ma(l), r.callback = e ?? null, fa(a, r, l), e = l, t.current.lanes = e, T(t, e), Ge(t), t;
      }, ht.createPortal = function(t, e, a) {
        var l = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: un,
          key: l == null ? null : "" + l,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, ht.createRoleSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, ht.createTestNameSelector = function(t) {
        return { $$typeof: ui, value: t };
      }, ht.createTextSelector = function(t) {
        return { $$typeof: di, value: t };
      }, ht.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ht.defaultOnRecoverableError = function(t) {
        Bu(t);
      }, ht.defaultOnUncaughtError = function(t) {
        Bu(t);
      }, ht.deferredUpdates = function(t) {
        var e = rt.T, a = ea();
        try {
          return Lt(32), rt.T = null, t();
        } finally {
          Lt(a), rt.T = e;
        }
      }, ht.discreteUpdates = function(t, e, a, l, r) {
        var u = rt.T, m = ea();
        try {
          return Lt(2), rt.T = null, t(e, a, l, r);
        } finally {
          Lt(m), rt.T = u, gt === 0 && (ol = ce() + 500);
        }
      }, ht.findAllNodes = Mr, ht.findBoundingRects = function(t, e) {
        if (!Fn) throw Error(c(363));
        e = Mr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Af(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, u = a.y, m = u + a.height, y = e - 1; 0 <= y; y--)
            if (e !== y) {
              var R = t[y], Q = R.x, Z = Q + R.width, V = R.y, L = V + R.height;
              if (l >= Q && u >= V && r <= Z && m <= L) {
                t.splice(e, 1);
                break;
              } else if (l !== Q || a.width !== R.width || L < u || V > m) {
                if (!(u !== V || a.height !== R.height || Z < l || Q > r)) {
                  Q > l && (R.width += Q - l, R.x = l), Z < r && (R.width = r - Q), t.splice(e, 1);
                  break;
                }
              } else {
                V > u && (R.height += V - u, R.y = u), L < m && (R.height = m - V), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ht.findHostInstance = su, ht.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? x(t) : null, t === null ? null : Wn(t.stateNode);
      }, ht.findHostInstanceWithWarning = function(t) {
        return su(t);
      }, ht.flushPassiveEffects = Ln, ht.flushSyncFromReconciler = function(t) {
        var e = gt;
        gt |= 1;
        var a = rt.T, l = ea();
        try {
          if (Lt(2), rt.T = null, t)
            return t();
        } finally {
          Lt(l), rt.T = a, gt = e, (gt & 6) === 0 && ln(0);
        }
      }, ht.flushSyncWork = Qc, ht.focusWithin = function(t, e) {
        if (!Fn) throw Error(c(363));
        for (t = Tr(t), e = Bc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!In(a)) {
            if ((l === 5 || l === 26 || l === 27) && Hf(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ht.getFindAllNodesFailureDescription = function(t, e) {
        if (!Fn) throw Error(c(363));
        var a = 0, l = [];
        t = [Tr(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], m = u.tag, y = t[r++], R = e[y];
          if ((m !== 5 && m !== 26 && m !== 27 || !In(u)) && (Cr(u, R) && (l.push(jr(R)), y++, y > a && (a = y)), y < e.length))
            for (u = u.child; u !== null; )
              t.push(u, y), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(jr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (l.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, ht.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Wn(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, ht.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: uf,
          rendererPackageName: df,
          currentDispatcherRef: rt,
          reconcilerVersion: "19.2.0"
        };
        if (pu !== null && (t.rendererConfig = pu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              $n = e.inject(t), be = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ht.isAlreadyRendering = function() {
        return (gt & 6) !== 0;
      }, ht.observeVisibleRects = function(t, e, a, l) {
        if (!Fn) throw Error(c(363));
        t = Mr(t, e);
        var r = Df(
          t,
          a,
          l
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, ht.shouldError = function() {
        return null;
      }, ht.shouldSuspend = function() {
        return !1;
      }, ht.startHostTransition = function(t, e, a, l) {
        if (t.tag !== 5) throw Error(c(476));
        var r = Zs(t).queue;
        Xs(
          t,
          r,
          e,
          mn,
          a === null ? s : function() {
            var u = Zs(t);
            return u.next === null && (u = t.alternate.memoizedState), Gn(
              t,
              u.next.queue,
              {},
              pe()
            ), a(l);
          }
        );
      }, ht.updateContainer = function(t, e, a, l) {
        var r = e.current, u = pe();
        return cu(
          r,
          u,
          t,
          e,
          a,
          l
        ), u;
      }, ht.updateContainerSync = function(t, e, a, l) {
        return cu(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, ht;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(ko)), ko.exports;
}
var id;
function wh() {
  return id || (id = 1, So.exports = xh()), So.exports;
}
var _h = wh();
const Sh = /* @__PURE__ */ Jo(_h);
var No = { exports: {} }, oa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var rd;
function kh() {
  return rd || (rd = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var od;
function zh() {
  return od || (od = 1, No.exports = kh()), No.exports;
}
var pl = zh();
//! The cascade: the computed style of a host element from the app's own compiled stylesheet (`css-table.json`,
//! written at build time from Vite + Tailwind's output by `build.mjs`), WebKit's user-agent defaults for the tags a
//! stock screen uses, the element's inline `style`, and the theme tokens the `perch` host gives (set on the root as
//! `themes.ts` `applyTheme` sets them on `<html>`, so `var(--accent)` resolves as on the web).
//!
//! It is a CSS engine for exactly what the app's stylesheet needs: selectors through `selector.mjs`, layers, the
//! viewport media queries (evaluated against `perch.viewport()`, so `min-[701px]:` is the desktop variant), custom
//! properties with `var()` fallbacks and `@property` initial values, `calc()`/`min()`/`max()`, the shorthands the
//! utilities write, `color-mix()` and inheritance. A colour keeps the theme token it came from (`token`), as the web
//! reference's provenance does. Nothing here knows GPUI; `translate.mjs` turns a computed style into engine styles.
const Kd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Ao = 16, Vd = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Eh = [
  ["html", { display: "block", "font-size": "16px", "font-family": "Times", color: "#000000", "line-height": "normal" }],
  ["body", { display: "block", margin: "8px" }],
  ["div, section, aside, p, nav, header, footer, main, ul, ol, li, form, label[hidden]", { display: "block" }],
  ["p", { "margin-top": "1em", "margin-bottom": "1em" }],
  ["strong, b", { "font-weight": "bold" }],
  ["em, i", { "font-style": "italic" }],
  ["kbd, code, samp, pre", { "font-family": "monospace" }],
  ["button, input, select, textarea", {
    display: "inline-block",
    "font-family": "system-ui",
    "font-size": "13.333333px",
    "font-weight": "400",
    "font-style": "normal",
    "line-height": "normal",
    "letter-spacing": "normal",
    "text-transform": "none",
    "text-indent": "0",
    "text-align": "start",
    margin: "0"
  }],
  ["button", {
    padding: "2px 6px 3px 6px",
    "border-width": "2px",
    "border-style": "outset",
    "border-color": "buttonborder",
    "background-color": "buttonface",
    color: "buttontext",
    "text-align": "center",
    cursor: "default",
    "box-sizing": "border-box"
  }],
  // A field's own text is the small system size (11 px, as the web reference measures a field that sets no size of
  // its own); a field that sets its size is unaffected.
  ["input, select, textarea", { "font-size": "11px" }],
  ["input", { padding: "1px 2px", "border-width": "2px", "border-style": "inset", "border-color": "buttonborder", "background-color": "field", color: "fieldtext" }],
  // A check box or radio button is WebKit's 12 px control with its margins (the reference's memory switch: 12 x 12,
  // 2 px from the label's edge, its row 18 px high).
  ['input[type="checkbox"], input[type="radio"]', { width: "12px", height: "12px", margin: "3px 2px", padding: "0", "border-width": "0", "box-sizing": "border-box" }],
  ["svg", { overflow: "hidden" }],
  ["[hidden]", { display: "none" }]
], sd = {
  buttontext: [255, 255, 255, 1],
  buttonface: [107, 107, 107, 1],
  buttonborder: [107, 107, 107, 1],
  field: [59, 59, 59, 1],
  fieldtext: [255, 255, 255, 1],
  canvastext: [255, 255, 255, 1],
  canvas: [30, 30, 30, 1],
  black: [0, 0, 0, 1],
  white: [255, 255, 255, 1],
  red: [255, 0, 0, 1],
  transparent: [0, 0, 0, 0]
}, Nh = /* @__PURE__ */ new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-transform",
  "text-align",
  "text-indent",
  "white-space",
  "visibility",
  "cursor",
  "font-variant-numeric",
  "overflow-wrap",
  "word-break",
  "pointer-events",
  "-webkit-touch-callout",
  "user-select",
  "-webkit-user-select",
  "color-scheme",
  "-webkit-tap-highlight-color",
  "accent-color"
]), Xd = {
  display: "inline",
  position: "static",
  top: "auto",
  right: "auto",
  bottom: "auto",
  left: "auto",
  "z-index": "auto",
  "flex-direction": "row",
  "flex-wrap": "nowrap",
  "align-items": "normal",
  "align-self": "auto",
  "justify-content": "normal",
  "justify-items": "legacy",
  "align-content": "normal",
  "flex-grow": "0",
  "flex-shrink": "1",
  "flex-basis": "auto",
  "row-gap": "normal",
  "column-gap": "normal",
  width: "auto",
  height: "auto",
  "min-width": "auto",
  "min-height": "auto",
  "max-width": "none",
  "max-height": "none",
  "margin-top": "0",
  "margin-right": "0",
  "margin-bottom": "0",
  "margin-left": "0",
  "padding-top": "0",
  "padding-right": "0",
  "padding-bottom": "0",
  "padding-left": "0",
  "border-top-width": "medium",
  "border-right-width": "medium",
  "border-bottom-width": "medium",
  "border-left-width": "medium",
  "border-top-style": "none",
  "border-right-style": "none",
  "border-bottom-style": "none",
  "border-left-style": "none",
  "border-top-color": "currentcolor",
  "border-right-color": "currentcolor",
  "border-bottom-color": "currentcolor",
  "border-left-color": "currentcolor",
  "border-top-left-radius": "0",
  "border-top-right-radius": "0",
  "border-bottom-right-radius": "0",
  "border-bottom-left-radius": "0",
  "background-color": "transparent",
  "background-image": "none",
  opacity: "1",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "text-overflow": "clip",
  "box-shadow": "none",
  "outline-style": "none",
  "outline-width": "medium",
  "outline-color": "currentcolor",
  "outline-offset": "0",
  "transition-property": "all",
  "transition-duration": "0s",
  "box-sizing": "content-box",
  "text-decoration-line": "none",
  "-webkit-line-clamp": "none",
  "-webkit-box-orient": "horizontal",
  "container-type": "normal"
}, Zd = {
  color: "canvastext",
  "font-family": "Times",
  "font-size": "16px",
  "font-weight": "400",
  "font-style": "normal",
  "line-height": "normal",
  "letter-spacing": "normal",
  "word-spacing": "normal",
  "text-transform": "none",
  "text-align": "start",
  "text-indent": "0",
  "white-space": "normal",
  visibility: "visible",
  cursor: "auto",
  "font-variant-numeric": "normal",
  "overflow-wrap": "normal",
  "word-break": "normal",
  "pointer-events": "auto",
  "-webkit-touch-callout": "default",
  "user-select": "auto",
  "-webkit-user-select": "auto",
  "color-scheme": "normal",
  "-webkit-tap-highlight-color": "transparent",
  "accent-color": "auto"
}, Oo = ["font-size", "color", ...new Set([...Object.keys(Xd), ...Object.keys(Zd)].filter((n) => n !== "font-size" && n !== "color"))], Th = new Set(Oo);
function ie(n, i = " ") {
  const o = [];
  let s = 0, c = "";
  for (let d = 0; d < n.length; d++) {
    const p = n[d];
    if (p === "(" ? s++ : p === ")" && s--, s === 0 && (i === " " ? /\s/.test(p) : p === i)) {
      (c.trim() || i !== " ") && o.push(c.trim()), c = "";
      continue;
    }
    c += p;
  }
  return (c.trim() || i !== " " && o.length) && o.push(c.trim()), o;
}
function Ro(n, i, o = 0) {
  if (o > 32) return null;
  let s = "", c = 0;
  for (; ; ) {
    const d = n.indexOf("var(", c);
    if (d < 0)
      return s += n.slice(c), s;
    s += n.slice(c, d);
    let p = 1, f = d + 4;
    for (; f < n.length && p; f++)
      n[f] === "(" ? p++ : n[f] === ")" && p--;
    const _ = n.slice(d + 4, f - 1), x = ie(_, ","), A = x[0].trim(), H = x.length > 1 ? _.slice(_.indexOf(",") + 1).trim() : null;
    let k = i(A);
    if ((k == null || k === "initial") && (k = H), k == null) return null;
    const b = Ro(k, i, o + 1);
    if (b === null) return null;
    s += b, c = f;
  }
}
function Ch(n) {
  const i = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, c = 0;
  for (; c < n.length; ) {
    if (o.lastIndex = c, s = o.exec(n), !s || s.index !== c) {
      if (/^\s+$/.test(n.slice(c))) break;
      return null;
    }
    c = o.lastIndex, s[1] !== void 0 ? i.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? i.push({ fn: s[3].toLowerCase() }) : s[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: s[5] ?? s[6] });
  }
  return i;
}
function On(n, i) {
  const o = Ch(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let s = 0;
  const c = ({ num: k, unit: b }) => {
    switch (b) {
      case "":
        return { px: 0, pct: 0, num: k, unitless: !0 };
      case "px":
        return { px: k, pct: 0, num: 0 };
      case "rem":
        return { px: k * Ao, pct: 0, num: 0 };
      case "em":
        return { px: k * (i.fontSize ?? Ao), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: k, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: k / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: k / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: k * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (k, b, S) => k && b ? { px: k.px + S * b.px, pct: k.pct + S * b.pct, num: k.num + S * b.num, unitless: k.unitless && b.unitless } : null, p = (k, b) => k ? { px: k.px * b, pct: k.pct * b, num: k.num * b, unitless: k.unitless } : null, f = (k) => k && k.unitless;
  function _() {
    const k = o[s++];
    if (!k) return null;
    if (k.num !== void 0) return c(k);
    if (k.op === "(") {
      const b = A();
      return o[s]?.op !== ")" ? null : (s++, b);
    }
    if (k.op === "-" || k.op === "+") {
      const b = _();
      return k.op === "-" ? p(b, -1) : b;
    }
    if (k.fn) {
      const b = [];
      for (; ; ) {
        b.push(A());
        const z = o[s++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (b.some((z) => !z)) return null;
      if (k.fn === "calc") return b[0];
      if (!(b.every((z) => !z.pct) || b.every((z) => !z.px && !z.num))) return null;
      const w = (z) => z.px + z.pct + z.num;
      return k.fn === "min" ? b.reduce((z, q) => w(q) < w(z) ? q : z) : k.fn === "max" ? b.reduce((z, q) => w(q) > w(z) ? q : z) : k.fn === "clamp" && b.length === 3 ? w(b[1]) < w(b[0]) ? b[0] : w(b[1]) > w(b[2]) ? b[2] : b[1] : null;
    }
    return null;
  }
  function x() {
    let k = _();
    for (; o[s] && (o[s].op === "*" || o[s].op === "/"); ) {
      const b = o[s++].op, S = _();
      if (!k || !S) return null;
      b === "*" ? k = f(S) ? p(k, S.num) : f(k) ? p(S, k.num) : null : k = f(S) && S.num !== 0 ? p(k, 1 / S.num) : null;
    }
    return k;
  }
  function A() {
    let k = x();
    for (; o[s] && (o[s].op === "+" || o[s].op === "-"); ) {
      const b = o[s++].op;
      k = d(k, x(), b === "-" ? -1 : 1);
    }
    return k;
  }
  const H = A();
  return s !== o.length || !H ? null : H;
}
function Ho(n, i) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const s = On(o, i);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: n.trim() } : s.pct && (s.px || s.num) ? { expr: n.trim() } : s.pct ? { pct: s.pct } : { px: jh(s.px) } : { expr: n.trim() };
}
const jh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, gi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Mh = ([n, i, o, s]) => `#${gi(n)}${gi(i)}${gi(o)}${gi(s * 255)}`;
function cd(n) {
  const i = n.slice(1), o = i.length <= 4 ? i.split("").map((c) => c + c).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const s = (c) => parseInt(o.slice(c, c + 2), 16);
  return [s(0), s(2), s(4), o.length === 8 ? s(6) / 255 : 1];
}
function zi(n, i) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (s) {
    const x = i(s[1]), A = x && cd(x);
    return A ? { rgba: A, token: s[1] } : null;
  }
  if (o.startsWith("#")) {
    const x = cd(o);
    return x ? { rgba: x, token: null } : null;
  }
  if (sd[o]) return { rgba: [...sd[o]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const x = ie(c[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const A = (Mt) => {
      const Kt = ie(Mt), Tt = Kt.findIndex((lt) => /%$/.test(lt)), K = Tt >= 0 ? parseFloat(Kt[Tt]) / 100 : null;
      return { color: zi(Kt.filter((lt, B) => B !== Tt).join(" "), i), pct: K };
    }, H = A(x[1]), k = A(x[2]);
    if (!H.color || !k.color || H.color === "currentcolor" || k.color === "currentcolor") return null;
    let b = H.pct, S = k.pct;
    b === null && S === null ? (b = 0.5, S = 0.5) : b === null ? b = 1 - S : S === null && (S = 1 - b);
    const w = b + S, z = w < 1 ? w : 1;
    b /= w, S /= w;
    const [q, E, N, j] = H.color.rgba, [D, T, g, h] = k.color.rgba, U = j * b + h * S, J = (Mt, Kt) => U === 0 ? 0 : (Mt * j * b + Kt * h * S) / U, at = [J(q, D), J(E, T), J(N, g), U * z], et = h === 0 ? H.color.token : j === 0 ? k.color.token : null;
    return { rgba: at, token: et };
  }
  const d = c[2].includes(",") ? ie(c[2], ",") : ie(c[2].replace("/", " / ")).filter((x) => x !== "/");
  if (d.length < 3) return null;
  const p = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), _ = [p(d[0]), p(d[1]), p(d[2]), f];
  return _.some((x) => Number.isNaN(x)) ? null : { rgba: _, token: null };
}
const ml = ["top", "right", "bottom", "left"], Ah = ["top-left", "top-right", "bottom-right", "bottom-left"], bi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], ud = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Do(n, i) {
  const o = i.trim(), s = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const c = bi(s());
      return ml.map((d, p) => [`${n}-${d}`, c[p]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const c = s(), d = n.split("-")[0];
      return [[`${d}-left`, c[0]], [`${d}-right`, c[1] ?? c[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const c = s(), d = n.split("-")[0];
      return [[`${d}-top`, c[0]], [`${d}-bottom`, c[1] ?? c[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${n.split("-")[0]}-left`, o]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, o]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, o]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, o]];
    case "inset": {
      const c = bi(s());
      return ml.map((d, p) => [d, c[p]]);
    }
    case "inset-inline": {
      const c = s();
      return [["left", c[0]], ["right", c[1] ?? c[0]]];
    }
    case "inset-block": {
      const c = s();
      return [["top", c[0]], ["bottom", c[1] ?? c[0]]];
    }
    case "inset-inline-start":
      return [["left", o]];
    case "inset-inline-end":
      return [["right", o]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const c = n.split("-")[1], d = bi(s());
      return ml.map((p, f) => [`border-${p}-${c}`, d[f]]);
    }
    case "border":
    case "border-top":
    case "border-right":
    case "border-bottom":
    case "border-left":
    case "border-inline":
    case "border-block":
    case "border-inline-start":
    case "border-inline-end": {
      const c = n === "border" ? ml : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", p = "none", f = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const _ of s())
          ud.has(_) ? p = _ : /^(thin|medium|thick|-?[\d.]|calc\()/.test(_) ? d = _ : f = _;
      else o === "0" && (d = "0");
      return c.flatMap((_) => [[`border-${_}-width`, d], [`border-${_}-style`, p], [`border-${_}-color`, f]]);
    }
    case "border-inline-width": {
      const c = s();
      return [["border-left-width", c[0]], ["border-right-width", c[1] ?? c[0]]];
    }
    case "border-block-width": {
      const c = s();
      return [["border-top-width", c[0]], ["border-bottom-width", c[1] ?? c[0]]];
    }
    case "border-inline-style": {
      const c = s();
      return [["border-left-style", c[0]], ["border-right-style", c[1] ?? c[0]]];
    }
    case "border-inline-color": {
      const c = s();
      return [["border-left-color", c[0]], ["border-right-color", c[1] ?? c[0]]];
    }
    case "border-radius": {
      const c = bi(ie(o.split("/")[0]));
      return Ah.map((d, p) => [`border-${d}-radius`, c[p]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", o]];
    case "border-start-end-radius":
      return [["border-top-right-radius", o]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", o]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", o]];
    case "background":
      return o === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : zi(o, () => "#000000") ? [["background-color", o], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", o]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(o) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((c) => [c, o]) : [[n, o]];
    case "overflow": {
      const c = s();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = s();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return Do("gap", o);
    case "place-items": {
      const c = s();
      return [["align-items", c[0]], ["justify-items", c[1] ?? c[0]]];
    }
    case "place-self": {
      const c = s();
      return [["align-self", c[0]], ["justify-self", c[1] ?? c[0]]];
    }
    case "place-content": {
      const c = s();
      return [["align-content", c[0]], ["justify-content", c[1] ?? c[0]]];
    }
    case "flex": {
      if (o === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (o === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (o === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const c = s(), d = c.filter((f) => /^[\d.]+$/.test(f)), p = c.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", p ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const c = [];
      for (const d of s()) c.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return c;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let c = "medium", d = "none", p = "currentcolor";
      for (const f of s())
        ud.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? c = f : p = f;
      return [["outline-width", c], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = ie(o, ","), d = c.map((f) => ie(f).find((_) => !/^[\d.]+m?s$/.test(_) && !/^(ease|linear|step|cubic)/.test(_)) ?? "all"), p = c.map((f) => ie(f).find((_) => /^[\d.]+m?s$/.test(_)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", p.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", s()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", o]];
    case "word-wrap":
      return [["overflow-wrap", o]];
    default:
      return [[n, o]];
  }
}
function Oh(n, i) {
  return n ? ie(n, ",").some((o) => {
    let s = o.trim().toLowerCase(), c = !1;
    s.startsWith("not ") && (c = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const d = s.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const f = /^\((.+)\)$/.exec(p);
      if (!f) return !1;
      const _ = f[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(_);
      if (x) {
        const [, H, k] = x, b = (S) => {
          const w = Ho(S, { viewport: i });
          return typeof w == "object" && "px" in w ? w.px : NaN;
        };
        switch (H) {
          case "min-width":
            return i.width >= b(k);
          case "max-width":
            return i.width <= b(k);
          case "min-height":
            return i.height >= b(k);
          case "max-height":
            return i.height <= b(k);
          case "hover":
          case "any-hover":
            return k.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return k.trim() === "fine";
          case "prefers-reduced-motion":
            return k.trim() === "no-preference";
          case "prefers-color-scheme":
            return k.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const A = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(_);
      if (A) {
        const H = A[1] === "width" ? i.width : i.height, k = Ho(A[3], { viewport: i }), b = typeof k == "object" && "px" in k ? k.px : NaN;
        switch (A[2]) {
          case ">=":
            return H >= b;
          case "<=":
            return H <= b;
          case ">":
            return H > b;
          case "<":
            return H < b;
          default:
            return H === b;
        }
      }
      return !1;
    });
    return c ? !d : d;
  }) : !0;
}
function Rh(n, i) {
  const o = i[i.length - 1].compound;
  return Lo(o)[0] ?? n;
}
function Hh(n) {
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), s = (c, d) => {
    c.forEach(({ compound: p }, f) => {
      const _ = d && f === c.length - 1;
      for (const x of p.pseudos)
        if (Vd.has(x.name) && (_ ? i : o).add(x.name), x.list && x.name !== "not") for (const A of x.list) s(A, _);
    });
  };
  return s(n, !0), { subject: i, ancestor: o };
}
function Lo(n) {
  const i = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const s of o.list) s.length === 1 && i.push(...Lo(s[0].compound));
  return i;
}
function Dh(n, i) {
  const o = (s, c) => {
    s.forEach(({ compound: d }, p) => {
      const f = c && p === s.length - 1, _ = d.pseudos.filter((x) => Vd.has(x.name)).map((x) => x.name);
      if (!f) for (const x of _) for (const A of Lo(d)) i.add(`${x}:${A}`);
      for (const x of d.pseudos) if (x.list && x.name !== "not") for (const A of x.list) o(A, f);
    });
  };
  o(n, !0);
}
class Uh {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const f = p[p.length - 1].compound, _ = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(_) || this.index.set(_, []), this.index.get(_).push(d);
    };
    let s = 0;
    const c = (d, p) => {
      for (const [f, _, x, A] of d)
        for (const H of Ko(f)) {
          let k;
          try {
            k = Vo(H);
          } catch (w) {
            if (w instanceof Se) {
              this.skipped++;
              continue;
            }
            throw w;
          }
          const b = Hh(k);
          Dh(k, this.trackedStates);
          const S = { steps: k, media: _, layer: x, origin: p, order: s++, specificity: Ud(k), decls: A, states: b, source: p === 0 ? `ua:${k[k.length - 1].compound.tag ?? "*"}` : Rh(H, k) };
          this.rules.push(S), o(S, k);
        }
    };
    c(Eh.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), c(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const o = [], s = /* @__PURE__ */ new Set(), c = (d) => {
      if (d) for (const p of d) s.has(p) || (s.add(p), o.push(p));
    };
    for (const d of i.classList) c(this.index.get(`.${d}`));
    return c(this.index.get(i.tagName)), c(this.index.get("*")), o;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, o) {
    for (const s of i.classList) if (this.trackedStates.has(`${o}:${s}`)) return !0;
    return !1;
  }
}
const Bh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function qh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [o, s] of Object.entries(n)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const c = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof s == "number" && s !== 0 && !Bh.has(c) && !c.startsWith("--") ? `${s}px` : String(s);
    i.push([c, d]);
  }
  return i;
}
function Yh(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const o of ["width", "height"]) {
    const s = n.getAttribute(o);
    s !== null && i.push([o, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return i;
}
const Gh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class Qh {
  constructor(i, { theme: o, viewport: s }) {
    this.sheet = i, this.theme = o, this.viewport = s, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, o) {
    const s = (c, d, p) => {
      if (d === "disabled") return !!c.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(c.tagName);
      if (d === "enabled") return !c.props?.disabled && ["button", "input", "select", "textarea"].includes(c.tagName);
      if (d === "checked") return !!c.props?.checked;
      if (o === "*") return !0;
      if (d === "focus-within") {
        const f = c.ownerDocument?.activeElement;
        return !!f && f !== c.ownerDocument.body && typeof c.contains == "function" && c.contains(f);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!c.state?.focus : !!c.state?.[d];
    };
    return this.sheet.candidates(i).filter((c) => (!c.media || c.media.every((d) => Oh(d, this.viewport))) && Bd(i, c.steps, { state: s }));
  }
  compute(i, o, s = /* @__PURE__ */ new Set()) {
    const c = this.matching(i, s), d = [];
    for (const g of c)
      for (const [h, U, J] of g.decls) d.push({ prop: h, value: U, important: J ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of Yh(i)) d.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of qh(i.props?.style)) d.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(Gh);
    const p = this.sheet.properties, f = Object.create(o?.customs ?? null), _ = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const g of d) g.prop.startsWith("--") && x.set(g.prop, g.value);
    if (!o && this.theme) for (const g of Kd) this.theme[g] && x.set(`--${g}`, `perchtoken(${g})`);
    const A = (g) => {
      if (_.has(g)) return _.get(g);
      const h = p[g];
      return h && !h.inherits ? h.initial ?? null : g in f ? f[g] : h?.initial ?? null;
    }, H = /* @__PURE__ */ new Set(), k = (g) => {
      if (!x.has(g)) return A(g);
      if (H.has(g)) return null;
      H.add(g);
      const h = Ro(x.get(g), k);
      return H.delete(g), x.delete(g), _.set(g, h), (!p[g] || p[g].inherits) && (f[g] = h), h;
    };
    for (const g of [...x.keys()]) k(g);
    const b = /* @__PURE__ */ new Map();
    for (const g of d) {
      if (g.prop.startsWith("--")) continue;
      const h = Ro(g.value, A);
      if (h === null) {
        for (const [U] of Do(g.prop, "unset")) b.set(U, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [U, J] of Do(g.prop, h)) b.set(U, { value: J, source: g.source, origin: g.origin });
    }
    const S = {}, w = {}, z = /* @__PURE__ */ new Set(), q = /* @__PURE__ */ new Set(), E = o?.values, N = { fontSize: E?.["font-size"] ?? Ao, viewport: this.viewport }, j = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, N, S, E);
      const U = `${g}\0${h}\0${N.fontSize}`;
      let J = this.parsed.get(U);
      return J === void 0 && this.parsed.set(U, J = this.parseValue(g, h, N, S, E)), J;
    }, D = b.size ? [...Oo, ...[...b.keys()].filter((g) => !Th.has(g))] : Oo;
    for (const g of D) {
      const h = b.get(g);
      let U = h?.value;
      const J = Nh.has(g);
      if ((U === void 0 || U === "unset" || U === "revert" || U === "revert-layer") && (U = J ? "inherit" : "initial"), h && (w[g] = h.source, h.origin !== 0 && z.add(g)), U === "inherit" && E && g in E) {
        S[g] = E[g], q.add(g);
        continue;
      }
      (U === "inherit" || U === "initial") && (U = J ? Zd[g] : Xd[g]), S[g] = j(g, U), g === "font-size" && (N.fontSize = S["font-size"]);
    }
    for (const g of ml) {
      const h = S[`border-${g}-style`];
      (h === "none" || h === "hidden") && (S[`border-${g}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const T = E?.display;
    return (T === "flex" || T === "inline-flex" || T === "grid" || T === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = dd(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = dd(S.display)), { values: S, sources: w, own: z, inherited: q, customs: f, rules: c, element: i };
  }
  parseValue(i, o, s, c, d) {
    const p = String(o).trim();
    switch (i) {
      case "font-size": {
        const f = p.toLowerCase(), _ = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (_[f]) return _[f];
        if (f === "smaller") return s.fontSize / 1.2;
        if (f === "larger") return s.fontSize * 1.2;
        const x = On(f, { fontSize: s.fontSize, viewport: s.viewport });
        return !x || x.num ? s.fontSize : x.px + x.pct / 100 * s.fontSize;
      }
      case "font-weight": {
        const f = p.toLowerCase();
        if (f === "normal") return 400;
        if (f === "bold") return 700;
        if (f === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (f === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const _ = parseFloat(f);
        return Number.isFinite(_) ? _ : 400;
      }
      case "line-height": {
        const f = p.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const _ = On(f, { fontSize: s.fontSize, viewport: s.viewport });
        return _ ? _.unitless ? { factor: _.num } : { px: _.px + _.pct / 100 * s.fontSize } : { normal: !0 };
      }
      case "font-family":
        return p;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const f = p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p);
        return Number.isFinite(f) ? f : parseFloat(i === "flex-shrink" || i === "opacity" ? 1 : 0);
      }
      case "color": {
        const f = zi(p, (_) => this.themeHex(_));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = zi(p, (_) => this.themeHex(_));
        return f === "currentcolor" ? c.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
      }
      case "width":
      case "height":
      case "min-width":
      case "min-height":
      case "max-width":
      case "max-height":
      case "flex-basis":
      case "row-gap":
      case "column-gap":
      case "top":
      case "right":
      case "bottom":
      case "left":
      case "margin-top":
      case "margin-right":
      case "margin-bottom":
      case "margin-left":
      case "padding-top":
      case "padding-right":
      case "padding-bottom":
      case "padding-left":
      case "border-top-width":
      case "border-right-width":
      case "border-bottom-width":
      case "border-left-width":
      case "border-top-left-radius":
      case "border-top-right-radius":
      case "border-bottom-right-radius":
      case "border-bottom-left-radius":
      case "outline-width":
      case "outline-offset":
      case "letter-spacing":
      case "word-spacing":
      case "text-indent":
        return Ho(p, s);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function dd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Ei = (n) => n && n.rgba ? { value: Mh(n.rgba), token: n.token ?? null } : null, Kh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Vh(n, i) {
  const o = i?.(n);
  if (Number.isFinite(o)) return o;
  const s = Math.round(n * 100) / 100;
  return Kh[s] ?? Math.round(n * 1.2);
}
function Ni(n, i) {
  const o = n["line-height"], s = n["font-size"];
  return o.normal ? Vh(s, i) : o.factor !== void 0 ? o.factor * s : o.px;
}
const Xh = (n) => ie(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Zh = "perch-native-description/1", Mn = Symbol("display"), Ti = {
  display: "block",
  flex_direction: "row",
  flex_wrap: "nowrap",
  items: "stretch",
  justify: "start",
  self: "auto",
  flex_grow: 0,
  flex_shrink: 1,
  flex_basis: "auto",
  position: "relative",
  overflow_x: "visible",
  overflow_y: "visible",
  visibility: "visible",
  bg: "#00000000",
  opacity: 1,
  shadow: "none",
  cursor: "default",
  border_color: "#00000000",
  text_ellipsis: !1,
  underline: !1
}, Jh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Jh) Ti[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Ti.rounded = 0;
const Lh = /* @__PURE__ */ new Set([
  "box-sizing",
  "-webkit-tap-highlight-color",
  "color-scheme",
  "accent-color",
  "user-select",
  "-webkit-touch-callout",
  "pointer-events",
  "overscroll-behavior",
  "text-indent",
  "word-spacing",
  "word-break",
  "font-style",
  "transition-timing-function",
  "transition-behavior",
  "transition-delay",
  "scrollbar-width",
  "scrollbar-color",
  "--tw-content",
  "container-type",
  "justify-items",
  "justify-self",
  "align-content",
  "outline-offset",
  "background-image"
]), Wh = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Fh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Ih = (n) => Fh.test(n) ? "Menlo" : Wh.test(n) ? ".SystemUIFont" : Xh(n).split(",")[0].trim(), $h = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, md = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Jd = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const s = n.parentElement;
  return s && s.tagName !== "body" ? `${Jd(s)} > ${n.tagName}` : n.tagName;
};
class Ph {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, o, s, c, d, p = "") {
    const f = `${i}|${o}|${s}|${c}`, _ = this.map.get(f);
    if (_) {
      !_.elements.includes(d) && _.elements.length < 4 && _.elements.push(d), _.count++;
      return;
    }
    this.map.set(f, { kind: i, property: o, value: String(s), class: c ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, o) => i.kind < o.kind ? -1 : i.kind > o.kind ? 1 : i.property < o.property ? -1 : i.property > o.property ? 1 : 0);
  }
}
const ca = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, t0 = /^(text|search|url|email|tel|password|number)$/, e0 = 162.13 / 12.8;
function a0(n, i) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = On(n.expr, { fontSize: i["font-size"] }), s = (i["margin-left"]?.px ?? NaN) + (i["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + s) < 0.01;
}
function n0(n) {
  const i = n.transform;
  if (i && i !== "none") {
    const s = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), c = s && ie(s[2], ",").map((d) => d.trim());
    return !c || c.length > (s[1] ? 1 : 2) ? null : s[1] === "X" ? [c[0], "0"] : s[1] === "Y" ? ["0", c[0]] : [c[0], c[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const s = ie(String(o).trim(), " ").filter(Boolean);
    return s.length > 3 || s[2] !== void 0 && On(s[2], {})?.px ? null : [s[0], s[1] ?? "0"];
  }
  return [];
}
function l0(n, i, o) {
  const s = n.values, c = n0(s);
  if (c?.length === 0) return;
  const d = s.transform && s.transform !== "none" ? "transform" : "translate", p = { fontSize: s["font-size"] }, f = (A, H) => {
    const k = On(A, p);
    if (!(!k || k.unitless && k.num))
      return k.pct ? typeof H == "number" ? k.px + k.pct / 100 * H : void 0 : k.px;
  }, _ = c ? f(c[0], i.w) : void 0, x = c ? f(c[1], i.h) : void 0;
  if (_ === void 0 || x === void 0) {
    o("unsupported", d, s[d], n.sources[d]);
    return;
  }
  _ && (i.ml = (i.ml ?? 0) + _), x && (i.mt = (i.mt ?? 0) + x);
}
function fd(n, i, o = null) {
  const s = n.values, c = {}, d = (E) => n.sources[E], p = (E) => n.sources[E] !== void 0, f = s.display;
  f === "none" ? c.display = "hidden" : f === "flex" || f === "inline-flex" ? c.display = "flex" : (f === "grid" || f === "inline-grid") && (c.display = "flex", c.flex_direction = "col", i("approximated", "display", f, d("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", s["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (c.display = "hidden");
  const _ = c.display === "flex";
  if (_ && c.flex_direction !== "col") {
    const E = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    c.flex_direction = E;
  }
  if (_) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (c.flex_wrap = "wrap");
    const E = f === "grid" || f === "inline-grid", N = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    N && (c.items = N);
    let j = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (E) {
      const g = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      g && (c.items = g), s["align-items"] === "center" && (j = "center");
    }
    j && (c.justify = j);
    const D = ca(s["row-gap"]), T = ca(s["column-gap"]);
    typeof D == "number" && D && (c.gap_y = D), typeof T == "number" && T && !E && (c.gap_x = T);
  }
  s["flex-grow"] && (c.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (c.flex_shrink = s["flex-shrink"]);
  const x = ca(s["flex-basis"]);
  x !== void 0 && x !== "auto" && (c.flex_basis = x);
  const A = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  A && (c.self = A);
  for (const [E, N] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const j = s[N], D = ca(j);
    if (D === void 0 && N === "width" && a0(j, s)) {
      c.self = "stretch", i("approximated", N, j.expr, d(N), "stretched across its parent, inside its margins");
      continue;
    }
    if (D === void 0) {
      typeof j == "object" && j.expr ? i("unsupported", N, j.expr, d(N), "no calc() in the engine") : typeof j == "string" && !["auto", "none"].includes(j) && i("unsupported", N, j, d(N));
      continue;
    }
    D !== "auto" && (c[E] = D);
  }
  const H = ["top", "right", "bottom", "left"];
  for (const E of H) {
    const N = E[0];
    for (const [j, D] of [["p", "padding"], ["m", "margin"]]) {
      const T = s[`${D}-${E}`], g = ca(T);
      if (g === void 0) {
        T?.expr && i("unsupported", `${D}-${E}`, T.expr, d(`${D}-${E}`), "no calc() in the engine");
        continue;
      }
      g !== 0 && (c[`${j}${N}`] = g);
    }
  }
  const k = s.position;
  if (k === "absolute" || k === "fixed") {
    c.position = "absolute", k === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const E of H) {
      const N = ca(s[E]);
      N !== void 0 && N !== "auto" && (c[E] = N);
    }
    if (k === "fixed" && o && c.w === void 0 && c.right === void 0 && typeof c.left == "number") {
      const E = o.width - c.left - (typeof c.ml == "number" ? c.ml : 0) - (typeof c.mr == "number" ? c.mr : 0);
      c.max_w = typeof c.max_w == "number" ? Math.min(c.max_w, E) : E;
    }
    l0(n, c, i);
  } else k === "sticky" && i("unsupported", "position", "sticky", d("position"));
  s["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", s["z-index"], d("z-index"), "paint order is tree order");
  for (const [E, N] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const j = s[N];
    j === "hidden" || j === "clip" ? c[E] = "hidden" : (j === "auto" || j === "scroll") && (c[E] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (c.visibility = "invisible");
  const b = s["background-color"];
  b?.unreadable ? i("unsupported", "background-color", b.unreadable, d("background-color")) : b?.rgba && b.rgba[3] > 0 && (c.bg = Ei(b)), s["background-image"] && s["background-image"] !== "none" && i("unsupported", "background-image", s["background-image"], d("background-image"));
  const S = H.map((E) => ca(s[`border-${E}-width`]) || 0), w = [];
  H.forEach((E, N) => {
    if (!S[N]) return;
    c[`border_${E[0]}`] = S[N];
    const j = s[`border-${E}-style`];
    j !== "solid" && i("approximated", `border-${E}-style`, j, d(`border-${E}-style`), "drawn solid");
    const D = Ei(s[`border-${E}-color`]);
    D && w.push(D);
  }), w.length && (c.border_color = w[0], w.some((E) => E.value !== w[0].value) && i("approximated", "border-color", w.map((E) => E.value).join(" "), d("border-top-color"), "one border colour"));
  const z = ["top-left", "top-right", "bottom-right", "bottom-left"].map((E) => ca(s[`border-${E}-radius`]) || 0);
  z.every((E) => E === z[0]) ? z[0] && (c.rounded = z[0]) : ["tl", "tr", "br", "bl"].forEach((E, N) => {
    z[N] && (c[`rounded_${E}`] = z[N]);
  }), s.opacity !== 1 && (c.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const q = s["box-shadow"];
  if (q && q !== "none" && ie(q, ",").some((E) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(E.trim())) && (c.shadow = "lg", i("approximated", "box-shadow", q, d("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !n.inherited.has("cursor")) {
    const E = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    E ? c.cursor = E : i("unsupported", "cursor", s.cursor, d("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (c.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? c.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", s["text-decoration-line"], d("text-decoration-line")), c;
}
const i0 = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Ld(n) {
  if (!n || n === "normal") return "";
  const i = String(n).trim().split(/\s+/).map((o) => i0[o]);
  return i.every(Boolean) ? i.join(",") : null;
}
function pd(n, i) {
  const o = n.values, s = o["line-height"];
  return {
    text_color: Ei(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Ld(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(Ni(o, i) * 1e3) / 1e3 },
    font_family: Ih(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const hd = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, Wd = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function gd(n, i, o) {
  const s = {}, c = (f, _) => _.some((x) => !n.inherited.has(x));
  for (const [f, _] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (c(f, _) || !Wd(i[f], o[f])) && (s[f] = i[f]);
  const d = hd(i.line_height, i.text_size), p = o.line_height ? hd(o.line_height, i.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (s.line_height = i.line_height), s;
}
const r0 = (n, i) => ({ ...n, ...i });
function bd(n, i) {
  const o = {};
  for (const [s, c] of Object.entries(n))
    c && typeof c == "object" && "value" in c ? (o[s] = c.value, c.token && (i[s] = c.token)) : s === "line_height" ? o[s] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : s === "italic" ? c && (o.italic = !0) : o[s] = c;
  return o.italic === !1 && delete o.italic, o;
}
function o0(n, i) {
  const o = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const c = n[s], d = i[s];
    Wd(c, d) || (o[s] = d === void 0 ? s in Ti ? Ti[s] : null : d);
  }
  return o;
}
function vd(n, i) {
  const o = n.values;
  for (const [s, c] of Object.entries(n.sources)) {
    if (s.startsWith("--") || Lh.has(s) || c.startsWith("ua:")) continue;
    const d = o[s];
    switch (s) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", s, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, c, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Ld(d) === null && i("unsupported", s, d, c);
        break;
      case "text-transform":
        d !== "none" && i("approximated", s, d, c, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        s === "transition-property" && p && ie(p, ",").some((f) => parseFloat(f) > 0) && o["transition-property"] !== "none" && i("unsupported", "transition", `${o["transition-property"]} ${p}`, c, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && i("unsupported", s, d, c, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        s === "overflow-wrap" && d !== "normal" && i("approximated", s, d, c, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && s === "outline-style" && i("unsupported", "outline", `${ca(o["outline-width"])}px ${o["outline-style"]} ${Ei(o["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
        break;
      case "transform":
      case "translate":
        o.position !== "absolute" && o.position !== "fixed" && d && d !== "none" && i("unsupported", s, d, c);
        break;
      case "rotate":
      case "scale":
      case "animation":
      case "animation-name":
      case "filter":
      case "backdrop-filter":
      case "mask":
      case "-webkit-mask":
      case "clip-path":
      case "content":
      case "list-style":
      case "resize":
      case "appearance":
      case "-webkit-appearance":
      case "vertical-align":
      case "float":
      case "clear":
      case "order":
      case "aspect-ratio":
      case "object-fit":
      case "isolation":
      case "mix-blend-mode":
      case "will-change":
      case "contain":
      case "touch-action":
      case "caret-color":
      case "scroll-behavior":
      case "scrollbar-gutter":
      case "text-wrap":
      case "fill":
      case "stroke":
      case "stroke-width":
      case "grid-template-rows":
      case "grid-auto-flow":
      case "grid-column":
      case "grid-row":
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && i("unsupported", s, d, c);
        break;
    }
  }
}
function s0(n, i, o, s) {
  const c = Jd(n), d = [], p = (z, q, E, N, j) => d.push([z, q, E, N ?? "(user agent)", c, j]), f = s.cascade.compute(n, i), _ = {}, x = fd(f, p, s.viewport);
  vd(f, p);
  const A = pd(f, s.measure), H = gd(f, A, o), k = bd({ ...x, ...H }, _), b = {}, S = s.cascade.matching(n, "*").filter((z) => z.states.subject.size);
  for (const [z, q] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!S.some((T) => q.some((g) => T.states.subject.has(g)))) continue;
    const E = s.cascade.compute(n, i, new Set(q)), N = {}, j = bd({ ...fd(E, () => {
    }), ...gd(E, pd(E, s.measure), o) }, N);
    z === "focus" && vd(E, p);
    const D = o0(k, j);
    if (Object.keys(D).length) {
      b[z] = D;
      const T = Object.fromEntries(Object.entries(N).filter(([g]) => g in D));
      Object.keys(T).length && (b[`${z}_tokens`] = T);
    }
  }
  if (s.cascade.sheet.tracks(n, "hover") && (b.track_hover = !0), /tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (b.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (b.break_anywhere = !0), x.overflow_y === "scroll") {
    const z = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    z > 0 && (b.scrollbar = z);
  }
  f.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (b.blocks_pointer = !0);
  const w = Object.entries($h).filter(([, z]) => z.some((q) => typeof n.props[q] == "function")).map(([z]) => z);
  return !w.includes("click") && Mo(n) && w.push("click"), w.length && (b.events = w), { computed: f, style: k, tokens: _, extra: b, meta: m0(n), reports: d, childText: r0(o, H), where: c };
}
function Fd(n, i, o, s, c = "") {
  const d = `${c}/${n.id}.${n.version}`;
  let p = s.cache.get(n);
  (!p || p.key !== d) && s.cache.set(n, p = { key: d, part: s0(n, i, o, s) });
  const { computed: f, tokens: _, extra: x, reports: A, childText: H, where: k } = p.part;
  for (const h of A) s.findings.add(...h);
  const b = (h, U, J, at, et) => s.findings.add(h, U, J, at, k, et), S = { ...p.part.style }, w = { kind: "div", id: n.id, style: S, tokens: _, meta: p.part.meta, ...x };
  Object.defineProperty(w, Mn, { value: f.values.display });
  const z = n.tagName;
  if (z === "svg")
    return w.kind = n.props["data-perch-image"] ? "image" : "svg", w.markup = p0(n), w;
  if (z === "input" || z === "textarea" || z === "select") {
    w.kind = "input", w.input_type = z === "input" ? String(n.props.type ?? "text") : z;
    for (const h of ["placeholder", "checked", "disabled"]) n.props[h] !== void 0 && (w[h] = n.props[h]);
    if (/^(checkbox|radio)$/.test(w.input_type) && (w.checked = n.checked), z !== "select" && (w.value = n.value), z === "input" && t0.test(w.input_type) && (w.field_w = e0 * f.values["font-size"]), z === "textarea" && S.h === void 0) {
      const h = f.values, U = (et) => et && typeof et == "object" && "px" in et ? et.px : 0, J = (et) => h[`border-${et}-style`] === "none" ? 0 : U(h[`border-${et}-width`]), at = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      S.h = at * Ni(h, s.measure) + U(h["padding-top"]) + U(h["padding-bottom"]) + J("top") + J("bottom");
    }
    return w;
  }
  if (z === "img") {
    w.kind = "image", w.src = n.props.src ?? null;
    for (const [h, U] of [["width", "w"], ["height", "h"]]) {
      const J = Number(n.props[h]);
      S[U] === void 0 && n.props[h] != null && Number.isFinite(J) && (S[U] = J);
    }
    return w;
  }
  const q = f.values["text-transform"], E = [];
  let N = !1, j = !1;
  for (const h of n.childNodes) {
    if (h instanceof Zo) {
      if (h.hidden || h.data === "") continue;
      N = !0;
      const at = E[E.length - 1];
      if (at?.kind === "text")
        at.source = (at.source ?? at.text) + h.data, at.text = yd(at.source, q), at.text === at.source && delete at.source;
      else {
        const et = yd(h.data, q);
        E.push(et === h.data ? { kind: "text", text: et } : { kind: "text", text: et, source: h.data });
      }
      continue;
    }
    if (!(h instanceof ke)) continue;
    const U = Fd(h, f, H, s, d), J = U[Mn];
    J === "inline" || J === "inline-block" || J === "inline-flex" ? N = !0 : J !== "none" && (j = !0), E.push(U);
  }
  const D = E.some((h) => h.kind !== "text"), T = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][Mn]) ? E[0] : null;
  if (!S.display && T) {
    const h = s.cache.get(n.childNodes.find((J) => J.id === T.id))?.part.computed, U = h ? Uo(f.values, s.measure) - d0(h.values, s.measure) : 0;
    S.display = "flex", S.flex_direction = "col", S.items = "start", U > 0 && (T.style.mt = Math.round(((T.style.mt ?? 0) + U) * 100) / 100), b("approximated", "display", `${f.values.display} holding one ${T[Mn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!S.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][Mn] === "inline" && typeof E[0].style.h == "number") {
    const h = E[0], U = Uo(f.values, s.measure), J = Ni(f.values, s.measure) - U, at = (et) => Math.round(et * 100) / 100;
    S.display = "flex", S.flex_direction = "col", S.items = "start", U > h.style.h && (h.style.mt = at((h.style.mt ?? 0) + U - h.style.h)), J > 0 && (h.style.mb = at((h.style.mb ?? 0) + J)), b("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!S.display && N && D) {
    if (S.display = "flex", S.flex_direction = j ? "col" : "row", !j) S.items = "baseline";
    else for (const h of E) h.kind !== "text" && /^inline-(block|flex)$/.test(h[Mn]) && !h.style.self && (h.style.self = "start");
    b("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", j ? "a column of its children" : "a row on the text baseline");
  }
  const g = f.values["letter-spacing"]?.px;
  if (g)
    for (let h = 0; h < E.length; h++) {
      const U = E[h];
      if (U.kind !== "text") continue;
      const J = Math.round(g * [...U.text].length * 1e3) / 1e3;
      E[h] = { kind: "div", style: { pr: J }, tokens: {}, children: [U] };
    }
  return w.children = E, w;
}
function c0(n, i) {
  if (!i) return null;
  let s = (i.self ? n : i.closest ? qd(n, i.closest) : i.find ? fl(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return s && i.strip && s.startsWith(i.strip) && (s = s.slice(i.strip.length)), s;
}
function u0(n, i, o) {
  const s = i.map((p) => [p, Oi(p.selector)]), c = /* @__PURE__ */ new Map(), d = (p) => {
    for (const f of p.children) {
      const _ = o.get(f.id);
      if (_)
        for (const [x, A] of s) {
          const H = x.textRange ? "range_name" : "name";
          if (x.textRange && _[H] != null || !A.some((w) => Bd(f, w))) continue;
          const k = c0(f, x.key), b = k == null ? c.get(x.name) ?? 0 : 0;
          k == null && c.set(x.name, b + 1);
          const S = k != null ? `${x.name}:${k}` : b ? `${x.name}@${b}` : x.name;
          _[H] == null ? _[H] = S : (_.also ??= []).push(S);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Ci = 0.9521, Id = 0.2256, Uo = (n, i) => (Ni(n, i) - (Ci + Id) * n["font-size"]) / 2 + Ci * n["font-size"];
function d0(n, i) {
  const o = (c) => c && typeof c == "object" && "px" in c ? c.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]);
  return o(n["padding-top"]) + s + Uo(n, i);
}
const yd = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, $d = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function m0(n) {
  const i = {};
  for (const [o, s] of Object.entries(n.props)) {
    if ($d.has(o) || typeof s == "function" || s === void 0 || s === null || typeof s == "object") continue;
    const c = o.startsWith("aria-") || o.startsWith("data-");
    if (s === !1 && !c) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    i[d] = typeof s == "boolean" ? c ? String(s) : "" : String(s);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const f0 = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), xd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function p0(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (o) => {
    const s = [];
    for (const [d, p] of Object.entries(o.props))
      $d.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || s.push(`${f0(d)}="${xd(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = o.childNodes.map((d) => d instanceof Zo ? xd(d.data) : i(d)).join("");
    return `<${o.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${c}</${o.tagName}>`;
  };
  return i(n);
}
function h0(n) {
  const i = n.theme?.() ?? {}, o = {};
  for (const s of Kd) i[s] && (o[s] = i[s]);
  return o;
}
const g0 = { font_features: "" };
function b0(n, i, o, s = {}, c = null) {
  const d = h0(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, p]);
  (s.look !== f || s.sheet !== o) && Object.assign(s, { look: f, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new Qh(o, { theme: d, viewport: p }), top: null });
  const { cascade: _, cache: x } = s, A = { cascade: _, cache: x, viewport: p, findings: new Ph(), measure: i.lineHeight ? (b) => i.lineHeight(b) : null };
  s.top ??= _.compute(n.body, _.compute(n.documentElement, null));
  const H = n.body.children.map((b) => Fd(b, s.top, g0, A));
  if (c?.length) {
    const b = /* @__PURE__ */ new Map(), S = (w) => {
      w.id && b.set(w.id, w);
      for (const z of w.children ?? []) S(z);
    };
    H.forEach(S), u0(n, c, b);
  }
  const k = /* @__PURE__ */ new Set();
  for (const b of [n, n.defaultView])
    for (const { type: S } of b?.listeners ?? []) md[S] && k.add(md[S]);
  return { schema: Zh, root: H[0] ?? null, overlays: H.slice(1), document_events: [...k].sort(), unsupported: A.findings.list() };
}
const v0 = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let y0 = null;
const x0 = () => y0 ??= new Uh(v0);
//! The React renderer: React 19 through `react-reconciler` onto the retained host tree of `dom.mjs`, so a stock
//! screen's unchanged source (`useRef`, `createPortal(..., document.body)`, `event.currentTarget.closest(...)`)
//! runs as it does in the page. After every commit the tree is described for the engine (`describe.mjs`) and handed
//! to `perch.render(description)`.
//!
//! The engine talks back through the handle `mount` returns: `dispatch(id, type, init)` runs a DOM event through
//! the tree (capture on `window`, `document` and the ancestors, the target, then bubble, with React's `on<Type>`
//! and `on<Type>Capture` props at their element), `hover(id, on)` and `focus(id)` set the interaction state the
//! cascade reads for group variants, and `flush()` runs pending effects. An event is a discrete update: React
//! commits it before `dispatch` returns.
let Pa = pl.NoEventPriority;
function w0(n, i) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const s of o) {
    if (s === "children") continue;
    const c = n[s], d = i[s];
    if (!(c === d || typeof c == "function" && typeof d == "function") && !(s === "style" && c && d && typeof c == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(d)])].every((f) => c[f] === d[f])))
      return !0;
  }
  return !1;
}
const _0 = {
  rendererPackageName: "perch-native",
  rendererVersion: "1.0.0",
  supportsMutation: !0,
  supportsPersistence: !1,
  supportsHydration: !1,
  supportsMicrotasks: !0,
  supportsResources: !1,
  supportsSingletons: !1,
  supportsTestSelectors: !1,
  isPrimaryRenderer: !0,
  noTimeout: -1,
  NotPendingTransition: null,
  HostTransitionContext: null,
  scheduleTimeout: (n, i) => setTimeout(n, i),
  cancelTimeout: (n) => clearTimeout(n),
  scheduleMicrotask: (n) => queueMicrotask(n),
  // React works on one root at a time, whichever screen's call it runs in: the host runs it as that root's screen.
  getRootHostContext: (n) => (n.ownerDocument?.perch?.enter?.(), null),
  getChildHostContext: (n) => n,
  getPublicInstance: (n) => n,
  prepareForCommit: (n) => (n.ownerDocument?.perch?.enter?.(), null),
  resetAfterCommit: (n) => n.ownerDocument?.afterCommit?.(),
  preparePortalMount: () => {
  },
  createInstance: (n, i, o) => new ke(n, i, o.ownerDocument),
  createTextInstance: (n, i) => new Zo(n),
  appendInitialChild: (n, i) => {
    n.appendChild(i);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, i, o) => !!o.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, i) => {
    n.appendChild(i);
  },
  appendChildToContainer: (n, i) => {
    n.appendChild(i);
  },
  insertBefore: (n, i, o) => {
    n.insertBefore(i, o);
  },
  insertInContainerBefore: (n, i, o) => {
    n.insertBefore(i, o);
  },
  removeChild: (n, i) => {
    n.removeChild(i);
  },
  removeChildFromContainer: (n, i) => {
    n.removeChild(i);
  },
  clearContainer: (n) => {
    for (const i of [...n.childNodes]) n.removeChild(i);
  },
  commitUpdate: (n, i, o, s) => {
    n.props = s, w0(o, s) && n.touch();
  },
  commitTextUpdate: (n, i, o) => {
    n.data = String(o);
  },
  commitMount: (n) => {
    n.focus();
  },
  resetTextContent: () => {
  },
  hideInstance: (n) => {
    n.hidden = !0, n.touch();
  },
  unhideInstance: (n) => {
    n.hidden = !1, n.touch();
  },
  hideTextInstance: (n) => {
    n.hidden = !0;
  },
  unhideTextInstance: (n) => {
    n.hidden = !1;
  },
  detachDeletedInstance: () => {
  },
  beforeActiveInstanceBlur: () => {
  },
  afterActiveInstanceBlur: () => {
  },
  getInstanceFromNode: () => null,
  getInstanceFromScope: () => null,
  prepareScopeUpdate: () => {
  },
  setCurrentUpdatePriority: (n) => {
    Pa = n;
  },
  getCurrentUpdatePriority: () => Pa,
  resolveUpdatePriority: () => Pa !== pl.NoEventPriority ? Pa : pl.DefaultEventPriority,
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  shouldAttemptEagerTransition: () => !1,
  trackSchedulerEvent: () => {
  },
  requestPostPaintCallback: () => {
  },
  maySuspendCommit: () => !1,
  maySuspendCommitOnUpdate: () => !1,
  maySuspendCommitInSyncRender: () => !1,
  preloadInstance: () => !0,
  startSuspendingCommit: () => null,
  suspendInstance: () => {
  },
  waitForCommitToBeReady: () => null,
  getSuspendedCommitReason: () => null,
  resetFormInstance: () => {
  },
  bindToConsole: (n, i) => Function.prototype.bind.call(console[n], console, ...i)
}, _e = Sh(_0), Ri = (n, i, o = null) => _e.createPortal(n, i, null, o), S0 = {
  click: "onClick",
  dblclick: "onDoubleClick",
  contextmenu: "onContextMenu",
  mousedown: "onMouseDown",
  mouseup: "onMouseUp",
  mousemove: "onMouseMove",
  pointerdown: "onPointerDown",
  pointerup: "onPointerUp",
  pointermove: "onPointerMove",
  pointercancel: "onPointerCancel",
  keydown: "onKeyDown",
  keyup: "onKeyUp",
  focus: "onFocus",
  blur: "onBlur",
  input: "onInput",
  change: "onChange",
  submit: "onSubmit"
};
class k0 {
  constructor(i, o, s) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, o), this.type = i, this.target = s, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
  }
  get nativeEvent() {
    return this;
  }
  preventDefault() {
    this.defaultPrevented = !0;
  }
  stopPropagation() {
    this.propagationStopped = !0;
  }
  stopImmediatePropagation() {
    this.propagationStopped = !0;
  }
  isDefaultPrevented() {
    return this.defaultPrevented;
  }
  isPropagationStopped() {
    return this.propagationStopped;
  }
  persist() {
  }
}
function vi(n, i, o) {
  i.currentTarget = n;
  for (const { type: s, listener: c, capture: d } of [...n.listeners ?? []])
    s === i.type && d === o && c.call(n, i);
  if (n instanceof ke) {
    const s = S0[i.type], c = s && n.props[o ? `${s}Capture` : s];
    typeof c == "function" && c(i);
  }
}
function mv(n, i, o = {}) {
  const { document: s, window: c, globals: d } = mh(n), p = new ke("div", { id: "root", style: o.container ?? {} }, s);
  s.body.appendChild(p);
  const f = [];
  let _ = null;
  const x = () => [s, c].map((N) => N.listeners.map((j) => `${j.type}:${j.capture}`).sort().join(",")).join("|");
  let A = "";
  const H = {}, k = () => (_ = b0(s, n, x0(), H, o.names), A = x(), n.render?.(_), _), b = () => {
    _e.flushPassiveEffects(), _e.flushSyncWork(), x() !== A && k();
  };
  s.afterCommit = k;
  const S = (N) => {
    f.push(N), n.error?.(N);
  }, w = _e.createContainer(p, pl.ConcurrentRoot, null, !1, null, "", S, S, S, null);
  _e.updateContainerSync(ct.createElement(i, o.props ?? {}), w, null, null), _e.flushSyncWork(), b();
  const z = (N) => {
    const j = (D) => {
      if (D.id === N) return D;
      for (const T of D.children) {
        const g = j(T);
        if (g) return g;
      }
      return null;
    };
    return j(s.documentElement);
  }, q = (N) => {
    const j = Pa;
    Pa = pl.DiscreteEventPriority;
    try {
      return N();
    } finally {
      Pa = j, _e.flushSyncWork(), b();
    }
  }, E = {
    document: s,
    window: c,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: p,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return _;
    },
    describe: k,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(N, j, D = {}) {
      const T = typeof N == "string" ? z(N) : N;
      if (!T) return !1;
      const g = new k0(j, D, T), h = [];
      for (let at = T; at; at = at.parentNode) h.push(at);
      const U = [...h, s, c];
      q(() => {
        for (let at = U.length - 1; at > 0 && !g.propagationStopped; at--) vi(U[at], g, !0);
        g.propagationStopped || (vi(T, g, !0), g.propagationStopped || vi(T, g, !1));
        for (let at = 1; at < U.length && !g.propagationStopped; at++) vi(U[at], g, !1);
      });
      const J = j === "click" && !g.defaultPrevented ? Mo(T) : null;
      return J && E.dispatch(J, "submit", {}), !g.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(N) {
      const j = s.activeElement && s.activeElement !== s.body ? s.activeElement : s.body;
      if (!E.dispatch(j, "keydown", N)) return !0;
      const T = N.key === "Enter" && !N.isComposing ? Mo(j, !0) : null;
      if (T)
        return E.dispatch(T, "submit", {}), !0;
      if (!Gd(j) || j.props.disabled || j.props.readOnly) return !1;
      if ((N.ctrlKey || N.metaKey) && !N.altKey && !N.shiftKey && N.key.toLowerCase() === "a")
        return j.selectedAll = !0, !0;
      if (N.ctrlKey || N.metaKey) return !1;
      const g = j.selectedAll;
      j.selectedAll = !1;
      const h = j.value, J = N.key === "Backspace" || g && N.key === "Delete" ? g ? "" : h.slice(0, -1) : [...N.key].length === 1 ? (g ? "" : h) + N.key : h;
      return J === h ? !1 : (j.value = J, E.dispatch(j, "input", { data: N.key }), E.dispatch(j, "change", {}), j.props.value !== void 0 && delete j.edit, j.touch(), k(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(N, j) {
      const D = z(N);
      D && (D.bounds = { x: j.x, y: j.y, width: j.width, height: j.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(N) {
      const j = z(N);
      if (!j || j.props.disabled || !E.dispatch(N, "click", { button: 0, detail: 1 })) return;
      const D = j.props.type === "radio";
      D && j.checked || (j.checked = D ? !0 : !j.checked, E.dispatch(N, "input", {}), E.dispatch(N, "change", {}), j.props.checked !== void 0 && delete j.ticked, j.touch(), k());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(N, j = {}) {
      const D = { button: 0, buttons: 1, pointerType: "mouse", ...j };
      for (const T of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) E.dispatch(N, T, D);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (N) => !!z(N)?.state.hover,
    hover(N, j) {
      const D = z(N);
      !D || D.state.hover === j || (D.state.hover = j, D.touch(), k());
    },
    focus(N) {
      const j = z(N);
      j && (q(() => {
        const D = s.activeElement;
        D && D !== j && D !== s.body && E.dispatch(D, "blur"), s.focus(j), E.dispatch(j, "focus");
      }), k());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: b,
    update(N) {
      _e.updateContainerSync(ct.createElement(i, N ?? {}), w, null, null), _e.flushSyncWork(), b();
    },
    unmount() {
      _e.updateContainerSync(null, w, null, null), _e.flushSyncWork(), _e.flushPassiveEffects(), s.afterCommit = null;
    }
  };
  return E;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Pd = (n) => _e.flushSyncFromReconciler(n), z0 = { createPortal: Ri, flushSync: Pd }, fv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Ri,
  default: z0,
  flushSync: Pd
}, Symbol.toStringTag, { value: "Module" }));
function tm(n) {
  var i, o, s = "";
  if (typeof n == "string" || typeof n == "number") s += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var c = n.length;
    for (i = 0; i < c; i++) n[i] && (o = tm(n[i])) && (s && (s += " "), s += o);
  } else for (o in n) n[o] && (s && (s += " "), s += o);
  return s;
}
function em() {
  for (var n, i, o = 0, s = "", c = arguments.length; o < c; o++) (n = arguments[o]) && (i = tm(n)) && (s && (s += " "), s += i);
  return s;
}
const E0 = (n, i) => {
  const o = new Array(n.length + i.length);
  for (let s = 0; s < n.length; s++)
    o[s] = n[s];
  for (let s = 0; s < i.length; s++)
    o[n.length + s] = i[s];
  return o;
}, N0 = (n, i) => ({
  classGroupId: n,
  validator: i
}), am = (n = /* @__PURE__ */ new Map(), i = null, o) => ({
  nextPart: n,
  validators: i,
  classGroupId: o
}), ji = "-", wd = [], T0 = "arbitrary..", C0 = (n) => {
  const i = M0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: s
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return j0(p);
      const f = p.split(ji), _ = f[0] === "" && f.length > 1 ? 1 : 0;
      return nm(f, _, i);
    },
    getConflictingClassGroupIds: (p, f) => {
      if (f) {
        const _ = s[p], x = o[p];
        return _ ? x ? E0(x, _) : _ : x || wd;
      }
      return o[p] || wd;
    }
  };
}, nm = (n, i, o) => {
  if (n.length - i === 0)
    return o.classGroupId;
  const c = n[i], d = o.nextPart.get(c);
  if (d) {
    const x = nm(n, i + 1, d);
    if (x) return x;
  }
  const p = o.validators;
  if (p === null)
    return;
  const f = i === 0 ? n.join(ji) : n.slice(i).join(ji), _ = p.length;
  for (let x = 0; x < _; x++) {
    const A = p[x];
    if (A.validator(f))
      return A.classGroupId;
  }
}, j0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), o = i.indexOf(":"), s = i.slice(0, o);
  return s ? T0 + s : void 0;
})(), M0 = (n) => {
  const {
    theme: i,
    classGroups: o
  } = n;
  return A0(o, i);
}, A0 = (n, i) => {
  const o = am();
  for (const s in n) {
    const c = n[s];
    Wo(c, o, s, i);
  }
  return o;
}, Wo = (n, i, o, s) => {
  const c = n.length;
  for (let d = 0; d < c; d++) {
    const p = n[d];
    O0(p, i, o, s);
  }
}, O0 = (n, i, o, s) => {
  if (typeof n == "string") {
    R0(n, i, o);
    return;
  }
  if (typeof n == "function") {
    H0(n, i, o, s);
    return;
  }
  D0(n, i, o, s);
}, R0 = (n, i, o) => {
  const s = n === "" ? i : lm(i, n);
  s.classGroupId = o;
}, H0 = (n, i, o, s) => {
  if (U0(n)) {
    Wo(n(s), i, o, s);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(N0(o, n));
}, D0 = (n, i, o, s) => {
  const c = Object.entries(n), d = c.length;
  for (let p = 0; p < d; p++) {
    const [f, _] = c[p];
    Wo(_, lm(i, f), o, s);
  }
}, lm = (n, i) => {
  let o = n;
  const s = i.split(ji), c = s.length;
  for (let d = 0; d < c; d++) {
    const p = s[d];
    let f = o.nextPart.get(p);
    f || (f = am(), o.nextPart.set(p, f)), o = f;
  }
  return o;
}, U0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, B0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, o = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const c = (d, p) => {
    o[d] = p, i++, i > n && (i = 0, s = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let p = o[d];
      if (p !== void 0)
        return p;
      if ((p = s[d]) !== void 0)
        return c(d, p), p;
    },
    set(d, p) {
      d in o ? o[d] = p : c(d, p);
    }
  };
}, Bo = "!", _d = ":", q0 = [], Sd = (n, i, o, s, c) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: o,
  maybePostfixModifierPosition: s,
  isExternal: c
}), Y0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: o
  } = n;
  let s = (c) => {
    const d = [];
    let p = 0, f = 0, _ = 0, x;
    const A = c.length;
    for (let w = 0; w < A; w++) {
      const z = c[w];
      if (p === 0 && f === 0) {
        if (z === _d) {
          d.push(c.slice(_, w)), _ = w + 1;
          continue;
        }
        if (z === "/") {
          x = w;
          continue;
        }
      }
      z === "[" ? p++ : z === "]" ? p-- : z === "(" ? f++ : z === ")" && f--;
    }
    const H = d.length === 0 ? c : c.slice(_);
    let k = H, b = !1;
    H.endsWith(Bo) ? (k = H.slice(0, -1), b = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      H.startsWith(Bo) && (k = H.slice(1), b = !0)
    );
    const S = x && x > _ ? x - _ : void 0;
    return Sd(d, b, k, S);
  };
  if (i) {
    const c = i + _d, d = s;
    s = (p) => p.startsWith(c) ? d(p.slice(c.length)) : Sd(q0, !1, p, void 0, !0);
  }
  if (o) {
    const c = s;
    s = (d) => o({
      className: d,
      parseClassName: c
    });
  }
  return s;
}, G0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, s) => {
    i.set(o, 1e6 + s);
  }), (o) => {
    const s = [];
    let c = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], f = p[0] === "[", _ = i.has(p);
      f || _ ? (c.length > 0 && (c.sort(), s.push(...c), c = []), s.push(p)) : c.push(p);
    }
    return c.length > 0 && (c.sort(), s.push(...c)), s;
  };
}, Q0 = (n) => ({
  cache: B0(n.cacheSize),
  parseClassName: Y0(n),
  sortModifiers: G0(n),
  postfixLookupClassGroupIds: K0(n),
  ...C0(n)
}), K0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let s = 0; s < o.length; s++)
      i[o[s]] = !0;
  return i;
}, V0 = /\s+/, X0 = (n, i) => {
  const {
    parseClassName: o,
    getClassGroupId: s,
    getConflictingClassGroupIds: c,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, f = [], _ = n.trim().split(V0);
  let x = "";
  for (let A = _.length - 1; A >= 0; A -= 1) {
    const H = _[A], {
      isExternal: k,
      modifiers: b,
      hasImportantModifier: S,
      baseClassName: w,
      maybePostfixModifierPosition: z
    } = o(H);
    if (k) {
      x = H + (x.length > 0 ? " " + x : x);
      continue;
    }
    let q = !!z, E;
    if (q) {
      const g = w.substring(0, z);
      E = s(g);
      const h = E && p[E] ? s(w) : void 0;
      h && h !== E && (E = h, q = !1);
    } else
      E = s(w);
    if (!E) {
      if (!q) {
        x = H + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (E = s(w), !E) {
        x = H + (x.length > 0 ? " " + x : x);
        continue;
      }
      q = !1;
    }
    const N = b.length === 0 ? "" : b.length === 1 ? b[0] : d(b).join(":"), j = S ? N + Bo : N, D = j + E;
    if (f.indexOf(D) > -1)
      continue;
    f.push(D);
    const T = c(E, q);
    for (let g = 0; g < T.length; ++g) {
      const h = T[g];
      f.push(j + h);
    }
    x = H + (x.length > 0 ? " " + x : x);
  }
  return x;
}, Z0 = (...n) => {
  let i = 0, o, s, c = "";
  for (; i < n.length; )
    (o = n[i++]) && (s = im(o)) && (c && (c += " "), c += s);
  return c;
}, im = (n) => {
  if (typeof n == "string")
    return n;
  let i, o = "";
  for (let s = 0; s < n.length; s++)
    n[s] && (i = im(n[s])) && (o && (o += " "), o += i);
  return o;
}, J0 = (n, ...i) => {
  let o, s, c, d;
  const p = (_) => {
    const x = i.reduce((A, H) => H(A), n());
    return o = Q0(x), s = o.cache.get, c = o.cache.set, d = f, f(_);
  }, f = (_) => {
    const x = s(_);
    if (x)
      return x;
    const A = X0(_, o);
    return c(_, A), A;
  };
  return d = p, (..._) => d(Z0(..._));
}, L0 = [], Zt = (n) => {
  const i = (o) => o[n] || L0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, rm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, om = /^\((?:(\w[\w-]*):)?(.+)\)$/i, W0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, F0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, I0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, $0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, P0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, tg = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ca = (n) => W0.test(n), pt = (n) => !!n && !Number.isNaN(Number(n)), Ze = (n) => !!n && Number.isInteger(Number(n)), To = (n) => n.endsWith("%") && pt(n.slice(0, -1)), sa = (n) => F0.test(n), sm = () => !0, eg = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  I0.test(n) && !$0.test(n)
), Fo = () => !1, ag = (n) => P0.test(n), ng = (n) => tg.test(n), lg = (n) => !W(n) && !F(n), ig = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), rg = (n) => Aa(n, dm, Fo), W = (n) => rm.test(n), $a = (n) => Aa(n, mm, eg), kd = (n) => Aa(n, pg, pt), og = (n) => Aa(n, pm, sm), sg = (n) => Aa(n, fm, Fo), zd = (n) => Aa(n, cm, Fo), cg = (n) => Aa(n, um, ng), yi = (n) => Aa(n, hm, ag), F = (n) => om.test(n), dl = (n) => en(n, mm), ug = (n) => en(n, fm), Ed = (n) => en(n, cm), dg = (n) => en(n, dm), mg = (n) => en(n, um), xi = (n) => en(n, hm, !0), fg = (n) => en(n, pm, !0), Aa = (n, i, o) => {
  const s = rm.exec(n);
  return s ? s[1] ? i(s[1]) : o(s[2]) : !1;
}, en = (n, i, o = !1) => {
  const s = om.exec(n);
  return s ? s[1] ? i(s[1]) : o : !1;
}, cm = (n) => n === "position" || n === "percentage", um = (n) => n === "image" || n === "url", dm = (n) => n === "length" || n === "size" || n === "bg-size", mm = (n) => n === "length", pg = (n) => n === "number", fm = (n) => n === "family-name", pm = (n) => n === "number" || n === "weight", hm = (n) => n === "shadow", hg = () => {
  const n = Zt("color"), i = Zt("font"), o = Zt("text"), s = Zt("font-weight"), c = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), f = Zt("container"), _ = Zt("spacing"), x = Zt("radius"), A = Zt("shadow"), H = Zt("inset-shadow"), k = Zt("text-shadow"), b = Zt("drop-shadow"), S = Zt("blur"), w = Zt("perspective"), z = Zt("aspect"), q = Zt("ease"), E = Zt("animate"), N = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], j = () => [
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-top",
    "top-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-top",
    "bottom-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-bottom",
    "bottom-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-bottom"
  ], D = () => [...j(), F, W], T = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [F, W, _], U = () => [Ca, "full", "auto", ...h()], J = () => [Ze, "none", "subgrid", F, W], at = () => ["auto", {
    span: ["full", Ze, F, W]
  }, Ze, F, W], et = () => [Ze, "auto", F, W], Mt = () => ["auto", "min", "max", "fr", F, W], Kt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Tt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], K = () => ["auto", ...h()], nt = () => [Ca, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], lt = () => [f, Ca, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], B = () => [Ca, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], Y = () => [n, F, W], v = () => [...j(), Ed, zd, {
    position: [F, W]
  }], G = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", dg, rg, {
    size: [F, W]
  }], $ = () => [To, dl, $a], P = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    F,
    W
  ], it = () => ["", pt, dl, $a], xt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], dt = () => [pt, To, Ed, zd], Oa = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    S,
    F,
    W
  ], Ra = () => ["none", pt, F, W], Ae = () => ["none", pt, F, W], Oe = () => [pt, F, W], ua = () => [Ca, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [sa],
      breakpoint: [sa],
      color: [sm],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [lg],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [sa],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [sa],
      shadow: [sa],
      spacing: ["px", pt],
      text: [sa],
      "text-shadow": [sa],
      tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"]
    },
    classGroups: {
      // --------------
      // --- Layout ---
      // --------------
      /**
       * Aspect Ratio
       * @see https://tailwindcss.com/docs/aspect-ratio
       */
      aspect: [{
        aspect: ["auto", "square", Ca, W, F, z]
      }],
      /**
       * Container
       * @see https://tailwindcss.com/docs/container
       * @deprecated since Tailwind CSS v4.0.0
       */
      container: ["container"],
      /**
       * Container Type
       * @see https://tailwindcss.com/docs/responsive-design#container-queries
       */
      "container-type": [{
        "@container": ["", "normal", "size", F, W]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [ig],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [pt, "auto", W, F, f]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": N()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": N()
      }],
      /**
       * Break Inside
       * @see https://tailwindcss.com/docs/break-inside
       */
      "break-inside": [{
        "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
      }],
      /**
       * Box Decoration Break
       * @see https://tailwindcss.com/docs/box-decoration-break
       */
      "box-decoration": [{
        "box-decoration": ["slice", "clone"]
      }],
      /**
       * Box Sizing
       * @see https://tailwindcss.com/docs/box-sizing
       */
      box: [{
        box: ["border", "content"]
      }],
      /**
       * Display
       * @see https://tailwindcss.com/docs/display
       */
      display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
      /**
       * Screen Reader Only
       * @see https://tailwindcss.com/docs/display#screen-reader-only
       */
      sr: ["sr-only", "not-sr-only"],
      /**
       * Floats
       * @see https://tailwindcss.com/docs/float
       */
      float: [{
        float: ["right", "left", "none", "start", "end"]
      }],
      /**
       * Clear
       * @see https://tailwindcss.com/docs/clear
       */
      clear: [{
        clear: ["left", "right", "both", "none", "start", "end"]
      }],
      /**
       * Isolation
       * @see https://tailwindcss.com/docs/isolation
       */
      isolation: ["isolate", "isolation-auto"],
      /**
       * Object Fit
       * @see https://tailwindcss.com/docs/object-fit
       */
      "object-fit": [{
        object: ["contain", "cover", "fill", "none", "scale-down"]
      }],
      /**
       * Object Position
       * @see https://tailwindcss.com/docs/object-position
       */
      "object-position": [{
        object: D()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: T()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": T()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": T()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: g()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": g()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": g()
      }],
      /**
       * Position
       * @see https://tailwindcss.com/docs/position
       */
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      /**
       * Inset
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      inset: [{
        inset: U()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": U()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": U()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": U(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: U()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": U(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: U()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": U()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": U()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: U()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: U()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: U()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: U()
      }],
      /**
       * Visibility
       * @see https://tailwindcss.com/docs/visibility
       */
      visibility: ["visible", "invisible", "collapse"],
      /**
       * Z-Index
       * @see https://tailwindcss.com/docs/z-index
       */
      z: [{
        z: [Ze, "auto", F, W]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Ca, "full", "auto", f, ...h()]
      }],
      /**
       * Flex Direction
       * @see https://tailwindcss.com/docs/flex-direction
       */
      "flex-direction": [{
        flex: ["row", "row-reverse", "col", "col-reverse"]
      }],
      /**
       * Flex Wrap
       * @see https://tailwindcss.com/docs/flex-wrap
       */
      "flex-wrap": [{
        flex: ["nowrap", "wrap", "wrap-reverse"]
      }],
      /**
       * Flex
       * @see https://tailwindcss.com/docs/flex
       */
      flex: [{
        flex: [pt, Ca, "auto", "initial", "none", W]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", pt, F, W]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", pt, F, W]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Ze, "first", "last", "none", F, W]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": J()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: at()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": et()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": et()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": J()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: at()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": et()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": et()
      }],
      /**
       * Grid Auto Flow
       * @see https://tailwindcss.com/docs/grid-auto-flow
       */
      "grid-flow": [{
        "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
      }],
      /**
       * Grid Auto Columns
       * @see https://tailwindcss.com/docs/grid-auto-columns
       */
      "auto-cols": [{
        "auto-cols": Mt()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": Mt()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: h()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": h()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": h()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...Kt(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...Tt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...Tt()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...Kt()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...Tt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...Tt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": Kt()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...Tt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...Tt()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: h()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: h()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: h()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: h()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: h()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: h()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: h()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: h()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: h()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: h()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: h()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: K()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: K()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: K()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: K()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: K()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: K()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: K()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: K()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: K()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: K()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: K()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": h()
      }],
      /**
       * Space Between X Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x-reverse": ["space-x-reverse"],
      /**
       * Space Between Y
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y": [{
        "space-y": h()
      }],
      /**
       * Space Between Y Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y-reverse": ["space-y-reverse"],
      // --------------
      // --- Sizing ---
      // --------------
      /**
       * Size
       * @see https://tailwindcss.com/docs/width#setting-both-width-and-height
       */
      size: [{
        size: nt()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...lt()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...lt()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...lt()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/block-size
       */
      "block-size": [{
        block: ["auto", ...B()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...B()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...B()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [f, "screen", ...nt()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          f,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...nt()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          f,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [p]
          },
          ...nt()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...nt()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...nt()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...nt()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", o, dl, $a]
      }],
      /**
       * Font Smoothing
       * @see https://tailwindcss.com/docs/font-smoothing
       */
      "font-smoothing": ["antialiased", "subpixel-antialiased"],
      /**
       * Font Style
       * @see https://tailwindcss.com/docs/font-style
       */
      "font-style": ["italic", "not-italic"],
      /**
       * Font Weight
       * @see https://tailwindcss.com/docs/font-weight
       */
      "font-weight": [{
        font: [s, fg, og]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", To, W]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [ug, sg, i]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [W]
      }],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-normal": ["normal-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-ordinal": ["ordinal"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-slashed-zero": ["slashed-zero"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-figure": ["lining-nums", "oldstyle-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
      /**
       * Letter Spacing
       * @see https://tailwindcss.com/docs/letter-spacing
       */
      tracking: [{
        tracking: [c, F, W]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [pt, "none", F, kd]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          d,
          ...h()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", F, W]
      }],
      /**
       * List Style Position
       * @see https://tailwindcss.com/docs/list-style-position
       */
      "list-style-position": [{
        list: ["inside", "outside"]
      }],
      /**
       * List Style Type
       * @see https://tailwindcss.com/docs/list-style-type
       */
      "list-style-type": [{
        list: ["disc", "decimal", "none", F, W]
      }],
      /**
       * Text Alignment
       * @see https://tailwindcss.com/docs/text-align
       */
      "text-alignment": [{
        text: ["left", "center", "right", "justify", "start", "end"]
      }],
      /**
       * Placeholder Color
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://v3.tailwindcss.com/docs/placeholder-color
       */
      "placeholder-color": [{
        placeholder: Y()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: Y()
      }],
      /**
       * Text Decoration
       * @see https://tailwindcss.com/docs/text-decoration
       */
      "text-decoration": ["underline", "overline", "line-through", "no-underline"],
      /**
       * Text Decoration Style
       * @see https://tailwindcss.com/docs/text-decoration-style
       */
      "text-decoration-style": [{
        decoration: [...xt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [pt, "from-font", "auto", F, $a]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: Y()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [pt, "auto", F, W]
      }],
      /**
       * Text Transform
       * @see https://tailwindcss.com/docs/text-transform
       */
      "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
      /**
       * Text Overflow
       * @see https://tailwindcss.com/docs/text-overflow
       */
      "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
      /**
       * Text Wrap
       * @see https://tailwindcss.com/docs/text-wrap
       */
      "text-wrap": [{
        text: ["wrap", "nowrap", "balance", "pretty"]
      }],
      /**
       * Text Indent
       * @see https://tailwindcss.com/docs/text-indent
       */
      indent: [{
        indent: h()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [Ze, F, W]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", F, W]
      }],
      /**
       * Whitespace
       * @see https://tailwindcss.com/docs/whitespace
       */
      whitespace: [{
        whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
      }],
      /**
       * Word Break
       * @see https://tailwindcss.com/docs/word-break
       */
      break: [{
        break: ["normal", "words", "all", "keep"]
      }],
      /**
       * Overflow Wrap
       * @see https://tailwindcss.com/docs/overflow-wrap
       */
      wrap: [{
        wrap: ["break-word", "anywhere", "normal"]
      }],
      /**
       * Hyphens
       * @see https://tailwindcss.com/docs/hyphens
       */
      hyphens: [{
        hyphens: ["none", "manual", "auto"]
      }],
      /**
       * Content
       * @see https://tailwindcss.com/docs/content
       */
      content: [{
        content: ["none", F, W]
      }],
      // -------------------
      // --- Backgrounds ---
      // -------------------
      /**
       * Background Attachment
       * @see https://tailwindcss.com/docs/background-attachment
       */
      "bg-attachment": [{
        bg: ["fixed", "local", "scroll"]
      }],
      /**
       * Background Clip
       * @see https://tailwindcss.com/docs/background-clip
       */
      "bg-clip": [{
        "bg-clip": ["border", "padding", "content", "text"]
      }],
      /**
       * Background Origin
       * @see https://tailwindcss.com/docs/background-origin
       */
      "bg-origin": [{
        "bg-origin": ["border", "padding", "content"]
      }],
      /**
       * Background Position
       * @see https://tailwindcss.com/docs/background-position
       */
      "bg-position": [{
        bg: v()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: G()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: tt()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Ze, F, W],
          radial: ["", F, W],
          conic: ["", Ze, F, W]
        }, mg, cg]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: Y()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: $()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: $()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: $()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: Y()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: Y()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: Y()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: P()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": P()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": P()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": P()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": P()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": P()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": P()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": P()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": P()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": P()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": P()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": P()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": P()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": P()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": P()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: it()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": it()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": it()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": it()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": it()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": it()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": it()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": it()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": it()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": it()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": it()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": it()
      }],
      /**
       * Divide Width X Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x-reverse": ["divide-x-reverse"],
      /**
       * Divide Width Y
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y": [{
        "divide-y": it()
      }],
      /**
       * Divide Width Y Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y-reverse": ["divide-y-reverse"],
      /**
       * Border Style
       * @see https://tailwindcss.com/docs/border-style
       */
      "border-style": [{
        border: [...xt(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...xt(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: Y()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": Y()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": Y()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": Y()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": Y()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": Y()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": Y()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": Y()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": Y()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": Y()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": Y()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: Y()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...xt(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [pt, F, W]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", pt, dl, $a]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: Y()
      }],
      // ---------------
      // --- Effects ---
      // ---------------
      /**
       * Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow
       */
      shadow: [{
        shadow: [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          // Deprecated since Tailwind CSS v4.0.0
          "inner",
          "none",
          A,
          xi,
          yi
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: Y()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", H, xi, yi]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": Y()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: it()
      }],
      /**
       * Ring Width Inset
       * @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-w-inset": ["ring-inset"],
      /**
       * Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
       */
      "ring-color": [{
        ring: Y()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [pt, $a]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": Y()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": it()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": Y()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", k, xi, yi]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": Y()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [pt, F, W]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Jt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Jt()
      }],
      /**
       * Mask Clip
       * @see https://tailwindcss.com/docs/mask-clip
       */
      "mask-clip": [{
        "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"]
      }, "mask-no-clip"],
      /**
       * Mask Composite
       * @see https://tailwindcss.com/docs/mask-composite
       */
      "mask-composite": [{
        mask: ["add", "subtract", "intersect", "exclude"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image-linear-pos": [{
        "mask-linear": [pt]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": dt()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": dt()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": Y()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": Y()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": dt()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": dt()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": Y()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": Y()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": dt()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": dt()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": Y()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": Y()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": dt()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": dt()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": Y()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": Y()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": dt()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": dt()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": Y()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": Y()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": dt()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": dt()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": Y()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": Y()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": dt()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": dt()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": Y()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": Y()
      }],
      "mask-image-radial": [{
        "mask-radial": [F, W]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": dt()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": dt()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": Y()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": Y()
      }],
      "mask-image-radial-shape": [{
        "mask-radial": ["circle", "ellipse"]
      }],
      "mask-image-radial-size": [{
        "mask-radial": [{
          closest: ["side", "corner"],
          farthest: ["side", "corner"]
        }]
      }],
      "mask-image-radial-pos": [{
        "mask-radial-at": j()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [pt]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": dt()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": dt()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": Y()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": Y()
      }],
      /**
       * Mask Mode
       * @see https://tailwindcss.com/docs/mask-mode
       */
      "mask-mode": [{
        mask: ["alpha", "luminance", "match"]
      }],
      /**
       * Mask Origin
       * @see https://tailwindcss.com/docs/mask-origin
       */
      "mask-origin": [{
        "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"]
      }],
      /**
       * Mask Position
       * @see https://tailwindcss.com/docs/mask-position
       */
      "mask-position": [{
        mask: v()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: G()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: tt()
      }],
      /**
       * Mask Type
       * @see https://tailwindcss.com/docs/mask-type
       */
      "mask-type": [{
        "mask-type": ["alpha", "luminance"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image": [{
        mask: ["none", F, W]
      }],
      // ---------------
      // --- Filters ---
      // ---------------
      /**
       * Filter
       * @see https://tailwindcss.com/docs/filter
       */
      filter: [{
        filter: [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          F,
          W
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Oa()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [pt, F, W]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [pt, F, W]
      }],
      /**
       * Drop Shadow
       * @see https://tailwindcss.com/docs/drop-shadow
       */
      "drop-shadow": [{
        "drop-shadow": [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          "none",
          b,
          xi,
          yi
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": Y()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", pt, F, W]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [pt, F, W]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", pt, F, W]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [pt, F, W]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", pt, F, W]
      }],
      /**
       * Backdrop Filter
       * @see https://tailwindcss.com/docs/backdrop-filter
       */
      "backdrop-filter": [{
        "backdrop-filter": [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          F,
          W
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Oa()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [pt, F, W]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [pt, F, W]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", pt, F, W]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [pt, F, W]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", pt, F, W]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [pt, F, W]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [pt, F, W]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", pt, F, W]
      }],
      // --------------
      // --- Tables ---
      // --------------
      /**
       * Border Collapse
       * @see https://tailwindcss.com/docs/border-collapse
       */
      "border-collapse": [{
        border: ["collapse", "separate"]
      }],
      /**
       * Border Spacing
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing": [{
        "border-spacing": h()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": h()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": h()
      }],
      /**
       * Table Layout
       * @see https://tailwindcss.com/docs/table-layout
       */
      "table-layout": [{
        table: ["auto", "fixed"]
      }],
      /**
       * Caption Side
       * @see https://tailwindcss.com/docs/caption-side
       */
      caption: [{
        caption: ["top", "bottom"]
      }],
      // ---------------------------------
      // --- Transitions and Animation ---
      // ---------------------------------
      /**
       * Transition Property
       * @see https://tailwindcss.com/docs/transition-property
       */
      transition: [{
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", F, W]
      }],
      /**
       * Transition Behavior
       * @see https://tailwindcss.com/docs/transition-behavior
       */
      "transition-behavior": [{
        transition: ["normal", "discrete"]
      }],
      /**
       * Transition Duration
       * @see https://tailwindcss.com/docs/transition-duration
       */
      duration: [{
        duration: [pt, "initial", F, W]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", q, F, W]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [pt, F, W]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", E, F, W]
      }],
      // ------------------
      // --- Transforms ---
      // ------------------
      /**
       * Backface Visibility
       * @see https://tailwindcss.com/docs/backface-visibility
       */
      backface: [{
        backface: ["hidden", "visible"]
      }],
      /**
       * Perspective
       * @see https://tailwindcss.com/docs/perspective
       */
      perspective: [{
        perspective: [w, F, W]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": D()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Ra()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Ra()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Ra()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Ra()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: Ae()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": Ae()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": Ae()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": Ae()
      }],
      /**
       * Scale 3D
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-3d": ["scale-3d"],
      /**
       * Skew
       * @see https://tailwindcss.com/docs/skew
       */
      skew: [{
        skew: Oe()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Oe()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Oe()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [F, W, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: D()
      }],
      /**
       * Transform Style
       * @see https://tailwindcss.com/docs/transform-style
       */
      "transform-style": [{
        transform: ["3d", "flat"]
      }],
      /**
       * Translate
       * @see https://tailwindcss.com/docs/translate
       */
      translate: [{
        translate: ua()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": ua()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": ua()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": ua()
      }],
      /**
       * Translate None
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-none": ["translate-none"],
      /**
       * Zoom
       * @see https://tailwindcss.com/docs/zoom
       */
      zoom: [{
        zoom: [Ze, F, W]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: Y()
      }],
      /**
       * Appearance
       * @see https://tailwindcss.com/docs/appearance
       */
      appearance: [{
        appearance: ["none", "auto"]
      }],
      /**
       * Caret Color
       * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
       */
      "caret-color": [{
        caret: Y()
      }],
      /**
       * Color Scheme
       * @see https://tailwindcss.com/docs/color-scheme
       */
      "color-scheme": [{
        scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"]
      }],
      /**
       * Cursor
       * @see https://tailwindcss.com/docs/cursor
       */
      cursor: [{
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", F, W]
      }],
      /**
       * Field Sizing
       * @see https://tailwindcss.com/docs/field-sizing
       */
      "field-sizing": [{
        "field-sizing": ["fixed", "content"]
      }],
      /**
       * Pointer Events
       * @see https://tailwindcss.com/docs/pointer-events
       */
      "pointer-events": [{
        "pointer-events": ["auto", "none"]
      }],
      /**
       * Resize
       * @see https://tailwindcss.com/docs/resize
       */
      resize: [{
        resize: ["none", "", "y", "x"]
      }],
      /**
       * Scroll Behavior
       * @see https://tailwindcss.com/docs/scroll-behavior
       */
      "scroll-behavior": [{
        scroll: ["auto", "smooth"]
      }],
      /**
       * Scrollbar Thumb Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-thumb-color": [{
        "scrollbar-thumb": Y()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": Y()
      }],
      /**
       * Scrollbar Gutter
       * @see https://tailwindcss.com/docs/scrollbar-gutter
       */
      "scrollbar-gutter": [{
        "scrollbar-gutter": ["auto", "stable", "both"]
      }],
      /**
       * Scrollbar Width
       * @see https://tailwindcss.com/docs/scrollbar-width
       */
      "scrollbar-w": [{
        scrollbar: ["auto", "thin", "none"]
      }],
      /**
       * Scroll Margin
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-m": [{
        "scroll-m": h()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": h()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": h()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": h()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": h()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": h()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": h()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": h()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": h()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": h()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": h()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": h()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": h()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": h()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": h()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": h()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": h()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": h()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": h()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": h()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": h()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": h()
      }],
      /**
       * Scroll Snap Align
       * @see https://tailwindcss.com/docs/scroll-snap-align
       */
      "snap-align": [{
        snap: ["start", "end", "center", "align-none"]
      }],
      /**
       * Scroll Snap Stop
       * @see https://tailwindcss.com/docs/scroll-snap-stop
       */
      "snap-stop": [{
        snap: ["normal", "always"]
      }],
      /**
       * Scroll Snap Type
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-type": [{
        snap: ["none", "x", "y", "both"]
      }],
      /**
       * Scroll Snap Type Strictness
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-strictness": [{
        snap: ["mandatory", "proximity"]
      }],
      /**
       * Touch Action
       * @see https://tailwindcss.com/docs/touch-action
       */
      touch: [{
        touch: ["auto", "none", "manipulation"]
      }],
      /**
       * Touch Action X
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-x": [{
        "touch-pan": ["x", "left", "right"]
      }],
      /**
       * Touch Action Y
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-y": [{
        "touch-pan": ["y", "up", "down"]
      }],
      /**
       * Touch Action Pinch Zoom
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-pz": ["touch-pinch-zoom"],
      /**
       * User Select
       * @see https://tailwindcss.com/docs/user-select
       */
      select: [{
        select: ["none", "text", "all", "auto"]
      }],
      /**
       * Will Change
       * @see https://tailwindcss.com/docs/will-change
       */
      "will-change": [{
        "will-change": ["auto", "scroll", "contents", "transform", F, W]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...Y()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [pt, dl, $a, kd]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...Y()]
      }],
      // ---------------------
      // --- Accessibility ---
      // ---------------------
      /**
       * Forced Color Adjust
       * @see https://tailwindcss.com/docs/forced-color-adjust
       */
      "forced-color-adjust": [{
        "forced-color-adjust": ["auto", "none"]
      }]
    },
    conflictingClassGroups: {
      "container-named": ["container-type"],
      overflow: ["overflow-x", "overflow-y"],
      overscroll: ["overscroll-x", "overscroll-y"],
      inset: ["inset-x", "inset-y", "inset-bs", "inset-be", "start", "end", "top", "right", "bottom", "left"],
      "inset-x": ["start", "end", "right", "left"],
      "inset-y": ["inset-bs", "inset-be", "top", "bottom"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      p: ["px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl"],
      px: ["ps", "pe", "pr", "pl"],
      py: ["pbs", "pbe", "pt", "pb"],
      m: ["mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml"],
      mx: ["ms", "me", "mr", "ml"],
      my: ["mbs", "mbe", "mt", "mb"],
      size: ["w", "h"],
      "font-size": ["leading"],
      "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
      "fvn-ordinal": ["fvn-normal"],
      "fvn-slashed-zero": ["fvn-normal"],
      "fvn-figure": ["fvn-normal"],
      "fvn-spacing": ["fvn-normal"],
      "fvn-fraction": ["fvn-normal"],
      "line-clamp": ["display", "overflow"],
      rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
      "border-spacing": ["border-spacing-x", "border-spacing-y"],
      "border-w": ["border-w-x", "border-w-y", "border-w-s", "border-w-e", "border-w-bs", "border-w-be", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
      "border-w-x": ["border-w-s", "border-w-e", "border-w-r", "border-w-l"],
      "border-w-y": ["border-w-bs", "border-w-be", "border-w-t", "border-w-b"],
      "border-color": ["border-color-x", "border-color-y", "border-color-s", "border-color-e", "border-color-bs", "border-color-be", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
      "border-color-x": ["border-color-s", "border-color-e", "border-color-r", "border-color-l"],
      "border-color-y": ["border-color-bs", "border-color-be", "border-color-t", "border-color-b"],
      translate: ["translate-x", "translate-y", "translate-none"],
      "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
      "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
      "scroll-mx": ["scroll-ms", "scroll-me", "scroll-mr", "scroll-ml"],
      "scroll-my": ["scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mb"],
      "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
      "scroll-px": ["scroll-ps", "scroll-pe", "scroll-pr", "scroll-pl"],
      "scroll-py": ["scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pb"],
      touch: ["touch-x", "touch-y", "touch-pz"],
      "touch-x": ["touch"],
      "touch-y": ["touch"],
      "touch-pz": ["touch"]
    },
    conflictingClassGroupModifiers: {
      "font-size": ["leading"]
    },
    postfixLookupClassGroups: ["container-type"],
    orderSensitiveModifiers: ["*", "**", "after", "backdrop", "before", "details-content", "file", "first-letter", "first-line", "marker", "placeholder", "selection"]
  };
}, gg = /* @__PURE__ */ J0(hg);
function je(...n) {
  return gg(em(n));
}
const gm = typeof navigator < "u" && /Mac/i.test(navigator.platform), Mi = {
  "[": "BracketLeft",
  "]": "BracketRight",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  "\\": "Backslash",
  "-": "Minus",
  "=": "Equal",
  "`": "Backquote",
  ";": "Semicolon",
  "'": "Quote",
  enter: "Enter",
  tab: "Tab",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  pageup: "PageUp",
  pagedown: "PageDown",
  home: "Home",
  end: "End"
};
for (let n = 1; n <= 12; n++) Mi[`f${n}`] = `F${n}`;
const bg = Object.fromEntries(Object.entries(Mi).map(([n, i]) => [i, n])), vg = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  enter: "Enter",
  tab: "Tab",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End"
};
function yg(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : bg[n];
}
const Nd = /* @__PURE__ */ new Map();
function bm(n, i = gm) {
  const o = `${i}|${n}`, s = Nd.get(o);
  if (s) return s;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      i ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") c[d] = !0;
    else if (/^[a-z]$/.test(d))
      c.code = `Key${d.toUpperCase()}`, c.letter = d;
    else if (/^[0-9]$/.test(d)) c.code = `Digit${d}`;
    else if (Mi[d]) c.code = Mi[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!c.code) throw new Error(`no key in "${n}"`);
  return Nd.set(o, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = bm(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function xg(n, i = gm) {
  const o = bm(n, i), s = wg(yg(o.code) ?? "");
  return i ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${s}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", s].filter(Boolean).join("+");
}
const wg = (n) => vg[n] ?? n.toUpperCase(), Td = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Cd = em, Hi = (n, i) => (o) => {
  var s;
  if (i?.variants == null) return Cd(n, o?.class, o?.className);
  const { variants: c, defaultVariants: d } = i, p = Object.keys(c).map((x) => {
    const A = o?.[x], H = d?.[x];
    if (A === null) return null;
    const k = Td(A) || Td(H);
    return c[x][k];
  }), f = o && Object.entries(o).reduce((x, A) => {
    let [H, k] = A;
    return k === void 0 || (x[H] = k), x;
  }, {}), _ = i == null || (s = i.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((x, A) => {
    let { class: H, className: k, ...b } = A;
    return Object.entries(b).every((S) => {
      let [w, z] = S;
      return Array.isArray(z) ? z.includes({
        ...d,
        ...f
      }[w]) : {
        ...d,
        ...f
      }[w] === z;
    }) ? [
      ...x,
      H,
      k
    ] : x;
  }, []);
  return Cd(n, p, _, o?.class, o?.className);
}, _g = Hi(
  "flex cursor-pointer items-center self-stretch rounded-none [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      active: {
        true: "bg-surface-1 text-fg",
        false: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
      }
    },
    defaultVariants: { active: !1 }
  }
), Sg = Hi(
  "mx-0.5 grid size-6 shrink-0 cursor-pointer place-items-center self-center rounded-ui bg-transparent p-0 leading-none text-subtext-0 [border:0] [font-family:inherit] [font-size:inherit] [font-weight:inherit] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg",
  {
    variants: {
      reveal: {
        always: "",
        project: "opacity-0 group-hover/ph:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100",
        session: "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      },
      tone: { default: "", danger: "hover:text-red focus-visible:text-red" }
    },
    defaultVariants: { reveal: "always", tone: "default" }
  }
);
function kg({ className: n, ...i } = {}) {
  return je(Sg(i), n);
}
const vm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", ym = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", zg = Hi(`${ym} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
  variants: {
    // `soft` is a ghost button on a resting fill, for empty-state calls to action;
    // `primary` is the one filled button of a surface.
    variant: {
      ghost: "",
      soft: "bg-surface-0",
      primary: "bg-accent font-semibold text-panel-bg hover:bg-accent hover:text-panel-bg hover:brightness-110 focus-visible:bg-accent focus-visible:text-panel-bg"
    },
    size: {
      xs: "px-[0.3rem] py-[0.14rem] text-[0.6rem] leading-[1.1]",
      sm: "px-[0.4rem] py-[0.15rem] text-[0.7rem]",
      md: "px-[0.85rem] py-[0.35rem] text-[0.82rem]",
      lg: "px-[0.9rem] py-2 text-[0.85rem]"
    },
    // Only recolours the label; the hover fill stays the ghost one.
    tone: {
      default: "",
      danger: "hover:text-red focus-visible:text-red",
      warn: "text-yellow hover:text-yellow focus-visible:text-yellow"
    }
  },
  defaultVariants: { variant: "ghost", size: "md", tone: "default" }
});
function Eg({ className: n, ...i } = {}) {
  return je(zg(i), n);
}
const xm = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Ng = Hi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Tg = "my-1 h-px bg-overlay-0";
function Cg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ kt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ kt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ kt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ kt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function jg({ size: n = 16, className: i }) {
  return /* @__PURE__ */ kt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ kt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ kt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Mg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ kt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ kt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function wm({ size: n = 14, className: i }) {
  return /* @__PURE__ */ kt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ kt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const jd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Ag({ state: n, error: i }) {
  return /* @__PURE__ */ kt.jsx(
    "span",
    {
      className: je("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", jd[n] ?? jd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function Og({ title: n, onClose: i, children: o, testId: s }) {
  return Ri(
    /* @__PURE__ */ kt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (c) => {
          c.target === c.currentTarget && i();
        },
        onKeyDown: (c) => {
          c.key === "Escape" && i();
        },
        children: /* @__PURE__ */ kt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": s,
            children: [
              /* @__PURE__ */ kt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const wi = 4, ja = 8, Rg = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Md = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Hg({ value: n, onChange: i, options: o, className: s, ariaLabel: c, testId: d, id: p, title: f, disabled: _, placeholder: x, freeText: A, onKeyDown: H }) {
  const k = ct.useId(), [b, S] = ct.useState(!1), [w, z] = ct.useState(-1), [q, E] = ct.useState(!1), N = ct.useRef(null), j = ct.useRef(null), [D, T] = ct.useState({}), g = ct.useRef({ text: "", at: 0 }), h = A && q && n ? o.filter((B) => Md(B).toLowerCase().includes(n.toLowerCase()) || B.value.toLowerCase().includes(n.toLowerCase())) : o, U = o.find((B) => B.value === n), J = (B) => `${k}-${B}`;
  function at(B) {
    _ || (z(B), S(!0));
  }
  function et() {
    S(!1), E(!1), z(-1);
  }
  function Mt(B) {
    !B || B.disabled || (i(B.value), et());
  }
  function Kt(B, Y) {
    for (let v = 1; v <= h.length; v++) {
      const G = (B + Y * v + h.length * v) % h.length;
      if (!h[G].disabled) return G;
    }
    return B;
  }
  const Tt = () => h.findIndex((B) => !B.disabled), K = () => h.length - 1 - [...h].reverse().findIndex((B) => !B.disabled);
  ct.useLayoutEffect(() => {
    if (!b || !N.current) {
      T((tt) => tt.left === void 0 ? tt : {});
      return;
    }
    const B = N.current.getBoundingClientRect(), Y = window.innerHeight - B.bottom - wi - ja, v = B.top - wi - ja, G = Y < 160 && v > Y;
    T({
      position: "fixed",
      left: Math.min(Math.max(ja, B.left), Math.max(ja, window.innerWidth - B.width - ja)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: B.width,
      maxWidth: window.innerWidth - 2 * ja,
      maxHeight: Math.min(G ? v : Y, 320),
      ...G ? { bottom: window.innerHeight - B.top + wi } : { top: B.bottom + wi },
      overflowY: "auto"
    });
  }, [b, h.length]), ct.useLayoutEffect(() => {
    const B = j.current;
    if (!b || !B || D.left === void 0) return;
    const Y = B.getBoundingClientRect().right, v = window.innerWidth - ja;
    Y > v && T((G) => ({ ...G, left: Math.max(ja, Number(G.left) - (Y - v)) }));
  }, [b, D]), ct.useEffect(() => {
    if (!b) return;
    const B = (Y) => {
      const v = Y.target;
      (v === document || v instanceof Node && N.current && v.contains(N.current)) && et();
    };
    return window.addEventListener("resize", et), window.addEventListener("scroll", B, !0), () => {
      window.removeEventListener("resize", et), window.removeEventListener("scroll", B, !0);
    };
  }, [b]), ct.useEffect(() => {
    const B = b && w >= 0 ? document.getElementById(J(w)) : null, Y = j.current;
    !B || !Y || (B.offsetTop < Y.scrollTop ? Y.scrollTop = B.offsetTop : B.offsetTop + B.offsetHeight > Y.scrollTop + Y.clientHeight && (Y.scrollTop = B.offsetTop + B.offsetHeight - Y.clientHeight));
  }, [b, w]), Sm(b, (B) => {
    B || et();
  }, N, j);
  function nt(B) {
    if (B.nativeEvent.isComposing) return;
    const Y = () => {
      B.preventDefault(), B.stopPropagation();
    }, { key: v } = B;
    if (b) {
      if (v === "Escape") {
        Y(), et();
        return;
      } else if (v === "Tab")
        et();
      else if (v === "ArrowDown" || v === "ArrowUp") {
        Y(), h.length && z(w < 0 ? v === "ArrowDown" ? Tt() : K() : Kt(w, v === "ArrowDown" ? 1 : -1));
        return;
      } else if (v === "Home" && !A) {
        Y(), z(Tt());
        return;
      } else if (v === "End" && !A) {
        Y(), z(K());
        return;
      } else if (v === "Enter" || v === " " && !A) {
        if (w >= 0 && h[w]) {
          Y(), Mt(h[w]);
          return;
        }
        if (!A) {
          Y(), et();
          return;
        }
      } else if (!A && v.length === 1 && !B.metaKey && !B.ctrlKey && !B.altKey) {
        const G = Date.now();
        g.current = { text: (G - g.current.at > 600 ? "" : g.current.text) + v.toLowerCase(), at: G };
        const tt = Math.max(w, 0), $ = [...h.slice(tt + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, tt + 1)].find((P) => !P.disabled && Md(P).toLowerCase().startsWith(g.current.text));
        $ && (Y(), z(h.indexOf($)));
        return;
      }
    } else if (v === "ArrowDown" || v === "ArrowUp" || !A && (v === "Enter" || v === " ")) {
      Y(), at(Math.max(0, h.findIndex((G) => G.value === n)));
      return;
    }
    H?.(B);
  }
  const lt = {
    ref: (B) => {
      N.current = B;
    },
    id: p,
    title: f,
    disabled: _,
    "aria-label": c,
    "aria-expanded": b,
    "aria-controls": b ? k : void 0,
    "aria-activedescendant": b && w >= 0 ? J(w) : void 0,
    "data-testid": d,
    onKeyDown: nt
  };
  return /* @__PURE__ */ kt.jsxs(kt.Fragment, { children: [
    A ? /* @__PURE__ */ kt.jsx(
      "input",
      {
        ...lt,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: s,
        value: n,
        onChange: (B) => {
          i(B.target.value), E(!0), b ? z(-1) : (z(-1), S(!0));
        },
        onBlur: () => et()
      }
    ) : /* @__PURE__ */ kt.jsxs(
      "button",
      {
        ...lt,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: je("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
        onClick: () => b ? et() : at(Math.max(0, h.findIndex((B) => B.value === n))),
        children: [
          /* @__PURE__ */ kt.jsx("span", { className: "min-w-0 flex-1 truncate", children: U ? U.label : x ?? "" }),
          /* @__PURE__ */ kt.jsx(_m, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    b && h.length > 0 && Ri(
      /* @__PURE__ */ kt.jsx(
        "div",
        {
          ref: j,
          id: k,
          role: "listbox",
          "aria-label": c,
          className: je("z-[9999]", xm),
          style: D,
          onMouseDown: (B) => {
            B.preventDefault(), B.stopPropagation();
          },
          onClick: (B) => B.stopPropagation(),
          children: h.map((B, Y) => /* @__PURE__ */ kt.jsxs(
            "div",
            {
              id: J(Y),
              role: "option",
              "aria-selected": B.value === n,
              "aria-disabled": B.disabled || void 0,
              "data-value": B.value,
              className: je(Rg, Y === w && !B.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                B.disabled || z(Y);
              },
              onClick: () => Mt(B),
              children: [
                /* @__PURE__ */ kt.jsx("span", { className: "min-w-0 truncate", children: B.label }),
                B.value === n && /* @__PURE__ */ kt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            B.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const Dg = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ug = `${Dg} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function _m({ open: n, size: i = 12, className: o }) {
  return /* @__PURE__ */ kt.jsx("svg", { className: o, width: i, height: i, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ kt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Bg(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const qo = {
  blocked: { glyph: "●", color: "var(--red)" },
  // ●
  working: { glyph: "●", color: "var(--yellow)" },
  // ●
  done: { glyph: "●", color: "var(--teal)" },
  // ●
  idle: { glyph: "○", color: "var(--green)" },
  // ○
  unknown: { glyph: "·", color: "var(--overlay-1)" }
  // ·
};
function Yo(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((o) => o.id === n.parentSessionId);
}
function qg(n) {
  const i = /* @__PURE__ */ new Map();
  for (const o of n)
    Yo(o, n) && i.set(o.parentSessionId, [...i.get(o.parentSessionId) ?? [], o]);
  return i.size ? n.filter((o) => !Yo(o, n)).flatMap((o) => [o, ...i.get(o.id) ?? []]) : n;
}
const _i = 6, Ad = 8;
function Yg(n, i = {}) {
  const { minWidth: o = 220, align: s = "right", minSpaceAbove: c = 100 } = i, d = n.getBoundingClientRect(), p = window.innerWidth, f = window.innerHeight, _ = s === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, x = d.top - _i - Ad, A = f - d.bottom - _i - Ad;
  return x >= c ? {
    position: "fixed",
    bottom: f - d.top + _i,
    ..._,
    minWidth: o,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + _i,
    ..._,
    minWidth: o,
    maxHeight: Math.min(A, f * 0.75),
    overflowY: "auto"
  };
}
function Sm(n, i, o, s) {
  ct.useEffect(() => {
    if (!n) return;
    function c(p) {
      const f = p.target, _ = o.current?.contains(f) ?? !1, x = s.current?.contains(f) ?? !1;
      !_ && !x && i(!1);
    }
    function d(p) {
      p.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function Gg({ icon: n, fallback: i }) {
  const [o, s] = ct.useState(!1);
  return ct.useEffect(() => s(!1), [n]), !n || o ? /* @__PURE__ */ kt.jsx(kt.Fragment, { children: i }) : /* @__PURE__ */ kt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => s(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Qg = "1.3.0";
let ki = null;
const Kg = (n) => {
  ki = n;
};
function zt() {
  const n = (typeof ki == "function" ? ki() : ki) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Vg = (n) => zt().subscribe?.(n) ?? (() => {
}), Xg = Yg, Zg = globalThis.perch?.isMac !== !1, Jg = (n) => xg(n, zt().isMac !== !1), Lg = (n) => _g(n), Wg = ({ className: n, ...i } = {}) => je(kg(i), n), Fg = Eg, Ig = (n) => Ng(n), $g = Tg, Pg = ym, tb = vm, eb = (n) => qo[n].color, ab = (n, i) => zt().shortcutFor?.(n, i) ?? null, nb = (n) => zt().shortcutLabel?.(n) ?? null, Di = (n, i) => zt().command(n, i ?? {}) !== !1, lb = (n, i, o) => zt().startSession?.(n, i, o), ib = globalThis.perch?.pickFolder ? (n) => zt().pickFolder(n) : null;
function me(n) {
  const i = ct.useRef(n);
  return i.current = n, ct.useSyncExternalStore(Vg, () => i.current(zt()));
}
const km = (n = {}) => me((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), rb = () => me((n) => n.hosts()), ob = () => me((n) => n.sessionFolders());
function sb() {
  const n = me((i) => i.addProject?.() ?? cb);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, o, s) => {
      i.trim() && n.status !== "pending" && zt().addProjectFolder?.(i, o, s);
    },
    clear: () => zt().clearAddProject?.()
  };
}
const cb = Object.freeze({ status: "idle" }), zm = "perch.lastAgentChoice", ub = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), db = () => {
  const n = zt().storage?.getItem(zm);
  return n === "claude" || n === "codex" ? n : "claude";
}, mb = Object.freeze({ items: [] });
function fb() {
  const n = me((i) => i.notifications?.() ?? mb);
  return ct.useMemo(() => ({
    items: n.items ?? [],
    open: (i) => zt().command("notification.open", { id: i }),
    dismiss: (i) => zt().command("notification.dismiss", { id: i })
  }), [n]);
}
function pb(n) {
  const i = me((c) => c.agentChoices?.(n) ?? ub), [o, s] = ct.useState(db);
  return ct.useMemo(() => ({
    connected: !!i.connected,
    discovery: !!i.discovery,
    choices: i.choices ?? [],
    lastChoice: o,
    state: i.state ?? "ready",
    error: i.state === "error" ? i.error : void 0,
    rememberChoice: (c) => {
      c !== "claude" && c !== "codex" || (zt().storage?.setItem(zm, c), s(c));
    },
    manage: () => zt().command("agents.manage", {})
  }), [i, o]);
}
function hb(n) {
  ct.useEffect(() => zt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function gb(n) {
  const i = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return qg(i).map((o) => ({ session: o.session, nested: Yo(o, i) }));
}
function bb({ id: n, plain: i, className: o }) {
  const s = me((x) => x.session(n));
  if (!s) return null;
  const c = s.state ?? Bg(s), d = qo[c]?.color ?? qo.unknown.color, p = s.provider, f = p === "claude" || p === "claude-agent-teams" || p === "omp", _ = i ? je("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : je("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return ct.createElement(
    "span",
    { className: _, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    ct.createElement("span", { className: je("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, ct.createElement(Em, { provider: p, size: 14 }))
  );
}
function Em({ provider: n, size: i = 14 }) {
  const o = zt().agentIcon?.(n, i) ?? null, s = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ct.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": s, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const vb = ({ children: n }) => ct.createElement(ct.Fragment, null, n);
function yb(n, i) {
  const o = ct.useRef(i);
  return o.current = i, ct.useEffect(() => {
    const s = zt();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const c = {};
    for (const [p, f] of Object.entries(o.current))
      c[p] = typeof f == "function" ? (..._) => o.current[p]?.(..._) : f;
    const d = s.openOverlay(n, c);
    return () => s.closeOverlay?.(d);
  }, [n]), null;
}
const an = (n) => function(o) {
  return yb(n, o);
}, xb = an("session-menu"), wb = an("new-session-menu"), _b = an("confirm");
let Nm = null;
const Sb = (n) => {
  Nm = n;
};
function kb(n) {
  return ct.createElement(Nm ?? _b, n);
}
function zb({ className: n = Ug, ...i }) {
  return ct.createElement(Hg, { ...i, className: n });
}
let Go = null;
const Eb = (n) => {
  Go = n;
}, Nb = an("folder-browser");
function Tb(n) {
  return Go ? ct.createElement(Go, { ...n, browse: (i) => zt().browse(n.hostId, i) }) : ct.createElement(Nb, n);
}
const Cb = an("instructions"), jb = an("memory"), Mb = Og;
let Io = null;
const Ab = (n) => {
  Io = n;
};
function Ob(n) {
  if (Io) return ct.createElement(Rb, n);
  const { hostId: i, path: o, className: s } = n, c = ct.useRef(null);
  return ct.createElement(
    "button",
    {
      type: "button",
      ref: c,
      className: je("worktree-menu__btn", vm, s),
      "data-testid": `worktree-menu-${i}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => zt().openOverlay?.("worktree", { hostId: i, cwd: o, anchor: c.current?.getBoundingClientRect() })
    },
    ct.createElement(wm, null)
  );
}
const Tm = "Perch did not answer.";
function Si(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Tm };
}
function Rb({ hostId: n, path: i, className: o, worktrees: s, request: c = null, parentChoices: d, emptyAgent: p, ...f }) {
  const [_, x] = ct.useState(s), A = (N) => !!zt().coreCan?.(N, n), H = km(), k = ct.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!A("workspace.nest")) return [];
    const N = H?.projects?.find((T) => T.hostId === n && T.repoPath === i), j = [], D = (T, g) => {
      for (const h of T ?? [])
        g && j.push({ id: h.id, name: h.name, path: h.path }), D(h.children, !0);
    };
    return D(N?.workspaces, !1), j;
  }, [d, H, n, i]), b = !1, S = f.deleteSupported ?? A("worktree.delete"), w = f.startFromSupported ?? A("worktree.startFrom"), [z, q] = ct.useState(c), E = ct.useMemo(() => {
    const N = (j, D) => zt().ask(j, { hostId: n, repoPath: i, ...D });
    return {
      list: async () => {
        const j = await N("worktree.list", {});
        return j?.type === "worktree.list.result" && x({ worktrees: j.worktrees ?? [], defaultRoot: j.defaultRoot ?? "", baseRef: j.baseRef, refs: j.refs ?? [] }), Si(j);
      },
      create: async ({ branch: j, newBranch: D, path: T, extra: g, agent: h }) => {
        const U = await N("worktree.create", { branch: j, newBranch: !!D, path: T ?? null, name: g?.name ?? null, startFrom: g?.startFrom ?? null, parentWorkspaceId: g?.parentWorkspaceId ?? null });
        return U?.type !== "worktree.done" ? { error: Si(U).error ?? Tm } : (h && U.path && zt().startSession?.(n, U.path, h), {});
      },
      remove: async (j, D) => {
        const T = await N("worktree.remove", { path: j, force: !!D, deleteBranch: S });
        return { ...Si(T), preservedBranch: T?.type === "worktree.done" ? T.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (j, D) => Si(await N("worktree.branch.delete", { branch: j, expectedHead: D })),
      open: (j) => zt().startSession?.(n, j, "terminal"),
      takeRequest: () => q(null)
    };
  }, [n, i, S]);
  return ct.createElement(Io, {
    hostId: n,
    cwd: i,
    projectKey: `${n}:${i}`,
    className: o,
    worktrees: _,
    background: b,
    startFromSupported: w,
    deleteSupported: S,
    parentChoices: k,
    emptyAgent: p,
    request: z,
    actions: E
  });
}
const Hb = (n, i) => zt().beginReorderDrag?.(n, i), Db = () => me((n) => n.workspaceTabs()), Ub = () => me((n) => n.statusLine()), Bb = () => me((n) => n.zoom()), qb = () => me((n) => n.paneLook()), Yb = () => me((n) => n.keybindings?.() ?? []), Gb = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Qb(n) {
  const i = !!n?.keepFresh, o = me((c) => c.statusLine?.().connected ?? !1), s = me((c) => c.planUsage?.() ?? Gb);
  return ct.useEffect(() => {
    if (!i || !o) return;
    let c;
    const d = () => {
      zt().command("usage.get"), c = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(c);
  }, [i, o]), s;
}
const Kb = () => zt().command("usage.get", { force: !0 }), Vb = (n) => zt().command("usage.redeemReset", { accountId: n }), Xb = () => Di("app.zoom_reset"), Zb = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Jb = (n, i, o) => zt().beginTabDrag?.(n, i, o);
function Lb(n) {
  ct.useEffect(() => zt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Wb = (n) => Di("browser.open", { workspaceId: n }), Fb = (n, i) => Di("file.open", { workspaceId: n, path: i }), Ib = () => null, $b = () => null, Pb = an("new-file"), pv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Em,
  Chevron: _m,
  CloseIcon: Mg,
  ConfirmDialog: kb,
  Dialog: Mb,
  EllipsisIcon: Cg,
  FolderBrowser: Tb,
  GearIcon: jg,
  HostStateDot: Ag,
  InstructionsDialog: Cb,
  MemoryDialog: jb,
  NewFilePrompt: Pb,
  NewSessionMenu: wb,
  PageIcon: Gg,
  PlusIcon: wm,
  Select: zb,
  SessionDot: bb,
  SessionMenu: xb,
  Slot: vb,
  TabDragLayer: $b,
  TabMenu: Ib,
  WorktreeMenu: Ob,
  agentStateColor: eb,
  anchoredPopoverStyle: Xg,
  beginReorderDrag: Hb,
  beginTabDrag: Jb,
  bindHost: Kg,
  buttonClass: Fg,
  cn: je,
  drawConfirmationsInPlace: Sb,
  drawFolderBrowserInPlace: Eb,
  drawWorktreeInPlace: Ab,
  ghostButton: Pg,
  iconButton: tb,
  isMac: Zg,
  keyLabel: Jg,
  menuDividerClass: $g,
  menuItemClass: Ig,
  menuPanel: xm,
  nestSessions: gb,
  openBrowserTab: Wb,
  openFileTab: Fb,
  pickFolder: ib,
  redeemUsageReset: Vb,
  refreshUsage: Kb,
  resetZoom: Xb,
  rowActionClass: Wg,
  runCommand: Di,
  segmentClass: Lg,
  shortcutFor: ab,
  shortcutLabel: nb,
  startSession: lb,
  tabStateClass: Zb,
  useAddProject: sb,
  useAddProjectRequest: hb,
  useAgentChoices: pb,
  useDismissOnOutsideClick: Sm,
  useHosts: rb,
  useKeybindings: Yb,
  useNavigation: km,
  useNewTabRequest: Lb,
  useNotifications: fb,
  usePaneLook: qb,
  usePlanUsage: Qb,
  useSessionFolders: ob,
  useStatusLine: Ub,
  useWorkspaceTabs: Db,
  useZoom: Bb,
  version: Qg
}, Symbol.toStringTag, { value: "Module" }));
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
const $o = {
  display: (n, i) => i === "hidden" ? n.hidden() : i === "flex" ? n.flex() : n.block(),
  flex_direction: (n, i) => n[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[i]](),
  flex_wrap: (n, i) => i === "wrap" ? n.flex_wrap() : n.flex_nowrap(),
  items: (n, i) => n[`items_${i}`](),
  justify: (n, i) => n[`justify_${i}`](),
  self: (n, i) => i === "auto" ? n : n[`self_${i}`](),
  flex_grow: (n, i) => n.flex_grow(i),
  flex_shrink: (n, i) => n.flex_shrink(i),
  flex_basis: (n, i) => n.flex_basis(i),
  position: (n, i) => i === "absolute" ? n.absolute() : n.relative(),
  overflow_x: (n, i) => i === "hidden" ? n.overflow_x_hidden() : i === "scroll" ? n.overflow_x_scroll() : n,
  overflow_y: (n, i) => i === "hidden" ? n.overflow_y_hidden() : i === "scroll" ? n.overflow_y_scroll() : n,
  visibility: (n, i) => i === "invisible" ? n.invisible() : n.visible(),
  bg: (n, i) => n.bg(i),
  opacity: (n, i) => n.opacity(i),
  shadow: (n, i) => i === "none" ? n.shadow_none() : n[`shadow_${i}`](),
  cursor: (n, i) => n[`cursor_${i}`](),
  border_color: (n, i) => n.border_color(i),
  text_ellipsis: (n, i) => i ? n.text_ellipsis() : n,
  underline: (n, i) => i ? n.underline() : n,
  text_color: (n, i) => n.text_color(i),
  text_size: (n, i) => n.text_size(i),
  font_weight: (n, i) => n.font_weight(i),
  font_family: (n, i) => n.font_family(i),
  font_features: (n, i) => n.font_features(i),
  line_height: (n, i) => n.line_height(i),
  italic: (n, i) => i ? n.italic() : n.not_italic(),
  whitespace: (n, i) => i === "nowrap" ? n.whitespace_nowrap() : n.whitespace_normal(),
  text_align: (n, i) => n[`text_${i}`](),
  rounded: (n, i) => n.rounded(i)
};
for (const n of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  $o[n] = (i, o) => i[n](o);
const hv = Object.keys($o);
function Od(n, i) {
  for (const [o, s] of Object.entries(i)) {
    const c = $o[o];
    if (!c) throw new Error(`the description key ${o} has no GPUI builder`);
    s != null && (n = c(n, s));
  }
  return n;
}
const Ma = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Rd = /* @__PURE__ */ new WeakSet();
function Hd(n, i, o) {
  const s = n.pressed, c = Ma(o);
  return s && s.x === c.clientX && s.y === c.clientY ? s.id : i;
}
function tv(n, i, o) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const Me = (n) => n.style?.display !== "hidden";
function Qo(n, i, o, s, c = !1, d = !1, p = null, f = {}, _ = !1, x = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return x.get(n)?.text ?? n.text;
  const A = Rd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), p = n.style.text_color ?? p;
  const H = !!n.hover?.text_color && Am(n);
  H && o.hovered?.(n.id) && (p = n.hover.text_color), f = { ...f };
  for (const T of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[T] !== void 0 && (f[T] = n.style[T]);
  const k = new Set(n.events ?? []);
  let b;
  n.kind === "image" && !n.markup ? b = i.image(n.src) : b = i.div(), n.markup && (b = b.child(s.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const S = tv(n, k, c);
  if (S && (b = b.id(S)), n.name && b.also_named) for (const T of n.also ?? []) b = b.also_named(T);
  b = Od(b, { ...n.style, ...x.get(n) });
  const w = f.whitespace !== "nowrap" && !f.text_ellipsis;
  _ && w && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && (n.children ?? []).some((T) => T.kind === "text") && (b = b.min_w(0));
  for (const T of ["hover", "focus", "active"]) n[T] && (b = b[T]((g) => Od(g, n[T])));
  if (i.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const T = o.document?.scrollTarget, g = T ? (n.children ?? []).filter(Me).findIndex((h) => Mm(h, T.id)) : -1;
    if (g >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, i.scroll.scroll_to_item(g)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      b = b.track_scroll(i.scroll);
      const h = (n.children ?? []).filter(Me).map((U) => U.id);
      o.document.itemBounds = (U) => h.includes(U) ? i.scroll.item_bounds?.(h.indexOf(U)) ?? null : null;
    }
  }
  n.kind === "input" && !n.disabled && (b = b.on_mouse_down("left", (T, g) => {
    o.focus(n.id), g.notify();
  }));
  const z = n.kind === "input" ? n : n.meta?.tag === "label" ? jm(n) : null;
  z && !z.disabled && /^(checkbox|radio)$/.test(z.input_type) && (b = b.on_click((T, g) => {
    g.stop_propagation?.(), o.toggle(z.id), g.notify();
  }));
  const q = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((T) => k.has(T));
  if (q || A) for (const T of n.children ?? []) T.kind !== "text" && Rd.add(T);
  if (q && (b = b.on_mouse_down("left", (T, g) => {
    g.stop_propagation?.(), T.bounds && o.setBounds(n.id, T.bounds);
    const h = { ...Ma(T), button: 0, buttons: 1, detail: T.click_count }, U = Hd(o, n.id, T);
    o.pressed = null, o.dispatch(U, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(U, "mousedown", h), g.notify();
  }), b = b.on_mouse_down("right", (T, g) => {
    g.stop_propagation?.(), T.bounds && o.setBounds(n.id, T.bounds);
    const h = Hd(o, n.id, T);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Ma(T), button: 2 }), g.notify();
  }), b = b.on_mouse_up("left", (T, g) => {
    g.stop_propagation?.();
    const h = { ...Ma(T), button: 0 };
    o.dispatch(n.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", h), g.notify();
  }), b = b.on_click((T, g) => {
    o.dispatch(n.id, T.click_count === 2 && k.has("double_click") ? "dblclick" : "click", { detail: T.click_count, button: 0 }), g.notify();
  })), n.blocks_pointer && !q)
    for (const T of ["left", "right"]) b = b.on_mouse_down(T, (g, h) => h.stop_propagation?.());
  else if (A && !q)
    for (const T of ["left", "right"])
      b = b.on_mouse_down(T, (g) => {
        const h = Ma(g);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: n.id, x: h.clientX, y: h.clientY });
      });
  if (k.has("mouse_move") && (b = b.on_mouse_move((T, g) => {
    o.dispatch(n.id, "pointermove", { ...Ma(T), pointerType: "mouse" }), g.notify();
  })), (n.track_hover || H) && (b = b.on_hover((T, g) => {
    o.hover(n.id, T), g.notify();
  })), c && (b = b.on_mouse_down_out((T, g) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Ma(T), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Ma(T)), g.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const T = n.value ? String(n.value) : String(n.placeholder ?? "");
    let g = i.div().whitespace_nowrap().overflow_x_hidden();
    const h = tn(f);
    h && (g = g.h(h)), !n.value && p && (g = g.text_color(av(p))), T && (b = b.child(g.child(n.input_type === "password" && n.value ? "•".repeat([...T].length) : T))), n.field_w && (b = b.child(i.div().w(n.field_w).h(0)));
  }
  const E = f.whitespace === "nowrap" ? tn(f) : null, N = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let j = !n.range_name;
  const D = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const T of (n.children ?? []).filter(Me)) {
    const g = T.style?.flex_basis;
    D && T.style.flex_grow > 0 && (g === 0 || typeof g == "string" && g.endsWith("%")) && x.set(T, { ...x.get(T), flex_basis: "auto" });
    let h = Qo(T, i, o, s, !1, d, p, f, N && T.style?.position !== "absolute", x);
    const U = !j && (T.kind === "text" || !T.meta), J = T.kind === "text" ? x.get(T)?.h ?? E : null, at = T.kind === "text" ? x.get(T)?.w : void 0;
    if (U || J || at !== void 0) {
      let et = i.div();
      U && (et = et.id(n.range_name)), U && !N && n.style.display === "flex" && (et = et[`self_${ev[f.text_align] ?? "start"}`]().max_w("100%")), J && (et = et.h(J)), at !== void 0 && (et = et.w(at).flex_none().whitespace_nowrap()), h = et.child(h), j ||= U;
    }
    b = b.child(h);
  }
  return b;
}
const ev = { center: "center", right: "end", end: "end" };
function av(n) {
  const i = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return n;
  const o = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const Cm = /^[!-,.-~]+$/, jm = (n) => {
  for (const i of n.children ?? []) {
    if (i.kind === "input" && /^(checkbox|radio)$/.test(i.input_type)) return i;
    const o = i.kind === "text" ? null : jm(i);
    if (o) return o;
  }
  return null;
}, Mm = (n, i) => n.id === i || (n.children ?? []).some((o) => o.kind !== "text" && Mm(o, i)), Am = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && Am(i));
function tn(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function gv(n, i, o, s, c = 0, d = !1) {
  const p = [n.root, ...n.overlays], f = c > 0 ? cv(p, c) : /* @__PURE__ */ new Map();
  c > 0 && s.measure && nv(p, c, s.measure, f), ov(p, f), rv(p, f), s.measure && iv(p, s.measure, f);
  let _ = i.div().relative().size_full().child(Qo(n.root, i, o, s, !1, !1, null, {}, !1, f)), x = d && n.overlays.length ? i.div().relative().size_full().window_layer() : _;
  for (const A of n.overlays) x = x.child(Qo(A, i, o, s, !0, !1, null, {}, !1, f));
  return x === _ ? _ : _.child(x);
}
function nv(n, i, o, s) {
  const c = (S, w) => s.set(S, { ...s.get(S), ...w }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function _(S, w, z) {
    if (S.kind === "text") {
      if (!(w.whitespace === "nowrap" || Cm.test(S.text)) || w.text_ellipsis || z || typeof w.text_size != "number") return NaN;
      const g = o(S.text, { size: w.text_size, weight: w.font_weight ?? 400, family: w.font_family ?? ".SystemUIFont", italic: !!w.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Me(S) || S.kind === "input" || S.markup) return x(S);
    const q = { ...w };
    for (const T of f) S.style[T] !== void 0 && (q[T] = S.style[T]);
    p.set(S, q);
    const E = S.style, N = (S.children ?? []).filter(Je), j = N.map((T) => _(T, q, z || !!S.tabular));
    let D = x(S);
    if (!Number.isFinite(D) && E.w === void 0) {
      const T = N.map((h, U) => j[U] + (h.kind === "text" ? 0 : I(h.style.ml) + I(h.style.mr)));
      let g;
      N.length ? Ye(S) ? g = N.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || E.flex_wrap === "wrap" ? NaN : T.reduce((h, U) => h + U, 0) + I(E.gap_x) * (N.length - 1) : g = Math.max(...T) : g = 0, D = g + I(E.pl) + I(E.pr) + I(E.border_l) + I(E.border_r), typeof E.min_w == "number" && (D = Math.max(D, E.min_w)), typeof E.max_w == "number" && (D = Math.min(D, E.max_w));
    }
    return d.set(S, D), D;
  }
  const x = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, A = () => ({ exact: 0, laid: 0 }), H = (S, w) => {
    if (!Number.isFinite(w))
      return Object.assign(S, A()), NaN;
    S.exact += w;
    const z = Math.round(S.exact * i + 1e-9) / i, q = z - S.laid;
    return S.laid = z, q;
  }, k = (S) => Ye(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function b(S) {
    if (!S || S.kind === "text" || !Me(S)) return;
    const w = (S.children ?? []).filter(Je);
    if (k(S) && w.length > 1) {
      const z = I(S.style.gap_x), q = A(), E = !(z && w.some((N) => N.kind === "text"));
      c(S, { border_l: H(q, I(S.style.border_l)), pl: H(q, I(S.style.pl)) }), E && z && c(S, { gap_x: 0 }), w.forEach((N, j) => {
        const D = (j && E ? z : 0) + (N.kind === "text" ? 0 : I(N.style.ml));
        if (N.kind === "text")
          D && Object.assign(q, A());
        else {
          const U = H(q, D);
          Number.isFinite(U) && c(N, { ml: U });
        }
        const T = N.kind === "text" ? p.get(S) ?? {} : null, g = N.kind === "text" ? _(N, T, !!S.tabular) : d.get(N);
        if ((N.kind === "text" || !(N.style.flex_grow > 0)) && Number.isFinite(g) ? c(N, { w: H(q, g) }) : Object.assign(q, A()), N.kind !== "text") {
          const U = H(q, I(N.style.mr));
          Number.isFinite(U) && c(N, { mr: U });
        }
      });
    }
    for (const z of S.children ?? []) z.kind !== "text" && b(z);
  }
  for (const S of n)
    S && (_(S, {}, !1), b(S));
}
const lv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function iv(n, i, o) {
  const s = ["text_size", "font_weight", "font_family", "italic", "line_height"], c = (f) => typeof f == "number" ? f : 0, d = (f, _) => _ && Ai(_) && !Ye(_) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(_.style.items), p = (f, _, x, A) => {
    if (!f || f.kind === "text" || !Me(f)) return;
    const H = f.style;
    let k = typeof H.w == "number" ? H.w : H.w === "100%" ? x : d(f, _) ? x - c(H.ml) - c(H.mr) : NaN;
    typeof H.max_w == "number" && (k = Math.min(k, H.max_w));
    const b = k - c(H.pl) - c(H.pr) - c(H.border_l) - c(H.border_r), S = { ...A };
    for (const z of s) H[z] !== void 0 && (S[z] = H[z]);
    const w = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(b) && b > 0 && typeof S.text_size == "number" && w.length && w.every((z) => z.kind === "text")) {
      const z = { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic }, q = (j) => i(j.trimEnd(), z) <= b + 0.01;
      let E = 0;
      for (const j of w) {
        const D = [];
        for (const g of j.text.split(`
`)) {
          let h = "";
          for (const U of g.split(lv)) {
            if (q(h + U)) {
              h += U;
              continue;
            }
            h && D.push(h.trimEnd()), h = "";
            for (const J of U)
              h && !q(h + J) && (D.push(h), h = ""), h += J;
          }
          D.push(h.trimEnd());
        }
        const T = D.join(`
`);
        D.every((g) => !g || q(g)) ? T !== j.text && o.set(j, { ...o.get(j), text: T }) : E = NaN, E += D.length;
      }
      const N = tn(S);
      Number.isFinite(E) && N && H.h === void 0 && w.length === 1 && o.set(f, { ...o.get(f), h: E * N + c(H.pt) + c(H.pb) + c(H.border_t) + c(H.border_b) });
    }
    for (const z of w) p(z, f, Ye(f) ? NaN : b, S);
  };
  for (const f of n) p(f, null, NaN, {});
}
function rv(n, i) {
  const o = (s, c) => {
    if (!s || s.kind === "text" || !Me(s)) return;
    const d = s.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : c && typeof d.w != "number";
    if (p && Ye(s))
      for (const f of s.children ?? []) {
        const _ = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (_ === 0 || typeof _ == "string" && _.endsWith("%")) && i.set(f, { ...i.get(f), flex_basis: "auto" });
      }
    for (const f of s.children ?? []) o(f, p);
  };
  for (const s of n) o(s, !1);
}
function ov(n, i) {
  const o = i.heights ?? /* @__PURE__ */ new Map(), s = (f) => o.get(f), c = (f) => {
    const _ = f.style, x = (f.children ?? []).filter(Je);
    if (!x.length || Ye(f)) return NaN;
    let A = 0;
    for (const H of x) {
      const k = s(H);
      if (!Number.isFinite(k)) return NaN;
      A += k + (H.kind === "text" ? 0 : I(H.style.mt) + I(H.style.mb));
    }
    return A + (_.display === "flex" ? I(_.gap_y) * (x.length - 1) : 0) + I(_.pt) + I(_.pb);
  }, d = (f, _) => {
    const x = f.style;
    if (typeof x.h == "number") return x.h;
    if (typeof x.max_h == "number") return x.max_h;
    if (!_ || !Ai(_) || Ye(_)) return NaN;
    const A = _.style, H = typeof A.h == "number" ? A.h : typeof A.max_h == "number" ? A.max_h : NaN, k = (_.children ?? []).filter(Je);
    let b = 0;
    for (const w of k) {
      if (w === f) continue;
      const z = s(w);
      if (!Number.isFinite(z)) return NaN;
      b += z + (w.kind === "text" ? 0 : I(w.style.mt) + I(w.style.mb));
    }
    const S = A.display === "flex" ? I(A.gap_y) * Math.max(0, k.length - 1) : 0;
    return H - I(A.pt) - I(A.pb) - I(A.border_t) - I(A.border_b) - b - S - I(x.mt) - I(x.mb);
  }, p = (f, _) => {
    if (!(!f || f.kind === "text" || !Me(f))) {
      if (f.scrollbar > 0 && f.style.overflow_y === "scroll") {
        const x = c(f), A = d(f, _);
        Number.isFinite(x) && Number.isFinite(A) && x > A + 0.01 && i.set(f, { ...i.get(f), pr: I(f.style.pr) + f.scrollbar });
      }
      for (const x of f.children ?? []) p(x, f);
    }
  };
  for (const f of n) p(f, null);
}
const sv = ["text_size", "line_height", "whitespace", "text_ellipsis"], I = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ai = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ye = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Je = (n) => n.kind === "text" || Me(n) && n.style.position !== "absolute";
function cv(n, i) {
  const o = /* @__PURE__ */ new Map(), s = (w, z) => o.set(w, { ...o.get(w), ...Object.fromEntries(Object.entries(z).filter(([, q]) => Number.isFinite(q))) }), c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(w, z) {
    if (w.kind === "text") return z.whitespace === "nowrap" || Cm.test(w.text) ? tn(z) ?? NaN : NaN;
    const q = { ...z };
    for (const T of sv) w.style[T] !== void 0 && (q[T] = w.style[T]);
    d.set(w, q);
    const E = w.style, N = (w.children ?? []).filter(Je), j = N.map((T) => p(T, q));
    let D;
    if (E.h !== void 0 && E.h !== "auto") D = I(E.h);
    else if (w.kind === "input")
      D = (w.input_type === "textarea" || w.input_type === "select" ? NaN : tn(q) ?? NaN) + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (D = Math.max(D, I(E.min_h)));
    else {
      const T = N.map((h, U) => (h.kind === "text" ? 0 : I(h.style.mt) + I(h.style.mb)) + j[U]);
      let g;
      if (Ye(w)) g = E.flex_wrap === "wrap" ? NaN : E.items === "baseline" ? _(N, j, q) : Math.max(0, ...T);
      else if (Ai(w)) {
        const h = N.some((J) => J.kind !== "text" && (J.style.flex_grow > 0 || J.style.flex_basis !== void 0)), U = E.display !== "flex" && N.some((J) => J.kind !== "text" && (I(J.style.mt) || I(J.style.mb)));
        g = h || U ? NaN : T.reduce((J, at) => J + at, 0) + (E.display === "flex" ? I(E.gap_y) * Math.max(0, N.length - 1) : 0);
      } else g = NaN;
      D = g + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (D = Math.max(D, I(E.min_h))), E.max_h !== void 0 && (D = Math.min(D, I(E.max_h)));
    }
    return c.set(w, D), D;
  }
  const f = (w) => (tn(w) - (Ci + Id) * w.text_size) / 2 + Ci * w.text_size;
  function _(w, z, q) {
    let E = 0, N = 0;
    for (const [j, D] of w.entries()) {
      const T = D.kind === "text" ? q : d.get(D);
      if (!(D.kind === "text" || (D.children ?? []).filter(Je).every((J) => J.kind === "text")) || !Number.isFinite(z[j]) || typeof T.text_size != "number") return NaN;
      const h = D.kind === "text" ? {} : D.style, U = I(h.mt) + I(h.border_t) + I(h.pt) + f(T);
      E = Math.max(E, U), N = Math.max(N, I(h.mt) + z[j] + I(h.mb) - U);
    }
    return E + N;
  }
  const x = () => ({ exact: 0, laid: 0 }), A = (w, z) => {
    if (!Number.isFinite(z))
      return Object.assign(w, x()), NaN;
    w.exact += z;
    const q = Math.round(w.exact * i + 1e-9) / i, E = q - w.laid;
    return w.laid = q, E;
  };
  function H(w) {
    if (!(w.kind === "text" || !Me(w))) {
      for (const z of (w.children ?? []).filter((q) => q.kind !== "text" && Me(q) && q.style.position === "absolute")) H(z);
      if (Ai(w) && !Ye(w)) {
        const z = x();
        s(w, { border_t: A(z, I(w.style.border_t)), pt: A(z, I(w.style.pt)) }), k(w, z);
      } else for (const z of (w.children ?? []).filter(Je)) z.kind !== "text" && H(z);
    }
  }
  function k(w, z) {
    const q = (w.children ?? []).filter(Je), E = w.style.display === "flex" ? I(w.style.gap_y) : 0;
    if (E && q.some((N) => N.kind === "text")) {
      for (const N of q) N.kind !== "text" && H(N);
      return !1;
    }
    return E && s(w, { gap_y: 0 }), q.forEach((N, j) => {
      if (N.kind === "text") {
        const D = c.get(N) ?? p(N, d.get(w) ?? {});
        Number.isFinite(D) ? s(N, { h: A(z, D) }) : Object.assign(z, x());
        return;
      }
      if (s(N, { mt: A(z, (j ? E : 0) + I(N.style.mt)) }), Number.isFinite(c.get(N))) S(N, z);
      else if (b(N)) {
        const D = N.style;
        s(N, { border_t: A(z, I(D.border_t)), pt: A(z, I(D.pt)) }), s(N, { pb: A(z, I(D.pb)), border_b: A(z, I(D.border_b)) });
      } else
        H(N), Object.assign(z, x());
      s(N, { mb: A(z, I(N.style.mb)) });
    }), !0;
  }
  function b(w) {
    const z = w.style, q = (w.children ?? []).filter(Je), E = tn(d.get(w) ?? {});
    return w.kind === "div" && !Ye(w) && q.length > 0 && q.every((N) => N.kind === "text") && Number.isInteger(E) && [z.h, z.min_h, z.max_h].every((N) => N === void 0 || N === "auto");
  }
  function S(w, z) {
    const q = w.style;
    for (const T of (w.children ?? []).filter((g) => g.kind !== "text" && Me(g) && g.style.position === "absolute")) H(T);
    const E = z.laid, N = z.exact;
    s(w, { border_t: A(z, I(q.border_t)), pt: A(z, I(q.pt)) });
    const j = q.h !== void 0 && q.h !== "auto", D = c.get(w) - I(q.pt) - I(q.pb) - I(q.border_t) - I(q.border_b);
    if (w.kind === "input")
      j || A(z, D);
    else if (Ye(w) || j && (q.justify ?? "start") !== "start") {
      for (const T of (w.children ?? []).filter(Je)) T.kind !== "text" && H(T);
      j || A(z, D);
    } else !k(w, z) && !j && A(z, D);
    if (j) {
      z.exact = N + c.get(w), z.laid = Math.round(z.exact * i + 1e-9) / i, s(w, { h: z.laid - E });
      return;
    }
    s(w, { pb: A(z, I(q.pb)), border_b: A(z, I(q.border_b)) }), s(w, { h: z.laid - E });
  }
  for (const w of n)
    p(w, {}), H(w);
  return Object.defineProperty(o, "heights", { value: c }), o;
}
const bv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }] };
export {
  bv as NAMED_ELEMENTS,
  uv as React,
  Zh as SCHEMA,
  hv as STYLE_KEYS,
  gv as describeToGpui,
  dv as jsxRuntime,
  mv as mount,
  fv as reactDom,
  pv as sdk
};
