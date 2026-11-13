function Ed(n, i) {
  for (var o = 0; o < i.length; o++) {
    const u = i[o];
    if (typeof u != "string" && !Array.isArray(u)) {
      for (const c in u)
        if (c !== "default" && !(c in n)) {
          const f = Object.getOwnPropertyDescriptor(u, c);
          f && Object.defineProperty(n, c, f.get ? f : {
            enumerable: !0,
            get: () => u[c]
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
class _e extends Error {
}
const Ap = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Op = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), Rp = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Ap]);
function wo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, o, u) => o ? String.fromCodePoint(parseInt(o, 16)) : u);
}
function ci(n, i) {
  let o = i;
  for (; o < n.length; ) {
    const u = n[o];
    if (u === "\\") {
      o += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(u)) {
      o++;
      continue;
    }
    break;
  }
  if (o === i) throw new _e(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [wo(n.slice(i, o)), o];
}
function Hp(n, i) {
  let o = 1;
  for (let u = i; u < n.length; u++) {
    const c = n[u];
    if (c === "\\") {
      u++;
      continue;
    }
    if (c === '"' || c === "'") {
      if (u = n.indexOf(c, u + 1), u < 0) break;
      continue;
    }
    if (c === "(") o++;
    else if (c === ")" && --o === 0) return u;
  }
  throw new _e(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Ro(n) {
  const i = [];
  let o = 0, u = 0;
  for (let c = 0; c < n.length; c++) {
    const f = n[c];
    if (f === "\\") {
      c++;
      continue;
    }
    if (f === '"' || f === "'") {
      if (c = n.indexOf(f, c + 1), c < 0) break;
      continue;
    }
    f === "(" || f === "[" ? o++ : f === ")" || f === "]" ? o-- : f === "," && o === 0 && (i.push(n.slice(u, c).trim()), u = c + 1);
  }
  return i.push(n.slice(u).trim()), i.filter(Boolean);
}
function Up(n, i) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let u = !1;
  for (; i < n.length; ) {
    const c = n[i];
    if (c === "*") {
      o.tag = "*", i++, u = !0;
      continue;
    }
    if (c === ".") {
      const [f, m] = ci(n, i + 1);
      o.classes.push(f), i = m, u = !0;
      continue;
    }
    if (c === "#") {
      const [f, m] = ci(n, i + 1);
      o.id = f, i = m, u = !0;
      continue;
    }
    if (c === "[") {
      const f = n.indexOf("]", i);
      if (f < 0) throw new _e(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(i + 1, f).trim(), p = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!p) throw new _e(`cannot read the attribute selector [${m}]`);
      const w = p[3] ?? p[4] ?? p[5];
      o.attrs.push({ name: wo(p[1]).toLowerCase(), op: p[2] ?? null, value: w === void 0 ? null : wo(w) }), i = f + 1, u = !0;
      continue;
    }
    if (c === ":") {
      if (n[i + 1] === ":") throw new _e(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [f, m] = ci(n, i + 1);
      i = m;
      const p = f.toLowerCase();
      if (n[i] === "(") {
        if (!Op.has(p)) throw new _e(`:${p}() is not supported`);
        const w = Hp(n, i + 1), y = n.slice(i + 1, w).trim();
        if (i = w + 1, p === "nth-child") {
          if (!/^\d+$/.test(y)) throw new _e(`:nth-child(${y}) is not supported (only a number)`);
          o.pseudos.push({ name: p, n: Number(y) });
        } else
          o.pseudos.push({ name: p, list: Ro(y).map(Ho) });
      } else {
        if (!Rp.has(p)) throw new _e(`:${p} is not supported`);
        o.pseudos.push({ name: p });
      }
      u = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !u) {
      const [f, m] = ci(n, i);
      o.tag = f.toLowerCase(), i = m, u = !0;
      continue;
    }
    break;
  }
  if (!u) throw new _e(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [o, i];
}
function Ho(n) {
  const i = [];
  let o = 0, u = null;
  for (n = n.trim(); o < n.length; ) {
    const [c, f] = Up(n, o);
    i.push({ compound: c, combinator: u }), o = f;
    let m = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, m = !0;
    if (o >= n.length) break;
    const p = n[o];
    if (p === ">")
      for (u = ">", o++; n[o] === " "; ) o++;
    else {
      if (p === "+" || p === "~") throw new _e(`the ${p} combinator is not supported`);
      if (m) u = " ";
      else throw new _e(`unexpected ${JSON.stringify(p)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new _e("empty selector");
  return i;
}
const Yc = /* @__PURE__ */ new Map();
function Ei(n) {
  let i = Yc.get(n);
  return i || (i = Ro(n).map(Ho), Yc.set(n, i)), i;
}
function kd(n) {
  const i = [0, 0, 0], o = (u) => {
    i[0] += u[0], i[1] += u[1], i[2] += u[2];
  };
  for (const { compound: u } of n) {
    u.id && i[0]++, i[1] += u.classes.length + u.attrs.length, u.tag && u.tag !== "*" && i[2]++;
    for (const c of u.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const f = c.list.map(kd).sort((m, p) => p[0] - m[0] || p[1] - m[1] || p[2] - m[2])[0];
          o(f);
        } else i[1]++;
  }
  return i;
}
function Dp(n, { name: i, op: o, value: u }) {
  const c = n.getAttribute(i);
  if (c == null) return !1;
  if (o === null) return !0;
  switch (o) {
    case "=":
      return c === u;
    case "^=":
      return u !== "" && c.startsWith(u);
    case "$=":
      return u !== "" && c.endsWith(u);
    case "*=":
      return u !== "" && c.includes(u);
    case "~=":
      return c.split(/\s+/).includes(u);
    case "|=":
      return c === u || c.startsWith(`${u}-`);
    default:
      return !1;
  }
}
function di(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Bp(n, i, o, u) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const c = n.classList ?? [];
    for (const f of i.classes) if (!c.includes(f)) return !1;
  }
  for (const c of i.attrs) if (!Dp(n, c)) return !1;
  for (const c of i.pseudos)
    switch (c.name) {
      case "first-child":
        if (di(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (di(n).length !== 1) return !1;
        break;
      case "last-child": {
        const f = di(n);
        if (f[f.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (di(n).indexOf(n) !== c.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((f) => kl(n, f, o, u))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((f) => kl(n, f, o, u))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, c.name, u)) return !1;
    }
  return !0;
}
function kl(n, i, o, u = !0) {
  const c = (f, m, p) => {
    const { compound: w, combinator: y } = i[m];
    if (!Bp(f, w, o, p)) return !1;
    if (m === 0) return !0;
    if (y === ">") return !!f.parentElement && c(f.parentElement, m - 1, !1);
    for (let H = f.parentElement; H; H = H.parentElement) if (c(H, m - 1, !1)) return !0;
    return !1;
  };
  return c(n, i.length - 1, u);
}
function qp(n, i, o = {}) {
  return (typeof i == "string" ? Ei(i) : i).some((c) => kl(n, c, o));
}
function Nd(n, i, o = {}) {
  return kl(n, i, o);
}
function bi(n, i, o = {}) {
  const u = Ei(i), c = [], f = (m) => {
    for (const p of m.children)
      u.some((w) => kl(p, w, o)) && c.push(p), f(p);
  };
  return f(n), c;
}
function Td(n, i, o = {}) {
  const u = Ei(i);
  for (let c = n; c; c = c.parentElement) if (u.some((f) => kl(c, f, o))) return c;
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
let Yp = 1;
class _o {
  constructor(i = 0, o = 0, u = 0, c = 0) {
    this.x = i, this.y = o, this.width = u, this.height = c;
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
class Uo {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, o, u) {
    const c = u === !0 || !!u?.capture;
    this.listeners.some((f) => f.type === i && f.listener === o && f.capture === c) || this.listeners.push({ type: i, listener: o, capture: c });
  }
  removeEventListener(i, o, u) {
    const c = u === !0 || !!u?.capture;
    this.listeners = this.listeners.filter((f) => !(f.type === i && f.listener === o && f.capture === c));
  }
}
class Do {
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
class Se extends Uo {
  constructor(i, o = {}, u = null) {
    super(), this.nodeType = 1, this.id = `n${Yp++}`, this.tagName = i.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = u, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof Se ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((i) => i instanceof Se);
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
    for (const [o, u] of Object.entries(this.props))
      o.startsWith("data-") && u != null && u !== !1 && (i[o.slice(5).replace(/-([a-z])/g, (c, f) => f.toUpperCase())] = String(u));
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
      const f = i.replace(/-([a-z])/g, (m, p) => p.toUpperCase());
      c = o[f];
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
    const u = this.childNodes.indexOf(o);
    return i.parentNode = this, u < 0 ? this.childNodes.push(i) : this.childNodes.splice(u, 0, i), this.touch(), i;
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
    return qp(this, i);
  }
  closest(i) {
    return Td(this, i);
  }
  querySelectorAll(i) {
    return bi(this, i);
  }
  querySelector(i) {
    return bi(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.bounds;
    return i ? new _o(i.x, i.y, i.width, i.height) : new _o();
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
  /** Asks the scroll area around this element to show it (`toGpui`, on the next frame: the engine scrolls by the
   * fewest pixels, as `{ inline: "nearest", block: "nearest" }`, whatever the options). */
  scrollIntoView() {
    this.ownerDocument && (this.ownerDocument.scrollTarget = this);
  }
}
class Gp {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Qp {
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
function Gc(n) {
  for (let i = n; i instanceof Se; i = i.parentElement) i.touch();
}
class Vp extends Uo {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new Se("html", {}, this), this.body = new Se("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new Se(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Gc(i);
  }
  blur(i) {
    i.state.focus = !1, Gc(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return bi(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
}
class Kp extends Uo {
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
  setTimeout(i, o, ...u) {
    return globalThis.setTimeout(i, o, ...u);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function Cd(n) {
  return {
    setTimeout: (i, o = 0, ...u) => n.setTimeout(() => i(...u), Math.max(0, Number(o) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
function Ce(n, i, o) {
  Object.defineProperty(n, i, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function Xp(n, i = globalThis) {
  const o = new Vp(n), u = new Kp(n, o);
  o.defaultView = u;
  const c = n.storage ?? new Qp();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const m = Cd(n);
    Ce(i, "setTimeout", m.setTimeout), Ce(i, "clearTimeout", m.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && Ce(i, "queueMicrotask", (m) => {
    Promise.resolve().then(m);
  }), Ce(i, "document", o), Ce(i, "window", u), Ce(i, "localStorage", c), Ce(i, "HTMLElement", Se), Ce(i, "Element", Se), Ce(i, "DOMRect", _o), typeof i.ResizeObserver != "function" && Ce(i, "ResizeObserver", Gp);
  const f = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!f.clipboard && n.clipboard)
    try {
      Ce(f, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || Ce(i, "navigator", f), { document: o, window: u };
}
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Qc = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Qc?.setTimeout == "function") {
  const n = Cd(Qc);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Bo(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var fo = { exports: {} }, nt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Vc;
function Zp() {
  if (Vc) return nt;
  Vc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), u = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), f = Symbol.for("react.consumer"), m = Symbol.for("react.context"), p = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), H = Symbol.for("react.lazy"), R = Symbol.for("react.activity"), g = Symbol.iterator;
  function E(v) {
    return v === null || typeof v != "object" ? null : (v = g && v[g] || v["@@iterator"], typeof v == "function" ? v : null);
  }
  var b = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, j = Object.assign, A = {};
  function M(v, D, $) {
    this.props = v, this.context = D, this.refs = A, this.updater = $ || b;
  }
  M.prototype.isReactComponent = {}, M.prototype.setState = function(v, D) {
    if (typeof v != "object" && typeof v != "function" && v != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, v, D, "setState");
  }, M.prototype.forceUpdate = function(v) {
    this.updater.enqueueForceUpdate(this, v, "forceUpdate");
  };
  function z() {
  }
  z.prototype = M.prototype;
  function C(v, D, $) {
    this.props = v, this.context = D, this.refs = A, this.updater = $ || b;
  }
  var O = C.prototype = new z();
  O.constructor = C, j(O, M.prototype), O.isPureReactComponent = !0;
  var X = Array.isArray;
  function K() {
  }
  var N = { H: null, A: null, T: null, S: null }, S = Object.prototype.hasOwnProperty;
  function G(v, D, $) {
    var W = $.ref;
    return {
      $$typeof: n,
      type: v,
      key: D,
      ref: W !== void 0 ? W : null,
      props: $
    };
  }
  function ut(v, D) {
    return G(v.type, D, v.props);
  }
  function xt(v) {
    return typeof v == "object" && v !== null && v.$$typeof === n;
  }
  function zt(v) {
    var D = { "=": "=0", ":": "=2" };
    return "$" + v.replace(/[=:]/g, function($) {
      return D[$];
    });
  }
  var Rt = /\/+/g;
  function Ft(v, D) {
    return typeof v == "object" && v !== null && v.key != null ? zt("" + v.key) : D.toString(36);
  }
  function Tt(v) {
    switch (v.status) {
      case "fulfilled":
        return v.value;
      case "rejected":
        throw v.reason;
      default:
        switch (typeof v.status == "string" ? v.then(K, K) : (v.status = "pending", v.then(
          function(D) {
            v.status === "pending" && (v.status = "fulfilled", v.value = D);
          },
          function(D) {
            v.status === "pending" && (v.status = "rejected", v.reason = D);
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
  function B(v, D, $, W, F) {
    var P = typeof v;
    (P === "undefined" || P === "boolean") && (v = null);
    var gt = !1;
    if (v === null) gt = !0;
    else
      switch (P) {
        case "bigint":
        case "string":
        case "number":
          gt = !0;
          break;
        case "object":
          switch (v.$$typeof) {
            case n:
            case i:
              gt = !0;
              break;
            case H:
              return gt = v._init, B(
                gt(v._payload),
                D,
                $,
                W,
                F
              );
          }
      }
    if (gt)
      return F = F(v), gt = W === "" ? "." + Ft(v, 0) : W, X(F) ? ($ = "", gt != null && ($ = gt.replace(Rt, "$&/") + "/"), B(F, D, $, "", function(Ta) {
        return Ta;
      })) : F != null && (xt(F) && (F = ut(
        F,
        $ + (F.key == null || v && v.key === F.key ? "" : ("" + F.key).replace(
          Rt,
          "$&/"
        ) + "/") + gt
      )), D.push(F)), 1;
    gt = 0;
    var Zt = W === "" ? "." : W + ":";
    if (X(v))
      for (var rt = 0; rt < v.length; rt++)
        W = v[rt], P = Zt + Ft(W, rt), gt += B(
          W,
          D,
          $,
          P,
          F
        );
    else if (rt = E(v), typeof rt == "function")
      for (v = rt.call(v), rt = 0; !(W = v.next()).done; )
        W = W.value, P = Zt + Ft(W, rt++), gt += B(
          W,
          D,
          $,
          P,
          F
        );
    else if (P === "object") {
      if (typeof v.then == "function")
        return B(
          Tt(v),
          D,
          $,
          W,
          F
        );
      throw D = String(v), Error(
        "Objects are not valid as a React child (found: " + (D === "[object Object]" ? "object with keys {" + Object.keys(v).join(", ") + "}" : D) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return gt;
  }
  function I(v, D, $) {
    if (v == null) return v;
    var W = [], F = 0;
    return B(v, W, "", "", function(P) {
      return D.call($, P, F++);
    }), W;
  }
  function at(v) {
    if (v._status === -1) {
      var D = v._result;
      D = D(), D.then(
        function($) {
          (v._status === 0 || v._status === -1) && (v._status = 1, v._result = $);
        },
        function($) {
          (v._status === 0 || v._status === -1) && (v._status = 2, v._result = $);
        }
      ), v._status === -1 && (v._status = 0, v._result = D);
    }
    if (v._status === 1) return v._result.default;
    throw v._result;
  }
  var it = typeof reportError == "function" ? reportError : function(v) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var D = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof v == "object" && v !== null && typeof v.message == "string" ? String(v.message) : String(v),
        error: v
      });
      if (!window.dispatchEvent(D)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", v);
      return;
    }
    console.error(v);
  }, Q = {
    map: I,
    forEach: function(v, D, $) {
      I(
        v,
        function() {
          D.apply(this, arguments);
        },
        $
      );
    },
    count: function(v) {
      var D = 0;
      return I(v, function() {
        D++;
      }), D;
    },
    toArray: function(v) {
      return I(v, function(D) {
        return D;
      }) || [];
    },
    only: function(v) {
      if (!xt(v))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return v;
    }
  };
  return nt.Activity = R, nt.Children = Q, nt.Component = M, nt.Fragment = o, nt.Profiler = c, nt.PureComponent = C, nt.StrictMode = u, nt.Suspense = w, nt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = N, nt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(v) {
      return N.H.useMemoCache(v);
    }
  }, nt.cache = function(v) {
    return function() {
      return v.apply(null, arguments);
    };
  }, nt.cacheSignal = function() {
    return null;
  }, nt.cloneElement = function(v, D, $) {
    if (v == null)
      throw Error(
        "The argument must be a React element, but you passed " + v + "."
      );
    var W = j({}, v.props), F = v.key;
    if (D != null)
      for (P in D.key !== void 0 && (F = "" + D.key), D)
        !S.call(D, P) || P === "key" || P === "__self" || P === "__source" || P === "ref" && D.ref === void 0 || (W[P] = D[P]);
    var P = arguments.length - 2;
    if (P === 1) W.children = $;
    else if (1 < P) {
      for (var gt = Array(P), Zt = 0; Zt < P; Zt++)
        gt[Zt] = arguments[Zt + 2];
      W.children = gt;
    }
    return G(v.type, F, W);
  }, nt.createContext = function(v) {
    return v = {
      $$typeof: m,
      _currentValue: v,
      _currentValue2: v,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, v.Provider = v, v.Consumer = {
      $$typeof: f,
      _context: v
    }, v;
  }, nt.createElement = function(v, D, $) {
    var W, F = {}, P = null;
    if (D != null)
      for (W in D.key !== void 0 && (P = "" + D.key), D)
        S.call(D, W) && W !== "key" && W !== "__self" && W !== "__source" && (F[W] = D[W]);
    var gt = arguments.length - 2;
    if (gt === 1) F.children = $;
    else if (1 < gt) {
      for (var Zt = Array(gt), rt = 0; rt < gt; rt++)
        Zt[rt] = arguments[rt + 2];
      F.children = Zt;
    }
    if (v && v.defaultProps)
      for (W in gt = v.defaultProps, gt)
        F[W] === void 0 && (F[W] = gt[W]);
    return G(v, P, F);
  }, nt.createRef = function() {
    return { current: null };
  }, nt.forwardRef = function(v) {
    return { $$typeof: p, render: v };
  }, nt.isValidElement = xt, nt.lazy = function(v) {
    return {
      $$typeof: H,
      _payload: { _status: -1, _result: v },
      _init: at
    };
  }, nt.memo = function(v, D) {
    return {
      $$typeof: y,
      type: v,
      compare: D === void 0 ? null : D
    };
  }, nt.startTransition = function(v) {
    var D = N.T, $ = {};
    N.T = $;
    try {
      var W = v(), F = N.S;
      F !== null && F($, W), typeof W == "object" && W !== null && typeof W.then == "function" && W.then(K, it);
    } catch (P) {
      it(P);
    } finally {
      D !== null && $.types !== null && (D.types = $.types), N.T = D;
    }
  }, nt.unstable_useCacheRefresh = function() {
    return N.H.useCacheRefresh();
  }, nt.use = function(v) {
    return N.H.use(v);
  }, nt.useActionState = function(v, D, $) {
    return N.H.useActionState(v, D, $);
  }, nt.useCallback = function(v, D) {
    return N.H.useCallback(v, D);
  }, nt.useContext = function(v) {
    return N.H.useContext(v);
  }, nt.useDebugValue = function() {
  }, nt.useDeferredValue = function(v, D) {
    return N.H.useDeferredValue(v, D);
  }, nt.useEffect = function(v, D) {
    return N.H.useEffect(v, D);
  }, nt.useEffectEvent = function(v) {
    return N.H.useEffectEvent(v);
  }, nt.useId = function() {
    return N.H.useId();
  }, nt.useImperativeHandle = function(v, D, $) {
    return N.H.useImperativeHandle(v, D, $);
  }, nt.useInsertionEffect = function(v, D) {
    return N.H.useInsertionEffect(v, D);
  }, nt.useLayoutEffect = function(v, D) {
    return N.H.useLayoutEffect(v, D);
  }, nt.useMemo = function(v, D) {
    return N.H.useMemo(v, D);
  }, nt.useOptimistic = function(v, D) {
    return N.H.useOptimistic(v, D);
  }, nt.useReducer = function(v, D, $) {
    return N.H.useReducer(v, D, $);
  }, nt.useRef = function(v) {
    return N.H.useRef(v);
  }, nt.useState = function(v) {
    return N.H.useState(v);
  }, nt.useSyncExternalStore = function(v, D, $) {
    return N.H.useSyncExternalStore(
      v,
      D,
      $
    );
  }, nt.useTransition = function() {
    return N.H.useTransition();
  }, nt.version = "19.2.8", nt;
}
var Kc;
function jd() {
  return Kc || (Kc = 1, fo.exports = Zp()), fo.exports;
}
var kt = jd();
const Jp = /* @__PURE__ */ Bo(kt), vv = /* @__PURE__ */ Ed({
  __proto__: null,
  default: Jp
}, [kt]);
var mo = { exports: {} }, ln = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Xc;
function Lp() {
  if (Xc) return ln;
  Xc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function o(u, c, f) {
    var m = null;
    if (f !== void 0 && (m = "" + f), c.key !== void 0 && (m = "" + c.key), "key" in c) {
      f = {};
      for (var p in c)
        p !== "key" && (f[p] = c[p]);
    } else f = c;
    return c = f.ref, {
      $$typeof: n,
      type: u,
      key: m,
      ref: c !== void 0 ? c : null,
      props: f
    };
  }
  return ln.Fragment = i, ln.jsx = o, ln.jsxs = o, ln;
}
var Zc;
function Wp() {
  return Zc || (Zc = 1, mo.exports = Lp()), mo.exports;
}
var Gt = Wp();
const Fp = /* @__PURE__ */ Bo(Gt), bv = /* @__PURE__ */ Ed({
  __proto__: null,
  default: Fp
}, [Gt]);
var po = { exports: {} }, ho = { exports: {} }, go = { exports: {} }, vo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Jc;
function Ip() {
  return Jc || (Jc = 1, (function(n) {
    function i(B, I) {
      var at = B.length;
      B.push(I);
      t: for (; 0 < at; ) {
        var it = at - 1 >>> 1, Q = B[it];
        if (0 < c(Q, I))
          B[it] = I, B[at] = Q, at = it;
        else break t;
      }
    }
    function o(B) {
      return B.length === 0 ? null : B[0];
    }
    function u(B) {
      if (B.length === 0) return null;
      var I = B[0], at = B.pop();
      if (at !== I) {
        B[0] = at;
        t: for (var it = 0, Q = B.length, v = Q >>> 1; it < v; ) {
          var D = 2 * (it + 1) - 1, $ = B[D], W = D + 1, F = B[W];
          if (0 > c($, at))
            W < Q && 0 > c(F, $) ? (B[it] = F, B[W] = at, it = W) : (B[it] = $, B[D] = at, it = D);
          else if (W < Q && 0 > c(F, at))
            B[it] = F, B[W] = at, it = W;
          else break t;
        }
      }
      return I;
    }
    function c(B, I) {
      var at = B.sortIndex - I.sortIndex;
      return at !== 0 ? at : B.id - I.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var f = performance;
      n.unstable_now = function() {
        return f.now();
      };
    } else {
      var m = Date, p = m.now();
      n.unstable_now = function() {
        return m.now() - p;
      };
    }
    var w = [], y = [], H = 1, R = null, g = 3, E = !1, b = !1, j = !1, A = !1, M = typeof setTimeout == "function" ? setTimeout : null, z = typeof clearTimeout == "function" ? clearTimeout : null, C = typeof setImmediate < "u" ? setImmediate : null;
    function O(B) {
      for (var I = o(y); I !== null; ) {
        if (I.callback === null) u(y);
        else if (I.startTime <= B)
          u(y), I.sortIndex = I.expirationTime, i(w, I);
        else break;
        I = o(y);
      }
    }
    function X(B) {
      if (j = !1, O(B), !b)
        if (o(w) !== null)
          b = !0, K || (K = !0, zt());
        else {
          var I = o(y);
          I !== null && Tt(X, I.startTime - B);
        }
    }
    var K = !1, N = -1, S = 5, G = -1;
    function ut() {
      return A ? !0 : !(n.unstable_now() - G < S);
    }
    function xt() {
      if (A = !1, K) {
        var B = n.unstable_now();
        G = B;
        var I = !0;
        try {
          t: {
            b = !1, j && (j = !1, z(N), N = -1), E = !0;
            var at = g;
            try {
              e: {
                for (O(B), R = o(w); R !== null && !(R.expirationTime > B && ut()); ) {
                  var it = R.callback;
                  if (typeof it == "function") {
                    R.callback = null, g = R.priorityLevel;
                    var Q = it(
                      R.expirationTime <= B
                    );
                    if (B = n.unstable_now(), typeof Q == "function") {
                      R.callback = Q, O(B), I = !0;
                      break e;
                    }
                    R === o(w) && u(w), O(B);
                  } else u(w);
                  R = o(w);
                }
                if (R !== null) I = !0;
                else {
                  var v = o(y);
                  v !== null && Tt(
                    X,
                    v.startTime - B
                  ), I = !1;
                }
              }
              break t;
            } finally {
              R = null, g = at, E = !1;
            }
            I = void 0;
          }
        } finally {
          I ? zt() : K = !1;
        }
      }
    }
    var zt;
    if (typeof C == "function")
      zt = function() {
        C(xt);
      };
    else if (typeof MessageChannel < "u") {
      var Rt = new MessageChannel(), Ft = Rt.port2;
      Rt.port1.onmessage = xt, zt = function() {
        Ft.postMessage(null);
      };
    } else
      zt = function() {
        M(xt, 0);
      };
    function Tt(B, I) {
      N = M(function() {
        B(n.unstable_now());
      }, I);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(B) {
      B.callback = null;
    }, n.unstable_forceFrameRate = function(B) {
      0 > B || 125 < B ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : S = 0 < B ? Math.floor(1e3 / B) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return g;
    }, n.unstable_next = function(B) {
      switch (g) {
        case 1:
        case 2:
        case 3:
          var I = 3;
          break;
        default:
          I = g;
      }
      var at = g;
      g = I;
      try {
        return B();
      } finally {
        g = at;
      }
    }, n.unstable_requestPaint = function() {
      A = !0;
    }, n.unstable_runWithPriority = function(B, I) {
      switch (B) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          B = 3;
      }
      var at = g;
      g = B;
      try {
        return I();
      } finally {
        g = at;
      }
    }, n.unstable_scheduleCallback = function(B, I, at) {
      var it = n.unstable_now();
      switch (typeof at == "object" && at !== null ? (at = at.delay, at = typeof at == "number" && 0 < at ? it + at : it) : at = it, B) {
        case 1:
          var Q = -1;
          break;
        case 2:
          Q = 250;
          break;
        case 5:
          Q = 1073741823;
          break;
        case 4:
          Q = 1e4;
          break;
        default:
          Q = 5e3;
      }
      return Q = at + Q, B = {
        id: H++,
        callback: I,
        priorityLevel: B,
        startTime: at,
        expirationTime: Q,
        sortIndex: -1
      }, at > it ? (B.sortIndex = at, i(y, B), o(w) === null && B === o(y) && (j ? (z(N), N = -1) : j = !0, Tt(X, at - it))) : (B.sortIndex = Q, i(w, B), b || E || (b = !0, K || (K = !0, zt()))), B;
    }, n.unstable_shouldYield = ut, n.unstable_wrapCallback = function(B) {
      var I = g;
      return function() {
        var at = g;
        g = I;
        try {
          return B.apply(this, arguments);
        } finally {
          g = at;
        }
      };
    };
  })(vo)), vo;
}
var Lc;
function $p() {
  return Lc || (Lc = 1, go.exports = Ip()), go.exports;
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
var Wc;
function Pp() {
  return Wc || (Wc = 1, (function(n) {
    n.exports = function(i) {
      function o(t, e, a, l) {
        return new Df(t, e, a, l);
      }
      function u() {
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
      function f(t) {
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
      function m(t) {
        if (f(t) !== t)
          throw Error(c(188));
      }
      function p(t) {
        var e = t.alternate;
        if (!e) {
          if (e = f(t), e === null) throw Error(c(188));
          return e !== t ? null : t;
        }
        for (var a = t, l = e; ; ) {
          var r = a.return;
          if (r === null) break;
          var s = r.alternate;
          if (s === null) {
            if (l = r.return, l !== null) {
              a = l;
              continue;
            }
            break;
          }
          if (r.child === s.child) {
            for (s = r.child; s; ) {
              if (s === a) return m(r), t;
              if (s === l) return m(r), e;
              s = s.sibling;
            }
            throw Error(c(188));
          }
          if (a.return !== l.return) a = r, l = s;
          else {
            for (var d = !1, h = r.child; h; ) {
              if (h === a) {
                d = !0, a = r, l = s;
                break;
              }
              if (h === l) {
                d = !0, l = r, a = s;
                break;
              }
              h = h.sibling;
            }
            if (!d) {
              for (h = s.child; h; ) {
                if (h === a) {
                  d = !0, a = s, l = r;
                  break;
                }
                if (h === l) {
                  d = !0, l = s, a = r;
                  break;
                }
                h = h.sibling;
              }
              if (!d) throw Error(c(189));
            }
          }
          if (a.alternate !== l) throw Error(c(190));
        }
        if (a.tag !== 3) throw Error(c(188));
        return a.stateNode.current === a ? t : e;
      }
      function w(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = w(t), e !== null) return e;
          t = t.sibling;
        }
        return null;
      }
      function y(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = y(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function H(t) {
        return t === null || typeof t != "object" ? null : (t = ic && t[ic] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function R(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Qf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case nl:
            return "Fragment";
          case Mr:
            return "Profiler";
          case lc:
            return "StrictMode";
          case Or:
            return "Suspense";
          case Rr:
            return "SuspenseList";
          case Ur:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ll:
              return "Portal";
            case ha:
              return t.displayName || "Context";
            case nc:
              return (t._context.displayName || "Context") + ".Consumer";
            case Ar:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Hr:
              return e = t.displayName || null, e !== null ? e : R(t.type) || "Memo";
            case ga:
              e = t._payload, t = t._init;
              try {
                return R(t(e));
              } catch {
              }
          }
        return null;
      }
      function g(t) {
        return { current: t };
      }
      function E(t) {
        0 > ol || (t.current = Qr[ol], Qr[ol] = null, ol--);
      }
      function b(t, e) {
        ol++, Qr[ol] = t.current, t.current = e;
      }
      function j(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (gp(t) / vp | 0) | 0;
      }
      function A(t) {
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
      function M(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, s = t.suspendedLanes, d = t.pingedLanes;
        t = t.warmLanes;
        var h = l & 134217727;
        return h !== 0 ? (l = h & ~s, l !== 0 ? r = A(l) : (d &= h, d !== 0 ? r = A(d) : a || (a = h & ~t, a !== 0 && (r = A(a))))) : (h = l & ~s, h !== 0 ? r = A(h) : d !== 0 ? r = A(d) : a || (a = l & ~t, a !== 0 && (r = A(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & s) === 0 && (s = r & -r, a = e & -e, s >= a || s === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function z(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function C(t, e) {
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
      function O() {
        var t = Xn;
        return Xn <<= 1, (Xn & 62914560) === 0 && (Xn = 4194304), t;
      }
      function X(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function K(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function N(t, e, a, l, r, s) {
        var d = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var h = t.entanglements, T = t.expirationTimes, U = t.hiddenUpdates;
        for (a = d & ~a; 0 < a; ) {
          var V = 31 - he(a), q = 1 << V;
          h[V] = 0, T[V] = -1;
          var Z = U[V];
          if (Z !== null)
            for (U[V] = null, V = 0; V < Z.length; V++) {
              var ot = Z[V];
              ot !== null && (ot.lane &= -536870913);
            }
          a &= ~q;
        }
        l !== 0 && S(t, l, 0), s !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= s & ~(d & ~e));
      }
      function S(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var l = 31 - he(e);
        t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | a & 261930;
      }
      function G(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var l = 31 - he(a), r = 1 << l;
          r & e | t[l] & e && (t[l] |= e), a &= ~r;
        }
      }
      function ut(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : xt(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function xt(t) {
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
      function zt(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function Rt(t) {
        if (typeof _p == "function" && Sp(t), ge && typeof ge.setStrictMode == "function")
          try {
            ge.setStrictMode(Xl, t);
          } catch {
          }
      }
      function Ft(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Tt(t) {
        if (Xr === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Xr = e && e[1] || "", Mc = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Xr + t + Mc;
      }
      function B(t, e) {
        if (!t || Zr) return "";
        Zr = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var l = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var q = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(q.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(q, []);
                    } catch (ot) {
                      var Z = ot;
                    }
                    Reflect.construct(t, [], q);
                  } else {
                    try {
                      q.call();
                    } catch (ot) {
                      Z = ot;
                    }
                    t.call(q.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ot) {
                    Z = ot;
                  }
                  (q = t()) && typeof q.catch == "function" && q.catch(function() {
                  });
                }
              } catch (ot) {
                if (ot && Z && typeof ot.stack == "string")
                  return [ot.stack, Z.stack];
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
          var s = l.DetermineComponentFrameRoot(), d = s[0], h = s[1];
          if (d && h) {
            var T = d.split(`
`), U = h.split(`
`);
            for (r = l = 0; l < T.length && !T[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < U.length && !U[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === T.length || r === U.length)
              for (l = T.length - 1, r = U.length - 1; 1 <= l && 0 <= r && T[l] !== U[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (T[l] !== U[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || T[l] !== U[r]) {
                      var V = `
` + T[l].replace(" at new ", " at ");
                      return t.displayName && V.includes("<anonymous>") && (V = V.replace("<anonymous>", t.displayName)), V;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          Zr = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? Tt(a) : "";
      }
      function I(t, e) {
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
            return B(t.type, !1);
          case 11:
            return B(t.type.render, !1);
          case 1:
            return B(t.type, !0);
          case 31:
            return Tt("Activity");
          default:
            return "";
        }
      }
      function at(t) {
        try {
          var e = "", a = null;
          do
            e += I(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (l) {
          return `
Error generating stack: ` + l.message + `
` + l.stack;
        }
      }
      function it(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Ac.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: at(e)
          }, Ac.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: at(e)
        };
      }
      function Q(t, e) {
        ul[cl++] = Zl, ul[cl++] = Jn, Jn = t, Zl = e;
      }
      function v(t, e, a) {
        ze[Ee++] = Ge, ze[Ee++] = Qe, ze[Ee++] = va, va = t;
        var l = Ge;
        t = Qe;
        var r = 32 - he(l) - 1;
        l &= ~(1 << r), a += 1;
        var s = 32 - he(e) + r;
        if (30 < s) {
          var d = r - r % 5;
          s = (l & (1 << d) - 1).toString(32), l >>= d, r -= d, Ge = 1 << 32 - he(e) + r | a << r | l, Qe = s + t;
        } else
          Ge = 1 << s | a << r | l, Qe = t;
      }
      function D(t) {
        t.return !== null && (Q(t, 1), v(t, 1, 0));
      }
      function $(t) {
        for (; t === Jn; )
          Jn = ul[--cl], ul[cl] = null, Zl = ul[--cl], ul[cl] = null;
        for (; t === va; )
          va = ze[--Ee], ze[Ee] = null, Qe = ze[--Ee], ze[Ee] = null, Ge = ze[--Ee], ze[Ee] = null;
      }
      function W(t, e) {
        ze[Ee++] = Ge, ze[Ee++] = Qe, ze[Ee++] = va, Ge = e.id, Qe = e.overflow, va = t;
      }
      function F(t, e) {
        b(ba, e), b(Jl, t), b(Pt, null), t = Xf(e), E(Pt), b(Pt, t);
      }
      function P() {
        E(Pt), E(Jl), E(ba);
      }
      function gt(t) {
        t.memoizedState !== null && b(Ln, t);
        var e = Pt.current, a = Zf(e, t.type);
        e !== a && (b(Jl, t), b(Pt, a));
      }
      function Zt(t) {
        Jl.current === t && (E(Pt), E(Jl)), Ln.current === t && (E(Ln), Ie ? Ba._currentValue = il : Ba._currentValue2 = il);
      }
      function rt(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Nl(it(e, t)), Jr;
      }
      function Ta(t, e) {
        if (!ne) throw Error(c(175));
        Zm(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || rt(t, !0);
      }
      function Ca(t) {
        for (te = t.return; te; )
          switch (te.tag) {
            case 5:
            case 31:
            case 13:
              ke = !1;
              return;
            case 27:
            case 3:
              ke = !0;
              return;
            default:
              te = te.return;
          }
      }
      function je(t) {
        if (!ne || t !== te) return !1;
        if (!ht) return Ca(t), ht = !0, !1;
        var e = t.tag;
        if (Qt ? e !== 3 && e !== 27 && (e !== 5 || bc(t.type) && !Qn(t.type, t.memoizedProps)) && Ct && rt(t) : e !== 3 && (e !== 5 || bc(t.type) && !Qn(t.type, t.memoizedProps)) && Ct && rt(t), Ca(t), e === 13) {
          if (!ne) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Ct = Im(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Ct = Fm(t);
        } else
          Ct = Qt && e === 27 ? Um(
            t.type,
            Ct
          ) : te ? vc(t.stateNode) : null;
        return !0;
      }
      function Me() {
        ne && (Ct = te = null, ht = !1);
      }
      function oa() {
        var t = ya;
        return t !== null && (de === null ? de = t : de.push.apply(
          de,
          t
        ), ya = null), t;
      }
      function Nl(t) {
        ya === null ? ya = [t] : ya.push(t);
      }
      function sa(t, e, a) {
        Ie ? (b(Wn, e._currentValue), e._currentValue = a) : (b(Wn, e._currentValue2), e._currentValue2 = a);
      }
      function Xe(t) {
        var e = Wn.current;
        Ie ? t._currentValue = e : t._currentValue2 = e, E(Wn);
      }
      function Ti(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Ci(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var s = r.dependencies;
          if (s !== null) {
            var d = r.child;
            s = s.firstContext;
            t: for (; s !== null; ) {
              var h = s;
              s = r;
              for (var T = 0; T < e.length; T++)
                if (h.context === e[T]) {
                  s.lanes |= a, h = s.alternate, h !== null && (h.lanes |= a), Ti(
                    s.return,
                    a,
                    t
                  ), l || (d = null);
                  break t;
                }
              s = h.next;
            }
          } else if (r.tag === 18) {
            if (d = r.return, d === null) throw Error(c(341));
            d.lanes |= a, s = d.alternate, s !== null && (s.lanes |= a), Ti(d, a, t), d = null;
          } else d = r.child;
          if (d !== null) d.return = r;
          else
            for (d = r; d !== null; ) {
              if (d === t) {
                d = null;
                break;
              }
              if (r = d.sibling, r !== null) {
                r.return = d.return, d = r;
                break;
              }
              d = d.return;
            }
          r = d;
        }
      }
      function Ia(t, e, a, l) {
        t = null;
        for (var r = e, s = !1; r !== null; ) {
          if (!s) {
            if ((r.flags & 524288) !== 0) s = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var d = r.alternate;
            if (d === null) throw Error(c(387));
            if (d = d.memoizedProps, d !== null) {
              var h = r.type;
              ve(r.pendingProps.value, d.value) || (t !== null ? t.push(h) : t = [h]);
            }
          } else if (r === Ln.current) {
            if (d = r.alternate, d === null) throw Error(c(387));
            d.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ba) : t = [Ba]);
          }
          r = r.return;
        }
        t !== null && Ci(
          e,
          t,
          a,
          l
        ), e.flags |= 262144;
      }
      function dn(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ve(
            Ie ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function ja(t) {
        qa = t, Pe = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function It(t) {
        return Xo(qa, t);
      }
      function fn(t, e) {
        return qa === null && ja(t), Xo(t, e);
      }
      function Xo(t, e) {
        var a = Ie ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, Pe === null) {
          if (t === null) throw Error(c(308));
          Pe = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else Pe = Pe.next = e;
        return a;
      }
      function ji() {
        return {
          controller: new Ep(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Tl(t) {
        t.refCount--, t.refCount === 0 && kp(Np, function() {
          t.controller.abort();
        });
      }
      function mn() {
      }
      function Be(t) {
        t !== dl && t.next === null && (dl === null ? Fn = dl = t : dl = dl.next = t), In = !0, Lr || (Lr = !0, mf());
      }
      function $a(t, e) {
        if (!Wr && In) {
          Wr = !0;
          do
            for (var a = !1, l = Fn; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var s = 0;
                else {
                  var d = l.suspendedLanes, h = l.pingedLanes;
                  s = (1 << 31 - he(42 | t) + 1) - 1, s &= r & ~(d & ~h), s = s & 201326741 ? s & 201326741 | 1 : s ? s | 2 : 0;
                }
                s !== 0 && (a = !0, Fo(l, s));
              } else
                s = pt, s = M(
                  l,
                  l === Et ? s : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Da
                ), (s & 3) === 0 || z(l, s) || (a = !0, Fo(l, s));
              l = l.next;
            }
          while (a);
          Wr = !1;
        }
      }
      function Zo() {
        Jo();
      }
      function Jo() {
        In = Lr = !1;
        var t = 0;
        Ya !== 0 && em() && (t = Ya);
        for (var e = ue(), a = null, l = Fn; l !== null; ) {
          var r = l.next, s = Lo(l, e);
          s === 0 ? (l.next = null, a === null ? Fn = r : a.next = r, r === null && (dl = a)) : (a = l, (t !== 0 || (s & 3) !== 0) && (In = !0)), l = r;
        }
        Vt !== 0 && Vt !== 5 || $a(t), Ya !== 0 && (Ya = 0);
      }
      function Lo(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, s = t.pendingLanes & -62914561; 0 < s; ) {
          var d = 31 - he(s), h = 1 << d, T = r[d];
          T === -1 ? ((h & a) === 0 || (h & l) !== 0) && (r[d] = C(h, e)) : T <= e && (t.expiredLanes |= h), s &= ~h;
        }
        if (e = Et, a = pt, a = M(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Da
        ), l = t.callbackNode, a === 0 || t === e && (_t === 2 || _t === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && Vr(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || z(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && Vr(l), zt(a)) {
            case 2:
            case 8:
              a = xp;
              break;
            case 32:
              a = Kr;
              break;
            case 268435456:
              a = wp;
              break;
            default:
              a = Kr;
          }
          return l = Wo.bind(null, t), a = Zn(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && Vr(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Wo(t, e) {
        if (Vt !== 0 && Vt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Gl() && t.callbackNode !== a)
          return null;
        var l = pt;
        return l = M(
          t,
          t === Et ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Da
        ), l === 0 ? null : (Au(t, l, e), Lo(t, ue()), t.callbackNode != null && t.callbackNode === a ? Wo.bind(null, t) : null);
      }
      function Fo(t, e) {
        if (Gl()) return null;
        Au(t, e, !0);
      }
      function mf() {
        sm ? um(function() {
          (ft & 6) !== 0 ? Zn(
            Cc,
            Zo
          ) : Jo();
        }) : Zn(
          Cc,
          Zo
        );
      }
      function Mi() {
        if (Ya === 0) {
          var t = fl;
          t === 0 && (t = Vn, Vn <<= 1, (Vn & 261888) === 0 && (Vn = 256)), Ya = t;
        }
        return Ya;
      }
      function pf(t, e) {
        if (Ll === null) {
          var a = Ll = [];
          Fr = 0, fl = Mi(), ml = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return Fr++, e.then(Io, Io), e;
      }
      function Io() {
        if (--Fr === 0 && Ll !== null) {
          ml !== null && (ml.status = "fulfilled");
          var t = Ll;
          Ll = null, fl = 0, ml = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function hf(t, e) {
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
      function Ai() {
        var t = Ga.current;
        return t !== null ? t : Et.pooledCache;
      }
      function pn(t, e) {
        e === null ? b(Ga, Ga.current) : b(Ga, e.pool);
      }
      function $o() {
        var t = Ai();
        return t === null ? null : {
          parent: Ie ? jt._currentValue : jt._currentValue2,
          pool: t
        };
      }
      function hn(t, e) {
        if (ve(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), l = Object.keys(e);
        if (a.length !== l.length) return !1;
        for (l = 0; l < a.length; l++) {
          var r = a[l];
          if (!zp.call(e, r) || !ve(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function Po(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function ts(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(mn, mn), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, as(t), t;
          default:
            if (typeof e.status == "string") e.then(mn, mn);
            else {
              if (t = Et, t !== null && 100 < t.shellSuspendCounter)
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
                throw t = e.reason, as(t), t;
            }
            throw Qa = e, pl;
        }
      }
      function Ma(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Qa = a, pl) : a;
        }
      }
      function es() {
        if (Qa === null) throw Error(c(459));
        var t = Qa;
        return Qa = null, t;
      }
      function as(t) {
        if (t === pl || t === $n)
          throw Error(c(483));
      }
      function gn(t) {
        var e = Wl;
        return Wl += 1, hl === null && (hl = []), ts(hl, t, e);
      }
      function Cl(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function vn(t, e) {
        throw e.$$typeof === Yf ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
          c(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function ls(t) {
        function e(_, x) {
          if (t) {
            var k = _.deletions;
            k === null ? (_.deletions = [x], _.flags |= 16) : k.push(x);
          }
        }
        function a(_, x) {
          if (!t) return null;
          for (; x !== null; )
            e(_, x), x = x.sibling;
          return null;
        }
        function l(_) {
          for (var x = /* @__PURE__ */ new Map(); _ !== null; )
            _.key !== null ? x.set(_.key, _) : x.set(_.index, _), _ = _.sibling;
          return x;
        }
        function r(_, x) {
          return _ = Fe(_, x), _.index = 0, _.sibling = null, _;
        }
        function s(_, x, k) {
          return _.index = k, t ? (k = _.alternate, k !== null ? (k = k.index, k < x ? (_.flags |= 67108866, x) : k) : (_.flags |= 67108866, x)) : (_.flags |= 1048576, x);
        }
        function d(_) {
          return t && _.alternate === null && (_.flags |= 67108866), _;
        }
        function h(_, x, k, Y) {
          return x === null || x.tag !== 6 ? (x = Nr(k, _.mode, Y), x.return = _, x) : (x = r(x, k), x.return = _, x);
        }
        function T(_, x, k, Y) {
          var et = k.type;
          return et === nl ? V(
            _,
            x,
            k.props.children,
            Y,
            k.key
          ) : x !== null && (x.elementType === et || typeof et == "object" && et !== null && et.$$typeof === ga && Ma(et) === x.type) ? (x = r(x, k.props), Cl(x, k), x.return = _, x) : (x = qn(
            k.type,
            k.key,
            k.props,
            null,
            _.mode,
            Y
          ), Cl(x, k), x.return = _, x);
        }
        function U(_, x, k, Y) {
          return x === null || x.tag !== 4 || x.stateNode.containerInfo !== k.containerInfo || x.stateNode.implementation !== k.implementation ? (x = Tr(k, _.mode, Y), x.return = _, x) : (x = r(x, k.children || []), x.return = _, x);
        }
        function V(_, x, k, Y, et) {
          return x === null || x.tag !== 7 ? (x = Ua(
            k,
            _.mode,
            Y,
            et
          ), x.return = _, x) : (x = r(x, k), x.return = _, x);
        }
        function q(_, x, k) {
          if (typeof x == "string" && x !== "" || typeof x == "number" || typeof x == "bigint")
            return x = Nr(
              "" + x,
              _.mode,
              k
            ), x.return = _, x;
          if (typeof x == "object" && x !== null) {
            switch (x.$$typeof) {
              case Yn:
                return k = qn(
                  x.type,
                  x.key,
                  x.props,
                  null,
                  _.mode,
                  k
                ), Cl(k, x), k.return = _, k;
              case ll:
                return x = Tr(
                  x,
                  _.mode,
                  k
                ), x.return = _, x;
              case ga:
                return x = Ma(x), q(_, x, k);
            }
            if (Gn(x) || H(x))
              return x = Ua(
                x,
                _.mode,
                k,
                null
              ), x.return = _, x;
            if (typeof x.then == "function")
              return q(_, gn(x), k);
            if (x.$$typeof === ha)
              return q(
                _,
                fn(_, x),
                k
              );
            vn(_, x);
          }
          return null;
        }
        function Z(_, x, k, Y) {
          var et = x !== null ? x.key : null;
          if (typeof k == "string" && k !== "" || typeof k == "number" || typeof k == "bigint")
            return et !== null ? null : h(_, x, "" + k, Y);
          if (typeof k == "object" && k !== null) {
            switch (k.$$typeof) {
              case Yn:
                return k.key === et ? T(_, x, k, Y) : null;
              case ll:
                return k.key === et ? U(_, x, k, Y) : null;
              case ga:
                return k = Ma(k), Z(_, x, k, Y);
            }
            if (Gn(k) || H(k))
              return et !== null ? null : V(_, x, k, Y, null);
            if (typeof k.then == "function")
              return Z(
                _,
                x,
                gn(k),
                Y
              );
            if (k.$$typeof === ha)
              return Z(
                _,
                x,
                fn(_, k),
                Y
              );
            vn(_, k);
          }
          return null;
        }
        function ot(_, x, k, Y, et) {
          if (typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint")
            return _ = _.get(k) || null, h(x, _, "" + Y, et);
          if (typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case Yn:
                return _ = _.get(
                  Y.key === null ? k : Y.key
                ) || null, T(x, _, Y, et);
              case ll:
                return _ = _.get(
                  Y.key === null ? k : Y.key
                ) || null, U(x, _, Y, et);
              case ga:
                return Y = Ma(Y), ot(
                  _,
                  x,
                  k,
                  Y,
                  et
                );
            }
            if (Gn(Y) || H(Y))
              return _ = _.get(k) || null, V(x, _, Y, et, null);
            if (typeof Y.then == "function")
              return ot(
                _,
                x,
                k,
                gn(Y),
                et
              );
            if (Y.$$typeof === ha)
              return ot(
                _,
                x,
                k,
                fn(x, Y),
                et
              );
            vn(x, Y);
          }
          return null;
        }
        function ee(_, x, k, Y) {
          for (var et = null, Mt = null, lt = x, bt = x = 0, Wt = null; lt !== null && bt < k.length; bt++) {
            lt.index > bt ? (Wt = lt, lt = null) : Wt = lt.sibling;
            var yt = Z(
              _,
              lt,
              k[bt],
              Y
            );
            if (yt === null) {
              lt === null && (lt = Wt);
              break;
            }
            t && lt && yt.alternate === null && e(_, lt), x = s(yt, x, bt), Mt === null ? et = yt : Mt.sibling = yt, Mt = yt, lt = Wt;
          }
          if (bt === k.length)
            return a(_, lt), ht && Q(_, bt), et;
          if (lt === null) {
            for (; bt < k.length; bt++)
              lt = q(_, k[bt], Y), lt !== null && (x = s(
                lt,
                x,
                bt
              ), Mt === null ? et = lt : Mt.sibling = lt, Mt = lt);
            return ht && Q(_, bt), et;
          }
          for (lt = l(lt); bt < k.length; bt++)
            Wt = ot(
              lt,
              _,
              bt,
              k[bt],
              Y
            ), Wt !== null && (t && Wt.alternate !== null && lt.delete(
              Wt.key === null ? bt : Wt.key
            ), x = s(
              Wt,
              x,
              bt
            ), Mt === null ? et = Wt : Mt.sibling = Wt, Mt = Wt);
          return t && lt.forEach(function(Ea) {
            return e(_, Ea);
          }), ht && Q(_, bt), et;
        }
        function an(_, x, k, Y) {
          if (k == null) throw Error(c(151));
          for (var et = null, Mt = null, lt = x, bt = x = 0, Wt = null, yt = k.next(); lt !== null && !yt.done; bt++, yt = k.next()) {
            lt.index > bt ? (Wt = lt, lt = null) : Wt = lt.sibling;
            var Ea = Z(_, lt, yt.value, Y);
            if (Ea === null) {
              lt === null && (lt = Wt);
              break;
            }
            t && lt && Ea.alternate === null && e(_, lt), x = s(Ea, x, bt), Mt === null ? et = Ea : Mt.sibling = Ea, Mt = Ea, lt = Wt;
          }
          if (yt.done)
            return a(_, lt), ht && Q(_, bt), et;
          if (lt === null) {
            for (; !yt.done; bt++, yt = k.next())
              yt = q(_, yt.value, Y), yt !== null && (x = s(
                yt,
                x,
                bt
              ), Mt === null ? et = yt : Mt.sibling = yt, Mt = yt);
            return ht && Q(_, bt), et;
          }
          for (lt = l(lt); !yt.done; bt++, yt = k.next())
            yt = ot(
              lt,
              _,
              bt,
              yt.value,
              Y
            ), yt !== null && (t && yt.alternate !== null && lt.delete(yt.key === null ? bt : yt.key), x = s(yt, x, bt), Mt === null ? et = yt : Mt.sibling = yt, Mt = yt);
          return t && lt.forEach(function(Mp) {
            return e(_, Mp);
          }), ht && Q(_, bt), et;
        }
        function Za(_, x, k, Y) {
          if (typeof k == "object" && k !== null && k.type === nl && k.key === null && (k = k.props.children), typeof k == "object" && k !== null) {
            switch (k.$$typeof) {
              case Yn:
                t: {
                  for (var et = k.key; x !== null; ) {
                    if (x.key === et) {
                      if (et = k.type, et === nl) {
                        if (x.tag === 7) {
                          a(
                            _,
                            x.sibling
                          ), Y = r(
                            x,
                            k.props.children
                          ), Y.return = _, _ = Y;
                          break t;
                        }
                      } else if (x.elementType === et || typeof et == "object" && et !== null && et.$$typeof === ga && Ma(et) === x.type) {
                        a(
                          _,
                          x.sibling
                        ), Y = r(x, k.props), Cl(Y, k), Y.return = _, _ = Y;
                        break t;
                      }
                      a(_, x);
                      break;
                    } else e(_, x);
                    x = x.sibling;
                  }
                  k.type === nl ? (Y = Ua(
                    k.props.children,
                    _.mode,
                    Y,
                    k.key
                  ), Y.return = _, _ = Y) : (Y = qn(
                    k.type,
                    k.key,
                    k.props,
                    null,
                    _.mode,
                    Y
                  ), Cl(Y, k), Y.return = _, _ = Y);
                }
                return d(_);
              case ll:
                t: {
                  for (et = k.key; x !== null; ) {
                    if (x.key === et)
                      if (x.tag === 4 && x.stateNode.containerInfo === k.containerInfo && x.stateNode.implementation === k.implementation) {
                        a(
                          _,
                          x.sibling
                        ), Y = r(
                          x,
                          k.children || []
                        ), Y.return = _, _ = Y;
                        break t;
                      } else {
                        a(_, x);
                        break;
                      }
                    else e(_, x);
                    x = x.sibling;
                  }
                  Y = Tr(k, _.mode, Y), Y.return = _, _ = Y;
                }
                return d(_);
              case ga:
                return k = Ma(k), Za(
                  _,
                  x,
                  k,
                  Y
                );
            }
            if (Gn(k))
              return ee(
                _,
                x,
                k,
                Y
              );
            if (H(k)) {
              if (et = H(k), typeof et != "function")
                throw Error(c(150));
              return k = et.call(k), an(
                _,
                x,
                k,
                Y
              );
            }
            if (typeof k.then == "function")
              return Za(
                _,
                x,
                gn(k),
                Y
              );
            if (k.$$typeof === ha)
              return Za(
                _,
                x,
                fn(_, k),
                Y
              );
            vn(_, k);
          }
          return typeof k == "string" && k !== "" || typeof k == "number" || typeof k == "bigint" ? (k = "" + k, x !== null && x.tag === 6 ? (a(_, x.sibling), Y = r(x, k), Y.return = _, _ = Y) : (a(_, x), Y = Nr(k, _.mode, Y), Y.return = _, _ = Y), d(_)) : a(_, x);
        }
        return function(_, x, k, Y) {
          try {
            Wl = 0;
            var et = Za(
              _,
              x,
              k,
              Y
            );
            return hl = null, et;
          } catch (lt) {
            if (lt === pl || lt === $n) throw lt;
            var Mt = o(29, lt, null, _.mode);
            return Mt.lanes = Y, Mt.return = _, Mt;
          } finally {
          }
        };
      }
      function bn() {
        for (var t = gl, e = $r = gl = 0; e < t; ) {
          var a = Ne[e];
          Ne[e++] = null;
          var l = Ne[e];
          Ne[e++] = null;
          var r = Ne[e];
          Ne[e++] = null;
          var s = Ne[e];
          if (Ne[e++] = null, l !== null && r !== null) {
            var d = l.pending;
            d === null ? r.next = r : (r.next = d.next, d.next = r), l.pending = r;
          }
          s !== 0 && ns(a, r, s);
        }
      }
      function yn(t, e, a, l) {
        Ne[gl++] = t, Ne[gl++] = e, Ne[gl++] = a, Ne[gl++] = l, $r |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Oi(t, e, a, l) {
        return yn(t, e, a, l), xn(t);
      }
      function Aa(t, e) {
        return yn(t, null, null, e), xn(t);
      }
      function ns(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, s = t.return; s !== null; )
          s.childLanes |= a, l = s.alternate, l !== null && (l.childLanes |= a), s.tag === 22 && (t = s.stateNode, t === null || t._visibility & 1 || (r = !0)), t = s, s = s.return;
        return t.tag === 3 ? (s = t.stateNode, r && e !== null && (r = 31 - he(a), t = s.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), s) : null;
      }
      function xn(t) {
        if (50 < en)
          throw en = 0, co = null, Error(c(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Ri(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Hi(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function ua(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function ca(t, e, a) {
        var l = t.updateQueue;
        if (l === null) return null;
        if (l = l.shared, (ft & 2) !== 0) {
          var r = l.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = xn(t), ns(t, null, a), e;
        }
        return yn(t, l, e, a), xn(t);
      }
      function jl(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function Ui(t, e) {
        var a = t.updateQueue, l = t.alternate;
        if (l !== null && (l = l.updateQueue, a === l)) {
          var r = null, s = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var d = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              s === null ? r = s = d : s = s.next = d, a = a.next;
            } while (a !== null);
            s === null ? r = s = e : s = s.next = e;
          } else r = s = e;
          a = {
            baseState: l.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: s,
            shared: l.shared,
            callbacks: l.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Ml() {
        if (Pr) {
          var t = ml;
          if (t !== null) throw t;
        }
      }
      function Al(t, e, a, l) {
        Pr = !1;
        var r = t.updateQueue;
        xa = !1;
        var s = r.firstBaseUpdate, d = r.lastBaseUpdate, h = r.shared.pending;
        if (h !== null) {
          r.shared.pending = null;
          var T = h, U = T.next;
          T.next = null, d === null ? s = U : d.next = U, d = T;
          var V = t.alternate;
          V !== null && (V = V.updateQueue, h = V.lastBaseUpdate, h !== d && (h === null ? V.firstBaseUpdate = U : h.next = U, V.lastBaseUpdate = T));
        }
        if (s !== null) {
          var q = r.baseState;
          d = 0, V = U = T = null, h = s;
          do {
            var Z = h.lane & -536870913, ot = Z !== h.lane;
            if (ot ? (pt & Z) === Z : (l & Z) === Z) {
              Z !== 0 && Z === fl && (Pr = !0), V !== null && (V = V.next = {
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, an = h;
                Z = e;
                var Za = a;
                switch (an.tag) {
                  case 1:
                    if (ee = an.payload, typeof ee == "function") {
                      q = ee.call(
                        Za,
                        q,
                        Z
                      );
                      break t;
                    }
                    q = ee;
                    break t;
                  case 3:
                    ee.flags = ee.flags & -65537 | 128;
                  case 0:
                    if (ee = an.payload, Z = typeof ee == "function" ? ee.call(Za, q, Z) : ee, Z == null) break t;
                    q = jr({}, q, Z);
                    break t;
                  case 2:
                    xa = !0;
                }
              }
              Z = h.callback, Z !== null && (t.flags |= 64, ot && (t.flags |= 8192), ot = r.callbacks, ot === null ? r.callbacks = [Z] : ot.push(Z));
            } else
              ot = {
                lane: Z,
                tag: h.tag,
                payload: h.payload,
                callback: h.callback,
                next: null
              }, V === null ? (U = V = ot, T = q) : V = V.next = ot, d |= Z;
            if (h = h.next, h === null) {
              if (h = r.shared.pending, h === null)
                break;
              ot = h, h = ot.next, ot.next = null, r.lastBaseUpdate = ot, r.shared.pending = null;
            }
          } while (!0);
          V === null && (T = q), r.baseState = T, r.firstBaseUpdate = U, r.lastBaseUpdate = V, s === null && (r.shared.lanes = 0), _a |= d, t.lanes = d, t.memoizedState = q;
        }
      }
      function is(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function rs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            is(a[t], e);
      }
      function os(t, e) {
        t = aa, b(ti, t), b(vl, e), aa = t | e.baseLanes;
      }
      function Di() {
        b(ti, aa), b(vl, vl.current);
      }
      function Bi() {
        aa = ti.current, E(vl), E(ti);
      }
      function da(t) {
        var e = t.alternate;
        b(Ut, Ut.current & 1), b(be, t), Te === null && (e === null || vl.current !== null || e.memoizedState !== null) && (Te = t);
      }
      function qi(t) {
        b(Ut, Ut.current), b(be, t), Te === null && (Te = t);
      }
      function ss(t) {
        t.tag === 22 ? (b(Ut, Ut.current), b(be, t), Te === null && (Te = t)) : fa();
      }
      function fa() {
        b(Ut, Ut.current), b(be, be.current);
      }
      function fe(t) {
        E(be), Te === t && (Te = null), E(Ut);
      }
      function wn(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || qr(a) || Yr(a)))
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
      function At() {
        throw Error(c(321));
      }
      function Yi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ve(t[a], e[a])) return !1;
        return !0;
      }
      function Gi(t, e, a, l, r, s) {
        return ta = s, st = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, tt.H = t === null || t.memoizedState === null ? Hc : to, Ka = !1, s = a(l, r), Ka = !1, bl && (s = cs(
          e,
          a,
          l,
          r
        )), us(t), s;
      }
      function us(t) {
        tt.H = Il;
        var e = St !== null && St.next !== null;
        if (ta = 0, Dt = St = st = null, ei = !1, Fl = 0, yl = null, e) throw Error(c(300));
        t === null || Bt || (t = t.dependencies, t !== null && dn(t) && (Bt = !0));
      }
      function cs(t, e, a, l) {
        st = t;
        var r = 0;
        do {
          if (bl && (yl = null), Fl = 0, bl = !1, 25 <= r) throw Error(c(301));
          if (r += 1, Dt = St = null, t.updateQueue != null) {
            var s = t.updateQueue;
            s.lastEffect = null, s.events = null, s.stores = null, s.memoCache != null && (s.memoCache.index = 0);
          }
          tt.H = Uc, s = e(a, l);
        } while (bl);
        return s;
      }
      function gf() {
        var t = tt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Ol(e) : e, t = t.useState()[0], (St !== null ? St.memoizedState : null) !== t && (st.flags |= 1024), e;
      }
      function Qi() {
        var t = ai !== 0;
        return ai = 0, t;
      }
      function Vi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Ki(t) {
        if (ei) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ei = !1;
        }
        ta = 0, Dt = St = st = null, bl = !1, Fl = ai = 0, yl = null;
      }
      function re() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Dt === null ? st.memoizedState = Dt = t : Dt = Dt.next = t, Dt;
      }
      function Ht() {
        if (St === null) {
          var t = st.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = St.next;
        var e = Dt === null ? st.memoizedState : Dt.next;
        if (e !== null)
          Dt = e, St = t;
        else {
          if (t === null)
            throw st.alternate === null ? Error(c(467)) : Error(c(310));
          St = t, t = {
            memoizedState: St.memoizedState,
            baseState: St.baseState,
            baseQueue: St.baseQueue,
            queue: St.queue,
            next: null
          }, Dt === null ? st.memoizedState = Dt = t : Dt = Dt.next = t;
        }
        return Dt;
      }
      function _n() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Ol(t) {
        var e = Fl;
        return Fl += 1, yl === null && (yl = []), t = ts(yl, t, e), e = st, (Dt === null ? e.memoizedState : Dt.next) === null && (e = e.alternate, tt.H = e === null || e.memoizedState === null ? Hc : to), t;
      }
      function Sn(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Ol(t);
          if (t.$$typeof === ha) return It(t);
        }
        throw Error(c(438, String(t)));
      }
      function Xi(t) {
        var e = null, a = st.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var l = st.alternate;
          l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (e = {
            data: l.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = _n(), st.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = Gf;
        return e.index++, a;
      }
      function Ze(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function zn(t) {
        var e = Ht();
        return Zi(e, St, t);
      }
      function Zi(t, e, a) {
        var l = t.queue;
        if (l === null) throw Error(c(311));
        l.lastRenderedReducer = a;
        var r = t.baseQueue, s = l.pending;
        if (s !== null) {
          if (r !== null) {
            var d = r.next;
            r.next = s.next, s.next = d;
          }
          e.baseQueue = r = s, l.pending = null;
        }
        if (s = t.baseState, r === null) t.memoizedState = s;
        else {
          e = r.next;
          var h = d = null, T = null, U = e, V = !1;
          do {
            var q = U.lane & -536870913;
            if (q !== U.lane ? (pt & q) === q : (ta & q) === q) {
              var Z = U.revertLane;
              if (Z === 0)
                T !== null && (T = T.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: U.action,
                  hasEagerState: U.hasEagerState,
                  eagerState: U.eagerState,
                  next: null
                }), q === fl && (V = !0);
              else if ((ta & Z) === Z) {
                U = U.next, Z === fl && (V = !0);
                continue;
              } else
                q = {
                  lane: 0,
                  revertLane: U.revertLane,
                  gesture: null,
                  action: U.action,
                  hasEagerState: U.hasEagerState,
                  eagerState: U.eagerState,
                  next: null
                }, T === null ? (h = T = q, d = s) : T = T.next = q, st.lanes |= Z, _a |= Z;
              q = U.action, Ka && a(s, q), s = U.hasEagerState ? U.eagerState : a(s, q);
            } else
              Z = {
                lane: q,
                revertLane: U.revertLane,
                gesture: U.gesture,
                action: U.action,
                hasEagerState: U.hasEagerState,
                eagerState: U.eagerState,
                next: null
              }, T === null ? (h = T = Z, d = s) : T = T.next = Z, st.lanes |= q, _a |= q;
            U = U.next;
          } while (U !== null && U !== e);
          if (T === null ? d = s : T.next = h, !ve(s, t.memoizedState) && (Bt = !0, V && (a = ml, a !== null)))
            throw a;
          t.memoizedState = s, t.baseState = d, t.baseQueue = T, l.lastRenderedState = s;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function Ji(t) {
        var e = Ht(), a = e.queue;
        if (a === null) throw Error(c(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, s = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var d = r = r.next;
          do
            s = t(s, d.action), d = d.next;
          while (d !== r);
          ve(s, e.memoizedState) || (Bt = !0), e.memoizedState = s, e.baseQueue === null && (e.baseState = s), a.lastRenderedState = s;
        }
        return [s, l];
      }
      function ds(t, e, a) {
        var l = st, r = Ht(), s = ht;
        if (s) {
          if (a === void 0)
            throw Error(c(407));
          a = a();
        } else a = e();
        var d = !ve(
          (St || r).memoizedState,
          a
        );
        if (d && (r.memoizedState = a, Bt = !0), r = r.queue, Fi(ps.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || d || Dt !== null && Dt.memoizedState.tag & 1) {
          if (l.flags |= 2048, Pa(
            9,
            { destroy: void 0 },
            ms.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), Et === null) throw Error(c(349));
          s || (ta & 127) !== 0 || fs(l, e, a);
        }
        return a;
      }
      function fs(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = st.updateQueue, e === null ? (e = _n(), st.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function ms(t, e, a, l) {
        e.value = a, e.getSnapshot = l, hs(e) && gs(t);
      }
      function ps(t, e, a) {
        return a(function() {
          hs(e) && gs(t);
        });
      }
      function hs(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ve(t, a);
        } catch {
          return !0;
        }
      }
      function gs(t) {
        var e = Aa(t, 2);
        e !== null && se(e, t, 2);
      }
      function Li(t) {
        var e = re();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Ka) {
            Rt(!0);
            try {
              a();
            } finally {
              Rt(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ze,
          lastRenderedState: t
        }, e;
      }
      function vs(t, e, a, l) {
        return t.baseState = a, Zi(
          t,
          St,
          typeof l == "function" ? l : Ze
        );
      }
      function vf(t, e, a, l, r) {
        if (Nn(t)) throw Error(c(485));
        if (t = e.action, t !== null) {
          var s = {
            payload: r,
            action: t,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(d) {
              s.listeners.push(d);
            }
          };
          tt.T !== null ? a(!0) : s.isTransition = !1, l(s), a = e.pending, a === null ? (s.next = e.pending = s, bs(e, s)) : (s.next = a.next, e.pending = a.next = s);
        }
      }
      function bs(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var s = tt.T, d = {};
          tt.T = d;
          try {
            var h = a(r, l), T = tt.S;
            T !== null && T(d, h), ys(t, e, h);
          } catch (U) {
            Wi(t, e, U);
          } finally {
            s !== null && d.types !== null && (s.types = d.types), tt.T = s;
          }
        } else
          try {
            s = a(r, l), ys(t, e, s);
          } catch (U) {
            Wi(t, e, U);
          }
      }
      function ys(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            xs(t, e, l);
          },
          function(l) {
            return Wi(t, e, l);
          }
        ) : xs(t, e, a);
      }
      function xs(t, e, a) {
        e.status = "fulfilled", e.value = a, ws(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, bs(t, a)));
      }
      function Wi(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, ws(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function ws(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function _s(t, e) {
        return e;
      }
      function Ss(t, e) {
        if (ht) {
          var a = Et.formState;
          if (a !== null) {
            t: {
              var l = st;
              if (ht) {
                if (Ct) {
                  var r = Rm(
                    Ct,
                    ke
                  );
                  if (r) {
                    Ct = vc(r), l = Hm(r);
                    break t;
                  }
                }
                rt(l);
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
          lastRenderedReducer: _s,
          lastRenderedState: e
        }, a.queue = l, a = Gs.bind(
          null,
          st,
          l
        ), l.dispatch = a, l = Li(!1);
        var s = tr.bind(
          null,
          st,
          !1,
          l.queue
        );
        return l = re(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = vf.bind(
          null,
          st,
          r,
          s,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function zs(t) {
        var e = Ht();
        return Es(e, St, t);
      }
      function Es(t, e, a) {
        if (e = Zi(
          t,
          e,
          _s
        )[0], t = zn(Ze)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Ol(e);
          } catch (d) {
            throw d === pl ? $n : d;
          }
        else l = e;
        e = Ht();
        var r = e.queue, s = r.dispatch;
        return a !== e.memoizedState && (st.flags |= 2048, Pa(
          9,
          { destroy: void 0 },
          bf.bind(null, r, a),
          null
        )), [l, s, t];
      }
      function bf(t, e) {
        t.action = e;
      }
      function ks(t) {
        var e = Ht(), a = St;
        if (a !== null)
          return Es(e, a, t);
        Ht(), e = e.memoizedState, a = Ht();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function Pa(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = st.updateQueue, e === null && (e = _n(), st.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function Ns() {
        return Ht().memoizedState;
      }
      function En(t, e, a, l) {
        var r = re();
        st.flags |= t, r.memoizedState = Pa(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function kn(t, e, a, l) {
        var r = Ht();
        l = l === void 0 ? null : l;
        var s = r.memoizedState.inst;
        St !== null && l !== null && Yi(l, St.memoizedState.deps) ? r.memoizedState = Pa(e, s, a, l) : (st.flags |= t, r.memoizedState = Pa(
          1 | e,
          s,
          a,
          l
        ));
      }
      function Ts(t, e) {
        En(8390656, 8, t, e);
      }
      function Fi(t, e) {
        kn(2048, 8, t, e);
      }
      function yf(t) {
        st.flags |= 4;
        var e = st.updateQueue;
        if (e === null)
          e = _n(), st.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Cs(t) {
        var e = Ht().memoizedState;
        return yf({ ref: e, nextImpl: t }), function() {
          if ((ft & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function js(t, e) {
        return kn(4, 2, t, e);
      }
      function Ms(t, e) {
        return kn(4, 4, t, e);
      }
      function As(t, e) {
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
      function Os(t, e, a) {
        a = a != null ? a.concat([t]) : null, kn(
          4,
          4,
          As.bind(null, e, t),
          a
        );
      }
      function Ii() {
      }
      function Rs(t, e) {
        var a = Ht();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Yi(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Hs(t, e) {
        var a = Ht();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Yi(e, l[1]))
          return l[0];
        if (l = t(), Ka) {
          Rt(!0);
          try {
            t();
          } finally {
            Rt(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function $i(t, e, a) {
        return a === void 0 || (ta & 1073741824) !== 0 && (pt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Mu(), st.lanes |= t, _a |= t, a);
      }
      function Us(t, e, a, l) {
        return ve(a, e) ? a : vl.current !== null ? (t = $i(t, a, l), ve(t, e) || (Bt = !0), t) : (ta & 42) === 0 || (ta & 1073741824) !== 0 && (pt & 261930) === 0 ? (Bt = !0, t.memoizedState = a) : (t = Mu(), st.lanes |= t, _a |= t, e);
      }
      function Ds(t, e, a, l, r) {
        var s = $e();
        Jt(
          s !== 0 && 8 > s ? s : 8
        );
        var d = tt.T, h = {};
        tt.T = h, tr(t, !1, e, a);
        try {
          var T = r(), U = tt.S;
          if (U !== null && U(h, T), T !== null && typeof T == "object" && typeof T.then == "function") {
            var V = hf(
              T,
              l
            );
            Rl(
              t,
              e,
              V,
              me(t)
            );
          } else
            Rl(
              t,
              e,
              l,
              me(t)
            );
        } catch (q) {
          Rl(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: q },
            me()
          );
        } finally {
          Jt(s), d !== null && h.types !== null && (d.types = h.types), tt.T = d;
        }
      }
      function Bs(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: il,
          baseState: il,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ze,
            lastRenderedState: il
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
            lastRenderedReducer: Ze,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Pi() {
        return It(Ba);
      }
      function qs() {
        return Ht().memoizedState;
      }
      function Ys() {
        return Ht().memoizedState;
      }
      function xf(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = me();
              t = ua(a);
              var l = ca(e, t, a);
              l !== null && (se(l, e, a), jl(l, e, a)), e = { cache: ji() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function wf(t, e, a) {
        var l = me();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Nn(t) ? Qs(e, a) : (a = Oi(t, e, a, l), a !== null && (se(a, t, l), Vs(a, e, l)));
      }
      function Gs(t, e, a) {
        var l = me();
        Rl(t, e, a, l);
      }
      function Rl(t, e, a, l) {
        var r = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Nn(t)) Qs(e, r);
        else {
          var s = t.alternate;
          if (t.lanes === 0 && (s === null || s.lanes === 0) && (s = e.lastRenderedReducer, s !== null))
            try {
              var d = e.lastRenderedState, h = s(d, a);
              if (r.hasEagerState = !0, r.eagerState = h, ve(h, d))
                return yn(t, e, r, 0), Et === null && bn(), !1;
            } catch {
            } finally {
            }
          if (a = Oi(t, e, r, l), a !== null)
            return se(a, t, l), Vs(a, e, l), !0;
        }
        return !1;
      }
      function tr(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: Mi(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Nn(t)) {
          if (e) throw Error(c(479));
        } else
          e = Oi(
            t,
            a,
            l,
            2
          ), e !== null && se(e, t, 2);
      }
      function Nn(t) {
        var e = t.alternate;
        return t === st || e !== null && e === st;
      }
      function Qs(t, e) {
        bl = ei = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Vs(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function er(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : jr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Ks(t, e, a, l, r, s, d) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, s, d) : e.prototype && e.prototype.isPureReactComponent ? !hn(a, l) || !hn(r, s) : !0;
      }
      function Xs(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && eo.enqueueReplaceState(e, e.state, null);
      }
      function Oa(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = jr({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function Tn(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (l) {
          setTimeout(function() {
            throw l;
          });
        }
      }
      function Zs(t, e, a) {
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
      function ar(t, e, a) {
        return a = ua(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Tn(t, e);
        }, a;
      }
      function Js(t) {
        return t = ua(t), t.tag = 3, t;
      }
      function Ls(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var s = l.value;
          t.payload = function() {
            return r(s);
          }, t.callback = function() {
            Zs(e, a, l);
          };
        }
        var d = a.stateNode;
        d !== null && typeof d.componentDidCatch == "function" && (t.callback = function() {
          Zs(e, a, l), typeof r != "function" && (Sa === null ? Sa = /* @__PURE__ */ new Set([this]) : Sa.add(this));
          var h = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: h !== null ? h : ""
          });
        });
      }
      function _f(t, e, a, l, r) {
        if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          if (e = a.alternate, e !== null && Ia(
            e,
            a,
            r,
            !0
          ), a = be.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Te === null ? Dn() : a.alternate === null && Ot === 0 && (Ot = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === Pn ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Er(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === Pn ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Er(t, l, r)), !1;
            }
            throw Error(c(435, a.tag));
          }
          return Er(t, l, r), Dn(), !1;
        }
        if (ht)
          return e = be.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== Jr && (t = Error(c(422), { cause: l }), Nl(
            it(t, a)
          ))) : (l !== Jr && (e = Error(c(423), {
            cause: l
          }), Nl(
            it(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = it(l, a), r = ar(
            t.stateNode,
            l,
            r
          ), Ui(t, r), Ot !== 4 && (Ot = 2)), !1;
        var s = Error(c(520), { cause: l });
        if (s = it(s, a), Pl === null ? Pl = [s] : Pl.push(s), Ot !== 4 && (Ot = 2), e === null) return !0;
        l = it(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = ar(a.stateNode, l, t), Ui(a, t), !1;
            case 1:
              if (e = a.type, s = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || s !== null && typeof s.componentDidCatch == "function" && (Sa === null || !Sa.has(
                s
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = Js(r), Ls(
                  r,
                  t,
                  a,
                  l
                ), Ui(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, l) {
        e.child = t === null ? Rc(e, null, a, l) : Va(
          e,
          t.child,
          a,
          l
        );
      }
      function Ws(t, e, a, l, r) {
        a = a.render;
        var s = e.ref;
        if ("ref" in l) {
          var d = {};
          for (var h in l)
            h !== "ref" && (d[h] = l[h]);
        } else d = l;
        return ja(e), l = Gi(
          t,
          e,
          a,
          d,
          s,
          r
        ), h = Qi(), t !== null && !Bt ? (Vi(t, e, r), Je(t, e, r)) : (ht && h && D(e), e.flags |= 1, $t(t, e, l, r), e.child);
      }
      function Fs(t, e, a, l, r) {
        if (t === null) {
          var s = a.type;
          return typeof s == "function" && !kr(s) && s.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = s, Is(
            t,
            e,
            s,
            l,
            r
          )) : (t = qn(
            a.type,
            null,
            l,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (s = t.child, !ur(t, r)) {
          var d = s.memoizedProps;
          if (a = a.compare, a = a !== null ? a : hn, a(d, l) && t.ref === e.ref)
            return Je(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Fe(s, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Is(t, e, a, l, r) {
        if (t !== null) {
          var s = t.memoizedProps;
          if (hn(s, l) && t.ref === e.ref)
            if (Bt = !1, e.pendingProps = l = s, ur(t, r))
              (t.flags & 131072) !== 0 && (Bt = !0);
            else
              return e.lanes = t.lanes, Je(t, e, r);
        }
        return lr(
          t,
          e,
          a,
          l,
          r
        );
      }
      function $s(t, e, a, l) {
        var r = l.children, s = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), l.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (s = s !== null ? s.baseLanes | a : a, t !== null) {
              for (l = e.child = t.child, r = 0; l !== null; )
                r = r | l.lanes | l.childLanes, l = l.sibling;
              l = r & ~s;
            } else l = 0, e.child = null;
            return Ps(
              t,
              e,
              s,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && pn(
              e,
              s !== null ? s.cachePool : null
            ), s !== null ? os(e, s) : Di(), ss(e);
          else
            return l = e.lanes = 536870912, Ps(
              t,
              e,
              s !== null ? s.baseLanes | a : a,
              a,
              l
            );
        } else
          s !== null ? (pn(e, s.cachePool), os(e, s), fa(), e.memoizedState = null) : (t !== null && pn(e, null), Di(), fa());
        return $t(t, e, r, a), e.child;
      }
      function Hl(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Ps(t, e, a, l, r) {
        var s = Ai();
        return s = s === null ? null : {
          parent: Ie ? jt._currentValue : jt._currentValue2,
          pool: s
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: s
        }, t !== null && pn(e, null), Di(), ss(e), t !== null && Ia(t, e, l, !0), e.childLanes = r, null;
      }
      function Cn(t, e) {
        return e = Mn(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function tu(t, e, a) {
        return Va(e, t.child, null, a), t = Cn(
          e,
          e.pendingProps
        ), t.flags |= 2, fe(e), e.memoizedState = null, t;
      }
      function Sf(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (ht) {
            if (l.mode === "hidden")
              return t = Cn(e, l), e.lanes = 536870912, Hl(null, t);
            if (qi(e), (t = Ct) ? (t = Km(
              t,
              ke
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: va !== null ? { id: Ge, overflow: Qe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Iu(t), a.return = e, e.child = a, te = e, Ct = null)) : t = null, t === null) throw rt(e);
            return e.lanes = 536870912, null;
          }
          return Cn(e, l);
        }
        var s = t.memoizedState;
        if (s !== null) {
          var d = s.dehydrated;
          if (qi(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = tu(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (Bt || Ia(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Bt || r) {
            if (l = Et, l !== null && (d = ut(l, a), d !== 0 && d !== s.retryLane))
              throw s.retryLane = d, Aa(t, d), se(l, t, d), ao;
            Dn(), e = tu(
              t,
              e,
              a
            );
          } else
            t = s.treeContext, ne && (Ct = qm(d), te = e, ht = !0, ya = null, ke = !1, t !== null && W(e, t)), e = Cn(e, l), e.flags |= 4096;
          return e;
        }
        return t = Fe(t.child, {
          mode: l.mode,
          children: l.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function jn(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(c(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function lr(t, e, a, l, r) {
        return ja(e), a = Gi(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = Qi(), t !== null && !Bt ? (Vi(t, e, r), Je(t, e, r)) : (ht && l && D(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function eu(t, e, a, l, r, s) {
        return ja(e), e.updateQueue = null, a = cs(
          e,
          l,
          a,
          r
        ), us(t), l = Qi(), t !== null && !Bt ? (Vi(t, e, s), Je(t, e, s)) : (ht && l && D(e), e.flags |= 1, $t(t, e, a, s), e.child);
      }
      function au(t, e, a, l, r) {
        if (ja(e), e.stateNode === null) {
          var s = sl, d = a.contextType;
          typeof d == "object" && d !== null && (s = It(d)), s = new a(l, s), e.memoizedState = s.state !== null && s.state !== void 0 ? s.state : null, s.updater = eo, e.stateNode = s, s._reactInternals = e, s = e.stateNode, s.props = l, s.state = e.memoizedState, s.refs = {}, Ri(e), d = a.contextType, s.context = typeof d == "object" && d !== null ? It(d) : sl, s.state = e.memoizedState, d = a.getDerivedStateFromProps, typeof d == "function" && (er(
            e,
            a,
            d,
            l
          ), s.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof s.getSnapshotBeforeUpdate == "function" || typeof s.UNSAFE_componentWillMount != "function" && typeof s.componentWillMount != "function" || (d = s.state, typeof s.componentWillMount == "function" && s.componentWillMount(), typeof s.UNSAFE_componentWillMount == "function" && s.UNSAFE_componentWillMount(), d !== s.state && eo.enqueueReplaceState(
            s,
            s.state,
            null
          ), Al(e, l, s, r), Ml(), s.state = e.memoizedState), typeof s.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          s = e.stateNode;
          var h = e.memoizedProps, T = Oa(a, h);
          s.props = T;
          var U = s.context, V = a.contextType;
          d = sl, typeof V == "object" && V !== null && (d = It(V));
          var q = a.getDerivedStateFromProps;
          V = typeof q == "function" || typeof s.getSnapshotBeforeUpdate == "function", h = e.pendingProps !== h, V || typeof s.UNSAFE_componentWillReceiveProps != "function" && typeof s.componentWillReceiveProps != "function" || (h || U !== d) && Xs(
            e,
            s,
            l,
            d
          ), xa = !1;
          var Z = e.memoizedState;
          s.state = Z, Al(e, l, s, r), Ml(), U = e.memoizedState, h || Z !== U || xa ? (typeof q == "function" && (er(
            e,
            a,
            q,
            l
          ), U = e.memoizedState), (T = xa || Ks(
            e,
            a,
            T,
            l,
            Z,
            U,
            d
          )) ? (V || typeof s.UNSAFE_componentWillMount != "function" && typeof s.componentWillMount != "function" || (typeof s.componentWillMount == "function" && s.componentWillMount(), typeof s.UNSAFE_componentWillMount == "function" && s.UNSAFE_componentWillMount()), typeof s.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof s.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = U), s.props = l, s.state = U, s.context = d, l = T) : (typeof s.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          s = e.stateNode, Hi(t, e), d = e.memoizedProps, V = Oa(a, d), s.props = V, q = e.pendingProps, Z = s.context, U = a.contextType, T = sl, typeof U == "object" && U !== null && (T = It(U)), h = a.getDerivedStateFromProps, (U = typeof h == "function" || typeof s.getSnapshotBeforeUpdate == "function") || typeof s.UNSAFE_componentWillReceiveProps != "function" && typeof s.componentWillReceiveProps != "function" || (d !== q || Z !== T) && Xs(
            e,
            s,
            l,
            T
          ), xa = !1, Z = e.memoizedState, s.state = Z, Al(e, l, s, r), Ml();
          var ot = e.memoizedState;
          d !== q || Z !== ot || xa || t !== null && t.dependencies !== null && dn(t.dependencies) ? (typeof h == "function" && (er(
            e,
            a,
            h,
            l
          ), ot = e.memoizedState), (V = xa || Ks(
            e,
            a,
            V,
            l,
            Z,
            ot,
            T
          ) || t !== null && t.dependencies !== null && dn(t.dependencies)) ? (U || typeof s.UNSAFE_componentWillUpdate != "function" && typeof s.componentWillUpdate != "function" || (typeof s.componentWillUpdate == "function" && s.componentWillUpdate(l, ot, T), typeof s.UNSAFE_componentWillUpdate == "function" && s.UNSAFE_componentWillUpdate(
            l,
            ot,
            T
          )), typeof s.componentDidUpdate == "function" && (e.flags |= 4), typeof s.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof s.componentDidUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof s.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = ot), s.props = l, s.state = ot, s.context = T, l = V) : (typeof s.componentDidUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof s.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return s = l, jn(t, e), l = (e.flags & 128) !== 0, s || l ? (s = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : s.render(), e.flags |= 1, t !== null && l ? (e.child = Va(
          e,
          t.child,
          null,
          r
        ), e.child = Va(
          e,
          null,
          a,
          r
        )) : $t(t, e, a, r), e.memoizedState = s.state, t = e.child) : t = Je(
          t,
          e,
          r
        ), t;
      }
      function lu(t, e, a, l) {
        return Me(), e.flags |= 256, $t(t, e, a, l), e.child;
      }
      function nr(t) {
        return { baseLanes: t, cachePool: $o() };
      }
      function ir(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= xe), t;
      }
      function nu(t, e, a) {
        var l = e.pendingProps, r = !1, s = (e.flags & 128) !== 0, d;
        if ((d = s) || (d = t !== null && t.memoizedState === null ? !1 : (Ut.current & 2) !== 0), d && (r = !0, e.flags &= -129), d = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (ht) {
            if (r ? da(e) : fa(), (t = Ct) ? (t = Xm(
              t,
              ke
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: va !== null ? { id: Ge, overflow: Qe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Iu(t), a.return = e, e.child = a, te = e, Ct = null)) : t = null, t === null) throw rt(e);
            return Yr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var h = l.children;
          return l = l.fallback, r ? (fa(), r = e.mode, h = Mn(
            { mode: "hidden", children: h },
            r
          ), l = Ua(
            l,
            r,
            a,
            null
          ), h.return = e, l.return = e, h.sibling = l, e.child = h, l = e.child, l.memoizedState = nr(a), l.childLanes = ir(
            t,
            d,
            a
          ), e.memoizedState = lo, Hl(null, l)) : (da(e), rr(e, h));
        }
        var T = t.memoizedState;
        if (T !== null && (h = T.dehydrated, h !== null)) {
          if (s)
            e.flags & 256 ? (da(e), e.flags &= -257, e = or(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (fa(), e.child = t.child, e.flags |= 128, e = null) : (fa(), h = l.fallback, r = e.mode, l = Mn(
              { mode: "visible", children: l.children },
              r
            ), h = Ua(
              h,
              r,
              a,
              null
            ), h.flags |= 2, l.return = e, h.return = e, l.sibling = h, e.child = l, Va(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = nr(a), l.childLanes = ir(
              t,
              d,
              a
            ), e.memoizedState = lo, e = Hl(null, l));
          else if (da(e), Yr(h))
            d = Am(h).digest, l = Error(c(419)), l.stack = "", l.digest = d, Nl({ value: l, source: null, stack: null }), e = or(
              t,
              e,
              a
            );
          else if (Bt || Ia(
            t,
            e,
            a,
            !1
          ), d = (a & t.childLanes) !== 0, Bt || d) {
            if (d = Et, d !== null && (l = ut(
              d,
              a
            ), l !== 0 && l !== T.retryLane))
              throw T.retryLane = l, Aa(t, l), se(d, t, l), ao;
            qr(h) || Dn(), e = or(
              t,
              e,
              a
            );
          } else
            qr(h) ? (e.flags |= 192, e.child = t.child, e = null) : (t = T.treeContext, ne && (Ct = Ym(
              h
            ), te = e, ht = !0, ya = null, ke = !1, t !== null && W(e, t)), e = rr(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (fa(), h = l.fallback, r = e.mode, T = t.child, s = T.sibling, l = Fe(T, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = T.subtreeFlags & 65011712, s !== null ? h = Fe(
          s,
          h
        ) : (h = Ua(
          h,
          r,
          a,
          null
        ), h.flags |= 2), h.return = e, l.return = e, l.sibling = h, e.child = l, Hl(null, l), l = e.child, h = t.child.memoizedState, h === null ? h = nr(a) : (r = h.cachePool, r !== null ? (T = Ie ? jt._currentValue : jt._currentValue2, r = r.parent !== T ? { parent: T, pool: T } : r) : r = $o(), h = {
          baseLanes: h.baseLanes | a,
          cachePool: r
        }), l.memoizedState = h, l.childLanes = ir(
          t,
          d,
          a
        ), e.memoizedState = lo, Hl(t.child, l)) : (da(e), a = t.child, t = a.sibling, a = Fe(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (d = e.deletions, d === null ? (e.deletions = [t], e.flags |= 16) : d.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function rr(t, e) {
        return e = Mn(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Mn(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function or(t, e, a) {
        return Va(e, t.child, null, a), t = rr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function iu(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), Ti(t.return, e, a);
      }
      function sr(t, e, a, l, r, s) {
        var d = t.memoizedState;
        d === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: r,
          treeForkCount: s
        } : (d.isBackwards = e, d.rendering = null, d.renderingStartTime = 0, d.last = l, d.tail = a, d.tailMode = r, d.treeForkCount = s);
      }
      function ru(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, s = l.tail;
        l = l.children;
        var d = Ut.current, h = (d & 2) !== 0;
        if (h ? (d = d & 1 | 2, e.flags |= 128) : d &= 1, b(Ut, d), $t(t, e, l, a), l = ht ? Zl : 0, !h && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && iu(t, a, e);
            else if (t.tag === 19)
              iu(t, a, e);
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
              t = a.alternate, t !== null && wn(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), sr(
              e,
              !1,
              r,
              a,
              s,
              l
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && wn(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            sr(
              e,
              !0,
              a,
              null,
              s,
              l
            );
            break;
          case "together":
            sr(
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
      function Je(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), _a |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (Ia(
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
          for (t = e.child, a = Fe(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Fe(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function ur(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && dn(t)));
      }
      function zf(t, e, a) {
        switch (e.tag) {
          case 3:
            F(
              e,
              e.stateNode.containerInfo
            ), sa(e, jt, t.memoizedState.cache), Me();
            break;
          case 27:
          case 5:
            gt(e);
            break;
          case 4:
            F(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            sa(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, qi(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (da(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? nu(
                t,
                e,
                a
              ) : (da(e), t = Je(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            da(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (l = (a & e.childLanes) !== 0, l || (Ia(
              t,
              e,
              a,
              !1
            ), l = (a & e.childLanes) !== 0), r) {
              if (l)
                return ru(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), b(Ut, Ut.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, $s(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            sa(e, jt, t.memoizedState.cache);
        }
        return Je(t, e, a);
      }
      function ou(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Bt = !0;
          else {
            if (!ur(t, a) && (e.flags & 128) === 0)
              return Bt = !1, zf(
                t,
                e,
                a
              );
            Bt = (t.flags & 131072) !== 0;
          }
        else
          Bt = !1, ht && (e.flags & 1048576) !== 0 && v(e, Zl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = Ma(e.elementType), e.type = t, typeof t == "function")
                kr(t) ? (l = Oa(t, l), e.tag = 1, e = au(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = lr(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Ar) {
                    e.tag = 11, e = Ws(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Hr) {
                    e.tag = 14, e = Fs(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  }
                }
                throw e = R(t) || t, Error(c(306, e, ""));
              }
            }
            return e;
          case 0:
            return lr(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return l = e.type, r = Oa(
              l,
              e.pendingProps
            ), au(
              t,
              e,
              l,
              r,
              a
            );
          case 3:
            t: {
              if (F(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(c(387));
              var s = e.pendingProps;
              r = e.memoizedState, l = r.element, Hi(t, e), Al(e, s, null, a);
              var d = e.memoizedState;
              if (s = d.cache, sa(e, jt, s), s !== r.cache && Ci(
                e,
                [jt],
                a,
                !0
              ), Ml(), s = d.element, ne && r.isDehydrated)
                if (r = {
                  element: s,
                  isDehydrated: !1,
                  cache: d.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = lu(
                    t,
                    e,
                    s,
                    a
                  );
                  break t;
                } else if (s !== l) {
                  l = it(
                    Error(c(424)),
                    e
                  ), Nl(l), e = lu(
                    t,
                    e,
                    s,
                    a
                  );
                  break t;
                } else
                  for (ne && (Ct = Bm(
                    e.stateNode.containerInfo
                  ), te = e, ht = !0, ya = null, ke = !0), a = Rc(
                    e,
                    null,
                    s,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Me(), s === l) {
                  e = Je(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                $t(t, e, s, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (He)
              return jn(t, e), t === null ? (a = xc(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : ht || (e.stateNode = dp(
                e.type,
                e.pendingProps,
                ba.current,
                e
              )) : e.memoizedState = xc(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Qt)
              return gt(e), t === null && Qt && ht && (l = e.stateNode = kc(
                e.type,
                e.pendingProps,
                ba.current,
                Pt.current,
                !1
              ), te = e, ke = !0, Ct = Gm(
                e.type,
                l,
                Ct
              )), $t(
                t,
                e,
                e.pendingProps.children,
                a
              ), jn(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && ht && (sp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = l = Ct) && (l = Qm(
              l,
              e.type,
              e.pendingProps,
              ke
            ), l !== null ? (e.stateNode = l, te = e, Ct = Dm(l), ke = !1, r = !0) : r = !1), r || rt(e)), gt(e), r = e.type, s = e.pendingProps, d = t !== null ? t.memoizedProps : null, l = s.children, Qn(r, s) ? l = null : d !== null && Qn(r, d) && (e.flags |= 32), e.memoizedState !== null && (r = Gi(
              t,
              e,
              gf,
              null,
              null,
              a
            ), Ie ? Ba._currentValue = r : Ba._currentValue2 = r), jn(t, e), $t(t, e, l, a), e.child;
          case 6:
            return t === null && ht && (up(
              e.pendingProps,
              Pt.current
            ), (t = a = Ct) && (a = Vm(
              a,
              e.pendingProps,
              ke
            ), a !== null ? (e.stateNode = a, te = e, Ct = null, t = !0) : t = !1), t || rt(e)), null;
          case 13:
            return nu(t, e, a);
          case 4:
            return F(
              e,
              e.stateNode.containerInfo
            ), l = e.pendingProps, t === null ? e.child = Va(
              e,
              null,
              l,
              a
            ) : $t(t, e, l, a), e.child;
          case 11:
            return Ws(
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
            return l = e.pendingProps, sa(e, e.type, l.value), $t(
              t,
              e,
              l.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, l = e.pendingProps.children, ja(e), r = It(r), l = l(r), e.flags |= 1, $t(t, e, l, a), e.child;
          case 14:
            return Fs(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Is(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return ru(
              t,
              e,
              a
            );
          case 31:
            return Sf(t, e, a);
          case 22:
            return $s(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return ja(e), l = It(jt), t === null ? (r = Ai(), r === null && (r = Et, s = ji(), r.pooledCache = s, s.refCount++, s !== null && (r.pooledCacheLanes |= a), r = s), e.memoizedState = {
              parent: l,
              cache: r
            }, Ri(e), sa(e, jt, r)) : ((t.lanes & a) !== 0 && (Hi(t, e), Al(e, null, null, a), Ml()), r = t.memoizedState, s = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), sa(e, jt, l)) : (l = s.cache, sa(e, jt, l), l !== r.cache && Ci(
              e,
              [jt],
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
      function Ae(t) {
        t.flags |= 4;
      }
      function An(t) {
        Ye && (t.flags |= 8);
      }
      function su(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function cr(t, e, a, l) {
        if (le)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Dr(t, a.stateNode);
            else if (!(a.tag === 4 || Qt && a.tag === 27) && a.child !== null) {
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
        else if (Ye)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var s = r.stateNode;
              a && l && (s = hc(
                s,
                r.type,
                r.memoizedProps
              )), Dr(t, s);
            } else if (r.tag === 6)
              s = r.stateNode, a && l && (s = gc(
                s,
                r.memoizedProps
              )), Dr(t, s);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                s = r.child, s !== null && (s.return = r), cr(t, r, !0, !0);
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
      function uu(t, e, a, l) {
        var r = !1;
        if (Ye)
          for (var s = e.child; s !== null; ) {
            if (s.tag === 5) {
              var d = s.stateNode;
              a && l && (d = hc(
                d,
                s.type,
                s.memoizedProps
              )), mc(t, d);
            } else if (s.tag === 6)
              d = s.stateNode, a && l && (d = gc(
                d,
                s.memoizedProps
              )), mc(t, d);
            else if (s.tag !== 4) {
              if (s.tag === 22 && s.memoizedState !== null)
                r = s.child, r !== null && (r.return = s), uu(t, s, !0, !0), r = !0;
              else if (s.child !== null) {
                s.child.return = s, s = s.child;
                continue;
              }
            }
            if (s === e) break;
            for (; s.sibling === null; ) {
              if (s.return === null || s.return === e)
                return r;
              s = s.return;
            }
            s.sibling.return = s.return, s = s.sibling;
          }
        return r;
      }
      function cu(t, e) {
        if (Ye && su(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = fc();
          uu(l, e, !1, !1), t.pendingChildren = l, Ae(e), Mm(a, l);
        }
      }
      function dr(t, e, a, l) {
        if (le)
          t.memoizedProps !== l && Ae(e);
        else if (Ye) {
          var r = t.stateNode, s = t.memoizedProps;
          if ((t = su(t, e)) || s !== l) {
            var d = Pt.current;
            s = jm(
              r,
              a,
              s,
              l,
              !t,
              null
            ), s === r ? e.stateNode = r : (An(e), oc(
              s,
              a,
              l,
              d
            ) && Ae(e), e.stateNode = s, t && cr(s, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function fr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? lm(e, l) : nm(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Br(e, l))
            if (uc(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Uu()) t.flags |= 8192;
            else
              throw Qa = Pn, Ir;
        } else t.flags &= -16777217;
      }
      function du(t, e) {
        if (mp(e)) {
          if (t.flags |= 16777216, !Ec(e))
            if (Uu()) t.flags |= 8192;
            else
              throw Qa = Pn, Ir;
        } else t.flags &= -16777217;
      }
      function On(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? O() : 536870912, t.lanes |= e, _l |= e);
      }
      function Ul(t, e) {
        if (!ht)
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
      function Nt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, l = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= l, t.childLanes = a, e;
      }
      function Ef(t, e, a) {
        var l = e.pendingProps;
        switch ($(e), e.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return Nt(e), null;
          case 1:
            return Nt(e), null;
          case 3:
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Xe(jt), P(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (je(e) ? Ae(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, oa())), cu(t, e), Nt(e), null;
          case 26:
            if (He) {
              var r = e.type, s = e.memoizedState;
              return t === null ? (Ae(e), s !== null ? (Nt(e), du(
                e,
                s
              )) : (Nt(e), fr(
                e,
                r,
                null,
                l,
                a
              ))) : s ? s !== t.memoizedState ? (Ae(e), Nt(e), du(
                e,
                s
              )) : (Nt(e), e.flags &= -16777217) : (s = t.memoizedProps, le ? s !== l && Ae(e) : dr(
                t,
                e,
                r,
                l
              ), Nt(e), fr(
                e,
                r,
                s,
                l,
                a
              )), null;
            }
          case 27:
            if (Qt) {
              if (Zt(e), a = ba.current, r = e.type, t !== null && e.stateNode != null)
                le ? t.memoizedProps !== l && Ae(e) : dr(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return Nt(e), null;
                }
                t = Pt.current, je(e) ? Ta(e, t) : (t = kc(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Ae(e));
              }
              return Nt(e), null;
            }
          case 5:
            if (Zt(e), r = e.type, t !== null && e.stateNode != null)
              dr(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return Nt(e), null;
              }
              if (s = Pt.current, je(e))
                Ta(e, s), ap(
                  e.stateNode,
                  r,
                  l,
                  s
                ) && (e.flags |= 64);
              else {
                var d = Wf(
                  r,
                  l,
                  ba.current,
                  s,
                  e
                );
                An(e), cr(d, e, !1, !1), e.stateNode = d, oc(
                  d,
                  r,
                  l,
                  s
                ) && Ae(e);
              }
            }
            return Nt(e), fr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, le ? a !== l && Ae(e) : Ye && (a !== l ? (t = ba.current, a = Pt.current, An(e), e.stateNode = sc(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = ba.current, a = Pt.current, je(e)) {
                if (!ne) throw Error(c(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                Jm(
                  t,
                  a,
                  e,
                  l
                ) || rt(e, !0);
              } else
                An(e), e.stateNode = sc(
                  l,
                  t,
                  a,
                  e
                );
            }
            return Nt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = je(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(c(318));
                  if (!ne) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  Lm(t, e);
                } else
                  Me(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Nt(e), t = !1;
              } else
                a = oa(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return Nt(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = je(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!ne) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  Wm(r, e);
                } else
                  Me(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Nt(e), r = !1;
              } else
                r = oa(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
            }
            return fe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), s = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (s = l.memoizedState.cachePool.pool), s !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), On(e, e.updateQueue), Nt(e), null);
          case 4:
            return P(), cu(t, e), t === null && Pf(e.stateNode.containerInfo), Nt(e), null;
          case 10:
            return Xe(e.type), Nt(e), null;
          case 19:
            if (E(Ut), l = e.memoizedState, l === null) return Nt(e), null;
            if (r = (e.flags & 128) !== 0, s = l.rendering, s === null)
              if (r) Ul(l, !1);
              else {
                if (Ot !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (s = wn(t), s !== null) {
                      for (e.flags |= 128, Ul(l, !1), t = s.updateQueue, e.updateQueue = t, On(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Fu(a, t), a = a.sibling;
                      return b(
                        Ut,
                        Ut.current & 1 | 2
                      ), ht && Q(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && ue() > tn && (e.flags |= 128, r = !0, Ul(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = wn(s), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, On(e, t), Ul(l, !0), l.tail === null && l.tailMode === "hidden" && !s.alternate && !ht)
                    return Nt(e), null;
                } else
                  2 * ue() - l.renderingStartTime > tn && a !== 536870912 && (e.flags |= 128, r = !0, Ul(l, !1), e.lanes = 4194304);
              l.isBackwards ? (s.sibling = e.child, e.child = s) : (t = l.last, t !== null ? t.sibling = s : e.child = s, l.last = s);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = ue(), t.sibling = null, a = Ut.current, b(
              Ut,
              r ? a & 1 | 2 : a & 1
            ), ht && Q(e, l.treeForkCount), t) : (Nt(e), null);
          case 22:
          case 23:
            return fe(e), Bi(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Nt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Nt(e), a = e.updateQueue, a !== null && On(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && E(Ga), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Xe(jt), Nt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function kf(t, e) {
        switch ($(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Xe(jt), P(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Zt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (fe(e), e.alternate === null)
                throw Error(c(340));
              Me();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (fe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(c(340));
              Me();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return E(Ut), null;
          case 4:
            return P(), null;
          case 10:
            return Xe(e.type), null;
          case 22:
          case 23:
            return fe(e), Bi(), t !== null && E(Ga), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Xe(jt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function fu(t, e) {
        switch ($(e), e.tag) {
          case 3:
            Xe(jt), P();
            break;
          case 26:
          case 27:
          case 5:
            Zt(e);
            break;
          case 4:
            P();
            break;
          case 31:
            e.memoizedState !== null && fe(e);
            break;
          case 13:
            fe(e);
            break;
          case 19:
            E(Ut);
            break;
          case 10:
            Xe(e.type);
            break;
          case 22:
          case 23:
            fe(e), Bi(), t !== null && E(Ga);
            break;
          case 24:
            Xe(jt);
        }
      }
      function Dl(t, e) {
        try {
          var a = e.updateQueue, l = a !== null ? a.lastEffect : null;
          if (l !== null) {
            var r = l.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                l = void 0;
                var s = a.create, d = a.inst;
                l = s(), d.destroy = l;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (h) {
          vt(e, e.return, h);
        }
      }
      function ma(t, e, a) {
        try {
          var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
          if (r !== null) {
            var s = r.next;
            l = s;
            do {
              if ((l.tag & t) === t) {
                var d = l.inst, h = d.destroy;
                if (h !== void 0) {
                  d.destroy = void 0, r = e;
                  var T = a, U = h;
                  try {
                    U();
                  } catch (V) {
                    vt(
                      r,
                      T,
                      V
                    );
                  }
                }
              }
              l = l.next;
            } while (l !== s);
          }
        } catch (V) {
          vt(e, e.return, V);
        }
      }
      function mu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            rs(e, a);
          } catch (l) {
            vt(t, t.return, l);
          }
        }
      }
      function pu(t, e, a) {
        a.props = Oa(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (l) {
          vt(t, e, l);
        }
      }
      function Bl(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var l = Ql(t.stateNode);
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
          vt(t, e, r);
        }
      }
      function qe(t, e) {
        var a = t.ref, l = t.refCleanup;
        if (a !== null)
          if (typeof l == "function")
            try {
              l();
            } catch (r) {
              vt(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (r) {
              vt(t, e, r);
            }
          else a.current = null;
      }
      function hu(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          ym(l, e, a, t);
        } catch (r) {
          vt(t, t.return, r);
        }
      }
      function mr(t, e, a) {
        try {
          xm(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          vt(t, t.return, l);
        }
      }
      function gu(t) {
        return t.tag === 5 || t.tag === 3 || (He ? t.tag === 26 : !1) || (Qt ? t.tag === 27 && rl(t.type) : !1) || t.tag === 4;
      }
      function pr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || gu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Qt && t.tag === 27 && rl(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function hr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? _m(a, t, e) : vm(a, t);
        else if (l !== 4 && (Qt && l === 27 && rl(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (hr(t, e, a), t = t.sibling; t !== null; )
            hr(t, e, a), t = t.sibling;
      }
      function Rn(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? wm(a, t, e) : gm(a, t);
        else if (l !== 4 && (Qt && l === 27 && rl(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Rn(t, e, a), t = t.sibling; t !== null; )
            Rn(t, e, a), t = t.sibling;
      }
      function vu(t, e, a) {
        t = t.containerInfo;
        try {
          pc(t, a);
        } catch (l) {
          vt(e, e.return, l);
        }
      }
      function bu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          hp(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          vt(t, t.return, l);
        }
      }
      function Nf(t, e) {
        for (Jf(t.containerInfo), Lt = e; Lt !== null; )
          if (t = Lt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Lt = e;
          else
            for (; Lt !== null; ) {
              t = Lt;
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
                    var s = l.stateNode;
                    try {
                      var d = Oa(
                        l.type,
                        r
                      );
                      e = s.getSnapshotBeforeUpdate(
                        d,
                        a
                      ), s.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (h) {
                      vt(l, l.return, h);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && le && Cm(t.stateNode.containerInfo);
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
                e.return = t.return, Lt = e;
                break;
              }
              Lt = t.return;
            }
      }
      function yu(t, e, a) {
        var l = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Le(t, a), l & 4 && Dl(5, a);
            break;
          case 1:
            if (Le(t, a), l & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (d) {
                  vt(a, a.return, d);
                }
              else {
                var r = Oa(
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
                } catch (d) {
                  vt(
                    a,
                    a.return,
                    d
                  );
                }
              }
            l & 64 && mu(a), l & 512 && Bl(a, a.return);
            break;
          case 3:
            if (Le(t, a), l & 64 && (l = a.updateQueue, l !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Ql(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                rs(l, t);
              } catch (d) {
                vt(a, a.return, d);
              }
            }
            break;
          case 27:
            Qt && e === null && l & 4 && bu(a);
          case 26:
          case 5:
            if (Le(t, a), e === null) {
              if (l & 4) hu(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  $m(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (d) {
                  vt(a, a.return, d);
                }
              }
            }
            l & 512 && Bl(a, a.return);
            break;
          case 12:
            Le(t, a);
            break;
          case 31:
            Le(t, a), l & 4 && wu(t, a);
            break;
          case 13:
            Le(t, a), l & 4 && _u(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = Rf.bind(
              null,
              a
            ), Om(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || ea, !l) {
              e = e !== null && e.memoizedState !== null || qt, r = ea;
              var s = qt;
              ea = l, (qt = e) && !s ? We(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Le(t, a), ea = r, qt = s;
            }
            break;
          case 30:
            break;
          default:
            Le(t, a);
        }
      }
      function xu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, xu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && am(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Oe(t, e, a) {
        for (a = a.child; a !== null; )
          gr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function gr(t, e, a) {
        if (ge && typeof ge.onCommitFiberUnmount == "function")
          try {
            ge.onCommitFiberUnmount(Xl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (He) {
              qt || qe(a, e), Oe(
                t,
                e,
                a
              ), a.memoizedState ? _c(a.memoizedState) : a.stateNode && zc(a.stateNode);
              break;
            }
          case 27:
            if (Qt) {
              qt || qe(a, e);
              var l = Yt, r = ce;
              rl(a.type) && (Yt = a.stateNode, ce = !1), Oe(
                t,
                e,
                a
              ), Nc(a.stateNode), Yt = l, ce = r;
              break;
            }
          case 5:
            qt || qe(a, e);
          case 6:
            if (le) {
              if (l = Yt, r = ce, Yt = null, Oe(
                t,
                e,
                a
              ), Yt = l, ce = r, Yt !== null)
                if (ce)
                  try {
                    zm(Yt, a.stateNode);
                  } catch (s) {
                    vt(
                      a,
                      e,
                      s
                    );
                  }
                else
                  try {
                    Sm(Yt, a.stateNode);
                  } catch (s) {
                    vt(
                      a,
                      e,
                      s
                    );
                  }
            } else
              Oe(
                t,
                e,
                a
              );
            break;
          case 18:
            le && Yt !== null && (ce ? ip(
              Yt,
              a.stateNode
            ) : np(Yt, a.stateNode));
            break;
          case 4:
            le ? (l = Yt, r = ce, Yt = a.stateNode.containerInfo, ce = !0, Oe(
              t,
              e,
              a
            ), Yt = l, ce = r) : (Ye && vu(
              a.stateNode,
              a,
              fc()
            ), Oe(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            ma(2, a, e), qt || ma(4, a, e), Oe(
              t,
              e,
              a
            );
            break;
          case 1:
            qt || (qe(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && pu(
              a,
              e,
              l
            )), Oe(
              t,
              e,
              a
            );
            break;
          case 21:
            Oe(
              t,
              e,
              a
            );
            break;
          case 22:
            qt = (l = qt) || a.memoizedState !== null, Oe(
              t,
              e,
              a
            ), qt = l;
            break;
          default:
            Oe(
              t,
              e,
              a
            );
        }
      }
      function wu(t, e) {
        if (ne && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            tp(t);
          } catch (a) {
            vt(e, e.return, a);
          }
        }
      }
      function _u(t, e) {
        if (ne && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            ep(t);
          } catch (a) {
            vt(e, e.return, a);
          }
      }
      function Tf(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Dc()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Dc()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function Hn(t, e) {
        var a = Tf(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = Hf.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ae(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], s = t, d = e;
            if (le) {
              var h = d;
              t: for (; h !== null; ) {
                switch (h.tag) {
                  case 27:
                    if (Qt) {
                      if (rl(h.type)) {
                        Yt = h.stateNode, ce = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Yt = h.stateNode, ce = !1;
                    break t;
                  case 3:
                  case 4:
                    Yt = h.stateNode.containerInfo, ce = !0;
                    break t;
                }
                h = h.return;
              }
              if (Yt === null) throw Error(c(160));
              gr(s, d, r), Yt = null, ce = !1;
            } else gr(s, d, r);
            s = r.alternate, s !== null && (s.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Su(e, t), e = e.sibling;
      }
      function Su(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ae(e, t), oe(t), l & 4 && (ma(3, t, t.return), Dl(3, t), ma(5, t, t.return));
            break;
          case 1:
            ae(e, t), oe(t), l & 512 && (qt || a === null || qe(a, a.return)), l & 64 && ea && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (He) {
              var r = Ue;
              if (ae(e, t), oe(t), l & 512 && (qt || a === null || qe(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var s = t.memoizedState;
                a === null ? s === null ? t.stateNode === null ? t.stateNode = cp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Sc(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = wc(
                  r,
                  s,
                  t.memoizedProps
                ) : l !== s ? (l === null ? a.stateNode !== null && zc(a.stateNode) : _c(l), s === null ? Sc(
                  r,
                  t.type,
                  t.stateNode
                ) : wc(
                  r,
                  s,
                  t.memoizedProps
                )) : s === null && t.stateNode !== null && mr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Qt) {
              ae(e, t), oe(t), l & 512 && (qt || a === null || qe(a, a.return)), a !== null && l & 4 && mr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ae(e, t), oe(t), l & 512 && (qt || a === null || qe(a, a.return)), le) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  dc(r);
                } catch (q) {
                  vt(t, t.return, q);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, mr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (no = !0);
            } else
              Ye && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ae(e, t), oe(t), l & 4 && le) {
              if (t.stateNode === null)
                throw Error(c(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                bm(r, a, l);
              } catch (q) {
                vt(t, t.return, q);
              }
            }
            break;
          case 3:
            if (He ? (fp(), r = Ue, Ue = Gr(e.containerInfo), ae(e, t), Ue = r) : ae(e, t), oe(t), l & 4) {
              if (le && ne && a !== null && a.memoizedState.isDehydrated)
                try {
                  Pm(e.containerInfo);
                } catch (q) {
                  vt(t, t.return, q);
                }
              if (Ye) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  pc(l, a);
                } catch (q) {
                  vt(t, t.return, q);
                }
              }
            }
            no && (no = !1, zu(t));
            break;
          case 4:
            He ? (a = Ue, Ue = Gr(
              t.stateNode.containerInfo
            ), ae(e, t), oe(t), Ue = a) : (ae(e, t), oe(t)), l & 4 && Ye && vu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ae(e, t), oe(t);
            break;
          case 31:
            ae(e, t), oe(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Hn(t, l)));
            break;
          case 13:
            ae(e, t), oe(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (si = ue()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Hn(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var d = a !== null && a.memoizedState !== null, h = ea, T = qt;
            if (ea = h || r, qt = T || d, ae(e, t), qt = T, ea = h, oe(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || d || ea || qt || Ra(t)), le)) {
              t: if (a = null, le)
                for (e = t; ; ) {
                  if (e.tag === 5 || He && e.tag === 26) {
                    if (a === null) {
                      d = a = e;
                      try {
                        s = d.stateNode, r ? Em(s) : Nm(
                          d.stateNode,
                          d.memoizedProps
                        );
                      } catch (q) {
                        vt(d, d.return, q);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      d = e;
                      try {
                        var U = d.stateNode;
                        r ? km(U) : Tm(U, d.memoizedProps);
                      } catch (q) {
                        vt(d, d.return, q);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      d = e;
                      try {
                        var V = d.stateNode;
                        r ? rp(V) : op(d.stateNode);
                      } catch (q) {
                        vt(d, d.return, q);
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
            l & 4 && (l = t.updateQueue, l !== null && (a = l.retryQueue, a !== null && (l.retryQueue = null, Hn(t, a))));
            break;
          case 19:
            ae(e, t), oe(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Hn(t, l)));
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
              if (gu(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (le) {
              if (a == null) throw Error(c(160));
              switch (a.tag) {
                case 27:
                  if (Qt) {
                    var r = a.stateNode, s = pr(t);
                    Rn(t, s, r);
                    break;
                  }
                case 5:
                  var d = a.stateNode;
                  a.flags & 32 && (dc(d), a.flags &= -33);
                  var h = pr(t);
                  Rn(t, h, d);
                  break;
                case 3:
                case 4:
                  var T = a.stateNode.containerInfo, U = pr(t);
                  hr(
                    t,
                    U,
                    T
                  );
                  break;
                default:
                  throw Error(c(161));
              }
            }
          } catch (V) {
            vt(t, t.return, V);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function zu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            zu(e), e.tag === 5 && e.flags & 1024 && om(e.stateNode), t = t.sibling;
          }
      }
      function Le(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            yu(t, e.alternate, e), e = e.sibling;
      }
      function Ra(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ma(4, e, e.return), Ra(e);
              break;
            case 1:
              qe(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && pu(
                e,
                e.return,
                a
              ), Ra(e);
              break;
            case 27:
              Qt && Nc(e.stateNode);
            case 26:
            case 5:
              qe(e, e.return), Ra(e);
              break;
            case 22:
              e.memoizedState === null && Ra(e);
              break;
            case 30:
              Ra(e);
              break;
            default:
              Ra(e);
          }
          t = t.sibling;
        }
      }
      function We(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var l = e.alternate, r = t, s = e, d = s.flags;
          switch (s.tag) {
            case 0:
            case 11:
            case 15:
              We(
                r,
                s,
                a
              ), Dl(4, s);
              break;
            case 1:
              if (We(
                r,
                s,
                a
              ), l = s, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (U) {
                  vt(l, l.return, U);
                }
              if (l = s, r = l.updateQueue, r !== null) {
                var h = l.stateNode;
                try {
                  var T = r.shared.hiddenCallbacks;
                  if (T !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < T.length; r++)
                      is(T[r], h);
                } catch (U) {
                  vt(l, l.return, U);
                }
              }
              a && d & 64 && mu(s), Bl(s, s.return);
              break;
            case 27:
              Qt && bu(s);
            case 26:
            case 5:
              We(
                r,
                s,
                a
              ), a && l === null && d & 4 && hu(s), Bl(s, s.return);
              break;
            case 12:
              We(
                r,
                s,
                a
              );
              break;
            case 31:
              We(
                r,
                s,
                a
              ), a && d & 4 && wu(r, s);
              break;
            case 13:
              We(
                r,
                s,
                a
              ), a && d & 4 && _u(r, s);
              break;
            case 22:
              s.memoizedState === null && We(
                r,
                s,
                a
              ), Bl(s, s.return);
              break;
            case 30:
              break;
            default:
              We(
                r,
                s,
                a
              );
          }
          e = e.sibling;
        }
      }
      function vr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Tl(a));
      }
      function br(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Tl(t));
      }
      function Re(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Eu(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function Eu(t, e, a, l) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Re(
              t,
              e,
              a,
              l
            ), r & 2048 && Dl(9, e);
            break;
          case 1:
            Re(
              t,
              e,
              a,
              l
            );
            break;
          case 3:
            Re(
              t,
              e,
              a,
              l
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Tl(t)));
            break;
          case 12:
            if (r & 2048) {
              Re(
                t,
                e,
                a,
                l
              ), t = e.stateNode;
              try {
                var s = e.memoizedProps, d = s.id, h = s.onPostCommit;
                typeof h == "function" && h(
                  d,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (T) {
                vt(e, e.return, T);
              }
            } else
              Re(
                t,
                e,
                a,
                l
              );
            break;
          case 31:
            Re(
              t,
              e,
              a,
              l
            );
            break;
          case 13:
            Re(
              t,
              e,
              a,
              l
            );
            break;
          case 23:
            break;
          case 22:
            s = e.stateNode, d = e.alternate, e.memoizedState !== null ? s._visibility & 2 ? Re(
              t,
              e,
              a,
              l
            ) : ql(
              t,
              e
            ) : s._visibility & 2 ? Re(
              t,
              e,
              a,
              l
            ) : (s._visibility |= 2, tl(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && vr(d, e);
            break;
          case 24:
            Re(
              t,
              e,
              a,
              l
            ), r & 2048 && br(e.alternate, e);
            break;
          default:
            Re(
              t,
              e,
              a,
              l
            );
        }
      }
      function tl(t, e, a, l, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var s = t, d = e, h = a, T = l, U = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              tl(
                s,
                d,
                h,
                T,
                r
              ), Dl(8, d);
              break;
            case 23:
              break;
            case 22:
              var V = d.stateNode;
              d.memoizedState !== null ? V._visibility & 2 ? tl(
                s,
                d,
                h,
                T,
                r
              ) : ql(
                s,
                d
              ) : (V._visibility |= 2, tl(
                s,
                d,
                h,
                T,
                r
              )), r && U & 2048 && vr(
                d.alternate,
                d
              );
              break;
            case 24:
              tl(
                s,
                d,
                h,
                T,
                r
              ), r && U & 2048 && br(d.alternate, d);
              break;
            default:
              tl(
                s,
                d,
                h,
                T,
                r
              );
          }
          e = e.sibling;
        }
      }
      function ql(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, l = e, r = l.flags;
            switch (l.tag) {
              case 22:
                ql(a, l), r & 2048 && vr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                ql(a, l), r & 2048 && br(
                  l.alternate,
                  l
                );
                break;
              default:
                ql(a, l);
            }
            e = e.sibling;
          }
      }
      function Ha(t, e, a) {
        if (t.subtreeFlags & xl)
          for (t = t.child; t !== null; )
            ku(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function ku(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ha(
              t,
              e,
              a
            ), t.flags & xl)
              if (t.memoizedState !== null)
                pp(
                  a,
                  Ue,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Br(r, t)) && cc(a, l, r, t);
              }
            break;
          case 5:
            Ha(
              t,
              e,
              a
            ), t.flags & xl && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Br(r, t)) && cc(a, l, r, t));
            break;
          case 3:
          case 4:
            He ? (l = Ue, Ue = Gr(
              t.stateNode.containerInfo
            ), Ha(
              t,
              e,
              a
            ), Ue = l) : Ha(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = xl, xl = 16777216, Ha(
              t,
              e,
              a
            ), xl = l) : Ha(
              t,
              e,
              a
            ));
            break;
          default:
            Ha(
              t,
              e,
              a
            );
        }
      }
      function Nu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Yl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Lt = l, Cu(
                l,
                t
              );
            }
          Nu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Tu(t), t = t.sibling;
      }
      function Tu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Yl(t), t.flags & 2048 && ma(9, t, t.return);
            break;
          case 3:
            Yl(t);
            break;
          case 12:
            Yl(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Un(t)) : Yl(t);
            break;
          default:
            Yl(t);
        }
      }
      function Un(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Lt = l, Cu(
                l,
                t
              );
            }
          Nu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ma(8, e, e.return), Un(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Un(e));
              break;
            default:
              Un(e);
          }
          t = t.sibling;
        }
      }
      function Cu(t, e) {
        for (; Lt !== null; ) {
          var a = Lt;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              ma(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var l = a.memoizedState.cachePool.pool;
                l != null && l.refCount++;
              }
              break;
            case 24:
              Tl(a.memoizedState.cache);
          }
          if (l = a.child, l !== null) l.return = a, Lt = l;
          else
            t: for (a = t; Lt !== null; ) {
              l = Lt;
              var r = l.sibling, s = l.return;
              if (xu(l), l === a) {
                Lt = null;
                break t;
              }
              if (r !== null) {
                r.return = s, Lt = r;
                break t;
              }
              Lt = s;
            }
        }
      }
      function yr(t) {
        var e = $f(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = cm(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function xr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case li:
            if (t.type === e.value) return !0;
            break;
          case ni:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, s = t[a++], d = e[s];
                if (r !== 5 && r !== 26 && r !== 27 || !Kl(l)) {
                  for (; d != null && xr(l, d); )
                    s++, d = e[s];
                  if (s === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (l = l.child; l !== null; )
                      t.push(l, s), l = l.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ii:
            if ((a === 5 || a === 26 || a === 27) && mm(t.stateNode, e.value))
              return !0;
            break;
          case oi:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = fm(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ri:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function wr(t) {
        switch (t.$$typeof) {
          case li:
            return "<" + (R(t.value) || "Unknown") + ">";
          case ni:
            return ":has(" + (wr(t) || "") + ")";
          case ii:
            return '[role="' + t.value + '"]';
          case oi:
            return '"' + t.value + '"';
          case ri:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function ju(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], s = r.tag, d = t[l++], h = e[d];
          if (s !== 5 && s !== 26 && s !== 27 || !Kl(r)) {
            for (; h != null && xr(r, h); )
              d++, h = e[d];
            if (d === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, d), r = r.sibling;
          }
        }
        return a;
      }
      function _r(t, e) {
        if (!Vl) throw Error(c(363));
        t = yr(t), t = ju(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var l = t[a++], r = l.tag;
          if (r === 5 || r === 26 || r === 27)
            Kl(l) || e.push(l.stateNode);
          else
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
        }
        return e;
      }
      function me() {
        return (ft & 2) !== 0 && pt !== 0 ? pt & -pt : tt.T !== null ? Mi() : tm();
      }
      function Mu() {
        if (xe === 0)
          if ((pt & 536870912) === 0 || ht) {
            var t = Kn;
            Kn <<= 1, (Kn & 3932160) === 0 && (Kn = 262144), xe = t;
          } else xe = 536870912;
        return t = be.current, t !== null && (t.flags |= 32), xe;
      }
      function se(t, e, a) {
        (t === Et && (_t === 2 || _t === 9) || t.cancelPendingCommit !== null) && (el(t, 0), pa(
          t,
          pt,
          xe,
          !1
        )), K(t, a), ((ft & 2) === 0 || t !== Et) && (t === Et && ((ft & 2) === 0 && (Xa |= a), Ot === 4 && pa(
          t,
          pt,
          xe,
          !1
        )), Be(t));
      }
      function Au(t, e, a) {
        if ((ft & 6) !== 0) throw Error(c(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || z(t, e), r = l ? Mf(t, e) : zr(t, e, !0), s = l;
        do {
          if (r === 0) {
            wl && !l && pa(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, s && !Cf(a)) {
              r = zr(t, e, !1), s = !1;
              continue;
            }
            if (r === 2) {
              if (s = e, t.errorRecoveryDisabledLanes & s)
                var d = 0;
              else
                d = t.pendingLanes & -536870913, d = d !== 0 ? d : d & 536870912 ? 536870912 : 0;
              if (d !== 0) {
                e = d;
                t: {
                  var h = t;
                  r = Pl;
                  var T = ne && h.current.memoizedState.isDehydrated;
                  if (T && (el(h, d).flags |= 256), d = zr(
                    h,
                    d,
                    !1
                  ), d !== 2) {
                    if (io && !T) {
                      h.errorRecoveryDisabledLanes |= s, Xa |= s, r = 4;
                      break t;
                    }
                    s = de, de = r, s !== null && (de === null ? de = s : de.push.apply(
                      de,
                      s
                    ));
                  }
                  r = d;
                }
                if (s = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              el(t, 0), pa(t, e, 0, !0);
              break;
            }
            t: {
              switch (l = t, s = r, s) {
                case 0:
                case 1:
                  throw Error(c(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  pa(
                    l,
                    e,
                    xe,
                    !wa
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
              if ((e & 62914560) === e && (r = si + 300 - ue(), 10 < r)) {
                if (pa(
                  l,
                  e,
                  xe,
                  !wa
                ), M(l, 0, !0) !== 0) break t;
                la = e, l.timeoutHandle = Ff(
                  Ou.bind(
                    null,
                    l,
                    a,
                    de,
                    ui,
                    oo,
                    e,
                    xe,
                    Xa,
                    _l,
                    wa,
                    s,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Ou(
                l,
                a,
                de,
                ui,
                oo,
                e,
                xe,
                Xa,
                _l,
                wa,
                s,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Be(t);
      }
      function Ou(t, e, a, l, r, s, d, h, T, U, V, q, Z, ot) {
        if (t.timeoutHandle = Da, q = e.subtreeFlags, q & 8192 || (q & 16785408) === 16785408) {
          q = im(), ku(
            e,
            s,
            q
          );
          var ee = (s & 62914560) === s ? si - ue() : (s & 4194048) === s ? Bc - ue() : 0;
          if (ee = rm(
            q,
            ee
          ), ee !== null) {
            la = s, t.cancelPendingCommit = ee(
              Qu.bind(
                null,
                t,
                e,
                s,
                a,
                l,
                r,
                d,
                h,
                T,
                V,
                q,
                null,
                Z,
                ot
              )
            ), pa(t, s, d, !U);
            return;
          }
        }
        Qu(
          t,
          e,
          s,
          a,
          l,
          r,
          d,
          h,
          T
        );
      }
      function Cf(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var l = 0; l < a.length; l++) {
              var r = a[l], s = r.getSnapshot;
              r = r.value;
              try {
                if (!ve(s(), r)) return !1;
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
      function pa(t, e, a, l) {
        e &= ~ro, e &= ~Xa, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var s = 31 - he(r), d = 1 << s;
          l[s] = -1, r &= ~d;
        }
        a !== 0 && S(t, a, e);
      }
      function Ru() {
        return (ft & 6) === 0 ? ($a(0), !1) : !0;
      }
      function Sr() {
        if (mt !== null) {
          if (_t === 0)
            var t = mt.return;
          else
            t = mt, Pe = qa = null, Ki(t), hl = null, Wl = 0, t = mt;
          for (; t !== null; )
            fu(t.alternate, t), t = t.return;
          mt = null;
        }
      }
      function el(t, e) {
        var a = t.timeoutHandle;
        a !== Da && (t.timeoutHandle = Da, If(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), la = 0, Sr(), Et = t, mt = a = Fe(t.current, null), pt = e, _t = 0, ye = null, wa = !1, wl = z(t, e), io = !1, _l = xe = ro = Xa = _a = Ot = 0, de = Pl = null, oo = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - he(l), s = 1 << r;
            e |= t[r], l &= ~s;
          }
        return aa = e, bn(), a;
      }
      function Hu(t, e) {
        st = null, tt.H = Il, e === pl || e === $n ? (e = es(), _t = 3) : e === Ir ? (e = es(), _t = 4) : _t = e === ao ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ye = e, mt === null && (Ot = 1, Tn(
          t,
          it(e, t.current)
        ));
      }
      function Uu() {
        var t = be.current;
        return t === null ? !0 : (pt & 4194048) === pt ? Te === null : (pt & 62914560) === pt || (pt & 536870912) !== 0 ? t === Te : !1;
      }
      function Du() {
        var t = tt.H;
        return tt.H = Il, t === null ? Il : t;
      }
      function Bu() {
        var t = tt.A;
        return tt.A = Cp, t;
      }
      function Dn() {
        Ot = 4, wa || (pt & 4194048) !== pt && be.current !== null || (wl = !0), (_a & 134217727) === 0 && (Xa & 134217727) === 0 || Et === null || pa(
          Et,
          pt,
          xe,
          !1
        );
      }
      function zr(t, e, a) {
        var l = ft;
        ft |= 2;
        var r = Du(), s = Bu();
        (Et !== t || pt !== e) && (ui = null, el(t, e)), e = !1;
        var d = Ot;
        t: do
          try {
            if (_t !== 0 && mt !== null) {
              var h = mt, T = ye;
              switch (_t) {
                case 8:
                  Sr(), d = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  be.current === null && (e = !0);
                  var U = _t;
                  if (_t = 0, ye = null, al(t, h, T, U), a && wl) {
                    d = 0;
                    break t;
                  }
                  break;
                default:
                  U = _t, _t = 0, ye = null, al(t, h, T, U);
              }
            }
            jf(), d = Ot;
            break;
          } catch (V) {
            Hu(t, V);
          }
        while (!0);
        return e && t.shellSuspendCounter++, Pe = qa = null, ft = l, tt.H = r, tt.A = s, mt === null && (Et = null, pt = 0, bn()), d;
      }
      function jf() {
        for (; mt !== null; ) qu(mt);
      }
      function Mf(t, e) {
        var a = ft;
        ft |= 2;
        var l = Du(), r = Bu();
        Et !== t || pt !== e ? (ui = null, tn = ue() + 500, el(t, e)) : wl = z(
          t,
          e
        );
        t: do
          try {
            if (_t !== 0 && mt !== null) {
              e = mt;
              var s = ye;
              e: switch (_t) {
                case 1:
                  _t = 0, ye = null, al(t, e, s, 1);
                  break;
                case 2:
                case 9:
                  if (Po(s)) {
                    _t = 0, ye = null, Yu(e);
                    break;
                  }
                  e = function() {
                    _t !== 2 && _t !== 9 || Et !== t || (_t = 7), Be(t);
                  }, s.then(e, e);
                  break t;
                case 3:
                  _t = 7;
                  break t;
                case 4:
                  _t = 5;
                  break t;
                case 7:
                  Po(s) ? (_t = 0, ye = null, Yu(e)) : (_t = 0, ye = null, al(t, e, s, 7));
                  break;
                case 5:
                  var d = null;
                  switch (mt.tag) {
                    case 26:
                      d = mt.memoizedState;
                    case 5:
                    case 27:
                      var h = mt, T = h.type, U = h.pendingProps;
                      if (d ? Ec(d) : uc(h.stateNode, T, U)) {
                        _t = 0, ye = null;
                        var V = h.sibling;
                        if (V !== null) mt = V;
                        else {
                          var q = h.return;
                          q !== null ? (mt = q, Bn(q)) : mt = null;
                        }
                        break e;
                      }
                  }
                  _t = 0, ye = null, al(t, e, s, 5);
                  break;
                case 6:
                  _t = 0, ye = null, al(t, e, s, 6);
                  break;
                case 8:
                  Sr(), Ot = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            Af();
            break;
          } catch (Z) {
            Hu(t, Z);
          }
        while (!0);
        return Pe = qa = null, tt.H = l, tt.A = r, ft = a, mt !== null ? 0 : (Et = null, pt = 0, bn(), Ot);
      }
      function Af() {
        for (; mt !== null && !bp(); )
          qu(mt);
      }
      function qu(t) {
        var e = ou(
          t.alternate,
          t,
          aa
        );
        t.memoizedProps = t.pendingProps, e === null ? Bn(t) : mt = e;
      }
      function Yu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = eu(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              pt
            );
            break;
          case 11:
            e = eu(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              pt
            );
            break;
          case 5:
            Ki(e);
          default:
            fu(a, e), e = mt = Fu(e, aa), e = ou(a, e, aa);
        }
        t.memoizedProps = t.pendingProps, e === null ? Bn(t) : mt = e;
      }
      function al(t, e, a, l) {
        Pe = qa = null, Ki(e), hl = null, Wl = 0;
        var r = e.return;
        try {
          if (_f(
            t,
            r,
            e,
            a,
            pt
          )) {
            Ot = 1, Tn(
              t,
              it(a, t.current)
            ), mt = null;
            return;
          }
        } catch (s) {
          if (r !== null) throw mt = r, s;
          Ot = 1, Tn(
            t,
            it(a, t.current)
          ), mt = null;
          return;
        }
        e.flags & 32768 ? (ht || l === 1 ? t = !0 : wl || (pt & 536870912) !== 0 ? t = !1 : (wa = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = be.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Gu(e, t)) : Bn(e);
      }
      function Bn(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Gu(
              e,
              wa
            );
            return;
          }
          t = e.return;
          var a = Ef(
            e.alternate,
            e,
            aa
          );
          if (a !== null) {
            mt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            mt = e;
            return;
          }
          mt = e = t;
        } while (e !== null);
        Ot === 0 && (Ot = 5);
      }
      function Gu(t, e) {
        do {
          var a = kf(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, mt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            mt = t;
            return;
          }
          mt = t = a;
        } while (t !== null);
        Ot = 6, mt = null;
      }
      function Qu(t, e, a, l, r, s, d, h, T) {
        t.cancelPendingCommit = null;
        do
          Gl();
        while (Vt !== 0);
        if ((ft & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (s = e.lanes | e.childLanes, s |= $r, N(
            t,
            a,
            s,
            d,
            h,
            T
          ), t === Et && (mt = Et = null, pt = 0), Sl = e, za = t, la = a, so = s, uo = r, qc = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Uf(Kr, function() {
            return Ju(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = tt.T, tt.T = null, r = $e(), Jt(2), d = ft, ft |= 4;
            try {
              Nf(t, e, a);
            } finally {
              ft = d, Jt(r), tt.T = l;
            }
          }
          Vt = 1, Vu(), Ku(), Xu();
        }
      }
      function Vu() {
        if (Vt === 1) {
          Vt = 0;
          var t = za, e = Sl, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = tt.T, tt.T = null;
            var l = $e();
            Jt(2);
            var r = ft;
            ft |= 4;
            try {
              Su(e, t), Lf(t.containerInfo);
            } finally {
              ft = r, Jt(l), tt.T = a;
            }
          }
          t.current = e, Vt = 2;
        }
      }
      function Ku() {
        if (Vt === 2) {
          Vt = 0;
          var t = za, e = Sl, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = tt.T, tt.T = null;
            var l = $e();
            Jt(2);
            var r = ft;
            ft |= 4;
            try {
              yu(t, e.alternate, e);
            } finally {
              ft = r, Jt(l), tt.T = a;
            }
          }
          Vt = 3;
        }
      }
      function Xu() {
        if (Vt === 4 || Vt === 3) {
          Vt = 0, yp();
          var t = za, e = Sl, a = la, l = qc;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Vt = 5 : (Vt = 0, Sl = za = null, Zu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Sa = null), zt(a), e = e.stateNode, ge && typeof ge.onCommitFiberRoot == "function")
            try {
              ge.onCommitFiberRoot(
                Xl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (l !== null) {
            e = tt.T, r = $e(), Jt(2), tt.T = null;
            try {
              for (var s = t.onRecoverableError, d = 0; d < l.length; d++) {
                var h = l[d];
                s(h.value, {
                  componentStack: h.stack
                });
              }
            } finally {
              tt.T = e, Jt(r);
            }
          }
          (la & 3) !== 0 && Gl(), Be(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === co ? en++ : (en = 0, co = t) : en = 0, ne && lp(), $a(0);
        }
      }
      function Zu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Tl(e)));
      }
      function Gl() {
        return Vu(), Ku(), Xu(), Ju();
      }
      function Ju() {
        if (Vt !== 5) return !1;
        var t = za, e = so;
        so = 0;
        var a = zt(la), l = 32 > a ? 32 : a;
        a = tt.T;
        var r = $e();
        try {
          Jt(l), tt.T = null, l = uo, uo = null;
          var s = za, d = la;
          if (Vt = 0, Sl = za = null, la = 0, (ft & 6) !== 0)
            throw Error(c(331));
          var h = ft;
          if (ft |= 4, Tu(s.current), Eu(
            s,
            s.current,
            d,
            l
          ), ft = h, $a(0, !1), ge && typeof ge.onPostCommitFiberRoot == "function")
            try {
              ge.onPostCommitFiberRoot(Xl, s);
            } catch {
            }
          return !0;
        } finally {
          Jt(r), tt.T = a, Zu(t, e);
        }
      }
      function Lu(t, e, a) {
        e = it(a, e), e = ar(t.stateNode, e, 2), t = ca(t, e, 2), t !== null && (K(t, 2), Be(t));
      }
      function vt(t, e, a) {
        if (t.tag === 3)
          Lu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Lu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Sa === null || !Sa.has(l))) {
                t = it(a, t), a = Js(2), l = ca(e, a, 2), l !== null && (Ls(
                  a,
                  l,
                  e,
                  t
                ), K(l, 2), Be(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function Er(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new jp();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (io = !0, r.add(a), t = Of.bind(null, t, e, a), e.then(t, t));
      }
      function Of(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Et === t && (pt & a) === a && (Ot === 4 || Ot === 3 && (pt & 62914560) === pt && 300 > ue() - si ? (ft & 2) === 0 && el(t, 0) : ro |= a, _l === pt && (_l = 0)), Be(t);
      }
      function Wu(t, e) {
        e === 0 && (e = O()), t = Aa(t, e), t !== null && (K(t, e), Be(t));
      }
      function Rf(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Wu(t, a);
      }
      function Hf(t, e) {
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
        l !== null && l.delete(e), Wu(t, a);
      }
      function Uf(t, e) {
        return Zn(t, e);
      }
      function Df(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function kr(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function Fe(t, e) {
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
      function Fu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function qn(t, e, a, l, r, s) {
        var d = 0;
        if (l = t, typeof t == "function") kr(t) && (d = 1);
        else if (typeof t == "string")
          d = He && Qt ? yc(t, a, Pt.current) ? 26 : Tc(t) ? 27 : 5 : He ? yc(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Qt && Tc(t) ? 27 : 5;
        else
          t: switch (t) {
            case Ur:
              return t = o(31, a, e, r), t.elementType = Ur, t.lanes = s, t;
            case nl:
              return Ua(
                a.children,
                r,
                s,
                e
              );
            case lc:
              d = 8, r |= 24;
              break;
            case Mr:
              return t = o(12, a, e, r | 2), t.elementType = Mr, t.lanes = s, t;
            case Or:
              return t = o(13, a, e, r), t.elementType = Or, t.lanes = s, t;
            case Rr:
              return t = o(19, a, e, r), t.elementType = Rr, t.lanes = s, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ha:
                    d = 10;
                    break t;
                  case nc:
                    d = 9;
                    break t;
                  case Ar:
                    d = 11;
                    break t;
                  case Hr:
                    d = 14;
                    break t;
                  case ga:
                    d = 16, l = null;
                    break t;
                }
              d = 29, a = Error(
                c(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), l = null;
          }
        return e = o(d, a, e, r), e.elementType = t, e.type = l, e.lanes = s, e;
      }
      function Ua(t, e, a, l) {
        return t = o(7, t, l, e), t.lanes = a, t;
      }
      function Nr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function Iu(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Tr(t, e, a) {
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
      function Bf(t, e, a, l, r, s, d, h, T) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Da, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = X(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = X(0), this.hiddenUpdates = X(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = s, this.onRecoverableError = d, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = T, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function $u(t, e, a, l, r, s, d, h, T, U, V, q) {
        return t = new Bf(
          t,
          e,
          a,
          d,
          T,
          U,
          V,
          q,
          h
        ), e = 1, s === !0 && (e |= 24), s = o(3, null, null, e), t.current = s, s.stateNode = t, e = ji(), e.refCount++, t.pooledCache = e, e.refCount++, s.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Ri(s), t;
      }
      function Pu(t) {
        return t ? (t = sl, t) : sl;
      }
      function tc(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = p(e), t = t !== null ? w(t) : null, t === null ? null : Ql(t.stateNode);
      }
      function ec(t, e, a, l, r, s) {
        r = Pu(r), l.context === null ? l.context = r : l.pendingContext = r, l = ua(e), l.payload = { element: a }, s = s === void 0 ? null : s, s !== null && (l.callback = s), a = ca(t, l, e), a !== null && (se(a, t, e), jl(a, t, e));
      }
      function ac(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Cr(t, e) {
        ac(t, e), (t = t.alternate) && ac(t, e);
      }
      var dt = {}, qf = jd(), pe = $p(), jr = Object.assign, Yf = Symbol.for("react.element"), Yn = Symbol.for("react.transitional.element"), ll = Symbol.for("react.portal"), nl = Symbol.for("react.fragment"), lc = Symbol.for("react.strict_mode"), Mr = Symbol.for("react.profiler"), nc = Symbol.for("react.consumer"), ha = Symbol.for("react.context"), Ar = Symbol.for("react.forward_ref"), Or = Symbol.for("react.suspense"), Rr = Symbol.for("react.suspense_list"), Hr = Symbol.for("react.memo"), ga = Symbol.for("react.lazy"), Ur = Symbol.for("react.activity"), Gf = Symbol.for("react.memo_cache_sentinel"), ic = Symbol.iterator, Qf = Symbol.for("react.client.reference"), Gn = Array.isArray, tt = qf.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Vf = i.rendererVersion, Kf = i.rendererPackageName, rc = i.extraDevToolsConfig, Ql = i.getPublicInstance, Xf = i.getRootHostContext, Zf = i.getChildHostContext, Jf = i.prepareForCommit, Lf = i.resetAfterCommit, Wf = i.createInstance;
      i.cloneMutableInstance;
      var Dr = i.appendInitialChild, oc = i.finalizeInitialChildren, Qn = i.shouldSetTextContent, sc = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Ff = i.scheduleTimeout, If = i.cancelTimeout, Da = i.noTimeout, Ie = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var le = i.supportsMutation, Ye = i.supportsPersistence, ne = i.supportsHydration, $f = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var Pf = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Jt = i.setCurrentUpdatePriority, $e = i.getCurrentUpdatePriority, tm = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var em = i.shouldAttemptEagerTransition, am = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var lm = i.maySuspendCommit, nm = i.maySuspendCommitOnUpdate, Br = i.maySuspendCommitInSyncRender, uc = i.preloadInstance, im = i.startSuspendingCommit, cc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var rm = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var il = i.NotPendingTransition, Ba = i.HostTransitionContext, om = i.resetFormInstance;
      i.bindToConsole;
      var sm = i.supportsMicrotasks, um = i.scheduleMicrotask, Vl = i.supportsTestSelectors, cm = i.findFiberRoot, dm = i.getBoundingRect, fm = i.getTextContent, Kl = i.isHiddenSubtree, mm = i.matchAccessibilityRole, pm = i.setFocusIfFocusable, hm = i.setupIntersectionObserver, gm = i.appendChild, vm = i.appendChildToContainer, bm = i.commitTextUpdate, ym = i.commitMount, xm = i.commitUpdate, wm = i.insertBefore, _m = i.insertInContainerBefore, Sm = i.removeChild, zm = i.removeChildFromContainer, dc = i.resetTextContent, Em = i.hideInstance, km = i.hideTextInstance, Nm = i.unhideInstance, Tm = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var Cm = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var jm = i.cloneInstance, fc = i.createContainerChildSet, mc = i.appendChildToContainerChildSet, Mm = i.finalizeContainerChildren, pc = i.replaceContainerChildren, hc = i.cloneHiddenInstance, gc = i.cloneHiddenTextInstance, qr = i.isSuspenseInstancePending, Yr = i.isSuspenseInstanceFallback, Am = i.getSuspenseInstanceFallbackErrorDetails, Om = i.registerSuspenseInstanceRetry, Rm = i.canHydrateFormStateMarker, Hm = i.isFormStateMarkerMatching, vc = i.getNextHydratableSibling, Um = i.getNextHydratableSiblingAfterSingleton, Dm = i.getFirstHydratableChild, Bm = i.getFirstHydratableChildWithinContainer, qm = i.getFirstHydratableChildWithinActivityInstance, Ym = i.getFirstHydratableChildWithinSuspenseInstance, Gm = i.getFirstHydratableChildWithinSingleton, Qm = i.canHydrateInstance, Vm = i.canHydrateTextInstance, Km = i.canHydrateActivityInstance, Xm = i.canHydrateSuspenseInstance, Zm = i.hydrateInstance, Jm = i.hydrateTextInstance, Lm = i.hydrateActivityInstance, Wm = i.hydrateSuspenseInstance, Fm = i.getNextHydratableInstanceAfterActivityInstance, Im = i.getNextHydratableInstanceAfterSuspenseInstance, $m = i.commitHydratedInstance, Pm = i.commitHydratedContainer, tp = i.commitHydratedActivityInstance, ep = i.commitHydratedSuspenseInstance, ap = i.finalizeHydratedChildren, lp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var np = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var ip = i.clearSuspenseBoundaryFromContainer, rp = i.hideDehydratedBoundary, op = i.unhideDehydratedBoundary, bc = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var sp = i.validateHydratableInstance, up = i.validateHydratableTextInstance, He = i.supportsResources, yc = i.isHostHoistableType, Gr = i.getHoistableRoot, xc = i.getResource, wc = i.acquireResource, _c = i.releaseResource, cp = i.hydrateHoistable, Sc = i.mountHoistable, zc = i.unmountHoistable, dp = i.createHoistableInstance, fp = i.prepareToCommitHoistables, mp = i.mayResourceSuspendCommit, Ec = i.preloadResource, pp = i.suspendResource, Qt = i.supportsSingletons, kc = i.resolveSingletonInstance, hp = i.acquireSingletonInstance, Nc = i.releaseSingletonInstance, Tc = i.isHostSingletonType, rl = i.isSingletonScope, Qr = [], ol = -1, sl = {}, he = Math.clz32 ? Math.clz32 : j, gp = Math.log, vp = Math.LN2, Vn = 256, Kn = 262144, Xn = 4194304, Zn = pe.unstable_scheduleCallback, Vr = pe.unstable_cancelCallback, bp = pe.unstable_shouldYield, yp = pe.unstable_requestPaint, ue = pe.unstable_now, Cc = pe.unstable_ImmediatePriority, xp = pe.unstable_UserBlockingPriority, Kr = pe.unstable_NormalPriority, wp = pe.unstable_IdlePriority, _p = pe.log, Sp = pe.unstable_setDisableYieldValue, Xl = null, ge = null, ve = typeof Object.is == "function" ? Object.is : Ft, jc = typeof reportError == "function" ? reportError : function(t) {
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
      }, zp = Object.prototype.hasOwnProperty, Xr, Mc, Zr = !1, Ac = /* @__PURE__ */ new WeakMap(), ul = [], cl = 0, Jn = null, Zl = 0, ze = [], Ee = 0, va = null, Ge = 1, Qe = "", Pt = g(null), Jl = g(null), ba = g(null), Ln = g(null), te = null, Ct = null, ht = !1, ya = null, ke = !1, Jr = Error(c(519)), Wn = g(null), qa = null, Pe = null, Ep = typeof AbortController < "u" ? AbortController : function() {
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
      }, kp = pe.unstable_scheduleCallback, Np = pe.unstable_NormalPriority, jt = {
        $$typeof: ha,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Fn = null, dl = null, Lr = !1, In = !1, Wr = !1, Ya = 0, Ll = null, Fr = 0, fl = 0, ml = null, Oc = tt.S;
      tt.S = function(t, e) {
        Bc = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && pf(t, e), Oc !== null && Oc(t, e);
      };
      var Ga = g(null), pl = Error(c(460)), Ir = Error(c(474)), $n = Error(c(542)), Pn = { then: function() {
      } }, Qa = null, hl = null, Wl = 0, Va = ls(!0), Rc = ls(!1), Ne = [], gl = 0, $r = 0, xa = !1, Pr = !1, vl = g(null), ti = g(0), be = g(null), Te = null, Ut = g(0), ta = 0, st = null, St = null, Dt = null, ei = !1, bl = !1, Ka = !1, ai = 0, Fl = 0, yl = null, Tp = 0, Il = {
        readContext: It,
        use: Sn,
        useCallback: At,
        useContext: At,
        useEffect: At,
        useImperativeHandle: At,
        useLayoutEffect: At,
        useInsertionEffect: At,
        useMemo: At,
        useReducer: At,
        useRef: At,
        useState: At,
        useDebugValue: At,
        useDeferredValue: At,
        useTransition: At,
        useSyncExternalStore: At,
        useId: At,
        useHostTransitionStatus: At,
        useFormState: At,
        useActionState: At,
        useOptimistic: At,
        useMemoCache: At,
        useCacheRefresh: At
      };
      Il.useEffectEvent = At;
      var Hc = {
        readContext: It,
        use: Sn,
        useCallback: function(t, e) {
          return re().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Ts,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, En(
            4194308,
            4,
            As.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return En(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          En(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = re();
          e = e === void 0 ? null : e;
          var l = t();
          if (Ka) {
            Rt(!0);
            try {
              t();
            } finally {
              Rt(!1);
            }
          }
          return a.memoizedState = [l, e], l;
        },
        useReducer: function(t, e, a) {
          var l = re();
          if (a !== void 0) {
            var r = a(e);
            if (Ka) {
              Rt(!0);
              try {
                a(e);
              } finally {
                Rt(!1);
              }
            }
          } else r = e;
          return l.memoizedState = l.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, l.queue = t, t = t.dispatch = wf.bind(
            null,
            st,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = re();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Li(t);
          var e = t.queue, a = Gs.bind(
            null,
            st,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Ii,
        useDeferredValue: function(t, e) {
          var a = re();
          return $i(a, t, e);
        },
        useTransition: function() {
          var t = Li(!1);
          return t = Ds.bind(
            null,
            st,
            t.queue,
            !0,
            !1
          ), re().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = st, r = re();
          if (ht) {
            if (a === void 0)
              throw Error(c(407));
            a = a();
          } else {
            if (a = e(), Et === null)
              throw Error(c(349));
            (pt & 127) !== 0 || fs(l, e, a);
          }
          r.memoizedState = a;
          var s = { value: a, getSnapshot: e };
          return r.queue = s, Ts(ps.bind(null, l, s, t), [
            t
          ]), l.flags |= 2048, Pa(
            9,
            { destroy: void 0 },
            ms.bind(
              null,
              l,
              s,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = re(), e = Et.identifierPrefix;
          if (ht) {
            var a = Qe, l = Ge;
            a = (l & ~(1 << 32 - he(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ai++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Tp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Pi,
        useFormState: Ss,
        useActionState: Ss,
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
          return e.queue = a, e = tr.bind(
            null,
            st,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Xi,
        useCacheRefresh: function() {
          return re().memoizedState = xf.bind(
            null,
            st
          );
        },
        useEffectEvent: function(t) {
          var e = re(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((ft & 2) !== 0)
              throw Error(c(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, to = {
        readContext: It,
        use: Sn,
        useCallback: Rs,
        useContext: It,
        useEffect: Fi,
        useImperativeHandle: Os,
        useInsertionEffect: js,
        useLayoutEffect: Ms,
        useMemo: Hs,
        useReducer: zn,
        useRef: Ns,
        useState: function() {
          return zn(Ze);
        },
        useDebugValue: Ii,
        useDeferredValue: function(t, e) {
          var a = Ht();
          return Us(
            a,
            St.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = zn(Ze)[0], e = Ht().memoizedState;
          return [
            typeof t == "boolean" ? t : Ol(t),
            e
          ];
        },
        useSyncExternalStore: ds,
        useId: qs,
        useHostTransitionStatus: Pi,
        useFormState: zs,
        useActionState: zs,
        useOptimistic: function(t, e) {
          var a = Ht();
          return vs(a, St, t, e);
        },
        useMemoCache: Xi,
        useCacheRefresh: Ys
      };
      to.useEffectEvent = Cs;
      var Uc = {
        readContext: It,
        use: Sn,
        useCallback: Rs,
        useContext: It,
        useEffect: Fi,
        useImperativeHandle: Os,
        useInsertionEffect: js,
        useLayoutEffect: Ms,
        useMemo: Hs,
        useReducer: Ji,
        useRef: Ns,
        useState: function() {
          return Ji(Ze);
        },
        useDebugValue: Ii,
        useDeferredValue: function(t, e) {
          var a = Ht();
          return St === null ? $i(a, t, e) : Us(
            a,
            St.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ji(Ze)[0], e = Ht().memoizedState;
          return [
            typeof t == "boolean" ? t : Ol(t),
            e
          ];
        },
        useSyncExternalStore: ds,
        useId: qs,
        useHostTransitionStatus: Pi,
        useFormState: ks,
        useActionState: ks,
        useOptimistic: function(t, e) {
          var a = Ht();
          return St !== null ? vs(a, St, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Xi,
        useCacheRefresh: Ys
      };
      Uc.useEffectEvent = Cs;
      var eo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = me(), r = ua(l);
          r.payload = e, a != null && (r.callback = a), e = ca(t, r, l), e !== null && (se(e, t, l), jl(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = me(), r = ua(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = ca(t, r, l), e !== null && (se(e, t, l), jl(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = me(), l = ua(a);
          l.tag = 2, e != null && (l.callback = e), e = ca(t, l, a), e !== null && (se(e, t, a), jl(e, t, a));
        }
      }, ao = Error(c(461)), Bt = !1, lo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, ea = !1, qt = !1, no = !1, Dc = typeof WeakSet == "function" ? WeakSet : Set, Lt = null, Yt = null, ce = !1, Ue = null, xl = 8192, Cp = {
        getCacheForType: function(t) {
          var e = It(jt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return It(jt).controller.signal;
        }
      }, li = 0, ni = 1, ii = 2, ri = 3, oi = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var $l = Symbol.for;
        li = $l("selector.component"), ni = $l("selector.has_pseudo_class"), ii = $l("selector.role"), ri = $l("selector.test_id"), oi = $l("selector.text");
      }
      var jp = typeof WeakMap == "function" ? WeakMap : Map, ft = 0, Et = null, mt = null, pt = 0, _t = 0, ye = null, wa = !1, wl = !1, io = !1, aa = 0, Ot = 0, _a = 0, Xa = 0, ro = 0, xe = 0, _l = 0, Pl = null, de = null, oo = !1, si = 0, Bc = 0, tn = 1 / 0, ui = null, Sa = null, Vt = 0, za = null, Sl = null, la = 0, so = 0, uo = null, qc = null, en = 0, co = null;
      return dt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Aa(t, 67108864);
          e !== null && se(e, t, 67108864), Cr(t, 67108864);
        }
      }, dt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = me();
          e = xt(e);
          var a = Aa(t, e);
          a !== null && se(a, t, e), Cr(t, e);
        }
      }, dt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = A(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - he(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Be(t), (ft & 6) === 0 && (tn = ue() + 500, $a(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Aa(t, 2), e !== null && se(e, t, 2), Ru(), Cr(t, 2);
        }
      }, dt.batchedUpdates = function(t, e) {
        return t(e);
      }, dt.createComponentSelector = function(t) {
        return { $$typeof: li, value: t };
      }, dt.createContainer = function(t, e, a, l, r, s, d, h, T, U) {
        return $u(
          t,
          e,
          !1,
          null,
          a,
          l,
          s,
          null,
          d,
          h,
          T,
          U
        );
      }, dt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ni, value: t };
      }, dt.createHydrationContainer = function(t, e, a, l, r, s, d, h, T, U, V, q, Z, ot) {
        return t = $u(
          a,
          l,
          !0,
          t,
          r,
          s,
          h,
          ot,
          T,
          U,
          V,
          q
        ), t.context = Pu(null), a = t.current, l = me(), l = xt(l), r = ua(l), r.callback = e ?? null, ca(a, r, l), e = l, t.current.lanes = e, K(t, e), Be(t), t;
      }, dt.createPortal = function(t, e, a) {
        var l = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ll,
          key: l == null ? null : "" + l,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, dt.createRoleSelector = function(t) {
        return { $$typeof: ii, value: t };
      }, dt.createTestNameSelector = function(t) {
        return { $$typeof: ri, value: t };
      }, dt.createTextSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, dt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, dt.defaultOnRecoverableError = function(t) {
        jc(t);
      }, dt.defaultOnUncaughtError = function(t) {
        jc(t);
      }, dt.deferredUpdates = function(t) {
        var e = tt.T, a = $e();
        try {
          return Jt(32), tt.T = null, t();
        } finally {
          Jt(a), tt.T = e;
        }
      }, dt.discreteUpdates = function(t, e, a, l, r) {
        var s = tt.T, d = $e();
        try {
          return Jt(2), tt.T = null, t(e, a, l, r);
        } finally {
          Jt(d), tt.T = s, ft === 0 && (tn = ue() + 500);
        }
      }, dt.findAllNodes = _r, dt.findBoundingRects = function(t, e) {
        if (!Vl) throw Error(c(363));
        e = _r(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(dm(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, s = a.y, d = s + a.height, h = e - 1; 0 <= h; h--)
            if (e !== h) {
              var T = t[h], U = T.x, V = U + T.width, q = T.y, Z = q + T.height;
              if (l >= U && s >= q && r <= V && d <= Z) {
                t.splice(e, 1);
                break;
              } else if (l !== U || a.width !== T.width || Z < s || q > d) {
                if (!(s !== q || a.height !== T.height || V < l || U > r)) {
                  U > l && (T.width += U - l, T.x = l), V < r && (T.width = r - U), t.splice(e, 1);
                  break;
                }
              } else {
                q > s && (T.height += q - s, T.y = s), Z < d && (T.height = d - q), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, dt.findHostInstance = tc, dt.findHostInstanceWithNoPortals = function(t) {
        return t = p(t), t = t !== null ? y(t) : null, t === null ? null : Ql(t.stateNode);
      }, dt.findHostInstanceWithWarning = function(t) {
        return tc(t);
      }, dt.flushPassiveEffects = Gl, dt.flushSyncFromReconciler = function(t) {
        var e = ft;
        ft |= 1;
        var a = tt.T, l = $e();
        try {
          if (Jt(2), tt.T = null, t)
            return t();
        } finally {
          Jt(l), tt.T = a, ft = e, (ft & 6) === 0 && $a(0);
        }
      }, dt.flushSyncWork = Ru, dt.focusWithin = function(t, e) {
        if (!Vl) throw Error(c(363));
        for (t = yr(t), e = ju(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!Kl(a)) {
            if ((l === 5 || l === 26 || l === 27) && pm(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, dt.getFindAllNodesFailureDescription = function(t, e) {
        if (!Vl) throw Error(c(363));
        var a = 0, l = [];
        t = [yr(t), 0];
        for (var r = 0; r < t.length; ) {
          var s = t[r++], d = s.tag, h = t[r++], T = e[h];
          if ((d !== 5 && d !== 26 && d !== 27 || !Kl(s)) && (xr(s, T) && (l.push(wr(T)), h++, h > a && (a = h)), h < e.length))
            for (s = s.child; s !== null; )
              t.push(s, h), s = s.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(wr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (l.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, dt.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Ql(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, dt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Vf,
          rendererPackageName: Kf,
          currentDispatcherRef: tt,
          reconcilerVersion: "19.2.0"
        };
        if (rc !== null && (t.rendererConfig = rc), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Xl = e.inject(t), ge = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, dt.isAlreadyRendering = function() {
        return (ft & 6) !== 0;
      }, dt.observeVisibleRects = function(t, e, a, l) {
        if (!Vl) throw Error(c(363));
        t = _r(t, e);
        var r = hm(
          t,
          a,
          l
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, dt.shouldError = function() {
        return null;
      }, dt.shouldSuspend = function() {
        return !1;
      }, dt.startHostTransition = function(t, e, a, l) {
        if (t.tag !== 5) throw Error(c(476));
        var r = Bs(t).queue;
        Ds(
          t,
          r,
          e,
          il,
          a === null ? u : function() {
            var s = Bs(t);
            return s.next === null && (s = t.alternate.memoizedState), Rl(
              t,
              s.next.queue,
              {},
              me()
            ), a(l);
          }
        );
      }, dt.updateContainer = function(t, e, a, l) {
        var r = e.current, s = me();
        return ec(
          r,
          s,
          t,
          e,
          a,
          l
        ), s;
      }, dt.updateContainerSync = function(t, e, a, l) {
        return ec(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, dt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(ho)), ho.exports;
}
var Fc;
function th() {
  return Fc || (Fc = 1, po.exports = Pp()), po.exports;
}
var eh = th();
const ah = /* @__PURE__ */ Bo(eh);
var bo = { exports: {} }, na = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ic;
function lh() {
  return Ic || (Ic = 1, na.ConcurrentRoot = 1, na.ContinuousEventPriority = 8, na.DefaultEventPriority = 32, na.DiscreteEventPriority = 2, na.IdleEventPriority = 268435456, na.LegacyRoot = 0, na.NoEventPriority = 0), na;
}
var $c;
function nh() {
  return $c || ($c = 1, bo.exports = lh()), bo.exports;
}
var un = nh();
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
const Md = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], So = 16, Ad = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), ih = [
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
    "align-items": "flex-start",
    cursor: "default",
    "box-sizing": "border-box"
  }],
  ["input", { padding: "1px 2px", "border-width": "2px", "border-style": "inset", "border-color": "buttonborder", "background-color": "field", color: "fieldtext" }],
  ["svg", { overflow: "hidden" }],
  ["[hidden]", { display: "none" }]
], Pc = {
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
}, rh = /* @__PURE__ */ new Set([
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
]), Od = {
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
}, Rd = {
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
}, zo = ["font-size", "color", ...new Set([...Object.keys(Od), ...Object.keys(Rd)].filter((n) => n !== "font-size" && n !== "color"))], oh = new Set(zo);
function ie(n, i = " ") {
  const o = [];
  let u = 0, c = "";
  for (let f = 0; f < n.length; f++) {
    const m = n[f];
    if (m === "(" ? u++ : m === ")" && u--, u === 0 && (i === " " ? /\s/.test(m) : m === i)) {
      (c.trim() || i !== " ") && o.push(c.trim()), c = "";
      continue;
    }
    c += m;
  }
  return (c.trim() || i !== " " && o.length) && o.push(c.trim()), o;
}
function Eo(n, i, o = 0) {
  if (o > 32) return null;
  let u = "", c = 0;
  for (; ; ) {
    const f = n.indexOf("var(", c);
    if (f < 0)
      return u += n.slice(c), u;
    u += n.slice(c, f);
    let m = 1, p = f + 4;
    for (; p < n.length && m; p++)
      n[p] === "(" ? m++ : n[p] === ")" && m--;
    const w = n.slice(f + 4, p - 1), y = ie(w, ","), H = y[0].trim(), R = y.length > 1 ? w.slice(w.indexOf(",") + 1).trim() : null;
    let g = i(H);
    if ((g == null || g === "initial") && (g = R), g == null) return null;
    const E = Eo(g, i, o + 1);
    if (E === null) return null;
    u += E, c = p;
  }
}
function sh(n) {
  const i = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let u, c = 0;
  for (; c < n.length; ) {
    if (o.lastIndex = c, u = o.exec(n), !u || u.index !== c) {
      if (/^\s+$/.test(n.slice(c))) break;
      return null;
    }
    c = o.lastIndex, u[1] !== void 0 ? i.push({ num: parseFloat(u[1]), unit: (u[2] ?? "").toLowerCase() }) : u[3] ? i.push({ fn: u[3].toLowerCase() }) : u[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: u[5] ?? u[6] });
  }
  return i;
}
function cn(n, i) {
  const o = sh(n.trim());
  if (!o) return null;
  let u = 0;
  const c = ({ num: g, unit: E }) => {
    switch (E) {
      case "":
        return { px: 0, pct: 0, num: g, unitless: !0 };
      case "px":
        return { px: g, pct: 0, num: 0 };
      case "rem":
        return { px: g * So, pct: 0, num: 0 };
      case "em":
        return { px: g * (i.fontSize ?? So), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: g, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: g / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: g / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: g * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, f = (g, E, b) => g && E ? { px: g.px + b * E.px, pct: g.pct + b * E.pct, num: g.num + b * E.num, unitless: g.unitless && E.unitless } : null, m = (g, E) => g ? { px: g.px * E, pct: g.pct * E, num: g.num * E, unitless: g.unitless } : null, p = (g) => g && g.unitless;
  function w() {
    const g = o[u++];
    if (!g) return null;
    if (g.num !== void 0) return c(g);
    if (g.op === "(") {
      const E = H();
      return o[u]?.op !== ")" ? null : (u++, E);
    }
    if (g.op === "-" || g.op === "+") {
      const E = w();
      return g.op === "-" ? m(E, -1) : E;
    }
    if (g.fn) {
      const E = [];
      for (; ; ) {
        E.push(H());
        const A = o[u++];
        if (!A) return null;
        if (A.op === ")") break;
        if (A.op !== ",") return null;
      }
      if (E.some((A) => !A)) return null;
      if (g.fn === "calc") return E[0];
      if (!(E.every((A) => !A.pct) || E.every((A) => !A.px && !A.num))) return null;
      const j = (A) => A.px + A.pct + A.num;
      return g.fn === "min" ? E.reduce((A, M) => j(M) < j(A) ? M : A) : g.fn === "max" ? E.reduce((A, M) => j(M) > j(A) ? M : A) : g.fn === "clamp" && E.length === 3 ? j(E[1]) < j(E[0]) ? E[0] : j(E[1]) > j(E[2]) ? E[2] : E[1] : null;
    }
    return null;
  }
  function y() {
    let g = w();
    for (; o[u] && (o[u].op === "*" || o[u].op === "/"); ) {
      const E = o[u++].op, b = w();
      if (!g || !b) return null;
      E === "*" ? g = p(b) ? m(g, b.num) : p(g) ? m(b, g.num) : null : g = p(b) && b.num !== 0 ? m(g, 1 / b.num) : null;
    }
    return g;
  }
  function H() {
    let g = y();
    for (; o[u] && (o[u].op === "+" || o[u].op === "-"); ) {
      const E = o[u++].op;
      g = f(g, y(), E === "-" ? -1 : 1);
    }
    return g;
  }
  const R = H();
  return u !== o.length || !R ? null : R;
}
function ko(n, i) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const u = cn(o, i);
  return u ? u.unitless ? u.num === 0 ? { px: 0 } : { expr: n.trim() } : u.pct && (u.px || u.num) ? { expr: n.trim() } : u.pct ? { pct: u.pct } : { px: uh(u.px) } : { expr: n.trim() };
}
const uh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, fi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), ch = ([n, i, o, u]) => `#${fi(n)}${fi(i)}${fi(o)}${fi(u * 255)}`;
function td(n) {
  const i = n.slice(1), o = i.length <= 4 ? i.split("").map((c) => c + c).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const u = (c) => parseInt(o.slice(c, c + 2), 16);
  return [u(0), u(2), u(4), o.length === 8 ? u(6) / 255 : 1];
}
function yi(n, i) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const u = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (u) {
    const y = i(u[1]), H = y && td(y);
    return H ? { rgba: H, token: u[1] } : null;
  }
  if (o.startsWith("#")) {
    const y = td(o);
    return y ? { rgba: y, token: null } : null;
  }
  if (Pc[o]) return { rgba: [...Pc[o]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const y = ie(c[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const H = (Rt) => {
      const Ft = ie(Rt), Tt = Ft.findIndex((at) => /%$/.test(at)), B = Tt >= 0 ? parseFloat(Ft[Tt]) / 100 : null;
      return { color: yi(Ft.filter((at, it) => it !== Tt).join(" "), i), pct: B };
    }, R = H(y[1]), g = H(y[2]);
    if (!R.color || !g.color || R.color === "currentcolor" || g.color === "currentcolor") return null;
    let E = R.pct, b = g.pct;
    E === null && b === null ? (E = 0.5, b = 0.5) : E === null ? E = 1 - b : b === null && (b = 1 - E);
    const j = E + b, A = j < 1 ? j : 1;
    E /= j, b /= j;
    const [M, z, C, O] = R.color.rgba, [X, K, N, S] = g.color.rgba, G = O * E + S * b, ut = (Rt, Ft) => G === 0 ? 0 : (Rt * O * E + Ft * S * b) / G, xt = [ut(M, X), ut(z, K), ut(C, N), G * A], zt = S === 0 ? R.color.token : O === 0 ? g.color.token : null;
    return { rgba: xt, token: zt };
  }
  const f = c[2].includes(",") ? ie(c[2], ",") : ie(c[2].replace("/", " / ")).filter((y) => y !== "/");
  if (f.length < 3) return null;
  const m = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), p = f[3] === void 0 ? 1 : f[3].endsWith("%") ? parseFloat(f[3]) / 100 : parseFloat(f[3]), w = [m(f[0]), m(f[1]), m(f[2]), p];
  return w.some((y) => Number.isNaN(y)) ? null : { rgba: w, token: null };
}
const sn = ["top", "right", "bottom", "left"], dh = ["top-left", "top-right", "bottom-right", "bottom-left"], mi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], ed = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function No(n, i) {
  const o = i.trim(), u = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const c = mi(u());
      return sn.map((f, m) => [`${n}-${f}`, c[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const c = u(), f = n.split("-")[0];
      return [[`${f}-left`, c[0]], [`${f}-right`, c[1] ?? c[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const c = u(), f = n.split("-")[0];
      return [[`${f}-top`, c[0]], [`${f}-bottom`, c[1] ?? c[0]]];
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
      const c = mi(u());
      return sn.map((f, m) => [f, c[m]]);
    }
    case "inset-inline": {
      const c = u();
      return [["left", c[0]], ["right", c[1] ?? c[0]]];
    }
    case "inset-block": {
      const c = u();
      return [["top", c[0]], ["bottom", c[1] ?? c[0]]];
    }
    case "inset-inline-start":
      return [["left", o]];
    case "inset-inline-end":
      return [["right", o]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const c = n.split("-")[1], f = mi(u());
      return sn.map((m, p) => [`border-${m}-${c}`, f[p]]);
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
      const c = n === "border" ? sn : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let f = "medium", m = "none", p = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const w of u())
          ed.has(w) ? m = w : /^(thin|medium|thick|-?[\d.]|calc\()/.test(w) ? f = w : p = w;
      else o === "0" && (f = "0");
      return c.flatMap((w) => [[`border-${w}-width`, f], [`border-${w}-style`, m], [`border-${w}-color`, p]]);
    }
    case "border-inline-width": {
      const c = u();
      return [["border-left-width", c[0]], ["border-right-width", c[1] ?? c[0]]];
    }
    case "border-block-width": {
      const c = u();
      return [["border-top-width", c[0]], ["border-bottom-width", c[1] ?? c[0]]];
    }
    case "border-inline-style": {
      const c = u();
      return [["border-left-style", c[0]], ["border-right-style", c[1] ?? c[0]]];
    }
    case "border-inline-color": {
      const c = u();
      return [["border-left-color", c[0]], ["border-right-color", c[1] ?? c[0]]];
    }
    case "border-radius": {
      const c = mi(ie(o.split("/")[0]));
      return dh.map((f, m) => [`border-${f}-radius`, c[m]]);
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
      return o === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : yi(o, () => "#000000") ? [["background-color", o], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", o]];
    case "overflow": {
      const c = u();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = u();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return No("gap", o);
    case "place-items": {
      const c = u();
      return [["align-items", c[0]], ["justify-items", c[1] ?? c[0]]];
    }
    case "place-self": {
      const c = u();
      return [["align-self", c[0]], ["justify-self", c[1] ?? c[0]]];
    }
    case "place-content": {
      const c = u();
      return [["align-content", c[0]], ["justify-content", c[1] ?? c[0]]];
    }
    case "flex": {
      if (o === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (o === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (o === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const c = u(), f = c.filter((p) => /^[\d.]+$/.test(p)), m = c.find((p) => !/^[\d.]+$/.test(p));
      return [["flex-grow", f[0] ?? "1"], ["flex-shrink", f[1] ?? "1"], ["flex-basis", m ?? (f.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const c = [];
      for (const f of u()) c.push(/wrap/.test(f) ? ["flex-wrap", f] : ["flex-direction", f]);
      return c;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let c = "medium", f = "none", m = "currentcolor";
      for (const p of u())
        ed.has(p) || p === "auto" ? f = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? c = p : m = p;
      return [["outline-width", c], ["outline-style", f], ["outline-color", m]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = ie(o, ","), f = c.map((p) => ie(p).find((w) => !/^[\d.]+m?s$/.test(w) && !/^(ease|linear|step|cubic)/.test(w)) ?? "all"), m = c.map((p) => ie(p).find((w) => /^[\d.]+m?s$/.test(w)) ?? "0s");
      return [["transition-property", f.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", u()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", o]];
    case "word-wrap":
      return [["overflow-wrap", o]];
    default:
      return [[n, o]];
  }
}
function fh(n, i) {
  return n ? ie(n, ",").some((o) => {
    let u = o.trim().toLowerCase(), c = !1;
    u.startsWith("not ") && (c = !0, u = u.slice(4)), u.startsWith("only ") && (u = u.slice(5));
    const f = u.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const p = /^\((.+)\)$/.exec(m);
      if (!p) return !1;
      const w = p[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(w);
      if (y) {
        const [, R, g] = y, E = (b) => {
          const j = ko(b, { viewport: i });
          return typeof j == "object" && "px" in j ? j.px : NaN;
        };
        switch (R) {
          case "min-width":
            return i.width >= E(g);
          case "max-width":
            return i.width <= E(g);
          case "min-height":
            return i.height >= E(g);
          case "max-height":
            return i.height <= E(g);
          case "hover":
          case "any-hover":
            return g.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return g.trim() === "fine";
          case "prefers-reduced-motion":
            return g.trim() === "no-preference";
          case "prefers-color-scheme":
            return g.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const H = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(w);
      if (H) {
        const R = H[1] === "width" ? i.width : i.height, g = ko(H[3], { viewport: i }), E = typeof g == "object" && "px" in g ? g.px : NaN;
        switch (H[2]) {
          case ">=":
            return R >= E;
          case "<=":
            return R <= E;
          case ">":
            return R > E;
          case "<":
            return R < E;
          default:
            return R === E;
        }
      }
      return !1;
    });
    return c ? !f : f;
  }) : !0;
}
function mh(n, i) {
  const o = i[i.length - 1].compound;
  return qo(o)[0] ?? n;
}
function ph(n) {
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), u = (c, f) => {
    c.forEach(({ compound: m }, p) => {
      const w = f && p === c.length - 1;
      for (const y of m.pseudos)
        if (Ad.has(y.name) && (w ? i : o).add(y.name), y.list && y.name !== "not") for (const H of y.list) u(H, w);
    });
  };
  return u(n, !0), { subject: i, ancestor: o };
}
function qo(n) {
  const i = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const u of o.list) u.length === 1 && i.push(...qo(u[0].compound));
  return i;
}
function hh(n, i) {
  const o = (u, c) => {
    u.forEach(({ compound: f }, m) => {
      const p = c && m === u.length - 1, w = f.pseudos.filter((y) => Ad.has(y.name)).map((y) => y.name);
      if (!p) for (const y of w) for (const H of qo(f)) i.add(`${y}:${H}`);
      for (const y of f.pseudos) if (y.list && y.name !== "not") for (const H of y.list) o(H, p);
    });
  };
  o(n, !0);
}
class gh {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (f, m) => {
      const p = m[m.length - 1].compound, w = p.classes.length ? `.${p.classes[0]}` : p.tag && p.tag !== "*" ? p.tag : "*";
      this.index.has(w) || this.index.set(w, []), this.index.get(w).push(f);
    };
    let u = 0;
    const c = (f, m) => {
      for (const [p, w, y, H] of f)
        for (const R of Ro(p)) {
          let g;
          try {
            g = Ho(R);
          } catch (j) {
            if (j instanceof _e) {
              this.skipped++;
              continue;
            }
            throw j;
          }
          const E = ph(g);
          hh(g, this.trackedStates);
          const b = { steps: g, media: w, layer: y, origin: m, order: u++, specificity: kd(g), decls: H, states: E, source: m === 0 ? `ua:${g[g.length - 1].compound.tag ?? "*"}` : mh(R, g) };
          this.rules.push(b), o(b, g);
        }
    };
    c(ih.map(([f, m]) => [f, null, 0, Object.entries(m)]), 0), c(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const o = [], u = /* @__PURE__ */ new Set(), c = (f) => {
      if (f) for (const m of f) u.has(m) || (u.add(m), o.push(m));
    };
    for (const f of i.classList) c(this.index.get(`.${f}`));
    return c(this.index.get(i.tagName)), c(this.index.get("*")), o;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, o) {
    for (const u of i.classList) if (this.trackedStates.has(`${o}:${u}`)) return !0;
    return !1;
  }
}
const vh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function bh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [o, u] of Object.entries(n)) {
    if (u == null || u === "" || typeof u == "boolean") continue;
    const c = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), f = typeof u == "number" && u !== 0 && !vh.has(c) && !c.startsWith("--") ? `${u}px` : String(u);
    i.push([c, f]);
  }
  return i;
}
function yh(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const o of ["width", "height"]) {
    const u = n.getAttribute(o);
    u !== null && i.push([o, /^[\d.]+$/.test(u) ? `${u}px` : u]);
  }
  return i;
}
const xh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class wh {
  constructor(i, { theme: o, viewport: u }) {
    this.sheet = i, this.theme = o, this.viewport = u, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, o) {
    const u = (c, f, m) => {
      if (f === "disabled") return !!c.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(c.tagName);
      if (f === "enabled") return !c.props?.disabled && ["button", "input", "select", "textarea"].includes(c.tagName);
      if (f === "checked") return !!c.props?.checked;
      if (o === "*") return !0;
      if (f === "focus-within") {
        const p = c.ownerDocument?.activeElement;
        return !!p && p !== c.ownerDocument.body && typeof c.contains == "function" && c.contains(p);
      }
      return m ? o.has(f) : f === "focus-visible" ? !!c.state?.focus : !!c.state?.[f];
    };
    return this.sheet.candidates(i).filter((c) => (!c.media || c.media.every((f) => fh(f, this.viewport))) && Nd(i, c.steps, { state: u }));
  }
  compute(i, o, u = /* @__PURE__ */ new Set()) {
    const c = this.matching(i, u), f = [];
    for (const N of c)
      for (const [S, G, ut] of N.decls) f.push({ prop: S, value: G, important: ut ? 1 : 0, origin: N.origin === 0 ? 0 : 2, layer: N.layer, specificity: N.specificity, order: N.order, source: N.source });
    for (const [N, S] of yh(i)) f.push({ prop: N, value: S, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${N}` });
    for (const [N, S] of bh(i.props?.style)) f.push({ prop: N, value: S, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    f.sort(xh);
    const m = this.sheet.properties, p = Object.create(o?.customs ?? null), w = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const N of f) N.prop.startsWith("--") && y.set(N.prop, N.value);
    if (!o && this.theme) for (const N of Md) this.theme[N] && y.set(`--${N}`, `perchtoken(${N})`);
    const H = (N) => {
      if (w.has(N)) return w.get(N);
      const S = m[N];
      return S && !S.inherits ? S.initial ?? null : N in p ? p[N] : S?.initial ?? null;
    }, R = /* @__PURE__ */ new Set(), g = (N) => {
      if (!y.has(N)) return H(N);
      if (R.has(N)) return null;
      R.add(N);
      const S = Eo(y.get(N), g);
      return R.delete(N), y.delete(N), w.set(N, S), (!m[N] || m[N].inherits) && (p[N] = S), S;
    };
    for (const N of [...y.keys()]) g(N);
    const E = /* @__PURE__ */ new Map();
    for (const N of f) {
      if (N.prop.startsWith("--")) continue;
      const S = Eo(N.value, H);
      if (S === null) {
        for (const [G] of No(N.prop, "unset")) E.set(G, { value: "unset", source: N.source, origin: N.origin });
        continue;
      }
      for (const [G, ut] of No(N.prop, S)) E.set(G, { value: ut, source: N.source, origin: N.origin });
    }
    const b = {}, j = {}, A = /* @__PURE__ */ new Set(), M = /* @__PURE__ */ new Set(), z = o?.values, C = { fontSize: z?.["font-size"] ?? So, viewport: this.viewport }, O = (N, S) => {
      if (/currentcolor/i.test(S)) return this.parseValue(N, S, C, b, z);
      const G = `${N}\0${S}\0${C.fontSize}`;
      let ut = this.parsed.get(G);
      return ut === void 0 && this.parsed.set(G, ut = this.parseValue(N, S, C, b, z)), ut;
    }, X = E.size ? [...zo, ...[...E.keys()].filter((N) => !oh.has(N))] : zo;
    for (const N of X) {
      const S = E.get(N);
      let G = S?.value;
      const ut = rh.has(N);
      if ((G === void 0 || G === "unset" || G === "revert" || G === "revert-layer") && (G = ut ? "inherit" : "initial"), S && (j[N] = S.source, S.origin !== 0 && A.add(N)), G === "inherit" && z && N in z) {
        b[N] = z[N], M.add(N);
        continue;
      }
      (G === "inherit" || G === "initial") && (G = ut ? Rd[N] : Od[N]), b[N] = O(N, G), N === "font-size" && (C.fontSize = b["font-size"]);
    }
    for (const N of sn) {
      const S = b[`border-${N}-style`];
      (S === "none" || S === "hidden") && (b[`border-${N}-width`] = { px: 0 });
    }
    b["outline-style"] === "none" && (b["outline-width"] = { px: 0 });
    const K = z?.display;
    return (K === "flex" || K === "inline-flex" || K === "grid" || K === "inline-grid") && b.position !== "absolute" && b.position !== "fixed" && (b.display = ad(b.display)), (b.position === "absolute" || b.position === "fixed") && (b.display = ad(b.display)), { values: b, sources: j, own: A, inherited: M, customs: p, rules: c, element: i };
  }
  parseValue(i, o, u, c, f) {
    const m = String(o).trim();
    switch (i) {
      case "font-size": {
        const p = m.toLowerCase(), w = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (w[p]) return w[p];
        if (p === "smaller") return u.fontSize / 1.2;
        if (p === "larger") return u.fontSize * 1.2;
        const y = cn(p, { fontSize: u.fontSize, viewport: u.viewport });
        return !y || y.num ? u.fontSize : y.px + y.pct / 100 * u.fontSize;
      }
      case "font-weight": {
        const p = m.toLowerCase();
        if (p === "normal") return 400;
        if (p === "bold") return 700;
        if (p === "bolder") return (f?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (p === "lighter") return (f?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const w = parseFloat(p);
        return Number.isFinite(w) ? w : 400;
      }
      case "line-height": {
        const p = m.toLowerCase();
        if (p === "normal") return { normal: !0 };
        const w = cn(p, { fontSize: u.fontSize, viewport: u.viewport });
        return w ? w.unitless ? { factor: w.num } : { px: w.px + w.pct / 100 * u.fontSize } : { normal: !0 };
      }
      case "font-family":
        return m;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const p = m.endsWith("%") ? parseFloat(m) / 100 : parseFloat(m);
        return Number.isFinite(p) ? p : parseFloat(i === "flex-shrink" || i === "opacity" ? 1 : 0);
      }
      case "color": {
        const p = yi(m, (w) => this.themeHex(w));
        return p === "currentcolor" || !p ? f?.color ?? { rgba: [0, 0, 0, 1], token: null } : p;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const p = yi(m, (w) => this.themeHex(w));
        return p === "currentcolor" ? c.color : p ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return ko(m, u);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function ad(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const xi = (n) => n && n.rgba ? { value: ch(n.rgba), token: n.token ?? null } : null, _h = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Sh(n, i) {
  const o = i?.(n);
  if (Number.isFinite(o)) return o;
  const u = Math.round(n * 100) / 100;
  return _h[u] ?? Math.round(n * 1.2);
}
function Yo(n, i) {
  const o = n["line-height"], u = n["font-size"];
  return o.normal ? Sh(u, i) : o.factor !== void 0 ? o.factor * u : o.px;
}
const zh = (n) => ie(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
//! - `{ kind: "input", id, value, placeholder, checked, input_type, style, ... }`
//! - a node `mount` was given a parity table for (`options.names`) carries `name` (`name` or `name:key`, the engine
//!   id tests find it by) and, for a name that is the element's own text, `range_name`.
//! - letter-spaced text is a `div` (no `id`) around the run with the spacing as room after it.
//!
//! Text styles follow GPUI's inheritance: a node carries a text style when it sets one itself (so an ancestor's
//! hover colour does not reach it, as in CSS) or when the inherited value would differ (`line-height: normal`, a
//! multiplier under a new size). `tokens` names the theme token each colour came from.
const Eh = "perch-native-description/1", nn = Symbol("display"), wi = {
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
}, kh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of kh) wi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
wi.rounded = 0;
const Nh = /* @__PURE__ */ new Set([
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
]), Th = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Ch = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, jh = (n) => Ch.test(n) ? "Menlo" : Th.test(n) ? ".SystemUIFont" : zh(n).split(",")[0].trim(), Mh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, ld = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Hd = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const u = n.parentElement;
  return u && u.tagName !== "body" ? `${Hd(u)} > ${n.tagName}` : n.tagName;
};
class Ah {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, o, u, c, f, m = "") {
    const p = `${i}|${o}|${u}|${c}`, w = this.map.get(p);
    if (w) {
      !w.elements.includes(f) && w.elements.length < 4 && w.elements.push(f), w.count++;
      return;
    }
    this.map.set(p, { kind: i, property: o, value: String(u), class: c ?? null, elements: [f], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, o) => i.kind < o.kind ? -1 : i.kind > o.kind ? 1 : i.property < o.property ? -1 : i.property > o.property ? 1 : 0);
  }
}
const ra = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
};
function Oh(n) {
  const i = n.transform;
  if (i && i !== "none") {
    const u = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), c = u && ie(u[2], ",").map((f) => f.trim());
    return !c || c.length > (u[1] ? 1 : 2) ? null : u[1] === "X" ? [c[0], "0"] : u[1] === "Y" ? ["0", c[0]] : [c[0], c[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const u = ie(String(o).trim(), " ").filter(Boolean);
    return u.length > 3 || u[2] !== void 0 && cn(u[2], {})?.px ? null : [u[0], u[1] ?? "0"];
  }
  return [];
}
function Rh(n, i, o) {
  const u = n.values, c = Oh(u);
  if (c?.length === 0) return;
  const f = u.transform && u.transform !== "none" ? "transform" : "translate", m = { fontSize: u["font-size"] }, p = (H, R) => {
    const g = cn(H, m);
    if (!(!g || g.unitless && g.num))
      return g.pct ? typeof R == "number" ? g.px + g.pct / 100 * R : void 0 : g.px;
  }, w = c ? p(c[0], i.w) : void 0, y = c ? p(c[1], i.h) : void 0;
  if (w === void 0 || y === void 0) {
    o("unsupported", f, u[f], n.sources[f]);
    return;
  }
  w && (i.ml = (i.ml ?? 0) + w), y && (i.mt = (i.mt ?? 0) + y);
}
function nd(n, i) {
  const o = n.values, u = {}, c = (M) => n.sources[M], f = (M) => n.sources[M] !== void 0, m = o.display;
  m === "none" ? u.display = "hidden" : m === "flex" || m === "inline-flex" ? u.display = "flex" : (m === "grid" || m === "inline-grid") && (u.display = "flex", u.flex_direction = "col", i("approximated", "display", m, c("display"), "one-column flex column"), o["grid-template-columns"] && o["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", o["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (u.display = "hidden");
  const p = u.display === "flex";
  if (p && u.flex_direction !== "col") {
    const M = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[o["flex-direction"]] ?? "row";
    u.flex_direction = M;
  }
  if (p) {
    (o["flex-wrap"] === "wrap" || o["flex-wrap"] === "wrap-reverse") && (u.flex_wrap = "wrap");
    const M = m === "grid" || m === "inline-grid", z = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[o["align-items"]];
    z && (u.items = z);
    let C = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (M) {
      const K = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      K && (u.items = K), o["align-items"] === "center" && (C = "center");
    }
    C && (u.justify = C);
    const O = ra(o["row-gap"]), X = ra(o["column-gap"]);
    typeof O == "number" && O && (u.gap_y = O), typeof X == "number" && X && !M && (u.gap_x = X);
  }
  o["flex-grow"] && (u.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (u.flex_shrink = o["flex-shrink"]);
  const w = ra(o["flex-basis"]);
  w !== void 0 && w !== "auto" && (u.flex_basis = w);
  const y = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  y && (u.self = y);
  for (const [M, z] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const C = o[z], O = ra(C);
    if (O === void 0) {
      typeof C == "object" && C.expr ? i("unsupported", z, C.expr, c(z), "no calc() in the engine") : typeof C == "string" && !["auto", "none"].includes(C) && i("unsupported", z, C, c(z));
      continue;
    }
    O !== "auto" && (u[M] = O);
  }
  const H = ["top", "right", "bottom", "left"];
  for (const M of H) {
    const z = M[0];
    for (const [C, O] of [["p", "padding"], ["m", "margin"]]) {
      const X = o[`${O}-${M}`], K = ra(X);
      if (K === void 0) {
        X?.expr && i("unsupported", `${O}-${M}`, X.expr, c(`${O}-${M}`), "no calc() in the engine");
        continue;
      }
      K !== 0 && (u[`${C}${z}`] = K);
    }
  }
  const R = o.position;
  if (R === "absolute" || R === "fixed") {
    u.position = "absolute", R === "fixed" && i("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const M of H) {
      const z = ra(o[M]);
      z !== void 0 && z !== "auto" && (u[M] = z);
    }
    Rh(n, u, i);
  } else R === "sticky" && i("unsupported", "position", "sticky", c("position"));
  o["z-index"] !== "auto" && f("z-index") && i("unsupported", "z-index", o["z-index"], c("z-index"), "paint order is tree order");
  for (const [M, z] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const C = o[z];
    C === "hidden" || C === "clip" ? u[M] = "hidden" : (C === "auto" || C === "scroll") && (u[M] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (u.visibility = "invisible");
  const g = o["background-color"];
  g?.unreadable ? i("unsupported", "background-color", g.unreadable, c("background-color")) : g?.rgba && g.rgba[3] > 0 && (u.bg = xi(g)), o["background-image"] && o["background-image"] !== "none" && i("unsupported", "background-image", o["background-image"], c("background-image"));
  const E = H.map((M) => ra(o[`border-${M}-width`]) || 0), b = [];
  H.forEach((M, z) => {
    if (!E[z]) return;
    u[`border_${M[0]}`] = E[z];
    const C = o[`border-${M}-style`];
    C !== "solid" && i("approximated", `border-${M}-style`, C, c(`border-${M}-style`), "drawn solid");
    const O = xi(o[`border-${M}-color`]);
    O && b.push(O);
  }), b.length && (u.border_color = b[0], b.some((M) => M.value !== b[0].value) && i("approximated", "border-color", b.map((M) => M.value).join(" "), c("border-top-color"), "one border colour"));
  const j = ["top-left", "top-right", "bottom-right", "bottom-left"].map((M) => ra(o[`border-${M}-radius`]) || 0);
  j.every((M) => M === j[0]) ? j[0] && (u.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((M, z) => {
    j[z] && (u[`rounded_${M}`] = j[z]);
  }), o.opacity !== 1 && (u.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const A = o["box-shadow"];
  if (A && A !== "none" && ie(A, ",").some((M) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(M.trim())) && (u.shadow = "lg", i("approximated", "box-shadow", A, c("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !n.inherited.has("cursor")) {
    const M = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    M ? u.cursor = M : i("unsupported", "cursor", o.cursor, c("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (u.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? u.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", o["text-decoration-line"], c("text-decoration-line")), u;
}
const Hh = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Ud(n) {
  if (!n || n === "normal") return "";
  const i = String(n).trim().split(/\s+/).map((o) => Hh[o]);
  return i.every(Boolean) ? i.join(",") : null;
}
function id(n, i) {
  const o = n.values, u = o["line-height"];
  return {
    text_color: xi(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Ud(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: u.factor !== void 0 ? { factor: u.factor } : { px: Math.round(Yo(o, i) * 1e3) / 1e3 },
    font_family: jh(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const rd = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, Dd = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function od(n, i, o) {
  const u = {}, c = (p, w) => w.some((y) => !n.inherited.has(y));
  for (const [p, w] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (c(p, w) || !Dd(i[p], o[p])) && (u[p] = i[p]);
  const f = rd(i.line_height, i.text_size), m = o.line_height ? rd(o.line_height, i.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(f - m) <= 1e-3)) && (u.line_height = i.line_height), u;
}
const Uh = (n, i) => ({ ...n, ...i });
function sd(n, i) {
  const o = {};
  for (const [u, c] of Object.entries(n))
    c && typeof c == "object" && "value" in c ? (o[u] = c.value, c.token && (i[u] = c.token)) : u === "line_height" ? o[u] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : u === "italic" ? c && (o.italic = !0) : o[u] = c;
  return o.italic === !1 && delete o.italic, o;
}
function Dh(n, i) {
  const o = {};
  for (const u of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const c = n[u], f = i[u];
    Dd(c, f) || (o[u] = f === void 0 ? u in wi ? wi[u] : null : f);
  }
  return o;
}
function ud(n, i) {
  const o = n.values;
  for (const [u, c] of Object.entries(n.sources)) {
    if (u.startsWith("--") || Nh.has(u) || c.startsWith("ua:")) continue;
    const f = o[u];
    switch (u) {
      case "letter-spacing":
        f !== "normal" && f?.px !== 0 && i("approximated", u, f?.px !== void 0 ? `${Math.round(f.px * 1e3) / 1e3}px` : f, c, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        f !== "normal" && Ud(f) === null && i("unsupported", u, f, c);
        break;
      case "text-transform":
        f !== "none" && i("approximated", u, f, c, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = o["transition-duration"];
        u === "transition-property" && m && ie(m, ",").some((p) => parseFloat(p) > 0) && o["transition-property"] !== "none" && i("unsupported", "transition", `${o["transition-property"]} ${m}`, c, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        f !== "none" && i("unsupported", u, f, c, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        u === "overflow-wrap" && f !== "normal" && i("unsupported", u, f, c);
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && u === "outline-style" && i("unsupported", "outline", `${ra(o["outline-width"])}px ${o["outline-style"]} ${xi(o["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
        break;
      case "transform":
      case "translate":
        o.position !== "absolute" && o.position !== "fixed" && f && f !== "none" && i("unsupported", u, f, c);
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
        f && f !== "none" && f !== "auto" && f !== "normal" && f !== "initial" && i("unsupported", u, f, c);
        break;
    }
  }
}
function Bh(n, i, o, u) {
  const c = Hd(n), f = [], m = (A, M, z, C, O) => f.push([A, M, z, C ?? "(user agent)", c, O]), p = u.cascade.compute(n, i), w = {}, y = nd(p, m);
  ud(p, m);
  const H = id(p, u.measure), R = od(p, H, o), g = sd({ ...y, ...R }, w), E = {}, b = u.cascade.matching(n, "*").filter((A) => A.states.subject.size);
  for (const [A, M] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!b.some((K) => M.some((N) => K.states.subject.has(N)))) continue;
    const z = u.cascade.compute(n, i, new Set(M)), C = {}, O = sd({ ...nd(z, () => {
    }), ...od(z, id(z, u.measure), o) }, C);
    A === "focus" && ud(z, m);
    const X = Dh(g, O);
    if (Object.keys(X).length) {
      E[A] = X;
      const K = Object.fromEntries(Object.entries(C).filter(([N]) => N in X));
      Object.keys(K).length && (E[`${A}_tokens`] = K);
    }
  }
  u.cascade.sheet.tracks(n, "hover") && (E.track_hover = !0);
  const j = Object.entries(Mh).filter(([, A]) => A.some((M) => typeof n.props[M] == "function")).map(([A]) => A);
  return j.length && (E.events = j), { computed: p, style: g, tokens: w, extra: E, meta: Qh(n), reports: f, childText: Uh(o, R), where: c };
}
function Bd(n, i, o, u, c = "") {
  const f = `${c}/${n.id}.${n.version}`;
  let m = u.cache.get(n);
  (!m || m.key !== f) && u.cache.set(n, m = { key: f, part: Bh(n, i, o, u) });
  const { computed: p, tokens: w, extra: y, reports: H, childText: R, where: g } = m.part;
  for (const S of H) u.findings.add(...S);
  const E = (S, G, ut, xt, zt) => u.findings.add(S, G, ut, xt, g, zt), b = { ...m.part.style }, j = { kind: "div", id: n.id, style: b, tokens: w, meta: m.part.meta, ...y };
  Object.defineProperty(j, nn, { value: p.values.display });
  const A = n.tagName;
  if (A === "svg")
    return j.kind = n.props["data-perch-image"] ? "image" : "svg", j.markup = Kh(n), j;
  if (A === "input" || A === "textarea" || A === "select") {
    j.kind = "input", j.input_type = A === "input" ? String(n.props.type ?? "text") : A;
    for (const S of ["value", "defaultValue", "placeholder", "checked", "disabled"]) n.props[S] !== void 0 && (j[S === "defaultValue" ? "value" : S] = n.props[S]);
    return j;
  }
  if (A === "img")
    return j.kind = "image", j.src = n.props.src ?? null, j;
  const M = p.values["text-transform"], z = [];
  let C = !1, O = !1;
  for (const S of n.childNodes) {
    if (S instanceof Do) {
      if (S.hidden || S.data === "") continue;
      C = !0;
      const xt = z[z.length - 1];
      if (xt?.kind === "text")
        xt.source = (xt.source ?? xt.text) + S.data, xt.text = cd(xt.source, M), xt.text === xt.source && delete xt.source;
      else {
        const zt = cd(S.data, M);
        z.push(zt === S.data ? { kind: "text", text: zt } : { kind: "text", text: zt, source: S.data });
      }
      continue;
    }
    if (!(S instanceof Se)) continue;
    const G = Bd(S, p, R, u, f), ut = G[nn];
    ut === "inline" || ut === "inline-block" || ut === "inline-flex" ? C = !0 : ut !== "none" && (O = !0), z.push(G);
  }
  const X = z.some((S) => S.kind !== "text"), K = z.length === 1 && z[0].kind !== "text" && /^inline-(block|flex)$/.test(z[0][nn]) ? z[0] : null;
  if (!b.display && K) {
    const S = u.cache.get(n.childNodes.find((ut) => ut.id === K.id))?.part.computed, G = S ? To(p.values, u.measure) - Gh(S.values, u.measure) : 0;
    b.display = "flex", b.flex_direction = "col", b.items = "start", G > 0 && (K.style.mt = Math.round(((K.style.mt ?? 0) + G) * 100) / 100), E("approximated", "display", `${p.values.display} holding one ${K[nn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!b.display && z.length === 1 && (z[0].kind === "svg" || z[0].kind === "image") && z[0][nn] === "inline" && typeof z[0].style.h == "number") {
    const S = z[0], G = To(p.values, u.measure), ut = Yo(p.values, u.measure) - G, xt = (zt) => Math.round(zt * 100) / 100;
    b.display = "flex", b.flex_direction = "col", b.items = "start", G > S.style.h && (S.style.mt = xt((S.style.mt ?? 0) + G - S.style.h)), ut > 0 && (S.style.mb = xt((S.style.mb ?? 0) + ut)), E("approximated", "display", `${p.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else !b.display && C && X && (b.display = "flex", b.flex_direction = O ? "col" : "row", O || (b.items = "baseline"), E("approximated", "display", `${p.values.display} with inline content`, "(inline formatting)", O ? "a column of its children" : "a row on the text baseline"));
  const N = p.values["letter-spacing"]?.px;
  if (N)
    for (let S = 0; S < z.length; S++) {
      const G = z[S];
      if (G.kind !== "text") continue;
      const ut = Math.round(N * [...G.text].length * 1e3) / 1e3;
      z[S] = { kind: "div", style: { pr: ut }, tokens: {}, children: [G] };
    }
  return j.children = z, j;
}
function qh(n, i) {
  if (!i) return null;
  let u = (i.self ? n : i.closest ? Td(n, i.closest) : i.find ? bi(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return u && i.strip && u.startsWith(i.strip) && (u = u.slice(i.strip.length)), u;
}
function Yh(n, i, o) {
  const u = i.map((m) => [m, Ei(m.selector)]), c = /* @__PURE__ */ new Map(), f = (m) => {
    for (const p of m.children) {
      const w = o.get(p.id);
      if (w)
        for (const [y, H] of u) {
          const R = y.textRange ? "range_name" : "name";
          if (w[R] != null || !H.some((b) => Nd(p, b))) continue;
          const g = qh(p, y.key), E = g == null ? c.get(y.name) ?? 0 : 0;
          g == null && c.set(y.name, E + 1), w[R] = g != null ? `${y.name}:${g}` : E ? `${y.name}@${E}` : y.name;
        }
      f(p);
    }
  };
  f(n.documentElement);
}
const _i = 0.9521, qd = 0.2256, To = (n, i) => (Yo(n, i) - (_i + qd) * n["font-size"]) / 2 + _i * n["font-size"];
function Gh(n, i) {
  const o = (c) => c && typeof c == "object" && "px" in c ? c.px : 0, u = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]);
  return o(n["padding-top"]) + u + To(n, i);
}
const cd = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, Yd = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Qh(n) {
  const i = {};
  for (const [o, u] of Object.entries(n.props)) {
    if (Yd.has(o) || typeof u == "function" || u === void 0 || u === null || typeof u == "object") continue;
    const c = o.startsWith("aria-") || o.startsWith("data-");
    if (u === !1 && !c) continue;
    const f = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    i[f] = typeof u == "boolean" ? c ? String(u) : "" : String(u);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const Vh = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), dd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Kh(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (o) => {
    const u = [];
    for (const [f, m] of Object.entries(o.props))
      Yd.has(f) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || f.startsWith("data-") || f.startsWith("aria-") || f === "focusable" || f === "role" || f === "title" || u.push(`${Vh(f)}="${dd(m === !0 ? "" : m)}"`);
    o.tagName === "svg" && !o.props.xmlns && u.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = o.childNodes.map((f) => f instanceof Do ? dd(f.data) : i(f)).join("");
    return `<${o.tagName}${u.length ? ` ${u.join(" ")}` : ""}>${c}</${o.tagName}>`;
  };
  return i(n);
}
function Xh(n) {
  const i = n.theme?.() ?? {}, o = {};
  for (const u of Md) i[u] && (o[u] = i[u]);
  return o;
}
const Zh = { font_features: "" };
function Jh(n, i, o, u = {}, c = null) {
  const f = Xh(i), m = i.viewport?.() ?? { width: 1e3, height: 800 }, p = JSON.stringify([f, m]);
  (u.look !== p || u.sheet !== o) && Object.assign(u, { look: p, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new wh(o, { theme: f, viewport: m }), top: null });
  const { cascade: w, cache: y } = u, H = { cascade: w, cache: y, findings: new Ah(), measure: i.lineHeight ? (E) => i.lineHeight(E) : null };
  u.top ??= w.compute(n.body, w.compute(n.documentElement, null));
  const R = n.body.children.map((E) => Bd(E, u.top, Zh, H));
  if (c?.length) {
    const E = /* @__PURE__ */ new Map(), b = (j) => {
      j.id && E.set(j.id, j);
      for (const A of j.children ?? []) b(A);
    };
    R.forEach(b), Yh(n, c, E);
  }
  const g = /* @__PURE__ */ new Set();
  for (const E of [n, n.defaultView])
    for (const { type: b } of E?.listeners ?? []) ld[b] && g.add(ld[b]);
  return { schema: Eh, root: R[0] ?? null, overlays: R.slice(1), document_events: [...g].sort(), unsupported: H.findings.list() };
}
const Lh = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Wh = null;
const Fh = () => Wh ??= new gh(Lh);
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
let La = un.NoEventPriority;
function Ih(n, i) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const u of o) {
    if (u === "children") continue;
    const c = n[u], f = i[u];
    if (!(c === f || typeof c == "function" && typeof f == "function") && !(u === "style" && c && f && typeof c == "object" && typeof f == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(f)])].every((p) => c[p] === f[p])))
      return !0;
  }
  return !1;
}
const $h = {
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
  getRootHostContext: () => null,
  getChildHostContext: (n) => n,
  getPublicInstance: (n) => n,
  prepareForCommit: () => null,
  resetAfterCommit: (n) => n.ownerDocument?.afterCommit?.(),
  preparePortalMount: () => {
  },
  createInstance: (n, i, o) => new Se(n, i, o.ownerDocument),
  createTextInstance: (n, i) => new Do(n),
  appendInitialChild: (n, i) => {
    n.appendChild(i);
  },
  finalizeInitialChildren: () => !1,
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
  commitUpdate: (n, i, o, u) => {
    n.props = u, Ih(o, u) && n.touch();
  },
  commitTextUpdate: (n, i, o) => {
    n.data = String(o);
  },
  commitMount: () => {
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
    La = n;
  },
  getCurrentUpdatePriority: () => La,
  resolveUpdatePriority: () => La !== un.NoEventPriority ? La : un.DefaultEventPriority,
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
}, we = ah($h), Go = (n, i, o = null) => we.createPortal(n, i, null, o), Ph = {
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
class t0 {
  constructor(i, o, u) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1 }, o), this.type = i, this.target = u, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function pi(n, i, o) {
  i.currentTarget = n;
  for (const { type: u, listener: c, capture: f } of [...n.listeners ?? []])
    u === i.type && f === o && c.call(n, i);
  if (n instanceof Se) {
    const u = Ph[i.type], c = u && n.props[o ? `${u}Capture` : u];
    typeof c == "function" && c(i);
  }
}
function yv(n, i, o = {}) {
  const { document: u, window: c } = Xp(n), f = new Se("div", { id: "root", style: o.container ?? {} }, u);
  u.body.appendChild(f);
  const m = [];
  let p = null;
  const w = () => [u, c].map((z) => z.listeners.map((C) => `${C.type}:${C.capture}`).sort().join(",")).join("|");
  let y = "";
  const H = {}, R = () => (p = Jh(u, n, Fh(), H, o.names), y = w(), n.render?.(p), p), g = () => {
    we.flushPassiveEffects(), we.flushSyncWork(), w() !== y && R();
  };
  u.afterCommit = R;
  const E = (z) => {
    m.push(z), n.error?.(z);
  }, b = we.createContainer(f, un.ConcurrentRoot, null, !1, null, "", E, E, E, null);
  we.updateContainerSync(kt.createElement(i, o.props ?? {}), b, null, null), we.flushSyncWork(), g();
  const j = (z) => {
    const C = (O) => {
      if (O.id === z) return O;
      for (const X of O.children) {
        const K = C(X);
        if (K) return K;
      }
      return null;
    };
    return C(u.documentElement);
  }, A = (z) => {
    const C = La;
    La = un.DiscreteEventPriority;
    try {
      return z();
    } finally {
      La = C, we.flushSyncWork(), g();
    }
  }, M = {
    document: u,
    window: c,
    container: f,
    errors: m,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: R,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(z, C, O = {}) {
      const X = typeof z == "string" ? j(z) : z;
      if (!X) return !1;
      const K = new t0(C, O, X), N = [];
      for (let G = X; G; G = G.parentNode) N.push(G);
      const S = [...N, u, c];
      return A(() => {
        for (let G = S.length - 1; G > 0 && !K.propagationStopped; G--) pi(S[G], K, !0);
        K.propagationStopped || (pi(X, K, !0), K.propagationStopped || pi(X, K, !1));
        for (let G = 1; G < S.length && !K.propagationStopped; G++) pi(S[G], K, !1);
      }), !K.defaultPrevented;
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(z, C) {
      const O = j(z);
      O && (O.bounds = { x: C.x, y: C.y, width: C.width, height: C.height });
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(z, C = {}) {
      const O = { button: 0, buttons: 1, pointerType: "mouse", ...C };
      for (const X of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) M.dispatch(z, X, O);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (z) => !!j(z)?.state.hover,
    hover(z, C) {
      const O = j(z);
      !O || O.state.hover === C || (O.state.hover = C, O.touch(), R());
    },
    focus(z) {
      const C = j(z);
      C && (A(() => {
        const O = u.activeElement;
        O && O !== C && O !== u.body && M.dispatch(O, "blur"), u.focus(C), M.dispatch(C, "focus");
      }), R());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: g,
    update(z) {
      we.updateContainerSync(kt.createElement(i, z ?? {}), b, null, null), we.flushSyncWork(), g();
    },
    unmount() {
      we.updateContainerSync(null, b, null, null), we.flushSyncWork(), we.flushPassiveEffects(), u.afterCommit = null;
    }
  };
  return M;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Gd = (n) => we.flushSyncFromReconciler(n), e0 = { createPortal: Go, flushSync: Gd }, xv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Go,
  default: e0,
  flushSync: Gd
}, Symbol.toStringTag, { value: "Module" }));
function Qd(n) {
  var i, o, u = "";
  if (typeof n == "string" || typeof n == "number") u += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var c = n.length;
    for (i = 0; i < c; i++) n[i] && (o = Qd(n[i])) && (u && (u += " "), u += o);
  } else for (o in n) n[o] && (u && (u += " "), u += o);
  return u;
}
function Vd() {
  for (var n, i, o = 0, u = "", c = arguments.length; o < c; o++) (n = arguments[o]) && (i = Qd(n)) && (u && (u += " "), u += i);
  return u;
}
const a0 = (n, i) => {
  const o = new Array(n.length + i.length);
  for (let u = 0; u < n.length; u++)
    o[u] = n[u];
  for (let u = 0; u < i.length; u++)
    o[n.length + u] = i[u];
  return o;
}, l0 = (n, i) => ({
  classGroupId: n,
  validator: i
}), Kd = (n = /* @__PURE__ */ new Map(), i = null, o) => ({
  nextPart: n,
  validators: i,
  classGroupId: o
}), Si = "-", fd = [], n0 = "arbitrary..", i0 = (n) => {
  const i = o0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: u
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return r0(m);
      const p = m.split(Si), w = p[0] === "" && p.length > 1 ? 1 : 0;
      return Xd(p, w, i);
    },
    getConflictingClassGroupIds: (m, p) => {
      if (p) {
        const w = u[m], y = o[m];
        return w ? y ? a0(y, w) : w : y || fd;
      }
      return o[m] || fd;
    }
  };
}, Xd = (n, i, o) => {
  if (n.length - i === 0)
    return o.classGroupId;
  const c = n[i], f = o.nextPart.get(c);
  if (f) {
    const y = Xd(n, i + 1, f);
    if (y) return y;
  }
  const m = o.validators;
  if (m === null)
    return;
  const p = i === 0 ? n.join(Si) : n.slice(i).join(Si), w = m.length;
  for (let y = 0; y < w; y++) {
    const H = m[y];
    if (H.validator(p))
      return H.classGroupId;
  }
}, r0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), o = i.indexOf(":"), u = i.slice(0, o);
  return u ? n0 + u : void 0;
})(), o0 = (n) => {
  const {
    theme: i,
    classGroups: o
  } = n;
  return s0(o, i);
}, s0 = (n, i) => {
  const o = Kd();
  for (const u in n) {
    const c = n[u];
    Qo(c, o, u, i);
  }
  return o;
}, Qo = (n, i, o, u) => {
  const c = n.length;
  for (let f = 0; f < c; f++) {
    const m = n[f];
    u0(m, i, o, u);
  }
}, u0 = (n, i, o, u) => {
  if (typeof n == "string") {
    c0(n, i, o);
    return;
  }
  if (typeof n == "function") {
    d0(n, i, o, u);
    return;
  }
  f0(n, i, o, u);
}, c0 = (n, i, o) => {
  const u = n === "" ? i : Zd(i, n);
  u.classGroupId = o;
}, d0 = (n, i, o, u) => {
  if (m0(n)) {
    Qo(n(u), i, o, u);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(l0(o, n));
}, f0 = (n, i, o, u) => {
  const c = Object.entries(n), f = c.length;
  for (let m = 0; m < f; m++) {
    const [p, w] = c[m];
    Qo(w, Zd(i, p), o, u);
  }
}, Zd = (n, i) => {
  let o = n;
  const u = i.split(Si), c = u.length;
  for (let f = 0; f < c; f++) {
    const m = u[f];
    let p = o.nextPart.get(m);
    p || (p = Kd(), o.nextPart.set(m, p)), o = p;
  }
  return o;
}, m0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, p0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, o = /* @__PURE__ */ Object.create(null), u = /* @__PURE__ */ Object.create(null);
  const c = (f, m) => {
    o[f] = m, i++, i > n && (i = 0, u = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(f) {
      let m = o[f];
      if (m !== void 0)
        return m;
      if ((m = u[f]) !== void 0)
        return c(f, m), m;
    },
    set(f, m) {
      f in o ? o[f] = m : c(f, m);
    }
  };
}, Co = "!", md = ":", h0 = [], pd = (n, i, o, u, c) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: o,
  maybePostfixModifierPosition: u,
  isExternal: c
}), g0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: o
  } = n;
  let u = (c) => {
    const f = [];
    let m = 0, p = 0, w = 0, y;
    const H = c.length;
    for (let j = 0; j < H; j++) {
      const A = c[j];
      if (m === 0 && p === 0) {
        if (A === md) {
          f.push(c.slice(w, j)), w = j + 1;
          continue;
        }
        if (A === "/") {
          y = j;
          continue;
        }
      }
      A === "[" ? m++ : A === "]" ? m-- : A === "(" ? p++ : A === ")" && p--;
    }
    const R = f.length === 0 ? c : c.slice(w);
    let g = R, E = !1;
    R.endsWith(Co) ? (g = R.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      R.startsWith(Co) && (g = R.slice(1), E = !0)
    );
    const b = y && y > w ? y - w : void 0;
    return pd(f, E, g, b);
  };
  if (i) {
    const c = i + md, f = u;
    u = (m) => m.startsWith(c) ? f(m.slice(c.length)) : pd(h0, !1, m, void 0, !0);
  }
  if (o) {
    const c = u;
    u = (f) => o({
      className: f,
      parseClassName: c
    });
  }
  return u;
}, v0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, u) => {
    i.set(o, 1e6 + u);
  }), (o) => {
    const u = [];
    let c = [];
    for (let f = 0; f < o.length; f++) {
      const m = o[f], p = m[0] === "[", w = i.has(m);
      p || w ? (c.length > 0 && (c.sort(), u.push(...c), c = []), u.push(m)) : c.push(m);
    }
    return c.length > 0 && (c.sort(), u.push(...c)), u;
  };
}, b0 = (n) => ({
  cache: p0(n.cacheSize),
  parseClassName: g0(n),
  sortModifiers: v0(n),
  postfixLookupClassGroupIds: y0(n),
  ...i0(n)
}), y0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let u = 0; u < o.length; u++)
      i[o[u]] = !0;
  return i;
}, x0 = /\s+/, w0 = (n, i) => {
  const {
    parseClassName: o,
    getClassGroupId: u,
    getConflictingClassGroupIds: c,
    sortModifiers: f,
    postfixLookupClassGroupIds: m
  } = i, p = [], w = n.trim().split(x0);
  let y = "";
  for (let H = w.length - 1; H >= 0; H -= 1) {
    const R = w[H], {
      isExternal: g,
      modifiers: E,
      hasImportantModifier: b,
      baseClassName: j,
      maybePostfixModifierPosition: A
    } = o(R);
    if (g) {
      y = R + (y.length > 0 ? " " + y : y);
      continue;
    }
    let M = !!A, z;
    if (M) {
      const N = j.substring(0, A);
      z = u(N);
      const S = z && m[z] ? u(j) : void 0;
      S && S !== z && (z = S, M = !1);
    } else
      z = u(j);
    if (!z) {
      if (!M) {
        y = R + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (z = u(j), !z) {
        y = R + (y.length > 0 ? " " + y : y);
        continue;
      }
      M = !1;
    }
    const C = E.length === 0 ? "" : E.length === 1 ? E[0] : f(E).join(":"), O = b ? C + Co : C, X = O + z;
    if (p.indexOf(X) > -1)
      continue;
    p.push(X);
    const K = c(z, M);
    for (let N = 0; N < K.length; ++N) {
      const S = K[N];
      p.push(O + S);
    }
    y = R + (y.length > 0 ? " " + y : y);
  }
  return y;
}, _0 = (...n) => {
  let i = 0, o, u, c = "";
  for (; i < n.length; )
    (o = n[i++]) && (u = Jd(o)) && (c && (c += " "), c += u);
  return c;
}, Jd = (n) => {
  if (typeof n == "string")
    return n;
  let i, o = "";
  for (let u = 0; u < n.length; u++)
    n[u] && (i = Jd(n[u])) && (o && (o += " "), o += i);
  return o;
}, S0 = (n, ...i) => {
  let o, u, c, f;
  const m = (w) => {
    const y = i.reduce((H, R) => R(H), n());
    return o = b0(y), u = o.cache.get, c = o.cache.set, f = p, p(w);
  }, p = (w) => {
    const y = u(w);
    if (y)
      return y;
    const H = w0(w, o);
    return c(w, H), H;
  };
  return f = m, (...w) => f(_0(...w));
}, z0 = [], Kt = (n) => {
  const i = (o) => o[n] || z0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, Ld = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Wd = /^\((?:(\w[\w-]*):)?(.+)\)$/i, E0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, k0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, N0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, T0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, C0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, j0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, ka = (n) => E0.test(n), ct = (n) => !!n && !Number.isNaN(Number(n)), Ve = (n) => !!n && Number.isInteger(Number(n)), yo = (n) => n.endsWith("%") && ct(n.slice(0, -1)), ia = (n) => k0.test(n), Fd = () => !0, M0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  N0.test(n) && !T0.test(n)
), Vo = () => !1, A0 = (n) => C0.test(n), O0 = (n) => j0.test(n), R0 = (n) => !J(n) && !L(n), H0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), U0 = (n) => Na(n, Pd, Vo), J = (n) => Ld.test(n), Ja = (n) => Na(n, tf, M0), hd = (n) => Na(n, K0, ct), D0 = (n) => Na(n, af, Fd), B0 = (n) => Na(n, ef, Vo), gd = (n) => Na(n, Id, Vo), q0 = (n) => Na(n, $d, O0), hi = (n) => Na(n, lf, A0), L = (n) => Wd.test(n), rn = (n) => Wa(n, tf), Y0 = (n) => Wa(n, ef), vd = (n) => Wa(n, Id), G0 = (n) => Wa(n, Pd), Q0 = (n) => Wa(n, $d), gi = (n) => Wa(n, lf, !0), V0 = (n) => Wa(n, af, !0), Na = (n, i, o) => {
  const u = Ld.exec(n);
  return u ? u[1] ? i(u[1]) : o(u[2]) : !1;
}, Wa = (n, i, o = !1) => {
  const u = Wd.exec(n);
  return u ? u[1] ? i(u[1]) : o : !1;
}, Id = (n) => n === "position" || n === "percentage", $d = (n) => n === "image" || n === "url", Pd = (n) => n === "length" || n === "size" || n === "bg-size", tf = (n) => n === "length", K0 = (n) => n === "number", ef = (n) => n === "family-name", af = (n) => n === "number" || n === "weight", lf = (n) => n === "shadow", X0 = () => {
  const n = Kt("color"), i = Kt("font"), o = Kt("text"), u = Kt("font-weight"), c = Kt("tracking"), f = Kt("leading"), m = Kt("breakpoint"), p = Kt("container"), w = Kt("spacing"), y = Kt("radius"), H = Kt("shadow"), R = Kt("inset-shadow"), g = Kt("text-shadow"), E = Kt("drop-shadow"), b = Kt("blur"), j = Kt("perspective"), A = Kt("aspect"), M = Kt("ease"), z = Kt("animate"), C = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], O = () => [
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
  ], X = () => [...O(), L, J], K = () => ["auto", "hidden", "clip", "visible", "scroll"], N = () => ["auto", "contain", "none"], S = () => [L, J, w], G = () => [ka, "full", "auto", ...S()], ut = () => [Ve, "none", "subgrid", L, J], xt = () => ["auto", {
    span: ["full", Ve, L, J]
  }, Ve, L, J], zt = () => [Ve, "auto", L, J], Rt = () => ["auto", "min", "max", "fr", L, J], Ft = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Tt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], B = () => ["auto", ...S()], I = () => [ka, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...S()], at = () => [p, ka, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...S()], it = () => [ka, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...S()], Q = () => [n, L, J], v = () => [...O(), vd, gd, {
    position: [L, J]
  }], D = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], $ = () => ["auto", "cover", "contain", G0, U0, {
    size: [L, J]
  }], W = () => [yo, rn, Ja], F = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    L,
    J
  ], P = () => ["", ct, rn, Ja], gt = () => ["solid", "dashed", "dotted", "double"], Zt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], rt = () => [ct, yo, vd, gd], Ta = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    b,
    L,
    J
  ], Ca = () => ["none", ct, L, J], je = () => ["none", ct, L, J], Me = () => [ct, L, J], oa = () => [ka, "full", ...S()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [ia],
      breakpoint: [ia],
      color: [Fd],
      container: [ia],
      "drop-shadow": [ia],
      ease: ["in", "out", "in-out"],
      font: [R0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [ia],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [ia],
      shadow: [ia],
      spacing: ["px", ct],
      text: [ia],
      "text-shadow": [ia],
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
        aspect: ["auto", "square", ka, J, L, A]
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
        "@container": ["", "normal", "size", L, J]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [H0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [ct, "auto", J, L, p]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": C()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": C()
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
        object: X()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: K()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": K()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": K()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: N()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": N()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": N()
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
        z: [Ve, "auto", L, J]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [ka, "full", "auto", p, ...S()]
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
        flex: [ct, ka, "auto", "initial", "none", J]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ct, L, J]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ct, L, J]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Ve, "first", "last", "none", L, J]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": ut()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: xt()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": zt()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": zt()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": ut()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: xt()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": zt()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": zt()
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
        "auto-cols": Rt()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": Rt()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: S()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": S()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": S()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...Ft(), "normal"]
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
        content: ["normal", ...Ft()]
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
        "place-content": Ft()
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
        p: S()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: S()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: S()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: S()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: S()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: S()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: S()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: S()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: S()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: S()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: S()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: B()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: B()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: B()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: B()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: B()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: B()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: B()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: B()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: B()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: B()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: B()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": S()
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
        "space-y": S()
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
        size: I()
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
        block: ["auto", ...it()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...it()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...it()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [p, "screen", ...I()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          p,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...I()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          p,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [m]
          },
          ...I()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...I()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...I()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...I()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", o, rn, Ja]
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
        font: [u, V0, D0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", yo, J]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [Y0, B0, i]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [J]
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
        tracking: [c, L, J]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [ct, "none", L, hd]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          f,
          ...S()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", L, J]
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
        list: ["disc", "decimal", "none", L, J]
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
        placeholder: Q()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: Q()
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
        decoration: [...gt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [ct, "from-font", "auto", L, Ja]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: Q()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [ct, "auto", L, J]
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
        indent: S()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [Ve, L, J]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", L, J]
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
        content: ["none", L, J]
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
        bg: D()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: $()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Ve, L, J],
          radial: ["", L, J],
          conic: ["", Ve, L, J]
        }, Q0, q0]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: Q()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: W()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: W()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: W()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: Q()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: Q()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: Q()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: F()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": F()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": F()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": F()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": F()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": F()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": F()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": F()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": F()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": F()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": F()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": F()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": F()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": F()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": F()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: P()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": P()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": P()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": P()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": P()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": P()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": P()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": P()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": P()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": P()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": P()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": P()
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
        "divide-y": P()
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
        border: [...gt(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...gt(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: Q()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": Q()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": Q()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": Q()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": Q()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": Q()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": Q()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": Q()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": Q()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": Q()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": Q()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: Q()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...gt(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [ct, L, J]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ct, rn, Ja]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: Q()
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
          H,
          gi,
          hi
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: Q()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", R, gi, hi]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": Q()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: P()
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
        ring: Q()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [ct, Ja]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": Q()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": P()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": Q()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", g, gi, hi]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": Q()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [ct, L, J]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Zt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Zt()
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
        "mask-linear": [ct]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": rt()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": rt()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": Q()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": Q()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": rt()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": rt()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": Q()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": Q()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": rt()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": rt()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": Q()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": Q()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": rt()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": rt()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": Q()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": Q()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": rt()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": rt()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": Q()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": Q()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": rt()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": rt()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": Q()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": Q()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": rt()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": rt()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": Q()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": Q()
      }],
      "mask-image-radial": [{
        "mask-radial": [L, J]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": rt()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": rt()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": Q()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": Q()
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
        "mask-radial-at": O()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [ct]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": rt()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": rt()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": Q()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": Q()
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
        mask: D()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: $()
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
        mask: ["none", L, J]
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
          L,
          J
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Ta()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [ct, L, J]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ct, L, J]
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
          E,
          gi,
          hi
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": Q()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", ct, L, J]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ct, L, J]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ct, L, J]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ct, L, J]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ct, L, J]
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
          L,
          J
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Ta()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [ct, L, J]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ct, L, J]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ct, L, J]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ct, L, J]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ct, L, J]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ct, L, J]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ct, L, J]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ct, L, J]
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
        "border-spacing": S()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": S()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": S()
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", L, J]
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
        duration: [ct, "initial", L, J]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", M, L, J]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [ct, L, J]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", z, L, J]
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
        perspective: [j, L, J]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": X()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Ca()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Ca()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Ca()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Ca()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: je()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": je()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": je()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": je()
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
        skew: Me()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Me()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Me()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [L, J, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: X()
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
        translate: oa()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": oa()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": oa()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": oa()
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
        zoom: [Ve, L, J]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: Q()
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
        caret: Q()
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", L, J]
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
        "scrollbar-thumb": Q()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": Q()
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
        "scroll-m": S()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": S()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": S()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": S()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": S()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": S()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": S()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": S()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": S()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": S()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": S()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": S()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": S()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": S()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": S()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": S()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": S()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": S()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": S()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": S()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": S()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": S()
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
        "will-change": ["auto", "scroll", "contents", "transform", L, J]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...Q()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [ct, rn, Ja, hd]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...Q()]
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
}, Z0 = /* @__PURE__ */ S0(X0);
function Ke(...n) {
  return Z0(Vd(n));
}
const nf = typeof navigator < "u" && /Mac/i.test(navigator.platform), zi = {
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
for (let n = 1; n <= 12; n++) zi[`f${n}`] = `F${n}`;
const J0 = Object.fromEntries(Object.entries(zi).map(([n, i]) => [i, n])), L0 = {
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
function W0(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : J0[n];
}
const bd = /* @__PURE__ */ new Map();
function rf(n, i = nf) {
  const o = `${i}|${n}`, u = bd.get(o);
  if (u) return u;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const f of n.split("+"))
    if (f === "mod")
      i ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (f === "cmd" || f === "ctrl" || f === "shift" || f === "alt") c[f] = !0;
    else if (/^[a-z]$/.test(f))
      c.code = `Key${f.toUpperCase()}`, c.letter = f;
    else if (/^[0-9]$/.test(f)) c.code = `Digit${f}`;
    else if (zi[f]) c.code = zi[f];
    else throw new Error(`unknown key "${f}" in "${n}"`);
  if (!c.code) throw new Error(`no key in "${n}"`);
  return bd.set(o, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = rf(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function F0(n, i = nf) {
  const o = rf(n, i), u = I0(W0(o.code) ?? "");
  return i ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${u}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", u].filter(Boolean).join("+");
}
const I0 = (n) => L0[n] ?? n.toUpperCase(), yd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, xd = Vd, ki = (n, i) => (o) => {
  var u;
  if (i?.variants == null) return xd(n, o?.class, o?.className);
  const { variants: c, defaultVariants: f } = i, m = Object.keys(c).map((y) => {
    const H = o?.[y], R = f?.[y];
    if (H === null) return null;
    const g = yd(H) || yd(R);
    return c[y][g];
  }), p = o && Object.entries(o).reduce((y, H) => {
    let [R, g] = H;
    return g === void 0 || (y[R] = g), y;
  }, {}), w = i == null || (u = i.compoundVariants) === null || u === void 0 ? void 0 : u.reduce((y, H) => {
    let { class: R, className: g, ...E } = H;
    return Object.entries(E).every((b) => {
      let [j, A] = b;
      return Array.isArray(A) ? A.includes({
        ...f,
        ...p
      }[j]) : {
        ...f,
        ...p
      }[j] === A;
    }) ? [
      ...y,
      R,
      g
    ] : y;
  }, []);
  return xd(n, m, w, o?.class, o?.className);
}, $0 = ki(
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
), P0 = ki(
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
function tg({ className: n, ...i } = {}) {
  return Ke(P0(i), n);
}
const of = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", sf = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", eg = ki(`${sf} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function ag({ className: n, ...i } = {}) {
  return Ke(eg(i), n);
}
const lg = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", ng = ki(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), ig = "my-1 h-px bg-overlay-0";
function rg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ Gt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ Gt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Gt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Gt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function og({ size: n = 16, className: i }) {
  return /* @__PURE__ */ Gt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ Gt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ Gt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function sg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ Gt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Gt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function uf({ size: n = 14, className: i }) {
  return /* @__PURE__ */ Gt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Gt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const wd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function ug({ state: n, error: i }) {
  return /* @__PURE__ */ Gt.jsx(
    "span",
    {
      className: Ke("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", wd[n] ?? wd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function cg({ title: n, onClose: i, children: o, testId: u }) {
  return Go(
    /* @__PURE__ */ Gt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (c) => {
          c.target === c.currentTarget && i();
        },
        onKeyDown: (c) => {
          c.key === "Escape" && i();
        },
        children: /* @__PURE__ */ Gt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": u,
            children: [
              /* @__PURE__ */ Gt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
function dg(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const jo = {
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
function Mo(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((o) => o.id === n.parentSessionId);
}
function fg(n) {
  const i = /* @__PURE__ */ new Map();
  for (const o of n)
    Mo(o, n) && i.set(o.parentSessionId, [...i.get(o.parentSessionId) ?? [], o]);
  return i.size ? n.filter((o) => !Mo(o, n)).flatMap((o) => [o, ...i.get(o.id) ?? []]) : n;
}
const vi = 6, _d = 8;
function mg(n, i = {}) {
  const { minWidth: o = 220, align: u = "right", minSpaceAbove: c = 100 } = i, f = n.getBoundingClientRect(), m = window.innerWidth, p = window.innerHeight, w = u === "right" ? { right: Math.max(0, m - f.right) } : { left: Math.max(0, f.left) }, y = f.top - vi - _d, H = p - f.bottom - vi - _d;
  return y >= c ? {
    position: "fixed",
    bottom: p - f.top + vi,
    ...w,
    minWidth: o,
    maxHeight: Math.min(y, p * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: f.bottom + vi,
    ...w,
    minWidth: o,
    maxHeight: Math.min(H, p * 0.75),
    overflowY: "auto"
  };
}
function pg(n, i, o, u) {
  kt.useEffect(() => {
    if (!n) return;
    function c(m) {
      const p = m.target, w = o.current?.contains(p) ?? !1, y = u.current?.contains(p) ?? !1;
      !w && !y && i(!1);
    }
    function f(m) {
      m.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", f), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", f);
    };
  }, [n]);
}
function hg({ icon: n, fallback: i }) {
  const [o, u] = kt.useState(!1);
  return kt.useEffect(() => u(!1), [n]), !n || o ? /* @__PURE__ */ Gt.jsx(Gt.Fragment, { children: i }) : /* @__PURE__ */ Gt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => u(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const gg = "1.3.0";
function Xt() {
  const n = globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const vg = (n) => Xt().subscribe?.(n) ?? (() => {
}), bg = mg, yg = globalThis.perch?.isMac !== !1, xg = (n) => F0(n, Xt().isMac !== !1), wg = (n) => $0(n), _g = ({ className: n, ...i } = {}) => Ke(tg(i), n), Sg = ag, zg = (n) => ng(n), Eg = ig, kg = sf, Ng = of, Tg = (n) => jo[n].color, Ni = (n, i) => Xt().command(n, i ?? {}) !== !1, Cg = (n, i, o) => Xt().startSession?.(n, i, o), jg = globalThis.perch?.pickFolder ? (n) => Xt().pickFolder(n) : null;
function De(n) {
  const i = kt.useRef(n);
  return i.current = n, kt.useSyncExternalStore(vg, () => i.current(Xt()));
}
const Mg = (n = {}) => De((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Ag = () => De((n) => n.hosts()), Og = () => De((n) => n.sessionFolders());
function Rg() {
  const n = De((i) => i.addProject?.() ?? Hg);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, o, u) => {
      i.trim() && n.status !== "pending" && Xt().addProjectFolder?.(i, o, u);
    },
    clear: () => Xt().clearAddProject?.()
  };
}
const Hg = Object.freeze({ status: "idle" });
function Ug(n) {
  kt.useEffect(() => Xt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Dg(n) {
  const i = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return fg(i).map((o) => ({ session: o.session, nested: Mo(o, i) }));
}
function Bg({ id: n, plain: i, className: o }) {
  const u = De((y) => y.session(n));
  if (!u) return null;
  const c = u.state ?? dg(u), f = jo[c]?.color ?? jo.unknown.color, m = u.provider, p = m === "claude" || m === "claude-agent-teams" || m === "omp", w = i ? Ke("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Ke("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return kt.createElement(
    "span",
    { className: w, style: i ? void 0 : { borderColor: f }, "data-provider": m ?? "unknown", title: i ? m ?? "Agent" : `${m ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    kt.createElement("span", { className: Ke("inline-flex text-fg", p && "rounded-full bg-[#161616]") }, kt.createElement(cf, { provider: m, size: 14 }))
  );
}
function cf({ provider: n, size: i = 14 }) {
  const o = Xt().agentIcon?.(n, i) ?? null, u = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return kt.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": u, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const qg = ({ children: n }) => kt.createElement(kt.Fragment, null, n);
function Yg(n, i) {
  const o = kt.useRef(i);
  return o.current = i, kt.useEffect(() => {
    const u = Xt();
    if (!u.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const c = {};
    for (const [m, p] of Object.entries(o.current))
      c[m] = typeof p == "function" ? (...w) => o.current[m]?.(...w) : p;
    const f = u.openOverlay(n, c);
    return () => u.closeOverlay?.(f);
  }, [n]), null;
}
const Fa = (n) => function(o) {
  return Yg(n, o);
}, Gg = Fa("session-menu"), Qg = Fa("new-session-menu"), Vg = Fa("confirm");
function Kg({ value: n, onChange: i, options: o = [], className: u, ariaLabel: c, testId: f, title: m, disabled: p, placeholder: w }) {
  const y = kt.useRef(null), H = o.find((R) => R.value === n);
  return kt.createElement(
    "button",
    {
      type: "button",
      ref: y,
      title: m,
      disabled: p,
      "aria-label": c,
      "data-testid": f,
      "aria-haspopup": "listbox",
      className: Ke("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", u),
      onClick: () => Xt().openOverlay?.("select", { value: n, options: o, onChange: (R) => i?.(R), anchor: y.current?.getBoundingClientRect() })
    },
    kt.createElement("span", { className: "min-w-0 flex-1 truncate" }, H ? H.label : w ?? "")
  );
}
const Xg = Fa("folder-browser"), Zg = Fa("instructions"), Jg = Fa("memory"), Lg = cg;
function Wg({ hostId: n, path: i, className: o }) {
  const u = kt.useRef(null);
  return kt.createElement(
    "button",
    {
      type: "button",
      ref: u,
      className: Ke("worktree-menu__btn", of, o),
      "data-testid": `worktree-menu-${n}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Xt().openOverlay?.("worktree", { hostId: n, cwd: i, anchor: u.current?.getBoundingClientRect() })
    },
    kt.createElement(uf, null)
  );
}
const Fg = (n, i) => Xt().beginReorderDrag?.(n, i), Ig = () => De((n) => n.workspaceTabs()), $g = () => De((n) => n.statusLine()), Pg = () => De((n) => n.zoom()), tv = () => De((n) => n.paneLook()), ev = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function av(n) {
  const i = !!n?.keepFresh, o = De((c) => c.statusLine?.().connected ?? !1), u = De((c) => c.planUsage?.() ?? ev);
  return kt.useEffect(() => {
    if (!i || !o) return;
    let c;
    const f = () => {
      Xt().command("usage.get"), c = setTimeout(f, 18e4);
    };
    return f(), () => clearTimeout(c);
  }, [i, o]), u;
}
const lv = () => Xt().command("usage.get", { force: !0 }), nv = (n) => Xt().command("usage.redeemReset", { accountId: n }), iv = () => Ni("app.zoom_reset"), rv = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, ov = (n, i, o) => Xt().beginTabDrag?.(n, i, o);
function sv(n) {
  kt.useEffect(() => Xt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const uv = (n) => Ni("browser.open", { workspaceId: n }), cv = (n, i) => Ni("file.open", { workspaceId: n, path: i }), dv = () => null, fv = () => null, mv = Fa("new-file"), wv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: cf,
  CloseIcon: sg,
  ConfirmDialog: Vg,
  Dialog: Lg,
  EllipsisIcon: rg,
  FolderBrowser: Xg,
  GearIcon: og,
  HostStateDot: ug,
  InstructionsDialog: Zg,
  MemoryDialog: Jg,
  NewFilePrompt: mv,
  NewSessionMenu: Qg,
  PageIcon: hg,
  PlusIcon: uf,
  Select: Kg,
  SessionDot: Bg,
  SessionMenu: Gg,
  Slot: qg,
  TabDragLayer: fv,
  TabMenu: dv,
  WorktreeMenu: Wg,
  agentStateColor: Tg,
  anchoredPopoverStyle: bg,
  beginReorderDrag: Fg,
  beginTabDrag: ov,
  buttonClass: Sg,
  cn: Ke,
  ghostButton: kg,
  iconButton: Ng,
  isMac: yg,
  keyLabel: xg,
  menuDividerClass: Eg,
  menuItemClass: zg,
  menuPanel: lg,
  nestSessions: Dg,
  openBrowserTab: uv,
  openFileTab: cv,
  pickFolder: jg,
  redeemUsageReset: nv,
  refreshUsage: lv,
  resetZoom: iv,
  rowActionClass: _g,
  runCommand: Ni,
  segmentClass: wg,
  startSession: Cg,
  tabStateClass: rv,
  useAddProject: Rg,
  useAddProjectRequest: Ug,
  useDismissOnOutsideClick: pg,
  useHosts: Ag,
  useNavigation: Mg,
  useNewTabRequest: sv,
  usePaneLook: tv,
  usePlanUsage: av,
  useSessionFolders: Og,
  useStatusLine: $g,
  useWorkspaceTabs: Ig,
  useZoom: Pg,
  version: gg
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
const Ko = {
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
  Ko[n] = (i, o) => i[n](o);
const _v = Object.keys(Ko);
function Sd(n, i) {
  for (const [o, u] of Object.entries(i)) {
    const c = Ko[o];
    if (!c) throw new Error(`the description key ${o} has no GPUI builder`);
    u != null && (n = c(n, u));
  }
  return n;
}
const zl = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 });
function pv(n, i, o) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const u = n.meta?.attrs["data-testid"];
  return u ? `~${n.id}:${u}` : `~${n.id}`;
}
const El = (n) => n.style?.display !== "hidden";
function Ao(n, i, o, u, c = !1, f = !1, m = null, p = {}, w = !1, y = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return n.text;
  f ||= n.style.opacity === 0 || n.style.visibility === "invisible", f && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0 }), m = n.style.text_color ?? m;
  const H = !!n.hover?.text_color && ff(n);
  H && o.hovered?.(n.id) && (m = n.hover.text_color), p = { ...p };
  for (const C of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[C] !== void 0 && (p[C] = n.style[C]);
  const R = new Set(n.events ?? []);
  let g;
  n.kind === "image" && !n.markup ? g = i.image(n.src) : g = i.div(), n.markup && (g = g.child(u.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const E = pv(n, R, c);
  E && (g = g.id(E)), g = Sd(g, { ...n.style, ...y.get(n) });
  const b = p.whitespace !== "nowrap" && !p.text_ellipsis;
  w && b && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && (n.children ?? []).some((C) => C.kind === "text") && (g = g.min_w(0));
  for (const C of ["hover", "focus", "active"]) n[C] && (g = g[C]((O) => Sd(O, n[C])));
  if (i.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const C = o.document?.scrollTarget, O = C ? (n.children ?? []).filter(El).findIndex((X) => df(X, C.id)) : -1;
    O >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, i.scroll.scroll_to_item(O)), o.scroller === n.id && (g = g.track_scroll(i.scroll));
  }
  ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((C) => R.has(C)) && (g = g.on_mouse_down("left", (C, O) => {
    O.stop_propagation?.(), C.bounds && o.setBounds(n.id, C.bounds);
    const X = { ...zl(C), button: 0, buttons: 1, detail: C.click_count };
    o.dispatch(n.id, "pointerdown", { ...X, pointerType: "mouse" }), o.dispatch(n.id, "mousedown", X), O.notify();
  }), g = g.on_mouse_down("right", (C, O) => {
    O.stop_propagation?.(), C.bounds && o.setBounds(n.id, C.bounds), o.dispatch(n.id, "contextmenu", { ...zl(C), button: 2 }), O.notify();
  }), g = g.on_mouse_up("left", (C, O) => {
    O.stop_propagation?.();
    const X = { ...zl(C), button: 0 };
    o.dispatch(n.id, "pointerup", { ...X, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", X), O.notify();
  }), g = g.on_click((C, O) => {
    o.dispatch(n.id, C.click_count === 2 && R.has("double_click") ? "dblclick" : "click", { detail: C.click_count, button: 0 }), O.notify();
  })), R.has("mouse_move") && (g = g.on_mouse_move((C, O) => {
    o.dispatch(n.id, "pointermove", { ...zl(C), pointerType: "mouse" }), O.notify();
  })), (n.track_hover || H) && (g = g.on_hover((C, O) => {
    o.hover(n.id, C), O.notify();
  })), c && (g = g.on_mouse_down_out((C, O) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...zl(C), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", zl(C)), O.notify();
  }));
  const A = p.whitespace === "nowrap" ? Oo(p) : null, M = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let z = !n.range_name;
  for (const C of (n.children ?? []).filter(El)) {
    let O = Ao(C, i, o, u, !1, f, m, p, M && C.style?.position !== "absolute", y);
    const X = !z && (C.kind === "text" || !C.meta);
    if (X || C.kind === "text" && A) {
      let K = i.div();
      X && (K = K.id(n.range_name)), C.kind === "text" && A && (K = K.h(y.get(C)?.h ?? A)), O = K.child(O), z ||= X;
    }
    g = g.child(O);
  }
  return g;
}
const df = (n, i) => n.id === i || (n.children ?? []).some((o) => o.kind !== "text" && df(o, i)), ff = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && ff(i));
function Oo(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function Sv(n, i, o, u, c = 0) {
  const f = c > 0 ? gv([n.root, ...n.overlays], c) : /* @__PURE__ */ new Map();
  let m = i.div().relative().size_full().child(Ao(n.root, i, o, u, !1, !1, null, {}, !1, f));
  for (const p of n.overlays) m = m.child(Ao(p, i, o, u, !0, !1, null, {}, !1, f));
  return m;
}
const hv = ["text_size", "line_height", "whitespace", "text_ellipsis"], wt = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, zd = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, xo = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", on = (n) => n.kind === "text" || El(n) && n.style.position !== "absolute";
function gv(n, i) {
  const o = /* @__PURE__ */ new Map(), u = (b, j) => o.set(b, { ...o.get(b), ...Object.fromEntries(Object.entries(j).filter(([, A]) => Number.isFinite(A))) }), c = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map();
  function m(b, j) {
    if (b.kind === "text") return j.whitespace === "nowrap" ? Oo(j) ?? NaN : NaN;
    const A = { ...j };
    for (const X of hv) b.style[X] !== void 0 && (A[X] = b.style[X]);
    f.set(b, A);
    const M = b.style, z = (b.children ?? []).filter(on), C = z.map((X) => m(X, A));
    let O;
    if (M.h !== void 0 && M.h !== "auto") O = wt(M.h);
    else {
      const X = z.map((N, S) => (N.kind === "text" ? 0 : wt(N.style.mt) + wt(N.style.mb)) + C[S]);
      let K;
      if (xo(b)) K = M.flex_wrap === "wrap" ? NaN : M.items === "baseline" ? w(z, C, A) : Math.max(0, ...X);
      else if (zd(b)) {
        const N = z.some((G) => G.kind !== "text" && (G.style.flex_grow > 0 || G.style.flex_basis !== void 0)), S = M.display !== "flex" && z.some((G) => G.kind !== "text" && (wt(G.style.mt) || wt(G.style.mb)));
        K = N || S ? NaN : X.reduce((G, ut) => G + ut, 0) + (M.display === "flex" ? wt(M.gap_y) * Math.max(0, z.length - 1) : 0);
      } else K = NaN;
      O = K + wt(M.pt) + wt(M.pb) + wt(M.border_t) + wt(M.border_b), M.min_h !== void 0 && (O = Math.max(O, wt(M.min_h))), M.max_h !== void 0 && (O = Math.min(O, wt(M.max_h)));
    }
    return c.set(b, O), O;
  }
  const p = (b) => (Oo(b) - (_i + qd) * b.text_size) / 2 + _i * b.text_size;
  function w(b, j, A) {
    let M = 0, z = 0;
    for (const [C, O] of b.entries()) {
      const X = O.kind === "text" ? A : f.get(O);
      if (!(O.kind === "text" || (O.children ?? []).filter(on).every((G) => G.kind === "text")) || !Number.isFinite(j[C]) || typeof X.text_size != "number") return NaN;
      const N = O.kind === "text" ? {} : O.style, S = wt(N.mt) + wt(N.border_t) + wt(N.pt) + p(X);
      M = Math.max(M, S), z = Math.max(z, wt(N.mt) + j[C] + wt(N.mb) - S);
    }
    return M + z;
  }
  const y = () => ({ exact: 0, laid: 0 }), H = (b, j) => {
    if (!Number.isFinite(j))
      return Object.assign(b, y()), NaN;
    b.exact += j;
    const A = Math.round(b.exact * i + 1e-9) / i, M = A - b.laid;
    return b.laid = A, M;
  };
  function R(b) {
    if (!(b.kind === "text" || !El(b))) {
      for (const j of (b.children ?? []).filter((A) => A.kind !== "text" && El(A) && A.style.position === "absolute")) R(j);
      if (zd(b) && !xo(b)) {
        const j = y();
        u(b, { border_t: H(j, wt(b.style.border_t)), pt: H(j, wt(b.style.pt)) }), g(b, j);
      } else for (const j of (b.children ?? []).filter(on)) j.kind !== "text" && R(j);
    }
  }
  function g(b, j) {
    const A = (b.children ?? []).filter(on), M = b.style.display === "flex" ? wt(b.style.gap_y) : 0;
    if (M && A.some((z) => z.kind === "text")) {
      for (const z of A) z.kind !== "text" && R(z);
      return !1;
    }
    return M && u(b, { gap_y: 0 }), A.forEach((z, C) => {
      if (z.kind === "text") {
        const O = c.get(z) ?? m(z, f.get(b) ?? {});
        Number.isFinite(O) ? u(z, { h: H(j, O) }) : Object.assign(j, y());
        return;
      }
      u(z, { mt: H(j, (C ? M : 0) + wt(z.style.mt)) }), Number.isFinite(c.get(z)) ? E(z, j) : (R(z), Object.assign(j, y())), u(z, { mb: H(j, wt(z.style.mb)) });
    }), !0;
  }
  function E(b, j) {
    const A = b.style;
    for (const X of (b.children ?? []).filter((K) => K.kind !== "text" && El(K) && K.style.position === "absolute")) R(X);
    const M = j.laid, z = j.exact;
    u(b, { border_t: H(j, wt(A.border_t)), pt: H(j, wt(A.pt)) });
    const C = A.h !== void 0 && A.h !== "auto", O = c.get(b) - wt(A.pt) - wt(A.pb) - wt(A.border_t) - wt(A.border_b);
    if (xo(b) || C && (A.justify ?? "start") !== "start") {
      for (const X of (b.children ?? []).filter(on)) X.kind !== "text" && R(X);
      C || H(j, O);
    } else !g(b, j) && !C && H(j, O);
    if (C) {
      j.exact = z + c.get(b), j.laid = Math.round(j.exact * i + 1e-9) / i, u(b, { h: j.laid - M });
      return;
    }
    u(b, { pb: H(j, wt(A.pb)), border_b: H(j, wt(A.border_b)) }), u(b, { h: j.laid - M });
  }
  for (const b of n)
    m(b, {}), R(b);
  return o;
}
const zv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }] };
export {
  zv as NAMED_ELEMENTS,
  vv as React,
  Eh as SCHEMA,
  _v as STYLE_KEYS,
  Sv as describeToGpui,
  bv as jsxRuntime,
  yv as mount,
  xv as reactDom,
  wv as sdk
};
