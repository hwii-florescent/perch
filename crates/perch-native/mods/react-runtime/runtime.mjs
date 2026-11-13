function jd(l, i) {
  for (var o = 0; o < i.length; o++) {
    const s = i[o];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const c in s)
        if (c !== "default" && !(c in l)) {
          const d = Object.getOwnPropertyDescriptor(s, c);
          d && Object.defineProperty(l, c, d.get ? d : {
            enumerable: !0,
            get: () => s[c]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(l, Symbol.toStringTag, { value: "Module" }));
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
const Xp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Zp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), Jp = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Xp]);
function ko(l) {
  return l.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, o, s) => o ? String.fromCodePoint(parseInt(o, 16)) : s);
}
function pi(l, i) {
  let o = i;
  for (; o < l.length; ) {
    const s = l[o];
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
  if (o === i) throw new Se(`expected a name at ${i} in ${JSON.stringify(l)}`);
  return [ko(l.slice(i, o)), o];
}
function Lp(l, i) {
  let o = 1;
  for (let s = i; s < l.length; s++) {
    const c = l[s];
    if (c === "\\") {
      s++;
      continue;
    }
    if (c === '"' || c === "'") {
      if (s = l.indexOf(c, s + 1), s < 0) break;
      continue;
    }
    if (c === "(") o++;
    else if (c === ")" && --o === 0) return s;
  }
  throw new Se(`unbalanced parenthesis in ${JSON.stringify(l)}`);
}
function Bo(l) {
  const i = [];
  let o = 0, s = 0;
  for (let c = 0; c < l.length; c++) {
    const d = l[c];
    if (d === "\\") {
      c++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (c = l.indexOf(d, c + 1), c < 0) break;
      continue;
    }
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (i.push(l.slice(s, c).trim()), s = c + 1);
  }
  return i.push(l.slice(s).trim()), i.filter(Boolean);
}
function Wp(l, i) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let s = !1;
  for (; i < l.length; ) {
    const c = l[i];
    if (c === "*") {
      o.tag = "*", i++, s = !0;
      continue;
    }
    if (c === ".") {
      const [d, p] = pi(l, i + 1);
      o.classes.push(d), i = p, s = !0;
      continue;
    }
    if (c === "#") {
      const [d, p] = pi(l, i + 1);
      o.id = d, i = p, s = !0;
      continue;
    }
    if (c === "[") {
      const d = l.indexOf("]", i);
      if (d < 0) throw new Se(`unclosed [ in ${JSON.stringify(l)}`);
      const p = l.slice(i + 1, d).trim(), m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!m) throw new Se(`cannot read the attribute selector [${p}]`);
      const S = m[3] ?? m[4] ?? m[5];
      o.attrs.push({ name: ko(m[1]).toLowerCase(), op: m[2] ?? null, value: S === void 0 ? null : ko(S) }), i = d + 1, s = !0;
      continue;
    }
    if (c === ":") {
      if (l[i + 1] === ":") throw new Se(`pseudo-elements are not supported (${JSON.stringify(l)})`);
      const [d, p] = pi(l, i + 1);
      i = p;
      const m = d.toLowerCase();
      if (l[i] === "(") {
        if (!Zp.has(m)) throw new Se(`:${m}() is not supported`);
        const S = Lp(l, i + 1), _ = l.slice(i + 1, S).trim();
        if (i = S + 1, m === "nth-child") {
          if (!/^\d+$/.test(_)) throw new Se(`:nth-child(${_}) is not supported (only a number)`);
          o.pseudos.push({ name: m, n: Number(_) });
        } else
          o.pseudos.push({ name: m, list: Bo(_).map(qo) });
      } else {
        if (!Jp.has(m)) throw new Se(`:${m} is not supported`);
        o.pseudos.push({ name: m });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !s) {
      const [d, p] = pi(l, i);
      o.tag = d.toLowerCase(), i = p, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new Se(`empty compound selector at ${i} in ${JSON.stringify(l)}`);
  return [o, i];
}
function qo(l) {
  const i = [];
  let o = 0, s = null;
  for (l = l.trim(); o < l.length; ) {
    const [c, d] = Wp(l, o);
    i.push({ compound: c, combinator: s }), o = d;
    let p = !1;
    for (; l[o] === " " || l[o] === `
` || l[o] === "	"; )
      o++, p = !0;
    if (o >= l.length) break;
    const m = l[o];
    if (m === ">")
      for (s = ">", o++; l[o] === " "; ) o++;
    else {
      if (m === "+" || m === "~") throw new Se(`the ${m} combinator is not supported`);
      if (p) s = " ";
      else throw new Se(`unexpected ${JSON.stringify(m)} in ${JSON.stringify(l)}`);
    }
  }
  if (!i.length) throw new Se("empty selector");
  return i;
}
const Kc = /* @__PURE__ */ new Map();
function ji(l) {
  let i = Kc.get(l);
  return i || (i = Bo(l).map(qo), Kc.set(l, i)), i;
}
function Md(l) {
  const i = [0, 0, 0], o = (s) => {
    i[0] += s[0], i[1] += s[1], i[2] += s[2];
  };
  for (const { compound: s } of l) {
    s.id && i[0]++, i[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && i[2]++;
    for (const c of s.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const d = c.list.map(Md).sort((p, m) => m[0] - p[0] || m[1] - p[1] || m[2] - p[2])[0];
          o(d);
        } else i[1]++;
  }
  return i;
}
function Fp(l, { name: i, op: o, value: s }) {
  const c = l.getAttribute(i);
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
function hi(l) {
  return l.parentElement ? l.parentElement.children : [l];
}
function Ip(l, i, o, s) {
  if (i.tag && i.tag !== "*" && l.tagName !== i.tag || i.id && l.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const c = l.classList ?? [];
    for (const d of i.classes) if (!c.includes(d)) return !1;
  }
  for (const c of i.attrs) if (!Fp(l, c)) return !1;
  for (const c of i.pseudos)
    switch (c.name) {
      case "first-child":
        if (hi(l)[0] !== l) return !1;
        break;
      case "only-child":
        if (hi(l).length !== 1) return !1;
        break;
      case "last-child": {
        const d = hi(l);
        if (d[d.length - 1] !== l) return !1;
        break;
      }
      case "nth-child":
        if (hi(l).indexOf(l) !== c.n - 1) return !1;
        break;
      case "root":
        if (!l.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((d) => Ml(l, d, o, s))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((d) => Ml(l, d, o, s))) return !1;
        break;
      default:
        if (!o.state || !o.state(l, c.name, s)) return !1;
    }
  return !0;
}
function Ml(l, i, o, s = !0) {
  const c = (d, p, m) => {
    const { compound: S, combinator: _ } = i[p];
    if (!Ip(d, S, o, m)) return !1;
    if (p === 0) return !0;
    if (_ === ">") return !!d.parentElement && c(d.parentElement, p - 1, !1);
    for (let R = d.parentElement; R; R = R.parentElement) if (c(R, p - 1, !1)) return !0;
    return !1;
  };
  return c(l, i.length - 1, s);
}
function $p(l, i, o = {}) {
  return (typeof i == "string" ? ji(i) : i).some((c) => Ml(l, c, o));
}
function Ad(l, i, o = {}) {
  return Ml(l, i, o);
}
function mn(l, i, o = {}) {
  const s = ji(i), c = [], d = (p) => {
    for (const m of p.children)
      s.some((S) => Ml(m, S, o)) && c.push(m), d(m);
  };
  return d(l), c;
}
function Od(l, i, o = {}) {
  const s = ji(i);
  for (let c = l; c; c = c.parentElement) if (s.some((d) => Ml(c, d, o))) return c;
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
//! runs unchanged.
let Pp = 1;
class No {
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
class Yo {
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
class Go {
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
class ze extends Yo {
  constructor(i, o = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${Pp++}`, this.tagName = i.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
      const d = i.replace(/-([a-z])/g, (p, m) => m.toUpperCase());
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
    return $p(this, i);
  }
  closest(i) {
    return Od(this, i);
  }
  querySelectorAll(i) {
    return mn(this, i);
  }
  querySelector(i) {
    return mn(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return i ? new No(i.x, i.y, i.width, i.height) : new No();
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
class th {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class eh {
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
function Vc(l) {
  for (let i = l; i instanceof ze; i = i.parentElement) i.touch();
}
class ah extends Yo {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new ze("html", {}, this), this.body = new ze("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new ze(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Vc(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, Vc(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return mn(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(i) {
    return mn(this.documentElement, "*").find((o) => o.props?.id === i) ?? null;
  }
}
class lh extends Yo {
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
function Rd(l) {
  return {
    setTimeout: (i, o = 0, ...s) => l.setTimeout(() => i(...s), Math.max(0, Number(o) || 0)),
    clearTimeout: (i) => {
      i != null && l.clearTimeout(i);
    }
  };
}
function fe(l, i, o) {
  Object.defineProperty(l, i, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function nh(l, i = globalThis) {
  const o = new ah(l), s = new lh(l, o);
  o.defaultView = s;
  const c = l.storage ?? new eh();
  if (typeof i.setTimeout != "function") {
    if (typeof l.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const p = Rd(l);
    fe(i, "setTimeout", p.setTimeout), fe(i, "clearTimeout", p.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && fe(i, "queueMicrotask", (p) => {
    Promise.resolve().then(p);
  }), fe(i, "requestAnimationFrame", (p) => i.setTimeout(() => p(Date.now()), 0)), fe(i, "cancelAnimationFrame", (p) => i.clearTimeout(p)), fe(i, "document", o), fe(i, "window", s), fe(i, "localStorage", c), fe(i, "HTMLElement", ze), fe(i, "Element", ze), fe(i, "DOMRect", No), typeof i.ResizeObserver != "function" && fe(i, "ResizeObserver", th);
  const d = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!d.clipboard && l.clipboard)
    try {
      fe(d, "clipboard", l.clipboard);
    } catch {
    }
  return i.navigator || fe(i, "navigator", d), { document: o, window: s };
}
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Xc = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Xc?.setTimeout == "function") {
  const l = Rd(Xc);
  globalThis.setTimeout = l.setTimeout, globalThis.clearTimeout = l.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (l) => {
  Promise.resolve().then(l);
});
function Qo(l) {
  return l && l.__esModule && Object.prototype.hasOwnProperty.call(l, "default") ? l.default : l;
}
var bo = { exports: {} }, st = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Zc;
function ih() {
  if (Zc) return st;
  Zc = 1;
  var l = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), S = Symbol.for("react.suspense"), _ = Symbol.for("react.memo"), R = Symbol.for("react.lazy"), A = Symbol.for("react.activity"), E = Symbol.iterator;
  function y(g) {
    return g === null || typeof g != "object" ? null : (g = E && g[E] || g["@@iterator"], typeof g == "function" ? g : null);
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
  }, w = Object.assign, k = {};
  function H(g, G, tt) {
    this.props = g, this.context = G, this.refs = k, this.updater = tt || z;
  }
  H.prototype.isReactComponent = {}, H.prototype.setState = function(g, G) {
    if (typeof g != "object" && typeof g != "function" && g != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, g, G, "setState");
  }, H.prototype.forceUpdate = function(g) {
    this.updater.enqueueForceUpdate(this, g, "forceUpdate");
  };
  function b() {
  }
  b.prototype = H.prototype;
  function N(g, G, tt) {
    this.props = g, this.context = G, this.refs = k, this.updater = tt || z;
  }
  var U = N.prototype = new b();
  U.constructor = N, w(U, H.prototype), U.isPureReactComponent = !0;
  var q = Array.isArray;
  function C() {
  }
  var x = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function Y(g, G, tt) {
    var $ = tt.ref;
    return {
      $$typeof: l,
      type: g,
      key: G,
      ref: $ !== void 0 ? $ : null,
      props: tt
    };
  }
  function I(g, G) {
    return Y(g.type, G, g.props);
  }
  function ft(g) {
    return typeof g == "object" && g !== null && g.$$typeof === l;
  }
  function rt(g) {
    var G = { "=": "=0", ":": "=2" };
    return "$" + g.replace(/[=:]/g, function(tt) {
      return G[tt];
    });
  }
  var jt = /\/+/g;
  function Kt(g, G) {
    return typeof g == "object" && g !== null && g.key != null ? rt("" + g.key) : G.toString(36);
  }
  function Nt(g) {
    switch (g.status) {
      case "fulfilled":
        return g.value;
      case "rejected":
        throw g.reason;
      default:
        switch (typeof g.status == "string" ? g.then(C, C) : (g.status = "pending", g.then(
          function(G) {
            g.status === "pending" && (g.status = "fulfilled", g.value = G);
          },
          function(G) {
            g.status === "pending" && (g.status = "rejected", g.reason = G);
          }
        )), g.status) {
          case "fulfilled":
            return g.value;
          case "rejected":
            throw g.reason;
        }
    }
    throw g;
  }
  function K(g, G, tt, $, P) {
    var lt = typeof g;
    (lt === "undefined" || lt === "boolean") && (g = null);
    var xt = !1;
    if (g === null) xt = !0;
    else
      switch (lt) {
        case "bigint":
        case "string":
        case "number":
          xt = !0;
          break;
        case "object":
          switch (g.$$typeof) {
            case l:
            case i:
              xt = !0;
              break;
            case R:
              return xt = g._init, K(
                xt(g._payload),
                G,
                tt,
                $,
                P
              );
          }
      }
    if (xt)
      return P = P(g), xt = $ === "" ? "." + Kt(g, 0) : $, q(P) ? (tt = "", xt != null && (tt = xt.replace(jt, "$&/") + "/"), K(P, G, tt, "", function(Oa) {
        return Oa;
      })) : P != null && (ft(P) && (P = I(
        P,
        tt + (P.key == null || g && g.key === P.key ? "" : ("" + P.key).replace(
          jt,
          "$&/"
        ) + "/") + xt
      )), G.push(P)), 1;
    xt = 0;
    var Jt = $ === "" ? "." : $ + ":";
    if (q(g))
      for (var ut = 0; ut < g.length; ut++)
        $ = g[ut], lt = Jt + Kt($, ut), xt += K(
          $,
          G,
          tt,
          lt,
          P
        );
    else if (ut = y(g), typeof ut == "function")
      for (g = ut.call(g), ut = 0; !($ = g.next()).done; )
        $ = $.value, lt = Jt + Kt($, ut++), xt += K(
          $,
          G,
          tt,
          lt,
          P
        );
    else if (lt === "object") {
      if (typeof g.then == "function")
        return K(
          Nt(g),
          G,
          tt,
          $,
          P
        );
      throw G = String(g), Error(
        "Objects are not valid as a React child (found: " + (G === "[object Object]" ? "object with keys {" + Object.keys(g).join(", ") + "}" : G) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return xt;
  }
  function et(g, G, tt) {
    if (g == null) return g;
    var $ = [], P = 0;
    return K(g, $, "", "", function(lt) {
      return G.call(tt, lt, P++);
    }), $;
  }
  function at(g) {
    if (g._status === -1) {
      var G = g._result;
      G = G(), G.then(
        function(tt) {
          (g._status === 0 || g._status === -1) && (g._status = 1, g._result = tt);
        },
        function(tt) {
          (g._status === 0 || g._status === -1) && (g._status = 2, g._result = tt);
        }
      ), g._status === -1 && (g._status = 0, g._result = G);
    }
    if (g._status === 1) return g._result.default;
    throw g._result;
  }
  var D = typeof reportError == "function" ? reportError : function(g) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var G = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof g == "object" && g !== null && typeof g.message == "string" ? String(g.message) : String(g),
        error: g
      });
      if (!window.dispatchEvent(G)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", g);
      return;
    }
    console.error(g);
  }, B = {
    map: et,
    forEach: function(g, G, tt) {
      et(
        g,
        function() {
          G.apply(this, arguments);
        },
        tt
      );
    },
    count: function(g) {
      var G = 0;
      return et(g, function() {
        G++;
      }), G;
    },
    toArray: function(g) {
      return et(g, function(G) {
        return G;
      }) || [];
    },
    only: function(g) {
      if (!ft(g))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return g;
    }
  };
  return st.Activity = A, st.Children = B, st.Component = H, st.Fragment = o, st.Profiler = c, st.PureComponent = N, st.StrictMode = s, st.Suspense = S, st.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = x, st.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(g) {
      return x.H.useMemoCache(g);
    }
  }, st.cache = function(g) {
    return function() {
      return g.apply(null, arguments);
    };
  }, st.cacheSignal = function() {
    return null;
  }, st.cloneElement = function(g, G, tt) {
    if (g == null)
      throw Error(
        "The argument must be a React element, but you passed " + g + "."
      );
    var $ = w({}, g.props), P = g.key;
    if (G != null)
      for (lt in G.key !== void 0 && (P = "" + G.key), G)
        !h.call(G, lt) || lt === "key" || lt === "__self" || lt === "__source" || lt === "ref" && G.ref === void 0 || ($[lt] = G[lt]);
    var lt = arguments.length - 2;
    if (lt === 1) $.children = tt;
    else if (1 < lt) {
      for (var xt = Array(lt), Jt = 0; Jt < lt; Jt++)
        xt[Jt] = arguments[Jt + 2];
      $.children = xt;
    }
    return Y(g.type, P, $);
  }, st.createContext = function(g) {
    return g = {
      $$typeof: p,
      _currentValue: g,
      _currentValue2: g,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, g.Provider = g, g.Consumer = {
      $$typeof: d,
      _context: g
    }, g;
  }, st.createElement = function(g, G, tt) {
    var $, P = {}, lt = null;
    if (G != null)
      for ($ in G.key !== void 0 && (lt = "" + G.key), G)
        h.call(G, $) && $ !== "key" && $ !== "__self" && $ !== "__source" && (P[$] = G[$]);
    var xt = arguments.length - 2;
    if (xt === 1) P.children = tt;
    else if (1 < xt) {
      for (var Jt = Array(xt), ut = 0; ut < xt; ut++)
        Jt[ut] = arguments[ut + 2];
      P.children = Jt;
    }
    if (g && g.defaultProps)
      for ($ in xt = g.defaultProps, xt)
        P[$] === void 0 && (P[$] = xt[$]);
    return Y(g, lt, P);
  }, st.createRef = function() {
    return { current: null };
  }, st.forwardRef = function(g) {
    return { $$typeof: m, render: g };
  }, st.isValidElement = ft, st.lazy = function(g) {
    return {
      $$typeof: R,
      _payload: { _status: -1, _result: g },
      _init: at
    };
  }, st.memo = function(g, G) {
    return {
      $$typeof: _,
      type: g,
      compare: G === void 0 ? null : G
    };
  }, st.startTransition = function(g) {
    var G = x.T, tt = {};
    x.T = tt;
    try {
      var $ = g(), P = x.S;
      P !== null && P(tt, $), typeof $ == "object" && $ !== null && typeof $.then == "function" && $.then(C, D);
    } catch (lt) {
      D(lt);
    } finally {
      G !== null && tt.types !== null && (G.types = tt.types), x.T = G;
    }
  }, st.unstable_useCacheRefresh = function() {
    return x.H.useCacheRefresh();
  }, st.use = function(g) {
    return x.H.use(g);
  }, st.useActionState = function(g, G, tt) {
    return x.H.useActionState(g, G, tt);
  }, st.useCallback = function(g, G) {
    return x.H.useCallback(g, G);
  }, st.useContext = function(g) {
    return x.H.useContext(g);
  }, st.useDebugValue = function() {
  }, st.useDeferredValue = function(g, G) {
    return x.H.useDeferredValue(g, G);
  }, st.useEffect = function(g, G) {
    return x.H.useEffect(g, G);
  }, st.useEffectEvent = function(g) {
    return x.H.useEffectEvent(g);
  }, st.useId = function() {
    return x.H.useId();
  }, st.useImperativeHandle = function(g, G, tt) {
    return x.H.useImperativeHandle(g, G, tt);
  }, st.useInsertionEffect = function(g, G) {
    return x.H.useInsertionEffect(g, G);
  }, st.useLayoutEffect = function(g, G) {
    return x.H.useLayoutEffect(g, G);
  }, st.useMemo = function(g, G) {
    return x.H.useMemo(g, G);
  }, st.useOptimistic = function(g, G) {
    return x.H.useOptimistic(g, G);
  }, st.useReducer = function(g, G, tt) {
    return x.H.useReducer(g, G, tt);
  }, st.useRef = function(g) {
    return x.H.useRef(g);
  }, st.useState = function(g) {
    return x.H.useState(g);
  }, st.useSyncExternalStore = function(g, G, tt) {
    return x.H.useSyncExternalStore(
      g,
      G,
      tt
    );
  }, st.useTransition = function() {
    return x.H.useTransition();
  }, st.version = "19.2.8", st;
}
var Jc;
function Hd() {
  return Jc || (Jc = 1, bo.exports = ih()), bo.exports;
}
var mt = Hd();
const rh = /* @__PURE__ */ Qo(mt), $v = /* @__PURE__ */ jd({
  __proto__: null,
  default: rh
}, [mt]);
var yo = { exports: {} }, cn = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Lc;
function oh() {
  if (Lc) return cn;
  Lc = 1;
  var l = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function o(s, c, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), c.key !== void 0 && (p = "" + c.key), "key" in c) {
      d = {};
      for (var m in c)
        m !== "key" && (d[m] = c[m]);
    } else d = c;
    return c = d.ref, {
      $$typeof: l,
      type: s,
      key: p,
      ref: c !== void 0 ? c : null,
      props: d
    };
  }
  return cn.Fragment = i, cn.jsx = o, cn.jsxs = o, cn;
}
var Wc;
function sh() {
  return Wc || (Wc = 1, yo.exports = oh()), yo.exports;
}
var zt = sh();
const uh = /* @__PURE__ */ Qo(zt), Pv = /* @__PURE__ */ jd({
  __proto__: null,
  default: uh
}, [zt]);
var xo = { exports: {} }, wo = { exports: {} }, _o = { exports: {} }, So = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Fc;
function ch() {
  return Fc || (Fc = 1, (function(l) {
    function i(K, et) {
      var at = K.length;
      K.push(et);
      t: for (; 0 < at; ) {
        var D = at - 1 >>> 1, B = K[D];
        if (0 < c(B, et))
          K[D] = et, K[at] = B, at = D;
        else break t;
      }
    }
    function o(K) {
      return K.length === 0 ? null : K[0];
    }
    function s(K) {
      if (K.length === 0) return null;
      var et = K[0], at = K.pop();
      if (at !== et) {
        K[0] = at;
        t: for (var D = 0, B = K.length, g = B >>> 1; D < g; ) {
          var G = 2 * (D + 1) - 1, tt = K[G], $ = G + 1, P = K[$];
          if (0 > c(tt, at))
            $ < B && 0 > c(P, tt) ? (K[D] = P, K[$] = at, D = $) : (K[D] = tt, K[G] = at, D = G);
          else if ($ < B && 0 > c(P, at))
            K[D] = P, K[$] = at, D = $;
          else break t;
        }
      }
      return et;
    }
    function c(K, et) {
      var at = K.sortIndex - et.sortIndex;
      return at !== 0 ? at : K.id - et.id;
    }
    if (l.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      l.unstable_now = function() {
        return d.now();
      };
    } else {
      var p = Date, m = p.now();
      l.unstable_now = function() {
        return p.now() - m;
      };
    }
    var S = [], _ = [], R = 1, A = null, E = 3, y = !1, z = !1, w = !1, k = !1, H = typeof setTimeout == "function" ? setTimeout : null, b = typeof clearTimeout == "function" ? clearTimeout : null, N = typeof setImmediate < "u" ? setImmediate : null;
    function U(K) {
      for (var et = o(_); et !== null; ) {
        if (et.callback === null) s(_);
        else if (et.startTime <= K)
          s(_), et.sortIndex = et.expirationTime, i(S, et);
        else break;
        et = o(_);
      }
    }
    function q(K) {
      if (w = !1, U(K), !z)
        if (o(S) !== null)
          z = !0, C || (C = !0, rt());
        else {
          var et = o(_);
          et !== null && Nt(q, et.startTime - K);
        }
    }
    var C = !1, x = -1, h = 5, Y = -1;
    function I() {
      return k ? !0 : !(l.unstable_now() - Y < h);
    }
    function ft() {
      if (k = !1, C) {
        var K = l.unstable_now();
        Y = K;
        var et = !0;
        try {
          t: {
            z = !1, w && (w = !1, b(x), x = -1), y = !0;
            var at = E;
            try {
              e: {
                for (U(K), A = o(S); A !== null && !(A.expirationTime > K && I()); ) {
                  var D = A.callback;
                  if (typeof D == "function") {
                    A.callback = null, E = A.priorityLevel;
                    var B = D(
                      A.expirationTime <= K
                    );
                    if (K = l.unstable_now(), typeof B == "function") {
                      A.callback = B, U(K), et = !0;
                      break e;
                    }
                    A === o(S) && s(S), U(K);
                  } else s(S);
                  A = o(S);
                }
                if (A !== null) et = !0;
                else {
                  var g = o(_);
                  g !== null && Nt(
                    q,
                    g.startTime - K
                  ), et = !1;
                }
              }
              break t;
            } finally {
              A = null, E = at, y = !1;
            }
            et = void 0;
          }
        } finally {
          et ? rt() : C = !1;
        }
      }
    }
    var rt;
    if (typeof N == "function")
      rt = function() {
        N(ft);
      };
    else if (typeof MessageChannel < "u") {
      var jt = new MessageChannel(), Kt = jt.port2;
      jt.port1.onmessage = ft, rt = function() {
        Kt.postMessage(null);
      };
    } else
      rt = function() {
        H(ft, 0);
      };
    function Nt(K, et) {
      x = H(function() {
        K(l.unstable_now());
      }, et);
    }
    l.unstable_IdlePriority = 5, l.unstable_ImmediatePriority = 1, l.unstable_LowPriority = 4, l.unstable_NormalPriority = 3, l.unstable_Profiling = null, l.unstable_UserBlockingPriority = 2, l.unstable_cancelCallback = function(K) {
      K.callback = null;
    }, l.unstable_forceFrameRate = function(K) {
      0 > K || 125 < K ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < K ? Math.floor(1e3 / K) : 5;
    }, l.unstable_getCurrentPriorityLevel = function() {
      return E;
    }, l.unstable_next = function(K) {
      switch (E) {
        case 1:
        case 2:
        case 3:
          var et = 3;
          break;
        default:
          et = E;
      }
      var at = E;
      E = et;
      try {
        return K();
      } finally {
        E = at;
      }
    }, l.unstable_requestPaint = function() {
      k = !0;
    }, l.unstable_runWithPriority = function(K, et) {
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
      var at = E;
      E = K;
      try {
        return et();
      } finally {
        E = at;
      }
    }, l.unstable_scheduleCallback = function(K, et, at) {
      var D = l.unstable_now();
      switch (typeof at == "object" && at !== null ? (at = at.delay, at = typeof at == "number" && 0 < at ? D + at : D) : at = D, K) {
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
      return B = at + B, K = {
        id: R++,
        callback: et,
        priorityLevel: K,
        startTime: at,
        expirationTime: B,
        sortIndex: -1
      }, at > D ? (K.sortIndex = at, i(_, K), o(S) === null && K === o(_) && (w ? (b(x), x = -1) : w = !0, Nt(q, at - D))) : (K.sortIndex = B, i(S, K), z || y || (z = !0, C || (C = !0, rt()))), K;
    }, l.unstable_shouldYield = I, l.unstable_wrapCallback = function(K) {
      var et = E;
      return function() {
        var at = E;
        E = et;
        try {
          return K.apply(this, arguments);
        } finally {
          E = at;
        }
      };
    };
  })(So)), So;
}
var Ic;
function dh() {
  return Ic || (Ic = 1, _o.exports = ch()), _o.exports;
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
var $c;
function fh() {
  return $c || ($c = 1, (function(l) {
    l.exports = function(i) {
      function o(t, e, a, n) {
        return new Ff(t, e, a, n);
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
      function m(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(c(188));
          return e !== t ? null : t;
        }
        for (var a = t, n = e; ; ) {
          var r = a.return;
          if (r === null) break;
          var u = r.alternate;
          if (u === null) {
            if (n = r.return, n !== null) {
              a = n;
              continue;
            }
            break;
          }
          if (r.child === u.child) {
            for (u = r.child; u; ) {
              if (u === a) return p(r), t;
              if (u === n) return p(r), e;
              u = u.sibling;
            }
            throw Error(c(188));
          }
          if (a.return !== n.return) a = r, n = u;
          else {
            for (var f = !1, v = r.child; v; ) {
              if (v === a) {
                f = !0, a = r, n = u;
                break;
              }
              if (v === n) {
                f = !0, n = r, a = u;
                break;
              }
              v = v.sibling;
            }
            if (!f) {
              for (v = u.child; v; ) {
                if (v === a) {
                  f = !0, a = u, n = r;
                  break;
                }
                if (v === n) {
                  f = !0, n = u, a = r;
                  break;
                }
                v = v.sibling;
              }
              if (!f) throw Error(c(189));
            }
          }
          if (a.alternate !== n) throw Error(c(190));
        }
        if (a.tag !== 3) throw Error(c(188));
        return a.stateNode.current === a ? t : e;
      }
      function S(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = S(t), e !== null) return e;
          t = t.sibling;
        }
        return null;
      }
      function _(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = _(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function R(t) {
        return t === null || typeof t != "object" ? null : (t = sc && t[sc] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function A(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === em ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case cl:
            return "Fragment";
          case Ur:
            return "Profiler";
          case rc:
            return "StrictMode";
          case qr:
            return "Suspense";
          case Yr:
            return "SuspenseList";
          case Qr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ul:
              return "Portal";
            case ba:
              return t.displayName || "Context";
            case oc:
              return (t._context.displayName || "Context") + ".Consumer";
            case Br:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Gr:
              return e = t.displayName || null, e !== null ? e : A(t.type) || "Memo";
            case ya:
              e = t._payload, t = t._init;
              try {
                return A(t(e));
              } catch {
              }
          }
        return null;
      }
      function E(t) {
        return { current: t };
      }
      function y(t) {
        0 > ml || (t.current = Lr[ml], Lr[ml] = null, ml--);
      }
      function z(t, e) {
        ml++, Lr[ml] = t.current, t.current = e;
      }
      function w(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Cp(t) / jp | 0) | 0;
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
      function H(t, e, a) {
        var n = t.pendingLanes;
        if (n === 0) return 0;
        var r = 0, u = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var v = n & 134217727;
        return v !== 0 ? (n = v & ~u, n !== 0 ? r = k(n) : (f &= v, f !== 0 ? r = k(f) : a || (a = v & ~t, a !== 0 && (r = k(a))))) : (v = n & ~u, v !== 0 ? r = k(v) : f !== 0 ? r = k(f) : a || (a = n & ~t, a !== 0 && (r = k(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function b(t, e) {
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
      function U() {
        var t = Wn;
        return Wn <<= 1, (Wn & 62914560) === 0 && (Wn = 4194304), t;
      }
      function q(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function C(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function x(t, e, a, n, r, u) {
        var f = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var v = t.entanglements, O = t.expirationTimes, Q = t.hiddenUpdates;
        for (a = f & ~a; 0 < a; ) {
          var Z = 31 - ge(a), V = 1 << Z;
          v[Z] = 0, O[Z] = -1;
          var J = Q[Z];
          if (J !== null)
            for (Q[Z] = null, Z = 0; Z < J.length; Z++) {
              var ct = J[Z];
              ct !== null && (ct.lane &= -536870913);
            }
          a &= ~V;
        }
        n !== 0 && h(t, n, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(f & ~e));
      }
      function h(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var n = 31 - ge(e);
        t.entangledLanes |= e, t.entanglements[n] = t.entanglements[n] | 1073741824 | a & 261930;
      }
      function Y(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var n = 31 - ge(a), r = 1 << n;
          r & e | t[n] & e && (t[n] |= e), a &= ~r;
        }
      }
      function I(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : ft(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function ft(t) {
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
      function rt(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function jt(t) {
        if (typeof Hp == "function" && Dp(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode(Il, t);
          } catch {
          }
      }
      function Kt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Nt(t) {
        if (Ir === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Ir = e && e[1] || "", Rc = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Ir + t + Rc;
      }
      function K(t, e) {
        if (!t || $r) return "";
        $r = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var n = {
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
                    } catch (ct) {
                      var J = ct;
                    }
                    Reflect.construct(t, [], V);
                  } else {
                    try {
                      V.call();
                    } catch (ct) {
                      J = ct;
                    }
                    t.call(V.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ct) {
                    J = ct;
                  }
                  (V = t()) && typeof V.catch == "function" && V.catch(function() {
                  });
                }
              } catch (ct) {
                if (ct && J && typeof ct.stack == "string")
                  return [ct.stack, J.stack];
              }
              return [null, null];
            }
          };
          n.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var r = Object.getOwnPropertyDescriptor(
            n.DetermineComponentFrameRoot,
            "name"
          );
          r && r.configurable && Object.defineProperty(
            n.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var u = n.DetermineComponentFrameRoot(), f = u[0], v = u[1];
          if (f && v) {
            var O = f.split(`
`), Q = v.split(`
`);
            for (r = n = 0; n < O.length && !O[n].includes("DetermineComponentFrameRoot"); )
              n++;
            for (; r < Q.length && !Q[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (n === O.length || r === Q.length)
              for (n = O.length - 1, r = Q.length - 1; 1 <= n && 0 <= r && O[n] !== Q[r]; )
                r--;
            for (; 1 <= n && 0 <= r; n--, r--)
              if (O[n] !== Q[r]) {
                if (n !== 1 || r !== 1)
                  do
                    if (n--, r--, 0 > r || O[n] !== Q[r]) {
                      var Z = `
` + O[n].replace(" at new ", " at ");
                      return t.displayName && Z.includes("<anonymous>") && (Z = Z.replace("<anonymous>", t.displayName)), Z;
                    }
                  while (1 <= n && 0 <= r);
                break;
              }
          }
        } finally {
          $r = !1, Error.prepareStackTrace = a;
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
      function at(t) {
        try {
          var e = "", a = null;
          do
            e += et(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (n) {
          return `
Error generating stack: ` + n.message + `
` + n.stack;
        }
      }
      function D(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Hc.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: at(e)
          }, Hc.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: at(e)
        };
      }
      function B(t, e) {
        hl[gl++] = $l, hl[gl++] = In, In = t, $l = e;
      }
      function g(t, e, a) {
        ke[Ne++] = Ve, ke[Ne++] = Xe, ke[Ne++] = xa, xa = t;
        var n = Ve;
        t = Xe;
        var r = 32 - ge(n) - 1;
        n &= ~(1 << r), a += 1;
        var u = 32 - ge(e) + r;
        if (30 < u) {
          var f = r - r % 5;
          u = (n & (1 << f) - 1).toString(32), n >>= f, r -= f, Ve = 1 << 32 - ge(e) + r | a << r | n, Xe = u + t;
        } else
          Ve = 1 << u | a << r | n, Xe = t;
      }
      function G(t) {
        t.return !== null && (B(t, 1), g(t, 1, 0));
      }
      function tt(t) {
        for (; t === In; )
          In = hl[--gl], hl[gl] = null, $l = hl[--gl], hl[gl] = null;
        for (; t === xa; )
          xa = ke[--Ne], ke[Ne] = null, Xe = ke[--Ne], ke[Ne] = null, Ve = ke[--Ne], ke[Ne] = null;
      }
      function $(t, e) {
        ke[Ne++] = Ve, ke[Ne++] = Xe, ke[Ne++] = xa, Ve = e.id, Xe = e.overflow, xa = t;
      }
      function P(t, e) {
        z(wa, e), z(Pl, t), z(Pt, null), t = nm(e), y(Pt), z(Pt, t);
      }
      function lt() {
        y(Pt), y(Pl), y(wa);
      }
      function xt(t) {
        t.memoizedState !== null && z($n, t);
        var e = Pt.current, a = im(e, t.type);
        e !== a && (z(Pl, t), z(Pt, a));
      }
      function Jt(t) {
        Pl.current === t && (y(Pt), y(Pl)), $n.current === t && (y($n), ta ? Ka._currentValue = dl : Ka._currentValue2 = dl);
      }
      function ut(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ol(D(e, t)), Pr;
      }
      function Oa(t, e) {
        if (!ne) throw Error(c(175));
        ip(
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
              Te = !1;
              return;
            case 27:
            case 3:
              Te = !0;
              return;
            default:
              te = te.return;
          }
      }
      function Oe(t) {
        if (!ne || t !== te) return !1;
        if (!yt) return Ra(t), yt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || wc(t.type) && !Zn(t.type, t.memoizedProps)) && At && ut(t) : e !== 3 && (e !== 5 || wc(t.type) && !Zn(t.type, t.memoizedProps)) && At && ut(t), Ra(t), e === 13) {
          if (!ne) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          At = cp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          At = up(t);
        } else
          At = Vt && e === 27 ? Wm(
            t.type,
            At
          ) : te ? xc(t.stateNode) : null;
        return !0;
      }
      function Re() {
        ne && (At = te = null, yt = !1);
      }
      function ca() {
        var t = _a;
        return t !== null && (de === null ? de = t : de.push.apply(
          de,
          t
        ), _a = null), t;
      }
      function Ol(t) {
        _a === null ? _a = [t] : _a.push(t);
      }
      function da(t, e, a) {
        ta ? (z(Pn, e._currentValue), e._currentValue = a) : (z(Pn, e._currentValue2), e._currentValue2 = a);
      }
      function Le(t) {
        var e = Pn.current;
        ta ? t._currentValue = e : t._currentValue2 = e, y(Pn);
      }
      function Ri(t, e, a) {
        for (; t !== null; ) {
          var n = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, n !== null && (n.childLanes |= e)) : n !== null && (n.childLanes & e) !== e && (n.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Hi(t, e, a, n) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var f = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var v = u;
              u = r;
              for (var O = 0; O < e.length; O++)
                if (v.context === e[O]) {
                  u.lanes |= a, v = u.alternate, v !== null && (v.lanes |= a), Ri(
                    u.return,
                    a,
                    t
                  ), n || (f = null);
                  break t;
                }
              u = v.next;
            }
          } else if (r.tag === 18) {
            if (f = r.return, f === null) throw Error(c(341));
            f.lanes |= a, u = f.alternate, u !== null && (u.lanes |= a), Ri(f, a, t), f = null;
          } else f = r.child;
          if (f !== null) f.return = r;
          else
            for (f = r; f !== null; ) {
              if (f === t) {
                f = null;
                break;
              }
              if (r = f.sibling, r !== null) {
                r.return = f.return, f = r;
                break;
              }
              f = f.return;
            }
          r = f;
        }
      }
      function ll(t, e, a, n) {
        t = null;
        for (var r = e, u = !1; r !== null; ) {
          if (!u) {
            if ((r.flags & 524288) !== 0) u = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var f = r.alternate;
            if (f === null) throw Error(c(387));
            if (f = f.memoizedProps, f !== null) {
              var v = r.type;
              be(r.pendingProps.value, f.value) || (t !== null ? t.push(v) : t = [v]);
            }
          } else if (r === $n.current) {
            if (f = r.alternate, f === null) throw Error(c(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ka) : t = [Ka]);
          }
          r = r.return;
        }
        t !== null && Hi(
          e,
          t,
          a,
          n
        ), e.flags |= 262144;
      }
      function hn(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!be(
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
        return Lo(Va, t);
      }
      function gn(t, e) {
        return Va === null && Ha(t), Lo(t, e);
      }
      function Lo(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(c(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function Di() {
        return {
          controller: new Bp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Rl(t) {
        t.refCount--, t.refCount === 0 && qp(Yp, function() {
          t.controller.abort();
        });
      }
      function vn() {
      }
      function Ge(t) {
        t !== vl && t.next === null && (vl === null ? ti = vl = t : vl = vl.next = t), ei = !0, to || (to = !0, kf());
      }
      function nl(t, e) {
        if (!eo && ei) {
          eo = !0;
          do
            for (var a = !1, n = ti; n !== null; ) {
              if (t !== 0) {
                var r = n.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var f = n.suspendedLanes, v = n.pingedLanes;
                  u = (1 << 31 - ge(42 | t) + 1) - 1, u &= r & ~(f & ~v), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Po(n, u));
              } else
                u = bt, u = H(
                  n,
                  n === Tt ? u : 0,
                  n.cancelPendingCommit !== null || n.timeoutHandle !== Qa
                ), (u & 3) === 0 || b(n, u) || (a = !0, Po(n, u));
              n = n.next;
            }
          while (a);
          eo = !1;
        }
      }
      function Wo() {
        Fo();
      }
      function Fo() {
        ei = to = !1;
        var t = 0;
        Xa !== 0 && pm() && (t = Xa);
        for (var e = ue(), a = null, n = ti; n !== null; ) {
          var r = n.next, u = Io(n, e);
          u === 0 ? (n.next = null, a === null ? ti = r : a.next = r, r === null && (vl = a)) : (a = n, (t !== 0 || (u & 3) !== 0) && (ei = !0)), n = r;
        }
        Xt !== 0 && Xt !== 5 || nl(t), Xa !== 0 && (Xa = 0);
      }
      function Io(t, e) {
        for (var a = t.suspendedLanes, n = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var f = 31 - ge(u), v = 1 << f, O = r[f];
          O === -1 ? ((v & a) === 0 || (v & n) !== 0) && (r[f] = N(v, e)) : O <= e && (t.expiredLanes |= v), u &= ~v;
        }
        if (e = Tt, a = bt, a = H(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), n = t.callbackNode, a === 0 || t === e && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null)
          return n !== null && n !== null && Wr(n), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || b(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (n !== null && Wr(n), rt(a)) {
            case 2:
            case 8:
              a = Op;
              break;
            case 32:
              a = Fr;
              break;
            case 268435456:
              a = Rp;
              break;
            default:
              a = Fr;
          }
          return n = $o.bind(null, t), a = Fn(a, n), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return n !== null && n !== null && Wr(n), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function $o(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Jl() && t.callbackNode !== a)
          return null;
        var n = bt;
        return n = H(
          t,
          t === Tt ? n : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), n === 0 ? null : (Hu(t, n, e), Io(t, ue()), t.callbackNode != null && t.callbackNode === a ? $o.bind(null, t) : null);
      }
      function Po(t, e) {
        if (Jl()) return null;
        Hu(t, e, !0);
      }
      function kf() {
        wm ? _m(function() {
          (gt & 6) !== 0 ? Fn(
            Ac,
            Wo
          ) : Fo();
        }) : Fn(
          Ac,
          Wo
        );
      }
      function Ui() {
        if (Xa === 0) {
          var t = bl;
          t === 0 && (t = Jn, Jn <<= 1, (Jn & 261888) === 0 && (Jn = 256)), Xa = t;
        }
        return Xa;
      }
      function Nf(t, e) {
        if (tn === null) {
          var a = tn = [];
          ao = 0, bl = Ui(), yl = {
            status: "pending",
            value: void 0,
            then: function(n) {
              a.push(n);
            }
          };
        }
        return ao++, e.then(ts, ts), e;
      }
      function ts() {
        if (--ao === 0 && tn !== null) {
          yl !== null && (yl.status = "fulfilled");
          var t = tn;
          tn = null, bl = 0, yl = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Tf(t, e) {
        var a = [], n = {
          status: "pending",
          value: null,
          reason: null,
          then: function(r) {
            a.push(r);
          }
        };
        return t.then(
          function() {
            n.status = "fulfilled", n.value = e;
            for (var r = 0; r < a.length; r++) (0, a[r])(e);
          },
          function(r) {
            for (n.status = "rejected", n.reason = r, r = 0; r < a.length; r++)
              (0, a[r])(void 0);
          }
        ), n;
      }
      function Bi() {
        var t = Za.current;
        return t !== null ? t : Tt.pooledCache;
      }
      function bn(t, e) {
        e === null ? z(Za, Za.current) : z(Za, e.pool);
      }
      function es() {
        var t = Bi();
        return t === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: t
        };
      }
      function yn(t, e) {
        if (be(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), n = Object.keys(e);
        if (a.length !== n.length) return !1;
        for (n = 0; n < a.length; n++) {
          var r = a[n];
          if (!Up.call(e, r) || !be(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function as(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function ls(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(vn, vn), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, is(t), t;
          default:
            if (typeof e.status == "string") e.then(vn, vn);
            else {
              if (t = Tt, t !== null && 100 < t.shellSuspendCounter)
                throw Error(c(482));
              t = e, t.status = "pending", t.then(
                function(n) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "fulfilled", r.value = n;
                  }
                },
                function(n) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "rejected", r.reason = n;
                  }
                }
              );
            }
            switch (e.status) {
              case "fulfilled":
                return e.value;
              case "rejected":
                throw t = e.reason, is(t), t;
            }
            throw Ja = e, xl;
        }
      }
      function Da(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ja = a, xl) : a;
        }
      }
      function ns() {
        if (Ja === null) throw Error(c(459));
        var t = Ja;
        return Ja = null, t;
      }
      function is(t) {
        if (t === xl || t === ai)
          throw Error(c(483));
      }
      function xn(t) {
        var e = en;
        return en += 1, wl === null && (wl = []), ls(wl, t, e);
      }
      function Hl(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function wn(t, e) {
        throw e.$$typeof === Pf ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
          c(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function rs(t) {
        function e(j, T) {
          if (t) {
            var M = j.deletions;
            M === null ? (j.deletions = [T], j.flags |= 16) : M.push(T);
          }
        }
        function a(j, T) {
          if (!t) return null;
          for (; T !== null; )
            e(j, T), T = T.sibling;
          return null;
        }
        function n(j) {
          for (var T = /* @__PURE__ */ new Map(); j !== null; )
            j.key !== null ? T.set(j.key, j) : T.set(j.index, j), j = j.sibling;
          return T;
        }
        function r(j, T) {
          return j = Pe(j, T), j.index = 0, j.sibling = null, j;
        }
        function u(j, T, M) {
          return j.index = M, t ? (M = j.alternate, M !== null ? (M = M.index, M < T ? (j.flags |= 67108866, T) : M) : (j.flags |= 67108866, T)) : (j.flags |= 1048576, T);
        }
        function f(j) {
          return t && j.alternate === null && (j.flags |= 67108866), j;
        }
        function v(j, T, M, X) {
          return T === null || T.tag !== 6 ? (T = Or(M, j.mode, X), T.return = j, T) : (T = r(T, M), T.return = j, T);
        }
        function O(j, T, M, X) {
          var it = M.type;
          return it === cl ? Z(
            j,
            T,
            M.props.children,
            X,
            M.key
          ) : T !== null && (T.elementType === it || typeof it == "object" && it !== null && it.$$typeof === ya && Da(it) === T.type) ? (T = r(T, M.props), Hl(T, M), T.return = j, T) : (T = Kn(
            M.type,
            M.key,
            M.props,
            null,
            j.mode,
            X
          ), Hl(T, M), T.return = j, T);
        }
        function Q(j, T, M, X) {
          return T === null || T.tag !== 4 || T.stateNode.containerInfo !== M.containerInfo || T.stateNode.implementation !== M.implementation ? (T = Rr(M, j.mode, X), T.return = j, T) : (T = r(T, M.children || []), T.return = j, T);
        }
        function Z(j, T, M, X, it) {
          return T === null || T.tag !== 7 ? (T = Ga(
            M,
            j.mode,
            X,
            it
          ), T.return = j, T) : (T = r(T, M), T.return = j, T);
        }
        function V(j, T, M) {
          if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
            return T = Or(
              "" + T,
              j.mode,
              M
            ), T.return = j, T;
          if (typeof T == "object" && T !== null) {
            switch (T.$$typeof) {
              case Vn:
                return M = Kn(
                  T.type,
                  T.key,
                  T.props,
                  null,
                  j.mode,
                  M
                ), Hl(M, T), M.return = j, M;
              case ul:
                return T = Rr(
                  T,
                  j.mode,
                  M
                ), T.return = j, T;
              case ya:
                return T = Da(T), V(j, T, M);
            }
            if (Xn(T) || R(T))
              return T = Ga(
                T,
                j.mode,
                M,
                null
              ), T.return = j, T;
            if (typeof T.then == "function")
              return V(j, xn(T), M);
            if (T.$$typeof === ba)
              return V(
                j,
                gn(j, T),
                M
              );
            wn(j, T);
          }
          return null;
        }
        function J(j, T, M, X) {
          var it = T !== null ? T.key : null;
          if (typeof M == "string" && M !== "" || typeof M == "number" || typeof M == "bigint")
            return it !== null ? null : v(j, T, "" + M, X);
          if (typeof M == "object" && M !== null) {
            switch (M.$$typeof) {
              case Vn:
                return M.key === it ? O(j, T, M, X) : null;
              case ul:
                return M.key === it ? Q(j, T, M, X) : null;
              case ya:
                return M = Da(M), J(j, T, M, X);
            }
            if (Xn(M) || R(M))
              return it !== null ? null : Z(j, T, M, X, null);
            if (typeof M.then == "function")
              return J(
                j,
                T,
                xn(M),
                X
              );
            if (M.$$typeof === ba)
              return J(
                j,
                T,
                gn(j, M),
                X
              );
            wn(j, M);
          }
          return null;
        }
        function ct(j, T, M, X, it) {
          if (typeof X == "string" && X !== "" || typeof X == "number" || typeof X == "bigint")
            return j = j.get(M) || null, v(T, j, "" + X, it);
          if (typeof X == "object" && X !== null) {
            switch (X.$$typeof) {
              case Vn:
                return j = j.get(
                  X.key === null ? M : X.key
                ) || null, O(T, j, X, it);
              case ul:
                return j = j.get(
                  X.key === null ? M : X.key
                ) || null, Q(T, j, X, it);
              case ya:
                return X = Da(X), ct(
                  j,
                  T,
                  M,
                  X,
                  it
                );
            }
            if (Xn(X) || R(X))
              return j = j.get(M) || null, Z(T, j, X, it, null);
            if (typeof X.then == "function")
              return ct(
                j,
                T,
                M,
                xn(X),
                it
              );
            if (X.$$typeof === ba)
              return ct(
                j,
                T,
                M,
                gn(T, X),
                it
              );
            wn(T, X);
          }
          return null;
        }
        function ee(j, T, M, X) {
          for (var it = null, Rt = null, ot = T, _t = T = 0, Ft = null; ot !== null && _t < M.length; _t++) {
            ot.index > _t ? (Ft = ot, ot = null) : Ft = ot.sibling;
            var St = J(
              j,
              ot,
              M[_t],
              X
            );
            if (St === null) {
              ot === null && (ot = Ft);
              break;
            }
            t && ot && St.alternate === null && e(j, ot), T = u(St, T, _t), Rt === null ? it = St : Rt.sibling = St, Rt = St, ot = Ft;
          }
          if (_t === M.length)
            return a(j, ot), yt && B(j, _t), it;
          if (ot === null) {
            for (; _t < M.length; _t++)
              ot = V(j, M[_t], X), ot !== null && (T = u(
                ot,
                T,
                _t
              ), Rt === null ? it = ot : Rt.sibling = ot, Rt = ot);
            return yt && B(j, _t), it;
          }
          for (ot = n(ot); _t < M.length; _t++)
            Ft = ct(
              ot,
              j,
              _t,
              M[_t],
              X
            ), Ft !== null && (t && Ft.alternate !== null && ot.delete(
              Ft.key === null ? _t : Ft.key
            ), T = u(
              Ft,
              T,
              _t
            ), Rt === null ? it = Ft : Rt.sibling = Ft, Rt = Ft);
          return t && ot.forEach(function(Ta) {
            return e(j, Ta);
          }), yt && B(j, _t), it;
        }
        function un(j, T, M, X) {
          if (M == null) throw Error(c(151));
          for (var it = null, Rt = null, ot = T, _t = T = 0, Ft = null, St = M.next(); ot !== null && !St.done; _t++, St = M.next()) {
            ot.index > _t ? (Ft = ot, ot = null) : Ft = ot.sibling;
            var Ta = J(j, ot, St.value, X);
            if (Ta === null) {
              ot === null && (ot = Ft);
              break;
            }
            t && ot && Ta.alternate === null && e(j, ot), T = u(Ta, T, _t), Rt === null ? it = Ta : Rt.sibling = Ta, Rt = Ta, ot = Ft;
          }
          if (St.done)
            return a(j, ot), yt && B(j, _t), it;
          if (ot === null) {
            for (; !St.done; _t++, St = M.next())
              St = V(j, St.value, X), St !== null && (T = u(
                St,
                T,
                _t
              ), Rt === null ? it = St : Rt.sibling = St, Rt = St);
            return yt && B(j, _t), it;
          }
          for (ot = n(ot); !St.done; _t++, St = M.next())
            St = ct(
              ot,
              j,
              _t,
              St.value,
              X
            ), St !== null && (t && St.alternate !== null && ot.delete(St.key === null ? _t : St.key), T = u(St, T, _t), Rt === null ? it = St : Rt.sibling = St, Rt = St);
          return t && ot.forEach(function(Vp) {
            return e(j, Vp);
          }), yt && B(j, _t), it;
        }
        function Ia(j, T, M, X) {
          if (typeof M == "object" && M !== null && M.type === cl && M.key === null && (M = M.props.children), typeof M == "object" && M !== null) {
            switch (M.$$typeof) {
              case Vn:
                t: {
                  for (var it = M.key; T !== null; ) {
                    if (T.key === it) {
                      if (it = M.type, it === cl) {
                        if (T.tag === 7) {
                          a(
                            j,
                            T.sibling
                          ), X = r(
                            T,
                            M.props.children
                          ), X.return = j, j = X;
                          break t;
                        }
                      } else if (T.elementType === it || typeof it == "object" && it !== null && it.$$typeof === ya && Da(it) === T.type) {
                        a(
                          j,
                          T.sibling
                        ), X = r(T, M.props), Hl(X, M), X.return = j, j = X;
                        break t;
                      }
                      a(j, T);
                      break;
                    } else e(j, T);
                    T = T.sibling;
                  }
                  M.type === cl ? (X = Ga(
                    M.props.children,
                    j.mode,
                    X,
                    M.key
                  ), X.return = j, j = X) : (X = Kn(
                    M.type,
                    M.key,
                    M.props,
                    null,
                    j.mode,
                    X
                  ), Hl(X, M), X.return = j, j = X);
                }
                return f(j);
              case ul:
                t: {
                  for (it = M.key; T !== null; ) {
                    if (T.key === it)
                      if (T.tag === 4 && T.stateNode.containerInfo === M.containerInfo && T.stateNode.implementation === M.implementation) {
                        a(
                          j,
                          T.sibling
                        ), X = r(
                          T,
                          M.children || []
                        ), X.return = j, j = X;
                        break t;
                      } else {
                        a(j, T);
                        break;
                      }
                    else e(j, T);
                    T = T.sibling;
                  }
                  X = Rr(M, j.mode, X), X.return = j, j = X;
                }
                return f(j);
              case ya:
                return M = Da(M), Ia(
                  j,
                  T,
                  M,
                  X
                );
            }
            if (Xn(M))
              return ee(
                j,
                T,
                M,
                X
              );
            if (R(M)) {
              if (it = R(M), typeof it != "function")
                throw Error(c(150));
              return M = it.call(M), un(
                j,
                T,
                M,
                X
              );
            }
            if (typeof M.then == "function")
              return Ia(
                j,
                T,
                xn(M),
                X
              );
            if (M.$$typeof === ba)
              return Ia(
                j,
                T,
                gn(j, M),
                X
              );
            wn(j, M);
          }
          return typeof M == "string" && M !== "" || typeof M == "number" || typeof M == "bigint" ? (M = "" + M, T !== null && T.tag === 6 ? (a(j, T.sibling), X = r(T, M), X.return = j, j = X) : (a(j, T), X = Or(M, j.mode, X), X.return = j, j = X), f(j)) : a(j, T);
        }
        return function(j, T, M, X) {
          try {
            en = 0;
            var it = Ia(
              j,
              T,
              M,
              X
            );
            return wl = null, it;
          } catch (ot) {
            if (ot === xl || ot === ai) throw ot;
            var Rt = o(29, ot, null, j.mode);
            return Rt.lanes = X, Rt.return = j, Rt;
          } finally {
          }
        };
      }
      function _n() {
        for (var t = _l, e = no = _l = 0; e < t; ) {
          var a = Ce[e];
          Ce[e++] = null;
          var n = Ce[e];
          Ce[e++] = null;
          var r = Ce[e];
          Ce[e++] = null;
          var u = Ce[e];
          if (Ce[e++] = null, n !== null && r !== null) {
            var f = n.pending;
            f === null ? r.next = r : (r.next = f.next, f.next = r), n.pending = r;
          }
          u !== 0 && os(a, r, u);
        }
      }
      function Sn(t, e, a, n) {
        Ce[_l++] = t, Ce[_l++] = e, Ce[_l++] = a, Ce[_l++] = n, no |= n, t.lanes |= n, t = t.alternate, t !== null && (t.lanes |= n);
      }
      function qi(t, e, a, n) {
        return Sn(t, e, a, n), zn(t);
      }
      function Ua(t, e) {
        return Sn(t, null, null, e), zn(t);
      }
      function os(t, e, a) {
        t.lanes |= a;
        var n = t.alternate;
        n !== null && (n.lanes |= a);
        for (var r = !1, u = t.return; u !== null; )
          u.childLanes |= a, n = u.alternate, n !== null && (n.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - ge(a), t = u.hiddenUpdates, n = t[r], n === null ? t[r] = [e] : n.push(e), e.lane = a | 536870912), u) : null;
      }
      function zn(t) {
        if (50 < sn)
          throw sn = 0, vo = null, Error(c(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Yi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Gi(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function fa(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function ma(t, e, a) {
        var n = t.updateQueue;
        if (n === null) return null;
        if (n = n.shared, (gt & 2) !== 0) {
          var r = n.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), n.pending = e, e = zn(t), os(t, null, a), e;
        }
        return Sn(t, n, e, a), zn(t);
      }
      function Dl(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var n = e.lanes;
          n &= t.pendingLanes, a |= n, e.lanes = a, Y(t, a);
        }
      }
      function Qi(t, e) {
        var a = t.updateQueue, n = t.alternate;
        if (n !== null && (n = n.updateQueue, a === n)) {
          var r = null, u = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var f = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              u === null ? r = u = f : u = u.next = f, a = a.next;
            } while (a !== null);
            u === null ? r = u = e : u = u.next = e;
          } else r = u = e;
          a = {
            baseState: n.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: u,
            shared: n.shared,
            callbacks: n.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Ul() {
        if (io) {
          var t = yl;
          if (t !== null) throw t;
        }
      }
      function Bl(t, e, a, n) {
        io = !1;
        var r = t.updateQueue;
        Sa = !1;
        var u = r.firstBaseUpdate, f = r.lastBaseUpdate, v = r.shared.pending;
        if (v !== null) {
          r.shared.pending = null;
          var O = v, Q = O.next;
          O.next = null, f === null ? u = Q : f.next = Q, f = O;
          var Z = t.alternate;
          Z !== null && (Z = Z.updateQueue, v = Z.lastBaseUpdate, v !== f && (v === null ? Z.firstBaseUpdate = Q : v.next = Q, Z.lastBaseUpdate = O));
        }
        if (u !== null) {
          var V = r.baseState;
          f = 0, Z = Q = O = null, v = u;
          do {
            var J = v.lane & -536870913, ct = J !== v.lane;
            if (ct ? (bt & J) === J : (n & J) === J) {
              J !== 0 && J === bl && (io = !0), Z !== null && (Z = Z.next = {
                lane: 0,
                tag: v.tag,
                payload: v.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, un = v;
                J = e;
                var Ia = a;
                switch (un.tag) {
                  case 1:
                    if (ee = un.payload, typeof ee == "function") {
                      V = ee.call(
                        Ia,
                        V,
                        J
                      );
                      break t;
                    }
                    V = ee;
                    break t;
                  case 3:
                    ee.flags = ee.flags & -65537 | 128;
                  case 0:
                    if (ee = un.payload, J = typeof ee == "function" ? ee.call(Ia, V, J) : ee, J == null) break t;
                    V = Dr({}, V, J);
                    break t;
                  case 2:
                    Sa = !0;
                }
              }
              J = v.callback, J !== null && (t.flags |= 64, ct && (t.flags |= 8192), ct = r.callbacks, ct === null ? r.callbacks = [J] : ct.push(J));
            } else
              ct = {
                lane: J,
                tag: v.tag,
                payload: v.payload,
                callback: v.callback,
                next: null
              }, Z === null ? (Q = Z = ct, O = V) : Z = Z.next = ct, f |= J;
            if (v = v.next, v === null) {
              if (v = r.shared.pending, v === null)
                break;
              ct = v, v = ct.next, ct.next = null, r.lastBaseUpdate = ct, r.shared.pending = null;
            }
          } while (!0);
          Z === null && (O = V), r.baseState = O, r.firstBaseUpdate = Q, r.lastBaseUpdate = Z, u === null && (r.shared.lanes = 0), Ea |= f, t.lanes = f, t.memoizedState = V;
        }
      }
      function ss(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function us(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            ss(a[t], e);
      }
      function cs(t, e) {
        t = ia, z(ni, t), z(Sl, e), ia = t | e.baseLanes;
      }
      function Ki() {
        z(ni, ia), z(Sl, Sl.current);
      }
      function Vi() {
        ia = ni.current, y(Sl), y(ni);
      }
      function pa(t) {
        var e = t.alternate;
        z(Bt, Bt.current & 1), z(ye, t), je === null && (e === null || Sl.current !== null || e.memoizedState !== null) && (je = t);
      }
      function Xi(t) {
        z(Bt, Bt.current), z(ye, t), je === null && (je = t);
      }
      function ds(t) {
        t.tag === 22 ? (z(Bt, Bt.current), z(ye, t), je === null && (je = t)) : ha();
      }
      function ha() {
        z(Bt, Bt.current), z(ye, ye.current);
      }
      function me(t) {
        y(ye), je === t && (je = null), y(Bt);
      }
      function En(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Xr(a) || Zr(a)))
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
      function Zi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!be(t[a], e[a])) return !1;
        return !0;
      }
      function Ji(t, e, a, n, r, u) {
        return la = u, dt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, nt.H = t === null || t.memoizedState === null ? Bc : ro, Wa = !1, u = a(n, r), Wa = !1, zl && (u = ms(
          e,
          a,
          n,
          r
        )), fs(t), u;
      }
      function fs(t) {
        nt.H = ln;
        var e = kt !== null && kt.next !== null;
        if (la = 0, qt = kt = dt = null, ii = !1, an = 0, El = null, e) throw Error(c(300));
        t === null || Yt || (t = t.dependencies, t !== null && hn(t) && (Yt = !0));
      }
      function ms(t, e, a, n) {
        dt = t;
        var r = 0;
        do {
          if (zl && (El = null), an = 0, zl = !1, 25 <= r) throw Error(c(301));
          if (r += 1, qt = kt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          nt.H = qc, u = e(a, n);
        } while (zl);
        return u;
      }
      function Cf() {
        var t = nt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? ql(e) : e, t = t.useState()[0], (kt !== null ? kt.memoizedState : null) !== t && (dt.flags |= 1024), e;
      }
      function Li() {
        var t = ri !== 0;
        return ri = 0, t;
      }
      function Wi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Fi(t) {
        if (ii) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ii = !1;
        }
        la = 0, qt = kt = dt = null, zl = !1, an = ri = 0, El = null;
      }
      function re() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return qt === null ? dt.memoizedState = qt = t : qt = qt.next = t, qt;
      }
      function Ut() {
        if (kt === null) {
          var t = dt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = kt.next;
        var e = qt === null ? dt.memoizedState : qt.next;
        if (e !== null)
          qt = e, kt = t;
        else {
          if (t === null)
            throw dt.alternate === null ? Error(c(467)) : Error(c(310));
          kt = t, t = {
            memoizedState: kt.memoizedState,
            baseState: kt.baseState,
            baseQueue: kt.baseQueue,
            queue: kt.queue,
            next: null
          }, qt === null ? dt.memoizedState = qt = t : qt = qt.next = t;
        }
        return qt;
      }
      function kn() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function ql(t) {
        var e = an;
        return an += 1, El === null && (El = []), t = ls(El, t, e), e = dt, (qt === null ? e.memoizedState : qt.next) === null && (e = e.alternate, nt.H = e === null || e.memoizedState === null ? Bc : ro), t;
      }
      function Nn(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return ql(t);
          if (t.$$typeof === ba) return It(t);
        }
        throw Error(c(438, String(t)));
      }
      function Ii(t) {
        var e = null, a = dt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var n = dt.alternate;
          n !== null && (n = n.updateQueue, n !== null && (n = n.memoCache, n != null && (e = {
            data: n.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = kn(), dt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), n = 0; n < t; n++)
            a[n] = tm;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Tn(t) {
        var e = Ut();
        return $i(e, kt, t);
      }
      function $i(t, e, a) {
        var n = t.queue;
        if (n === null) throw Error(c(311));
        n.lastRenderedReducer = a;
        var r = t.baseQueue, u = n.pending;
        if (u !== null) {
          if (r !== null) {
            var f = r.next;
            r.next = u.next, u.next = f;
          }
          e.baseQueue = r = u, n.pending = null;
        }
        if (u = t.baseState, r === null) t.memoizedState = u;
        else {
          e = r.next;
          var v = f = null, O = null, Q = e, Z = !1;
          do {
            var V = Q.lane & -536870913;
            if (V !== Q.lane ? (bt & V) === V : (la & V) === V) {
              var J = Q.revertLane;
              if (J === 0)
                O !== null && (O = O.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }), V === bl && (Z = !0);
              else if ((la & J) === J) {
                Q = Q.next, J === bl && (Z = !0);
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
                }, O === null ? (v = O = V, f = u) : O = O.next = V, dt.lanes |= J, Ea |= J;
              V = Q.action, Wa && a(u, V), u = Q.hasEagerState ? Q.eagerState : a(u, V);
            } else
              J = {
                lane: V,
                revertLane: Q.revertLane,
                gesture: Q.gesture,
                action: Q.action,
                hasEagerState: Q.hasEagerState,
                eagerState: Q.eagerState,
                next: null
              }, O === null ? (v = O = J, f = u) : O = O.next = J, dt.lanes |= V, Ea |= V;
            Q = Q.next;
          } while (Q !== null && Q !== e);
          if (O === null ? f = u : O.next = v, !be(u, t.memoizedState) && (Yt = !0, Z && (a = yl, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = f, t.baseQueue = O, n.lastRenderedState = u;
        }
        return r === null && (n.lanes = 0), [t.memoizedState, n.dispatch];
      }
      function Pi(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(c(311));
        a.lastRenderedReducer = t;
        var n = a.dispatch, r = a.pending, u = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var f = r = r.next;
          do
            u = t(u, f.action), f = f.next;
          while (f !== r);
          be(u, e.memoizedState) || (Yt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, n];
      }
      function ps(t, e, a) {
        var n = dt, r = Ut(), u = yt;
        if (u) {
          if (a === void 0)
            throw Error(c(407));
          a = a();
        } else a = e();
        var f = !be(
          (kt || r).memoizedState,
          a
        );
        if (f && (r.memoizedState = a, Yt = !0), r = r.queue, ar(vs.bind(null, n, r, t), [
          t
        ]), r.getSnapshot !== e || f || qt !== null && qt.memoizedState.tag & 1) {
          if (n.flags |= 2048, il(
            9,
            { destroy: void 0 },
            gs.bind(
              null,
              n,
              r,
              a,
              e
            ),
            null
          ), Tt === null) throw Error(c(349));
          u || (la & 127) !== 0 || hs(n, e, a);
        }
        return a;
      }
      function hs(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = dt.updateQueue, e === null ? (e = kn(), dt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function gs(t, e, a, n) {
        e.value = a, e.getSnapshot = n, bs(e) && ys(t);
      }
      function vs(t, e, a) {
        return a(function() {
          bs(e) && ys(t);
        });
      }
      function bs(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !be(t, a);
        } catch {
          return !0;
        }
      }
      function ys(t) {
        var e = Ua(t, 2);
        e !== null && se(e, t, 2);
      }
      function tr(t) {
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
      function xs(t, e, a, n) {
        return t.baseState = a, $i(
          t,
          kt,
          typeof n == "function" ? n : We
        );
      }
      function jf(t, e, a, n, r) {
        if (Mn(t)) throw Error(c(485));
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
            then: function(f) {
              u.listeners.push(f);
            }
          };
          nt.T !== null ? a(!0) : u.isTransition = !1, n(u), a = e.pending, a === null ? (u.next = e.pending = u, ws(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function ws(t, e) {
        var a = e.action, n = e.payload, r = t.state;
        if (e.isTransition) {
          var u = nt.T, f = {};
          nt.T = f;
          try {
            var v = a(r, n), O = nt.S;
            O !== null && O(f, v), _s(t, e, v);
          } catch (Q) {
            er(t, e, Q);
          } finally {
            u !== null && f.types !== null && (u.types = f.types), nt.T = u;
          }
        } else
          try {
            u = a(r, n), _s(t, e, u);
          } catch (Q) {
            er(t, e, Q);
          }
      }
      function _s(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(n) {
            Ss(t, e, n);
          },
          function(n) {
            return er(t, e, n);
          }
        ) : Ss(t, e, a);
      }
      function Ss(t, e, a) {
        e.status = "fulfilled", e.value = a, zs(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ws(t, a)));
      }
      function er(t, e, a) {
        var n = t.pending;
        if (t.pending = null, n !== null) {
          n = n.next;
          do
            e.status = "rejected", e.reason = a, zs(e), e = e.next;
          while (e !== n);
        }
        t.action = null;
      }
      function zs(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Es(t, e) {
        return e;
      }
      function ks(t, e) {
        if (yt) {
          var a = Tt.formState;
          if (a !== null) {
            t: {
              var n = dt;
              if (yt) {
                if (At) {
                  var r = Jm(
                    At,
                    Te
                  );
                  if (r) {
                    At = xc(r), n = Lm(r);
                    break t;
                  }
                }
                ut(n);
              }
              n = !1;
            }
            n && (e = a[0]);
          }
        }
        a = re(), a.memoizedState = a.baseState = e, n = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Es,
          lastRenderedState: e
        }, a.queue = n, a = Vs.bind(
          null,
          dt,
          n
        ), n.dispatch = a, n = tr(!1);
        var u = rr.bind(
          null,
          dt,
          !1,
          n.queue
        );
        return n = re(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, n.queue = r, a = jf.bind(
          null,
          dt,
          r,
          u,
          a
        ), r.dispatch = a, n.memoizedState = t, [e, a, !1];
      }
      function Ns(t) {
        var e = Ut();
        return Ts(e, kt, t);
      }
      function Ts(t, e, a) {
        if (e = $i(
          t,
          e,
          Es
        )[0], t = Tn(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var n = ql(e);
          } catch (f) {
            throw f === xl ? ai : f;
          }
        else n = e;
        e = Ut();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (dt.flags |= 2048, il(
          9,
          { destroy: void 0 },
          Mf.bind(null, r, a),
          null
        )), [n, u, t];
      }
      function Mf(t, e) {
        t.action = e;
      }
      function Cs(t) {
        var e = Ut(), a = kt;
        if (a !== null)
          return Ts(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var n = a.queue.dispatch;
        return a.memoizedState = t, [e, n, !1];
      }
      function il(t, e, a, n) {
        return t = { tag: t, create: a, deps: n, inst: e, next: null }, e = dt.updateQueue, e === null && (e = kn(), dt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (n = a.next, a.next = t, t.next = n, e.lastEffect = t), t;
      }
      function js() {
        return Ut().memoizedState;
      }
      function Cn(t, e, a, n) {
        var r = re();
        dt.flags |= t, r.memoizedState = il(
          1 | e,
          { destroy: void 0 },
          a,
          n === void 0 ? null : n
        );
      }
      function jn(t, e, a, n) {
        var r = Ut();
        n = n === void 0 ? null : n;
        var u = r.memoizedState.inst;
        kt !== null && n !== null && Zi(n, kt.memoizedState.deps) ? r.memoizedState = il(e, u, a, n) : (dt.flags |= t, r.memoizedState = il(
          1 | e,
          u,
          a,
          n
        ));
      }
      function Ms(t, e) {
        Cn(8390656, 8, t, e);
      }
      function ar(t, e) {
        jn(2048, 8, t, e);
      }
      function Af(t) {
        dt.flags |= 4;
        var e = dt.updateQueue;
        if (e === null)
          e = kn(), dt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function As(t) {
        var e = Ut().memoizedState;
        return Af({ ref: e, nextImpl: t }), function() {
          if ((gt & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Os(t, e) {
        return jn(4, 2, t, e);
      }
      function Rs(t, e) {
        return jn(4, 4, t, e);
      }
      function Hs(t, e) {
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
      function Ds(t, e, a) {
        a = a != null ? a.concat([t]) : null, jn(
          4,
          4,
          Hs.bind(null, e, t),
          a
        );
      }
      function lr() {
      }
      function Us(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var n = a.memoizedState;
        return e !== null && Zi(e, n[1]) ? n[0] : (a.memoizedState = [t, e], t);
      }
      function Bs(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var n = a.memoizedState;
        if (e !== null && Zi(e, n[1]))
          return n[0];
        if (n = t(), Wa) {
          jt(!0);
          try {
            t();
          } finally {
            jt(!1);
          }
        }
        return a.memoizedState = [n, e], n;
      }
      function nr(t, e, a) {
        return a === void 0 || (la & 1073741824) !== 0 && (bt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Ru(), dt.lanes |= t, Ea |= t, a);
      }
      function qs(t, e, a, n) {
        return be(a, e) ? a : Sl.current !== null ? (t = nr(t, a, n), be(t, e) || (Yt = !0), t) : (la & 42) === 0 || (la & 1073741824) !== 0 && (bt & 261930) === 0 ? (Yt = !0, t.memoizedState = a) : (t = Ru(), dt.lanes |= t, Ea |= t, e);
      }
      function Ys(t, e, a, n, r) {
        var u = ea();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var f = nt.T, v = {};
        nt.T = v, rr(t, !1, e, a);
        try {
          var O = r(), Q = nt.S;
          if (Q !== null && Q(v, O), O !== null && typeof O == "object" && typeof O.then == "function") {
            var Z = Tf(
              O,
              n
            );
            Yl(
              t,
              e,
              Z,
              pe(t)
            );
          } else
            Yl(
              t,
              e,
              n,
              pe(t)
            );
        } catch (V) {
          Yl(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: V },
            pe()
          );
        } finally {
          Lt(u), f !== null && v.types !== null && (f.types = v.types), nt.T = f;
        }
      }
      function Gs(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: dl,
          baseState: dl,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: We,
            lastRenderedState: dl
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
      function ir() {
        return It(Ka);
      }
      function Qs() {
        return Ut().memoizedState;
      }
      function Ks() {
        return Ut().memoizedState;
      }
      function Of(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = pe();
              t = fa(a);
              var n = ma(e, t, a);
              n !== null && (se(n, e, a), Dl(n, e, a)), e = { cache: Di() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Rf(t, e, a) {
        var n = pe();
        a = {
          lane: n,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Mn(t) ? Xs(e, a) : (a = qi(t, e, a, n), a !== null && (se(a, t, n), Zs(a, e, n)));
      }
      function Vs(t, e, a) {
        var n = pe();
        Yl(t, e, a, n);
      }
      function Yl(t, e, a, n) {
        var r = {
          lane: n,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Mn(t)) Xs(e, r);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var f = e.lastRenderedState, v = u(f, a);
              if (r.hasEagerState = !0, r.eagerState = v, be(v, f))
                return Sn(t, e, r, 0), Tt === null && _n(), !1;
            } catch {
            } finally {
            }
          if (a = qi(t, e, r, n), a !== null)
            return se(a, t, n), Zs(a, e, n), !0;
        }
        return !1;
      }
      function rr(t, e, a, n) {
        if (n = {
          lane: 2,
          revertLane: Ui(),
          gesture: null,
          action: n,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Mn(t)) {
          if (e) throw Error(c(479));
        } else
          e = qi(
            t,
            a,
            n,
            2
          ), e !== null && se(e, t, 2);
      }
      function Mn(t) {
        var e = t.alternate;
        return t === dt || e !== null && e === dt;
      }
      function Xs(t, e) {
        zl = ii = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Zs(t, e, a) {
        if ((a & 4194048) !== 0) {
          var n = e.lanes;
          n &= t.pendingLanes, a |= n, e.lanes = a, Y(t, a);
        }
      }
      function or(t, e, a, n) {
        e = t.memoizedState, a = a(n, e), a = a == null ? e : Dr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Js(t, e, a, n, r, u, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(n, u, f) : e.prototype && e.prototype.isPureReactComponent ? !yn(a, n) || !yn(r, u) : !0;
      }
      function Ls(t, e, a, n) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, n), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, n), e.state !== t && oo.enqueueReplaceState(e, e.state, null);
      }
      function Ba(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var n in e)
            n !== "ref" && (a[n] = e[n]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Dr({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function An(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (n) {
          setTimeout(function() {
            throw n;
          });
        }
      }
      function Ws(t, e, a) {
        try {
          var n = t.onCaughtError;
          n(a.value, {
            componentStack: a.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function sr(t, e, a) {
        return a = fa(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          An(t, e);
        }, a;
      }
      function Fs(t) {
        return t = fa(t), t.tag = 3, t;
      }
      function Is(t, e, a, n) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = n.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            Ws(e, a, n);
          };
        }
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          Ws(e, a, n), typeof r != "function" && (ka === null ? ka = /* @__PURE__ */ new Set([this]) : ka.add(this));
          var v = n.stack;
          this.componentDidCatch(n.value, {
            componentStack: v !== null ? v : ""
          });
        });
      }
      function Hf(t, e, a, n, r) {
        if (a.flags |= 32768, n !== null && typeof n == "object" && typeof n.then == "function") {
          if (e = a.alternate, e !== null && ll(
            e,
            a,
            r,
            !0
          ), a = ye.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return je === null ? Gn() : a.alternate === null && Dt === 0 && (Dt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, n === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([n]) : e.add(n), Mr(t, n, r)), !1;
              case 22:
                return a.flags |= 65536, n === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([n])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([n]) : a.add(n)), Mr(t, n, r)), !1;
            }
            throw Error(c(435, a.tag));
          }
          return Mr(t, n, r), Gn(), !1;
        }
        if (yt)
          return e = ye.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, n !== Pr && (t = Error(c(422), { cause: n }), Ol(
            D(t, a)
          ))) : (n !== Pr && (e = Error(c(423), {
            cause: n
          }), Ol(
            D(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, n = D(n, a), r = sr(
            t.stateNode,
            n,
            r
          ), Qi(t, r), Dt !== 4 && (Dt = 2)), !1;
        var u = Error(c(520), { cause: n });
        if (u = D(u, a), rn === null ? rn = [u] : rn.push(u), Dt !== 4 && (Dt = 2), e === null) return !0;
        n = D(n, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = sr(a.stateNode, n, t), Qi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (ka === null || !ka.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = Fs(r), Is(
                  r,
                  t,
                  a,
                  n
                ), Qi(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, n) {
        e.child = t === null ? Uc(e, null, a, n) : La(
          e,
          t.child,
          a,
          n
        );
      }
      function $s(t, e, a, n, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in n) {
          var f = {};
          for (var v in n)
            v !== "ref" && (f[v] = n[v]);
        } else f = n;
        return Ha(e), n = Ji(
          t,
          e,
          a,
          f,
          u,
          r
        ), v = Li(), t !== null && !Yt ? (Wi(t, e, r), Fe(t, e, r)) : (yt && v && G(e), e.flags |= 1, $t(t, e, n, r), e.child);
      }
      function Ps(t, e, a, n, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !Ar(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, tu(
            t,
            e,
            u,
            n,
            r
          )) : (t = Kn(
            a.type,
            null,
            n,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !hr(t, r)) {
          var f = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : yn, a(f, n) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(u, n), t.ref = e.ref, t.return = e, e.child = t;
      }
      function tu(t, e, a, n, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (yn(u, n) && t.ref === e.ref)
            if (Yt = !1, e.pendingProps = n = u, hr(t, r))
              (t.flags & 131072) !== 0 && (Yt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return ur(
          t,
          e,
          a,
          n,
          r
        );
      }
      function eu(t, e, a, n) {
        var r = n.children, u = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), n.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (u = u !== null ? u.baseLanes | a : a, t !== null) {
              for (n = e.child = t.child, r = 0; n !== null; )
                r = r | n.lanes | n.childLanes, n = n.sibling;
              n = r & ~u;
            } else n = 0, e.child = null;
            return au(
              t,
              e,
              u,
              a,
              n
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && bn(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? cs(e, u) : Ki(), ds(e);
          else
            return n = e.lanes = 536870912, au(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              n
            );
        } else
          u !== null ? (bn(e, u.cachePool), cs(e, u), ha(), e.memoizedState = null) : (t !== null && bn(e, null), Ki(), ha());
        return $t(t, e, r, a), e.child;
      }
      function Gl(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function au(t, e, a, n, r) {
        var u = Bi();
        return u = u === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && bn(e, null), Ki(), ds(e), t !== null && ll(t, e, n, !0), e.childLanes = r, null;
      }
      function On(t, e) {
        return e = Hn(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function lu(t, e, a) {
        return La(e, t.child, null, a), t = On(
          e,
          e.pendingProps
        ), t.flags |= 2, me(e), e.memoizedState = null, t;
      }
      function Df(t, e, a) {
        var n = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (yt) {
            if (n.mode === "hidden")
              return t = On(e, n), e.lanes = 536870912, Gl(null, t);
            if (Xi(e), (t = At) ? (t = lp(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = tc(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw ut(e);
            return e.lanes = 536870912, null;
          }
          return On(e, n);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var f = u.dehydrated;
          if (Xi(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = lu(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (Yt || ll(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Yt || r) {
            if (n = Tt, n !== null && (f = I(n, a), f !== 0 && f !== u.retryLane))
              throw u.retryLane = f, Ua(t, f), se(n, t, f), so;
            Gn(), e = lu(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ne && (At = $m(f), te = e, yt = !0, _a = null, Te = !1, t !== null && $(e, t)), e = On(e, n), e.flags |= 4096;
          return e;
        }
        return t = Pe(t.child, {
          mode: n.mode,
          children: n.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Rn(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(c(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function ur(t, e, a, n, r) {
        return Ha(e), a = Ji(
          t,
          e,
          a,
          n,
          void 0,
          r
        ), n = Li(), t !== null && !Yt ? (Wi(t, e, r), Fe(t, e, r)) : (yt && n && G(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function nu(t, e, a, n, r, u) {
        return Ha(e), e.updateQueue = null, a = ms(
          e,
          n,
          a,
          r
        ), fs(t), n = Li(), t !== null && !Yt ? (Wi(t, e, u), Fe(t, e, u)) : (yt && n && G(e), e.flags |= 1, $t(t, e, a, u), e.child);
      }
      function iu(t, e, a, n, r) {
        if (Ha(e), e.stateNode === null) {
          var u = pl, f = a.contextType;
          typeof f == "object" && f !== null && (u = It(f)), u = new a(n, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = oo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = n, u.state = e.memoizedState, u.refs = {}, Yi(e), f = a.contextType, u.context = typeof f == "object" && f !== null ? It(f) : pl, u.state = e.memoizedState, f = a.getDerivedStateFromProps, typeof f == "function" && (or(
            e,
            a,
            f,
            n
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (f = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), f !== u.state && oo.enqueueReplaceState(
            u,
            u.state,
            null
          ), Bl(e, n, u, r), Ul(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), n = !0;
        } else if (t === null) {
          u = e.stateNode;
          var v = e.memoizedProps, O = Ba(a, v);
          u.props = O;
          var Q = u.context, Z = a.contextType;
          f = pl, typeof Z == "object" && Z !== null && (f = It(Z));
          var V = a.getDerivedStateFromProps;
          Z = typeof V == "function" || typeof u.getSnapshotBeforeUpdate == "function", v = e.pendingProps !== v, Z || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (v || Q !== f) && Ls(
            e,
            u,
            n,
            f
          ), Sa = !1;
          var J = e.memoizedState;
          u.state = J, Bl(e, n, u, r), Ul(), Q = e.memoizedState, v || J !== Q || Sa ? (typeof V == "function" && (or(
            e,
            a,
            V,
            n
          ), Q = e.memoizedState), (O = Sa || Js(
            e,
            a,
            O,
            n,
            J,
            Q,
            f
          )) ? (Z || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = n, e.memoizedState = Q), u.props = n, u.state = Q, u.context = f, n = O) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), n = !1);
        } else {
          u = e.stateNode, Gi(t, e), f = e.memoizedProps, Z = Ba(a, f), u.props = Z, V = e.pendingProps, J = u.context, Q = a.contextType, O = pl, typeof Q == "object" && Q !== null && (O = It(Q)), v = a.getDerivedStateFromProps, (Q = typeof v == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (f !== V || J !== O) && Ls(
            e,
            u,
            n,
            O
          ), Sa = !1, J = e.memoizedState, u.state = J, Bl(e, n, u, r), Ul();
          var ct = e.memoizedState;
          f !== V || J !== ct || Sa || t !== null && t.dependencies !== null && hn(t.dependencies) ? (typeof v == "function" && (or(
            e,
            a,
            v,
            n
          ), ct = e.memoizedState), (Z = Sa || Js(
            e,
            a,
            Z,
            n,
            J,
            ct,
            O
          ) || t !== null && t.dependencies !== null && hn(t.dependencies)) ? (Q || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(n, ct, O), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            n,
            ct,
            O
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && J === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && J === t.memoizedState || (e.flags |= 1024), e.memoizedProps = n, e.memoizedState = ct), u.props = n, u.state = ct, u.context = O, n = Z) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && J === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && J === t.memoizedState || (e.flags |= 1024), n = !1);
        }
        return u = n, Rn(t, e), n = (e.flags & 128) !== 0, u || n ? (u = e.stateNode, a = n && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && n ? (e.child = La(
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
      function ru(t, e, a, n) {
        return Re(), e.flags |= 256, $t(t, e, a, n), e.child;
      }
      function cr(t) {
        return { baseLanes: t, cachePool: es() };
      }
      function dr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= we), t;
      }
      function ou(t, e, a) {
        var n = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, f;
        if ((f = u) || (f = t !== null && t.memoizedState === null ? !1 : (Bt.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (yt) {
            if (r ? pa(e) : ha(), (t = At) ? (t = np(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = tc(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw ut(e);
            return Zr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var v = n.children;
          return n = n.fallback, r ? (ha(), r = e.mode, v = Hn(
            { mode: "hidden", children: v },
            r
          ), n = Ga(
            n,
            r,
            a,
            null
          ), v.return = e, n.return = e, v.sibling = n, e.child = v, n = e.child, n.memoizedState = cr(a), n.childLanes = dr(
            t,
            f,
            a
          ), e.memoizedState = uo, Gl(null, n)) : (pa(e), fr(e, v));
        }
        var O = t.memoizedState;
        if (O !== null && (v = O.dehydrated, v !== null)) {
          if (u)
            e.flags & 256 ? (pa(e), e.flags &= -257, e = mr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ha(), e.child = t.child, e.flags |= 128, e = null) : (ha(), v = n.fallback, r = e.mode, n = Hn(
              { mode: "visible", children: n.children },
              r
            ), v = Ga(
              v,
              r,
              a,
              null
            ), v.flags |= 2, n.return = e, v.return = e, n.sibling = v, e.child = n, La(
              e,
              t.child,
              null,
              a
            ), n = e.child, n.memoizedState = cr(a), n.childLanes = dr(
              t,
              f,
              a
            ), e.memoizedState = uo, e = Gl(null, n));
          else if (pa(e), Zr(v))
            f = Xm(v).digest, n = Error(c(419)), n.stack = "", n.digest = f, Ol({ value: n, source: null, stack: null }), e = mr(
              t,
              e,
              a
            );
          else if (Yt || ll(
            t,
            e,
            a,
            !1
          ), f = (a & t.childLanes) !== 0, Yt || f) {
            if (f = Tt, f !== null && (n = I(
              f,
              a
            ), n !== 0 && n !== O.retryLane))
              throw O.retryLane = n, Ua(t, n), se(f, t, n), so;
            Xr(v) || Gn(), e = mr(
              t,
              e,
              a
            );
          } else
            Xr(v) ? (e.flags |= 192, e.child = t.child, e = null) : (t = O.treeContext, ne && (At = Pm(
              v
            ), te = e, yt = !0, _a = null, Te = !1, t !== null && $(e, t)), e = fr(
              e,
              n.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ha(), v = n.fallback, r = e.mode, O = t.child, u = O.sibling, n = Pe(O, {
          mode: "hidden",
          children: n.children
        }), n.subtreeFlags = O.subtreeFlags & 65011712, u !== null ? v = Pe(
          u,
          v
        ) : (v = Ga(
          v,
          r,
          a,
          null
        ), v.flags |= 2), v.return = e, n.return = e, n.sibling = v, e.child = n, Gl(null, n), n = e.child, v = t.child.memoizedState, v === null ? v = cr(a) : (r = v.cachePool, r !== null ? (O = ta ? Ot._currentValue : Ot._currentValue2, r = r.parent !== O ? { parent: O, pool: O } : r) : r = es(), v = {
          baseLanes: v.baseLanes | a,
          cachePool: r
        }), n.memoizedState = v, n.childLanes = dr(
          t,
          f,
          a
        ), e.memoizedState = uo, Gl(t.child, n)) : (pa(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: n.children
        }), a.return = e, a.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function fr(t, e) {
        return e = Hn(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Hn(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function mr(t, e, a) {
        return La(e, t.child, null, a), t = fr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function su(t, e, a) {
        t.lanes |= e;
        var n = t.alternate;
        n !== null && (n.lanes |= e), Ri(t.return, e, a);
      }
      function pr(t, e, a, n, r, u) {
        var f = t.memoizedState;
        f === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: n,
          tail: a,
          tailMode: r,
          treeForkCount: u
        } : (f.isBackwards = e, f.rendering = null, f.renderingStartTime = 0, f.last = n, f.tail = a, f.tailMode = r, f.treeForkCount = u);
      }
      function uu(t, e, a) {
        var n = e.pendingProps, r = n.revealOrder, u = n.tail;
        n = n.children;
        var f = Bt.current, v = (f & 2) !== 0;
        if (v ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, z(Bt, f), $t(t, e, n, a), n = yt ? $l : 0, !v && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && su(t, a, e);
            else if (t.tag === 19)
              su(t, a, e);
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
              t = a.alternate, t !== null && En(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), pr(
              e,
              !1,
              r,
              a,
              u,
              n
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && En(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            pr(
              e,
              !0,
              a,
              null,
              u,
              n
            );
            break;
          case "together":
            pr(
              e,
              !1,
              null,
              null,
              void 0,
              n
            );
            break;
          default:
            e.memoizedState = null;
        }
        return e.child;
      }
      function Fe(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), Ea |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (ll(
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
      function hr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && hn(t)));
      }
      function Uf(t, e, a) {
        switch (e.tag) {
          case 3:
            P(
              e,
              e.stateNode.containerInfo
            ), da(e, Ot, t.memoizedState.cache), Re();
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
              return e.flags |= 128, Xi(e), null;
            break;
          case 13:
            var n = e.memoizedState;
            if (n !== null)
              return n.dehydrated !== null ? (pa(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? ou(
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
            if (n = (a & e.childLanes) !== 0, n || (ll(
              t,
              e,
              a,
              !1
            ), n = (a & e.childLanes) !== 0), r) {
              if (n)
                return uu(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), z(Bt, Bt.current), n) break;
            return null;
          case 22:
            return e.lanes = 0, eu(
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
      function cu(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Yt = !0;
          else {
            if (!hr(t, a) && (e.flags & 128) === 0)
              return Yt = !1, Uf(
                t,
                e,
                a
              );
            Yt = (t.flags & 131072) !== 0;
          }
        else
          Yt = !1, yt && (e.flags & 1048576) !== 0 && g(e, $l, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var n = e.pendingProps;
              if (t = Da(e.elementType), e.type = t, typeof t == "function")
                Ar(t) ? (n = Ba(t, n), e.tag = 1, e = iu(
                  null,
                  e,
                  t,
                  n,
                  a
                )) : (e.tag = 0, e = ur(
                  null,
                  e,
                  t,
                  n,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Br) {
                    e.tag = 11, e = $s(
                      null,
                      e,
                      t,
                      n,
                      a
                    );
                    break t;
                  } else if (r === Gr) {
                    e.tag = 14, e = Ps(
                      null,
                      e,
                      t,
                      n,
                      a
                    );
                    break t;
                  }
                }
                throw e = A(t) || t, Error(c(306, e, ""));
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
            return n = e.type, r = Ba(
              n,
              e.pendingProps
            ), iu(
              t,
              e,
              n,
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
              r = e.memoizedState, n = r.element, Gi(t, e), Bl(e, u, null, a);
              var f = e.memoizedState;
              if (u = f.cache, da(e, Ot, u), u !== r.cache && Hi(
                e,
                [Ot],
                a,
                !0
              ), Ul(), u = f.element, ne && r.isDehydrated)
                if (r = {
                  element: u,
                  isDehydrated: !1,
                  cache: f.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = ru(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== n) {
                  n = D(
                    Error(c(424)),
                    e
                  ), Ol(n), e = ru(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ne && (At = Im(
                    e.stateNode.containerInfo
                  ), te = e, yt = !0, _a = null, Te = !0), a = Uc(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Re(), u === n) {
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
            if (Be)
              return Rn(t, e), t === null ? (a = Sc(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : yt || (e.stateNode = zp(
                e.type,
                e.pendingProps,
                wa.current,
                e
              )) : e.memoizedState = Sc(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return xt(e), t === null && Vt && yt && (n = e.stateNode = Cc(
                e.type,
                e.pendingProps,
                wa.current,
                Pt.current,
                !1
              ), te = e, Te = !0, At = tp(
                e.type,
                n,
                At
              )), $t(
                t,
                e,
                e.pendingProps.children,
                a
              ), Rn(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && yt && (wp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = n = At) && (n = ep(
              n,
              e.type,
              e.pendingProps,
              Te
            ), n !== null ? (e.stateNode = n, te = e, At = Fm(n), Te = !1, r = !0) : r = !1), r || ut(e)), xt(e), r = e.type, u = e.pendingProps, f = t !== null ? t.memoizedProps : null, n = u.children, Zn(r, u) ? n = null : f !== null && Zn(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = Ji(
              t,
              e,
              Cf,
              null,
              null,
              a
            ), ta ? Ka._currentValue = r : Ka._currentValue2 = r), Rn(t, e), $t(t, e, n, a), e.child;
          case 6:
            return t === null && yt && (_p(
              e.pendingProps,
              Pt.current
            ), (t = a = At) && (a = ap(
              a,
              e.pendingProps,
              Te
            ), a !== null ? (e.stateNode = a, te = e, At = null, t = !0) : t = !1), t || ut(e)), null;
          case 13:
            return ou(t, e, a);
          case 4:
            return P(
              e,
              e.stateNode.containerInfo
            ), n = e.pendingProps, t === null ? e.child = La(
              e,
              null,
              n,
              a
            ) : $t(t, e, n, a), e.child;
          case 11:
            return $s(
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
            return n = e.pendingProps, da(e, e.type, n.value), $t(
              t,
              e,
              n.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, n = e.pendingProps.children, Ha(e), r = It(r), n = n(r), e.flags |= 1, $t(t, e, n, a), e.child;
          case 14:
            return Ps(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return tu(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return uu(
              t,
              e,
              a
            );
          case 31:
            return Df(t, e, a);
          case 22:
            return eu(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ha(e), n = It(Ot), t === null ? (r = Bi(), r === null && (r = Tt, u = Di(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: n,
              cache: r
            }, Yi(e), da(e, Ot, r)) : ((t.lanes & a) !== 0 && (Gi(t, e), Bl(e, null, null, a), Ul()), r = t.memoizedState, u = e.memoizedState, r.parent !== n ? (r = { parent: n, cache: n }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), da(e, Ot, n)) : (n = u.cache, da(e, Ot, n), n !== r.cache && Hi(
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
      function He(t) {
        t.flags |= 4;
      }
      function Dn(t) {
        Ke && (t.flags |= 8);
      }
      function du(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function gr(t, e, a, n) {
        if (le)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Kr(t, a.stateNode);
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
              a && n && (u = bc(
                u,
                r.type,
                r.memoizedProps
              )), Kr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && n && (u = yc(
                u,
                r.memoizedProps
              )), Kr(t, u);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                u = r.child, u !== null && (u.return = r), gr(t, r, !0, !0);
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
      function fu(t, e, a, n) {
        var r = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var f = u.stateNode;
              a && n && (f = bc(
                f,
                u.type,
                u.memoizedProps
              )), gc(t, f);
            } else if (u.tag === 6)
              f = u.stateNode, a && n && (f = yc(
                f,
                u.memoizedProps
              )), gc(t, f);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), fu(t, u, !0, !0), r = !0;
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
      function mu(t, e) {
        if (Ke && du(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, n = hc();
          fu(n, e, !1, !1), t.pendingChildren = n, He(e), Vm(a, n);
        }
      }
      function vr(t, e, a, n) {
        if (le)
          t.memoizedProps !== n && He(e);
        else if (Ke) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = du(t, e)) || u !== n) {
            var f = Pt.current;
            u = Km(
              r,
              a,
              u,
              n,
              !t,
              null
            ), u === r ? e.stateNode = r : (Dn(e), cc(
              u,
              a,
              n,
              f
            ) && He(e), e.stateNode = u, t && gr(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function br(t, e, a, n, r) {
        if ((t.mode & 32) !== 0 && (a === null ? gm(e, n) : vm(e, a, n))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Vr(e, n))
            if (fc(t.stateNode, e, n))
              t.flags |= 8192;
            else if (qu()) t.flags |= 8192;
            else
              throw Ja = li, lo;
        } else t.flags &= -16777217;
      }
      function pu(t, e) {
        if (kp(e)) {
          if (t.flags |= 16777216, !Tc(e))
            if (qu()) t.flags |= 8192;
            else
              throw Ja = li, lo;
        } else t.flags &= -16777217;
      }
      function Un(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? U() : 536870912, t.lanes |= e, Tl |= e);
      }
      function Ql(t, e) {
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
              for (var n = null; a !== null; )
                a.alternate !== null && (n = a), a = a.sibling;
              n === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : n.sibling = null;
          }
      }
      function Ct(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, n = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, n |= r.subtreeFlags & 65011712, n |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, n |= r.subtreeFlags, n |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= n, t.childLanes = a, e;
      }
      function Bf(t, e, a) {
        var n = e.pendingProps;
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
            return a = e.stateNode, n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), Le(Ot), lt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Oe(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ca())), mu(t, e), Ct(e), null;
          case 26:
            if (Be) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (Ct(e), pu(
                e,
                u
              )) : (Ct(e), br(
                e,
                r,
                null,
                n,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), Ct(e), pu(
                e,
                u
              )) : (Ct(e), e.flags &= -16777217) : (u = t.memoizedProps, le ? u !== n && He(e) : vr(
                t,
                e,
                r,
                n
              ), Ct(e), br(
                e,
                r,
                u,
                n,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Jt(e), a = wa.current, r = e.type, t !== null && e.stateNode != null)
                le ? t.memoizedProps !== n && He(e) : vr(t, e, r, n);
              else {
                if (!n) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return Ct(e), null;
                }
                t = Pt.current, Oe(e) ? Oa(e, t) : (t = Cc(
                  r,
                  n,
                  a,
                  t,
                  !0
                ), e.stateNode = t, He(e));
              }
              return Ct(e), null;
            }
          case 5:
            if (Jt(e), r = e.type, t !== null && e.stateNode != null)
              vr(t, e, r, n);
            else {
              if (!n) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return Ct(e), null;
              }
              if (u = Pt.current, Oe(e))
                Oa(e, u), hp(
                  e.stateNode,
                  r,
                  n,
                  u
                ) && (e.flags |= 64);
              else {
                var f = sm(
                  r,
                  n,
                  wa.current,
                  u,
                  e
                );
                Dn(e), gr(f, e, !1, !1), e.stateNode = f, cc(
                  f,
                  r,
                  n,
                  u
                ) && He(e);
              }
            }
            return Ct(e), br(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, le ? a !== n && He(e) : Ke && (a !== n ? (t = wa.current, a = Pt.current, Dn(e), e.stateNode = dc(
                n,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof n != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = wa.current, a = Pt.current, Oe(e)) {
                if (!ne) throw Error(c(176));
                if (t = e.stateNode, a = e.memoizedProps, n = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      n = r.memoizedProps;
                  }
                rp(
                  t,
                  a,
                  e,
                  n
                ) || ut(e, !0);
              } else
                Dn(e), e.stateNode = dc(
                  n,
                  t,
                  a,
                  e
                );
            }
            return Ct(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (n = Oe(e), a !== null) {
                if (t === null) {
                  if (!n) throw Error(c(318));
                  if (!ne) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  op(t, e);
                } else
                  Re(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ct(e), t = !1;
              } else
                a = ca(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (me(e), e) : (me(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return Ct(e), null;
          case 13:
            if (n = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Oe(e), n !== null && n.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!ne) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  sp(r, e);
                } else
                  Re(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ct(e), r = !1;
              } else
                r = ca(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (me(e), e) : (me(e), null);
            }
            return me(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = n !== null, t = t !== null && t.memoizedState !== null, a && (n = e.child, r = null, n.alternate !== null && n.alternate.memoizedState !== null && n.alternate.memoizedState.cachePool !== null && (r = n.alternate.memoizedState.cachePool.pool), u = null, n.memoizedState !== null && n.memoizedState.cachePool !== null && (u = n.memoizedState.cachePool.pool), u !== r && (n.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Un(e, e.updateQueue), Ct(e), null);
          case 4:
            return lt(), mu(t, e), t === null && fm(e.stateNode.containerInfo), Ct(e), null;
          case 10:
            return Le(e.type), Ct(e), null;
          case 19:
            if (y(Bt), n = e.memoizedState, n === null) return Ct(e), null;
            if (r = (e.flags & 128) !== 0, u = n.rendering, u === null)
              if (r) Ql(n, !1);
              else {
                if (Dt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = En(t), u !== null) {
                      for (e.flags |= 128, Ql(n, !1), t = u.updateQueue, e.updateQueue = t, Un(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Pu(a, t), a = a.sibling;
                      return z(
                        Bt,
                        Bt.current & 1 | 2
                      ), yt && B(e, n.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                n.tail !== null && ue() > on && (e.flags |= 128, r = !0, Ql(n, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = En(u), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Un(e, t), Ql(n, !0), n.tail === null && n.tailMode === "hidden" && !u.alternate && !yt)
                    return Ct(e), null;
                } else
                  2 * ue() - n.renderingStartTime > on && a !== 536870912 && (e.flags |= 128, r = !0, Ql(n, !1), e.lanes = 4194304);
              n.isBackwards ? (u.sibling = e.child, e.child = u) : (t = n.last, t !== null ? t.sibling = u : e.child = u, n.last = u);
            }
            return n.tail !== null ? (t = n.tail, n.rendering = t, n.tail = t.sibling, n.renderingStartTime = ue(), t.sibling = null, a = Bt.current, z(
              Bt,
              r ? a & 1 | 2 : a & 1
            ), yt && B(e, n.treeForkCount), t) : (Ct(e), null);
          case 22:
          case 23:
            return me(e), Vi(), n = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== n && (e.flags |= 8192) : n && (e.flags |= 8192), n ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Ct(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ct(e), a = e.updateQueue, a !== null && Un(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), n = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), n !== a && (e.flags |= 2048), t !== null && y(Za), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(Ot), Ct(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function qf(t, e) {
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
              if (me(e), e.alternate === null)
                throw Error(c(340));
              Re();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (me(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(c(340));
              Re();
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
            return me(e), Vi(), t !== null && y(Za), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(Ot), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function hu(t, e) {
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
            e.memoizedState !== null && me(e);
            break;
          case 13:
            me(e);
            break;
          case 19:
            y(Bt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            me(e), Vi(), t !== null && y(Za);
            break;
          case 24:
            Le(Ot);
        }
      }
      function Kl(t, e) {
        try {
          var a = e.updateQueue, n = a !== null ? a.lastEffect : null;
          if (n !== null) {
            var r = n.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                n = void 0;
                var u = a.create, f = a.inst;
                n = u(), f.destroy = n;
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
          var n = e.updateQueue, r = n !== null ? n.lastEffect : null;
          if (r !== null) {
            var u = r.next;
            n = u;
            do {
              if ((n.tag & t) === t) {
                var f = n.inst, v = f.destroy;
                if (v !== void 0) {
                  f.destroy = void 0, r = e;
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
              n = n.next;
            } while (n !== u);
          }
        } catch (Z) {
          wt(e, e.return, Z);
        }
      }
      function gu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            us(e, a);
          } catch (n) {
            wt(t, t.return, n);
          }
        }
      }
      function vu(t, e, a) {
        a.props = Ba(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (n) {
          wt(t, e, n);
        }
      }
      function Vl(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var n = Ll(t.stateNode);
                break;
              case 30:
                n = t.stateNode;
                break;
              default:
                n = t.stateNode;
            }
            typeof a == "function" ? t.refCleanup = a(n) : a.current = n;
          }
        } catch (r) {
          wt(t, e, r);
        }
      }
      function Qe(t, e) {
        var a = t.ref, n = t.refCleanup;
        if (a !== null)
          if (typeof n == "function")
            try {
              n();
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
      function bu(t) {
        var e = t.type, a = t.memoizedProps, n = t.stateNode;
        try {
          Am(n, e, a, t);
        } catch (r) {
          wt(t, t.return, r);
        }
      }
      function yr(t, e, a) {
        try {
          Om(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (n) {
          wt(t, t.return, n);
        }
      }
      function yu(t) {
        return t.tag === 5 || t.tag === 3 || (Be ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && fl(t.type) : !1) || t.tag === 4;
      }
      function xr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || yu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && fl(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function wr(t, e, a) {
        var n = t.tag;
        if (n === 5 || n === 6)
          t = t.stateNode, e ? Hm(a, t, e) : jm(a, t);
        else if (n !== 4 && (Vt && n === 27 && fl(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (wr(t, e, a), t = t.sibling; t !== null; )
            wr(t, e, a), t = t.sibling;
      }
      function Bn(t, e, a) {
        var n = t.tag;
        if (n === 5 || n === 6)
          t = t.stateNode, e ? Rm(a, t, e) : Cm(a, t);
        else if (n !== 4 && (Vt && n === 27 && fl(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Bn(t, e, a), t = t.sibling; t !== null; )
            Bn(t, e, a), t = t.sibling;
      }
      function xu(t, e, a) {
        t = t.containerInfo;
        try {
          vc(t, a);
        } catch (n) {
          wt(e, e.return, n);
        }
      }
      function wu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Tp(
            t.type,
            a,
            e,
            t
          );
        } catch (n) {
          wt(t, t.return, n);
        }
      }
      function Yf(t, e) {
        for (rm(t.containerInfo), Wt = e; Wt !== null; )
          if (t = Wt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Wt = e;
          else
            for (; Wt !== null; ) {
              t = Wt;
              var a = t.alternate;
              switch (e = t.flags, t.tag) {
                case 0:
                  if ((e & 4) !== 0 && (e = t.updateQueue, e = e !== null ? e.events : null, e !== null))
                    for (var n = 0; n < e.length; n++) {
                      var r = e[n];
                      r.ref.impl = r.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((e & 1024) !== 0 && a !== null) {
                    e = void 0, n = t, r = a.memoizedProps, a = a.memoizedState;
                    var u = n.stateNode;
                    try {
                      var f = Ba(
                        n.type,
                        r
                      );
                      e = u.getSnapshotBeforeUpdate(
                        f,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (v) {
                      wt(n, n.return, v);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && le && Qm(t.stateNode.containerInfo);
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
      function _u(t, e, a) {
        var n = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Ie(t, a), n & 4 && Kl(5, a);
            break;
          case 1:
            if (Ie(t, a), n & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (f) {
                  wt(a, a.return, f);
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
                } catch (f) {
                  wt(
                    a,
                    a.return,
                    f
                  );
                }
              }
            n & 64 && gu(a), n & 512 && Vl(a, a.return);
            break;
          case 3:
            if (Ie(t, a), n & 64 && (n = a.updateQueue, n !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Ll(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                us(n, t);
              } catch (f) {
                wt(a, a.return, f);
              }
            }
            break;
          case 27:
            Vt && e === null && n & 4 && wu(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (n & 4) bu(a);
              else if (n & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  dp(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (f) {
                  wt(a, a.return, f);
                }
              }
            }
            n & 512 && Vl(a, a.return);
            break;
          case 12:
            Ie(t, a);
            break;
          case 31:
            Ie(t, a), n & 4 && zu(t, a);
            break;
          case 13:
            Ie(t, a), n & 4 && Eu(t, a), n & 64 && (n = a.memoizedState, n !== null && (n = n.dehydrated, n !== null && (a = Jf.bind(
              null,
              a
            ), Zm(n, a))));
            break;
          case 22:
            if (n = a.memoizedState !== null || na, !n) {
              e = e !== null && e.memoizedState !== null || Gt, r = na;
              var u = Gt;
              na = n, (Gt = e) && !u ? $e(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Ie(t, a), na = r, Gt = u;
            }
            break;
          case 30:
            break;
          default:
            Ie(t, a);
        }
      }
      function Su(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Su(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && hm(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function De(t, e, a) {
        for (a = a.child; a !== null; )
          _r(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function _r(t, e, a) {
        if (ve && typeof ve.onCommitFiberUnmount == "function")
          try {
            ve.onCommitFiberUnmount(Il, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Be) {
              Gt || Qe(a, e), De(
                t,
                e,
                a
              ), a.memoizedState ? Ec(a.memoizedState) : a.stateNode && Nc(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Gt || Qe(a, e);
              var n = Qt, r = ce;
              fl(a.type) && (Qt = a.stateNode, ce = !1), De(
                t,
                e,
                a
              ), jc(a.stateNode), Qt = n, ce = r;
              break;
            }
          case 5:
            Gt || Qe(a, e);
          case 6:
            if (le) {
              if (n = Qt, r = ce, Qt = null, De(
                t,
                e,
                a
              ), Qt = n, ce = r, Qt !== null)
                if (ce)
                  try {
                    Um(Qt, a.stateNode);
                  } catch (u) {
                    wt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Dm(Qt, a.stateNode);
                  } catch (u) {
                    wt(
                      a,
                      e,
                      u
                    );
                  }
            } else
              De(
                t,
                e,
                a
              );
            break;
          case 18:
            le && Qt !== null && (ce ? bp(
              Qt,
              a.stateNode
            ) : vp(Qt, a.stateNode));
            break;
          case 4:
            le ? (n = Qt, r = ce, Qt = a.stateNode.containerInfo, ce = !0, De(
              t,
              e,
              a
            ), Qt = n, ce = r) : (Ke && xu(
              a.stateNode,
              a,
              hc()
            ), De(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            ga(2, a, e), Gt || ga(4, a, e), De(
              t,
              e,
              a
            );
            break;
          case 1:
            Gt || (Qe(a, e), n = a.stateNode, typeof n.componentWillUnmount == "function" && vu(
              a,
              e,
              n
            )), De(
              t,
              e,
              a
            );
            break;
          case 21:
            De(
              t,
              e,
              a
            );
            break;
          case 22:
            Gt = (n = Gt) || a.memoizedState !== null, De(
              t,
              e,
              a
            ), Gt = n;
            break;
          default:
            De(
              t,
              e,
              a
            );
        }
      }
      function zu(t, e) {
        if (ne && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            mp(t);
          } catch (a) {
            wt(e, e.return, a);
          }
        }
      }
      function Eu(t, e) {
        if (ne && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            pp(t);
          } catch (a) {
            wt(e, e.return, a);
          }
      }
      function Gf(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Yc()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Yc()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function qn(t, e) {
        var a = Gf(t);
        e.forEach(function(n) {
          if (!a.has(n)) {
            a.add(n);
            var r = Lf.bind(null, t, n);
            n.then(r, r);
          }
        });
      }
      function ae(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var n = 0; n < a.length; n++) {
            var r = a[n], u = t, f = e;
            if (le) {
              var v = f;
              t: for (; v !== null; ) {
                switch (v.tag) {
                  case 27:
                    if (Vt) {
                      if (fl(v.type)) {
                        Qt = v.stateNode, ce = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = v.stateNode, ce = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = v.stateNode.containerInfo, ce = !0;
                    break t;
                }
                v = v.return;
              }
              if (Qt === null) throw Error(c(160));
              _r(u, f, r), Qt = null, ce = !1;
            } else _r(u, f, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            ku(e, t), e = e.sibling;
      }
      function ku(t, e) {
        var a = t.alternate, n = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ae(e, t), oe(t), n & 4 && (ga(3, t, t.return), Kl(3, t), ga(5, t, t.return));
            break;
          case 1:
            ae(e, t), oe(t), n & 512 && (Gt || a === null || Qe(a, a.return)), n & 64 && na && (t = t.updateQueue, t !== null && (n = t.callbacks, n !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? n : a.concat(n))));
            break;
          case 26:
            if (Be) {
              var r = qe;
              if (ae(e, t), oe(t), n & 512 && (Gt || a === null || Qe(a, a.return)), n & 4) {
                n = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Sp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : kc(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = zc(
                  r,
                  u,
                  t.memoizedProps
                ) : n !== u ? (n === null ? a.stateNode !== null && Nc(a.stateNode) : Ec(n), u === null ? kc(
                  r,
                  t.type,
                  t.stateNode
                ) : zc(
                  r,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && yr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ae(e, t), oe(t), n & 512 && (Gt || a === null || Qe(a, a.return)), a !== null && n & 4 && yr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ae(e, t), oe(t), n & 512 && (Gt || a === null || Qe(a, a.return)), le) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  pc(r);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
              n & 4 && t.stateNode != null && (r = t.memoizedProps, yr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), n & 1024 && (co = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ae(e, t), oe(t), n & 4 && le) {
              if (t.stateNode === null)
                throw Error(c(162));
              n = t.memoizedProps, a = a !== null ? a.memoizedProps : n, r = t.stateNode;
              try {
                Mm(r, a, n);
              } catch (V) {
                wt(t, t.return, V);
              }
            }
            break;
          case 3:
            if (Be ? (Ep(), r = qe, qe = Jr(e.containerInfo), ae(e, t), qe = r) : ae(e, t), oe(t), n & 4) {
              if (le && ne && a !== null && a.memoizedState.isDehydrated)
                try {
                  fp(e.containerInfo);
                } catch (V) {
                  wt(t, t.return, V);
                }
              if (Ke) {
                n = e.containerInfo, a = e.pendingChildren;
                try {
                  vc(n, a);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
            }
            co && (co = !1, Nu(t));
            break;
          case 4:
            Be ? (a = qe, qe = Jr(
              t.stateNode.containerInfo
            ), ae(e, t), oe(t), qe = a) : (ae(e, t), oe(t)), n & 4 && Ke && xu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ae(e, t), oe(t);
            break;
          case 31:
            ae(e, t), oe(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, qn(t, n)));
            break;
          case 13:
            ae(e, t), oe(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (fi = ue()), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, qn(t, n)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = a !== null && a.memoizedState !== null, v = na, O = Gt;
            if (na = v || r, Gt = O || f, ae(e, t), Gt = O, na = v, oe(t), n & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || f || na || Gt || qa(t)), le)) {
              t: if (a = null, le)
                for (e = t; ; ) {
                  if (e.tag === 5 || Be && e.tag === 26) {
                    if (a === null) {
                      f = a = e;
                      try {
                        u = f.stateNode, r ? Bm(u) : Ym(
                          f.stateNode,
                          f.memoizedProps
                        );
                      } catch (V) {
                        wt(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      f = e;
                      try {
                        var Q = f.stateNode;
                        r ? qm(Q) : Gm(Q, f.memoizedProps);
                      } catch (V) {
                        wt(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      f = e;
                      try {
                        var Z = f.stateNode;
                        r ? yp(Z) : xp(f.stateNode);
                      } catch (V) {
                        wt(f, f.return, V);
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
            n & 4 && (n = t.updateQueue, n !== null && (a = n.retryQueue, a !== null && (n.retryQueue = null, qn(t, a))));
            break;
          case 19:
            ae(e, t), oe(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, qn(t, n)));
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
            for (var a, n = t.return; n !== null; ) {
              if (yu(n)) {
                a = n;
                break;
              }
              n = n.return;
            }
            if (le) {
              if (a == null) throw Error(c(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, u = xr(t);
                    Bn(t, u, r);
                    break;
                  }
                case 5:
                  var f = a.stateNode;
                  a.flags & 32 && (pc(f), a.flags &= -33);
                  var v = xr(t);
                  Bn(t, v, f);
                  break;
                case 3:
                case 4:
                  var O = a.stateNode.containerInfo, Q = xr(t);
                  wr(
                    t,
                    Q,
                    O
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
      function Nu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Nu(e), e.tag === 5 && e.flags & 1024 && xm(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            _u(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && vu(
                e,
                e.return,
                a
              ), qa(e);
              break;
            case 27:
              Vt && jc(e.stateNode);
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
          var n = e.alternate, r = t, u = e, f = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              $e(
                r,
                u,
                a
              ), Kl(4, u);
              break;
            case 1:
              if ($e(
                r,
                u,
                a
              ), n = u, r = n.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (Q) {
                  wt(n, n.return, Q);
                }
              if (n = u, r = n.updateQueue, r !== null) {
                var v = n.stateNode;
                try {
                  var O = r.shared.hiddenCallbacks;
                  if (O !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < O.length; r++)
                      ss(O[r], v);
                } catch (Q) {
                  wt(n, n.return, Q);
                }
              }
              a && f & 64 && gu(u), Vl(u, u.return);
              break;
            case 27:
              Vt && wu(u);
            case 26:
            case 5:
              $e(
                r,
                u,
                a
              ), a && n === null && f & 4 && bu(u), Vl(u, u.return);
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
              ), a && f & 4 && zu(r, u);
              break;
            case 13:
              $e(
                r,
                u,
                a
              ), a && f & 4 && Eu(r, u);
              break;
            case 22:
              u.memoizedState === null && $e(
                r,
                u,
                a
              ), Vl(u, u.return);
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
      function Sr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Rl(a));
      }
      function zr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Rl(t));
      }
      function Ue(t, e, a, n) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Tu(
              t,
              e,
              a,
              n
            ), e = e.sibling;
      }
      function Tu(t, e, a, n) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Ue(
              t,
              e,
              a,
              n
            ), r & 2048 && Kl(9, e);
            break;
          case 1:
            Ue(
              t,
              e,
              a,
              n
            );
            break;
          case 3:
            Ue(
              t,
              e,
              a,
              n
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Rl(t)));
            break;
          case 12:
            if (r & 2048) {
              Ue(
                t,
                e,
                a,
                n
              ), t = e.stateNode;
              try {
                var u = e.memoizedProps, f = u.id, v = u.onPostCommit;
                typeof v == "function" && v(
                  f,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (O) {
                wt(e, e.return, O);
              }
            } else
              Ue(
                t,
                e,
                a,
                n
              );
            break;
          case 31:
            Ue(
              t,
              e,
              a,
              n
            );
            break;
          case 13:
            Ue(
              t,
              e,
              a,
              n
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, f = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ue(
              t,
              e,
              a,
              n
            ) : Xl(
              t,
              e
            ) : u._visibility & 2 ? Ue(
              t,
              e,
              a,
              n
            ) : (u._visibility |= 2, rl(
              t,
              e,
              a,
              n,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && Sr(f, e);
            break;
          case 24:
            Ue(
              t,
              e,
              a,
              n
            ), r & 2048 && zr(e.alternate, e);
            break;
          default:
            Ue(
              t,
              e,
              a,
              n
            );
        }
      }
      function rl(t, e, a, n, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, f = e, v = a, O = n, Q = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              rl(
                u,
                f,
                v,
                O,
                r
              ), Kl(8, f);
              break;
            case 23:
              break;
            case 22:
              var Z = f.stateNode;
              f.memoizedState !== null ? Z._visibility & 2 ? rl(
                u,
                f,
                v,
                O,
                r
              ) : Xl(
                u,
                f
              ) : (Z._visibility |= 2, rl(
                u,
                f,
                v,
                O,
                r
              )), r && Q & 2048 && Sr(
                f.alternate,
                f
              );
              break;
            case 24:
              rl(
                u,
                f,
                v,
                O,
                r
              ), r && Q & 2048 && zr(f.alternate, f);
              break;
            default:
              rl(
                u,
                f,
                v,
                O,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Xl(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, n = e, r = n.flags;
            switch (n.tag) {
              case 22:
                Xl(a, n), r & 2048 && Sr(
                  n.alternate,
                  n
                );
                break;
              case 24:
                Xl(a, n), r & 2048 && zr(
                  n.alternate,
                  n
                );
                break;
              default:
                Xl(a, n);
            }
            e = e.sibling;
          }
      }
      function Ya(t, e, a) {
        if (t.subtreeFlags & kl)
          for (t = t.child; t !== null; )
            Cu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Cu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ya(
              t,
              e,
              a
            ), t.flags & kl)
              if (t.memoizedState !== null)
                Np(
                  a,
                  qe,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var n = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Vr(r, t)) && mc(a, n, r, t);
              }
            break;
          case 5:
            Ya(
              t,
              e,
              a
            ), t.flags & kl && (n = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Vr(r, t)) && mc(a, n, r, t));
            break;
          case 3:
          case 4:
            Be ? (n = qe, qe = Jr(
              t.stateNode.containerInfo
            ), Ya(
              t,
              e,
              a
            ), qe = n) : Ya(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (n = t.alternate, n !== null && n.memoizedState !== null ? (n = kl, kl = 16777216, Ya(
              t,
              e,
              a
            ), kl = n) : Ya(
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
      function ju(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Zl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var n = e[a];
              Wt = n, Au(
                n,
                t
              );
            }
          ju(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Mu(t), t = t.sibling;
      }
      function Mu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Zl(t), t.flags & 2048 && ga(9, t, t.return);
            break;
          case 3:
            Zl(t);
            break;
          case 12:
            Zl(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Yn(t)) : Zl(t);
            break;
          default:
            Zl(t);
        }
      }
      function Yn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var n = e[a];
              Wt = n, Au(
                n,
                t
              );
            }
          ju(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ga(8, e, e.return), Yn(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Yn(e));
              break;
            default:
              Yn(e);
          }
          t = t.sibling;
        }
      }
      function Au(t, e) {
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
                var n = a.memoizedState.cachePool.pool;
                n != null && n.refCount++;
              }
              break;
            case 24:
              Rl(a.memoizedState.cache);
          }
          if (n = a.child, n !== null) n.return = a, Wt = n;
          else
            t: for (a = t; Wt !== null; ) {
              n = Wt;
              var r = n.sibling, u = n.return;
              if (Su(n), n === a) {
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
      function Er(t) {
        var e = dm(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = Sm(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function kr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case oi:
            if (t.type === e.value) return !0;
            break;
          case si:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var n = t[a++], r = n.tag, u = t[a++], f = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !Fl(n)) {
                  for (; f != null && kr(n, f); )
                    u++, f = e[u];
                  if (u === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (n = n.child; n !== null; )
                      t.push(n, u), n = n.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ui:
            if ((a === 5 || a === 26 || a === 27) && km(t.stateNode, e.value))
              return !0;
            break;
          case di:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Em(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ci:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function Nr(t) {
        switch (t.$$typeof) {
          case oi:
            return "<" + (A(t.value) || "Unknown") + ">";
          case si:
            return ":has(" + (Nr(t) || "") + ")";
          case ui:
            return '[role="' + t.value + '"]';
          case di:
            return '"' + t.value + '"';
          case ci:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function Ou(t, e) {
        var a = [];
        t = [t, 0];
        for (var n = 0; n < t.length; ) {
          var r = t[n++], u = r.tag, f = t[n++], v = e[f];
          if (u !== 5 && u !== 26 && u !== 27 || !Fl(r)) {
            for (; v != null && kr(r, v); )
              f++, v = e[f];
            if (f === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return a;
      }
      function Tr(t, e) {
        if (!Wl) throw Error(c(363));
        t = Er(t), t = Ou(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var n = t[a++], r = n.tag;
          if (r === 5 || r === 26 || r === 27)
            Fl(n) || e.push(n.stateNode);
          else
            for (n = n.child; n !== null; )
              t.push(n), n = n.sibling;
        }
        return e;
      }
      function pe() {
        return (gt & 2) !== 0 && bt !== 0 ? bt & -bt : nt.T !== null ? Ui() : mm();
      }
      function Ru() {
        if (we === 0)
          if ((bt & 536870912) === 0 || yt) {
            var t = Ln;
            Ln <<= 1, (Ln & 3932160) === 0 && (Ln = 262144), we = t;
          } else we = 536870912;
        return t = ye.current, t !== null && (t.flags |= 32), we;
      }
      function se(t, e, a) {
        (t === Tt && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null) && (ol(t, 0), va(
          t,
          bt,
          we,
          !1
        )), C(t, a), ((gt & 2) === 0 || t !== Tt) && (t === Tt && ((gt & 2) === 0 && (Fa |= a), Dt === 4 && va(
          t,
          bt,
          we,
          !1
        )), Ge(t));
      }
      function Hu(t, e, a) {
        if ((gt & 6) !== 0) throw Error(c(327));
        var n = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || b(t, e), r = n ? Vf(t, e) : jr(t, e, !0), u = n;
        do {
          if (r === 0) {
            Nl && !n && va(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Qf(a)) {
              r = jr(t, e, !1), u = !1;
              continue;
            }
            if (r === 2) {
              if (u = e, t.errorRecoveryDisabledLanes & u)
                var f = 0;
              else
                f = t.pendingLanes & -536870913, f = f !== 0 ? f : f & 536870912 ? 536870912 : 0;
              if (f !== 0) {
                e = f;
                t: {
                  var v = t;
                  r = rn;
                  var O = ne && v.current.memoizedState.isDehydrated;
                  if (O && (ol(v, f).flags |= 256), f = jr(
                    v,
                    f,
                    !1
                  ), f !== 2) {
                    if (fo && !O) {
                      v.errorRecoveryDisabledLanes |= u, Fa |= u, r = 4;
                      break t;
                    }
                    u = de, de = r, u !== null && (de === null ? de = u : de.push.apply(
                      de,
                      u
                    ));
                  }
                  r = f;
                }
                if (u = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              ol(t, 0), va(t, e, 0, !0);
              break;
            }
            t: {
              switch (n = t, u = r, u) {
                case 0:
                case 1:
                  throw Error(c(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  va(
                    n,
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
                  throw Error(c(329));
              }
              if ((e & 62914560) === e && (r = fi + 300 - ue(), 10 < r)) {
                if (va(
                  n,
                  e,
                  we,
                  !za
                ), H(n, 0, !0) !== 0) break t;
                ra = e, n.timeoutHandle = um(
                  Du.bind(
                    null,
                    n,
                    a,
                    de,
                    mi,
                    po,
                    e,
                    we,
                    Fa,
                    Tl,
                    za,
                    u,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Du(
                n,
                a,
                de,
                mi,
                po,
                e,
                we,
                Fa,
                Tl,
                za,
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
      function Du(t, e, a, n, r, u, f, v, O, Q, Z, V, J, ct) {
        if (t.timeoutHandle = Qa, V = e.subtreeFlags, V & 8192 || (V & 16785408) === 16785408) {
          V = bm(), Cu(
            e,
            u,
            V
          );
          var ee = (u & 62914560) === u ? fi - ue() : (u & 4194048) === u ? Gc - ue() : 0;
          if (ee = ym(
            V,
            ee
          ), ee !== null) {
            ra = u, t.cancelPendingCommit = ee(
              Xu.bind(
                null,
                t,
                e,
                u,
                a,
                n,
                r,
                f,
                v,
                O,
                Z,
                V,
                null,
                J,
                ct
              )
            ), va(t, u, f, !Q);
            return;
          }
        }
        Xu(
          t,
          e,
          u,
          a,
          n,
          r,
          f,
          v,
          O
        );
      }
      function Qf(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var n = 0; n < a.length; n++) {
              var r = a[n], u = r.getSnapshot;
              r = r.value;
              try {
                if (!be(u(), r)) return !1;
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
      function va(t, e, a, n) {
        e &= ~mo, e &= ~Fa, t.suspendedLanes |= e, t.pingedLanes &= ~e, n && (t.warmLanes |= e), n = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - ge(r), f = 1 << u;
          n[u] = -1, r &= ~f;
        }
        a !== 0 && h(t, a, e);
      }
      function Uu() {
        return (gt & 6) === 0 ? (nl(0), !1) : !0;
      }
      function Cr() {
        if (vt !== null) {
          if (Et === 0)
            var t = vt.return;
          else
            t = vt, aa = Va = null, Fi(t), wl = null, en = 0, t = vt;
          for (; t !== null; )
            hu(t.alternate, t), t = t.return;
          vt = null;
        }
      }
      function ol(t, e) {
        var a = t.timeoutHandle;
        a !== Qa && (t.timeoutHandle = Qa, cm(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, Cr(), Tt = t, vt = a = Pe(t.current, null), bt = e, Et = 0, xe = null, za = !1, Nl = b(t, e), fo = !1, Tl = we = mo = Fa = Ea = Dt = 0, de = rn = null, po = !1, (e & 8) !== 0 && (e |= e & 32);
        var n = t.entangledLanes;
        if (n !== 0)
          for (t = t.entanglements, n &= e; 0 < n; ) {
            var r = 31 - ge(n), u = 1 << r;
            e |= t[r], n &= ~u;
          }
        return ia = e, _n(), a;
      }
      function Bu(t, e) {
        dt = null, nt.H = ln, e === xl || e === ai ? (e = ns(), Et = 3) : e === lo ? (e = ns(), Et = 4) : Et = e === so ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, xe = e, vt === null && (Dt = 1, An(
          t,
          D(e, t.current)
        ));
      }
      function qu() {
        var t = ye.current;
        return t === null ? !0 : (bt & 4194048) === bt ? je === null : (bt & 62914560) === bt || (bt & 536870912) !== 0 ? t === je : !1;
      }
      function Yu() {
        var t = nt.H;
        return nt.H = ln, t === null ? ln : t;
      }
      function Gu() {
        var t = nt.A;
        return nt.A = Qp, t;
      }
      function Gn() {
        Dt = 4, za || (bt & 4194048) !== bt && ye.current !== null || (Nl = !0), (Ea & 134217727) === 0 && (Fa & 134217727) === 0 || Tt === null || va(
          Tt,
          bt,
          we,
          !1
        );
      }
      function jr(t, e, a) {
        var n = gt;
        gt |= 2;
        var r = Yu(), u = Gu();
        (Tt !== t || bt !== e) && (mi = null, ol(t, e)), e = !1;
        var f = Dt;
        t: do
          try {
            if (Et !== 0 && vt !== null) {
              var v = vt, O = xe;
              switch (Et) {
                case 8:
                  Cr(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ye.current === null && (e = !0);
                  var Q = Et;
                  if (Et = 0, xe = null, sl(t, v, O, Q), a && Nl) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  Q = Et, Et = 0, xe = null, sl(t, v, O, Q);
              }
            }
            Kf(), f = Dt;
            break;
          } catch (Z) {
            Bu(t, Z);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Va = null, gt = n, nt.H = r, nt.A = u, vt === null && (Tt = null, bt = 0, _n()), f;
      }
      function Kf() {
        for (; vt !== null; ) Qu(vt);
      }
      function Vf(t, e) {
        var a = gt;
        gt |= 2;
        var n = Yu(), r = Gu();
        Tt !== t || bt !== e ? (mi = null, on = ue() + 500, ol(t, e)) : Nl = b(
          t,
          e
        );
        t: do
          try {
            if (Et !== 0 && vt !== null) {
              e = vt;
              var u = xe;
              e: switch (Et) {
                case 1:
                  Et = 0, xe = null, sl(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (as(u)) {
                    Et = 0, xe = null, Ku(e);
                    break;
                  }
                  e = function() {
                    Et !== 2 && Et !== 9 || Tt !== t || (Et = 7), Ge(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Et = 7;
                  break t;
                case 4:
                  Et = 5;
                  break t;
                case 7:
                  as(u) ? (Et = 0, xe = null, Ku(e)) : (Et = 0, xe = null, sl(t, e, u, 7));
                  break;
                case 5:
                  var f = null;
                  switch (vt.tag) {
                    case 26:
                      f = vt.memoizedState;
                    case 5:
                    case 27:
                      var v = vt, O = v.type, Q = v.pendingProps;
                      if (f ? Tc(f) : fc(v.stateNode, O, Q)) {
                        Et = 0, xe = null;
                        var Z = v.sibling;
                        if (Z !== null) vt = Z;
                        else {
                          var V = v.return;
                          V !== null ? (vt = V, Qn(V)) : vt = null;
                        }
                        break e;
                      }
                  }
                  Et = 0, xe = null, sl(t, e, u, 5);
                  break;
                case 6:
                  Et = 0, xe = null, sl(t, e, u, 6);
                  break;
                case 8:
                  Cr(), Dt = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            Xf();
            break;
          } catch (J) {
            Bu(t, J);
          }
        while (!0);
        return aa = Va = null, nt.H = n, nt.A = r, gt = a, vt !== null ? 0 : (Tt = null, bt = 0, _n(), Dt);
      }
      function Xf() {
        for (; vt !== null && !Mp(); )
          Qu(vt);
      }
      function Qu(t) {
        var e = cu(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Qn(t) : vt = e;
      }
      function Ku(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = nu(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              bt
            );
            break;
          case 11:
            e = nu(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              bt
            );
            break;
          case 5:
            Fi(e);
          default:
            hu(a, e), e = vt = Pu(e, ia), e = cu(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Qn(t) : vt = e;
      }
      function sl(t, e, a, n) {
        aa = Va = null, Fi(e), wl = null, en = 0;
        var r = e.return;
        try {
          if (Hf(
            t,
            r,
            e,
            a,
            bt
          )) {
            Dt = 1, An(
              t,
              D(a, t.current)
            ), vt = null;
            return;
          }
        } catch (u) {
          if (r !== null) throw vt = r, u;
          Dt = 1, An(
            t,
            D(a, t.current)
          ), vt = null;
          return;
        }
        e.flags & 32768 ? (yt || n === 1 ? t = !0 : Nl || (bt & 536870912) !== 0 ? t = !1 : (za = t = !0, (n === 2 || n === 9 || n === 3 || n === 6) && (n = ye.current, n !== null && n.tag === 13 && (n.flags |= 16384))), Vu(e, t)) : Qn(e);
      }
      function Qn(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Vu(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = Bf(
            e.alternate,
            e,
            ia
          );
          if (a !== null) {
            vt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            vt = e;
            return;
          }
          vt = e = t;
        } while (e !== null);
        Dt === 0 && (Dt = 5);
      }
      function Vu(t, e) {
        do {
          var a = qf(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, vt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            vt = t;
            return;
          }
          vt = t = a;
        } while (t !== null);
        Dt = 6, vt = null;
      }
      function Xu(t, e, a, n, r, u, f, v, O) {
        t.cancelPendingCommit = null;
        do
          Jl();
        while (Xt !== 0);
        if ((gt & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (u = e.lanes | e.childLanes, u |= no, x(
            t,
            a,
            u,
            f,
            v,
            O
          ), t === Tt && (vt = Tt = null, bt = 0), Cl = e, Na = t, ra = a, ho = u, go = r, Qc = n, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Wf(Fr, function() {
            return Fu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), n = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || n) {
            n = nt.T, nt.T = null, r = ea(), Lt(2), f = gt, gt |= 4;
            try {
              Yf(t, e, a);
            } finally {
              gt = f, Lt(r), nt.T = n;
            }
          }
          Xt = 1, Zu(), Ju(), Lu();
        }
      }
      function Zu() {
        if (Xt === 1) {
          Xt = 0;
          var t = Na, e = Cl, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = nt.T, nt.T = null;
            var n = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              ku(e, t), om(t.containerInfo);
            } finally {
              gt = r, Lt(n), nt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Ju() {
        if (Xt === 2) {
          Xt = 0;
          var t = Na, e = Cl, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = nt.T, nt.T = null;
            var n = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              _u(t, e.alternate, e);
            } finally {
              gt = r, Lt(n), nt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Lu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Ap();
          var t = Na, e = Cl, a = ra, n = Qc;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Cl = Na = null, Wu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (ka = null), rt(a), e = e.stateNode, ve && typeof ve.onCommitFiberRoot == "function")
            try {
              ve.onCommitFiberRoot(
                Il,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (n !== null) {
            e = nt.T, r = ea(), Lt(2), nt.T = null;
            try {
              for (var u = t.onRecoverableError, f = 0; f < n.length; f++) {
                var v = n[f];
                u(v.value, {
                  componentStack: v.stack
                });
              }
            } finally {
              nt.T = e, Lt(r);
            }
          }
          (ra & 3) !== 0 && Jl(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === vo ? sn++ : (sn = 0, vo = t) : sn = 0, ne && gp(), nl(0);
        }
      }
      function Wu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Rl(e)));
      }
      function Jl() {
        return Zu(), Ju(), Lu(), Fu();
      }
      function Fu() {
        if (Xt !== 5) return !1;
        var t = Na, e = ho;
        ho = 0;
        var a = rt(ra), n = 32 > a ? 32 : a;
        a = nt.T;
        var r = ea();
        try {
          Lt(n), nt.T = null, n = go, go = null;
          var u = Na, f = ra;
          if (Xt = 0, Cl = Na = null, ra = 0, (gt & 6) !== 0)
            throw Error(c(331));
          var v = gt;
          if (gt |= 4, Mu(u.current), Tu(
            u,
            u.current,
            f,
            n
          ), gt = v, nl(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot(Il, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), nt.T = a, Wu(t, e);
        }
      }
      function Iu(t, e, a) {
        e = D(a, e), e = sr(t.stateNode, e, 2), t = ma(t, e, 2), t !== null && (C(t, 2), Ge(t));
      }
      function wt(t, e, a) {
        if (t.tag === 3)
          Iu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Iu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var n = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof n.componentDidCatch == "function" && (ka === null || !ka.has(n))) {
                t = D(a, t), a = Fs(2), n = ma(e, a, 2), n !== null && (Is(
                  a,
                  n,
                  e,
                  t
                ), C(n, 2), Ge(n));
                break;
              }
            }
            e = e.return;
          }
      }
      function Mr(t, e, a) {
        var n = t.pingCache;
        if (n === null) {
          n = t.pingCache = new Kp();
          var r = /* @__PURE__ */ new Set();
          n.set(e, r);
        } else
          r = n.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), n.set(e, r));
        r.has(a) || (fo = !0, r.add(a), t = Zf.bind(null, t, e, a), e.then(t, t));
      }
      function Zf(t, e, a) {
        var n = t.pingCache;
        n !== null && n.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Tt === t && (bt & a) === a && (Dt === 4 || Dt === 3 && (bt & 62914560) === bt && 300 > ue() - fi ? (gt & 2) === 0 && ol(t, 0) : mo |= a, Tl === bt && (Tl = 0)), Ge(t);
      }
      function $u(t, e) {
        e === 0 && (e = U()), t = Ua(t, e), t !== null && (C(t, e), Ge(t));
      }
      function Jf(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), $u(t, a);
      }
      function Lf(t, e) {
        var a = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var n = t.stateNode, r = t.memoizedState;
            r !== null && (a = r.retryLane);
            break;
          case 19:
            n = t.stateNode;
            break;
          case 22:
            n = t.stateNode._retryCache;
            break;
          default:
            throw Error(c(314));
        }
        n !== null && n.delete(e), $u(t, a);
      }
      function Wf(t, e) {
        return Fn(t, e);
      }
      function Ff(t, e, a, n) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = n, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Ar(t) {
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
      function Pu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Kn(t, e, a, n, r, u) {
        var f = 0;
        if (n = t, typeof t == "function") Ar(t) && (f = 1);
        else if (typeof t == "string")
          f = Be && Vt ? _c(t, a, Pt.current) ? 26 : Mc(t) ? 27 : 5 : Be ? _c(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Mc(t) ? 27 : 5;
        else
          t: switch (t) {
            case Qr:
              return t = o(31, a, e, r), t.elementType = Qr, t.lanes = u, t;
            case cl:
              return Ga(
                a.children,
                r,
                u,
                e
              );
            case rc:
              f = 8, r |= 24;
              break;
            case Ur:
              return t = o(12, a, e, r | 2), t.elementType = Ur, t.lanes = u, t;
            case qr:
              return t = o(13, a, e, r), t.elementType = qr, t.lanes = u, t;
            case Yr:
              return t = o(19, a, e, r), t.elementType = Yr, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ba:
                    f = 10;
                    break t;
                  case oc:
                    f = 9;
                    break t;
                  case Br:
                    f = 11;
                    break t;
                  case Gr:
                    f = 14;
                    break t;
                  case ya:
                    f = 16, n = null;
                    break t;
                }
              f = 29, a = Error(
                c(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), n = null;
          }
        return e = o(f, a, e, r), e.elementType = t, e.type = n, e.lanes = u, e;
      }
      function Ga(t, e, a, n) {
        return t = o(7, t, n, e), t.lanes = a, t;
      }
      function Or(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function tc(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Rr(t, e, a) {
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
      function If(t, e, a, n, r, u, f, v, O) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = n, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = O, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function ec(t, e, a, n, r, u, f, v, O, Q, Z, V) {
        return t = new If(
          t,
          e,
          a,
          f,
          O,
          Q,
          Z,
          V,
          v
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Di(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: n,
          isDehydrated: a,
          cache: e
        }, Yi(u), t;
      }
      function ac(t) {
        return t ? (t = pl, t) : pl;
      }
      function lc(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = m(e), t = t !== null ? S(t) : null, t === null ? null : Ll(t.stateNode);
      }
      function nc(t, e, a, n, r, u) {
        r = ac(r), n.context === null ? n.context = r : n.pendingContext = r, n = fa(e), n.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (n.callback = u), a = ma(t, n, e), a !== null && (se(a, t, e), Dl(a, t, e));
      }
      function ic(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Hr(t, e) {
        ic(t, e), (t = t.alternate) && ic(t, e);
      }
      var ht = {}, $f = Hd(), he = dh(), Dr = Object.assign, Pf = Symbol.for("react.element"), Vn = Symbol.for("react.transitional.element"), ul = Symbol.for("react.portal"), cl = Symbol.for("react.fragment"), rc = Symbol.for("react.strict_mode"), Ur = Symbol.for("react.profiler"), oc = Symbol.for("react.consumer"), ba = Symbol.for("react.context"), Br = Symbol.for("react.forward_ref"), qr = Symbol.for("react.suspense"), Yr = Symbol.for("react.suspense_list"), Gr = Symbol.for("react.memo"), ya = Symbol.for("react.lazy"), Qr = Symbol.for("react.activity"), tm = Symbol.for("react.memo_cache_sentinel"), sc = Symbol.iterator, em = Symbol.for("react.client.reference"), Xn = Array.isArray, nt = $f.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, am = i.rendererVersion, lm = i.rendererPackageName, uc = i.extraDevToolsConfig, Ll = i.getPublicInstance, nm = i.getRootHostContext, im = i.getChildHostContext, rm = i.prepareForCommit, om = i.resetAfterCommit, sm = i.createInstance;
      i.cloneMutableInstance;
      var Kr = i.appendInitialChild, cc = i.finalizeInitialChildren, Zn = i.shouldSetTextContent, dc = i.createTextInstance;
      i.cloneMutableTextInstance;
      var um = i.scheduleTimeout, cm = i.cancelTimeout, Qa = i.noTimeout, ta = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var le = i.supportsMutation, Ke = i.supportsPersistence, ne = i.supportsHydration, dm = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var fm = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Lt = i.setCurrentUpdatePriority, ea = i.getCurrentUpdatePriority, mm = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var pm = i.shouldAttemptEagerTransition, hm = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var gm = i.maySuspendCommit, vm = i.maySuspendCommitOnUpdate, Vr = i.maySuspendCommitInSyncRender, fc = i.preloadInstance, bm = i.startSuspendingCommit, mc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var ym = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var dl = i.NotPendingTransition, Ka = i.HostTransitionContext, xm = i.resetFormInstance;
      i.bindToConsole;
      var wm = i.supportsMicrotasks, _m = i.scheduleMicrotask, Wl = i.supportsTestSelectors, Sm = i.findFiberRoot, zm = i.getBoundingRect, Em = i.getTextContent, Fl = i.isHiddenSubtree, km = i.matchAccessibilityRole, Nm = i.setFocusIfFocusable, Tm = i.setupIntersectionObserver, Cm = i.appendChild, jm = i.appendChildToContainer, Mm = i.commitTextUpdate, Am = i.commitMount, Om = i.commitUpdate, Rm = i.insertBefore, Hm = i.insertInContainerBefore, Dm = i.removeChild, Um = i.removeChildFromContainer, pc = i.resetTextContent, Bm = i.hideInstance, qm = i.hideTextInstance, Ym = i.unhideInstance, Gm = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var Qm = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var Km = i.cloneInstance, hc = i.createContainerChildSet, gc = i.appendChildToContainerChildSet, Vm = i.finalizeContainerChildren, vc = i.replaceContainerChildren, bc = i.cloneHiddenInstance, yc = i.cloneHiddenTextInstance, Xr = i.isSuspenseInstancePending, Zr = i.isSuspenseInstanceFallback, Xm = i.getSuspenseInstanceFallbackErrorDetails, Zm = i.registerSuspenseInstanceRetry, Jm = i.canHydrateFormStateMarker, Lm = i.isFormStateMarkerMatching, xc = i.getNextHydratableSibling, Wm = i.getNextHydratableSiblingAfterSingleton, Fm = i.getFirstHydratableChild, Im = i.getFirstHydratableChildWithinContainer, $m = i.getFirstHydratableChildWithinActivityInstance, Pm = i.getFirstHydratableChildWithinSuspenseInstance, tp = i.getFirstHydratableChildWithinSingleton, ep = i.canHydrateInstance, ap = i.canHydrateTextInstance, lp = i.canHydrateActivityInstance, np = i.canHydrateSuspenseInstance, ip = i.hydrateInstance, rp = i.hydrateTextInstance, op = i.hydrateActivityInstance, sp = i.hydrateSuspenseInstance, up = i.getNextHydratableInstanceAfterActivityInstance, cp = i.getNextHydratableInstanceAfterSuspenseInstance, dp = i.commitHydratedInstance, fp = i.commitHydratedContainer, mp = i.commitHydratedActivityInstance, pp = i.commitHydratedSuspenseInstance, hp = i.finalizeHydratedChildren, gp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var vp = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var bp = i.clearSuspenseBoundaryFromContainer, yp = i.hideDehydratedBoundary, xp = i.unhideDehydratedBoundary, wc = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var wp = i.validateHydratableInstance, _p = i.validateHydratableTextInstance, Be = i.supportsResources, _c = i.isHostHoistableType, Jr = i.getHoistableRoot, Sc = i.getResource, zc = i.acquireResource, Ec = i.releaseResource, Sp = i.hydrateHoistable, kc = i.mountHoistable, Nc = i.unmountHoistable, zp = i.createHoistableInstance, Ep = i.prepareToCommitHoistables, kp = i.mayResourceSuspendCommit, Tc = i.preloadResource, Np = i.suspendResource, Vt = i.supportsSingletons, Cc = i.resolveSingletonInstance, Tp = i.acquireSingletonInstance, jc = i.releaseSingletonInstance, Mc = i.isHostSingletonType, fl = i.isSingletonScope, Lr = [], ml = -1, pl = {}, ge = Math.clz32 ? Math.clz32 : w, Cp = Math.log, jp = Math.LN2, Jn = 256, Ln = 262144, Wn = 4194304, Fn = he.unstable_scheduleCallback, Wr = he.unstable_cancelCallback, Mp = he.unstable_shouldYield, Ap = he.unstable_requestPaint, ue = he.unstable_now, Ac = he.unstable_ImmediatePriority, Op = he.unstable_UserBlockingPriority, Fr = he.unstable_NormalPriority, Rp = he.unstable_IdlePriority, Hp = he.log, Dp = he.unstable_setDisableYieldValue, Il = null, ve = null, be = typeof Object.is == "function" ? Object.is : Kt, Oc = typeof reportError == "function" ? reportError : function(t) {
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
      }, Up = Object.prototype.hasOwnProperty, Ir, Rc, $r = !1, Hc = /* @__PURE__ */ new WeakMap(), hl = [], gl = 0, In = null, $l = 0, ke = [], Ne = 0, xa = null, Ve = 1, Xe = "", Pt = E(null), Pl = E(null), wa = E(null), $n = E(null), te = null, At = null, yt = !1, _a = null, Te = !1, Pr = Error(c(519)), Pn = E(null), Va = null, aa = null, Bp = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(a, n) {
            t.push(n);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(a) {
            return a();
          });
        };
      }, qp = he.unstable_scheduleCallback, Yp = he.unstable_NormalPriority, Ot = {
        $$typeof: ba,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ti = null, vl = null, to = !1, ei = !1, eo = !1, Xa = 0, tn = null, ao = 0, bl = 0, yl = null, Dc = nt.S;
      nt.S = function(t, e) {
        Gc = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && Nf(t, e), Dc !== null && Dc(t, e);
      };
      var Za = E(null), xl = Error(c(460)), lo = Error(c(474)), ai = Error(c(542)), li = { then: function() {
      } }, Ja = null, wl = null, en = 0, La = rs(!0), Uc = rs(!1), Ce = [], _l = 0, no = 0, Sa = !1, io = !1, Sl = E(null), ni = E(0), ye = E(null), je = null, Bt = E(0), la = 0, dt = null, kt = null, qt = null, ii = !1, zl = !1, Wa = !1, ri = 0, an = 0, El = null, Gp = 0, ln = {
        readContext: It,
        use: Nn,
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
      ln.useEffectEvent = Ht;
      var Bc = {
        readContext: It,
        use: Nn,
        useCallback: function(t, e) {
          return re().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Ms,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Cn(
            4194308,
            4,
            Hs.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Cn(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Cn(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = re();
          e = e === void 0 ? null : e;
          var n = t();
          if (Wa) {
            jt(!0);
            try {
              t();
            } finally {
              jt(!1);
            }
          }
          return a.memoizedState = [n, e], n;
        },
        useReducer: function(t, e, a) {
          var n = re();
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
          return n.memoizedState = n.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, n.queue = t, t = t.dispatch = Rf.bind(
            null,
            dt,
            t
          ), [n.memoizedState, t];
        },
        useRef: function(t) {
          var e = re();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = tr(t);
          var e = t.queue, a = Vs.bind(
            null,
            dt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: lr,
        useDeferredValue: function(t, e) {
          var a = re();
          return nr(a, t, e);
        },
        useTransition: function() {
          var t = tr(!1);
          return t = Ys.bind(
            null,
            dt,
            t.queue,
            !0,
            !1
          ), re().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var n = dt, r = re();
          if (yt) {
            if (a === void 0)
              throw Error(c(407));
            a = a();
          } else {
            if (a = e(), Tt === null)
              throw Error(c(349));
            (bt & 127) !== 0 || hs(n, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Ms(vs.bind(null, n, u, t), [
            t
          ]), n.flags |= 2048, il(
            9,
            { destroy: void 0 },
            gs.bind(
              null,
              n,
              u,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = re(), e = Tt.identifierPrefix;
          if (yt) {
            var a = Xe, n = Ve;
            a = (n & ~(1 << 32 - ge(n) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ri++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Gp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: ir,
        useFormState: ks,
        useActionState: ks,
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
          return e.queue = a, e = rr.bind(
            null,
            dt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Ii,
        useCacheRefresh: function() {
          return re().memoizedState = Of.bind(
            null,
            dt
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
      }, ro = {
        readContext: It,
        use: Nn,
        useCallback: Us,
        useContext: It,
        useEffect: ar,
        useImperativeHandle: Ds,
        useInsertionEffect: Os,
        useLayoutEffect: Rs,
        useMemo: Bs,
        useReducer: Tn,
        useRef: js,
        useState: function() {
          return Tn(We);
        },
        useDebugValue: lr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return qs(
            a,
            kt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Tn(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : ql(t),
            e
          ];
        },
        useSyncExternalStore: ps,
        useId: Qs,
        useHostTransitionStatus: ir,
        useFormState: Ns,
        useActionState: Ns,
        useOptimistic: function(t, e) {
          var a = Ut();
          return xs(a, kt, t, e);
        },
        useMemoCache: Ii,
        useCacheRefresh: Ks
      };
      ro.useEffectEvent = As;
      var qc = {
        readContext: It,
        use: Nn,
        useCallback: Us,
        useContext: It,
        useEffect: ar,
        useImperativeHandle: Ds,
        useInsertionEffect: Os,
        useLayoutEffect: Rs,
        useMemo: Bs,
        useReducer: Pi,
        useRef: js,
        useState: function() {
          return Pi(We);
        },
        useDebugValue: lr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return kt === null ? nr(a, t, e) : qs(
            a,
            kt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Pi(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : ql(t),
            e
          ];
        },
        useSyncExternalStore: ps,
        useId: Qs,
        useHostTransitionStatus: ir,
        useFormState: Cs,
        useActionState: Cs,
        useOptimistic: function(t, e) {
          var a = Ut();
          return kt !== null ? xs(a, kt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Ii,
        useCacheRefresh: Ks
      };
      qc.useEffectEvent = As;
      var oo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var n = pe(), r = fa(n);
          r.payload = e, a != null && (r.callback = a), e = ma(t, r, n), e !== null && (se(e, t, n), Dl(e, t, n));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var n = pe(), r = fa(n);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = ma(t, r, n), e !== null && (se(e, t, n), Dl(e, t, n));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = pe(), n = fa(a);
          n.tag = 2, e != null && (n.callback = e), e = ma(t, n, a), e !== null && (se(e, t, a), Dl(e, t, a));
        }
      }, so = Error(c(461)), Yt = !1, uo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, na = !1, Gt = !1, co = !1, Yc = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, ce = !1, qe = null, kl = 8192, Qp = {
        getCacheForType: function(t) {
          var e = It(Ot), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return It(Ot).controller.signal;
        }
      }, oi = 0, si = 1, ui = 2, ci = 3, di = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var nn = Symbol.for;
        oi = nn("selector.component"), si = nn("selector.has_pseudo_class"), ui = nn("selector.role"), ci = nn("selector.test_id"), di = nn("selector.text");
      }
      var Kp = typeof WeakMap == "function" ? WeakMap : Map, gt = 0, Tt = null, vt = null, bt = 0, Et = 0, xe = null, za = !1, Nl = !1, fo = !1, ia = 0, Dt = 0, Ea = 0, Fa = 0, mo = 0, we = 0, Tl = 0, rn = null, de = null, po = !1, fi = 0, Gc = 0, on = 1 / 0, mi = null, ka = null, Xt = 0, Na = null, Cl = null, ra = 0, ho = 0, go = null, Qc = null, sn = 0, vo = null;
      return ht.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ua(t, 67108864);
          e !== null && se(e, t, 67108864), Hr(t, 67108864);
        }
      }, ht.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = pe();
          e = ft(e);
          var a = Ua(t, e);
          a !== null && se(a, t, e), Hr(t, e);
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
                Ge(t), (gt & 6) === 0 && (on = ue() + 500, nl(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ua(t, 2), e !== null && se(e, t, 2), Uu(), Hr(t, 2);
        }
      }, ht.batchedUpdates = function(t, e) {
        return t(e);
      }, ht.createComponentSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, ht.createContainer = function(t, e, a, n, r, u, f, v, O, Q) {
        return ec(
          t,
          e,
          !1,
          null,
          a,
          n,
          u,
          null,
          f,
          v,
          O,
          Q
        );
      }, ht.createHasPseudoClassSelector = function(t) {
        return { $$typeof: si, value: t };
      }, ht.createHydrationContainer = function(t, e, a, n, r, u, f, v, O, Q, Z, V, J, ct) {
        return t = ec(
          a,
          n,
          !0,
          t,
          r,
          u,
          v,
          ct,
          O,
          Q,
          Z,
          V
        ), t.context = ac(null), a = t.current, n = pe(), n = ft(n), r = fa(n), r.callback = e ?? null, ma(a, r, n), e = n, t.current.lanes = e, C(t, e), Ge(t), t;
      }, ht.createPortal = function(t, e, a) {
        var n = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ul,
          key: n == null ? null : "" + n,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, ht.createRoleSelector = function(t) {
        return { $$typeof: ui, value: t };
      }, ht.createTestNameSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, ht.createTextSelector = function(t) {
        return { $$typeof: di, value: t };
      }, ht.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ht.defaultOnRecoverableError = function(t) {
        Oc(t);
      }, ht.defaultOnUncaughtError = function(t) {
        Oc(t);
      }, ht.deferredUpdates = function(t) {
        var e = nt.T, a = ea();
        try {
          return Lt(32), nt.T = null, t();
        } finally {
          Lt(a), nt.T = e;
        }
      }, ht.discreteUpdates = function(t, e, a, n, r) {
        var u = nt.T, f = ea();
        try {
          return Lt(2), nt.T = null, t(e, a, n, r);
        } finally {
          Lt(f), nt.T = u, gt === 0 && (on = ue() + 500);
        }
      }, ht.findAllNodes = Tr, ht.findBoundingRects = function(t, e) {
        if (!Wl) throw Error(c(363));
        e = Tr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(zm(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var n = a.x, r = n + a.width, u = a.y, f = u + a.height, v = e - 1; 0 <= v; v--)
            if (e !== v) {
              var O = t[v], Q = O.x, Z = Q + O.width, V = O.y, J = V + O.height;
              if (n >= Q && u >= V && r <= Z && f <= J) {
                t.splice(e, 1);
                break;
              } else if (n !== Q || a.width !== O.width || J < u || V > f) {
                if (!(u !== V || a.height !== O.height || Z < n || Q > r)) {
                  Q > n && (O.width += Q - n, O.x = n), Z < r && (O.width = r - Q), t.splice(e, 1);
                  break;
                }
              } else {
                V > u && (O.height += V - u, O.y = u), J < f && (O.height = f - V), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ht.findHostInstance = lc, ht.findHostInstanceWithNoPortals = function(t) {
        return t = m(t), t = t !== null ? _(t) : null, t === null ? null : Ll(t.stateNode);
      }, ht.findHostInstanceWithWarning = function(t) {
        return lc(t);
      }, ht.flushPassiveEffects = Jl, ht.flushSyncFromReconciler = function(t) {
        var e = gt;
        gt |= 1;
        var a = nt.T, n = ea();
        try {
          if (Lt(2), nt.T = null, t)
            return t();
        } finally {
          Lt(n), nt.T = a, gt = e, (gt & 6) === 0 && nl(0);
        }
      }, ht.flushSyncWork = Uu, ht.focusWithin = function(t, e) {
        if (!Wl) throw Error(c(363));
        for (t = Er(t), e = Ou(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], n = a.tag;
          if (!Fl(a)) {
            if ((n === 5 || n === 26 || n === 27) && Nm(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ht.getFindAllNodesFailureDescription = function(t, e) {
        if (!Wl) throw Error(c(363));
        var a = 0, n = [];
        t = [Er(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], f = u.tag, v = t[r++], O = e[v];
          if ((f !== 5 && f !== 26 && f !== 27 || !Fl(u)) && (kr(u, O) && (n.push(Nr(O)), v++, v > a && (a = v)), v < e.length))
            for (u = u.child; u !== null; )
              t.push(u, v), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Nr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (n.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, ht.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Ll(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, ht.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: am,
          rendererPackageName: lm,
          currentDispatcherRef: nt,
          reconcilerVersion: "19.2.0"
        };
        if (uc !== null && (t.rendererConfig = uc), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Il = e.inject(t), ve = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ht.isAlreadyRendering = function() {
        return (gt & 6) !== 0;
      }, ht.observeVisibleRects = function(t, e, a, n) {
        if (!Wl) throw Error(c(363));
        t = Tr(t, e);
        var r = Tm(
          t,
          a,
          n
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
      }, ht.startHostTransition = function(t, e, a, n) {
        if (t.tag !== 5) throw Error(c(476));
        var r = Gs(t).queue;
        Ys(
          t,
          r,
          e,
          dl,
          a === null ? s : function() {
            var u = Gs(t);
            return u.next === null && (u = t.alternate.memoizedState), Yl(
              t,
              u.next.queue,
              {},
              pe()
            ), a(n);
          }
        );
      }, ht.updateContainer = function(t, e, a, n) {
        var r = e.current, u = pe();
        return nc(
          r,
          u,
          t,
          e,
          a,
          n
        ), u;
      }, ht.updateContainerSync = function(t, e, a, n) {
        return nc(
          e.current,
          2,
          t,
          e,
          a,
          n
        ), 2;
      }, ht;
    }, l.exports.default = l.exports, Object.defineProperty(l.exports, "__esModule", { value: !0 });
  })(wo)), wo.exports;
}
var Pc;
function mh() {
  return Pc || (Pc = 1, xo.exports = fh()), xo.exports;
}
var ph = mh();
const hh = /* @__PURE__ */ Qo(ph);
var zo = { exports: {} }, oa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var td;
function gh() {
  return td || (td = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var ed;
function vh() {
  return ed || (ed = 1, zo.exports = gh()), zo.exports;
}
var pn = vh();
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
const Dd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], To = 16, Ud = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), bh = [
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
], ad = {
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
}, yh = /* @__PURE__ */ new Set([
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
]), Bd = {
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
}, qd = {
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
}, Co = ["font-size", "color", ...new Set([...Object.keys(Bd), ...Object.keys(qd)].filter((l) => l !== "font-size" && l !== "color"))], xh = new Set(Co);
function ie(l, i = " ") {
  const o = [];
  let s = 0, c = "";
  for (let d = 0; d < l.length; d++) {
    const p = l[d];
    if (p === "(" ? s++ : p === ")" && s--, s === 0 && (i === " " ? /\s/.test(p) : p === i)) {
      (c.trim() || i !== " ") && o.push(c.trim()), c = "";
      continue;
    }
    c += p;
  }
  return (c.trim() || i !== " " && o.length) && o.push(c.trim()), o;
}
function jo(l, i, o = 0) {
  if (o > 32) return null;
  let s = "", c = 0;
  for (; ; ) {
    const d = l.indexOf("var(", c);
    if (d < 0)
      return s += l.slice(c), s;
    s += l.slice(c, d);
    let p = 1, m = d + 4;
    for (; m < l.length && p; m++)
      l[m] === "(" ? p++ : l[m] === ")" && p--;
    const S = l.slice(d + 4, m - 1), _ = ie(S, ","), R = _[0].trim(), A = _.length > 1 ? S.slice(S.indexOf(",") + 1).trim() : null;
    let E = i(R);
    if ((E == null || E === "initial") && (E = A), E == null) return null;
    const y = jo(E, i, o + 1);
    if (y === null) return null;
    s += y, c = m;
  }
}
function wh(l) {
  const i = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, c = 0;
  for (; c < l.length; ) {
    if (o.lastIndex = c, s = o.exec(l), !s || s.index !== c) {
      if (/^\s+$/.test(l.slice(c))) break;
      return null;
    }
    c = o.lastIndex, s[1] !== void 0 ? i.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? i.push({ fn: s[3].toLowerCase() }) : s[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: s[5] ?? s[6] });
  }
  return i;
}
function Al(l, i) {
  const o = wh(l.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let s = 0;
  const c = ({ num: E, unit: y }) => {
    switch (y) {
      case "":
        return { px: 0, pct: 0, num: E, unitless: !0 };
      case "px":
        return { px: E, pct: 0, num: 0 };
      case "rem":
        return { px: E * To, pct: 0, num: 0 };
      case "em":
        return { px: E * (i.fontSize ?? To), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: E, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: E / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: E / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: E * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (E, y, z) => E && y ? { px: E.px + z * y.px, pct: E.pct + z * y.pct, num: E.num + z * y.num, unitless: E.unitless && y.unitless } : null, p = (E, y) => E ? { px: E.px * y, pct: E.pct * y, num: E.num * y, unitless: E.unitless } : null, m = (E) => E && E.unitless;
  function S() {
    const E = o[s++];
    if (!E) return null;
    if (E.num !== void 0) return c(E);
    if (E.op === "(") {
      const y = R();
      return o[s]?.op !== ")" ? null : (s++, y);
    }
    if (E.op === "-" || E.op === "+") {
      const y = S();
      return E.op === "-" ? p(y, -1) : y;
    }
    if (E.fn) {
      const y = [];
      for (; ; ) {
        y.push(R());
        const k = o[s++];
        if (!k) return null;
        if (k.op === ")") break;
        if (k.op !== ",") return null;
      }
      if (y.some((k) => !k)) return null;
      if (E.fn === "calc") return y[0];
      if (!(y.every((k) => !k.pct) || y.every((k) => !k.px && !k.num))) return null;
      const w = (k) => k.px + k.pct + k.num;
      return E.fn === "min" ? y.reduce((k, H) => w(H) < w(k) ? H : k) : E.fn === "max" ? y.reduce((k, H) => w(H) > w(k) ? H : k) : E.fn === "clamp" && y.length === 3 ? w(y[1]) < w(y[0]) ? y[0] : w(y[1]) > w(y[2]) ? y[2] : y[1] : null;
    }
    return null;
  }
  function _() {
    let E = S();
    for (; o[s] && (o[s].op === "*" || o[s].op === "/"); ) {
      const y = o[s++].op, z = S();
      if (!E || !z) return null;
      y === "*" ? E = m(z) ? p(E, z.num) : m(E) ? p(z, E.num) : null : E = m(z) && z.num !== 0 ? p(E, 1 / z.num) : null;
    }
    return E;
  }
  function R() {
    let E = _();
    for (; o[s] && (o[s].op === "+" || o[s].op === "-"); ) {
      const y = o[s++].op;
      E = d(E, _(), y === "-" ? -1 : 1);
    }
    return E;
  }
  const A = R();
  return s !== o.length || !A ? null : A;
}
function Mo(l, i) {
  const o = l.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const s = Al(o, i);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: l.trim() } : s.pct && (s.px || s.num) ? { expr: l.trim() } : s.pct ? { pct: s.pct } : { px: _h(s.px) } : { expr: l.trim() };
}
const _h = (l) => Number.isFinite(l) ? l : l > 0 ? 34e37 : -34e37, gi = (l) => Math.max(0, Math.min(255, Math.round(l))).toString(16).padStart(2, "0"), Sh = ([l, i, o, s]) => `#${gi(l)}${gi(i)}${gi(o)}${gi(s * 255)}`;
function ld(l) {
  const i = l.slice(1), o = i.length <= 4 ? i.split("").map((c) => c + c).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const s = (c) => parseInt(o.slice(c, c + 2), 16);
  return [s(0), s(2), s(4), o.length === 8 ? s(6) / 255 : 1];
}
function Si(l, i) {
  const o = l.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (s) {
    const _ = i(s[1]), R = _ && ld(_);
    return R ? { rgba: R, token: s[1] } : null;
  }
  if (o.startsWith("#")) {
    const _ = ld(o);
    return _ ? { rgba: _, token: null } : null;
  }
  if (ad[o]) return { rgba: [...ad[o]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const _ = ie(c[2], ",");
    if (_.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(_[0])) return null;
    const R = (jt) => {
      const Kt = ie(jt), Nt = Kt.findIndex((at) => /%$/.test(at)), K = Nt >= 0 ? parseFloat(Kt[Nt]) / 100 : null;
      return { color: Si(Kt.filter((at, D) => D !== Nt).join(" "), i), pct: K };
    }, A = R(_[1]), E = R(_[2]);
    if (!A.color || !E.color || A.color === "currentcolor" || E.color === "currentcolor") return null;
    let y = A.pct, z = E.pct;
    y === null && z === null ? (y = 0.5, z = 0.5) : y === null ? y = 1 - z : z === null && (z = 1 - y);
    const w = y + z, k = w < 1 ? w : 1;
    y /= w, z /= w;
    const [H, b, N, U] = A.color.rgba, [q, C, x, h] = E.color.rgba, Y = U * y + h * z, I = (jt, Kt) => Y === 0 ? 0 : (jt * U * y + Kt * h * z) / Y, ft = [I(H, q), I(b, C), I(N, x), Y * k], rt = h === 0 ? A.color.token : U === 0 ? E.color.token : null;
    return { rgba: ft, token: rt };
  }
  const d = c[2].includes(",") ? ie(c[2], ",") : ie(c[2].replace("/", " / ")).filter((_) => _ !== "/");
  if (d.length < 3) return null;
  const p = (_) => _.endsWith("%") ? parseFloat(_) / 100 * 255 : parseFloat(_), m = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), S = [p(d[0]), p(d[1]), p(d[2]), m];
  return S.some((_) => Number.isNaN(_)) ? null : { rgba: S, token: null };
}
const fn = ["top", "right", "bottom", "left"], zh = ["top-left", "top-right", "bottom-right", "bottom-left"], vi = (l) => [l[0], l[1] ?? l[0], l[2] ?? l[0], l[3] ?? l[1] ?? l[0]], nd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Ao(l, i) {
  const o = i.trim(), s = () => ie(o);
  switch (l) {
    case "padding":
    case "margin": {
      const c = vi(s());
      return fn.map((d, p) => [`${l}-${d}`, c[p]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const c = s(), d = l.split("-")[0];
      return [[`${d}-left`, c[0]], [`${d}-right`, c[1] ?? c[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const c = s(), d = l.split("-")[0];
      return [[`${d}-top`, c[0]], [`${d}-bottom`, c[1] ?? c[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${l.split("-")[0]}-left`, o]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${l.split("-")[0]}-right`, o]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${l.split("-")[0]}-top`, o]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${l.split("-")[0]}-bottom`, o]];
    case "inset": {
      const c = vi(s());
      return fn.map((d, p) => [d, c[p]]);
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
      const c = l.split("-")[1], d = vi(s());
      return fn.map((p, m) => [`border-${p}-${c}`, d[m]]);
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
      const c = l === "border" ? fn : l === "border-inline" ? ["left", "right"] : l === "border-block" ? ["top", "bottom"] : l === "border-inline-start" ? ["left"] : l === "border-inline-end" ? ["right"] : [l.slice(7)];
      let d = "medium", p = "none", m = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const S of s())
          nd.has(S) ? p = S : /^(thin|medium|thick|-?[\d.]|calc\()/.test(S) ? d = S : m = S;
      else o === "0" && (d = "0");
      return c.flatMap((S) => [[`border-${S}-width`, d], [`border-${S}-style`, p], [`border-${S}-color`, m]]);
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
      const c = vi(ie(o.split("/")[0]));
      return zh.map((d, p) => [`border-${d}-radius`, c[p]]);
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
      return o === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Si(o, () => "#000000") ? [["background-color", o], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", o]];
    case "overflow": {
      const c = s();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = s();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return Ao("gap", o);
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
      const c = s(), d = c.filter((m) => /^[\d.]+$/.test(m)), p = c.find((m) => !/^[\d.]+$/.test(m));
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
      for (const m of s())
        nd.has(m) || m === "auto" ? d = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? c = m : p = m;
      return [["outline-width", c], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = ie(o, ","), d = c.map((m) => ie(m).find((S) => !/^[\d.]+m?s$/.test(S) && !/^(ease|linear|step|cubic)/.test(S)) ?? "all"), p = c.map((m) => ie(m).find((S) => /^[\d.]+m?s$/.test(S)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", p.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", s()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", o]];
    case "word-wrap":
      return [["overflow-wrap", o]];
    default:
      return [[l, o]];
  }
}
function Eh(l, i) {
  return l ? ie(l, ",").some((o) => {
    let s = o.trim().toLowerCase(), c = !1;
    s.startsWith("not ") && (c = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const d = s.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const m = /^\((.+)\)$/.exec(p);
      if (!m) return !1;
      const S = m[1].trim(), _ = /^([a-z-]+)\s*:\s*(.+)$/.exec(S);
      if (_) {
        const [, A, E] = _, y = (z) => {
          const w = Mo(z, { viewport: i });
          return typeof w == "object" && "px" in w ? w.px : NaN;
        };
        switch (A) {
          case "min-width":
            return i.width >= y(E);
          case "max-width":
            return i.width <= y(E);
          case "min-height":
            return i.height >= y(E);
          case "max-height":
            return i.height <= y(E);
          case "hover":
          case "any-hover":
            return E.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return E.trim() === "fine";
          case "prefers-reduced-motion":
            return E.trim() === "no-preference";
          case "prefers-color-scheme":
            return E.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const R = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(S);
      if (R) {
        const A = R[1] === "width" ? i.width : i.height, E = Mo(R[3], { viewport: i }), y = typeof E == "object" && "px" in E ? E.px : NaN;
        switch (R[2]) {
          case ">=":
            return A >= y;
          case "<=":
            return A <= y;
          case ">":
            return A > y;
          case "<":
            return A < y;
          default:
            return A === y;
        }
      }
      return !1;
    });
    return c ? !d : d;
  }) : !0;
}
function kh(l, i) {
  const o = i[i.length - 1].compound;
  return Ko(o)[0] ?? l;
}
function Nh(l) {
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), s = (c, d) => {
    c.forEach(({ compound: p }, m) => {
      const S = d && m === c.length - 1;
      for (const _ of p.pseudos)
        if (Ud.has(_.name) && (S ? i : o).add(_.name), _.list && _.name !== "not") for (const R of _.list) s(R, S);
    });
  };
  return s(l, !0), { subject: i, ancestor: o };
}
function Ko(l) {
  const i = [...l.classes];
  for (const o of l.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const s of o.list) s.length === 1 && i.push(...Ko(s[0].compound));
  return i;
}
function Th(l, i) {
  const o = (s, c) => {
    s.forEach(({ compound: d }, p) => {
      const m = c && p === s.length - 1, S = d.pseudos.filter((_) => Ud.has(_.name)).map((_) => _.name);
      if (!m) for (const _ of S) for (const R of Ko(d)) i.add(`${_}:${R}`);
      for (const _ of d.pseudos) if (_.list && _.name !== "not") for (const R of _.list) o(R, m);
    });
  };
  o(l, !0);
}
class Ch {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const m = p[p.length - 1].compound, S = m.classes.length ? `.${m.classes[0]}` : m.tag && m.tag !== "*" ? m.tag : "*";
      this.index.has(S) || this.index.set(S, []), this.index.get(S).push(d);
    };
    let s = 0;
    const c = (d, p) => {
      for (const [m, S, _, R] of d)
        for (const A of Bo(m)) {
          let E;
          try {
            E = qo(A);
          } catch (w) {
            if (w instanceof Se) {
              this.skipped++;
              continue;
            }
            throw w;
          }
          const y = Nh(E);
          Th(E, this.trackedStates);
          const z = { steps: E, media: S, layer: _, origin: p, order: s++, specificity: Md(E), decls: R, states: y, source: p === 0 ? `ua:${E[E.length - 1].compound.tag ?? "*"}` : kh(A, E) };
          this.rules.push(z), o(z, E);
        }
    };
    c(bh.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), c(i.rules, 1);
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
const jh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function Mh(l) {
  if (!l || typeof l != "object") return [];
  const i = [];
  for (const [o, s] of Object.entries(l)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const c = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof s == "number" && s !== 0 && !jh.has(c) && !c.startsWith("--") ? `${s}px` : String(s);
    i.push([c, d]);
  }
  return i;
}
function Ah(l) {
  if (l.tagName !== "svg") return [];
  const i = [];
  for (const o of ["width", "height"]) {
    const s = l.getAttribute(o);
    s !== null && i.push([o, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return i;
}
const Oh = (l, i) => l.important - i.important || l.origin - i.origin || l.layer - i.layer || l.specificity[0] - i.specificity[0] || l.specificity[1] - i.specificity[1] || l.specificity[2] - i.specificity[2] || l.order - i.order;
class Rh {
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
        const m = c.ownerDocument?.activeElement;
        return !!m && m !== c.ownerDocument.body && typeof c.contains == "function" && c.contains(m);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!c.state?.focus : !!c.state?.[d];
    };
    return this.sheet.candidates(i).filter((c) => (!c.media || c.media.every((d) => Eh(d, this.viewport))) && Ad(i, c.steps, { state: s }));
  }
  compute(i, o, s = /* @__PURE__ */ new Set()) {
    const c = this.matching(i, s), d = [];
    for (const x of c)
      for (const [h, Y, I] of x.decls) d.push({ prop: h, value: Y, important: I ? 1 : 0, origin: x.origin === 0 ? 0 : 2, layer: x.layer, specificity: x.specificity, order: x.order, source: x.source });
    for (const [x, h] of Ah(i)) d.push({ prop: x, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${x}` });
    for (const [x, h] of Mh(i.props?.style)) d.push({ prop: x, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(Oh);
    const p = this.sheet.properties, m = Object.create(o?.customs ?? null), S = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map();
    for (const x of d) x.prop.startsWith("--") && _.set(x.prop, x.value);
    if (!o && this.theme) for (const x of Dd) this.theme[x] && _.set(`--${x}`, `perchtoken(${x})`);
    const R = (x) => {
      if (S.has(x)) return S.get(x);
      const h = p[x];
      return h && !h.inherits ? h.initial ?? null : x in m ? m[x] : h?.initial ?? null;
    }, A = /* @__PURE__ */ new Set(), E = (x) => {
      if (!_.has(x)) return R(x);
      if (A.has(x)) return null;
      A.add(x);
      const h = jo(_.get(x), E);
      return A.delete(x), _.delete(x), S.set(x, h), (!p[x] || p[x].inherits) && (m[x] = h), h;
    };
    for (const x of [..._.keys()]) E(x);
    const y = /* @__PURE__ */ new Map();
    for (const x of d) {
      if (x.prop.startsWith("--")) continue;
      const h = jo(x.value, R);
      if (h === null) {
        for (const [Y] of Ao(x.prop, "unset")) y.set(Y, { value: "unset", source: x.source, origin: x.origin });
        continue;
      }
      for (const [Y, I] of Ao(x.prop, h)) y.set(Y, { value: I, source: x.source, origin: x.origin });
    }
    const z = {}, w = {}, k = /* @__PURE__ */ new Set(), H = /* @__PURE__ */ new Set(), b = o?.values, N = { fontSize: b?.["font-size"] ?? To, viewport: this.viewport }, U = (x, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(x, h, N, z, b);
      const Y = `${x}\0${h}\0${N.fontSize}`;
      let I = this.parsed.get(Y);
      return I === void 0 && this.parsed.set(Y, I = this.parseValue(x, h, N, z, b)), I;
    }, q = y.size ? [...Co, ...[...y.keys()].filter((x) => !xh.has(x))] : Co;
    for (const x of q) {
      const h = y.get(x);
      let Y = h?.value;
      const I = yh.has(x);
      if ((Y === void 0 || Y === "unset" || Y === "revert" || Y === "revert-layer") && (Y = I ? "inherit" : "initial"), h && (w[x] = h.source, h.origin !== 0 && k.add(x)), Y === "inherit" && b && x in b) {
        z[x] = b[x], H.add(x);
        continue;
      }
      (Y === "inherit" || Y === "initial") && (Y = I ? qd[x] : Bd[x]), z[x] = U(x, Y), x === "font-size" && (N.fontSize = z["font-size"]);
    }
    for (const x of fn) {
      const h = z[`border-${x}-style`];
      (h === "none" || h === "hidden") && (z[`border-${x}-width`] = { px: 0 });
    }
    z["outline-style"] === "none" && (z["outline-width"] = { px: 0 });
    const C = b?.display;
    return (C === "flex" || C === "inline-flex" || C === "grid" || C === "inline-grid") && z.position !== "absolute" && z.position !== "fixed" && (z.display = id(z.display)), (z.position === "absolute" || z.position === "fixed") && (z.display = id(z.display)), { values: z, sources: w, own: k, inherited: H, customs: m, rules: c, element: i };
  }
  parseValue(i, o, s, c, d) {
    const p = String(o).trim();
    switch (i) {
      case "font-size": {
        const m = p.toLowerCase(), S = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (S[m]) return S[m];
        if (m === "smaller") return s.fontSize / 1.2;
        if (m === "larger") return s.fontSize * 1.2;
        const _ = Al(m, { fontSize: s.fontSize, viewport: s.viewport });
        return !_ || _.num ? s.fontSize : _.px + _.pct / 100 * s.fontSize;
      }
      case "font-weight": {
        const m = p.toLowerCase();
        if (m === "normal") return 400;
        if (m === "bold") return 700;
        if (m === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (m === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const S = parseFloat(m);
        return Number.isFinite(S) ? S : 400;
      }
      case "line-height": {
        const m = p.toLowerCase();
        if (m === "normal") return { normal: !0 };
        const S = Al(m, { fontSize: s.fontSize, viewport: s.viewport });
        return S ? S.unitless ? { factor: S.num } : { px: S.px + S.pct / 100 * s.fontSize } : { normal: !0 };
      }
      case "font-family":
        return p;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const m = p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p);
        return Number.isFinite(m) ? m : parseFloat(i === "flex-shrink" || i === "opacity" ? 1 : 0);
      }
      case "color": {
        const m = Si(p, (S) => this.themeHex(S));
        return m === "currentcolor" || !m ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : m;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const m = Si(p, (S) => this.themeHex(S));
        return m === "currentcolor" ? c.color : m ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
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
        return Mo(p, s);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function id(l) {
  return l === "inline" || l === "inline-block" || l === "contents" ? "block" : l === "inline-flex" ? "flex" : l === "inline-grid" ? "grid" : l;
}
const zi = (l) => l && l.rgba ? { value: Sh(l.rgba), token: l.token ?? null } : null, Hh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Dh(l, i) {
  const o = i?.(l);
  if (Number.isFinite(o)) return o;
  const s = Math.round(l * 100) / 100;
  return Hh[s] ?? Math.round(l * 1.2);
}
function Vo(l, i) {
  const o = l["line-height"], s = l["font-size"];
  return o.normal ? Dh(s, i) : o.factor !== void 0 ? o.factor * s : o.px;
}
const Uh = (l) => ie(l, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Bh = "perch-native-description/1", jl = Symbol("display"), Ei = {
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
}, qh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const l of qh) Ei[l] = /^(w|h|min_|max_|top|right|bottom|left)/.test(l) ? "auto" : 0;
Ei.rounded = 0;
const Yh = /* @__PURE__ */ new Set([
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
]), Gh = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Qh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Kh = (l) => Qh.test(l) ? "Menlo" : Gh.test(l) ? ".SystemUIFont" : Uh(l).split(",")[0].trim(), Vh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, rd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Yd = (l) => {
  const i = l.props["data-testid"];
  if (i) return `${l.tagName}[data-testid="${i}"]`;
  if (l.props.id) return `${l.tagName}#${l.props.id}`;
  const o = l.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? l.classList[0];
  if (o) return `${l.tagName}.${o}`;
  const s = l.parentElement;
  return s && s.tagName !== "body" ? `${Yd(s)} > ${l.tagName}` : l.tagName;
};
class Xh {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, o, s, c, d, p = "") {
    const m = `${i}|${o}|${s}|${c}`, S = this.map.get(m);
    if (S) {
      !S.elements.includes(d) && S.elements.length < 4 && S.elements.push(d), S.count++;
      return;
    }
    this.map.set(m, { kind: i, property: o, value: String(s), class: c ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, o) => i.kind < o.kind ? -1 : i.kind > o.kind ? 1 : i.property < o.property ? -1 : i.property > o.property ? 1 : 0);
  }
}
const ua = (l) => {
  if (l != null) {
    if (typeof l == "string") return l === "auto" || l === "none" || l === "normal" ? "auto" : void 0;
    if ("px" in l) return Math.round(Math.min(Math.max(l.px, -9999), 9999) * 100) / 100;
    if ("pct" in l) return `${Math.round(l.pct * 1e3) / 1e3}%`;
  }
}, Zh = /^(text|search|url|email|tel|password|number)$/, Jh = 162.13 / 12.8;
function Lh(l, i) {
  if (typeof l != "object" || !l?.expr) return !1;
  const o = Al(l.expr, { fontSize: i["font-size"] }), s = (i["margin-left"]?.px ?? NaN) + (i["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + s) < 0.01;
}
function Wh(l) {
  const i = l.transform;
  if (i && i !== "none") {
    const s = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), c = s && ie(s[2], ",").map((d) => d.trim());
    return !c || c.length > (s[1] ? 1 : 2) ? null : s[1] === "X" ? [c[0], "0"] : s[1] === "Y" ? ["0", c[0]] : [c[0], c[1] ?? "0"];
  }
  const o = l.translate;
  if (o && o !== "none") {
    const s = ie(String(o).trim(), " ").filter(Boolean);
    return s.length > 3 || s[2] !== void 0 && Al(s[2], {})?.px ? null : [s[0], s[1] ?? "0"];
  }
  return [];
}
function Fh(l, i, o) {
  const s = l.values, c = Wh(s);
  if (c?.length === 0) return;
  const d = s.transform && s.transform !== "none" ? "transform" : "translate", p = { fontSize: s["font-size"] }, m = (R, A) => {
    const E = Al(R, p);
    if (!(!E || E.unitless && E.num))
      return E.pct ? typeof A == "number" ? E.px + E.pct / 100 * A : void 0 : E.px;
  }, S = c ? m(c[0], i.w) : void 0, _ = c ? m(c[1], i.h) : void 0;
  if (S === void 0 || _ === void 0) {
    o("unsupported", d, s[d], l.sources[d]);
    return;
  }
  S && (i.ml = (i.ml ?? 0) + S), _ && (i.mt = (i.mt ?? 0) + _);
}
function od(l, i, o = null) {
  const s = l.values, c = {}, d = (b) => l.sources[b], p = (b) => l.sources[b] !== void 0, m = s.display;
  m === "none" ? c.display = "hidden" : m === "flex" || m === "inline-flex" ? c.display = "flex" : (m === "grid" || m === "inline-grid") && (c.display = "flex", c.flex_direction = "col", i("approximated", "display", m, d("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", s["grid-template-columns"], d("grid-template-columns"))), l.element.hidden && (c.display = "hidden");
  const S = c.display === "flex";
  if (S && c.flex_direction !== "col") {
    const b = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    c.flex_direction = b;
  }
  if (S) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (c.flex_wrap = "wrap");
    const b = m === "grid" || m === "inline-grid", N = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    N && (c.items = N);
    let U = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (b) {
      const x = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      x && (c.items = x), s["align-items"] === "center" && (U = "center");
    }
    U && (c.justify = U);
    const q = ua(s["row-gap"]), C = ua(s["column-gap"]);
    typeof q == "number" && q && (c.gap_y = q), typeof C == "number" && C && !b && (c.gap_x = C);
  }
  s["flex-grow"] && (c.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (c.flex_shrink = s["flex-shrink"]);
  const _ = ua(s["flex-basis"]);
  _ !== void 0 && _ !== "auto" && (c.flex_basis = _);
  const R = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  R && (c.self = R);
  for (const [b, N] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const U = s[N], q = ua(U);
    if (q === void 0 && N === "width" && Lh(U, s)) {
      c.self = "stretch", i("approximated", N, U.expr, d(N), "stretched across its parent, inside its margins");
      continue;
    }
    if (q === void 0) {
      typeof U == "object" && U.expr ? i("unsupported", N, U.expr, d(N), "no calc() in the engine") : typeof U == "string" && !["auto", "none"].includes(U) && i("unsupported", N, U, d(N));
      continue;
    }
    q !== "auto" && (c[b] = q);
  }
  const A = ["top", "right", "bottom", "left"];
  for (const b of A) {
    const N = b[0];
    for (const [U, q] of [["p", "padding"], ["m", "margin"]]) {
      const C = s[`${q}-${b}`], x = ua(C);
      if (x === void 0) {
        C?.expr && i("unsupported", `${q}-${b}`, C.expr, d(`${q}-${b}`), "no calc() in the engine");
        continue;
      }
      x !== 0 && (c[`${U}${N}`] = x);
    }
  }
  const E = s.position;
  if (E === "absolute" || E === "fixed") {
    c.position = "absolute", E === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const b of A) {
      const N = ua(s[b]);
      N !== void 0 && N !== "auto" && (c[b] = N);
    }
    if (E === "fixed" && o && c.w === void 0 && c.right === void 0 && typeof c.left == "number") {
      const b = o.width - c.left - (typeof c.ml == "number" ? c.ml : 0) - (typeof c.mr == "number" ? c.mr : 0);
      c.max_w = typeof c.max_w == "number" ? Math.min(c.max_w, b) : b;
    }
    Fh(l, c, i);
  } else E === "sticky" && i("unsupported", "position", "sticky", d("position"));
  s["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", s["z-index"], d("z-index"), "paint order is tree order");
  for (const [b, N] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const U = s[N];
    U === "hidden" || U === "clip" ? c[b] = "hidden" : (U === "auto" || U === "scroll") && (c[b] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (c.visibility = "invisible");
  const y = s["background-color"];
  y?.unreadable ? i("unsupported", "background-color", y.unreadable, d("background-color")) : y?.rgba && y.rgba[3] > 0 && (c.bg = zi(y)), s["background-image"] && s["background-image"] !== "none" && i("unsupported", "background-image", s["background-image"], d("background-image"));
  const z = A.map((b) => ua(s[`border-${b}-width`]) || 0), w = [];
  A.forEach((b, N) => {
    if (!z[N]) return;
    c[`border_${b[0]}`] = z[N];
    const U = s[`border-${b}-style`];
    U !== "solid" && i("approximated", `border-${b}-style`, U, d(`border-${b}-style`), "drawn solid");
    const q = zi(s[`border-${b}-color`]);
    q && w.push(q);
  }), w.length && (c.border_color = w[0], w.some((b) => b.value !== w[0].value) && i("approximated", "border-color", w.map((b) => b.value).join(" "), d("border-top-color"), "one border colour"));
  const k = ["top-left", "top-right", "bottom-right", "bottom-left"].map((b) => ua(s[`border-${b}-radius`]) || 0);
  k.every((b) => b === k[0]) ? k[0] && (c.rounded = k[0]) : ["tl", "tr", "br", "bl"].forEach((b, N) => {
    k[N] && (c[`rounded_${b}`] = k[N]);
  }), s.opacity !== 1 && (c.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const H = s["box-shadow"];
  if (H && H !== "none" && ie(H, ",").some((b) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(b.trim())) && (c.shadow = "lg", i("approximated", "box-shadow", H, d("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !l.inherited.has("cursor")) {
    const b = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    b ? c.cursor = b : i("unsupported", "cursor", s.cursor, d("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (c.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? c.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", s["text-decoration-line"], d("text-decoration-line")), c;
}
const Ih = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Gd(l) {
  if (!l || l === "normal") return "";
  const i = String(l).trim().split(/\s+/).map((o) => Ih[o]);
  return i.every(Boolean) ? i.join(",") : null;
}
function sd(l, i) {
  const o = l.values, s = o["line-height"];
  return {
    text_color: zi(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Gd(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(Vo(o, i) * 1e3) / 1e3 },
    font_family: Kh(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const ud = (l, i) => l.factor !== void 0 ? l.factor * i : l.px, Qd = (l, i) => JSON.stringify(l) === JSON.stringify(i);
function cd(l, i, o) {
  const s = {}, c = (m, S) => S.some((_) => !l.inherited.has(_));
  for (const [m, S] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (c(m, S) || !Qd(i[m], o[m])) && (s[m] = i[m]);
  const d = ud(i.line_height, i.text_size), p = o.line_height ? ud(o.line_height, i.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (s.line_height = i.line_height), s;
}
const $h = (l, i) => ({ ...l, ...i });
function dd(l, i) {
  const o = {};
  for (const [s, c] of Object.entries(l))
    c && typeof c == "object" && "value" in c ? (o[s] = c.value, c.token && (i[s] = c.token)) : s === "line_height" ? o[s] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : s === "italic" ? c && (o.italic = !0) : o[s] = c;
  return o.italic === !1 && delete o.italic, o;
}
function Ph(l, i) {
  const o = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(l), ...Object.keys(i)])) {
    const c = l[s], d = i[s];
    Qd(c, d) || (o[s] = d === void 0 ? s in Ei ? Ei[s] : null : d);
  }
  return o;
}
function fd(l, i) {
  const o = l.values;
  for (const [s, c] of Object.entries(l.sources)) {
    if (s.startsWith("--") || Yh.has(s) || c.startsWith("ua:")) continue;
    const d = o[s];
    switch (s) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", s, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, c, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Gd(d) === null && i("unsupported", s, d, c);
        break;
      case "text-transform":
        d !== "none" && i("approximated", s, d, c, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        s === "transition-property" && p && ie(p, ",").some((m) => parseFloat(m) > 0) && o["transition-property"] !== "none" && i("unsupported", "transition", `${o["transition-property"]} ${p}`, c, "changes are instant (the engine animates only opacity and size)");
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
        o["outline-style"] !== "none" && s === "outline-style" && i("unsupported", "outline", `${ua(o["outline-width"])}px ${o["outline-style"]} ${zi(o["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
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
function t0(l, i, o, s) {
  const c = Yd(l), d = [], p = (k, H, b, N, U) => d.push([k, H, b, N ?? "(user agent)", c, U]), m = s.cascade.compute(l, i), S = {}, _ = od(m, p, s.viewport);
  fd(m, p);
  const R = sd(m, s.measure), A = cd(m, R, o), E = dd({ ..._, ...A }, S), y = {}, z = s.cascade.matching(l, "*").filter((k) => k.states.subject.size);
  for (const [k, H] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!z.some((C) => H.some((x) => C.states.subject.has(x)))) continue;
    const b = s.cascade.compute(l, i, new Set(H)), N = {}, U = dd({ ...od(b, () => {
    }), ...cd(b, sd(b, s.measure), o) }, N);
    k === "focus" && fd(b, p);
    const q = Ph(E, U);
    if (Object.keys(q).length) {
      y[k] = q;
      const C = Object.fromEntries(Object.entries(N).filter(([x]) => x in q));
      Object.keys(C).length && (y[`${k}_tokens`] = C);
    }
  }
  if (s.cascade.sheet.tracks(l, "hover") && (y.track_hover = !0), /tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (y.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (y.break_anywhere = !0), _.overflow_y === "scroll") {
    const k = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    k > 0 && (y.scrollbar = k);
  }
  m.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (y.blocks_pointer = !0);
  const w = Object.entries(Vh).filter(([, k]) => k.some((H) => typeof l.props[H] == "function")).map(([k]) => k);
  return w.length && (y.events = w), { computed: m, style: E, tokens: S, extra: y, meta: n0(l), reports: d, childText: $h(o, A), where: c };
}
function Kd(l, i, o, s, c = "") {
  const d = `${c}/${l.id}.${l.version}`;
  let p = s.cache.get(l);
  (!p || p.key !== d) && s.cache.set(l, p = { key: d, part: t0(l, i, o, s) });
  const { computed: m, tokens: S, extra: _, reports: R, childText: A, where: E } = p.part;
  for (const h of R) s.findings.add(...h);
  const y = (h, Y, I, ft, rt) => s.findings.add(h, Y, I, ft, E, rt), z = { ...p.part.style }, w = { kind: "div", id: l.id, style: z, tokens: S, meta: p.part.meta, ..._ };
  Object.defineProperty(w, jl, { value: m.values.display });
  const k = l.tagName;
  if (k === "svg")
    return w.kind = l.props["data-perch-image"] ? "image" : "svg", w.markup = r0(l), w;
  if (k === "input" || k === "textarea" || k === "select") {
    w.kind = "input", w.input_type = k === "input" ? String(l.props.type ?? "text") : k;
    for (const h of ["placeholder", "checked", "disabled"]) l.props[h] !== void 0 && (w[h] = l.props[h]);
    return /^(checkbox|radio)$/.test(w.input_type) && (w.checked = l.checked), k !== "select" && (w.value = l.value), k === "input" && Zh.test(w.input_type) && (w.field_w = Jh * m.values["font-size"]), w;
  }
  if (k === "img")
    return w.kind = "image", w.src = l.props.src ?? null, w;
  const H = m.values["text-transform"], b = [];
  let N = !1, U = !1;
  for (const h of l.childNodes) {
    if (h instanceof Go) {
      if (h.hidden || h.data === "") continue;
      N = !0;
      const ft = b[b.length - 1];
      if (ft?.kind === "text")
        ft.source = (ft.source ?? ft.text) + h.data, ft.text = md(ft.source, H), ft.text === ft.source && delete ft.source;
      else {
        const rt = md(h.data, H);
        b.push(rt === h.data ? { kind: "text", text: rt } : { kind: "text", text: rt, source: h.data });
      }
      continue;
    }
    if (!(h instanceof ze)) continue;
    const Y = Kd(h, m, A, s, d), I = Y[jl];
    I === "inline" || I === "inline-block" || I === "inline-flex" ? N = !0 : I !== "none" && (U = !0), b.push(Y);
  }
  const q = b.some((h) => h.kind !== "text"), C = b.length === 1 && b[0].kind !== "text" && /^inline-(block|flex)$/.test(b[0][jl]) ? b[0] : null;
  if (!z.display && C) {
    const h = s.cache.get(l.childNodes.find((I) => I.id === C.id))?.part.computed, Y = h ? Oo(m.values, s.measure) - l0(h.values, s.measure) : 0;
    z.display = "flex", z.flex_direction = "col", z.items = "start", Y > 0 && (C.style.mt = Math.round(((C.style.mt ?? 0) + Y) * 100) / 100), y("approximated", "display", `${m.values.display} holding one ${C[jl]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!z.display && b.length === 1 && (b[0].kind === "svg" || b[0].kind === "image") && b[0][jl] === "inline" && typeof b[0].style.h == "number") {
    const h = b[0], Y = Oo(m.values, s.measure), I = Vo(m.values, s.measure) - Y, ft = (rt) => Math.round(rt * 100) / 100;
    z.display = "flex", z.flex_direction = "col", z.items = "start", Y > h.style.h && (h.style.mt = ft((h.style.mt ?? 0) + Y - h.style.h)), I > 0 && (h.style.mb = ft((h.style.mb ?? 0) + I)), y("approximated", "display", `${m.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!z.display && N && q) {
    if (z.display = "flex", z.flex_direction = U ? "col" : "row", !U) z.items = "baseline";
    else for (const h of b) h.kind !== "text" && /^inline-(block|flex)$/.test(h[jl]) && !h.style.self && (h.style.self = "start");
    y("approximated", "display", `${m.values.display} with inline content`, "(inline formatting)", U ? "a column of its children" : "a row on the text baseline");
  }
  const x = m.values["letter-spacing"]?.px;
  if (x)
    for (let h = 0; h < b.length; h++) {
      const Y = b[h];
      if (Y.kind !== "text") continue;
      const I = Math.round(x * [...Y.text].length * 1e3) / 1e3;
      b[h] = { kind: "div", style: { pr: I }, tokens: {}, children: [Y] };
    }
  return w.children = b, w;
}
function e0(l, i) {
  if (!i) return null;
  let s = (i.self ? l : i.closest ? Od(l, i.closest) : i.find ? mn(l, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return s && i.strip && s.startsWith(i.strip) && (s = s.slice(i.strip.length)), s;
}
function a0(l, i, o) {
  const s = i.map((p) => [p, ji(p.selector)]), c = /* @__PURE__ */ new Map(), d = (p) => {
    for (const m of p.children) {
      const S = o.get(m.id);
      if (S)
        for (const [_, R] of s) {
          const A = _.textRange ? "range_name" : "name";
          if (S[A] != null || !R.some((z) => Ad(m, z))) continue;
          const E = e0(m, _.key), y = E == null ? c.get(_.name) ?? 0 : 0;
          E == null && c.set(_.name, y + 1), S[A] = E != null ? `${_.name}:${E}` : y ? `${_.name}@${y}` : _.name;
        }
      d(m);
    }
  };
  d(l.documentElement);
}
const ki = 0.9521, Vd = 0.2256, Oo = (l, i) => (Vo(l, i) - (ki + Vd) * l["font-size"]) / 2 + ki * l["font-size"];
function l0(l, i) {
  const o = (c) => c && typeof c == "object" && "px" in c ? c.px : 0, s = l["border-top-style"] === "none" ? 0 : o(l["border-top-width"]);
  return o(l["padding-top"]) + s + Oo(l, i);
}
const md = (l, i) => i === "uppercase" ? l.toUpperCase() : i === "lowercase" ? l.toLowerCase() : i === "capitalize" ? l.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : l, Xd = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function n0(l) {
  const i = {};
  for (const [o, s] of Object.entries(l.props)) {
    if (Xd.has(o) || typeof s == "function" || s === void 0 || s === null || typeof s == "object") continue;
    const c = o.startsWith("aria-") || o.startsWith("data-");
    if (s === !1 && !c) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    i[d] = typeof s == "boolean" ? c ? String(s) : "" : String(s);
  }
  return { tag: l.tagName, classes: l.classList, attrs: i };
}
const i0 = (l) => l === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(l) ? l : l.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), pd = (l) => String(l).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function r0(l) {
  if (l.props["data-perch-markup"]) return String(l.props["data-perch-markup"]);
  const i = (o) => {
    const s = [];
    for (const [d, p] of Object.entries(o.props))
      Xd.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || s.push(`${i0(d)}="${pd(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = o.childNodes.map((d) => d instanceof Go ? pd(d.data) : i(d)).join("");
    return `<${o.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${c}</${o.tagName}>`;
  };
  return i(l);
}
function o0(l) {
  const i = l.theme?.() ?? {}, o = {};
  for (const s of Dd) i[s] && (o[s] = i[s]);
  return o;
}
const s0 = { font_features: "" };
function u0(l, i, o, s = {}, c = null) {
  const d = o0(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([d, p]);
  (s.look !== m || s.sheet !== o) && Object.assign(s, { look: m, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new Rh(o, { theme: d, viewport: p }), top: null });
  const { cascade: S, cache: _ } = s, R = { cascade: S, cache: _, viewport: p, findings: new Xh(), measure: i.lineHeight ? (y) => i.lineHeight(y) : null };
  s.top ??= S.compute(l.body, S.compute(l.documentElement, null));
  const A = l.body.children.map((y) => Kd(y, s.top, s0, R));
  if (c?.length) {
    const y = /* @__PURE__ */ new Map(), z = (w) => {
      w.id && y.set(w.id, w);
      for (const k of w.children ?? []) z(k);
    };
    A.forEach(z), a0(l, c, y);
  }
  const E = /* @__PURE__ */ new Set();
  for (const y of [l, l.defaultView])
    for (const { type: z } of y?.listeners ?? []) rd[z] && E.add(rd[z]);
  return { schema: Bh, root: A[0] ?? null, overlays: A.slice(1), document_events: [...E].sort(), unsupported: R.findings.list() };
}
const c0 = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let d0 = null;
const f0 = () => d0 ??= new Ch(c0);
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
let Pa = pn.NoEventPriority;
function m0(l, i) {
  const o = /* @__PURE__ */ new Set([...Object.keys(l), ...Object.keys(i)]);
  for (const s of o) {
    if (s === "children") continue;
    const c = l[s], d = i[s];
    if (!(c === d || typeof c == "function" && typeof d == "function") && !(s === "style" && c && d && typeof c == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(d)])].every((m) => c[m] === d[m])))
      return !0;
  }
  return !1;
}
const p0 = {
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
  scheduleTimeout: (l, i) => setTimeout(l, i),
  cancelTimeout: (l) => clearTimeout(l),
  scheduleMicrotask: (l) => queueMicrotask(l),
  getRootHostContext: () => null,
  getChildHostContext: (l) => l,
  getPublicInstance: (l) => l,
  prepareForCommit: () => null,
  resetAfterCommit: (l) => l.ownerDocument?.afterCommit?.(),
  preparePortalMount: () => {
  },
  createInstance: (l, i, o) => new ze(l, i, o.ownerDocument),
  createTextInstance: (l, i) => new Go(l),
  appendInitialChild: (l, i) => {
    l.appendChild(i);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (l, i, o) => !!o.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (l, i) => {
    l.appendChild(i);
  },
  appendChildToContainer: (l, i) => {
    l.appendChild(i);
  },
  insertBefore: (l, i, o) => {
    l.insertBefore(i, o);
  },
  insertInContainerBefore: (l, i, o) => {
    l.insertBefore(i, o);
  },
  removeChild: (l, i) => {
    l.removeChild(i);
  },
  removeChildFromContainer: (l, i) => {
    l.removeChild(i);
  },
  clearContainer: (l) => {
    for (const i of [...l.childNodes]) l.removeChild(i);
  },
  commitUpdate: (l, i, o, s) => {
    l.props = s, m0(o, s) && l.touch();
  },
  commitTextUpdate: (l, i, o) => {
    l.data = String(o);
  },
  commitMount: (l) => {
    l.focus();
  },
  resetTextContent: () => {
  },
  hideInstance: (l) => {
    l.hidden = !0, l.touch();
  },
  unhideInstance: (l) => {
    l.hidden = !1, l.touch();
  },
  hideTextInstance: (l) => {
    l.hidden = !0;
  },
  unhideTextInstance: (l) => {
    l.hidden = !1;
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
  setCurrentUpdatePriority: (l) => {
    Pa = l;
  },
  getCurrentUpdatePriority: () => Pa,
  resolveUpdatePriority: () => Pa !== pn.NoEventPriority ? Pa : pn.DefaultEventPriority,
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
  bindToConsole: (l, i) => Function.prototype.bind.call(console[l], console, ...i)
}, _e = hh(p0), Mi = (l, i, o = null) => _e.createPortal(l, i, null, o), h0 = {
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
  change: "onChange"
};
class g0 {
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
function bi(l, i, o) {
  i.currentTarget = l;
  for (const { type: s, listener: c, capture: d } of [...l.listeners ?? []])
    s === i.type && d === o && c.call(l, i);
  if (l instanceof ze) {
    const s = h0[i.type], c = s && l.props[o ? `${s}Capture` : s];
    typeof c == "function" && c(i);
  }
}
const v0 = (l) => l?.tagName === "textarea" || l?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(l.props.type ?? ""));
function tb(l, i, o = {}) {
  const { document: s, window: c } = nh(l), d = new ze("div", { id: "root", style: o.container ?? {} }, s);
  s.body.appendChild(d);
  const p = [];
  let m = null;
  const S = () => [s, c].map((b) => b.listeners.map((N) => `${N.type}:${N.capture}`).sort().join(",")).join("|");
  let _ = "";
  const R = {}, A = () => (m = u0(s, l, f0(), R, o.names), _ = S(), l.render?.(m), m), E = () => {
    _e.flushPassiveEffects(), _e.flushSyncWork(), S() !== _ && A();
  };
  s.afterCommit = A;
  const y = (b) => {
    p.push(b), l.error?.(b);
  }, z = _e.createContainer(d, pn.ConcurrentRoot, null, !1, null, "", y, y, y, null);
  _e.updateContainerSync(mt.createElement(i, o.props ?? {}), z, null, null), _e.flushSyncWork(), E();
  const w = (b) => {
    const N = (U) => {
      if (U.id === b) return U;
      for (const q of U.children) {
        const C = N(q);
        if (C) return C;
      }
      return null;
    };
    return N(s.documentElement);
  }, k = (b) => {
    const N = Pa;
    Pa = pn.DiscreteEventPriority;
    try {
      return b();
    } finally {
      Pa = N, _e.flushSyncWork(), E();
    }
  }, H = {
    document: s,
    window: c,
    container: d,
    errors: p,
    /** The latest description (after the last commit or state change). */
    get description() {
      return m;
    },
    describe: A,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(b, N, U = {}) {
      const q = typeof b == "string" ? w(b) : b;
      if (!q) return !1;
      const C = new g0(N, U, q), x = [];
      for (let Y = q; Y; Y = Y.parentNode) x.push(Y);
      const h = [...x, s, c];
      return k(() => {
        for (let Y = h.length - 1; Y > 0 && !C.propagationStopped; Y--) bi(h[Y], C, !0);
        C.propagationStopped || (bi(q, C, !0), C.propagationStopped || bi(q, C, !1));
        for (let Y = 1; Y < h.length && !C.propagationStopped; Y++) bi(h[Y], C, !1);
      }), !C.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(b) {
      const N = s.activeElement && s.activeElement !== s.body ? s.activeElement : s.body;
      if (!H.dispatch(N, "keydown", b)) return !0;
      if (!v0(N) || N.props.disabled || N.props.readOnly) return !1;
      if ((b.ctrlKey || b.metaKey) && !b.altKey && !b.shiftKey && b.key.toLowerCase() === "a")
        return N.selectedAll = !0, !0;
      if (b.ctrlKey || b.metaKey) return !1;
      const q = N.selectedAll;
      N.selectedAll = !1;
      const C = N.value, h = b.key === "Backspace" || q && b.key === "Delete" ? q ? "" : C.slice(0, -1) : [...b.key].length === 1 ? (q ? "" : C) + b.key : C;
      return h === C ? !1 : (N.value = h, H.dispatch(N, "input", { data: b.key }), H.dispatch(N, "change", {}), N.props.value !== void 0 && delete N.edit, N.touch(), A(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(b, N) {
      const U = w(b);
      U && (U.bounds = { x: N.x, y: N.y, width: N.width, height: N.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(b) {
      const N = w(b);
      if (!N || N.props.disabled || !H.dispatch(b, "click", { button: 0, detail: 1 })) return;
      const U = N.props.type === "radio";
      U && N.checked || (N.checked = U ? !0 : !N.checked, H.dispatch(b, "input", {}), H.dispatch(b, "change", {}), N.props.checked !== void 0 && delete N.ticked, N.touch(), A());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(b, N = {}) {
      const U = { button: 0, buttons: 1, pointerType: "mouse", ...N };
      for (const q of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) H.dispatch(b, q, U);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (b) => !!w(b)?.state.hover,
    hover(b, N) {
      const U = w(b);
      !U || U.state.hover === N || (U.state.hover = N, U.touch(), A());
    },
    focus(b) {
      const N = w(b);
      N && (k(() => {
        const U = s.activeElement;
        U && U !== N && U !== s.body && H.dispatch(U, "blur"), s.focus(N), H.dispatch(N, "focus");
      }), A());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: E,
    update(b) {
      _e.updateContainerSync(mt.createElement(i, b ?? {}), z, null, null), _e.flushSyncWork(), E();
    },
    unmount() {
      _e.updateContainerSync(null, z, null, null), _e.flushSyncWork(), _e.flushPassiveEffects(), s.afterCommit = null;
    }
  };
  return H;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Zd = (l) => _e.flushSyncFromReconciler(l), b0 = { createPortal: Mi, flushSync: Zd }, eb = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Mi,
  default: b0,
  flushSync: Zd
}, Symbol.toStringTag, { value: "Module" }));
function Jd(l) {
  var i, o, s = "";
  if (typeof l == "string" || typeof l == "number") s += l;
  else if (typeof l == "object") if (Array.isArray(l)) {
    var c = l.length;
    for (i = 0; i < c; i++) l[i] && (o = Jd(l[i])) && (s && (s += " "), s += o);
  } else for (o in l) l[o] && (s && (s += " "), s += o);
  return s;
}
function Ld() {
  for (var l, i, o = 0, s = "", c = arguments.length; o < c; o++) (l = arguments[o]) && (i = Jd(l)) && (s && (s += " "), s += i);
  return s;
}
const y0 = (l, i) => {
  const o = new Array(l.length + i.length);
  for (let s = 0; s < l.length; s++)
    o[s] = l[s];
  for (let s = 0; s < i.length; s++)
    o[l.length + s] = i[s];
  return o;
}, x0 = (l, i) => ({
  classGroupId: l,
  validator: i
}), Wd = (l = /* @__PURE__ */ new Map(), i = null, o) => ({
  nextPart: l,
  validators: i,
  classGroupId: o
}), Ni = "-", hd = [], w0 = "arbitrary..", _0 = (l) => {
  const i = z0(l), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: s
  } = l;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return S0(p);
      const m = p.split(Ni), S = m[0] === "" && m.length > 1 ? 1 : 0;
      return Fd(m, S, i);
    },
    getConflictingClassGroupIds: (p, m) => {
      if (m) {
        const S = s[p], _ = o[p];
        return S ? _ ? y0(_, S) : S : _ || hd;
      }
      return o[p] || hd;
    }
  };
}, Fd = (l, i, o) => {
  if (l.length - i === 0)
    return o.classGroupId;
  const c = l[i], d = o.nextPart.get(c);
  if (d) {
    const _ = Fd(l, i + 1, d);
    if (_) return _;
  }
  const p = o.validators;
  if (p === null)
    return;
  const m = i === 0 ? l.join(Ni) : l.slice(i).join(Ni), S = p.length;
  for (let _ = 0; _ < S; _++) {
    const R = p[_];
    if (R.validator(m))
      return R.classGroupId;
  }
}, S0 = (l) => l.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = l.slice(1, -1), o = i.indexOf(":"), s = i.slice(0, o);
  return s ? w0 + s : void 0;
})(), z0 = (l) => {
  const {
    theme: i,
    classGroups: o
  } = l;
  return E0(o, i);
}, E0 = (l, i) => {
  const o = Wd();
  for (const s in l) {
    const c = l[s];
    Xo(c, o, s, i);
  }
  return o;
}, Xo = (l, i, o, s) => {
  const c = l.length;
  for (let d = 0; d < c; d++) {
    const p = l[d];
    k0(p, i, o, s);
  }
}, k0 = (l, i, o, s) => {
  if (typeof l == "string") {
    N0(l, i, o);
    return;
  }
  if (typeof l == "function") {
    T0(l, i, o, s);
    return;
  }
  C0(l, i, o, s);
}, N0 = (l, i, o) => {
  const s = l === "" ? i : Id(i, l);
  s.classGroupId = o;
}, T0 = (l, i, o, s) => {
  if (j0(l)) {
    Xo(l(s), i, o, s);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(x0(o, l));
}, C0 = (l, i, o, s) => {
  const c = Object.entries(l), d = c.length;
  for (let p = 0; p < d; p++) {
    const [m, S] = c[p];
    Xo(S, Id(i, m), o, s);
  }
}, Id = (l, i) => {
  let o = l;
  const s = i.split(Ni), c = s.length;
  for (let d = 0; d < c; d++) {
    const p = s[d];
    let m = o.nextPart.get(p);
    m || (m = Wd(), o.nextPart.set(p, m)), o = m;
  }
  return o;
}, j0 = (l) => "isThemeGetter" in l && l.isThemeGetter === !0, M0 = (l) => {
  if (l < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, o = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const c = (d, p) => {
    o[d] = p, i++, i > l && (i = 0, s = o, o = /* @__PURE__ */ Object.create(null));
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
}, Ro = "!", gd = ":", A0 = [], vd = (l, i, o, s, c) => ({
  modifiers: l,
  hasImportantModifier: i,
  baseClassName: o,
  maybePostfixModifierPosition: s,
  isExternal: c
}), O0 = (l) => {
  const {
    prefix: i,
    experimentalParseClassName: o
  } = l;
  let s = (c) => {
    const d = [];
    let p = 0, m = 0, S = 0, _;
    const R = c.length;
    for (let w = 0; w < R; w++) {
      const k = c[w];
      if (p === 0 && m === 0) {
        if (k === gd) {
          d.push(c.slice(S, w)), S = w + 1;
          continue;
        }
        if (k === "/") {
          _ = w;
          continue;
        }
      }
      k === "[" ? p++ : k === "]" ? p-- : k === "(" ? m++ : k === ")" && m--;
    }
    const A = d.length === 0 ? c : c.slice(S);
    let E = A, y = !1;
    A.endsWith(Ro) ? (E = A.slice(0, -1), y = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      A.startsWith(Ro) && (E = A.slice(1), y = !0)
    );
    const z = _ && _ > S ? _ - S : void 0;
    return vd(d, y, E, z);
  };
  if (i) {
    const c = i + gd, d = s;
    s = (p) => p.startsWith(c) ? d(p.slice(c.length)) : vd(A0, !1, p, void 0, !0);
  }
  if (o) {
    const c = s;
    s = (d) => o({
      className: d,
      parseClassName: c
    });
  }
  return s;
}, R0 = (l) => {
  const i = /* @__PURE__ */ new Map();
  return l.orderSensitiveModifiers.forEach((o, s) => {
    i.set(o, 1e6 + s);
  }), (o) => {
    const s = [];
    let c = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], m = p[0] === "[", S = i.has(p);
      m || S ? (c.length > 0 && (c.sort(), s.push(...c), c = []), s.push(p)) : c.push(p);
    }
    return c.length > 0 && (c.sort(), s.push(...c)), s;
  };
}, H0 = (l) => ({
  cache: M0(l.cacheSize),
  parseClassName: O0(l),
  sortModifiers: R0(l),
  postfixLookupClassGroupIds: D0(l),
  ..._0(l)
}), D0 = (l) => {
  const i = /* @__PURE__ */ Object.create(null), o = l.postfixLookupClassGroups;
  if (o)
    for (let s = 0; s < o.length; s++)
      i[o[s]] = !0;
  return i;
}, U0 = /\s+/, B0 = (l, i) => {
  const {
    parseClassName: o,
    getClassGroupId: s,
    getConflictingClassGroupIds: c,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, m = [], S = l.trim().split(U0);
  let _ = "";
  for (let R = S.length - 1; R >= 0; R -= 1) {
    const A = S[R], {
      isExternal: E,
      modifiers: y,
      hasImportantModifier: z,
      baseClassName: w,
      maybePostfixModifierPosition: k
    } = o(A);
    if (E) {
      _ = A + (_.length > 0 ? " " + _ : _);
      continue;
    }
    let H = !!k, b;
    if (H) {
      const x = w.substring(0, k);
      b = s(x);
      const h = b && p[b] ? s(w) : void 0;
      h && h !== b && (b = h, H = !1);
    } else
      b = s(w);
    if (!b) {
      if (!H) {
        _ = A + (_.length > 0 ? " " + _ : _);
        continue;
      }
      if (b = s(w), !b) {
        _ = A + (_.length > 0 ? " " + _ : _);
        continue;
      }
      H = !1;
    }
    const N = y.length === 0 ? "" : y.length === 1 ? y[0] : d(y).join(":"), U = z ? N + Ro : N, q = U + b;
    if (m.indexOf(q) > -1)
      continue;
    m.push(q);
    const C = c(b, H);
    for (let x = 0; x < C.length; ++x) {
      const h = C[x];
      m.push(U + h);
    }
    _ = A + (_.length > 0 ? " " + _ : _);
  }
  return _;
}, q0 = (...l) => {
  let i = 0, o, s, c = "";
  for (; i < l.length; )
    (o = l[i++]) && (s = $d(o)) && (c && (c += " "), c += s);
  return c;
}, $d = (l) => {
  if (typeof l == "string")
    return l;
  let i, o = "";
  for (let s = 0; s < l.length; s++)
    l[s] && (i = $d(l[s])) && (o && (o += " "), o += i);
  return o;
}, Y0 = (l, ...i) => {
  let o, s, c, d;
  const p = (S) => {
    const _ = i.reduce((R, A) => A(R), l());
    return o = H0(_), s = o.cache.get, c = o.cache.set, d = m, m(S);
  }, m = (S) => {
    const _ = s(S);
    if (_)
      return _;
    const R = B0(S, o);
    return c(S, R), R;
  };
  return d = p, (...S) => d(q0(...S));
}, G0 = [], Zt = (l) => {
  const i = (o) => o[l] || G0;
  return i.isThemeGetter = !0, i.themeKey = l, i;
}, Pd = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, tf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Q0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, K0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, V0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, X0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Z0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, J0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ca = (l) => Q0.test(l), pt = (l) => !!l && !Number.isNaN(Number(l)), Ze = (l) => !!l && Number.isInteger(Number(l)), Eo = (l) => l.endsWith("%") && pt(l.slice(0, -1)), sa = (l) => K0.test(l), ef = () => !0, L0 = (l) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  V0.test(l) && !X0.test(l)
), Zo = () => !1, W0 = (l) => Z0.test(l), F0 = (l) => J0.test(l), I0 = (l) => !L(l) && !W(l), $0 = (l) => l.startsWith("@container") && (l[10] === "/" && l[11] !== void 0 || l[11] === "s" && l[16] !== void 0 && l.startsWith("-size/", 10) || l[11] === "n" && l[18] !== void 0 && l.startsWith("-normal/", 10)), P0 = (l) => Aa(l, nf, Zo), L = (l) => Pd.test(l), $a = (l) => Aa(l, rf, L0), bd = (l) => Aa(l, og, pt), tg = (l) => Aa(l, sf, ef), eg = (l) => Aa(l, of, Zo), yd = (l) => Aa(l, af, Zo), ag = (l) => Aa(l, lf, F0), yi = (l) => Aa(l, uf, W0), W = (l) => tf.test(l), dn = (l) => el(l, rf), lg = (l) => el(l, of), xd = (l) => el(l, af), ng = (l) => el(l, nf), ig = (l) => el(l, lf), xi = (l) => el(l, uf, !0), rg = (l) => el(l, sf, !0), Aa = (l, i, o) => {
  const s = Pd.exec(l);
  return s ? s[1] ? i(s[1]) : o(s[2]) : !1;
}, el = (l, i, o = !1) => {
  const s = tf.exec(l);
  return s ? s[1] ? i(s[1]) : o : !1;
}, af = (l) => l === "position" || l === "percentage", lf = (l) => l === "image" || l === "url", nf = (l) => l === "length" || l === "size" || l === "bg-size", rf = (l) => l === "length", og = (l) => l === "number", of = (l) => l === "family-name", sf = (l) => l === "number" || l === "weight", uf = (l) => l === "shadow", sg = () => {
  const l = Zt("color"), i = Zt("font"), o = Zt("text"), s = Zt("font-weight"), c = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), m = Zt("container"), S = Zt("spacing"), _ = Zt("radius"), R = Zt("shadow"), A = Zt("inset-shadow"), E = Zt("text-shadow"), y = Zt("drop-shadow"), z = Zt("blur"), w = Zt("perspective"), k = Zt("aspect"), H = Zt("ease"), b = Zt("animate"), N = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], U = () => [
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
  ], q = () => [...U(), W, L], C = () => ["auto", "hidden", "clip", "visible", "scroll"], x = () => ["auto", "contain", "none"], h = () => [W, L, S], Y = () => [Ca, "full", "auto", ...h()], I = () => [Ze, "none", "subgrid", W, L], ft = () => ["auto", {
    span: ["full", Ze, W, L]
  }, Ze, W, L], rt = () => [Ze, "auto", W, L], jt = () => ["auto", "min", "max", "fr", W, L], Kt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Nt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], K = () => ["auto", ...h()], et = () => [Ca, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], at = () => [m, Ca, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], D = () => [Ca, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], B = () => [l, W, L], g = () => [...U(), xd, yd, {
    position: [W, L]
  }], G = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", ng, P0, {
    size: [W, L]
  }], $ = () => [Eo, dn, $a], P = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    _,
    W,
    L
  ], lt = () => ["", pt, dn, $a], xt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ut = () => [pt, Eo, xd, yd], Oa = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    z,
    W,
    L
  ], Ra = () => ["none", pt, W, L], Oe = () => ["none", pt, W, L], Re = () => [pt, W, L], ca = () => [Ca, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [sa],
      breakpoint: [sa],
      color: [ef],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [I0],
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
        aspect: ["auto", "square", Ca, L, W, k]
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
        "@container": ["", "normal", "size", W, L]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [$0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [pt, "auto", L, W, m]
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
        object: q()
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
        overscroll: x()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": x()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": x()
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
        inset: Y()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": Y()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": Y()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": Y(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: Y()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": Y(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: Y()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": Y()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": Y()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: Y()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: Y()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: Y()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: Y()
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
        z: [Ze, "auto", W, L]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Ca, "full", "auto", m, ...h()]
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
        flex: [pt, Ca, "auto", "initial", "none", L]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", pt, W, L]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", pt, W, L]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Ze, "first", "last", "none", W, L]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": I()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: ft()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": rt()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": rt()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": I()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: ft()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": rt()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": rt()
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
        inline: ["auto", ...at()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...at()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...at()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/block-size
       */
      "block-size": [{
        block: ["auto", ...D()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...D()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...D()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [m, "screen", ...et()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          m,
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
          m,
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
        text: ["base", o, dn, $a]
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
        font: [s, rg, tg]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Eo, L]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [lg, eg, i]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [L]
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
        tracking: [c, W, L]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [pt, "none", W, bd]
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
        "list-image": ["none", W, L]
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
        list: ["disc", "decimal", "none", W, L]
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
        decoration: [pt, "from-font", "auto", W, $a]
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
        "underline-offset": [pt, "auto", W, L]
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
        tab: [Ze, W, L]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", W, L]
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
        content: ["none", W, L]
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
        bg: g()
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
          }, Ze, W, L],
          radial: ["", W, L],
          conic: ["", Ze, W, L]
        }, ig, ag]
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
        "outline-offset": [pt, W, L]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", pt, dn, $a]
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
        "inset-shadow": ["none", A, xi, yi]
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
        "text-shadow": ["none", E, xi, yi]
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
        opacity: [pt, W, L]
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
        "mask-radial": [W, L]
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
        "mask-radial-at": U()
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
        mask: g()
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
        mask: ["none", W, L]
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
          W,
          L
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
        brightness: [pt, W, L]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [pt, W, L]
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
        grayscale: ["", pt, W, L]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [pt, W, L]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", pt, W, L]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [pt, W, L]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", pt, W, L]
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
          W,
          L
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
        "backdrop-brightness": [pt, W, L]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [pt, W, L]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", pt, W, L]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [pt, W, L]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", pt, W, L]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [pt, W, L]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [pt, W, L]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", pt, W, L]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", W, L]
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
        duration: [pt, "initial", W, L]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", H, W, L]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [pt, W, L]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", b, W, L]
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
        perspective: [w, W, L]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": q()
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
        scale: Oe()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": Oe()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": Oe()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": Oe()
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
        skew: Re()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Re()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Re()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [W, L, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: q()
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
        translate: ca()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": ca()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": ca()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": ca()
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
        zoom: [Ze, W, L]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", W, L]
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
        "will-change": ["auto", "scroll", "contents", "transform", W, L]
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
        stroke: [pt, dn, $a, bd]
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
}, ug = /* @__PURE__ */ Y0(sg);
function Me(...l) {
  return ug(Ld(l));
}
const cf = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ti = {
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
for (let l = 1; l <= 12; l++) Ti[`f${l}`] = `F${l}`;
const cg = Object.fromEntries(Object.entries(Ti).map(([l, i]) => [i, l])), dg = {
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
function fg(l) {
  const i = /^Key([A-Z])$/.exec(l) ?? /^Digit(\d)$/.exec(l);
  return i ? i[1].toLowerCase() : cg[l];
}
const wd = /* @__PURE__ */ new Map();
function df(l, i = cf) {
  const o = `${i}|${l}`, s = wd.get(o);
  if (s) return s;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of l.split("+"))
    if (d === "mod")
      i ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") c[d] = !0;
    else if (/^[a-z]$/.test(d))
      c.code = `Key${d.toUpperCase()}`, c.letter = d;
    else if (/^[0-9]$/.test(d)) c.code = `Digit${d}`;
    else if (Ti[d]) c.code = Ti[d];
    else throw new Error(`unknown key "${d}" in "${l}"`);
  if (!c.code) throw new Error(`no key in "${l}"`);
  return wd.set(o, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((l) => {
  const i = df(l, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function mg(l, i = cf) {
  const o = df(l, i), s = pg(fg(o.code) ?? "");
  return i ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${s}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", s].filter(Boolean).join("+");
}
const pg = (l) => dg[l] ?? l.toUpperCase(), _d = (l) => typeof l == "boolean" ? `${l}` : l === 0 ? "0" : l, Sd = Ld, Ai = (l, i) => (o) => {
  var s;
  if (i?.variants == null) return Sd(l, o?.class, o?.className);
  const { variants: c, defaultVariants: d } = i, p = Object.keys(c).map((_) => {
    const R = o?.[_], A = d?.[_];
    if (R === null) return null;
    const E = _d(R) || _d(A);
    return c[_][E];
  }), m = o && Object.entries(o).reduce((_, R) => {
    let [A, E] = R;
    return E === void 0 || (_[A] = E), _;
  }, {}), S = i == null || (s = i.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((_, R) => {
    let { class: A, className: E, ...y } = R;
    return Object.entries(y).every((z) => {
      let [w, k] = z;
      return Array.isArray(k) ? k.includes({
        ...d,
        ...m
      }[w]) : {
        ...d,
        ...m
      }[w] === k;
    }) ? [
      ..._,
      A,
      E
    ] : _;
  }, []);
  return Sd(l, p, S, o?.class, o?.className);
}, hg = Ai(
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
), gg = Ai(
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
function vg({ className: l, ...i } = {}) {
  return Me(gg(i), l);
}
const ff = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", mf = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", bg = Ai(`${mf} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function yg({ className: l, ...i } = {}) {
  return Me(bg(i), l);
}
const pf = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", xg = Ai(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), wg = "my-1 h-px bg-overlay-0";
function _g({ size: l = 14, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Sg({ size: l = 16, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function zg({ size: l = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function hf({ size: l = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const zd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Eg({ state: l, error: i }) {
  return /* @__PURE__ */ zt.jsx(
    "span",
    {
      className: Me("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", zd[l] ?? zd.disabled),
      title: l === "error" && i ? i : l
    }
  );
}
function kg({ title: l, onClose: i, children: o, testId: s }) {
  return Mi(
    /* @__PURE__ */ zt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (c) => {
          c.target === c.currentTarget && i();
        },
        onKeyDown: (c) => {
          c.key === "Escape" && i();
        },
        children: /* @__PURE__ */ zt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": l,
            "data-testid": s,
            children: [
              /* @__PURE__ */ zt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: l }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const wi = 4, ja = 8, Ng = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Ed = (l) => l.text ?? (typeof l.label == "string" ? l.label : l.value);
function Tg({ value: l, onChange: i, options: o, className: s, ariaLabel: c, testId: d, id: p, title: m, disabled: S, placeholder: _, freeText: R, onKeyDown: A }) {
  const E = mt.useId(), [y, z] = mt.useState(!1), [w, k] = mt.useState(-1), [H, b] = mt.useState(!1), N = mt.useRef(null), U = mt.useRef(null), [q, C] = mt.useState({}), x = mt.useRef({ text: "", at: 0 }), h = R && H && l ? o.filter((D) => Ed(D).toLowerCase().includes(l.toLowerCase()) || D.value.toLowerCase().includes(l.toLowerCase())) : o, Y = o.find((D) => D.value === l), I = (D) => `${E}-${D}`;
  function ft(D) {
    S || (k(D), z(!0));
  }
  function rt() {
    z(!1), b(!1), k(-1);
  }
  function jt(D) {
    !D || D.disabled || (i(D.value), rt());
  }
  function Kt(D, B) {
    for (let g = 1; g <= h.length; g++) {
      const G = (D + B * g + h.length * g) % h.length;
      if (!h[G].disabled) return G;
    }
    return D;
  }
  const Nt = () => h.findIndex((D) => !D.disabled), K = () => h.length - 1 - [...h].reverse().findIndex((D) => !D.disabled);
  mt.useLayoutEffect(() => {
    if (!y || !N.current) {
      C((tt) => tt.left === void 0 ? tt : {});
      return;
    }
    const D = N.current.getBoundingClientRect(), B = window.innerHeight - D.bottom - wi - ja, g = D.top - wi - ja, G = B < 160 && g > B;
    C({
      position: "fixed",
      left: Math.min(Math.max(ja, D.left), Math.max(ja, window.innerWidth - D.width - ja)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: D.width,
      maxWidth: window.innerWidth - 2 * ja,
      maxHeight: Math.min(G ? g : B, 320),
      ...G ? { bottom: window.innerHeight - D.top + wi } : { top: D.bottom + wi },
      overflowY: "auto"
    });
  }, [y, h.length]), mt.useLayoutEffect(() => {
    const D = U.current;
    if (!y || !D || q.left === void 0) return;
    const B = D.getBoundingClientRect().right, g = window.innerWidth - ja;
    B > g && C((G) => ({ ...G, left: Math.max(ja, Number(G.left) - (B - g)) }));
  }, [y, q]), mt.useEffect(() => {
    if (!y) return;
    const D = (B) => {
      const g = B.target;
      (g === document || g instanceof Node && N.current && g.contains(N.current)) && rt();
    };
    return window.addEventListener("resize", rt), window.addEventListener("scroll", D, !0), () => {
      window.removeEventListener("resize", rt), window.removeEventListener("scroll", D, !0);
    };
  }, [y]), mt.useEffect(() => {
    const D = y && w >= 0 ? document.getElementById(I(w)) : null, B = U.current;
    !D || !B || (D.offsetTop < B.scrollTop ? B.scrollTop = D.offsetTop : D.offsetTop + D.offsetHeight > B.scrollTop + B.clientHeight && (B.scrollTop = D.offsetTop + D.offsetHeight - B.clientHeight));
  }, [y, w]), vf(y, (D) => {
    D || rt();
  }, N, U);
  function et(D) {
    if (D.nativeEvent.isComposing) return;
    const B = () => {
      D.preventDefault(), D.stopPropagation();
    }, { key: g } = D;
    if (y) {
      if (g === "Escape") {
        B(), rt();
        return;
      } else if (g === "Tab")
        rt();
      else if (g === "ArrowDown" || g === "ArrowUp") {
        B(), h.length && k(w < 0 ? g === "ArrowDown" ? Nt() : K() : Kt(w, g === "ArrowDown" ? 1 : -1));
        return;
      } else if (g === "Home" && !R) {
        B(), k(Nt());
        return;
      } else if (g === "End" && !R) {
        B(), k(K());
        return;
      } else if (g === "Enter" || g === " " && !R) {
        if (w >= 0 && h[w]) {
          B(), jt(h[w]);
          return;
        }
        if (!R) {
          B(), rt();
          return;
        }
      } else if (!R && g.length === 1 && !D.metaKey && !D.ctrlKey && !D.altKey) {
        const G = Date.now();
        x.current = { text: (G - x.current.at > 600 ? "" : x.current.text) + g.toLowerCase(), at: G };
        const tt = Math.max(w, 0), $ = [...h.slice(tt + (x.current.text.length === 1 ? 1 : 0)), ...h.slice(0, tt + 1)].find((P) => !P.disabled && Ed(P).toLowerCase().startsWith(x.current.text));
        $ && (B(), k(h.indexOf($)));
        return;
      }
    } else if (g === "ArrowDown" || g === "ArrowUp" || !R && (g === "Enter" || g === " ")) {
      B(), ft(Math.max(0, h.findIndex((G) => G.value === l)));
      return;
    }
    A?.(D);
  }
  const at = {
    ref: (D) => {
      N.current = D;
    },
    id: p,
    title: m,
    disabled: S,
    "aria-label": c,
    "aria-expanded": y,
    "aria-controls": y ? E : void 0,
    "aria-activedescendant": y && w >= 0 ? I(w) : void 0,
    "data-testid": d,
    onKeyDown: et
  };
  return /* @__PURE__ */ zt.jsxs(zt.Fragment, { children: [
    R ? /* @__PURE__ */ zt.jsx(
      "input",
      {
        ...at,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: _,
        className: s,
        value: l,
        onChange: (D) => {
          i(D.target.value), b(!0), y ? k(-1) : (k(-1), z(!0));
        },
        onBlur: () => rt()
      }
    ) : /* @__PURE__ */ zt.jsxs(
      "button",
      {
        ...at,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": l,
        className: Me("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
        onClick: () => y ? rt() : ft(Math.max(0, h.findIndex((D) => D.value === l))),
        children: [
          /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 flex-1 truncate", children: Y ? Y.label : _ ?? "" }),
          /* @__PURE__ */ zt.jsx(gf, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    y && h.length > 0 && Mi(
      /* @__PURE__ */ zt.jsx(
        "div",
        {
          ref: U,
          id: E,
          role: "listbox",
          "aria-label": c,
          className: Me("z-[9999]", pf),
          style: q,
          onMouseDown: (D) => {
            D.preventDefault(), D.stopPropagation();
          },
          onClick: (D) => D.stopPropagation(),
          children: h.map((D, B) => /* @__PURE__ */ zt.jsxs(
            "div",
            {
              id: I(B),
              role: "option",
              "aria-selected": D.value === l,
              "aria-disabled": D.disabled || void 0,
              "data-value": D.value,
              className: Me(Ng, B === w && !D.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                D.disabled || k(B);
              },
              onClick: () => jt(D),
              children: [
                /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 truncate", children: D.label }),
                D.value === l && /* @__PURE__ */ zt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            D.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const Cg = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", jg = `${Cg} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function gf({ open: l, size: i = 12, className: o }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: o, width: i, height: i, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: l ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Mg(l) {
  return l.blocked && !l.stale ? "blocked" : l.status === "running" && !l.stale ? "working" : l.unseen ? "done" : "idle";
}
const Ho = {
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
function Do(l, i) {
  return !!l.parentSessionId && l.parentSessionId !== l.id && i.some((o) => o.id === l.parentSessionId);
}
function Ag(l) {
  const i = /* @__PURE__ */ new Map();
  for (const o of l)
    Do(o, l) && i.set(o.parentSessionId, [...i.get(o.parentSessionId) ?? [], o]);
  return i.size ? l.filter((o) => !Do(o, l)).flatMap((o) => [o, ...i.get(o.id) ?? []]) : l;
}
const _i = 6, kd = 8;
function Og(l, i = {}) {
  const { minWidth: o = 220, align: s = "right", minSpaceAbove: c = 100 } = i, d = l.getBoundingClientRect(), p = window.innerWidth, m = window.innerHeight, S = s === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, _ = d.top - _i - kd, R = m - d.bottom - _i - kd;
  return _ >= c ? {
    position: "fixed",
    bottom: m - d.top + _i,
    ...S,
    minWidth: o,
    maxHeight: Math.min(_, m * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + _i,
    ...S,
    minWidth: o,
    maxHeight: Math.min(R, m * 0.75),
    overflowY: "auto"
  };
}
function vf(l, i, o, s) {
  mt.useEffect(() => {
    if (!l) return;
    function c(p) {
      const m = p.target, S = o.current?.contains(m) ?? !1, _ = s.current?.contains(m) ?? !1;
      !S && !_ && i(!1);
    }
    function d(p) {
      p.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", d);
    };
  }, [l]);
}
function Rg({ icon: l, fallback: i }) {
  const [o, s] = mt.useState(!1);
  return mt.useEffect(() => s(!1), [l]), !l || o ? /* @__PURE__ */ zt.jsx(zt.Fragment, { children: i }) : /* @__PURE__ */ zt.jsx("img", { src: l, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => s(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Hg = "1.3.0";
let bf = null;
const Dg = (l) => {
  bf = l;
};
function Mt() {
  const l = bf ?? globalThis.perch;
  if (!l) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return l;
}
const Ug = (l) => Mt().subscribe?.(l) ?? (() => {
}), Bg = Og, qg = globalThis.perch?.isMac !== !1, Yg = (l) => mg(l, Mt().isMac !== !1), Gg = (l) => hg(l), Qg = ({ className: l, ...i } = {}) => Me(vg(i), l), Kg = yg, Vg = (l) => xg(l), Xg = wg, Zg = mf, Jg = ff, Lg = (l) => Ho[l].color, Wg = (l, i) => Mt().shortcutFor?.(l, i) ?? null, Oi = (l, i) => Mt().command(l, i ?? {}) !== !1, Fg = (l, i, o) => Mt().startSession?.(l, i, o), Ig = globalThis.perch?.pickFolder ? (l) => Mt().pickFolder(l) : null;
function Ee(l) {
  const i = mt.useRef(l);
  return i.current = l, mt.useSyncExternalStore(Ug, () => i.current(Mt()));
}
const $g = (l = {}) => Ee((i) => i.navigation({ showTerminals: !!l.showTerminals, sortByAttention: !!l.sortByAttention })), Pg = () => Ee((l) => l.hosts()), tv = () => Ee((l) => l.sessionFolders());
function ev() {
  const l = Ee((i) => i.addProject?.() ?? av);
  return {
    status: l.status ?? "idle",
    error: l.error,
    hostId: l.hostId,
    add: (i, o, s) => {
      i.trim() && l.status !== "pending" && Mt().addProjectFolder?.(i, o, s);
    },
    clear: () => Mt().clearAddProject?.()
  };
}
const av = Object.freeze({ status: "idle" }), yf = "perch.lastAgentChoice", lv = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), nv = () => {
  const l = Mt().storage?.getItem(yf);
  return l === "claude" || l === "codex" ? l : "claude";
}, iv = Object.freeze({ items: [] });
function rv() {
  const l = Ee((i) => i.notifications?.() ?? iv);
  return mt.useMemo(() => ({
    items: l.items ?? [],
    open: (i) => Mt().command("notification.open", { id: i }),
    dismiss: (i) => Mt().command("notification.dismiss", { id: i })
  }), [l]);
}
function ov(l) {
  const i = Ee((c) => c.agentChoices?.(l) ?? lv), [o, s] = mt.useState(nv);
  return mt.useMemo(() => ({
    connected: !!i.connected,
    discovery: !!i.discovery,
    choices: i.choices ?? [],
    lastChoice: o,
    state: i.state ?? "ready",
    error: i.state === "error" ? i.error : void 0,
    rememberChoice: (c) => {
      c !== "claude" && c !== "codex" || (Mt().storage?.setItem(yf, c), s(c));
    },
    manage: () => Mt().command("agents.manage", {})
  }), [i, o]);
}
function sv(l) {
  mt.useEffect(() => Mt().onRequest?.("add-project", l) ?? void 0, [l]);
}
function uv(l) {
  const i = l.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return Ag(i).map((o) => ({ session: o.session, nested: Do(o, i) }));
}
function cv({ id: l, plain: i, className: o }) {
  const s = Ee((_) => _.session(l));
  if (!s) return null;
  const c = s.state ?? Mg(s), d = Ho[c]?.color ?? Ho.unknown.color, p = s.provider, m = p === "claude" || p === "claude-agent-teams" || p === "omp", S = i ? Me("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Me("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return mt.createElement(
    "span",
    { className: S, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    mt.createElement("span", { className: Me("inline-flex text-fg", m && "rounded-full bg-[#161616]") }, mt.createElement(xf, { provider: p, size: 14 }))
  );
}
function xf({ provider: l, size: i = 14 }) {
  const o = Mt().agentIcon?.(l, i) ?? null, s = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return mt.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": l ?? "unknown", "data-perch-markup": s, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const dv = ({ children: l }) => mt.createElement(mt.Fragment, null, l);
function fv(l, i) {
  const o = mt.useRef(i);
  return o.current = i, mt.useEffect(() => {
    const s = Mt();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${l} cannot open`);
    const c = {};
    for (const [p, m] of Object.entries(o.current))
      c[p] = typeof m == "function" ? (...S) => o.current[p]?.(...S) : m;
    const d = s.openOverlay(l, c);
    return () => s.closeOverlay?.(d);
  }, [l]), null;
}
const al = (l) => function(o) {
  return fv(l, o);
}, mv = al("session-menu"), pv = al("new-session-menu"), hv = al("confirm");
let wf = null;
const gv = (l) => {
  wf = l;
};
function vv(l) {
  return mt.createElement(wf ?? hv, l);
}
function bv({ className: l = jg, ...i }) {
  return mt.createElement(Tg, { ...i, className: l });
}
const yv = al("folder-browser"), xv = al("instructions"), wv = al("memory"), _v = kg;
function Sv({ hostId: l, path: i, className: o }) {
  const s = mt.useRef(null);
  return mt.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Me("worktree-menu__btn", ff, o),
      "data-testid": `worktree-menu-${l}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Mt().openOverlay?.("worktree", { hostId: l, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    mt.createElement(hf, null)
  );
}
const zv = (l, i) => Mt().beginReorderDrag?.(l, i), Ev = () => Ee((l) => l.workspaceTabs()), kv = () => Ee((l) => l.statusLine()), Nv = () => Ee((l) => l.zoom()), Tv = () => Ee((l) => l.paneLook()), Cv = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function jv(l) {
  const i = !!l?.keepFresh, o = Ee((c) => c.statusLine?.().connected ?? !1), s = Ee((c) => c.planUsage?.() ?? Cv);
  return mt.useEffect(() => {
    if (!i || !o) return;
    let c;
    const d = () => {
      Mt().command("usage.get"), c = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(c);
  }, [i, o]), s;
}
const Mv = () => Mt().command("usage.get", { force: !0 }), Av = (l) => Mt().command("usage.redeemReset", { accountId: l }), Ov = () => Oi("app.zoom_reset"), Rv = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Hv = (l, i, o) => Mt().beginTabDrag?.(l, i, o);
function Dv(l) {
  mt.useEffect(() => Mt().onRequest?.("new-tab", l) ?? void 0, [l]);
}
const Uv = (l) => Oi("browser.open", { workspaceId: l }), Bv = (l, i) => Oi("file.open", { workspaceId: l, path: i }), qv = () => null, Yv = () => null, Gv = al("new-file"), ab = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: xf,
  Chevron: gf,
  CloseIcon: zg,
  ConfirmDialog: vv,
  Dialog: _v,
  EllipsisIcon: _g,
  FolderBrowser: yv,
  GearIcon: Sg,
  HostStateDot: Eg,
  InstructionsDialog: xv,
  MemoryDialog: wv,
  NewFilePrompt: Gv,
  NewSessionMenu: pv,
  PageIcon: Rg,
  PlusIcon: hf,
  Select: bv,
  SessionDot: cv,
  SessionMenu: mv,
  Slot: dv,
  TabDragLayer: Yv,
  TabMenu: qv,
  WorktreeMenu: Sv,
  agentStateColor: Lg,
  anchoredPopoverStyle: Bg,
  beginReorderDrag: zv,
  beginTabDrag: Hv,
  bindHost: Dg,
  buttonClass: Kg,
  cn: Me,
  drawConfirmationsInPlace: gv,
  ghostButton: Zg,
  iconButton: Jg,
  isMac: qg,
  keyLabel: Yg,
  menuDividerClass: Xg,
  menuItemClass: Vg,
  menuPanel: pf,
  nestSessions: uv,
  openBrowserTab: Uv,
  openFileTab: Bv,
  pickFolder: Ig,
  redeemUsageReset: Av,
  refreshUsage: Mv,
  resetZoom: Ov,
  rowActionClass: Qg,
  runCommand: Oi,
  segmentClass: Gg,
  shortcutFor: Wg,
  startSession: Fg,
  tabStateClass: Rv,
  useAddProject: ev,
  useAddProjectRequest: sv,
  useAgentChoices: ov,
  useDismissOnOutsideClick: vf,
  useHosts: Pg,
  useNavigation: $g,
  useNewTabRequest: Dv,
  useNotifications: rv,
  usePaneLook: Tv,
  usePlanUsage: jv,
  useSessionFolders: tv,
  useStatusLine: kv,
  useWorkspaceTabs: Ev,
  useZoom: Nv,
  version: Hg
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
const Jo = {
  display: (l, i) => i === "hidden" ? l.hidden() : i === "flex" ? l.flex() : l.block(),
  flex_direction: (l, i) => l[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[i]](),
  flex_wrap: (l, i) => i === "wrap" ? l.flex_wrap() : l.flex_nowrap(),
  items: (l, i) => l[`items_${i}`](),
  justify: (l, i) => l[`justify_${i}`](),
  self: (l, i) => i === "auto" ? l : l[`self_${i}`](),
  flex_grow: (l, i) => l.flex_grow(i),
  flex_shrink: (l, i) => l.flex_shrink(i),
  flex_basis: (l, i) => l.flex_basis(i),
  position: (l, i) => i === "absolute" ? l.absolute() : l.relative(),
  overflow_x: (l, i) => i === "hidden" ? l.overflow_x_hidden() : i === "scroll" ? l.overflow_x_scroll() : l,
  overflow_y: (l, i) => i === "hidden" ? l.overflow_y_hidden() : i === "scroll" ? l.overflow_y_scroll() : l,
  visibility: (l, i) => i === "invisible" ? l.invisible() : l.visible(),
  bg: (l, i) => l.bg(i),
  opacity: (l, i) => l.opacity(i),
  shadow: (l, i) => i === "none" ? l.shadow_none() : l[`shadow_${i}`](),
  cursor: (l, i) => l[`cursor_${i}`](),
  border_color: (l, i) => l.border_color(i),
  text_ellipsis: (l, i) => i ? l.text_ellipsis() : l,
  underline: (l, i) => i ? l.underline() : l,
  text_color: (l, i) => l.text_color(i),
  text_size: (l, i) => l.text_size(i),
  font_weight: (l, i) => l.font_weight(i),
  font_family: (l, i) => l.font_family(i),
  font_features: (l, i) => l.font_features(i),
  line_height: (l, i) => l.line_height(i),
  italic: (l, i) => i ? l.italic() : l.not_italic(),
  whitespace: (l, i) => i === "nowrap" ? l.whitespace_nowrap() : l.whitespace_normal(),
  text_align: (l, i) => l[`text_${i}`](),
  rounded: (l, i) => l.rounded(i)
};
for (const l of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  Jo[l] = (i, o) => i[l](o);
const lb = Object.keys(Jo);
function Nd(l, i) {
  for (const [o, s] of Object.entries(i)) {
    const c = Jo[o];
    if (!c) throw new Error(`the description key ${o} has no GPUI builder`);
    s != null && (l = c(l, s));
  }
  return l;
}
const Ma = (l) => ({ clientX: l?.position?.x ?? 0, clientY: l?.position?.y ?? 0 }), Td = /* @__PURE__ */ new WeakSet();
function Cd(l, i, o) {
  const s = l.pressed, c = Ma(o);
  return s && s.x === c.clientX && s.y === c.clientY ? s.id : i;
}
function Qv(l, i, o) {
  if (l.name) return l.name;
  if (!(i.size || l.hover || l.focus || l.active || l.track_hover || o)) return null;
  const s = l.meta?.attrs["data-testid"];
  return s ? `~${l.id}:${s}` : `~${l.id}`;
}
const Ae = (l) => l.style?.display !== "hidden";
function Uo(l, i, o, s, c = !1, d = !1, p = null, m = {}, S = !1, _ = /* @__PURE__ */ new Map()) {
  if (l.kind === "text") return _.get(l)?.text ?? l.text;
  const R = Td.has(l);
  d ||= l.style.opacity === 0 || l.style.visibility === "invisible", d && (l.name || l.range_name) && (l = { ...l, name: void 0, range_name: void 0 }), p = l.style.text_color ?? p;
  const A = !!l.hover?.text_color && Ef(l);
  A && o.hovered?.(l.id) && (p = l.hover.text_color), m = { ...m };
  for (const C of ["text_size", "line_height", "whitespace", "text_ellipsis"]) l.style[C] !== void 0 && (m[C] = l.style[C]);
  const E = new Set(l.events ?? []);
  let y;
  l.kind === "image" && !l.markup ? y = i.image(l.src) : y = i.div(), l.markup && (y = y.child(s.icon(`~icon-${l.id}`, l.markup, l.kind === "svg" ? p : "")));
  const z = Qv(l, E, c);
  z && (y = y.id(z)), y = Nd(y, { ...l.style, ..._.get(l) });
  const w = m.whitespace !== "nowrap" && !m.text_ellipsis;
  S && w && l.style.flex_shrink !== 0 && l.style.min_w === void 0 && (l.children ?? []).some((C) => C.kind === "text") && (y = y.min_w(0));
  for (const C of ["hover", "focus", "active"]) l[C] && (y = y[C]((x) => Nd(x, l[C])));
  if (i.scroll && (l.style.overflow_x === "scroll" || l.style.overflow_y === "scroll")) {
    const C = o.document?.scrollTarget, x = C ? (l.children ?? []).filter(Ae).findIndex((h) => zf(h, C.id)) : -1;
    if (x >= 0 && (o.scroller ?? l.id) === l.id && (o.document.scrollTarget = null, o.scroller = l.id, i.scroll.scroll_to_item(x)), o.scroller ??= l.id, o.scroller === l.id && o.document) {
      y = y.track_scroll(i.scroll);
      const h = (l.children ?? []).filter(Ae).map((Y) => Y.id);
      o.document.itemBounds = (Y) => h.includes(Y) ? i.scroll.item_bounds?.(h.indexOf(Y)) ?? null : null;
    }
  }
  l.kind === "input" && !l.disabled && (y = y.on_mouse_down("left", (C, x) => {
    o.focus(l.id), x.notify();
  }));
  const k = l.kind === "input" ? l : l.meta?.tag === "label" ? Sf(l) : null;
  k && !k.disabled && /^(checkbox|radio)$/.test(k.input_type) && (y = y.on_click((C, x) => {
    x.stop_propagation?.(), o.toggle(k.id), x.notify();
  }));
  const H = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((C) => E.has(C));
  if (H || R) for (const C of l.children ?? []) C.kind !== "text" && Td.add(C);
  if (H && (y = y.on_mouse_down("left", (C, x) => {
    x.stop_propagation?.(), C.bounds && o.setBounds(l.id, C.bounds);
    const h = { ...Ma(C), button: 0, buttons: 1, detail: C.click_count }, Y = Cd(o, l.id, C);
    o.pressed = null, o.dispatch(Y, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(Y, "mousedown", h), x.notify();
  }), y = y.on_mouse_down("right", (C, x) => {
    x.stop_propagation?.(), C.bounds && o.setBounds(l.id, C.bounds);
    const h = Cd(o, l.id, C);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Ma(C), button: 2 }), x.notify();
  }), y = y.on_mouse_up("left", (C, x) => {
    x.stop_propagation?.();
    const h = { ...Ma(C), button: 0 };
    o.dispatch(l.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(l.id, "mouseup", h), x.notify();
  }), y = y.on_click((C, x) => {
    o.dispatch(l.id, C.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: C.click_count, button: 0 }), x.notify();
  })), l.blocks_pointer && !H)
    for (const C of ["left", "right"]) y = y.on_mouse_down(C, (x, h) => h.stop_propagation?.());
  else if (R && !H)
    for (const C of ["left", "right"])
      y = y.on_mouse_down(C, (x) => {
        const h = Ma(x);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: l.id, x: h.clientX, y: h.clientY });
      });
  if (E.has("mouse_move") && (y = y.on_mouse_move((C, x) => {
    o.dispatch(l.id, "pointermove", { ...Ma(C), pointerType: "mouse" }), x.notify();
  })), (l.track_hover || A) && (y = y.on_hover((C, x) => {
    o.hover(l.id, C), x.notify();
  })), c && (y = y.on_mouse_down_out((C, x) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Ma(C), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Ma(C)), x.notify();
  })), l.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(l.input_type)) {
    const C = l.value ? String(l.value) : String(l.placeholder ?? "");
    let x = i.div().whitespace_nowrap().overflow_x_hidden();
    const h = tl(m);
    h && (x = x.h(h)), !l.value && p && (x = x.text_color(Vv(p))), C && (y = y.child(x.child(l.input_type === "password" && l.value ? "•".repeat([...C].length) : C))), l.field_w && (y = y.child(i.div().w(l.field_w).h(0)));
  }
  const b = m.whitespace === "nowrap" ? tl(m) : null, N = l.style.display === "flex" && !String(l.style.flex_direction ?? "row").startsWith("col");
  let U = !l.range_name;
  const q = l.style.display === "flex" && String(l.style.flex_direction ?? "row").startsWith("col") && (l.style.h === void 0 || l.style.h === "auto") && typeof l.style.max_h == "number";
  for (const C of (l.children ?? []).filter(Ae)) {
    const x = C.style?.flex_basis;
    q && C.style.flex_grow > 0 && (x === 0 || typeof x == "string" && x.endsWith("%")) && _.set(C, { ..._.get(C), flex_basis: "auto" });
    let h = Uo(C, i, o, s, !1, d, p, m, N && C.style?.position !== "absolute", _);
    const Y = !U && (C.kind === "text" || !C.meta), I = C.kind === "text" ? _.get(C)?.h ?? b : null, ft = C.kind === "text" ? _.get(C)?.w : void 0;
    if (Y || I || ft !== void 0) {
      let rt = i.div();
      Y && (rt = rt.id(l.range_name)), Y && !N && l.style.display === "flex" && (rt = rt[`self_${Kv[m.text_align] ?? "start"}`]().max_w("100%")), I && (rt = rt.h(I)), ft !== void 0 && (rt = rt.w(ft).flex_none().whitespace_nowrap()), h = rt.child(h), U ||= Y;
    }
    y = y.child(h);
  }
  return y;
}
const Kv = { center: "center", right: "end", end: "end" };
function Vv(l) {
  const i = String(l);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return l;
  const o = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const _f = /^[!-,.-~]+$/, Sf = (l) => {
  for (const i of l.children ?? []) {
    if (i.kind === "input" && /^(checkbox|radio)$/.test(i.input_type)) return i;
    const o = i.kind === "text" ? null : Sf(i);
    if (o) return o;
  }
  return null;
}, zf = (l, i) => l.id === i || (l.children ?? []).some((o) => o.kind !== "text" && zf(o, i)), Ef = (l) => !!l.markup || (l.children ?? []).some((i) => i.kind !== "text" && Ef(i));
function tl(l) {
  const i = l.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof l.text_size == "number" ? i * l.text_size : null;
}
function nb(l, i, o, s, c = 0) {
  const d = [l.root, ...l.overlays], p = c > 0 ? Iv(d, c) : /* @__PURE__ */ new Map();
  c > 0 && s.measure && Xv(d, c, s.measure, p), Wv(d, p), Lv(d, p), s.measure && Jv(d, s.measure, p);
  let m = i.div().relative().size_full().child(Uo(l.root, i, o, s, !1, !1, null, {}, !1, p));
  for (const S of l.overlays) m = m.child(Uo(S, i, o, s, !0, !1, null, {}, !1, p));
  return m;
}
function Xv(l, i, o, s) {
  const c = (z, w) => s.set(z, { ...s.get(z), ...w }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function S(z, w, k) {
    if (z.kind === "text") {
      if (!(w.whitespace === "nowrap" || _f.test(z.text)) || w.text_ellipsis || k || typeof w.text_size != "number") return NaN;
      const x = o(z.text, { size: w.text_size, weight: w.font_weight ?? 400, family: w.font_family ?? ".SystemUIFont", italic: !!w.italic });
      return Number.isFinite(x) ? x : NaN;
    }
    if (!Ae(z) || z.kind === "input" || z.markup) return _(z);
    const H = { ...w };
    for (const C of m) z.style[C] !== void 0 && (H[C] = z.style[C]);
    p.set(z, H);
    const b = z.style, N = (z.children ?? []).filter(Je), U = N.map((C) => S(C, H, k || !!z.tabular));
    let q = _(z);
    if (!Number.isFinite(q) && b.w === void 0) {
      const C = N.map((h, Y) => U[Y] + (h.kind === "text" ? 0 : F(h.style.ml) + F(h.style.mr)));
      let x;
      N.length ? Ye(z) ? x = N.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || b.flex_wrap === "wrap" ? NaN : C.reduce((h, Y) => h + Y, 0) + F(b.gap_x) * (N.length - 1) : x = Math.max(...C) : x = 0, q = x + F(b.pl) + F(b.pr) + F(b.border_l) + F(b.border_r), typeof b.min_w == "number" && (q = Math.max(q, b.min_w)), typeof b.max_w == "number" && (q = Math.min(q, b.max_w));
    }
    return d.set(z, q), q;
  }
  const _ = (z) => typeof z.style?.w == "number" ? z.style.w : NaN, R = () => ({ exact: 0, laid: 0 }), A = (z, w) => {
    if (!Number.isFinite(w))
      return Object.assign(z, R()), NaN;
    z.exact += w;
    const k = Math.round(z.exact * i + 1e-9) / i, H = k - z.laid;
    return z.laid = k, H;
  }, E = (z) => Ye(z) && z.style.flex_wrap !== "wrap" && (z.style.justify ?? "start") === "start";
  function y(z) {
    if (!z || z.kind === "text" || !Ae(z)) return;
    const w = (z.children ?? []).filter(Je);
    if (E(z) && w.length > 1) {
      const k = F(z.style.gap_x), H = R(), b = !(k && w.some((N) => N.kind === "text"));
      c(z, { border_l: A(H, F(z.style.border_l)), pl: A(H, F(z.style.pl)) }), b && k && c(z, { gap_x: 0 }), w.forEach((N, U) => {
        const q = (U && b ? k : 0) + (N.kind === "text" ? 0 : F(N.style.ml));
        if (N.kind === "text")
          q && Object.assign(H, R());
        else {
          const Y = A(H, q);
          Number.isFinite(Y) && c(N, { ml: Y });
        }
        const C = N.kind === "text" ? p.get(z) ?? {} : null, x = N.kind === "text" ? S(N, C, !!z.tabular) : d.get(N);
        if ((N.kind === "text" || !(N.style.flex_grow > 0)) && Number.isFinite(x) ? c(N, { w: A(H, x) }) : Object.assign(H, R()), N.kind !== "text") {
          const Y = A(H, F(N.style.mr));
          Number.isFinite(Y) && c(N, { mr: Y });
        }
      });
    }
    for (const k of z.children ?? []) k.kind !== "text" && y(k);
  }
  for (const z of l)
    z && (S(z, {}, !1), y(z));
}
const Zv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Jv(l, i, o) {
  const s = ["text_size", "font_weight", "font_family", "italic", "line_height"], c = (m) => typeof m == "number" ? m : 0, d = (m, S) => S && Ci(S) && !Ye(S) && m.style.position !== "absolute" && !["start", "center", "end"].includes(m.style.self) && !["start", "center", "end"].includes(S.style.items), p = (m, S, _, R) => {
    if (!m || m.kind === "text" || !Ae(m)) return;
    const A = m.style;
    let E = typeof A.w == "number" ? A.w : A.w === "100%" ? _ : d(m, S) ? _ - c(A.ml) - c(A.mr) : NaN;
    typeof A.max_w == "number" && (E = Math.min(E, A.max_w));
    const y = E - c(A.pl) - c(A.pr) - c(A.border_l) - c(A.border_r), z = { ...R };
    for (const k of s) A[k] !== void 0 && (z[k] = A[k]);
    const w = m.children ?? [];
    if (m.break_anywhere && Number.isFinite(y) && y > 0 && typeof z.text_size == "number" && w.length && w.every((k) => k.kind === "text")) {
      const k = { size: z.text_size, weight: z.font_weight ?? 400, family: z.font_family ?? ".SystemUIFont", italic: !!z.italic }, H = (U) => i(U.trimEnd(), k) <= y + 0.01;
      let b = 0;
      for (const U of w) {
        const q = [];
        for (const x of U.text.split(`
`)) {
          let h = "";
          for (const Y of x.split(Zv)) {
            if (H(h + Y)) {
              h += Y;
              continue;
            }
            h && q.push(h.trimEnd()), h = "";
            for (const I of Y)
              h && !H(h + I) && (q.push(h), h = ""), h += I;
          }
          q.push(h.trimEnd());
        }
        const C = q.join(`
`);
        q.every((x) => !x || H(x)) ? C !== U.text && o.set(U, { ...o.get(U), text: C }) : b = NaN, b += q.length;
      }
      const N = tl(z);
      Number.isFinite(b) && N && A.h === void 0 && w.length === 1 && o.set(m, { ...o.get(m), h: b * N + c(A.pt) + c(A.pb) + c(A.border_t) + c(A.border_b) });
    }
    for (const k of w) p(k, m, Ye(m) ? NaN : y, z);
  };
  for (const m of l) p(m, null, NaN, {});
}
function Lv(l, i) {
  const o = (s, c) => {
    if (!s || s.kind === "text" || !Ae(s)) return;
    const d = s.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : c && typeof d.w != "number";
    if (p && Ye(s))
      for (const m of s.children ?? []) {
        const S = m.kind === "text" ? void 0 : m.style.flex_basis;
        m.kind !== "text" && m.style.flex_grow > 0 && (S === 0 || typeof S == "string" && S.endsWith("%")) && i.set(m, { ...i.get(m), flex_basis: "auto" });
      }
    for (const m of s.children ?? []) o(m, p);
  };
  for (const s of l) o(s, !1);
}
function Wv(l, i) {
  const o = i.heights ?? /* @__PURE__ */ new Map(), s = (m) => o.get(m), c = (m) => {
    const S = m.style, _ = (m.children ?? []).filter(Je);
    if (!_.length || Ye(m)) return NaN;
    let R = 0;
    for (const A of _) {
      const E = s(A);
      if (!Number.isFinite(E)) return NaN;
      R += E + (A.kind === "text" ? 0 : F(A.style.mt) + F(A.style.mb));
    }
    return R + (S.display === "flex" ? F(S.gap_y) * (_.length - 1) : 0) + F(S.pt) + F(S.pb);
  }, d = (m, S) => {
    const _ = m.style;
    if (typeof _.h == "number") return _.h;
    if (typeof _.max_h == "number") return _.max_h;
    if (!S || !Ci(S) || Ye(S)) return NaN;
    const R = S.style, A = typeof R.h == "number" ? R.h : typeof R.max_h == "number" ? R.max_h : NaN, E = (S.children ?? []).filter(Je);
    let y = 0;
    for (const w of E) {
      if (w === m) continue;
      const k = s(w);
      if (!Number.isFinite(k)) return NaN;
      y += k + (w.kind === "text" ? 0 : F(w.style.mt) + F(w.style.mb));
    }
    const z = R.display === "flex" ? F(R.gap_y) * Math.max(0, E.length - 1) : 0;
    return A - F(R.pt) - F(R.pb) - F(R.border_t) - F(R.border_b) - y - z - F(_.mt) - F(_.mb);
  }, p = (m, S) => {
    if (!(!m || m.kind === "text" || !Ae(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const _ = c(m), R = d(m, S);
        Number.isFinite(_) && Number.isFinite(R) && _ > R + 0.01 && i.set(m, { ...i.get(m), pr: F(m.style.pr) + m.scrollbar });
      }
      for (const _ of m.children ?? []) p(_, m);
    }
  };
  for (const m of l) p(m, null);
}
const Fv = ["text_size", "line_height", "whitespace", "text_ellipsis"], F = (l) => l == null ? 0 : typeof l == "number" ? l : NaN, Ci = (l) => l.style.display === "flex" ? l.style.flex_direction === "col" : !0, Ye = (l) => l.style.display === "flex" && (l.style.flex_direction ?? "row") === "row", Je = (l) => l.kind === "text" || Ae(l) && l.style.position !== "absolute";
function Iv(l, i) {
  const o = /* @__PURE__ */ new Map(), s = (w, k) => o.set(w, { ...o.get(w), ...Object.fromEntries(Object.entries(k).filter(([, H]) => Number.isFinite(H))) }), c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(w, k) {
    if (w.kind === "text") return k.whitespace === "nowrap" || _f.test(w.text) ? tl(k) ?? NaN : NaN;
    const H = { ...k };
    for (const C of Fv) w.style[C] !== void 0 && (H[C] = w.style[C]);
    d.set(w, H);
    const b = w.style, N = (w.children ?? []).filter(Je), U = N.map((C) => p(C, H));
    let q;
    if (b.h !== void 0 && b.h !== "auto") q = F(b.h);
    else if (w.kind === "input")
      q = (w.input_type === "textarea" || w.input_type === "select" ? NaN : tl(H) ?? NaN) + F(b.pt) + F(b.pb) + F(b.border_t) + F(b.border_b), b.min_h !== void 0 && (q = Math.max(q, F(b.min_h)));
    else {
      const C = N.map((h, Y) => (h.kind === "text" ? 0 : F(h.style.mt) + F(h.style.mb)) + U[Y]);
      let x;
      if (Ye(w)) x = b.flex_wrap === "wrap" ? NaN : b.items === "baseline" ? S(N, U, H) : Math.max(0, ...C);
      else if (Ci(w)) {
        const h = N.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), Y = b.display !== "flex" && N.some((I) => I.kind !== "text" && (F(I.style.mt) || F(I.style.mb)));
        x = h || Y ? NaN : C.reduce((I, ft) => I + ft, 0) + (b.display === "flex" ? F(b.gap_y) * Math.max(0, N.length - 1) : 0);
      } else x = NaN;
      q = x + F(b.pt) + F(b.pb) + F(b.border_t) + F(b.border_b), b.min_h !== void 0 && (q = Math.max(q, F(b.min_h))), b.max_h !== void 0 && (q = Math.min(q, F(b.max_h)));
    }
    return c.set(w, q), q;
  }
  const m = (w) => (tl(w) - (ki + Vd) * w.text_size) / 2 + ki * w.text_size;
  function S(w, k, H) {
    let b = 0, N = 0;
    for (const [U, q] of w.entries()) {
      const C = q.kind === "text" ? H : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Je).every((I) => I.kind === "text")) || !Number.isFinite(k[U]) || typeof C.text_size != "number") return NaN;
      const h = q.kind === "text" ? {} : q.style, Y = F(h.mt) + F(h.border_t) + F(h.pt) + m(C);
      b = Math.max(b, Y), N = Math.max(N, F(h.mt) + k[U] + F(h.mb) - Y);
    }
    return b + N;
  }
  const _ = () => ({ exact: 0, laid: 0 }), R = (w, k) => {
    if (!Number.isFinite(k))
      return Object.assign(w, _()), NaN;
    w.exact += k;
    const H = Math.round(w.exact * i + 1e-9) / i, b = H - w.laid;
    return w.laid = H, b;
  };
  function A(w) {
    if (!(w.kind === "text" || !Ae(w))) {
      for (const k of (w.children ?? []).filter((H) => H.kind !== "text" && Ae(H) && H.style.position === "absolute")) A(k);
      if (Ci(w) && !Ye(w)) {
        const k = _();
        s(w, { border_t: R(k, F(w.style.border_t)), pt: R(k, F(w.style.pt)) }), E(w, k);
      } else for (const k of (w.children ?? []).filter(Je)) k.kind !== "text" && A(k);
    }
  }
  function E(w, k) {
    const H = (w.children ?? []).filter(Je), b = w.style.display === "flex" ? F(w.style.gap_y) : 0;
    if (b && H.some((N) => N.kind === "text")) {
      for (const N of H) N.kind !== "text" && A(N);
      return !1;
    }
    return b && s(w, { gap_y: 0 }), H.forEach((N, U) => {
      if (N.kind === "text") {
        const q = c.get(N) ?? p(N, d.get(w) ?? {});
        Number.isFinite(q) ? s(N, { h: R(k, q) }) : Object.assign(k, _());
        return;
      }
      if (s(N, { mt: R(k, (U ? b : 0) + F(N.style.mt)) }), Number.isFinite(c.get(N))) z(N, k);
      else if (y(N)) {
        const q = N.style;
        s(N, { border_t: R(k, F(q.border_t)), pt: R(k, F(q.pt)) }), s(N, { pb: R(k, F(q.pb)), border_b: R(k, F(q.border_b)) });
      } else
        A(N), Object.assign(k, _());
      s(N, { mb: R(k, F(N.style.mb)) });
    }), !0;
  }
  function y(w) {
    const k = w.style, H = (w.children ?? []).filter(Je), b = tl(d.get(w) ?? {});
    return w.kind === "div" && !Ye(w) && H.length > 0 && H.every((N) => N.kind === "text") && Number.isInteger(b) && [k.h, k.min_h, k.max_h].every((N) => N === void 0 || N === "auto");
  }
  function z(w, k) {
    const H = w.style;
    for (const C of (w.children ?? []).filter((x) => x.kind !== "text" && Ae(x) && x.style.position === "absolute")) A(C);
    const b = k.laid, N = k.exact;
    s(w, { border_t: R(k, F(H.border_t)), pt: R(k, F(H.pt)) });
    const U = H.h !== void 0 && H.h !== "auto", q = c.get(w) - F(H.pt) - F(H.pb) - F(H.border_t) - F(H.border_b);
    if (w.kind === "input")
      U || R(k, q);
    else if (Ye(w) || U && (H.justify ?? "start") !== "start") {
      for (const C of (w.children ?? []).filter(Je)) C.kind !== "text" && A(C);
      U || R(k, q);
    } else !E(w, k) && !U && R(k, q);
    if (U) {
      k.exact = N + c.get(w), k.laid = Math.round(k.exact * i + 1e-9) / i, s(w, { h: k.laid - b });
      return;
    }
    s(w, { pb: R(k, F(H.pb)), border_b: R(k, F(H.border_b)) }), s(w, { h: k.laid - b });
  }
  for (const w of l)
    p(w, {}), A(w);
  return Object.defineProperty(o, "heights", { value: c }), o;
}
const ib = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }] };
export {
  ib as NAMED_ELEMENTS,
  $v as React,
  Bh as SCHEMA,
  lb as STYLE_KEYS,
  nb as describeToGpui,
  Pv as jsxRuntime,
  tb as mount,
  eb as reactDom,
  ab as sdk
};
