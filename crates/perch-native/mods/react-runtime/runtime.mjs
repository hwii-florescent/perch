function Od(n, i) {
  for (var o = 0; o < i.length; o++) {
    const s = i[o];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const u in s)
        if (u !== "default" && !(u in n)) {
          const d = Object.getOwnPropertyDescriptor(s, u);
          d && Object.defineProperty(n, u, d.get ? d : {
            enumerable: !0,
            get: () => s[u]
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
const Lp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Wp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), Fp = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Lp]);
function No(n) {
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
  return [No(n.slice(i, o)), o];
}
function Ip(n, i) {
  let o = 1;
  for (let s = i; s < n.length; s++) {
    const u = n[s];
    if (u === "\\") {
      s++;
      continue;
    }
    if (u === '"' || u === "'") {
      if (s = n.indexOf(u, s + 1), s < 0) break;
      continue;
    }
    if (u === "(") o++;
    else if (u === ")" && --o === 0) return s;
  }
  throw new Se(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Yo(n) {
  const i = [];
  let o = 0, s = 0;
  for (let u = 0; u < n.length; u++) {
    const d = n[u];
    if (d === "\\") {
      u++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (u = n.indexOf(d, u + 1), u < 0) break;
      continue;
    }
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (i.push(n.slice(s, u).trim()), s = u + 1);
  }
  return i.push(n.slice(s).trim()), i.filter(Boolean);
}
function $p(n, i) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let s = !1;
  for (; i < n.length; ) {
    const u = n[i];
    if (u === "*") {
      o.tag = "*", i++, s = !0;
      continue;
    }
    if (u === ".") {
      const [d, p] = pi(n, i + 1);
      o.classes.push(d), i = p, s = !0;
      continue;
    }
    if (u === "#") {
      const [d, p] = pi(n, i + 1);
      o.id = d, i = p, s = !0;
      continue;
    }
    if (u === "[") {
      const d = n.indexOf("]", i);
      if (d < 0) throw new Se(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(i + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!f) throw new Se(`cannot read the attribute selector [${p}]`);
      const _ = f[3] ?? f[4] ?? f[5];
      o.attrs.push({ name: No(f[1]).toLowerCase(), op: f[2] ?? null, value: _ === void 0 ? null : No(_) }), i = d + 1, s = !0;
      continue;
    }
    if (u === ":") {
      if (n[i + 1] === ":") throw new Se(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = pi(n, i + 1);
      i = p;
      const f = d.toLowerCase();
      if (n[i] === "(") {
        if (!Wp.has(f)) throw new Se(`:${f}() is not supported`);
        const _ = Ip(n, i + 1), w = n.slice(i + 1, _).trim();
        if (i = _ + 1, f === "nth-child") {
          if (!/^\d+$/.test(w)) throw new Se(`:nth-child(${w}) is not supported (only a number)`);
          o.pseudos.push({ name: f, n: Number(w) });
        } else
          o.pseudos.push({ name: f, list: Yo(w).map(Go) });
      } else {
        if (!Fp.has(f)) throw new Se(`:${f} is not supported`);
        o.pseudos.push({ name: f });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(u) && !s) {
      const [d, p] = pi(n, i);
      o.tag = d.toLowerCase(), i = p, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new Se(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [o, i];
}
function Go(n) {
  const i = [];
  let o = 0, s = null;
  for (n = n.trim(); o < n.length; ) {
    const [u, d] = $p(n, o);
    i.push({ compound: u, combinator: s }), o = d;
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
const Xu = /* @__PURE__ */ new Map();
function Mi(n) {
  let i = Xu.get(n);
  return i || (i = Yo(n).map(Go), Xu.set(n, i)), i;
}
function Rd(n) {
  const i = [0, 0, 0], o = (s) => {
    i[0] += s[0], i[1] += s[1], i[2] += s[2];
  };
  for (const { compound: s } of n) {
    s.id && i[0]++, i[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && i[2]++;
    for (const u of s.pseudos)
      if (u.name !== "where")
        if (u.list) {
          const d = u.list.map(Rd).sort((p, f) => f[0] - p[0] || f[1] - p[1] || f[2] - p[2])[0];
          o(d);
        } else i[1]++;
  }
  return i;
}
function Pp(n, { name: i, op: o, value: s }) {
  const u = n.getAttribute(i);
  if (u == null) return !1;
  if (o === null) return !0;
  switch (o) {
    case "=":
      return u === s;
    case "^=":
      return s !== "" && u.startsWith(s);
    case "$=":
      return s !== "" && u.endsWith(s);
    case "*=":
      return s !== "" && u.includes(s);
    case "~=":
      return u.split(/\s+/).includes(s);
    case "|=":
      return u === s || u.startsWith(`${s}-`);
    default:
      return !1;
  }
}
function hi(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function th(n, i, o, s) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const u = n.classList ?? [];
    for (const d of i.classes) if (!u.includes(d)) return !1;
  }
  for (const u of i.attrs) if (!Pp(n, u)) return !1;
  for (const u of i.pseudos)
    switch (u.name) {
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
        if (hi(n).indexOf(n) !== u.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (u.list.some((d) => An(n, d, o, s))) return !1;
        break;
      case "is":
      case "where":
        if (!u.list.some((d) => An(n, d, o, s))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, u.name, s)) return !1;
    }
  return !0;
}
function An(n, i, o, s = !0) {
  const u = (d, p, f) => {
    const { compound: _, combinator: w } = i[p];
    if (!th(d, _, o, f)) return !1;
    if (p === 0) return !0;
    if (w === ">") return !!d.parentElement && u(d.parentElement, p - 1, !1);
    for (let R = d.parentElement; R; R = R.parentElement) if (u(R, p - 1, !1)) return !0;
    return !1;
  };
  return u(n, i.length - 1, s);
}
function eh(n, i, o = {}) {
  return (typeof i == "string" ? Mi(i) : i).some((u) => An(n, u, o));
}
function Hd(n, i, o = {}) {
  return An(n, i, o);
}
function fl(n, i, o = {}) {
  const s = Mi(i), u = [], d = (p) => {
    for (const f of p.children)
      s.some((_) => An(f, _, o)) && u.push(f), d(f);
  };
  return d(n), u;
}
function Dd(n, i, o = {}) {
  const s = Mi(i);
  for (let u = n; u; u = u.parentElement) if (s.some((d) => An(u, d, o))) return u;
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
let ah = 1;
class To {
  constructor(i = 0, o = 0, s = 0, u = 0) {
    this.x = i, this.y = o, this.width = s, this.height = u;
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
class Qo {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, o, s) {
    const u = s === !0 || !!s?.capture;
    this.listeners.some((d) => d.type === i && d.listener === o && d.capture === u) || this.listeners.push({ type: i, listener: o, capture: u });
  }
  removeEventListener(i, o, s) {
    const u = s === !0 || !!s?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === i && d.listener === o && d.capture === u));
  }
}
class Ko {
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
class ze extends Qo {
  constructor(i, o = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${ah++}`, this.tagName = i.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof ze ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((i) => i instanceof ze);
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
      o.startsWith("data-") && s != null && s !== !1 && (i[o.slice(5).replace(/-([a-z])/g, (u, d) => d.toUpperCase())] = String(s));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const o = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return o.id != null ? String(o.id) : null;
    if (i === "style") return null;
    let u = o[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (u === void 0 && !i.includes("-")) {
      const d = i.replace(/-([a-z])/g, (p, f) => f.toUpperCase());
      u = o[d];
    }
    return u == null || typeof u == "function" ? null : typeof u == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(u) : u ? "" : null : String(u);
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
    return eh(this, i);
  }
  closest(i) {
    return Dd(this, i);
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
    return i ? new To(i.x, i.y, i.width, i.height) : new To();
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
class nh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class lh {
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
function Zu(n) {
  for (let i = n; i instanceof ze; i = i.parentElement) i.touch();
}
class ih extends Qo {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new ze("html", {}, this), this.body = new ze("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new ze(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Zu(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, Zu(i), this.activeElement === i && (this.activeElement = this.body);
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
class rh extends Qo {
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
function Ud(n) {
  return {
    setTimeout: (i, o = 0, ...s) => n.setTimeout(() => i(...s), Math.max(0, Number(o) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
const Ju = Symbol.for("perch.react.globals");
function qe(n, i, o) {
  Object.defineProperty(n, i, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function oh(n, i = globalThis) {
  const o = new ih(n), s = new rh(n, o);
  o.defaultView = s;
  const u = n.storage ?? new lh();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = Ud(n);
    qe(i, "setTimeout", f.setTimeout), qe(i, "clearTimeout", f.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && qe(i, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), qe(i, "requestAnimationFrame", (f) => i.setTimeout(() => f(Date.now()), 0)), qe(i, "cancelAnimationFrame", (f) => i.clearTimeout(f));
  const d = { document: o, window: s, localStorage: u };
  for (const f of Object.keys(d))
    Object.defineProperty(i, f, { get: () => i[Ju]?.[f], configurable: !0, enumerable: !1 });
  i[Ju] = d, qe(i, "HTMLElement", ze), qe(i, "Element", ze), qe(i, "DOMRect", To), typeof i.ResizeObserver != "function" && qe(i, "ResizeObserver", nh);
  const p = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      qe(p, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || qe(i, "navigator", p), { document: o, window: s, globals: d };
}
function Co(n, i = !1) {
  if (!(i ? n?.tagName === "input" && Bd(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let s = n.parentElement; s; s = s.parentElement) if (s.tagName === "form") return s;
  return null;
}
const Bd = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Lu = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Lu?.setTimeout == "function") {
  const n = Ud(Lu);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Vo(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var yo = { exports: {} }, ct = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Wu;
function sh() {
  if (Wu) return ct;
  Wu = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), u = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), _ = Symbol.for("react.suspense"), w = Symbol.for("react.memo"), R = Symbol.for("react.lazy"), H = Symbol.for("react.activity"), S = Symbol.iterator;
  function y(b) {
    return b === null || typeof b != "object" ? null : (b = S && b[S] || b["@@iterator"], typeof b == "function" ? b : null);
  }
  var z = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, x = Object.assign, k = {};
  function Y(b, q, tt) {
    this.props = b, this.context = q, this.refs = k, this.updater = tt || z;
  }
  Y.prototype.isReactComponent = {}, Y.prototype.setState = function(b, q) {
    if (typeof b != "object" && typeof b != "function" && b != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, b, q, "setState");
  }, Y.prototype.forceUpdate = function(b) {
    this.updater.enqueueForceUpdate(this, b, "forceUpdate");
  };
  function E() {
  }
  E.prototype = Y.prototype;
  function N(b, q, tt) {
    this.props = b, this.context = q, this.refs = k, this.updater = tt || z;
  }
  var M = N.prototype = new E();
  M.constructor = N, x(M, Y.prototype), M.isPureReactComponent = !0;
  var D = Array.isArray;
  function C() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function G(b, q, tt) {
    var $ = tt.ref;
    return {
      $$typeof: n,
      type: b,
      key: q,
      ref: $ !== void 0 ? $ : null,
      props: tt
    };
  }
  function J(b, q) {
    return G(b.type, q, b.props);
  }
  function at(b) {
    return typeof b == "object" && b !== null && b.$$typeof === n;
  }
  function ot(b) {
    var q = { "=": "=0", ":": "=2" };
    return "$" + b.replace(/[=:]/g, function(tt) {
      return q[tt];
    });
  }
  var jt = /\/+/g;
  function Kt(b, q) {
    return typeof b == "object" && b !== null && b.key != null ? ot("" + b.key) : q.toString(36);
  }
  function Nt(b) {
    switch (b.status) {
      case "fulfilled":
        return b.value;
      case "rejected":
        throw b.reason;
      default:
        switch (typeof b.status == "string" ? b.then(C, C) : (b.status = "pending", b.then(
          function(q) {
            b.status === "pending" && (b.status = "fulfilled", b.value = q);
          },
          function(q) {
            b.status === "pending" && (b.status = "rejected", b.reason = q);
          }
        )), b.status) {
          case "fulfilled":
            return b.value;
          case "rejected":
            throw b.reason;
        }
    }
    throw b;
  }
  function K(b, q, tt, $, P) {
    var lt = typeof b;
    (lt === "undefined" || lt === "boolean") && (b = null);
    var xt = !1;
    if (b === null) xt = !0;
    else
      switch (lt) {
        case "bigint":
        case "string":
        case "number":
          xt = !0;
          break;
        case "object":
          switch (b.$$typeof) {
            case n:
            case i:
              xt = !0;
              break;
            case R:
              return xt = b._init, K(
                xt(b._payload),
                q,
                tt,
                $,
                P
              );
          }
      }
    if (xt)
      return P = P(b), xt = $ === "" ? "." + Kt(b, 0) : $, D(P) ? (tt = "", xt != null && (tt = xt.replace(jt, "$&/") + "/"), K(P, q, tt, "", function(Oa) {
        return Oa;
      })) : P != null && (at(P) && (P = J(
        P,
        tt + (P.key == null || b && b.key === P.key ? "" : ("" + P.key).replace(
          jt,
          "$&/"
        ) + "/") + xt
      )), q.push(P)), 1;
    xt = 0;
    var Jt = $ === "" ? "." : $ + ":";
    if (D(b))
      for (var ut = 0; ut < b.length; ut++)
        $ = b[ut], lt = Jt + Kt($, ut), xt += K(
          $,
          q,
          tt,
          lt,
          P
        );
    else if (ut = y(b), typeof ut == "function")
      for (b = ut.call(b), ut = 0; !($ = b.next()).done; )
        $ = $.value, lt = Jt + Kt($, ut++), xt += K(
          $,
          q,
          tt,
          lt,
          P
        );
    else if (lt === "object") {
      if (typeof b.then == "function")
        return K(
          Nt(b),
          q,
          tt,
          $,
          P
        );
      throw q = String(b), Error(
        "Objects are not valid as a React child (found: " + (q === "[object Object]" ? "object with keys {" + Object.keys(b).join(", ") + "}" : q) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return xt;
  }
  function et(b, q, tt) {
    if (b == null) return b;
    var $ = [], P = 0;
    return K(b, $, "", "", function(lt) {
      return q.call(tt, lt, P++);
    }), $;
  }
  function nt(b) {
    if (b._status === -1) {
      var q = b._result;
      q = q(), q.then(
        function(tt) {
          (b._status === 0 || b._status === -1) && (b._status = 1, b._result = tt);
        },
        function(tt) {
          (b._status === 0 || b._status === -1) && (b._status = 2, b._result = tt);
        }
      ), b._status === -1 && (b._status = 0, b._result = q);
    }
    if (b._status === 1) return b._result.default;
    throw b._result;
  }
  var U = typeof reportError == "function" ? reportError : function(b) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var q = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof b == "object" && b !== null && typeof b.message == "string" ? String(b.message) : String(b),
        error: b
      });
      if (!window.dispatchEvent(q)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", b);
      return;
    }
    console.error(b);
  }, B = {
    map: et,
    forEach: function(b, q, tt) {
      et(
        b,
        function() {
          q.apply(this, arguments);
        },
        tt
      );
    },
    count: function(b) {
      var q = 0;
      return et(b, function() {
        q++;
      }), q;
    },
    toArray: function(b) {
      return et(b, function(q) {
        return q;
      }) || [];
    },
    only: function(b) {
      if (!at(b))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return b;
    }
  };
  return ct.Activity = H, ct.Children = B, ct.Component = Y, ct.Fragment = o, ct.Profiler = u, ct.PureComponent = N, ct.StrictMode = s, ct.Suspense = _, ct.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, ct.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(b) {
      return g.H.useMemoCache(b);
    }
  }, ct.cache = function(b) {
    return function() {
      return b.apply(null, arguments);
    };
  }, ct.cacheSignal = function() {
    return null;
  }, ct.cloneElement = function(b, q, tt) {
    if (b == null)
      throw Error(
        "The argument must be a React element, but you passed " + b + "."
      );
    var $ = x({}, b.props), P = b.key;
    if (q != null)
      for (lt in q.key !== void 0 && (P = "" + q.key), q)
        !h.call(q, lt) || lt === "key" || lt === "__self" || lt === "__source" || lt === "ref" && q.ref === void 0 || ($[lt] = q[lt]);
    var lt = arguments.length - 2;
    if (lt === 1) $.children = tt;
    else if (1 < lt) {
      for (var xt = Array(lt), Jt = 0; Jt < lt; Jt++)
        xt[Jt] = arguments[Jt + 2];
      $.children = xt;
    }
    return G(b.type, P, $);
  }, ct.createContext = function(b) {
    return b = {
      $$typeof: p,
      _currentValue: b,
      _currentValue2: b,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, b.Provider = b, b.Consumer = {
      $$typeof: d,
      _context: b
    }, b;
  }, ct.createElement = function(b, q, tt) {
    var $, P = {}, lt = null;
    if (q != null)
      for ($ in q.key !== void 0 && (lt = "" + q.key), q)
        h.call(q, $) && $ !== "key" && $ !== "__self" && $ !== "__source" && (P[$] = q[$]);
    var xt = arguments.length - 2;
    if (xt === 1) P.children = tt;
    else if (1 < xt) {
      for (var Jt = Array(xt), ut = 0; ut < xt; ut++)
        Jt[ut] = arguments[ut + 2];
      P.children = Jt;
    }
    if (b && b.defaultProps)
      for ($ in xt = b.defaultProps, xt)
        P[$] === void 0 && (P[$] = xt[$]);
    return G(b, lt, P);
  }, ct.createRef = function() {
    return { current: null };
  }, ct.forwardRef = function(b) {
    return { $$typeof: f, render: b };
  }, ct.isValidElement = at, ct.lazy = function(b) {
    return {
      $$typeof: R,
      _payload: { _status: -1, _result: b },
      _init: nt
    };
  }, ct.memo = function(b, q) {
    return {
      $$typeof: w,
      type: b,
      compare: q === void 0 ? null : q
    };
  }, ct.startTransition = function(b) {
    var q = g.T, tt = {};
    g.T = tt;
    try {
      var $ = b(), P = g.S;
      P !== null && P(tt, $), typeof $ == "object" && $ !== null && typeof $.then == "function" && $.then(C, U);
    } catch (lt) {
      U(lt);
    } finally {
      q !== null && tt.types !== null && (q.types = tt.types), g.T = q;
    }
  }, ct.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, ct.use = function(b) {
    return g.H.use(b);
  }, ct.useActionState = function(b, q, tt) {
    return g.H.useActionState(b, q, tt);
  }, ct.useCallback = function(b, q) {
    return g.H.useCallback(b, q);
  }, ct.useContext = function(b) {
    return g.H.useContext(b);
  }, ct.useDebugValue = function() {
  }, ct.useDeferredValue = function(b, q) {
    return g.H.useDeferredValue(b, q);
  }, ct.useEffect = function(b, q) {
    return g.H.useEffect(b, q);
  }, ct.useEffectEvent = function(b) {
    return g.H.useEffectEvent(b);
  }, ct.useId = function() {
    return g.H.useId();
  }, ct.useImperativeHandle = function(b, q, tt) {
    return g.H.useImperativeHandle(b, q, tt);
  }, ct.useInsertionEffect = function(b, q) {
    return g.H.useInsertionEffect(b, q);
  }, ct.useLayoutEffect = function(b, q) {
    return g.H.useLayoutEffect(b, q);
  }, ct.useMemo = function(b, q) {
    return g.H.useMemo(b, q);
  }, ct.useOptimistic = function(b, q) {
    return g.H.useOptimistic(b, q);
  }, ct.useReducer = function(b, q, tt) {
    return g.H.useReducer(b, q, tt);
  }, ct.useRef = function(b) {
    return g.H.useRef(b);
  }, ct.useState = function(b) {
    return g.H.useState(b);
  }, ct.useSyncExternalStore = function(b, q, tt) {
    return g.H.useSyncExternalStore(
      b,
      q,
      tt
    );
  }, ct.useTransition = function() {
    return g.H.useTransition();
  }, ct.version = "19.2.8", ct;
}
var Fu;
function qd() {
  return Fu || (Fu = 1, yo.exports = sh()), yo.exports;
}
var ft = qd();
const ch = /* @__PURE__ */ Vo(ft), ev = /* @__PURE__ */ Od({
  __proto__: null,
  default: ch
}, [ft]);
var xo = { exports: {} }, ul = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Iu;
function uh() {
  if (Iu) return ul;
  Iu = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function o(s, u, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), u.key !== void 0 && (p = "" + u.key), "key" in u) {
      d = {};
      for (var f in u)
        f !== "key" && (d[f] = u[f]);
    } else d = u;
    return u = d.ref, {
      $$typeof: n,
      type: s,
      key: p,
      ref: u !== void 0 ? u : null,
      props: d
    };
  }
  return ul.Fragment = i, ul.jsx = o, ul.jsxs = o, ul;
}
var $u;
function dh() {
  return $u || ($u = 1, xo.exports = uh()), xo.exports;
}
var zt = dh();
const mh = /* @__PURE__ */ Vo(zt), av = /* @__PURE__ */ Od({
  __proto__: null,
  default: mh
}, [zt]);
var wo = { exports: {} }, _o = { exports: {} }, So = { exports: {} }, zo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Pu;
function fh() {
  return Pu || (Pu = 1, (function(n) {
    function i(K, et) {
      var nt = K.length;
      K.push(et);
      t: for (; 0 < nt; ) {
        var U = nt - 1 >>> 1, B = K[U];
        if (0 < u(B, et))
          K[U] = et, K[nt] = B, nt = U;
        else break t;
      }
    }
    function o(K) {
      return K.length === 0 ? null : K[0];
    }
    function s(K) {
      if (K.length === 0) return null;
      var et = K[0], nt = K.pop();
      if (nt !== et) {
        K[0] = nt;
        t: for (var U = 0, B = K.length, b = B >>> 1; U < b; ) {
          var q = 2 * (U + 1) - 1, tt = K[q], $ = q + 1, P = K[$];
          if (0 > u(tt, nt))
            $ < B && 0 > u(P, tt) ? (K[U] = P, K[$] = nt, U = $) : (K[U] = tt, K[q] = nt, U = q);
          else if ($ < B && 0 > u(P, nt))
            K[U] = P, K[$] = nt, U = $;
          else break t;
        }
      }
      return et;
    }
    function u(K, et) {
      var nt = K.sortIndex - et.sortIndex;
      return nt !== 0 ? nt : K.id - et.id;
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
    var _ = [], w = [], R = 1, H = null, S = 3, y = !1, z = !1, x = !1, k = !1, Y = typeof setTimeout == "function" ? setTimeout : null, E = typeof clearTimeout == "function" ? clearTimeout : null, N = typeof setImmediate < "u" ? setImmediate : null;
    function M(K) {
      for (var et = o(w); et !== null; ) {
        if (et.callback === null) s(w);
        else if (et.startTime <= K)
          s(w), et.sortIndex = et.expirationTime, i(_, et);
        else break;
        et = o(w);
      }
    }
    function D(K) {
      if (x = !1, M(K), !z)
        if (o(_) !== null)
          z = !0, C || (C = !0, ot());
        else {
          var et = o(w);
          et !== null && Nt(D, et.startTime - K);
        }
    }
    var C = !1, g = -1, h = 5, G = -1;
    function J() {
      return k ? !0 : !(n.unstable_now() - G < h);
    }
    function at() {
      if (k = !1, C) {
        var K = n.unstable_now();
        G = K;
        var et = !0;
        try {
          t: {
            z = !1, x && (x = !1, E(g), g = -1), y = !0;
            var nt = S;
            try {
              e: {
                for (M(K), H = o(_); H !== null && !(H.expirationTime > K && J()); ) {
                  var U = H.callback;
                  if (typeof U == "function") {
                    H.callback = null, S = H.priorityLevel;
                    var B = U(
                      H.expirationTime <= K
                    );
                    if (K = n.unstable_now(), typeof B == "function") {
                      H.callback = B, M(K), et = !0;
                      break e;
                    }
                    H === o(_) && s(_), M(K);
                  } else s(_);
                  H = o(_);
                }
                if (H !== null) et = !0;
                else {
                  var b = o(w);
                  b !== null && Nt(
                    D,
                    b.startTime - K
                  ), et = !1;
                }
              }
              break t;
            } finally {
              H = null, S = nt, y = !1;
            }
            et = void 0;
          }
        } finally {
          et ? ot() : C = !1;
        }
      }
    }
    var ot;
    if (typeof N == "function")
      ot = function() {
        N(at);
      };
    else if (typeof MessageChannel < "u") {
      var jt = new MessageChannel(), Kt = jt.port2;
      jt.port1.onmessage = at, ot = function() {
        Kt.postMessage(null);
      };
    } else
      ot = function() {
        Y(at, 0);
      };
    function Nt(K, et) {
      g = Y(function() {
        K(n.unstable_now());
      }, et);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(K) {
      K.callback = null;
    }, n.unstable_forceFrameRate = function(K) {
      0 > K || 125 < K ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < K ? Math.floor(1e3 / K) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return S;
    }, n.unstable_next = function(K) {
      switch (S) {
        case 1:
        case 2:
        case 3:
          var et = 3;
          break;
        default:
          et = S;
      }
      var nt = S;
      S = et;
      try {
        return K();
      } finally {
        S = nt;
      }
    }, n.unstable_requestPaint = function() {
      k = !0;
    }, n.unstable_runWithPriority = function(K, et) {
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
      var nt = S;
      S = K;
      try {
        return et();
      } finally {
        S = nt;
      }
    }, n.unstable_scheduleCallback = function(K, et, nt) {
      var U = n.unstable_now();
      switch (typeof nt == "object" && nt !== null ? (nt = nt.delay, nt = typeof nt == "number" && 0 < nt ? U + nt : U) : nt = U, K) {
        case 1:
          var B = -1;
          break;
        case 2:
          B = 250;
          break;
        case 5:
          B = 1073741823;
          break;
        case 4:
          B = 1e4;
          break;
        default:
          B = 5e3;
      }
      return B = nt + B, K = {
        id: R++,
        callback: et,
        priorityLevel: K,
        startTime: nt,
        expirationTime: B,
        sortIndex: -1
      }, nt > U ? (K.sortIndex = nt, i(w, K), o(_) === null && K === o(w) && (x ? (E(g), g = -1) : x = !0, Nt(D, nt - U))) : (K.sortIndex = B, i(_, K), z || y || (z = !0, C || (C = !0, ot()))), K;
    }, n.unstable_shouldYield = J, n.unstable_wrapCallback = function(K) {
      var et = S;
      return function() {
        var nt = S;
        S = et;
        try {
          return K.apply(this, arguments);
        } finally {
          S = nt;
        }
      };
    };
  })(zo)), zo;
}
var td;
function ph() {
  return td || (td = 1, So.exports = fh()), So.exports;
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
var ed;
function hh() {
  return ed || (ed = 1, (function(n) {
    n.exports = function(i) {
      function o(t, e, a, l) {
        return new $m(t, e, a, l);
      }
      function s() {
      }
      function u(t) {
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
          throw Error(u(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(u(188));
          return e !== t ? null : t;
        }
        for (var a = t, l = e; ; ) {
          var r = a.return;
          if (r === null) break;
          var c = r.alternate;
          if (c === null) {
            if (l = r.return, l !== null) {
              a = l;
              continue;
            }
            break;
          }
          if (r.child === c.child) {
            for (c = r.child; c; ) {
              if (c === a) return p(r), t;
              if (c === l) return p(r), e;
              c = c.sibling;
            }
            throw Error(u(188));
          }
          if (a.return !== l.return) a = r, l = c;
          else {
            for (var m = !1, v = r.child; v; ) {
              if (v === a) {
                m = !0, a = r, l = c;
                break;
              }
              if (v === l) {
                m = !0, l = r, a = c;
                break;
              }
              v = v.sibling;
            }
            if (!m) {
              for (v = c.child; v; ) {
                if (v === a) {
                  m = !0, a = c, l = r;
                  break;
                }
                if (v === l) {
                  m = !0, l = c, a = r;
                  break;
                }
                v = v.sibling;
              }
              if (!m) throw Error(u(189));
            }
          }
          if (a.alternate !== l) throw Error(u(190));
        }
        if (a.tag !== 3) throw Error(u(188));
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
      function w(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = w(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function R(t) {
        return t === null || typeof t != "object" ? null : (t = uu && t[uu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function H(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === nf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case dn:
            return "Fragment";
          case Br:
            return "Profiler";
          case su:
            return "StrictMode";
          case Yr:
            return "Suspense";
          case Gr:
            return "SuspenseList";
          case Kr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case un:
              return "Portal";
            case va:
              return t.displayName || "Context";
            case cu:
              return (t._context.displayName || "Context") + ".Consumer";
            case qr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Qr:
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
      function S(t) {
        return { current: t };
      }
      function y(t) {
        0 > pn || (t.current = Wr[pn], Wr[pn] = null, pn--);
      }
      function z(t, e) {
        pn++, Wr[pn] = t.current, t.current = e;
      }
      function x(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Ap(t) / Op | 0) | 0;
      }
      function k(t) {
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
      function Y(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, c = t.suspendedLanes, m = t.pingedLanes;
        t = t.warmLanes;
        var v = l & 134217727;
        return v !== 0 ? (l = v & ~c, l !== 0 ? r = k(l) : (m &= v, m !== 0 ? r = k(m) : a || (a = v & ~t, a !== 0 && (r = k(a))))) : (v = l & ~c, v !== 0 ? r = k(v) : m !== 0 ? r = k(m) : a || (a = l & ~t, a !== 0 && (r = k(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & c) === 0 && (c = r & -r, a = e & -e, c >= a || c === 32 && (a & 4194048) !== 0) ? e : r;
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
      function M() {
        var t = Wl;
        return Wl <<= 1, (Wl & 62914560) === 0 && (Wl = 4194304), t;
      }
      function D(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function C(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, a, l, r, c) {
        var m = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var v = t.entanglements, O = t.expirationTimes, Q = t.hiddenUpdates;
        for (a = m & ~a; 0 < a; ) {
          var Z = 31 - ge(a), V = 1 << Z;
          v[Z] = 0, O[Z] = -1;
          var L = Q[Z];
          if (L !== null)
            for (Q[Z] = null, Z = 0; Z < L.length; Z++) {
              var dt = L[Z];
              dt !== null && (dt.lane &= -536870913);
            }
          a &= ~V;
        }
        l !== 0 && h(t, l, 0), c !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= c & ~(m & ~e));
      }
      function h(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var l = 31 - ge(e);
        t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | a & 261930;
      }
      function G(t, e) {
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
      function ot(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function jt(t) {
        if (typeof Bp == "function" && qp(t), be && typeof be.setStrictMode == "function")
          try {
            be.setStrictMode($n, t);
          } catch {
          }
      }
      function Kt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Nt(t) {
        if ($r === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            $r = e && e[1] || "", Du = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + $r + t + Du;
      }
      function K(t, e) {
        if (!t || Pr) return "";
        Pr = !0;
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
                    } catch (dt) {
                      var L = dt;
                    }
                    Reflect.construct(t, [], V);
                  } else {
                    try {
                      V.call();
                    } catch (dt) {
                      L = dt;
                    }
                    t.call(V.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (dt) {
                    L = dt;
                  }
                  (V = t()) && typeof V.catch == "function" && V.catch(function() {
                  });
                }
              } catch (dt) {
                if (dt && L && typeof dt.stack == "string")
                  return [dt.stack, L.stack];
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
          var c = l.DetermineComponentFrameRoot(), m = c[0], v = c[1];
          if (m && v) {
            var O = m.split(`
`), Q = v.split(`
`);
            for (r = l = 0; l < O.length && !O[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < Q.length && !Q[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === O.length || r === Q.length)
              for (l = O.length - 1, r = Q.length - 1; 1 <= l && 0 <= r && O[l] !== Q[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (O[l] !== Q[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || O[l] !== Q[r]) {
                      var Z = `
` + O[l].replace(" at new ", " at ");
                      return t.displayName && Z.includes("<anonymous>") && (Z = Z.replace("<anonymous>", t.displayName)), Z;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          Pr = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? Nt(a) : "";
      }
      function et(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return Nt(t.type);
          case 16:
            return Nt("Lazy");
          case 13:
            return t.child !== e && e !== null ? Nt("Suspense Fallback") : Nt("Suspense");
          case 19:
            return Nt("SuspenseList");
          case 0:
          case 15:
            return K(t.type, !1);
          case 11:
            return K(t.type.render, !1);
          case 1:
            return K(t.type, !0);
          case 31:
            return Nt("Activity");
          default:
            return "";
        }
      }
      function nt(t) {
        try {
          var e = "", a = null;
          do
            e += et(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (l) {
          return `
Error generating stack: ` + l.message + `
` + l.stack;
        }
      }
      function U(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Uu.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: nt(e)
          }, Uu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: nt(e)
        };
      }
      function B(t, e) {
        gn[bn++] = Pn, gn[bn++] = Il, Il = t, Pn = e;
      }
      function b(t, e, a) {
        ke[Ee++] = Ve, ke[Ee++] = Xe, ke[Ee++] = xa, xa = t;
        var l = Ve;
        t = Xe;
        var r = 32 - ge(l) - 1;
        l &= ~(1 << r), a += 1;
        var c = 32 - ge(e) + r;
        if (30 < c) {
          var m = r - r % 5;
          c = (l & (1 << m) - 1).toString(32), l >>= m, r -= m, Ve = 1 << 32 - ge(e) + r | a << r | l, Xe = c + t;
        } else
          Ve = 1 << c | a << r | l, Xe = t;
      }
      function q(t) {
        t.return !== null && (B(t, 1), b(t, 1, 0));
      }
      function tt(t) {
        for (; t === Il; )
          Il = gn[--bn], gn[bn] = null, Pn = gn[--bn], gn[bn] = null;
        for (; t === xa; )
          xa = ke[--Ee], ke[Ee] = null, Xe = ke[--Ee], ke[Ee] = null, Ve = ke[--Ee], ke[Ee] = null;
      }
      function $(t, e) {
        ke[Ee++] = Ve, ke[Ee++] = Xe, ke[Ee++] = xa, Ve = e.id, Xe = e.overflow, xa = t;
      }
      function P(t, e) {
        z(wa, e), z(tl, t), z(Pt, null), t = of(e), y(Pt), z(Pt, t);
      }
      function lt() {
        y(Pt), y(tl), y(wa);
      }
      function xt(t) {
        t.memoizedState !== null && z($l, t);
        var e = Pt.current, a = sf(e, t.type);
        e !== a && (z(tl, t), z(Pt, a));
      }
      function Jt(t) {
        tl.current === t && (y(Pt), y(tl)), $l.current === t && (y($l), ta ? Ka._currentValue = mn : Ka._currentValue2 = mn);
      }
      function ut(t) {
        var e = Error(
          u(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Rn(U(e, t)), to;
      }
      function Oa(t, e) {
        if (!le) throw Error(u(175));
        sp(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ut(t, !0);
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
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Su(t.type) && !Zl(t.type, t.memoizedProps)) && At && ut(t) : e !== 3 && (e !== 5 || Su(t.type) && !Zl(t.type, t.memoizedProps)) && At && ut(t), Ra(t), e === 13) {
          if (!le) throw Error(u(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(u(317));
          At = fp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(u(317));
          At = mp(t);
        } else
          At = Vt && e === 27 ? $f(
            t.type,
            At
          ) : te ? _u(t.stateNode) : null;
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
        ta ? (z(Pl, e._currentValue), e._currentValue = a) : (z(Pl, e._currentValue2), e._currentValue2 = a);
      }
      function Le(t) {
        var e = Pl.current;
        ta ? t._currentValue = e : t._currentValue2 = e, y(Pl);
      }
      function Hi(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Di(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var c = r.dependencies;
          if (c !== null) {
            var m = r.child;
            c = c.firstContext;
            t: for (; c !== null; ) {
              var v = c;
              c = r;
              for (var O = 0; O < e.length; O++)
                if (v.context === e[O]) {
                  c.lanes |= a, v = c.alternate, v !== null && (v.lanes |= a), Hi(
                    c.return,
                    a,
                    t
                  ), l || (m = null);
                  break t;
                }
              c = v.next;
            }
          } else if (r.tag === 18) {
            if (m = r.return, m === null) throw Error(u(341));
            m.lanes |= a, c = m.alternate, c !== null && (c.lanes |= a), Hi(m, a, t), m = null;
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
        for (var r = e, c = !1; r !== null; ) {
          if (!c) {
            if ((r.flags & 524288) !== 0) c = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var m = r.alternate;
            if (m === null) throw Error(u(387));
            if (m = m.memoizedProps, m !== null) {
              var v = r.type;
              ve(r.pendingProps.value, m.value) || (t !== null ? t.push(v) : t = [v]);
            }
          } else if (r === $l.current) {
            if (m = r.alternate, m === null) throw Error(u(387));
            m.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ka) : t = [Ka]);
          }
          r = r.return;
        }
        t !== null && Di(
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
        return Fo(Va, t);
      }
      function gl(t, e) {
        return Va === null && Ha(t), Fo(t, e);
      }
      function Fo(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(u(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function Ui() {
        return {
          controller: new Gp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Hn(t) {
        t.refCount--, t.refCount === 0 && Qp(Kp, function() {
          t.controller.abort();
        });
      }
      function bl() {
      }
      function Ge(t) {
        t !== vn && t.next === null && (vn === null ? ti = vn = t : vn = vn.next = t), ei = !0, eo || (eo = !0, Tm());
      }
      function ln(t, e) {
        if (!ao && ei) {
          ao = !0;
          do
            for (var a = !1, l = ti; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var c = 0;
                else {
                  var m = l.suspendedLanes, v = l.pingedLanes;
                  c = (1 << 31 - ge(42 | t) + 1) - 1, c &= r & ~(m & ~v), c = c & 201326741 ? c & 201326741 | 1 : c ? c | 2 : 0;
                }
                c !== 0 && (a = !0, es(l, c));
              } else
                c = vt, c = Y(
                  l,
                  l === Tt ? c : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Qa
                ), (c & 3) === 0 || E(l, c) || (a = !0, es(l, c));
              l = l.next;
            }
          while (a);
          ao = !1;
        }
      }
      function Io() {
        $o();
      }
      function $o() {
        ei = eo = !1;
        var t = 0;
        Xa !== 0 && bf() && (t = Xa);
        for (var e = ce(), a = null, l = ti; l !== null; ) {
          var r = l.next, c = Po(l, e);
          c === 0 ? (l.next = null, a === null ? ti = r : a.next = r, r === null && (vn = a)) : (a = l, (t !== 0 || (c & 3) !== 0) && (ei = !0)), l = r;
        }
        Xt !== 0 && Xt !== 5 || ln(t), Xa !== 0 && (Xa = 0);
      }
      function Po(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, c = t.pendingLanes & -62914561; 0 < c; ) {
          var m = 31 - ge(c), v = 1 << m, O = r[m];
          O === -1 ? ((v & a) === 0 || (v & l) !== 0) && (r[m] = N(v, e)) : O <= e && (t.expiredLanes |= v), c &= ~v;
        }
        if (e = Tt, a = vt, a = Y(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l = t.callbackNode, a === 0 || t === e && (kt === 2 || kt === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && Fr(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || E(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && Fr(l), ot(a)) {
            case 2:
            case 8:
              a = Dp;
              break;
            case 32:
              a = Ir;
              break;
            case 268435456:
              a = Up;
              break;
            default:
              a = Ir;
          }
          return l = ts.bind(null, t), a = Fl(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && Fr(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function ts(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Ln() && t.callbackNode !== a)
          return null;
        var l = vt;
        return l = Y(
          t,
          t === Tt ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l === 0 ? null : (Uc(t, l, e), Po(t, ce()), t.callbackNode != null && t.callbackNode === a ? ts.bind(null, t) : null);
      }
      function es(t, e) {
        if (Ln()) return null;
        Uc(t, e, !0);
      }
      function Tm() {
        zf ? kf(function() {
          (gt & 6) !== 0 ? Fl(
            Ru,
            Io
          ) : $o();
        }) : Fl(
          Ru,
          Io
        );
      }
      function Bi() {
        if (Xa === 0) {
          var t = yn;
          t === 0 && (t = Jl, Jl <<= 1, (Jl & 261888) === 0 && (Jl = 256)), Xa = t;
        }
        return Xa;
      }
      function Cm(t, e) {
        if (el === null) {
          var a = el = [];
          no = 0, yn = Bi(), xn = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return no++, e.then(as, as), e;
      }
      function as() {
        if (--no === 0 && el !== null) {
          xn !== null && (xn.status = "fulfilled");
          var t = el;
          el = null, yn = 0, xn = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function jm(t, e) {
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
      function qi() {
        var t = Za.current;
        return t !== null ? t : Tt.pooledCache;
      }
      function vl(t, e) {
        e === null ? z(Za, Za.current) : z(Za, e.pool);
      }
      function ns() {
        var t = qi();
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
          if (!Yp.call(e, r) || !ve(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function ls(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function is(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(bl, bl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, os(t), t;
          default:
            if (typeof e.status == "string") e.then(bl, bl);
            else {
              if (t = Tt, t !== null && 100 < t.shellSuspendCounter)
                throw Error(u(482));
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
                throw t = e.reason, os(t), t;
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
      function rs() {
        if (Ja === null) throw Error(u(459));
        var t = Ja;
        return Ja = null, t;
      }
      function os(t) {
        if (t === wn || t === ai)
          throw Error(u(483));
      }
      function xl(t) {
        var e = al;
        return al += 1, _n === null && (_n = []), is(_n, t, e);
      }
      function Dn(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function wl(t, e) {
        throw e.$$typeof === ef ? Error(u(525)) : (t = Object.prototype.toString.call(e), Error(
          u(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function ss(t) {
        function e(j, T) {
          if (t) {
            var A = j.deletions;
            A === null ? (j.deletions = [T], j.flags |= 16) : A.push(T);
          }
        }
        function a(j, T) {
          if (!t) return null;
          for (; T !== null; )
            e(j, T), T = T.sibling;
          return null;
        }
        function l(j) {
          for (var T = /* @__PURE__ */ new Map(); j !== null; )
            j.key !== null ? T.set(j.key, j) : T.set(j.index, j), j = j.sibling;
          return T;
        }
        function r(j, T) {
          return j = Pe(j, T), j.index = 0, j.sibling = null, j;
        }
        function c(j, T, A) {
          return j.index = A, t ? (A = j.alternate, A !== null ? (A = A.index, A < T ? (j.flags |= 67108866, T) : A) : (j.flags |= 67108866, T)) : (j.flags |= 1048576, T);
        }
        function m(j) {
          return t && j.alternate === null && (j.flags |= 67108866), j;
        }
        function v(j, T, A, X) {
          return T === null || T.tag !== 6 ? (T = Rr(A, j.mode, X), T.return = j, T) : (T = r(T, A), T.return = j, T);
        }
        function O(j, T, A, X) {
          var rt = A.type;
          return rt === dn ? Z(
            j,
            T,
            A.props.children,
            X,
            A.key
          ) : T !== null && (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === ya && Da(rt) === T.type) ? (T = r(T, A.props), Dn(T, A), T.return = j, T) : (T = Kl(
            A.type,
            A.key,
            A.props,
            null,
            j.mode,
            X
          ), Dn(T, A), T.return = j, T);
        }
        function Q(j, T, A, X) {
          return T === null || T.tag !== 4 || T.stateNode.containerInfo !== A.containerInfo || T.stateNode.implementation !== A.implementation ? (T = Hr(A, j.mode, X), T.return = j, T) : (T = r(T, A.children || []), T.return = j, T);
        }
        function Z(j, T, A, X, rt) {
          return T === null || T.tag !== 7 ? (T = Ga(
            A,
            j.mode,
            X,
            rt
          ), T.return = j, T) : (T = r(T, A), T.return = j, T);
        }
        function V(j, T, A) {
          if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
            return T = Rr(
              "" + T,
              j.mode,
              A
            ), T.return = j, T;
          if (typeof T == "object" && T !== null) {
            switch (T.$$typeof) {
              case Vl:
                return A = Kl(
                  T.type,
                  T.key,
                  T.props,
                  null,
                  j.mode,
                  A
                ), Dn(A, T), A.return = j, A;
              case un:
                return T = Hr(
                  T,
                  j.mode,
                  A
                ), T.return = j, T;
              case ya:
                return T = Da(T), V(j, T, A);
            }
            if (Xl(T) || R(T))
              return T = Ga(
                T,
                j.mode,
                A,
                null
              ), T.return = j, T;
            if (typeof T.then == "function")
              return V(j, xl(T), A);
            if (T.$$typeof === va)
              return V(
                j,
                gl(j, T),
                A
              );
            wl(j, T);
          }
          return null;
        }
        function L(j, T, A, X) {
          var rt = T !== null ? T.key : null;
          if (typeof A == "string" && A !== "" || typeof A == "number" || typeof A == "bigint")
            return rt !== null ? null : v(j, T, "" + A, X);
          if (typeof A == "object" && A !== null) {
            switch (A.$$typeof) {
              case Vl:
                return A.key === rt ? O(j, T, A, X) : null;
              case un:
                return A.key === rt ? Q(j, T, A, X) : null;
              case ya:
                return A = Da(A), L(j, T, A, X);
            }
            if (Xl(A) || R(A))
              return rt !== null ? null : Z(j, T, A, X, null);
            if (typeof A.then == "function")
              return L(
                j,
                T,
                xl(A),
                X
              );
            if (A.$$typeof === va)
              return L(
                j,
                T,
                gl(j, A),
                X
              );
            wl(j, A);
          }
          return null;
        }
        function dt(j, T, A, X, rt) {
          if (typeof X == "string" && X !== "" || typeof X == "number" || typeof X == "bigint")
            return j = j.get(A) || null, v(T, j, "" + X, rt);
          if (typeof X == "object" && X !== null) {
            switch (X.$$typeof) {
              case Vl:
                return j = j.get(
                  X.key === null ? A : X.key
                ) || null, O(T, j, X, rt);
              case un:
                return j = j.get(
                  X.key === null ? A : X.key
                ) || null, Q(T, j, X, rt);
              case ya:
                return X = Da(X), dt(
                  j,
                  T,
                  A,
                  X,
                  rt
                );
            }
            if (Xl(X) || R(X))
              return j = j.get(A) || null, Z(T, j, X, rt, null);
            if (typeof X.then == "function")
              return dt(
                j,
                T,
                A,
                xl(X),
                rt
              );
            if (X.$$typeof === va)
              return dt(
                j,
                T,
                A,
                gl(T, X),
                rt
              );
            wl(T, X);
          }
          return null;
        }
        function ee(j, T, A, X) {
          for (var rt = null, Rt = null, st = T, _t = T = 0, Ft = null; st !== null && _t < A.length; _t++) {
            st.index > _t ? (Ft = st, st = null) : Ft = st.sibling;
            var St = L(
              j,
              st,
              A[_t],
              X
            );
            if (St === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && St.alternate === null && e(j, st), T = c(St, T, _t), Rt === null ? rt = St : Rt.sibling = St, Rt = St, st = Ft;
          }
          if (_t === A.length)
            return a(j, st), yt && B(j, _t), rt;
          if (st === null) {
            for (; _t < A.length; _t++)
              st = V(j, A[_t], X), st !== null && (T = c(
                st,
                T,
                _t
              ), Rt === null ? rt = st : Rt.sibling = st, Rt = st);
            return yt && B(j, _t), rt;
          }
          for (st = l(st); _t < A.length; _t++)
            Ft = dt(
              st,
              j,
              _t,
              A[_t],
              X
            ), Ft !== null && (t && Ft.alternate !== null && st.delete(
              Ft.key === null ? _t : Ft.key
            ), T = c(
              Ft,
              T,
              _t
            ), Rt === null ? rt = Ft : Rt.sibling = Ft, Rt = Ft);
          return t && st.forEach(function(Ta) {
            return e(j, Ta);
          }), yt && B(j, _t), rt;
        }
        function cl(j, T, A, X) {
          if (A == null) throw Error(u(151));
          for (var rt = null, Rt = null, st = T, _t = T = 0, Ft = null, St = A.next(); st !== null && !St.done; _t++, St = A.next()) {
            st.index > _t ? (Ft = st, st = null) : Ft = st.sibling;
            var Ta = L(j, st, St.value, X);
            if (Ta === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Ta.alternate === null && e(j, st), T = c(Ta, T, _t), Rt === null ? rt = Ta : Rt.sibling = Ta, Rt = Ta, st = Ft;
          }
          if (St.done)
            return a(j, st), yt && B(j, _t), rt;
          if (st === null) {
            for (; !St.done; _t++, St = A.next())
              St = V(j, St.value, X), St !== null && (T = c(
                St,
                T,
                _t
              ), Rt === null ? rt = St : Rt.sibling = St, Rt = St);
            return yt && B(j, _t), rt;
          }
          for (st = l(st); !St.done; _t++, St = A.next())
            St = dt(
              st,
              j,
              _t,
              St.value,
              X
            ), St !== null && (t && St.alternate !== null && st.delete(St.key === null ? _t : St.key), T = c(St, T, _t), Rt === null ? rt = St : Rt.sibling = St, Rt = St);
          return t && st.forEach(function(Jp) {
            return e(j, Jp);
          }), yt && B(j, _t), rt;
        }
        function Ia(j, T, A, X) {
          if (typeof A == "object" && A !== null && A.type === dn && A.key === null && (A = A.props.children), typeof A == "object" && A !== null) {
            switch (A.$$typeof) {
              case Vl:
                t: {
                  for (var rt = A.key; T !== null; ) {
                    if (T.key === rt) {
                      if (rt = A.type, rt === dn) {
                        if (T.tag === 7) {
                          a(
                            j,
                            T.sibling
                          ), X = r(
                            T,
                            A.props.children
                          ), X.return = j, j = X;
                          break t;
                        }
                      } else if (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === ya && Da(rt) === T.type) {
                        a(
                          j,
                          T.sibling
                        ), X = r(T, A.props), Dn(X, A), X.return = j, j = X;
                        break t;
                      }
                      a(j, T);
                      break;
                    } else e(j, T);
                    T = T.sibling;
                  }
                  A.type === dn ? (X = Ga(
                    A.props.children,
                    j.mode,
                    X,
                    A.key
                  ), X.return = j, j = X) : (X = Kl(
                    A.type,
                    A.key,
                    A.props,
                    null,
                    j.mode,
                    X
                  ), Dn(X, A), X.return = j, j = X);
                }
                return m(j);
              case un:
                t: {
                  for (rt = A.key; T !== null; ) {
                    if (T.key === rt)
                      if (T.tag === 4 && T.stateNode.containerInfo === A.containerInfo && T.stateNode.implementation === A.implementation) {
                        a(
                          j,
                          T.sibling
                        ), X = r(
                          T,
                          A.children || []
                        ), X.return = j, j = X;
                        break t;
                      } else {
                        a(j, T);
                        break;
                      }
                    else e(j, T);
                    T = T.sibling;
                  }
                  X = Hr(A, j.mode, X), X.return = j, j = X;
                }
                return m(j);
              case ya:
                return A = Da(A), Ia(
                  j,
                  T,
                  A,
                  X
                );
            }
            if (Xl(A))
              return ee(
                j,
                T,
                A,
                X
              );
            if (R(A)) {
              if (rt = R(A), typeof rt != "function")
                throw Error(u(150));
              return A = rt.call(A), cl(
                j,
                T,
                A,
                X
              );
            }
            if (typeof A.then == "function")
              return Ia(
                j,
                T,
                xl(A),
                X
              );
            if (A.$$typeof === va)
              return Ia(
                j,
                T,
                gl(j, A),
                X
              );
            wl(j, A);
          }
          return typeof A == "string" && A !== "" || typeof A == "number" || typeof A == "bigint" ? (A = "" + A, T !== null && T.tag === 6 ? (a(j, T.sibling), X = r(T, A), X.return = j, j = X) : (a(j, T), X = Rr(A, j.mode, X), X.return = j, j = X), m(j)) : a(j, T);
        }
        return function(j, T, A, X) {
          try {
            al = 0;
            var rt = Ia(
              j,
              T,
              A,
              X
            );
            return _n = null, rt;
          } catch (st) {
            if (st === wn || st === ai) throw st;
            var Rt = o(29, st, null, j.mode);
            return Rt.lanes = X, Rt.return = j, Rt;
          } finally {
          }
        };
      }
      function _l() {
        for (var t = Sn, e = io = Sn = 0; e < t; ) {
          var a = Te[e];
          Te[e++] = null;
          var l = Te[e];
          Te[e++] = null;
          var r = Te[e];
          Te[e++] = null;
          var c = Te[e];
          if (Te[e++] = null, l !== null && r !== null) {
            var m = l.pending;
            m === null ? r.next = r : (r.next = m.next, m.next = r), l.pending = r;
          }
          c !== 0 && cs(a, r, c);
        }
      }
      function Sl(t, e, a, l) {
        Te[Sn++] = t, Te[Sn++] = e, Te[Sn++] = a, Te[Sn++] = l, io |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Yi(t, e, a, l) {
        return Sl(t, e, a, l), zl(t);
      }
      function Ua(t, e) {
        return Sl(t, null, null, e), zl(t);
      }
      function cs(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, c = t.return; c !== null; )
          c.childLanes |= a, l = c.alternate, l !== null && (l.childLanes |= a), c.tag === 22 && (t = c.stateNode, t === null || t._visibility & 1 || (r = !0)), t = c, c = c.return;
        return t.tag === 3 ? (c = t.stateNode, r && e !== null && (r = 31 - ge(a), t = c.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), c) : null;
      }
      function zl(t) {
        if (50 < sl)
          throw sl = 0, vo = null, Error(u(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Gi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Qi(t, e) {
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
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = zl(t), cs(t, null, a), e;
        }
        return Sl(t, l, e, a), zl(t);
      }
      function Un(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function Ki(t, e) {
        var a = t.updateQueue, l = t.alternate;
        if (l !== null && (l = l.updateQueue, a === l)) {
          var r = null, c = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var m = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              c === null ? r = c = m : c = c.next = m, a = a.next;
            } while (a !== null);
            c === null ? r = c = e : c = c.next = e;
          } else r = c = e;
          a = {
            baseState: l.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: c,
            shared: l.shared,
            callbacks: l.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Bn() {
        if (ro) {
          var t = xn;
          if (t !== null) throw t;
        }
      }
      function qn(t, e, a, l) {
        ro = !1;
        var r = t.updateQueue;
        Sa = !1;
        var c = r.firstBaseUpdate, m = r.lastBaseUpdate, v = r.shared.pending;
        if (v !== null) {
          r.shared.pending = null;
          var O = v, Q = O.next;
          O.next = null, m === null ? c = Q : m.next = Q, m = O;
          var Z = t.alternate;
          Z !== null && (Z = Z.updateQueue, v = Z.lastBaseUpdate, v !== m && (v === null ? Z.firstBaseUpdate = Q : v.next = Q, Z.lastBaseUpdate = O));
        }
        if (c !== null) {
          var V = r.baseState;
          m = 0, Z = Q = O = null, v = c;
          do {
            var L = v.lane & -536870913, dt = L !== v.lane;
            if (dt ? (vt & L) === L : (l & L) === L) {
              L !== 0 && L === yn && (ro = !0), Z !== null && (Z = Z.next = {
                lane: 0,
                tag: v.tag,
                payload: v.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, cl = v;
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
                    V = Ur({}, V, L);
                    break t;
                  case 2:
                    Sa = !0;
                }
              }
              L = v.callback, L !== null && (t.flags |= 64, dt && (t.flags |= 8192), dt = r.callbacks, dt === null ? r.callbacks = [L] : dt.push(L));
            } else
              dt = {
                lane: L,
                tag: v.tag,
                payload: v.payload,
                callback: v.callback,
                next: null
              }, Z === null ? (Q = Z = dt, O = V) : Z = Z.next = dt, m |= L;
            if (v = v.next, v === null) {
              if (v = r.shared.pending, v === null)
                break;
              dt = v, v = dt.next, dt.next = null, r.lastBaseUpdate = dt, r.shared.pending = null;
            }
          } while (!0);
          Z === null && (O = V), r.baseState = O, r.firstBaseUpdate = Q, r.lastBaseUpdate = Z, c === null && (r.shared.lanes = 0), ka |= m, t.lanes = m, t.memoizedState = V;
        }
      }
      function us(t, e) {
        if (typeof t != "function")
          throw Error(u(191, t));
        t.call(e);
      }
      function ds(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            us(a[t], e);
      }
      function ms(t, e) {
        t = ia, z(li, t), z(zn, e), ia = t | e.baseLanes;
      }
      function Vi() {
        z(li, ia), z(zn, zn.current);
      }
      function Xi() {
        ia = li.current, y(zn), y(li);
      }
      function pa(t) {
        var e = t.alternate;
        z(Bt, Bt.current & 1), z(ye, t), Ce === null && (e === null || zn.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Zi(t) {
        z(Bt, Bt.current), z(ye, t), Ce === null && (Ce = t);
      }
      function fs(t) {
        t.tag === 22 ? (z(Bt, Bt.current), z(ye, t), Ce === null && (Ce = t)) : ha();
      }
      function ha() {
        z(Bt, Bt.current), z(ye, ye.current);
      }
      function fe(t) {
        y(ye), Ce === t && (Ce = null), y(Bt);
      }
      function kl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Zr(a) || Jr(a)))
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
        throw Error(u(321));
      }
      function Ji(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ve(t[a], e[a])) return !1;
        return !0;
      }
      function Li(t, e, a, l, r, c) {
        return na = c, mt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, it.H = t === null || t.memoizedState === null ? Yu : oo, Wa = !1, c = a(l, r), Wa = !1, kn && (c = hs(
          e,
          a,
          l,
          r
        )), ps(t), c;
      }
      function ps(t) {
        it.H = ll;
        var e = Et !== null && Et.next !== null;
        if (na = 0, qt = Et = mt = null, ii = !1, nl = 0, En = null, e) throw Error(u(300));
        t === null || Yt || (t = t.dependencies, t !== null && hl(t) && (Yt = !0));
      }
      function hs(t, e, a, l) {
        mt = t;
        var r = 0;
        do {
          if (kn && (En = null), nl = 0, kn = !1, 25 <= r) throw Error(u(301));
          if (r += 1, qt = Et = null, t.updateQueue != null) {
            var c = t.updateQueue;
            c.lastEffect = null, c.events = null, c.stores = null, c.memoCache != null && (c.memoCache.index = 0);
          }
          it.H = Gu, c = e(a, l);
        } while (kn);
        return c;
      }
      function Mm() {
        var t = it.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Yn(e) : e, t = t.useState()[0], (Et !== null ? Et.memoizedState : null) !== t && (mt.flags |= 1024), e;
      }
      function Wi() {
        var t = ri !== 0;
        return ri = 0, t;
      }
      function Fi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Ii(t) {
        if (ii) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ii = !1;
        }
        na = 0, qt = Et = mt = null, kn = !1, nl = ri = 0, En = null;
      }
      function re() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return qt === null ? mt.memoizedState = qt = t : qt = qt.next = t, qt;
      }
      function Ut() {
        if (Et === null) {
          var t = mt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Et.next;
        var e = qt === null ? mt.memoizedState : qt.next;
        if (e !== null)
          qt = e, Et = t;
        else {
          if (t === null)
            throw mt.alternate === null ? Error(u(467)) : Error(u(310));
          Et = t, t = {
            memoizedState: Et.memoizedState,
            baseState: Et.baseState,
            baseQueue: Et.baseQueue,
            queue: Et.queue,
            next: null
          }, qt === null ? mt.memoizedState = qt = t : qt = qt.next = t;
        }
        return qt;
      }
      function El() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Yn(t) {
        var e = nl;
        return nl += 1, En === null && (En = []), t = is(En, t, e), e = mt, (qt === null ? e.memoizedState : qt.next) === null && (e = e.alternate, it.H = e === null || e.memoizedState === null ? Yu : oo), t;
      }
      function Nl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Yn(t);
          if (t.$$typeof === va) return It(t);
        }
        throw Error(u(438, String(t)));
      }
      function $i(t) {
        var e = null, a = mt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var l = mt.alternate;
          l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (e = {
            data: l.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = El(), mt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = af;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Tl(t) {
        var e = Ut();
        return Pi(e, Et, t);
      }
      function Pi(t, e, a) {
        var l = t.queue;
        if (l === null) throw Error(u(311));
        l.lastRenderedReducer = a;
        var r = t.baseQueue, c = l.pending;
        if (c !== null) {
          if (r !== null) {
            var m = r.next;
            r.next = c.next, c.next = m;
          }
          e.baseQueue = r = c, l.pending = null;
        }
        if (c = t.baseState, r === null) t.memoizedState = c;
        else {
          e = r.next;
          var v = m = null, O = null, Q = e, Z = !1;
          do {
            var V = Q.lane & -536870913;
            if (V !== Q.lane ? (vt & V) === V : (na & V) === V) {
              var L = Q.revertLane;
              if (L === 0)
                O !== null && (O = O.next = {
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
                }, O === null ? (v = O = V, m = c) : O = O.next = V, mt.lanes |= L, ka |= L;
              V = Q.action, Wa && a(c, V), c = Q.hasEagerState ? Q.eagerState : a(c, V);
            } else
              L = {
                lane: V,
                revertLane: Q.revertLane,
                gesture: Q.gesture,
                action: Q.action,
                hasEagerState: Q.hasEagerState,
                eagerState: Q.eagerState,
                next: null
              }, O === null ? (v = O = L, m = c) : O = O.next = L, mt.lanes |= V, ka |= V;
            Q = Q.next;
          } while (Q !== null && Q !== e);
          if (O === null ? m = c : O.next = v, !ve(c, t.memoizedState) && (Yt = !0, Z && (a = xn, a !== null)))
            throw a;
          t.memoizedState = c, t.baseState = m, t.baseQueue = O, l.lastRenderedState = c;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function tr(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(u(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, c = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var m = r = r.next;
          do
            c = t(c, m.action), m = m.next;
          while (m !== r);
          ve(c, e.memoizedState) || (Yt = !0), e.memoizedState = c, e.baseQueue === null && (e.baseState = c), a.lastRenderedState = c;
        }
        return [c, l];
      }
      function gs(t, e, a) {
        var l = mt, r = Ut(), c = yt;
        if (c) {
          if (a === void 0)
            throw Error(u(407));
          a = a();
        } else a = e();
        var m = !ve(
          (Et || r).memoizedState,
          a
        );
        if (m && (r.memoizedState = a, Yt = !0), r = r.queue, nr(ys.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || m || qt !== null && qt.memoizedState.tag & 1) {
          if (l.flags |= 2048, rn(
            9,
            { destroy: void 0 },
            vs.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), Tt === null) throw Error(u(349));
          c || (na & 127) !== 0 || bs(l, e, a);
        }
        return a;
      }
      function bs(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = mt.updateQueue, e === null ? (e = El(), mt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function vs(t, e, a, l) {
        e.value = a, e.getSnapshot = l, xs(e) && ws(t);
      }
      function ys(t, e, a) {
        return a(function() {
          xs(e) && ws(t);
        });
      }
      function xs(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ve(t, a);
        } catch {
          return !0;
        }
      }
      function ws(t) {
        var e = Ua(t, 2);
        e !== null && se(e, t, 2);
      }
      function er(t) {
        var e = re();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Wa) {
            jt(!0);
            try {
              a();
            } finally {
              jt(!1);
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
      function _s(t, e, a, l) {
        return t.baseState = a, Pi(
          t,
          Et,
          typeof l == "function" ? l : We
        );
      }
      function Am(t, e, a, l, r) {
        if (Ml(t)) throw Error(u(485));
        if (t = e.action, t !== null) {
          var c = {
            payload: r,
            action: t,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(m) {
              c.listeners.push(m);
            }
          };
          it.T !== null ? a(!0) : c.isTransition = !1, l(c), a = e.pending, a === null ? (c.next = e.pending = c, Ss(e, c)) : (c.next = a.next, e.pending = a.next = c);
        }
      }
      function Ss(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var c = it.T, m = {};
          it.T = m;
          try {
            var v = a(r, l), O = it.S;
            O !== null && O(m, v), zs(t, e, v);
          } catch (Q) {
            ar(t, e, Q);
          } finally {
            c !== null && m.types !== null && (c.types = m.types), it.T = c;
          }
        } else
          try {
            c = a(r, l), zs(t, e, c);
          } catch (Q) {
            ar(t, e, Q);
          }
      }
      function zs(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            ks(t, e, l);
          },
          function(l) {
            return ar(t, e, l);
          }
        ) : ks(t, e, a);
      }
      function ks(t, e, a) {
        e.status = "fulfilled", e.value = a, Es(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Ss(t, a)));
      }
      function ar(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, Es(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function Es(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Ns(t, e) {
        return e;
      }
      function Ts(t, e) {
        if (yt) {
          var a = Tt.formState;
          if (a !== null) {
            t: {
              var l = mt;
              if (yt) {
                if (At) {
                  var r = Ff(
                    At,
                    Ne
                  );
                  if (r) {
                    At = _u(r), l = If(r);
                    break t;
                  }
                }
                ut(l);
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
          lastRenderedReducer: Ns,
          lastRenderedState: e
        }, a.queue = l, a = Zs.bind(
          null,
          mt,
          l
        ), l.dispatch = a, l = er(!1);
        var c = or.bind(
          null,
          mt,
          !1,
          l.queue
        );
        return l = re(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = Am.bind(
          null,
          mt,
          r,
          c,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function Cs(t) {
        var e = Ut();
        return js(e, Et, t);
      }
      function js(t, e, a) {
        if (e = Pi(
          t,
          e,
          Ns
        )[0], t = Tl(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Yn(e);
          } catch (m) {
            throw m === wn ? ai : m;
          }
        else l = e;
        e = Ut();
        var r = e.queue, c = r.dispatch;
        return a !== e.memoizedState && (mt.flags |= 2048, rn(
          9,
          { destroy: void 0 },
          Om.bind(null, r, a),
          null
        )), [l, c, t];
      }
      function Om(t, e) {
        t.action = e;
      }
      function Ms(t) {
        var e = Ut(), a = Et;
        if (a !== null)
          return js(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function rn(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = mt.updateQueue, e === null && (e = El(), mt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function As() {
        return Ut().memoizedState;
      }
      function Cl(t, e, a, l) {
        var r = re();
        mt.flags |= t, r.memoizedState = rn(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function jl(t, e, a, l) {
        var r = Ut();
        l = l === void 0 ? null : l;
        var c = r.memoizedState.inst;
        Et !== null && l !== null && Ji(l, Et.memoizedState.deps) ? r.memoizedState = rn(e, c, a, l) : (mt.flags |= t, r.memoizedState = rn(
          1 | e,
          c,
          a,
          l
        ));
      }
      function Os(t, e) {
        Cl(8390656, 8, t, e);
      }
      function nr(t, e) {
        jl(2048, 8, t, e);
      }
      function Rm(t) {
        mt.flags |= 4;
        var e = mt.updateQueue;
        if (e === null)
          e = El(), mt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Rs(t) {
        var e = Ut().memoizedState;
        return Rm({ ref: e, nextImpl: t }), function() {
          if ((gt & 2) !== 0)
            throw Error(u(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Hs(t, e) {
        return jl(4, 2, t, e);
      }
      function Ds(t, e) {
        return jl(4, 4, t, e);
      }
      function Us(t, e) {
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
      function Bs(t, e, a) {
        a = a != null ? a.concat([t]) : null, jl(
          4,
          4,
          Us.bind(null, e, t),
          a
        );
      }
      function lr() {
      }
      function qs(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Ji(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Ys(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Ji(e, l[1]))
          return l[0];
        if (l = t(), Wa) {
          jt(!0);
          try {
            t();
          } finally {
            jt(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function ir(t, e, a) {
        return a === void 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Dc(), mt.lanes |= t, ka |= t, a);
      }
      function Gs(t, e, a, l) {
        return ve(a, e) ? a : zn.current !== null ? (t = ir(t, a, l), ve(t, e) || (Yt = !0), t) : (na & 42) === 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? (Yt = !0, t.memoizedState = a) : (t = Dc(), mt.lanes |= t, ka |= t, e);
      }
      function Qs(t, e, a, l, r) {
        var c = ea();
        Lt(
          c !== 0 && 8 > c ? c : 8
        );
        var m = it.T, v = {};
        it.T = v, or(t, !1, e, a);
        try {
          var O = r(), Q = it.S;
          if (Q !== null && Q(v, O), O !== null && typeof O == "object" && typeof O.then == "function") {
            var Z = jm(
              O,
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
          Lt(c), m !== null && v.types !== null && (m.types = v.types), it.T = m;
        }
      }
      function Ks(t) {
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
      function rr() {
        return It(Ka);
      }
      function Vs() {
        return Ut().memoizedState;
      }
      function Xs() {
        return Ut().memoizedState;
      }
      function Hm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = pe();
              t = ma(a);
              var l = fa(e, t, a);
              l !== null && (se(l, e, a), Un(l, e, a)), e = { cache: Ui() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Dm(t, e, a) {
        var l = pe();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t) ? Js(e, a) : (a = Yi(t, e, a, l), a !== null && (se(a, t, l), Ls(a, e, l)));
      }
      function Zs(t, e, a) {
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
        if (Ml(t)) Js(e, r);
        else {
          var c = t.alternate;
          if (t.lanes === 0 && (c === null || c.lanes === 0) && (c = e.lastRenderedReducer, c !== null))
            try {
              var m = e.lastRenderedState, v = c(m, a);
              if (r.hasEagerState = !0, r.eagerState = v, ve(v, m))
                return Sl(t, e, r, 0), Tt === null && _l(), !1;
            } catch {
            } finally {
            }
          if (a = Yi(t, e, r, l), a !== null)
            return se(a, t, l), Ls(a, e, l), !0;
        }
        return !1;
      }
      function or(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: Bi(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t)) {
          if (e) throw Error(u(479));
        } else
          e = Yi(
            t,
            a,
            l,
            2
          ), e !== null && se(e, t, 2);
      }
      function Ml(t) {
        var e = t.alternate;
        return t === mt || e !== null && e === mt;
      }
      function Js(t, e) {
        kn = ii = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Ls(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function sr(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : Ur({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Ws(t, e, a, l, r, c, m) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, c, m) : e.prototype && e.prototype.isPureReactComponent ? !yl(a, l) || !yl(r, c) : !0;
      }
      function Fs(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && so.enqueueReplaceState(e, e.state, null);
      }
      function Ba(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Ur({}, a));
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
      function Is(t, e, a) {
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
      function cr(t, e, a) {
        return a = ma(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Al(t, e);
        }, a;
      }
      function $s(t) {
        return t = ma(t), t.tag = 3, t;
      }
      function Ps(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var c = l.value;
          t.payload = function() {
            return r(c);
          }, t.callback = function() {
            Is(e, a, l);
          };
        }
        var m = a.stateNode;
        m !== null && typeof m.componentDidCatch == "function" && (t.callback = function() {
          Is(e, a, l), typeof r != "function" && (Ea === null ? Ea = /* @__PURE__ */ new Set([this]) : Ea.add(this));
          var v = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: v !== null ? v : ""
          });
        });
      }
      function Um(t, e, a, l, r) {
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
                return Ce === null ? Gl() : a.alternate === null && Dt === 0 && (Dt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Ar(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Ar(t, l, r)), !1;
            }
            throw Error(u(435, a.tag));
          }
          return Ar(t, l, r), Gl(), !1;
        }
        if (yt)
          return e = ye.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== to && (t = Error(u(422), { cause: l }), Rn(
            U(t, a)
          ))) : (l !== to && (e = Error(u(423), {
            cause: l
          }), Rn(
            U(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = U(l, a), r = cr(
            t.stateNode,
            l,
            r
          ), Ki(t, r), Dt !== 4 && (Dt = 2)), !1;
        var c = Error(u(520), { cause: l });
        if (c = U(c, a), rl === null ? rl = [c] : rl.push(c), Dt !== 4 && (Dt = 2), e === null) return !0;
        l = U(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = cr(a.stateNode, l, t), Ki(a, t), !1;
            case 1:
              if (e = a.type, c = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || c !== null && typeof c.componentDidCatch == "function" && (Ea === null || !Ea.has(
                c
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = $s(r), Ps(
                  r,
                  t,
                  a,
                  l
                ), Ki(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, l) {
        e.child = t === null ? qu(e, null, a, l) : La(
          e,
          t.child,
          a,
          l
        );
      }
      function tc(t, e, a, l, r) {
        a = a.render;
        var c = e.ref;
        if ("ref" in l) {
          var m = {};
          for (var v in l)
            v !== "ref" && (m[v] = l[v]);
        } else m = l;
        return Ha(e), l = Li(
          t,
          e,
          a,
          m,
          c,
          r
        ), v = Wi(), t !== null && !Yt ? (Fi(t, e, r), Fe(t, e, r)) : (yt && v && q(e), e.flags |= 1, $t(t, e, l, r), e.child);
      }
      function ec(t, e, a, l, r) {
        if (t === null) {
          var c = a.type;
          return typeof c == "function" && !Or(c) && c.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = c, ac(
            t,
            e,
            c,
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
        if (c = t.child, !gr(t, r)) {
          var m = c.memoizedProps;
          if (a = a.compare, a = a !== null ? a : yl, a(m, l) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(c, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function ac(t, e, a, l, r) {
        if (t !== null) {
          var c = t.memoizedProps;
          if (yl(c, l) && t.ref === e.ref)
            if (Yt = !1, e.pendingProps = l = c, gr(t, r))
              (t.flags & 131072) !== 0 && (Yt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return ur(
          t,
          e,
          a,
          l,
          r
        );
      }
      function nc(t, e, a, l) {
        var r = l.children, c = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), l.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (c = c !== null ? c.baseLanes | a : a, t !== null) {
              for (l = e.child = t.child, r = 0; l !== null; )
                r = r | l.lanes | l.childLanes, l = l.sibling;
              l = r & ~c;
            } else l = 0, e.child = null;
            return lc(
              t,
              e,
              c,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && vl(
              e,
              c !== null ? c.cachePool : null
            ), c !== null ? ms(e, c) : Vi(), fs(e);
          else
            return l = e.lanes = 536870912, lc(
              t,
              e,
              c !== null ? c.baseLanes | a : a,
              a,
              l
            );
        } else
          c !== null ? (vl(e, c.cachePool), ms(e, c), ha(), e.memoizedState = null) : (t !== null && vl(e, null), Vi(), ha());
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
      function lc(t, e, a, l, r) {
        var c = qi();
        return c = c === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: c
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: c
        }, t !== null && vl(e, null), Vi(), fs(e), t !== null && nn(t, e, l, !0), e.childLanes = r, null;
      }
      function Ol(t, e) {
        return e = Hl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function ic(t, e, a) {
        return La(e, t.child, null, a), t = Ol(
          e,
          e.pendingProps
        ), t.flags |= 2, fe(e), e.memoizedState = null, t;
      }
      function Bm(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (yt) {
            if (l.mode === "hidden")
              return t = Ol(e, l), e.lanes = 536870912, Qn(null, t);
            if (Zi(e), (t = At) ? (t = rp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = au(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw ut(e);
            return e.lanes = 536870912, null;
          }
          return Ol(e, l);
        }
        var c = t.memoizedState;
        if (c !== null) {
          var m = c.dehydrated;
          if (Zi(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = ic(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(u(558));
          else if (Yt || nn(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Yt || r) {
            if (l = Tt, l !== null && (m = J(l, a), m !== 0 && m !== c.retryLane))
              throw c.retryLane = m, Ua(t, m), se(l, t, m), co;
            Gl(), e = ic(
              t,
              e,
              a
            );
          } else
            t = c.treeContext, le && (At = ep(m), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = Ol(e, l), e.flags |= 4096;
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
            throw Error(u(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function ur(t, e, a, l, r) {
        return Ha(e), a = Li(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = Wi(), t !== null && !Yt ? (Fi(t, e, r), Fe(t, e, r)) : (yt && l && q(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function rc(t, e, a, l, r, c) {
        return Ha(e), e.updateQueue = null, a = hs(
          e,
          l,
          a,
          r
        ), ps(t), l = Wi(), t !== null && !Yt ? (Fi(t, e, c), Fe(t, e, c)) : (yt && l && q(e), e.flags |= 1, $t(t, e, a, c), e.child);
      }
      function oc(t, e, a, l, r) {
        if (Ha(e), e.stateNode === null) {
          var c = hn, m = a.contextType;
          typeof m == "object" && m !== null && (c = It(m)), c = new a(l, c), e.memoizedState = c.state !== null && c.state !== void 0 ? c.state : null, c.updater = so, e.stateNode = c, c._reactInternals = e, c = e.stateNode, c.props = l, c.state = e.memoizedState, c.refs = {}, Gi(e), m = a.contextType, c.context = typeof m == "object" && m !== null ? It(m) : hn, c.state = e.memoizedState, m = a.getDerivedStateFromProps, typeof m == "function" && (sr(
            e,
            a,
            m,
            l
          ), c.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof c.getSnapshotBeforeUpdate == "function" || typeof c.UNSAFE_componentWillMount != "function" && typeof c.componentWillMount != "function" || (m = c.state, typeof c.componentWillMount == "function" && c.componentWillMount(), typeof c.UNSAFE_componentWillMount == "function" && c.UNSAFE_componentWillMount(), m !== c.state && so.enqueueReplaceState(
            c,
            c.state,
            null
          ), qn(e, l, c, r), Bn(), c.state = e.memoizedState), typeof c.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          c = e.stateNode;
          var v = e.memoizedProps, O = Ba(a, v);
          c.props = O;
          var Q = c.context, Z = a.contextType;
          m = hn, typeof Z == "object" && Z !== null && (m = It(Z));
          var V = a.getDerivedStateFromProps;
          Z = typeof V == "function" || typeof c.getSnapshotBeforeUpdate == "function", v = e.pendingProps !== v, Z || typeof c.UNSAFE_componentWillReceiveProps != "function" && typeof c.componentWillReceiveProps != "function" || (v || Q !== m) && Fs(
            e,
            c,
            l,
            m
          ), Sa = !1;
          var L = e.memoizedState;
          c.state = L, qn(e, l, c, r), Bn(), Q = e.memoizedState, v || L !== Q || Sa ? (typeof V == "function" && (sr(
            e,
            a,
            V,
            l
          ), Q = e.memoizedState), (O = Sa || Ws(
            e,
            a,
            O,
            l,
            L,
            Q,
            m
          )) ? (Z || typeof c.UNSAFE_componentWillMount != "function" && typeof c.componentWillMount != "function" || (typeof c.componentWillMount == "function" && c.componentWillMount(), typeof c.UNSAFE_componentWillMount == "function" && c.UNSAFE_componentWillMount()), typeof c.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof c.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = Q), c.props = l, c.state = Q, c.context = m, l = O) : (typeof c.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          c = e.stateNode, Qi(t, e), m = e.memoizedProps, Z = Ba(a, m), c.props = Z, V = e.pendingProps, L = c.context, Q = a.contextType, O = hn, typeof Q == "object" && Q !== null && (O = It(Q)), v = a.getDerivedStateFromProps, (Q = typeof v == "function" || typeof c.getSnapshotBeforeUpdate == "function") || typeof c.UNSAFE_componentWillReceiveProps != "function" && typeof c.componentWillReceiveProps != "function" || (m !== V || L !== O) && Fs(
            e,
            c,
            l,
            O
          ), Sa = !1, L = e.memoizedState, c.state = L, qn(e, l, c, r), Bn();
          var dt = e.memoizedState;
          m !== V || L !== dt || Sa || t !== null && t.dependencies !== null && hl(t.dependencies) ? (typeof v == "function" && (sr(
            e,
            a,
            v,
            l
          ), dt = e.memoizedState), (Z = Sa || Ws(
            e,
            a,
            Z,
            l,
            L,
            dt,
            O
          ) || t !== null && t.dependencies !== null && hl(t.dependencies)) ? (Q || typeof c.UNSAFE_componentWillUpdate != "function" && typeof c.componentWillUpdate != "function" || (typeof c.componentWillUpdate == "function" && c.componentWillUpdate(l, dt, O), typeof c.UNSAFE_componentWillUpdate == "function" && c.UNSAFE_componentWillUpdate(
            l,
            dt,
            O
          )), typeof c.componentDidUpdate == "function" && (e.flags |= 4), typeof c.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof c.componentDidUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof c.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = dt), c.props = l, c.state = dt, c.context = O, l = Z) : (typeof c.componentDidUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof c.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return c = l, Rl(t, e), l = (e.flags & 128) !== 0, c || l ? (c = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : c.render(), e.flags |= 1, t !== null && l ? (e.child = La(
          e,
          t.child,
          null,
          r
        ), e.child = La(
          e,
          null,
          a,
          r
        )) : $t(t, e, a, r), e.memoizedState = c.state, t = e.child) : t = Fe(
          t,
          e,
          r
        ), t;
      }
      function sc(t, e, a, l) {
        return Oe(), e.flags |= 256, $t(t, e, a, l), e.child;
      }
      function dr(t) {
        return { baseLanes: t, cachePool: ns() };
      }
      function mr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= we), t;
      }
      function cc(t, e, a) {
        var l = e.pendingProps, r = !1, c = (e.flags & 128) !== 0, m;
        if ((m = c) || (m = t !== null && t.memoizedState === null ? !1 : (Bt.current & 2) !== 0), m && (r = !0, e.flags &= -129), m = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (yt) {
            if (r ? pa(e) : ha(), (t = At) ? (t = op(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = au(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw ut(e);
            return Jr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var v = l.children;
          return l = l.fallback, r ? (ha(), r = e.mode, v = Hl(
            { mode: "hidden", children: v },
            r
          ), l = Ga(
            l,
            r,
            a,
            null
          ), v.return = e, l.return = e, v.sibling = l, e.child = v, l = e.child, l.memoizedState = dr(a), l.childLanes = mr(
            t,
            m,
            a
          ), e.memoizedState = uo, Qn(null, l)) : (pa(e), fr(e, v));
        }
        var O = t.memoizedState;
        if (O !== null && (v = O.dehydrated, v !== null)) {
          if (c)
            e.flags & 256 ? (pa(e), e.flags &= -257, e = pr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ha(), e.child = t.child, e.flags |= 128, e = null) : (ha(), v = l.fallback, r = e.mode, l = Hl(
              { mode: "visible", children: l.children },
              r
            ), v = Ga(
              v,
              r,
              a,
              null
            ), v.flags |= 2, l.return = e, v.return = e, l.sibling = v, e.child = l, La(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = dr(a), l.childLanes = mr(
              t,
              m,
              a
            ), e.memoizedState = uo, e = Qn(null, l));
          else if (pa(e), Jr(v))
            m = Lf(v).digest, l = Error(u(419)), l.stack = "", l.digest = m, Rn({ value: l, source: null, stack: null }), e = pr(
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
            if (m = Tt, m !== null && (l = J(
              m,
              a
            ), l !== 0 && l !== O.retryLane))
              throw O.retryLane = l, Ua(t, l), se(m, t, l), co;
            Zr(v) || Gl(), e = pr(
              t,
              e,
              a
            );
          } else
            Zr(v) ? (e.flags |= 192, e.child = t.child, e = null) : (t = O.treeContext, le && (At = ap(
              v
            ), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = fr(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ha(), v = l.fallback, r = e.mode, O = t.child, c = O.sibling, l = Pe(O, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = O.subtreeFlags & 65011712, c !== null ? v = Pe(
          c,
          v
        ) : (v = Ga(
          v,
          r,
          a,
          null
        ), v.flags |= 2), v.return = e, l.return = e, l.sibling = v, e.child = l, Qn(null, l), l = e.child, v = t.child.memoizedState, v === null ? v = dr(a) : (r = v.cachePool, r !== null ? (O = ta ? Ot._currentValue : Ot._currentValue2, r = r.parent !== O ? { parent: O, pool: O } : r) : r = ns(), v = {
          baseLanes: v.baseLanes | a,
          cachePool: r
        }), l.memoizedState = v, l.childLanes = mr(
          t,
          m,
          a
        ), e.memoizedState = uo, Qn(t.child, l)) : (pa(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (m = e.deletions, m === null ? (e.deletions = [t], e.flags |= 16) : m.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function fr(t, e) {
        return e = Hl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Hl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function pr(t, e, a) {
        return La(e, t.child, null, a), t = fr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function uc(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), Hi(t.return, e, a);
      }
      function hr(t, e, a, l, r, c) {
        var m = t.memoizedState;
        m === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: r,
          treeForkCount: c
        } : (m.isBackwards = e, m.rendering = null, m.renderingStartTime = 0, m.last = l, m.tail = a, m.tailMode = r, m.treeForkCount = c);
      }
      function dc(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, c = l.tail;
        l = l.children;
        var m = Bt.current, v = (m & 2) !== 0;
        if (v ? (m = m & 1 | 2, e.flags |= 128) : m &= 1, z(Bt, m), $t(t, e, l, a), l = yt ? Pn : 0, !v && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && uc(t, a, e);
            else if (t.tag === 19)
              uc(t, a, e);
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
              t = a.alternate, t !== null && kl(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), hr(
              e,
              !1,
              r,
              a,
              c,
              l
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && kl(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            hr(
              e,
              !0,
              a,
              null,
              c,
              l
            );
            break;
          case "together":
            hr(
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
        if (t !== null && (e.dependencies = t.dependencies), ka |= e.lanes, (a & e.childLanes) === 0)
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
          throw Error(u(153));
        if (e.child !== null) {
          for (t = e.child, a = Pe(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Pe(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function gr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && hl(t)));
      }
      function qm(t, e, a) {
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
              return e.flags |= 128, Zi(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (pa(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? cc(
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
                return dc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), z(Bt, Bt.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, nc(
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
      function mc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Yt = !0;
          else {
            if (!gr(t, a) && (e.flags & 128) === 0)
              return Yt = !1, qm(
                t,
                e,
                a
              );
            Yt = (t.flags & 131072) !== 0;
          }
        else
          Yt = !1, yt && (e.flags & 1048576) !== 0 && b(e, Pn, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = Da(e.elementType), e.type = t, typeof t == "function")
                Or(t) ? (l = Ba(t, l), e.tag = 1, e = oc(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = ur(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === qr) {
                    e.tag = 11, e = tc(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Qr) {
                    e.tag = 14, e = ec(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  }
                }
                throw e = H(t) || t, Error(u(306, e, ""));
              }
            }
            return e;
          case 0:
            return ur(
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
            ), oc(
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
              ), t === null) throw Error(u(387));
              var c = e.pendingProps;
              r = e.memoizedState, l = r.element, Qi(t, e), qn(e, c, null, a);
              var m = e.memoizedState;
              if (c = m.cache, da(e, Ot, c), c !== r.cache && Di(
                e,
                [Ot],
                a,
                !0
              ), Bn(), c = m.element, le && r.isDehydrated)
                if (r = {
                  element: c,
                  isDehydrated: !1,
                  cache: m.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = sc(
                    t,
                    e,
                    c,
                    a
                  );
                  break t;
                } else if (c !== l) {
                  l = U(
                    Error(u(424)),
                    e
                  ), Rn(l), e = sc(
                    t,
                    e,
                    c,
                    a
                  );
                  break t;
                } else
                  for (le && (At = tp(
                    e.stateNode.containerInfo
                  ), te = e, yt = !0, _a = null, Ne = !0), a = qu(
                    e,
                    null,
                    c,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Oe(), c === l) {
                  e = Fe(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                $t(t, e, c, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Ue)
              return Rl(t, e), t === null ? (a = ku(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : yt || (e.stateNode = Np(
                e.type,
                e.pendingProps,
                wa.current,
                e
              )) : e.memoizedState = ku(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return xt(e), t === null && Vt && yt && (l = e.stateNode = Mu(
                e.type,
                e.pendingProps,
                wa.current,
                Pt.current,
                !1
              ), te = e, Ne = !0, At = np(
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
            return t === null && yt && (zp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = l = At) && (l = lp(
              l,
              e.type,
              e.pendingProps,
              Ne
            ), l !== null ? (e.stateNode = l, te = e, At = Pf(l), Ne = !1, r = !0) : r = !1), r || ut(e)), xt(e), r = e.type, c = e.pendingProps, m = t !== null ? t.memoizedProps : null, l = c.children, Zl(r, c) ? l = null : m !== null && Zl(r, m) && (e.flags |= 32), e.memoizedState !== null && (r = Li(
              t,
              e,
              Mm,
              null,
              null,
              a
            ), ta ? Ka._currentValue = r : Ka._currentValue2 = r), Rl(t, e), $t(t, e, l, a), e.child;
          case 6:
            return t === null && yt && (kp(
              e.pendingProps,
              Pt.current
            ), (t = a = At) && (a = ip(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, te = e, At = null, t = !0) : t = !1), t || ut(e)), null;
          case 13:
            return cc(t, e, a);
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
            return tc(
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
            return ec(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return ac(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return dc(
              t,
              e,
              a
            );
          case 31:
            return Bm(t, e, a);
          case 22:
            return nc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ha(e), l = It(Ot), t === null ? (r = qi(), r === null && (r = Tt, c = Ui(), r.pooledCache = c, c.refCount++, c !== null && (r.pooledCacheLanes |= a), r = c), e.memoizedState = {
              parent: l,
              cache: r
            }, Gi(e), da(e, Ot, r)) : ((t.lanes & a) !== 0 && (Qi(t, e), qn(e, null, null, a), Bn()), r = t.memoizedState, c = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), da(e, Ot, l)) : (l = c.cache, da(e, Ot, l), l !== r.cache && Di(
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
        throw Error(u(156, e.tag));
      }
      function Re(t) {
        t.flags |= 4;
      }
      function Dl(t) {
        Ke && (t.flags |= 8);
      }
      function fc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function br(t, e, a, l) {
        if (ne)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Vr(t, a.stateNode);
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
              var c = r.stateNode;
              a && l && (c = xu(
                c,
                r.type,
                r.memoizedProps
              )), Vr(t, c);
            } else if (r.tag === 6)
              c = r.stateNode, a && l && (c = wu(
                c,
                r.memoizedProps
              )), Vr(t, c);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                c = r.child, c !== null && (c.return = r), br(t, r, !0, !0);
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
      function pc(t, e, a, l) {
        var r = !1;
        if (Ke)
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var m = c.stateNode;
              a && l && (m = xu(
                m,
                c.type,
                c.memoizedProps
              )), vu(t, m);
            } else if (c.tag === 6)
              m = c.stateNode, a && l && (m = wu(
                m,
                c.memoizedProps
              )), vu(t, m);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                r = c.child, r !== null && (r.return = c), pc(t, c, !0, !0), r = !0;
              else if (c.child !== null) {
                c.child.return = c, c = c.child;
                continue;
              }
            }
            if (c === e) break;
            for (; c.sibling === null; ) {
              if (c.return === null || c.return === e)
                return r;
              c = c.return;
            }
            c.sibling.return = c.return, c = c.sibling;
          }
        return r;
      }
      function hc(t, e) {
        if (Ke && fc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = bu();
          pc(l, e, !1, !1), t.pendingChildren = l, Re(e), Jf(a, l);
        }
      }
      function vr(t, e, a, l) {
        if (ne)
          t.memoizedProps !== l && Re(e);
        else if (Ke) {
          var r = t.stateNode, c = t.memoizedProps;
          if ((t = fc(t, e)) || c !== l) {
            var m = Pt.current;
            c = Zf(
              r,
              a,
              c,
              l,
              !t,
              null
            ), c === r ? e.stateNode = r : (Dl(e), mu(
              c,
              a,
              l,
              m
            ) && Re(e), e.stateNode = c, t && br(c, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function yr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? yf(e, l) : xf(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Xr(e, l))
            if (pu(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Gc()) t.flags |= 8192;
            else
              throw Ja = ni, lo;
        } else t.flags &= -16777217;
      }
      function gc(t, e) {
        if (Cp(e)) {
          if (t.flags |= 16777216, !ju(e))
            if (Gc()) t.flags |= 8192;
            else
              throw Ja = ni, lo;
        } else t.flags &= -16777217;
      }
      function Ul(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? M() : 536870912, t.lanes |= e, Cn |= e);
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
      function Ct(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, l = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= l, t.childLanes = a, e;
      }
      function Ym(t, e, a) {
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
            return Ct(e), null;
          case 1:
            return Ct(e), null;
          case 3:
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Le(Ot), lt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ae(e) ? Re(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ua())), hc(t, e), Ct(e), null;
          case 26:
            if (Ue) {
              var r = e.type, c = e.memoizedState;
              return t === null ? (Re(e), c !== null ? (Ct(e), gc(
                e,
                c
              )) : (Ct(e), yr(
                e,
                r,
                null,
                l,
                a
              ))) : c ? c !== t.memoizedState ? (Re(e), Ct(e), gc(
                e,
                c
              )) : (Ct(e), e.flags &= -16777217) : (c = t.memoizedProps, ne ? c !== l && Re(e) : vr(
                t,
                e,
                r,
                l
              ), Ct(e), yr(
                e,
                r,
                c,
                l,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Jt(e), a = wa.current, r = e.type, t !== null && e.stateNode != null)
                ne ? t.memoizedProps !== l && Re(e) : vr(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(u(166));
                  return Ct(e), null;
                }
                t = Pt.current, Ae(e) ? Oa(e, t) : (t = Mu(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Re(e));
              }
              return Ct(e), null;
            }
          case 5:
            if (Jt(e), r = e.type, t !== null && e.stateNode != null)
              vr(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(u(166));
                return Ct(e), null;
              }
              if (c = Pt.current, Ae(e))
                Oa(e, c), vp(
                  e.stateNode,
                  r,
                  l,
                  c
                ) && (e.flags |= 64);
              else {
                var m = df(
                  r,
                  l,
                  wa.current,
                  c,
                  e
                );
                Dl(e), br(m, e, !1, !1), e.stateNode = m, mu(
                  m,
                  r,
                  l,
                  c
                ) && Re(e);
              }
            }
            return Ct(e), yr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ne ? a !== l && Re(e) : Ke && (a !== l ? (t = wa.current, a = Pt.current, Dl(e), e.stateNode = fu(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(u(166));
              if (t = wa.current, a = Pt.current, Ae(e)) {
                if (!le) throw Error(u(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                cp(
                  t,
                  a,
                  e,
                  l
                ) || ut(e, !0);
              } else
                Dl(e), e.stateNode = fu(
                  l,
                  t,
                  a,
                  e
                );
            }
            return Ct(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = Ae(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(u(318));
                  if (!le) throw Error(u(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(u(557));
                  up(t, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ct(e), t = !1;
              } else
                a = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(u(558));
            }
            return Ct(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ae(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(u(318));
                  if (!le) throw Error(u(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(u(317));
                  dp(r, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ct(e), r = !1;
              } else
                r = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
            }
            return fe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), c = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (c = l.memoizedState.cachePool.pool), c !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Ul(e, e.updateQueue), Ct(e), null);
          case 4:
            return lt(), hc(t, e), t === null && hf(e.stateNode.containerInfo), Ct(e), null;
          case 10:
            return Le(e.type), Ct(e), null;
          case 19:
            if (y(Bt), l = e.memoizedState, l === null) return Ct(e), null;
            if (r = (e.flags & 128) !== 0, c = l.rendering, c === null)
              if (r) Kn(l, !1);
              else {
                if (Dt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (c = kl(t), c !== null) {
                      for (e.flags |= 128, Kn(l, !1), t = c.updateQueue, e.updateQueue = t, Ul(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        eu(a, t), a = a.sibling;
                      return z(
                        Bt,
                        Bt.current & 1 | 2
                      ), yt && B(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && ce() > ol && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = kl(c), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Ul(e, t), Kn(l, !0), l.tail === null && l.tailMode === "hidden" && !c.alternate && !yt)
                    return Ct(e), null;
                } else
                  2 * ce() - l.renderingStartTime > ol && a !== 536870912 && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              l.isBackwards ? (c.sibling = e.child, e.child = c) : (t = l.last, t !== null ? t.sibling = c : e.child = c, l.last = c);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = ce(), t.sibling = null, a = Bt.current, z(
              Bt,
              r ? a & 1 | 2 : a & 1
            ), yt && B(e, l.treeForkCount), t) : (Ct(e), null);
          case 22:
          case 23:
            return fe(e), Xi(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Ct(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ct(e), a = e.updateQueue, a !== null && Ul(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && y(Za), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(Ot), Ct(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(u(156, e.tag));
      }
      function Gm(t, e) {
        switch (tt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Le(Ot), lt(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Jt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (fe(e), e.alternate === null)
                throw Error(u(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (fe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(u(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return y(Bt), null;
          case 4:
            return lt(), null;
          case 10:
            return Le(e.type), null;
          case 22:
          case 23:
            return fe(e), Xi(), t !== null && y(Za), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(Ot), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function bc(t, e) {
        switch (tt(e), e.tag) {
          case 3:
            Le(Ot), lt();
            break;
          case 26:
          case 27:
          case 5:
            Jt(e);
            break;
          case 4:
            lt();
            break;
          case 31:
            e.memoizedState !== null && fe(e);
            break;
          case 13:
            fe(e);
            break;
          case 19:
            y(Bt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            fe(e), Xi(), t !== null && y(Za);
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
                var c = a.create, m = a.inst;
                l = c(), m.destroy = l;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (v) {
          wt(e, e.return, v);
        }
      }
      function ga(t, e, a) {
        try {
          var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
          if (r !== null) {
            var c = r.next;
            l = c;
            do {
              if ((l.tag & t) === t) {
                var m = l.inst, v = m.destroy;
                if (v !== void 0) {
                  m.destroy = void 0, r = e;
                  var O = a, Q = v;
                  try {
                    Q();
                  } catch (Z) {
                    wt(
                      r,
                      O,
                      Z
                    );
                  }
                }
              }
              l = l.next;
            } while (l !== c);
          }
        } catch (Z) {
          wt(e, e.return, Z);
        }
      }
      function vc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            ds(e, a);
          } catch (l) {
            wt(t, t.return, l);
          }
        }
      }
      function yc(t, e, a) {
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
      function xc(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          Hf(l, e, a, t);
        } catch (r) {
          wt(t, t.return, r);
        }
      }
      function xr(t, e, a) {
        try {
          Df(
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
      function wc(t) {
        return t.tag === 5 || t.tag === 3 || (Ue ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && fn(t.type) : !1) || t.tag === 4;
      }
      function wr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || wc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && fn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function _r(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Bf(a, t, e) : Of(a, t);
        else if (l !== 4 && (Vt && l === 27 && fn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (_r(t, e, a), t = t.sibling; t !== null; )
            _r(t, e, a), t = t.sibling;
      }
      function Bl(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Uf(a, t, e) : Af(a, t);
        else if (l !== 4 && (Vt && l === 27 && fn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Bl(t, e, a), t = t.sibling; t !== null; )
            Bl(t, e, a), t = t.sibling;
      }
      function _c(t, e, a) {
        t = t.containerInfo;
        try {
          yu(t, a);
        } catch (l) {
          wt(e, e.return, l);
        }
      }
      function Sc(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Mp(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          wt(t, t.return, l);
        }
      }
      function Qm(t, e) {
        for (cf(t.containerInfo), Wt = e; Wt !== null; )
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
                    var c = l.stateNode;
                    try {
                      var m = Ba(
                        l.type,
                        r
                      );
                      e = c.getSnapshotBeforeUpdate(
                        m,
                        a
                      ), c.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (v) {
                      wt(l, l.return, v);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ne && Xf(t.stateNode.containerInfo);
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
                    throw Error(u(163));
              }
              if (e = t.sibling, e !== null) {
                e.return = t.return, Wt = e;
                break;
              }
              Wt = t.return;
            }
      }
      function zc(t, e, a) {
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
            l & 64 && vc(a), l & 512 && Xn(a, a.return);
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
                ds(l, t);
              } catch (m) {
                wt(a, a.return, m);
              }
            }
            break;
          case 27:
            Vt && e === null && l & 4 && Sc(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (l & 4) xc(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  pp(
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
            Ie(t, a), l & 4 && Ec(t, a);
            break;
          case 13:
            Ie(t, a), l & 4 && Nc(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = Wm.bind(
              null,
              a
            ), Wf(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || la, !l) {
              e = e !== null && e.memoizedState !== null || Gt, r = la;
              var c = Gt;
              la = l, (Gt = e) && !c ? $e(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Ie(t, a), la = r, Gt = c;
            }
            break;
          case 30:
            break;
          default:
            Ie(t, a);
        }
      }
      function kc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, kc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && vf(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, a) {
        for (a = a.child; a !== null; )
          Sr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Sr(t, e, a) {
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
              ), a.memoizedState ? Nu(a.memoizedState) : a.stateNode && Cu(a.stateNode);
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
              ), Au(a.stateNode), Qt = l, ue = r;
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
                    Yf(Qt, a.stateNode);
                  } catch (c) {
                    wt(
                      a,
                      e,
                      c
                    );
                  }
                else
                  try {
                    qf(Qt, a.stateNode);
                  } catch (c) {
                    wt(
                      a,
                      e,
                      c
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
            ne && Qt !== null && (ue ? wp(
              Qt,
              a.stateNode
            ) : xp(Qt, a.stateNode));
            break;
          case 4:
            ne ? (l = Qt, r = ue, Qt = a.stateNode.containerInfo, ue = !0, He(
              t,
              e,
              a
            ), Qt = l, ue = r) : (Ke && _c(
              a.stateNode,
              a,
              bu()
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
            Gt || (Qe(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && yc(
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
      function Ec(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            gp(t);
          } catch (a) {
            wt(e, e.return, a);
          }
        }
      }
      function Nc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            bp(t);
          } catch (a) {
            wt(e, e.return, a);
          }
      }
      function Km(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Qu()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Qu()), e;
          default:
            throw Error(u(435, t.tag));
        }
      }
      function ql(t, e) {
        var a = Km(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = Fm.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ae(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], c = t, m = e;
            if (ne) {
              var v = m;
              t: for (; v !== null; ) {
                switch (v.tag) {
                  case 27:
                    if (Vt) {
                      if (fn(v.type)) {
                        Qt = v.stateNode, ue = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = v.stateNode, ue = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = v.stateNode.containerInfo, ue = !0;
                    break t;
                }
                v = v.return;
              }
              if (Qt === null) throw Error(u(160));
              Sr(c, m, r), Qt = null, ue = !1;
            } else Sr(c, m, r);
            c = r.alternate, c !== null && (c.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Tc(e, t), e = e.sibling;
      }
      function Tc(t, e) {
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
                var c = t.memoizedState;
                a === null ? c === null ? t.stateNode === null ? t.stateNode = Ep(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Tu(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Eu(
                  r,
                  c,
                  t.memoizedProps
                ) : l !== c ? (l === null ? a.stateNode !== null && Cu(a.stateNode) : Nu(l), c === null ? Tu(
                  r,
                  t.type,
                  t.stateNode
                ) : Eu(
                  r,
                  c,
                  t.memoizedProps
                )) : c === null && t.stateNode !== null && xr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ae(e, t), oe(t), l & 512 && (Gt || a === null || Qe(a, a.return)), a !== null && l & 4 && xr(
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
                  gu(r);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, xr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (mo = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ae(e, t), oe(t), l & 4 && ne) {
              if (t.stateNode === null)
                throw Error(u(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                Rf(r, a, l);
              } catch (V) {
                wt(t, t.return, V);
              }
            }
            break;
          case 3:
            if (Ue ? (Tp(), r = Be, Be = Lr(e.containerInfo), ae(e, t), Be = r) : ae(e, t), oe(t), l & 4) {
              if (ne && le && a !== null && a.memoizedState.isDehydrated)
                try {
                  hp(e.containerInfo);
                } catch (V) {
                  wt(t, t.return, V);
                }
              if (Ke) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  yu(l, a);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
            }
            mo && (mo = !1, Cc(t));
            break;
          case 4:
            Ue ? (a = Be, Be = Lr(
              t.stateNode.containerInfo
            ), ae(e, t), oe(t), Be = a) : (ae(e, t), oe(t)), l & 4 && Ke && _c(
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
            var m = a !== null && a.memoizedState !== null, v = la, O = Gt;
            if (la = v || r, Gt = O || m, ae(e, t), Gt = O, la = v, oe(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || m || la || Gt || qa(t)), ne)) {
              t: if (a = null, ne)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ue && e.tag === 26) {
                    if (a === null) {
                      m = a = e;
                      try {
                        c = m.stateNode, r ? Gf(c) : Kf(
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
                        r ? Qf(Q) : Vf(Q, m.memoizedProps);
                      } catch (V) {
                        wt(m, m.return, V);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      m = e;
                      try {
                        var Z = m.stateNode;
                        r ? _p(Z) : Sp(m.stateNode);
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
              if (wc(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (ne) {
              if (a == null) throw Error(u(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, c = wr(t);
                    Bl(t, c, r);
                    break;
                  }
                case 5:
                  var m = a.stateNode;
                  a.flags & 32 && (gu(m), a.flags &= -33);
                  var v = wr(t);
                  Bl(t, v, m);
                  break;
                case 3:
                case 4:
                  var O = a.stateNode.containerInfo, Q = wr(t);
                  _r(
                    t,
                    Q,
                    O
                  );
                  break;
                default:
                  throw Error(u(161));
              }
            }
          } catch (Z) {
            wt(t, t.return, Z);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Cc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Cc(e), e.tag === 5 && e.flags & 1024 && Sf(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            zc(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && yc(
                e,
                e.return,
                a
              ), qa(e);
              break;
            case 27:
              Vt && Au(e.stateNode);
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
          var l = e.alternate, r = t, c = e, m = c.flags;
          switch (c.tag) {
            case 0:
            case 11:
            case 15:
              $e(
                r,
                c,
                a
              ), Vn(4, c);
              break;
            case 1:
              if ($e(
                r,
                c,
                a
              ), l = c, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (Q) {
                  wt(l, l.return, Q);
                }
              if (l = c, r = l.updateQueue, r !== null) {
                var v = l.stateNode;
                try {
                  var O = r.shared.hiddenCallbacks;
                  if (O !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < O.length; r++)
                      us(O[r], v);
                } catch (Q) {
                  wt(l, l.return, Q);
                }
              }
              a && m & 64 && vc(c), Xn(c, c.return);
              break;
            case 27:
              Vt && Sc(c);
            case 26:
            case 5:
              $e(
                r,
                c,
                a
              ), a && l === null && m & 4 && xc(c), Xn(c, c.return);
              break;
            case 12:
              $e(
                r,
                c,
                a
              );
              break;
            case 31:
              $e(
                r,
                c,
                a
              ), a && m & 4 && Ec(r, c);
              break;
            case 13:
              $e(
                r,
                c,
                a
              ), a && m & 4 && Nc(r, c);
              break;
            case 22:
              c.memoizedState === null && $e(
                r,
                c,
                a
              ), Xn(c, c.return);
              break;
            case 30:
              break;
            default:
              $e(
                r,
                c,
                a
              );
          }
          e = e.sibling;
        }
      }
      function zr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Hn(a));
      }
      function kr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Hn(t));
      }
      function De(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            jc(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function jc(t, e, a, l) {
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
                var c = e.memoizedProps, m = c.id, v = c.onPostCommit;
                typeof v == "function" && v(
                  m,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (O) {
                wt(e, e.return, O);
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
            c = e.stateNode, m = e.alternate, e.memoizedState !== null ? c._visibility & 2 ? De(
              t,
              e,
              a,
              l
            ) : Zn(
              t,
              e
            ) : c._visibility & 2 ? De(
              t,
              e,
              a,
              l
            ) : (c._visibility |= 2, on(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && zr(m, e);
            break;
          case 24:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && kr(e.alternate, e);
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
          var c = t, m = e, v = a, O = l, Q = m.flags;
          switch (m.tag) {
            case 0:
            case 11:
            case 15:
              on(
                c,
                m,
                v,
                O,
                r
              ), Vn(8, m);
              break;
            case 23:
              break;
            case 22:
              var Z = m.stateNode;
              m.memoizedState !== null ? Z._visibility & 2 ? on(
                c,
                m,
                v,
                O,
                r
              ) : Zn(
                c,
                m
              ) : (Z._visibility |= 2, on(
                c,
                m,
                v,
                O,
                r
              )), r && Q & 2048 && zr(
                m.alternate,
                m
              );
              break;
            case 24:
              on(
                c,
                m,
                v,
                O,
                r
              ), r && Q & 2048 && kr(m.alternate, m);
              break;
            default:
              on(
                c,
                m,
                v,
                O,
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
                Zn(a, l), r & 2048 && zr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Zn(a, l), r & 2048 && kr(
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
            Mc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Mc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ya(
              t,
              e,
              a
            ), t.flags & Nn)
              if (t.memoizedState !== null)
                jp(
                  a,
                  Be,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Xr(r, t)) && hu(a, l, r, t);
              }
            break;
          case 5:
            Ya(
              t,
              e,
              a
            ), t.flags & Nn && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Xr(r, t)) && hu(a, l, r, t));
            break;
          case 3:
          case 4:
            Ue ? (l = Be, Be = Lr(
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
      function Ac(t) {
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
              Wt = l, Rc(
                l,
                t
              );
            }
          Ac(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Oc(t), t = t.sibling;
      }
      function Oc(t) {
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
              Wt = l, Rc(
                l,
                t
              );
            }
          Ac(t);
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
      function Rc(t, e) {
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
              var r = l.sibling, c = l.return;
              if (kc(l), l === a) {
                Wt = null;
                break t;
              }
              if (r !== null) {
                r.return = c, Wt = r;
                break t;
              }
              Wt = c;
            }
        }
      }
      function Er(t) {
        var e = pf(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(u(364));
          return e;
        }
        if (t = Ef(t), t === null) throw Error(u(362));
        return t.stateNode.current;
      }
      function Nr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case oi:
            if (t.type === e.value) return !0;
            break;
          case si:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, c = t[a++], m = e[c];
                if (r !== 5 && r !== 26 && r !== 27 || !In(l)) {
                  for (; m != null && Nr(l, m); )
                    c++, m = e[c];
                  if (c === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (l = l.child; l !== null; )
                      t.push(l, c), l = l.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ci:
            if ((a === 5 || a === 26 || a === 27) && Cf(t.stateNode, e.value))
              return !0;
            break;
          case di:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Tf(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ui:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(u(365));
        }
        return !1;
      }
      function Tr(t) {
        switch (t.$$typeof) {
          case oi:
            return "<" + (H(t.value) || "Unknown") + ">";
          case si:
            return ":has(" + (Tr(t) || "") + ")";
          case ci:
            return '[role="' + t.value + '"]';
          case di:
            return '"' + t.value + '"';
          case ui:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(u(365));
        }
      }
      function Hc(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], c = r.tag, m = t[l++], v = e[m];
          if (c !== 5 && c !== 26 && c !== 27 || !In(r)) {
            for (; v != null && Nr(r, v); )
              m++, v = e[m];
            if (m === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, m), r = r.sibling;
          }
        }
        return a;
      }
      function Cr(t, e) {
        if (!Fn) throw Error(u(363));
        t = Er(t), t = Hc(t, e), e = [], t = Array.from(t);
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
        return (gt & 2) !== 0 && vt !== 0 ? vt & -vt : it.T !== null ? Bi() : gf();
      }
      function Dc() {
        if (we === 0)
          if ((vt & 536870912) === 0 || yt) {
            var t = Ll;
            Ll <<= 1, (Ll & 3932160) === 0 && (Ll = 262144), we = t;
          } else we = 536870912;
        return t = ye.current, t !== null && (t.flags |= 32), we;
      }
      function se(t, e, a) {
        (t === Tt && (kt === 2 || kt === 9) || t.cancelPendingCommit !== null) && (sn(t, 0), ba(
          t,
          vt,
          we,
          !1
        )), C(t, a), ((gt & 2) === 0 || t !== Tt) && (t === Tt && ((gt & 2) === 0 && (Fa |= a), Dt === 4 && ba(
          t,
          vt,
          we,
          !1
        )), Ge(t));
      }
      function Uc(t, e, a) {
        if ((gt & 6) !== 0) throw Error(u(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || E(t, e), r = l ? Zm(t, e) : Mr(t, e, !0), c = l;
        do {
          if (r === 0) {
            Tn && !l && ba(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, c && !Vm(a)) {
              r = Mr(t, e, !1), c = !1;
              continue;
            }
            if (r === 2) {
              if (c = e, t.errorRecoveryDisabledLanes & c)
                var m = 0;
              else
                m = t.pendingLanes & -536870913, m = m !== 0 ? m : m & 536870912 ? 536870912 : 0;
              if (m !== 0) {
                e = m;
                t: {
                  var v = t;
                  r = rl;
                  var O = le && v.current.memoizedState.isDehydrated;
                  if (O && (sn(v, m).flags |= 256), m = Mr(
                    v,
                    m,
                    !1
                  ), m !== 2) {
                    if (fo && !O) {
                      v.errorRecoveryDisabledLanes |= c, Fa |= c, r = 4;
                      break t;
                    }
                    c = de, de = r, c !== null && (de === null ? de = c : de.push.apply(
                      de,
                      c
                    ));
                  }
                  r = m;
                }
                if (c = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              sn(t, 0), ba(t, e, 0, !0);
              break;
            }
            t: {
              switch (l = t, c = r, c) {
                case 0:
                case 1:
                  throw Error(u(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  ba(
                    l,
                    e,
                    we,
                    !za
                  );
                  break t;
                case 2:
                  de = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(u(329));
              }
              if ((e & 62914560) === e && (r = mi + 300 - ce(), 10 < r)) {
                if (ba(
                  l,
                  e,
                  we,
                  !za
                ), Y(l, 0, !0) !== 0) break t;
                ra = e, l.timeoutHandle = mf(
                  Bc.bind(
                    null,
                    l,
                    a,
                    de,
                    fi,
                    ho,
                    e,
                    we,
                    Fa,
                    Cn,
                    za,
                    c,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Bc(
                l,
                a,
                de,
                fi,
                ho,
                e,
                we,
                Fa,
                Cn,
                za,
                c,
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
      function Bc(t, e, a, l, r, c, m, v, O, Q, Z, V, L, dt) {
        if (t.timeoutHandle = Qa, V = e.subtreeFlags, V & 8192 || (V & 16785408) === 16785408) {
          V = wf(), Mc(
            e,
            c,
            V
          );
          var ee = (c & 62914560) === c ? mi - ce() : (c & 4194048) === c ? Ku - ce() : 0;
          if (ee = _f(
            V,
            ee
          ), ee !== null) {
            ra = c, t.cancelPendingCommit = ee(
              Jc.bind(
                null,
                t,
                e,
                c,
                a,
                l,
                r,
                m,
                v,
                O,
                Z,
                V,
                null,
                L,
                dt
              )
            ), ba(t, c, m, !Q);
            return;
          }
        }
        Jc(
          t,
          e,
          c,
          a,
          l,
          r,
          m,
          v,
          O
        );
      }
      function Vm(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var l = 0; l < a.length; l++) {
              var r = a[l], c = r.getSnapshot;
              r = r.value;
              try {
                if (!ve(c(), r)) return !1;
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
        e &= ~po, e &= ~Fa, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var c = 31 - ge(r), m = 1 << c;
          l[c] = -1, r &= ~m;
        }
        a !== 0 && h(t, a, e);
      }
      function qc() {
        return (gt & 6) === 0 ? (ln(0), !1) : !0;
      }
      function jr() {
        if (bt !== null) {
          if (kt === 0)
            var t = bt.return;
          else
            t = bt, aa = Va = null, Ii(t), _n = null, al = 0, t = bt;
          for (; t !== null; )
            bc(t.alternate, t), t = t.return;
          bt = null;
        }
      }
      function sn(t, e) {
        var a = t.timeoutHandle;
        a !== Qa && (t.timeoutHandle = Qa, ff(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, jr(), Tt = t, bt = a = Pe(t.current, null), vt = e, kt = 0, xe = null, za = !1, Tn = E(t, e), fo = !1, Cn = we = po = Fa = ka = Dt = 0, de = rl = null, ho = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - ge(l), c = 1 << r;
            e |= t[r], l &= ~c;
          }
        return ia = e, _l(), a;
      }
      function Yc(t, e) {
        mt = null, it.H = ll, e === wn || e === ai ? (e = rs(), kt = 3) : e === lo ? (e = rs(), kt = 4) : kt = e === co ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, xe = e, bt === null && (Dt = 1, Al(
          t,
          U(e, t.current)
        ));
      }
      function Gc() {
        var t = ye.current;
        return t === null ? !0 : (vt & 4194048) === vt ? Ce === null : (vt & 62914560) === vt || (vt & 536870912) !== 0 ? t === Ce : !1;
      }
      function Qc() {
        var t = it.H;
        return it.H = ll, t === null ? ll : t;
      }
      function Kc() {
        var t = it.A;
        return it.A = Xp, t;
      }
      function Gl() {
        Dt = 4, za || (vt & 4194048) !== vt && ye.current !== null || (Tn = !0), (ka & 134217727) === 0 && (Fa & 134217727) === 0 || Tt === null || ba(
          Tt,
          vt,
          we,
          !1
        );
      }
      function Mr(t, e, a) {
        var l = gt;
        gt |= 2;
        var r = Qc(), c = Kc();
        (Tt !== t || vt !== e) && (fi = null, sn(t, e)), e = !1;
        var m = Dt;
        t: do
          try {
            if (kt !== 0 && bt !== null) {
              var v = bt, O = xe;
              switch (kt) {
                case 8:
                  jr(), m = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ye.current === null && (e = !0);
                  var Q = kt;
                  if (kt = 0, xe = null, cn(t, v, O, Q), a && Tn) {
                    m = 0;
                    break t;
                  }
                  break;
                default:
                  Q = kt, kt = 0, xe = null, cn(t, v, O, Q);
              }
            }
            Xm(), m = Dt;
            break;
          } catch (Z) {
            Yc(t, Z);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Va = null, gt = l, it.H = r, it.A = c, bt === null && (Tt = null, vt = 0, _l()), m;
      }
      function Xm() {
        for (; bt !== null; ) Vc(bt);
      }
      function Zm(t, e) {
        var a = gt;
        gt |= 2;
        var l = Qc(), r = Kc();
        Tt !== t || vt !== e ? (fi = null, ol = ce() + 500, sn(t, e)) : Tn = E(
          t,
          e
        );
        t: do
          try {
            if (kt !== 0 && bt !== null) {
              e = bt;
              var c = xe;
              e: switch (kt) {
                case 1:
                  kt = 0, xe = null, cn(t, e, c, 1);
                  break;
                case 2:
                case 9:
                  if (ls(c)) {
                    kt = 0, xe = null, Xc(e);
                    break;
                  }
                  e = function() {
                    kt !== 2 && kt !== 9 || Tt !== t || (kt = 7), Ge(t);
                  }, c.then(e, e);
                  break t;
                case 3:
                  kt = 7;
                  break t;
                case 4:
                  kt = 5;
                  break t;
                case 7:
                  ls(c) ? (kt = 0, xe = null, Xc(e)) : (kt = 0, xe = null, cn(t, e, c, 7));
                  break;
                case 5:
                  var m = null;
                  switch (bt.tag) {
                    case 26:
                      m = bt.memoizedState;
                    case 5:
                    case 27:
                      var v = bt, O = v.type, Q = v.pendingProps;
                      if (m ? ju(m) : pu(v.stateNode, O, Q)) {
                        kt = 0, xe = null;
                        var Z = v.sibling;
                        if (Z !== null) bt = Z;
                        else {
                          var V = v.return;
                          V !== null ? (bt = V, Ql(V)) : bt = null;
                        }
                        break e;
                      }
                  }
                  kt = 0, xe = null, cn(t, e, c, 5);
                  break;
                case 6:
                  kt = 0, xe = null, cn(t, e, c, 6);
                  break;
                case 8:
                  jr(), Dt = 6;
                  break t;
                default:
                  throw Error(u(462));
              }
            }
            Jm();
            break;
          } catch (L) {
            Yc(t, L);
          }
        while (!0);
        return aa = Va = null, it.H = l, it.A = r, gt = a, bt !== null ? 0 : (Tt = null, vt = 0, _l(), Dt);
      }
      function Jm() {
        for (; bt !== null && !Rp(); )
          Vc(bt);
      }
      function Vc(t) {
        var e = mc(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function Xc(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = rc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              vt
            );
            break;
          case 11:
            e = rc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              vt
            );
            break;
          case 5:
            Ii(e);
          default:
            bc(a, e), e = bt = eu(e, ia), e = mc(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function cn(t, e, a, l) {
        aa = Va = null, Ii(e), _n = null, al = 0;
        var r = e.return;
        try {
          if (Um(
            t,
            r,
            e,
            a,
            vt
          )) {
            Dt = 1, Al(
              t,
              U(a, t.current)
            ), bt = null;
            return;
          }
        } catch (c) {
          if (r !== null) throw bt = r, c;
          Dt = 1, Al(
            t,
            U(a, t.current)
          ), bt = null;
          return;
        }
        e.flags & 32768 ? (yt || l === 1 ? t = !0 : Tn || (vt & 536870912) !== 0 ? t = !1 : (za = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = ye.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Zc(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Zc(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = Ym(
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
      function Zc(t, e) {
        do {
          var a = Gm(t.alternate, t);
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
      function Jc(t, e, a, l, r, c, m, v, O) {
        t.cancelPendingCommit = null;
        do
          Ln();
        while (Xt !== 0);
        if ((gt & 6) !== 0) throw Error(u(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(u(177));
          if (c = e.lanes | e.childLanes, c |= io, g(
            t,
            a,
            c,
            m,
            v,
            O
          ), t === Tt && (bt = Tt = null, vt = 0), jn = e, Na = t, ra = a, go = c, bo = r, Vu = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Im(Ir, function() {
            return $c(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = it.T, it.T = null, r = ea(), Lt(2), m = gt, gt |= 4;
            try {
              Qm(t, e, a);
            } finally {
              gt = m, Lt(r), it.T = l;
            }
          }
          Xt = 1, Lc(), Wc(), Fc();
        }
      }
      function Lc() {
        if (Xt === 1) {
          Xt = 0;
          var t = Na, e = jn, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = it.T, it.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Tc(e, t), uf(t.containerInfo);
            } finally {
              gt = r, Lt(l), it.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Wc() {
        if (Xt === 2) {
          Xt = 0;
          var t = Na, e = jn, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = it.T, it.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              zc(t, e.alternate, e);
            } finally {
              gt = r, Lt(l), it.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Fc() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Hp();
          var t = Na, e = jn, a = ra, l = Vu;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, jn = Na = null, Ic(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Ea = null), ot(a), e = e.stateNode, be && typeof be.onCommitFiberRoot == "function")
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
            e = it.T, r = ea(), Lt(2), it.T = null;
            try {
              for (var c = t.onRecoverableError, m = 0; m < l.length; m++) {
                var v = l[m];
                c(v.value, {
                  componentStack: v.stack
                });
              }
            } finally {
              it.T = e, Lt(r);
            }
          }
          (ra & 3) !== 0 && Ln(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === vo ? sl++ : (sl = 0, vo = t) : sl = 0, le && yp(), ln(0);
        }
      }
      function Ic(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Hn(e)));
      }
      function Ln() {
        return Lc(), Wc(), Fc(), $c();
      }
      function $c() {
        if (Xt !== 5) return !1;
        var t = Na, e = go;
        go = 0;
        var a = ot(ra), l = 32 > a ? 32 : a;
        a = it.T;
        var r = ea();
        try {
          Lt(l), it.T = null, l = bo, bo = null;
          var c = Na, m = ra;
          if (Xt = 0, jn = Na = null, ra = 0, (gt & 6) !== 0)
            throw Error(u(331));
          var v = gt;
          if (gt |= 4, Oc(c.current), jc(
            c,
            c.current,
            m,
            l
          ), gt = v, ln(0, !1), be && typeof be.onPostCommitFiberRoot == "function")
            try {
              be.onPostCommitFiberRoot($n, c);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), it.T = a, Ic(t, e);
        }
      }
      function Pc(t, e, a) {
        e = U(a, e), e = cr(t.stateNode, e, 2), t = fa(t, e, 2), t !== null && (C(t, 2), Ge(t));
      }
      function wt(t, e, a) {
        if (t.tag === 3)
          Pc(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Pc(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Ea === null || !Ea.has(l))) {
                t = U(a, t), a = $s(2), l = fa(e, a, 2), l !== null && (Ps(
                  a,
                  l,
                  e,
                  t
                ), C(l, 2), Ge(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function Ar(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new Zp();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (fo = !0, r.add(a), t = Lm.bind(null, t, e, a), e.then(t, t));
      }
      function Lm(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Tt === t && (vt & a) === a && (Dt === 4 || Dt === 3 && (vt & 62914560) === vt && 300 > ce() - mi ? (gt & 2) === 0 && sn(t, 0) : po |= a, Cn === vt && (Cn = 0)), Ge(t);
      }
      function tu(t, e) {
        e === 0 && (e = M()), t = Ua(t, e), t !== null && (C(t, e), Ge(t));
      }
      function Wm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), tu(t, a);
      }
      function Fm(t, e) {
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
            throw Error(u(314));
        }
        l !== null && l.delete(e), tu(t, a);
      }
      function Im(t, e) {
        return Fl(t, e);
      }
      function $m(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Or(t) {
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
      function eu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Kl(t, e, a, l, r, c) {
        var m = 0;
        if (l = t, typeof t == "function") Or(t) && (m = 1);
        else if (typeof t == "string")
          m = Ue && Vt ? zu(t, a, Pt.current) ? 26 : Ou(t) ? 27 : 5 : Ue ? zu(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Ou(t) ? 27 : 5;
        else
          t: switch (t) {
            case Kr:
              return t = o(31, a, e, r), t.elementType = Kr, t.lanes = c, t;
            case dn:
              return Ga(
                a.children,
                r,
                c,
                e
              );
            case su:
              m = 8, r |= 24;
              break;
            case Br:
              return t = o(12, a, e, r | 2), t.elementType = Br, t.lanes = c, t;
            case Yr:
              return t = o(13, a, e, r), t.elementType = Yr, t.lanes = c, t;
            case Gr:
              return t = o(19, a, e, r), t.elementType = Gr, t.lanes = c, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case va:
                    m = 10;
                    break t;
                  case cu:
                    m = 9;
                    break t;
                  case qr:
                    m = 11;
                    break t;
                  case Qr:
                    m = 14;
                    break t;
                  case ya:
                    m = 16, l = null;
                    break t;
                }
              m = 29, a = Error(
                u(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), l = null;
          }
        return e = o(m, a, e, r), e.elementType = t, e.type = l, e.lanes = c, e;
      }
      function Ga(t, e, a, l) {
        return t = o(7, t, l, e), t.lanes = a, t;
      }
      function Rr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function au(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Hr(t, e, a) {
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
      function Pm(t, e, a, l, r, c, m, v, O) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = D(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = D(0), this.hiddenUpdates = D(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = c, this.onRecoverableError = m, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = O, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function nu(t, e, a, l, r, c, m, v, O, Q, Z, V) {
        return t = new Pm(
          t,
          e,
          a,
          m,
          O,
          Q,
          Z,
          V,
          v
        ), e = 1, c === !0 && (e |= 24), c = o(3, null, null, e), t.current = c, c.stateNode = t, e = Ui(), e.refCount++, t.pooledCache = e, e.refCount++, c.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Gi(c), t;
      }
      function lu(t) {
        return t ? (t = hn, t) : hn;
      }
      function iu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(u(188)) : (t = Object.keys(t).join(","), Error(u(268, t)));
        return t = f(e), t = t !== null ? _(t) : null, t === null ? null : Wn(t.stateNode);
      }
      function ru(t, e, a, l, r, c) {
        r = lu(r), l.context === null ? l.context = r : l.pendingContext = r, l = ma(e), l.payload = { element: a }, c = c === void 0 ? null : c, c !== null && (l.callback = c), a = fa(t, l, e), a !== null && (se(a, t, e), Un(a, t, e));
      }
      function ou(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Dr(t, e) {
        ou(t, e), (t = t.alternate) && ou(t, e);
      }
      var ht = {}, tf = qd(), he = ph(), Ur = Object.assign, ef = Symbol.for("react.element"), Vl = Symbol.for("react.transitional.element"), un = Symbol.for("react.portal"), dn = Symbol.for("react.fragment"), su = Symbol.for("react.strict_mode"), Br = Symbol.for("react.profiler"), cu = Symbol.for("react.consumer"), va = Symbol.for("react.context"), qr = Symbol.for("react.forward_ref"), Yr = Symbol.for("react.suspense"), Gr = Symbol.for("react.suspense_list"), Qr = Symbol.for("react.memo"), ya = Symbol.for("react.lazy"), Kr = Symbol.for("react.activity"), af = Symbol.for("react.memo_cache_sentinel"), uu = Symbol.iterator, nf = Symbol.for("react.client.reference"), Xl = Array.isArray, it = tf.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, lf = i.rendererVersion, rf = i.rendererPackageName, du = i.extraDevToolsConfig, Wn = i.getPublicInstance, of = i.getRootHostContext, sf = i.getChildHostContext, cf = i.prepareForCommit, uf = i.resetAfterCommit, df = i.createInstance;
      i.cloneMutableInstance;
      var Vr = i.appendInitialChild, mu = i.finalizeInitialChildren, Zl = i.shouldSetTextContent, fu = i.createTextInstance;
      i.cloneMutableTextInstance;
      var mf = i.scheduleTimeout, ff = i.cancelTimeout, Qa = i.noTimeout, ta = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ne = i.supportsMutation, Ke = i.supportsPersistence, le = i.supportsHydration, pf = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var hf = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Lt = i.setCurrentUpdatePriority, ea = i.getCurrentUpdatePriority, gf = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var bf = i.shouldAttemptEagerTransition, vf = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var yf = i.maySuspendCommit, xf = i.maySuspendCommitOnUpdate, Xr = i.maySuspendCommitInSyncRender, pu = i.preloadInstance, wf = i.startSuspendingCommit, hu = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var _f = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var mn = i.NotPendingTransition, Ka = i.HostTransitionContext, Sf = i.resetFormInstance;
      i.bindToConsole;
      var zf = i.supportsMicrotasks, kf = i.scheduleMicrotask, Fn = i.supportsTestSelectors, Ef = i.findFiberRoot, Nf = i.getBoundingRect, Tf = i.getTextContent, In = i.isHiddenSubtree, Cf = i.matchAccessibilityRole, jf = i.setFocusIfFocusable, Mf = i.setupIntersectionObserver, Af = i.appendChild, Of = i.appendChildToContainer, Rf = i.commitTextUpdate, Hf = i.commitMount, Df = i.commitUpdate, Uf = i.insertBefore, Bf = i.insertInContainerBefore, qf = i.removeChild, Yf = i.removeChildFromContainer, gu = i.resetTextContent, Gf = i.hideInstance, Qf = i.hideTextInstance, Kf = i.unhideInstance, Vf = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var Xf = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var Zf = i.cloneInstance, bu = i.createContainerChildSet, vu = i.appendChildToContainerChildSet, Jf = i.finalizeContainerChildren, yu = i.replaceContainerChildren, xu = i.cloneHiddenInstance, wu = i.cloneHiddenTextInstance, Zr = i.isSuspenseInstancePending, Jr = i.isSuspenseInstanceFallback, Lf = i.getSuspenseInstanceFallbackErrorDetails, Wf = i.registerSuspenseInstanceRetry, Ff = i.canHydrateFormStateMarker, If = i.isFormStateMarkerMatching, _u = i.getNextHydratableSibling, $f = i.getNextHydratableSiblingAfterSingleton, Pf = i.getFirstHydratableChild, tp = i.getFirstHydratableChildWithinContainer, ep = i.getFirstHydratableChildWithinActivityInstance, ap = i.getFirstHydratableChildWithinSuspenseInstance, np = i.getFirstHydratableChildWithinSingleton, lp = i.canHydrateInstance, ip = i.canHydrateTextInstance, rp = i.canHydrateActivityInstance, op = i.canHydrateSuspenseInstance, sp = i.hydrateInstance, cp = i.hydrateTextInstance, up = i.hydrateActivityInstance, dp = i.hydrateSuspenseInstance, mp = i.getNextHydratableInstanceAfterActivityInstance, fp = i.getNextHydratableInstanceAfterSuspenseInstance, pp = i.commitHydratedInstance, hp = i.commitHydratedContainer, gp = i.commitHydratedActivityInstance, bp = i.commitHydratedSuspenseInstance, vp = i.finalizeHydratedChildren, yp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var xp = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var wp = i.clearSuspenseBoundaryFromContainer, _p = i.hideDehydratedBoundary, Sp = i.unhideDehydratedBoundary, Su = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var zp = i.validateHydratableInstance, kp = i.validateHydratableTextInstance, Ue = i.supportsResources, zu = i.isHostHoistableType, Lr = i.getHoistableRoot, ku = i.getResource, Eu = i.acquireResource, Nu = i.releaseResource, Ep = i.hydrateHoistable, Tu = i.mountHoistable, Cu = i.unmountHoistable, Np = i.createHoistableInstance, Tp = i.prepareToCommitHoistables, Cp = i.mayResourceSuspendCommit, ju = i.preloadResource, jp = i.suspendResource, Vt = i.supportsSingletons, Mu = i.resolveSingletonInstance, Mp = i.acquireSingletonInstance, Au = i.releaseSingletonInstance, Ou = i.isHostSingletonType, fn = i.isSingletonScope, Wr = [], pn = -1, hn = {}, ge = Math.clz32 ? Math.clz32 : x, Ap = Math.log, Op = Math.LN2, Jl = 256, Ll = 262144, Wl = 4194304, Fl = he.unstable_scheduleCallback, Fr = he.unstable_cancelCallback, Rp = he.unstable_shouldYield, Hp = he.unstable_requestPaint, ce = he.unstable_now, Ru = he.unstable_ImmediatePriority, Dp = he.unstable_UserBlockingPriority, Ir = he.unstable_NormalPriority, Up = he.unstable_IdlePriority, Bp = he.log, qp = he.unstable_setDisableYieldValue, $n = null, be = null, ve = typeof Object.is == "function" ? Object.is : Kt, Hu = typeof reportError == "function" ? reportError : function(t) {
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
      }, Yp = Object.prototype.hasOwnProperty, $r, Du, Pr = !1, Uu = /* @__PURE__ */ new WeakMap(), gn = [], bn = 0, Il = null, Pn = 0, ke = [], Ee = 0, xa = null, Ve = 1, Xe = "", Pt = S(null), tl = S(null), wa = S(null), $l = S(null), te = null, At = null, yt = !1, _a = null, Ne = !1, to = Error(u(519)), Pl = S(null), Va = null, aa = null, Gp = typeof AbortController < "u" ? AbortController : function() {
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
      }, Qp = he.unstable_scheduleCallback, Kp = he.unstable_NormalPriority, Ot = {
        $$typeof: va,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ti = null, vn = null, eo = !1, ei = !1, ao = !1, Xa = 0, el = null, no = 0, yn = 0, xn = null, Bu = it.S;
      it.S = function(t, e) {
        Ku = ce(), typeof e == "object" && e !== null && typeof e.then == "function" && Cm(t, e), Bu !== null && Bu(t, e);
      };
      var Za = S(null), wn = Error(u(460)), lo = Error(u(474)), ai = Error(u(542)), ni = { then: function() {
      } }, Ja = null, _n = null, al = 0, La = ss(!0), qu = ss(!1), Te = [], Sn = 0, io = 0, Sa = !1, ro = !1, zn = S(null), li = S(0), ye = S(null), Ce = null, Bt = S(0), na = 0, mt = null, Et = null, qt = null, ii = !1, kn = !1, Wa = !1, ri = 0, nl = 0, En = null, Vp = 0, ll = {
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
      var Yu = {
        readContext: It,
        use: Nl,
        useCallback: function(t, e) {
          return re().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Os,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Cl(
            4194308,
            4,
            Us.bind(null, e, t),
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
            jt(!0);
            try {
              t();
            } finally {
              jt(!1);
            }
          }
          return a.memoizedState = [l, e], l;
        },
        useReducer: function(t, e, a) {
          var l = re();
          if (a !== void 0) {
            var r = a(e);
            if (Wa) {
              jt(!0);
              try {
                a(e);
              } finally {
                jt(!1);
              }
            }
          } else r = e;
          return l.memoizedState = l.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, l.queue = t, t = t.dispatch = Dm.bind(
            null,
            mt,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = re();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = er(t);
          var e = t.queue, a = Zs.bind(
            null,
            mt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: lr,
        useDeferredValue: function(t, e) {
          var a = re();
          return ir(a, t, e);
        },
        useTransition: function() {
          var t = er(!1);
          return t = Qs.bind(
            null,
            mt,
            t.queue,
            !0,
            !1
          ), re().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = mt, r = re();
          if (yt) {
            if (a === void 0)
              throw Error(u(407));
            a = a();
          } else {
            if (a = e(), Tt === null)
              throw Error(u(349));
            (vt & 127) !== 0 || bs(l, e, a);
          }
          r.memoizedState = a;
          var c = { value: a, getSnapshot: e };
          return r.queue = c, Os(ys.bind(null, l, c, t), [
            t
          ]), l.flags |= 2048, rn(
            9,
            { destroy: void 0 },
            vs.bind(
              null,
              l,
              c,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = re(), e = Tt.identifierPrefix;
          if (yt) {
            var a = Xe, l = Ve;
            a = (l & ~(1 << 32 - ge(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ri++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Vp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: rr,
        useFormState: Ts,
        useActionState: Ts,
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
          return e.queue = a, e = or.bind(
            null,
            mt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: $i,
        useCacheRefresh: function() {
          return re().memoizedState = Hm.bind(
            null,
            mt
          );
        },
        useEffectEvent: function(t) {
          var e = re(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((gt & 2) !== 0)
              throw Error(u(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, oo = {
        readContext: It,
        use: Nl,
        useCallback: qs,
        useContext: It,
        useEffect: nr,
        useImperativeHandle: Bs,
        useInsertionEffect: Hs,
        useLayoutEffect: Ds,
        useMemo: Ys,
        useReducer: Tl,
        useRef: As,
        useState: function() {
          return Tl(We);
        },
        useDebugValue: lr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Gs(
            a,
            Et.memoizedState,
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
        useSyncExternalStore: gs,
        useId: Vs,
        useHostTransitionStatus: rr,
        useFormState: Cs,
        useActionState: Cs,
        useOptimistic: function(t, e) {
          var a = Ut();
          return _s(a, Et, t, e);
        },
        useMemoCache: $i,
        useCacheRefresh: Xs
      };
      oo.useEffectEvent = Rs;
      var Gu = {
        readContext: It,
        use: Nl,
        useCallback: qs,
        useContext: It,
        useEffect: nr,
        useImperativeHandle: Bs,
        useInsertionEffect: Hs,
        useLayoutEffect: Ds,
        useMemo: Ys,
        useReducer: tr,
        useRef: As,
        useState: function() {
          return tr(We);
        },
        useDebugValue: lr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Et === null ? ir(a, t, e) : Gs(
            a,
            Et.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = tr(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Yn(t),
            e
          ];
        },
        useSyncExternalStore: gs,
        useId: Vs,
        useHostTransitionStatus: rr,
        useFormState: Ms,
        useActionState: Ms,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Et !== null ? _s(a, Et, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: $i,
        useCacheRefresh: Xs
      };
      Gu.useEffectEvent = Rs;
      var so = {
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
      }, co = Error(u(461)), Yt = !1, uo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, la = !1, Gt = !1, mo = !1, Qu = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, ue = !1, Be = null, Nn = 8192, Xp = {
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
      var Zp = typeof WeakMap == "function" ? WeakMap : Map, gt = 0, Tt = null, bt = null, vt = 0, kt = 0, xe = null, za = !1, Tn = !1, fo = !1, ia = 0, Dt = 0, ka = 0, Fa = 0, po = 0, we = 0, Cn = 0, rl = null, de = null, ho = !1, mi = 0, Ku = 0, ol = 1 / 0, fi = null, Ea = null, Xt = 0, Na = null, jn = null, ra = 0, go = 0, bo = null, Vu = null, sl = 0, vo = null;
      return ht.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ua(t, 67108864);
          e !== null && se(e, t, 67108864), Dr(t, 67108864);
        }
      }, ht.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = pe();
          e = at(e);
          var a = Ua(t, e);
          a !== null && se(a, t, e), Dr(t, e);
        }
      }, ht.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = k(t.pendingLanes);
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
            e = Ua(t, 2), e !== null && se(e, t, 2), qc(), Dr(t, 2);
        }
      }, ht.batchedUpdates = function(t, e) {
        return t(e);
      }, ht.createComponentSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, ht.createContainer = function(t, e, a, l, r, c, m, v, O, Q) {
        return nu(
          t,
          e,
          !1,
          null,
          a,
          l,
          c,
          null,
          m,
          v,
          O,
          Q
        );
      }, ht.createHasPseudoClassSelector = function(t) {
        return { $$typeof: si, value: t };
      }, ht.createHydrationContainer = function(t, e, a, l, r, c, m, v, O, Q, Z, V, L, dt) {
        return t = nu(
          a,
          l,
          !0,
          t,
          r,
          c,
          v,
          dt,
          O,
          Q,
          Z,
          V
        ), t.context = lu(null), a = t.current, l = pe(), l = at(l), r = ma(l), r.callback = e ?? null, fa(a, r, l), e = l, t.current.lanes = e, C(t, e), Ge(t), t;
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
        Hu(t);
      }, ht.defaultOnUncaughtError = function(t) {
        Hu(t);
      }, ht.deferredUpdates = function(t) {
        var e = it.T, a = ea();
        try {
          return Lt(32), it.T = null, t();
        } finally {
          Lt(a), it.T = e;
        }
      }, ht.discreteUpdates = function(t, e, a, l, r) {
        var c = it.T, m = ea();
        try {
          return Lt(2), it.T = null, t(e, a, l, r);
        } finally {
          Lt(m), it.T = c, gt === 0 && (ol = ce() + 500);
        }
      }, ht.findAllNodes = Cr, ht.findBoundingRects = function(t, e) {
        if (!Fn) throw Error(u(363));
        e = Cr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Nf(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, c = a.y, m = c + a.height, v = e - 1; 0 <= v; v--)
            if (e !== v) {
              var O = t[v], Q = O.x, Z = Q + O.width, V = O.y, L = V + O.height;
              if (l >= Q && c >= V && r <= Z && m <= L) {
                t.splice(e, 1);
                break;
              } else if (l !== Q || a.width !== O.width || L < c || V > m) {
                if (!(c !== V || a.height !== O.height || Z < l || Q > r)) {
                  Q > l && (O.width += Q - l, O.x = l), Z < r && (O.width = r - Q), t.splice(e, 1);
                  break;
                }
              } else {
                V > c && (O.height += V - c, O.y = c), L < m && (O.height = m - V), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ht.findHostInstance = iu, ht.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? w(t) : null, t === null ? null : Wn(t.stateNode);
      }, ht.findHostInstanceWithWarning = function(t) {
        return iu(t);
      }, ht.flushPassiveEffects = Ln, ht.flushSyncFromReconciler = function(t) {
        var e = gt;
        gt |= 1;
        var a = it.T, l = ea();
        try {
          if (Lt(2), it.T = null, t)
            return t();
        } finally {
          Lt(l), it.T = a, gt = e, (gt & 6) === 0 && ln(0);
        }
      }, ht.flushSyncWork = qc, ht.focusWithin = function(t, e) {
        if (!Fn) throw Error(u(363));
        for (t = Er(t), e = Hc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!In(a)) {
            if ((l === 5 || l === 26 || l === 27) && jf(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ht.getFindAllNodesFailureDescription = function(t, e) {
        if (!Fn) throw Error(u(363));
        var a = 0, l = [];
        t = [Er(t), 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], m = c.tag, v = t[r++], O = e[v];
          if ((m !== 5 && m !== 26 && m !== 27 || !In(c)) && (Nr(c, O) && (l.push(Tr(O)), v++, v > a && (a = v)), v < e.length))
            for (c = c.child; c !== null; )
              t.push(c, v), c = c.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Tr(e[a]));
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
          version: lf,
          rendererPackageName: rf,
          currentDispatcherRef: it,
          reconcilerVersion: "19.2.0"
        };
        if (du !== null && (t.rendererConfig = du), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
        if (!Fn) throw Error(u(363));
        t = Cr(t, e);
        var r = Mf(
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
        if (t.tag !== 5) throw Error(u(476));
        var r = Ks(t).queue;
        Qs(
          t,
          r,
          e,
          mn,
          a === null ? s : function() {
            var c = Ks(t);
            return c.next === null && (c = t.alternate.memoizedState), Gn(
              t,
              c.next.queue,
              {},
              pe()
            ), a(l);
          }
        );
      }, ht.updateContainer = function(t, e, a, l) {
        var r = e.current, c = pe();
        return ru(
          r,
          c,
          t,
          e,
          a,
          l
        ), c;
      }, ht.updateContainerSync = function(t, e, a, l) {
        return ru(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, ht;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(_o)), _o.exports;
}
var ad;
function gh() {
  return ad || (ad = 1, wo.exports = hh()), wo.exports;
}
var bh = gh();
const vh = /* @__PURE__ */ Vo(bh);
var ko = { exports: {} }, oa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var nd;
function yh() {
  return nd || (nd = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var ld;
function xh() {
  return ld || (ld = 1, ko.exports = yh()), ko.exports;
}
var pl = xh();
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
const Yd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], jo = 16, Gd = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), wh = [
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
  ["input", { padding: "1px 2px", "border-width": "2px", "border-style": "inset", "border-color": "buttonborder", "background-color": "field", color: "fieldtext" }],
  ["svg", { overflow: "hidden" }],
  ["[hidden]", { display: "none" }]
], id = {
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
}, _h = /* @__PURE__ */ new Set([
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
]), Qd = {
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
}, Kd = {
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
}, Mo = ["font-size", "color", ...new Set([...Object.keys(Qd), ...Object.keys(Kd)].filter((n) => n !== "font-size" && n !== "color"))], Sh = new Set(Mo);
function ie(n, i = " ") {
  const o = [];
  let s = 0, u = "";
  for (let d = 0; d < n.length; d++) {
    const p = n[d];
    if (p === "(" ? s++ : p === ")" && s--, s === 0 && (i === " " ? /\s/.test(p) : p === i)) {
      (u.trim() || i !== " ") && o.push(u.trim()), u = "";
      continue;
    }
    u += p;
  }
  return (u.trim() || i !== " " && o.length) && o.push(u.trim()), o;
}
function Ao(n, i, o = 0) {
  if (o > 32) return null;
  let s = "", u = 0;
  for (; ; ) {
    const d = n.indexOf("var(", u);
    if (d < 0)
      return s += n.slice(u), s;
    s += n.slice(u, d);
    let p = 1, f = d + 4;
    for (; f < n.length && p; f++)
      n[f] === "(" ? p++ : n[f] === ")" && p--;
    const _ = n.slice(d + 4, f - 1), w = ie(_, ","), R = w[0].trim(), H = w.length > 1 ? _.slice(_.indexOf(",") + 1).trim() : null;
    let S = i(R);
    if ((S == null || S === "initial") && (S = H), S == null) return null;
    const y = Ao(S, i, o + 1);
    if (y === null) return null;
    s += y, u = f;
  }
}
function zh(n) {
  const i = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, u = 0;
  for (; u < n.length; ) {
    if (o.lastIndex = u, s = o.exec(n), !s || s.index !== u) {
      if (/^\s+$/.test(n.slice(u))) break;
      return null;
    }
    u = o.lastIndex, s[1] !== void 0 ? i.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? i.push({ fn: s[3].toLowerCase() }) : s[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: s[5] ?? s[6] });
  }
  return i;
}
function On(n, i) {
  const o = zh(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let s = 0;
  const u = ({ num: S, unit: y }) => {
    switch (y) {
      case "":
        return { px: 0, pct: 0, num: S, unitless: !0 };
      case "px":
        return { px: S, pct: 0, num: 0 };
      case "rem":
        return { px: S * jo, pct: 0, num: 0 };
      case "em":
        return { px: S * (i.fontSize ?? jo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: S, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: S / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: S / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: S * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (S, y, z) => S && y ? { px: S.px + z * y.px, pct: S.pct + z * y.pct, num: S.num + z * y.num, unitless: S.unitless && y.unitless } : null, p = (S, y) => S ? { px: S.px * y, pct: S.pct * y, num: S.num * y, unitless: S.unitless } : null, f = (S) => S && S.unitless;
  function _() {
    const S = o[s++];
    if (!S) return null;
    if (S.num !== void 0) return u(S);
    if (S.op === "(") {
      const y = R();
      return o[s]?.op !== ")" ? null : (s++, y);
    }
    if (S.op === "-" || S.op === "+") {
      const y = _();
      return S.op === "-" ? p(y, -1) : y;
    }
    if (S.fn) {
      const y = [];
      for (; ; ) {
        y.push(R());
        const k = o[s++];
        if (!k) return null;
        if (k.op === ")") break;
        if (k.op !== ",") return null;
      }
      if (y.some((k) => !k)) return null;
      if (S.fn === "calc") return y[0];
      if (!(y.every((k) => !k.pct) || y.every((k) => !k.px && !k.num))) return null;
      const x = (k) => k.px + k.pct + k.num;
      return S.fn === "min" ? y.reduce((k, Y) => x(Y) < x(k) ? Y : k) : S.fn === "max" ? y.reduce((k, Y) => x(Y) > x(k) ? Y : k) : S.fn === "clamp" && y.length === 3 ? x(y[1]) < x(y[0]) ? y[0] : x(y[1]) > x(y[2]) ? y[2] : y[1] : null;
    }
    return null;
  }
  function w() {
    let S = _();
    for (; o[s] && (o[s].op === "*" || o[s].op === "/"); ) {
      const y = o[s++].op, z = _();
      if (!S || !z) return null;
      y === "*" ? S = f(z) ? p(S, z.num) : f(S) ? p(z, S.num) : null : S = f(z) && z.num !== 0 ? p(S, 1 / z.num) : null;
    }
    return S;
  }
  function R() {
    let S = w();
    for (; o[s] && (o[s].op === "+" || o[s].op === "-"); ) {
      const y = o[s++].op;
      S = d(S, w(), y === "-" ? -1 : 1);
    }
    return S;
  }
  const H = R();
  return s !== o.length || !H ? null : H;
}
function Oo(n, i) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const s = On(o, i);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: n.trim() } : s.pct && (s.px || s.num) ? { expr: n.trim() } : s.pct ? { pct: s.pct } : { px: kh(s.px) } : { expr: n.trim() };
}
const kh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, gi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Eh = ([n, i, o, s]) => `#${gi(n)}${gi(i)}${gi(o)}${gi(s * 255)}`;
function rd(n) {
  const i = n.slice(1), o = i.length <= 4 ? i.split("").map((u) => u + u).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const s = (u) => parseInt(o.slice(u, u + 2), 16);
  return [s(0), s(2), s(4), o.length === 8 ? s(6) / 255 : 1];
}
function zi(n, i) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (s) {
    const w = i(s[1]), R = w && rd(w);
    return R ? { rgba: R, token: s[1] } : null;
  }
  if (o.startsWith("#")) {
    const w = rd(o);
    return w ? { rgba: w, token: null } : null;
  }
  if (id[o]) return { rgba: [...id[o]], token: null };
  const u = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!u) return null;
  if (u[1] === "color-mix") {
    const w = ie(u[2], ",");
    if (w.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(w[0])) return null;
    const R = (jt) => {
      const Kt = ie(jt), Nt = Kt.findIndex((nt) => /%$/.test(nt)), K = Nt >= 0 ? parseFloat(Kt[Nt]) / 100 : null;
      return { color: zi(Kt.filter((nt, U) => U !== Nt).join(" "), i), pct: K };
    }, H = R(w[1]), S = R(w[2]);
    if (!H.color || !S.color || H.color === "currentcolor" || S.color === "currentcolor") return null;
    let y = H.pct, z = S.pct;
    y === null && z === null ? (y = 0.5, z = 0.5) : y === null ? y = 1 - z : z === null && (z = 1 - y);
    const x = y + z, k = x < 1 ? x : 1;
    y /= x, z /= x;
    const [Y, E, N, M] = H.color.rgba, [D, C, g, h] = S.color.rgba, G = M * y + h * z, J = (jt, Kt) => G === 0 ? 0 : (jt * M * y + Kt * h * z) / G, at = [J(Y, D), J(E, C), J(N, g), G * k], ot = h === 0 ? H.color.token : M === 0 ? S.color.token : null;
    return { rgba: at, token: ot };
  }
  const d = u[2].includes(",") ? ie(u[2], ",") : ie(u[2].replace("/", " / ")).filter((w) => w !== "/");
  if (d.length < 3) return null;
  const p = (w) => w.endsWith("%") ? parseFloat(w) / 100 * 255 : parseFloat(w), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), _ = [p(d[0]), p(d[1]), p(d[2]), f];
  return _.some((w) => Number.isNaN(w)) ? null : { rgba: _, token: null };
}
const ml = ["top", "right", "bottom", "left"], Nh = ["top-left", "top-right", "bottom-right", "bottom-left"], bi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], od = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Ro(n, i) {
  const o = i.trim(), s = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const u = bi(s());
      return ml.map((d, p) => [`${n}-${d}`, u[p]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const u = s(), d = n.split("-")[0];
      return [[`${d}-left`, u[0]], [`${d}-right`, u[1] ?? u[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const u = s(), d = n.split("-")[0];
      return [[`${d}-top`, u[0]], [`${d}-bottom`, u[1] ?? u[0]]];
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
      const u = bi(s());
      return ml.map((d, p) => [d, u[p]]);
    }
    case "inset-inline": {
      const u = s();
      return [["left", u[0]], ["right", u[1] ?? u[0]]];
    }
    case "inset-block": {
      const u = s();
      return [["top", u[0]], ["bottom", u[1] ?? u[0]]];
    }
    case "inset-inline-start":
      return [["left", o]];
    case "inset-inline-end":
      return [["right", o]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const u = n.split("-")[1], d = bi(s());
      return ml.map((p, f) => [`border-${p}-${u}`, d[f]]);
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
      const u = n === "border" ? ml : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", p = "none", f = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const _ of s())
          od.has(_) ? p = _ : /^(thin|medium|thick|-?[\d.]|calc\()/.test(_) ? d = _ : f = _;
      else o === "0" && (d = "0");
      return u.flatMap((_) => [[`border-${_}-width`, d], [`border-${_}-style`, p], [`border-${_}-color`, f]]);
    }
    case "border-inline-width": {
      const u = s();
      return [["border-left-width", u[0]], ["border-right-width", u[1] ?? u[0]]];
    }
    case "border-block-width": {
      const u = s();
      return [["border-top-width", u[0]], ["border-bottom-width", u[1] ?? u[0]]];
    }
    case "border-inline-style": {
      const u = s();
      return [["border-left-style", u[0]], ["border-right-style", u[1] ?? u[0]]];
    }
    case "border-inline-color": {
      const u = s();
      return [["border-left-color", u[0]], ["border-right-color", u[1] ?? u[0]]];
    }
    case "border-radius": {
      const u = bi(ie(o.split("/")[0]));
      return Nh.map((d, p) => [`border-${d}-radius`, u[p]]);
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
    case "overflow": {
      const u = s();
      return [["overflow-x", u[0]], ["overflow-y", u[1] ?? u[0]]];
    }
    case "gap": {
      const u = s();
      return [["row-gap", u[0]], ["column-gap", u[1] ?? u[0]]];
    }
    case "grid-gap":
      return Ro("gap", o);
    case "place-items": {
      const u = s();
      return [["align-items", u[0]], ["justify-items", u[1] ?? u[0]]];
    }
    case "place-self": {
      const u = s();
      return [["align-self", u[0]], ["justify-self", u[1] ?? u[0]]];
    }
    case "place-content": {
      const u = s();
      return [["align-content", u[0]], ["justify-content", u[1] ?? u[0]]];
    }
    case "flex": {
      if (o === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (o === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (o === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const u = s(), d = u.filter((f) => /^[\d.]+$/.test(f)), p = u.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", p ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const u = [];
      for (const d of s()) u.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return u;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let u = "medium", d = "none", p = "currentcolor";
      for (const f of s())
        od.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? u = f : p = f;
      return [["outline-width", u], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const u = ie(o, ","), d = u.map((f) => ie(f).find((_) => !/^[\d.]+m?s$/.test(_) && !/^(ease|linear|step|cubic)/.test(_)) ?? "all"), p = u.map((f) => ie(f).find((_) => /^[\d.]+m?s$/.test(_)) ?? "0s");
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
function Th(n, i) {
  return n ? ie(n, ",").some((o) => {
    let s = o.trim().toLowerCase(), u = !1;
    s.startsWith("not ") && (u = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const d = s.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const f = /^\((.+)\)$/.exec(p);
      if (!f) return !1;
      const _ = f[1].trim(), w = /^([a-z-]+)\s*:\s*(.+)$/.exec(_);
      if (w) {
        const [, H, S] = w, y = (z) => {
          const x = Oo(z, { viewport: i });
          return typeof x == "object" && "px" in x ? x.px : NaN;
        };
        switch (H) {
          case "min-width":
            return i.width >= y(S);
          case "max-width":
            return i.width <= y(S);
          case "min-height":
            return i.height >= y(S);
          case "max-height":
            return i.height <= y(S);
          case "hover":
          case "any-hover":
            return S.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return S.trim() === "fine";
          case "prefers-reduced-motion":
            return S.trim() === "no-preference";
          case "prefers-color-scheme":
            return S.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const R = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(_);
      if (R) {
        const H = R[1] === "width" ? i.width : i.height, S = Oo(R[3], { viewport: i }), y = typeof S == "object" && "px" in S ? S.px : NaN;
        switch (R[2]) {
          case ">=":
            return H >= y;
          case "<=":
            return H <= y;
          case ">":
            return H > y;
          case "<":
            return H < y;
          default:
            return H === y;
        }
      }
      return !1;
    });
    return u ? !d : d;
  }) : !0;
}
function Ch(n, i) {
  const o = i[i.length - 1].compound;
  return Xo(o)[0] ?? n;
}
function jh(n) {
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), s = (u, d) => {
    u.forEach(({ compound: p }, f) => {
      const _ = d && f === u.length - 1;
      for (const w of p.pseudos)
        if (Gd.has(w.name) && (_ ? i : o).add(w.name), w.list && w.name !== "not") for (const R of w.list) s(R, _);
    });
  };
  return s(n, !0), { subject: i, ancestor: o };
}
function Xo(n) {
  const i = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const s of o.list) s.length === 1 && i.push(...Xo(s[0].compound));
  return i;
}
function Mh(n, i) {
  const o = (s, u) => {
    s.forEach(({ compound: d }, p) => {
      const f = u && p === s.length - 1, _ = d.pseudos.filter((w) => Gd.has(w.name)).map((w) => w.name);
      if (!f) for (const w of _) for (const R of Xo(d)) i.add(`${w}:${R}`);
      for (const w of d.pseudos) if (w.list && w.name !== "not") for (const R of w.list) o(R, f);
    });
  };
  o(n, !0);
}
class Ah {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const f = p[p.length - 1].compound, _ = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(_) || this.index.set(_, []), this.index.get(_).push(d);
    };
    let s = 0;
    const u = (d, p) => {
      for (const [f, _, w, R] of d)
        for (const H of Yo(f)) {
          let S;
          try {
            S = Go(H);
          } catch (x) {
            if (x instanceof Se) {
              this.skipped++;
              continue;
            }
            throw x;
          }
          const y = jh(S);
          Mh(S, this.trackedStates);
          const z = { steps: S, media: _, layer: w, origin: p, order: s++, specificity: Rd(S), decls: R, states: y, source: p === 0 ? `ua:${S[S.length - 1].compound.tag ?? "*"}` : Ch(H, S) };
          this.rules.push(z), o(z, S);
        }
    };
    u(wh.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), u(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const o = [], s = /* @__PURE__ */ new Set(), u = (d) => {
      if (d) for (const p of d) s.has(p) || (s.add(p), o.push(p));
    };
    for (const d of i.classList) u(this.index.get(`.${d}`));
    return u(this.index.get(i.tagName)), u(this.index.get("*")), o;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, o) {
    for (const s of i.classList) if (this.trackedStates.has(`${o}:${s}`)) return !0;
    return !1;
  }
}
const Oh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function Rh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [o, s] of Object.entries(n)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const u = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof s == "number" && s !== 0 && !Oh.has(u) && !u.startsWith("--") ? `${s}px` : String(s);
    i.push([u, d]);
  }
  return i;
}
function Hh(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const o of ["width", "height"]) {
    const s = n.getAttribute(o);
    s !== null && i.push([o, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return i;
}
const Dh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class Uh {
  constructor(i, { theme: o, viewport: s }) {
    this.sheet = i, this.theme = o, this.viewport = s, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, o) {
    const s = (u, d, p) => {
      if (d === "disabled") return !!u.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(u.tagName);
      if (d === "enabled") return !u.props?.disabled && ["button", "input", "select", "textarea"].includes(u.tagName);
      if (d === "checked") return !!u.props?.checked;
      if (o === "*") return !0;
      if (d === "focus-within") {
        const f = u.ownerDocument?.activeElement;
        return !!f && f !== u.ownerDocument.body && typeof u.contains == "function" && u.contains(f);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!u.state?.focus : !!u.state?.[d];
    };
    return this.sheet.candidates(i).filter((u) => (!u.media || u.media.every((d) => Th(d, this.viewport))) && Hd(i, u.steps, { state: s }));
  }
  compute(i, o, s = /* @__PURE__ */ new Set()) {
    const u = this.matching(i, s), d = [];
    for (const g of u)
      for (const [h, G, J] of g.decls) d.push({ prop: h, value: G, important: J ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of Hh(i)) d.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of Rh(i.props?.style)) d.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(Dh);
    const p = this.sheet.properties, f = Object.create(o?.customs ?? null), _ = /* @__PURE__ */ new Map(), w = /* @__PURE__ */ new Map();
    for (const g of d) g.prop.startsWith("--") && w.set(g.prop, g.value);
    if (!o && this.theme) for (const g of Yd) this.theme[g] && w.set(`--${g}`, `perchtoken(${g})`);
    const R = (g) => {
      if (_.has(g)) return _.get(g);
      const h = p[g];
      return h && !h.inherits ? h.initial ?? null : g in f ? f[g] : h?.initial ?? null;
    }, H = /* @__PURE__ */ new Set(), S = (g) => {
      if (!w.has(g)) return R(g);
      if (H.has(g)) return null;
      H.add(g);
      const h = Ao(w.get(g), S);
      return H.delete(g), w.delete(g), _.set(g, h), (!p[g] || p[g].inherits) && (f[g] = h), h;
    };
    for (const g of [...w.keys()]) S(g);
    const y = /* @__PURE__ */ new Map();
    for (const g of d) {
      if (g.prop.startsWith("--")) continue;
      const h = Ao(g.value, R);
      if (h === null) {
        for (const [G] of Ro(g.prop, "unset")) y.set(G, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [G, J] of Ro(g.prop, h)) y.set(G, { value: J, source: g.source, origin: g.origin });
    }
    const z = {}, x = {}, k = /* @__PURE__ */ new Set(), Y = /* @__PURE__ */ new Set(), E = o?.values, N = { fontSize: E?.["font-size"] ?? jo, viewport: this.viewport }, M = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, N, z, E);
      const G = `${g}\0${h}\0${N.fontSize}`;
      let J = this.parsed.get(G);
      return J === void 0 && this.parsed.set(G, J = this.parseValue(g, h, N, z, E)), J;
    }, D = y.size ? [...Mo, ...[...y.keys()].filter((g) => !Sh.has(g))] : Mo;
    for (const g of D) {
      const h = y.get(g);
      let G = h?.value;
      const J = _h.has(g);
      if ((G === void 0 || G === "unset" || G === "revert" || G === "revert-layer") && (G = J ? "inherit" : "initial"), h && (x[g] = h.source, h.origin !== 0 && k.add(g)), G === "inherit" && E && g in E) {
        z[g] = E[g], Y.add(g);
        continue;
      }
      (G === "inherit" || G === "initial") && (G = J ? Kd[g] : Qd[g]), z[g] = M(g, G), g === "font-size" && (N.fontSize = z["font-size"]);
    }
    for (const g of ml) {
      const h = z[`border-${g}-style`];
      (h === "none" || h === "hidden") && (z[`border-${g}-width`] = { px: 0 });
    }
    z["outline-style"] === "none" && (z["outline-width"] = { px: 0 });
    const C = E?.display;
    return (C === "flex" || C === "inline-flex" || C === "grid" || C === "inline-grid") && z.position !== "absolute" && z.position !== "fixed" && (z.display = sd(z.display)), (z.position === "absolute" || z.position === "fixed") && (z.display = sd(z.display)), { values: z, sources: x, own: k, inherited: Y, customs: f, rules: u, element: i };
  }
  parseValue(i, o, s, u, d) {
    const p = String(o).trim();
    switch (i) {
      case "font-size": {
        const f = p.toLowerCase(), _ = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (_[f]) return _[f];
        if (f === "smaller") return s.fontSize / 1.2;
        if (f === "larger") return s.fontSize * 1.2;
        const w = On(f, { fontSize: s.fontSize, viewport: s.viewport });
        return !w || w.num ? s.fontSize : w.px + w.pct / 100 * s.fontSize;
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
        return f === "currentcolor" ? u.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
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
        return Oo(p, s);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function sd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const ki = (n) => n && n.rgba ? { value: Eh(n.rgba), token: n.token ?? null } : null, Bh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function qh(n, i) {
  const o = i?.(n);
  if (Number.isFinite(o)) return o;
  const s = Math.round(n * 100) / 100;
  return Bh[s] ?? Math.round(n * 1.2);
}
function Zo(n, i) {
  const o = n["line-height"], s = n["font-size"];
  return o.normal ? qh(s, i) : o.factor !== void 0 ? o.factor * s : o.px;
}
const Yh = (n) => ie(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Gh = "perch-native-description/1", Mn = Symbol("display"), Ei = {
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
}, Qh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Qh) Ei[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Ei.rounded = 0;
const Kh = /* @__PURE__ */ new Set([
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
]), Vh = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Xh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Zh = (n) => Xh.test(n) ? "Menlo" : Vh.test(n) ? ".SystemUIFont" : Yh(n).split(",")[0].trim(), Jh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, cd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Vd = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((u) => !u.includes(":") && !u.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const s = n.parentElement;
  return s && s.tagName !== "body" ? `${Vd(s)} > ${n.tagName}` : n.tagName;
};
class Lh {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, o, s, u, d, p = "") {
    const f = `${i}|${o}|${s}|${u}`, _ = this.map.get(f);
    if (_) {
      !_.elements.includes(d) && _.elements.length < 4 && _.elements.push(d), _.count++;
      return;
    }
    this.map.set(f, { kind: i, property: o, value: String(s), class: u ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
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
}, Wh = /^(text|search|url|email|tel|password|number)$/, Fh = 162.13 / 12.8;
function Ih(n, i) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = On(n.expr, { fontSize: i["font-size"] }), s = (i["margin-left"]?.px ?? NaN) + (i["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + s) < 0.01;
}
function $h(n) {
  const i = n.transform;
  if (i && i !== "none") {
    const s = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), u = s && ie(s[2], ",").map((d) => d.trim());
    return !u || u.length > (s[1] ? 1 : 2) ? null : s[1] === "X" ? [u[0], "0"] : s[1] === "Y" ? ["0", u[0]] : [u[0], u[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const s = ie(String(o).trim(), " ").filter(Boolean);
    return s.length > 3 || s[2] !== void 0 && On(s[2], {})?.px ? null : [s[0], s[1] ?? "0"];
  }
  return [];
}
function Ph(n, i, o) {
  const s = n.values, u = $h(s);
  if (u?.length === 0) return;
  const d = s.transform && s.transform !== "none" ? "transform" : "translate", p = { fontSize: s["font-size"] }, f = (R, H) => {
    const S = On(R, p);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof H == "number" ? S.px + S.pct / 100 * H : void 0 : S.px;
  }, _ = u ? f(u[0], i.w) : void 0, w = u ? f(u[1], i.h) : void 0;
  if (_ === void 0 || w === void 0) {
    o("unsupported", d, s[d], n.sources[d]);
    return;
  }
  _ && (i.ml = (i.ml ?? 0) + _), w && (i.mt = (i.mt ?? 0) + w);
}
function ud(n, i, o = null) {
  const s = n.values, u = {}, d = (E) => n.sources[E], p = (E) => n.sources[E] !== void 0, f = s.display;
  f === "none" ? u.display = "hidden" : f === "flex" || f === "inline-flex" ? u.display = "flex" : (f === "grid" || f === "inline-grid") && (u.display = "flex", u.flex_direction = "col", i("approximated", "display", f, d("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", s["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (u.display = "hidden");
  const _ = u.display === "flex";
  if (_ && u.flex_direction !== "col") {
    const E = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    u.flex_direction = E;
  }
  if (_) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (u.flex_wrap = "wrap");
    const E = f === "grid" || f === "inline-grid", N = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    N && (u.items = N);
    let M = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (E) {
      const g = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      g && (u.items = g), s["align-items"] === "center" && (M = "center");
    }
    M && (u.justify = M);
    const D = ca(s["row-gap"]), C = ca(s["column-gap"]);
    typeof D == "number" && D && (u.gap_y = D), typeof C == "number" && C && !E && (u.gap_x = C);
  }
  s["flex-grow"] && (u.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (u.flex_shrink = s["flex-shrink"]);
  const w = ca(s["flex-basis"]);
  w !== void 0 && w !== "auto" && (u.flex_basis = w);
  const R = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  R && (u.self = R);
  for (const [E, N] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const M = s[N], D = ca(M);
    if (D === void 0 && N === "width" && Ih(M, s)) {
      u.self = "stretch", i("approximated", N, M.expr, d(N), "stretched across its parent, inside its margins");
      continue;
    }
    if (D === void 0) {
      typeof M == "object" && M.expr ? i("unsupported", N, M.expr, d(N), "no calc() in the engine") : typeof M == "string" && !["auto", "none"].includes(M) && i("unsupported", N, M, d(N));
      continue;
    }
    D !== "auto" && (u[E] = D);
  }
  const H = ["top", "right", "bottom", "left"];
  for (const E of H) {
    const N = E[0];
    for (const [M, D] of [["p", "padding"], ["m", "margin"]]) {
      const C = s[`${D}-${E}`], g = ca(C);
      if (g === void 0) {
        C?.expr && i("unsupported", `${D}-${E}`, C.expr, d(`${D}-${E}`), "no calc() in the engine");
        continue;
      }
      g !== 0 && (u[`${M}${N}`] = g);
    }
  }
  const S = s.position;
  if (S === "absolute" || S === "fixed") {
    u.position = "absolute", S === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const E of H) {
      const N = ca(s[E]);
      N !== void 0 && N !== "auto" && (u[E] = N);
    }
    if (S === "fixed" && o && u.w === void 0 && u.right === void 0 && typeof u.left == "number") {
      const E = o.width - u.left - (typeof u.ml == "number" ? u.ml : 0) - (typeof u.mr == "number" ? u.mr : 0);
      u.max_w = typeof u.max_w == "number" ? Math.min(u.max_w, E) : E;
    }
    Ph(n, u, i);
  } else S === "sticky" && i("unsupported", "position", "sticky", d("position"));
  s["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", s["z-index"], d("z-index"), "paint order is tree order");
  for (const [E, N] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const M = s[N];
    M === "hidden" || M === "clip" ? u[E] = "hidden" : (M === "auto" || M === "scroll") && (u[E] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (u.visibility = "invisible");
  const y = s["background-color"];
  y?.unreadable ? i("unsupported", "background-color", y.unreadable, d("background-color")) : y?.rgba && y.rgba[3] > 0 && (u.bg = ki(y)), s["background-image"] && s["background-image"] !== "none" && i("unsupported", "background-image", s["background-image"], d("background-image"));
  const z = H.map((E) => ca(s[`border-${E}-width`]) || 0), x = [];
  H.forEach((E, N) => {
    if (!z[N]) return;
    u[`border_${E[0]}`] = z[N];
    const M = s[`border-${E}-style`];
    M !== "solid" && i("approximated", `border-${E}-style`, M, d(`border-${E}-style`), "drawn solid");
    const D = ki(s[`border-${E}-color`]);
    D && x.push(D);
  }), x.length && (u.border_color = x[0], x.some((E) => E.value !== x[0].value) && i("approximated", "border-color", x.map((E) => E.value).join(" "), d("border-top-color"), "one border colour"));
  const k = ["top-left", "top-right", "bottom-right", "bottom-left"].map((E) => ca(s[`border-${E}-radius`]) || 0);
  k.every((E) => E === k[0]) ? k[0] && (u.rounded = k[0]) : ["tl", "tr", "br", "bl"].forEach((E, N) => {
    k[N] && (u[`rounded_${E}`] = k[N]);
  }), s.opacity !== 1 && (u.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const Y = s["box-shadow"];
  if (Y && Y !== "none" && ie(Y, ",").some((E) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(E.trim())) && (u.shadow = "lg", i("approximated", "box-shadow", Y, d("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !n.inherited.has("cursor")) {
    const E = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    E ? u.cursor = E : i("unsupported", "cursor", s.cursor, d("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (u.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? u.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", s["text-decoration-line"], d("text-decoration-line")), u;
}
const t0 = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Xd(n) {
  if (!n || n === "normal") return "";
  const i = String(n).trim().split(/\s+/).map((o) => t0[o]);
  return i.every(Boolean) ? i.join(",") : null;
}
function dd(n, i) {
  const o = n.values, s = o["line-height"];
  return {
    text_color: ki(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Xd(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(Zo(o, i) * 1e3) / 1e3 },
    font_family: Zh(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const md = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, Zd = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function fd(n, i, o) {
  const s = {}, u = (f, _) => _.some((w) => !n.inherited.has(w));
  for (const [f, _] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (u(f, _) || !Zd(i[f], o[f])) && (s[f] = i[f]);
  const d = md(i.line_height, i.text_size), p = o.line_height ? md(o.line_height, i.text_size) : NaN;
  return (u("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (s.line_height = i.line_height), s;
}
const e0 = (n, i) => ({ ...n, ...i });
function pd(n, i) {
  const o = {};
  for (const [s, u] of Object.entries(n))
    u && typeof u == "object" && "value" in u ? (o[s] = u.value, u.token && (i[s] = u.token)) : s === "line_height" ? o[s] = u.factor !== void 0 ? Math.round(u.factor * 1e3) / 1e3 : `${u.px}px` : s === "italic" ? u && (o.italic = !0) : o[s] = u;
  return o.italic === !1 && delete o.italic, o;
}
function a0(n, i) {
  const o = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const u = n[s], d = i[s];
    Zd(u, d) || (o[s] = d === void 0 ? s in Ei ? Ei[s] : null : d);
  }
  return o;
}
function hd(n, i) {
  const o = n.values;
  for (const [s, u] of Object.entries(n.sources)) {
    if (s.startsWith("--") || Kh.has(s) || u.startsWith("ua:")) continue;
    const d = o[s];
    switch (s) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", s, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, u, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Xd(d) === null && i("unsupported", s, d, u);
        break;
      case "text-transform":
        d !== "none" && i("approximated", s, d, u, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        s === "transition-property" && p && ie(p, ",").some((f) => parseFloat(f) > 0) && o["transition-property"] !== "none" && i("unsupported", "transition", `${o["transition-property"]} ${p}`, u, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && i("unsupported", s, d, u, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        s === "overflow-wrap" && d !== "normal" && i("approximated", s, d, u, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && s === "outline-style" && i("unsupported", "outline", `${ca(o["outline-width"])}px ${o["outline-style"]} ${ki(o["outline-color"])?.value ?? ""}`.trim(), u, "no outline in the engine (no focus ring)");
        break;
      case "transform":
      case "translate":
        o.position !== "absolute" && o.position !== "fixed" && d && d !== "none" && i("unsupported", s, d, u);
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && i("unsupported", s, d, u);
        break;
    }
  }
}
function n0(n, i, o, s) {
  const u = Vd(n), d = [], p = (k, Y, E, N, M) => d.push([k, Y, E, N ?? "(user agent)", u, M]), f = s.cascade.compute(n, i), _ = {}, w = ud(f, p, s.viewport);
  hd(f, p);
  const R = dd(f, s.measure), H = fd(f, R, o), S = pd({ ...w, ...H }, _), y = {}, z = s.cascade.matching(n, "*").filter((k) => k.states.subject.size);
  for (const [k, Y] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!z.some((C) => Y.some((g) => C.states.subject.has(g)))) continue;
    const E = s.cascade.compute(n, i, new Set(Y)), N = {}, M = pd({ ...ud(E, () => {
    }), ...fd(E, dd(E, s.measure), o) }, N);
    k === "focus" && hd(E, p);
    const D = a0(S, M);
    if (Object.keys(D).length) {
      y[k] = D;
      const C = Object.fromEntries(Object.entries(N).filter(([g]) => g in D));
      Object.keys(C).length && (y[`${k}_tokens`] = C);
    }
  }
  if (s.cascade.sheet.tracks(n, "hover") && (y.track_hover = !0), /tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (y.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (y.break_anywhere = !0), w.overflow_y === "scroll") {
    const k = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    k > 0 && (y.scrollbar = k);
  }
  f.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (y.blocks_pointer = !0);
  const x = Object.entries(Jh).filter(([, k]) => k.some((Y) => typeof n.props[Y] == "function")).map(([k]) => k);
  return !x.includes("click") && Co(n) && x.push("click"), x.length && (y.events = x), { computed: f, style: S, tokens: _, extra: y, meta: o0(n), reports: d, childText: e0(o, H), where: u };
}
function Jd(n, i, o, s, u = "") {
  const d = `${u}/${n.id}.${n.version}`;
  let p = s.cache.get(n);
  (!p || p.key !== d) && s.cache.set(n, p = { key: d, part: n0(n, i, o, s) });
  const { computed: f, tokens: _, extra: w, reports: R, childText: H, where: S } = p.part;
  for (const h of R) s.findings.add(...h);
  const y = (h, G, J, at, ot) => s.findings.add(h, G, J, at, S, ot), z = { ...p.part.style }, x = { kind: "div", id: n.id, style: z, tokens: _, meta: p.part.meta, ...w };
  Object.defineProperty(x, Mn, { value: f.values.display });
  const k = n.tagName;
  if (k === "svg")
    return x.kind = n.props["data-perch-image"] ? "image" : "svg", x.markup = c0(n), x;
  if (k === "input" || k === "textarea" || k === "select") {
    x.kind = "input", x.input_type = k === "input" ? String(n.props.type ?? "text") : k;
    for (const h of ["placeholder", "checked", "disabled"]) n.props[h] !== void 0 && (x[h] = n.props[h]);
    return /^(checkbox|radio)$/.test(x.input_type) && (x.checked = n.checked), k !== "select" && (x.value = n.value), k === "input" && Wh.test(x.input_type) && (x.field_w = Fh * f.values["font-size"]), x;
  }
  if (k === "img")
    return x.kind = "image", x.src = n.props.src ?? null, x;
  const Y = f.values["text-transform"], E = [];
  let N = !1, M = !1;
  for (const h of n.childNodes) {
    if (h instanceof Ko) {
      if (h.hidden || h.data === "") continue;
      N = !0;
      const at = E[E.length - 1];
      if (at?.kind === "text")
        at.source = (at.source ?? at.text) + h.data, at.text = gd(at.source, Y), at.text === at.source && delete at.source;
      else {
        const ot = gd(h.data, Y);
        E.push(ot === h.data ? { kind: "text", text: ot } : { kind: "text", text: ot, source: h.data });
      }
      continue;
    }
    if (!(h instanceof ze)) continue;
    const G = Jd(h, f, H, s, d), J = G[Mn];
    J === "inline" || J === "inline-block" || J === "inline-flex" ? N = !0 : J !== "none" && (M = !0), E.push(G);
  }
  const D = E.some((h) => h.kind !== "text"), C = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][Mn]) ? E[0] : null;
  if (!z.display && C) {
    const h = s.cache.get(n.childNodes.find((J) => J.id === C.id))?.part.computed, G = h ? Ho(f.values, s.measure) - r0(h.values, s.measure) : 0;
    z.display = "flex", z.flex_direction = "col", z.items = "start", G > 0 && (C.style.mt = Math.round(((C.style.mt ?? 0) + G) * 100) / 100), y("approximated", "display", `${f.values.display} holding one ${C[Mn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!z.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][Mn] === "inline" && typeof E[0].style.h == "number") {
    const h = E[0], G = Ho(f.values, s.measure), J = Zo(f.values, s.measure) - G, at = (ot) => Math.round(ot * 100) / 100;
    z.display = "flex", z.flex_direction = "col", z.items = "start", G > h.style.h && (h.style.mt = at((h.style.mt ?? 0) + G - h.style.h)), J > 0 && (h.style.mb = at((h.style.mb ?? 0) + J)), y("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!z.display && N && D) {
    if (z.display = "flex", z.flex_direction = M ? "col" : "row", !M) z.items = "baseline";
    else for (const h of E) h.kind !== "text" && /^inline-(block|flex)$/.test(h[Mn]) && !h.style.self && (h.style.self = "start");
    y("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", M ? "a column of its children" : "a row on the text baseline");
  }
  const g = f.values["letter-spacing"]?.px;
  if (g)
    for (let h = 0; h < E.length; h++) {
      const G = E[h];
      if (G.kind !== "text") continue;
      const J = Math.round(g * [...G.text].length * 1e3) / 1e3;
      E[h] = { kind: "div", style: { pr: J }, tokens: {}, children: [G] };
    }
  return x.children = E, x;
}
function l0(n, i) {
  if (!i) return null;
  let s = (i.self ? n : i.closest ? Dd(n, i.closest) : i.find ? fl(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return s && i.strip && s.startsWith(i.strip) && (s = s.slice(i.strip.length)), s;
}
function i0(n, i, o) {
  const s = i.map((p) => [p, Mi(p.selector)]), u = /* @__PURE__ */ new Map(), d = (p) => {
    for (const f of p.children) {
      const _ = o.get(f.id);
      if (_)
        for (const [w, R] of s) {
          const H = w.textRange ? "range_name" : "name";
          if (_[H] != null || !R.some((z) => Hd(f, z))) continue;
          const S = l0(f, w.key), y = S == null ? u.get(w.name) ?? 0 : 0;
          S == null && u.set(w.name, y + 1), _[H] = S != null ? `${w.name}:${S}` : y ? `${w.name}@${y}` : w.name;
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Ni = 0.9521, Ld = 0.2256, Ho = (n, i) => (Zo(n, i) - (Ni + Ld) * n["font-size"]) / 2 + Ni * n["font-size"];
function r0(n, i) {
  const o = (u) => u && typeof u == "object" && "px" in u ? u.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]);
  return o(n["padding-top"]) + s + Ho(n, i);
}
const gd = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, Wd = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function o0(n) {
  const i = {};
  for (const [o, s] of Object.entries(n.props)) {
    if (Wd.has(o) || typeof s == "function" || s === void 0 || s === null || typeof s == "object") continue;
    const u = o.startsWith("aria-") || o.startsWith("data-");
    if (s === !1 && !u) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    i[d] = typeof s == "boolean" ? u ? String(s) : "" : String(s);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const s0 = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), bd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function c0(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (o) => {
    const s = [];
    for (const [d, p] of Object.entries(o.props))
      Wd.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || s.push(`${s0(d)}="${bd(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const u = o.childNodes.map((d) => d instanceof Ko ? bd(d.data) : i(d)).join("");
    return `<${o.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${u}</${o.tagName}>`;
  };
  return i(n);
}
function u0(n) {
  const i = n.theme?.() ?? {}, o = {};
  for (const s of Yd) i[s] && (o[s] = i[s]);
  return o;
}
const d0 = { font_features: "" };
function m0(n, i, o, s = {}, u = null) {
  const d = u0(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, p]);
  (s.look !== f || s.sheet !== o) && Object.assign(s, { look: f, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new Uh(o, { theme: d, viewport: p }), top: null });
  const { cascade: _, cache: w } = s, R = { cascade: _, cache: w, viewport: p, findings: new Lh(), measure: i.lineHeight ? (y) => i.lineHeight(y) : null };
  s.top ??= _.compute(n.body, _.compute(n.documentElement, null));
  const H = n.body.children.map((y) => Jd(y, s.top, d0, R));
  if (u?.length) {
    const y = /* @__PURE__ */ new Map(), z = (x) => {
      x.id && y.set(x.id, x);
      for (const k of x.children ?? []) z(k);
    };
    H.forEach(z), i0(n, u, y);
  }
  const S = /* @__PURE__ */ new Set();
  for (const y of [n, n.defaultView])
    for (const { type: z } of y?.listeners ?? []) cd[z] && S.add(cd[z]);
  return { schema: Gh, root: H[0] ?? null, overlays: H.slice(1), document_events: [...S].sort(), unsupported: R.findings.list() };
}
const f0 = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let p0 = null;
const h0 = () => p0 ??= new Ah(f0);
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
function g0(n, i) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const s of o) {
    if (s === "children") continue;
    const u = n[s], d = i[s];
    if (!(u === d || typeof u == "function" && typeof d == "function") && !(s === "style" && u && d && typeof u == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(u), ...Object.keys(d)])].every((f) => u[f] === d[f])))
      return !0;
  }
  return !1;
}
const b0 = {
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
  createInstance: (n, i, o) => new ze(n, i, o.ownerDocument),
  createTextInstance: (n, i) => new Ko(n),
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
    n.props = s, g0(o, s) && n.touch();
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
}, _e = vh(b0), Ai = (n, i, o = null) => _e.createPortal(n, i, null, o), v0 = {
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
class y0 {
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
  for (const { type: s, listener: u, capture: d } of [...n.listeners ?? []])
    s === i.type && d === o && u.call(n, i);
  if (n instanceof ze) {
    const s = v0[i.type], u = s && n.props[o ? `${s}Capture` : s];
    typeof u == "function" && u(i);
  }
}
function nv(n, i, o = {}) {
  const { document: s, window: u, globals: d } = oh(n), p = new ze("div", { id: "root", style: o.container ?? {} }, s);
  s.body.appendChild(p);
  const f = [];
  let _ = null;
  const w = () => [s, u].map((N) => N.listeners.map((M) => `${M.type}:${M.capture}`).sort().join(",")).join("|");
  let R = "";
  const H = {}, S = () => (_ = m0(s, n, h0(), H, o.names), R = w(), n.render?.(_), _), y = () => {
    _e.flushPassiveEffects(), _e.flushSyncWork(), w() !== R && S();
  };
  s.afterCommit = S;
  const z = (N) => {
    f.push(N), n.error?.(N);
  }, x = _e.createContainer(p, pl.ConcurrentRoot, null, !1, null, "", z, z, z, null);
  _e.updateContainerSync(ft.createElement(i, o.props ?? {}), x, null, null), _e.flushSyncWork(), y();
  const k = (N) => {
    const M = (D) => {
      if (D.id === N) return D;
      for (const C of D.children) {
        const g = M(C);
        if (g) return g;
      }
      return null;
    };
    return M(s.documentElement);
  }, Y = (N) => {
    const M = Pa;
    Pa = pl.DiscreteEventPriority;
    try {
      return N();
    } finally {
      Pa = M, _e.flushSyncWork(), y();
    }
  }, E = {
    document: s,
    window: u,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: p,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return _;
    },
    describe: S,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(N, M, D = {}) {
      const C = typeof N == "string" ? k(N) : N;
      if (!C) return !1;
      const g = new y0(M, D, C), h = [];
      for (let at = C; at; at = at.parentNode) h.push(at);
      const G = [...h, s, u];
      Y(() => {
        for (let at = G.length - 1; at > 0 && !g.propagationStopped; at--) vi(G[at], g, !0);
        g.propagationStopped || (vi(C, g, !0), g.propagationStopped || vi(C, g, !1));
        for (let at = 1; at < G.length && !g.propagationStopped; at++) vi(G[at], g, !1);
      });
      const J = M === "click" && !g.defaultPrevented ? Co(C) : null;
      return J && E.dispatch(J, "submit", {}), !g.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(N) {
      const M = s.activeElement && s.activeElement !== s.body ? s.activeElement : s.body;
      if (!E.dispatch(M, "keydown", N)) return !0;
      const C = N.key === "Enter" && !N.isComposing ? Co(M, !0) : null;
      if (C)
        return E.dispatch(C, "submit", {}), !0;
      if (!Bd(M) || M.props.disabled || M.props.readOnly) return !1;
      if ((N.ctrlKey || N.metaKey) && !N.altKey && !N.shiftKey && N.key.toLowerCase() === "a")
        return M.selectedAll = !0, !0;
      if (N.ctrlKey || N.metaKey) return !1;
      const g = M.selectedAll;
      M.selectedAll = !1;
      const h = M.value, J = N.key === "Backspace" || g && N.key === "Delete" ? g ? "" : h.slice(0, -1) : [...N.key].length === 1 ? (g ? "" : h) + N.key : h;
      return J === h ? !1 : (M.value = J, E.dispatch(M, "input", { data: N.key }), E.dispatch(M, "change", {}), M.props.value !== void 0 && delete M.edit, M.touch(), S(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(N, M) {
      const D = k(N);
      D && (D.bounds = { x: M.x, y: M.y, width: M.width, height: M.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(N) {
      const M = k(N);
      if (!M || M.props.disabled || !E.dispatch(N, "click", { button: 0, detail: 1 })) return;
      const D = M.props.type === "radio";
      D && M.checked || (M.checked = D ? !0 : !M.checked, E.dispatch(N, "input", {}), E.dispatch(N, "change", {}), M.props.checked !== void 0 && delete M.ticked, M.touch(), S());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(N, M = {}) {
      const D = { button: 0, buttons: 1, pointerType: "mouse", ...M };
      for (const C of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) E.dispatch(N, C, D);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (N) => !!k(N)?.state.hover,
    hover(N, M) {
      const D = k(N);
      !D || D.state.hover === M || (D.state.hover = M, D.touch(), S());
    },
    focus(N) {
      const M = k(N);
      M && (Y(() => {
        const D = s.activeElement;
        D && D !== M && D !== s.body && E.dispatch(D, "blur"), s.focus(M), E.dispatch(M, "focus");
      }), S());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: y,
    update(N) {
      _e.updateContainerSync(ft.createElement(i, N ?? {}), x, null, null), _e.flushSyncWork(), y();
    },
    unmount() {
      _e.updateContainerSync(null, x, null, null), _e.flushSyncWork(), _e.flushPassiveEffects(), s.afterCommit = null;
    }
  };
  return E;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Fd = (n) => _e.flushSyncFromReconciler(n), x0 = { createPortal: Ai, flushSync: Fd }, lv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Ai,
  default: x0,
  flushSync: Fd
}, Symbol.toStringTag, { value: "Module" }));
function Id(n) {
  var i, o, s = "";
  if (typeof n == "string" || typeof n == "number") s += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var u = n.length;
    for (i = 0; i < u; i++) n[i] && (o = Id(n[i])) && (s && (s += " "), s += o);
  } else for (o in n) n[o] && (s && (s += " "), s += o);
  return s;
}
function $d() {
  for (var n, i, o = 0, s = "", u = arguments.length; o < u; o++) (n = arguments[o]) && (i = Id(n)) && (s && (s += " "), s += i);
  return s;
}
const w0 = (n, i) => {
  const o = new Array(n.length + i.length);
  for (let s = 0; s < n.length; s++)
    o[s] = n[s];
  for (let s = 0; s < i.length; s++)
    o[n.length + s] = i[s];
  return o;
}, _0 = (n, i) => ({
  classGroupId: n,
  validator: i
}), Pd = (n = /* @__PURE__ */ new Map(), i = null, o) => ({
  nextPart: n,
  validators: i,
  classGroupId: o
}), Ti = "-", vd = [], S0 = "arbitrary..", z0 = (n) => {
  const i = E0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: s
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return k0(p);
      const f = p.split(Ti), _ = f[0] === "" && f.length > 1 ? 1 : 0;
      return tm(f, _, i);
    },
    getConflictingClassGroupIds: (p, f) => {
      if (f) {
        const _ = s[p], w = o[p];
        return _ ? w ? w0(w, _) : _ : w || vd;
      }
      return o[p] || vd;
    }
  };
}, tm = (n, i, o) => {
  if (n.length - i === 0)
    return o.classGroupId;
  const u = n[i], d = o.nextPart.get(u);
  if (d) {
    const w = tm(n, i + 1, d);
    if (w) return w;
  }
  const p = o.validators;
  if (p === null)
    return;
  const f = i === 0 ? n.join(Ti) : n.slice(i).join(Ti), _ = p.length;
  for (let w = 0; w < _; w++) {
    const R = p[w];
    if (R.validator(f))
      return R.classGroupId;
  }
}, k0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), o = i.indexOf(":"), s = i.slice(0, o);
  return s ? S0 + s : void 0;
})(), E0 = (n) => {
  const {
    theme: i,
    classGroups: o
  } = n;
  return N0(o, i);
}, N0 = (n, i) => {
  const o = Pd();
  for (const s in n) {
    const u = n[s];
    Jo(u, o, s, i);
  }
  return o;
}, Jo = (n, i, o, s) => {
  const u = n.length;
  for (let d = 0; d < u; d++) {
    const p = n[d];
    T0(p, i, o, s);
  }
}, T0 = (n, i, o, s) => {
  if (typeof n == "string") {
    C0(n, i, o);
    return;
  }
  if (typeof n == "function") {
    j0(n, i, o, s);
    return;
  }
  M0(n, i, o, s);
}, C0 = (n, i, o) => {
  const s = n === "" ? i : em(i, n);
  s.classGroupId = o;
}, j0 = (n, i, o, s) => {
  if (A0(n)) {
    Jo(n(s), i, o, s);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(_0(o, n));
}, M0 = (n, i, o, s) => {
  const u = Object.entries(n), d = u.length;
  for (let p = 0; p < d; p++) {
    const [f, _] = u[p];
    Jo(_, em(i, f), o, s);
  }
}, em = (n, i) => {
  let o = n;
  const s = i.split(Ti), u = s.length;
  for (let d = 0; d < u; d++) {
    const p = s[d];
    let f = o.nextPart.get(p);
    f || (f = Pd(), o.nextPart.set(p, f)), o = f;
  }
  return o;
}, A0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, O0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, o = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const u = (d, p) => {
    o[d] = p, i++, i > n && (i = 0, s = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let p = o[d];
      if (p !== void 0)
        return p;
      if ((p = s[d]) !== void 0)
        return u(d, p), p;
    },
    set(d, p) {
      d in o ? o[d] = p : u(d, p);
    }
  };
}, Do = "!", yd = ":", R0 = [], xd = (n, i, o, s, u) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: o,
  maybePostfixModifierPosition: s,
  isExternal: u
}), H0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: o
  } = n;
  let s = (u) => {
    const d = [];
    let p = 0, f = 0, _ = 0, w;
    const R = u.length;
    for (let x = 0; x < R; x++) {
      const k = u[x];
      if (p === 0 && f === 0) {
        if (k === yd) {
          d.push(u.slice(_, x)), _ = x + 1;
          continue;
        }
        if (k === "/") {
          w = x;
          continue;
        }
      }
      k === "[" ? p++ : k === "]" ? p-- : k === "(" ? f++ : k === ")" && f--;
    }
    const H = d.length === 0 ? u : u.slice(_);
    let S = H, y = !1;
    H.endsWith(Do) ? (S = H.slice(0, -1), y = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      H.startsWith(Do) && (S = H.slice(1), y = !0)
    );
    const z = w && w > _ ? w - _ : void 0;
    return xd(d, y, S, z);
  };
  if (i) {
    const u = i + yd, d = s;
    s = (p) => p.startsWith(u) ? d(p.slice(u.length)) : xd(R0, !1, p, void 0, !0);
  }
  if (o) {
    const u = s;
    s = (d) => o({
      className: d,
      parseClassName: u
    });
  }
  return s;
}, D0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, s) => {
    i.set(o, 1e6 + s);
  }), (o) => {
    const s = [];
    let u = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], f = p[0] === "[", _ = i.has(p);
      f || _ ? (u.length > 0 && (u.sort(), s.push(...u), u = []), s.push(p)) : u.push(p);
    }
    return u.length > 0 && (u.sort(), s.push(...u)), s;
  };
}, U0 = (n) => ({
  cache: O0(n.cacheSize),
  parseClassName: H0(n),
  sortModifiers: D0(n),
  postfixLookupClassGroupIds: B0(n),
  ...z0(n)
}), B0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let s = 0; s < o.length; s++)
      i[o[s]] = !0;
  return i;
}, q0 = /\s+/, Y0 = (n, i) => {
  const {
    parseClassName: o,
    getClassGroupId: s,
    getConflictingClassGroupIds: u,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, f = [], _ = n.trim().split(q0);
  let w = "";
  for (let R = _.length - 1; R >= 0; R -= 1) {
    const H = _[R], {
      isExternal: S,
      modifiers: y,
      hasImportantModifier: z,
      baseClassName: x,
      maybePostfixModifierPosition: k
    } = o(H);
    if (S) {
      w = H + (w.length > 0 ? " " + w : w);
      continue;
    }
    let Y = !!k, E;
    if (Y) {
      const g = x.substring(0, k);
      E = s(g);
      const h = E && p[E] ? s(x) : void 0;
      h && h !== E && (E = h, Y = !1);
    } else
      E = s(x);
    if (!E) {
      if (!Y) {
        w = H + (w.length > 0 ? " " + w : w);
        continue;
      }
      if (E = s(x), !E) {
        w = H + (w.length > 0 ? " " + w : w);
        continue;
      }
      Y = !1;
    }
    const N = y.length === 0 ? "" : y.length === 1 ? y[0] : d(y).join(":"), M = z ? N + Do : N, D = M + E;
    if (f.indexOf(D) > -1)
      continue;
    f.push(D);
    const C = u(E, Y);
    for (let g = 0; g < C.length; ++g) {
      const h = C[g];
      f.push(M + h);
    }
    w = H + (w.length > 0 ? " " + w : w);
  }
  return w;
}, G0 = (...n) => {
  let i = 0, o, s, u = "";
  for (; i < n.length; )
    (o = n[i++]) && (s = am(o)) && (u && (u += " "), u += s);
  return u;
}, am = (n) => {
  if (typeof n == "string")
    return n;
  let i, o = "";
  for (let s = 0; s < n.length; s++)
    n[s] && (i = am(n[s])) && (o && (o += " "), o += i);
  return o;
}, Q0 = (n, ...i) => {
  let o, s, u, d;
  const p = (_) => {
    const w = i.reduce((R, H) => H(R), n());
    return o = U0(w), s = o.cache.get, u = o.cache.set, d = f, f(_);
  }, f = (_) => {
    const w = s(_);
    if (w)
      return w;
    const R = Y0(_, o);
    return u(_, R), R;
  };
  return d = p, (..._) => d(G0(..._));
}, K0 = [], Zt = (n) => {
  const i = (o) => o[n] || K0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, nm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, lm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, V0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, X0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, Z0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, J0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, L0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, W0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ca = (n) => V0.test(n), pt = (n) => !!n && !Number.isNaN(Number(n)), Ze = (n) => !!n && Number.isInteger(Number(n)), Eo = (n) => n.endsWith("%") && pt(n.slice(0, -1)), sa = (n) => X0.test(n), im = () => !0, F0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  Z0.test(n) && !J0.test(n)
), Lo = () => !1, I0 = (n) => L0.test(n), $0 = (n) => W0.test(n), P0 = (n) => !W(n) && !F(n), tg = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), eg = (n) => Aa(n, sm, Lo), W = (n) => nm.test(n), $a = (n) => Aa(n, cm, F0), wd = (n) => Aa(n, cg, pt), ag = (n) => Aa(n, dm, im), ng = (n) => Aa(n, um, Lo), _d = (n) => Aa(n, rm, Lo), lg = (n) => Aa(n, om, $0), yi = (n) => Aa(n, mm, I0), F = (n) => lm.test(n), dl = (n) => en(n, cm), ig = (n) => en(n, um), Sd = (n) => en(n, rm), rg = (n) => en(n, sm), og = (n) => en(n, om), xi = (n) => en(n, mm, !0), sg = (n) => en(n, dm, !0), Aa = (n, i, o) => {
  const s = nm.exec(n);
  return s ? s[1] ? i(s[1]) : o(s[2]) : !1;
}, en = (n, i, o = !1) => {
  const s = lm.exec(n);
  return s ? s[1] ? i(s[1]) : o : !1;
}, rm = (n) => n === "position" || n === "percentage", om = (n) => n === "image" || n === "url", sm = (n) => n === "length" || n === "size" || n === "bg-size", cm = (n) => n === "length", cg = (n) => n === "number", um = (n) => n === "family-name", dm = (n) => n === "number" || n === "weight", mm = (n) => n === "shadow", ug = () => {
  const n = Zt("color"), i = Zt("font"), o = Zt("text"), s = Zt("font-weight"), u = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), f = Zt("container"), _ = Zt("spacing"), w = Zt("radius"), R = Zt("shadow"), H = Zt("inset-shadow"), S = Zt("text-shadow"), y = Zt("drop-shadow"), z = Zt("blur"), x = Zt("perspective"), k = Zt("aspect"), Y = Zt("ease"), E = Zt("animate"), N = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], M = () => [
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
  ], D = () => [...M(), F, W], C = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [F, W, _], G = () => [Ca, "full", "auto", ...h()], J = () => [Ze, "none", "subgrid", F, W], at = () => ["auto", {
    span: ["full", Ze, F, W]
  }, Ze, F, W], ot = () => [Ze, "auto", F, W], jt = () => ["auto", "min", "max", "fr", F, W], Kt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Nt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], K = () => ["auto", ...h()], et = () => [Ca, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], nt = () => [f, Ca, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], U = () => [Ca, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], B = () => [n, F, W], b = () => [...M(), Sd, _d, {
    position: [F, W]
  }], q = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", rg, eg, {
    size: [F, W]
  }], $ = () => [Eo, dl, $a], P = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    w,
    F,
    W
  ], lt = () => ["", pt, dl, $a], xt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ut = () => [pt, Eo, Sd, _d], Oa = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    z,
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
      color: [im],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [P0],
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
        aspect: ["auto", "square", Ca, W, F, k]
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
      "container-named": [tg],
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
        overflow: C()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": C()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": C()
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
        inset: G()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": G()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": G()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": G(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: G()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": G(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: G()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": G()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": G()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: G()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: G()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: G()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: G()
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
        "col-start": ot()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": ot()
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
        "row-start": ot()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": ot()
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
        "auto-cols": jt()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": jt()
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
        "justify-items": [...Nt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...Nt()]
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
        items: [...Nt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...Nt(), {
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
        "place-items": [...Nt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...Nt()]
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
        size: et()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...nt()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...nt()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...nt()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/block-size
       */
      "block-size": [{
        block: ["auto", ...U()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...U()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...U()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [f, "screen", ...et()]
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
          ...et()
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
          ...et()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...et()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...et()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...et()]
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
        font: [s, sg, ag]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Eo, W]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [ig, ng, i]
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
        tracking: [u, F, W]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [pt, "none", F, wd]
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
        placeholder: B()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: B()
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
        decoration: B()
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
        bg: b()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: q()
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
        }, og, lg]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: B()
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
        from: B()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: B()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: B()
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
        border: lt()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": lt()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": lt()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": lt()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": lt()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": lt()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": lt()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": lt()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": lt()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": lt()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": lt()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": lt()
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
        "divide-y": lt()
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
        border: B()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": B()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": B()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": B()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": B()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": B()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": B()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": B()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": B()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": B()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": B()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: B()
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
        outline: B()
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
          R,
          xi,
          yi
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: B()
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
        "inset-shadow": B()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: lt()
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
        ring: B()
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
        "ring-offset": B()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": lt()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": B()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", S, xi, yi]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": B()
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
        "mask-linear-from": ut()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": ut()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": B()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": B()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": ut()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": ut()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": B()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": B()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": ut()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": ut()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": B()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": B()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": ut()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": ut()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": B()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": B()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": ut()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": ut()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": B()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": B()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": ut()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": ut()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": B()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": B()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": ut()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": ut()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": B()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": B()
      }],
      "mask-image-radial": [{
        "mask-radial": [F, W]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": ut()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": ut()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": B()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": B()
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
        "mask-radial-at": M()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [pt]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": ut()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": ut()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": B()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": B()
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
        mask: b()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: q()
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
          y,
          xi,
          yi
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": B()
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
        ease: ["linear", "initial", Y, F, W]
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
        perspective: [x, F, W]
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
        accent: B()
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
        caret: B()
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
        "scrollbar-thumb": B()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": B()
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
        fill: ["none", ...B()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [pt, dl, $a, wd]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...B()]
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
}, dg = /* @__PURE__ */ Q0(ug);
function je(...n) {
  return dg($d(n));
}
const fm = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ci = {
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
for (let n = 1; n <= 12; n++) Ci[`f${n}`] = `F${n}`;
const mg = Object.fromEntries(Object.entries(Ci).map(([n, i]) => [i, n])), fg = {
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
function pg(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : mg[n];
}
const zd = /* @__PURE__ */ new Map();
function pm(n, i = fm) {
  const o = `${i}|${n}`, s = zd.get(o);
  if (s) return s;
  const u = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      i ? u.cmd = !0 : (u.ctrl = !0, u.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") u[d] = !0;
    else if (/^[a-z]$/.test(d))
      u.code = `Key${d.toUpperCase()}`, u.letter = d;
    else if (/^[0-9]$/.test(d)) u.code = `Digit${d}`;
    else if (Ci[d]) u.code = Ci[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!u.code) throw new Error(`no key in "${n}"`);
  return zd.set(o, u), u;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = pm(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function hg(n, i = fm) {
  const o = pm(n, i), s = gg(pg(o.code) ?? "");
  return i ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${s}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", s].filter(Boolean).join("+");
}
const gg = (n) => fg[n] ?? n.toUpperCase(), kd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Ed = $d, Oi = (n, i) => (o) => {
  var s;
  if (i?.variants == null) return Ed(n, o?.class, o?.className);
  const { variants: u, defaultVariants: d } = i, p = Object.keys(u).map((w) => {
    const R = o?.[w], H = d?.[w];
    if (R === null) return null;
    const S = kd(R) || kd(H);
    return u[w][S];
  }), f = o && Object.entries(o).reduce((w, R) => {
    let [H, S] = R;
    return S === void 0 || (w[H] = S), w;
  }, {}), _ = i == null || (s = i.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((w, R) => {
    let { class: H, className: S, ...y } = R;
    return Object.entries(y).every((z) => {
      let [x, k] = z;
      return Array.isArray(k) ? k.includes({
        ...d,
        ...f
      }[x]) : {
        ...d,
        ...f
      }[x] === k;
    }) ? [
      ...w,
      H,
      S
    ] : w;
  }, []);
  return Ed(n, p, _, o?.class, o?.className);
}, bg = Oi(
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
), vg = Oi(
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
function yg({ className: n, ...i } = {}) {
  return je(vg(i), n);
}
const hm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", gm = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", xg = Oi(`${gm} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function wg({ className: n, ...i } = {}) {
  return je(xg(i), n);
}
const bm = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", _g = Oi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Sg = "my-1 h-px bg-overlay-0";
function zg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function kg({ size: n = 16, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Eg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function vm({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Nd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Ng({ state: n, error: i }) {
  return /* @__PURE__ */ zt.jsx(
    "span",
    {
      className: je("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Nd[n] ?? Nd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function Tg({ title: n, onClose: i, children: o, testId: s }) {
  return Ai(
    /* @__PURE__ */ zt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (u) => {
          u.target === u.currentTarget && i();
        },
        onKeyDown: (u) => {
          u.key === "Escape" && i();
        },
        children: /* @__PURE__ */ zt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": s,
            children: [
              /* @__PURE__ */ zt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const wi = 4, ja = 8, Cg = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Td = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function jg({ value: n, onChange: i, options: o, className: s, ariaLabel: u, testId: d, id: p, title: f, disabled: _, placeholder: w, freeText: R, onKeyDown: H }) {
  const S = ft.useId(), [y, z] = ft.useState(!1), [x, k] = ft.useState(-1), [Y, E] = ft.useState(!1), N = ft.useRef(null), M = ft.useRef(null), [D, C] = ft.useState({}), g = ft.useRef({ text: "", at: 0 }), h = R && Y && n ? o.filter((U) => Td(U).toLowerCase().includes(n.toLowerCase()) || U.value.toLowerCase().includes(n.toLowerCase())) : o, G = o.find((U) => U.value === n), J = (U) => `${S}-${U}`;
  function at(U) {
    _ || (k(U), z(!0));
  }
  function ot() {
    z(!1), E(!1), k(-1);
  }
  function jt(U) {
    !U || U.disabled || (i(U.value), ot());
  }
  function Kt(U, B) {
    for (let b = 1; b <= h.length; b++) {
      const q = (U + B * b + h.length * b) % h.length;
      if (!h[q].disabled) return q;
    }
    return U;
  }
  const Nt = () => h.findIndex((U) => !U.disabled), K = () => h.length - 1 - [...h].reverse().findIndex((U) => !U.disabled);
  ft.useLayoutEffect(() => {
    if (!y || !N.current) {
      C((tt) => tt.left === void 0 ? tt : {});
      return;
    }
    const U = N.current.getBoundingClientRect(), B = window.innerHeight - U.bottom - wi - ja, b = U.top - wi - ja, q = B < 160 && b > B;
    C({
      position: "fixed",
      left: Math.min(Math.max(ja, U.left), Math.max(ja, window.innerWidth - U.width - ja)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: U.width,
      maxWidth: window.innerWidth - 2 * ja,
      maxHeight: Math.min(q ? b : B, 320),
      ...q ? { bottom: window.innerHeight - U.top + wi } : { top: U.bottom + wi },
      overflowY: "auto"
    });
  }, [y, h.length]), ft.useLayoutEffect(() => {
    const U = M.current;
    if (!y || !U || D.left === void 0) return;
    const B = U.getBoundingClientRect().right, b = window.innerWidth - ja;
    B > b && C((q) => ({ ...q, left: Math.max(ja, Number(q.left) - (B - b)) }));
  }, [y, D]), ft.useEffect(() => {
    if (!y) return;
    const U = (B) => {
      const b = B.target;
      (b === document || b instanceof Node && N.current && b.contains(N.current)) && ot();
    };
    return window.addEventListener("resize", ot), window.addEventListener("scroll", U, !0), () => {
      window.removeEventListener("resize", ot), window.removeEventListener("scroll", U, !0);
    };
  }, [y]), ft.useEffect(() => {
    const U = y && x >= 0 ? document.getElementById(J(x)) : null, B = M.current;
    !U || !B || (U.offsetTop < B.scrollTop ? B.scrollTop = U.offsetTop : U.offsetTop + U.offsetHeight > B.scrollTop + B.clientHeight && (B.scrollTop = U.offsetTop + U.offsetHeight - B.clientHeight));
  }, [y, x]), xm(y, (U) => {
    U || ot();
  }, N, M);
  function et(U) {
    if (U.nativeEvent.isComposing) return;
    const B = () => {
      U.preventDefault(), U.stopPropagation();
    }, { key: b } = U;
    if (y) {
      if (b === "Escape") {
        B(), ot();
        return;
      } else if (b === "Tab")
        ot();
      else if (b === "ArrowDown" || b === "ArrowUp") {
        B(), h.length && k(x < 0 ? b === "ArrowDown" ? Nt() : K() : Kt(x, b === "ArrowDown" ? 1 : -1));
        return;
      } else if (b === "Home" && !R) {
        B(), k(Nt());
        return;
      } else if (b === "End" && !R) {
        B(), k(K());
        return;
      } else if (b === "Enter" || b === " " && !R) {
        if (x >= 0 && h[x]) {
          B(), jt(h[x]);
          return;
        }
        if (!R) {
          B(), ot();
          return;
        }
      } else if (!R && b.length === 1 && !U.metaKey && !U.ctrlKey && !U.altKey) {
        const q = Date.now();
        g.current = { text: (q - g.current.at > 600 ? "" : g.current.text) + b.toLowerCase(), at: q };
        const tt = Math.max(x, 0), $ = [...h.slice(tt + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, tt + 1)].find((P) => !P.disabled && Td(P).toLowerCase().startsWith(g.current.text));
        $ && (B(), k(h.indexOf($)));
        return;
      }
    } else if (b === "ArrowDown" || b === "ArrowUp" || !R && (b === "Enter" || b === " ")) {
      B(), at(Math.max(0, h.findIndex((q) => q.value === n)));
      return;
    }
    H?.(U);
  }
  const nt = {
    ref: (U) => {
      N.current = U;
    },
    id: p,
    title: f,
    disabled: _,
    "aria-label": u,
    "aria-expanded": y,
    "aria-controls": y ? S : void 0,
    "aria-activedescendant": y && x >= 0 ? J(x) : void 0,
    "data-testid": d,
    onKeyDown: et
  };
  return /* @__PURE__ */ zt.jsxs(zt.Fragment, { children: [
    R ? /* @__PURE__ */ zt.jsx(
      "input",
      {
        ...nt,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: w,
        className: s,
        value: n,
        onChange: (U) => {
          i(U.target.value), E(!0), y ? k(-1) : (k(-1), z(!0));
        },
        onBlur: () => ot()
      }
    ) : /* @__PURE__ */ zt.jsxs(
      "button",
      {
        ...nt,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: je("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
        onClick: () => y ? ot() : at(Math.max(0, h.findIndex((U) => U.value === n))),
        children: [
          /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 flex-1 truncate", children: G ? G.label : w ?? "" }),
          /* @__PURE__ */ zt.jsx(ym, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    y && h.length > 0 && Ai(
      /* @__PURE__ */ zt.jsx(
        "div",
        {
          ref: M,
          id: S,
          role: "listbox",
          "aria-label": u,
          className: je("z-[9999]", bm),
          style: D,
          onMouseDown: (U) => {
            U.preventDefault(), U.stopPropagation();
          },
          onClick: (U) => U.stopPropagation(),
          children: h.map((U, B) => /* @__PURE__ */ zt.jsxs(
            "div",
            {
              id: J(B),
              role: "option",
              "aria-selected": U.value === n,
              "aria-disabled": U.disabled || void 0,
              "data-value": U.value,
              className: je(Cg, B === x && !U.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                U.disabled || k(B);
              },
              onClick: () => jt(U),
              children: [
                /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 truncate", children: U.label }),
                U.value === n && /* @__PURE__ */ zt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            U.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const Mg = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ag = `${Mg} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function ym({ open: n, size: i = 12, className: o }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: o, width: i, height: i, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Og(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Uo = {
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
function Bo(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((o) => o.id === n.parentSessionId);
}
function Rg(n) {
  const i = /* @__PURE__ */ new Map();
  for (const o of n)
    Bo(o, n) && i.set(o.parentSessionId, [...i.get(o.parentSessionId) ?? [], o]);
  return i.size ? n.filter((o) => !Bo(o, n)).flatMap((o) => [o, ...i.get(o.id) ?? []]) : n;
}
const _i = 6, Cd = 8;
function Hg(n, i = {}) {
  const { minWidth: o = 220, align: s = "right", minSpaceAbove: u = 100 } = i, d = n.getBoundingClientRect(), p = window.innerWidth, f = window.innerHeight, _ = s === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, w = d.top - _i - Cd, R = f - d.bottom - _i - Cd;
  return w >= u ? {
    position: "fixed",
    bottom: f - d.top + _i,
    ..._,
    minWidth: o,
    maxHeight: Math.min(w, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + _i,
    ..._,
    minWidth: o,
    maxHeight: Math.min(R, f * 0.75),
    overflowY: "auto"
  };
}
function xm(n, i, o, s) {
  ft.useEffect(() => {
    if (!n) return;
    function u(p) {
      const f = p.target, _ = o.current?.contains(f) ?? !1, w = s.current?.contains(f) ?? !1;
      !_ && !w && i(!1);
    }
    function d(p) {
      p.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", u), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", u), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function Dg({ icon: n, fallback: i }) {
  const [o, s] = ft.useState(!1);
  return ft.useEffect(() => s(!1), [n]), !n || o ? /* @__PURE__ */ zt.jsx(zt.Fragment, { children: i }) : /* @__PURE__ */ zt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => s(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Ug = "1.3.0";
let Si = null;
const Bg = (n) => {
  Si = n;
};
function Mt() {
  const n = (typeof Si == "function" ? Si() : Si) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const qg = (n) => Mt().subscribe?.(n) ?? (() => {
}), Yg = Hg, Gg = globalThis.perch?.isMac !== !1, Qg = (n) => hg(n, Mt().isMac !== !1), Kg = (n) => bg(n), Vg = ({ className: n, ...i } = {}) => je(yg(i), n), Xg = wg, Zg = (n) => _g(n), Jg = Sg, Lg = gm, Wg = hm, Fg = (n) => Uo[n].color, Ig = (n, i) => Mt().shortcutFor?.(n, i) ?? null, Ri = (n, i) => Mt().command(n, i ?? {}) !== !1, $g = (n, i, o) => Mt().startSession?.(n, i, o), Pg = globalThis.perch?.pickFolder ? (n) => Mt().pickFolder(n) : null;
function me(n) {
  const i = ft.useRef(n);
  return i.current = n, ft.useSyncExternalStore(qg, () => i.current(Mt()));
}
const tb = (n = {}) => me((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), eb = () => me((n) => n.hosts()), ab = () => me((n) => n.sessionFolders());
function nb() {
  const n = me((i) => i.addProject?.() ?? lb);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, o, s) => {
      i.trim() && n.status !== "pending" && Mt().addProjectFolder?.(i, o, s);
    },
    clear: () => Mt().clearAddProject?.()
  };
}
const lb = Object.freeze({ status: "idle" }), wm = "perch.lastAgentChoice", ib = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), rb = () => {
  const n = Mt().storage?.getItem(wm);
  return n === "claude" || n === "codex" ? n : "claude";
}, ob = Object.freeze({ items: [] });
function sb() {
  const n = me((i) => i.notifications?.() ?? ob);
  return ft.useMemo(() => ({
    items: n.items ?? [],
    open: (i) => Mt().command("notification.open", { id: i }),
    dismiss: (i) => Mt().command("notification.dismiss", { id: i })
  }), [n]);
}
function cb(n) {
  const i = me((u) => u.agentChoices?.(n) ?? ib), [o, s] = ft.useState(rb);
  return ft.useMemo(() => ({
    connected: !!i.connected,
    discovery: !!i.discovery,
    choices: i.choices ?? [],
    lastChoice: o,
    state: i.state ?? "ready",
    error: i.state === "error" ? i.error : void 0,
    rememberChoice: (u) => {
      u !== "claude" && u !== "codex" || (Mt().storage?.setItem(wm, u), s(u));
    },
    manage: () => Mt().command("agents.manage", {})
  }), [i, o]);
}
function ub(n) {
  ft.useEffect(() => Mt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function db(n) {
  const i = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return Rg(i).map((o) => ({ session: o.session, nested: Bo(o, i) }));
}
function mb({ id: n, plain: i, className: o }) {
  const s = me((w) => w.session(n));
  if (!s) return null;
  const u = s.state ?? Og(s), d = Uo[u]?.color ?? Uo.unknown.color, p = s.provider, f = p === "claude" || p === "claude-agent-teams" || p === "omp", _ = i ? je("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : je("agent-status-dot", `agent-status-dot--${u}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return ft.createElement(
    "span",
    { className: _, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${u}`, "aria-hidden": "true" },
    ft.createElement("span", { className: je("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, ft.createElement(_m, { provider: p, size: 14 }))
  );
}
function _m({ provider: n, size: i = 14 }) {
  const o = Mt().agentIcon?.(n, i) ?? null, s = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ft.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": s, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const fb = ({ children: n }) => ft.createElement(ft.Fragment, null, n);
function pb(n, i) {
  const o = ft.useRef(i);
  return o.current = i, ft.useEffect(() => {
    const s = Mt();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const u = {};
    for (const [p, f] of Object.entries(o.current))
      u[p] = typeof f == "function" ? (..._) => o.current[p]?.(..._) : f;
    const d = s.openOverlay(n, u);
    return () => s.closeOverlay?.(d);
  }, [n]), null;
}
const an = (n) => function(o) {
  return pb(n, o);
}, hb = an("session-menu"), gb = an("new-session-menu"), bb = an("confirm");
let Sm = null;
const vb = (n) => {
  Sm = n;
};
function yb(n) {
  return ft.createElement(Sm ?? bb, n);
}
function xb({ className: n = Ag, ...i }) {
  return ft.createElement(jg, { ...i, className: n });
}
const wb = an("folder-browser"), _b = an("instructions"), Sb = an("memory"), zb = Tg;
function kb({ hostId: n, path: i, className: o }) {
  const s = ft.useRef(null);
  return ft.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: je("worktree-menu__btn", hm, o),
      "data-testid": `worktree-menu-${n}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Mt().openOverlay?.("worktree", { hostId: n, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    ft.createElement(vm, null)
  );
}
const Eb = (n, i) => Mt().beginReorderDrag?.(n, i), Nb = () => me((n) => n.workspaceTabs()), Tb = () => me((n) => n.statusLine()), Cb = () => me((n) => n.zoom()), jb = () => me((n) => n.paneLook()), Mb = () => me((n) => n.keybindings?.() ?? []), Ab = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Ob(n) {
  const i = !!n?.keepFresh, o = me((u) => u.statusLine?.().connected ?? !1), s = me((u) => u.planUsage?.() ?? Ab);
  return ft.useEffect(() => {
    if (!i || !o) return;
    let u;
    const d = () => {
      Mt().command("usage.get"), u = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(u);
  }, [i, o]), s;
}
const Rb = () => Mt().command("usage.get", { force: !0 }), Hb = (n) => Mt().command("usage.redeemReset", { accountId: n }), Db = () => Ri("app.zoom_reset"), Ub = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Bb = (n, i, o) => Mt().beginTabDrag?.(n, i, o);
function qb(n) {
  ft.useEffect(() => Mt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Yb = (n) => Ri("browser.open", { workspaceId: n }), Gb = (n, i) => Ri("file.open", { workspaceId: n, path: i }), Qb = () => null, Kb = () => null, Vb = an("new-file"), iv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: _m,
  Chevron: ym,
  CloseIcon: Eg,
  ConfirmDialog: yb,
  Dialog: zb,
  EllipsisIcon: zg,
  FolderBrowser: wb,
  GearIcon: kg,
  HostStateDot: Ng,
  InstructionsDialog: _b,
  MemoryDialog: Sb,
  NewFilePrompt: Vb,
  NewSessionMenu: gb,
  PageIcon: Dg,
  PlusIcon: vm,
  Select: xb,
  SessionDot: mb,
  SessionMenu: hb,
  Slot: fb,
  TabDragLayer: Kb,
  TabMenu: Qb,
  WorktreeMenu: kb,
  agentStateColor: Fg,
  anchoredPopoverStyle: Yg,
  beginReorderDrag: Eb,
  beginTabDrag: Bb,
  bindHost: Bg,
  buttonClass: Xg,
  cn: je,
  drawConfirmationsInPlace: vb,
  ghostButton: Lg,
  iconButton: Wg,
  isMac: Gg,
  keyLabel: Qg,
  menuDividerClass: Jg,
  menuItemClass: Zg,
  menuPanel: bm,
  nestSessions: db,
  openBrowserTab: Yb,
  openFileTab: Gb,
  pickFolder: Pg,
  redeemUsageReset: Hb,
  refreshUsage: Rb,
  resetZoom: Db,
  rowActionClass: Vg,
  runCommand: Ri,
  segmentClass: Kg,
  shortcutFor: Ig,
  startSession: $g,
  tabStateClass: Ub,
  useAddProject: nb,
  useAddProjectRequest: ub,
  useAgentChoices: cb,
  useDismissOnOutsideClick: xm,
  useHosts: eb,
  useKeybindings: Mb,
  useNavigation: tb,
  useNewTabRequest: qb,
  useNotifications: sb,
  usePaneLook: jb,
  usePlanUsage: Ob,
  useSessionFolders: ab,
  useStatusLine: Tb,
  useWorkspaceTabs: Nb,
  useZoom: Cb,
  version: Ug
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
const Wo = {
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
  Wo[n] = (i, o) => i[n](o);
const rv = Object.keys(Wo);
function jd(n, i) {
  for (const [o, s] of Object.entries(i)) {
    const u = Wo[o];
    if (!u) throw new Error(`the description key ${o} has no GPUI builder`);
    s != null && (n = u(n, s));
  }
  return n;
}
const Ma = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Md = /* @__PURE__ */ new WeakSet();
function Ad(n, i, o) {
  const s = n.pressed, u = Ma(o);
  return s && s.x === u.clientX && s.y === u.clientY ? s.id : i;
}
function Xb(n, i, o) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const Me = (n) => n.style?.display !== "hidden";
function qo(n, i, o, s, u = !1, d = !1, p = null, f = {}, _ = !1, w = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return w.get(n)?.text ?? n.text;
  const R = Md.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0 }), p = n.style.text_color ?? p;
  const H = !!n.hover?.text_color && Nm(n);
  H && o.hovered?.(n.id) && (p = n.hover.text_color), f = { ...f };
  for (const C of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[C] !== void 0 && (f[C] = n.style[C]);
  const S = new Set(n.events ?? []);
  let y;
  n.kind === "image" && !n.markup ? y = i.image(n.src) : y = i.div(), n.markup && (y = y.child(s.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const z = Xb(n, S, u);
  z && (y = y.id(z)), y = jd(y, { ...n.style, ...w.get(n) });
  const x = f.whitespace !== "nowrap" && !f.text_ellipsis;
  _ && x && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && (n.children ?? []).some((C) => C.kind === "text") && (y = y.min_w(0));
  for (const C of ["hover", "focus", "active"]) n[C] && (y = y[C]((g) => jd(g, n[C])));
  if (i.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const C = o.document?.scrollTarget, g = C ? (n.children ?? []).filter(Me).findIndex((h) => Em(h, C.id)) : -1;
    if (g >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, i.scroll.scroll_to_item(g)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      y = y.track_scroll(i.scroll);
      const h = (n.children ?? []).filter(Me).map((G) => G.id);
      o.document.itemBounds = (G) => h.includes(G) ? i.scroll.item_bounds?.(h.indexOf(G)) ?? null : null;
    }
  }
  n.kind === "input" && !n.disabled && (y = y.on_mouse_down("left", (C, g) => {
    o.focus(n.id), g.notify();
  }));
  const k = n.kind === "input" ? n : n.meta?.tag === "label" ? km(n) : null;
  k && !k.disabled && /^(checkbox|radio)$/.test(k.input_type) && (y = y.on_click((C, g) => {
    g.stop_propagation?.(), o.toggle(k.id), g.notify();
  }));
  const Y = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((C) => S.has(C));
  if (Y || R) for (const C of n.children ?? []) C.kind !== "text" && Md.add(C);
  if (Y && (y = y.on_mouse_down("left", (C, g) => {
    g.stop_propagation?.(), C.bounds && o.setBounds(n.id, C.bounds);
    const h = { ...Ma(C), button: 0, buttons: 1, detail: C.click_count }, G = Ad(o, n.id, C);
    o.pressed = null, o.dispatch(G, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(G, "mousedown", h), g.notify();
  }), y = y.on_mouse_down("right", (C, g) => {
    g.stop_propagation?.(), C.bounds && o.setBounds(n.id, C.bounds);
    const h = Ad(o, n.id, C);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Ma(C), button: 2 }), g.notify();
  }), y = y.on_mouse_up("left", (C, g) => {
    g.stop_propagation?.();
    const h = { ...Ma(C), button: 0 };
    o.dispatch(n.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", h), g.notify();
  }), y = y.on_click((C, g) => {
    o.dispatch(n.id, C.click_count === 2 && S.has("double_click") ? "dblclick" : "click", { detail: C.click_count, button: 0 }), g.notify();
  })), n.blocks_pointer && !Y)
    for (const C of ["left", "right"]) y = y.on_mouse_down(C, (g, h) => h.stop_propagation?.());
  else if (R && !Y)
    for (const C of ["left", "right"])
      y = y.on_mouse_down(C, (g) => {
        const h = Ma(g);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: n.id, x: h.clientX, y: h.clientY });
      });
  if (S.has("mouse_move") && (y = y.on_mouse_move((C, g) => {
    o.dispatch(n.id, "pointermove", { ...Ma(C), pointerType: "mouse" }), g.notify();
  })), (n.track_hover || H) && (y = y.on_hover((C, g) => {
    o.hover(n.id, C), g.notify();
  })), u && (y = y.on_mouse_down_out((C, g) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Ma(C), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Ma(C)), g.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const C = n.value ? String(n.value) : String(n.placeholder ?? "");
    let g = i.div().whitespace_nowrap().overflow_x_hidden();
    const h = tn(f);
    h && (g = g.h(h)), !n.value && p && (g = g.text_color(Jb(p))), C && (y = y.child(g.child(n.input_type === "password" && n.value ? "•".repeat([...C].length) : C))), n.field_w && (y = y.child(i.div().w(n.field_w).h(0)));
  }
  const E = f.whitespace === "nowrap" ? tn(f) : null, N = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let M = !n.range_name;
  const D = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const C of (n.children ?? []).filter(Me)) {
    const g = C.style?.flex_basis;
    D && C.style.flex_grow > 0 && (g === 0 || typeof g == "string" && g.endsWith("%")) && w.set(C, { ...w.get(C), flex_basis: "auto" });
    let h = qo(C, i, o, s, !1, d, p, f, N && C.style?.position !== "absolute", w);
    const G = !M && (C.kind === "text" || !C.meta), J = C.kind === "text" ? w.get(C)?.h ?? E : null, at = C.kind === "text" ? w.get(C)?.w : void 0;
    if (G || J || at !== void 0) {
      let ot = i.div();
      G && (ot = ot.id(n.range_name)), G && !N && n.style.display === "flex" && (ot = ot[`self_${Zb[f.text_align] ?? "start"}`]().max_w("100%")), J && (ot = ot.h(J)), at !== void 0 && (ot = ot.w(at).flex_none().whitespace_nowrap()), h = ot.child(h), M ||= G;
    }
    y = y.child(h);
  }
  return y;
}
const Zb = { center: "center", right: "end", end: "end" };
function Jb(n) {
  const i = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return n;
  const o = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const zm = /^[!-,.-~]+$/, km = (n) => {
  for (const i of n.children ?? []) {
    if (i.kind === "input" && /^(checkbox|radio)$/.test(i.input_type)) return i;
    const o = i.kind === "text" ? null : km(i);
    if (o) return o;
  }
  return null;
}, Em = (n, i) => n.id === i || (n.children ?? []).some((o) => o.kind !== "text" && Em(o, i)), Nm = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && Nm(i));
function tn(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function ov(n, i, o, s, u = 0) {
  const d = [n.root, ...n.overlays], p = u > 0 ? tv(d, u) : /* @__PURE__ */ new Map();
  u > 0 && s.measure && Lb(d, u, s.measure, p), $b(d, p), Ib(d, p), s.measure && Fb(d, s.measure, p);
  let f = i.div().relative().size_full().child(qo(n.root, i, o, s, !1, !1, null, {}, !1, p));
  for (const _ of n.overlays) f = f.child(qo(_, i, o, s, !0, !1, null, {}, !1, p));
  return f;
}
function Lb(n, i, o, s) {
  const u = (z, x) => s.set(z, { ...s.get(z), ...x }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function _(z, x, k) {
    if (z.kind === "text") {
      if (!(x.whitespace === "nowrap" || zm.test(z.text)) || x.text_ellipsis || k || typeof x.text_size != "number") return NaN;
      const g = o(z.text, { size: x.text_size, weight: x.font_weight ?? 400, family: x.font_family ?? ".SystemUIFont", italic: !!x.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Me(z) || z.kind === "input" || z.markup) return w(z);
    const Y = { ...x };
    for (const C of f) z.style[C] !== void 0 && (Y[C] = z.style[C]);
    p.set(z, Y);
    const E = z.style, N = (z.children ?? []).filter(Je), M = N.map((C) => _(C, Y, k || !!z.tabular));
    let D = w(z);
    if (!Number.isFinite(D) && E.w === void 0) {
      const C = N.map((h, G) => M[G] + (h.kind === "text" ? 0 : I(h.style.ml) + I(h.style.mr)));
      let g;
      N.length ? Ye(z) ? g = N.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || E.flex_wrap === "wrap" ? NaN : C.reduce((h, G) => h + G, 0) + I(E.gap_x) * (N.length - 1) : g = Math.max(...C) : g = 0, D = g + I(E.pl) + I(E.pr) + I(E.border_l) + I(E.border_r), typeof E.min_w == "number" && (D = Math.max(D, E.min_w)), typeof E.max_w == "number" && (D = Math.min(D, E.max_w));
    }
    return d.set(z, D), D;
  }
  const w = (z) => typeof z.style?.w == "number" ? z.style.w : NaN, R = () => ({ exact: 0, laid: 0 }), H = (z, x) => {
    if (!Number.isFinite(x))
      return Object.assign(z, R()), NaN;
    z.exact += x;
    const k = Math.round(z.exact * i + 1e-9) / i, Y = k - z.laid;
    return z.laid = k, Y;
  }, S = (z) => Ye(z) && z.style.flex_wrap !== "wrap" && (z.style.justify ?? "start") === "start";
  function y(z) {
    if (!z || z.kind === "text" || !Me(z)) return;
    const x = (z.children ?? []).filter(Je);
    if (S(z) && x.length > 1) {
      const k = I(z.style.gap_x), Y = R(), E = !(k && x.some((N) => N.kind === "text"));
      u(z, { border_l: H(Y, I(z.style.border_l)), pl: H(Y, I(z.style.pl)) }), E && k && u(z, { gap_x: 0 }), x.forEach((N, M) => {
        const D = (M && E ? k : 0) + (N.kind === "text" ? 0 : I(N.style.ml));
        if (N.kind === "text")
          D && Object.assign(Y, R());
        else {
          const G = H(Y, D);
          Number.isFinite(G) && u(N, { ml: G });
        }
        const C = N.kind === "text" ? p.get(z) ?? {} : null, g = N.kind === "text" ? _(N, C, !!z.tabular) : d.get(N);
        if ((N.kind === "text" || !(N.style.flex_grow > 0)) && Number.isFinite(g) ? u(N, { w: H(Y, g) }) : Object.assign(Y, R()), N.kind !== "text") {
          const G = H(Y, I(N.style.mr));
          Number.isFinite(G) && u(N, { mr: G });
        }
      });
    }
    for (const k of z.children ?? []) k.kind !== "text" && y(k);
  }
  for (const z of n)
    z && (_(z, {}, !1), y(z));
}
const Wb = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Fb(n, i, o) {
  const s = ["text_size", "font_weight", "font_family", "italic", "line_height"], u = (f) => typeof f == "number" ? f : 0, d = (f, _) => _ && ji(_) && !Ye(_) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(_.style.items), p = (f, _, w, R) => {
    if (!f || f.kind === "text" || !Me(f)) return;
    const H = f.style;
    let S = typeof H.w == "number" ? H.w : H.w === "100%" ? w : d(f, _) ? w - u(H.ml) - u(H.mr) : NaN;
    typeof H.max_w == "number" && (S = Math.min(S, H.max_w));
    const y = S - u(H.pl) - u(H.pr) - u(H.border_l) - u(H.border_r), z = { ...R };
    for (const k of s) H[k] !== void 0 && (z[k] = H[k]);
    const x = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(y) && y > 0 && typeof z.text_size == "number" && x.length && x.every((k) => k.kind === "text")) {
      const k = { size: z.text_size, weight: z.font_weight ?? 400, family: z.font_family ?? ".SystemUIFont", italic: !!z.italic }, Y = (M) => i(M.trimEnd(), k) <= y + 0.01;
      let E = 0;
      for (const M of x) {
        const D = [];
        for (const g of M.text.split(`
`)) {
          let h = "";
          for (const G of g.split(Wb)) {
            if (Y(h + G)) {
              h += G;
              continue;
            }
            h && D.push(h.trimEnd()), h = "";
            for (const J of G)
              h && !Y(h + J) && (D.push(h), h = ""), h += J;
          }
          D.push(h.trimEnd());
        }
        const C = D.join(`
`);
        D.every((g) => !g || Y(g)) ? C !== M.text && o.set(M, { ...o.get(M), text: C }) : E = NaN, E += D.length;
      }
      const N = tn(z);
      Number.isFinite(E) && N && H.h === void 0 && x.length === 1 && o.set(f, { ...o.get(f), h: E * N + u(H.pt) + u(H.pb) + u(H.border_t) + u(H.border_b) });
    }
    for (const k of x) p(k, f, Ye(f) ? NaN : y, z);
  };
  for (const f of n) p(f, null, NaN, {});
}
function Ib(n, i) {
  const o = (s, u) => {
    if (!s || s.kind === "text" || !Me(s)) return;
    const d = s.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : u && typeof d.w != "number";
    if (p && Ye(s))
      for (const f of s.children ?? []) {
        const _ = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (_ === 0 || typeof _ == "string" && _.endsWith("%")) && i.set(f, { ...i.get(f), flex_basis: "auto" });
      }
    for (const f of s.children ?? []) o(f, p);
  };
  for (const s of n) o(s, !1);
}
function $b(n, i) {
  const o = i.heights ?? /* @__PURE__ */ new Map(), s = (f) => o.get(f), u = (f) => {
    const _ = f.style, w = (f.children ?? []).filter(Je);
    if (!w.length || Ye(f)) return NaN;
    let R = 0;
    for (const H of w) {
      const S = s(H);
      if (!Number.isFinite(S)) return NaN;
      R += S + (H.kind === "text" ? 0 : I(H.style.mt) + I(H.style.mb));
    }
    return R + (_.display === "flex" ? I(_.gap_y) * (w.length - 1) : 0) + I(_.pt) + I(_.pb);
  }, d = (f, _) => {
    const w = f.style;
    if (typeof w.h == "number") return w.h;
    if (typeof w.max_h == "number") return w.max_h;
    if (!_ || !ji(_) || Ye(_)) return NaN;
    const R = _.style, H = typeof R.h == "number" ? R.h : typeof R.max_h == "number" ? R.max_h : NaN, S = (_.children ?? []).filter(Je);
    let y = 0;
    for (const x of S) {
      if (x === f) continue;
      const k = s(x);
      if (!Number.isFinite(k)) return NaN;
      y += k + (x.kind === "text" ? 0 : I(x.style.mt) + I(x.style.mb));
    }
    const z = R.display === "flex" ? I(R.gap_y) * Math.max(0, S.length - 1) : 0;
    return H - I(R.pt) - I(R.pb) - I(R.border_t) - I(R.border_b) - y - z - I(w.mt) - I(w.mb);
  }, p = (f, _) => {
    if (!(!f || f.kind === "text" || !Me(f))) {
      if (f.scrollbar > 0 && f.style.overflow_y === "scroll") {
        const w = u(f), R = d(f, _);
        Number.isFinite(w) && Number.isFinite(R) && w > R + 0.01 && i.set(f, { ...i.get(f), pr: I(f.style.pr) + f.scrollbar });
      }
      for (const w of f.children ?? []) p(w, f);
    }
  };
  for (const f of n) p(f, null);
}
const Pb = ["text_size", "line_height", "whitespace", "text_ellipsis"], I = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, ji = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ye = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Je = (n) => n.kind === "text" || Me(n) && n.style.position !== "absolute";
function tv(n, i) {
  const o = /* @__PURE__ */ new Map(), s = (x, k) => o.set(x, { ...o.get(x), ...Object.fromEntries(Object.entries(k).filter(([, Y]) => Number.isFinite(Y))) }), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(x, k) {
    if (x.kind === "text") return k.whitespace === "nowrap" || zm.test(x.text) ? tn(k) ?? NaN : NaN;
    const Y = { ...k };
    for (const C of Pb) x.style[C] !== void 0 && (Y[C] = x.style[C]);
    d.set(x, Y);
    const E = x.style, N = (x.children ?? []).filter(Je), M = N.map((C) => p(C, Y));
    let D;
    if (E.h !== void 0 && E.h !== "auto") D = I(E.h);
    else if (x.kind === "input")
      D = (x.input_type === "textarea" || x.input_type === "select" ? NaN : tn(Y) ?? NaN) + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (D = Math.max(D, I(E.min_h)));
    else {
      const C = N.map((h, G) => (h.kind === "text" ? 0 : I(h.style.mt) + I(h.style.mb)) + M[G]);
      let g;
      if (Ye(x)) g = E.flex_wrap === "wrap" ? NaN : E.items === "baseline" ? _(N, M, Y) : Math.max(0, ...C);
      else if (ji(x)) {
        const h = N.some((J) => J.kind !== "text" && (J.style.flex_grow > 0 || J.style.flex_basis !== void 0)), G = E.display !== "flex" && N.some((J) => J.kind !== "text" && (I(J.style.mt) || I(J.style.mb)));
        g = h || G ? NaN : C.reduce((J, at) => J + at, 0) + (E.display === "flex" ? I(E.gap_y) * Math.max(0, N.length - 1) : 0);
      } else g = NaN;
      D = g + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (D = Math.max(D, I(E.min_h))), E.max_h !== void 0 && (D = Math.min(D, I(E.max_h)));
    }
    return u.set(x, D), D;
  }
  const f = (x) => (tn(x) - (Ni + Ld) * x.text_size) / 2 + Ni * x.text_size;
  function _(x, k, Y) {
    let E = 0, N = 0;
    for (const [M, D] of x.entries()) {
      const C = D.kind === "text" ? Y : d.get(D);
      if (!(D.kind === "text" || (D.children ?? []).filter(Je).every((J) => J.kind === "text")) || !Number.isFinite(k[M]) || typeof C.text_size != "number") return NaN;
      const h = D.kind === "text" ? {} : D.style, G = I(h.mt) + I(h.border_t) + I(h.pt) + f(C);
      E = Math.max(E, G), N = Math.max(N, I(h.mt) + k[M] + I(h.mb) - G);
    }
    return E + N;
  }
  const w = () => ({ exact: 0, laid: 0 }), R = (x, k) => {
    if (!Number.isFinite(k))
      return Object.assign(x, w()), NaN;
    x.exact += k;
    const Y = Math.round(x.exact * i + 1e-9) / i, E = Y - x.laid;
    return x.laid = Y, E;
  };
  function H(x) {
    if (!(x.kind === "text" || !Me(x))) {
      for (const k of (x.children ?? []).filter((Y) => Y.kind !== "text" && Me(Y) && Y.style.position === "absolute")) H(k);
      if (ji(x) && !Ye(x)) {
        const k = w();
        s(x, { border_t: R(k, I(x.style.border_t)), pt: R(k, I(x.style.pt)) }), S(x, k);
      } else for (const k of (x.children ?? []).filter(Je)) k.kind !== "text" && H(k);
    }
  }
  function S(x, k) {
    const Y = (x.children ?? []).filter(Je), E = x.style.display === "flex" ? I(x.style.gap_y) : 0;
    if (E && Y.some((N) => N.kind === "text")) {
      for (const N of Y) N.kind !== "text" && H(N);
      return !1;
    }
    return E && s(x, { gap_y: 0 }), Y.forEach((N, M) => {
      if (N.kind === "text") {
        const D = u.get(N) ?? p(N, d.get(x) ?? {});
        Number.isFinite(D) ? s(N, { h: R(k, D) }) : Object.assign(k, w());
        return;
      }
      if (s(N, { mt: R(k, (M ? E : 0) + I(N.style.mt)) }), Number.isFinite(u.get(N))) z(N, k);
      else if (y(N)) {
        const D = N.style;
        s(N, { border_t: R(k, I(D.border_t)), pt: R(k, I(D.pt)) }), s(N, { pb: R(k, I(D.pb)), border_b: R(k, I(D.border_b)) });
      } else
        H(N), Object.assign(k, w());
      s(N, { mb: R(k, I(N.style.mb)) });
    }), !0;
  }
  function y(x) {
    const k = x.style, Y = (x.children ?? []).filter(Je), E = tn(d.get(x) ?? {});
    return x.kind === "div" && !Ye(x) && Y.length > 0 && Y.every((N) => N.kind === "text") && Number.isInteger(E) && [k.h, k.min_h, k.max_h].every((N) => N === void 0 || N === "auto");
  }
  function z(x, k) {
    const Y = x.style;
    for (const C of (x.children ?? []).filter((g) => g.kind !== "text" && Me(g) && g.style.position === "absolute")) H(C);
    const E = k.laid, N = k.exact;
    s(x, { border_t: R(k, I(Y.border_t)), pt: R(k, I(Y.pt)) });
    const M = Y.h !== void 0 && Y.h !== "auto", D = u.get(x) - I(Y.pt) - I(Y.pb) - I(Y.border_t) - I(Y.border_b);
    if (x.kind === "input")
      M || R(k, D);
    else if (Ye(x) || M && (Y.justify ?? "start") !== "start") {
      for (const C of (x.children ?? []).filter(Je)) C.kind !== "text" && H(C);
      M || R(k, D);
    } else !S(x, k) && !M && R(k, D);
    if (M) {
      k.exact = N + u.get(x), k.laid = Math.round(k.exact * i + 1e-9) / i, s(x, { h: k.laid - E });
      return;
    }
    s(x, { pb: R(k, I(Y.pb)), border_b: R(k, I(Y.border_b)) }), s(x, { h: k.laid - E });
  }
  for (const x of n)
    p(x, {}), H(x);
  return Object.defineProperty(o, "heights", { value: u }), o;
}
const sv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }] };
export {
  sv as NAMED_ELEMENTS,
  ev as React,
  Gh as SCHEMA,
  rv as STYLE_KEYS,
  ov as describeToGpui,
  av as jsxRuntime,
  nv as mount,
  lv as reactDom,
  iv as sdk
};
