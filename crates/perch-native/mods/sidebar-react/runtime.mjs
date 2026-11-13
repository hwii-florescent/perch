function pd(n, i) {
  for (var u = 0; u < i.length; u++) {
    const s = i[u];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const c in s)
        if (c !== "default" && !(c in n)) {
          const f = Object.getOwnPropertyDescriptor(s, c);
          f && Object.defineProperty(n, c, f.get ? f : {
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
//! `:first-child`, `:last-child`, `:nth-child(n)`, `:not()`, `:is()`, `:where()`, `:root`, the state pseudo-classes
//! (`:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:enabled`, `:checked`), and the
//! descendant and child combinators. Anything else (`+`, `~`, `:has()`, pseudo-elements, ...) throws a
//! `SelectorError`, so a caller can skip a rule it cannot evaluate instead of guessing.
//!
//! An element is anything with `tagName` (lower case), `getAttribute(name)`, `parentElement` and `children`
//! (elements only). State pseudo-classes ask `options.state(element, name, isSubject)`; without it they never match.
class we extends Error {
}
const bp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), yp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), xp = /* @__PURE__ */ new Set(["first-child", "last-child", "root", ...bp]);
function fo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, u, s) => u ? String.fromCodePoint(parseInt(u, 16)) : s);
}
function ri(n, i) {
  let u = i;
  for (; u < n.length; ) {
    const s = n[u];
    if (s === "\\") {
      u += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(s)) {
      u++;
      continue;
    }
    break;
  }
  if (u === i) throw new we(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [fo(n.slice(i, u)), u];
}
function wp(n, i) {
  let u = 1;
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
    if (c === "(") u++;
    else if (c === ")" && --u === 0) return s;
  }
  throw new we(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function zo(n) {
  const i = [];
  let u = 0, s = 0;
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
    f === "(" || f === "[" ? u++ : f === ")" || f === "]" ? u-- : f === "," && u === 0 && (i.push(n.slice(s, c).trim()), s = c + 1);
  }
  return i.push(n.slice(s).trim()), i.filter(Boolean);
}
function _p(n, i) {
  const u = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let s = !1;
  for (; i < n.length; ) {
    const c = n[i];
    if (c === "*") {
      u.tag = "*", i++, s = !0;
      continue;
    }
    if (c === ".") {
      const [f, m] = ri(n, i + 1);
      u.classes.push(f), i = m, s = !0;
      continue;
    }
    if (c === "#") {
      const [f, m] = ri(n, i + 1);
      u.id = f, i = m, s = !0;
      continue;
    }
    if (c === "[") {
      const f = n.indexOf("]", i);
      if (f < 0) throw new we(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(i + 1, f).trim(), p = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!p) throw new we(`cannot read the attribute selector [${m}]`);
      const w = p[3] ?? p[4] ?? p[5];
      u.attrs.push({ name: fo(p[1]).toLowerCase(), op: p[2] ?? null, value: w === void 0 ? null : fo(w) }), i = f + 1, s = !0;
      continue;
    }
    if (c === ":") {
      if (n[i + 1] === ":") throw new we(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [f, m] = ri(n, i + 1);
      i = m;
      const p = f.toLowerCase();
      if (n[i] === "(") {
        if (!yp.has(p)) throw new we(`:${p}() is not supported`);
        const w = wp(n, i + 1), v = n.slice(i + 1, w).trim();
        if (i = w + 1, p === "nth-child") {
          if (!/^\d+$/.test(v)) throw new we(`:nth-child(${v}) is not supported (only a number)`);
          u.pseudos.push({ name: p, n: Number(v) });
        } else
          u.pseudos.push({ name: p, list: zo(v).map(Eo) });
      } else {
        if (!xp.has(p)) throw new we(`:${p} is not supported`);
        u.pseudos.push({ name: p });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !s) {
      const [f, m] = ri(n, i);
      u.tag = f.toLowerCase(), i = m, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new we(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [u, i];
}
function Eo(n) {
  const i = [];
  let u = 0, s = null;
  for (n = n.trim(); u < n.length; ) {
    const [c, f] = _p(n, u);
    i.push({ compound: c, combinator: s }), u = f;
    let m = !1;
    for (; n[u] === " " || n[u] === `
` || n[u] === "	"; )
      u++, m = !0;
    if (u >= n.length) break;
    const p = n[u];
    if (p === ">")
      for (s = ">", u++; n[u] === " "; ) u++;
    else {
      if (p === "+" || p === "~") throw new we(`the ${p} combinator is not supported`);
      if (m) s = " ";
      else throw new we(`unexpected ${JSON.stringify(p)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new we("empty selector");
  return i;
}
const jc = /* @__PURE__ */ new Map();
function No(n) {
  let i = jc.get(n);
  return i || (i = zo(n).map(Eo), jc.set(n, i)), i;
}
function hd(n) {
  const i = [0, 0, 0], u = (s) => {
    i[0] += s[0], i[1] += s[1], i[2] += s[2];
  };
  for (const { compound: s } of n) {
    s.id && i[0]++, i[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && i[2]++;
    for (const c of s.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const f = c.list.map(hd).sort((m, p) => p[0] - m[0] || p[1] - m[1] || p[2] - m[2])[0];
          u(f);
        } else i[1]++;
  }
  return i;
}
function Sp(n, { name: i, op: u, value: s }) {
  const c = n.getAttribute(i);
  if (c == null) return !1;
  if (u === null) return !0;
  switch (u) {
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
function lo(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function zp(n, i, u, s) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const c = n.classList ?? [];
    for (const f of i.classes) if (!c.includes(f)) return !1;
  }
  for (const c of i.attrs) if (!Sp(n, c)) return !1;
  for (const c of i.pseudos)
    switch (c.name) {
      case "first-child":
        if (lo(n)[0] !== n) return !1;
        break;
      case "last-child": {
        const f = lo(n);
        if (f[f.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (lo(n).indexOf(n) !== c.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((f) => _a(n, f, u, s))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((f) => _a(n, f, u, s))) return !1;
        break;
      default:
        if (!u.state || !u.state(n, c.name, s)) return !1;
    }
  return !0;
}
function _a(n, i, u, s = !0) {
  const c = (f, m, p) => {
    const { compound: w, combinator: v } = i[m];
    if (!zp(f, w, u, p)) return !1;
    if (m === 0) return !0;
    if (v === ">") return !!f.parentElement && c(f.parentElement, m - 1, !1);
    for (let q = f.parentElement; q; q = q.parentElement) if (c(q, m - 1, !1)) return !0;
    return !1;
  };
  return c(n, i.length - 1, s);
}
function Ep(n, i, u = {}) {
  return (typeof i == "string" ? No(i) : i).some((c) => _a(n, c, u));
}
function Np(n, i, u = {}) {
  return _a(n, i, u);
}
function an(n, i, u = {}) {
  const s = No(i), c = [], f = (m) => {
    for (const p of m.children)
      s.some((w) => _a(p, w, u)) && c.push(p), f(p);
  };
  return f(n), c;
}
function gd(n, i, u = {}) {
  const s = No(i);
  for (let c = n; c; c = c.parentElement) if (s.some((f) => _a(c, f, u))) return c;
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
let kp = 1;
class mo {
  constructor(i = 0, u = 0, s = 0, c = 0) {
    this.x = i, this.y = u, this.width = s, this.height = c;
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
class ko {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, u, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners.some((f) => f.type === i && f.listener === u && f.capture === c) || this.listeners.push({ type: i, listener: u, capture: c });
  }
  removeEventListener(i, u, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners = this.listeners.filter((f) => !(f.type === i && f.listener === u && f.capture === c));
  }
}
class To {
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
class _e extends ko {
  constructor(i, u = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${kp++}`, this.tagName = i.toLowerCase(), this.props = u, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof _e ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((i) => i instanceof _e);
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
    for (const [u, s] of Object.entries(this.props))
      u.startsWith("data-") && s != null && s !== !1 && (i[u.slice(5).replace(/-([a-z])/g, (c, f) => f.toUpperCase())] = String(s));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const u = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return u.id != null ? String(u.id) : null;
    if (i === "style") return null;
    let c = u[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (c === void 0 && !i.includes("-")) {
      const f = i.replace(/-([a-z])/g, (m, p) => p.toUpperCase());
      c = u[f];
    }
    return c == null || typeof c == "function" ? null : typeof c == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(c) : c ? "" : null : String(c);
  }
  hasAttribute(i) {
    return this.getAttribute(i) !== null;
  }
  appendChild(i) {
    return i.parentNode && i.parentNode.removeChild(i), i.parentNode = this, this.childNodes.push(i), this.touch(), i;
  }
  insertBefore(i, u) {
    i.parentNode && i.parentNode.removeChild(i);
    const s = this.childNodes.indexOf(u);
    return i.parentNode = this, s < 0 ? this.childNodes.push(i) : this.childNodes.splice(s, 0, i), this.touch(), i;
  }
  removeChild(i) {
    const u = this.childNodes.indexOf(i);
    return u >= 0 && this.childNodes.splice(u, 1), i.parentNode = null, this.touch(), i;
  }
  contains(i) {
    for (let u = i; u; u = u.parentNode) if (u === this) return !0;
    return !1;
  }
  matches(i) {
    return Ep(this, i);
  }
  closest(i) {
    return gd(this, i);
  }
  querySelectorAll(i) {
    return an(this, i);
  }
  querySelector(i) {
    return an(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.bounds;
    return i ? new mo(i.x, i.y, i.width, i.height) : new mo();
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
class Tp {
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
  setItem(i, u) {
    this.map.set(i, String(u));
  }
  removeItem(i) {
    this.map.delete(i);
  }
  clear() {
    this.map.clear();
  }
}
function Ac(n) {
  for (let i = n; i instanceof _e; i = i.parentElement) i.touch();
}
class Cp extends ko {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new _e("html", {}, this), this.body = new _e("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new _e(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Ac(i);
  }
  blur(i) {
    i.state.focus = !1, Ac(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return an(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
}
class jp extends ko {
  constructor(i, u) {
    super(), this.perch = i, this.document = u, this.location = { get hostname() {
      return i.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(i, u, ...s) {
    return globalThis.setTimeout(i, u, ...s);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function vd(n) {
  return {
    setTimeout: (i, u = 0, ...s) => n.setTimeout(() => i(...s), Math.max(0, Number(u) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
function He(n, i, u) {
  Object.defineProperty(n, i, { value: u, configurable: !0, writable: !0, enumerable: !1 });
}
function Ap(n, i = globalThis) {
  const u = new Cp(n), s = new jp(n, u);
  u.defaultView = s;
  const c = n.storage ?? new Tp();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const m = vd(n);
    He(i, "setTimeout", m.setTimeout), He(i, "clearTimeout", m.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && He(i, "queueMicrotask", (m) => {
    Promise.resolve().then(m);
  }), He(i, "document", u), He(i, "window", s), He(i, "localStorage", c), He(i, "HTMLElement", _e), He(i, "Element", _e), He(i, "DOMRect", mo);
  const f = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!f.clipboard && n.clipboard)
    try {
      He(f, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || He(i, "navigator", f), { document: u, window: s };
}
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Mc = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Mc?.setTimeout == "function") {
  const n = vd(Mc);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Co(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var ao = { exports: {} }, nt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Oc;
function Mp() {
  if (Oc) return nt;
  Oc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), u = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), f = Symbol.for("react.consumer"), m = Symbol.for("react.context"), p = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), v = Symbol.for("react.memo"), q = Symbol.for("react.lazy"), R = Symbol.for("react.activity"), y = Symbol.iterator;
  function E(g) {
    return g === null || typeof g != "object" ? null : (g = y && g[y] || g["@@iterator"], typeof g == "function" ? g : null);
  }
  var x = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, T = Object.assign, O = {};
  function A(g, M, I) {
    this.props = g, this.context = M, this.refs = O, this.updater = I || x;
  }
  A.prototype.isReactComponent = {}, A.prototype.setState = function(g, M) {
    if (typeof g != "object" && typeof g != "function" && g != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, g, M, "setState");
  }, A.prototype.forceUpdate = function(g) {
    this.updater.enqueueForceUpdate(this, g, "forceUpdate");
  };
  function j() {
  }
  j.prototype = A.prototype;
  function G(g, M, I) {
    this.props = g, this.context = M, this.refs = O, this.updater = I || x;
  }
  var V = G.prototype = new j();
  V.constructor = G, T(V, A.prototype), V.isPureReactComponent = !0;
  var at = Array.isArray;
  function J() {
  }
  var k = { H: null, A: null, T: null, S: null }, N = Object.prototype.hasOwnProperty;
  function Q(g, M, I) {
    var L = I.ref;
    return {
      $$typeof: n,
      type: g,
      key: M,
      ref: L !== void 0 ? L : null,
      props: I
    };
  }
  function mt(g, M) {
    return Q(g.type, M, g.props);
  }
  function wt(g) {
    return typeof g == "object" && g !== null && g.$$typeof === n;
  }
  function zt(g) {
    var M = { "=": "=0", ":": "=2" };
    return "$" + g.replace(/[=:]/g, function(I) {
      return M[I];
    });
  }
  var Mt = /\/+/g;
  function Jt(g, M) {
    return typeof g == "object" && g !== null && g.key != null ? zt("" + g.key) : M.toString(36);
  }
  function Nt(g) {
    switch (g.status) {
      case "fulfilled":
        return g.value;
      case "rejected":
        throw g.reason;
      default:
        switch (typeof g.status == "string" ? g.then(J, J) : (g.status = "pending", g.then(
          function(M) {
            g.status === "pending" && (g.status = "fulfilled", g.value = M);
          },
          function(M) {
            g.status === "pending" && (g.status = "rejected", g.reason = M);
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
  function H(g, M, I, L, W) {
    var $ = typeof g;
    ($ === "undefined" || $ === "boolean") && (g = null);
    var gt = !1;
    if (g === null) gt = !0;
    else
      switch ($) {
        case "bigint":
        case "string":
        case "number":
          gt = !0;
          break;
        case "object":
          switch (g.$$typeof) {
            case n:
            case i:
              gt = !0;
              break;
            case q:
              return gt = g._init, H(
                gt(g._payload),
                M,
                I,
                L,
                W
              );
          }
      }
    if (gt)
      return W = W(g), gt = L === "" ? "." + Jt(g, 0) : L, at(W) ? (I = "", gt != null && (I = gt.replace(Mt, "$&/") + "/"), H(W, M, I, "", function(Nl) {
        return Nl;
      })) : W != null && (wt(W) && (W = mt(
        W,
        I + (W.key == null || g && g.key === W.key ? "" : ("" + W.key).replace(
          Mt,
          "$&/"
        ) + "/") + gt
      )), M.push(W)), 1;
    gt = 0;
    var Vt = L === "" ? "." : L + ":";
    if (at(g))
      for (var rt = 0; rt < g.length; rt++)
        L = g[rt], $ = Vt + Jt(L, rt), gt += H(
          L,
          M,
          I,
          $,
          W
        );
    else if (rt = E(g), typeof rt == "function")
      for (g = rt.call(g), rt = 0; !(L = g.next()).done; )
        L = L.value, $ = Vt + Jt(L, rt++), gt += H(
          L,
          M,
          I,
          $,
          W
        );
    else if ($ === "object") {
      if (typeof g.then == "function")
        return H(
          Nt(g),
          M,
          I,
          L,
          W
        );
      throw M = String(g), Error(
        "Objects are not valid as a React child (found: " + (M === "[object Object]" ? "object with keys {" + Object.keys(g).join(", ") + "}" : M) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return gt;
  }
  function F(g, M, I) {
    if (g == null) return g;
    var L = [], W = 0;
    return H(g, L, "", "", function($) {
      return M.call(I, $, W++);
    }), L;
  }
  function et(g) {
    if (g._status === -1) {
      var M = g._result;
      M = M(), M.then(
        function(I) {
          (g._status === 0 || g._status === -1) && (g._status = 1, g._result = I);
        },
        function(I) {
          (g._status === 0 || g._status === -1) && (g._status = 2, g._result = I);
        }
      ), g._status === -1 && (g._status = 0, g._result = M);
    }
    if (g._status === 1) return g._result.default;
    throw g._result;
  }
  var it = typeof reportError == "function" ? reportError : function(g) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var M = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof g == "object" && g !== null && typeof g.message == "string" ? String(g.message) : String(g),
        error: g
      });
      if (!window.dispatchEvent(M)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", g);
      return;
    }
    console.error(g);
  }, B = {
    map: F,
    forEach: function(g, M, I) {
      F(
        g,
        function() {
          M.apply(this, arguments);
        },
        I
      );
    },
    count: function(g) {
      var M = 0;
      return F(g, function() {
        M++;
      }), M;
    },
    toArray: function(g) {
      return F(g, function(M) {
        return M;
      }) || [];
    },
    only: function(g) {
      if (!wt(g))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return g;
    }
  };
  return nt.Activity = R, nt.Children = B, nt.Component = A, nt.Fragment = u, nt.Profiler = c, nt.PureComponent = G, nt.StrictMode = s, nt.Suspense = w, nt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = k, nt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(g) {
      return k.H.useMemoCache(g);
    }
  }, nt.cache = function(g) {
    return function() {
      return g.apply(null, arguments);
    };
  }, nt.cacheSignal = function() {
    return null;
  }, nt.cloneElement = function(g, M, I) {
    if (g == null)
      throw Error(
        "The argument must be a React element, but you passed " + g + "."
      );
    var L = T({}, g.props), W = g.key;
    if (M != null)
      for ($ in M.key !== void 0 && (W = "" + M.key), M)
        !N.call(M, $) || $ === "key" || $ === "__self" || $ === "__source" || $ === "ref" && M.ref === void 0 || (L[$] = M[$]);
    var $ = arguments.length - 2;
    if ($ === 1) L.children = I;
    else if (1 < $) {
      for (var gt = Array($), Vt = 0; Vt < $; Vt++)
        gt[Vt] = arguments[Vt + 2];
      L.children = gt;
    }
    return Q(g.type, W, L);
  }, nt.createContext = function(g) {
    return g = {
      $$typeof: m,
      _currentValue: g,
      _currentValue2: g,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, g.Provider = g, g.Consumer = {
      $$typeof: f,
      _context: g
    }, g;
  }, nt.createElement = function(g, M, I) {
    var L, W = {}, $ = null;
    if (M != null)
      for (L in M.key !== void 0 && ($ = "" + M.key), M)
        N.call(M, L) && L !== "key" && L !== "__self" && L !== "__source" && (W[L] = M[L]);
    var gt = arguments.length - 2;
    if (gt === 1) W.children = I;
    else if (1 < gt) {
      for (var Vt = Array(gt), rt = 0; rt < gt; rt++)
        Vt[rt] = arguments[rt + 2];
      W.children = Vt;
    }
    if (g && g.defaultProps)
      for (L in gt = g.defaultProps, gt)
        W[L] === void 0 && (W[L] = gt[L]);
    return Q(g, $, W);
  }, nt.createRef = function() {
    return { current: null };
  }, nt.forwardRef = function(g) {
    return { $$typeof: p, render: g };
  }, nt.isValidElement = wt, nt.lazy = function(g) {
    return {
      $$typeof: q,
      _payload: { _status: -1, _result: g },
      _init: et
    };
  }, nt.memo = function(g, M) {
    return {
      $$typeof: v,
      type: g,
      compare: M === void 0 ? null : M
    };
  }, nt.startTransition = function(g) {
    var M = k.T, I = {};
    k.T = I;
    try {
      var L = g(), W = k.S;
      W !== null && W(I, L), typeof L == "object" && L !== null && typeof L.then == "function" && L.then(J, it);
    } catch ($) {
      it($);
    } finally {
      M !== null && I.types !== null && (M.types = I.types), k.T = M;
    }
  }, nt.unstable_useCacheRefresh = function() {
    return k.H.useCacheRefresh();
  }, nt.use = function(g) {
    return k.H.use(g);
  }, nt.useActionState = function(g, M, I) {
    return k.H.useActionState(g, M, I);
  }, nt.useCallback = function(g, M) {
    return k.H.useCallback(g, M);
  }, nt.useContext = function(g) {
    return k.H.useContext(g);
  }, nt.useDebugValue = function() {
  }, nt.useDeferredValue = function(g, M) {
    return k.H.useDeferredValue(g, M);
  }, nt.useEffect = function(g, M) {
    return k.H.useEffect(g, M);
  }, nt.useEffectEvent = function(g) {
    return k.H.useEffectEvent(g);
  }, nt.useId = function() {
    return k.H.useId();
  }, nt.useImperativeHandle = function(g, M, I) {
    return k.H.useImperativeHandle(g, M, I);
  }, nt.useInsertionEffect = function(g, M) {
    return k.H.useInsertionEffect(g, M);
  }, nt.useLayoutEffect = function(g, M) {
    return k.H.useLayoutEffect(g, M);
  }, nt.useMemo = function(g, M) {
    return k.H.useMemo(g, M);
  }, nt.useOptimistic = function(g, M) {
    return k.H.useOptimistic(g, M);
  }, nt.useReducer = function(g, M, I) {
    return k.H.useReducer(g, M, I);
  }, nt.useRef = function(g) {
    return k.H.useRef(g);
  }, nt.useState = function(g) {
    return k.H.useState(g);
  }, nt.useSyncExternalStore = function(g, M, I) {
    return k.H.useSyncExternalStore(
      g,
      M,
      I
    );
  }, nt.useTransition = function() {
    return k.H.useTransition();
  }, nt.version = "19.2.8", nt;
}
var Rc;
function bd() {
  return Rc || (Rc = 1, ao.exports = Mp()), ao.exports;
}
var Ht = bd();
const Op = /* @__PURE__ */ Co(Ht), Hg = /* @__PURE__ */ pd({
  __proto__: null,
  default: Op
}, [Ht]);
var no = { exports: {} }, tn = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Hc;
function Rp() {
  if (Hc) return tn;
  Hc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function u(s, c, f) {
    var m = null;
    if (f !== void 0 && (m = "" + f), c.key !== void 0 && (m = "" + c.key), "key" in c) {
      f = {};
      for (var p in c)
        p !== "key" && (f[p] = c[p]);
    } else f = c;
    return c = f.ref, {
      $$typeof: n,
      type: s,
      key: m,
      ref: c !== void 0 ? c : null,
      props: f
    };
  }
  return tn.Fragment = i, tn.jsx = u, tn.jsxs = u, tn;
}
var Uc;
function Hp() {
  return Uc || (Uc = 1, no.exports = Rp()), no.exports;
}
var Pt = Hp();
const Up = /* @__PURE__ */ Co(Pt), Ug = /* @__PURE__ */ pd({
  __proto__: null,
  default: Up
}, [Pt]);
var io = { exports: {} }, ro = { exports: {} }, oo = { exports: {} }, uo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Dc;
function Dp() {
  return Dc || (Dc = 1, (function(n) {
    function i(H, F) {
      var et = H.length;
      H.push(F);
      t: for (; 0 < et; ) {
        var it = et - 1 >>> 1, B = H[it];
        if (0 < c(B, F))
          H[it] = F, H[et] = B, et = it;
        else break t;
      }
    }
    function u(H) {
      return H.length === 0 ? null : H[0];
    }
    function s(H) {
      if (H.length === 0) return null;
      var F = H[0], et = H.pop();
      if (et !== F) {
        H[0] = et;
        t: for (var it = 0, B = H.length, g = B >>> 1; it < g; ) {
          var M = 2 * (it + 1) - 1, I = H[M], L = M + 1, W = H[L];
          if (0 > c(I, et))
            L < B && 0 > c(W, I) ? (H[it] = W, H[L] = et, it = L) : (H[it] = I, H[M] = et, it = M);
          else if (L < B && 0 > c(W, et))
            H[it] = W, H[L] = et, it = L;
          else break t;
        }
      }
      return F;
    }
    function c(H, F) {
      var et = H.sortIndex - F.sortIndex;
      return et !== 0 ? et : H.id - F.id;
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
    var w = [], v = [], q = 1, R = null, y = 3, E = !1, x = !1, T = !1, O = !1, A = typeof setTimeout == "function" ? setTimeout : null, j = typeof clearTimeout == "function" ? clearTimeout : null, G = typeof setImmediate < "u" ? setImmediate : null;
    function V(H) {
      for (var F = u(v); F !== null; ) {
        if (F.callback === null) s(v);
        else if (F.startTime <= H)
          s(v), F.sortIndex = F.expirationTime, i(w, F);
        else break;
        F = u(v);
      }
    }
    function at(H) {
      if (T = !1, V(H), !x)
        if (u(w) !== null)
          x = !0, J || (J = !0, zt());
        else {
          var F = u(v);
          F !== null && Nt(at, F.startTime - H);
        }
    }
    var J = !1, k = -1, N = 5, Q = -1;
    function mt() {
      return O ? !0 : !(n.unstable_now() - Q < N);
    }
    function wt() {
      if (O = !1, J) {
        var H = n.unstable_now();
        Q = H;
        var F = !0;
        try {
          t: {
            x = !1, T && (T = !1, j(k), k = -1), E = !0;
            var et = y;
            try {
              e: {
                for (V(H), R = u(w); R !== null && !(R.expirationTime > H && mt()); ) {
                  var it = R.callback;
                  if (typeof it == "function") {
                    R.callback = null, y = R.priorityLevel;
                    var B = it(
                      R.expirationTime <= H
                    );
                    if (H = n.unstable_now(), typeof B == "function") {
                      R.callback = B, V(H), F = !0;
                      break e;
                    }
                    R === u(w) && s(w), V(H);
                  } else s(w);
                  R = u(w);
                }
                if (R !== null) F = !0;
                else {
                  var g = u(v);
                  g !== null && Nt(
                    at,
                    g.startTime - H
                  ), F = !1;
                }
              }
              break t;
            } finally {
              R = null, y = et, E = !1;
            }
            F = void 0;
          }
        } finally {
          F ? zt() : J = !1;
        }
      }
    }
    var zt;
    if (typeof G == "function")
      zt = function() {
        G(wt);
      };
    else if (typeof MessageChannel < "u") {
      var Mt = new MessageChannel(), Jt = Mt.port2;
      Mt.port1.onmessage = wt, zt = function() {
        Jt.postMessage(null);
      };
    } else
      zt = function() {
        A(wt, 0);
      };
    function Nt(H, F) {
      k = A(function() {
        H(n.unstable_now());
      }, F);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(H) {
      H.callback = null;
    }, n.unstable_forceFrameRate = function(H) {
      0 > H || 125 < H ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : N = 0 < H ? Math.floor(1e3 / H) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return y;
    }, n.unstable_next = function(H) {
      switch (y) {
        case 1:
        case 2:
        case 3:
          var F = 3;
          break;
        default:
          F = y;
      }
      var et = y;
      y = F;
      try {
        return H();
      } finally {
        y = et;
      }
    }, n.unstable_requestPaint = function() {
      O = !0;
    }, n.unstable_runWithPriority = function(H, F) {
      switch (H) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          H = 3;
      }
      var et = y;
      y = H;
      try {
        return F();
      } finally {
        y = et;
      }
    }, n.unstable_scheduleCallback = function(H, F, et) {
      var it = n.unstable_now();
      switch (typeof et == "object" && et !== null ? (et = et.delay, et = typeof et == "number" && 0 < et ? it + et : it) : et = it, H) {
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
      return B = et + B, H = {
        id: q++,
        callback: F,
        priorityLevel: H,
        startTime: et,
        expirationTime: B,
        sortIndex: -1
      }, et > it ? (H.sortIndex = et, i(v, H), u(w) === null && H === u(v) && (T ? (j(k), k = -1) : T = !0, Nt(at, et - it))) : (H.sortIndex = B, i(w, H), x || E || (x = !0, J || (J = !0, zt()))), H;
    }, n.unstable_shouldYield = mt, n.unstable_wrapCallback = function(H) {
      var F = y;
      return function() {
        var et = y;
        y = F;
        try {
          return H.apply(this, arguments);
        } finally {
          y = et;
        }
      };
    };
  })(uo)), uo;
}
var qc;
function qp() {
  return qc || (qc = 1, oo.exports = Dp()), oo.exports;
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
var Bc;
function Bp() {
  return Bc || (Bc = 1, (function(n) {
    n.exports = function(i) {
      function u(t, e, l, a) {
        return new Sf(t, e, l, a);
      }
      function s() {
      }
      function c(t) {
        var e = "https://react.dev/errors/" + t;
        if (1 < arguments.length) {
          e += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var l = 2; l < arguments.length; l++)
            e += "&args[]=" + encodeURIComponent(arguments[l]);
        }
        return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function f(t) {
        var e = t, l = t;
        if (t.alternate) for (; e.return; ) e = e.return;
        else {
          t = e;
          do
            e = t, (e.flags & 4098) !== 0 && (l = e.return), t = e.return;
          while (t);
        }
        return e.tag === 3 ? l : null;
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
        for (var l = t, a = e; ; ) {
          var r = l.return;
          if (r === null) break;
          var o = r.alternate;
          if (o === null) {
            if (a = r.return, a !== null) {
              l = a;
              continue;
            }
            break;
          }
          if (r.child === o.child) {
            for (o = r.child; o; ) {
              if (o === l) return m(r), t;
              if (o === a) return m(r), e;
              o = o.sibling;
            }
            throw Error(c(188));
          }
          if (l.return !== a.return) l = r, a = o;
          else {
            for (var d = !1, h = r.child; h; ) {
              if (h === l) {
                d = !0, l = r, a = o;
                break;
              }
              if (h === a) {
                d = !0, a = r, l = o;
                break;
              }
              h = h.sibling;
            }
            if (!d) {
              for (h = o.child; h; ) {
                if (h === l) {
                  d = !0, l = o, a = r;
                  break;
                }
                if (h === a) {
                  d = !0, a = o, l = r;
                  break;
                }
                h = h.sibling;
              }
              if (!d) throw Error(c(189));
            }
          }
          if (l.alternate !== a) throw Error(c(190));
        }
        if (l.tag !== 3) throw Error(c(188));
        return l.stateNode.current === l ? t : e;
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
      function v(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = v(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function q(t) {
        return t === null || typeof t != "object" ? null : (t = Ws && t[Ws] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function R(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Tf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ea:
            return "Fragment";
          case _r:
            return "Profiler";
          case Js:
            return "StrictMode";
          case zr:
            return "Suspense";
          case Er:
            return "SuspenseList";
          case kr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ta:
              return "Portal";
            case ml:
              return t.displayName || "Context";
            case Ls:
              return (t._context.displayName || "Context") + ".Consumer";
            case Sr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Nr:
              return e = t.displayName || null, e !== null ? e : R(t.type) || "Memo";
            case pl:
              e = t._payload, t = t._init;
              try {
                return R(t(e));
              } catch {
              }
          }
        return null;
      }
      function y(t) {
        return { current: t };
      }
      function E(t) {
        0 > na || (t.current = Or[na], Or[na] = null, na--);
      }
      function x(t, e) {
        na++, Or[na] = t.current, t.current = e;
      }
      function T(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (lp(t) / ap | 0) | 0;
      }
      function O(t) {
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
      function A(t, e, l) {
        var a = t.pendingLanes;
        if (a === 0) return 0;
        var r = 0, o = t.suspendedLanes, d = t.pingedLanes;
        t = t.warmLanes;
        var h = a & 134217727;
        return h !== 0 ? (a = h & ~o, a !== 0 ? r = O(a) : (d &= h, d !== 0 ? r = O(d) : l || (l = h & ~t, l !== 0 && (r = O(l))))) : (h = a & ~o, h !== 0 ? r = O(h) : d !== 0 ? r = O(d) : l || (l = a & ~t, l !== 0 && (r = O(l)))), r === 0 ? 0 : e !== 0 && e !== r && (e & o) === 0 && (o = r & -r, l = e & -e, o >= l || o === 32 && (l & 4194048) !== 0) ? e : r;
      }
      function j(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function G(t, e) {
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
      function V() {
        var t = Gn;
        return Gn <<= 1, (Gn & 62914560) === 0 && (Gn = 4194304), t;
      }
      function at(t) {
        for (var e = [], l = 0; 31 > l; l++) e.push(t);
        return e;
      }
      function J(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function k(t, e, l, a, r, o) {
        var d = t.pendingLanes;
        t.pendingLanes = l, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= l, t.entangledLanes &= l, t.errorRecoveryDisabledLanes &= l, t.shellSuspendCounter = 0;
        var h = t.entanglements, z = t.expirationTimes, C = t.hiddenUpdates;
        for (l = d & ~l; 0 < l; ) {
          var Y = 31 - pe(l), U = 1 << Y;
          h[Y] = 0, z[Y] = -1;
          var K = C[Y];
          if (K !== null)
            for (C[Y] = null, Y = 0; Y < K.length; Y++) {
              var ot = K[Y];
              ot !== null && (ot.lane &= -536870913);
            }
          l &= ~U;
        }
        a !== 0 && N(t, a, 0), o !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= o & ~(d & ~e));
      }
      function N(t, e, l) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var a = 31 - pe(e);
        t.entangledLanes |= e, t.entanglements[a] = t.entanglements[a] | 1073741824 | l & 261930;
      }
      function Q(t, e) {
        var l = t.entangledLanes |= e;
        for (t = t.entanglements; l; ) {
          var a = 31 - pe(l), r = 1 << a;
          r & e | t[a] & e && (t[a] |= e), l &= ~r;
        }
      }
      function mt(t, e) {
        var l = e & -e;
        return l = (l & 42) !== 0 ? 1 : wt(l), (l & (t.suspendedLanes | e)) !== 0 ? 0 : l;
      }
      function wt(t) {
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
      function Mt(t) {
        if (typeof up == "function" && sp(t), he && typeof he.setStrictMode == "function")
          try {
            he.setStrictMode(Qa, t);
          } catch {
          }
      }
      function Jt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Nt(t) {
        if (Ur === void 0)
          try {
            throw Error();
          } catch (l) {
            var e = l.stack.trim().match(/\n( *(at )?)/);
            Ur = e && e[1] || "", wc = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Ur + t + wc;
      }
      function H(t, e) {
        if (!t || Dr) return "";
        Dr = !0;
        var l = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var a = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var U = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(U.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(U, []);
                    } catch (ot) {
                      var K = ot;
                    }
                    Reflect.construct(t, [], U);
                  } else {
                    try {
                      U.call();
                    } catch (ot) {
                      K = ot;
                    }
                    t.call(U.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ot) {
                    K = ot;
                  }
                  (U = t()) && typeof U.catch == "function" && U.catch(function() {
                  });
                }
              } catch (ot) {
                if (ot && K && typeof ot.stack == "string")
                  return [ot.stack, K.stack];
              }
              return [null, null];
            }
          };
          a.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var r = Object.getOwnPropertyDescriptor(
            a.DetermineComponentFrameRoot,
            "name"
          );
          r && r.configurable && Object.defineProperty(
            a.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var o = a.DetermineComponentFrameRoot(), d = o[0], h = o[1];
          if (d && h) {
            var z = d.split(`
`), C = h.split(`
`);
            for (r = a = 0; a < z.length && !z[a].includes("DetermineComponentFrameRoot"); )
              a++;
            for (; r < C.length && !C[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (a === z.length || r === C.length)
              for (a = z.length - 1, r = C.length - 1; 1 <= a && 0 <= r && z[a] !== C[r]; )
                r--;
            for (; 1 <= a && 0 <= r; a--, r--)
              if (z[a] !== C[r]) {
                if (a !== 1 || r !== 1)
                  do
                    if (a--, r--, 0 > r || z[a] !== C[r]) {
                      var Y = `
` + z[a].replace(" at new ", " at ");
                      return t.displayName && Y.includes("<anonymous>") && (Y = Y.replace("<anonymous>", t.displayName)), Y;
                    }
                  while (1 <= a && 0 <= r);
                break;
              }
          }
        } finally {
          Dr = !1, Error.prepareStackTrace = l;
        }
        return (l = t ? t.displayName || t.name : "") ? Nt(l) : "";
      }
      function F(t, e) {
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
            return H(t.type, !1);
          case 11:
            return H(t.type.render, !1);
          case 1:
            return H(t.type, !0);
          case 31:
            return Nt("Activity");
          default:
            return "";
        }
      }
      function et(t) {
        try {
          var e = "", l = null;
          do
            e += F(t, l), l = t, t = t.return;
          while (t);
          return e;
        } catch (a) {
          return `
Error generating stack: ` + a.message + `
` + a.stack;
        }
      }
      function it(t, e) {
        if (typeof t == "object" && t !== null) {
          var l = _c.get(t);
          return l !== void 0 ? l : (e = {
            value: t,
            source: e,
            stack: et(e)
          }, _c.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: et(e)
        };
      }
      function B(t, e) {
        ra[oa++] = Va, ra[oa++] = Vn, Vn = t, Va = e;
      }
      function g(t, e, l) {
        Se[ze++] = Be, Se[ze++] = Ye, Se[ze++] = hl, hl = t;
        var a = Be;
        t = Ye;
        var r = 32 - pe(a) - 1;
        a &= ~(1 << r), l += 1;
        var o = 32 - pe(e) + r;
        if (30 < o) {
          var d = r - r % 5;
          o = (a & (1 << d) - 1).toString(32), a >>= d, r -= d, Be = 1 << 32 - pe(e) + r | l << r | a, Ye = o + t;
        } else
          Be = 1 << o | l << r | a, Ye = t;
      }
      function M(t) {
        t.return !== null && (B(t, 1), g(t, 1, 0));
      }
      function I(t) {
        for (; t === Vn; )
          Vn = ra[--oa], ra[oa] = null, Va = ra[--oa], ra[oa] = null;
        for (; t === hl; )
          hl = Se[--ze], Se[ze] = null, Ye = Se[--ze], Se[ze] = null, Be = Se[--ze], Se[ze] = null;
      }
      function L(t, e) {
        Se[ze++] = Be, Se[ze++] = Ye, Se[ze++] = hl, Be = e.id, Ye = e.overflow, hl = t;
      }
      function W(t, e) {
        x(gl, e), x(Ka, t), x(Ft, null), t = Af(e), E(Ft), x(Ft, t);
      }
      function $() {
        E(Ft), E(Ka), E(gl);
      }
      function gt(t) {
        t.memoizedState !== null && x(Kn, t);
        var e = Ft.current, l = Mf(e, t.type);
        e !== l && (x(Ka, t), x(Ft, l));
      }
      function Vt(t) {
        Ka.current === t && (E(Ft), E(Ka)), Kn.current === t && (E(Kn), We ? Ul._currentValue = la : Ul._currentValue2 = la);
      }
      function rt(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw za(it(e, t)), qr;
      }
      function Nl(t, e) {
        if (!le) throw Error(c(175));
        Mm(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || rt(t, !0);
      }
      function kl(t) {
        for (It = t.return; It; )
          switch (It.tag) {
            case 5:
            case 31:
            case 13:
              Ee = !1;
              return;
            case 27:
            case 3:
              Ee = !0;
              return;
            default:
              It = It.return;
          }
      }
      function Te(t) {
        if (!le || t !== It) return !1;
        if (!ht) return kl(t), ht = !0, !1;
        var e = t.tag;
        if (Yt ? e !== 3 && e !== 27 && (e !== 5 || uc(t.type) && !qn(t.type, t.memoizedProps)) && kt && rt(t) : e !== 3 && (e !== 5 || uc(t.type) && !qn(t.type, t.memoizedProps)) && kt && rt(t), kl(t), e === 13) {
          if (!le) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          kt = Dm(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          kt = Um(t);
        } else
          kt = Yt && e === 27 ? _m(
            t.type,
            kt
          ) : It ? oc(t.stateNode) : null;
        return !0;
      }
      function Ce() {
        le && (kt = It = null, ht = !1);
      }
      function il() {
        var t = vl;
        return t !== null && (ue === null ? ue = t : ue.push.apply(
          ue,
          t
        ), vl = null), t;
      }
      function za(t) {
        vl === null ? vl = [t] : vl.push(t);
      }
      function rl(t, e, l) {
        We ? (x(Xn, e._currentValue), e._currentValue = l) : (x(Xn, e._currentValue2), e._currentValue2 = l);
      }
      function Ve(t) {
        var e = Xn.current;
        We ? t._currentValue = e : t._currentValue2 = e, E(Xn);
      }
      function yi(t, e, l) {
        for (; t !== null; ) {
          var a = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, a !== null && (a.childLanes |= e)) : a !== null && (a.childLanes & e) !== e && (a.childLanes |= e), t === l) break;
          t = t.return;
        }
      }
      function xi(t, e, l, a) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var o = r.dependencies;
          if (o !== null) {
            var d = r.child;
            o = o.firstContext;
            t: for (; o !== null; ) {
              var h = o;
              o = r;
              for (var z = 0; z < e.length; z++)
                if (h.context === e[z]) {
                  o.lanes |= l, h = o.alternate, h !== null && (h.lanes |= l), yi(
                    o.return,
                    l,
                    t
                  ), a || (d = null);
                  break t;
                }
              o = h.next;
            }
          } else if (r.tag === 18) {
            if (d = r.return, d === null) throw Error(c(341));
            d.lanes |= l, o = d.alternate, o !== null && (o.lanes |= l), yi(d, l, t), d = null;
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
      function Ll(t, e, l, a) {
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
              ge(r.pendingProps.value, d.value) || (t !== null ? t.push(h) : t = [h]);
            }
          } else if (r === Kn.current) {
            if (d = r.alternate, d === null) throw Error(c(387));
            d.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ul) : t = [Ul]);
          }
          r = r.return;
        }
        t !== null && xi(
          e,
          t,
          l,
          a
        ), e.flags |= 262144;
      }
      function on(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ge(
            We ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Tl(t) {
        Dl = t, Ie = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Lt(t) {
        return Ho(Dl, t);
      }
      function un(t, e) {
        return Dl === null && Tl(t), Ho(t, e);
      }
      function Ho(t, e) {
        var l = We ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: l, next: null }, Ie === null) {
          if (t === null) throw Error(c(308));
          Ie = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else Ie = Ie.next = e;
        return l;
      }
      function wi() {
        return {
          controller: new dp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ea(t) {
        t.refCount--, t.refCount === 0 && fp(mp, function() {
          t.controller.abort();
        });
      }
      function sn() {
      }
      function Ue(t) {
        t !== ua && t.next === null && (ua === null ? Zn = ua = t : ua = ua.next = t), Jn = !0, Br || (Br = !0, $d());
      }
      function Wl(t, e) {
        if (!Yr && Jn) {
          Yr = !0;
          do
            for (var l = !1, a = Zn; a !== null; ) {
              if (t !== 0) {
                var r = a.pendingLanes;
                if (r === 0) var o = 0;
                else {
                  var d = a.suspendedLanes, h = a.pingedLanes;
                  o = (1 << 31 - pe(42 | t) + 1) - 1, o &= r & ~(d & ~h), o = o & 201326741 ? o & 201326741 | 1 : o ? o | 2 : 0;
                }
                o !== 0 && (l = !0, Yo(a, o));
              } else
                o = pt, o = A(
                  a,
                  a === St ? o : 0,
                  a.cancelPendingCommit !== null || a.timeoutHandle !== Hl
                ), (o & 3) === 0 || j(a, o) || (l = !0, Yo(a, o));
              a = a.next;
            }
          while (l);
          Yr = !1;
        }
      }
      function Uo() {
        Do();
      }
      function Do() {
        Jn = Br = !1;
        var t = 0;
        ql !== 0 && Gf() && (t = ql);
        for (var e = re(), l = null, a = Zn; a !== null; ) {
          var r = a.next, o = qo(a, e);
          o === 0 ? (a.next = null, l === null ? Zn = r : l.next = r, r === null && (ua = l)) : (l = a, (t !== 0 || (o & 3) !== 0) && (Jn = !0)), a = r;
        }
        Gt !== 0 && Gt !== 5 || Wl(t), ql !== 0 && (ql = 0);
      }
      function qo(t, e) {
        for (var l = t.suspendedLanes, a = t.pingedLanes, r = t.expirationTimes, o = t.pendingLanes & -62914561; 0 < o; ) {
          var d = 31 - pe(o), h = 1 << d, z = r[d];
          z === -1 ? ((h & l) === 0 || (h & a) !== 0) && (r[d] = G(h, e)) : z <= e && (t.expiredLanes |= h), o &= ~h;
        }
        if (e = St, l = pt, l = A(
          t,
          t === e ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Hl
        ), a = t.callbackNode, l === 0 || t === e && (xt === 2 || xt === 9) || t.cancelPendingCommit !== null)
          return a !== null && a !== null && Rr(a), t.callbackNode = null, t.callbackPriority = 0;
        if ((l & 3) === 0 || j(t, l)) {
          if (e = l & -l, e === t.callbackPriority) return e;
          switch (a !== null && Rr(a), zt(l)) {
            case 2:
            case 8:
              l = rp;
              break;
            case 32:
              l = Hr;
              break;
            case 268435456:
              l = op;
              break;
            default:
              l = Hr;
          }
          return a = Bo.bind(null, t), l = Qn(l, a), t.callbackPriority = e, t.callbackNode = l, e;
        }
        return a !== null && a !== null && Rr(a), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Bo(t, e) {
        if (Gt !== 0 && Gt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var l = t.callbackNode;
        if (qa() && t.callbackNode !== l)
          return null;
        var a = pt;
        return a = A(
          t,
          t === St ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Hl
        ), a === 0 ? null : (_s(t, a, e), qo(t, re()), t.callbackNode != null && t.callbackNode === l ? Bo.bind(null, t) : null);
      }
      function Yo(t, e) {
        if (qa()) return null;
        _s(t, e, !0);
      }
      function $d() {
        Lf ? Wf(function() {
          (dt & 6) !== 0 ? Qn(
            yc,
            Uo
          ) : Do();
        }) : Qn(
          yc,
          Uo
        );
      }
      function _i() {
        if (ql === 0) {
          var t = sa;
          t === 0 && (t = Bn, Bn <<= 1, (Bn & 261888) === 0 && (Bn = 256)), ql = t;
        }
        return ql;
      }
      function Pd(t, e) {
        if (Xa === null) {
          var l = Xa = [];
          Gr = 0, sa = _i(), ca = {
            status: "pending",
            value: void 0,
            then: function(a) {
              l.push(a);
            }
          };
        }
        return Gr++, e.then(Go, Go), e;
      }
      function Go() {
        if (--Gr === 0 && Xa !== null) {
          ca !== null && (ca.status = "fulfilled");
          var t = Xa;
          Xa = null, sa = 0, ca = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function tf(t, e) {
        var l = [], a = {
          status: "pending",
          value: null,
          reason: null,
          then: function(r) {
            l.push(r);
          }
        };
        return t.then(
          function() {
            a.status = "fulfilled", a.value = e;
            for (var r = 0; r < l.length; r++) (0, l[r])(e);
          },
          function(r) {
            for (a.status = "rejected", a.reason = r, r = 0; r < l.length; r++)
              (0, l[r])(void 0);
          }
        ), a;
      }
      function Si() {
        var t = Bl.current;
        return t !== null ? t : St.pooledCache;
      }
      function cn(t, e) {
        e === null ? x(Bl, Bl.current) : x(Bl, e.pool);
      }
      function Qo() {
        var t = Si();
        return t === null ? null : {
          parent: We ? Tt._currentValue : Tt._currentValue2,
          pool: t
        };
      }
      function dn(t, e) {
        if (ge(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var l = Object.keys(t), a = Object.keys(e);
        if (l.length !== a.length) return !1;
        for (a = 0; a < l.length; a++) {
          var r = l[a];
          if (!cp.call(e, r) || !ge(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function Vo(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ko(t, e, l) {
        switch (l = t[l], l === void 0 ? t.push(e) : l !== e && (e.then(sn, sn), e = l), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Zo(t), t;
          default:
            if (typeof e.status == "string") e.then(sn, sn);
            else {
              if (t = St, t !== null && 100 < t.shellSuspendCounter)
                throw Error(c(482));
              t = e, t.status = "pending", t.then(
                function(a) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "fulfilled", r.value = a;
                  }
                },
                function(a) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "rejected", r.reason = a;
                  }
                }
              );
            }
            switch (e.status) {
              case "fulfilled":
                return e.value;
              case "rejected":
                throw t = e.reason, Zo(t), t;
            }
            throw Yl = e, da;
        }
      }
      function Cl(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (Yl = l, da) : l;
        }
      }
      function Xo() {
        if (Yl === null) throw Error(c(459));
        var t = Yl;
        return Yl = null, t;
      }
      function Zo(t) {
        if (t === da || t === Ln)
          throw Error(c(483));
      }
      function fn(t) {
        var e = Za;
        return Za += 1, fa === null && (fa = []), Ko(fa, t, e);
      }
      function Na(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function mn(t, e) {
        throw e.$$typeof === Nf ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
          c(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Jo(t) {
        function e(_, b) {
          if (t) {
            var S = _.deletions;
            S === null ? (_.deletions = [b], _.flags |= 16) : S.push(b);
          }
        }
        function l(_, b) {
          if (!t) return null;
          for (; b !== null; )
            e(_, b), b = b.sibling;
          return null;
        }
        function a(_) {
          for (var b = /* @__PURE__ */ new Map(); _ !== null; )
            _.key !== null ? b.set(_.key, _) : b.set(_.index, _), _ = _.sibling;
          return b;
        }
        function r(_, b) {
          return _ = Le(_, b), _.index = 0, _.sibling = null, _;
        }
        function o(_, b, S) {
          return _.index = S, t ? (S = _.alternate, S !== null ? (S = S.index, S < b ? (_.flags |= 67108866, b) : S) : (_.flags |= 67108866, b)) : (_.flags |= 1048576, b);
        }
        function d(_) {
          return t && _.alternate === null && (_.flags |= 67108866), _;
        }
        function h(_, b, S, D) {
          return b === null || b.tag !== 6 ? (b = br(S, _.mode, D), b.return = _, b) : (b = r(b, S), b.return = _, b);
        }
        function z(_, b, S, D) {
          var tt = S.type;
          return tt === ea ? Y(
            _,
            b,
            S.props.children,
            D,
            S.key
          ) : b !== null && (b.elementType === tt || typeof tt == "object" && tt !== null && tt.$$typeof === pl && Cl(tt) === b.type) ? (b = r(b, S.props), Na(b, S), b.return = _, b) : (b = Hn(
            S.type,
            S.key,
            S.props,
            null,
            _.mode,
            D
          ), Na(b, S), b.return = _, b);
        }
        function C(_, b, S, D) {
          return b === null || b.tag !== 4 || b.stateNode.containerInfo !== S.containerInfo || b.stateNode.implementation !== S.implementation ? (b = yr(S, _.mode, D), b.return = _, b) : (b = r(b, S.children || []), b.return = _, b);
        }
        function Y(_, b, S, D, tt) {
          return b === null || b.tag !== 7 ? (b = Rl(
            S,
            _.mode,
            D,
            tt
          ), b.return = _, b) : (b = r(b, S), b.return = _, b);
        }
        function U(_, b, S) {
          if (typeof b == "string" && b !== "" || typeof b == "number" || typeof b == "bigint")
            return b = br(
              "" + b,
              _.mode,
              S
            ), b.return = _, b;
          if (typeof b == "object" && b !== null) {
            switch (b.$$typeof) {
              case Un:
                return S = Hn(
                  b.type,
                  b.key,
                  b.props,
                  null,
                  _.mode,
                  S
                ), Na(S, b), S.return = _, S;
              case ta:
                return b = yr(
                  b,
                  _.mode,
                  S
                ), b.return = _, b;
              case pl:
                return b = Cl(b), U(_, b, S);
            }
            if (Dn(b) || q(b))
              return b = Rl(
                b,
                _.mode,
                S,
                null
              ), b.return = _, b;
            if (typeof b.then == "function")
              return U(_, fn(b), S);
            if (b.$$typeof === ml)
              return U(
                _,
                un(_, b),
                S
              );
            mn(_, b);
          }
          return null;
        }
        function K(_, b, S, D) {
          var tt = b !== null ? b.key : null;
          if (typeof S == "string" && S !== "" || typeof S == "number" || typeof S == "bigint")
            return tt !== null ? null : h(_, b, "" + S, D);
          if (typeof S == "object" && S !== null) {
            switch (S.$$typeof) {
              case Un:
                return S.key === tt ? z(_, b, S, D) : null;
              case ta:
                return S.key === tt ? C(_, b, S, D) : null;
              case pl:
                return S = Cl(S), K(_, b, S, D);
            }
            if (Dn(S) || q(S))
              return tt !== null ? null : Y(_, b, S, D, null);
            if (typeof S.then == "function")
              return K(
                _,
                b,
                fn(S),
                D
              );
            if (S.$$typeof === ml)
              return K(
                _,
                b,
                un(_, S),
                D
              );
            mn(_, S);
          }
          return null;
        }
        function ot(_, b, S, D, tt) {
          if (typeof D == "string" && D !== "" || typeof D == "number" || typeof D == "bigint")
            return _ = _.get(S) || null, h(b, _, "" + D, tt);
          if (typeof D == "object" && D !== null) {
            switch (D.$$typeof) {
              case Un:
                return _ = _.get(
                  D.key === null ? S : D.key
                ) || null, z(b, _, D, tt);
              case ta:
                return _ = _.get(
                  D.key === null ? S : D.key
                ) || null, C(b, _, D, tt);
              case pl:
                return D = Cl(D), ot(
                  _,
                  b,
                  S,
                  D,
                  tt
                );
            }
            if (Dn(D) || q(D))
              return _ = _.get(S) || null, Y(b, _, D, tt, null);
            if (typeof D.then == "function")
              return ot(
                _,
                b,
                S,
                fn(D),
                tt
              );
            if (D.$$typeof === ml)
              return ot(
                _,
                b,
                S,
                un(b, D),
                tt
              );
            mn(b, D);
          }
          return null;
        }
        function $t(_, b, S, D) {
          for (var tt = null, Ct = null, lt = b, bt = b = 0, Zt = null; lt !== null && bt < S.length; bt++) {
            lt.index > bt ? (Zt = lt, lt = null) : Zt = lt.sibling;
            var yt = K(
              _,
              lt,
              S[bt],
              D
            );
            if (yt === null) {
              lt === null && (lt = Zt);
              break;
            }
            t && lt && yt.alternate === null && e(_, lt), b = o(yt, b, bt), Ct === null ? tt = yt : Ct.sibling = yt, Ct = yt, lt = Zt;
          }
          if (bt === S.length)
            return l(_, lt), ht && B(_, bt), tt;
          if (lt === null) {
            for (; bt < S.length; bt++)
              lt = U(_, S[bt], D), lt !== null && (b = o(
                lt,
                b,
                bt
              ), Ct === null ? tt = lt : Ct.sibling = lt, Ct = lt);
            return ht && B(_, bt), tt;
          }
          for (lt = a(lt); bt < S.length; bt++)
            Zt = ot(
              lt,
              _,
              bt,
              S[bt],
              D
            ), Zt !== null && (t && Zt.alternate !== null && lt.delete(
              Zt.key === null ? bt : Zt.key
            ), b = o(
              Zt,
              b,
              bt
            ), Ct === null ? tt = Zt : Ct.sibling = Zt, Ct = Zt);
          return t && lt.forEach(function(Sl) {
            return e(_, Sl);
          }), ht && B(_, bt), tt;
        }
        function Pa(_, b, S, D) {
          if (S == null) throw Error(c(151));
          for (var tt = null, Ct = null, lt = b, bt = b = 0, Zt = null, yt = S.next(); lt !== null && !yt.done; bt++, yt = S.next()) {
            lt.index > bt ? (Zt = lt, lt = null) : Zt = lt.sibling;
            var Sl = K(_, lt, yt.value, D);
            if (Sl === null) {
              lt === null && (lt = Zt);
              break;
            }
            t && lt && Sl.alternate === null && e(_, lt), b = o(Sl, b, bt), Ct === null ? tt = Sl : Ct.sibling = Sl, Ct = Sl, lt = Zt;
          }
          if (yt.done)
            return l(_, lt), ht && B(_, bt), tt;
          if (lt === null) {
            for (; !yt.done; bt++, yt = S.next())
              yt = U(_, yt.value, D), yt !== null && (b = o(
                yt,
                b,
                bt
              ), Ct === null ? tt = yt : Ct.sibling = yt, Ct = yt);
            return ht && B(_, bt), tt;
          }
          for (lt = a(lt); !yt.done; bt++, yt = S.next())
            yt = ot(
              lt,
              _,
              bt,
              yt.value,
              D
            ), yt !== null && (t && yt.alternate !== null && lt.delete(yt.key === null ? bt : yt.key), b = o(yt, b, bt), Ct === null ? tt = yt : Ct.sibling = yt, Ct = yt);
          return t && lt.forEach(function(vp) {
            return e(_, vp);
          }), ht && B(_, bt), tt;
        }
        function Kl(_, b, S, D) {
          if (typeof S == "object" && S !== null && S.type === ea && S.key === null && (S = S.props.children), typeof S == "object" && S !== null) {
            switch (S.$$typeof) {
              case Un:
                t: {
                  for (var tt = S.key; b !== null; ) {
                    if (b.key === tt) {
                      if (tt = S.type, tt === ea) {
                        if (b.tag === 7) {
                          l(
                            _,
                            b.sibling
                          ), D = r(
                            b,
                            S.props.children
                          ), D.return = _, _ = D;
                          break t;
                        }
                      } else if (b.elementType === tt || typeof tt == "object" && tt !== null && tt.$$typeof === pl && Cl(tt) === b.type) {
                        l(
                          _,
                          b.sibling
                        ), D = r(b, S.props), Na(D, S), D.return = _, _ = D;
                        break t;
                      }
                      l(_, b);
                      break;
                    } else e(_, b);
                    b = b.sibling;
                  }
                  S.type === ea ? (D = Rl(
                    S.props.children,
                    _.mode,
                    D,
                    S.key
                  ), D.return = _, _ = D) : (D = Hn(
                    S.type,
                    S.key,
                    S.props,
                    null,
                    _.mode,
                    D
                  ), Na(D, S), D.return = _, _ = D);
                }
                return d(_);
              case ta:
                t: {
                  for (tt = S.key; b !== null; ) {
                    if (b.key === tt)
                      if (b.tag === 4 && b.stateNode.containerInfo === S.containerInfo && b.stateNode.implementation === S.implementation) {
                        l(
                          _,
                          b.sibling
                        ), D = r(
                          b,
                          S.children || []
                        ), D.return = _, _ = D;
                        break t;
                      } else {
                        l(_, b);
                        break;
                      }
                    else e(_, b);
                    b = b.sibling;
                  }
                  D = yr(S, _.mode, D), D.return = _, _ = D;
                }
                return d(_);
              case pl:
                return S = Cl(S), Kl(
                  _,
                  b,
                  S,
                  D
                );
            }
            if (Dn(S))
              return $t(
                _,
                b,
                S,
                D
              );
            if (q(S)) {
              if (tt = q(S), typeof tt != "function")
                throw Error(c(150));
              return S = tt.call(S), Pa(
                _,
                b,
                S,
                D
              );
            }
            if (typeof S.then == "function")
              return Kl(
                _,
                b,
                fn(S),
                D
              );
            if (S.$$typeof === ml)
              return Kl(
                _,
                b,
                un(_, S),
                D
              );
            mn(_, S);
          }
          return typeof S == "string" && S !== "" || typeof S == "number" || typeof S == "bigint" ? (S = "" + S, b !== null && b.tag === 6 ? (l(_, b.sibling), D = r(b, S), D.return = _, _ = D) : (l(_, b), D = br(S, _.mode, D), D.return = _, _ = D), d(_)) : l(_, b);
        }
        return function(_, b, S, D) {
          try {
            Za = 0;
            var tt = Kl(
              _,
              b,
              S,
              D
            );
            return fa = null, tt;
          } catch (lt) {
            if (lt === da || lt === Ln) throw lt;
            var Ct = u(29, lt, null, _.mode);
            return Ct.lanes = D, Ct.return = _, Ct;
          } finally {
          }
        };
      }
      function pn() {
        for (var t = ma, e = Vr = ma = 0; e < t; ) {
          var l = Ne[e];
          Ne[e++] = null;
          var a = Ne[e];
          Ne[e++] = null;
          var r = Ne[e];
          Ne[e++] = null;
          var o = Ne[e];
          if (Ne[e++] = null, a !== null && r !== null) {
            var d = a.pending;
            d === null ? r.next = r : (r.next = d.next, d.next = r), a.pending = r;
          }
          o !== 0 && Lo(l, r, o);
        }
      }
      function hn(t, e, l, a) {
        Ne[ma++] = t, Ne[ma++] = e, Ne[ma++] = l, Ne[ma++] = a, Vr |= a, t.lanes |= a, t = t.alternate, t !== null && (t.lanes |= a);
      }
      function zi(t, e, l, a) {
        return hn(t, e, l, a), gn(t);
      }
      function jl(t, e) {
        return hn(t, null, null, e), gn(t);
      }
      function Lo(t, e, l) {
        t.lanes |= l;
        var a = t.alternate;
        a !== null && (a.lanes |= l);
        for (var r = !1, o = t.return; o !== null; )
          o.childLanes |= l, a = o.alternate, a !== null && (a.childLanes |= l), o.tag === 22 && (t = o.stateNode, t === null || t._visibility & 1 || (r = !0)), t = o, o = o.return;
        return t.tag === 3 ? (o = t.stateNode, r && e !== null && (r = 31 - pe(l), t = o.hiddenUpdates, a = t[r], a === null ? t[r] = [e] : a.push(e), e.lane = l | 536870912), o) : null;
      }
      function gn(t) {
        if (50 < $a)
          throw $a = 0, eo = null, Error(c(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Ei(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Ni(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function ol(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function ul(t, e, l) {
        var a = t.updateQueue;
        if (a === null) return null;
        if (a = a.shared, (dt & 2) !== 0) {
          var r = a.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), a.pending = e, e = gn(t), Lo(t, null, l), e;
        }
        return hn(t, a, e, l), gn(t);
      }
      function ka(t, e, l) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (l & 4194048) !== 0)) {
          var a = e.lanes;
          a &= t.pendingLanes, l |= a, e.lanes = l, Q(t, l);
        }
      }
      function ki(t, e) {
        var l = t.updateQueue, a = t.alternate;
        if (a !== null && (a = a.updateQueue, l === a)) {
          var r = null, o = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var d = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              o === null ? r = o = d : o = o.next = d, l = l.next;
            } while (l !== null);
            o === null ? r = o = e : o = o.next = e;
          } else r = o = e;
          l = {
            baseState: a.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: o,
            shared: a.shared,
            callbacks: a.callbacks
          }, t.updateQueue = l;
          return;
        }
        t = l.lastBaseUpdate, t === null ? l.firstBaseUpdate = e : t.next = e, l.lastBaseUpdate = e;
      }
      function Ta() {
        if (Kr) {
          var t = ca;
          if (t !== null) throw t;
        }
      }
      function Ca(t, e, l, a) {
        Kr = !1;
        var r = t.updateQueue;
        bl = !1;
        var o = r.firstBaseUpdate, d = r.lastBaseUpdate, h = r.shared.pending;
        if (h !== null) {
          r.shared.pending = null;
          var z = h, C = z.next;
          z.next = null, d === null ? o = C : d.next = C, d = z;
          var Y = t.alternate;
          Y !== null && (Y = Y.updateQueue, h = Y.lastBaseUpdate, h !== d && (h === null ? Y.firstBaseUpdate = C : h.next = C, Y.lastBaseUpdate = z));
        }
        if (o !== null) {
          var U = r.baseState;
          d = 0, Y = C = z = null, h = o;
          do {
            var K = h.lane & -536870913, ot = K !== h.lane;
            if (ot ? (pt & K) === K : (a & K) === K) {
              K !== 0 && K === sa && (Kr = !0), Y !== null && (Y = Y.next = {
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: null,
                next: null
              });
              t: {
                var $t = t, Pa = h;
                K = e;
                var Kl = l;
                switch (Pa.tag) {
                  case 1:
                    if ($t = Pa.payload, typeof $t == "function") {
                      U = $t.call(
                        Kl,
                        U,
                        K
                      );
                      break t;
                    }
                    U = $t;
                    break t;
                  case 3:
                    $t.flags = $t.flags & -65537 | 128;
                  case 0:
                    if ($t = Pa.payload, K = typeof $t == "function" ? $t.call(Kl, U, K) : $t, K == null) break t;
                    U = wr({}, U, K);
                    break t;
                  case 2:
                    bl = !0;
                }
              }
              K = h.callback, K !== null && (t.flags |= 64, ot && (t.flags |= 8192), ot = r.callbacks, ot === null ? r.callbacks = [K] : ot.push(K));
            } else
              ot = {
                lane: K,
                tag: h.tag,
                payload: h.payload,
                callback: h.callback,
                next: null
              }, Y === null ? (C = Y = ot, z = U) : Y = Y.next = ot, d |= K;
            if (h = h.next, h === null) {
              if (h = r.shared.pending, h === null)
                break;
              ot = h, h = ot.next, ot.next = null, r.lastBaseUpdate = ot, r.shared.pending = null;
            }
          } while (!0);
          Y === null && (z = U), r.baseState = z, r.firstBaseUpdate = C, r.lastBaseUpdate = Y, o === null && (r.shared.lanes = 0), xl |= d, t.lanes = d, t.memoizedState = U;
        }
      }
      function Wo(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function Fo(t, e) {
        var l = t.callbacks;
        if (l !== null)
          for (t.callbacks = null, t = 0; t < l.length; t++)
            Wo(l[t], e);
      }
      function Io(t, e) {
        t = tl, x(Fn, t), x(pa, e), tl = t | e.baseLanes;
      }
      function Ti() {
        x(Fn, tl), x(pa, pa.current);
      }
      function Ci() {
        tl = Fn.current, E(pa), E(Fn);
      }
      function sl(t) {
        var e = t.alternate;
        x(Rt, Rt.current & 1), x(ve, t), ke === null && (e === null || pa.current !== null || e.memoizedState !== null) && (ke = t);
      }
      function ji(t) {
        x(Rt, Rt.current), x(ve, t), ke === null && (ke = t);
      }
      function $o(t) {
        t.tag === 22 ? (x(Rt, Rt.current), x(ve, t), ke === null && (ke = t)) : cl();
      }
      function cl() {
        x(Rt, Rt.current), x(ve, ve.current);
      }
      function de(t) {
        E(ve), ke === t && (ke = null), E(Rt);
      }
      function vn(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var l = e.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || jr(l) || Ar(l)))
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
      function jt() {
        throw Error(c(321));
      }
      function Ai(t, e) {
        if (e === null) return !1;
        for (var l = 0; l < e.length && l < t.length; l++)
          if (!ge(t[l], e[l])) return !1;
        return !0;
      }
      function Mi(t, e, l, a, r, o) {
        return $e = o, ut = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, P.H = t === null || t.memoizedState === null ? Ec : Xr, Ql = !1, o = l(a, r), Ql = !1, ha && (o = tu(
          e,
          l,
          a,
          r
        )), Po(t), o;
      }
      function Po(t) {
        P.H = La;
        var e = _t !== null && _t.next !== null;
        if ($e = 0, Ut = _t = ut = null, In = !1, Ja = 0, ga = null, e) throw Error(c(300));
        t === null || Dt || (t = t.dependencies, t !== null && on(t) && (Dt = !0));
      }
      function tu(t, e, l, a) {
        ut = t;
        var r = 0;
        do {
          if (ha && (ga = null), Ja = 0, ha = !1, 25 <= r) throw Error(c(301));
          if (r += 1, Ut = _t = null, t.updateQueue != null) {
            var o = t.updateQueue;
            o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
          }
          P.H = Nc, o = e(l, a);
        } while (ha);
        return o;
      }
      function ef() {
        var t = P.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? ja(e) : e, t = t.useState()[0], (_t !== null ? _t.memoizedState : null) !== t && (ut.flags |= 1024), e;
      }
      function Oi() {
        var t = $n !== 0;
        return $n = 0, t;
      }
      function Ri(t, e, l) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~l;
      }
      function Hi(t) {
        if (In) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          In = !1;
        }
        $e = 0, Ut = _t = ut = null, ha = !1, Ja = $n = 0, ga = null;
      }
      function ae() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Ut === null ? ut.memoizedState = Ut = t : Ut = Ut.next = t, Ut;
      }
      function Ot() {
        if (_t === null) {
          var t = ut.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = _t.next;
        var e = Ut === null ? ut.memoizedState : Ut.next;
        if (e !== null)
          Ut = e, _t = t;
        else {
          if (t === null)
            throw ut.alternate === null ? Error(c(467)) : Error(c(310));
          _t = t, t = {
            memoizedState: _t.memoizedState,
            baseState: _t.baseState,
            baseQueue: _t.baseQueue,
            queue: _t.queue,
            next: null
          }, Ut === null ? ut.memoizedState = Ut = t : Ut = Ut.next = t;
        }
        return Ut;
      }
      function bn() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function ja(t) {
        var e = Ja;
        return Ja += 1, ga === null && (ga = []), t = Ko(ga, t, e), e = ut, (Ut === null ? e.memoizedState : Ut.next) === null && (e = e.alternate, P.H = e === null || e.memoizedState === null ? Ec : Xr), t;
      }
      function yn(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return ja(t);
          if (t.$$typeof === ml) return Lt(t);
        }
        throw Error(c(438, String(t)));
      }
      function Ui(t) {
        var e = null, l = ut.updateQueue;
        if (l !== null && (e = l.memoCache), e == null) {
          var a = ut.alternate;
          a !== null && (a = a.updateQueue, a !== null && (a = a.memoCache, a != null && (e = {
            data: a.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), l === null && (l = bn(), ut.updateQueue = l), l.memoCache = e, l = e.data[e.index], l === void 0)
          for (l = e.data[e.index] = Array(t), a = 0; a < t; a++)
            l[a] = kf;
        return e.index++, l;
      }
      function Ke(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function xn(t) {
        var e = Ot();
        return Di(e, _t, t);
      }
      function Di(t, e, l) {
        var a = t.queue;
        if (a === null) throw Error(c(311));
        a.lastRenderedReducer = l;
        var r = t.baseQueue, o = a.pending;
        if (o !== null) {
          if (r !== null) {
            var d = r.next;
            r.next = o.next, o.next = d;
          }
          e.baseQueue = r = o, a.pending = null;
        }
        if (o = t.baseState, r === null) t.memoizedState = o;
        else {
          e = r.next;
          var h = d = null, z = null, C = e, Y = !1;
          do {
            var U = C.lane & -536870913;
            if (U !== C.lane ? (pt & U) === U : ($e & U) === U) {
              var K = C.revertLane;
              if (K === 0)
                z !== null && (z = z.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: C.action,
                  hasEagerState: C.hasEagerState,
                  eagerState: C.eagerState,
                  next: null
                }), U === sa && (Y = !0);
              else if (($e & K) === K) {
                C = C.next, K === sa && (Y = !0);
                continue;
              } else
                U = {
                  lane: 0,
                  revertLane: C.revertLane,
                  gesture: null,
                  action: C.action,
                  hasEagerState: C.hasEagerState,
                  eagerState: C.eagerState,
                  next: null
                }, z === null ? (h = z = U, d = o) : z = z.next = U, ut.lanes |= K, xl |= K;
              U = C.action, Ql && l(o, U), o = C.hasEagerState ? C.eagerState : l(o, U);
            } else
              K = {
                lane: U,
                revertLane: C.revertLane,
                gesture: C.gesture,
                action: C.action,
                hasEagerState: C.hasEagerState,
                eagerState: C.eagerState,
                next: null
              }, z === null ? (h = z = K, d = o) : z = z.next = K, ut.lanes |= U, xl |= U;
            C = C.next;
          } while (C !== null && C !== e);
          if (z === null ? d = o : z.next = h, !ge(o, t.memoizedState) && (Dt = !0, Y && (l = ca, l !== null)))
            throw l;
          t.memoizedState = o, t.baseState = d, t.baseQueue = z, a.lastRenderedState = o;
        }
        return r === null && (a.lanes = 0), [t.memoizedState, a.dispatch];
      }
      function qi(t) {
        var e = Ot(), l = e.queue;
        if (l === null) throw Error(c(311));
        l.lastRenderedReducer = t;
        var a = l.dispatch, r = l.pending, o = e.memoizedState;
        if (r !== null) {
          l.pending = null;
          var d = r = r.next;
          do
            o = t(o, d.action), d = d.next;
          while (d !== r);
          ge(o, e.memoizedState) || (Dt = !0), e.memoizedState = o, e.baseQueue === null && (e.baseState = o), l.lastRenderedState = o;
        }
        return [o, a];
      }
      function eu(t, e, l) {
        var a = ut, r = Ot(), o = ht;
        if (o) {
          if (l === void 0)
            throw Error(c(407));
          l = l();
        } else l = e();
        var d = !ge(
          (_t || r).memoizedState,
          l
        );
        if (d && (r.memoizedState = l, Dt = !0), r = r.queue, Gi(nu.bind(null, a, r, t), [
          t
        ]), r.getSnapshot !== e || d || Ut !== null && Ut.memoizedState.tag & 1) {
          if (a.flags |= 2048, Fl(
            9,
            { destroy: void 0 },
            au.bind(
              null,
              a,
              r,
              l,
              e
            ),
            null
          ), St === null) throw Error(c(349));
          o || ($e & 127) !== 0 || lu(a, e, l);
        }
        return l;
      }
      function lu(t, e, l) {
        t.flags |= 16384, t = { getSnapshot: e, value: l }, e = ut.updateQueue, e === null ? (e = bn(), ut.updateQueue = e, e.stores = [t]) : (l = e.stores, l === null ? e.stores = [t] : l.push(t));
      }
      function au(t, e, l, a) {
        e.value = l, e.getSnapshot = a, iu(e) && ru(t);
      }
      function nu(t, e, l) {
        return l(function() {
          iu(e) && ru(t);
        });
      }
      function iu(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var l = e();
          return !ge(t, l);
        } catch {
          return !0;
        }
      }
      function ru(t) {
        var e = jl(t, 2);
        e !== null && ie(e, t, 2);
      }
      function Bi(t) {
        var e = ae();
        if (typeof t == "function") {
          var l = t;
          if (t = l(), Ql) {
            Mt(!0);
            try {
              l();
            } finally {
              Mt(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ke,
          lastRenderedState: t
        }, e;
      }
      function ou(t, e, l, a) {
        return t.baseState = l, Di(
          t,
          _t,
          typeof a == "function" ? a : Ke
        );
      }
      function lf(t, e, l, a, r) {
        if (Sn(t)) throw Error(c(485));
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
          P.T !== null ? l(!0) : o.isTransition = !1, a(o), l = e.pending, l === null ? (o.next = e.pending = o, uu(e, o)) : (o.next = l.next, e.pending = l.next = o);
        }
      }
      function uu(t, e) {
        var l = e.action, a = e.payload, r = t.state;
        if (e.isTransition) {
          var o = P.T, d = {};
          P.T = d;
          try {
            var h = l(r, a), z = P.S;
            z !== null && z(d, h), su(t, e, h);
          } catch (C) {
            Yi(t, e, C);
          } finally {
            o !== null && d.types !== null && (o.types = d.types), P.T = o;
          }
        } else
          try {
            o = l(r, a), su(t, e, o);
          } catch (C) {
            Yi(t, e, C);
          }
      }
      function su(t, e, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(a) {
            cu(t, e, a);
          },
          function(a) {
            return Yi(t, e, a);
          }
        ) : cu(t, e, l);
      }
      function cu(t, e, l) {
        e.status = "fulfilled", e.value = l, du(e), t.state = l, e = t.pending, e !== null && (l = e.next, l === e ? t.pending = null : (l = l.next, e.next = l, uu(t, l)));
      }
      function Yi(t, e, l) {
        var a = t.pending;
        if (t.pending = null, a !== null) {
          a = a.next;
          do
            e.status = "rejected", e.reason = l, du(e), e = e.next;
          while (e !== a);
        }
        t.action = null;
      }
      function du(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function fu(t, e) {
        return e;
      }
      function mu(t, e) {
        if (ht) {
          var l = St.formState;
          if (l !== null) {
            t: {
              var a = ut;
              if (ht) {
                if (kt) {
                  var r = xm(
                    kt,
                    Ee
                  );
                  if (r) {
                    kt = oc(r), a = wm(r);
                    break t;
                  }
                }
                rt(a);
              }
              a = !1;
            }
            a && (e = l[0]);
          }
        }
        l = ae(), l.memoizedState = l.baseState = e, a = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: fu,
          lastRenderedState: e
        }, l.queue = a, l = Au.bind(
          null,
          ut,
          a
        ), a.dispatch = l, a = Bi(!1);
        var o = Xi.bind(
          null,
          ut,
          !1,
          a.queue
        );
        return a = ae(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, a.queue = r, l = lf.bind(
          null,
          ut,
          r,
          o,
          l
        ), r.dispatch = l, a.memoizedState = t, [e, l, !1];
      }
      function pu(t) {
        var e = Ot();
        return hu(e, _t, t);
      }
      function hu(t, e, l) {
        if (e = Di(
          t,
          e,
          fu
        )[0], t = xn(Ke)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var a = ja(e);
          } catch (d) {
            throw d === da ? Ln : d;
          }
        else a = e;
        e = Ot();
        var r = e.queue, o = r.dispatch;
        return l !== e.memoizedState && (ut.flags |= 2048, Fl(
          9,
          { destroy: void 0 },
          af.bind(null, r, l),
          null
        )), [a, o, t];
      }
      function af(t, e) {
        t.action = e;
      }
      function gu(t) {
        var e = Ot(), l = _t;
        if (l !== null)
          return hu(e, l, t);
        Ot(), e = e.memoizedState, l = Ot();
        var a = l.queue.dispatch;
        return l.memoizedState = t, [e, a, !1];
      }
      function Fl(t, e, l, a) {
        return t = { tag: t, create: l, deps: a, inst: e, next: null }, e = ut.updateQueue, e === null && (e = bn(), ut.updateQueue = e), l = e.lastEffect, l === null ? e.lastEffect = t.next = t : (a = l.next, l.next = t, t.next = a, e.lastEffect = t), t;
      }
      function vu() {
        return Ot().memoizedState;
      }
      function wn(t, e, l, a) {
        var r = ae();
        ut.flags |= t, r.memoizedState = Fl(
          1 | e,
          { destroy: void 0 },
          l,
          a === void 0 ? null : a
        );
      }
      function _n(t, e, l, a) {
        var r = Ot();
        a = a === void 0 ? null : a;
        var o = r.memoizedState.inst;
        _t !== null && a !== null && Ai(a, _t.memoizedState.deps) ? r.memoizedState = Fl(e, o, l, a) : (ut.flags |= t, r.memoizedState = Fl(
          1 | e,
          o,
          l,
          a
        ));
      }
      function bu(t, e) {
        wn(8390656, 8, t, e);
      }
      function Gi(t, e) {
        _n(2048, 8, t, e);
      }
      function nf(t) {
        ut.flags |= 4;
        var e = ut.updateQueue;
        if (e === null)
          e = bn(), ut.updateQueue = e, e.events = [t];
        else {
          var l = e.events;
          l === null ? e.events = [t] : l.push(t);
        }
      }
      function yu(t) {
        var e = Ot().memoizedState;
        return nf({ ref: e, nextImpl: t }), function() {
          if ((dt & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function xu(t, e) {
        return _n(4, 2, t, e);
      }
      function wu(t, e) {
        return _n(4, 4, t, e);
      }
      function _u(t, e) {
        if (typeof e == "function") {
          t = t();
          var l = e(t);
          return function() {
            typeof l == "function" ? l() : e(null);
          };
        }
        if (e != null)
          return t = t(), e.current = t, function() {
            e.current = null;
          };
      }
      function Su(t, e, l) {
        l = l != null ? l.concat([t]) : null, _n(
          4,
          4,
          _u.bind(null, e, t),
          l
        );
      }
      function Qi() {
      }
      function zu(t, e) {
        var l = Ot();
        e = e === void 0 ? null : e;
        var a = l.memoizedState;
        return e !== null && Ai(e, a[1]) ? a[0] : (l.memoizedState = [t, e], t);
      }
      function Eu(t, e) {
        var l = Ot();
        e = e === void 0 ? null : e;
        var a = l.memoizedState;
        if (e !== null && Ai(e, a[1]))
          return a[0];
        if (a = t(), Ql) {
          Mt(!0);
          try {
            t();
          } finally {
            Mt(!1);
          }
        }
        return l.memoizedState = [a, e], a;
      }
      function Vi(t, e, l) {
        return l === void 0 || ($e & 1073741824) !== 0 && (pt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = l, t = ws(), ut.lanes |= t, xl |= t, l);
      }
      function Nu(t, e, l, a) {
        return ge(l, e) ? l : pa.current !== null ? (t = Vi(t, l, a), ge(t, e) || (Dt = !0), t) : ($e & 42) === 0 || ($e & 1073741824) !== 0 && (pt & 261930) === 0 ? (Dt = !0, t.memoizedState = l) : (t = ws(), ut.lanes |= t, xl |= t, e);
      }
      function ku(t, e, l, a, r) {
        var o = Fe();
        Kt(
          o !== 0 && 8 > o ? o : 8
        );
        var d = P.T, h = {};
        P.T = h, Xi(t, !1, e, l);
        try {
          var z = r(), C = P.S;
          if (C !== null && C(h, z), z !== null && typeof z == "object" && typeof z.then == "function") {
            var Y = tf(
              z,
              a
            );
            Aa(
              t,
              e,
              Y,
              fe(t)
            );
          } else
            Aa(
              t,
              e,
              a,
              fe(t)
            );
        } catch (U) {
          Aa(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: U },
            fe()
          );
        } finally {
          Kt(o), d !== null && h.types !== null && (d.types = h.types), P.T = d;
        }
      }
      function Tu(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: la,
          baseState: la,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ke,
            lastRenderedState: la
          },
          next: null
        };
        var l = {};
        return e.next = {
          memoizedState: l,
          baseState: l,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ke,
            lastRenderedState: l
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Ki() {
        return Lt(Ul);
      }
      function Cu() {
        return Ot().memoizedState;
      }
      function ju() {
        return Ot().memoizedState;
      }
      function rf(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var l = fe();
              t = ol(l);
              var a = ul(e, t, l);
              a !== null && (ie(a, e, l), ka(a, e, l)), e = { cache: wi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function of(t, e, l) {
        var a = fe();
        l = {
          lane: a,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Sn(t) ? Mu(e, l) : (l = zi(t, e, l, a), l !== null && (ie(l, t, a), Ou(l, e, a)));
      }
      function Au(t, e, l) {
        var a = fe();
        Aa(t, e, l, a);
      }
      function Aa(t, e, l, a) {
        var r = {
          lane: a,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Sn(t)) Mu(e, r);
        else {
          var o = t.alternate;
          if (t.lanes === 0 && (o === null || o.lanes === 0) && (o = e.lastRenderedReducer, o !== null))
            try {
              var d = e.lastRenderedState, h = o(d, l);
              if (r.hasEagerState = !0, r.eagerState = h, ge(h, d))
                return hn(t, e, r, 0), St === null && pn(), !1;
            } catch {
            } finally {
            }
          if (l = zi(t, e, r, a), l !== null)
            return ie(l, t, a), Ou(l, e, a), !0;
        }
        return !1;
      }
      function Xi(t, e, l, a) {
        if (a = {
          lane: 2,
          revertLane: _i(),
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Sn(t)) {
          if (e) throw Error(c(479));
        } else
          e = zi(
            t,
            l,
            a,
            2
          ), e !== null && ie(e, t, 2);
      }
      function Sn(t) {
        var e = t.alternate;
        return t === ut || e !== null && e === ut;
      }
      function Mu(t, e) {
        ha = In = !0;
        var l = t.pending;
        l === null ? e.next = e : (e.next = l.next, l.next = e), t.pending = e;
      }
      function Ou(t, e, l) {
        if ((l & 4194048) !== 0) {
          var a = e.lanes;
          a &= t.pendingLanes, l |= a, e.lanes = l, Q(t, l);
        }
      }
      function Zi(t, e, l, a) {
        e = t.memoizedState, l = l(a, e), l = l == null ? e : wr({}, e, l), t.memoizedState = l, t.lanes === 0 && (t.updateQueue.baseState = l);
      }
      function Ru(t, e, l, a, r, o, d) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(a, o, d) : e.prototype && e.prototype.isPureReactComponent ? !dn(l, a) || !dn(r, o) : !0;
      }
      function Hu(t, e, l, a) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(l, a), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(l, a), e.state !== t && Zr.enqueueReplaceState(e, e.state, null);
      }
      function Al(t, e) {
        var l = e;
        if ("ref" in e) {
          l = {};
          for (var a in e)
            a !== "ref" && (l[a] = e[a]);
        }
        if (t = t.defaultProps) {
          l === e && (l = wr({}, l));
          for (var r in t)
            l[r] === void 0 && (l[r] = t[r]);
        }
        return l;
      }
      function zn(t, e) {
        try {
          var l = t.onUncaughtError;
          l(e.value, { componentStack: e.stack });
        } catch (a) {
          setTimeout(function() {
            throw a;
          });
        }
      }
      function Uu(t, e, l) {
        try {
          var a = t.onCaughtError;
          a(l.value, {
            componentStack: l.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Ji(t, e, l) {
        return l = ol(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          zn(t, e);
        }, l;
      }
      function Du(t) {
        return t = ol(t), t.tag = 3, t;
      }
      function qu(t, e, l, a) {
        var r = l.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var o = a.value;
          t.payload = function() {
            return r(o);
          }, t.callback = function() {
            Uu(e, l, a);
          };
        }
        var d = l.stateNode;
        d !== null && typeof d.componentDidCatch == "function" && (t.callback = function() {
          Uu(e, l, a), typeof r != "function" && (wl === null ? wl = /* @__PURE__ */ new Set([this]) : wl.add(this));
          var h = a.stack;
          this.componentDidCatch(a.value, {
            componentStack: h !== null ? h : ""
          });
        });
      }
      function uf(t, e, l, a, r) {
        if (l.flags |= 32768, a !== null && typeof a == "object" && typeof a.then == "function") {
          if (e = l.alternate, e !== null && Ll(
            e,
            l,
            r,
            !0
          ), l = ve.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return ke === null ? On() : l.alternate === null && At === 0 && (At = 3), l.flags &= -257, l.flags |= 65536, l.lanes = r, a === Wn ? l.flags |= 16384 : (e = l.updateQueue, e === null ? l.updateQueue = /* @__PURE__ */ new Set([a]) : e.add(a), gr(t, a, r)), !1;
              case 22:
                return l.flags |= 65536, a === Wn ? l.flags |= 16384 : (e = l.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([a])
                }, l.updateQueue = e) : (l = e.retryQueue, l === null ? e.retryQueue = /* @__PURE__ */ new Set([a]) : l.add(a)), gr(t, a, r)), !1;
            }
            throw Error(c(435, l.tag));
          }
          return gr(t, a, r), On(), !1;
        }
        if (ht)
          return e = ve.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, a !== qr && (t = Error(c(422), { cause: a }), za(
            it(t, l)
          ))) : (a !== qr && (e = Error(c(423), {
            cause: a
          }), za(
            it(e, l)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, a = it(a, l), r = Ji(
            t.stateNode,
            a,
            r
          ), ki(t, r), At !== 4 && (At = 2)), !1;
        var o = Error(c(520), { cause: a });
        if (o = it(o, l), Fa === null ? Fa = [o] : Fa.push(o), At !== 4 && (At = 2), e === null) return !0;
        a = it(a, l), l = e;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, t = r & -r, l.lanes |= t, t = Ji(l.stateNode, a, t), ki(l, t), !1;
            case 1:
              if (e = l.type, o = l.stateNode, (l.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (wl === null || !wl.has(
                o
              ))))
                return l.flags |= 65536, r &= -r, l.lanes |= r, r = Du(r), qu(
                  r,
                  t,
                  l,
                  a
                ), ki(l, r), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function Wt(t, e, l, a) {
        e.child = t === null ? zc(e, null, l, a) : Gl(
          e,
          t.child,
          l,
          a
        );
      }
      function Bu(t, e, l, a, r) {
        l = l.render;
        var o = e.ref;
        if ("ref" in a) {
          var d = {};
          for (var h in a)
            h !== "ref" && (d[h] = a[h]);
        } else d = a;
        return Tl(e), a = Mi(
          t,
          e,
          l,
          d,
          o,
          r
        ), h = Oi(), t !== null && !Dt ? (Ri(t, e, r), Xe(t, e, r)) : (ht && h && M(e), e.flags |= 1, Wt(t, e, a, r), e.child);
      }
      function Yu(t, e, l, a, r) {
        if (t === null) {
          var o = l.type;
          return typeof o == "function" && !vr(o) && o.defaultProps === void 0 && l.compare === null ? (e.tag = 15, e.type = o, Gu(
            t,
            e,
            o,
            a,
            r
          )) : (t = Hn(
            l.type,
            null,
            a,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (o = t.child, !tr(t, r)) {
          var d = o.memoizedProps;
          if (l = l.compare, l = l !== null ? l : dn, l(d, a) && t.ref === e.ref)
            return Xe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Le(o, a), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Gu(t, e, l, a, r) {
        if (t !== null) {
          var o = t.memoizedProps;
          if (dn(o, a) && t.ref === e.ref)
            if (Dt = !1, e.pendingProps = a = o, tr(t, r))
              (t.flags & 131072) !== 0 && (Dt = !0);
            else
              return e.lanes = t.lanes, Xe(t, e, r);
        }
        return Li(
          t,
          e,
          l,
          a,
          r
        );
      }
      function Qu(t, e, l, a) {
        var r = a.children, o = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), a.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (o = o !== null ? o.baseLanes | l : l, t !== null) {
              for (a = e.child = t.child, r = 0; a !== null; )
                r = r | a.lanes | a.childLanes, a = a.sibling;
              a = r & ~o;
            } else a = 0, e.child = null;
            return Vu(
              t,
              e,
              o,
              l,
              a
            );
          }
          if ((l & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && cn(
              e,
              o !== null ? o.cachePool : null
            ), o !== null ? Io(e, o) : Ti(), $o(e);
          else
            return a = e.lanes = 536870912, Vu(
              t,
              e,
              o !== null ? o.baseLanes | l : l,
              l,
              a
            );
        } else
          o !== null ? (cn(e, o.cachePool), Io(e, o), cl(), e.memoizedState = null) : (t !== null && cn(e, null), Ti(), cl());
        return Wt(t, e, r, l), e.child;
      }
      function Ma(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Vu(t, e, l, a, r) {
        var o = Si();
        return o = o === null ? null : {
          parent: We ? Tt._currentValue : Tt._currentValue2,
          pool: o
        }, e.memoizedState = {
          baseLanes: l,
          cachePool: o
        }, t !== null && cn(e, null), Ti(), $o(e), t !== null && Ll(t, e, a, !0), e.childLanes = r, null;
      }
      function En(t, e) {
        return e = kn(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Ku(t, e, l) {
        return Gl(e, t.child, null, l), t = En(
          e,
          e.pendingProps
        ), t.flags |= 2, de(e), e.memoizedState = null, t;
      }
      function sf(t, e, l) {
        var a = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (ht) {
            if (a.mode === "hidden")
              return t = En(e, a), e.lanes = 536870912, Ma(null, t);
            if (ji(e), (t = kt) ? (t = jm(
              t,
              Ee
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: hl !== null ? { id: Be, overflow: Ye } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Gs(t), l.return = e, e.child = l, It = e, kt = null)) : t = null, t === null) throw rt(e);
            return e.lanes = 536870912, null;
          }
          return En(e, a);
        }
        var o = t.memoizedState;
        if (o !== null) {
          var d = o.dehydrated;
          if (ji(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = Ku(
                t,
                e,
                l
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (Dt || Ll(
            t,
            e,
            l,
            !1
          ), r = (l & t.childLanes) !== 0, Dt || r) {
            if (a = St, a !== null && (d = mt(a, l), d !== 0 && d !== o.retryLane))
              throw o.retryLane = d, jl(t, d), ie(a, t, d), Jr;
            On(), e = Ku(
              t,
              e,
              l
            );
          } else
            t = o.treeContext, le && (kt = Em(d), It = e, ht = !0, vl = null, Ee = !1, t !== null && L(e, t)), e = En(e, a), e.flags |= 4096;
          return e;
        }
        return t = Le(t.child, {
          mode: a.mode,
          children: a.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Nn(t, e) {
        var l = e.ref;
        if (l === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(c(284));
          (t === null || t.ref !== l) && (e.flags |= 4194816);
        }
      }
      function Li(t, e, l, a, r) {
        return Tl(e), l = Mi(
          t,
          e,
          l,
          a,
          void 0,
          r
        ), a = Oi(), t !== null && !Dt ? (Ri(t, e, r), Xe(t, e, r)) : (ht && a && M(e), e.flags |= 1, Wt(t, e, l, r), e.child);
      }
      function Xu(t, e, l, a, r, o) {
        return Tl(e), e.updateQueue = null, l = tu(
          e,
          a,
          l,
          r
        ), Po(t), a = Oi(), t !== null && !Dt ? (Ri(t, e, o), Xe(t, e, o)) : (ht && a && M(e), e.flags |= 1, Wt(t, e, l, o), e.child);
      }
      function Zu(t, e, l, a, r) {
        if (Tl(e), e.stateNode === null) {
          var o = ia, d = l.contextType;
          typeof d == "object" && d !== null && (o = Lt(d)), o = new l(a, o), e.memoizedState = o.state !== null && o.state !== void 0 ? o.state : null, o.updater = Zr, e.stateNode = o, o._reactInternals = e, o = e.stateNode, o.props = a, o.state = e.memoizedState, o.refs = {}, Ei(e), d = l.contextType, o.context = typeof d == "object" && d !== null ? Lt(d) : ia, o.state = e.memoizedState, d = l.getDerivedStateFromProps, typeof d == "function" && (Zi(
            e,
            l,
            d,
            a
          ), o.state = e.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof o.getSnapshotBeforeUpdate == "function" || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (d = o.state, typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount(), d !== o.state && Zr.enqueueReplaceState(
            o,
            o.state,
            null
          ), Ca(e, a, o, r), Ta(), o.state = e.memoizedState), typeof o.componentDidMount == "function" && (e.flags |= 4194308), a = !0;
        } else if (t === null) {
          o = e.stateNode;
          var h = e.memoizedProps, z = Al(l, h);
          o.props = z;
          var C = o.context, Y = l.contextType;
          d = ia, typeof Y == "object" && Y !== null && (d = Lt(Y));
          var U = l.getDerivedStateFromProps;
          Y = typeof U == "function" || typeof o.getSnapshotBeforeUpdate == "function", h = e.pendingProps !== h, Y || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (h || C !== d) && Hu(
            e,
            o,
            a,
            d
          ), bl = !1;
          var K = e.memoizedState;
          o.state = K, Ca(e, a, o, r), Ta(), C = e.memoizedState, h || K !== C || bl ? (typeof U == "function" && (Zi(
            e,
            l,
            U,
            a
          ), C = e.memoizedState), (z = bl || Ru(
            e,
            l,
            z,
            a,
            K,
            C,
            d
          )) ? (Y || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = a, e.memoizedState = C), o.props = a, o.state = C, o.context = d, a = z) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), a = !1);
        } else {
          o = e.stateNode, Ni(t, e), d = e.memoizedProps, Y = Al(l, d), o.props = Y, U = e.pendingProps, K = o.context, C = l.contextType, z = ia, typeof C == "object" && C !== null && (z = Lt(C)), h = l.getDerivedStateFromProps, (C = typeof h == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (d !== U || K !== z) && Hu(
            e,
            o,
            a,
            z
          ), bl = !1, K = e.memoizedState, o.state = K, Ca(e, a, o, r), Ta();
          var ot = e.memoizedState;
          d !== U || K !== ot || bl || t !== null && t.dependencies !== null && on(t.dependencies) ? (typeof h == "function" && (Zi(
            e,
            l,
            h,
            a
          ), ot = e.memoizedState), (Y = bl || Ru(
            e,
            l,
            Y,
            a,
            K,
            ot,
            z
          ) || t !== null && t.dependencies !== null && on(t.dependencies)) ? (C || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(a, ot, z), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(
            a,
            ot,
            z
          )), typeof o.componentDidUpdate == "function" && (e.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 1024), e.memoizedProps = a, e.memoizedState = ot), o.props = a, o.state = ot, o.context = z, a = Y) : (typeof o.componentDidUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 1024), a = !1);
        }
        return o = a, Nn(t, e), a = (e.flags & 128) !== 0, o || a ? (o = e.stateNode, l = a && typeof l.getDerivedStateFromError != "function" ? null : o.render(), e.flags |= 1, t !== null && a ? (e.child = Gl(
          e,
          t.child,
          null,
          r
        ), e.child = Gl(
          e,
          null,
          l,
          r
        )) : Wt(t, e, l, r), e.memoizedState = o.state, t = e.child) : t = Xe(
          t,
          e,
          r
        ), t;
      }
      function Ju(t, e, l, a) {
        return Ce(), e.flags |= 256, Wt(t, e, l, a), e.child;
      }
      function Wi(t) {
        return { baseLanes: t, cachePool: Qo() };
      }
      function Fi(t, e, l) {
        return t = t !== null ? t.childLanes & ~l : 0, e && (t |= ye), t;
      }
      function Lu(t, e, l) {
        var a = e.pendingProps, r = !1, o = (e.flags & 128) !== 0, d;
        if ((d = o) || (d = t !== null && t.memoizedState === null ? !1 : (Rt.current & 2) !== 0), d && (r = !0, e.flags &= -129), d = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (ht) {
            if (r ? sl(e) : cl(), (t = kt) ? (t = Am(
              t,
              Ee
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: hl !== null ? { id: Be, overflow: Ye } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Gs(t), l.return = e, e.child = l, It = e, kt = null)) : t = null, t === null) throw rt(e);
            return Ar(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var h = a.children;
          return a = a.fallback, r ? (cl(), r = e.mode, h = kn(
            { mode: "hidden", children: h },
            r
          ), a = Rl(
            a,
            r,
            l,
            null
          ), h.return = e, a.return = e, h.sibling = a, e.child = h, a = e.child, a.memoizedState = Wi(l), a.childLanes = Fi(
            t,
            d,
            l
          ), e.memoizedState = Lr, Ma(null, a)) : (sl(e), Ii(e, h));
        }
        var z = t.memoizedState;
        if (z !== null && (h = z.dehydrated, h !== null)) {
          if (o)
            e.flags & 256 ? (sl(e), e.flags &= -257, e = $i(
              t,
              e,
              l
            )) : e.memoizedState !== null ? (cl(), e.child = t.child, e.flags |= 128, e = null) : (cl(), h = a.fallback, r = e.mode, a = kn(
              { mode: "visible", children: a.children },
              r
            ), h = Rl(
              h,
              r,
              l,
              null
            ), h.flags |= 2, a.return = e, h.return = e, a.sibling = h, e.child = a, Gl(
              e,
              t.child,
              null,
              l
            ), a = e.child, a.memoizedState = Wi(l), a.childLanes = Fi(
              t,
              d,
              l
            ), e.memoizedState = Lr, e = Ma(null, a));
          else if (sl(e), Ar(h))
            d = bm(h).digest, a = Error(c(419)), a.stack = "", a.digest = d, za({ value: a, source: null, stack: null }), e = $i(
              t,
              e,
              l
            );
          else if (Dt || Ll(
            t,
            e,
            l,
            !1
          ), d = (l & t.childLanes) !== 0, Dt || d) {
            if (d = St, d !== null && (a = mt(
              d,
              l
            ), a !== 0 && a !== z.retryLane))
              throw z.retryLane = a, jl(t, a), ie(d, t, a), Jr;
            jr(h) || On(), e = $i(
              t,
              e,
              l
            );
          } else
            jr(h) ? (e.flags |= 192, e.child = t.child, e = null) : (t = z.treeContext, le && (kt = Nm(
              h
            ), It = e, ht = !0, vl = null, Ee = !1, t !== null && L(e, t)), e = Ii(
              e,
              a.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (cl(), h = a.fallback, r = e.mode, z = t.child, o = z.sibling, a = Le(z, {
          mode: "hidden",
          children: a.children
        }), a.subtreeFlags = z.subtreeFlags & 65011712, o !== null ? h = Le(
          o,
          h
        ) : (h = Rl(
          h,
          r,
          l,
          null
        ), h.flags |= 2), h.return = e, a.return = e, a.sibling = h, e.child = a, Ma(null, a), a = e.child, h = t.child.memoizedState, h === null ? h = Wi(l) : (r = h.cachePool, r !== null ? (z = We ? Tt._currentValue : Tt._currentValue2, r = r.parent !== z ? { parent: z, pool: z } : r) : r = Qo(), h = {
          baseLanes: h.baseLanes | l,
          cachePool: r
        }), a.memoizedState = h, a.childLanes = Fi(
          t,
          d,
          l
        ), e.memoizedState = Lr, Ma(t.child, a)) : (sl(e), l = t.child, t = l.sibling, l = Le(l, {
          mode: "visible",
          children: a.children
        }), l.return = e, l.sibling = null, t !== null && (d = e.deletions, d === null ? (e.deletions = [t], e.flags |= 16) : d.push(t)), e.child = l, e.memoizedState = null, l);
      }
      function Ii(t, e) {
        return e = kn(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function kn(t, e) {
        return t = u(22, t, null, e), t.lanes = 0, t;
      }
      function $i(t, e, l) {
        return Gl(e, t.child, null, l), t = Ii(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Wu(t, e, l) {
        t.lanes |= e;
        var a = t.alternate;
        a !== null && (a.lanes |= e), yi(t.return, e, l);
      }
      function Pi(t, e, l, a, r, o) {
        var d = t.memoizedState;
        d === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: a,
          tail: l,
          tailMode: r,
          treeForkCount: o
        } : (d.isBackwards = e, d.rendering = null, d.renderingStartTime = 0, d.last = a, d.tail = l, d.tailMode = r, d.treeForkCount = o);
      }
      function Fu(t, e, l) {
        var a = e.pendingProps, r = a.revealOrder, o = a.tail;
        a = a.children;
        var d = Rt.current, h = (d & 2) !== 0;
        if (h ? (d = d & 1 | 2, e.flags |= 128) : d &= 1, x(Rt, d), Wt(t, e, a, l), a = ht ? Va : 0, !h && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Wu(t, l, e);
            else if (t.tag === 19)
              Wu(t, l, e);
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
            for (l = e.child, r = null; l !== null; )
              t = l.alternate, t !== null && vn(t) === null && (r = l), l = l.sibling;
            l = r, l === null ? (r = e.child, e.child = null) : (r = l.sibling, l.sibling = null), Pi(
              e,
              !1,
              r,
              l,
              o,
              a
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (l = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && vn(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = l, l = r, r = t;
            }
            Pi(
              e,
              !0,
              l,
              null,
              o,
              a
            );
            break;
          case "together":
            Pi(
              e,
              !1,
              null,
              null,
              void 0,
              a
            );
            break;
          default:
            e.memoizedState = null;
        }
        return e.child;
      }
      function Xe(t, e, l) {
        if (t !== null && (e.dependencies = t.dependencies), xl |= e.lanes, (l & e.childLanes) === 0)
          if (t !== null) {
            if (Ll(
              t,
              e,
              l,
              !1
            ), (l & e.childLanes) === 0)
              return null;
          } else return null;
        if (t !== null && e.child !== t.child)
          throw Error(c(153));
        if (e.child !== null) {
          for (t = e.child, l = Le(t, t.pendingProps), e.child = l, l.return = e; t.sibling !== null; )
            t = t.sibling, l = l.sibling = Le(t, t.pendingProps), l.return = e;
          l.sibling = null;
        }
        return e.child;
      }
      function tr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && on(t)));
      }
      function cf(t, e, l) {
        switch (e.tag) {
          case 3:
            W(
              e,
              e.stateNode.containerInfo
            ), rl(e, Tt, t.memoizedState.cache), Ce();
            break;
          case 27:
          case 5:
            gt(e);
            break;
          case 4:
            W(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            rl(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, ji(e), null;
            break;
          case 13:
            var a = e.memoizedState;
            if (a !== null)
              return a.dehydrated !== null ? (sl(e), e.flags |= 128, null) : (l & e.child.childLanes) !== 0 ? Lu(
                t,
                e,
                l
              ) : (sl(e), t = Xe(
                t,
                e,
                l
              ), t !== null ? t.sibling : null);
            sl(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (a = (l & e.childLanes) !== 0, a || (Ll(
              t,
              e,
              l,
              !1
            ), a = (l & e.childLanes) !== 0), r) {
              if (a)
                return Fu(
                  t,
                  e,
                  l
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), x(Rt, Rt.current), a) break;
            return null;
          case 22:
            return e.lanes = 0, Qu(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            rl(e, Tt, t.memoizedState.cache);
        }
        return Xe(t, e, l);
      }
      function Iu(t, e, l) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Dt = !0;
          else {
            if (!tr(t, l) && (e.flags & 128) === 0)
              return Dt = !1, cf(
                t,
                e,
                l
              );
            Dt = (t.flags & 131072) !== 0;
          }
        else
          Dt = !1, ht && (e.flags & 1048576) !== 0 && g(e, Va, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var a = e.pendingProps;
              if (t = Cl(e.elementType), e.type = t, typeof t == "function")
                vr(t) ? (a = Al(t, a), e.tag = 1, e = Zu(
                  null,
                  e,
                  t,
                  a,
                  l
                )) : (e.tag = 0, e = Li(
                  null,
                  e,
                  t,
                  a,
                  l
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Sr) {
                    e.tag = 11, e = Bu(
                      null,
                      e,
                      t,
                      a,
                      l
                    );
                    break t;
                  } else if (r === Nr) {
                    e.tag = 14, e = Yu(
                      null,
                      e,
                      t,
                      a,
                      l
                    );
                    break t;
                  }
                }
                throw e = R(t) || t, Error(c(306, e, ""));
              }
            }
            return e;
          case 0:
            return Li(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 1:
            return a = e.type, r = Al(
              a,
              e.pendingProps
            ), Zu(
              t,
              e,
              a,
              r,
              l
            );
          case 3:
            t: {
              if (W(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(c(387));
              var o = e.pendingProps;
              r = e.memoizedState, a = r.element, Ni(t, e), Ca(e, o, null, l);
              var d = e.memoizedState;
              if (o = d.cache, rl(e, Tt, o), o !== r.cache && xi(
                e,
                [Tt],
                l,
                !0
              ), Ta(), o = d.element, le && r.isDehydrated)
                if (r = {
                  element: o,
                  isDehydrated: !1,
                  cache: d.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = Ju(
                    t,
                    e,
                    o,
                    l
                  );
                  break t;
                } else if (o !== a) {
                  a = it(
                    Error(c(424)),
                    e
                  ), za(a), e = Ju(
                    t,
                    e,
                    o,
                    l
                  );
                  break t;
                } else
                  for (le && (kt = zm(
                    e.stateNode.containerInfo
                  ), It = e, ht = !0, vl = null, Ee = !0), l = zc(
                    e,
                    null,
                    o,
                    l
                  ), e.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (Ce(), o === a) {
                  e = Xe(
                    t,
                    e,
                    l
                  );
                  break t;
                }
                Wt(t, e, o, l);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Oe)
              return Nn(t, e), t === null ? (l = cc(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = l : ht || (e.stateNode = Im(
                e.type,
                e.pendingProps,
                gl.current,
                e
              )) : e.memoizedState = cc(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Yt)
              return gt(e), t === null && Yt && ht && (a = e.stateNode = gc(
                e.type,
                e.pendingProps,
                gl.current,
                Ft.current,
                !1
              ), It = e, Ee = !0, kt = km(
                e.type,
                a,
                kt
              )), Wt(
                t,
                e,
                e.pendingProps.children,
                l
              ), Nn(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && ht && (Lm(
              e.type,
              e.pendingProps,
              Ft.current
            ), (r = a = kt) && (a = Tm(
              a,
              e.type,
              e.pendingProps,
              Ee
            ), a !== null ? (e.stateNode = a, It = e, kt = Sm(a), Ee = !1, r = !0) : r = !1), r || rt(e)), gt(e), r = e.type, o = e.pendingProps, d = t !== null ? t.memoizedProps : null, a = o.children, qn(r, o) ? a = null : d !== null && qn(r, d) && (e.flags |= 32), e.memoizedState !== null && (r = Mi(
              t,
              e,
              ef,
              null,
              null,
              l
            ), We ? Ul._currentValue = r : Ul._currentValue2 = r), Nn(t, e), Wt(t, e, a, l), e.child;
          case 6:
            return t === null && ht && (Wm(
              e.pendingProps,
              Ft.current
            ), (t = l = kt) && (l = Cm(
              l,
              e.pendingProps,
              Ee
            ), l !== null ? (e.stateNode = l, It = e, kt = null, t = !0) : t = !1), t || rt(e)), null;
          case 13:
            return Lu(t, e, l);
          case 4:
            return W(
              e,
              e.stateNode.containerInfo
            ), a = e.pendingProps, t === null ? e.child = Gl(
              e,
              null,
              a,
              l
            ) : Wt(t, e, a, l), e.child;
          case 11:
            return Bu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 7:
            return Wt(
              t,
              e,
              e.pendingProps,
              l
            ), e.child;
          case 8:
            return Wt(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 12:
            return Wt(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 10:
            return a = e.pendingProps, rl(e, e.type, a.value), Wt(
              t,
              e,
              a.children,
              l
            ), e.child;
          case 9:
            return r = e.type._context, a = e.pendingProps.children, Tl(e), r = Lt(r), a = a(r), e.flags |= 1, Wt(t, e, a, l), e.child;
          case 14:
            return Yu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 15:
            return Gu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 19:
            return Fu(
              t,
              e,
              l
            );
          case 31:
            return sf(t, e, l);
          case 22:
            return Qu(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            return Tl(e), a = Lt(Tt), t === null ? (r = Si(), r === null && (r = St, o = wi(), r.pooledCache = o, o.refCount++, o !== null && (r.pooledCacheLanes |= l), r = o), e.memoizedState = {
              parent: a,
              cache: r
            }, Ei(e), rl(e, Tt, r)) : ((t.lanes & l) !== 0 && (Ni(t, e), Ca(e, null, null, l), Ta()), r = t.memoizedState, o = e.memoizedState, r.parent !== a ? (r = { parent: a, cache: a }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), rl(e, Tt, a)) : (a = o.cache, rl(e, Tt, a), a !== r.cache && xi(
              e,
              [Tt],
              l,
              !0
            ))), Wt(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 29:
            throw e.pendingProps;
        }
        throw Error(c(156, e.tag));
      }
      function je(t) {
        t.flags |= 4;
      }
      function Tn(t) {
        qe && (t.flags |= 8);
      }
      function $u(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function er(t, e, l, a) {
        if (ee)
          for (l = e.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              Tr(t, l.stateNode);
            else if (!(l.tag === 4 || Yt && l.tag === 27) && l.child !== null) {
              l.child.return = l, l = l.child;
              continue;
            }
            if (l === e) break;
            for (; l.sibling === null; ) {
              if (l.return === null || l.return === e)
                return;
              l = l.return;
            }
            l.sibling.return = l.return, l = l.sibling;
          }
        else if (qe)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var o = r.stateNode;
              l && a && (o = ic(
                o,
                r.type,
                r.memoizedProps
              )), Tr(t, o);
            } else if (r.tag === 6)
              o = r.stateNode, l && a && (o = rc(
                o,
                r.memoizedProps
              )), Tr(t, o);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                o = r.child, o !== null && (o.return = r), er(t, r, !0, !0);
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
      function Pu(t, e, l, a) {
        var r = !1;
        if (qe)
          for (var o = e.child; o !== null; ) {
            if (o.tag === 5) {
              var d = o.stateNode;
              l && a && (d = ic(
                d,
                o.type,
                o.memoizedProps
              )), ac(t, d);
            } else if (o.tag === 6)
              d = o.stateNode, l && a && (d = rc(
                d,
                o.memoizedProps
              )), ac(t, d);
            else if (o.tag !== 4) {
              if (o.tag === 22 && o.memoizedState !== null)
                r = o.child, r !== null && (r.return = o), Pu(t, o, !0, !0), r = !0;
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
      function ts(t, e) {
        if (qe && $u(t, e)) {
          t = e.stateNode;
          var l = t.containerInfo, a = lc();
          Pu(a, e, !1, !1), t.pendingChildren = a, je(e), vm(l, a);
        }
      }
      function lr(t, e, l, a) {
        if (ee)
          t.memoizedProps !== a && je(e);
        else if (qe) {
          var r = t.stateNode, o = t.memoizedProps;
          if ((t = $u(t, e)) || o !== a) {
            var d = Ft.current;
            o = gm(
              r,
              l,
              o,
              a,
              !t,
              null
            ), o === r ? e.stateNode = r : (Tn(e), Is(
              o,
              l,
              a,
              d
            ) && je(e), e.stateNode = o, t && er(o, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function ar(t, e, l, a, r) {
        if ((t.mode & 32) !== 0 && (l === null ? Vf(e, a) : Kf(e, l, a))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Cr(e, a))
            if (Ps(t.stateNode, e, a))
              t.flags |= 8192;
            else if (Ns()) t.flags |= 8192;
            else
              throw Yl = Wn, Qr;
        } else t.flags &= -16777217;
      }
      function es(t, e) {
        if (Pm(e)) {
          if (t.flags |= 16777216, !hc(e))
            if (Ns()) t.flags |= 8192;
            else
              throw Yl = Wn, Qr;
        } else t.flags &= -16777217;
      }
      function Cn(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? V() : 536870912, t.lanes |= e, ya |= e);
      }
      function Oa(t, e) {
        if (!ht)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var l = null; e !== null; )
                e.alternate !== null && (l = e), e = e.sibling;
              l === null ? t.tail = null : l.sibling = null;
              break;
            case "collapsed":
              l = t.tail;
              for (var a = null; l !== null; )
                l.alternate !== null && (a = l), l = l.sibling;
              a === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : a.sibling = null;
          }
      }
      function Et(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, l = 0, a = 0;
        if (e)
          for (var r = t.child; r !== null; )
            l |= r.lanes | r.childLanes, a |= r.subtreeFlags & 65011712, a |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            l |= r.lanes | r.childLanes, a |= r.subtreeFlags, a |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= a, t.childLanes = l, e;
      }
      function df(t, e, l) {
        var a = e.pendingProps;
        switch (I(e), e.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return Et(e), null;
          case 1:
            return Et(e), null;
          case 3:
            return l = e.stateNode, a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ve(Tt), $(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (t === null || t.child === null) && (Te(e) ? je(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, il())), ts(t, e), Et(e), null;
          case 26:
            if (Oe) {
              var r = e.type, o = e.memoizedState;
              return t === null ? (je(e), o !== null ? (Et(e), es(
                e,
                o
              )) : (Et(e), ar(
                e,
                r,
                null,
                a,
                l
              ))) : o ? o !== t.memoizedState ? (je(e), Et(e), es(
                e,
                o
              )) : (Et(e), e.flags &= -16777217) : (o = t.memoizedProps, ee ? o !== a && je(e) : lr(
                t,
                e,
                r,
                a
              ), Et(e), ar(
                e,
                r,
                o,
                a,
                l
              )), null;
            }
          case 27:
            if (Yt) {
              if (Vt(e), l = gl.current, r = e.type, t !== null && e.stateNode != null)
                ee ? t.memoizedProps !== a && je(e) : lr(t, e, r, a);
              else {
                if (!a) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return Et(e), null;
                }
                t = Ft.current, Te(e) ? Nl(e, t) : (t = gc(
                  r,
                  a,
                  l,
                  t,
                  !0
                ), e.stateNode = t, je(e));
              }
              return Et(e), null;
            }
          case 5:
            if (Vt(e), r = e.type, t !== null && e.stateNode != null)
              lr(t, e, r, a);
            else {
              if (!a) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return Et(e), null;
              }
              if (o = Ft.current, Te(e))
                Nl(e, o), Qm(
                  e.stateNode,
                  r,
                  a,
                  o
                ) && (e.flags |= 64);
              else {
                var d = Hf(
                  r,
                  a,
                  gl.current,
                  o,
                  e
                );
                Tn(e), er(d, e, !1, !1), e.stateNode = d, Is(
                  d,
                  r,
                  a,
                  o
                ) && je(e);
              }
            }
            return Et(e), ar(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              l
            ), null;
          case 6:
            if (t && e.stateNode != null)
              l = t.memoizedProps, ee ? l !== a && je(e) : qe && (l !== a ? (t = gl.current, l = Ft.current, Tn(e), e.stateNode = $s(
                a,
                t,
                l,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof a != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = gl.current, l = Ft.current, Te(e)) {
                if (!le) throw Error(c(176));
                if (t = e.stateNode, l = e.memoizedProps, a = null, r = It, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      a = r.memoizedProps;
                  }
                Om(
                  t,
                  l,
                  e,
                  a
                ) || rt(e, !0);
              } else
                Tn(e), e.stateNode = $s(
                  a,
                  t,
                  l,
                  e
                );
            }
            return Et(e), null;
          case 31:
            if (l = e.memoizedState, t === null || t.memoizedState !== null) {
              if (a = Te(e), l !== null) {
                if (t === null) {
                  if (!a) throw Error(c(318));
                  if (!le) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  Rm(t, e);
                } else
                  Ce(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Et(e), t = !1;
              } else
                l = il(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = l), t = !0;
              if (!t)
                return e.flags & 256 ? (de(e), e) : (de(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return Et(e), null;
          case 13:
            if (a = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Te(e), a !== null && a.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!le) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  Hm(r, e);
                } else
                  Ce(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Et(e), r = !1;
              } else
                r = il(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (de(e), e) : (de(e), null);
            }
            return de(e), (e.flags & 128) !== 0 ? (e.lanes = l, e) : (l = a !== null, t = t !== null && t.memoizedState !== null, l && (a = e.child, r = null, a.alternate !== null && a.alternate.memoizedState !== null && a.alternate.memoizedState.cachePool !== null && (r = a.alternate.memoizedState.cachePool.pool), o = null, a.memoizedState !== null && a.memoizedState.cachePool !== null && (o = a.memoizedState.cachePool.pool), o !== r && (a.flags |= 2048)), l !== t && l && (e.child.flags |= 8192), Cn(e, e.updateQueue), Et(e), null);
          case 4:
            return $(), ts(t, e), t === null && Bf(e.stateNode.containerInfo), Et(e), null;
          case 10:
            return Ve(e.type), Et(e), null;
          case 19:
            if (E(Rt), a = e.memoizedState, a === null) return Et(e), null;
            if (r = (e.flags & 128) !== 0, o = a.rendering, o === null)
              if (r) Oa(a, !1);
              else {
                if (At !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (o = vn(t), o !== null) {
                      for (e.flags |= 128, Oa(a, !1), t = o.updateQueue, e.updateQueue = t, Cn(e, t), e.subtreeFlags = 0, t = l, l = e.child; l !== null; )
                        Ys(l, t), l = l.sibling;
                      return x(
                        Rt,
                        Rt.current & 1 | 2
                      ), ht && B(e, a.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                a.tail !== null && re() > Ia && (e.flags |= 128, r = !0, Oa(a, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = vn(o), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Cn(e, t), Oa(a, !0), a.tail === null && a.tailMode === "hidden" && !o.alternate && !ht)
                    return Et(e), null;
                } else
                  2 * re() - a.renderingStartTime > Ia && l !== 536870912 && (e.flags |= 128, r = !0, Oa(a, !1), e.lanes = 4194304);
              a.isBackwards ? (o.sibling = e.child, e.child = o) : (t = a.last, t !== null ? t.sibling = o : e.child = o, a.last = o);
            }
            return a.tail !== null ? (t = a.tail, a.rendering = t, a.tail = t.sibling, a.renderingStartTime = re(), t.sibling = null, l = Rt.current, x(
              Rt,
              r ? l & 1 | 2 : l & 1
            ), ht && B(e, a.treeForkCount), t) : (Et(e), null);
          case 22:
          case 23:
            return de(e), Ci(), a = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== a && (e.flags |= 8192) : a && (e.flags |= 8192), a ? (l & 536870912) !== 0 && (e.flags & 128) === 0 && (Et(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Et(e), l = e.updateQueue, l !== null && Cn(e, l.retryQueue), l = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), a = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (a = e.memoizedState.cachePool.pool), a !== l && (e.flags |= 2048), t !== null && E(Bl), null;
          case 24:
            return l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Ve(Tt), Et(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function ff(t, e) {
        switch (I(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ve(Tt), $(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Vt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (de(e), e.alternate === null)
                throw Error(c(340));
              Ce();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (de(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(c(340));
              Ce();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return E(Rt), null;
          case 4:
            return $(), null;
          case 10:
            return Ve(e.type), null;
          case 22:
          case 23:
            return de(e), Ci(), t !== null && E(Bl), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ve(Tt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function ls(t, e) {
        switch (I(e), e.tag) {
          case 3:
            Ve(Tt), $();
            break;
          case 26:
          case 27:
          case 5:
            Vt(e);
            break;
          case 4:
            $();
            break;
          case 31:
            e.memoizedState !== null && de(e);
            break;
          case 13:
            de(e);
            break;
          case 19:
            E(Rt);
            break;
          case 10:
            Ve(e.type);
            break;
          case 22:
          case 23:
            de(e), Ci(), t !== null && E(Bl);
            break;
          case 24:
            Ve(Tt);
        }
      }
      function Ra(t, e) {
        try {
          var l = e.updateQueue, a = l !== null ? l.lastEffect : null;
          if (a !== null) {
            var r = a.next;
            l = r;
            do {
              if ((l.tag & t) === t) {
                a = void 0;
                var o = l.create, d = l.inst;
                a = o(), d.destroy = a;
              }
              l = l.next;
            } while (l !== r);
          }
        } catch (h) {
          vt(e, e.return, h);
        }
      }
      function dl(t, e, l) {
        try {
          var a = e.updateQueue, r = a !== null ? a.lastEffect : null;
          if (r !== null) {
            var o = r.next;
            a = o;
            do {
              if ((a.tag & t) === t) {
                var d = a.inst, h = d.destroy;
                if (h !== void 0) {
                  d.destroy = void 0, r = e;
                  var z = l, C = h;
                  try {
                    C();
                  } catch (Y) {
                    vt(
                      r,
                      z,
                      Y
                    );
                  }
                }
              }
              a = a.next;
            } while (a !== o);
          }
        } catch (Y) {
          vt(e, e.return, Y);
        }
      }
      function as(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var l = t.stateNode;
          try {
            Fo(e, l);
          } catch (a) {
            vt(t, t.return, a);
          }
        }
      }
      function ns(t, e, l) {
        l.props = Al(
          t.type,
          t.memoizedProps
        ), l.state = t.memoizedState;
        try {
          l.componentWillUnmount();
        } catch (a) {
          vt(t, e, a);
        }
      }
      function Ha(t, e) {
        try {
          var l = t.ref;
          if (l !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var a = Ba(t.stateNode);
                break;
              case 30:
                a = t.stateNode;
                break;
              default:
                a = t.stateNode;
            }
            typeof l == "function" ? t.refCleanup = l(a) : l.current = a;
          }
        } catch (r) {
          vt(t, e, r);
        }
      }
      function De(t, e) {
        var l = t.ref, a = t.refCleanup;
        if (l !== null)
          if (typeof a == "function")
            try {
              a();
            } catch (r) {
              vt(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof l == "function")
            try {
              l(null);
            } catch (r) {
              vt(t, e, r);
            }
          else l.current = null;
      }
      function is(t) {
        var e = t.type, l = t.memoizedProps, a = t.stateNode;
        try {
          im(a, e, l, t);
        } catch (r) {
          vt(t, t.return, r);
        }
      }
      function nr(t, e, l) {
        try {
          rm(
            t.stateNode,
            t.type,
            l,
            e,
            t
          );
        } catch (a) {
          vt(t, t.return, a);
        }
      }
      function rs(t) {
        return t.tag === 5 || t.tag === 3 || (Oe ? t.tag === 26 : !1) || (Yt ? t.tag === 27 && aa(t.type) : !1) || t.tag === 4;
      }
      function ir(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || rs(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Yt && t.tag === 27 && aa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function rr(t, e, l) {
        var a = t.tag;
        if (a === 5 || a === 6)
          t = t.stateNode, e ? um(l, t, e) : am(l, t);
        else if (a !== 4 && (Yt && a === 27 && aa(t.type) && (l = t.stateNode, e = null), t = t.child, t !== null))
          for (rr(t, e, l), t = t.sibling; t !== null; )
            rr(t, e, l), t = t.sibling;
      }
      function jn(t, e, l) {
        var a = t.tag;
        if (a === 5 || a === 6)
          t = t.stateNode, e ? om(l, t, e) : lm(l, t);
        else if (a !== 4 && (Yt && a === 27 && aa(t.type) && (l = t.stateNode), t = t.child, t !== null))
          for (jn(t, e, l), t = t.sibling; t !== null; )
            jn(t, e, l), t = t.sibling;
      }
      function os(t, e, l) {
        t = t.containerInfo;
        try {
          nc(t, l);
        } catch (a) {
          vt(e, e.return, a);
        }
      }
      function us(t) {
        var e = t.stateNode, l = t.memoizedProps;
        try {
          ep(
            t.type,
            l,
            e,
            t
          );
        } catch (a) {
          vt(t, t.return, a);
        }
      }
      function mf(t, e) {
        for (Of(t.containerInfo), Xt = e; Xt !== null; )
          if (t = Xt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Xt = e;
          else
            for (; Xt !== null; ) {
              t = Xt;
              var l = t.alternate;
              switch (e = t.flags, t.tag) {
                case 0:
                  if ((e & 4) !== 0 && (e = t.updateQueue, e = e !== null ? e.events : null, e !== null))
                    for (var a = 0; a < e.length; a++) {
                      var r = e[a];
                      r.ref.impl = r.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((e & 1024) !== 0 && l !== null) {
                    e = void 0, a = t, r = l.memoizedProps, l = l.memoizedState;
                    var o = a.stateNode;
                    try {
                      var d = Al(
                        a.type,
                        r
                      );
                      e = o.getSnapshotBeforeUpdate(
                        d,
                        l
                      ), o.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (h) {
                      vt(a, a.return, h);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ee && hm(t.stateNode.containerInfo);
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
                e.return = t.return, Xt = e;
                break;
              }
              Xt = t.return;
            }
      }
      function ss(t, e, l) {
        var a = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            Ze(t, l), a & 4 && Ra(5, l);
            break;
          case 1:
            if (Ze(t, l), a & 4)
              if (t = l.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (d) {
                  vt(l, l.return, d);
                }
              else {
                var r = Al(
                  l.type,
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
                    l,
                    l.return,
                    d
                  );
                }
              }
            a & 64 && as(l), a & 512 && Ha(l, l.return);
            break;
          case 3:
            if (Ze(t, l), a & 64 && (a = l.updateQueue, a !== null)) {
              if (t = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    t = Ba(l.child.stateNode);
                    break;
                  case 1:
                    t = l.child.stateNode;
                }
              try {
                Fo(a, t);
              } catch (d) {
                vt(l, l.return, d);
              }
            }
            break;
          case 27:
            Yt && e === null && a & 4 && us(l);
          case 26:
          case 5:
            if (Ze(t, l), e === null) {
              if (a & 4) is(l);
              else if (a & 64) {
                t = l.type, e = l.memoizedProps, r = l.stateNode;
                try {
                  qm(
                    r,
                    t,
                    e,
                    l
                  );
                } catch (d) {
                  vt(l, l.return, d);
                }
              }
            }
            a & 512 && Ha(l, l.return);
            break;
          case 12:
            Ze(t, l);
            break;
          case 31:
            Ze(t, l), a & 4 && ds(t, l);
            break;
          case 13:
            Ze(t, l), a & 4 && fs(t, l), a & 64 && (a = l.memoizedState, a !== null && (a = a.dehydrated, a !== null && (l = xf.bind(
              null,
              l
            ), ym(a, l))));
            break;
          case 22:
            if (a = l.memoizedState !== null || Pe, !a) {
              e = e !== null && e.memoizedState !== null || qt, r = Pe;
              var o = qt;
              Pe = a, (qt = e) && !o ? Je(
                t,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : Ze(t, l), Pe = r, qt = o;
            }
            break;
          case 30:
            break;
          default:
            Ze(t, l);
        }
      }
      function cs(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, cs(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Qf(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ae(t, e, l) {
        for (l = l.child; l !== null; )
          or(
            t,
            e,
            l
          ), l = l.sibling;
      }
      function or(t, e, l) {
        if (he && typeof he.onCommitFiberUnmount == "function")
          try {
            he.onCommitFiberUnmount(Qa, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Oe) {
              qt || De(l, e), Ae(
                t,
                e,
                l
              ), l.memoizedState ? fc(l.memoizedState) : l.stateNode && pc(l.stateNode);
              break;
            }
          case 27:
            if (Yt) {
              qt || De(l, e);
              var a = Bt, r = oe;
              aa(l.type) && (Bt = l.stateNode, oe = !1), Ae(
                t,
                e,
                l
              ), vc(l.stateNode), Bt = a, oe = r;
              break;
            }
          case 5:
            qt || De(l, e);
          case 6:
            if (ee) {
              if (a = Bt, r = oe, Bt = null, Ae(
                t,
                e,
                l
              ), Bt = a, oe = r, Bt !== null)
                if (oe)
                  try {
                    cm(Bt, l.stateNode);
                  } catch (o) {
                    vt(
                      l,
                      e,
                      o
                    );
                  }
                else
                  try {
                    sm(Bt, l.stateNode);
                  } catch (o) {
                    vt(
                      l,
                      e,
                      o
                    );
                  }
            } else
              Ae(
                t,
                e,
                l
              );
            break;
          case 18:
            ee && Bt !== null && (oe ? Xm(
              Bt,
              l.stateNode
            ) : Km(Bt, l.stateNode));
            break;
          case 4:
            ee ? (a = Bt, r = oe, Bt = l.stateNode.containerInfo, oe = !0, Ae(
              t,
              e,
              l
            ), Bt = a, oe = r) : (qe && os(
              l.stateNode,
              l,
              lc()
            ), Ae(
              t,
              e,
              l
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            dl(2, l, e), qt || dl(4, l, e), Ae(
              t,
              e,
              l
            );
            break;
          case 1:
            qt || (De(l, e), a = l.stateNode, typeof a.componentWillUnmount == "function" && ns(
              l,
              e,
              a
            )), Ae(
              t,
              e,
              l
            );
            break;
          case 21:
            Ae(
              t,
              e,
              l
            );
            break;
          case 22:
            qt = (a = qt) || l.memoizedState !== null, Ae(
              t,
              e,
              l
            ), qt = a;
            break;
          default:
            Ae(
              t,
              e,
              l
            );
        }
      }
      function ds(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Ym(t);
          } catch (l) {
            vt(e, e.return, l);
          }
        }
      }
      function fs(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Gm(t);
          } catch (l) {
            vt(e, e.return, l);
          }
      }
      function pf(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new kc()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new kc()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function An(t, e) {
        var l = pf(t);
        e.forEach(function(a) {
          if (!l.has(a)) {
            l.add(a);
            var r = wf.bind(null, t, a);
            a.then(r, r);
          }
        });
      }
      function te(t, e) {
        var l = e.deletions;
        if (l !== null)
          for (var a = 0; a < l.length; a++) {
            var r = l[a], o = t, d = e;
            if (ee) {
              var h = d;
              t: for (; h !== null; ) {
                switch (h.tag) {
                  case 27:
                    if (Yt) {
                      if (aa(h.type)) {
                        Bt = h.stateNode, oe = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Bt = h.stateNode, oe = !1;
                    break t;
                  case 3:
                  case 4:
                    Bt = h.stateNode.containerInfo, oe = !0;
                    break t;
                }
                h = h.return;
              }
              if (Bt === null) throw Error(c(160));
              or(o, d, r), Bt = null, oe = !1;
            } else or(o, d, r);
            o = r.alternate, o !== null && (o.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            ms(e, t), e = e.sibling;
      }
      function ms(t, e) {
        var l = t.alternate, a = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            te(e, t), ne(t), a & 4 && (dl(3, t, t.return), Ra(3, t), dl(5, t, t.return));
            break;
          case 1:
            te(e, t), ne(t), a & 512 && (qt || l === null || De(l, l.return)), a & 64 && Pe && (t = t.updateQueue, t !== null && (a = t.callbacks, a !== null && (l = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = l === null ? a : l.concat(a))));
            break;
          case 26:
            if (Oe) {
              var r = Re;
              if (te(e, t), ne(t), a & 512 && (qt || l === null || De(l, l.return)), a & 4) {
                a = l !== null ? l.memoizedState : null;
                var o = t.memoizedState;
                l === null ? o === null ? t.stateNode === null ? t.stateNode = Fm(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : mc(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = dc(
                  r,
                  o,
                  t.memoizedProps
                ) : a !== o ? (a === null ? l.stateNode !== null && pc(l.stateNode) : fc(a), o === null ? mc(
                  r,
                  t.type,
                  t.stateNode
                ) : dc(
                  r,
                  o,
                  t.memoizedProps
                )) : o === null && t.stateNode !== null && nr(
                  t,
                  t.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Yt) {
              te(e, t), ne(t), a & 512 && (qt || l === null || De(l, l.return)), l !== null && a & 4 && nr(
                t,
                t.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (te(e, t), ne(t), a & 512 && (qt || l === null || De(l, l.return)), ee) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  ec(r);
                } catch (U) {
                  vt(t, t.return, U);
                }
              }
              a & 4 && t.stateNode != null && (r = t.memoizedProps, nr(
                t,
                r,
                l !== null ? l.memoizedProps : r
              )), a & 1024 && (Wr = !0);
            } else
              qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (te(e, t), ne(t), a & 4 && ee) {
              if (t.stateNode === null)
                throw Error(c(162));
              a = t.memoizedProps, l = l !== null ? l.memoizedProps : a, r = t.stateNode;
              try {
                nm(r, l, a);
              } catch (U) {
                vt(t, t.return, U);
              }
            }
            break;
          case 3:
            if (Oe ? ($m(), r = Re, Re = Mr(e.containerInfo), te(e, t), Re = r) : te(e, t), ne(t), a & 4) {
              if (ee && le && l !== null && l.memoizedState.isDehydrated)
                try {
                  Bm(e.containerInfo);
                } catch (U) {
                  vt(t, t.return, U);
                }
              if (qe) {
                a = e.containerInfo, l = e.pendingChildren;
                try {
                  nc(a, l);
                } catch (U) {
                  vt(t, t.return, U);
                }
              }
            }
            Wr && (Wr = !1, ps(t));
            break;
          case 4:
            Oe ? (l = Re, Re = Mr(
              t.stateNode.containerInfo
            ), te(e, t), ne(t), Re = l) : (te(e, t), ne(t)), a & 4 && qe && os(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            te(e, t), ne(t);
            break;
          case 31:
            te(e, t), ne(t), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, An(t, a)));
            break;
          case 13:
            te(e, t), ne(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (ni = re()), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, An(t, a)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var d = l !== null && l.memoizedState !== null, h = Pe, z = qt;
            if (Pe = h || r, qt = z || d, te(e, t), qt = z, Pe = h, ne(t), a & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (l === null || d || Pe || qt || Ml(t)), ee)) {
              t: if (l = null, ee)
                for (e = t; ; ) {
                  if (e.tag === 5 || Oe && e.tag === 26) {
                    if (l === null) {
                      d = l = e;
                      try {
                        o = d.stateNode, r ? dm(o) : mm(
                          d.stateNode,
                          d.memoizedProps
                        );
                      } catch (U) {
                        vt(d, d.return, U);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (l === null) {
                      d = e;
                      try {
                        var C = d.stateNode;
                        r ? fm(C) : pm(C, d.memoizedProps);
                      } catch (U) {
                        vt(d, d.return, U);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (l === null) {
                      d = e;
                      try {
                        var Y = d.stateNode;
                        r ? Zm(Y) : Jm(d.stateNode);
                      } catch (U) {
                        vt(d, d.return, U);
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
                    l === e && (l = null), e = e.return;
                  }
                  l === e && (l = null), e.sibling.return = e.return, e = e.sibling;
                }
            }
            a & 4 && (a = t.updateQueue, a !== null && (l = a.retryQueue, l !== null && (a.retryQueue = null, An(t, l))));
            break;
          case 19:
            te(e, t), ne(t), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, An(t, a)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            te(e, t), ne(t);
        }
      }
      function ne(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var l, a = t.return; a !== null; ) {
              if (rs(a)) {
                l = a;
                break;
              }
              a = a.return;
            }
            if (ee) {
              if (l == null) throw Error(c(160));
              switch (l.tag) {
                case 27:
                  if (Yt) {
                    var r = l.stateNode, o = ir(t);
                    jn(t, o, r);
                    break;
                  }
                case 5:
                  var d = l.stateNode;
                  l.flags & 32 && (ec(d), l.flags &= -33);
                  var h = ir(t);
                  jn(t, h, d);
                  break;
                case 3:
                case 4:
                  var z = l.stateNode.containerInfo, C = ir(t);
                  rr(
                    t,
                    C,
                    z
                  );
                  break;
                default:
                  throw Error(c(161));
              }
            }
          } catch (Y) {
            vt(t, t.return, Y);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function ps(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            ps(e), e.tag === 5 && e.flags & 1024 && Jf(e.stateNode), t = t.sibling;
          }
      }
      function Ze(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            ss(t, e.alternate, e), e = e.sibling;
      }
      function Ml(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              dl(4, e, e.return), Ml(e);
              break;
            case 1:
              De(e, e.return);
              var l = e.stateNode;
              typeof l.componentWillUnmount == "function" && ns(
                e,
                e.return,
                l
              ), Ml(e);
              break;
            case 27:
              Yt && vc(e.stateNode);
            case 26:
            case 5:
              De(e, e.return), Ml(e);
              break;
            case 22:
              e.memoizedState === null && Ml(e);
              break;
            case 30:
              Ml(e);
              break;
            default:
              Ml(e);
          }
          t = t.sibling;
        }
      }
      function Je(t, e, l) {
        for (l = l && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var a = e.alternate, r = t, o = e, d = o.flags;
          switch (o.tag) {
            case 0:
            case 11:
            case 15:
              Je(
                r,
                o,
                l
              ), Ra(4, o);
              break;
            case 1:
              if (Je(
                r,
                o,
                l
              ), a = o, r = a.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (C) {
                  vt(a, a.return, C);
                }
              if (a = o, r = a.updateQueue, r !== null) {
                var h = a.stateNode;
                try {
                  var z = r.shared.hiddenCallbacks;
                  if (z !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < z.length; r++)
                      Wo(z[r], h);
                } catch (C) {
                  vt(a, a.return, C);
                }
              }
              l && d & 64 && as(o), Ha(o, o.return);
              break;
            case 27:
              Yt && us(o);
            case 26:
            case 5:
              Je(
                r,
                o,
                l
              ), l && a === null && d & 4 && is(o), Ha(o, o.return);
              break;
            case 12:
              Je(
                r,
                o,
                l
              );
              break;
            case 31:
              Je(
                r,
                o,
                l
              ), l && d & 4 && ds(r, o);
              break;
            case 13:
              Je(
                r,
                o,
                l
              ), l && d & 4 && fs(r, o);
              break;
            case 22:
              o.memoizedState === null && Je(
                r,
                o,
                l
              ), Ha(o, o.return);
              break;
            case 30:
              break;
            default:
              Je(
                r,
                o,
                l
              );
          }
          e = e.sibling;
        }
      }
      function ur(t, e) {
        var l = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== l && (t != null && t.refCount++, l != null && Ea(l));
      }
      function sr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ea(t));
      }
      function Me(t, e, l, a) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            hs(
              t,
              e,
              l,
              a
            ), e = e.sibling;
      }
      function hs(t, e, l, a) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Me(
              t,
              e,
              l,
              a
            ), r & 2048 && Ra(9, e);
            break;
          case 1:
            Me(
              t,
              e,
              l,
              a
            );
            break;
          case 3:
            Me(
              t,
              e,
              l,
              a
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ea(t)));
            break;
          case 12:
            if (r & 2048) {
              Me(
                t,
                e,
                l,
                a
              ), t = e.stateNode;
              try {
                var o = e.memoizedProps, d = o.id, h = o.onPostCommit;
                typeof h == "function" && h(
                  d,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (z) {
                vt(e, e.return, z);
              }
            } else
              Me(
                t,
                e,
                l,
                a
              );
            break;
          case 31:
            Me(
              t,
              e,
              l,
              a
            );
            break;
          case 13:
            Me(
              t,
              e,
              l,
              a
            );
            break;
          case 23:
            break;
          case 22:
            o = e.stateNode, d = e.alternate, e.memoizedState !== null ? o._visibility & 2 ? Me(
              t,
              e,
              l,
              a
            ) : Ua(
              t,
              e
            ) : o._visibility & 2 ? Me(
              t,
              e,
              l,
              a
            ) : (o._visibility |= 2, Il(
              t,
              e,
              l,
              a,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && ur(d, e);
            break;
          case 24:
            Me(
              t,
              e,
              l,
              a
            ), r & 2048 && sr(e.alternate, e);
            break;
          default:
            Me(
              t,
              e,
              l,
              a
            );
        }
      }
      function Il(t, e, l, a, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var o = t, d = e, h = l, z = a, C = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              Il(
                o,
                d,
                h,
                z,
                r
              ), Ra(8, d);
              break;
            case 23:
              break;
            case 22:
              var Y = d.stateNode;
              d.memoizedState !== null ? Y._visibility & 2 ? Il(
                o,
                d,
                h,
                z,
                r
              ) : Ua(
                o,
                d
              ) : (Y._visibility |= 2, Il(
                o,
                d,
                h,
                z,
                r
              )), r && C & 2048 && ur(
                d.alternate,
                d
              );
              break;
            case 24:
              Il(
                o,
                d,
                h,
                z,
                r
              ), r && C & 2048 && sr(d.alternate, d);
              break;
            default:
              Il(
                o,
                d,
                h,
                z,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Ua(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var l = t, a = e, r = a.flags;
            switch (a.tag) {
              case 22:
                Ua(l, a), r & 2048 && ur(
                  a.alternate,
                  a
                );
                break;
              case 24:
                Ua(l, a), r & 2048 && sr(
                  a.alternate,
                  a
                );
                break;
              default:
                Ua(l, a);
            }
            e = e.sibling;
          }
      }
      function Ol(t, e, l) {
        if (t.subtreeFlags & va)
          for (t = t.child; t !== null; )
            gs(
              t,
              e,
              l
            ), t = t.sibling;
      }
      function gs(t, e, l) {
        switch (t.tag) {
          case 26:
            if (Ol(
              t,
              e,
              l
            ), t.flags & va)
              if (t.memoizedState !== null)
                tp(
                  l,
                  Re,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var a = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Cr(r, t)) && tc(l, a, r, t);
              }
            break;
          case 5:
            Ol(
              t,
              e,
              l
            ), t.flags & va && (a = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Cr(r, t)) && tc(l, a, r, t));
            break;
          case 3:
          case 4:
            Oe ? (a = Re, Re = Mr(
              t.stateNode.containerInfo
            ), Ol(
              t,
              e,
              l
            ), Re = a) : Ol(
              t,
              e,
              l
            );
            break;
          case 22:
            t.memoizedState === null && (a = t.alternate, a !== null && a.memoizedState !== null ? (a = va, va = 16777216, Ol(
              t,
              e,
              l
            ), va = a) : Ol(
              t,
              e,
              l
            ));
            break;
          default:
            Ol(
              t,
              e,
              l
            );
        }
      }
      function vs(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Da(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var a = e[l];
              Xt = a, ys(
                a,
                t
              );
            }
          vs(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            bs(t), t = t.sibling;
      }
      function bs(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Da(t), t.flags & 2048 && dl(9, t, t.return);
            break;
          case 3:
            Da(t);
            break;
          case 12:
            Da(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Mn(t)) : Da(t);
            break;
          default:
            Da(t);
        }
      }
      function Mn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var a = e[l];
              Xt = a, ys(
                a,
                t
              );
            }
          vs(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              dl(8, e, e.return), Mn(e);
              break;
            case 22:
              l = e.stateNode, l._visibility & 2 && (l._visibility &= -3, Mn(e));
              break;
            default:
              Mn(e);
          }
          t = t.sibling;
        }
      }
      function ys(t, e) {
        for (; Xt !== null; ) {
          var l = Xt;
          switch (l.tag) {
            case 0:
            case 11:
            case 15:
              dl(8, l, e);
              break;
            case 23:
            case 22:
              if (l.memoizedState !== null && l.memoizedState.cachePool !== null) {
                var a = l.memoizedState.cachePool.pool;
                a != null && a.refCount++;
              }
              break;
            case 24:
              Ea(l.memoizedState.cache);
          }
          if (a = l.child, a !== null) a.return = l, Xt = a;
          else
            t: for (l = t; Xt !== null; ) {
              a = Xt;
              var r = a.sibling, o = a.return;
              if (cs(a), a === l) {
                Xt = null;
                break t;
              }
              if (r !== null) {
                r.return = o, Xt = r;
                break t;
              }
              Xt = o;
            }
        }
      }
      function cr(t) {
        var e = qf(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = Ff(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function dr(t, e) {
        var l = t.tag;
        switch (e.$$typeof) {
          case Pn:
            if (t.type === e.value) return !0;
            break;
          case ti:
            t: {
              for (e = e.value, t = [t, 0], l = 0; l < t.length; ) {
                var a = t[l++], r = a.tag, o = t[l++], d = e[o];
                if (r !== 5 && r !== 26 && r !== 27 || !Ga(a)) {
                  for (; d != null && dr(a, d); )
                    o++, d = e[o];
                  if (o === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (a = a.child; a !== null; )
                      t.push(a, o), a = a.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ei:
            if ((l === 5 || l === 26 || l === 27) && Pf(t.stateNode, e.value))
              return !0;
            break;
          case ai:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (t = $f(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case li:
            if ((l === 5 || l === 26 || l === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function fr(t) {
        switch (t.$$typeof) {
          case Pn:
            return "<" + (R(t.value) || "Unknown") + ">";
          case ti:
            return ":has(" + (fr(t) || "") + ")";
          case ei:
            return '[role="' + t.value + '"]';
          case ai:
            return '"' + t.value + '"';
          case li:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function xs(t, e) {
        var l = [];
        t = [t, 0];
        for (var a = 0; a < t.length; ) {
          var r = t[a++], o = r.tag, d = t[a++], h = e[d];
          if (o !== 5 && o !== 26 && o !== 27 || !Ga(r)) {
            for (; h != null && dr(r, h); )
              d++, h = e[d];
            if (d === e.length) l.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, d), r = r.sibling;
          }
        }
        return l;
      }
      function mr(t, e) {
        if (!Ya) throw Error(c(363));
        t = cr(t), t = xs(t, e), e = [], t = Array.from(t);
        for (var l = 0; l < t.length; ) {
          var a = t[l++], r = a.tag;
          if (r === 5 || r === 26 || r === 27)
            Ga(a) || e.push(a.stateNode);
          else
            for (a = a.child; a !== null; )
              t.push(a), a = a.sibling;
        }
        return e;
      }
      function fe() {
        return (dt & 2) !== 0 && pt !== 0 ? pt & -pt : P.T !== null ? _i() : Yf();
      }
      function ws() {
        if (ye === 0)
          if ((pt & 536870912) === 0 || ht) {
            var t = Yn;
            Yn <<= 1, (Yn & 3932160) === 0 && (Yn = 262144), ye = t;
          } else ye = 536870912;
        return t = ve.current, t !== null && (t.flags |= 32), ye;
      }
      function ie(t, e, l) {
        (t === St && (xt === 2 || xt === 9) || t.cancelPendingCommit !== null) && ($l(t, 0), fl(
          t,
          pt,
          ye,
          !1
        )), J(t, l), ((dt & 2) === 0 || t !== St) && (t === St && ((dt & 2) === 0 && (Vl |= l), At === 4 && fl(
          t,
          pt,
          ye,
          !1
        )), Ue(t));
      }
      function _s(t, e, l) {
        if ((dt & 6) !== 0) throw Error(c(327));
        var a = !l && (e & 127) === 0 && (e & t.expiredLanes) === 0 || j(t, e), r = a ? vf(t, e) : hr(t, e, !0), o = a;
        do {
          if (r === 0) {
            ba && !a && fl(t, e, 0, !1);
            break;
          } else {
            if (l = t.current.alternate, o && !hf(l)) {
              r = hr(t, e, !1), o = !1;
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
                  r = Fa;
                  var z = le && h.current.memoizedState.isDehydrated;
                  if (z && ($l(h, d).flags |= 256), d = hr(
                    h,
                    d,
                    !1
                  ), d !== 2) {
                    if (Fr && !z) {
                      h.errorRecoveryDisabledLanes |= o, Vl |= o, r = 4;
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
              $l(t, 0), fl(t, e, 0, !0);
              break;
            }
            t: {
              switch (a = t, o = r, o) {
                case 0:
                case 1:
                  throw Error(c(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  fl(
                    a,
                    e,
                    ye,
                    !yl
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
              if ((e & 62914560) === e && (r = ni + 300 - re(), 10 < r)) {
                if (fl(
                  a,
                  e,
                  ye,
                  !yl
                ), A(a, 0, !0) !== 0) break t;
                el = e, a.timeoutHandle = Uf(
                  Ss.bind(
                    null,
                    a,
                    l,
                    ue,
                    ii,
                    $r,
                    e,
                    ye,
                    Vl,
                    ya,
                    yl,
                    o,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Ss(
                a,
                l,
                ue,
                ii,
                $r,
                e,
                ye,
                Vl,
                ya,
                yl,
                o,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Ue(t);
      }
      function Ss(t, e, l, a, r, o, d, h, z, C, Y, U, K, ot) {
        if (t.timeoutHandle = Hl, U = e.subtreeFlags, U & 8192 || (U & 16785408) === 16785408) {
          U = Xf(), gs(
            e,
            o,
            U
          );
          var $t = (o & 62914560) === o ? ni - re() : (o & 4194048) === o ? Tc - re() : 0;
          if ($t = Zf(
            U,
            $t
          ), $t !== null) {
            el = o, t.cancelPendingCommit = $t(
              Ms.bind(
                null,
                t,
                e,
                o,
                l,
                a,
                r,
                d,
                h,
                z,
                Y,
                U,
                null,
                K,
                ot
              )
            ), fl(t, o, d, !C);
            return;
          }
        }
        Ms(
          t,
          e,
          o,
          l,
          a,
          r,
          d,
          h,
          z
        );
      }
      function hf(t) {
        for (var e = t; ; ) {
          var l = e.tag;
          if ((l === 0 || l === 11 || l === 15) && e.flags & 16384 && (l = e.updateQueue, l !== null && (l = l.stores, l !== null)))
            for (var a = 0; a < l.length; a++) {
              var r = l[a], o = r.getSnapshot;
              r = r.value;
              try {
                if (!ge(o(), r)) return !1;
              } catch {
                return !1;
              }
            }
          if (l = e.child, e.subtreeFlags & 16384 && l !== null)
            l.return = e, e = l;
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
      function fl(t, e, l, a) {
        e &= ~Ir, e &= ~Vl, t.suspendedLanes |= e, t.pingedLanes &= ~e, a && (t.warmLanes |= e), a = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var o = 31 - pe(r), d = 1 << o;
          a[o] = -1, r &= ~d;
        }
        l !== 0 && N(t, l, e);
      }
      function zs() {
        return (dt & 6) === 0 ? (Wl(0), !1) : !0;
      }
      function pr() {
        if (ft !== null) {
          if (xt === 0)
            var t = ft.return;
          else
            t = ft, Ie = Dl = null, Hi(t), fa = null, Za = 0, t = ft;
          for (; t !== null; )
            ls(t.alternate, t), t = t.return;
          ft = null;
        }
      }
      function $l(t, e) {
        var l = t.timeoutHandle;
        l !== Hl && (t.timeoutHandle = Hl, Df(l)), l = t.cancelPendingCommit, l !== null && (t.cancelPendingCommit = null, l()), el = 0, pr(), St = t, ft = l = Le(t.current, null), pt = e, xt = 0, be = null, yl = !1, ba = j(t, e), Fr = !1, ya = ye = Ir = Vl = xl = At = 0, ue = Fa = null, $r = !1, (e & 8) !== 0 && (e |= e & 32);
        var a = t.entangledLanes;
        if (a !== 0)
          for (t = t.entanglements, a &= e; 0 < a; ) {
            var r = 31 - pe(a), o = 1 << r;
            e |= t[r], a &= ~o;
          }
        return tl = e, pn(), l;
      }
      function Es(t, e) {
        ut = null, P.H = La, e === da || e === Ln ? (e = Xo(), xt = 3) : e === Qr ? (e = Xo(), xt = 4) : xt = e === Jr ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, be = e, ft === null && (At = 1, zn(
          t,
          it(e, t.current)
        ));
      }
      function Ns() {
        var t = ve.current;
        return t === null ? !0 : (pt & 4194048) === pt ? ke === null : (pt & 62914560) === pt || (pt & 536870912) !== 0 ? t === ke : !1;
      }
      function ks() {
        var t = P.H;
        return P.H = La, t === null ? La : t;
      }
      function Ts() {
        var t = P.A;
        return P.A = hp, t;
      }
      function On() {
        At = 4, yl || (pt & 4194048) !== pt && ve.current !== null || (ba = !0), (xl & 134217727) === 0 && (Vl & 134217727) === 0 || St === null || fl(
          St,
          pt,
          ye,
          !1
        );
      }
      function hr(t, e, l) {
        var a = dt;
        dt |= 2;
        var r = ks(), o = Ts();
        (St !== t || pt !== e) && (ii = null, $l(t, e)), e = !1;
        var d = At;
        t: do
          try {
            if (xt !== 0 && ft !== null) {
              var h = ft, z = be;
              switch (xt) {
                case 8:
                  pr(), d = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ve.current === null && (e = !0);
                  var C = xt;
                  if (xt = 0, be = null, Pl(t, h, z, C), l && ba) {
                    d = 0;
                    break t;
                  }
                  break;
                default:
                  C = xt, xt = 0, be = null, Pl(t, h, z, C);
              }
            }
            gf(), d = At;
            break;
          } catch (Y) {
            Es(t, Y);
          }
        while (!0);
        return e && t.shellSuspendCounter++, Ie = Dl = null, dt = a, P.H = r, P.A = o, ft === null && (St = null, pt = 0, pn()), d;
      }
      function gf() {
        for (; ft !== null; ) Cs(ft);
      }
      function vf(t, e) {
        var l = dt;
        dt |= 2;
        var a = ks(), r = Ts();
        St !== t || pt !== e ? (ii = null, Ia = re() + 500, $l(t, e)) : ba = j(
          t,
          e
        );
        t: do
          try {
            if (xt !== 0 && ft !== null) {
              e = ft;
              var o = be;
              e: switch (xt) {
                case 1:
                  xt = 0, be = null, Pl(t, e, o, 1);
                  break;
                case 2:
                case 9:
                  if (Vo(o)) {
                    xt = 0, be = null, js(e);
                    break;
                  }
                  e = function() {
                    xt !== 2 && xt !== 9 || St !== t || (xt = 7), Ue(t);
                  }, o.then(e, e);
                  break t;
                case 3:
                  xt = 7;
                  break t;
                case 4:
                  xt = 5;
                  break t;
                case 7:
                  Vo(o) ? (xt = 0, be = null, js(e)) : (xt = 0, be = null, Pl(t, e, o, 7));
                  break;
                case 5:
                  var d = null;
                  switch (ft.tag) {
                    case 26:
                      d = ft.memoizedState;
                    case 5:
                    case 27:
                      var h = ft, z = h.type, C = h.pendingProps;
                      if (d ? hc(d) : Ps(h.stateNode, z, C)) {
                        xt = 0, be = null;
                        var Y = h.sibling;
                        if (Y !== null) ft = Y;
                        else {
                          var U = h.return;
                          U !== null ? (ft = U, Rn(U)) : ft = null;
                        }
                        break e;
                      }
                  }
                  xt = 0, be = null, Pl(t, e, o, 5);
                  break;
                case 6:
                  xt = 0, be = null, Pl(t, e, o, 6);
                  break;
                case 8:
                  pr(), At = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            bf();
            break;
          } catch (K) {
            Es(t, K);
          }
        while (!0);
        return Ie = Dl = null, P.H = a, P.A = r, dt = l, ft !== null ? 0 : (St = null, pt = 0, pn(), At);
      }
      function bf() {
        for (; ft !== null && !np(); )
          Cs(ft);
      }
      function Cs(t) {
        var e = Iu(
          t.alternate,
          t,
          tl
        );
        t.memoizedProps = t.pendingProps, e === null ? Rn(t) : ft = e;
      }
      function js(t) {
        var e = t, l = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Xu(
              l,
              e,
              e.pendingProps,
              e.type,
              void 0,
              pt
            );
            break;
          case 11:
            e = Xu(
              l,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              pt
            );
            break;
          case 5:
            Hi(e);
          default:
            ls(l, e), e = ft = Ys(e, tl), e = Iu(l, e, tl);
        }
        t.memoizedProps = t.pendingProps, e === null ? Rn(t) : ft = e;
      }
      function Pl(t, e, l, a) {
        Ie = Dl = null, Hi(e), fa = null, Za = 0;
        var r = e.return;
        try {
          if (uf(
            t,
            r,
            e,
            l,
            pt
          )) {
            At = 1, zn(
              t,
              it(l, t.current)
            ), ft = null;
            return;
          }
        } catch (o) {
          if (r !== null) throw ft = r, o;
          At = 1, zn(
            t,
            it(l, t.current)
          ), ft = null;
          return;
        }
        e.flags & 32768 ? (ht || a === 1 ? t = !0 : ba || (pt & 536870912) !== 0 ? t = !1 : (yl = t = !0, (a === 2 || a === 9 || a === 3 || a === 6) && (a = ve.current, a !== null && a.tag === 13 && (a.flags |= 16384))), As(e, t)) : Rn(e);
      }
      function Rn(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            As(
              e,
              yl
            );
            return;
          }
          t = e.return;
          var l = df(
            e.alternate,
            e,
            tl
          );
          if (l !== null) {
            ft = l;
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
      function As(t, e) {
        do {
          var l = ff(t.alternate, t);
          if (l !== null) {
            l.flags &= 32767, ft = l;
            return;
          }
          if (l = t.return, l !== null && (l.flags |= 32768, l.subtreeFlags = 0, l.deletions = null), !e && (t = t.sibling, t !== null)) {
            ft = t;
            return;
          }
          ft = t = l;
        } while (t !== null);
        At = 6, ft = null;
      }
      function Ms(t, e, l, a, r, o, d, h, z) {
        t.cancelPendingCommit = null;
        do
          qa();
        while (Gt !== 0);
        if ((dt & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (o = e.lanes | e.childLanes, o |= Vr, k(
            t,
            l,
            o,
            d,
            h,
            z
          ), t === St && (ft = St = null, pt = 0), xa = e, _l = t, el = l, Pr = o, to = r, Cc = a, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, _f(Hr, function() {
            return Ds(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), a = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || a) {
            a = P.T, P.T = null, r = Fe(), Kt(2), d = dt, dt |= 4;
            try {
              mf(t, e, l);
            } finally {
              dt = d, Kt(r), P.T = a;
            }
          }
          Gt = 1, Os(), Rs(), Hs();
        }
      }
      function Os() {
        if (Gt === 1) {
          Gt = 0;
          var t = _l, e = xa, l = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || l) {
            l = P.T, P.T = null;
            var a = Fe();
            Kt(2);
            var r = dt;
            dt |= 4;
            try {
              ms(e, t), Rf(t.containerInfo);
            } finally {
              dt = r, Kt(a), P.T = l;
            }
          }
          t.current = e, Gt = 2;
        }
      }
      function Rs() {
        if (Gt === 2) {
          Gt = 0;
          var t = _l, e = xa, l = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || l) {
            l = P.T, P.T = null;
            var a = Fe();
            Kt(2);
            var r = dt;
            dt |= 4;
            try {
              ss(t, e.alternate, e);
            } finally {
              dt = r, Kt(a), P.T = l;
            }
          }
          Gt = 3;
        }
      }
      function Hs() {
        if (Gt === 4 || Gt === 3) {
          Gt = 0, ip();
          var t = _l, e = xa, l = el, a = Cc;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Gt = 5 : (Gt = 0, xa = _l = null, Us(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (wl = null), zt(l), e = e.stateNode, he && typeof he.onCommitFiberRoot == "function")
            try {
              he.onCommitFiberRoot(
                Qa,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (a !== null) {
            e = P.T, r = Fe(), Kt(2), P.T = null;
            try {
              for (var o = t.onRecoverableError, d = 0; d < a.length; d++) {
                var h = a[d];
                o(h.value, {
                  componentStack: h.stack
                });
              }
            } finally {
              P.T = e, Kt(r);
            }
          }
          (el & 3) !== 0 && qa(), Ue(t), r = t.pendingLanes, (l & 261930) !== 0 && (r & 42) !== 0 ? t === eo ? $a++ : ($a = 0, eo = t) : $a = 0, le && Vm(), Wl(0);
        }
      }
      function Us(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ea(e)));
      }
      function qa() {
        return Os(), Rs(), Hs(), Ds();
      }
      function Ds() {
        if (Gt !== 5) return !1;
        var t = _l, e = Pr;
        Pr = 0;
        var l = zt(el), a = 32 > l ? 32 : l;
        l = P.T;
        var r = Fe();
        try {
          Kt(a), P.T = null, a = to, to = null;
          var o = _l, d = el;
          if (Gt = 0, xa = _l = null, el = 0, (dt & 6) !== 0)
            throw Error(c(331));
          var h = dt;
          if (dt |= 4, bs(o.current), hs(
            o,
            o.current,
            d,
            a
          ), dt = h, Wl(0, !1), he && typeof he.onPostCommitFiberRoot == "function")
            try {
              he.onPostCommitFiberRoot(Qa, o);
            } catch {
            }
          return !0;
        } finally {
          Kt(r), P.T = l, Us(t, e);
        }
      }
      function qs(t, e, l) {
        e = it(l, e), e = Ji(t.stateNode, e, 2), t = ul(t, e, 2), t !== null && (J(t, 2), Ue(t));
      }
      function vt(t, e, l) {
        if (t.tag === 3)
          qs(t, t, l);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              qs(
                e,
                t,
                l
              );
              break;
            } else if (e.tag === 1) {
              var a = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof a.componentDidCatch == "function" && (wl === null || !wl.has(a))) {
                t = it(l, t), l = Du(2), a = ul(e, l, 2), a !== null && (qu(
                  l,
                  a,
                  e,
                  t
                ), J(a, 2), Ue(a));
                break;
              }
            }
            e = e.return;
          }
      }
      function gr(t, e, l) {
        var a = t.pingCache;
        if (a === null) {
          a = t.pingCache = new gp();
          var r = /* @__PURE__ */ new Set();
          a.set(e, r);
        } else
          r = a.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), a.set(e, r));
        r.has(l) || (Fr = !0, r.add(l), t = yf.bind(null, t, e, l), e.then(t, t));
      }
      function yf(t, e, l) {
        var a = t.pingCache;
        a !== null && a.delete(e), t.pingedLanes |= t.suspendedLanes & l, t.warmLanes &= ~l, St === t && (pt & l) === l && (At === 4 || At === 3 && (pt & 62914560) === pt && 300 > re() - ni ? (dt & 2) === 0 && $l(t, 0) : Ir |= l, ya === pt && (ya = 0)), Ue(t);
      }
      function Bs(t, e) {
        e === 0 && (e = V()), t = jl(t, e), t !== null && (J(t, e), Ue(t));
      }
      function xf(t) {
        var e = t.memoizedState, l = 0;
        e !== null && (l = e.retryLane), Bs(t, l);
      }
      function wf(t, e) {
        var l = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var a = t.stateNode, r = t.memoizedState;
            r !== null && (l = r.retryLane);
            break;
          case 19:
            a = t.stateNode;
            break;
          case 22:
            a = t.stateNode._retryCache;
            break;
          default:
            throw Error(c(314));
        }
        a !== null && a.delete(e), Bs(t, l);
      }
      function _f(t, e) {
        return Qn(t, e);
      }
      function Sf(t, e, l, a) {
        this.tag = t, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = a, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function vr(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function Le(t, e) {
        var l = t.alternate;
        return l === null ? (l = u(
          t.tag,
          e,
          t.key,
          t.mode
        ), l.elementType = t.elementType, l.type = t.type, l.stateNode = t.stateNode, l.alternate = t, t.alternate = l) : (l.pendingProps = e, l.type = t.type, l.flags = 0, l.subtreeFlags = 0, l.deletions = null), l.flags = t.flags & 65011712, l.childLanes = t.childLanes, l.lanes = t.lanes, l.child = t.child, l.memoizedProps = t.memoizedProps, l.memoizedState = t.memoizedState, l.updateQueue = t.updateQueue, e = t.dependencies, l.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, l.sibling = t.sibling, l.index = t.index, l.ref = t.ref, l.refCleanup = t.refCleanup, l;
      }
      function Ys(t, e) {
        t.flags &= 65011714;
        var l = t.alternate;
        return l === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = l.childLanes, t.lanes = l.lanes, t.child = l.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = l.memoizedProps, t.memoizedState = l.memoizedState, t.updateQueue = l.updateQueue, t.type = l.type, e = l.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Hn(t, e, l, a, r, o) {
        var d = 0;
        if (a = t, typeof t == "function") vr(t) && (d = 1);
        else if (typeof t == "string")
          d = Oe && Yt ? sc(t, l, Ft.current) ? 26 : bc(t) ? 27 : 5 : Oe ? sc(
            t,
            l,
            Ft.current
          ) ? 26 : 5 : Yt && bc(t) ? 27 : 5;
        else
          t: switch (t) {
            case kr:
              return t = u(31, l, e, r), t.elementType = kr, t.lanes = o, t;
            case ea:
              return Rl(
                l.children,
                r,
                o,
                e
              );
            case Js:
              d = 8, r |= 24;
              break;
            case _r:
              return t = u(12, l, e, r | 2), t.elementType = _r, t.lanes = o, t;
            case zr:
              return t = u(13, l, e, r), t.elementType = zr, t.lanes = o, t;
            case Er:
              return t = u(19, l, e, r), t.elementType = Er, t.lanes = o, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ml:
                    d = 10;
                    break t;
                  case Ls:
                    d = 9;
                    break t;
                  case Sr:
                    d = 11;
                    break t;
                  case Nr:
                    d = 14;
                    break t;
                  case pl:
                    d = 16, a = null;
                    break t;
                }
              d = 29, l = Error(
                c(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), a = null;
          }
        return e = u(d, l, e, r), e.elementType = t, e.type = a, e.lanes = o, e;
      }
      function Rl(t, e, l, a) {
        return t = u(7, t, a, e), t.lanes = l, t;
      }
      function br(t, e, l) {
        return t = u(6, t, null, e), t.lanes = l, t;
      }
      function Gs(t) {
        var e = u(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function yr(t, e, l) {
        return e = u(
          4,
          t.children !== null ? t.children : [],
          t.key,
          e
        ), e.lanes = l, e.stateNode = {
          containerInfo: t.containerInfo,
          pendingChildren: null,
          implementation: t.implementation
        }, e;
      }
      function zf(t, e, l, a, r, o, d, h, z) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Hl, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = at(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = at(0), this.hiddenUpdates = at(null), this.identifierPrefix = a, this.onUncaughtError = r, this.onCaughtError = o, this.onRecoverableError = d, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = z, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Qs(t, e, l, a, r, o, d, h, z, C, Y, U) {
        return t = new zf(
          t,
          e,
          l,
          d,
          z,
          C,
          Y,
          U,
          h
        ), e = 1, o === !0 && (e |= 24), o = u(3, null, null, e), t.current = o, o.stateNode = t, e = wi(), e.refCount++, t.pooledCache = e, e.refCount++, o.memoizedState = {
          element: a,
          isDehydrated: l,
          cache: e
        }, Ei(o), t;
      }
      function Vs(t) {
        return t ? (t = ia, t) : ia;
      }
      function Ks(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = p(e), t = t !== null ? w(t) : null, t === null ? null : Ba(t.stateNode);
      }
      function Xs(t, e, l, a, r, o) {
        r = Vs(r), a.context === null ? a.context = r : a.pendingContext = r, a = ol(e), a.payload = { element: l }, o = o === void 0 ? null : o, o !== null && (a.callback = o), l = ul(t, a, e), l !== null && (ie(l, t, e), ka(l, t, e));
      }
      function Zs(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var l = t.retryLane;
          t.retryLane = l !== 0 && l < e ? l : e;
        }
      }
      function xr(t, e) {
        Zs(t, e), (t = t.alternate) && Zs(t, e);
      }
      var ct = {}, Ef = bd(), me = qp(), wr = Object.assign, Nf = Symbol.for("react.element"), Un = Symbol.for("react.transitional.element"), ta = Symbol.for("react.portal"), ea = Symbol.for("react.fragment"), Js = Symbol.for("react.strict_mode"), _r = Symbol.for("react.profiler"), Ls = Symbol.for("react.consumer"), ml = Symbol.for("react.context"), Sr = Symbol.for("react.forward_ref"), zr = Symbol.for("react.suspense"), Er = Symbol.for("react.suspense_list"), Nr = Symbol.for("react.memo"), pl = Symbol.for("react.lazy"), kr = Symbol.for("react.activity"), kf = Symbol.for("react.memo_cache_sentinel"), Ws = Symbol.iterator, Tf = Symbol.for("react.client.reference"), Dn = Array.isArray, P = Ef.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Cf = i.rendererVersion, jf = i.rendererPackageName, Fs = i.extraDevToolsConfig, Ba = i.getPublicInstance, Af = i.getRootHostContext, Mf = i.getChildHostContext, Of = i.prepareForCommit, Rf = i.resetAfterCommit, Hf = i.createInstance;
      i.cloneMutableInstance;
      var Tr = i.appendInitialChild, Is = i.finalizeInitialChildren, qn = i.shouldSetTextContent, $s = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Uf = i.scheduleTimeout, Df = i.cancelTimeout, Hl = i.noTimeout, We = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ee = i.supportsMutation, qe = i.supportsPersistence, le = i.supportsHydration, qf = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var Bf = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Kt = i.setCurrentUpdatePriority, Fe = i.getCurrentUpdatePriority, Yf = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var Gf = i.shouldAttemptEagerTransition, Qf = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var Vf = i.maySuspendCommit, Kf = i.maySuspendCommitOnUpdate, Cr = i.maySuspendCommitInSyncRender, Ps = i.preloadInstance, Xf = i.startSuspendingCommit, tc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var Zf = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var la = i.NotPendingTransition, Ul = i.HostTransitionContext, Jf = i.resetFormInstance;
      i.bindToConsole;
      var Lf = i.supportsMicrotasks, Wf = i.scheduleMicrotask, Ya = i.supportsTestSelectors, Ff = i.findFiberRoot, If = i.getBoundingRect, $f = i.getTextContent, Ga = i.isHiddenSubtree, Pf = i.matchAccessibilityRole, tm = i.setFocusIfFocusable, em = i.setupIntersectionObserver, lm = i.appendChild, am = i.appendChildToContainer, nm = i.commitTextUpdate, im = i.commitMount, rm = i.commitUpdate, om = i.insertBefore, um = i.insertInContainerBefore, sm = i.removeChild, cm = i.removeChildFromContainer, ec = i.resetTextContent, dm = i.hideInstance, fm = i.hideTextInstance, mm = i.unhideInstance, pm = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var hm = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var gm = i.cloneInstance, lc = i.createContainerChildSet, ac = i.appendChildToContainerChildSet, vm = i.finalizeContainerChildren, nc = i.replaceContainerChildren, ic = i.cloneHiddenInstance, rc = i.cloneHiddenTextInstance, jr = i.isSuspenseInstancePending, Ar = i.isSuspenseInstanceFallback, bm = i.getSuspenseInstanceFallbackErrorDetails, ym = i.registerSuspenseInstanceRetry, xm = i.canHydrateFormStateMarker, wm = i.isFormStateMarkerMatching, oc = i.getNextHydratableSibling, _m = i.getNextHydratableSiblingAfterSingleton, Sm = i.getFirstHydratableChild, zm = i.getFirstHydratableChildWithinContainer, Em = i.getFirstHydratableChildWithinActivityInstance, Nm = i.getFirstHydratableChildWithinSuspenseInstance, km = i.getFirstHydratableChildWithinSingleton, Tm = i.canHydrateInstance, Cm = i.canHydrateTextInstance, jm = i.canHydrateActivityInstance, Am = i.canHydrateSuspenseInstance, Mm = i.hydrateInstance, Om = i.hydrateTextInstance, Rm = i.hydrateActivityInstance, Hm = i.hydrateSuspenseInstance, Um = i.getNextHydratableInstanceAfterActivityInstance, Dm = i.getNextHydratableInstanceAfterSuspenseInstance, qm = i.commitHydratedInstance, Bm = i.commitHydratedContainer, Ym = i.commitHydratedActivityInstance, Gm = i.commitHydratedSuspenseInstance, Qm = i.finalizeHydratedChildren, Vm = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var Km = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var Xm = i.clearSuspenseBoundaryFromContainer, Zm = i.hideDehydratedBoundary, Jm = i.unhideDehydratedBoundary, uc = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var Lm = i.validateHydratableInstance, Wm = i.validateHydratableTextInstance, Oe = i.supportsResources, sc = i.isHostHoistableType, Mr = i.getHoistableRoot, cc = i.getResource, dc = i.acquireResource, fc = i.releaseResource, Fm = i.hydrateHoistable, mc = i.mountHoistable, pc = i.unmountHoistable, Im = i.createHoistableInstance, $m = i.prepareToCommitHoistables, Pm = i.mayResourceSuspendCommit, hc = i.preloadResource, tp = i.suspendResource, Yt = i.supportsSingletons, gc = i.resolveSingletonInstance, ep = i.acquireSingletonInstance, vc = i.releaseSingletonInstance, bc = i.isHostSingletonType, aa = i.isSingletonScope, Or = [], na = -1, ia = {}, pe = Math.clz32 ? Math.clz32 : T, lp = Math.log, ap = Math.LN2, Bn = 256, Yn = 262144, Gn = 4194304, Qn = me.unstable_scheduleCallback, Rr = me.unstable_cancelCallback, np = me.unstable_shouldYield, ip = me.unstable_requestPaint, re = me.unstable_now, yc = me.unstable_ImmediatePriority, rp = me.unstable_UserBlockingPriority, Hr = me.unstable_NormalPriority, op = me.unstable_IdlePriority, up = me.log, sp = me.unstable_setDisableYieldValue, Qa = null, he = null, ge = typeof Object.is == "function" ? Object.is : Jt, xc = typeof reportError == "function" ? reportError : function(t) {
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
      }, cp = Object.prototype.hasOwnProperty, Ur, wc, Dr = !1, _c = /* @__PURE__ */ new WeakMap(), ra = [], oa = 0, Vn = null, Va = 0, Se = [], ze = 0, hl = null, Be = 1, Ye = "", Ft = y(null), Ka = y(null), gl = y(null), Kn = y(null), It = null, kt = null, ht = !1, vl = null, Ee = !1, qr = Error(c(519)), Xn = y(null), Dl = null, Ie = null, dp = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(l, a) {
            t.push(a);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(l) {
            return l();
          });
        };
      }, fp = me.unstable_scheduleCallback, mp = me.unstable_NormalPriority, Tt = {
        $$typeof: ml,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Zn = null, ua = null, Br = !1, Jn = !1, Yr = !1, ql = 0, Xa = null, Gr = 0, sa = 0, ca = null, Sc = P.S;
      P.S = function(t, e) {
        Tc = re(), typeof e == "object" && e !== null && typeof e.then == "function" && Pd(t, e), Sc !== null && Sc(t, e);
      };
      var Bl = y(null), da = Error(c(460)), Qr = Error(c(474)), Ln = Error(c(542)), Wn = { then: function() {
      } }, Yl = null, fa = null, Za = 0, Gl = Jo(!0), zc = Jo(!1), Ne = [], ma = 0, Vr = 0, bl = !1, Kr = !1, pa = y(null), Fn = y(0), ve = y(null), ke = null, Rt = y(0), $e = 0, ut = null, _t = null, Ut = null, In = !1, ha = !1, Ql = !1, $n = 0, Ja = 0, ga = null, pp = 0, La = {
        readContext: Lt,
        use: yn,
        useCallback: jt,
        useContext: jt,
        useEffect: jt,
        useImperativeHandle: jt,
        useLayoutEffect: jt,
        useInsertionEffect: jt,
        useMemo: jt,
        useReducer: jt,
        useRef: jt,
        useState: jt,
        useDebugValue: jt,
        useDeferredValue: jt,
        useTransition: jt,
        useSyncExternalStore: jt,
        useId: jt,
        useHostTransitionStatus: jt,
        useFormState: jt,
        useActionState: jt,
        useOptimistic: jt,
        useMemoCache: jt,
        useCacheRefresh: jt
      };
      La.useEffectEvent = jt;
      var Ec = {
        readContext: Lt,
        use: yn,
        useCallback: function(t, e) {
          return ae().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Lt,
        useEffect: bu,
        useImperativeHandle: function(t, e, l) {
          l = l != null ? l.concat([t]) : null, wn(
            4194308,
            4,
            _u.bind(null, e, t),
            l
          );
        },
        useLayoutEffect: function(t, e) {
          return wn(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          wn(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var l = ae();
          e = e === void 0 ? null : e;
          var a = t();
          if (Ql) {
            Mt(!0);
            try {
              t();
            } finally {
              Mt(!1);
            }
          }
          return l.memoizedState = [a, e], a;
        },
        useReducer: function(t, e, l) {
          var a = ae();
          if (l !== void 0) {
            var r = l(e);
            if (Ql) {
              Mt(!0);
              try {
                l(e);
              } finally {
                Mt(!1);
              }
            }
          } else r = e;
          return a.memoizedState = a.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, a.queue = t, t = t.dispatch = of.bind(
            null,
            ut,
            t
          ), [a.memoizedState, t];
        },
        useRef: function(t) {
          var e = ae();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Bi(t);
          var e = t.queue, l = Au.bind(
            null,
            ut,
            e
          );
          return e.dispatch = l, [t.memoizedState, l];
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var l = ae();
          return Vi(l, t, e);
        },
        useTransition: function() {
          var t = Bi(!1);
          return t = ku.bind(
            null,
            ut,
            t.queue,
            !0,
            !1
          ), ae().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, l) {
          var a = ut, r = ae();
          if (ht) {
            if (l === void 0)
              throw Error(c(407));
            l = l();
          } else {
            if (l = e(), St === null)
              throw Error(c(349));
            (pt & 127) !== 0 || lu(a, e, l);
          }
          r.memoizedState = l;
          var o = { value: l, getSnapshot: e };
          return r.queue = o, bu(nu.bind(null, a, o, t), [
            t
          ]), a.flags |= 2048, Fl(
            9,
            { destroy: void 0 },
            au.bind(
              null,
              a,
              o,
              l,
              e
            ),
            null
          ), l;
        },
        useId: function() {
          var t = ae(), e = St.identifierPrefix;
          if (ht) {
            var l = Ye, a = Be;
            l = (a & ~(1 << 32 - pe(a) - 1)).toString(32) + l, e = "_" + e + "R_" + l, l = $n++, 0 < l && (e += "H" + l.toString(32)), e += "_";
          } else
            l = pp++, e = "_" + e + "r_" + l.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ki,
        useFormState: mu,
        useActionState: mu,
        useOptimistic: function(t) {
          var e = ae();
          e.memoizedState = e.baseState = t;
          var l = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = l, e = Xi.bind(
            null,
            ut,
            !0,
            l
          ), l.dispatch = e, [t, e];
        },
        useMemoCache: Ui,
        useCacheRefresh: function() {
          return ae().memoizedState = rf.bind(
            null,
            ut
          );
        },
        useEffectEvent: function(t) {
          var e = ae(), l = { impl: t };
          return e.memoizedState = l, function() {
            if ((dt & 2) !== 0)
              throw Error(c(440));
            return l.impl.apply(void 0, arguments);
          };
        }
      }, Xr = {
        readContext: Lt,
        use: yn,
        useCallback: zu,
        useContext: Lt,
        useEffect: Gi,
        useImperativeHandle: Su,
        useInsertionEffect: xu,
        useLayoutEffect: wu,
        useMemo: Eu,
        useReducer: xn,
        useRef: vu,
        useState: function() {
          return xn(Ke);
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var l = Ot();
          return Nu(
            l,
            _t.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = xn(Ke)[0], e = Ot().memoizedState;
          return [
            typeof t == "boolean" ? t : ja(t),
            e
          ];
        },
        useSyncExternalStore: eu,
        useId: Cu,
        useHostTransitionStatus: Ki,
        useFormState: pu,
        useActionState: pu,
        useOptimistic: function(t, e) {
          var l = Ot();
          return ou(l, _t, t, e);
        },
        useMemoCache: Ui,
        useCacheRefresh: ju
      };
      Xr.useEffectEvent = yu;
      var Nc = {
        readContext: Lt,
        use: yn,
        useCallback: zu,
        useContext: Lt,
        useEffect: Gi,
        useImperativeHandle: Su,
        useInsertionEffect: xu,
        useLayoutEffect: wu,
        useMemo: Eu,
        useReducer: qi,
        useRef: vu,
        useState: function() {
          return qi(Ke);
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var l = Ot();
          return _t === null ? Vi(l, t, e) : Nu(
            l,
            _t.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = qi(Ke)[0], e = Ot().memoizedState;
          return [
            typeof t == "boolean" ? t : ja(t),
            e
          ];
        },
        useSyncExternalStore: eu,
        useId: Cu,
        useHostTransitionStatus: Ki,
        useFormState: gu,
        useActionState: gu,
        useOptimistic: function(t, e) {
          var l = Ot();
          return _t !== null ? ou(l, _t, t, e) : (l.baseState = t, [t, l.queue.dispatch]);
        },
        useMemoCache: Ui,
        useCacheRefresh: ju
      };
      Nc.useEffectEvent = yu;
      var Zr = {
        enqueueSetState: function(t, e, l) {
          t = t._reactInternals;
          var a = fe(), r = ol(a);
          r.payload = e, l != null && (r.callback = l), e = ul(t, r, a), e !== null && (ie(e, t, a), ka(e, t, a));
        },
        enqueueReplaceState: function(t, e, l) {
          t = t._reactInternals;
          var a = fe(), r = ol(a);
          r.tag = 1, r.payload = e, l != null && (r.callback = l), e = ul(t, r, a), e !== null && (ie(e, t, a), ka(e, t, a));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var l = fe(), a = ol(l);
          a.tag = 2, e != null && (a.callback = e), e = ul(t, a, l), e !== null && (ie(e, t, l), ka(e, t, l));
        }
      }, Jr = Error(c(461)), Dt = !1, Lr = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, Pe = !1, qt = !1, Wr = !1, kc = typeof WeakSet == "function" ? WeakSet : Set, Xt = null, Bt = null, oe = !1, Re = null, va = 8192, hp = {
        getCacheForType: function(t) {
          var e = Lt(Tt), l = e.data.get(t);
          return l === void 0 && (l = t(), e.data.set(t, l)), l;
        },
        cacheSignal: function() {
          return Lt(Tt).controller.signal;
        }
      }, Pn = 0, ti = 1, ei = 2, li = 3, ai = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Wa = Symbol.for;
        Pn = Wa("selector.component"), ti = Wa("selector.has_pseudo_class"), ei = Wa("selector.role"), li = Wa("selector.test_id"), ai = Wa("selector.text");
      }
      var gp = typeof WeakMap == "function" ? WeakMap : Map, dt = 0, St = null, ft = null, pt = 0, xt = 0, be = null, yl = !1, ba = !1, Fr = !1, tl = 0, At = 0, xl = 0, Vl = 0, Ir = 0, ye = 0, ya = 0, Fa = null, ue = null, $r = !1, ni = 0, Tc = 0, Ia = 1 / 0, ii = null, wl = null, Gt = 0, _l = null, xa = null, el = 0, Pr = 0, to = null, Cc = null, $a = 0, eo = null;
      return ct.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = jl(t, 67108864);
          e !== null && ie(e, t, 67108864), xr(t, 67108864);
        }
      }, ct.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = fe();
          e = wt(e);
          var l = jl(t, e);
          l !== null && ie(l, t, e), xr(t, e);
        }
      }, ct.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = O(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var l = 1 << 31 - pe(e);
                  t.entanglements[1] |= l, e &= ~l;
                }
                Ue(t), (dt & 6) === 0 && (Ia = re() + 500, Wl(0));
              }
            }
            break;
          case 31:
          case 13:
            e = jl(t, 2), e !== null && ie(e, t, 2), zs(), xr(t, 2);
        }
      }, ct.batchedUpdates = function(t, e) {
        return t(e);
      }, ct.createComponentSelector = function(t) {
        return { $$typeof: Pn, value: t };
      }, ct.createContainer = function(t, e, l, a, r, o, d, h, z, C) {
        return Qs(
          t,
          e,
          !1,
          null,
          l,
          a,
          o,
          null,
          d,
          h,
          z,
          C
        );
      }, ct.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ti, value: t };
      }, ct.createHydrationContainer = function(t, e, l, a, r, o, d, h, z, C, Y, U, K, ot) {
        return t = Qs(
          l,
          a,
          !0,
          t,
          r,
          o,
          h,
          ot,
          z,
          C,
          Y,
          U
        ), t.context = Vs(null), l = t.current, a = fe(), a = wt(a), r = ol(a), r.callback = e ?? null, ul(l, r, a), e = a, t.current.lanes = e, J(t, e), Ue(t), t;
      }, ct.createPortal = function(t, e, l) {
        var a = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ta,
          key: a == null ? null : "" + a,
          children: t,
          containerInfo: e,
          implementation: l
        };
      }, ct.createRoleSelector = function(t) {
        return { $$typeof: ei, value: t };
      }, ct.createTestNameSelector = function(t) {
        return { $$typeof: li, value: t };
      }, ct.createTextSelector = function(t) {
        return { $$typeof: ai, value: t };
      }, ct.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ct.defaultOnRecoverableError = function(t) {
        xc(t);
      }, ct.defaultOnUncaughtError = function(t) {
        xc(t);
      }, ct.deferredUpdates = function(t) {
        var e = P.T, l = Fe();
        try {
          return Kt(32), P.T = null, t();
        } finally {
          Kt(l), P.T = e;
        }
      }, ct.discreteUpdates = function(t, e, l, a, r) {
        var o = P.T, d = Fe();
        try {
          return Kt(2), P.T = null, t(e, l, a, r);
        } finally {
          Kt(d), P.T = o, dt === 0 && (Ia = re() + 500);
        }
      }, ct.findAllNodes = mr, ct.findBoundingRects = function(t, e) {
        if (!Ya) throw Error(c(363));
        e = mr(t, e), t = [];
        for (var l = 0; l < e.length; l++)
          t.push(If(e[l]));
        for (e = t.length - 1; 0 < e; e--) {
          l = t[e];
          for (var a = l.x, r = a + l.width, o = l.y, d = o + l.height, h = e - 1; 0 <= h; h--)
            if (e !== h) {
              var z = t[h], C = z.x, Y = C + z.width, U = z.y, K = U + z.height;
              if (a >= C && o >= U && r <= Y && d <= K) {
                t.splice(e, 1);
                break;
              } else if (a !== C || l.width !== z.width || K < o || U > d) {
                if (!(o !== U || l.height !== z.height || Y < a || C > r)) {
                  C > a && (z.width += C - a, z.x = a), Y < r && (z.width = r - C), t.splice(e, 1);
                  break;
                }
              } else {
                U > o && (z.height += U - o, z.y = o), K < d && (z.height = d - U), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ct.findHostInstance = Ks, ct.findHostInstanceWithNoPortals = function(t) {
        return t = p(t), t = t !== null ? v(t) : null, t === null ? null : Ba(t.stateNode);
      }, ct.findHostInstanceWithWarning = function(t) {
        return Ks(t);
      }, ct.flushPassiveEffects = qa, ct.flushSyncFromReconciler = function(t) {
        var e = dt;
        dt |= 1;
        var l = P.T, a = Fe();
        try {
          if (Kt(2), P.T = null, t)
            return t();
        } finally {
          Kt(a), P.T = l, dt = e, (dt & 6) === 0 && Wl(0);
        }
      }, ct.flushSyncWork = zs, ct.focusWithin = function(t, e) {
        if (!Ya) throw Error(c(363));
        for (t = cr(t), e = xs(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var l = e[t++], a = l.tag;
          if (!Ga(l)) {
            if ((a === 5 || a === 26 || a === 27) && tm(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              e.push(l), l = l.sibling;
          }
        }
        return !1;
      }, ct.getFindAllNodesFailureDescription = function(t, e) {
        if (!Ya) throw Error(c(363));
        var l = 0, a = [];
        t = [cr(t), 0];
        for (var r = 0; r < t.length; ) {
          var o = t[r++], d = o.tag, h = t[r++], z = e[h];
          if ((d !== 5 && d !== 26 && d !== 27 || !Ga(o)) && (dr(o, z) && (a.push(fr(z)), h++, h > l && (l = h)), h < e.length))
            for (o = o.child; o !== null; )
              t.push(o, h), o = o.sibling;
        }
        if (l < e.length) {
          for (t = []; l < e.length; l++)
            t.push(fr(e[l]));
          return `findAllNodes was able to match part of the selector:
  ` + (a.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, ct.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Ba(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, ct.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Cf,
          rendererPackageName: jf,
          currentDispatcherRef: P,
          reconcilerVersion: "19.2.0"
        };
        if (Fs !== null && (t.rendererConfig = Fs), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Qa = e.inject(t), he = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ct.isAlreadyRendering = function() {
        return (dt & 6) !== 0;
      }, ct.observeVisibleRects = function(t, e, l, a) {
        if (!Ya) throw Error(c(363));
        t = mr(t, e);
        var r = em(
          t,
          l,
          a
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, ct.shouldError = function() {
        return null;
      }, ct.shouldSuspend = function() {
        return !1;
      }, ct.startHostTransition = function(t, e, l, a) {
        if (t.tag !== 5) throw Error(c(476));
        var r = Tu(t).queue;
        ku(
          t,
          r,
          e,
          la,
          l === null ? s : function() {
            var o = Tu(t);
            return o.next === null && (o = t.alternate.memoizedState), Aa(
              t,
              o.next.queue,
              {},
              fe()
            ), l(a);
          }
        );
      }, ct.updateContainer = function(t, e, l, a) {
        var r = e.current, o = fe();
        return Xs(
          r,
          o,
          t,
          e,
          l,
          a
        ), o;
      }, ct.updateContainerSync = function(t, e, l, a) {
        return Xs(
          e.current,
          2,
          t,
          e,
          l,
          a
        ), 2;
      }, ct;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(ro)), ro.exports;
}
var Yc;
function Yp() {
  return Yc || (Yc = 1, io.exports = Bp()), io.exports;
}
var Gp = Yp();
const Qp = /* @__PURE__ */ Co(Gp);
var so = { exports: {} }, ll = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Gc;
function Vp() {
  return Gc || (Gc = 1, ll.ConcurrentRoot = 1, ll.ContinuousEventPriority = 8, ll.DefaultEventPriority = 32, ll.DiscreteEventPriority = 2, ll.IdleEventPriority = 268435456, ll.LegacyRoot = 0, ll.NoEventPriority = 0), ll;
}
var Qc;
function Kp() {
  return Qc || (Qc = 1, so.exports = Vp()), so.exports;
}
var nn = Kp();
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
const yd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], po = 16, xd = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Xp = [
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
], Vc = {
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
}, Zp = /* @__PURE__ */ new Set([
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
]), wd = {
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
}, _d = {
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
}, ho = ["font-size", "color", ...new Set([...Object.keys(wd), ...Object.keys(_d)].filter((n) => n !== "font-size" && n !== "color"))], Jp = new Set(ho);
function se(n, i = " ") {
  const u = [];
  let s = 0, c = "";
  for (let f = 0; f < n.length; f++) {
    const m = n[f];
    if (m === "(" ? s++ : m === ")" && s--, s === 0 && (i === " " ? /\s/.test(m) : m === i)) {
      (c.trim() || i !== " ") && u.push(c.trim()), c = "";
      continue;
    }
    c += m;
  }
  return (c.trim() || i !== " " && u.length) && u.push(c.trim()), u;
}
function go(n, i, u = 0) {
  if (u > 32) return null;
  let s = "", c = 0;
  for (; ; ) {
    const f = n.indexOf("var(", c);
    if (f < 0)
      return s += n.slice(c), s;
    s += n.slice(c, f);
    let m = 1, p = f + 4;
    for (; p < n.length && m; p++)
      n[p] === "(" ? m++ : n[p] === ")" && m--;
    const w = n.slice(f + 4, p - 1), v = se(w, ","), q = v[0].trim(), R = v.length > 1 ? w.slice(w.indexOf(",") + 1).trim() : null;
    let y = i(q);
    if ((y == null || y === "initial") && (y = R), y == null) return null;
    const E = go(y, i, u + 1);
    if (E === null) return null;
    s += E, c = p;
  }
}
function Lp(n) {
  const i = [], u = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, c = 0;
  for (; c < n.length; ) {
    if (u.lastIndex = c, s = u.exec(n), !s || s.index !== c) {
      if (/^\s+$/.test(n.slice(c))) break;
      return null;
    }
    c = u.lastIndex, s[1] !== void 0 ? i.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? i.push({ fn: s[3].toLowerCase() }) : s[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: s[5] ?? s[6] });
  }
  return i;
}
function vo(n, i) {
  const u = Lp(n.trim());
  if (!u) return null;
  let s = 0;
  const c = ({ num: y, unit: E }) => {
    switch (E) {
      case "":
        return { px: 0, pct: 0, num: y, unitless: !0 };
      case "px":
        return { px: y, pct: 0, num: 0 };
      case "rem":
        return { px: y * po, pct: 0, num: 0 };
      case "em":
        return { px: y * (i.fontSize ?? po), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: y, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: y / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: y / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: y * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, f = (y, E, x) => y && E ? { px: y.px + x * E.px, pct: y.pct + x * E.pct, num: y.num + x * E.num, unitless: y.unitless && E.unitless } : null, m = (y, E) => y ? { px: y.px * E, pct: y.pct * E, num: y.num * E, unitless: y.unitless } : null, p = (y) => y && y.unitless;
  function w() {
    const y = u[s++];
    if (!y) return null;
    if (y.num !== void 0) return c(y);
    if (y.op === "(") {
      const E = q();
      return u[s]?.op !== ")" ? null : (s++, E);
    }
    if (y.op === "-" || y.op === "+") {
      const E = w();
      return y.op === "-" ? m(E, -1) : E;
    }
    if (y.fn) {
      const E = [];
      for (; ; ) {
        E.push(q());
        const O = u[s++];
        if (!O) return null;
        if (O.op === ")") break;
        if (O.op !== ",") return null;
      }
      if (E.some((O) => !O)) return null;
      if (y.fn === "calc") return E[0];
      if (!(E.every((O) => !O.pct) || E.every((O) => !O.px && !O.num))) return null;
      const T = (O) => O.px + O.pct + O.num;
      return y.fn === "min" ? E.reduce((O, A) => T(A) < T(O) ? A : O) : y.fn === "max" ? E.reduce((O, A) => T(A) > T(O) ? A : O) : y.fn === "clamp" && E.length === 3 ? T(E[1]) < T(E[0]) ? E[0] : T(E[1]) > T(E[2]) ? E[2] : E[1] : null;
    }
    return null;
  }
  function v() {
    let y = w();
    for (; u[s] && (u[s].op === "*" || u[s].op === "/"); ) {
      const E = u[s++].op, x = w();
      if (!y || !x) return null;
      E === "*" ? y = p(x) ? m(y, x.num) : p(y) ? m(x, y.num) : null : y = p(x) && x.num !== 0 ? m(y, 1 / x.num) : null;
    }
    return y;
  }
  function q() {
    let y = v();
    for (; u[s] && (u[s].op === "+" || u[s].op === "-"); ) {
      const E = u[s++].op;
      y = f(y, v(), E === "-" ? -1 : 1);
    }
    return y;
  }
  const R = q();
  return s !== u.length || !R ? null : R;
}
function bo(n, i) {
  const u = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(u))
    return u === "thin" ? { px: 1 } : u === "medium" ? { px: 3 } : u === "thick" ? { px: 5 } : u;
  const s = vo(u, i);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: n.trim() } : s.pct && (s.px || s.num) ? { expr: n.trim() } : s.pct ? { pct: s.pct } : { px: Wp(s.px) } : { expr: n.trim() };
}
const Wp = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, oi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Fp = ([n, i, u, s]) => `#${oi(n)}${oi(i)}${oi(u)}${oi(s * 255)}`;
function Kc(n) {
  const i = n.slice(1), u = i.length <= 4 ? i.split("").map((c) => c + c).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(u)) return null;
  const s = (c) => parseInt(u.slice(c, c + 2), 16);
  return [s(0), s(2), s(4), u.length === 8 ? s(6) / 255 : 1];
}
function mi(n, i) {
  const u = n.trim().toLowerCase();
  if (u === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(u);
  if (s) {
    const v = i(s[1]), q = v && Kc(v);
    return q ? { rgba: q, token: s[1] } : null;
  }
  if (u.startsWith("#")) {
    const v = Kc(u);
    return v ? { rgba: v, token: null } : null;
  }
  if (Vc[u]) return { rgba: [...Vc[u]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(u);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const v = se(c[2], ",");
    if (v.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(v[0])) return null;
    const q = (Mt) => {
      const Jt = se(Mt), Nt = Jt.findIndex((et) => /%$/.test(et)), H = Nt >= 0 ? parseFloat(Jt[Nt]) / 100 : null;
      return { color: mi(Jt.filter((et, it) => it !== Nt).join(" "), i), pct: H };
    }, R = q(v[1]), y = q(v[2]);
    if (!R.color || !y.color || R.color === "currentcolor" || y.color === "currentcolor") return null;
    let E = R.pct, x = y.pct;
    E === null && x === null ? (E = 0.5, x = 0.5) : E === null ? E = 1 - x : x === null && (x = 1 - E);
    const T = E + x, O = T < 1 ? T : 1;
    E /= T, x /= T;
    const [A, j, G, V] = R.color.rgba, [at, J, k, N] = y.color.rgba, Q = V * E + N * x, mt = (Mt, Jt) => Q === 0 ? 0 : (Mt * V * E + Jt * N * x) / Q, wt = [mt(A, at), mt(j, J), mt(G, k), Q * O], zt = N === 0 ? R.color.token : V === 0 ? y.color.token : null;
    return { rgba: wt, token: zt };
  }
  const f = c[2].includes(",") ? se(c[2], ",") : se(c[2].replace("/", " / ")).filter((v) => v !== "/");
  if (f.length < 3) return null;
  const m = (v) => v.endsWith("%") ? parseFloat(v) / 100 * 255 : parseFloat(v), p = f[3] === void 0 ? 1 : f[3].endsWith("%") ? parseFloat(f[3]) / 100 : parseFloat(f[3]), w = [m(f[0]), m(f[1]), m(f[2]), p];
  return w.some((v) => Number.isNaN(v)) ? null : { rgba: w, token: null };
}
const ln = ["top", "right", "bottom", "left"], Ip = ["top-left", "top-right", "bottom-right", "bottom-left"], ui = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Xc = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function yo(n, i) {
  const u = i.trim(), s = () => se(u);
  switch (n) {
    case "padding":
    case "margin": {
      const c = ui(s());
      return ln.map((f, m) => [`${n}-${f}`, c[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const c = s(), f = n.split("-")[0];
      return [[`${f}-left`, c[0]], [`${f}-right`, c[1] ?? c[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const c = s(), f = n.split("-")[0];
      return [[`${f}-top`, c[0]], [`${f}-bottom`, c[1] ?? c[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${n.split("-")[0]}-left`, u]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, u]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, u]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, u]];
    case "inset": {
      const c = ui(s());
      return ln.map((f, m) => [f, c[m]]);
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
      return [["left", u]];
    case "inset-inline-end":
      return [["right", u]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const c = n.split("-")[1], f = ui(s());
      return ln.map((m, p) => [`border-${m}-${c}`, f[p]]);
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
      const c = n === "border" ? ln : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let f = "medium", m = "none", p = "currentcolor";
      if (u !== "none" && u !== "0")
        for (const w of s())
          Xc.has(w) ? m = w : /^(thin|medium|thick|-?[\d.]|calc\()/.test(w) ? f = w : p = w;
      else u === "0" && (f = "0");
      return c.flatMap((w) => [[`border-${w}-width`, f], [`border-${w}-style`, m], [`border-${w}-color`, p]]);
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
      const c = ui(se(u.split("/")[0]));
      return Ip.map((f, m) => [`border-${f}-radius`, c[m]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", u]];
    case "border-start-end-radius":
      return [["border-top-right-radius", u]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", u]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", u]];
    case "background":
      return u === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : mi(u, () => "#000000") ? [["background-color", u], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", u]];
    case "overflow": {
      const c = s();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = s();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return yo("gap", u);
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
      if (u === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (u === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (u === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const c = s(), f = c.filter((p) => /^[\d.]+$/.test(p)), m = c.find((p) => !/^[\d.]+$/.test(p));
      return [["flex-grow", f[0] ?? "1"], ["flex-shrink", f[1] ?? "1"], ["flex-basis", m ?? (f.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const c = [];
      for (const f of s()) c.push(/wrap/.test(f) ? ["flex-wrap", f] : ["flex-direction", f]);
      return c;
    }
    case "outline": {
      if (u === "none" || u === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let c = "medium", f = "none", m = "currentcolor";
      for (const p of s())
        Xc.has(p) || p === "auto" ? f = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? c = p : m = p;
      return [["outline-width", c], ["outline-style", f], ["outline-color", m]];
    }
    case "transition": {
      if (u === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = se(u, ","), f = c.map((p) => se(p).find((w) => !/^[\d.]+m?s$/.test(w) && !/^(ease|linear|step|cubic)/.test(w)) ?? "all"), m = c.map((p) => se(p).find((w) => /^[\d.]+m?s$/.test(w)) ?? "0s");
      return [["transition-property", f.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", s()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", u]];
    case "word-wrap":
      return [["overflow-wrap", u]];
    default:
      return [[n, u]];
  }
}
function $p(n, i) {
  return n ? se(n, ",").some((u) => {
    let s = u.trim().toLowerCase(), c = !1;
    s.startsWith("not ") && (c = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const f = s.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const p = /^\((.+)\)$/.exec(m);
      if (!p) return !1;
      const w = p[1].trim(), v = /^([a-z-]+)\s*:\s*(.+)$/.exec(w);
      if (v) {
        const [, R, y] = v, E = (x) => {
          const T = bo(x, { viewport: i });
          return typeof T == "object" && "px" in T ? T.px : NaN;
        };
        switch (R) {
          case "min-width":
            return i.width >= E(y);
          case "max-width":
            return i.width <= E(y);
          case "min-height":
            return i.height >= E(y);
          case "max-height":
            return i.height <= E(y);
          case "hover":
          case "any-hover":
            return y.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return y.trim() === "fine";
          case "prefers-reduced-motion":
            return y.trim() === "no-preference";
          case "prefers-color-scheme":
            return y.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const q = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(w);
      if (q) {
        const R = q[1] === "width" ? i.width : i.height, y = bo(q[3], { viewport: i }), E = typeof y == "object" && "px" in y ? y.px : NaN;
        switch (q[2]) {
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
function Pp(n, i) {
  const u = i[i.length - 1].compound;
  return jo(u)[0] ?? n;
}
function th(n) {
  const i = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Set(), s = (c, f) => {
    c.forEach(({ compound: m }, p) => {
      const w = f && p === c.length - 1;
      for (const v of m.pseudos)
        if (xd.has(v.name) && (w ? i : u).add(v.name), v.list && v.name !== "not") for (const q of v.list) s(q, w);
    });
  };
  return s(n, !0), { subject: i, ancestor: u };
}
function jo(n) {
  const i = [...n.classes];
  for (const u of n.pseudos)
    if (!(u.name !== "is" && u.name !== "where"))
      for (const s of u.list) s.length === 1 && i.push(...jo(s[0].compound));
  return i;
}
function eh(n, i) {
  const u = (s, c) => {
    s.forEach(({ compound: f }, m) => {
      const p = c && m === s.length - 1, w = f.pseudos.filter((v) => xd.has(v.name)).map((v) => v.name);
      if (!p) for (const v of w) for (const q of jo(f)) i.add(`${v}:${q}`);
      for (const v of f.pseudos) if (v.list && v.name !== "not") for (const q of v.list) u(q, p);
    });
  };
  u(n, !0);
}
class lh {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const u = (f, m) => {
      const p = m[m.length - 1].compound, w = p.classes.length ? `.${p.classes[0]}` : p.tag && p.tag !== "*" ? p.tag : "*";
      this.index.has(w) || this.index.set(w, []), this.index.get(w).push(f);
    };
    let s = 0;
    const c = (f, m) => {
      for (const [p, w, v, q] of f)
        for (const R of zo(p)) {
          let y;
          try {
            y = Eo(R);
          } catch (T) {
            if (T instanceof we) {
              this.skipped++;
              continue;
            }
            throw T;
          }
          const E = th(y);
          eh(y, this.trackedStates);
          const x = { steps: y, media: w, layer: v, origin: m, order: s++, specificity: hd(y), decls: q, states: E, source: m === 0 ? `ua:${y[y.length - 1].compound.tag ?? "*"}` : Pp(R, y) };
          this.rules.push(x), u(x, y);
        }
    };
    c(Xp.map(([f, m]) => [f, null, 0, Object.entries(m)]), 0), c(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const u = [], s = /* @__PURE__ */ new Set(), c = (f) => {
      if (f) for (const m of f) s.has(m) || (s.add(m), u.push(m));
    };
    for (const f of i.classList) c(this.index.get(`.${f}`));
    return c(this.index.get(i.tagName)), c(this.index.get("*")), u;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, u) {
    for (const s of i.classList) if (this.trackedStates.has(`${u}:${s}`)) return !0;
    return !1;
  }
}
const ah = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function nh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [u, s] of Object.entries(n)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const c = u.startsWith("--") ? u : u.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), f = typeof s == "number" && s !== 0 && !ah.has(c) && !c.startsWith("--") ? `${s}px` : String(s);
    i.push([c, f]);
  }
  return i;
}
function ih(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const u of ["width", "height"]) {
    const s = n.getAttribute(u);
    s !== null && i.push([u, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return i;
}
const rh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class oh {
  constructor(i, { theme: u, viewport: s }) {
    this.sheet = i, this.theme = u, this.viewport = s, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, u) {
    const s = (c, f, m) => {
      if (f === "disabled") return !!c.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(c.tagName);
      if (f === "enabled") return !c.props?.disabled && ["button", "input", "select", "textarea"].includes(c.tagName);
      if (f === "checked") return !!c.props?.checked;
      if (u === "*") return !0;
      if (f === "focus-within") {
        const p = c.ownerDocument?.activeElement;
        return !!p && p !== c.ownerDocument.body && typeof c.contains == "function" && c.contains(p);
      }
      return m ? u.has(f) : f === "focus-visible" ? !!c.state?.focus : !!c.state?.[f];
    };
    return this.sheet.candidates(i).filter((c) => (!c.media || c.media.every((f) => $p(f, this.viewport))) && Np(i, c.steps, { state: s }));
  }
  compute(i, u, s = /* @__PURE__ */ new Set()) {
    const c = this.matching(i, s), f = [];
    for (const k of c)
      for (const [N, Q, mt] of k.decls) f.push({ prop: N, value: Q, important: mt ? 1 : 0, origin: k.origin === 0 ? 0 : 2, layer: k.layer, specificity: k.specificity, order: k.order, source: k.source });
    for (const [k, N] of ih(i)) f.push({ prop: k, value: N, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${k}` });
    for (const [k, N] of nh(i.props?.style)) f.push({ prop: k, value: N, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    f.sort(rh);
    const m = this.sheet.properties, p = Object.create(u?.customs ?? null), w = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
    for (const k of f) k.prop.startsWith("--") && v.set(k.prop, k.value);
    if (!u && this.theme) for (const k of yd) this.theme[k] && v.set(`--${k}`, `perchtoken(${k})`);
    const q = (k) => {
      if (w.has(k)) return w.get(k);
      const N = m[k];
      return N && !N.inherits ? N.initial ?? null : k in p ? p[k] : N?.initial ?? null;
    }, R = /* @__PURE__ */ new Set(), y = (k) => {
      if (!v.has(k)) return q(k);
      if (R.has(k)) return null;
      R.add(k);
      const N = go(v.get(k), y);
      return R.delete(k), v.delete(k), w.set(k, N), (!m[k] || m[k].inherits) && (p[k] = N), N;
    };
    for (const k of [...v.keys()]) y(k);
    const E = /* @__PURE__ */ new Map();
    for (const k of f) {
      if (k.prop.startsWith("--")) continue;
      const N = go(k.value, q);
      if (N === null) {
        for (const [Q] of yo(k.prop, "unset")) E.set(Q, { value: "unset", source: k.source, origin: k.origin });
        continue;
      }
      for (const [Q, mt] of yo(k.prop, N)) E.set(Q, { value: mt, source: k.source, origin: k.origin });
    }
    const x = {}, T = {}, O = /* @__PURE__ */ new Set(), A = /* @__PURE__ */ new Set(), j = u?.values, G = { fontSize: j?.["font-size"] ?? po, viewport: this.viewport }, V = (k, N) => {
      if (/currentcolor/i.test(N)) return this.parseValue(k, N, G, x, j);
      const Q = `${k}\0${N}\0${G.fontSize}`;
      let mt = this.parsed.get(Q);
      return mt === void 0 && this.parsed.set(Q, mt = this.parseValue(k, N, G, x, j)), mt;
    }, at = E.size ? [...ho, ...[...E.keys()].filter((k) => !Jp.has(k))] : ho;
    for (const k of at) {
      const N = E.get(k);
      let Q = N?.value;
      const mt = Zp.has(k);
      if ((Q === void 0 || Q === "unset" || Q === "revert" || Q === "revert-layer") && (Q = mt ? "inherit" : "initial"), N && (T[k] = N.source, N.origin !== 0 && O.add(k)), Q === "inherit" && j && k in j) {
        x[k] = j[k], A.add(k);
        continue;
      }
      (Q === "inherit" || Q === "initial") && (Q = mt ? _d[k] : wd[k]), x[k] = V(k, Q), k === "font-size" && (G.fontSize = x["font-size"]);
    }
    for (const k of ln) {
      const N = x[`border-${k}-style`];
      (N === "none" || N === "hidden") && (x[`border-${k}-width`] = { px: 0 });
    }
    x["outline-style"] === "none" && (x["outline-width"] = { px: 0 });
    const J = j?.display;
    return (J === "flex" || J === "inline-flex" || J === "grid" || J === "inline-grid") && x.position !== "absolute" && x.position !== "fixed" && (x.display = Zc(x.display)), (x.position === "absolute" || x.position === "fixed") && (x.display = Zc(x.display)), { values: x, sources: T, own: O, inherited: A, customs: p, rules: c, element: i };
  }
  parseValue(i, u, s, c, f) {
    const m = String(u).trim();
    switch (i) {
      case "font-size": {
        const p = m.toLowerCase(), w = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (w[p]) return w[p];
        if (p === "smaller") return s.fontSize / 1.2;
        if (p === "larger") return s.fontSize * 1.2;
        const v = vo(p, { fontSize: s.fontSize, viewport: s.viewport });
        return !v || v.num ? s.fontSize : v.px + v.pct / 100 * s.fontSize;
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
        const w = vo(p, { fontSize: s.fontSize, viewport: s.viewport });
        return w ? w.unitless ? { factor: w.num } : { px: w.px + w.pct / 100 * s.fontSize } : { normal: !0 };
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
        const p = mi(m, (w) => this.themeHex(w));
        return p === "currentcolor" || !p ? f?.color ?? { rgba: [0, 0, 0, 1], token: null } : p;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const p = mi(m, (w) => this.themeHex(w));
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
        return bo(m, s);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Zc(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const pi = (n) => n && n.rgba ? { value: Fp(n.rgba), token: n.token ?? null } : null, uh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function sh(n, i) {
  const u = i?.(n);
  if (Number.isFinite(u)) return u;
  const s = Math.round(n * 100) / 100;
  return uh[s] ?? Math.round(n * 1.2);
}
function Sd(n, i) {
  const u = n["line-height"], s = n["font-size"];
  return u.normal ? sh(s, i) : u.factor !== void 0 ? u.factor * s : u.px;
}
const ch = (n) => se(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const dh = "perch-native-description/1", si = Symbol("display"), hi = {
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
}, fh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of fh) hi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
hi.rounded = 0;
const mh = /* @__PURE__ */ new Set([
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
]), ph = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, hh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, gh = (n) => hh.test(n) ? "Menlo" : ph.test(n) ? ".SystemUIFont" : ch(n).split(",")[0].trim(), vh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Jc = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, zd = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const u = n.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? n.classList[0];
  if (u) return `${n.tagName}.${u}`;
  const s = n.parentElement;
  return s && s.tagName !== "body" ? `${zd(s)} > ${n.tagName}` : n.tagName;
};
class bh {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, u, s, c, f, m = "") {
    const p = `${i}|${u}|${s}|${c}`, w = this.map.get(p);
    if (w) {
      !w.elements.includes(f) && w.elements.length < 4 && w.elements.push(f), w.count++;
      return;
    }
    this.map.set(p, { kind: i, property: u, value: String(s), class: c ?? null, elements: [f], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, u) => i.kind < u.kind ? -1 : i.kind > u.kind ? 1 : i.property < u.property ? -1 : i.property > u.property ? 1 : 0);
  }
}
const nl = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
};
function Lc(n, i) {
  const u = n.values, s = {}, c = (A) => n.sources[A], f = (A) => n.sources[A] !== void 0, m = u.display;
  m === "none" ? s.display = "hidden" : m === "flex" || m === "inline-flex" ? s.display = "flex" : (m === "grid" || m === "inline-grid") && (s.display = "flex", s.flex_direction = "col", i("approximated", "display", m, c("display"), "one-column flex column"), u["grid-template-columns"] && u["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", u["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[u["flex-direction"]] ?? "row";
    s.flex_direction = A;
  }
  if (p) {
    (u["flex-wrap"] === "wrap" || u["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const A = m === "grid" || m === "inline-grid", j = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[u["align-items"]];
    j && (s.items = j);
    let G = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[u["justify-content"]];
    if (A) {
      const J = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[u["justify-items"]];
      J && (s.items = J), u["align-items"] === "center" && (G = "center");
    }
    G && (s.justify = G);
    const V = nl(u["row-gap"]), at = nl(u["column-gap"]);
    typeof V == "number" && V && (s.gap_y = V), typeof at == "number" && at && !A && (s.gap_x = at);
  }
  u["flex-grow"] && (s.flex_grow = u["flex-grow"]), u["flex-shrink"] !== 1 && (s.flex_shrink = u["flex-shrink"]);
  const w = nl(u["flex-basis"]);
  w !== void 0 && w !== "auto" && (s.flex_basis = w);
  const v = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[u["align-self"]];
  v && (s.self = v);
  for (const [A, j] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const G = u[j], V = nl(G);
    if (V === void 0) {
      typeof G == "object" && G.expr ? i("unsupported", j, G.expr, c(j), "no calc() in the engine") : typeof G == "string" && !["auto", "none"].includes(G) && i("unsupported", j, G, c(j));
      continue;
    }
    V !== "auto" && (s[A] = V);
  }
  const q = ["top", "right", "bottom", "left"];
  for (const A of q) {
    const j = A[0];
    for (const [G, V] of [["p", "padding"], ["m", "margin"]]) {
      const at = u[`${V}-${A}`], J = nl(at);
      if (J === void 0) {
        at?.expr && i("unsupported", `${V}-${A}`, at.expr, c(`${V}-${A}`), "no calc() in the engine");
        continue;
      }
      J !== 0 && (s[`${G}${j}`] = J);
    }
  }
  const R = u.position;
  if (R === "absolute" || R === "fixed") {
    s.position = "absolute", R === "fixed" && i("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const A of q) {
      const j = nl(u[A]);
      j !== void 0 && j !== "auto" && (s[A] = j);
    }
  } else R === "sticky" && i("unsupported", "position", "sticky", c("position"));
  u["z-index"] !== "auto" && f("z-index") && i("unsupported", "z-index", u["z-index"], c("z-index"), "paint order is tree order");
  for (const [A, j] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const G = u[j];
    G === "hidden" || G === "clip" ? s[A] = "hidden" : (G === "auto" || G === "scroll") && (s[A] = "scroll");
  }
  (u.visibility === "hidden" || u.visibility === "collapse") && (s.visibility = "invisible");
  const y = u["background-color"];
  y?.unreadable ? i("unsupported", "background-color", y.unreadable, c("background-color")) : y?.rgba && y.rgba[3] > 0 && (s.bg = pi(y)), u["background-image"] && u["background-image"] !== "none" && i("unsupported", "background-image", u["background-image"], c("background-image"));
  const E = q.map((A) => nl(u[`border-${A}-width`]) || 0), x = [];
  q.forEach((A, j) => {
    if (!E[j]) return;
    s[`border_${A[0]}`] = E[j];
    const G = u[`border-${A}-style`];
    G !== "solid" && i("approximated", `border-${A}-style`, G, c(`border-${A}-style`), "drawn solid");
    const V = pi(u[`border-${A}-color`]);
    V && x.push(V);
  }), x.length && (s.border_color = x[0], x.some((A) => A.value !== x[0].value) && i("approximated", "border-color", x.map((A) => A.value).join(" "), c("border-top-color"), "one border colour"));
  const T = ["top-left", "top-right", "bottom-right", "bottom-left"].map((A) => nl(u[`border-${A}-radius`]) || 0);
  T.every((A) => A === T[0]) ? T[0] && (s.rounded = T[0]) : ["tl", "tr", "br", "bl"].forEach((A, j) => {
    T[j] && (s[`rounded_${A}`] = T[j]);
  }), u.opacity !== 1 && (s.opacity = Math.round(u.opacity * 1e3) / 1e3);
  const O = u["box-shadow"];
  if (O && O !== "none" && se(O, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (s.shadow = "lg", i("approximated", "box-shadow", O, c("box-shadow"), "the engine's large shadow preset")), u.cursor && u.cursor !== "auto" && !n.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[u.cursor];
    A ? s.cursor = A : i("unsupported", "cursor", u.cursor, c("cursor"));
  }
  return u["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), u["text-decoration-line"] === "underline" ? s.underline = !0 : u["text-decoration-line"] && u["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", u["text-decoration-line"], c("text-decoration-line")), s;
}
function Wc(n, i) {
  const u = n.values, s = u["line-height"];
  return {
    text_color: pi(u.color),
    text_size: Math.round(u["font-size"] * 1e3) / 1e3,
    font_weight: u["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(Sd(u, i) * 1e3) / 1e3 },
    font_family: gh(u["font-family"]),
    italic: u["font-style"] === "italic" || u["font-style"] === "oblique",
    whitespace: u["white-space"] === "nowrap" || u["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[u["text-align"]] ?? "left"
  };
}
const Fc = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, Ed = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function Ic(n, i, u) {
  const s = {}, c = (p, w) => w.some((v) => !n.inherited.has(v));
  for (const [p, w] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]]])
    (c(p, w) || !Ed(i[p], u[p])) && (s[p] = i[p]);
  const f = Fc(i.line_height, i.text_size), m = u.line_height ? Fc(u.line_height, i.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(f - m) <= 1e-3)) && (s.line_height = i.line_height), s;
}
const yh = (n, i) => ({ ...n, ...i });
function $c(n, i) {
  const u = {};
  for (const [s, c] of Object.entries(n))
    c && typeof c == "object" && "value" in c ? (u[s] = c.value, c.token && (i[s] = c.token)) : s === "line_height" ? u[s] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : s === "italic" ? c && (u.italic = !0) : u[s] = c;
  return u.italic === !1 && delete u.italic, u;
}
function xh(n, i) {
  const u = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const c = n[s], f = i[s];
    Ed(c, f) || (u[s] = f === void 0 ? s in hi ? hi[s] : null : f);
  }
  return u;
}
function Pc(n, i) {
  const u = n.values;
  for (const [s, c] of Object.entries(n.sources)) {
    if (s.startsWith("--") || mh.has(s) || c.startsWith("ua:")) continue;
    const f = u[s];
    switch (s) {
      case "letter-spacing":
        f !== "normal" && f?.px !== 0 && i("approximated", s, f?.px !== void 0 ? `${Math.round(f.px * 1e3) / 1e3}px` : f, c, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        f !== "normal" && i("unsupported", s, f, c, "no font features in the engine");
        break;
      case "text-transform":
        f !== "none" && i("approximated", s, f, c, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = u["transition-duration"];
        s === "transition-property" && m && se(m, ",").some((p) => parseFloat(p) > 0) && u["transition-property"] !== "none" && i("unsupported", "transition", `${u["transition-property"]} ${m}`, c, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        f !== "none" && i("unsupported", s, f, c, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        s === "overflow-wrap" && f !== "normal" && i("unsupported", s, f, c);
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        u["outline-style"] !== "none" && s === "outline-style" && i("unsupported", "outline", `${nl(u["outline-width"])}px ${u["outline-style"]} ${pi(u["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
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
        f && f !== "none" && f !== "auto" && f !== "normal" && f !== "initial" && i("unsupported", s, f, c);
        break;
    }
  }
}
function wh(n, i, u, s) {
  const c = zd(n), f = [], m = (O, A, j, G, V) => f.push([O, A, j, G ?? "(user agent)", c, V]), p = s.cascade.compute(n, i), w = {}, v = Lc(p, m);
  Pc(p, m);
  const q = Wc(p, s.measure), R = Ic(p, q, u), y = $c({ ...v, ...R }, w), E = {}, x = s.cascade.matching(n, "*").filter((O) => O.states.subject.size);
  for (const [O, A] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!x.some((J) => A.some((k) => J.states.subject.has(k)))) continue;
    const j = s.cascade.compute(n, i, new Set(A)), G = {}, V = $c({ ...Lc(j, () => {
    }), ...Ic(j, Wc(j, s.measure), u) }, G);
    O === "focus" && Pc(j, m);
    const at = xh(y, V);
    if (Object.keys(at).length) {
      E[O] = at;
      const J = Object.fromEntries(Object.entries(G).filter(([k]) => k in at));
      Object.keys(J).length && (E[`${O}_tokens`] = J);
    }
  }
  s.cascade.sheet.tracks(n, "hover") && (E.track_hover = !0);
  const T = Object.entries(vh).filter(([, O]) => O.some((A) => typeof n.props[A] == "function")).map(([O]) => O);
  return T.length && (E.events = T), { computed: p, style: y, tokens: w, extra: E, meta: Nh(n), reports: f, childText: yh(u, R), where: c };
}
function Nd(n, i, u, s, c = "") {
  const f = `${c}/${n.id}.${n.version}`;
  let m = s.cache.get(n);
  (!m || m.key !== f) && s.cache.set(n, m = { key: f, part: wh(n, i, u, s) });
  const { computed: p, tokens: w, extra: v, reports: q, childText: R, where: y } = m.part;
  for (const N of q) s.findings.add(...N);
  const E = (N, Q, mt, wt, zt) => s.findings.add(N, Q, mt, wt, y, zt), x = { ...m.part.style }, T = { kind: "div", id: n.id, style: x, tokens: w, meta: m.part.meta, ...v };
  Object.defineProperty(T, si, { value: p.values.display });
  const O = n.tagName;
  if (O === "svg")
    return T.kind = n.props["data-perch-image"] ? "image" : "svg", T.markup = Th(n), T;
  if (O === "input" || O === "textarea" || O === "select") {
    T.kind = "input", T.input_type = O === "input" ? String(n.props.type ?? "text") : O;
    for (const N of ["value", "defaultValue", "placeholder", "checked", "disabled"]) n.props[N] !== void 0 && (T[N === "defaultValue" ? "value" : N] = n.props[N]);
    return T;
  }
  if (O === "img")
    return T.kind = "image", T.src = n.props.src ?? null, T;
  const A = p.values["text-transform"], j = [];
  let G = !1, V = !1;
  for (const N of n.childNodes) {
    if (N instanceof To) {
      if (N.hidden || N.data === "") continue;
      G = !0;
      const wt = j[j.length - 1];
      if (wt?.kind === "text")
        wt.source = (wt.source ?? wt.text) + N.data, wt.text = ed(wt.source, A), wt.text === wt.source && delete wt.source;
      else {
        const zt = ed(N.data, A);
        j.push(zt === N.data ? { kind: "text", text: zt } : { kind: "text", text: zt, source: N.data });
      }
      continue;
    }
    if (!(N instanceof _e)) continue;
    const Q = Nd(N, p, R, s, f), mt = Q[si];
    mt === "inline" || mt === "inline-block" || mt === "inline-flex" ? G = !0 : mt !== "none" && (V = !0), j.push(Q);
  }
  const at = j.some((N) => N.kind !== "text"), J = j.length === 1 && j[0].kind !== "text" && /^inline-(block|flex)$/.test(j[0][si]) ? j[0] : null;
  if (!x.display && J) {
    const N = s.cache.get(n.childNodes.find((mt) => mt.id === J.id))?.part.computed, Q = N ? kd(p.values, s.measure) - Eh(N.values, s.measure) : 0;
    x.display = "flex", x.flex_direction = "col", x.items = "start", Q > 0 && (J.style.mt = Math.round(((J.style.mt ?? 0) + Q) * 100) / 100), E("approximated", "display", `${p.values.display} holding one ${J[si]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else !x.display && G && at && (x.display = "flex", x.flex_direction = V ? "col" : "row", V || (x.items = "baseline"), E("approximated", "display", `${p.values.display} with inline content`, "(inline formatting)", V ? "a column of its children" : "a row on the text baseline"));
  const k = p.values["letter-spacing"]?.px;
  if (k)
    for (let N = 0; N < j.length; N++) {
      const Q = j[N];
      if (Q.kind !== "text") continue;
      const mt = Math.round(k * [...Q.text].length * 1e3) / 1e3;
      j[N] = { kind: "div", style: { pr: mt }, tokens: {}, children: [Q] };
    }
  return T.children = j, T;
}
function _h(n, i) {
  if (!i) return null;
  let s = (i.self ? n : i.closest ? gd(n, i.closest) : i.find ? an(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return s && i.strip && s.startsWith(i.strip) && (s = s.slice(i.strip.length)), s;
}
function Sh(n, i, u) {
  for (const s of i)
    for (const c of an(n.documentElement, s.selector)) {
      const f = u.get(c.id);
      if (!f) continue;
      const m = _h(c, s.key);
      f[s.textRange ? "range_name" : "name"] ??= m == null ? s.name : `${s.name}:${m}`;
    }
}
const td = 0.9521, zh = 0.2256, kd = (n, i) => (Sd(n, i) - (td + zh) * n["font-size"]) / 2 + td * n["font-size"];
function Eh(n, i) {
  const u = (c) => c && typeof c == "object" && "px" in c ? c.px : 0, s = n["border-top-style"] === "none" ? 0 : u(n["border-top-width"]);
  return u(n["padding-top"]) + s + kd(n, i);
}
const ed = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (u) => u.toUpperCase()) : n, Td = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Nh(n) {
  const i = {};
  for (const [u, s] of Object.entries(n.props)) {
    if (Td.has(u) || typeof s == "function" || s === void 0 || s === null || typeof s == "object") continue;
    const c = u.startsWith("aria-") || u.startsWith("data-");
    if (s === !1 && !c) continue;
    const f = u === "htmlFor" ? "for" : u === "tabIndex" ? "tabindex" : u;
    i[f] = typeof s == "boolean" ? c ? String(s) : "" : String(s);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const kh = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), ld = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Th(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (u) => {
    const s = [];
    for (const [f, m] of Object.entries(u.props))
      Td.has(f) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || f.startsWith("data-") || f.startsWith("aria-") || f === "focusable" || f === "role" || f === "title" || s.push(`${kh(f)}="${ld(m === !0 ? "" : m)}"`);
    u.tagName === "svg" && !u.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = u.childNodes.map((f) => f instanceof To ? ld(f.data) : i(f)).join("");
    return `<${u.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${c}</${u.tagName}>`;
  };
  return i(n);
}
function Ch(n) {
  const i = n.theme?.() ?? {}, u = {};
  for (const s of yd) i[s] && (u[s] = i[s]);
  return u;
}
const jh = {};
function Ah(n, i, u, s = {}, c = null) {
  const f = Ch(i), m = i.viewport?.() ?? { width: 1e3, height: 800 }, p = JSON.stringify([f, m]);
  (s.look !== p || s.sheet !== u) && Object.assign(s, { look: p, sheet: u, cache: /* @__PURE__ */ new WeakMap(), cascade: new oh(u, { theme: f, viewport: m }), top: null });
  const { cascade: w, cache: v } = s, q = { cascade: w, cache: v, findings: new bh(), measure: i.lineHeight ? (E) => i.lineHeight(E) : null };
  s.top ??= w.compute(n.body, w.compute(n.documentElement, null));
  const R = n.body.children.map((E) => Nd(E, s.top, jh, q));
  if (c?.length) {
    const E = /* @__PURE__ */ new Map(), x = (T) => {
      T.id && E.set(T.id, T);
      for (const O of T.children ?? []) x(O);
    };
    R.forEach(x), Sh(n, c, E);
  }
  const y = /* @__PURE__ */ new Set();
  for (const E of [n, n.defaultView])
    for (const { type: x } of E?.listeners ?? []) Jc[x] && y.add(Jc[x]);
  return { schema: dh, root: R[0] ?? null, overlays: R.slice(1), document_events: [...y].sort(), unsupported: q.findings.list() };
}
const Mh = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Oh = null;
const Rh = () => Oh ??= new lh(Mh);
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
let Zl = nn.NoEventPriority;
function Hh(n, i) {
  const u = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const s of u) {
    if (s === "children") continue;
    const c = n[s], f = i[s];
    if (!(c === f || typeof c == "function" && typeof f == "function") && !(s === "style" && c && f && typeof c == "object" && typeof f == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(f)])].every((p) => c[p] === f[p])))
      return !0;
  }
  return !1;
}
const Uh = {
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
  createInstance: (n, i, u) => new _e(n, i, u.ownerDocument),
  createTextInstance: (n, i) => new To(n),
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
  insertBefore: (n, i, u) => {
    n.insertBefore(i, u);
  },
  insertInContainerBefore: (n, i, u) => {
    n.insertBefore(i, u);
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
  commitUpdate: (n, i, u, s) => {
    n.props = s, Hh(u, s) && n.touch();
  },
  commitTextUpdate: (n, i, u) => {
    n.data = String(u);
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
    Zl = n;
  },
  getCurrentUpdatePriority: () => Zl,
  resolveUpdatePriority: () => Zl !== nn.NoEventPriority ? Zl : nn.DefaultEventPriority,
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
}, xe = Qp(Uh), Ao = (n, i, u = null) => xe.createPortal(n, i, null, u), Dh = {
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
class qh {
  constructor(i, u, s) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1 }, u), this.type = i, this.target = s, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function ci(n, i, u) {
  i.currentTarget = n;
  for (const { type: s, listener: c, capture: f } of [...n.listeners ?? []])
    s === i.type && f === u && c.call(n, i);
  if (n instanceof _e) {
    const s = Dh[i.type], c = s && n.props[u ? `${s}Capture` : s];
    typeof c == "function" && c(i);
  }
}
function Dg(n, i, u = {}) {
  const { document: s, window: c } = Ap(n), f = new _e("div", { id: "root", style: u.container ?? {} }, s);
  s.body.appendChild(f);
  const m = [];
  let p = null;
  const w = () => [s, c].map((j) => j.listeners.map((G) => `${G.type}:${G.capture}`).sort().join(",")).join("|");
  let v = "";
  const q = {}, R = () => (p = Ah(s, n, Rh(), q, u.names), v = w(), n.render?.(p), p), y = () => {
    xe.flushPassiveEffects(), xe.flushSyncWork(), w() !== v && R();
  };
  s.afterCommit = R;
  const E = (j) => {
    m.push(j), n.error?.(j);
  }, x = xe.createContainer(f, nn.ConcurrentRoot, null, !1, null, "", E, E, E, null);
  xe.updateContainerSync(Ht.createElement(i, u.props ?? {}), x, null, null), xe.flushSyncWork(), y();
  const T = (j) => {
    const G = (V) => {
      if (V.id === j) return V;
      for (const at of V.children) {
        const J = G(at);
        if (J) return J;
      }
      return null;
    };
    return G(s.documentElement);
  }, O = (j) => {
    const G = Zl;
    Zl = nn.DiscreteEventPriority;
    try {
      return j();
    } finally {
      Zl = G, xe.flushSyncWork(), y();
    }
  }, A = {
    document: s,
    window: c,
    container: f,
    errors: m,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: R,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(j, G, V = {}) {
      const at = typeof j == "string" ? T(j) : j;
      if (!at) return !1;
      const J = new qh(G, V, at), k = [];
      for (let Q = at; Q; Q = Q.parentNode) k.push(Q);
      const N = [...k, s, c];
      return O(() => {
        for (let Q = N.length - 1; Q > 0 && !J.propagationStopped; Q--) ci(N[Q], J, !0);
        J.propagationStopped || (ci(at, J, !0), J.propagationStopped || ci(at, J, !1));
        for (let Q = 1; Q < N.length && !J.propagationStopped; Q++) ci(N[Q], J, !1);
      }), !J.defaultPrevented;
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(j, G) {
      const V = T(j);
      V && (V.bounds = { x: G.x, y: G.y, width: G.width, height: G.height });
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(j, G = {}) {
      const V = { button: 0, buttons: 1, pointerType: "mouse", ...G };
      for (const at of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) A.dispatch(j, at, V);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    hover(j, G) {
      const V = T(j);
      !V || V.state.hover === G || (V.state.hover = G, V.touch(), R());
    },
    focus(j) {
      const G = T(j);
      G && (O(() => {
        const V = s.activeElement;
        V && V !== G && V !== s.body && A.dispatch(V, "blur"), s.focus(G), A.dispatch(G, "focus");
      }), R());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: y,
    update(j) {
      xe.updateContainerSync(Ht.createElement(i, j ?? {}), x, null, null), xe.flushSyncWork(), y();
    },
    unmount() {
      xe.updateContainerSync(null, x, null, null), xe.flushSyncWork(), xe.flushPassiveEffects(), s.afterCommit = null;
    }
  };
  return A;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Cd = (n) => xe.flushSyncFromReconciler(n), Bh = { createPortal: Ao, flushSync: Cd }, qg = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Ao,
  default: Bh,
  flushSync: Cd
}, Symbol.toStringTag, { value: "Module" }));
function jd(n) {
  var i, u, s = "";
  if (typeof n == "string" || typeof n == "number") s += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var c = n.length;
    for (i = 0; i < c; i++) n[i] && (u = jd(n[i])) && (s && (s += " "), s += u);
  } else for (u in n) n[u] && (s && (s += " "), s += u);
  return s;
}
function Ad() {
  for (var n, i, u = 0, s = "", c = arguments.length; u < c; u++) (n = arguments[u]) && (i = jd(n)) && (s && (s += " "), s += i);
  return s;
}
const Yh = (n, i) => {
  const u = new Array(n.length + i.length);
  for (let s = 0; s < n.length; s++)
    u[s] = n[s];
  for (let s = 0; s < i.length; s++)
    u[n.length + s] = i[s];
  return u;
}, Gh = (n, i) => ({
  classGroupId: n,
  validator: i
}), Md = (n = /* @__PURE__ */ new Map(), i = null, u) => ({
  nextPart: n,
  validators: i,
  classGroupId: u
}), gi = "-", ad = [], Qh = "arbitrary..", Vh = (n) => {
  const i = Xh(n), {
    conflictingClassGroups: u,
    conflictingClassGroupModifiers: s
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Kh(m);
      const p = m.split(gi), w = p[0] === "" && p.length > 1 ? 1 : 0;
      return Od(p, w, i);
    },
    getConflictingClassGroupIds: (m, p) => {
      if (p) {
        const w = s[m], v = u[m];
        return w ? v ? Yh(v, w) : w : v || ad;
      }
      return u[m] || ad;
    }
  };
}, Od = (n, i, u) => {
  if (n.length - i === 0)
    return u.classGroupId;
  const c = n[i], f = u.nextPart.get(c);
  if (f) {
    const v = Od(n, i + 1, f);
    if (v) return v;
  }
  const m = u.validators;
  if (m === null)
    return;
  const p = i === 0 ? n.join(gi) : n.slice(i).join(gi), w = m.length;
  for (let v = 0; v < w; v++) {
    const q = m[v];
    if (q.validator(p))
      return q.classGroupId;
  }
}, Kh = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), u = i.indexOf(":"), s = i.slice(0, u);
  return s ? Qh + s : void 0;
})(), Xh = (n) => {
  const {
    theme: i,
    classGroups: u
  } = n;
  return Zh(u, i);
}, Zh = (n, i) => {
  const u = Md();
  for (const s in n) {
    const c = n[s];
    Mo(c, u, s, i);
  }
  return u;
}, Mo = (n, i, u, s) => {
  const c = n.length;
  for (let f = 0; f < c; f++) {
    const m = n[f];
    Jh(m, i, u, s);
  }
}, Jh = (n, i, u, s) => {
  if (typeof n == "string") {
    Lh(n, i, u);
    return;
  }
  if (typeof n == "function") {
    Wh(n, i, u, s);
    return;
  }
  Fh(n, i, u, s);
}, Lh = (n, i, u) => {
  const s = n === "" ? i : Rd(i, n);
  s.classGroupId = u;
}, Wh = (n, i, u, s) => {
  if (Ih(n)) {
    Mo(n(s), i, u, s);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(Gh(u, n));
}, Fh = (n, i, u, s) => {
  const c = Object.entries(n), f = c.length;
  for (let m = 0; m < f; m++) {
    const [p, w] = c[m];
    Mo(w, Rd(i, p), u, s);
  }
}, Rd = (n, i) => {
  let u = n;
  const s = i.split(gi), c = s.length;
  for (let f = 0; f < c; f++) {
    const m = s[f];
    let p = u.nextPart.get(m);
    p || (p = Md(), u.nextPart.set(m, p)), u = p;
  }
  return u;
}, Ih = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, $h = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, u = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const c = (f, m) => {
    u[f] = m, i++, i > n && (i = 0, s = u, u = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(f) {
      let m = u[f];
      if (m !== void 0)
        return m;
      if ((m = s[f]) !== void 0)
        return c(f, m), m;
    },
    set(f, m) {
      f in u ? u[f] = m : c(f, m);
    }
  };
}, xo = "!", nd = ":", Ph = [], id = (n, i, u, s, c) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: u,
  maybePostfixModifierPosition: s,
  isExternal: c
}), t0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: u
  } = n;
  let s = (c) => {
    const f = [];
    let m = 0, p = 0, w = 0, v;
    const q = c.length;
    for (let T = 0; T < q; T++) {
      const O = c[T];
      if (m === 0 && p === 0) {
        if (O === nd) {
          f.push(c.slice(w, T)), w = T + 1;
          continue;
        }
        if (O === "/") {
          v = T;
          continue;
        }
      }
      O === "[" ? m++ : O === "]" ? m-- : O === "(" ? p++ : O === ")" && p--;
    }
    const R = f.length === 0 ? c : c.slice(w);
    let y = R, E = !1;
    R.endsWith(xo) ? (y = R.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      R.startsWith(xo) && (y = R.slice(1), E = !0)
    );
    const x = v && v > w ? v - w : void 0;
    return id(f, E, y, x);
  };
  if (i) {
    const c = i + nd, f = s;
    s = (m) => m.startsWith(c) ? f(m.slice(c.length)) : id(Ph, !1, m, void 0, !0);
  }
  if (u) {
    const c = s;
    s = (f) => u({
      className: f,
      parseClassName: c
    });
  }
  return s;
}, e0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((u, s) => {
    i.set(u, 1e6 + s);
  }), (u) => {
    const s = [];
    let c = [];
    for (let f = 0; f < u.length; f++) {
      const m = u[f], p = m[0] === "[", w = i.has(m);
      p || w ? (c.length > 0 && (c.sort(), s.push(...c), c = []), s.push(m)) : c.push(m);
    }
    return c.length > 0 && (c.sort(), s.push(...c)), s;
  };
}, l0 = (n) => ({
  cache: $h(n.cacheSize),
  parseClassName: t0(n),
  sortModifiers: e0(n),
  postfixLookupClassGroupIds: a0(n),
  ...Vh(n)
}), a0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), u = n.postfixLookupClassGroups;
  if (u)
    for (let s = 0; s < u.length; s++)
      i[u[s]] = !0;
  return i;
}, n0 = /\s+/, i0 = (n, i) => {
  const {
    parseClassName: u,
    getClassGroupId: s,
    getConflictingClassGroupIds: c,
    sortModifiers: f,
    postfixLookupClassGroupIds: m
  } = i, p = [], w = n.trim().split(n0);
  let v = "";
  for (let q = w.length - 1; q >= 0; q -= 1) {
    const R = w[q], {
      isExternal: y,
      modifiers: E,
      hasImportantModifier: x,
      baseClassName: T,
      maybePostfixModifierPosition: O
    } = u(R);
    if (y) {
      v = R + (v.length > 0 ? " " + v : v);
      continue;
    }
    let A = !!O, j;
    if (A) {
      const k = T.substring(0, O);
      j = s(k);
      const N = j && m[j] ? s(T) : void 0;
      N && N !== j && (j = N, A = !1);
    } else
      j = s(T);
    if (!j) {
      if (!A) {
        v = R + (v.length > 0 ? " " + v : v);
        continue;
      }
      if (j = s(T), !j) {
        v = R + (v.length > 0 ? " " + v : v);
        continue;
      }
      A = !1;
    }
    const G = E.length === 0 ? "" : E.length === 1 ? E[0] : f(E).join(":"), V = x ? G + xo : G, at = V + j;
    if (p.indexOf(at) > -1)
      continue;
    p.push(at);
    const J = c(j, A);
    for (let k = 0; k < J.length; ++k) {
      const N = J[k];
      p.push(V + N);
    }
    v = R + (v.length > 0 ? " " + v : v);
  }
  return v;
}, r0 = (...n) => {
  let i = 0, u, s, c = "";
  for (; i < n.length; )
    (u = n[i++]) && (s = Hd(u)) && (c && (c += " "), c += s);
  return c;
}, Hd = (n) => {
  if (typeof n == "string")
    return n;
  let i, u = "";
  for (let s = 0; s < n.length; s++)
    n[s] && (i = Hd(n[s])) && (u && (u += " "), u += i);
  return u;
}, o0 = (n, ...i) => {
  let u, s, c, f;
  const m = (w) => {
    const v = i.reduce((q, R) => R(q), n());
    return u = l0(v), s = u.cache.get, c = u.cache.set, f = p, p(w);
  }, p = (w) => {
    const v = s(w);
    if (v)
      return v;
    const q = i0(w, u);
    return c(w, q), q;
  };
  return f = m, (...w) => f(r0(...w));
}, u0 = [], Qt = (n) => {
  const i = (u) => u[n] || u0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, Ud = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Dd = /^\((?:(\w[\w-]*):)?(.+)\)$/i, s0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, c0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, d0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, f0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, m0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, p0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, zl = (n) => s0.test(n), st = (n) => !!n && !Number.isNaN(Number(n)), Ge = (n) => !!n && Number.isInteger(Number(n)), co = (n) => n.endsWith("%") && st(n.slice(0, -1)), al = (n) => c0.test(n), qd = () => !0, h0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  d0.test(n) && !f0.test(n)
), Oo = () => !1, g0 = (n) => m0.test(n), v0 = (n) => p0.test(n), b0 = (n) => !X(n) && !Z(n), y0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), x0 = (n) => El(n, Gd, Oo), X = (n) => Ud.test(n), Xl = (n) => El(n, Qd, h0), rd = (n) => El(n, T0, st), w0 = (n) => El(n, Kd, qd), _0 = (n) => El(n, Vd, Oo), od = (n) => El(n, Bd, Oo), S0 = (n) => El(n, Yd, v0), di = (n) => El(n, Xd, g0), Z = (n) => Dd.test(n), en = (n) => Jl(n, Qd), z0 = (n) => Jl(n, Vd), ud = (n) => Jl(n, Bd), E0 = (n) => Jl(n, Gd), N0 = (n) => Jl(n, Yd), fi = (n) => Jl(n, Xd, !0), k0 = (n) => Jl(n, Kd, !0), El = (n, i, u) => {
  const s = Ud.exec(n);
  return s ? s[1] ? i(s[1]) : u(s[2]) : !1;
}, Jl = (n, i, u = !1) => {
  const s = Dd.exec(n);
  return s ? s[1] ? i(s[1]) : u : !1;
}, Bd = (n) => n === "position" || n === "percentage", Yd = (n) => n === "image" || n === "url", Gd = (n) => n === "length" || n === "size" || n === "bg-size", Qd = (n) => n === "length", T0 = (n) => n === "number", Vd = (n) => n === "family-name", Kd = (n) => n === "number" || n === "weight", Xd = (n) => n === "shadow", C0 = () => {
  const n = Qt("color"), i = Qt("font"), u = Qt("text"), s = Qt("font-weight"), c = Qt("tracking"), f = Qt("leading"), m = Qt("breakpoint"), p = Qt("container"), w = Qt("spacing"), v = Qt("radius"), q = Qt("shadow"), R = Qt("inset-shadow"), y = Qt("text-shadow"), E = Qt("drop-shadow"), x = Qt("blur"), T = Qt("perspective"), O = Qt("aspect"), A = Qt("ease"), j = Qt("animate"), G = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], V = () => [
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
  ], at = () => [...V(), Z, X], J = () => ["auto", "hidden", "clip", "visible", "scroll"], k = () => ["auto", "contain", "none"], N = () => [Z, X, w], Q = () => [zl, "full", "auto", ...N()], mt = () => [Ge, "none", "subgrid", Z, X], wt = () => ["auto", {
    span: ["full", Ge, Z, X]
  }, Ge, Z, X], zt = () => [Ge, "auto", Z, X], Mt = () => ["auto", "min", "max", "fr", Z, X], Jt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Nt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], H = () => ["auto", ...N()], F = () => [zl, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...N()], et = () => [p, zl, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...N()], it = () => [zl, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...N()], B = () => [n, Z, X], g = () => [...V(), ud, od, {
    position: [Z, X]
  }], M = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], I = () => ["auto", "cover", "contain", E0, x0, {
    size: [Z, X]
  }], L = () => [co, en, Xl], W = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    v,
    Z,
    X
  ], $ = () => ["", st, en, Xl], gt = () => ["solid", "dashed", "dotted", "double"], Vt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], rt = () => [st, co, ud, od], Nl = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    x,
    Z,
    X
  ], kl = () => ["none", st, Z, X], Te = () => ["none", st, Z, X], Ce = () => [st, Z, X], il = () => [zl, "full", ...N()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [al],
      breakpoint: [al],
      color: [qd],
      container: [al],
      "drop-shadow": [al],
      ease: ["in", "out", "in-out"],
      font: [b0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [al],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [al],
      shadow: [al],
      spacing: ["px", st],
      text: [al],
      "text-shadow": [al],
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
        aspect: ["auto", "square", zl, X, Z, O]
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
        "@container": ["", "normal", "size", Z, X]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [y0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [st, "auto", X, Z, p]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": G()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": G()
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
        object: at()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: J()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": J()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": J()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: k()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": k()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": k()
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
        inset: Q()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": Q()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": Q()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": Q(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: Q()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": Q(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: Q()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": Q()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": Q()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: Q()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: Q()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: Q()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: Q()
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
        z: [Ge, "auto", Z, X]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [zl, "full", "auto", p, ...N()]
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
        flex: [st, zl, "auto", "initial", "none", X]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", st, Z, X]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", st, Z, X]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Ge, "first", "last", "none", Z, X]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": mt()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: wt()
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
        "grid-rows": mt()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: wt()
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
        gap: N()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": N()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": N()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...Jt(), "normal"]
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
        content: ["normal", ...Jt()]
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
        "place-content": Jt()
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
        p: N()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: N()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: N()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: N()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: N()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: N()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: N()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: N()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: N()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: N()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: N()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: H()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: H()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: H()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: H()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: H()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: H()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: H()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: H()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: H()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: H()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: H()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": N()
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
        "space-y": N()
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
        size: F()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...et()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...et()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...et()]
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
        w: [p, "screen", ...F()]
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
          ...F()
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
          ...F()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...F()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...F()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...F()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", u, en, Xl]
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
        font: [s, k0, w0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", co, X]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [z0, _0, i]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [X]
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
        tracking: [c, Z, X]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [st, "none", Z, rd]
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
          ...N()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", Z, X]
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
        list: ["disc", "decimal", "none", Z, X]
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
        decoration: [...gt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [st, "from-font", "auto", Z, Xl]
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
        "underline-offset": [st, "auto", Z, X]
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
        indent: N()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [Ge, Z, X]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", Z, X]
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
        content: ["none", Z, X]
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
        bg: M()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: I()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Ge, Z, X],
          radial: ["", Z, X],
          conic: ["", Ge, Z, X]
        }, N0, S0]
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
        from: L()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: L()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: L()
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
        rounded: W()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": W()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": W()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": W()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": W()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": W()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": W()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": W()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": W()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": W()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": W()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": W()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": W()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": W()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": W()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: $()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": $()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": $()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": $()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": $()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": $()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": $()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": $()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": $()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": $()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": $()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": $()
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
        "divide-y": $()
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
        outline: [...gt(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [st, Z, X]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", st, en, Xl]
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
          q,
          fi,
          di
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
        "inset-shadow": ["none", R, fi, di]
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
        ring: $()
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
        "ring-offset": [st, Xl]
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
        "inset-ring": $()
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
        "text-shadow": ["none", y, fi, di]
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
        opacity: [st, Z, X]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Vt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Vt()
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
        "mask-linear": [st]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": rt()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": rt()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": B()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": B()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": rt()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": rt()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": B()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": B()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": rt()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": rt()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": B()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": B()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": rt()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": rt()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": B()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": B()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": rt()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": rt()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": B()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": B()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": rt()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": rt()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": B()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": B()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": rt()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": rt()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": B()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": B()
      }],
      "mask-image-radial": [{
        "mask-radial": [Z, X]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": rt()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": rt()
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
        "mask-radial-at": V()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [st]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": rt()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": rt()
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
        mask: M()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: I()
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
        mask: ["none", Z, X]
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
          Z,
          X
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Nl()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [st, Z, X]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [st, Z, X]
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
          fi,
          di
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
        grayscale: ["", st, Z, X]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [st, Z, X]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", st, Z, X]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [st, Z, X]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", st, Z, X]
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
          Z,
          X
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Nl()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [st, Z, X]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [st, Z, X]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", st, Z, X]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [st, Z, X]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", st, Z, X]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [st, Z, X]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [st, Z, X]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", st, Z, X]
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
        "border-spacing": N()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": N()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": N()
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", Z, X]
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
        duration: [st, "initial", Z, X]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", A, Z, X]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [st, Z, X]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", j, Z, X]
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
        perspective: [T, Z, X]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": at()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: kl()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": kl()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": kl()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": kl()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: Te()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": Te()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": Te()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": Te()
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
        skew: Ce()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Ce()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Ce()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [Z, X, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: at()
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
        translate: il()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": il()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": il()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": il()
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
        zoom: [Ge, Z, X]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", Z, X]
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
        "scroll-m": N()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": N()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": N()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": N()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": N()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": N()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": N()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": N()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": N()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": N()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": N()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": N()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": N()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": N()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": N()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": N()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": N()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": N()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": N()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": N()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": N()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": N()
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
        "will-change": ["auto", "scroll", "contents", "transform", Z, X]
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
        stroke: [st, en, Xl, rd]
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
}, j0 = /* @__PURE__ */ o0(C0);
function Qe(...n) {
  return j0(Ad(n));
}
const Zd = typeof navigator < "u" && /Mac/i.test(navigator.platform), vi = {
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
for (let n = 1; n <= 12; n++) vi[`f${n}`] = `F${n}`;
const A0 = Object.fromEntries(Object.entries(vi).map(([n, i]) => [i, n])), M0 = {
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
function O0(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : A0[n];
}
const sd = /* @__PURE__ */ new Map();
function Jd(n, i = Zd) {
  const u = `${i}|${n}`, s = sd.get(u);
  if (s) return s;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const f of n.split("+"))
    if (f === "mod")
      i ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (f === "cmd" || f === "ctrl" || f === "shift" || f === "alt") c[f] = !0;
    else if (/^[a-z]$/.test(f))
      c.code = `Key${f.toUpperCase()}`, c.letter = f;
    else if (/^[0-9]$/.test(f)) c.code = `Digit${f}`;
    else if (vi[f]) c.code = vi[f];
    else throw new Error(`unknown key "${f}" in "${n}"`);
  if (!c.code) throw new Error(`no key in "${n}"`);
  return sd.set(u, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = Jd(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function R0(n, i = Zd) {
  const u = Jd(n, i), s = H0(O0(u.code) ?? "");
  return i ? `${u.ctrl ? "⌃" : ""}${u.alt ? "⌥" : ""}${u.shift ? "⇧" : ""}${u.cmd ? "⌘" : ""}${s}` : [u.ctrl && "Ctrl", u.alt && "Alt", u.shift && "Shift", s].filter(Boolean).join("+");
}
const H0 = (n) => M0[n] ?? n.toUpperCase(), cd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, dd = Ad, bi = (n, i) => (u) => {
  var s;
  if (i?.variants == null) return dd(n, u?.class, u?.className);
  const { variants: c, defaultVariants: f } = i, m = Object.keys(c).map((v) => {
    const q = u?.[v], R = f?.[v];
    if (q === null) return null;
    const y = cd(q) || cd(R);
    return c[v][y];
  }), p = u && Object.entries(u).reduce((v, q) => {
    let [R, y] = q;
    return y === void 0 || (v[R] = y), v;
  }, {}), w = i == null || (s = i.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((v, q) => {
    let { class: R, className: y, ...E } = q;
    return Object.entries(E).every((x) => {
      let [T, O] = x;
      return Array.isArray(O) ? O.includes({
        ...f,
        ...p
      }[T]) : {
        ...f,
        ...p
      }[T] === O;
    }) ? [
      ...v,
      R,
      y
    ] : v;
  }, []);
  return dd(n, m, w, u?.class, u?.className);
}, U0 = bi(
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
), D0 = bi(
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
function q0({ className: n, ...i } = {}) {
  return Qe(D0(i), n);
}
const Ld = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Wd = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", B0 = bi(`${Wd} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Y0({ className: n, ...i } = {}) {
  return Qe(B0(i), n);
}
const G0 = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Q0 = bi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), V0 = "my-1 h-px bg-overlay-0";
function K0({ size: n = 14, className: i }) {
  return /* @__PURE__ */ Pt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ Pt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Pt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Pt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function X0({ size: n = 16, className: i }) {
  return /* @__PURE__ */ Pt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ Pt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ Pt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Z0({ size: n = 14, className: i }) {
  return /* @__PURE__ */ Pt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Pt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Fd({ size: n = 14, className: i }) {
  return /* @__PURE__ */ Pt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Pt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const fd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function J0({ state: n, error: i }) {
  return /* @__PURE__ */ Pt.jsx(
    "span",
    {
      className: Qe("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", fd[n] ?? fd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function L0({ title: n, onClose: i, children: u, testId: s }) {
  return Ao(
    /* @__PURE__ */ Pt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (c) => {
          c.target === c.currentTarget && i();
        },
        onKeyDown: (c) => {
          c.key === "Escape" && i();
        },
        children: /* @__PURE__ */ Pt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": s,
            children: [
              /* @__PURE__ */ Pt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              u
            ]
          }
        )
      }
    ),
    document.body
  );
}
function W0(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const wo = {
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
function _o(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((u) => u.id === n.parentSessionId);
}
function F0(n) {
  const i = /* @__PURE__ */ new Map();
  for (const u of n)
    _o(u, n) && i.set(u.parentSessionId, [...i.get(u.parentSessionId) ?? [], u]);
  return i.size ? n.filter((u) => !_o(u, n)).flatMap((u) => [u, ...i.get(u.id) ?? []]) : n;
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const I0 = "1.3.0";
function ce() {
  const n = globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const $0 = (n) => ce().subscribe?.(n) ?? (() => {
}), P0 = globalThis.perch?.isMac !== !1, tg = (n) => R0(n, ce().isMac !== !1), eg = (n) => U0(n), lg = ({ className: n, ...i } = {}) => Qe(q0(i), n), ag = Y0, ng = (n) => Q0(n), ig = V0, rg = Wd, og = Ld, ug = (n) => wo[n].color, sg = (n, i) => ce().command(n, i ?? {}) !== !1, cg = (n, i, u) => ce().startSession?.(n, i, u), dg = globalThis.perch?.pickFolder ? (n) => ce().pickFolder(n) : null;
function rn(n) {
  const i = Ht.useRef(n);
  return i.current = n, Ht.useSyncExternalStore($0, () => i.current(ce()));
}
const fg = (n = {}) => rn((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), mg = () => rn((n) => n.hosts()), pg = () => rn((n) => n.sessionFolders());
function hg() {
  const n = rn((i) => i.addProject?.() ?? gg);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, u, s) => {
      i.trim() && n.status !== "pending" && ce().addProjectFolder?.(i, u, s);
    },
    clear: () => ce().clearAddProject?.()
  };
}
const gg = Object.freeze({ status: "idle" });
function vg(n) {
  Ht.useEffect(() => ce().onRequest?.("add-project", n) ?? void 0, [n]);
}
function bg(n) {
  const i = n.map((u) => ({ id: u.id, parentSessionId: u.parentId, session: u }));
  return F0(i).map((u) => ({ session: u.session, nested: _o(u, i) }));
}
function yg({ id: n, plain: i, className: u }) {
  const s = rn((v) => v.session(n));
  if (!s) return null;
  const c = s.state ?? W0(s), f = wo[c]?.color ?? wo.unknown.color, m = s.provider, p = m === "claude" || m === "claude-agent-teams" || m === "omp", w = i ? Qe("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", u) : Qe("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", u);
  return Ht.createElement(
    "span",
    { className: w, style: i ? void 0 : { borderColor: f }, "data-provider": m ?? "unknown", title: i ? m ?? "Agent" : `${m ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    Ht.createElement("span", { className: Qe("inline-flex text-fg", p && "rounded-full bg-[#161616]") }, Ht.createElement(Id, { provider: m, size: 14 }))
  );
}
function Id({ provider: n, size: i = 14 }) {
  const u = ce().agentIcon?.(n, i) ?? null, s = u?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return Ht.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": s, ...u && u.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const xg = ({ children: n }) => Ht.createElement(Ht.Fragment, null, n);
function wg(n, i) {
  const u = Ht.useRef(i);
  return u.current = i, Ht.useEffect(() => {
    const s = ce();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const c = {};
    for (const [m, p] of Object.entries(u.current))
      c[m] = typeof p == "function" ? (...w) => u.current[m]?.(...w) : p;
    const f = s.openOverlay(n, c);
    return () => s.closeOverlay?.(f);
  }, [n]), null;
}
const Sa = (n) => function(u) {
  return wg(n, u);
}, _g = Sa("session-menu"), Sg = Sa("new-session-menu"), zg = Sa("confirm");
function Eg({ value: n, onChange: i, options: u = [], className: s, ariaLabel: c, testId: f, title: m, disabled: p, placeholder: w }) {
  const v = Ht.useRef(null), q = u.find((R) => R.value === n);
  return Ht.createElement(
    "button",
    {
      type: "button",
      ref: v,
      title: m,
      disabled: p,
      "aria-label": c,
      "data-testid": f,
      "aria-haspopup": "listbox",
      className: Qe("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
      onClick: () => ce().openOverlay?.("select", { value: n, options: u, onChange: (R) => i?.(R), anchor: v.current?.getBoundingClientRect() })
    },
    Ht.createElement("span", { className: "min-w-0 flex-1 truncate" }, q ? q.label : w ?? "")
  );
}
const Ng = Sa("folder-browser"), kg = Sa("instructions"), Tg = Sa("memory"), Cg = L0;
function jg({ hostId: n, path: i, className: u }) {
  const s = Ht.useRef(null);
  return Ht.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Qe("worktree-menu__btn", Ld, u),
      "data-testid": `worktree-menu-${n}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => ce().openOverlay?.("worktree", { hostId: n, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    Ht.createElement(Fd, null)
  );
}
const Ag = (n, i) => ce().beginReorderDrag?.(n, i), Bg = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Id,
  CloseIcon: Z0,
  ConfirmDialog: zg,
  Dialog: Cg,
  EllipsisIcon: K0,
  FolderBrowser: Ng,
  GearIcon: X0,
  HostStateDot: J0,
  InstructionsDialog: kg,
  MemoryDialog: Tg,
  NewSessionMenu: Sg,
  PlusIcon: Fd,
  Select: Eg,
  SessionDot: yg,
  SessionMenu: _g,
  Slot: xg,
  WorktreeMenu: jg,
  agentStateColor: ug,
  beginReorderDrag: Ag,
  buttonClass: ag,
  cn: Qe,
  ghostButton: rg,
  iconButton: og,
  isMac: P0,
  keyLabel: tg,
  menuDividerClass: ig,
  menuItemClass: ng,
  menuPanel: G0,
  nestSessions: bg,
  pickFolder: dg,
  rowActionClass: lg,
  runCommand: sg,
  segmentClass: eg,
  startSession: cg,
  useAddProject: hg,
  useAddProjectRequest: vg,
  useHosts: mg,
  useNavigation: fg,
  useSessionFolders: pg,
  version: I0
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
//! `kit` is `{ div, image }` from `gpui-kit`; `files.icon(id, markup, color)` gives the element that draws an icon's
//! markup (`currentColor` as `color`; the mod's `perch-react` `Icon`), as gpui-kit's `svg()` and `image()` read
//! files through an asset source the host may not have. An icon does not follow a hover colour (it is drawn once
//! per colour it is described with).
const Ro = {
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
  Ro[n] = (i, u) => i[n](u);
const Yg = Object.keys(Ro);
function md(n, i) {
  for (const [u, s] of Object.entries(i)) {
    const c = Ro[u];
    if (!c) throw new Error(`the description key ${u} has no GPUI builder`);
    s != null && (n = c(n, s));
  }
  return n;
}
const wa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 });
function Mg(n, i, u) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || u)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const Og = (n) => n.style?.display !== "hidden";
function So(n, i, u, s, c = !1, f = !1, m = null, p = {}) {
  if (n.kind === "text") return n.text;
  f ||= n.style.opacity === 0 || n.style.visibility === "invisible", f && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0 }), m = n.style.text_color ?? m, p = { ...p };
  for (const x of ["text_size", "line_height", "whitespace"]) n.style[x] !== void 0 && (p[x] = n.style[x]);
  const w = new Set(n.events ?? []);
  let v;
  n.kind === "image" && !n.markup ? v = i.image(n.src) : v = i.div(), n.markup && (v = v.child(s.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const q = Mg(n, w, c);
  q && (v = v.id(q)), v = md(v, n.style);
  for (const x of ["hover", "focus", "active"]) n[x] && (v = v[x]((T) => md(T, n[x])));
  ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((x) => w.has(x)) && (v = v.on_mouse_down("left", (x, T) => {
    T.stop_propagation?.(), x.bounds && u.setBounds(n.id, x.bounds);
    const O = { ...wa(x), button: 0, buttons: 1, detail: x.click_count };
    u.dispatch(n.id, "pointerdown", { ...O, pointerType: "mouse" }), u.dispatch(n.id, "mousedown", O), T.notify();
  }), v = v.on_mouse_down("right", (x, T) => {
    T.stop_propagation?.(), x.bounds && u.setBounds(n.id, x.bounds), u.dispatch(n.id, "contextmenu", { ...wa(x), button: 2 }), T.notify();
  }), v = v.on_mouse_up("left", (x, T) => {
    T.stop_propagation?.();
    const O = { ...wa(x), button: 0 };
    u.dispatch(n.id, "pointerup", { ...O, pointerType: "mouse" }), u.dispatch(n.id, "mouseup", O), T.notify();
  }), v = v.on_click((x, T) => {
    u.dispatch(n.id, x.click_count === 2 && w.has("double_click") ? "dblclick" : "click", { detail: x.click_count, button: 0 }), T.notify();
  })), w.has("mouse_move") && (v = v.on_mouse_move((x, T) => {
    u.dispatch(n.id, "pointermove", { ...wa(x), pointerType: "mouse" }), T.notify();
  })), n.track_hover && (v = v.on_hover((x, T) => {
    u.hover(n.id, x), T.notify();
  })), c && (v = v.on_mouse_down_out((x, T) => {
    u.dispatch(u.document.body.id, "pointerdown", { ...wa(x), pointerType: "mouse" }), u.dispatch(u.document.body.id, "mousedown", wa(x)), T.notify();
  }));
  const y = p.whitespace === "nowrap" ? Rg(p) : null;
  let E = !n.range_name;
  for (const x of (n.children ?? []).filter(Og)) {
    let T = So(x, i, u, s, !1, f, m, p);
    const O = !E && (x.kind === "text" || !x.meta);
    if (O || x.kind === "text" && y) {
      let A = i.div();
      O && (A = A.id(n.range_name)), x.kind === "text" && y && (A = A.h(y)), T = A.child(T), E ||= O;
    }
    v = v.child(T);
  }
  return v;
}
function Rg(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function Gg(n, i, u, s) {
  let c = i.div().relative().size_full().child(So(n.root, i, u, s));
  for (const f of n.overlays) c = c.child(So(f, i, u, s, !0));
  return c;
}
const Qg = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }] };
export {
  Qg as NAMED_ELEMENTS,
  Hg as React,
  dh as SCHEMA,
  Yg as STYLE_KEYS,
  Gg as describeToGpui,
  Ug as jsxRuntime,
  Dg as mount,
  qg as reactDom,
  Bg as sdk
};
