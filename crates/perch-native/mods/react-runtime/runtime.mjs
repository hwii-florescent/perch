function xd(n, i) {
  for (var s = 0; s < i.length; s++) {
    const u = i[s];
    if (typeof u != "string" && !Array.isArray(u)) {
      for (const c in u)
        if (c !== "default" && !(c in n)) {
          const m = Object.getOwnPropertyDescriptor(u, c);
          m && Object.defineProperty(n, c, m.get ? m : {
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
//! `:first-child`, `:last-child`, `:nth-child(n)`, `:not()`, `:is()`, `:where()`, `:root`, the state pseudo-classes
//! (`:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:enabled`, `:checked`), and the
//! descendant and child combinators. Anything else (`+`, `~`, `:has()`, pseudo-elements, ...) throws a
//! `SelectorError`, so a caller can skip a rule it cannot evaluate instead of guessing.
//!
//! An element is anything with `tagName` (lower case), `getAttribute(name)`, `parentElement` and `children`
//! (elements only). State pseudo-classes ask `options.state(element, name, isSubject)`; without it they never match.
class _e extends Error {
}
const Np = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Tp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), Cp = /* @__PURE__ */ new Set(["first-child", "last-child", "root", ...Np]);
function bo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, s, u) => s ? String.fromCodePoint(parseInt(s, 16)) : u);
}
function si(n, i) {
  let s = i;
  for (; s < n.length; ) {
    const u = n[s];
    if (u === "\\") {
      s += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(u)) {
      s++;
      continue;
    }
    break;
  }
  if (s === i) throw new _e(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [bo(n.slice(i, s)), s];
}
function jp(n, i) {
  let s = 1;
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
    if (c === "(") s++;
    else if (c === ")" && --s === 0) return u;
  }
  throw new _e(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Mo(n) {
  const i = [];
  let s = 0, u = 0;
  for (let c = 0; c < n.length; c++) {
    const m = n[c];
    if (m === "\\") {
      c++;
      continue;
    }
    if (m === '"' || m === "'") {
      if (c = n.indexOf(m, c + 1), c < 0) break;
      continue;
    }
    m === "(" || m === "[" ? s++ : m === ")" || m === "]" ? s-- : m === "," && s === 0 && (i.push(n.slice(u, c).trim()), u = c + 1);
  }
  return i.push(n.slice(u).trim()), i.filter(Boolean);
}
function Mp(n, i) {
  const s = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let u = !1;
  for (; i < n.length; ) {
    const c = n[i];
    if (c === "*") {
      s.tag = "*", i++, u = !0;
      continue;
    }
    if (c === ".") {
      const [m, f] = si(n, i + 1);
      s.classes.push(m), i = f, u = !0;
      continue;
    }
    if (c === "#") {
      const [m, f] = si(n, i + 1);
      s.id = m, i = f, u = !0;
      continue;
    }
    if (c === "[") {
      const m = n.indexOf("]", i);
      if (m < 0) throw new _e(`unclosed [ in ${JSON.stringify(n)}`);
      const f = n.slice(i + 1, m).trim(), p = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(f);
      if (!p) throw new _e(`cannot read the attribute selector [${f}]`);
      const w = p[3] ?? p[4] ?? p[5];
      s.attrs.push({ name: bo(p[1]).toLowerCase(), op: p[2] ?? null, value: w === void 0 ? null : bo(w) }), i = m + 1, u = !0;
      continue;
    }
    if (c === ":") {
      if (n[i + 1] === ":") throw new _e(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [m, f] = si(n, i + 1);
      i = f;
      const p = m.toLowerCase();
      if (n[i] === "(") {
        if (!Tp.has(p)) throw new _e(`:${p}() is not supported`);
        const w = jp(n, i + 1), x = n.slice(i + 1, w).trim();
        if (i = w + 1, p === "nth-child") {
          if (!/^\d+$/.test(x)) throw new _e(`:nth-child(${x}) is not supported (only a number)`);
          s.pseudos.push({ name: p, n: Number(x) });
        } else
          s.pseudos.push({ name: p, list: Mo(x).map(Ao) });
      } else {
        if (!Cp.has(p)) throw new _e(`:${p} is not supported`);
        s.pseudos.push({ name: p });
      }
      u = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !u) {
      const [m, f] = si(n, i);
      s.tag = m.toLowerCase(), i = f, u = !0;
      continue;
    }
    break;
  }
  if (!u) throw new _e(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [s, i];
}
function Ao(n) {
  const i = [];
  let s = 0, u = null;
  for (n = n.trim(); s < n.length; ) {
    const [c, m] = Mp(n, s);
    i.push({ compound: c, combinator: u }), s = m;
    let f = !1;
    for (; n[s] === " " || n[s] === `
` || n[s] === "	"; )
      s++, f = !0;
    if (s >= n.length) break;
    const p = n[s];
    if (p === ">")
      for (u = ">", s++; n[s] === " "; ) s++;
    else {
      if (p === "+" || p === "~") throw new _e(`the ${p} combinator is not supported`);
      if (f) u = " ";
      else throw new _e(`unexpected ${JSON.stringify(p)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new _e("empty selector");
  return i;
}
const Uc = /* @__PURE__ */ new Map();
function _i(n) {
  let i = Uc.get(n);
  return i || (i = Mo(n).map(Ao), Uc.set(n, i)), i;
}
function wd(n) {
  const i = [0, 0, 0], s = (u) => {
    i[0] += u[0], i[1] += u[1], i[2] += u[2];
  };
  for (const { compound: u } of n) {
    u.id && i[0]++, i[1] += u.classes.length + u.attrs.length, u.tag && u.tag !== "*" && i[2]++;
    for (const c of u.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const m = c.list.map(wd).sort((f, p) => p[0] - f[0] || p[1] - f[1] || p[2] - f[2])[0];
          s(m);
        } else i[1]++;
  }
  return i;
}
function Ap(n, { name: i, op: s, value: u }) {
  const c = n.getAttribute(i);
  if (c == null) return !1;
  if (s === null) return !0;
  switch (s) {
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
function oo(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Op(n, i, s, u) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const c = n.classList ?? [];
    for (const m of i.classes) if (!c.includes(m)) return !1;
  }
  for (const c of i.attrs) if (!Ap(n, c)) return !1;
  for (const c of i.pseudos)
    switch (c.name) {
      case "first-child":
        if (oo(n)[0] !== n) return !1;
        break;
      case "last-child": {
        const m = oo(n);
        if (m[m.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (oo(n).indexOf(n) !== c.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((m) => Sl(n, m, s, u))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((m) => Sl(n, m, s, u))) return !1;
        break;
      default:
        if (!s.state || !s.state(n, c.name, u)) return !1;
    }
  return !0;
}
function Sl(n, i, s, u = !0) {
  const c = (m, f, p) => {
    const { compound: w, combinator: x } = i[f];
    if (!Op(m, w, s, p)) return !1;
    if (f === 0) return !0;
    if (x === ">") return !!m.parentElement && c(m.parentElement, f - 1, !1);
    for (let U = m.parentElement; U; U = U.parentElement) if (c(U, f - 1, !1)) return !0;
    return !1;
  };
  return c(n, i.length - 1, u);
}
function Rp(n, i, s = {}) {
  return (typeof i == "string" ? _i(i) : i).some((c) => Sl(n, c, s));
}
function _d(n, i, s = {}) {
  return Sl(n, i, s);
}
function hi(n, i, s = {}) {
  const u = _i(i), c = [], m = (f) => {
    for (const p of f.children)
      u.some((w) => Sl(p, w, s)) && c.push(p), m(p);
  };
  return m(n), c;
}
function Sd(n, i, s = {}) {
  const u = _i(i);
  for (let c = n; c; c = c.parentElement) if (u.some((m) => Sl(c, m, s))) return c;
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
let Hp = 1;
class yo {
  constructor(i = 0, s = 0, u = 0, c = 0) {
    this.x = i, this.y = s, this.width = u, this.height = c;
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
class Oo {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, s, u) {
    const c = u === !0 || !!u?.capture;
    this.listeners.some((m) => m.type === i && m.listener === s && m.capture === c) || this.listeners.push({ type: i, listener: s, capture: c });
  }
  removeEventListener(i, s, u) {
    const c = u === !0 || !!u?.capture;
    this.listeners = this.listeners.filter((m) => !(m.type === i && m.listener === s && m.capture === c));
  }
}
class Ro {
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
class Se extends Oo {
  constructor(i, s = {}, u = null) {
    super(), this.nodeType = 1, this.id = `n${Hp++}`, this.tagName = i.toLowerCase(), this.props = s, this.childNodes = [], this.parentNode = null, this.ownerDocument = u, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    for (const [s, u] of Object.entries(this.props))
      s.startsWith("data-") && u != null && u !== !1 && (i[s.slice(5).replace(/-([a-z])/g, (c, m) => m.toUpperCase())] = String(u));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const s = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return s.id != null ? String(s.id) : null;
    if (i === "style") return null;
    let c = s[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (c === void 0 && !i.includes("-")) {
      const m = i.replace(/-([a-z])/g, (f, p) => p.toUpperCase());
      c = s[m];
    }
    return c == null || typeof c == "function" ? null : typeof c == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(c) : c ? "" : null : String(c);
  }
  hasAttribute(i) {
    return this.getAttribute(i) !== null;
  }
  appendChild(i) {
    return i.parentNode && i.parentNode.removeChild(i), i.parentNode = this, this.childNodes.push(i), this.touch(), i;
  }
  insertBefore(i, s) {
    i.parentNode && i.parentNode.removeChild(i);
    const u = this.childNodes.indexOf(s);
    return i.parentNode = this, u < 0 ? this.childNodes.push(i) : this.childNodes.splice(u, 0, i), this.touch(), i;
  }
  removeChild(i) {
    const s = this.childNodes.indexOf(i);
    return s >= 0 && this.childNodes.splice(s, 1), i.parentNode = null, this.touch(), i;
  }
  contains(i) {
    for (let s = i; s; s = s.parentNode) if (s === this) return !0;
    return !1;
  }
  matches(i) {
    return Rp(this, i);
  }
  closest(i) {
    return Sd(this, i);
  }
  querySelectorAll(i) {
    return hi(this, i);
  }
  querySelector(i) {
    return hi(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.bounds;
    return i ? new yo(i.x, i.y, i.width, i.height) : new yo();
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
}
class Up {
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
  setItem(i, s) {
    this.map.set(i, String(s));
  }
  removeItem(i) {
    this.map.delete(i);
  }
  clear() {
    this.map.clear();
  }
}
function Dc(n) {
  for (let i = n; i instanceof Se; i = i.parentElement) i.touch();
}
class Dp extends Oo {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new Se("html", {}, this), this.body = new Se("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new Se(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Dc(i);
  }
  blur(i) {
    i.state.focus = !1, Dc(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return hi(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
}
class qp extends Oo {
  constructor(i, s) {
    super(), this.perch = i, this.document = s, this.location = { get hostname() {
      return i.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(i, s, ...u) {
    return globalThis.setTimeout(i, s, ...u);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function zd(n) {
  return {
    setTimeout: (i, s = 0, ...u) => n.setTimeout(() => i(...u), Math.max(0, Number(s) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
function Ue(n, i, s) {
  Object.defineProperty(n, i, { value: s, configurable: !0, writable: !0, enumerable: !1 });
}
function Bp(n, i = globalThis) {
  const s = new Dp(n), u = new qp(n, s);
  s.defaultView = u;
  const c = n.storage ?? new Up();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = zd(n);
    Ue(i, "setTimeout", f.setTimeout), Ue(i, "clearTimeout", f.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && Ue(i, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ue(i, "document", s), Ue(i, "window", u), Ue(i, "localStorage", c), Ue(i, "HTMLElement", Se), Ue(i, "Element", Se), Ue(i, "DOMRect", yo);
  const m = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Ue(m, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || Ue(i, "navigator", m), { document: s, window: u };
}
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const qc = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof qc?.setTimeout == "function") {
  const n = zd(qc);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Ho(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var so = { exports: {} }, nt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Bc;
function Yp() {
  if (Bc) return nt;
  Bc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), u = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), m = Symbol.for("react.consumer"), f = Symbol.for("react.context"), p = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), U = Symbol.for("react.lazy"), R = Symbol.for("react.activity"), g = Symbol.iterator;
  function T(v) {
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
  function N() {
  }
  N.prototype = M.prototype;
  function C(v, D, $) {
    this.props = v, this.context = D, this.refs = A, this.updater = $ || b;
  }
  var O = C.prototype = new N();
  O.constructor = C, j(O, M.prototype), O.isPureReactComponent = !0;
  var X = Array.isArray;
  function K() {
  }
  var E = { H: null, A: null, T: null, S: null }, S = Object.prototype.hasOwnProperty;
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
  function ct(v, D) {
    return G(v.type, D, v.props);
  }
  function _t(v) {
    return typeof v == "object" && v !== null && v.$$typeof === n;
  }
  function Et(v) {
    var D = { "=": "=0", ":": "=2" };
    return "$" + v.replace(/[=:]/g, function($) {
      return D[$];
    });
  }
  var Ot = /\/+/g;
  function Lt(v, D) {
    return typeof v == "object" && v !== null && v.key != null ? Et("" + v.key) : D.toString(36);
  }
  function Nt(v) {
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
  function q(v, D, $, W, F) {
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
            case U:
              return gt = v._init, q(
                gt(v._payload),
                D,
                $,
                W,
                F
              );
          }
      }
    if (gt)
      return F = F(v), gt = W === "" ? "." + Lt(v, 0) : W, X(F) ? ($ = "", gt != null && ($ = gt.replace(Ot, "$&/") + "/"), q(F, D, $, "", function(Na) {
        return Na;
      })) : F != null && (_t(F) && (F = ct(
        F,
        $ + (F.key == null || v && v.key === F.key ? "" : ("" + F.key).replace(
          Ot,
          "$&/"
        ) + "/") + gt
      )), D.push(F)), 1;
    gt = 0;
    var Kt = W === "" ? "." : W + ":";
    if (X(v))
      for (var rt = 0; rt < v.length; rt++)
        W = v[rt], P = Kt + Lt(W, rt), gt += q(
          W,
          D,
          $,
          P,
          F
        );
    else if (rt = T(v), typeof rt == "function")
      for (v = rt.call(v), rt = 0; !(W = v.next()).done; )
        W = W.value, P = Kt + Lt(W, rt++), gt += q(
          W,
          D,
          $,
          P,
          F
        );
    else if (P === "object") {
      if (typeof v.then == "function")
        return q(
          Nt(v),
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
    return q(v, W, "", "", function(P) {
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
      if (!_t(v))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return v;
    }
  };
  return nt.Activity = R, nt.Children = Q, nt.Component = M, nt.Fragment = s, nt.Profiler = c, nt.PureComponent = C, nt.StrictMode = u, nt.Suspense = w, nt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = E, nt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(v) {
      return E.H.useMemoCache(v);
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
      for (var gt = Array(P), Kt = 0; Kt < P; Kt++)
        gt[Kt] = arguments[Kt + 2];
      W.children = gt;
    }
    return G(v.type, F, W);
  }, nt.createContext = function(v) {
    return v = {
      $$typeof: f,
      _currentValue: v,
      _currentValue2: v,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, v.Provider = v, v.Consumer = {
      $$typeof: m,
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
      for (var Kt = Array(gt), rt = 0; rt < gt; rt++)
        Kt[rt] = arguments[rt + 2];
      F.children = Kt;
    }
    if (v && v.defaultProps)
      for (W in gt = v.defaultProps, gt)
        F[W] === void 0 && (F[W] = gt[W]);
    return G(v, P, F);
  }, nt.createRef = function() {
    return { current: null };
  }, nt.forwardRef = function(v) {
    return { $$typeof: p, render: v };
  }, nt.isValidElement = _t, nt.lazy = function(v) {
    return {
      $$typeof: U,
      _payload: { _status: -1, _result: v },
      _init: at
    };
  }, nt.memo = function(v, D) {
    return {
      $$typeof: x,
      type: v,
      compare: D === void 0 ? null : D
    };
  }, nt.startTransition = function(v) {
    var D = E.T, $ = {};
    E.T = $;
    try {
      var W = v(), F = E.S;
      F !== null && F($, W), typeof W == "object" && W !== null && typeof W.then == "function" && W.then(K, it);
    } catch (P) {
      it(P);
    } finally {
      D !== null && $.types !== null && (D.types = $.types), E.T = D;
    }
  }, nt.unstable_useCacheRefresh = function() {
    return E.H.useCacheRefresh();
  }, nt.use = function(v) {
    return E.H.use(v);
  }, nt.useActionState = function(v, D, $) {
    return E.H.useActionState(v, D, $);
  }, nt.useCallback = function(v, D) {
    return E.H.useCallback(v, D);
  }, nt.useContext = function(v) {
    return E.H.useContext(v);
  }, nt.useDebugValue = function() {
  }, nt.useDeferredValue = function(v, D) {
    return E.H.useDeferredValue(v, D);
  }, nt.useEffect = function(v, D) {
    return E.H.useEffect(v, D);
  }, nt.useEffectEvent = function(v) {
    return E.H.useEffectEvent(v);
  }, nt.useId = function() {
    return E.H.useId();
  }, nt.useImperativeHandle = function(v, D, $) {
    return E.H.useImperativeHandle(v, D, $);
  }, nt.useInsertionEffect = function(v, D) {
    return E.H.useInsertionEffect(v, D);
  }, nt.useLayoutEffect = function(v, D) {
    return E.H.useLayoutEffect(v, D);
  }, nt.useMemo = function(v, D) {
    return E.H.useMemo(v, D);
  }, nt.useOptimistic = function(v, D) {
    return E.H.useOptimistic(v, D);
  }, nt.useReducer = function(v, D, $) {
    return E.H.useReducer(v, D, $);
  }, nt.useRef = function(v) {
    return E.H.useRef(v);
  }, nt.useState = function(v) {
    return E.H.useState(v);
  }, nt.useSyncExternalStore = function(v, D, $) {
    return E.H.useSyncExternalStore(
      v,
      D,
      $
    );
  }, nt.useTransition = function() {
    return E.H.useTransition();
  }, nt.version = "19.2.8", nt;
}
var Yc;
function Ed() {
  return Yc || (Yc = 1, so.exports = Yp()), so.exports;
}
var Ut = Ed();
const Gp = /* @__PURE__ */ Ho(Ut), Qg = /* @__PURE__ */ xd({
  __proto__: null,
  default: Gp
}, [Ut]);
var uo = { exports: {} }, en = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Gc;
function Qp() {
  if (Gc) return en;
  Gc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function s(u, c, m) {
    var f = null;
    if (m !== void 0 && (f = "" + m), c.key !== void 0 && (f = "" + c.key), "key" in c) {
      m = {};
      for (var p in c)
        p !== "key" && (m[p] = c[p]);
    } else m = c;
    return c = m.ref, {
      $$typeof: n,
      type: u,
      key: f,
      ref: c !== void 0 ? c : null,
      props: m
    };
  }
  return en.Fragment = i, en.jsx = s, en.jsxs = s, en;
}
var Qc;
function Vp() {
  return Qc || (Qc = 1, uo.exports = Qp()), uo.exports;
}
var te = Vp();
const Kp = /* @__PURE__ */ Ho(te), Vg = /* @__PURE__ */ xd({
  __proto__: null,
  default: Kp
}, [te]);
var co = { exports: {} }, mo = { exports: {} }, fo = { exports: {} }, po = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Vc;
function Xp() {
  return Vc || (Vc = 1, (function(n) {
    function i(q, I) {
      var at = q.length;
      q.push(I);
      t: for (; 0 < at; ) {
        var it = at - 1 >>> 1, Q = q[it];
        if (0 < c(Q, I))
          q[it] = I, q[at] = Q, at = it;
        else break t;
      }
    }
    function s(q) {
      return q.length === 0 ? null : q[0];
    }
    function u(q) {
      if (q.length === 0) return null;
      var I = q[0], at = q.pop();
      if (at !== I) {
        q[0] = at;
        t: for (var it = 0, Q = q.length, v = Q >>> 1; it < v; ) {
          var D = 2 * (it + 1) - 1, $ = q[D], W = D + 1, F = q[W];
          if (0 > c($, at))
            W < Q && 0 > c(F, $) ? (q[it] = F, q[W] = at, it = W) : (q[it] = $, q[D] = at, it = D);
          else if (W < Q && 0 > c(F, at))
            q[it] = F, q[W] = at, it = W;
          else break t;
        }
      }
      return I;
    }
    function c(q, I) {
      var at = q.sortIndex - I.sortIndex;
      return at !== 0 ? at : q.id - I.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var m = performance;
      n.unstable_now = function() {
        return m.now();
      };
    } else {
      var f = Date, p = f.now();
      n.unstable_now = function() {
        return f.now() - p;
      };
    }
    var w = [], x = [], U = 1, R = null, g = 3, T = !1, b = !1, j = !1, A = !1, M = typeof setTimeout == "function" ? setTimeout : null, N = typeof clearTimeout == "function" ? clearTimeout : null, C = typeof setImmediate < "u" ? setImmediate : null;
    function O(q) {
      for (var I = s(x); I !== null; ) {
        if (I.callback === null) u(x);
        else if (I.startTime <= q)
          u(x), I.sortIndex = I.expirationTime, i(w, I);
        else break;
        I = s(x);
      }
    }
    function X(q) {
      if (j = !1, O(q), !b)
        if (s(w) !== null)
          b = !0, K || (K = !0, Et());
        else {
          var I = s(x);
          I !== null && Nt(X, I.startTime - q);
        }
    }
    var K = !1, E = -1, S = 5, G = -1;
    function ct() {
      return A ? !0 : !(n.unstable_now() - G < S);
    }
    function _t() {
      if (A = !1, K) {
        var q = n.unstable_now();
        G = q;
        var I = !0;
        try {
          t: {
            b = !1, j && (j = !1, N(E), E = -1), T = !0;
            var at = g;
            try {
              e: {
                for (O(q), R = s(w); R !== null && !(R.expirationTime > q && ct()); ) {
                  var it = R.callback;
                  if (typeof it == "function") {
                    R.callback = null, g = R.priorityLevel;
                    var Q = it(
                      R.expirationTime <= q
                    );
                    if (q = n.unstable_now(), typeof Q == "function") {
                      R.callback = Q, O(q), I = !0;
                      break e;
                    }
                    R === s(w) && u(w), O(q);
                  } else u(w);
                  R = s(w);
                }
                if (R !== null) I = !0;
                else {
                  var v = s(x);
                  v !== null && Nt(
                    X,
                    v.startTime - q
                  ), I = !1;
                }
              }
              break t;
            } finally {
              R = null, g = at, T = !1;
            }
            I = void 0;
          }
        } finally {
          I ? Et() : K = !1;
        }
      }
    }
    var Et;
    if (typeof C == "function")
      Et = function() {
        C(_t);
      };
    else if (typeof MessageChannel < "u") {
      var Ot = new MessageChannel(), Lt = Ot.port2;
      Ot.port1.onmessage = _t, Et = function() {
        Lt.postMessage(null);
      };
    } else
      Et = function() {
        M(_t, 0);
      };
    function Nt(q, I) {
      E = M(function() {
        q(n.unstable_now());
      }, I);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(q) {
      q.callback = null;
    }, n.unstable_forceFrameRate = function(q) {
      0 > q || 125 < q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : S = 0 < q ? Math.floor(1e3 / q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return g;
    }, n.unstable_next = function(q) {
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
        return q();
      } finally {
        g = at;
      }
    }, n.unstable_requestPaint = function() {
      A = !0;
    }, n.unstable_runWithPriority = function(q, I) {
      switch (q) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          q = 3;
      }
      var at = g;
      g = q;
      try {
        return I();
      } finally {
        g = at;
      }
    }, n.unstable_scheduleCallback = function(q, I, at) {
      var it = n.unstable_now();
      switch (typeof at == "object" && at !== null ? (at = at.delay, at = typeof at == "number" && 0 < at ? it + at : it) : at = it, q) {
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
      return Q = at + Q, q = {
        id: U++,
        callback: I,
        priorityLevel: q,
        startTime: at,
        expirationTime: Q,
        sortIndex: -1
      }, at > it ? (q.sortIndex = at, i(x, q), s(w) === null && q === s(x) && (j ? (N(E), E = -1) : j = !0, Nt(X, at - it))) : (q.sortIndex = Q, i(w, q), b || T || (b = !0, K || (K = !0, Et()))), q;
    }, n.unstable_shouldYield = ct, n.unstable_wrapCallback = function(q) {
      var I = g;
      return function() {
        var at = g;
        g = I;
        try {
          return q.apply(this, arguments);
        } finally {
          g = at;
        }
      };
    };
  })(po)), po;
}
var Kc;
function Zp() {
  return Kc || (Kc = 1, fo.exports = Xp()), fo.exports;
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
var Xc;
function Jp() {
  return Xc || (Xc = 1, (function(n) {
    n.exports = function(i) {
      function s(t, e, a, l) {
        return new Mm(t, e, a, l);
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
      function m(t) {
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
      function f(t) {
        if (m(t) !== t)
          throw Error(c(188));
      }
      function p(t) {
        var e = t.alternate;
        if (!e) {
          if (e = m(t), e === null) throw Error(c(188));
          return e !== t ? null : t;
        }
        for (var a = t, l = e; ; ) {
          var r = a.return;
          if (r === null) break;
          var o = r.alternate;
          if (o === null) {
            if (l = r.return, l !== null) {
              a = l;
              continue;
            }
            break;
          }
          if (r.child === o.child) {
            for (o = r.child; o; ) {
              if (o === a) return f(r), t;
              if (o === l) return f(r), e;
              o = o.sibling;
            }
            throw Error(c(188));
          }
          if (a.return !== l.return) a = r, l = o;
          else {
            for (var d = !1, h = r.child; h; ) {
              if (h === a) {
                d = !0, a = r, l = o;
                break;
              }
              if (h === l) {
                d = !0, l = r, a = o;
                break;
              }
              h = h.sibling;
            }
            if (!d) {
              for (h = o.child; h; ) {
                if (h === a) {
                  d = !0, a = o, l = r;
                  break;
                }
                if (h === l) {
                  d = !0, l = o, a = r;
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
      function U(t) {
        return t === null || typeof t != "object" ? null : (t = ec && t[ec] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function R(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Um ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case al:
            return "Fragment";
          case Nr:
            return "Profiler";
          case Pu:
            return "StrictMode";
          case Cr:
            return "Suspense";
          case jr:
            return "SuspenseList";
          case Ar:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case el:
              return "Portal";
            case pa:
              return t.displayName || "Context";
            case tc:
              return (t._context.displayName || "Context") + ".Consumer";
            case Tr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Mr:
              return e = t.displayName || null, e !== null ? e : R(t.type) || "Memo";
            case ha:
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
      function T(t) {
        0 > il || (t.current = qr[il], qr[il] = null, il--);
      }
      function b(t, e) {
        il++, qr[il] = t.current, t.current = e;
      }
      function j(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (dp(t) / mp | 0) | 0;
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
        var r = 0, o = t.suspendedLanes, d = t.pingedLanes;
        t = t.warmLanes;
        var h = l & 134217727;
        return h !== 0 ? (l = h & ~o, l !== 0 ? r = A(l) : (d &= h, d !== 0 ? r = A(d) : a || (a = h & ~t, a !== 0 && (r = A(a))))) : (h = l & ~o, h !== 0 ? r = A(h) : d !== 0 ? r = A(d) : a || (a = l & ~t, a !== 0 && (r = A(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & o) === 0 && (o = r & -r, a = e & -e, o >= a || o === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function N(t, e) {
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
        var t = Vn;
        return Vn <<= 1, (Vn & 62914560) === 0 && (Vn = 4194304), t;
      }
      function X(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function K(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function E(t, e, a, l, r, o) {
        var d = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var h = t.entanglements, k = t.expirationTimes, H = t.hiddenUpdates;
        for (a = d & ~a; 0 < a; ) {
          var V = 31 - he(a), B = 1 << V;
          h[V] = 0, k[V] = -1;
          var Z = H[V];
          if (Z !== null)
            for (H[V] = null, V = 0; V < Z.length; V++) {
              var ot = Z[V];
              ot !== null && (ot.lane &= -536870913);
            }
          a &= ~B;
        }
        l !== 0 && S(t, l, 0), o !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= o & ~(d & ~e));
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
      function ct(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : _t(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function _t(t) {
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
      function Et(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function Ot(t) {
        if (typeof vp == "function" && bp(t), ge && typeof ge.setStrictMode == "function")
          try {
            ge.setStrictMode(Vl, t);
          } catch {
          }
      }
      function Lt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Nt(t) {
        if (Gr === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Gr = e && e[1] || "", Nc = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Gr + t + Nc;
      }
      function q(t, e) {
        if (!t || Qr) return "";
        Qr = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var l = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var B = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(B.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(B, []);
                    } catch (ot) {
                      var Z = ot;
                    }
                    Reflect.construct(t, [], B);
                  } else {
                    try {
                      B.call();
                    } catch (ot) {
                      Z = ot;
                    }
                    t.call(B.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ot) {
                    Z = ot;
                  }
                  (B = t()) && typeof B.catch == "function" && B.catch(function() {
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
          var o = l.DetermineComponentFrameRoot(), d = o[0], h = o[1];
          if (d && h) {
            var k = d.split(`
`), H = h.split(`
`);
            for (r = l = 0; l < k.length && !k[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < H.length && !H[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === k.length || r === H.length)
              for (l = k.length - 1, r = H.length - 1; 1 <= l && 0 <= r && k[l] !== H[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (k[l] !== H[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || k[l] !== H[r]) {
                      var V = `
` + k[l].replace(" at new ", " at ");
                      return t.displayName && V.includes("<anonymous>") && (V = V.replace("<anonymous>", t.displayName)), V;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          Qr = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? Nt(a) : "";
      }
      function I(t, e) {
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
            return q(t.type, !1);
          case 11:
            return q(t.type.render, !1);
          case 1:
            return q(t.type, !0);
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
          var a = Tc.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: at(e)
          }, Tc.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: at(e)
        };
      }
      function Q(t, e) {
        ol[sl++] = Kl, ol[sl++] = Xn, Xn = t, Kl = e;
      }
      function v(t, e, a) {
        ze[Ee++] = Ye, ze[Ee++] = Ge, ze[Ee++] = ga, ga = t;
        var l = Ye;
        t = Ge;
        var r = 32 - he(l) - 1;
        l &= ~(1 << r), a += 1;
        var o = 32 - he(e) + r;
        if (30 < o) {
          var d = r - r % 5;
          o = (l & (1 << d) - 1).toString(32), l >>= d, r -= d, Ye = 1 << 32 - he(e) + r | a << r | l, Ge = o + t;
        } else
          Ye = 1 << o | a << r | l, Ge = t;
      }
      function D(t) {
        t.return !== null && (Q(t, 1), v(t, 1, 0));
      }
      function $(t) {
        for (; t === Xn; )
          Xn = ol[--sl], ol[sl] = null, Kl = ol[--sl], ol[sl] = null;
        for (; t === ga; )
          ga = ze[--Ee], ze[Ee] = null, Ge = ze[--Ee], ze[Ee] = null, Ye = ze[--Ee], ze[Ee] = null;
      }
      function W(t, e) {
        ze[Ee++] = Ye, ze[Ee++] = Ge, ze[Ee++] = ga, Ye = e.id, Ge = e.overflow, ga = t;
      }
      function F(t, e) {
        b(va, e), b(Xl, t), b(It, null), t = Bm(e), T(It), b(It, t);
      }
      function P() {
        T(It), T(Xl), T(va);
      }
      function gt(t) {
        t.memoizedState !== null && b(Zn, t);
        var e = It.current, a = Ym(e, t.type);
        e !== a && (b(Xl, t), b(It, a));
      }
      function Kt(t) {
        Xl.current === t && (T(It), T(Xl)), Zn.current === t && (T(Zn), Fe ? Da._currentValue = ll : Da._currentValue2 = ll);
      }
      function rt(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw El(it(e, t)), Vr;
      }
      function Na(t, e) {
        if (!le) throw Error(c(175));
        Gf(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || rt(t, !0);
      }
      function Ta(t) {
        for ($t = t.return; $t; )
          switch ($t.tag) {
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
              $t = $t.return;
          }
      }
      function Ce(t) {
        if (!le || t !== $t) return !1;
        if (!ht) return Ta(t), ht = !0, !1;
        var e = t.tag;
        if (Gt ? e !== 3 && e !== 27 && (e !== 5 || pc(t.type) && !Yn(t.type, t.memoizedProps)) && Tt && rt(t) : e !== 3 && (e !== 5 || pc(t.type) && !Yn(t.type, t.memoizedProps)) && Tt && rt(t), Ta(t), e === 13) {
          if (!le) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Tt = Zf(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Tt = Xf(t);
        } else
          Tt = Gt && e === 27 ? Mf(
            t.type,
            Tt
          ) : $t ? fc(t.stateNode) : null;
        return !0;
      }
      function je() {
        le && (Tt = $t = null, ht = !1);
      }
      function ra() {
        var t = ba;
        return t !== null && (ue === null ? ue = t : ue.push.apply(
          ue,
          t
        ), ba = null), t;
      }
      function El(t) {
        ba === null ? ba = [t] : ba.push(t);
      }
      function oa(t, e, a) {
        Fe ? (b(Jn, e._currentValue), e._currentValue = a) : (b(Jn, e._currentValue2), e._currentValue2 = a);
      }
      function Ke(t) {
        var e = Jn.current;
        Fe ? t._currentValue = e : t._currentValue2 = e, T(Jn);
      }
      function zi(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Ei(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var o = r.dependencies;
          if (o !== null) {
            var d = r.child;
            o = o.firstContext;
            t: for (; o !== null; ) {
              var h = o;
              o = r;
              for (var k = 0; k < e.length; k++)
                if (h.context === e[k]) {
                  o.lanes |= a, h = o.alternate, h !== null && (h.lanes |= a), zi(
                    o.return,
                    a,
                    t
                  ), l || (d = null);
                  break t;
                }
              o = h.next;
            }
          } else if (r.tag === 18) {
            if (d = r.return, d === null) throw Error(c(341));
            d.lanes |= a, o = d.alternate, o !== null && (o.lanes |= a), zi(d, a, t), d = null;
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
      function Wa(t, e, a, l) {
        t = null;
        for (var r = e, o = !1; r !== null; ) {
          if (!o) {
            if ((r.flags & 524288) !== 0) o = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var d = r.alternate;
            if (d === null) throw Error(c(387));
            if (d = d.memoizedProps, d !== null) {
              var h = r.type;
              ve(r.pendingProps.value, d.value) || (t !== null ? t.push(h) : t = [h]);
            }
          } else if (r === Zn.current) {
            if (d = r.alternate, d === null) throw Error(c(387));
            d.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Da) : t = [Da]);
          }
          r = r.return;
        }
        t !== null && Ei(
          e,
          t,
          a,
          l
        ), e.flags |= 262144;
      }
      function un(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ve(
            Fe ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Ca(t) {
        qa = t, $e = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Wt(t) {
        return Go(qa, t);
      }
      function cn(t, e) {
        return qa === null && Ca(t), Go(t, e);
      }
      function Go(t, e) {
        var a = Fe ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, $e === null) {
          if (t === null) throw Error(c(308));
          $e = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else $e = $e.next = e;
        return a;
      }
      function ki() {
        return {
          controller: new xp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function kl(t) {
        t.refCount--, t.refCount === 0 && wp(_p, function() {
          t.controller.abort();
        });
      }
      function dn() {
      }
      function De(t) {
        t !== ul && t.next === null && (ul === null ? Ln = ul = t : ul = ul.next = t), Wn = !0, Kr || (Kr = !0, om());
      }
      function Fa(t, e) {
        if (!Xr && Wn) {
          Xr = !0;
          do
            for (var a = !1, l = Ln; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var o = 0;
                else {
                  var d = l.suspendedLanes, h = l.pingedLanes;
                  o = (1 << 31 - he(42 | t) + 1) - 1, o &= r & ~(d & ~h), o = o & 201326741 ? o & 201326741 | 1 : o ? o | 2 : 0;
                }
                o !== 0 && (a = !0, Zo(l, o));
              } else
                o = pt, o = M(
                  l,
                  l === zt ? o : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Ua
                ), (o & 3) === 0 || N(l, o) || (a = !0, Zo(l, o));
              l = l.next;
            }
          while (a);
          Xr = !1;
        }
      }
      function Qo() {
        Vo();
      }
      function Vo() {
        Wn = Kr = !1;
        var t = 0;
        Ba !== 0 && Wm() && (t = Ba);
        for (var e = oe(), a = null, l = Ln; l !== null; ) {
          var r = l.next, o = Ko(l, e);
          o === 0 ? (l.next = null, a === null ? Ln = r : a.next = r, r === null && (ul = a)) : (a = l, (t !== 0 || (o & 3) !== 0) && (Wn = !0)), l = r;
        }
        Qt !== 0 && Qt !== 5 || Fa(t), Ba !== 0 && (Ba = 0);
      }
      function Ko(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, o = t.pendingLanes & -62914561; 0 < o; ) {
          var d = 31 - he(o), h = 1 << d, k = r[d];
          k === -1 ? ((h & a) === 0 || (h & l) !== 0) && (r[d] = C(h, e)) : k <= e && (t.expiredLanes |= h), o &= ~h;
        }
        if (e = zt, a = pt, a = M(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Ua
        ), l = t.callbackNode, a === 0 || t === e && (wt === 2 || wt === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && Br(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || N(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && Br(l), Et(a)) {
            case 2:
            case 8:
              a = hp;
              break;
            case 32:
              a = Yr;
              break;
            case 268435456:
              a = gp;
              break;
            default:
              a = Yr;
          }
          return l = Xo.bind(null, t), a = Kn(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && Br(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Xo(t, e) {
        if (Qt !== 0 && Qt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Bl() && t.callbackNode !== a)
          return null;
        var l = pt;
        return l = M(
          t,
          t === zt ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Ua
        ), l === 0 ? null : (Tu(t, l, e), Ko(t, oe()), t.callbackNode != null && t.callbackNode === a ? Xo.bind(null, t) : null);
      }
      function Zo(t, e) {
        if (Bl()) return null;
        Tu(t, e, !0);
      }
      function om() {
        af ? lf(function() {
          (mt & 6) !== 0 ? Kn(
            Ec,
            Qo
          ) : Vo();
        }) : Kn(
          Ec,
          Qo
        );
      }
      function Ni() {
        if (Ba === 0) {
          var t = cl;
          t === 0 && (t = Gn, Gn <<= 1, (Gn & 261888) === 0 && (Gn = 256)), Ba = t;
        }
        return Ba;
      }
      function sm(t, e) {
        if (Zl === null) {
          var a = Zl = [];
          Zr = 0, cl = Ni(), dl = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return Zr++, e.then(Jo, Jo), e;
      }
      function Jo() {
        if (--Zr === 0 && Zl !== null) {
          dl !== null && (dl.status = "fulfilled");
          var t = Zl;
          Zl = null, cl = 0, dl = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function um(t, e) {
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
      function Ti() {
        var t = Ya.current;
        return t !== null ? t : zt.pooledCache;
      }
      function mn(t, e) {
        e === null ? b(Ya, Ya.current) : b(Ya, e.pool);
      }
      function Lo() {
        var t = Ti();
        return t === null ? null : {
          parent: Fe ? Ct._currentValue : Ct._currentValue2,
          pool: t
        };
      }
      function fn(t, e) {
        if (ve(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), l = Object.keys(e);
        if (a.length !== l.length) return !1;
        for (l = 0; l < a.length; l++) {
          var r = a[l];
          if (!yp.call(e, r) || !ve(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function Wo(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Fo(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(dn, dn), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, $o(t), t;
          default:
            if (typeof e.status == "string") e.then(dn, dn);
            else {
              if (t = zt, t !== null && 100 < t.shellSuspendCounter)
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
                throw t = e.reason, $o(t), t;
            }
            throw Ga = e, ml;
        }
      }
      function ja(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ga = a, ml) : a;
        }
      }
      function Io() {
        if (Ga === null) throw Error(c(459));
        var t = Ga;
        return Ga = null, t;
      }
      function $o(t) {
        if (t === ml || t === Fn)
          throw Error(c(483));
      }
      function pn(t) {
        var e = Jl;
        return Jl += 1, fl === null && (fl = []), Fo(fl, t, e);
      }
      function Nl(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function hn(t, e) {
        throw e.$$typeof === Rm ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
          c(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Po(t) {
        function e(_, y) {
          if (t) {
            var z = _.deletions;
            z === null ? (_.deletions = [y], _.flags |= 16) : z.push(y);
          }
        }
        function a(_, y) {
          if (!t) return null;
          for (; y !== null; )
            e(_, y), y = y.sibling;
          return null;
        }
        function l(_) {
          for (var y = /* @__PURE__ */ new Map(); _ !== null; )
            _.key !== null ? y.set(_.key, _) : y.set(_.index, _), _ = _.sibling;
          return y;
        }
        function r(_, y) {
          return _ = We(_, y), _.index = 0, _.sibling = null, _;
        }
        function o(_, y, z) {
          return _.index = z, t ? (z = _.alternate, z !== null ? (z = z.index, z < y ? (_.flags |= 67108866, y) : z) : (_.flags |= 67108866, y)) : (_.flags |= 1048576, y);
        }
        function d(_) {
          return t && _.alternate === null && (_.flags |= 67108866), _;
        }
        function h(_, y, z, Y) {
          return y === null || y.tag !== 6 ? (y = Sr(z, _.mode, Y), y.return = _, y) : (y = r(y, z), y.return = _, y);
        }
        function k(_, y, z, Y) {
          var et = z.type;
          return et === al ? V(
            _,
            y,
            z.props.children,
            Y,
            z.key
          ) : y !== null && (y.elementType === et || typeof et == "object" && et !== null && et.$$typeof === ha && ja(et) === y.type) ? (y = r(y, z.props), Nl(y, z), y.return = _, y) : (y = Dn(
            z.type,
            z.key,
            z.props,
            null,
            _.mode,
            Y
          ), Nl(y, z), y.return = _, y);
        }
        function H(_, y, z, Y) {
          return y === null || y.tag !== 4 || y.stateNode.containerInfo !== z.containerInfo || y.stateNode.implementation !== z.implementation ? (y = zr(z, _.mode, Y), y.return = _, y) : (y = r(y, z.children || []), y.return = _, y);
        }
        function V(_, y, z, Y, et) {
          return y === null || y.tag !== 7 ? (y = Ha(
            z,
            _.mode,
            Y,
            et
          ), y.return = _, y) : (y = r(y, z), y.return = _, y);
        }
        function B(_, y, z) {
          if (typeof y == "string" && y !== "" || typeof y == "number" || typeof y == "bigint")
            return y = Sr(
              "" + y,
              _.mode,
              z
            ), y.return = _, y;
          if (typeof y == "object" && y !== null) {
            switch (y.$$typeof) {
              case qn:
                return z = Dn(
                  y.type,
                  y.key,
                  y.props,
                  null,
                  _.mode,
                  z
                ), Nl(z, y), z.return = _, z;
              case el:
                return y = zr(
                  y,
                  _.mode,
                  z
                ), y.return = _, y;
              case ha:
                return y = ja(y), B(_, y, z);
            }
            if (Bn(y) || U(y))
              return y = Ha(
                y,
                _.mode,
                z,
                null
              ), y.return = _, y;
            if (typeof y.then == "function")
              return B(_, pn(y), z);
            if (y.$$typeof === pa)
              return B(
                _,
                cn(_, y),
                z
              );
            hn(_, y);
          }
          return null;
        }
        function Z(_, y, z, Y) {
          var et = y !== null ? y.key : null;
          if (typeof z == "string" && z !== "" || typeof z == "number" || typeof z == "bigint")
            return et !== null ? null : h(_, y, "" + z, Y);
          if (typeof z == "object" && z !== null) {
            switch (z.$$typeof) {
              case qn:
                return z.key === et ? k(_, y, z, Y) : null;
              case el:
                return z.key === et ? H(_, y, z, Y) : null;
              case ha:
                return z = ja(z), Z(_, y, z, Y);
            }
            if (Bn(z) || U(z))
              return et !== null ? null : V(_, y, z, Y, null);
            if (typeof z.then == "function")
              return Z(
                _,
                y,
                pn(z),
                Y
              );
            if (z.$$typeof === pa)
              return Z(
                _,
                y,
                cn(_, z),
                Y
              );
            hn(_, z);
          }
          return null;
        }
        function ot(_, y, z, Y, et) {
          if (typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint")
            return _ = _.get(z) || null, h(y, _, "" + Y, et);
          if (typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case qn:
                return _ = _.get(
                  Y.key === null ? z : Y.key
                ) || null, k(y, _, Y, et);
              case el:
                return _ = _.get(
                  Y.key === null ? z : Y.key
                ) || null, H(y, _, Y, et);
              case ha:
                return Y = ja(Y), ot(
                  _,
                  y,
                  z,
                  Y,
                  et
                );
            }
            if (Bn(Y) || U(Y))
              return _ = _.get(z) || null, V(y, _, Y, et, null);
            if (typeof Y.then == "function")
              return ot(
                _,
                y,
                z,
                pn(Y),
                et
              );
            if (Y.$$typeof === pa)
              return ot(
                _,
                y,
                z,
                cn(y, Y),
                et
              );
            hn(y, Y);
          }
          return null;
        }
        function Pt(_, y, z, Y) {
          for (var et = null, jt = null, lt = y, bt = y = 0, Jt = null; lt !== null && bt < z.length; bt++) {
            lt.index > bt ? (Jt = lt, lt = null) : Jt = lt.sibling;
            var yt = Z(
              _,
              lt,
              z[bt],
              Y
            );
            if (yt === null) {
              lt === null && (lt = Jt);
              break;
            }
            t && lt && yt.alternate === null && e(_, lt), y = o(yt, y, bt), jt === null ? et = yt : jt.sibling = yt, jt = yt, lt = Jt;
          }
          if (bt === z.length)
            return a(_, lt), ht && Q(_, bt), et;
          if (lt === null) {
            for (; bt < z.length; bt++)
              lt = B(_, z[bt], Y), lt !== null && (y = o(
                lt,
                y,
                bt
              ), jt === null ? et = lt : jt.sibling = lt, jt = lt);
            return ht && Q(_, bt), et;
          }
          for (lt = l(lt); bt < z.length; bt++)
            Jt = ot(
              lt,
              _,
              bt,
              z[bt],
              Y
            ), Jt !== null && (t && Jt.alternate !== null && lt.delete(
              Jt.key === null ? bt : Jt.key
            ), y = o(
              Jt,
              y,
              bt
            ), jt === null ? et = Jt : jt.sibling = Jt, jt = Jt);
          return t && lt.forEach(function(za) {
            return e(_, za);
          }), ht && Q(_, bt), et;
        }
        function tn(_, y, z, Y) {
          if (z == null) throw Error(c(151));
          for (var et = null, jt = null, lt = y, bt = y = 0, Jt = null, yt = z.next(); lt !== null && !yt.done; bt++, yt = z.next()) {
            lt.index > bt ? (Jt = lt, lt = null) : Jt = lt.sibling;
            var za = Z(_, lt, yt.value, Y);
            if (za === null) {
              lt === null && (lt = Jt);
              break;
            }
            t && lt && za.alternate === null && e(_, lt), y = o(za, y, bt), jt === null ? et = za : jt.sibling = za, jt = za, lt = Jt;
          }
          if (yt.done)
            return a(_, lt), ht && Q(_, bt), et;
          if (lt === null) {
            for (; !yt.done; bt++, yt = z.next())
              yt = B(_, yt.value, Y), yt !== null && (y = o(
                yt,
                y,
                bt
              ), jt === null ? et = yt : jt.sibling = yt, jt = yt);
            return ht && Q(_, bt), et;
          }
          for (lt = l(lt); !yt.done; bt++, yt = z.next())
            yt = ot(
              lt,
              _,
              bt,
              yt.value,
              Y
            ), yt !== null && (t && yt.alternate !== null && lt.delete(yt.key === null ? bt : yt.key), y = o(yt, y, bt), jt === null ? et = yt : jt.sibling = yt, jt = yt);
          return t && lt.forEach(function(kp) {
            return e(_, kp);
          }), ht && Q(_, bt), et;
        }
        function Xa(_, y, z, Y) {
          if (typeof z == "object" && z !== null && z.type === al && z.key === null && (z = z.props.children), typeof z == "object" && z !== null) {
            switch (z.$$typeof) {
              case qn:
                t: {
                  for (var et = z.key; y !== null; ) {
                    if (y.key === et) {
                      if (et = z.type, et === al) {
                        if (y.tag === 7) {
                          a(
                            _,
                            y.sibling
                          ), Y = r(
                            y,
                            z.props.children
                          ), Y.return = _, _ = Y;
                          break t;
                        }
                      } else if (y.elementType === et || typeof et == "object" && et !== null && et.$$typeof === ha && ja(et) === y.type) {
                        a(
                          _,
                          y.sibling
                        ), Y = r(y, z.props), Nl(Y, z), Y.return = _, _ = Y;
                        break t;
                      }
                      a(_, y);
                      break;
                    } else e(_, y);
                    y = y.sibling;
                  }
                  z.type === al ? (Y = Ha(
                    z.props.children,
                    _.mode,
                    Y,
                    z.key
                  ), Y.return = _, _ = Y) : (Y = Dn(
                    z.type,
                    z.key,
                    z.props,
                    null,
                    _.mode,
                    Y
                  ), Nl(Y, z), Y.return = _, _ = Y);
                }
                return d(_);
              case el:
                t: {
                  for (et = z.key; y !== null; ) {
                    if (y.key === et)
                      if (y.tag === 4 && y.stateNode.containerInfo === z.containerInfo && y.stateNode.implementation === z.implementation) {
                        a(
                          _,
                          y.sibling
                        ), Y = r(
                          y,
                          z.children || []
                        ), Y.return = _, _ = Y;
                        break t;
                      } else {
                        a(_, y);
                        break;
                      }
                    else e(_, y);
                    y = y.sibling;
                  }
                  Y = zr(z, _.mode, Y), Y.return = _, _ = Y;
                }
                return d(_);
              case ha:
                return z = ja(z), Xa(
                  _,
                  y,
                  z,
                  Y
                );
            }
            if (Bn(z))
              return Pt(
                _,
                y,
                z,
                Y
              );
            if (U(z)) {
              if (et = U(z), typeof et != "function")
                throw Error(c(150));
              return z = et.call(z), tn(
                _,
                y,
                z,
                Y
              );
            }
            if (typeof z.then == "function")
              return Xa(
                _,
                y,
                pn(z),
                Y
              );
            if (z.$$typeof === pa)
              return Xa(
                _,
                y,
                cn(_, z),
                Y
              );
            hn(_, z);
          }
          return typeof z == "string" && z !== "" || typeof z == "number" || typeof z == "bigint" ? (z = "" + z, y !== null && y.tag === 6 ? (a(_, y.sibling), Y = r(y, z), Y.return = _, _ = Y) : (a(_, y), Y = Sr(z, _.mode, Y), Y.return = _, _ = Y), d(_)) : a(_, y);
        }
        return function(_, y, z, Y) {
          try {
            Jl = 0;
            var et = Xa(
              _,
              y,
              z,
              Y
            );
            return fl = null, et;
          } catch (lt) {
            if (lt === ml || lt === Fn) throw lt;
            var jt = s(29, lt, null, _.mode);
            return jt.lanes = Y, jt.return = _, jt;
          } finally {
          }
        };
      }
      function gn() {
        for (var t = pl, e = Lr = pl = 0; e < t; ) {
          var a = Ne[e];
          Ne[e++] = null;
          var l = Ne[e];
          Ne[e++] = null;
          var r = Ne[e];
          Ne[e++] = null;
          var o = Ne[e];
          if (Ne[e++] = null, l !== null && r !== null) {
            var d = l.pending;
            d === null ? r.next = r : (r.next = d.next, d.next = r), l.pending = r;
          }
          o !== 0 && ts(a, r, o);
        }
      }
      function vn(t, e, a, l) {
        Ne[pl++] = t, Ne[pl++] = e, Ne[pl++] = a, Ne[pl++] = l, Lr |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Ci(t, e, a, l) {
        return vn(t, e, a, l), bn(t);
      }
      function Ma(t, e) {
        return vn(t, null, null, e), bn(t);
      }
      function ts(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, o = t.return; o !== null; )
          o.childLanes |= a, l = o.alternate, l !== null && (l.childLanes |= a), o.tag === 22 && (t = o.stateNode, t === null || t._visibility & 1 || (r = !0)), t = o, o = o.return;
        return t.tag === 3 ? (o = t.stateNode, r && e !== null && (r = 31 - he(a), t = o.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), o) : null;
      }
      function bn(t) {
        if (50 < Pl)
          throw Pl = 0, ro = null, Error(c(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function ji(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Mi(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function sa(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function ua(t, e, a) {
        var l = t.updateQueue;
        if (l === null) return null;
        if (l = l.shared, (mt & 2) !== 0) {
          var r = l.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = bn(t), ts(t, null, a), e;
        }
        return vn(t, l, e, a), bn(t);
      }
      function Tl(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function Ai(t, e) {
        var a = t.updateQueue, l = t.alternate;
        if (l !== null && (l = l.updateQueue, a === l)) {
          var r = null, o = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var d = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              o === null ? r = o = d : o = o.next = d, a = a.next;
            } while (a !== null);
            o === null ? r = o = e : o = o.next = e;
          } else r = o = e;
          a = {
            baseState: l.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: o,
            shared: l.shared,
            callbacks: l.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Cl() {
        if (Wr) {
          var t = dl;
          if (t !== null) throw t;
        }
      }
      function jl(t, e, a, l) {
        Wr = !1;
        var r = t.updateQueue;
        ya = !1;
        var o = r.firstBaseUpdate, d = r.lastBaseUpdate, h = r.shared.pending;
        if (h !== null) {
          r.shared.pending = null;
          var k = h, H = k.next;
          k.next = null, d === null ? o = H : d.next = H, d = k;
          var V = t.alternate;
          V !== null && (V = V.updateQueue, h = V.lastBaseUpdate, h !== d && (h === null ? V.firstBaseUpdate = H : h.next = H, V.lastBaseUpdate = k));
        }
        if (o !== null) {
          var B = r.baseState;
          d = 0, V = H = k = null, h = o;
          do {
            var Z = h.lane & -536870913, ot = Z !== h.lane;
            if (ot ? (pt & Z) === Z : (l & Z) === Z) {
              Z !== 0 && Z === cl && (Wr = !0), V !== null && (V = V.next = {
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: null,
                next: null
              });
              t: {
                var Pt = t, tn = h;
                Z = e;
                var Xa = a;
                switch (tn.tag) {
                  case 1:
                    if (Pt = tn.payload, typeof Pt == "function") {
                      B = Pt.call(
                        Xa,
                        B,
                        Z
                      );
                      break t;
                    }
                    B = Pt;
                    break t;
                  case 3:
                    Pt.flags = Pt.flags & -65537 | 128;
                  case 0:
                    if (Pt = tn.payload, Z = typeof Pt == "function" ? Pt.call(Xa, B, Z) : Pt, Z == null) break t;
                    B = kr({}, B, Z);
                    break t;
                  case 2:
                    ya = !0;
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
              }, V === null ? (H = V = ot, k = B) : V = V.next = ot, d |= Z;
            if (h = h.next, h === null) {
              if (h = r.shared.pending, h === null)
                break;
              ot = h, h = ot.next, ot.next = null, r.lastBaseUpdate = ot, r.shared.pending = null;
            }
          } while (!0);
          V === null && (k = B), r.baseState = k, r.firstBaseUpdate = H, r.lastBaseUpdate = V, o === null && (r.shared.lanes = 0), wa |= d, t.lanes = d, t.memoizedState = B;
        }
      }
      function es(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function as(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            es(a[t], e);
      }
      function ls(t, e) {
        t = ea, b($n, t), b(hl, e), ea = t | e.baseLanes;
      }
      function Oi() {
        b($n, ea), b(hl, hl.current);
      }
      function Ri() {
        ea = $n.current, T(hl), T($n);
      }
      function ca(t) {
        var e = t.alternate;
        b(Ht, Ht.current & 1), b(be, t), Te === null && (e === null || hl.current !== null || e.memoizedState !== null) && (Te = t);
      }
      function Hi(t) {
        b(Ht, Ht.current), b(be, t), Te === null && (Te = t);
      }
      function ns(t) {
        t.tag === 22 ? (b(Ht, Ht.current), b(be, t), Te === null && (Te = t)) : da();
      }
      function da() {
        b(Ht, Ht.current), b(be, be.current);
      }
      function me(t) {
        T(be), Te === t && (Te = null), T(Ht);
      }
      function yn(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Hr(a) || Ur(a)))
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
      function Mt() {
        throw Error(c(321));
      }
      function Ui(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ve(t[a], e[a])) return !1;
        return !0;
      }
      function Di(t, e, a, l, r, o) {
        return Pe = o, st = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, tt.H = t === null || t.memoizedState === null ? Mc : Fr, Va = !1, o = a(l, r), Va = !1, gl && (o = rs(
          e,
          a,
          l,
          r
        )), is(t), o;
      }
      function is(t) {
        tt.H = Wl;
        var e = St !== null && St.next !== null;
        if (Pe = 0, Dt = St = st = null, Pn = !1, Ll = 0, vl = null, e) throw Error(c(300));
        t === null || qt || (t = t.dependencies, t !== null && un(t) && (qt = !0));
      }
      function rs(t, e, a, l) {
        st = t;
        var r = 0;
        do {
          if (gl && (vl = null), Ll = 0, gl = !1, 25 <= r) throw Error(c(301));
          if (r += 1, Dt = St = null, t.updateQueue != null) {
            var o = t.updateQueue;
            o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
          }
          tt.H = Ac, o = e(a, l);
        } while (gl);
        return o;
      }
      function cm() {
        var t = tt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Ml(e) : e, t = t.useState()[0], (St !== null ? St.memoizedState : null) !== t && (st.flags |= 1024), e;
      }
      function qi() {
        var t = ti !== 0;
        return ti = 0, t;
      }
      function Bi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Yi(t) {
        if (Pn) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          Pn = !1;
        }
        Pe = 0, Dt = St = st = null, gl = !1, Ll = ti = 0, vl = null;
      }
      function ne() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Dt === null ? st.memoizedState = Dt = t : Dt = Dt.next = t, Dt;
      }
      function Rt() {
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
      function xn() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Ml(t) {
        var e = Ll;
        return Ll += 1, vl === null && (vl = []), t = Fo(vl, t, e), e = st, (Dt === null ? e.memoizedState : Dt.next) === null && (e = e.alternate, tt.H = e === null || e.memoizedState === null ? Mc : Fr), t;
      }
      function wn(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Ml(t);
          if (t.$$typeof === pa) return Wt(t);
        }
        throw Error(c(438, String(t)));
      }
      function Gi(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = xn(), st.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = Hm;
        return e.index++, a;
      }
      function Xe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function _n(t) {
        var e = Rt();
        return Qi(e, St, t);
      }
      function Qi(t, e, a) {
        var l = t.queue;
        if (l === null) throw Error(c(311));
        l.lastRenderedReducer = a;
        var r = t.baseQueue, o = l.pending;
        if (o !== null) {
          if (r !== null) {
            var d = r.next;
            r.next = o.next, o.next = d;
          }
          e.baseQueue = r = o, l.pending = null;
        }
        if (o = t.baseState, r === null) t.memoizedState = o;
        else {
          e = r.next;
          var h = d = null, k = null, H = e, V = !1;
          do {
            var B = H.lane & -536870913;
            if (B !== H.lane ? (pt & B) === B : (Pe & B) === B) {
              var Z = H.revertLane;
              if (Z === 0)
                k !== null && (k = k.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: H.action,
                  hasEagerState: H.hasEagerState,
                  eagerState: H.eagerState,
                  next: null
                }), B === cl && (V = !0);
              else if ((Pe & Z) === Z) {
                H = H.next, Z === cl && (V = !0);
                continue;
              } else
                B = {
                  lane: 0,
                  revertLane: H.revertLane,
                  gesture: null,
                  action: H.action,
                  hasEagerState: H.hasEagerState,
                  eagerState: H.eagerState,
                  next: null
                }, k === null ? (h = k = B, d = o) : k = k.next = B, st.lanes |= Z, wa |= Z;
              B = H.action, Va && a(o, B), o = H.hasEagerState ? H.eagerState : a(o, B);
            } else
              Z = {
                lane: B,
                revertLane: H.revertLane,
                gesture: H.gesture,
                action: H.action,
                hasEagerState: H.hasEagerState,
                eagerState: H.eagerState,
                next: null
              }, k === null ? (h = k = Z, d = o) : k = k.next = Z, st.lanes |= B, wa |= B;
            H = H.next;
          } while (H !== null && H !== e);
          if (k === null ? d = o : k.next = h, !ve(o, t.memoizedState) && (qt = !0, V && (a = dl, a !== null)))
            throw a;
          t.memoizedState = o, t.baseState = d, t.baseQueue = k, l.lastRenderedState = o;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function Vi(t) {
        var e = Rt(), a = e.queue;
        if (a === null) throw Error(c(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, o = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var d = r = r.next;
          do
            o = t(o, d.action), d = d.next;
          while (d !== r);
          ve(o, e.memoizedState) || (qt = !0), e.memoizedState = o, e.baseQueue === null && (e.baseState = o), a.lastRenderedState = o;
        }
        return [o, l];
      }
      function os(t, e, a) {
        var l = st, r = Rt(), o = ht;
        if (o) {
          if (a === void 0)
            throw Error(c(407));
          a = a();
        } else a = e();
        var d = !ve(
          (St || r).memoizedState,
          a
        );
        if (d && (r.memoizedState = a, qt = !0), r = r.queue, Zi(cs.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || d || Dt !== null && Dt.memoizedState.tag & 1) {
          if (l.flags |= 2048, Ia(
            9,
            { destroy: void 0 },
            us.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), zt === null) throw Error(c(349));
          o || (Pe & 127) !== 0 || ss(l, e, a);
        }
        return a;
      }
      function ss(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = st.updateQueue, e === null ? (e = xn(), st.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function us(t, e, a, l) {
        e.value = a, e.getSnapshot = l, ds(e) && ms(t);
      }
      function cs(t, e, a) {
        return a(function() {
          ds(e) && ms(t);
        });
      }
      function ds(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ve(t, a);
        } catch {
          return !0;
        }
      }
      function ms(t) {
        var e = Ma(t, 2);
        e !== null && re(e, t, 2);
      }
      function Ki(t) {
        var e = ne();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Va) {
            Ot(!0);
            try {
              a();
            } finally {
              Ot(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Xe,
          lastRenderedState: t
        }, e;
      }
      function fs(t, e, a, l) {
        return t.baseState = a, Qi(
          t,
          St,
          typeof l == "function" ? l : Xe
        );
      }
      function dm(t, e, a, l, r) {
        if (En(t)) throw Error(c(485));
        if (t = e.action, t !== null) {
          var o = {
            payload: r,
            action: t,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(d) {
              o.listeners.push(d);
            }
          };
          tt.T !== null ? a(!0) : o.isTransition = !1, l(o), a = e.pending, a === null ? (o.next = e.pending = o, ps(e, o)) : (o.next = a.next, e.pending = a.next = o);
        }
      }
      function ps(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var o = tt.T, d = {};
          tt.T = d;
          try {
            var h = a(r, l), k = tt.S;
            k !== null && k(d, h), hs(t, e, h);
          } catch (H) {
            Xi(t, e, H);
          } finally {
            o !== null && d.types !== null && (o.types = d.types), tt.T = o;
          }
        } else
          try {
            o = a(r, l), hs(t, e, o);
          } catch (H) {
            Xi(t, e, H);
          }
      }
      function hs(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            gs(t, e, l);
          },
          function(l) {
            return Xi(t, e, l);
          }
        ) : gs(t, e, a);
      }
      function gs(t, e, a) {
        e.status = "fulfilled", e.value = a, vs(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ps(t, a)));
      }
      function Xi(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, vs(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function vs(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function bs(t, e) {
        return e;
      }
      function ys(t, e) {
        if (ht) {
          var a = zt.formState;
          if (a !== null) {
            t: {
              var l = st;
              if (ht) {
                if (Tt) {
                  var r = Cf(
                    Tt,
                    ke
                  );
                  if (r) {
                    Tt = fc(r), l = jf(r);
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
        a = ne(), a.memoizedState = a.baseState = e, l = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: bs,
          lastRenderedState: e
        }, a.queue = l, a = Ds.bind(
          null,
          st,
          l
        ), l.dispatch = a, l = Ki(!1);
        var o = Fi.bind(
          null,
          st,
          !1,
          l.queue
        );
        return l = ne(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = dm.bind(
          null,
          st,
          r,
          o,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function xs(t) {
        var e = Rt();
        return ws(e, St, t);
      }
      function ws(t, e, a) {
        if (e = Qi(
          t,
          e,
          bs
        )[0], t = _n(Xe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Ml(e);
          } catch (d) {
            throw d === ml ? Fn : d;
          }
        else l = e;
        e = Rt();
        var r = e.queue, o = r.dispatch;
        return a !== e.memoizedState && (st.flags |= 2048, Ia(
          9,
          { destroy: void 0 },
          mm.bind(null, r, a),
          null
        )), [l, o, t];
      }
      function mm(t, e) {
        t.action = e;
      }
      function _s(t) {
        var e = Rt(), a = St;
        if (a !== null)
          return ws(e, a, t);
        Rt(), e = e.memoizedState, a = Rt();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function Ia(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = st.updateQueue, e === null && (e = xn(), st.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function Ss() {
        return Rt().memoizedState;
      }
      function Sn(t, e, a, l) {
        var r = ne();
        st.flags |= t, r.memoizedState = Ia(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function zn(t, e, a, l) {
        var r = Rt();
        l = l === void 0 ? null : l;
        var o = r.memoizedState.inst;
        St !== null && l !== null && Ui(l, St.memoizedState.deps) ? r.memoizedState = Ia(e, o, a, l) : (st.flags |= t, r.memoizedState = Ia(
          1 | e,
          o,
          a,
          l
        ));
      }
      function zs(t, e) {
        Sn(8390656, 8, t, e);
      }
      function Zi(t, e) {
        zn(2048, 8, t, e);
      }
      function fm(t) {
        st.flags |= 4;
        var e = st.updateQueue;
        if (e === null)
          e = xn(), st.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Es(t) {
        var e = Rt().memoizedState;
        return fm({ ref: e, nextImpl: t }), function() {
          if ((mt & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function ks(t, e) {
        return zn(4, 2, t, e);
      }
      function Ns(t, e) {
        return zn(4, 4, t, e);
      }
      function Ts(t, e) {
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
      function Cs(t, e, a) {
        a = a != null ? a.concat([t]) : null, zn(
          4,
          4,
          Ts.bind(null, e, t),
          a
        );
      }
      function Ji() {
      }
      function js(t, e) {
        var a = Rt();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Ui(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Ms(t, e) {
        var a = Rt();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Ui(e, l[1]))
          return l[0];
        if (l = t(), Va) {
          Ot(!0);
          try {
            t();
          } finally {
            Ot(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function Li(t, e, a) {
        return a === void 0 || (Pe & 1073741824) !== 0 && (pt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Nu(), st.lanes |= t, wa |= t, a);
      }
      function As(t, e, a, l) {
        return ve(a, e) ? a : hl.current !== null ? (t = Li(t, a, l), ve(t, e) || (qt = !0), t) : (Pe & 42) === 0 || (Pe & 1073741824) !== 0 && (pt & 261930) === 0 ? (qt = !0, t.memoizedState = a) : (t = Nu(), st.lanes |= t, wa |= t, e);
      }
      function Os(t, e, a, l, r) {
        var o = Ie();
        Xt(
          o !== 0 && 8 > o ? o : 8
        );
        var d = tt.T, h = {};
        tt.T = h, Fi(t, !1, e, a);
        try {
          var k = r(), H = tt.S;
          if (H !== null && H(h, k), k !== null && typeof k == "object" && typeof k.then == "function") {
            var V = um(
              k,
              l
            );
            Al(
              t,
              e,
              V,
              fe(t)
            );
          } else
            Al(
              t,
              e,
              l,
              fe(t)
            );
        } catch (B) {
          Al(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: B },
            fe()
          );
        } finally {
          Xt(o), d !== null && h.types !== null && (d.types = h.types), tt.T = d;
        }
      }
      function Rs(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: ll,
          baseState: ll,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Xe,
            lastRenderedState: ll
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
            lastRenderedReducer: Xe,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Wi() {
        return Wt(Da);
      }
      function Hs() {
        return Rt().memoizedState;
      }
      function Us() {
        return Rt().memoizedState;
      }
      function pm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = fe();
              t = sa(a);
              var l = ua(e, t, a);
              l !== null && (re(l, e, a), Tl(l, e, a)), e = { cache: ki() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function hm(t, e, a) {
        var l = fe();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, En(t) ? qs(e, a) : (a = Ci(t, e, a, l), a !== null && (re(a, t, l), Bs(a, e, l)));
      }
      function Ds(t, e, a) {
        var l = fe();
        Al(t, e, a, l);
      }
      function Al(t, e, a, l) {
        var r = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (En(t)) qs(e, r);
        else {
          var o = t.alternate;
          if (t.lanes === 0 && (o === null || o.lanes === 0) && (o = e.lastRenderedReducer, o !== null))
            try {
              var d = e.lastRenderedState, h = o(d, a);
              if (r.hasEagerState = !0, r.eagerState = h, ve(h, d))
                return vn(t, e, r, 0), zt === null && gn(), !1;
            } catch {
            } finally {
            }
          if (a = Ci(t, e, r, l), a !== null)
            return re(a, t, l), Bs(a, e, l), !0;
        }
        return !1;
      }
      function Fi(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: Ni(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, En(t)) {
          if (e) throw Error(c(479));
        } else
          e = Ci(
            t,
            a,
            l,
            2
          ), e !== null && re(e, t, 2);
      }
      function En(t) {
        var e = t.alternate;
        return t === st || e !== null && e === st;
      }
      function qs(t, e) {
        gl = Pn = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Bs(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function Ii(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : kr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Ys(t, e, a, l, r, o, d) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, o, d) : e.prototype && e.prototype.isPureReactComponent ? !fn(a, l) || !fn(r, o) : !0;
      }
      function Gs(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && Ir.enqueueReplaceState(e, e.state, null);
      }
      function Aa(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = kr({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function kn(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (l) {
          setTimeout(function() {
            throw l;
          });
        }
      }
      function Qs(t, e, a) {
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
      function $i(t, e, a) {
        return a = sa(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          kn(t, e);
        }, a;
      }
      function Vs(t) {
        return t = sa(t), t.tag = 3, t;
      }
      function Ks(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var o = l.value;
          t.payload = function() {
            return r(o);
          }, t.callback = function() {
            Qs(e, a, l);
          };
        }
        var d = a.stateNode;
        d !== null && typeof d.componentDidCatch == "function" && (t.callback = function() {
          Qs(e, a, l), typeof r != "function" && (_a === null ? _a = /* @__PURE__ */ new Set([this]) : _a.add(this));
          var h = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: h !== null ? h : ""
          });
        });
      }
      function gm(t, e, a, l, r) {
        if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          if (e = a.alternate, e !== null && Wa(
            e,
            a,
            r,
            !0
          ), a = be.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Te === null ? Hn() : a.alternate === null && At === 0 && (At = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === In ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), wr(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === In ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), wr(t, l, r)), !1;
            }
            throw Error(c(435, a.tag));
          }
          return wr(t, l, r), Hn(), !1;
        }
        if (ht)
          return e = be.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== Vr && (t = Error(c(422), { cause: l }), El(
            it(t, a)
          ))) : (l !== Vr && (e = Error(c(423), {
            cause: l
          }), El(
            it(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = it(l, a), r = $i(
            t.stateNode,
            l,
            r
          ), Ai(t, r), At !== 4 && (At = 2)), !1;
        var o = Error(c(520), { cause: l });
        if (o = it(o, a), Il === null ? Il = [o] : Il.push(o), At !== 4 && (At = 2), e === null) return !0;
        l = it(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = $i(a.stateNode, l, t), Ai(a, t), !1;
            case 1:
              if (e = a.type, o = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (_a === null || !_a.has(
                o
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = Vs(r), Ks(
                  r,
                  t,
                  a,
                  l
                ), Ai(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function Ft(t, e, a, l) {
        e.child = t === null ? jc(e, null, a, l) : Qa(
          e,
          t.child,
          a,
          l
        );
      }
      function Xs(t, e, a, l, r) {
        a = a.render;
        var o = e.ref;
        if ("ref" in l) {
          var d = {};
          for (var h in l)
            h !== "ref" && (d[h] = l[h]);
        } else d = l;
        return Ca(e), l = Di(
          t,
          e,
          a,
          d,
          o,
          r
        ), h = qi(), t !== null && !qt ? (Bi(t, e, r), Ze(t, e, r)) : (ht && h && D(e), e.flags |= 1, Ft(t, e, l, r), e.child);
      }
      function Zs(t, e, a, l, r) {
        if (t === null) {
          var o = a.type;
          return typeof o == "function" && !_r(o) && o.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = o, Js(
            t,
            e,
            o,
            l,
            r
          )) : (t = Dn(
            a.type,
            null,
            l,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (o = t.child, !ir(t, r)) {
          var d = o.memoizedProps;
          if (a = a.compare, a = a !== null ? a : fn, a(d, l) && t.ref === e.ref)
            return Ze(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = We(o, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Js(t, e, a, l, r) {
        if (t !== null) {
          var o = t.memoizedProps;
          if (fn(o, l) && t.ref === e.ref)
            if (qt = !1, e.pendingProps = l = o, ir(t, r))
              (t.flags & 131072) !== 0 && (qt = !0);
            else
              return e.lanes = t.lanes, Ze(t, e, r);
        }
        return Pi(
          t,
          e,
          a,
          l,
          r
        );
      }
      function Ls(t, e, a, l) {
        var r = l.children, o = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), l.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (o = o !== null ? o.baseLanes | a : a, t !== null) {
              for (l = e.child = t.child, r = 0; l !== null; )
                r = r | l.lanes | l.childLanes, l = l.sibling;
              l = r & ~o;
            } else l = 0, e.child = null;
            return Ws(
              t,
              e,
              o,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && mn(
              e,
              o !== null ? o.cachePool : null
            ), o !== null ? ls(e, o) : Oi(), ns(e);
          else
            return l = e.lanes = 536870912, Ws(
              t,
              e,
              o !== null ? o.baseLanes | a : a,
              a,
              l
            );
        } else
          o !== null ? (mn(e, o.cachePool), ls(e, o), da(), e.memoizedState = null) : (t !== null && mn(e, null), Oi(), da());
        return Ft(t, e, r, a), e.child;
      }
      function Ol(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Ws(t, e, a, l, r) {
        var o = Ti();
        return o = o === null ? null : {
          parent: Fe ? Ct._currentValue : Ct._currentValue2,
          pool: o
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: o
        }, t !== null && mn(e, null), Oi(), ns(e), t !== null && Wa(t, e, l, !0), e.childLanes = r, null;
      }
      function Nn(t, e) {
        return e = Cn(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Fs(t, e, a) {
        return Qa(e, t.child, null, a), t = Nn(
          e,
          e.pendingProps
        ), t.flags |= 2, me(e), e.memoizedState = null, t;
      }
      function vm(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (ht) {
            if (l.mode === "hidden")
              return t = Nn(e, l), e.lanes = 536870912, Ol(null, t);
            if (Hi(e), (t = Tt) ? (t = Bf(
              t,
              ke
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: ga !== null ? { id: Ye, overflow: Ge } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Ju(t), a.return = e, e.child = a, $t = e, Tt = null)) : t = null, t === null) throw rt(e);
            return e.lanes = 536870912, null;
          }
          return Nn(e, l);
        }
        var o = t.memoizedState;
        if (o !== null) {
          var d = o.dehydrated;
          if (Hi(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = Fs(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (qt || Wa(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, qt || r) {
            if (l = zt, l !== null && (d = ct(l, a), d !== 0 && d !== o.retryLane))
              throw o.retryLane = d, Ma(t, d), re(l, t, d), $r;
            Hn(), e = Fs(
              t,
              e,
              a
            );
          } else
            t = o.treeContext, le && (Tt = Rf(d), $t = e, ht = !0, ba = null, ke = !1, t !== null && W(e, t)), e = Nn(e, l), e.flags |= 4096;
          return e;
        }
        return t = We(t.child, {
          mode: l.mode,
          children: l.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Tn(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(c(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Pi(t, e, a, l, r) {
        return Ca(e), a = Di(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = qi(), t !== null && !qt ? (Bi(t, e, r), Ze(t, e, r)) : (ht && l && D(e), e.flags |= 1, Ft(t, e, a, r), e.child);
      }
      function Is(t, e, a, l, r, o) {
        return Ca(e), e.updateQueue = null, a = rs(
          e,
          l,
          a,
          r
        ), is(t), l = qi(), t !== null && !qt ? (Bi(t, e, o), Ze(t, e, o)) : (ht && l && D(e), e.flags |= 1, Ft(t, e, a, o), e.child);
      }
      function $s(t, e, a, l, r) {
        if (Ca(e), e.stateNode === null) {
          var o = rl, d = a.contextType;
          typeof d == "object" && d !== null && (o = Wt(d)), o = new a(l, o), e.memoizedState = o.state !== null && o.state !== void 0 ? o.state : null, o.updater = Ir, e.stateNode = o, o._reactInternals = e, o = e.stateNode, o.props = l, o.state = e.memoizedState, o.refs = {}, ji(e), d = a.contextType, o.context = typeof d == "object" && d !== null ? Wt(d) : rl, o.state = e.memoizedState, d = a.getDerivedStateFromProps, typeof d == "function" && (Ii(
            e,
            a,
            d,
            l
          ), o.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof o.getSnapshotBeforeUpdate == "function" || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (d = o.state, typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount(), d !== o.state && Ir.enqueueReplaceState(
            o,
            o.state,
            null
          ), jl(e, l, o, r), Cl(), o.state = e.memoizedState), typeof o.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          o = e.stateNode;
          var h = e.memoizedProps, k = Aa(a, h);
          o.props = k;
          var H = o.context, V = a.contextType;
          d = rl, typeof V == "object" && V !== null && (d = Wt(V));
          var B = a.getDerivedStateFromProps;
          V = typeof B == "function" || typeof o.getSnapshotBeforeUpdate == "function", h = e.pendingProps !== h, V || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (h || H !== d) && Gs(
            e,
            o,
            l,
            d
          ), ya = !1;
          var Z = e.memoizedState;
          o.state = Z, jl(e, l, o, r), Cl(), H = e.memoizedState, h || Z !== H || ya ? (typeof B == "function" && (Ii(
            e,
            a,
            B,
            l
          ), H = e.memoizedState), (k = ya || Ys(
            e,
            a,
            k,
            l,
            Z,
            H,
            d
          )) ? (V || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = H), o.props = l, o.state = H, o.context = d, l = k) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          o = e.stateNode, Mi(t, e), d = e.memoizedProps, V = Aa(a, d), o.props = V, B = e.pendingProps, Z = o.context, H = a.contextType, k = rl, typeof H == "object" && H !== null && (k = Wt(H)), h = a.getDerivedStateFromProps, (H = typeof h == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (d !== B || Z !== k) && Gs(
            e,
            o,
            l,
            k
          ), ya = !1, Z = e.memoizedState, o.state = Z, jl(e, l, o, r), Cl();
          var ot = e.memoizedState;
          d !== B || Z !== ot || ya || t !== null && t.dependencies !== null && un(t.dependencies) ? (typeof h == "function" && (Ii(
            e,
            a,
            h,
            l
          ), ot = e.memoizedState), (V = ya || Ys(
            e,
            a,
            V,
            l,
            Z,
            ot,
            k
          ) || t !== null && t.dependencies !== null && un(t.dependencies)) ? (H || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(l, ot, k), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(
            l,
            ot,
            k
          )), typeof o.componentDidUpdate == "function" && (e.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = ot), o.props = l, o.state = ot, o.context = k, l = V) : (typeof o.componentDidUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return o = l, Tn(t, e), l = (e.flags & 128) !== 0, o || l ? (o = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : o.render(), e.flags |= 1, t !== null && l ? (e.child = Qa(
          e,
          t.child,
          null,
          r
        ), e.child = Qa(
          e,
          null,
          a,
          r
        )) : Ft(t, e, a, r), e.memoizedState = o.state, t = e.child) : t = Ze(
          t,
          e,
          r
        ), t;
      }
      function Ps(t, e, a, l) {
        return je(), e.flags |= 256, Ft(t, e, a, l), e.child;
      }
      function tr(t) {
        return { baseLanes: t, cachePool: Lo() };
      }
      function er(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= xe), t;
      }
      function tu(t, e, a) {
        var l = e.pendingProps, r = !1, o = (e.flags & 128) !== 0, d;
        if ((d = o) || (d = t !== null && t.memoizedState === null ? !1 : (Ht.current & 2) !== 0), d && (r = !0, e.flags &= -129), d = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (ht) {
            if (r ? ca(e) : da(), (t = Tt) ? (t = Yf(
              t,
              ke
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: ga !== null ? { id: Ye, overflow: Ge } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Ju(t), a.return = e, e.child = a, $t = e, Tt = null)) : t = null, t === null) throw rt(e);
            return Ur(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var h = l.children;
          return l = l.fallback, r ? (da(), r = e.mode, h = Cn(
            { mode: "hidden", children: h },
            r
          ), l = Ha(
            l,
            r,
            a,
            null
          ), h.return = e, l.return = e, h.sibling = l, e.child = h, l = e.child, l.memoizedState = tr(a), l.childLanes = er(
            t,
            d,
            a
          ), e.memoizedState = Pr, Ol(null, l)) : (ca(e), ar(e, h));
        }
        var k = t.memoizedState;
        if (k !== null && (h = k.dehydrated, h !== null)) {
          if (o)
            e.flags & 256 ? (ca(e), e.flags &= -257, e = lr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (da(), e.child = t.child, e.flags |= 128, e = null) : (da(), h = l.fallback, r = e.mode, l = Cn(
              { mode: "visible", children: l.children },
              r
            ), h = Ha(
              h,
              r,
              a,
              null
            ), h.flags |= 2, l.return = e, h.return = e, l.sibling = h, e.child = l, Qa(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = tr(a), l.childLanes = er(
              t,
              d,
              a
            ), e.memoizedState = Pr, e = Ol(null, l));
          else if (ca(e), Ur(h))
            d = Nf(h).digest, l = Error(c(419)), l.stack = "", l.digest = d, El({ value: l, source: null, stack: null }), e = lr(
              t,
              e,
              a
            );
          else if (qt || Wa(
            t,
            e,
            a,
            !1
          ), d = (a & t.childLanes) !== 0, qt || d) {
            if (d = zt, d !== null && (l = ct(
              d,
              a
            ), l !== 0 && l !== k.retryLane))
              throw k.retryLane = l, Ma(t, l), re(d, t, l), $r;
            Hr(h) || Hn(), e = lr(
              t,
              e,
              a
            );
          } else
            Hr(h) ? (e.flags |= 192, e.child = t.child, e = null) : (t = k.treeContext, le && (Tt = Hf(
              h
            ), $t = e, ht = !0, ba = null, ke = !1, t !== null && W(e, t)), e = ar(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (da(), h = l.fallback, r = e.mode, k = t.child, o = k.sibling, l = We(k, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = k.subtreeFlags & 65011712, o !== null ? h = We(
          o,
          h
        ) : (h = Ha(
          h,
          r,
          a,
          null
        ), h.flags |= 2), h.return = e, l.return = e, l.sibling = h, e.child = l, Ol(null, l), l = e.child, h = t.child.memoizedState, h === null ? h = tr(a) : (r = h.cachePool, r !== null ? (k = Fe ? Ct._currentValue : Ct._currentValue2, r = r.parent !== k ? { parent: k, pool: k } : r) : r = Lo(), h = {
          baseLanes: h.baseLanes | a,
          cachePool: r
        }), l.memoizedState = h, l.childLanes = er(
          t,
          d,
          a
        ), e.memoizedState = Pr, Ol(t.child, l)) : (ca(e), a = t.child, t = a.sibling, a = We(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (d = e.deletions, d === null ? (e.deletions = [t], e.flags |= 16) : d.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function ar(t, e) {
        return e = Cn(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Cn(t, e) {
        return t = s(22, t, null, e), t.lanes = 0, t;
      }
      function lr(t, e, a) {
        return Qa(e, t.child, null, a), t = ar(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function eu(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), zi(t.return, e, a);
      }
      function nr(t, e, a, l, r, o) {
        var d = t.memoizedState;
        d === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: r,
          treeForkCount: o
        } : (d.isBackwards = e, d.rendering = null, d.renderingStartTime = 0, d.last = l, d.tail = a, d.tailMode = r, d.treeForkCount = o);
      }
      function au(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, o = l.tail;
        l = l.children;
        var d = Ht.current, h = (d & 2) !== 0;
        if (h ? (d = d & 1 | 2, e.flags |= 128) : d &= 1, b(Ht, d), Ft(t, e, l, a), l = ht ? Kl : 0, !h && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && eu(t, a, e);
            else if (t.tag === 19)
              eu(t, a, e);
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
              t = a.alternate, t !== null && yn(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), nr(
              e,
              !1,
              r,
              a,
              o,
              l
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && yn(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            nr(
              e,
              !0,
              a,
              null,
              o,
              l
            );
            break;
          case "together":
            nr(
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
      function Ze(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), wa |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (Wa(
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
          for (t = e.child, a = We(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = We(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function ir(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && un(t)));
      }
      function bm(t, e, a) {
        switch (e.tag) {
          case 3:
            F(
              e,
              e.stateNode.containerInfo
            ), oa(e, Ct, t.memoizedState.cache), je();
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
            oa(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, Hi(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (ca(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? tu(
                t,
                e,
                a
              ) : (ca(e), t = Ze(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            ca(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (l = (a & e.childLanes) !== 0, l || (Wa(
              t,
              e,
              a,
              !1
            ), l = (a & e.childLanes) !== 0), r) {
              if (l)
                return au(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), b(Ht, Ht.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, Ls(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            oa(e, Ct, t.memoizedState.cache);
        }
        return Ze(t, e, a);
      }
      function lu(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            qt = !0;
          else {
            if (!ir(t, a) && (e.flags & 128) === 0)
              return qt = !1, bm(
                t,
                e,
                a
              );
            qt = (t.flags & 131072) !== 0;
          }
        else
          qt = !1, ht && (e.flags & 1048576) !== 0 && v(e, Kl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = ja(e.elementType), e.type = t, typeof t == "function")
                _r(t) ? (l = Aa(t, l), e.tag = 1, e = $s(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = Pi(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Tr) {
                    e.tag = 11, e = Xs(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Mr) {
                    e.tag = 14, e = Zs(
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
            return Pi(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return l = e.type, r = Aa(
              l,
              e.pendingProps
            ), $s(
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
              var o = e.pendingProps;
              r = e.memoizedState, l = r.element, Mi(t, e), jl(e, o, null, a);
              var d = e.memoizedState;
              if (o = d.cache, oa(e, Ct, o), o !== r.cache && Ei(
                e,
                [Ct],
                a,
                !0
              ), Cl(), o = d.element, le && r.isDehydrated)
                if (r = {
                  element: o,
                  isDehydrated: !1,
                  cache: d.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = Ps(
                    t,
                    e,
                    o,
                    a
                  );
                  break t;
                } else if (o !== l) {
                  l = it(
                    Error(c(424)),
                    e
                  ), El(l), e = Ps(
                    t,
                    e,
                    o,
                    a
                  );
                  break t;
                } else
                  for (le && (Tt = Of(
                    e.stateNode.containerInfo
                  ), $t = e, ht = !0, ba = null, ke = !0), a = jc(
                    e,
                    null,
                    o,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (je(), o === l) {
                  e = Ze(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                Ft(t, e, o, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Re)
              return Tn(t, e), t === null ? (a = gc(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : ht || (e.stateNode = rp(
                e.type,
                e.pendingProps,
                va.current,
                e
              )) : e.memoizedState = gc(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Gt)
              return gt(e), t === null && Gt && ht && (l = e.stateNode = _c(
                e.type,
                e.pendingProps,
                va.current,
                It.current,
                !1
              ), $t = e, ke = !0, Tt = Uf(
                e.type,
                l,
                Tt
              )), Ft(
                t,
                e,
                e.pendingProps.children,
                a
              ), Tn(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && ht && (lp(
              e.type,
              e.pendingProps,
              It.current
            ), (r = l = Tt) && (l = Df(
              l,
              e.type,
              e.pendingProps,
              ke
            ), l !== null ? (e.stateNode = l, $t = e, Tt = Af(l), ke = !1, r = !0) : r = !1), r || rt(e)), gt(e), r = e.type, o = e.pendingProps, d = t !== null ? t.memoizedProps : null, l = o.children, Yn(r, o) ? l = null : d !== null && Yn(r, d) && (e.flags |= 32), e.memoizedState !== null && (r = Di(
              t,
              e,
              cm,
              null,
              null,
              a
            ), Fe ? Da._currentValue = r : Da._currentValue2 = r), Tn(t, e), Ft(t, e, l, a), e.child;
          case 6:
            return t === null && ht && (np(
              e.pendingProps,
              It.current
            ), (t = a = Tt) && (a = qf(
              a,
              e.pendingProps,
              ke
            ), a !== null ? (e.stateNode = a, $t = e, Tt = null, t = !0) : t = !1), t || rt(e)), null;
          case 13:
            return tu(t, e, a);
          case 4:
            return F(
              e,
              e.stateNode.containerInfo
            ), l = e.pendingProps, t === null ? e.child = Qa(
              e,
              null,
              l,
              a
            ) : Ft(t, e, l, a), e.child;
          case 11:
            return Xs(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return Ft(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return Ft(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return Ft(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return l = e.pendingProps, oa(e, e.type, l.value), Ft(
              t,
              e,
              l.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, l = e.pendingProps.children, Ca(e), r = Wt(r), l = l(r), e.flags |= 1, Ft(t, e, l, a), e.child;
          case 14:
            return Zs(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Js(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return au(
              t,
              e,
              a
            );
          case 31:
            return vm(t, e, a);
          case 22:
            return Ls(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ca(e), l = Wt(Ct), t === null ? (r = Ti(), r === null && (r = zt, o = ki(), r.pooledCache = o, o.refCount++, o !== null && (r.pooledCacheLanes |= a), r = o), e.memoizedState = {
              parent: l,
              cache: r
            }, ji(e), oa(e, Ct, r)) : ((t.lanes & a) !== 0 && (Mi(t, e), jl(e, null, null, a), Cl()), r = t.memoizedState, o = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), oa(e, Ct, l)) : (l = o.cache, oa(e, Ct, l), l !== r.cache && Ei(
              e,
              [Ct],
              a,
              !0
            ))), Ft(
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
      function Me(t) {
        t.flags |= 4;
      }
      function jn(t) {
        Be && (t.flags |= 8);
      }
      function nu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function rr(t, e, a, l) {
        if (ae)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Or(t, a.stateNode);
            else if (!(a.tag === 4 || Gt && a.tag === 27) && a.child !== null) {
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
        else if (Be)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var o = r.stateNode;
              a && l && (o = dc(
                o,
                r.type,
                r.memoizedProps
              )), Or(t, o);
            } else if (r.tag === 6)
              o = r.stateNode, a && l && (o = mc(
                o,
                r.memoizedProps
              )), Or(t, o);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                o = r.child, o !== null && (o.return = r), rr(t, r, !0, !0);
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
      function iu(t, e, a, l) {
        var r = !1;
        if (Be)
          for (var o = e.child; o !== null; ) {
            if (o.tag === 5) {
              var d = o.stateNode;
              a && l && (d = dc(
                d,
                o.type,
                o.memoizedProps
              )), uc(t, d);
            } else if (o.tag === 6)
              d = o.stateNode, a && l && (d = mc(
                d,
                o.memoizedProps
              )), uc(t, d);
            else if (o.tag !== 4) {
              if (o.tag === 22 && o.memoizedState !== null)
                r = o.child, r !== null && (r.return = o), iu(t, o, !0, !0), r = !0;
              else if (o.child !== null) {
                o.child.return = o, o = o.child;
                continue;
              }
            }
            if (o === e) break;
            for (; o.sibling === null; ) {
              if (o.return === null || o.return === e)
                return r;
              o = o.return;
            }
            o.sibling.return = o.return, o = o.sibling;
          }
        return r;
      }
      function ru(t, e) {
        if (Be && nu(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = sc();
          iu(l, e, !1, !1), t.pendingChildren = l, Me(e), kf(a, l);
        }
      }
      function or(t, e, a, l) {
        if (ae)
          t.memoizedProps !== l && Me(e);
        else if (Be) {
          var r = t.stateNode, o = t.memoizedProps;
          if ((t = nu(t, e)) || o !== l) {
            var d = It.current;
            o = Ef(
              r,
              a,
              o,
              l,
              !t,
              null
            ), o === r ? e.stateNode = r : (jn(e), lc(
              o,
              a,
              l,
              d
            ) && Me(e), e.stateNode = o, t && rr(o, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function sr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Im(e, l) : $m(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Rr(e, l))
            if (ic(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Au()) t.flags |= 8192;
            else
              throw Ga = In, Jr;
        } else t.flags &= -16777217;
      }
      function ou(t, e) {
        if (sp(e)) {
          if (t.flags |= 16777216, !wc(e))
            if (Au()) t.flags |= 8192;
            else
              throw Ga = In, Jr;
        } else t.flags &= -16777217;
      }
      function Mn(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? O() : 536870912, t.lanes |= e, xl |= e);
      }
      function Rl(t, e) {
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
      function kt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, l = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= l, t.childLanes = a, e;
      }
      function ym(t, e, a) {
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
            return kt(e), null;
          case 1:
            return kt(e), null;
          case 3:
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Ke(Ct), P(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ce(e) ? Me(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ra())), ru(t, e), kt(e), null;
          case 26:
            if (Re) {
              var r = e.type, o = e.memoizedState;
              return t === null ? (Me(e), o !== null ? (kt(e), ou(
                e,
                o
              )) : (kt(e), sr(
                e,
                r,
                null,
                l,
                a
              ))) : o ? o !== t.memoizedState ? (Me(e), kt(e), ou(
                e,
                o
              )) : (kt(e), e.flags &= -16777217) : (o = t.memoizedProps, ae ? o !== l && Me(e) : or(
                t,
                e,
                r,
                l
              ), kt(e), sr(
                e,
                r,
                o,
                l,
                a
              )), null;
            }
          case 27:
            if (Gt) {
              if (Kt(e), a = va.current, r = e.type, t !== null && e.stateNode != null)
                ae ? t.memoizedProps !== l && Me(e) : or(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return kt(e), null;
                }
                t = It.current, Ce(e) ? Na(e, t) : (t = _c(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Me(e));
              }
              return kt(e), null;
            }
          case 5:
            if (Kt(e), r = e.type, t !== null && e.stateNode != null)
              or(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return kt(e), null;
              }
              if (o = It.current, Ce(e))
                Na(e, o), If(
                  e.stateNode,
                  r,
                  l,
                  o
                ) && (e.flags |= 64);
              else {
                var d = Vm(
                  r,
                  l,
                  va.current,
                  o,
                  e
                );
                jn(e), rr(d, e, !1, !1), e.stateNode = d, lc(
                  d,
                  r,
                  l,
                  o
                ) && Me(e);
              }
            }
            return kt(e), sr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ae ? a !== l && Me(e) : Be && (a !== l ? (t = va.current, a = It.current, jn(e), e.stateNode = nc(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = va.current, a = It.current, Ce(e)) {
                if (!le) throw Error(c(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = $t, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                Qf(
                  t,
                  a,
                  e,
                  l
                ) || rt(e, !0);
              } else
                jn(e), e.stateNode = nc(
                  l,
                  t,
                  a,
                  e
                );
            }
            return kt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = Ce(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(c(318));
                  if (!le) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  Vf(t, e);
                } else
                  je(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                kt(e), t = !1;
              } else
                a = ra(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (me(e), e) : (me(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return kt(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ce(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!le) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  Kf(r, e);
                } else
                  je(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                kt(e), r = !1;
              } else
                r = ra(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (me(e), e) : (me(e), null);
            }
            return me(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), o = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (o = l.memoizedState.cachePool.pool), o !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Mn(e, e.updateQueue), kt(e), null);
          case 4:
            return P(), ru(t, e), t === null && Jm(e.stateNode.containerInfo), kt(e), null;
          case 10:
            return Ke(e.type), kt(e), null;
          case 19:
            if (T(Ht), l = e.memoizedState, l === null) return kt(e), null;
            if (r = (e.flags & 128) !== 0, o = l.rendering, o === null)
              if (r) Rl(l, !1);
              else {
                if (At !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (o = yn(t), o !== null) {
                      for (e.flags |= 128, Rl(l, !1), t = o.updateQueue, e.updateQueue = t, Mn(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Zu(a, t), a = a.sibling;
                      return b(
                        Ht,
                        Ht.current & 1 | 2
                      ), ht && Q(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && oe() > $l && (e.flags |= 128, r = !0, Rl(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = yn(o), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Mn(e, t), Rl(l, !0), l.tail === null && l.tailMode === "hidden" && !o.alternate && !ht)
                    return kt(e), null;
                } else
                  2 * oe() - l.renderingStartTime > $l && a !== 536870912 && (e.flags |= 128, r = !0, Rl(l, !1), e.lanes = 4194304);
              l.isBackwards ? (o.sibling = e.child, e.child = o) : (t = l.last, t !== null ? t.sibling = o : e.child = o, l.last = o);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = oe(), t.sibling = null, a = Ht.current, b(
              Ht,
              r ? a & 1 | 2 : a & 1
            ), ht && Q(e, l.treeForkCount), t) : (kt(e), null);
          case 22:
          case 23:
            return me(e), Ri(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (kt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : kt(e), a = e.updateQueue, a !== null && Mn(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && T(Ya), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ke(Ct), kt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function xm(t, e) {
        switch ($(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ke(Ct), P(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Kt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (me(e), e.alternate === null)
                throw Error(c(340));
              je();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (me(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(c(340));
              je();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return T(Ht), null;
          case 4:
            return P(), null;
          case 10:
            return Ke(e.type), null;
          case 22:
          case 23:
            return me(e), Ri(), t !== null && T(Ya), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ke(Ct), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function su(t, e) {
        switch ($(e), e.tag) {
          case 3:
            Ke(Ct), P();
            break;
          case 26:
          case 27:
          case 5:
            Kt(e);
            break;
          case 4:
            P();
            break;
          case 31:
            e.memoizedState !== null && me(e);
            break;
          case 13:
            me(e);
            break;
          case 19:
            T(Ht);
            break;
          case 10:
            Ke(e.type);
            break;
          case 22:
          case 23:
            me(e), Ri(), t !== null && T(Ya);
            break;
          case 24:
            Ke(Ct);
        }
      }
      function Hl(t, e) {
        try {
          var a = e.updateQueue, l = a !== null ? a.lastEffect : null;
          if (l !== null) {
            var r = l.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                l = void 0;
                var o = a.create, d = a.inst;
                l = o(), d.destroy = l;
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
            var o = r.next;
            l = o;
            do {
              if ((l.tag & t) === t) {
                var d = l.inst, h = d.destroy;
                if (h !== void 0) {
                  d.destroy = void 0, r = e;
                  var k = a, H = h;
                  try {
                    H();
                  } catch (V) {
                    vt(
                      r,
                      k,
                      V
                    );
                  }
                }
              }
              l = l.next;
            } while (l !== o);
          }
        } catch (V) {
          vt(e, e.return, V);
        }
      }
      function uu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            as(e, a);
          } catch (l) {
            vt(t, t.return, l);
          }
        }
      }
      function cu(t, e, a) {
        a.props = Aa(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (l) {
          vt(t, e, l);
        }
      }
      function Ul(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var l = Yl(t.stateNode);
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
      function du(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          pf(l, e, a, t);
        } catch (r) {
          vt(t, t.return, r);
        }
      }
      function ur(t, e, a) {
        try {
          hf(
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
      function mu(t) {
        return t.tag === 5 || t.tag === 3 || (Re ? t.tag === 26 : !1) || (Gt ? t.tag === 27 && nl(t.type) : !1) || t.tag === 4;
      }
      function cr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || mu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Gt && t.tag === 27 && nl(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function dr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? vf(a, t, e) : mf(a, t);
        else if (l !== 4 && (Gt && l === 27 && nl(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (dr(t, e, a), t = t.sibling; t !== null; )
            dr(t, e, a), t = t.sibling;
      }
      function An(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? gf(a, t, e) : df(a, t);
        else if (l !== 4 && (Gt && l === 27 && nl(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (An(t, e, a), t = t.sibling; t !== null; )
            An(t, e, a), t = t.sibling;
      }
      function fu(t, e, a) {
        t = t.containerInfo;
        try {
          cc(t, a);
        } catch (l) {
          vt(e, e.return, l);
        }
      }
      function pu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          cp(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          vt(t, t.return, l);
        }
      }
      function wm(t, e) {
        for (Gm(t.containerInfo), Zt = e; Zt !== null; )
          if (t = Zt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Zt = e;
          else
            for (; Zt !== null; ) {
              t = Zt;
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
                    var o = l.stateNode;
                    try {
                      var d = Aa(
                        l.type,
                        r
                      );
                      e = o.getSnapshotBeforeUpdate(
                        d,
                        a
                      ), o.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (h) {
                      vt(l, l.return, h);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ae && zf(t.stateNode.containerInfo);
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
                e.return = t.return, Zt = e;
                break;
              }
              Zt = t.return;
            }
      }
      function hu(t, e, a) {
        var l = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Je(t, a), l & 4 && Hl(5, a);
            break;
          case 1:
            if (Je(t, a), l & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (d) {
                  vt(a, a.return, d);
                }
              else {
                var r = Aa(
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
            l & 64 && uu(a), l & 512 && Ul(a, a.return);
            break;
          case 3:
            if (Je(t, a), l & 64 && (l = a.updateQueue, l !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Yl(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                as(l, t);
              } catch (d) {
                vt(a, a.return, d);
              }
            }
            break;
          case 27:
            Gt && e === null && l & 4 && pu(a);
          case 26:
          case 5:
            if (Je(t, a), e === null) {
              if (l & 4) du(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  Jf(
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
            l & 512 && Ul(a, a.return);
            break;
          case 12:
            Je(t, a);
            break;
          case 31:
            Je(t, a), l & 4 && vu(t, a);
            break;
          case 13:
            Je(t, a), l & 4 && bu(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = Tm.bind(
              null,
              a
            ), Tf(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || ta, !l) {
              e = e !== null && e.memoizedState !== null || Bt, r = ta;
              var o = Bt;
              ta = l, (Bt = e) && !o ? Le(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Je(t, a), ta = r, Bt = o;
            }
            break;
          case 30:
            break;
          default:
            Je(t, a);
        }
      }
      function gu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, gu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Fm(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ae(t, e, a) {
        for (a = a.child; a !== null; )
          mr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function mr(t, e, a) {
        if (ge && typeof ge.onCommitFiberUnmount == "function")
          try {
            ge.onCommitFiberUnmount(Vl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Re) {
              Bt || qe(a, e), Ae(
                t,
                e,
                a
              ), a.memoizedState ? bc(a.memoizedState) : a.stateNode && xc(a.stateNode);
              break;
            }
          case 27:
            if (Gt) {
              Bt || qe(a, e);
              var l = Yt, r = se;
              nl(a.type) && (Yt = a.stateNode, se = !1), Ae(
                t,
                e,
                a
              ), Sc(a.stateNode), Yt = l, se = r;
              break;
            }
          case 5:
            Bt || qe(a, e);
          case 6:
            if (ae) {
              if (l = Yt, r = se, Yt = null, Ae(
                t,
                e,
                a
              ), Yt = l, se = r, Yt !== null)
                if (se)
                  try {
                    yf(Yt, a.stateNode);
                  } catch (o) {
                    vt(
                      a,
                      e,
                      o
                    );
                  }
                else
                  try {
                    bf(Yt, a.stateNode);
                  } catch (o) {
                    vt(
                      a,
                      e,
                      o
                    );
                  }
            } else
              Ae(
                t,
                e,
                a
              );
            break;
          case 18:
            ae && Yt !== null && (se ? tp(
              Yt,
              a.stateNode
            ) : Pf(Yt, a.stateNode));
            break;
          case 4:
            ae ? (l = Yt, r = se, Yt = a.stateNode.containerInfo, se = !0, Ae(
              t,
              e,
              a
            ), Yt = l, se = r) : (Be && fu(
              a.stateNode,
              a,
              sc()
            ), Ae(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            ma(2, a, e), Bt || ma(4, a, e), Ae(
              t,
              e,
              a
            );
            break;
          case 1:
            Bt || (qe(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && cu(
              a,
              e,
              l
            )), Ae(
              t,
              e,
              a
            );
            break;
          case 21:
            Ae(
              t,
              e,
              a
            );
            break;
          case 22:
            Bt = (l = Bt) || a.memoizedState !== null, Ae(
              t,
              e,
              a
            ), Bt = l;
            break;
          default:
            Ae(
              t,
              e,
              a
            );
        }
      }
      function vu(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Wf(t);
          } catch (a) {
            vt(e, e.return, a);
          }
        }
      }
      function bu(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Ff(t);
          } catch (a) {
            vt(e, e.return, a);
          }
      }
      function _m(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Oc()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Oc()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function On(t, e) {
        var a = _m(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = Cm.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ee(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], o = t, d = e;
            if (ae) {
              var h = d;
              t: for (; h !== null; ) {
                switch (h.tag) {
                  case 27:
                    if (Gt) {
                      if (nl(h.type)) {
                        Yt = h.stateNode, se = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Yt = h.stateNode, se = !1;
                    break t;
                  case 3:
                  case 4:
                    Yt = h.stateNode.containerInfo, se = !0;
                    break t;
                }
                h = h.return;
              }
              if (Yt === null) throw Error(c(160));
              mr(o, d, r), Yt = null, se = !1;
            } else mr(o, d, r);
            o = r.alternate, o !== null && (o.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            yu(e, t), e = e.sibling;
      }
      function yu(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ee(e, t), ie(t), l & 4 && (ma(3, t, t.return), Hl(3, t), ma(5, t, t.return));
            break;
          case 1:
            ee(e, t), ie(t), l & 512 && (Bt || a === null || qe(a, a.return)), l & 64 && ta && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (Re) {
              var r = He;
              if (ee(e, t), ie(t), l & 512 && (Bt || a === null || qe(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var o = t.memoizedState;
                a === null ? o === null ? t.stateNode === null ? t.stateNode = ip(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : yc(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = vc(
                  r,
                  o,
                  t.memoizedProps
                ) : l !== o ? (l === null ? a.stateNode !== null && xc(a.stateNode) : bc(l), o === null ? yc(
                  r,
                  t.type,
                  t.stateNode
                ) : vc(
                  r,
                  o,
                  t.memoizedProps
                )) : o === null && t.stateNode !== null && ur(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Gt) {
              ee(e, t), ie(t), l & 512 && (Bt || a === null || qe(a, a.return)), a !== null && l & 4 && ur(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ee(e, t), ie(t), l & 512 && (Bt || a === null || qe(a, a.return)), ae) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  oc(r);
                } catch (B) {
                  vt(t, t.return, B);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, ur(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (to = !0);
            } else
              Be && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ee(e, t), ie(t), l & 4 && ae) {
              if (t.stateNode === null)
                throw Error(c(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                ff(r, a, l);
              } catch (B) {
                vt(t, t.return, B);
              }
            }
            break;
          case 3:
            if (Re ? (op(), r = He, He = Dr(e.containerInfo), ee(e, t), He = r) : ee(e, t), ie(t), l & 4) {
              if (ae && le && a !== null && a.memoizedState.isDehydrated)
                try {
                  Lf(e.containerInfo);
                } catch (B) {
                  vt(t, t.return, B);
                }
              if (Be) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  cc(l, a);
                } catch (B) {
                  vt(t, t.return, B);
                }
              }
            }
            to && (to = !1, xu(t));
            break;
          case 4:
            Re ? (a = He, He = Dr(
              t.stateNode.containerInfo
            ), ee(e, t), ie(t), He = a) : (ee(e, t), ie(t)), l & 4 && Be && fu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ee(e, t), ie(t);
            break;
          case 31:
            ee(e, t), ie(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, On(t, l)));
            break;
          case 13:
            ee(e, t), ie(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (ri = oe()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, On(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var d = a !== null && a.memoizedState !== null, h = ta, k = Bt;
            if (ta = h || r, Bt = k || d, ee(e, t), Bt = k, ta = h, ie(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || d || ta || Bt || Oa(t)), ae)) {
              t: if (a = null, ae)
                for (e = t; ; ) {
                  if (e.tag === 5 || Re && e.tag === 26) {
                    if (a === null) {
                      d = a = e;
                      try {
                        o = d.stateNode, r ? xf(o) : _f(
                          d.stateNode,
                          d.memoizedProps
                        );
                      } catch (B) {
                        vt(d, d.return, B);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      d = e;
                      try {
                        var H = d.stateNode;
                        r ? wf(H) : Sf(H, d.memoizedProps);
                      } catch (B) {
                        vt(d, d.return, B);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      d = e;
                      try {
                        var V = d.stateNode;
                        r ? ep(V) : ap(d.stateNode);
                      } catch (B) {
                        vt(d, d.return, B);
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
            l & 4 && (l = t.updateQueue, l !== null && (a = l.retryQueue, a !== null && (l.retryQueue = null, On(t, a))));
            break;
          case 19:
            ee(e, t), ie(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, On(t, l)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            ee(e, t), ie(t);
        }
      }
      function ie(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, l = t.return; l !== null; ) {
              if (mu(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (ae) {
              if (a == null) throw Error(c(160));
              switch (a.tag) {
                case 27:
                  if (Gt) {
                    var r = a.stateNode, o = cr(t);
                    An(t, o, r);
                    break;
                  }
                case 5:
                  var d = a.stateNode;
                  a.flags & 32 && (oc(d), a.flags &= -33);
                  var h = cr(t);
                  An(t, h, d);
                  break;
                case 3:
                case 4:
                  var k = a.stateNode.containerInfo, H = cr(t);
                  dr(
                    t,
                    H,
                    k
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
      function xu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            xu(e), e.tag === 5 && e.flags & 1024 && ef(e.stateNode), t = t.sibling;
          }
      }
      function Je(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            hu(t, e.alternate, e), e = e.sibling;
      }
      function Oa(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ma(4, e, e.return), Oa(e);
              break;
            case 1:
              qe(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && cu(
                e,
                e.return,
                a
              ), Oa(e);
              break;
            case 27:
              Gt && Sc(e.stateNode);
            case 26:
            case 5:
              qe(e, e.return), Oa(e);
              break;
            case 22:
              e.memoizedState === null && Oa(e);
              break;
            case 30:
              Oa(e);
              break;
            default:
              Oa(e);
          }
          t = t.sibling;
        }
      }
      function Le(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var l = e.alternate, r = t, o = e, d = o.flags;
          switch (o.tag) {
            case 0:
            case 11:
            case 15:
              Le(
                r,
                o,
                a
              ), Hl(4, o);
              break;
            case 1:
              if (Le(
                r,
                o,
                a
              ), l = o, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (H) {
                  vt(l, l.return, H);
                }
              if (l = o, r = l.updateQueue, r !== null) {
                var h = l.stateNode;
                try {
                  var k = r.shared.hiddenCallbacks;
                  if (k !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < k.length; r++)
                      es(k[r], h);
                } catch (H) {
                  vt(l, l.return, H);
                }
              }
              a && d & 64 && uu(o), Ul(o, o.return);
              break;
            case 27:
              Gt && pu(o);
            case 26:
            case 5:
              Le(
                r,
                o,
                a
              ), a && l === null && d & 4 && du(o), Ul(o, o.return);
              break;
            case 12:
              Le(
                r,
                o,
                a
              );
              break;
            case 31:
              Le(
                r,
                o,
                a
              ), a && d & 4 && vu(r, o);
              break;
            case 13:
              Le(
                r,
                o,
                a
              ), a && d & 4 && bu(r, o);
              break;
            case 22:
              o.memoizedState === null && Le(
                r,
                o,
                a
              ), Ul(o, o.return);
              break;
            case 30:
              break;
            default:
              Le(
                r,
                o,
                a
              );
          }
          e = e.sibling;
        }
      }
      function fr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && kl(a));
      }
      function pr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && kl(t));
      }
      function Oe(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            wu(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function wu(t, e, a, l) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Oe(
              t,
              e,
              a,
              l
            ), r & 2048 && Hl(9, e);
            break;
          case 1:
            Oe(
              t,
              e,
              a,
              l
            );
            break;
          case 3:
            Oe(
              t,
              e,
              a,
              l
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && kl(t)));
            break;
          case 12:
            if (r & 2048) {
              Oe(
                t,
                e,
                a,
                l
              ), t = e.stateNode;
              try {
                var o = e.memoizedProps, d = o.id, h = o.onPostCommit;
                typeof h == "function" && h(
                  d,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (k) {
                vt(e, e.return, k);
              }
            } else
              Oe(
                t,
                e,
                a,
                l
              );
            break;
          case 31:
            Oe(
              t,
              e,
              a,
              l
            );
            break;
          case 13:
            Oe(
              t,
              e,
              a,
              l
            );
            break;
          case 23:
            break;
          case 22:
            o = e.stateNode, d = e.alternate, e.memoizedState !== null ? o._visibility & 2 ? Oe(
              t,
              e,
              a,
              l
            ) : Dl(
              t,
              e
            ) : o._visibility & 2 ? Oe(
              t,
              e,
              a,
              l
            ) : (o._visibility |= 2, $a(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && fr(d, e);
            break;
          case 24:
            Oe(
              t,
              e,
              a,
              l
            ), r & 2048 && pr(e.alternate, e);
            break;
          default:
            Oe(
              t,
              e,
              a,
              l
            );
        }
      }
      function $a(t, e, a, l, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var o = t, d = e, h = a, k = l, H = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              $a(
                o,
                d,
                h,
                k,
                r
              ), Hl(8, d);
              break;
            case 23:
              break;
            case 22:
              var V = d.stateNode;
              d.memoizedState !== null ? V._visibility & 2 ? $a(
                o,
                d,
                h,
                k,
                r
              ) : Dl(
                o,
                d
              ) : (V._visibility |= 2, $a(
                o,
                d,
                h,
                k,
                r
              )), r && H & 2048 && fr(
                d.alternate,
                d
              );
              break;
            case 24:
              $a(
                o,
                d,
                h,
                k,
                r
              ), r && H & 2048 && pr(d.alternate, d);
              break;
            default:
              $a(
                o,
                d,
                h,
                k,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Dl(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, l = e, r = l.flags;
            switch (l.tag) {
              case 22:
                Dl(a, l), r & 2048 && fr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Dl(a, l), r & 2048 && pr(
                  l.alternate,
                  l
                );
                break;
              default:
                Dl(a, l);
            }
            e = e.sibling;
          }
      }
      function Ra(t, e, a) {
        if (t.subtreeFlags & bl)
          for (t = t.child; t !== null; )
            _u(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function _u(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ra(
              t,
              e,
              a
            ), t.flags & bl)
              if (t.memoizedState !== null)
                up(
                  a,
                  He,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Rr(r, t)) && rc(a, l, r, t);
              }
            break;
          case 5:
            Ra(
              t,
              e,
              a
            ), t.flags & bl && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Rr(r, t)) && rc(a, l, r, t));
            break;
          case 3:
          case 4:
            Re ? (l = He, He = Dr(
              t.stateNode.containerInfo
            ), Ra(
              t,
              e,
              a
            ), He = l) : Ra(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = bl, bl = 16777216, Ra(
              t,
              e,
              a
            ), bl = l) : Ra(
              t,
              e,
              a
            ));
            break;
          default:
            Ra(
              t,
              e,
              a
            );
        }
      }
      function Su(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function ql(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Zt = l, Eu(
                l,
                t
              );
            }
          Su(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            zu(t), t = t.sibling;
      }
      function zu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            ql(t), t.flags & 2048 && ma(9, t, t.return);
            break;
          case 3:
            ql(t);
            break;
          case 12:
            ql(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Rn(t)) : ql(t);
            break;
          default:
            ql(t);
        }
      }
      function Rn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Zt = l, Eu(
                l,
                t
              );
            }
          Su(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ma(8, e, e.return), Rn(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Rn(e));
              break;
            default:
              Rn(e);
          }
          t = t.sibling;
        }
      }
      function Eu(t, e) {
        for (; Zt !== null; ) {
          var a = Zt;
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
              kl(a.memoizedState.cache);
          }
          if (l = a.child, l !== null) l.return = a, Zt = l;
          else
            t: for (a = t; Zt !== null; ) {
              l = Zt;
              var r = l.sibling, o = l.return;
              if (gu(l), l === a) {
                Zt = null;
                break t;
              }
              if (r !== null) {
                r.return = o, Zt = r;
                break t;
              }
              Zt = o;
            }
        }
      }
      function hr(t) {
        var e = Zm(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = nf(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function gr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case ei:
            if (t.type === e.value) return !0;
            break;
          case ai:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, o = t[a++], d = e[o];
                if (r !== 5 && r !== 26 && r !== 27 || !Ql(l)) {
                  for (; d != null && gr(l, d); )
                    o++, d = e[o];
                  if (o === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (l = l.child; l !== null; )
                      t.push(l, o), l = l.sibling;
                }
              }
              e = !1;
            }
            return e;
          case li:
            if ((a === 5 || a === 26 || a === 27) && sf(t.stateNode, e.value))
              return !0;
            break;
          case ii:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = of(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ni:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function vr(t) {
        switch (t.$$typeof) {
          case ei:
            return "<" + (R(t.value) || "Unknown") + ">";
          case ai:
            return ":has(" + (vr(t) || "") + ")";
          case li:
            return '[role="' + t.value + '"]';
          case ii:
            return '"' + t.value + '"';
          case ni:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function ku(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], o = r.tag, d = t[l++], h = e[d];
          if (o !== 5 && o !== 26 && o !== 27 || !Ql(r)) {
            for (; h != null && gr(r, h); )
              d++, h = e[d];
            if (d === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, d), r = r.sibling;
          }
        }
        return a;
      }
      function br(t, e) {
        if (!Gl) throw Error(c(363));
        t = hr(t), t = ku(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var l = t[a++], r = l.tag;
          if (r === 5 || r === 26 || r === 27)
            Ql(l) || e.push(l.stateNode);
          else
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
        }
        return e;
      }
      function fe() {
        return (mt & 2) !== 0 && pt !== 0 ? pt & -pt : tt.T !== null ? Ni() : Lm();
      }
      function Nu() {
        if (xe === 0)
          if ((pt & 536870912) === 0 || ht) {
            var t = Qn;
            Qn <<= 1, (Qn & 3932160) === 0 && (Qn = 262144), xe = t;
          } else xe = 536870912;
        return t = be.current, t !== null && (t.flags |= 32), xe;
      }
      function re(t, e, a) {
        (t === zt && (wt === 2 || wt === 9) || t.cancelPendingCommit !== null) && (Pa(t, 0), fa(
          t,
          pt,
          xe,
          !1
        )), K(t, a), ((mt & 2) === 0 || t !== zt) && (t === zt && ((mt & 2) === 0 && (Ka |= a), At === 4 && fa(
          t,
          pt,
          xe,
          !1
        )), De(t));
      }
      function Tu(t, e, a) {
        if ((mt & 6) !== 0) throw Error(c(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || N(t, e), r = l ? Em(t, e) : xr(t, e, !0), o = l;
        do {
          if (r === 0) {
            yl && !l && fa(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, o && !Sm(a)) {
              r = xr(t, e, !1), o = !1;
              continue;
            }
            if (r === 2) {
              if (o = e, t.errorRecoveryDisabledLanes & o)
                var d = 0;
              else
                d = t.pendingLanes & -536870913, d = d !== 0 ? d : d & 536870912 ? 536870912 : 0;
              if (d !== 0) {
                e = d;
                t: {
                  var h = t;
                  r = Il;
                  var k = le && h.current.memoizedState.isDehydrated;
                  if (k && (Pa(h, d).flags |= 256), d = xr(
                    h,
                    d,
                    !1
                  ), d !== 2) {
                    if (eo && !k) {
                      h.errorRecoveryDisabledLanes |= o, Ka |= o, r = 4;
                      break t;
                    }
                    o = ue, ue = r, o !== null && (ue === null ? ue = o : ue.push.apply(
                      ue,
                      o
                    ));
                  }
                  r = d;
                }
                if (o = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              Pa(t, 0), fa(t, e, 0, !0);
              break;
            }
            t: {
              switch (l = t, o = r, o) {
                case 0:
                case 1:
                  throw Error(c(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  fa(
                    l,
                    e,
                    xe,
                    !xa
                  );
                  break t;
                case 2:
                  ue = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(c(329));
              }
              if ((e & 62914560) === e && (r = ri + 300 - oe(), 10 < r)) {
                if (fa(
                  l,
                  e,
                  xe,
                  !xa
                ), M(l, 0, !0) !== 0) break t;
                aa = e, l.timeoutHandle = Km(
                  Cu.bind(
                    null,
                    l,
                    a,
                    ue,
                    oi,
                    lo,
                    e,
                    xe,
                    Ka,
                    xl,
                    xa,
                    o,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Cu(
                l,
                a,
                ue,
                oi,
                lo,
                e,
                xe,
                Ka,
                xl,
                xa,
                o,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        De(t);
      }
      function Cu(t, e, a, l, r, o, d, h, k, H, V, B, Z, ot) {
        if (t.timeoutHandle = Ua, B = e.subtreeFlags, B & 8192 || (B & 16785408) === 16785408) {
          B = Pm(), _u(
            e,
            o,
            B
          );
          var Pt = (o & 62914560) === o ? ri - oe() : (o & 4194048) === o ? Rc - oe() : 0;
          if (Pt = tf(
            B,
            Pt
          ), Pt !== null) {
            aa = o, t.cancelPendingCommit = Pt(
              qu.bind(
                null,
                t,
                e,
                o,
                a,
                l,
                r,
                d,
                h,
                k,
                V,
                B,
                null,
                Z,
                ot
              )
            ), fa(t, o, d, !H);
            return;
          }
        }
        qu(
          t,
          e,
          o,
          a,
          l,
          r,
          d,
          h,
          k
        );
      }
      function Sm(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var l = 0; l < a.length; l++) {
              var r = a[l], o = r.getSnapshot;
              r = r.value;
              try {
                if (!ve(o(), r)) return !1;
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
      function fa(t, e, a, l) {
        e &= ~ao, e &= ~Ka, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var o = 31 - he(r), d = 1 << o;
          l[o] = -1, r &= ~d;
        }
        a !== 0 && S(t, a, e);
      }
      function ju() {
        return (mt & 6) === 0 ? (Fa(0), !1) : !0;
      }
      function yr() {
        if (ft !== null) {
          if (wt === 0)
            var t = ft.return;
          else
            t = ft, $e = qa = null, Yi(t), fl = null, Jl = 0, t = ft;
          for (; t !== null; )
            su(t.alternate, t), t = t.return;
          ft = null;
        }
      }
      function Pa(t, e) {
        var a = t.timeoutHandle;
        a !== Ua && (t.timeoutHandle = Ua, Xm(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), aa = 0, yr(), zt = t, ft = a = We(t.current, null), pt = e, wt = 0, ye = null, xa = !1, yl = N(t, e), eo = !1, xl = xe = ao = Ka = wa = At = 0, ue = Il = null, lo = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - he(l), o = 1 << r;
            e |= t[r], l &= ~o;
          }
        return ea = e, gn(), a;
      }
      function Mu(t, e) {
        st = null, tt.H = Wl, e === ml || e === Fn ? (e = Io(), wt = 3) : e === Jr ? (e = Io(), wt = 4) : wt = e === $r ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ye = e, ft === null && (At = 1, kn(
          t,
          it(e, t.current)
        ));
      }
      function Au() {
        var t = be.current;
        return t === null ? !0 : (pt & 4194048) === pt ? Te === null : (pt & 62914560) === pt || (pt & 536870912) !== 0 ? t === Te : !1;
      }
      function Ou() {
        var t = tt.H;
        return tt.H = Wl, t === null ? Wl : t;
      }
      function Ru() {
        var t = tt.A;
        return tt.A = zp, t;
      }
      function Hn() {
        At = 4, xa || (pt & 4194048) !== pt && be.current !== null || (yl = !0), (wa & 134217727) === 0 && (Ka & 134217727) === 0 || zt === null || fa(
          zt,
          pt,
          xe,
          !1
        );
      }
      function xr(t, e, a) {
        var l = mt;
        mt |= 2;
        var r = Ou(), o = Ru();
        (zt !== t || pt !== e) && (oi = null, Pa(t, e)), e = !1;
        var d = At;
        t: do
          try {
            if (wt !== 0 && ft !== null) {
              var h = ft, k = ye;
              switch (wt) {
                case 8:
                  yr(), d = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  be.current === null && (e = !0);
                  var H = wt;
                  if (wt = 0, ye = null, tl(t, h, k, H), a && yl) {
                    d = 0;
                    break t;
                  }
                  break;
                default:
                  H = wt, wt = 0, ye = null, tl(t, h, k, H);
              }
            }
            zm(), d = At;
            break;
          } catch (V) {
            Mu(t, V);
          }
        while (!0);
        return e && t.shellSuspendCounter++, $e = qa = null, mt = l, tt.H = r, tt.A = o, ft === null && (zt = null, pt = 0, gn()), d;
      }
      function zm() {
        for (; ft !== null; ) Hu(ft);
      }
      function Em(t, e) {
        var a = mt;
        mt |= 2;
        var l = Ou(), r = Ru();
        zt !== t || pt !== e ? (oi = null, $l = oe() + 500, Pa(t, e)) : yl = N(
          t,
          e
        );
        t: do
          try {
            if (wt !== 0 && ft !== null) {
              e = ft;
              var o = ye;
              e: switch (wt) {
                case 1:
                  wt = 0, ye = null, tl(t, e, o, 1);
                  break;
                case 2:
                case 9:
                  if (Wo(o)) {
                    wt = 0, ye = null, Uu(e);
                    break;
                  }
                  e = function() {
                    wt !== 2 && wt !== 9 || zt !== t || (wt = 7), De(t);
                  }, o.then(e, e);
                  break t;
                case 3:
                  wt = 7;
                  break t;
                case 4:
                  wt = 5;
                  break t;
                case 7:
                  Wo(o) ? (wt = 0, ye = null, Uu(e)) : (wt = 0, ye = null, tl(t, e, o, 7));
                  break;
                case 5:
                  var d = null;
                  switch (ft.tag) {
                    case 26:
                      d = ft.memoizedState;
                    case 5:
                    case 27:
                      var h = ft, k = h.type, H = h.pendingProps;
                      if (d ? wc(d) : ic(h.stateNode, k, H)) {
                        wt = 0, ye = null;
                        var V = h.sibling;
                        if (V !== null) ft = V;
                        else {
                          var B = h.return;
                          B !== null ? (ft = B, Un(B)) : ft = null;
                        }
                        break e;
                      }
                  }
                  wt = 0, ye = null, tl(t, e, o, 5);
                  break;
                case 6:
                  wt = 0, ye = null, tl(t, e, o, 6);
                  break;
                case 8:
                  yr(), At = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            km();
            break;
          } catch (Z) {
            Mu(t, Z);
          }
        while (!0);
        return $e = qa = null, tt.H = l, tt.A = r, mt = a, ft !== null ? 0 : (zt = null, pt = 0, gn(), At);
      }
      function km() {
        for (; ft !== null && !fp(); )
          Hu(ft);
      }
      function Hu(t) {
        var e = lu(
          t.alternate,
          t,
          ea
        );
        t.memoizedProps = t.pendingProps, e === null ? Un(t) : ft = e;
      }
      function Uu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Is(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              pt
            );
            break;
          case 11:
            e = Is(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              pt
            );
            break;
          case 5:
            Yi(e);
          default:
            su(a, e), e = ft = Zu(e, ea), e = lu(a, e, ea);
        }
        t.memoizedProps = t.pendingProps, e === null ? Un(t) : ft = e;
      }
      function tl(t, e, a, l) {
        $e = qa = null, Yi(e), fl = null, Jl = 0;
        var r = e.return;
        try {
          if (gm(
            t,
            r,
            e,
            a,
            pt
          )) {
            At = 1, kn(
              t,
              it(a, t.current)
            ), ft = null;
            return;
          }
        } catch (o) {
          if (r !== null) throw ft = r, o;
          At = 1, kn(
            t,
            it(a, t.current)
          ), ft = null;
          return;
        }
        e.flags & 32768 ? (ht || l === 1 ? t = !0 : yl || (pt & 536870912) !== 0 ? t = !1 : (xa = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = be.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Du(e, t)) : Un(e);
      }
      function Un(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Du(
              e,
              xa
            );
            return;
          }
          t = e.return;
          var a = ym(
            e.alternate,
            e,
            ea
          );
          if (a !== null) {
            ft = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            ft = e;
            return;
          }
          ft = e = t;
        } while (e !== null);
        At === 0 && (At = 5);
      }
      function Du(t, e) {
        do {
          var a = xm(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, ft = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            ft = t;
            return;
          }
          ft = t = a;
        } while (t !== null);
        At = 6, ft = null;
      }
      function qu(t, e, a, l, r, o, d, h, k) {
        t.cancelPendingCommit = null;
        do
          Bl();
        while (Qt !== 0);
        if ((mt & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (o = e.lanes | e.childLanes, o |= Lr, E(
            t,
            a,
            o,
            d,
            h,
            k
          ), t === zt && (ft = zt = null, pt = 0), wl = e, Sa = t, aa = a, no = o, io = r, Hc = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, jm(Yr, function() {
            return Vu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = tt.T, tt.T = null, r = Ie(), Xt(2), d = mt, mt |= 4;
            try {
              wm(t, e, a);
            } finally {
              mt = d, Xt(r), tt.T = l;
            }
          }
          Qt = 1, Bu(), Yu(), Gu();
        }
      }
      function Bu() {
        if (Qt === 1) {
          Qt = 0;
          var t = Sa, e = wl, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = tt.T, tt.T = null;
            var l = Ie();
            Xt(2);
            var r = mt;
            mt |= 4;
            try {
              yu(e, t), Qm(t.containerInfo);
            } finally {
              mt = r, Xt(l), tt.T = a;
            }
          }
          t.current = e, Qt = 2;
        }
      }
      function Yu() {
        if (Qt === 2) {
          Qt = 0;
          var t = Sa, e = wl, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = tt.T, tt.T = null;
            var l = Ie();
            Xt(2);
            var r = mt;
            mt |= 4;
            try {
              hu(t, e.alternate, e);
            } finally {
              mt = r, Xt(l), tt.T = a;
            }
          }
          Qt = 3;
        }
      }
      function Gu() {
        if (Qt === 4 || Qt === 3) {
          Qt = 0, pp();
          var t = Sa, e = wl, a = aa, l = Hc;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Qt = 5 : (Qt = 0, wl = Sa = null, Qu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (_a = null), Et(a), e = e.stateNode, ge && typeof ge.onCommitFiberRoot == "function")
            try {
              ge.onCommitFiberRoot(
                Vl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (l !== null) {
            e = tt.T, r = Ie(), Xt(2), tt.T = null;
            try {
              for (var o = t.onRecoverableError, d = 0; d < l.length; d++) {
                var h = l[d];
                o(h.value, {
                  componentStack: h.stack
                });
              }
            } finally {
              tt.T = e, Xt(r);
            }
          }
          (aa & 3) !== 0 && Bl(), De(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === ro ? Pl++ : (Pl = 0, ro = t) : Pl = 0, le && $f(), Fa(0);
        }
      }
      function Qu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, kl(e)));
      }
      function Bl() {
        return Bu(), Yu(), Gu(), Vu();
      }
      function Vu() {
        if (Qt !== 5) return !1;
        var t = Sa, e = no;
        no = 0;
        var a = Et(aa), l = 32 > a ? 32 : a;
        a = tt.T;
        var r = Ie();
        try {
          Xt(l), tt.T = null, l = io, io = null;
          var o = Sa, d = aa;
          if (Qt = 0, wl = Sa = null, aa = 0, (mt & 6) !== 0)
            throw Error(c(331));
          var h = mt;
          if (mt |= 4, zu(o.current), wu(
            o,
            o.current,
            d,
            l
          ), mt = h, Fa(0, !1), ge && typeof ge.onPostCommitFiberRoot == "function")
            try {
              ge.onPostCommitFiberRoot(Vl, o);
            } catch {
            }
          return !0;
        } finally {
          Xt(r), tt.T = a, Qu(t, e);
        }
      }
      function Ku(t, e, a) {
        e = it(a, e), e = $i(t.stateNode, e, 2), t = ua(t, e, 2), t !== null && (K(t, 2), De(t));
      }
      function vt(t, e, a) {
        if (t.tag === 3)
          Ku(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Ku(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (_a === null || !_a.has(l))) {
                t = it(a, t), a = Vs(2), l = ua(e, a, 2), l !== null && (Ks(
                  a,
                  l,
                  e,
                  t
                ), K(l, 2), De(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function wr(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new Ep();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (eo = !0, r.add(a), t = Nm.bind(null, t, e, a), e.then(t, t));
      }
      function Nm(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, zt === t && (pt & a) === a && (At === 4 || At === 3 && (pt & 62914560) === pt && 300 > oe() - ri ? (mt & 2) === 0 && Pa(t, 0) : ao |= a, xl === pt && (xl = 0)), De(t);
      }
      function Xu(t, e) {
        e === 0 && (e = O()), t = Ma(t, e), t !== null && (K(t, e), De(t));
      }
      function Tm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Xu(t, a);
      }
      function Cm(t, e) {
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
        l !== null && l.delete(e), Xu(t, a);
      }
      function jm(t, e) {
        return Kn(t, e);
      }
      function Mm(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function _r(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function We(t, e) {
        var a = t.alternate;
        return a === null ? (a = s(
          t.tag,
          e,
          t.key,
          t.mode
        ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
      }
      function Zu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Dn(t, e, a, l, r, o) {
        var d = 0;
        if (l = t, typeof t == "function") _r(t) && (d = 1);
        else if (typeof t == "string")
          d = Re && Gt ? hc(t, a, It.current) ? 26 : zc(t) ? 27 : 5 : Re ? hc(
            t,
            a,
            It.current
          ) ? 26 : 5 : Gt && zc(t) ? 27 : 5;
        else
          t: switch (t) {
            case Ar:
              return t = s(31, a, e, r), t.elementType = Ar, t.lanes = o, t;
            case al:
              return Ha(
                a.children,
                r,
                o,
                e
              );
            case Pu:
              d = 8, r |= 24;
              break;
            case Nr:
              return t = s(12, a, e, r | 2), t.elementType = Nr, t.lanes = o, t;
            case Cr:
              return t = s(13, a, e, r), t.elementType = Cr, t.lanes = o, t;
            case jr:
              return t = s(19, a, e, r), t.elementType = jr, t.lanes = o, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case pa:
                    d = 10;
                    break t;
                  case tc:
                    d = 9;
                    break t;
                  case Tr:
                    d = 11;
                    break t;
                  case Mr:
                    d = 14;
                    break t;
                  case ha:
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
        return e = s(d, a, e, r), e.elementType = t, e.type = l, e.lanes = o, e;
      }
      function Ha(t, e, a, l) {
        return t = s(7, t, l, e), t.lanes = a, t;
      }
      function Sr(t, e, a) {
        return t = s(6, t, null, e), t.lanes = a, t;
      }
      function Ju(t) {
        var e = s(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function zr(t, e, a) {
        return e = s(
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
      function Am(t, e, a, l, r, o, d, h, k) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Ua, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = X(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = X(0), this.hiddenUpdates = X(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = o, this.onRecoverableError = d, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = k, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Lu(t, e, a, l, r, o, d, h, k, H, V, B) {
        return t = new Am(
          t,
          e,
          a,
          d,
          k,
          H,
          V,
          B,
          h
        ), e = 1, o === !0 && (e |= 24), o = s(3, null, null, e), t.current = o, o.stateNode = t, e = ki(), e.refCount++, t.pooledCache = e, e.refCount++, o.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, ji(o), t;
      }
      function Wu(t) {
        return t ? (t = rl, t) : rl;
      }
      function Fu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = p(e), t = t !== null ? w(t) : null, t === null ? null : Yl(t.stateNode);
      }
      function Iu(t, e, a, l, r, o) {
        r = Wu(r), l.context === null ? l.context = r : l.pendingContext = r, l = sa(e), l.payload = { element: a }, o = o === void 0 ? null : o, o !== null && (l.callback = o), a = ua(t, l, e), a !== null && (re(a, t, e), Tl(a, t, e));
      }
      function $u(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Er(t, e) {
        $u(t, e), (t = t.alternate) && $u(t, e);
      }
      var dt = {}, Om = Ed(), pe = Zp(), kr = Object.assign, Rm = Symbol.for("react.element"), qn = Symbol.for("react.transitional.element"), el = Symbol.for("react.portal"), al = Symbol.for("react.fragment"), Pu = Symbol.for("react.strict_mode"), Nr = Symbol.for("react.profiler"), tc = Symbol.for("react.consumer"), pa = Symbol.for("react.context"), Tr = Symbol.for("react.forward_ref"), Cr = Symbol.for("react.suspense"), jr = Symbol.for("react.suspense_list"), Mr = Symbol.for("react.memo"), ha = Symbol.for("react.lazy"), Ar = Symbol.for("react.activity"), Hm = Symbol.for("react.memo_cache_sentinel"), ec = Symbol.iterator, Um = Symbol.for("react.client.reference"), Bn = Array.isArray, tt = Om.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Dm = i.rendererVersion, qm = i.rendererPackageName, ac = i.extraDevToolsConfig, Yl = i.getPublicInstance, Bm = i.getRootHostContext, Ym = i.getChildHostContext, Gm = i.prepareForCommit, Qm = i.resetAfterCommit, Vm = i.createInstance;
      i.cloneMutableInstance;
      var Or = i.appendInitialChild, lc = i.finalizeInitialChildren, Yn = i.shouldSetTextContent, nc = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Km = i.scheduleTimeout, Xm = i.cancelTimeout, Ua = i.noTimeout, Fe = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ae = i.supportsMutation, Be = i.supportsPersistence, le = i.supportsHydration, Zm = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var Jm = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Xt = i.setCurrentUpdatePriority, Ie = i.getCurrentUpdatePriority, Lm = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var Wm = i.shouldAttemptEagerTransition, Fm = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var Im = i.maySuspendCommit, $m = i.maySuspendCommitOnUpdate, Rr = i.maySuspendCommitInSyncRender, ic = i.preloadInstance, Pm = i.startSuspendingCommit, rc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var tf = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var ll = i.NotPendingTransition, Da = i.HostTransitionContext, ef = i.resetFormInstance;
      i.bindToConsole;
      var af = i.supportsMicrotasks, lf = i.scheduleMicrotask, Gl = i.supportsTestSelectors, nf = i.findFiberRoot, rf = i.getBoundingRect, of = i.getTextContent, Ql = i.isHiddenSubtree, sf = i.matchAccessibilityRole, uf = i.setFocusIfFocusable, cf = i.setupIntersectionObserver, df = i.appendChild, mf = i.appendChildToContainer, ff = i.commitTextUpdate, pf = i.commitMount, hf = i.commitUpdate, gf = i.insertBefore, vf = i.insertInContainerBefore, bf = i.removeChild, yf = i.removeChildFromContainer, oc = i.resetTextContent, xf = i.hideInstance, wf = i.hideTextInstance, _f = i.unhideInstance, Sf = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var zf = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var Ef = i.cloneInstance, sc = i.createContainerChildSet, uc = i.appendChildToContainerChildSet, kf = i.finalizeContainerChildren, cc = i.replaceContainerChildren, dc = i.cloneHiddenInstance, mc = i.cloneHiddenTextInstance, Hr = i.isSuspenseInstancePending, Ur = i.isSuspenseInstanceFallback, Nf = i.getSuspenseInstanceFallbackErrorDetails, Tf = i.registerSuspenseInstanceRetry, Cf = i.canHydrateFormStateMarker, jf = i.isFormStateMarkerMatching, fc = i.getNextHydratableSibling, Mf = i.getNextHydratableSiblingAfterSingleton, Af = i.getFirstHydratableChild, Of = i.getFirstHydratableChildWithinContainer, Rf = i.getFirstHydratableChildWithinActivityInstance, Hf = i.getFirstHydratableChildWithinSuspenseInstance, Uf = i.getFirstHydratableChildWithinSingleton, Df = i.canHydrateInstance, qf = i.canHydrateTextInstance, Bf = i.canHydrateActivityInstance, Yf = i.canHydrateSuspenseInstance, Gf = i.hydrateInstance, Qf = i.hydrateTextInstance, Vf = i.hydrateActivityInstance, Kf = i.hydrateSuspenseInstance, Xf = i.getNextHydratableInstanceAfterActivityInstance, Zf = i.getNextHydratableInstanceAfterSuspenseInstance, Jf = i.commitHydratedInstance, Lf = i.commitHydratedContainer, Wf = i.commitHydratedActivityInstance, Ff = i.commitHydratedSuspenseInstance, If = i.finalizeHydratedChildren, $f = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var Pf = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var tp = i.clearSuspenseBoundaryFromContainer, ep = i.hideDehydratedBoundary, ap = i.unhideDehydratedBoundary, pc = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var lp = i.validateHydratableInstance, np = i.validateHydratableTextInstance, Re = i.supportsResources, hc = i.isHostHoistableType, Dr = i.getHoistableRoot, gc = i.getResource, vc = i.acquireResource, bc = i.releaseResource, ip = i.hydrateHoistable, yc = i.mountHoistable, xc = i.unmountHoistable, rp = i.createHoistableInstance, op = i.prepareToCommitHoistables, sp = i.mayResourceSuspendCommit, wc = i.preloadResource, up = i.suspendResource, Gt = i.supportsSingletons, _c = i.resolveSingletonInstance, cp = i.acquireSingletonInstance, Sc = i.releaseSingletonInstance, zc = i.isHostSingletonType, nl = i.isSingletonScope, qr = [], il = -1, rl = {}, he = Math.clz32 ? Math.clz32 : j, dp = Math.log, mp = Math.LN2, Gn = 256, Qn = 262144, Vn = 4194304, Kn = pe.unstable_scheduleCallback, Br = pe.unstable_cancelCallback, fp = pe.unstable_shouldYield, pp = pe.unstable_requestPaint, oe = pe.unstable_now, Ec = pe.unstable_ImmediatePriority, hp = pe.unstable_UserBlockingPriority, Yr = pe.unstable_NormalPriority, gp = pe.unstable_IdlePriority, vp = pe.log, bp = pe.unstable_setDisableYieldValue, Vl = null, ge = null, ve = typeof Object.is == "function" ? Object.is : Lt, kc = typeof reportError == "function" ? reportError : function(t) {
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
      }, yp = Object.prototype.hasOwnProperty, Gr, Nc, Qr = !1, Tc = /* @__PURE__ */ new WeakMap(), ol = [], sl = 0, Xn = null, Kl = 0, ze = [], Ee = 0, ga = null, Ye = 1, Ge = "", It = g(null), Xl = g(null), va = g(null), Zn = g(null), $t = null, Tt = null, ht = !1, ba = null, ke = !1, Vr = Error(c(519)), Jn = g(null), qa = null, $e = null, xp = typeof AbortController < "u" ? AbortController : function() {
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
      }, wp = pe.unstable_scheduleCallback, _p = pe.unstable_NormalPriority, Ct = {
        $$typeof: pa,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Ln = null, ul = null, Kr = !1, Wn = !1, Xr = !1, Ba = 0, Zl = null, Zr = 0, cl = 0, dl = null, Cc = tt.S;
      tt.S = function(t, e) {
        Rc = oe(), typeof e == "object" && e !== null && typeof e.then == "function" && sm(t, e), Cc !== null && Cc(t, e);
      };
      var Ya = g(null), ml = Error(c(460)), Jr = Error(c(474)), Fn = Error(c(542)), In = { then: function() {
      } }, Ga = null, fl = null, Jl = 0, Qa = Po(!0), jc = Po(!1), Ne = [], pl = 0, Lr = 0, ya = !1, Wr = !1, hl = g(null), $n = g(0), be = g(null), Te = null, Ht = g(0), Pe = 0, st = null, St = null, Dt = null, Pn = !1, gl = !1, Va = !1, ti = 0, Ll = 0, vl = null, Sp = 0, Wl = {
        readContext: Wt,
        use: wn,
        useCallback: Mt,
        useContext: Mt,
        useEffect: Mt,
        useImperativeHandle: Mt,
        useLayoutEffect: Mt,
        useInsertionEffect: Mt,
        useMemo: Mt,
        useReducer: Mt,
        useRef: Mt,
        useState: Mt,
        useDebugValue: Mt,
        useDeferredValue: Mt,
        useTransition: Mt,
        useSyncExternalStore: Mt,
        useId: Mt,
        useHostTransitionStatus: Mt,
        useFormState: Mt,
        useActionState: Mt,
        useOptimistic: Mt,
        useMemoCache: Mt,
        useCacheRefresh: Mt
      };
      Wl.useEffectEvent = Mt;
      var Mc = {
        readContext: Wt,
        use: wn,
        useCallback: function(t, e) {
          return ne().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Wt,
        useEffect: zs,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Sn(
            4194308,
            4,
            Ts.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Sn(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Sn(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = ne();
          e = e === void 0 ? null : e;
          var l = t();
          if (Va) {
            Ot(!0);
            try {
              t();
            } finally {
              Ot(!1);
            }
          }
          return a.memoizedState = [l, e], l;
        },
        useReducer: function(t, e, a) {
          var l = ne();
          if (a !== void 0) {
            var r = a(e);
            if (Va) {
              Ot(!0);
              try {
                a(e);
              } finally {
                Ot(!1);
              }
            }
          } else r = e;
          return l.memoizedState = l.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, l.queue = t, t = t.dispatch = hm.bind(
            null,
            st,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = ne();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Ki(t);
          var e = t.queue, a = Ds.bind(
            null,
            st,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Ji,
        useDeferredValue: function(t, e) {
          var a = ne();
          return Li(a, t, e);
        },
        useTransition: function() {
          var t = Ki(!1);
          return t = Os.bind(
            null,
            st,
            t.queue,
            !0,
            !1
          ), ne().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = st, r = ne();
          if (ht) {
            if (a === void 0)
              throw Error(c(407));
            a = a();
          } else {
            if (a = e(), zt === null)
              throw Error(c(349));
            (pt & 127) !== 0 || ss(l, e, a);
          }
          r.memoizedState = a;
          var o = { value: a, getSnapshot: e };
          return r.queue = o, zs(cs.bind(null, l, o, t), [
            t
          ]), l.flags |= 2048, Ia(
            9,
            { destroy: void 0 },
            us.bind(
              null,
              l,
              o,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = ne(), e = zt.identifierPrefix;
          if (ht) {
            var a = Ge, l = Ye;
            a = (l & ~(1 << 32 - he(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ti++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Sp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Wi,
        useFormState: ys,
        useActionState: ys,
        useOptimistic: function(t) {
          var e = ne();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = Fi.bind(
            null,
            st,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Gi,
        useCacheRefresh: function() {
          return ne().memoizedState = pm.bind(
            null,
            st
          );
        },
        useEffectEvent: function(t) {
          var e = ne(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((mt & 2) !== 0)
              throw Error(c(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, Fr = {
        readContext: Wt,
        use: wn,
        useCallback: js,
        useContext: Wt,
        useEffect: Zi,
        useImperativeHandle: Cs,
        useInsertionEffect: ks,
        useLayoutEffect: Ns,
        useMemo: Ms,
        useReducer: _n,
        useRef: Ss,
        useState: function() {
          return _n(Xe);
        },
        useDebugValue: Ji,
        useDeferredValue: function(t, e) {
          var a = Rt();
          return As(
            a,
            St.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = _n(Xe)[0], e = Rt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ml(t),
            e
          ];
        },
        useSyncExternalStore: os,
        useId: Hs,
        useHostTransitionStatus: Wi,
        useFormState: xs,
        useActionState: xs,
        useOptimistic: function(t, e) {
          var a = Rt();
          return fs(a, St, t, e);
        },
        useMemoCache: Gi,
        useCacheRefresh: Us
      };
      Fr.useEffectEvent = Es;
      var Ac = {
        readContext: Wt,
        use: wn,
        useCallback: js,
        useContext: Wt,
        useEffect: Zi,
        useImperativeHandle: Cs,
        useInsertionEffect: ks,
        useLayoutEffect: Ns,
        useMemo: Ms,
        useReducer: Vi,
        useRef: Ss,
        useState: function() {
          return Vi(Xe);
        },
        useDebugValue: Ji,
        useDeferredValue: function(t, e) {
          var a = Rt();
          return St === null ? Li(a, t, e) : As(
            a,
            St.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Vi(Xe)[0], e = Rt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ml(t),
            e
          ];
        },
        useSyncExternalStore: os,
        useId: Hs,
        useHostTransitionStatus: Wi,
        useFormState: _s,
        useActionState: _s,
        useOptimistic: function(t, e) {
          var a = Rt();
          return St !== null ? fs(a, St, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Gi,
        useCacheRefresh: Us
      };
      Ac.useEffectEvent = Es;
      var Ir = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = fe(), r = sa(l);
          r.payload = e, a != null && (r.callback = a), e = ua(t, r, l), e !== null && (re(e, t, l), Tl(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = fe(), r = sa(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = ua(t, r, l), e !== null && (re(e, t, l), Tl(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = fe(), l = sa(a);
          l.tag = 2, e != null && (l.callback = e), e = ua(t, l, a), e !== null && (re(e, t, a), Tl(e, t, a));
        }
      }, $r = Error(c(461)), qt = !1, Pr = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, ta = !1, Bt = !1, to = !1, Oc = typeof WeakSet == "function" ? WeakSet : Set, Zt = null, Yt = null, se = !1, He = null, bl = 8192, zp = {
        getCacheForType: function(t) {
          var e = Wt(Ct), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return Wt(Ct).controller.signal;
        }
      }, ei = 0, ai = 1, li = 2, ni = 3, ii = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Fl = Symbol.for;
        ei = Fl("selector.component"), ai = Fl("selector.has_pseudo_class"), li = Fl("selector.role"), ni = Fl("selector.test_id"), ii = Fl("selector.text");
      }
      var Ep = typeof WeakMap == "function" ? WeakMap : Map, mt = 0, zt = null, ft = null, pt = 0, wt = 0, ye = null, xa = !1, yl = !1, eo = !1, ea = 0, At = 0, wa = 0, Ka = 0, ao = 0, xe = 0, xl = 0, Il = null, ue = null, lo = !1, ri = 0, Rc = 0, $l = 1 / 0, oi = null, _a = null, Qt = 0, Sa = null, wl = null, aa = 0, no = 0, io = null, Hc = null, Pl = 0, ro = null;
      return dt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ma(t, 67108864);
          e !== null && re(e, t, 67108864), Er(t, 67108864);
        }
      }, dt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = fe();
          e = _t(e);
          var a = Ma(t, e);
          a !== null && re(a, t, e), Er(t, e);
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
                De(t), (mt & 6) === 0 && ($l = oe() + 500, Fa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ma(t, 2), e !== null && re(e, t, 2), ju(), Er(t, 2);
        }
      }, dt.batchedUpdates = function(t, e) {
        return t(e);
      }, dt.createComponentSelector = function(t) {
        return { $$typeof: ei, value: t };
      }, dt.createContainer = function(t, e, a, l, r, o, d, h, k, H) {
        return Lu(
          t,
          e,
          !1,
          null,
          a,
          l,
          o,
          null,
          d,
          h,
          k,
          H
        );
      }, dt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ai, value: t };
      }, dt.createHydrationContainer = function(t, e, a, l, r, o, d, h, k, H, V, B, Z, ot) {
        return t = Lu(
          a,
          l,
          !0,
          t,
          r,
          o,
          h,
          ot,
          k,
          H,
          V,
          B
        ), t.context = Wu(null), a = t.current, l = fe(), l = _t(l), r = sa(l), r.callback = e ?? null, ua(a, r, l), e = l, t.current.lanes = e, K(t, e), De(t), t;
      }, dt.createPortal = function(t, e, a) {
        var l = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: el,
          key: l == null ? null : "" + l,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, dt.createRoleSelector = function(t) {
        return { $$typeof: li, value: t };
      }, dt.createTestNameSelector = function(t) {
        return { $$typeof: ni, value: t };
      }, dt.createTextSelector = function(t) {
        return { $$typeof: ii, value: t };
      }, dt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, dt.defaultOnRecoverableError = function(t) {
        kc(t);
      }, dt.defaultOnUncaughtError = function(t) {
        kc(t);
      }, dt.deferredUpdates = function(t) {
        var e = tt.T, a = Ie();
        try {
          return Xt(32), tt.T = null, t();
        } finally {
          Xt(a), tt.T = e;
        }
      }, dt.discreteUpdates = function(t, e, a, l, r) {
        var o = tt.T, d = Ie();
        try {
          return Xt(2), tt.T = null, t(e, a, l, r);
        } finally {
          Xt(d), tt.T = o, mt === 0 && ($l = oe() + 500);
        }
      }, dt.findAllNodes = br, dt.findBoundingRects = function(t, e) {
        if (!Gl) throw Error(c(363));
        e = br(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(rf(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, o = a.y, d = o + a.height, h = e - 1; 0 <= h; h--)
            if (e !== h) {
              var k = t[h], H = k.x, V = H + k.width, B = k.y, Z = B + k.height;
              if (l >= H && o >= B && r <= V && d <= Z) {
                t.splice(e, 1);
                break;
              } else if (l !== H || a.width !== k.width || Z < o || B > d) {
                if (!(o !== B || a.height !== k.height || V < l || H > r)) {
                  H > l && (k.width += H - l, k.x = l), V < r && (k.width = r - H), t.splice(e, 1);
                  break;
                }
              } else {
                B > o && (k.height += B - o, k.y = o), Z < d && (k.height = d - B), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, dt.findHostInstance = Fu, dt.findHostInstanceWithNoPortals = function(t) {
        return t = p(t), t = t !== null ? x(t) : null, t === null ? null : Yl(t.stateNode);
      }, dt.findHostInstanceWithWarning = function(t) {
        return Fu(t);
      }, dt.flushPassiveEffects = Bl, dt.flushSyncFromReconciler = function(t) {
        var e = mt;
        mt |= 1;
        var a = tt.T, l = Ie();
        try {
          if (Xt(2), tt.T = null, t)
            return t();
        } finally {
          Xt(l), tt.T = a, mt = e, (mt & 6) === 0 && Fa(0);
        }
      }, dt.flushSyncWork = ju, dt.focusWithin = function(t, e) {
        if (!Gl) throw Error(c(363));
        for (t = hr(t), e = ku(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!Ql(a)) {
            if ((l === 5 || l === 26 || l === 27) && uf(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, dt.getFindAllNodesFailureDescription = function(t, e) {
        if (!Gl) throw Error(c(363));
        var a = 0, l = [];
        t = [hr(t), 0];
        for (var r = 0; r < t.length; ) {
          var o = t[r++], d = o.tag, h = t[r++], k = e[h];
          if ((d !== 5 && d !== 26 && d !== 27 || !Ql(o)) && (gr(o, k) && (l.push(vr(k)), h++, h > a && (a = h)), h < e.length))
            for (o = o.child; o !== null; )
              t.push(o, h), o = o.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(vr(e[a]));
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
            return Yl(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, dt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Dm,
          rendererPackageName: qm,
          currentDispatcherRef: tt,
          reconcilerVersion: "19.2.0"
        };
        if (ac !== null && (t.rendererConfig = ac), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Vl = e.inject(t), ge = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, dt.isAlreadyRendering = function() {
        return (mt & 6) !== 0;
      }, dt.observeVisibleRects = function(t, e, a, l) {
        if (!Gl) throw Error(c(363));
        t = br(t, e);
        var r = cf(
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
        var r = Rs(t).queue;
        Os(
          t,
          r,
          e,
          ll,
          a === null ? u : function() {
            var o = Rs(t);
            return o.next === null && (o = t.alternate.memoizedState), Al(
              t,
              o.next.queue,
              {},
              fe()
            ), a(l);
          }
        );
      }, dt.updateContainer = function(t, e, a, l) {
        var r = e.current, o = fe();
        return Iu(
          r,
          o,
          t,
          e,
          a,
          l
        ), o;
      }, dt.updateContainerSync = function(t, e, a, l) {
        return Iu(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, dt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(mo)), mo.exports;
}
var Zc;
function Lp() {
  return Zc || (Zc = 1, co.exports = Jp()), co.exports;
}
var Wp = Lp();
const Fp = /* @__PURE__ */ Ho(Wp);
var ho = { exports: {} }, la = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Jc;
function Ip() {
  return Jc || (Jc = 1, la.ConcurrentRoot = 1, la.ContinuousEventPriority = 8, la.DefaultEventPriority = 32, la.DiscreteEventPriority = 2, la.IdleEventPriority = 268435456, la.LegacyRoot = 0, la.NoEventPriority = 0), la;
}
var Lc;
function $p() {
  return Lc || (Lc = 1, ho.exports = Ip()), ho.exports;
}
var on = $p();
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
const kd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], xo = 16, Nd = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Pp = [
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
], Wc = {
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
}, th = /* @__PURE__ */ new Set([
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
]), Td = {
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
}, Cd = {
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
}, wo = ["font-size", "color", ...new Set([...Object.keys(Td), ...Object.keys(Cd)].filter((n) => n !== "font-size" && n !== "color"))], eh = new Set(wo);
function ce(n, i = " ") {
  const s = [];
  let u = 0, c = "";
  for (let m = 0; m < n.length; m++) {
    const f = n[m];
    if (f === "(" ? u++ : f === ")" && u--, u === 0 && (i === " " ? /\s/.test(f) : f === i)) {
      (c.trim() || i !== " ") && s.push(c.trim()), c = "";
      continue;
    }
    c += f;
  }
  return (c.trim() || i !== " " && s.length) && s.push(c.trim()), s;
}
function _o(n, i, s = 0) {
  if (s > 32) return null;
  let u = "", c = 0;
  for (; ; ) {
    const m = n.indexOf("var(", c);
    if (m < 0)
      return u += n.slice(c), u;
    u += n.slice(c, m);
    let f = 1, p = m + 4;
    for (; p < n.length && f; p++)
      n[p] === "(" ? f++ : n[p] === ")" && f--;
    const w = n.slice(m + 4, p - 1), x = ce(w, ","), U = x[0].trim(), R = x.length > 1 ? w.slice(w.indexOf(",") + 1).trim() : null;
    let g = i(U);
    if ((g == null || g === "initial") && (g = R), g == null) return null;
    const T = _o(g, i, s + 1);
    if (T === null) return null;
    u += T, c = p;
  }
}
function ah(n) {
  const i = [], s = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let u, c = 0;
  for (; c < n.length; ) {
    if (s.lastIndex = c, u = s.exec(n), !u || u.index !== c) {
      if (/^\s+$/.test(n.slice(c))) break;
      return null;
    }
    c = s.lastIndex, u[1] !== void 0 ? i.push({ num: parseFloat(u[1]), unit: (u[2] ?? "").toLowerCase() }) : u[3] ? i.push({ fn: u[3].toLowerCase() }) : u[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: u[5] ?? u[6] });
  }
  return i;
}
function So(n, i) {
  const s = ah(n.trim());
  if (!s) return null;
  let u = 0;
  const c = ({ num: g, unit: T }) => {
    switch (T) {
      case "":
        return { px: 0, pct: 0, num: g, unitless: !0 };
      case "px":
        return { px: g, pct: 0, num: 0 };
      case "rem":
        return { px: g * xo, pct: 0, num: 0 };
      case "em":
        return { px: g * (i.fontSize ?? xo), pct: 0, num: 0 };
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
  }, m = (g, T, b) => g && T ? { px: g.px + b * T.px, pct: g.pct + b * T.pct, num: g.num + b * T.num, unitless: g.unitless && T.unitless } : null, f = (g, T) => g ? { px: g.px * T, pct: g.pct * T, num: g.num * T, unitless: g.unitless } : null, p = (g) => g && g.unitless;
  function w() {
    const g = s[u++];
    if (!g) return null;
    if (g.num !== void 0) return c(g);
    if (g.op === "(") {
      const T = U();
      return s[u]?.op !== ")" ? null : (u++, T);
    }
    if (g.op === "-" || g.op === "+") {
      const T = w();
      return g.op === "-" ? f(T, -1) : T;
    }
    if (g.fn) {
      const T = [];
      for (; ; ) {
        T.push(U());
        const A = s[u++];
        if (!A) return null;
        if (A.op === ")") break;
        if (A.op !== ",") return null;
      }
      if (T.some((A) => !A)) return null;
      if (g.fn === "calc") return T[0];
      if (!(T.every((A) => !A.pct) || T.every((A) => !A.px && !A.num))) return null;
      const j = (A) => A.px + A.pct + A.num;
      return g.fn === "min" ? T.reduce((A, M) => j(M) < j(A) ? M : A) : g.fn === "max" ? T.reduce((A, M) => j(M) > j(A) ? M : A) : g.fn === "clamp" && T.length === 3 ? j(T[1]) < j(T[0]) ? T[0] : j(T[1]) > j(T[2]) ? T[2] : T[1] : null;
    }
    return null;
  }
  function x() {
    let g = w();
    for (; s[u] && (s[u].op === "*" || s[u].op === "/"); ) {
      const T = s[u++].op, b = w();
      if (!g || !b) return null;
      T === "*" ? g = p(b) ? f(g, b.num) : p(g) ? f(b, g.num) : null : g = p(b) && b.num !== 0 ? f(g, 1 / b.num) : null;
    }
    return g;
  }
  function U() {
    let g = x();
    for (; s[u] && (s[u].op === "+" || s[u].op === "-"); ) {
      const T = s[u++].op;
      g = m(g, x(), T === "-" ? -1 : 1);
    }
    return g;
  }
  const R = U();
  return u !== s.length || !R ? null : R;
}
function zo(n, i) {
  const s = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(s))
    return s === "thin" ? { px: 1 } : s === "medium" ? { px: 3 } : s === "thick" ? { px: 5 } : s;
  const u = So(s, i);
  return u ? u.unitless ? u.num === 0 ? { px: 0 } : { expr: n.trim() } : u.pct && (u.px || u.num) ? { expr: n.trim() } : u.pct ? { pct: u.pct } : { px: lh(u.px) } : { expr: n.trim() };
}
const lh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, ui = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), nh = ([n, i, s, u]) => `#${ui(n)}${ui(i)}${ui(s)}${ui(u * 255)}`;
function Fc(n) {
  const i = n.slice(1), s = i.length <= 4 ? i.split("").map((c) => c + c).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
  const u = (c) => parseInt(s.slice(c, c + 2), 16);
  return [u(0), u(2), u(4), s.length === 8 ? u(6) / 255 : 1];
}
function gi(n, i) {
  const s = n.trim().toLowerCase();
  if (s === "currentcolor") return "currentcolor";
  const u = /^perchtoken\(([a-z0-9-]+)\)$/.exec(s);
  if (u) {
    const x = i(u[1]), U = x && Fc(x);
    return U ? { rgba: U, token: u[1] } : null;
  }
  if (s.startsWith("#")) {
    const x = Fc(s);
    return x ? { rgba: x, token: null } : null;
  }
  if (Wc[s]) return { rgba: [...Wc[s]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(s);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const x = ce(c[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const U = (Ot) => {
      const Lt = ce(Ot), Nt = Lt.findIndex((at) => /%$/.test(at)), q = Nt >= 0 ? parseFloat(Lt[Nt]) / 100 : null;
      return { color: gi(Lt.filter((at, it) => it !== Nt).join(" "), i), pct: q };
    }, R = U(x[1]), g = U(x[2]);
    if (!R.color || !g.color || R.color === "currentcolor" || g.color === "currentcolor") return null;
    let T = R.pct, b = g.pct;
    T === null && b === null ? (T = 0.5, b = 0.5) : T === null ? T = 1 - b : b === null && (b = 1 - T);
    const j = T + b, A = j < 1 ? j : 1;
    T /= j, b /= j;
    const [M, N, C, O] = R.color.rgba, [X, K, E, S] = g.color.rgba, G = O * T + S * b, ct = (Ot, Lt) => G === 0 ? 0 : (Ot * O * T + Lt * S * b) / G, _t = [ct(M, X), ct(N, K), ct(C, E), G * A], Et = S === 0 ? R.color.token : O === 0 ? g.color.token : null;
    return { rgba: _t, token: Et };
  }
  const m = c[2].includes(",") ? ce(c[2], ",") : ce(c[2].replace("/", " / ")).filter((x) => x !== "/");
  if (m.length < 3) return null;
  const f = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), p = m[3] === void 0 ? 1 : m[3].endsWith("%") ? parseFloat(m[3]) / 100 : parseFloat(m[3]), w = [f(m[0]), f(m[1]), f(m[2]), p];
  return w.some((x) => Number.isNaN(x)) ? null : { rgba: w, token: null };
}
const nn = ["top", "right", "bottom", "left"], ih = ["top-left", "top-right", "bottom-right", "bottom-left"], ci = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Ic = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Eo(n, i) {
  const s = i.trim(), u = () => ce(s);
  switch (n) {
    case "padding":
    case "margin": {
      const c = ci(u());
      return nn.map((m, f) => [`${n}-${m}`, c[f]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const c = u(), m = n.split("-")[0];
      return [[`${m}-left`, c[0]], [`${m}-right`, c[1] ?? c[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const c = u(), m = n.split("-")[0];
      return [[`${m}-top`, c[0]], [`${m}-bottom`, c[1] ?? c[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${n.split("-")[0]}-left`, s]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, s]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, s]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, s]];
    case "inset": {
      const c = ci(u());
      return nn.map((m, f) => [m, c[f]]);
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
      return [["left", s]];
    case "inset-inline-end":
      return [["right", s]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const c = n.split("-")[1], m = ci(u());
      return nn.map((f, p) => [`border-${f}-${c}`, m[p]]);
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
      const c = n === "border" ? nn : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let m = "medium", f = "none", p = "currentcolor";
      if (s !== "none" && s !== "0")
        for (const w of u())
          Ic.has(w) ? f = w : /^(thin|medium|thick|-?[\d.]|calc\()/.test(w) ? m = w : p = w;
      else s === "0" && (m = "0");
      return c.flatMap((w) => [[`border-${w}-width`, m], [`border-${w}-style`, f], [`border-${w}-color`, p]]);
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
      const c = ci(ce(s.split("/")[0]));
      return ih.map((m, f) => [`border-${m}-radius`, c[f]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", s]];
    case "border-start-end-radius":
      return [["border-top-right-radius", s]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", s]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", s]];
    case "background":
      return s === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : gi(s, () => "#000000") ? [["background-color", s], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", s]];
    case "overflow": {
      const c = u();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = u();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return Eo("gap", s);
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
      if (s === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (s === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (s === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const c = u(), m = c.filter((p) => /^[\d.]+$/.test(p)), f = c.find((p) => !/^[\d.]+$/.test(p));
      return [["flex-grow", m[0] ?? "1"], ["flex-shrink", m[1] ?? "1"], ["flex-basis", f ?? (m.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const c = [];
      for (const m of u()) c.push(/wrap/.test(m) ? ["flex-wrap", m] : ["flex-direction", m]);
      return c;
    }
    case "outline": {
      if (s === "none" || s === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let c = "medium", m = "none", f = "currentcolor";
      for (const p of u())
        Ic.has(p) || p === "auto" ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? c = p : f = p;
      return [["outline-width", c], ["outline-style", m], ["outline-color", f]];
    }
    case "transition": {
      if (s === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = ce(s, ","), m = c.map((p) => ce(p).find((w) => !/^[\d.]+m?s$/.test(w) && !/^(ease|linear|step|cubic)/.test(w)) ?? "all"), f = c.map((p) => ce(p).find((w) => /^[\d.]+m?s$/.test(w)) ?? "0s");
      return [["transition-property", m.join(", ")], ["transition-duration", f.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", u()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", s]];
    case "word-wrap":
      return [["overflow-wrap", s]];
    default:
      return [[n, s]];
  }
}
function rh(n, i) {
  return n ? ce(n, ",").some((s) => {
    let u = s.trim().toLowerCase(), c = !1;
    u.startsWith("not ") && (c = !0, u = u.slice(4)), u.startsWith("only ") && (u = u.slice(5));
    const m = u.split(/\s+and\s+/).every((f) => {
      if (f = f.trim(), f === "all" || f === "screen") return !0;
      if (f === "print") return !1;
      const p = /^\((.+)\)$/.exec(f);
      if (!p) return !1;
      const w = p[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(w);
      if (x) {
        const [, R, g] = x, T = (b) => {
          const j = zo(b, { viewport: i });
          return typeof j == "object" && "px" in j ? j.px : NaN;
        };
        switch (R) {
          case "min-width":
            return i.width >= T(g);
          case "max-width":
            return i.width <= T(g);
          case "min-height":
            return i.height >= T(g);
          case "max-height":
            return i.height <= T(g);
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
      const U = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(w);
      if (U) {
        const R = U[1] === "width" ? i.width : i.height, g = zo(U[3], { viewport: i }), T = typeof g == "object" && "px" in g ? g.px : NaN;
        switch (U[2]) {
          case ">=":
            return R >= T;
          case "<=":
            return R <= T;
          case ">":
            return R > T;
          case "<":
            return R < T;
          default:
            return R === T;
        }
      }
      return !1;
    });
    return c ? !m : m;
  }) : !0;
}
function oh(n, i) {
  const s = i[i.length - 1].compound;
  return Uo(s)[0] ?? n;
}
function sh(n) {
  const i = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), u = (c, m) => {
    c.forEach(({ compound: f }, p) => {
      const w = m && p === c.length - 1;
      for (const x of f.pseudos)
        if (Nd.has(x.name) && (w ? i : s).add(x.name), x.list && x.name !== "not") for (const U of x.list) u(U, w);
    });
  };
  return u(n, !0), { subject: i, ancestor: s };
}
function Uo(n) {
  const i = [...n.classes];
  for (const s of n.pseudos)
    if (!(s.name !== "is" && s.name !== "where"))
      for (const u of s.list) u.length === 1 && i.push(...Uo(u[0].compound));
  return i;
}
function uh(n, i) {
  const s = (u, c) => {
    u.forEach(({ compound: m }, f) => {
      const p = c && f === u.length - 1, w = m.pseudos.filter((x) => Nd.has(x.name)).map((x) => x.name);
      if (!p) for (const x of w) for (const U of Uo(m)) i.add(`${x}:${U}`);
      for (const x of m.pseudos) if (x.list && x.name !== "not") for (const U of x.list) s(U, p);
    });
  };
  s(n, !0);
}
class ch {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const s = (m, f) => {
      const p = f[f.length - 1].compound, w = p.classes.length ? `.${p.classes[0]}` : p.tag && p.tag !== "*" ? p.tag : "*";
      this.index.has(w) || this.index.set(w, []), this.index.get(w).push(m);
    };
    let u = 0;
    const c = (m, f) => {
      for (const [p, w, x, U] of m)
        for (const R of Mo(p)) {
          let g;
          try {
            g = Ao(R);
          } catch (j) {
            if (j instanceof _e) {
              this.skipped++;
              continue;
            }
            throw j;
          }
          const T = sh(g);
          uh(g, this.trackedStates);
          const b = { steps: g, media: w, layer: x, origin: f, order: u++, specificity: wd(g), decls: U, states: T, source: f === 0 ? `ua:${g[g.length - 1].compound.tag ?? "*"}` : oh(R, g) };
          this.rules.push(b), s(b, g);
        }
    };
    c(Pp.map(([m, f]) => [m, null, 0, Object.entries(f)]), 0), c(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const s = [], u = /* @__PURE__ */ new Set(), c = (m) => {
      if (m) for (const f of m) u.has(f) || (u.add(f), s.push(f));
    };
    for (const m of i.classList) c(this.index.get(`.${m}`));
    return c(this.index.get(i.tagName)), c(this.index.get("*")), s;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, s) {
    for (const u of i.classList) if (this.trackedStates.has(`${s}:${u}`)) return !0;
    return !1;
  }
}
const dh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function mh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [s, u] of Object.entries(n)) {
    if (u == null || u === "" || typeof u == "boolean") continue;
    const c = s.startsWith("--") ? s : s.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), m = typeof u == "number" && u !== 0 && !dh.has(c) && !c.startsWith("--") ? `${u}px` : String(u);
    i.push([c, m]);
  }
  return i;
}
function fh(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const s of ["width", "height"]) {
    const u = n.getAttribute(s);
    u !== null && i.push([s, /^[\d.]+$/.test(u) ? `${u}px` : u]);
  }
  return i;
}
const ph = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class hh {
  constructor(i, { theme: s, viewport: u }) {
    this.sheet = i, this.theme = s, this.viewport = u, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, s) {
    const u = (c, m, f) => {
      if (m === "disabled") return !!c.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(c.tagName);
      if (m === "enabled") return !c.props?.disabled && ["button", "input", "select", "textarea"].includes(c.tagName);
      if (m === "checked") return !!c.props?.checked;
      if (s === "*") return !0;
      if (m === "focus-within") {
        const p = c.ownerDocument?.activeElement;
        return !!p && p !== c.ownerDocument.body && typeof c.contains == "function" && c.contains(p);
      }
      return f ? s.has(m) : m === "focus-visible" ? !!c.state?.focus : !!c.state?.[m];
    };
    return this.sheet.candidates(i).filter((c) => (!c.media || c.media.every((m) => rh(m, this.viewport))) && _d(i, c.steps, { state: u }));
  }
  compute(i, s, u = /* @__PURE__ */ new Set()) {
    const c = this.matching(i, u), m = [];
    for (const E of c)
      for (const [S, G, ct] of E.decls) m.push({ prop: S, value: G, important: ct ? 1 : 0, origin: E.origin === 0 ? 0 : 2, layer: E.layer, specificity: E.specificity, order: E.order, source: E.source });
    for (const [E, S] of fh(i)) m.push({ prop: E, value: S, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${E}` });
    for (const [E, S] of mh(i.props?.style)) m.push({ prop: E, value: S, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    m.sort(ph);
    const f = this.sheet.properties, p = Object.create(s?.customs ?? null), w = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const E of m) E.prop.startsWith("--") && x.set(E.prop, E.value);
    if (!s && this.theme) for (const E of kd) this.theme[E] && x.set(`--${E}`, `perchtoken(${E})`);
    const U = (E) => {
      if (w.has(E)) return w.get(E);
      const S = f[E];
      return S && !S.inherits ? S.initial ?? null : E in p ? p[E] : S?.initial ?? null;
    }, R = /* @__PURE__ */ new Set(), g = (E) => {
      if (!x.has(E)) return U(E);
      if (R.has(E)) return null;
      R.add(E);
      const S = _o(x.get(E), g);
      return R.delete(E), x.delete(E), w.set(E, S), (!f[E] || f[E].inherits) && (p[E] = S), S;
    };
    for (const E of [...x.keys()]) g(E);
    const T = /* @__PURE__ */ new Map();
    for (const E of m) {
      if (E.prop.startsWith("--")) continue;
      const S = _o(E.value, U);
      if (S === null) {
        for (const [G] of Eo(E.prop, "unset")) T.set(G, { value: "unset", source: E.source, origin: E.origin });
        continue;
      }
      for (const [G, ct] of Eo(E.prop, S)) T.set(G, { value: ct, source: E.source, origin: E.origin });
    }
    const b = {}, j = {}, A = /* @__PURE__ */ new Set(), M = /* @__PURE__ */ new Set(), N = s?.values, C = { fontSize: N?.["font-size"] ?? xo, viewport: this.viewport }, O = (E, S) => {
      if (/currentcolor/i.test(S)) return this.parseValue(E, S, C, b, N);
      const G = `${E}\0${S}\0${C.fontSize}`;
      let ct = this.parsed.get(G);
      return ct === void 0 && this.parsed.set(G, ct = this.parseValue(E, S, C, b, N)), ct;
    }, X = T.size ? [...wo, ...[...T.keys()].filter((E) => !eh.has(E))] : wo;
    for (const E of X) {
      const S = T.get(E);
      let G = S?.value;
      const ct = th.has(E);
      if ((G === void 0 || G === "unset" || G === "revert" || G === "revert-layer") && (G = ct ? "inherit" : "initial"), S && (j[E] = S.source, S.origin !== 0 && A.add(E)), G === "inherit" && N && E in N) {
        b[E] = N[E], M.add(E);
        continue;
      }
      (G === "inherit" || G === "initial") && (G = ct ? Cd[E] : Td[E]), b[E] = O(E, G), E === "font-size" && (C.fontSize = b["font-size"]);
    }
    for (const E of nn) {
      const S = b[`border-${E}-style`];
      (S === "none" || S === "hidden") && (b[`border-${E}-width`] = { px: 0 });
    }
    b["outline-style"] === "none" && (b["outline-width"] = { px: 0 });
    const K = N?.display;
    return (K === "flex" || K === "inline-flex" || K === "grid" || K === "inline-grid") && b.position !== "absolute" && b.position !== "fixed" && (b.display = $c(b.display)), (b.position === "absolute" || b.position === "fixed") && (b.display = $c(b.display)), { values: b, sources: j, own: A, inherited: M, customs: p, rules: c, element: i };
  }
  parseValue(i, s, u, c, m) {
    const f = String(s).trim();
    switch (i) {
      case "font-size": {
        const p = f.toLowerCase(), w = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (w[p]) return w[p];
        if (p === "smaller") return u.fontSize / 1.2;
        if (p === "larger") return u.fontSize * 1.2;
        const x = So(p, { fontSize: u.fontSize, viewport: u.viewport });
        return !x || x.num ? u.fontSize : x.px + x.pct / 100 * u.fontSize;
      }
      case "font-weight": {
        const p = f.toLowerCase();
        if (p === "normal") return 400;
        if (p === "bold") return 700;
        if (p === "bolder") return (m?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (p === "lighter") return (m?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const w = parseFloat(p);
        return Number.isFinite(w) ? w : 400;
      }
      case "line-height": {
        const p = f.toLowerCase();
        if (p === "normal") return { normal: !0 };
        const w = So(p, { fontSize: u.fontSize, viewport: u.viewport });
        return w ? w.unitless ? { factor: w.num } : { px: w.px + w.pct / 100 * u.fontSize } : { normal: !0 };
      }
      case "font-family":
        return f;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const p = f.endsWith("%") ? parseFloat(f) / 100 : parseFloat(f);
        return Number.isFinite(p) ? p : parseFloat(i === "flex-shrink" || i === "opacity" ? 1 : 0);
      }
      case "color": {
        const p = gi(f, (w) => this.themeHex(w));
        return p === "currentcolor" || !p ? m?.color ?? { rgba: [0, 0, 0, 1], token: null } : p;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const p = gi(f, (w) => this.themeHex(w));
        return p === "currentcolor" ? c.color : p ?? { rgba: [0, 0, 0, 0], token: null, unreadable: f };
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
        return zo(f, u);
      default:
        return f.toLowerCase().startsWith("var(") ? f : /^[a-z-]+$/i.test(f) ? f.toLowerCase() : f;
    }
  }
}
function $c(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const vi = (n) => n && n.rgba ? { value: nh(n.rgba), token: n.token ?? null } : null, gh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function vh(n, i) {
  const s = i?.(n);
  if (Number.isFinite(s)) return s;
  const u = Math.round(n * 100) / 100;
  return gh[u] ?? Math.round(n * 1.2);
}
function jd(n, i) {
  const s = n["line-height"], u = n["font-size"];
  return s.normal ? vh(u, i) : s.factor !== void 0 ? s.factor * u : s.px;
}
const bh = (n) => ce(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const yh = "perch-native-description/1", di = Symbol("display"), bi = {
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
}, xh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of xh) bi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
bi.rounded = 0;
const wh = /* @__PURE__ */ new Set([
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
]), _h = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Sh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, zh = (n) => Sh.test(n) ? "Menlo" : _h.test(n) ? ".SystemUIFont" : bh(n).split(",")[0].trim(), Eh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Pc = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Md = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const s = n.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? n.classList[0];
  if (s) return `${n.tagName}.${s}`;
  const u = n.parentElement;
  return u && u.tagName !== "body" ? `${Md(u)} > ${n.tagName}` : n.tagName;
};
class kh {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, s, u, c, m, f = "") {
    const p = `${i}|${s}|${u}|${c}`, w = this.map.get(p);
    if (w) {
      !w.elements.includes(m) && w.elements.length < 4 && w.elements.push(m), w.count++;
      return;
    }
    this.map.set(p, { kind: i, property: s, value: String(u), class: c ?? null, elements: [m], count: 1, ...f ? { note: f } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, s) => i.kind < s.kind ? -1 : i.kind > s.kind ? 1 : i.property < s.property ? -1 : i.property > s.property ? 1 : 0);
  }
}
const ia = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
};
function td(n, i) {
  const s = n.values, u = {}, c = (M) => n.sources[M], m = (M) => n.sources[M] !== void 0, f = s.display;
  f === "none" ? u.display = "hidden" : f === "flex" || f === "inline-flex" ? u.display = "flex" : (f === "grid" || f === "inline-grid") && (u.display = "flex", u.flex_direction = "col", i("approximated", "display", f, c("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", s["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (u.display = "hidden");
  const p = u.display === "flex";
  if (p && u.flex_direction !== "col") {
    const M = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    u.flex_direction = M;
  }
  if (p) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (u.flex_wrap = "wrap");
    const M = f === "grid" || f === "inline-grid", N = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    N && (u.items = N);
    let C = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (M) {
      const K = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      K && (u.items = K), s["align-items"] === "center" && (C = "center");
    }
    C && (u.justify = C);
    const O = ia(s["row-gap"]), X = ia(s["column-gap"]);
    typeof O == "number" && O && (u.gap_y = O), typeof X == "number" && X && !M && (u.gap_x = X);
  }
  s["flex-grow"] && (u.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (u.flex_shrink = s["flex-shrink"]);
  const w = ia(s["flex-basis"]);
  w !== void 0 && w !== "auto" && (u.flex_basis = w);
  const x = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  x && (u.self = x);
  for (const [M, N] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const C = s[N], O = ia(C);
    if (O === void 0) {
      typeof C == "object" && C.expr ? i("unsupported", N, C.expr, c(N), "no calc() in the engine") : typeof C == "string" && !["auto", "none"].includes(C) && i("unsupported", N, C, c(N));
      continue;
    }
    O !== "auto" && (u[M] = O);
  }
  const U = ["top", "right", "bottom", "left"];
  for (const M of U) {
    const N = M[0];
    for (const [C, O] of [["p", "padding"], ["m", "margin"]]) {
      const X = s[`${O}-${M}`], K = ia(X);
      if (K === void 0) {
        X?.expr && i("unsupported", `${O}-${M}`, X.expr, c(`${O}-${M}`), "no calc() in the engine");
        continue;
      }
      K !== 0 && (u[`${C}${N}`] = K);
    }
  }
  const R = s.position;
  if (R === "absolute" || R === "fixed") {
    u.position = "absolute", R === "fixed" && i("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const M of U) {
      const N = ia(s[M]);
      N !== void 0 && N !== "auto" && (u[M] = N);
    }
  } else R === "sticky" && i("unsupported", "position", "sticky", c("position"));
  s["z-index"] !== "auto" && m("z-index") && i("unsupported", "z-index", s["z-index"], c("z-index"), "paint order is tree order");
  for (const [M, N] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const C = s[N];
    C === "hidden" || C === "clip" ? u[M] = "hidden" : (C === "auto" || C === "scroll") && (u[M] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (u.visibility = "invisible");
  const g = s["background-color"];
  g?.unreadable ? i("unsupported", "background-color", g.unreadable, c("background-color")) : g?.rgba && g.rgba[3] > 0 && (u.bg = vi(g)), s["background-image"] && s["background-image"] !== "none" && i("unsupported", "background-image", s["background-image"], c("background-image"));
  const T = U.map((M) => ia(s[`border-${M}-width`]) || 0), b = [];
  U.forEach((M, N) => {
    if (!T[N]) return;
    u[`border_${M[0]}`] = T[N];
    const C = s[`border-${M}-style`];
    C !== "solid" && i("approximated", `border-${M}-style`, C, c(`border-${M}-style`), "drawn solid");
    const O = vi(s[`border-${M}-color`]);
    O && b.push(O);
  }), b.length && (u.border_color = b[0], b.some((M) => M.value !== b[0].value) && i("approximated", "border-color", b.map((M) => M.value).join(" "), c("border-top-color"), "one border colour"));
  const j = ["top-left", "top-right", "bottom-right", "bottom-left"].map((M) => ia(s[`border-${M}-radius`]) || 0);
  j.every((M) => M === j[0]) ? j[0] && (u.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((M, N) => {
    j[N] && (u[`rounded_${M}`] = j[N]);
  }), s.opacity !== 1 && (u.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const A = s["box-shadow"];
  if (A && A !== "none" && ce(A, ",").some((M) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(M.trim())) && (u.shadow = "lg", i("approximated", "box-shadow", A, c("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !n.inherited.has("cursor")) {
    const M = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    M ? u.cursor = M : i("unsupported", "cursor", s.cursor, c("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (u.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? u.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", s["text-decoration-line"], c("text-decoration-line")), u;
}
function ed(n, i) {
  const s = n.values, u = s["line-height"];
  return {
    text_color: vi(s.color),
    text_size: Math.round(s["font-size"] * 1e3) / 1e3,
    font_weight: s["font-weight"],
    line_height: u.factor !== void 0 ? { factor: u.factor } : { px: Math.round(jd(s, i) * 1e3) / 1e3 },
    font_family: zh(s["font-family"]),
    italic: s["font-style"] === "italic" || s["font-style"] === "oblique",
    whitespace: s["white-space"] === "nowrap" || s["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[s["text-align"]] ?? "left"
  };
}
const ad = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, Ad = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function ld(n, i, s) {
  const u = {}, c = (p, w) => w.some((x) => !n.inherited.has(x));
  for (const [p, w] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]]])
    (c(p, w) || !Ad(i[p], s[p])) && (u[p] = i[p]);
  const m = ad(i.line_height, i.text_size), f = s.line_height ? ad(s.line_height, i.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(m - f) <= 1e-3)) && (u.line_height = i.line_height), u;
}
const Nh = (n, i) => ({ ...n, ...i });
function nd(n, i) {
  const s = {};
  for (const [u, c] of Object.entries(n))
    c && typeof c == "object" && "value" in c ? (s[u] = c.value, c.token && (i[u] = c.token)) : u === "line_height" ? s[u] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : u === "italic" ? c && (s.italic = !0) : s[u] = c;
  return s.italic === !1 && delete s.italic, s;
}
function Th(n, i) {
  const s = {};
  for (const u of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const c = n[u], m = i[u];
    Ad(c, m) || (s[u] = m === void 0 ? u in bi ? bi[u] : null : m);
  }
  return s;
}
function id(n, i) {
  const s = n.values;
  for (const [u, c] of Object.entries(n.sources)) {
    if (u.startsWith("--") || wh.has(u) || c.startsWith("ua:")) continue;
    const m = s[u];
    switch (u) {
      case "letter-spacing":
        m !== "normal" && m?.px !== 0 && i("approximated", u, m?.px !== void 0 ? `${Math.round(m.px * 1e3) / 1e3}px` : m, c, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        m !== "normal" && i("unsupported", u, m, c, "no font features in the engine");
        break;
      case "text-transform":
        m !== "none" && i("approximated", u, m, c, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const f = s["transition-duration"];
        u === "transition-property" && f && ce(f, ",").some((p) => parseFloat(p) > 0) && s["transition-property"] !== "none" && i("unsupported", "transition", `${s["transition-property"]} ${f}`, c, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        m !== "none" && i("unsupported", u, m, c, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        u === "overflow-wrap" && m !== "normal" && i("unsupported", u, m, c);
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        s["outline-style"] !== "none" && u === "outline-style" && i("unsupported", "outline", `${ia(s["outline-width"])}px ${s["outline-style"]} ${vi(s["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
        break;
      case "transform":
      case "translate":
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
        m && m !== "none" && m !== "auto" && m !== "normal" && m !== "initial" && i("unsupported", u, m, c);
        break;
    }
  }
}
function Ch(n, i, s, u) {
  const c = Md(n), m = [], f = (A, M, N, C, O) => m.push([A, M, N, C ?? "(user agent)", c, O]), p = u.cascade.compute(n, i), w = {}, x = td(p, f);
  id(p, f);
  const U = ed(p, u.measure), R = ld(p, U, s), g = nd({ ...x, ...R }, w), T = {}, b = u.cascade.matching(n, "*").filter((A) => A.states.subject.size);
  for (const [A, M] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!b.some((K) => M.some((E) => K.states.subject.has(E)))) continue;
    const N = u.cascade.compute(n, i, new Set(M)), C = {}, O = nd({ ...td(N, () => {
    }), ...ld(N, ed(N, u.measure), s) }, C);
    A === "focus" && id(N, f);
    const X = Th(g, O);
    if (Object.keys(X).length) {
      T[A] = X;
      const K = Object.fromEntries(Object.entries(C).filter(([E]) => E in X));
      Object.keys(K).length && (T[`${A}_tokens`] = K);
    }
  }
  u.cascade.sheet.tracks(n, "hover") && (T.track_hover = !0);
  const j = Object.entries(Eh).filter(([, A]) => A.some((M) => typeof n.props[M] == "function")).map(([A]) => A);
  return j.length && (T.events = j), { computed: p, style: g, tokens: w, extra: T, meta: Oh(n), reports: m, childText: Nh(s, R), where: c };
}
function Od(n, i, s, u, c = "") {
  const m = `${c}/${n.id}.${n.version}`;
  let f = u.cache.get(n);
  (!f || f.key !== m) && u.cache.set(n, f = { key: m, part: Ch(n, i, s, u) });
  const { computed: p, tokens: w, extra: x, reports: U, childText: R, where: g } = f.part;
  for (const S of U) u.findings.add(...S);
  const T = (S, G, ct, _t, Et) => u.findings.add(S, G, ct, _t, g, Et), b = { ...f.part.style }, j = { kind: "div", id: n.id, style: b, tokens: w, meta: f.part.meta, ...x };
  Object.defineProperty(j, di, { value: p.values.display });
  const A = n.tagName;
  if (A === "svg")
    return j.kind = n.props["data-perch-image"] ? "image" : "svg", j.markup = Hh(n), j;
  if (A === "input" || A === "textarea" || A === "select") {
    j.kind = "input", j.input_type = A === "input" ? String(n.props.type ?? "text") : A;
    for (const S of ["value", "defaultValue", "placeholder", "checked", "disabled"]) n.props[S] !== void 0 && (j[S === "defaultValue" ? "value" : S] = n.props[S]);
    return j;
  }
  if (A === "img")
    return j.kind = "image", j.src = n.props.src ?? null, j;
  const M = p.values["text-transform"], N = [];
  let C = !1, O = !1;
  for (const S of n.childNodes) {
    if (S instanceof Ro) {
      if (S.hidden || S.data === "") continue;
      C = !0;
      const _t = N[N.length - 1];
      if (_t?.kind === "text")
        _t.source = (_t.source ?? _t.text) + S.data, _t.text = rd(_t.source, M), _t.text === _t.source && delete _t.source;
      else {
        const Et = rd(S.data, M);
        N.push(Et === S.data ? { kind: "text", text: Et } : { kind: "text", text: Et, source: S.data });
      }
      continue;
    }
    if (!(S instanceof Se)) continue;
    const G = Od(S, p, R, u, m), ct = G[di];
    ct === "inline" || ct === "inline-block" || ct === "inline-flex" ? C = !0 : ct !== "none" && (O = !0), N.push(G);
  }
  const X = N.some((S) => S.kind !== "text"), K = N.length === 1 && N[0].kind !== "text" && /^inline-(block|flex)$/.test(N[0][di]) ? N[0] : null;
  if (!b.display && K) {
    const S = u.cache.get(n.childNodes.find((ct) => ct.id === K.id))?.part.computed, G = S ? Hd(p.values, u.measure) - Ah(S.values, u.measure) : 0;
    b.display = "flex", b.flex_direction = "col", b.items = "start", G > 0 && (K.style.mt = Math.round(((K.style.mt ?? 0) + G) * 100) / 100), T("approximated", "display", `${p.values.display} holding one ${K[di]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else !b.display && C && X && (b.display = "flex", b.flex_direction = O ? "col" : "row", O || (b.items = "baseline"), T("approximated", "display", `${p.values.display} with inline content`, "(inline formatting)", O ? "a column of its children" : "a row on the text baseline"));
  const E = p.values["letter-spacing"]?.px;
  if (E)
    for (let S = 0; S < N.length; S++) {
      const G = N[S];
      if (G.kind !== "text") continue;
      const ct = Math.round(E * [...G.text].length * 1e3) / 1e3;
      N[S] = { kind: "div", style: { pr: ct }, tokens: {}, children: [G] };
    }
  return j.children = N, j;
}
function jh(n, i) {
  if (!i) return null;
  let u = (i.self ? n : i.closest ? Sd(n, i.closest) : i.find ? hi(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return u && i.strip && u.startsWith(i.strip) && (u = u.slice(i.strip.length)), u;
}
function Mh(n, i, s) {
  const u = i.map((m) => [m, _i(m.selector)]), c = (m) => {
    for (const f of m.children) {
      const p = s.get(f.id);
      if (p)
        for (const [w, x] of u) {
          const U = w.textRange ? "range_name" : "name";
          if (p[U] != null || !x.some((g) => _d(f, g))) continue;
          const R = jh(f, w.key);
          p[U] = R == null ? w.name : `${w.name}:${R}`;
        }
      c(f);
    }
  };
  c(n.documentElement);
}
const yi = 0.9521, Rd = 0.2256, Hd = (n, i) => (jd(n, i) - (yi + Rd) * n["font-size"]) / 2 + yi * n["font-size"];
function Ah(n, i) {
  const s = (c) => c && typeof c == "object" && "px" in c ? c.px : 0, u = n["border-top-style"] === "none" ? 0 : s(n["border-top-width"]);
  return s(n["padding-top"]) + u + Hd(n, i);
}
const rd = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (s) => s.toUpperCase()) : n, Ud = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Oh(n) {
  const i = {};
  for (const [s, u] of Object.entries(n.props)) {
    if (Ud.has(s) || typeof u == "function" || u === void 0 || u === null || typeof u == "object") continue;
    const c = s.startsWith("aria-") || s.startsWith("data-");
    if (u === !1 && !c) continue;
    const m = s === "htmlFor" ? "for" : s === "tabIndex" ? "tabindex" : s;
    i[m] = typeof u == "boolean" ? c ? String(u) : "" : String(u);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const Rh = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), od = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Hh(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (s) => {
    const u = [];
    for (const [m, f] of Object.entries(s.props))
      Ud.has(m) || typeof f == "function" || f === void 0 || f === null || f === !1 || typeof f == "object" || m.startsWith("data-") || m.startsWith("aria-") || m === "focusable" || m === "role" || m === "title" || u.push(`${Rh(m)}="${od(f === !0 ? "" : f)}"`);
    s.tagName === "svg" && !s.props.xmlns && u.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = s.childNodes.map((m) => m instanceof Ro ? od(m.data) : i(m)).join("");
    return `<${s.tagName}${u.length ? ` ${u.join(" ")}` : ""}>${c}</${s.tagName}>`;
  };
  return i(n);
}
function Uh(n) {
  const i = n.theme?.() ?? {}, s = {};
  for (const u of kd) i[u] && (s[u] = i[u]);
  return s;
}
const Dh = {};
function qh(n, i, s, u = {}, c = null) {
  const m = Uh(i), f = i.viewport?.() ?? { width: 1e3, height: 800 }, p = JSON.stringify([m, f]);
  (u.look !== p || u.sheet !== s) && Object.assign(u, { look: p, sheet: s, cache: /* @__PURE__ */ new WeakMap(), cascade: new hh(s, { theme: m, viewport: f }), top: null });
  const { cascade: w, cache: x } = u, U = { cascade: w, cache: x, findings: new kh(), measure: i.lineHeight ? (T) => i.lineHeight(T) : null };
  u.top ??= w.compute(n.body, w.compute(n.documentElement, null));
  const R = n.body.children.map((T) => Od(T, u.top, Dh, U));
  if (c?.length) {
    const T = /* @__PURE__ */ new Map(), b = (j) => {
      j.id && T.set(j.id, j);
      for (const A of j.children ?? []) b(A);
    };
    R.forEach(b), Mh(n, c, T);
  }
  const g = /* @__PURE__ */ new Set();
  for (const T of [n, n.defaultView])
    for (const { type: b } of T?.listeners ?? []) Pc[b] && g.add(Pc[b]);
  return { schema: yh, root: R[0] ?? null, overlays: R.slice(1), document_events: [...g].sort(), unsupported: U.findings.list() };
}
const Bh = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Yh = null;
const Gh = () => Yh ??= new ch(Bh);
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
let Ja = on.NoEventPriority;
function Qh(n, i) {
  const s = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const u of s) {
    if (u === "children") continue;
    const c = n[u], m = i[u];
    if (!(c === m || typeof c == "function" && typeof m == "function") && !(u === "style" && c && m && typeof c == "object" && typeof m == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(m)])].every((p) => c[p] === m[p])))
      return !0;
  }
  return !1;
}
const Vh = {
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
  createInstance: (n, i, s) => new Se(n, i, s.ownerDocument),
  createTextInstance: (n, i) => new Ro(n),
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
  insertBefore: (n, i, s) => {
    n.insertBefore(i, s);
  },
  insertInContainerBefore: (n, i, s) => {
    n.insertBefore(i, s);
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
  commitUpdate: (n, i, s, u) => {
    n.props = u, Qh(s, u) && n.touch();
  },
  commitTextUpdate: (n, i, s) => {
    n.data = String(s);
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
    Ja = n;
  },
  getCurrentUpdatePriority: () => Ja,
  resolveUpdatePriority: () => Ja !== on.NoEventPriority ? Ja : on.DefaultEventPriority,
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
}, we = Fp(Vh), Do = (n, i, s = null) => we.createPortal(n, i, null, s), Kh = {
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
class Xh {
  constructor(i, s, u) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1 }, s), this.type = i, this.target = u, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function mi(n, i, s) {
  i.currentTarget = n;
  for (const { type: u, listener: c, capture: m } of [...n.listeners ?? []])
    u === i.type && m === s && c.call(n, i);
  if (n instanceof Se) {
    const u = Kh[i.type], c = u && n.props[s ? `${u}Capture` : u];
    typeof c == "function" && c(i);
  }
}
function Kg(n, i, s = {}) {
  const { document: u, window: c } = Bp(n), m = new Se("div", { id: "root", style: s.container ?? {} }, u);
  u.body.appendChild(m);
  const f = [];
  let p = null;
  const w = () => [u, c].map((N) => N.listeners.map((C) => `${C.type}:${C.capture}`).sort().join(",")).join("|");
  let x = "";
  const U = {}, R = () => (p = qh(u, n, Gh(), U, s.names), x = w(), n.render?.(p), p), g = () => {
    we.flushPassiveEffects(), we.flushSyncWork(), w() !== x && R();
  };
  u.afterCommit = R;
  const T = (N) => {
    f.push(N), n.error?.(N);
  }, b = we.createContainer(m, on.ConcurrentRoot, null, !1, null, "", T, T, T, null);
  we.updateContainerSync(Ut.createElement(i, s.props ?? {}), b, null, null), we.flushSyncWork(), g();
  const j = (N) => {
    const C = (O) => {
      if (O.id === N) return O;
      for (const X of O.children) {
        const K = C(X);
        if (K) return K;
      }
      return null;
    };
    return C(u.documentElement);
  }, A = (N) => {
    const C = Ja;
    Ja = on.DiscreteEventPriority;
    try {
      return N();
    } finally {
      Ja = C, we.flushSyncWork(), g();
    }
  }, M = {
    document: u,
    window: c,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: R,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(N, C, O = {}) {
      const X = typeof N == "string" ? j(N) : N;
      if (!X) return !1;
      const K = new Xh(C, O, X), E = [];
      for (let G = X; G; G = G.parentNode) E.push(G);
      const S = [...E, u, c];
      return A(() => {
        for (let G = S.length - 1; G > 0 && !K.propagationStopped; G--) mi(S[G], K, !0);
        K.propagationStopped || (mi(X, K, !0), K.propagationStopped || mi(X, K, !1));
        for (let G = 1; G < S.length && !K.propagationStopped; G++) mi(S[G], K, !1);
      }), !K.defaultPrevented;
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(N, C) {
      const O = j(N);
      O && (O.bounds = { x: C.x, y: C.y, width: C.width, height: C.height });
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(N, C = {}) {
      const O = { button: 0, buttons: 1, pointerType: "mouse", ...C };
      for (const X of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) M.dispatch(N, X, O);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (N) => !!j(N)?.state.hover,
    hover(N, C) {
      const O = j(N);
      !O || O.state.hover === C || (O.state.hover = C, O.touch(), R());
    },
    focus(N) {
      const C = j(N);
      C && (A(() => {
        const O = u.activeElement;
        O && O !== C && O !== u.body && M.dispatch(O, "blur"), u.focus(C), M.dispatch(C, "focus");
      }), R());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: g,
    update(N) {
      we.updateContainerSync(Ut.createElement(i, N ?? {}), b, null, null), we.flushSyncWork(), g();
    },
    unmount() {
      we.updateContainerSync(null, b, null, null), we.flushSyncWork(), we.flushPassiveEffects(), u.afterCommit = null;
    }
  };
  return M;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Dd = (n) => we.flushSyncFromReconciler(n), Zh = { createPortal: Do, flushSync: Dd }, Xg = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Do,
  default: Zh,
  flushSync: Dd
}, Symbol.toStringTag, { value: "Module" }));
function qd(n) {
  var i, s, u = "";
  if (typeof n == "string" || typeof n == "number") u += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var c = n.length;
    for (i = 0; i < c; i++) n[i] && (s = qd(n[i])) && (u && (u += " "), u += s);
  } else for (s in n) n[s] && (u && (u += " "), u += s);
  return u;
}
function Bd() {
  for (var n, i, s = 0, u = "", c = arguments.length; s < c; s++) (n = arguments[s]) && (i = qd(n)) && (u && (u += " "), u += i);
  return u;
}
const Jh = (n, i) => {
  const s = new Array(n.length + i.length);
  for (let u = 0; u < n.length; u++)
    s[u] = n[u];
  for (let u = 0; u < i.length; u++)
    s[n.length + u] = i[u];
  return s;
}, Lh = (n, i) => ({
  classGroupId: n,
  validator: i
}), Yd = (n = /* @__PURE__ */ new Map(), i = null, s) => ({
  nextPart: n,
  validators: i,
  classGroupId: s
}), xi = "-", sd = [], Wh = "arbitrary..", Fh = (n) => {
  const i = $h(n), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: u
  } = n;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return Ih(f);
      const p = f.split(xi), w = p[0] === "" && p.length > 1 ? 1 : 0;
      return Gd(p, w, i);
    },
    getConflictingClassGroupIds: (f, p) => {
      if (p) {
        const w = u[f], x = s[f];
        return w ? x ? Jh(x, w) : w : x || sd;
      }
      return s[f] || sd;
    }
  };
}, Gd = (n, i, s) => {
  if (n.length - i === 0)
    return s.classGroupId;
  const c = n[i], m = s.nextPart.get(c);
  if (m) {
    const x = Gd(n, i + 1, m);
    if (x) return x;
  }
  const f = s.validators;
  if (f === null)
    return;
  const p = i === 0 ? n.join(xi) : n.slice(i).join(xi), w = f.length;
  for (let x = 0; x < w; x++) {
    const U = f[x];
    if (U.validator(p))
      return U.classGroupId;
  }
}, Ih = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), s = i.indexOf(":"), u = i.slice(0, s);
  return u ? Wh + u : void 0;
})(), $h = (n) => {
  const {
    theme: i,
    classGroups: s
  } = n;
  return Ph(s, i);
}, Ph = (n, i) => {
  const s = Yd();
  for (const u in n) {
    const c = n[u];
    qo(c, s, u, i);
  }
  return s;
}, qo = (n, i, s, u) => {
  const c = n.length;
  for (let m = 0; m < c; m++) {
    const f = n[m];
    t0(f, i, s, u);
  }
}, t0 = (n, i, s, u) => {
  if (typeof n == "string") {
    e0(n, i, s);
    return;
  }
  if (typeof n == "function") {
    a0(n, i, s, u);
    return;
  }
  l0(n, i, s, u);
}, e0 = (n, i, s) => {
  const u = n === "" ? i : Qd(i, n);
  u.classGroupId = s;
}, a0 = (n, i, s, u) => {
  if (n0(n)) {
    qo(n(u), i, s, u);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(Lh(s, n));
}, l0 = (n, i, s, u) => {
  const c = Object.entries(n), m = c.length;
  for (let f = 0; f < m; f++) {
    const [p, w] = c[f];
    qo(w, Qd(i, p), s, u);
  }
}, Qd = (n, i) => {
  let s = n;
  const u = i.split(xi), c = u.length;
  for (let m = 0; m < c; m++) {
    const f = u[m];
    let p = s.nextPart.get(f);
    p || (p = Yd(), s.nextPart.set(f, p)), s = p;
  }
  return s;
}, n0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, i0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, s = /* @__PURE__ */ Object.create(null), u = /* @__PURE__ */ Object.create(null);
  const c = (m, f) => {
    s[m] = f, i++, i > n && (i = 0, u = s, s = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(m) {
      let f = s[m];
      if (f !== void 0)
        return f;
      if ((f = u[m]) !== void 0)
        return c(m, f), f;
    },
    set(m, f) {
      m in s ? s[m] = f : c(m, f);
    }
  };
}, ko = "!", ud = ":", r0 = [], cd = (n, i, s, u, c) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: s,
  maybePostfixModifierPosition: u,
  isExternal: c
}), o0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: s
  } = n;
  let u = (c) => {
    const m = [];
    let f = 0, p = 0, w = 0, x;
    const U = c.length;
    for (let j = 0; j < U; j++) {
      const A = c[j];
      if (f === 0 && p === 0) {
        if (A === ud) {
          m.push(c.slice(w, j)), w = j + 1;
          continue;
        }
        if (A === "/") {
          x = j;
          continue;
        }
      }
      A === "[" ? f++ : A === "]" ? f-- : A === "(" ? p++ : A === ")" && p--;
    }
    const R = m.length === 0 ? c : c.slice(w);
    let g = R, T = !1;
    R.endsWith(ko) ? (g = R.slice(0, -1), T = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      R.startsWith(ko) && (g = R.slice(1), T = !0)
    );
    const b = x && x > w ? x - w : void 0;
    return cd(m, T, g, b);
  };
  if (i) {
    const c = i + ud, m = u;
    u = (f) => f.startsWith(c) ? m(f.slice(c.length)) : cd(r0, !1, f, void 0, !0);
  }
  if (s) {
    const c = u;
    u = (m) => s({
      className: m,
      parseClassName: c
    });
  }
  return u;
}, s0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((s, u) => {
    i.set(s, 1e6 + u);
  }), (s) => {
    const u = [];
    let c = [];
    for (let m = 0; m < s.length; m++) {
      const f = s[m], p = f[0] === "[", w = i.has(f);
      p || w ? (c.length > 0 && (c.sort(), u.push(...c), c = []), u.push(f)) : c.push(f);
    }
    return c.length > 0 && (c.sort(), u.push(...c)), u;
  };
}, u0 = (n) => ({
  cache: i0(n.cacheSize),
  parseClassName: o0(n),
  sortModifiers: s0(n),
  postfixLookupClassGroupIds: c0(n),
  ...Fh(n)
}), c0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), s = n.postfixLookupClassGroups;
  if (s)
    for (let u = 0; u < s.length; u++)
      i[s[u]] = !0;
  return i;
}, d0 = /\s+/, m0 = (n, i) => {
  const {
    parseClassName: s,
    getClassGroupId: u,
    getConflictingClassGroupIds: c,
    sortModifiers: m,
    postfixLookupClassGroupIds: f
  } = i, p = [], w = n.trim().split(d0);
  let x = "";
  for (let U = w.length - 1; U >= 0; U -= 1) {
    const R = w[U], {
      isExternal: g,
      modifiers: T,
      hasImportantModifier: b,
      baseClassName: j,
      maybePostfixModifierPosition: A
    } = s(R);
    if (g) {
      x = R + (x.length > 0 ? " " + x : x);
      continue;
    }
    let M = !!A, N;
    if (M) {
      const E = j.substring(0, A);
      N = u(E);
      const S = N && f[N] ? u(j) : void 0;
      S && S !== N && (N = S, M = !1);
    } else
      N = u(j);
    if (!N) {
      if (!M) {
        x = R + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (N = u(j), !N) {
        x = R + (x.length > 0 ? " " + x : x);
        continue;
      }
      M = !1;
    }
    const C = T.length === 0 ? "" : T.length === 1 ? T[0] : m(T).join(":"), O = b ? C + ko : C, X = O + N;
    if (p.indexOf(X) > -1)
      continue;
    p.push(X);
    const K = c(N, M);
    for (let E = 0; E < K.length; ++E) {
      const S = K[E];
      p.push(O + S);
    }
    x = R + (x.length > 0 ? " " + x : x);
  }
  return x;
}, f0 = (...n) => {
  let i = 0, s, u, c = "";
  for (; i < n.length; )
    (s = n[i++]) && (u = Vd(s)) && (c && (c += " "), c += u);
  return c;
}, Vd = (n) => {
  if (typeof n == "string")
    return n;
  let i, s = "";
  for (let u = 0; u < n.length; u++)
    n[u] && (i = Vd(n[u])) && (s && (s += " "), s += i);
  return s;
}, p0 = (n, ...i) => {
  let s, u, c, m;
  const f = (w) => {
    const x = i.reduce((U, R) => R(U), n());
    return s = u0(x), u = s.cache.get, c = s.cache.set, m = p, p(w);
  }, p = (w) => {
    const x = u(w);
    if (x)
      return x;
    const U = m0(w, s);
    return c(w, U), U;
  };
  return m = f, (...w) => m(f0(...w));
}, h0 = [], Vt = (n) => {
  const i = (s) => s[n] || h0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, Kd = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Xd = /^\((?:(\w[\w-]*):)?(.+)\)$/i, g0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, v0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, b0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, y0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, x0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, w0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ea = (n) => g0.test(n), ut = (n) => !!n && !Number.isNaN(Number(n)), Qe = (n) => !!n && Number.isInteger(Number(n)), go = (n) => n.endsWith("%") && ut(n.slice(0, -1)), na = (n) => v0.test(n), Zd = () => !0, _0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  b0.test(n) && !y0.test(n)
), Bo = () => !1, S0 = (n) => x0.test(n), z0 = (n) => w0.test(n), E0 = (n) => !J(n) && !L(n), k0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), N0 = (n) => ka(n, Wd, Bo), J = (n) => Kd.test(n), Za = (n) => ka(n, Fd, _0), dd = (n) => ka(n, H0, ut), T0 = (n) => ka(n, $d, Zd), C0 = (n) => ka(n, Id, Bo), md = (n) => ka(n, Jd, Bo), j0 = (n) => ka(n, Ld, z0), fi = (n) => ka(n, Pd, S0), L = (n) => Xd.test(n), an = (n) => La(n, Fd), M0 = (n) => La(n, Id), fd = (n) => La(n, Jd), A0 = (n) => La(n, Wd), O0 = (n) => La(n, Ld), pi = (n) => La(n, Pd, !0), R0 = (n) => La(n, $d, !0), ka = (n, i, s) => {
  const u = Kd.exec(n);
  return u ? u[1] ? i(u[1]) : s(u[2]) : !1;
}, La = (n, i, s = !1) => {
  const u = Xd.exec(n);
  return u ? u[1] ? i(u[1]) : s : !1;
}, Jd = (n) => n === "position" || n === "percentage", Ld = (n) => n === "image" || n === "url", Wd = (n) => n === "length" || n === "size" || n === "bg-size", Fd = (n) => n === "length", H0 = (n) => n === "number", Id = (n) => n === "family-name", $d = (n) => n === "number" || n === "weight", Pd = (n) => n === "shadow", U0 = () => {
  const n = Vt("color"), i = Vt("font"), s = Vt("text"), u = Vt("font-weight"), c = Vt("tracking"), m = Vt("leading"), f = Vt("breakpoint"), p = Vt("container"), w = Vt("spacing"), x = Vt("radius"), U = Vt("shadow"), R = Vt("inset-shadow"), g = Vt("text-shadow"), T = Vt("drop-shadow"), b = Vt("blur"), j = Vt("perspective"), A = Vt("aspect"), M = Vt("ease"), N = Vt("animate"), C = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], O = () => [
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
  ], X = () => [...O(), L, J], K = () => ["auto", "hidden", "clip", "visible", "scroll"], E = () => ["auto", "contain", "none"], S = () => [L, J, w], G = () => [Ea, "full", "auto", ...S()], ct = () => [Qe, "none", "subgrid", L, J], _t = () => ["auto", {
    span: ["full", Qe, L, J]
  }, Qe, L, J], Et = () => [Qe, "auto", L, J], Ot = () => ["auto", "min", "max", "fr", L, J], Lt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Nt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], q = () => ["auto", ...S()], I = () => [Ea, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...S()], at = () => [p, Ea, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...S()], it = () => [Ea, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...S()], Q = () => [n, L, J], v = () => [...O(), fd, md, {
    position: [L, J]
  }], D = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], $ = () => ["auto", "cover", "contain", A0, N0, {
    size: [L, J]
  }], W = () => [go, an, Za], F = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    L,
    J
  ], P = () => ["", ut, an, Za], gt = () => ["solid", "dashed", "dotted", "double"], Kt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], rt = () => [ut, go, fd, md], Na = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    b,
    L,
    J
  ], Ta = () => ["none", ut, L, J], Ce = () => ["none", ut, L, J], je = () => [ut, L, J], ra = () => [Ea, "full", ...S()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [na],
      breakpoint: [na],
      color: [Zd],
      container: [na],
      "drop-shadow": [na],
      ease: ["in", "out", "in-out"],
      font: [E0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [na],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [na],
      shadow: [na],
      spacing: ["px", ut],
      text: [na],
      "text-shadow": [na],
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
        aspect: ["auto", "square", Ea, J, L, A]
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
      "container-named": [k0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [ut, "auto", J, L, p]
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
        overscroll: E()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": E()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": E()
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
        z: [Qe, "auto", L, J]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Ea, "full", "auto", p, ...S()]
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
        flex: [ut, Ea, "auto", "initial", "none", J]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ut, L, J]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ut, L, J]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Qe, "first", "last", "none", L, J]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": ct()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: _t()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": Et()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": Et()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": ct()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: _t()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": Et()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": Et()
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
        "auto-cols": Ot()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": Ot()
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
        justify: [...Lt(), "normal"]
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
        content: ["normal", ...Lt()]
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
        "place-content": Lt()
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
        m: q()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: q()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: q()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: q()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: q()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: q()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: q()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: q()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: q()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: q()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: q()
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
            screen: [f]
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
        text: ["base", s, an, Za]
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
        font: [u, R0, T0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", go, J]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [M0, C0, i]
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
        "line-clamp": [ut, "none", L, dd]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          m,
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
        decoration: [ut, "from-font", "auto", L, Za]
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
        "underline-offset": [ut, "auto", L, J]
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
        tab: [Qe, L, J]
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
          }, Qe, L, J],
          radial: ["", L, J],
          conic: ["", Qe, L, J]
        }, O0, j0]
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
        "outline-offset": [ut, L, J]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ut, an, Za]
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
          U,
          pi,
          fi
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
        "inset-shadow": ["none", R, pi, fi]
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
        "ring-offset": [ut, Za]
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
        "text-shadow": ["none", g, pi, fi]
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
        opacity: [ut, L, J]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Kt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Kt()
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
        "mask-linear": [ut]
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
        "mask-conic": [ut]
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
        blur: Na()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [ut, L, J]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ut, L, J]
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
          T,
          pi,
          fi
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
        grayscale: ["", ut, L, J]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ut, L, J]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ut, L, J]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ut, L, J]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ut, L, J]
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
        "backdrop-blur": Na()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [ut, L, J]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ut, L, J]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ut, L, J]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ut, L, J]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ut, L, J]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ut, L, J]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ut, L, J]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ut, L, J]
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
        duration: [ut, "initial", L, J]
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
        delay: [ut, L, J]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", N, L, J]
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
        rotate: Ta()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Ta()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Ta()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Ta()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: Ce()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": Ce()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": Ce()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": Ce()
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
        skew: je()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": je()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": je()
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
        translate: ra()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": ra()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": ra()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": ra()
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
        zoom: [Qe, L, J]
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
        stroke: [ut, an, Za, dd]
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
}, D0 = /* @__PURE__ */ p0(U0);
function Ve(...n) {
  return D0(Bd(n));
}
const tm = typeof navigator < "u" && /Mac/i.test(navigator.platform), wi = {
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
for (let n = 1; n <= 12; n++) wi[`f${n}`] = `F${n}`;
const q0 = Object.fromEntries(Object.entries(wi).map(([n, i]) => [i, n])), B0 = {
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
function Y0(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : q0[n];
}
const pd = /* @__PURE__ */ new Map();
function em(n, i = tm) {
  const s = `${i}|${n}`, u = pd.get(s);
  if (u) return u;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const m of n.split("+"))
    if (m === "mod")
      i ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (m === "cmd" || m === "ctrl" || m === "shift" || m === "alt") c[m] = !0;
    else if (/^[a-z]$/.test(m))
      c.code = `Key${m.toUpperCase()}`, c.letter = m;
    else if (/^[0-9]$/.test(m)) c.code = `Digit${m}`;
    else if (wi[m]) c.code = wi[m];
    else throw new Error(`unknown key "${m}" in "${n}"`);
  if (!c.code) throw new Error(`no key in "${n}"`);
  return pd.set(s, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = em(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function G0(n, i = tm) {
  const s = em(n, i), u = Q0(Y0(s.code) ?? "");
  return i ? `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.cmd ? "⌘" : ""}${u}` : [s.ctrl && "Ctrl", s.alt && "Alt", s.shift && "Shift", u].filter(Boolean).join("+");
}
const Q0 = (n) => B0[n] ?? n.toUpperCase(), hd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, gd = Bd, Si = (n, i) => (s) => {
  var u;
  if (i?.variants == null) return gd(n, s?.class, s?.className);
  const { variants: c, defaultVariants: m } = i, f = Object.keys(c).map((x) => {
    const U = s?.[x], R = m?.[x];
    if (U === null) return null;
    const g = hd(U) || hd(R);
    return c[x][g];
  }), p = s && Object.entries(s).reduce((x, U) => {
    let [R, g] = U;
    return g === void 0 || (x[R] = g), x;
  }, {}), w = i == null || (u = i.compoundVariants) === null || u === void 0 ? void 0 : u.reduce((x, U) => {
    let { class: R, className: g, ...T } = U;
    return Object.entries(T).every((b) => {
      let [j, A] = b;
      return Array.isArray(A) ? A.includes({
        ...m,
        ...p
      }[j]) : {
        ...m,
        ...p
      }[j] === A;
    }) ? [
      ...x,
      R,
      g
    ] : x;
  }, []);
  return gd(n, f, w, s?.class, s?.className);
}, V0 = Si(
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
), K0 = Si(
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
function X0({ className: n, ...i } = {}) {
  return Ve(K0(i), n);
}
const am = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", lm = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Z0 = Si(`${lm} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function J0({ className: n, ...i } = {}) {
  return Ve(Z0(i), n);
}
const L0 = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", W0 = Si(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), F0 = "my-1 h-px bg-overlay-0";
function I0({ size: n = 14, className: i }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function $0({ size: n = 16, className: i }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function P0({ size: n = 14, className: i }) {
  return /* @__PURE__ */ te.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function nm({ size: n = 14, className: i }) {
  return /* @__PURE__ */ te.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const vd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function tg({ state: n, error: i }) {
  return /* @__PURE__ */ te.jsx(
    "span",
    {
      className: Ve("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", vd[n] ?? vd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function eg({ title: n, onClose: i, children: s, testId: u }) {
  return Do(
    /* @__PURE__ */ te.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (c) => {
          c.target === c.currentTarget && i();
        },
        onKeyDown: (c) => {
          c.key === "Escape" && i();
        },
        children: /* @__PURE__ */ te.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": u,
            children: [
              /* @__PURE__ */ te.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              s
            ]
          }
        )
      }
    ),
    document.body
  );
}
function ag(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const No = {
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
function To(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((s) => s.id === n.parentSessionId);
}
function lg(n) {
  const i = /* @__PURE__ */ new Map();
  for (const s of n)
    To(s, n) && i.set(s.parentSessionId, [...i.get(s.parentSessionId) ?? [], s]);
  return i.size ? n.filter((s) => !To(s, n)).flatMap((s) => [s, ...i.get(s.id) ?? []]) : n;
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const ng = "1.3.0";
function de() {
  const n = globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const ig = (n) => de().subscribe?.(n) ?? (() => {
}), rg = globalThis.perch?.isMac !== !1, og = (n) => G0(n, de().isMac !== !1), sg = (n) => V0(n), ug = ({ className: n, ...i } = {}) => Ve(X0(i), n), cg = J0, dg = (n) => W0(n), mg = F0, fg = lm, pg = am, hg = (n) => No[n].color, gg = (n, i) => de().command(n, i ?? {}) !== !1, vg = (n, i, s) => de().startSession?.(n, i, s), bg = globalThis.perch?.pickFolder ? (n) => de().pickFolder(n) : null;
function sn(n) {
  const i = Ut.useRef(n);
  return i.current = n, Ut.useSyncExternalStore(ig, () => i.current(de()));
}
const yg = (n = {}) => sn((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), xg = () => sn((n) => n.hosts()), wg = () => sn((n) => n.sessionFolders());
function _g() {
  const n = sn((i) => i.addProject?.() ?? Sg);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, s, u) => {
      i.trim() && n.status !== "pending" && de().addProjectFolder?.(i, s, u);
    },
    clear: () => de().clearAddProject?.()
  };
}
const Sg = Object.freeze({ status: "idle" });
function zg(n) {
  Ut.useEffect(() => de().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Eg(n) {
  const i = n.map((s) => ({ id: s.id, parentSessionId: s.parentId, session: s }));
  return lg(i).map((s) => ({ session: s.session, nested: To(s, i) }));
}
function kg({ id: n, plain: i, className: s }) {
  const u = sn((x) => x.session(n));
  if (!u) return null;
  const c = u.state ?? ag(u), m = No[c]?.color ?? No.unknown.color, f = u.provider, p = f === "claude" || f === "claude-agent-teams" || f === "omp", w = i ? Ve("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", s) : Ve("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", s);
  return Ut.createElement(
    "span",
    { className: w, style: i ? void 0 : { borderColor: m }, "data-provider": f ?? "unknown", title: i ? f ?? "Agent" : `${f ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    Ut.createElement("span", { className: Ve("inline-flex text-fg", p && "rounded-full bg-[#161616]") }, Ut.createElement(im, { provider: f, size: 14 }))
  );
}
function im({ provider: n, size: i = 14 }) {
  const s = de().agentIcon?.(n, i) ?? null, u = s?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return Ut.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": u, ...s && s.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Ng = ({ children: n }) => Ut.createElement(Ut.Fragment, null, n);
function Tg(n, i) {
  const s = Ut.useRef(i);
  return s.current = i, Ut.useEffect(() => {
    const u = de();
    if (!u.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const c = {};
    for (const [f, p] of Object.entries(s.current))
      c[f] = typeof p == "function" ? (...w) => s.current[f]?.(...w) : p;
    const m = u.openOverlay(n, c);
    return () => u.closeOverlay?.(m);
  }, [n]), null;
}
const zl = (n) => function(s) {
  return Tg(n, s);
}, Cg = zl("session-menu"), jg = zl("new-session-menu"), Mg = zl("confirm");
function Ag({ value: n, onChange: i, options: s = [], className: u, ariaLabel: c, testId: m, title: f, disabled: p, placeholder: w }) {
  const x = Ut.useRef(null), U = s.find((R) => R.value === n);
  return Ut.createElement(
    "button",
    {
      type: "button",
      ref: x,
      title: f,
      disabled: p,
      "aria-label": c,
      "data-testid": m,
      "aria-haspopup": "listbox",
      className: Ve("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", u),
      onClick: () => de().openOverlay?.("select", { value: n, options: s, onChange: (R) => i?.(R), anchor: x.current?.getBoundingClientRect() })
    },
    Ut.createElement("span", { className: "min-w-0 flex-1 truncate" }, U ? U.label : w ?? "")
  );
}
const Og = zl("folder-browser"), Rg = zl("instructions"), Hg = zl("memory"), Ug = eg;
function Dg({ hostId: n, path: i, className: s }) {
  const u = Ut.useRef(null);
  return Ut.createElement(
    "button",
    {
      type: "button",
      ref: u,
      className: Ve("worktree-menu__btn", am, s),
      "data-testid": `worktree-menu-${n}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => de().openOverlay?.("worktree", { hostId: n, cwd: i, anchor: u.current?.getBoundingClientRect() })
    },
    Ut.createElement(nm, null)
  );
}
const qg = (n, i) => de().beginReorderDrag?.(n, i), Zg = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: im,
  CloseIcon: P0,
  ConfirmDialog: Mg,
  Dialog: Ug,
  EllipsisIcon: I0,
  FolderBrowser: Og,
  GearIcon: $0,
  HostStateDot: tg,
  InstructionsDialog: Rg,
  MemoryDialog: Hg,
  NewSessionMenu: jg,
  PlusIcon: nm,
  Select: Ag,
  SessionDot: kg,
  SessionMenu: Cg,
  Slot: Ng,
  WorktreeMenu: Dg,
  agentStateColor: hg,
  beginReorderDrag: qg,
  buttonClass: cg,
  cn: Ve,
  ghostButton: fg,
  iconButton: pg,
  isMac: rg,
  keyLabel: og,
  menuDividerClass: mg,
  menuItemClass: dg,
  menuPanel: L0,
  nestSessions: Eg,
  pickFolder: bg,
  rowActionClass: ug,
  runCommand: gg,
  segmentClass: sg,
  startSession: vg,
  useAddProject: _g,
  useAddProjectRequest: zg,
  useHosts: xg,
  useNavigation: yg,
  useSessionFolders: wg,
  version: ng
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
const Yo = {
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
  line_height: (n, i) => n.line_height(i),
  italic: (n, i) => i ? n.italic() : n.not_italic(),
  whitespace: (n, i) => i === "nowrap" ? n.whitespace_nowrap() : n.whitespace_normal(),
  text_align: (n, i) => n[`text_${i}`](),
  rounded: (n, i) => n.rounded(i)
};
for (const n of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  Yo[n] = (i, s) => i[n](s);
const Jg = Object.keys(Yo);
function bd(n, i) {
  for (const [s, u] of Object.entries(i)) {
    const c = Yo[s];
    if (!c) throw new Error(`the description key ${s} has no GPUI builder`);
    u != null && (n = c(n, u));
  }
  return n;
}
const _l = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 });
function Bg(n, i, s) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || s)) return null;
  const u = n.meta?.attrs["data-testid"];
  return u ? `~${n.id}:${u}` : `~${n.id}`;
}
const rn = (n) => n.style?.display !== "hidden";
function Co(n, i, s, u, c = !1, m = !1, f = null, p = {}, w = !1, x = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return n.text;
  m ||= n.style.opacity === 0 || n.style.visibility === "invisible", m && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0 }), f = n.style.text_color ?? f;
  const U = !!n.hover?.text_color && rm(n);
  U && s.hovered?.(n.id) && (f = n.hover.text_color), p = { ...p };
  for (const C of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[C] !== void 0 && (p[C] = n.style[C]);
  const R = new Set(n.events ?? []);
  let g;
  n.kind === "image" && !n.markup ? g = i.image(n.src) : g = i.div(), n.markup && (g = g.child(u.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? f : "")));
  const T = Bg(n, R, c);
  T && (g = g.id(T)), g = bd(g, { ...n.style, ...x.get(n) });
  const b = p.whitespace !== "nowrap" && !p.text_ellipsis;
  w && b && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && (n.children ?? []).some((C) => C.kind === "text") && (g = g.min_w(0));
  for (const C of ["hover", "focus", "active"]) n[C] && (g = g[C]((O) => bd(O, n[C])));
  ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((C) => R.has(C)) && (g = g.on_mouse_down("left", (C, O) => {
    O.stop_propagation?.(), C.bounds && s.setBounds(n.id, C.bounds);
    const X = { ..._l(C), button: 0, buttons: 1, detail: C.click_count };
    s.dispatch(n.id, "pointerdown", { ...X, pointerType: "mouse" }), s.dispatch(n.id, "mousedown", X), O.notify();
  }), g = g.on_mouse_down("right", (C, O) => {
    O.stop_propagation?.(), C.bounds && s.setBounds(n.id, C.bounds), s.dispatch(n.id, "contextmenu", { ..._l(C), button: 2 }), O.notify();
  }), g = g.on_mouse_up("left", (C, O) => {
    O.stop_propagation?.();
    const X = { ..._l(C), button: 0 };
    s.dispatch(n.id, "pointerup", { ...X, pointerType: "mouse" }), s.dispatch(n.id, "mouseup", X), O.notify();
  }), g = g.on_click((C, O) => {
    s.dispatch(n.id, C.click_count === 2 && R.has("double_click") ? "dblclick" : "click", { detail: C.click_count, button: 0 }), O.notify();
  })), R.has("mouse_move") && (g = g.on_mouse_move((C, O) => {
    s.dispatch(n.id, "pointermove", { ..._l(C), pointerType: "mouse" }), O.notify();
  })), (n.track_hover || U) && (g = g.on_hover((C, O) => {
    s.hover(n.id, C), O.notify();
  })), c && (g = g.on_mouse_down_out((C, O) => {
    s.dispatch(s.document.body.id, "pointerdown", { ..._l(C), pointerType: "mouse" }), s.dispatch(s.document.body.id, "mousedown", _l(C)), O.notify();
  }));
  const A = p.whitespace === "nowrap" ? jo(p) : null, M = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let N = !n.range_name;
  for (const C of (n.children ?? []).filter(rn)) {
    let O = Co(C, i, s, u, !1, m, f, p, M && C.style?.position !== "absolute", x);
    const X = !N && (C.kind === "text" || !C.meta);
    if (X || C.kind === "text" && A) {
      let K = i.div();
      X && (K = K.id(n.range_name)), C.kind === "text" && A && (K = K.h(x.get(C)?.h ?? A)), O = K.child(O), N ||= X;
    }
    g = g.child(O);
  }
  return g;
}
const rm = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && rm(i));
function jo(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function Lg(n, i, s, u, c = 0) {
  const m = c > 0 ? Gg([n.root, ...n.overlays], c) : /* @__PURE__ */ new Map();
  let f = i.div().relative().size_full().child(Co(n.root, i, s, u, !1, !1, null, {}, !1, m));
  for (const p of n.overlays) f = f.child(Co(p, i, s, u, !0, !1, null, {}, !1, m));
  return f;
}
const Yg = ["text_size", "line_height", "whitespace", "text_ellipsis"], xt = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, yd = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, vo = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", ln = (n) => n.kind === "text" || rn(n) && n.style.position !== "absolute";
function Gg(n, i) {
  const s = /* @__PURE__ */ new Map(), u = (b, j) => s.set(b, { ...s.get(b), ...Object.fromEntries(Object.entries(j).filter(([, A]) => Number.isFinite(A))) }), c = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map();
  function f(b, j) {
    if (b.kind === "text") return j.whitespace === "nowrap" ? jo(j) ?? NaN : NaN;
    const A = { ...j };
    for (const X of Yg) b.style[X] !== void 0 && (A[X] = b.style[X]);
    m.set(b, A);
    const M = b.style, N = (b.children ?? []).filter(ln), C = N.map((X) => f(X, A));
    let O;
    if (M.h !== void 0 && M.h !== "auto") O = xt(M.h);
    else {
      const X = N.map((E, S) => (E.kind === "text" ? 0 : xt(E.style.mt) + xt(E.style.mb)) + C[S]);
      let K;
      if (vo(b)) K = M.flex_wrap === "wrap" ? NaN : M.items === "baseline" ? w(N, C, A) : Math.max(0, ...X);
      else if (yd(b)) {
        const E = N.some((G) => G.kind !== "text" && (G.style.flex_grow > 0 || G.style.flex_basis !== void 0)), S = M.display !== "flex" && N.some((G) => G.kind !== "text" && (xt(G.style.mt) || xt(G.style.mb)));
        K = E || S ? NaN : X.reduce((G, ct) => G + ct, 0) + (M.display === "flex" ? xt(M.gap_y) * Math.max(0, N.length - 1) : 0);
      } else K = NaN;
      O = K + xt(M.pt) + xt(M.pb) + xt(M.border_t) + xt(M.border_b), M.min_h !== void 0 && (O = Math.max(O, xt(M.min_h))), M.max_h !== void 0 && (O = Math.min(O, xt(M.max_h)));
    }
    return c.set(b, O), O;
  }
  const p = (b) => (jo(b) - (yi + Rd) * b.text_size) / 2 + yi * b.text_size;
  function w(b, j, A) {
    let M = 0, N = 0;
    for (const [C, O] of b.entries()) {
      const X = O.kind === "text" ? A : m.get(O);
      if (!(O.kind === "text" || (O.children ?? []).filter(ln).every((G) => G.kind === "text")) || !Number.isFinite(j[C]) || typeof X.text_size != "number") return NaN;
      const E = O.kind === "text" ? {} : O.style, S = xt(E.mt) + xt(E.border_t) + xt(E.pt) + p(X);
      M = Math.max(M, S), N = Math.max(N, xt(E.mt) + j[C] + xt(E.mb) - S);
    }
    return M + N;
  }
  const x = () => ({ exact: 0, laid: 0 }), U = (b, j) => {
    if (!Number.isFinite(j))
      return Object.assign(b, x()), NaN;
    b.exact += j;
    const A = Math.round(b.exact * i + 1e-9) / i, M = A - b.laid;
    return b.laid = A, M;
  };
  function R(b) {
    if (!(b.kind === "text" || !rn(b))) {
      for (const j of (b.children ?? []).filter((A) => A.kind !== "text" && rn(A) && A.style.position === "absolute")) R(j);
      if (yd(b) && !vo(b)) {
        const j = x();
        u(b, { border_t: U(j, xt(b.style.border_t)), pt: U(j, xt(b.style.pt)) }), g(b, j);
      } else for (const j of (b.children ?? []).filter(ln)) j.kind !== "text" && R(j);
    }
  }
  function g(b, j) {
    const A = (b.children ?? []).filter(ln), M = b.style.display === "flex" ? xt(b.style.gap_y) : 0;
    if (M && A.some((N) => N.kind === "text")) {
      for (const N of A) N.kind !== "text" && R(N);
      return !1;
    }
    return M && u(b, { gap_y: 0 }), A.forEach((N, C) => {
      if (N.kind === "text") {
        const O = c.get(N) ?? f(N, m.get(b) ?? {});
        Number.isFinite(O) ? u(N, { h: U(j, O) }) : Object.assign(j, x());
        return;
      }
      u(N, { mt: U(j, (C ? M : 0) + xt(N.style.mt)) }), Number.isFinite(c.get(N)) ? T(N, j) : (R(N), Object.assign(j, x())), u(N, { mb: U(j, xt(N.style.mb)) });
    }), !0;
  }
  function T(b, j) {
    const A = b.style;
    for (const X of (b.children ?? []).filter((K) => K.kind !== "text" && rn(K) && K.style.position === "absolute")) R(X);
    const M = j.laid, N = j.exact;
    u(b, { border_t: U(j, xt(A.border_t)), pt: U(j, xt(A.pt)) });
    const C = A.h !== void 0 && A.h !== "auto", O = c.get(b) - xt(A.pt) - xt(A.pb) - xt(A.border_t) - xt(A.border_b);
    if (vo(b) || C && (A.justify ?? "start") !== "start") {
      for (const X of (b.children ?? []).filter(ln)) X.kind !== "text" && R(X);
      C || U(j, O);
    } else !g(b, j) && !C && U(j, O);
    if (C) {
      j.exact = N + c.get(b), j.laid = Math.round(j.exact * i + 1e-9) / i, u(b, { h: j.laid - M });
      return;
    }
    u(b, { pb: U(j, xt(A.pb)), border_b: U(j, xt(A.border_b)) }), u(b, { h: j.laid - M });
  }
  for (const b of n)
    f(b, {}), R(b);
  return s;
}
const Wg = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }] };
export {
  Wg as NAMED_ELEMENTS,
  Qg as React,
  yh as SCHEMA,
  Jg as STYLE_KEYS,
  Lg as describeToGpui,
  Vg as jsxRuntime,
  Kg as mount,
  Xg as reactDom,
  Zg as sdk
};
