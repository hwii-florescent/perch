function pd(n, i) {
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
class we extends Error {
}
const bp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), yp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), xp = /* @__PURE__ */ new Set(["first-child", "last-child", "root", ...bp]);
function mo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, s, u) => s ? String.fromCodePoint(parseInt(s, 16)) : u);
}
function ri(n, i) {
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
  if (s === i) throw new we(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [mo(n.slice(i, s)), s];
}
function wp(n, i) {
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
  throw new we(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function zo(n) {
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
function _p(n, i) {
  const s = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let u = !1;
  for (; i < n.length; ) {
    const c = n[i];
    if (c === "*") {
      s.tag = "*", i++, u = !0;
      continue;
    }
    if (c === ".") {
      const [m, f] = ri(n, i + 1);
      s.classes.push(m), i = f, u = !0;
      continue;
    }
    if (c === "#") {
      const [m, f] = ri(n, i + 1);
      s.id = m, i = f, u = !0;
      continue;
    }
    if (c === "[") {
      const m = n.indexOf("]", i);
      if (m < 0) throw new we(`unclosed [ in ${JSON.stringify(n)}`);
      const f = n.slice(i + 1, m).trim(), p = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(f);
      if (!p) throw new we(`cannot read the attribute selector [${f}]`);
      const w = p[3] ?? p[4] ?? p[5];
      s.attrs.push({ name: mo(p[1]).toLowerCase(), op: p[2] ?? null, value: w === void 0 ? null : mo(w) }), i = m + 1, u = !0;
      continue;
    }
    if (c === ":") {
      if (n[i + 1] === ":") throw new we(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [m, f] = ri(n, i + 1);
      i = f;
      const p = m.toLowerCase();
      if (n[i] === "(") {
        if (!yp.has(p)) throw new we(`:${p}() is not supported`);
        const w = wp(n, i + 1), v = n.slice(i + 1, w).trim();
        if (i = w + 1, p === "nth-child") {
          if (!/^\d+$/.test(v)) throw new we(`:nth-child(${v}) is not supported (only a number)`);
          s.pseudos.push({ name: p, n: Number(v) });
        } else
          s.pseudos.push({ name: p, list: zo(v).map(Eo) });
      } else {
        if (!xp.has(p)) throw new we(`:${p} is not supported`);
        s.pseudos.push({ name: p });
      }
      u = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !u) {
      const [m, f] = ri(n, i);
      s.tag = m.toLowerCase(), i = f, u = !0;
      continue;
    }
    break;
  }
  if (!u) throw new we(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [s, i];
}
function Eo(n) {
  const i = [];
  let s = 0, u = null;
  for (n = n.trim(); s < n.length; ) {
    const [c, m] = _p(n, s);
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
      if (p === "+" || p === "~") throw new we(`the ${p} combinator is not supported`);
      if (f) u = " ";
      else throw new we(`unexpected ${JSON.stringify(p)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new we("empty selector");
  return i;
}
const jc = /* @__PURE__ */ new Map();
function ko(n) {
  let i = jc.get(n);
  return i || (i = zo(n).map(Eo), jc.set(n, i)), i;
}
function hd(n) {
  const i = [0, 0, 0], s = (u) => {
    i[0] += u[0], i[1] += u[1], i[2] += u[2];
  };
  for (const { compound: u } of n) {
    u.id && i[0]++, i[1] += u.classes.length + u.attrs.length, u.tag && u.tag !== "*" && i[2]++;
    for (const c of u.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const m = c.list.map(hd).sort((f, p) => p[0] - f[0] || p[1] - f[1] || p[2] - f[2])[0];
          s(m);
        } else i[1]++;
  }
  return i;
}
function Sp(n, { name: i, op: s, value: u }) {
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
function ao(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function zp(n, i, s, u) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const c = n.classList ?? [];
    for (const m of i.classes) if (!c.includes(m)) return !1;
  }
  for (const c of i.attrs) if (!Sp(n, c)) return !1;
  for (const c of i.pseudos)
    switch (c.name) {
      case "first-child":
        if (ao(n)[0] !== n) return !1;
        break;
      case "last-child": {
        const m = ao(n);
        if (m[m.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (ao(n).indexOf(n) !== c.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((m) => _l(n, m, s, u))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((m) => _l(n, m, s, u))) return !1;
        break;
      default:
        if (!s.state || !s.state(n, c.name, u)) return !1;
    }
  return !0;
}
function _l(n, i, s, u = !0) {
  const c = (m, f, p) => {
    const { compound: w, combinator: v } = i[f];
    if (!zp(m, w, s, p)) return !1;
    if (f === 0) return !0;
    if (v === ">") return !!m.parentElement && c(m.parentElement, f - 1, !1);
    for (let q = m.parentElement; q; q = q.parentElement) if (c(q, f - 1, !1)) return !0;
    return !1;
  };
  return c(n, i.length - 1, u);
}
function Ep(n, i, s = {}) {
  return (typeof i == "string" ? ko(i) : i).some((c) => _l(n, c, s));
}
function kp(n, i, s = {}) {
  return _l(n, i, s);
}
function ln(n, i, s = {}) {
  const u = ko(i), c = [], m = (f) => {
    for (const p of f.children)
      u.some((w) => _l(p, w, s)) && c.push(p), m(p);
  };
  return m(n), c;
}
function gd(n, i, s = {}) {
  const u = ko(i);
  for (let c = n; c; c = c.parentElement) if (u.some((m) => _l(c, m, s))) return c;
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
let Np = 1;
class fo {
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
class No {
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
class _e extends No {
  constructor(i, s = {}, u = null) {
    super(), this.nodeType = 1, this.id = `n${Np++}`, this.tagName = i.toLowerCase(), this.props = s, this.childNodes = [], this.parentNode = null, this.ownerDocument = u, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return Ep(this, i);
  }
  closest(i) {
    return gd(this, i);
  }
  querySelectorAll(i) {
    return ln(this, i);
  }
  querySelector(i) {
    return ln(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.bounds;
    return i ? new fo(i.x, i.y, i.width, i.height) : new fo();
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
function Ac(n) {
  for (let i = n; i instanceof _e; i = i.parentElement) i.touch();
}
class Cp extends No {
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
    return ln(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
}
class jp extends No {
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
function vd(n) {
  return {
    setTimeout: (i, s = 0, ...u) => n.setTimeout(() => i(...u), Math.max(0, Number(s) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
function He(n, i, s) {
  Object.defineProperty(n, i, { value: s, configurable: !0, writable: !0, enumerable: !1 });
}
function Ap(n, i = globalThis) {
  const s = new Cp(n), u = new jp(n, s);
  s.defaultView = u;
  const c = n.storage ?? new Tp();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = vd(n);
    He(i, "setTimeout", f.setTimeout), He(i, "clearTimeout", f.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && He(i, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), He(i, "document", s), He(i, "window", u), He(i, "localStorage", c), He(i, "HTMLElement", _e), He(i, "Element", _e), He(i, "DOMRect", fo);
  const m = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      He(m, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || He(i, "navigator", m), { document: s, window: u };
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
var lo = { exports: {} }, nt = {};
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
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), u = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), m = Symbol.for("react.consumer"), f = Symbol.for("react.context"), p = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), v = Symbol.for("react.memo"), q = Symbol.for("react.lazy"), R = Symbol.for("react.activity"), y = Symbol.iterator;
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
  var lt = Array.isArray;
  function J() {
  }
  var N = { H: null, A: null, T: null, S: null }, k = Object.prototype.hasOwnProperty;
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
  function ft(g, M) {
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
  function kt(g) {
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
      return W = W(g), gt = L === "" ? "." + Jt(g, 0) : L, lt(W) ? (I = "", gt != null && (I = gt.replace(Mt, "$&/") + "/"), H(W, M, I, "", function(ka) {
        return ka;
      })) : W != null && (wt(W) && (W = ft(
        W,
        I + (W.key == null || g && g.key === W.key ? "" : ("" + W.key).replace(
          Mt,
          "$&/"
        ) + "/") + gt
      )), M.push(W)), 1;
    gt = 0;
    var Vt = L === "" ? "." : L + ":";
    if (lt(g))
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
          kt(g),
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
  return nt.Activity = R, nt.Children = B, nt.Component = A, nt.Fragment = s, nt.Profiler = c, nt.PureComponent = G, nt.StrictMode = u, nt.Suspense = w, nt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = N, nt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(g) {
      return N.H.useMemoCache(g);
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
        !k.call(M, $) || $ === "key" || $ === "__self" || $ === "__source" || $ === "ref" && M.ref === void 0 || (L[$] = M[$]);
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
      $$typeof: f,
      _currentValue: g,
      _currentValue2: g,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, g.Provider = g, g.Consumer = {
      $$typeof: m,
      _context: g
    }, g;
  }, nt.createElement = function(g, M, I) {
    var L, W = {}, $ = null;
    if (M != null)
      for (L in M.key !== void 0 && ($ = "" + M.key), M)
        k.call(M, L) && L !== "key" && L !== "__self" && L !== "__source" && (W[L] = M[L]);
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
    var M = N.T, I = {};
    N.T = I;
    try {
      var L = g(), W = N.S;
      W !== null && W(I, L), typeof L == "object" && L !== null && typeof L.then == "function" && L.then(J, it);
    } catch ($) {
      it($);
    } finally {
      M !== null && I.types !== null && (M.types = I.types), N.T = M;
    }
  }, nt.unstable_useCacheRefresh = function() {
    return N.H.useCacheRefresh();
  }, nt.use = function(g) {
    return N.H.use(g);
  }, nt.useActionState = function(g, M, I) {
    return N.H.useActionState(g, M, I);
  }, nt.useCallback = function(g, M) {
    return N.H.useCallback(g, M);
  }, nt.useContext = function(g) {
    return N.H.useContext(g);
  }, nt.useDebugValue = function() {
  }, nt.useDeferredValue = function(g, M) {
    return N.H.useDeferredValue(g, M);
  }, nt.useEffect = function(g, M) {
    return N.H.useEffect(g, M);
  }, nt.useEffectEvent = function(g) {
    return N.H.useEffectEvent(g);
  }, nt.useId = function() {
    return N.H.useId();
  }, nt.useImperativeHandle = function(g, M, I) {
    return N.H.useImperativeHandle(g, M, I);
  }, nt.useInsertionEffect = function(g, M) {
    return N.H.useInsertionEffect(g, M);
  }, nt.useLayoutEffect = function(g, M) {
    return N.H.useLayoutEffect(g, M);
  }, nt.useMemo = function(g, M) {
    return N.H.useMemo(g, M);
  }, nt.useOptimistic = function(g, M) {
    return N.H.useOptimistic(g, M);
  }, nt.useReducer = function(g, M, I) {
    return N.H.useReducer(g, M, I);
  }, nt.useRef = function(g) {
    return N.H.useRef(g);
  }, nt.useState = function(g) {
    return N.H.useState(g);
  }, nt.useSyncExternalStore = function(g, M, I) {
    return N.H.useSyncExternalStore(
      g,
      M,
      I
    );
  }, nt.useTransition = function() {
    return N.H.useTransition();
  }, nt.version = "19.2.8", nt;
}
var Rc;
function bd() {
  return Rc || (Rc = 1, lo.exports = Mp()), lo.exports;
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
  return tn.Fragment = i, tn.jsx = s, tn.jsxs = s, tn;
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
var io = { exports: {} }, ro = { exports: {} }, oo = { exports: {} }, so = {};
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
    function s(H) {
      return H.length === 0 ? null : H[0];
    }
    function u(H) {
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
    var w = [], v = [], q = 1, R = null, y = 3, E = !1, x = !1, T = !1, O = !1, A = typeof setTimeout == "function" ? setTimeout : null, j = typeof clearTimeout == "function" ? clearTimeout : null, G = typeof setImmediate < "u" ? setImmediate : null;
    function V(H) {
      for (var F = s(v); F !== null; ) {
        if (F.callback === null) u(v);
        else if (F.startTime <= H)
          u(v), F.sortIndex = F.expirationTime, i(w, F);
        else break;
        F = s(v);
      }
    }
    function lt(H) {
      if (T = !1, V(H), !x)
        if (s(w) !== null)
          x = !0, J || (J = !0, zt());
        else {
          var F = s(v);
          F !== null && kt(lt, F.startTime - H);
        }
    }
    var J = !1, N = -1, k = 5, Q = -1;
    function ft() {
      return O ? !0 : !(n.unstable_now() - Q < k);
    }
    function wt() {
      if (O = !1, J) {
        var H = n.unstable_now();
        Q = H;
        var F = !0;
        try {
          t: {
            x = !1, T && (T = !1, j(N), N = -1), E = !0;
            var et = y;
            try {
              e: {
                for (V(H), R = s(w); R !== null && !(R.expirationTime > H && ft()); ) {
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
                    R === s(w) && u(w), V(H);
                  } else u(w);
                  R = s(w);
                }
                if (R !== null) F = !0;
                else {
                  var g = s(v);
                  g !== null && kt(
                    lt,
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
    function kt(H, F) {
      N = A(function() {
        H(n.unstable_now());
      }, F);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(H) {
      H.callback = null;
    }, n.unstable_forceFrameRate = function(H) {
      0 > H || 125 < H ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : k = 0 < H ? Math.floor(1e3 / H) : 5;
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
      }, et > it ? (H.sortIndex = et, i(v, H), s(w) === null && H === s(v) && (T ? (j(N), N = -1) : T = !0, kt(lt, et - it))) : (H.sortIndex = B, i(w, H), x || E || (x = !0, J || (J = !0, zt()))), H;
    }, n.unstable_shouldYield = ft, n.unstable_wrapCallback = function(H) {
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
  })(so)), so;
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
      function s(t, e, a, l) {
        return new _m(t, e, a, l);
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
        return t === null || typeof t != "object" ? null : (t = Wu && t[Wu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function R(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Nm ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case el:
            return "Fragment";
          case _r:
            return "Profiler";
          case Ju:
            return "StrictMode";
          case zr:
            return "Suspense";
          case Er:
            return "SuspenseList";
          case Nr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case tl:
              return "Portal";
            case fa:
              return t.displayName || "Context";
            case Lu:
              return (t._context.displayName || "Context") + ".Consumer";
            case Sr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case kr:
              return e = t.displayName || null, e !== null ? e : R(t.type) || "Memo";
            case pa:
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
        0 > nl || (t.current = Or[nl], Or[nl] = null, nl--);
      }
      function x(t, e) {
        nl++, Or[nl] = t.current, t.current = e;
      }
      function T(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (ap(t) / lp | 0) | 0;
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
      function A(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, o = t.suspendedLanes, d = t.pingedLanes;
        t = t.warmLanes;
        var h = l & 134217727;
        return h !== 0 ? (l = h & ~o, l !== 0 ? r = O(l) : (d &= h, d !== 0 ? r = O(d) : a || (a = h & ~t, a !== 0 && (r = O(a))))) : (h = l & ~o, h !== 0 ? r = O(h) : d !== 0 ? r = O(d) : a || (a = l & ~t, a !== 0 && (r = O(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & o) === 0 && (o = r & -r, a = e & -e, o >= a || o === 32 && (a & 4194048) !== 0) ? e : r;
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
      function lt(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function J(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function N(t, e, a, l, r, o) {
        var d = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var h = t.entanglements, z = t.expirationTimes, C = t.hiddenUpdates;
        for (a = d & ~a; 0 < a; ) {
          var Y = 31 - pe(a), U = 1 << Y;
          h[Y] = 0, z[Y] = -1;
          var K = C[Y];
          if (K !== null)
            for (C[Y] = null, Y = 0; Y < K.length; Y++) {
              var ot = K[Y];
              ot !== null && (ot.lane &= -536870913);
            }
          a &= ~U;
        }
        l !== 0 && k(t, l, 0), o !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= o & ~(d & ~e));
      }
      function k(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var l = 31 - pe(e);
        t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | a & 261930;
      }
      function Q(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var l = 31 - pe(a), r = 1 << l;
          r & e | t[l] & e && (t[l] |= e), a &= ~r;
        }
      }
      function ft(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : wt(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
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
        if (typeof sp == "function" && up(t), he && typeof he.setStrictMode == "function")
          try {
            he.setStrictMode(Ql, t);
          } catch {
          }
      }
      function Jt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function kt(t) {
        if (Ur === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Ur = e && e[1] || "", wc = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Ur + t + wc;
      }
      function H(t, e) {
        if (!t || Dr) return "";
        Dr = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var l = {
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
            var z = d.split(`
`), C = h.split(`
`);
            for (r = l = 0; l < z.length && !z[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < C.length && !C[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === z.length || r === C.length)
              for (l = z.length - 1, r = C.length - 1; 1 <= l && 0 <= r && z[l] !== C[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (z[l] !== C[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || z[l] !== C[r]) {
                      var Y = `
` + z[l].replace(" at new ", " at ");
                      return t.displayName && Y.includes("<anonymous>") && (Y = Y.replace("<anonymous>", t.displayName)), Y;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          Dr = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? kt(a) : "";
      }
      function F(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return kt(t.type);
          case 16:
            return kt("Lazy");
          case 13:
            return t.child !== e && e !== null ? kt("Suspense Fallback") : kt("Suspense");
          case 19:
            return kt("SuspenseList");
          case 0:
          case 15:
            return H(t.type, !1);
          case 11:
            return H(t.type.render, !1);
          case 1:
            return H(t.type, !0);
          case 31:
            return kt("Activity");
          default:
            return "";
        }
      }
      function et(t) {
        try {
          var e = "", a = null;
          do
            e += F(t, a), a = t, t = t.return;
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
          var a = _c.get(t);
          return a !== void 0 ? a : (e = {
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
        rl[ol++] = Vl, rl[ol++] = Vn, Vn = t, Vl = e;
      }
      function g(t, e, a) {
        Se[ze++] = Be, Se[ze++] = Ye, Se[ze++] = ha, ha = t;
        var l = Be;
        t = Ye;
        var r = 32 - pe(l) - 1;
        l &= ~(1 << r), a += 1;
        var o = 32 - pe(e) + r;
        if (30 < o) {
          var d = r - r % 5;
          o = (l & (1 << d) - 1).toString(32), l >>= d, r -= d, Be = 1 << 32 - pe(e) + r | a << r | l, Ye = o + t;
        } else
          Be = 1 << o | a << r | l, Ye = t;
      }
      function M(t) {
        t.return !== null && (B(t, 1), g(t, 1, 0));
      }
      function I(t) {
        for (; t === Vn; )
          Vn = rl[--ol], rl[ol] = null, Vl = rl[--ol], rl[ol] = null;
        for (; t === ha; )
          ha = Se[--ze], Se[ze] = null, Ye = Se[--ze], Se[ze] = null, Be = Se[--ze], Se[ze] = null;
      }
      function L(t, e) {
        Se[ze++] = Be, Se[ze++] = Ye, Se[ze++] = ha, Be = e.id, Ye = e.overflow, ha = t;
      }
      function W(t, e) {
        x(ga, e), x(Kl, t), x(Ft, null), t = jm(e), E(Ft), x(Ft, t);
      }
      function $() {
        E(Ft), E(Kl), E(ga);
      }
      function gt(t) {
        t.memoizedState !== null && x(Kn, t);
        var e = Ft.current, a = Am(e, t.type);
        e !== a && (x(Kl, t), x(Ft, a));
      }
      function Vt(t) {
        Kl.current === t && (E(Ft), E(Kl)), Kn.current === t && (E(Kn), We ? Ua._currentValue = al : Ua._currentValue2 = al);
      }
      function rt(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw zl(it(e, t)), qr;
      }
      function ka(t, e) {
        if (!ae) throw Error(c(175));
        Mf(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || rt(t, !0);
      }
      function Na(t) {
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
        if (!ae || t !== It) return !1;
        if (!ht) return Na(t), ht = !0, !1;
        var e = t.tag;
        if (Yt ? e !== 3 && e !== 27 && (e !== 5 || sc(t.type) && !qn(t.type, t.memoizedProps)) && Nt && rt(t) : e !== 3 && (e !== 5 || sc(t.type) && !qn(t.type, t.memoizedProps)) && Nt && rt(t), Na(t), e === 13) {
          if (!ae) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Nt = Df(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Nt = Uf(t);
        } else
          Nt = Yt && e === 27 ? _f(
            t.type,
            Nt
          ) : It ? oc(t.stateNode) : null;
        return !0;
      }
      function Ce() {
        ae && (Nt = It = null, ht = !1);
      }
      function ia() {
        var t = va;
        return t !== null && (se === null ? se = t : se.push.apply(
          se,
          t
        ), va = null), t;
      }
      function zl(t) {
        va === null ? va = [t] : va.push(t);
      }
      function ra(t, e, a) {
        We ? (x(Xn, e._currentValue), e._currentValue = a) : (x(Xn, e._currentValue2), e._currentValue2 = a);
      }
      function Ve(t) {
        var e = Xn.current;
        We ? t._currentValue = e : t._currentValue2 = e, E(Xn);
      }
      function yi(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function xi(t, e, a, l) {
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
                  o.lanes |= a, h = o.alternate, h !== null && (h.lanes |= a), yi(
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
            d.lanes |= a, o = d.alternate, o !== null && (o.lanes |= a), yi(d, a, t), d = null;
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
      function La(t, e, a, l) {
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
            d.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ua) : t = [Ua]);
          }
          r = r.return;
        }
        t !== null && xi(
          e,
          t,
          a,
          l
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
      function Ta(t) {
        Da = t, Ie = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Lt(t) {
        return Ho(Da, t);
      }
      function sn(t, e) {
        return Da === null && Ta(t), Ho(t, e);
      }
      function Ho(t, e) {
        var a = We ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, Ie === null) {
          if (t === null) throw Error(c(308));
          Ie = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else Ie = Ie.next = e;
        return a;
      }
      function wi() {
        return {
          controller: new dp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function El(t) {
        t.refCount--, t.refCount === 0 && mp(fp, function() {
          t.controller.abort();
        });
      }
      function un() {
      }
      function Ue(t) {
        t !== sl && t.next === null && (sl === null ? Zn = sl = t : sl = sl.next = t), Jn = !0, Br || (Br = !0, $d());
      }
      function Wa(t, e) {
        if (!Yr && Jn) {
          Yr = !0;
          do
            for (var a = !1, l = Zn; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var o = 0;
                else {
                  var d = l.suspendedLanes, h = l.pingedLanes;
                  o = (1 << 31 - pe(42 | t) + 1) - 1, o &= r & ~(d & ~h), o = o & 201326741 ? o & 201326741 | 1 : o ? o | 2 : 0;
                }
                o !== 0 && (a = !0, Yo(l, o));
              } else
                o = pt, o = A(
                  l,
                  l === St ? o : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Ha
                ), (o & 3) === 0 || j(l, o) || (a = !0, Yo(l, o));
              l = l.next;
            }
          while (a);
          Yr = !1;
        }
      }
      function Uo() {
        Do();
      }
      function Do() {
        Jn = Br = !1;
        var t = 0;
        qa !== 0 && Ym() && (t = qa);
        for (var e = re(), a = null, l = Zn; l !== null; ) {
          var r = l.next, o = qo(l, e);
          o === 0 ? (l.next = null, a === null ? Zn = r : a.next = r, r === null && (sl = a)) : (a = l, (t !== 0 || (o & 3) !== 0) && (Jn = !0)), l = r;
        }
        Gt !== 0 && Gt !== 5 || Wa(t), qa !== 0 && (qa = 0);
      }
      function qo(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, o = t.pendingLanes & -62914561; 0 < o; ) {
          var d = 31 - pe(o), h = 1 << d, z = r[d];
          z === -1 ? ((h & a) === 0 || (h & l) !== 0) && (r[d] = G(h, e)) : z <= e && (t.expiredLanes |= h), o &= ~h;
        }
        if (e = St, a = pt, a = A(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Ha
        ), l = t.callbackNode, a === 0 || t === e && (xt === 2 || xt === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && Rr(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || j(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && Rr(l), zt(a)) {
            case 2:
            case 8:
              a = rp;
              break;
            case 32:
              a = Hr;
              break;
            case 268435456:
              a = op;
              break;
            default:
              a = Hr;
          }
          return l = Bo.bind(null, t), a = Qn(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && Rr(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Bo(t, e) {
        if (Gt !== 0 && Gt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (ql() && t.callbackNode !== a)
          return null;
        var l = pt;
        return l = A(
          t,
          t === St ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Ha
        ), l === 0 ? null : (_u(t, l, e), qo(t, re()), t.callbackNode != null && t.callbackNode === a ? Bo.bind(null, t) : null);
      }
      function Yo(t, e) {
        if (ql()) return null;
        _u(t, e, !0);
      }
      function $d() {
        Jm ? Lm(function() {
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
        if (qa === 0) {
          var t = ul;
          t === 0 && (t = Bn, Bn <<= 1, (Bn & 261888) === 0 && (Bn = 256)), qa = t;
        }
        return qa;
      }
      function Pd(t, e) {
        if (Xl === null) {
          var a = Xl = [];
          Gr = 0, ul = _i(), cl = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return Gr++, e.then(Go, Go), e;
      }
      function Go() {
        if (--Gr === 0 && Xl !== null) {
          cl !== null && (cl.status = "fulfilled");
          var t = Xl;
          Xl = null, ul = 0, cl = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function tm(t, e) {
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
      function Si() {
        var t = Ba.current;
        return t !== null ? t : St.pooledCache;
      }
      function cn(t, e) {
        e === null ? x(Ba, Ba.current) : x(Ba, e.pool);
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
        var a = Object.keys(t), l = Object.keys(e);
        if (a.length !== l.length) return !1;
        for (l = 0; l < a.length; l++) {
          var r = a[l];
          if (!cp.call(e, r) || !ge(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function Vo(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ko(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(un, un), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Zo(t), t;
          default:
            if (typeof e.status == "string") e.then(un, un);
            else {
              if (t = St, t !== null && 100 < t.shellSuspendCounter)
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
                throw t = e.reason, Zo(t), t;
            }
            throw Ya = e, dl;
        }
      }
      function Ca(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ya = a, dl) : a;
        }
      }
      function Xo() {
        if (Ya === null) throw Error(c(459));
        var t = Ya;
        return Ya = null, t;
      }
      function Zo(t) {
        if (t === dl || t === Ln)
          throw Error(c(483));
      }
      function mn(t) {
        var e = Zl;
        return Zl += 1, ml === null && (ml = []), Ko(ml, t, e);
      }
      function kl(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function fn(t, e) {
        throw e.$$typeof === Em ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
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
        function a(_, b) {
          if (!t) return null;
          for (; b !== null; )
            e(_, b), b = b.sibling;
          return null;
        }
        function l(_) {
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
          return tt === el ? Y(
            _,
            b,
            S.props.children,
            D,
            S.key
          ) : b !== null && (b.elementType === tt || typeof tt == "object" && tt !== null && tt.$$typeof === pa && Ca(tt) === b.type) ? (b = r(b, S.props), kl(b, S), b.return = _, b) : (b = Hn(
            S.type,
            S.key,
            S.props,
            null,
            _.mode,
            D
          ), kl(b, S), b.return = _, b);
        }
        function C(_, b, S, D) {
          return b === null || b.tag !== 4 || b.stateNode.containerInfo !== S.containerInfo || b.stateNode.implementation !== S.implementation ? (b = yr(S, _.mode, D), b.return = _, b) : (b = r(b, S.children || []), b.return = _, b);
        }
        function Y(_, b, S, D, tt) {
          return b === null || b.tag !== 7 ? (b = Ra(
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
                ), kl(S, b), S.return = _, S;
              case tl:
                return b = yr(
                  b,
                  _.mode,
                  S
                ), b.return = _, b;
              case pa:
                return b = Ca(b), U(_, b, S);
            }
            if (Dn(b) || q(b))
              return b = Ra(
                b,
                _.mode,
                S,
                null
              ), b.return = _, b;
            if (typeof b.then == "function")
              return U(_, mn(b), S);
            if (b.$$typeof === fa)
              return U(
                _,
                sn(_, b),
                S
              );
            fn(_, b);
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
              case tl:
                return S.key === tt ? C(_, b, S, D) : null;
              case pa:
                return S = Ca(S), K(_, b, S, D);
            }
            if (Dn(S) || q(S))
              return tt !== null ? null : Y(_, b, S, D, null);
            if (typeof S.then == "function")
              return K(
                _,
                b,
                mn(S),
                D
              );
            if (S.$$typeof === fa)
              return K(
                _,
                b,
                sn(_, S),
                D
              );
            fn(_, S);
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
              case tl:
                return _ = _.get(
                  D.key === null ? S : D.key
                ) || null, C(b, _, D, tt);
              case pa:
                return D = Ca(D), ot(
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
                mn(D),
                tt
              );
            if (D.$$typeof === fa)
              return ot(
                _,
                b,
                S,
                sn(b, D),
                tt
              );
            fn(b, D);
          }
          return null;
        }
        function $t(_, b, S, D) {
          for (var tt = null, Ct = null, at = b, bt = b = 0, Zt = null; at !== null && bt < S.length; bt++) {
            at.index > bt ? (Zt = at, at = null) : Zt = at.sibling;
            var yt = K(
              _,
              at,
              S[bt],
              D
            );
            if (yt === null) {
              at === null && (at = Zt);
              break;
            }
            t && at && yt.alternate === null && e(_, at), b = o(yt, b, bt), Ct === null ? tt = yt : Ct.sibling = yt, Ct = yt, at = Zt;
          }
          if (bt === S.length)
            return a(_, at), ht && B(_, bt), tt;
          if (at === null) {
            for (; bt < S.length; bt++)
              at = U(_, S[bt], D), at !== null && (b = o(
                at,
                b,
                bt
              ), Ct === null ? tt = at : Ct.sibling = at, Ct = at);
            return ht && B(_, bt), tt;
          }
          for (at = l(at); bt < S.length; bt++)
            Zt = ot(
              at,
              _,
              bt,
              S[bt],
              D
            ), Zt !== null && (t && Zt.alternate !== null && at.delete(
              Zt.key === null ? bt : Zt.key
            ), b = o(
              Zt,
              b,
              bt
            ), Ct === null ? tt = Zt : Ct.sibling = Zt, Ct = Zt);
          return t && at.forEach(function(Sa) {
            return e(_, Sa);
          }), ht && B(_, bt), tt;
        }
        function Pl(_, b, S, D) {
          if (S == null) throw Error(c(151));
          for (var tt = null, Ct = null, at = b, bt = b = 0, Zt = null, yt = S.next(); at !== null && !yt.done; bt++, yt = S.next()) {
            at.index > bt ? (Zt = at, at = null) : Zt = at.sibling;
            var Sa = K(_, at, yt.value, D);
            if (Sa === null) {
              at === null && (at = Zt);
              break;
            }
            t && at && Sa.alternate === null && e(_, at), b = o(Sa, b, bt), Ct === null ? tt = Sa : Ct.sibling = Sa, Ct = Sa, at = Zt;
          }
          if (yt.done)
            return a(_, at), ht && B(_, bt), tt;
          if (at === null) {
            for (; !yt.done; bt++, yt = S.next())
              yt = U(_, yt.value, D), yt !== null && (b = o(
                yt,
                b,
                bt
              ), Ct === null ? tt = yt : Ct.sibling = yt, Ct = yt);
            return ht && B(_, bt), tt;
          }
          for (at = l(at); !yt.done; bt++, yt = S.next())
            yt = ot(
              at,
              _,
              bt,
              yt.value,
              D
            ), yt !== null && (t && yt.alternate !== null && at.delete(yt.key === null ? bt : yt.key), b = o(yt, b, bt), Ct === null ? tt = yt : Ct.sibling = yt, Ct = yt);
          return t && at.forEach(function(vp) {
            return e(_, vp);
          }), ht && B(_, bt), tt;
        }
        function Ka(_, b, S, D) {
          if (typeof S == "object" && S !== null && S.type === el && S.key === null && (S = S.props.children), typeof S == "object" && S !== null) {
            switch (S.$$typeof) {
              case Un:
                t: {
                  for (var tt = S.key; b !== null; ) {
                    if (b.key === tt) {
                      if (tt = S.type, tt === el) {
                        if (b.tag === 7) {
                          a(
                            _,
                            b.sibling
                          ), D = r(
                            b,
                            S.props.children
                          ), D.return = _, _ = D;
                          break t;
                        }
                      } else if (b.elementType === tt || typeof tt == "object" && tt !== null && tt.$$typeof === pa && Ca(tt) === b.type) {
                        a(
                          _,
                          b.sibling
                        ), D = r(b, S.props), kl(D, S), D.return = _, _ = D;
                        break t;
                      }
                      a(_, b);
                      break;
                    } else e(_, b);
                    b = b.sibling;
                  }
                  S.type === el ? (D = Ra(
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
                  ), kl(D, S), D.return = _, _ = D);
                }
                return d(_);
              case tl:
                t: {
                  for (tt = S.key; b !== null; ) {
                    if (b.key === tt)
                      if (b.tag === 4 && b.stateNode.containerInfo === S.containerInfo && b.stateNode.implementation === S.implementation) {
                        a(
                          _,
                          b.sibling
                        ), D = r(
                          b,
                          S.children || []
                        ), D.return = _, _ = D;
                        break t;
                      } else {
                        a(_, b);
                        break;
                      }
                    else e(_, b);
                    b = b.sibling;
                  }
                  D = yr(S, _.mode, D), D.return = _, _ = D;
                }
                return d(_);
              case pa:
                return S = Ca(S), Ka(
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
              return S = tt.call(S), Pl(
                _,
                b,
                S,
                D
              );
            }
            if (typeof S.then == "function")
              return Ka(
                _,
                b,
                mn(S),
                D
              );
            if (S.$$typeof === fa)
              return Ka(
                _,
                b,
                sn(_, S),
                D
              );
            fn(_, S);
          }
          return typeof S == "string" && S !== "" || typeof S == "number" || typeof S == "bigint" ? (S = "" + S, b !== null && b.tag === 6 ? (a(_, b.sibling), D = r(b, S), D.return = _, _ = D) : (a(_, b), D = br(S, _.mode, D), D.return = _, _ = D), d(_)) : a(_, b);
        }
        return function(_, b, S, D) {
          try {
            Zl = 0;
            var tt = Ka(
              _,
              b,
              S,
              D
            );
            return ml = null, tt;
          } catch (at) {
            if (at === dl || at === Ln) throw at;
            var Ct = s(29, at, null, _.mode);
            return Ct.lanes = D, Ct.return = _, Ct;
          } finally {
          }
        };
      }
      function pn() {
        for (var t = fl, e = Vr = fl = 0; e < t; ) {
          var a = ke[e];
          ke[e++] = null;
          var l = ke[e];
          ke[e++] = null;
          var r = ke[e];
          ke[e++] = null;
          var o = ke[e];
          if (ke[e++] = null, l !== null && r !== null) {
            var d = l.pending;
            d === null ? r.next = r : (r.next = d.next, d.next = r), l.pending = r;
          }
          o !== 0 && Lo(a, r, o);
        }
      }
      function hn(t, e, a, l) {
        ke[fl++] = t, ke[fl++] = e, ke[fl++] = a, ke[fl++] = l, Vr |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function zi(t, e, a, l) {
        return hn(t, e, a, l), gn(t);
      }
      function ja(t, e) {
        return hn(t, null, null, e), gn(t);
      }
      function Lo(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, o = t.return; o !== null; )
          o.childLanes |= a, l = o.alternate, l !== null && (l.childLanes |= a), o.tag === 22 && (t = o.stateNode, t === null || t._visibility & 1 || (r = !0)), t = o, o = o.return;
        return t.tag === 3 ? (o = t.stateNode, r && e !== null && (r = 31 - pe(a), t = o.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), o) : null;
      }
      function gn(t) {
        if (50 < $l)
          throw $l = 0, eo = null, Error(c(185));
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
      function ki(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function oa(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function sa(t, e, a) {
        var l = t.updateQueue;
        if (l === null) return null;
        if (l = l.shared, (dt & 2) !== 0) {
          var r = l.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = gn(t), Lo(t, null, a), e;
        }
        return hn(t, l, e, a), gn(t);
      }
      function Nl(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, Q(t, a);
        }
      }
      function Ni(t, e) {
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
      function Tl() {
        if (Kr) {
          var t = cl;
          if (t !== null) throw t;
        }
      }
      function Cl(t, e, a, l) {
        Kr = !1;
        var r = t.updateQueue;
        ba = !1;
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
            if (ot ? (pt & K) === K : (l & K) === K) {
              K !== 0 && K === ul && (Kr = !0), Y !== null && (Y = Y.next = {
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: null,
                next: null
              });
              t: {
                var $t = t, Pl = h;
                K = e;
                var Ka = a;
                switch (Pl.tag) {
                  case 1:
                    if ($t = Pl.payload, typeof $t == "function") {
                      U = $t.call(
                        Ka,
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
                    if ($t = Pl.payload, K = typeof $t == "function" ? $t.call(Ka, U, K) : $t, K == null) break t;
                    U = wr({}, U, K);
                    break t;
                  case 2:
                    ba = !0;
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
          Y === null && (z = U), r.baseState = z, r.firstBaseUpdate = C, r.lastBaseUpdate = Y, o === null && (r.shared.lanes = 0), xa |= d, t.lanes = d, t.memoizedState = U;
        }
      }
      function Wo(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function Fo(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Wo(a[t], e);
      }
      function Io(t, e) {
        t = ta, x(Fn, t), x(pl, e), ta = t | e.baseLanes;
      }
      function Ti() {
        x(Fn, ta), x(pl, pl.current);
      }
      function Ci() {
        ta = Fn.current, E(pl), E(Fn);
      }
      function ua(t) {
        var e = t.alternate;
        x(Rt, Rt.current & 1), x(ve, t), Ne === null && (e === null || pl.current !== null || e.memoizedState !== null) && (Ne = t);
      }
      function ji(t) {
        x(Rt, Rt.current), x(ve, t), Ne === null && (Ne = t);
      }
      function $o(t) {
        t.tag === 22 ? (x(Rt, Rt.current), x(ve, t), Ne === null && (Ne = t)) : ca();
      }
      function ca() {
        x(Rt, Rt.current), x(ve, ve.current);
      }
      function de(t) {
        E(ve), Ne === t && (Ne = null), E(Rt);
      }
      function vn(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || jr(a) || Ar(a)))
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
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ge(t[a], e[a])) return !1;
        return !0;
      }
      function Mi(t, e, a, l, r, o) {
        return $e = o, st = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, P.H = t === null || t.memoizedState === null ? Ec : Xr, Qa = !1, o = a(l, r), Qa = !1, hl && (o = ts(
          e,
          a,
          l,
          r
        )), Po(t), o;
      }
      function Po(t) {
        P.H = Ll;
        var e = _t !== null && _t.next !== null;
        if ($e = 0, Ut = _t = st = null, In = !1, Jl = 0, gl = null, e) throw Error(c(300));
        t === null || Dt || (t = t.dependencies, t !== null && on(t) && (Dt = !0));
      }
      function ts(t, e, a, l) {
        st = t;
        var r = 0;
        do {
          if (hl && (gl = null), Jl = 0, hl = !1, 25 <= r) throw Error(c(301));
          if (r += 1, Ut = _t = null, t.updateQueue != null) {
            var o = t.updateQueue;
            o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
          }
          P.H = kc, o = e(a, l);
        } while (hl);
        return o;
      }
      function em() {
        var t = P.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? jl(e) : e, t = t.useState()[0], (_t !== null ? _t.memoizedState : null) !== t && (st.flags |= 1024), e;
      }
      function Oi() {
        var t = $n !== 0;
        return $n = 0, t;
      }
      function Ri(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Hi(t) {
        if (In) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          In = !1;
        }
        $e = 0, Ut = _t = st = null, hl = !1, Jl = $n = 0, gl = null;
      }
      function le() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Ut === null ? st.memoizedState = Ut = t : Ut = Ut.next = t, Ut;
      }
      function Ot() {
        if (_t === null) {
          var t = st.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = _t.next;
        var e = Ut === null ? st.memoizedState : Ut.next;
        if (e !== null)
          Ut = e, _t = t;
        else {
          if (t === null)
            throw st.alternate === null ? Error(c(467)) : Error(c(310));
          _t = t, t = {
            memoizedState: _t.memoizedState,
            baseState: _t.baseState,
            baseQueue: _t.baseQueue,
            queue: _t.queue,
            next: null
          }, Ut === null ? st.memoizedState = Ut = t : Ut = Ut.next = t;
        }
        return Ut;
      }
      function bn() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function jl(t) {
        var e = Jl;
        return Jl += 1, gl === null && (gl = []), t = Ko(gl, t, e), e = st, (Ut === null ? e.memoizedState : Ut.next) === null && (e = e.alternate, P.H = e === null || e.memoizedState === null ? Ec : Xr), t;
      }
      function yn(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return jl(t);
          if (t.$$typeof === fa) return Lt(t);
        }
        throw Error(c(438, String(t)));
      }
      function Ui(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = bn(), st.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = km;
        return e.index++, a;
      }
      function Ke(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function xn(t) {
        var e = Ot();
        return Di(e, _t, t);
      }
      function Di(t, e, a) {
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
                }), U === ul && (Y = !0);
              else if (($e & K) === K) {
                C = C.next, K === ul && (Y = !0);
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
                }, z === null ? (h = z = U, d = o) : z = z.next = U, st.lanes |= K, xa |= K;
              U = C.action, Qa && a(o, U), o = C.hasEagerState ? C.eagerState : a(o, U);
            } else
              K = {
                lane: U,
                revertLane: C.revertLane,
                gesture: C.gesture,
                action: C.action,
                hasEagerState: C.hasEagerState,
                eagerState: C.eagerState,
                next: null
              }, z === null ? (h = z = K, d = o) : z = z.next = K, st.lanes |= U, xa |= U;
            C = C.next;
          } while (C !== null && C !== e);
          if (z === null ? d = o : z.next = h, !ge(o, t.memoizedState) && (Dt = !0, Y && (a = cl, a !== null)))
            throw a;
          t.memoizedState = o, t.baseState = d, t.baseQueue = z, l.lastRenderedState = o;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function qi(t) {
        var e = Ot(), a = e.queue;
        if (a === null) throw Error(c(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, o = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var d = r = r.next;
          do
            o = t(o, d.action), d = d.next;
          while (d !== r);
          ge(o, e.memoizedState) || (Dt = !0), e.memoizedState = o, e.baseQueue === null && (e.baseState = o), a.lastRenderedState = o;
        }
        return [o, l];
      }
      function es(t, e, a) {
        var l = st, r = Ot(), o = ht;
        if (o) {
          if (a === void 0)
            throw Error(c(407));
          a = a();
        } else a = e();
        var d = !ge(
          (_t || r).memoizedState,
          a
        );
        if (d && (r.memoizedState = a, Dt = !0), r = r.queue, Gi(ns.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || d || Ut !== null && Ut.memoizedState.tag & 1) {
          if (l.flags |= 2048, Fa(
            9,
            { destroy: void 0 },
            ls.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), St === null) throw Error(c(349));
          o || ($e & 127) !== 0 || as(l, e, a);
        }
        return a;
      }
      function as(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = st.updateQueue, e === null ? (e = bn(), st.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function ls(t, e, a, l) {
        e.value = a, e.getSnapshot = l, is(e) && rs(t);
      }
      function ns(t, e, a) {
        return a(function() {
          is(e) && rs(t);
        });
      }
      function is(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ge(t, a);
        } catch {
          return !0;
        }
      }
      function rs(t) {
        var e = ja(t, 2);
        e !== null && ie(e, t, 2);
      }
      function Bi(t) {
        var e = le();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Qa) {
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
          lastRenderedReducer: Ke,
          lastRenderedState: t
        }, e;
      }
      function os(t, e, a, l) {
        return t.baseState = a, Di(
          t,
          _t,
          typeof l == "function" ? l : Ke
        );
      }
      function am(t, e, a, l, r) {
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
          P.T !== null ? a(!0) : o.isTransition = !1, l(o), a = e.pending, a === null ? (o.next = e.pending = o, ss(e, o)) : (o.next = a.next, e.pending = a.next = o);
        }
      }
      function ss(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var o = P.T, d = {};
          P.T = d;
          try {
            var h = a(r, l), z = P.S;
            z !== null && z(d, h), us(t, e, h);
          } catch (C) {
            Yi(t, e, C);
          } finally {
            o !== null && d.types !== null && (o.types = d.types), P.T = o;
          }
        } else
          try {
            o = a(r, l), us(t, e, o);
          } catch (C) {
            Yi(t, e, C);
          }
      }
      function us(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            cs(t, e, l);
          },
          function(l) {
            return Yi(t, e, l);
          }
        ) : cs(t, e, a);
      }
      function cs(t, e, a) {
        e.status = "fulfilled", e.value = a, ds(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ss(t, a)));
      }
      function Yi(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, ds(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function ds(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function ms(t, e) {
        return e;
      }
      function fs(t, e) {
        if (ht) {
          var a = St.formState;
          if (a !== null) {
            t: {
              var l = st;
              if (ht) {
                if (Nt) {
                  var r = xf(
                    Nt,
                    Ee
                  );
                  if (r) {
                    Nt = oc(r), l = wf(r);
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
        a = le(), a.memoizedState = a.baseState = e, l = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: ms,
          lastRenderedState: e
        }, a.queue = l, a = As.bind(
          null,
          st,
          l
        ), l.dispatch = a, l = Bi(!1);
        var o = Xi.bind(
          null,
          st,
          !1,
          l.queue
        );
        return l = le(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = am.bind(
          null,
          st,
          r,
          o,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function ps(t) {
        var e = Ot();
        return hs(e, _t, t);
      }
      function hs(t, e, a) {
        if (e = Di(
          t,
          e,
          ms
        )[0], t = xn(Ke)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = jl(e);
          } catch (d) {
            throw d === dl ? Ln : d;
          }
        else l = e;
        e = Ot();
        var r = e.queue, o = r.dispatch;
        return a !== e.memoizedState && (st.flags |= 2048, Fa(
          9,
          { destroy: void 0 },
          lm.bind(null, r, a),
          null
        )), [l, o, t];
      }
      function lm(t, e) {
        t.action = e;
      }
      function gs(t) {
        var e = Ot(), a = _t;
        if (a !== null)
          return hs(e, a, t);
        Ot(), e = e.memoizedState, a = Ot();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function Fa(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = st.updateQueue, e === null && (e = bn(), st.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function vs() {
        return Ot().memoizedState;
      }
      function wn(t, e, a, l) {
        var r = le();
        st.flags |= t, r.memoizedState = Fa(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function _n(t, e, a, l) {
        var r = Ot();
        l = l === void 0 ? null : l;
        var o = r.memoizedState.inst;
        _t !== null && l !== null && Ai(l, _t.memoizedState.deps) ? r.memoizedState = Fa(e, o, a, l) : (st.flags |= t, r.memoizedState = Fa(
          1 | e,
          o,
          a,
          l
        ));
      }
      function bs(t, e) {
        wn(8390656, 8, t, e);
      }
      function Gi(t, e) {
        _n(2048, 8, t, e);
      }
      function nm(t) {
        st.flags |= 4;
        var e = st.updateQueue;
        if (e === null)
          e = bn(), st.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function ys(t) {
        var e = Ot().memoizedState;
        return nm({ ref: e, nextImpl: t }), function() {
          if ((dt & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function xs(t, e) {
        return _n(4, 2, t, e);
      }
      function ws(t, e) {
        return _n(4, 4, t, e);
      }
      function _s(t, e) {
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
      function Ss(t, e, a) {
        a = a != null ? a.concat([t]) : null, _n(
          4,
          4,
          _s.bind(null, e, t),
          a
        );
      }
      function Qi() {
      }
      function zs(t, e) {
        var a = Ot();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Ai(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Es(t, e) {
        var a = Ot();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Ai(e, l[1]))
          return l[0];
        if (l = t(), Qa) {
          Mt(!0);
          try {
            t();
          } finally {
            Mt(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function Vi(t, e, a) {
        return a === void 0 || ($e & 1073741824) !== 0 && (pt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = wu(), st.lanes |= t, xa |= t, a);
      }
      function ks(t, e, a, l) {
        return ge(a, e) ? a : pl.current !== null ? (t = Vi(t, a, l), ge(t, e) || (Dt = !0), t) : ($e & 42) === 0 || ($e & 1073741824) !== 0 && (pt & 261930) === 0 ? (Dt = !0, t.memoizedState = a) : (t = wu(), st.lanes |= t, xa |= t, e);
      }
      function Ns(t, e, a, l, r) {
        var o = Fe();
        Kt(
          o !== 0 && 8 > o ? o : 8
        );
        var d = P.T, h = {};
        P.T = h, Xi(t, !1, e, a);
        try {
          var z = r(), C = P.S;
          if (C !== null && C(h, z), z !== null && typeof z == "object" && typeof z.then == "function") {
            var Y = tm(
              z,
              l
            );
            Al(
              t,
              e,
              Y,
              me(t)
            );
          } else
            Al(
              t,
              e,
              l,
              me(t)
            );
        } catch (U) {
          Al(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: U },
            me()
          );
        } finally {
          Kt(o), d !== null && h.types !== null && (d.types = h.types), P.T = d;
        }
      }
      function Ts(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: al,
          baseState: al,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ke,
            lastRenderedState: al
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
            lastRenderedReducer: Ke,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Ki() {
        return Lt(Ua);
      }
      function Cs() {
        return Ot().memoizedState;
      }
      function js() {
        return Ot().memoizedState;
      }
      function im(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = me();
              t = oa(a);
              var l = sa(e, t, a);
              l !== null && (ie(l, e, a), Nl(l, e, a)), e = { cache: wi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function rm(t, e, a) {
        var l = me();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Sn(t) ? Ms(e, a) : (a = zi(t, e, a, l), a !== null && (ie(a, t, l), Os(a, e, l)));
      }
      function As(t, e, a) {
        var l = me();
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
        if (Sn(t)) Ms(e, r);
        else {
          var o = t.alternate;
          if (t.lanes === 0 && (o === null || o.lanes === 0) && (o = e.lastRenderedReducer, o !== null))
            try {
              var d = e.lastRenderedState, h = o(d, a);
              if (r.hasEagerState = !0, r.eagerState = h, ge(h, d))
                return hn(t, e, r, 0), St === null && pn(), !1;
            } catch {
            } finally {
            }
          if (a = zi(t, e, r, l), a !== null)
            return ie(a, t, l), Os(a, e, l), !0;
        }
        return !1;
      }
      function Xi(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: _i(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Sn(t)) {
          if (e) throw Error(c(479));
        } else
          e = zi(
            t,
            a,
            l,
            2
          ), e !== null && ie(e, t, 2);
      }
      function Sn(t) {
        var e = t.alternate;
        return t === st || e !== null && e === st;
      }
      function Ms(t, e) {
        hl = In = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Os(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, Q(t, a);
        }
      }
      function Zi(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : wr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Rs(t, e, a, l, r, o, d) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, o, d) : e.prototype && e.prototype.isPureReactComponent ? !dn(a, l) || !dn(r, o) : !0;
      }
      function Hs(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && Zr.enqueueReplaceState(e, e.state, null);
      }
      function Aa(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = wr({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function zn(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (l) {
          setTimeout(function() {
            throw l;
          });
        }
      }
      function Us(t, e, a) {
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
      function Ji(t, e, a) {
        return a = oa(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          zn(t, e);
        }, a;
      }
      function Ds(t) {
        return t = oa(t), t.tag = 3, t;
      }
      function qs(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var o = l.value;
          t.payload = function() {
            return r(o);
          }, t.callback = function() {
            Us(e, a, l);
          };
        }
        var d = a.stateNode;
        d !== null && typeof d.componentDidCatch == "function" && (t.callback = function() {
          Us(e, a, l), typeof r != "function" && (wa === null ? wa = /* @__PURE__ */ new Set([this]) : wa.add(this));
          var h = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: h !== null ? h : ""
          });
        });
      }
      function om(t, e, a, l, r) {
        if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          if (e = a.alternate, e !== null && La(
            e,
            a,
            r,
            !0
          ), a = ve.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Ne === null ? On() : a.alternate === null && At === 0 && (At = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === Wn ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), gr(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === Wn ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), gr(t, l, r)), !1;
            }
            throw Error(c(435, a.tag));
          }
          return gr(t, l, r), On(), !1;
        }
        if (ht)
          return e = ve.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== qr && (t = Error(c(422), { cause: l }), zl(
            it(t, a)
          ))) : (l !== qr && (e = Error(c(423), {
            cause: l
          }), zl(
            it(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = it(l, a), r = Ji(
            t.stateNode,
            l,
            r
          ), Ni(t, r), At !== 4 && (At = 2)), !1;
        var o = Error(c(520), { cause: l });
        if (o = it(o, a), Fl === null ? Fl = [o] : Fl.push(o), At !== 4 && (At = 2), e === null) return !0;
        l = it(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = Ji(a.stateNode, l, t), Ni(a, t), !1;
            case 1:
              if (e = a.type, o = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (wa === null || !wa.has(
                o
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = Ds(r), qs(
                  r,
                  t,
                  a,
                  l
                ), Ni(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function Wt(t, e, a, l) {
        e.child = t === null ? zc(e, null, a, l) : Ga(
          e,
          t.child,
          a,
          l
        );
      }
      function Bs(t, e, a, l, r) {
        a = a.render;
        var o = e.ref;
        if ("ref" in l) {
          var d = {};
          for (var h in l)
            h !== "ref" && (d[h] = l[h]);
        } else d = l;
        return Ta(e), l = Mi(
          t,
          e,
          a,
          d,
          o,
          r
        ), h = Oi(), t !== null && !Dt ? (Ri(t, e, r), Xe(t, e, r)) : (ht && h && M(e), e.flags |= 1, Wt(t, e, l, r), e.child);
      }
      function Ys(t, e, a, l, r) {
        if (t === null) {
          var o = a.type;
          return typeof o == "function" && !vr(o) && o.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = o, Gs(
            t,
            e,
            o,
            l,
            r
          )) : (t = Hn(
            a.type,
            null,
            l,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (o = t.child, !tr(t, r)) {
          var d = o.memoizedProps;
          if (a = a.compare, a = a !== null ? a : dn, a(d, l) && t.ref === e.ref)
            return Xe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Le(o, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Gs(t, e, a, l, r) {
        if (t !== null) {
          var o = t.memoizedProps;
          if (dn(o, l) && t.ref === e.ref)
            if (Dt = !1, e.pendingProps = l = o, tr(t, r))
              (t.flags & 131072) !== 0 && (Dt = !0);
            else
              return e.lanes = t.lanes, Xe(t, e, r);
        }
        return Li(
          t,
          e,
          a,
          l,
          r
        );
      }
      function Qs(t, e, a, l) {
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
            return Vs(
              t,
              e,
              o,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && cn(
              e,
              o !== null ? o.cachePool : null
            ), o !== null ? Io(e, o) : Ti(), $o(e);
          else
            return l = e.lanes = 536870912, Vs(
              t,
              e,
              o !== null ? o.baseLanes | a : a,
              a,
              l
            );
        } else
          o !== null ? (cn(e, o.cachePool), Io(e, o), ca(), e.memoizedState = null) : (t !== null && cn(e, null), Ti(), ca());
        return Wt(t, e, r, a), e.child;
      }
      function Ml(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Vs(t, e, a, l, r) {
        var o = Si();
        return o = o === null ? null : {
          parent: We ? Tt._currentValue : Tt._currentValue2,
          pool: o
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: o
        }, t !== null && cn(e, null), Ti(), $o(e), t !== null && La(t, e, l, !0), e.childLanes = r, null;
      }
      function En(t, e) {
        return e = Nn(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Ks(t, e, a) {
        return Ga(e, t.child, null, a), t = En(
          e,
          e.pendingProps
        ), t.flags |= 2, de(e), e.memoizedState = null, t;
      }
      function sm(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (ht) {
            if (l.mode === "hidden")
              return t = En(e, l), e.lanes = 536870912, Ml(null, t);
            if (ji(e), (t = Nt) ? (t = jf(
              t,
              Ee
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: ha !== null ? { id: Be, overflow: Ye } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Gu(t), a.return = e, e.child = a, It = e, Nt = null)) : t = null, t === null) throw rt(e);
            return e.lanes = 536870912, null;
          }
          return En(e, l);
        }
        var o = t.memoizedState;
        if (o !== null) {
          var d = o.dehydrated;
          if (ji(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = Ks(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (Dt || La(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Dt || r) {
            if (l = St, l !== null && (d = ft(l, a), d !== 0 && d !== o.retryLane))
              throw o.retryLane = d, ja(t, d), ie(l, t, d), Jr;
            On(), e = Ks(
              t,
              e,
              a
            );
          } else
            t = o.treeContext, ae && (Nt = Ef(d), It = e, ht = !0, va = null, Ee = !1, t !== null && L(e, t)), e = En(e, l), e.flags |= 4096;
          return e;
        }
        return t = Le(t.child, {
          mode: l.mode,
          children: l.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function kn(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(c(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Li(t, e, a, l, r) {
        return Ta(e), a = Mi(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = Oi(), t !== null && !Dt ? (Ri(t, e, r), Xe(t, e, r)) : (ht && l && M(e), e.flags |= 1, Wt(t, e, a, r), e.child);
      }
      function Xs(t, e, a, l, r, o) {
        return Ta(e), e.updateQueue = null, a = ts(
          e,
          l,
          a,
          r
        ), Po(t), l = Oi(), t !== null && !Dt ? (Ri(t, e, o), Xe(t, e, o)) : (ht && l && M(e), e.flags |= 1, Wt(t, e, a, o), e.child);
      }
      function Zs(t, e, a, l, r) {
        if (Ta(e), e.stateNode === null) {
          var o = il, d = a.contextType;
          typeof d == "object" && d !== null && (o = Lt(d)), o = new a(l, o), e.memoizedState = o.state !== null && o.state !== void 0 ? o.state : null, o.updater = Zr, e.stateNode = o, o._reactInternals = e, o = e.stateNode, o.props = l, o.state = e.memoizedState, o.refs = {}, Ei(e), d = a.contextType, o.context = typeof d == "object" && d !== null ? Lt(d) : il, o.state = e.memoizedState, d = a.getDerivedStateFromProps, typeof d == "function" && (Zi(
            e,
            a,
            d,
            l
          ), o.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof o.getSnapshotBeforeUpdate == "function" || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (d = o.state, typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount(), d !== o.state && Zr.enqueueReplaceState(
            o,
            o.state,
            null
          ), Cl(e, l, o, r), Tl(), o.state = e.memoizedState), typeof o.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          o = e.stateNode;
          var h = e.memoizedProps, z = Aa(a, h);
          o.props = z;
          var C = o.context, Y = a.contextType;
          d = il, typeof Y == "object" && Y !== null && (d = Lt(Y));
          var U = a.getDerivedStateFromProps;
          Y = typeof U == "function" || typeof o.getSnapshotBeforeUpdate == "function", h = e.pendingProps !== h, Y || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (h || C !== d) && Hs(
            e,
            o,
            l,
            d
          ), ba = !1;
          var K = e.memoizedState;
          o.state = K, Cl(e, l, o, r), Tl(), C = e.memoizedState, h || K !== C || ba ? (typeof U == "function" && (Zi(
            e,
            a,
            U,
            l
          ), C = e.memoizedState), (z = ba || Rs(
            e,
            a,
            z,
            l,
            K,
            C,
            d
          )) ? (Y || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = C), o.props = l, o.state = C, o.context = d, l = z) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          o = e.stateNode, ki(t, e), d = e.memoizedProps, Y = Aa(a, d), o.props = Y, U = e.pendingProps, K = o.context, C = a.contextType, z = il, typeof C == "object" && C !== null && (z = Lt(C)), h = a.getDerivedStateFromProps, (C = typeof h == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (d !== U || K !== z) && Hs(
            e,
            o,
            l,
            z
          ), ba = !1, K = e.memoizedState, o.state = K, Cl(e, l, o, r), Tl();
          var ot = e.memoizedState;
          d !== U || K !== ot || ba || t !== null && t.dependencies !== null && on(t.dependencies) ? (typeof h == "function" && (Zi(
            e,
            a,
            h,
            l
          ), ot = e.memoizedState), (Y = ba || Rs(
            e,
            a,
            Y,
            l,
            K,
            ot,
            z
          ) || t !== null && t.dependencies !== null && on(t.dependencies)) ? (C || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(l, ot, z), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(
            l,
            ot,
            z
          )), typeof o.componentDidUpdate == "function" && (e.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = ot), o.props = l, o.state = ot, o.context = z, l = Y) : (typeof o.componentDidUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || d === t.memoizedProps && K === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return o = l, kn(t, e), l = (e.flags & 128) !== 0, o || l ? (o = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : o.render(), e.flags |= 1, t !== null && l ? (e.child = Ga(
          e,
          t.child,
          null,
          r
        ), e.child = Ga(
          e,
          null,
          a,
          r
        )) : Wt(t, e, a, r), e.memoizedState = o.state, t = e.child) : t = Xe(
          t,
          e,
          r
        ), t;
      }
      function Js(t, e, a, l) {
        return Ce(), e.flags |= 256, Wt(t, e, a, l), e.child;
      }
      function Wi(t) {
        return { baseLanes: t, cachePool: Qo() };
      }
      function Fi(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= ye), t;
      }
      function Ls(t, e, a) {
        var l = e.pendingProps, r = !1, o = (e.flags & 128) !== 0, d;
        if ((d = o) || (d = t !== null && t.memoizedState === null ? !1 : (Rt.current & 2) !== 0), d && (r = !0, e.flags &= -129), d = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (ht) {
            if (r ? ua(e) : ca(), (t = Nt) ? (t = Af(
              t,
              Ee
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: ha !== null ? { id: Be, overflow: Ye } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Gu(t), a.return = e, e.child = a, It = e, Nt = null)) : t = null, t === null) throw rt(e);
            return Ar(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var h = l.children;
          return l = l.fallback, r ? (ca(), r = e.mode, h = Nn(
            { mode: "hidden", children: h },
            r
          ), l = Ra(
            l,
            r,
            a,
            null
          ), h.return = e, l.return = e, h.sibling = l, e.child = h, l = e.child, l.memoizedState = Wi(a), l.childLanes = Fi(
            t,
            d,
            a
          ), e.memoizedState = Lr, Ml(null, l)) : (ua(e), Ii(e, h));
        }
        var z = t.memoizedState;
        if (z !== null && (h = z.dehydrated, h !== null)) {
          if (o)
            e.flags & 256 ? (ua(e), e.flags &= -257, e = $i(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ca(), e.child = t.child, e.flags |= 128, e = null) : (ca(), h = l.fallback, r = e.mode, l = Nn(
              { mode: "visible", children: l.children },
              r
            ), h = Ra(
              h,
              r,
              a,
              null
            ), h.flags |= 2, l.return = e, h.return = e, l.sibling = h, e.child = l, Ga(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = Wi(a), l.childLanes = Fi(
              t,
              d,
              a
            ), e.memoizedState = Lr, e = Ml(null, l));
          else if (ua(e), Ar(h))
            d = bf(h).digest, l = Error(c(419)), l.stack = "", l.digest = d, zl({ value: l, source: null, stack: null }), e = $i(
              t,
              e,
              a
            );
          else if (Dt || La(
            t,
            e,
            a,
            !1
          ), d = (a & t.childLanes) !== 0, Dt || d) {
            if (d = St, d !== null && (l = ft(
              d,
              a
            ), l !== 0 && l !== z.retryLane))
              throw z.retryLane = l, ja(t, l), ie(d, t, l), Jr;
            jr(h) || On(), e = $i(
              t,
              e,
              a
            );
          } else
            jr(h) ? (e.flags |= 192, e.child = t.child, e = null) : (t = z.treeContext, ae && (Nt = kf(
              h
            ), It = e, ht = !0, va = null, Ee = !1, t !== null && L(e, t)), e = Ii(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ca(), h = l.fallback, r = e.mode, z = t.child, o = z.sibling, l = Le(z, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = z.subtreeFlags & 65011712, o !== null ? h = Le(
          o,
          h
        ) : (h = Ra(
          h,
          r,
          a,
          null
        ), h.flags |= 2), h.return = e, l.return = e, l.sibling = h, e.child = l, Ml(null, l), l = e.child, h = t.child.memoizedState, h === null ? h = Wi(a) : (r = h.cachePool, r !== null ? (z = We ? Tt._currentValue : Tt._currentValue2, r = r.parent !== z ? { parent: z, pool: z } : r) : r = Qo(), h = {
          baseLanes: h.baseLanes | a,
          cachePool: r
        }), l.memoizedState = h, l.childLanes = Fi(
          t,
          d,
          a
        ), e.memoizedState = Lr, Ml(t.child, l)) : (ua(e), a = t.child, t = a.sibling, a = Le(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (d = e.deletions, d === null ? (e.deletions = [t], e.flags |= 16) : d.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Ii(t, e) {
        return e = Nn(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Nn(t, e) {
        return t = s(22, t, null, e), t.lanes = 0, t;
      }
      function $i(t, e, a) {
        return Ga(e, t.child, null, a), t = Ii(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Ws(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), yi(t.return, e, a);
      }
      function Pi(t, e, a, l, r, o) {
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
      function Fs(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, o = l.tail;
        l = l.children;
        var d = Rt.current, h = (d & 2) !== 0;
        if (h ? (d = d & 1 | 2, e.flags |= 128) : d &= 1, x(Rt, d), Wt(t, e, l, a), l = ht ? Vl : 0, !h && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Ws(t, a, e);
            else if (t.tag === 19)
              Ws(t, a, e);
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
              t = a.alternate, t !== null && vn(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), Pi(
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
              if (t = r.alternate, t !== null && vn(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            Pi(
              e,
              !0,
              a,
              null,
              o,
              l
            );
            break;
          case "together":
            Pi(
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
      function Xe(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), xa |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (La(
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
          for (t = e.child, a = Le(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Le(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function tr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && on(t)));
      }
      function um(t, e, a) {
        switch (e.tag) {
          case 3:
            W(
              e,
              e.stateNode.containerInfo
            ), ra(e, Tt, t.memoizedState.cache), Ce();
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
            ra(
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
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (ua(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Ls(
                t,
                e,
                a
              ) : (ua(e), t = Xe(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            ua(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (l = (a & e.childLanes) !== 0, l || (La(
              t,
              e,
              a,
              !1
            ), l = (a & e.childLanes) !== 0), r) {
              if (l)
                return Fs(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), x(Rt, Rt.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, Qs(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            ra(e, Tt, t.memoizedState.cache);
        }
        return Xe(t, e, a);
      }
      function Is(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Dt = !0;
          else {
            if (!tr(t, a) && (e.flags & 128) === 0)
              return Dt = !1, um(
                t,
                e,
                a
              );
            Dt = (t.flags & 131072) !== 0;
          }
        else
          Dt = !1, ht && (e.flags & 1048576) !== 0 && g(e, Vl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = Ca(e.elementType), e.type = t, typeof t == "function")
                vr(t) ? (l = Aa(t, l), e.tag = 1, e = Zs(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = Li(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Sr) {
                    e.tag = 11, e = Bs(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === kr) {
                    e.tag = 14, e = Ys(
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
            return Li(
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
            ), Zs(
              t,
              e,
              l,
              r,
              a
            );
          case 3:
            t: {
              if (W(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(c(387));
              var o = e.pendingProps;
              r = e.memoizedState, l = r.element, ki(t, e), Cl(e, o, null, a);
              var d = e.memoizedState;
              if (o = d.cache, ra(e, Tt, o), o !== r.cache && xi(
                e,
                [Tt],
                a,
                !0
              ), Tl(), o = d.element, ae && r.isDehydrated)
                if (r = {
                  element: o,
                  isDehydrated: !1,
                  cache: d.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = Js(
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
                  ), zl(l), e = Js(
                    t,
                    e,
                    o,
                    a
                  );
                  break t;
                } else
                  for (ae && (Nt = zf(
                    e.stateNode.containerInfo
                  ), It = e, ht = !0, va = null, Ee = !0), a = zc(
                    e,
                    null,
                    o,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Ce(), o === l) {
                  e = Xe(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                Wt(t, e, o, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Oe)
              return kn(t, e), t === null ? (a = cc(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : ht || (e.stateNode = If(
                e.type,
                e.pendingProps,
                ga.current,
                e
              )) : e.memoizedState = cc(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Yt)
              return gt(e), t === null && Yt && ht && (l = e.stateNode = gc(
                e.type,
                e.pendingProps,
                ga.current,
                Ft.current,
                !1
              ), It = e, Ee = !0, Nt = Nf(
                e.type,
                l,
                Nt
              )), Wt(
                t,
                e,
                e.pendingProps.children,
                a
              ), kn(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && ht && (Lf(
              e.type,
              e.pendingProps,
              Ft.current
            ), (r = l = Nt) && (l = Tf(
              l,
              e.type,
              e.pendingProps,
              Ee
            ), l !== null ? (e.stateNode = l, It = e, Nt = Sf(l), Ee = !1, r = !0) : r = !1), r || rt(e)), gt(e), r = e.type, o = e.pendingProps, d = t !== null ? t.memoizedProps : null, l = o.children, qn(r, o) ? l = null : d !== null && qn(r, d) && (e.flags |= 32), e.memoizedState !== null && (r = Mi(
              t,
              e,
              em,
              null,
              null,
              a
            ), We ? Ua._currentValue = r : Ua._currentValue2 = r), kn(t, e), Wt(t, e, l, a), e.child;
          case 6:
            return t === null && ht && (Wf(
              e.pendingProps,
              Ft.current
            ), (t = a = Nt) && (a = Cf(
              a,
              e.pendingProps,
              Ee
            ), a !== null ? (e.stateNode = a, It = e, Nt = null, t = !0) : t = !1), t || rt(e)), null;
          case 13:
            return Ls(t, e, a);
          case 4:
            return W(
              e,
              e.stateNode.containerInfo
            ), l = e.pendingProps, t === null ? e.child = Ga(
              e,
              null,
              l,
              a
            ) : Wt(t, e, l, a), e.child;
          case 11:
            return Bs(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return Wt(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return Wt(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return Wt(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return l = e.pendingProps, ra(e, e.type, l.value), Wt(
              t,
              e,
              l.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, l = e.pendingProps.children, Ta(e), r = Lt(r), l = l(r), e.flags |= 1, Wt(t, e, l, a), e.child;
          case 14:
            return Ys(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Gs(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return Fs(
              t,
              e,
              a
            );
          case 31:
            return sm(t, e, a);
          case 22:
            return Qs(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ta(e), l = Lt(Tt), t === null ? (r = Si(), r === null && (r = St, o = wi(), r.pooledCache = o, o.refCount++, o !== null && (r.pooledCacheLanes |= a), r = o), e.memoizedState = {
              parent: l,
              cache: r
            }, Ei(e), ra(e, Tt, r)) : ((t.lanes & a) !== 0 && (ki(t, e), Cl(e, null, null, a), Tl()), r = t.memoizedState, o = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), ra(e, Tt, l)) : (l = o.cache, ra(e, Tt, l), l !== r.cache && xi(
              e,
              [Tt],
              a,
              !0
            ))), Wt(
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
      function je(t) {
        t.flags |= 4;
      }
      function Tn(t) {
        qe && (t.flags |= 8);
      }
      function $s(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function er(t, e, a, l) {
        if (ee)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Tr(t, a.stateNode);
            else if (!(a.tag === 4 || Yt && a.tag === 27) && a.child !== null) {
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
        else if (qe)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var o = r.stateNode;
              a && l && (o = ic(
                o,
                r.type,
                r.memoizedProps
              )), Tr(t, o);
            } else if (r.tag === 6)
              o = r.stateNode, a && l && (o = rc(
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
      function Ps(t, e, a, l) {
        var r = !1;
        if (qe)
          for (var o = e.child; o !== null; ) {
            if (o.tag === 5) {
              var d = o.stateNode;
              a && l && (d = ic(
                d,
                o.type,
                o.memoizedProps
              )), lc(t, d);
            } else if (o.tag === 6)
              d = o.stateNode, a && l && (d = rc(
                d,
                o.memoizedProps
              )), lc(t, d);
            else if (o.tag !== 4) {
              if (o.tag === 22 && o.memoizedState !== null)
                r = o.child, r !== null && (r.return = o), Ps(t, o, !0, !0), r = !0;
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
      function tu(t, e) {
        if (qe && $s(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = ac();
          Ps(l, e, !1, !1), t.pendingChildren = l, je(e), vf(a, l);
        }
      }
      function ar(t, e, a, l) {
        if (ee)
          t.memoizedProps !== l && je(e);
        else if (qe) {
          var r = t.stateNode, o = t.memoizedProps;
          if ((t = $s(t, e)) || o !== l) {
            var d = Ft.current;
            o = gf(
              r,
              a,
              o,
              l,
              !t,
              null
            ), o === r ? e.stateNode = r : (Tn(e), Iu(
              o,
              a,
              l,
              d
            ) && je(e), e.stateNode = o, t && er(o, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function lr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Qm(e, l) : Vm(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Cr(e, l))
            if (Pu(t.stateNode, e, l))
              t.flags |= 8192;
            else if (ku()) t.flags |= 8192;
            else
              throw Ya = Wn, Qr;
        } else t.flags &= -16777217;
      }
      function eu(t, e) {
        if (Pf(e)) {
          if (t.flags |= 16777216, !hc(e))
            if (ku()) t.flags |= 8192;
            else
              throw Ya = Wn, Qr;
        } else t.flags &= -16777217;
      }
      function Cn(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? V() : 536870912, t.lanes |= e, yl |= e);
      }
      function Ol(t, e) {
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
      function Et(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, l = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= l, t.childLanes = a, e;
      }
      function cm(t, e, a) {
        var l = e.pendingProps;
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
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Ve(Tt), $(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Te(e) ? je(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ia())), tu(t, e), Et(e), null;
          case 26:
            if (Oe) {
              var r = e.type, o = e.memoizedState;
              return t === null ? (je(e), o !== null ? (Et(e), eu(
                e,
                o
              )) : (Et(e), lr(
                e,
                r,
                null,
                l,
                a
              ))) : o ? o !== t.memoizedState ? (je(e), Et(e), eu(
                e,
                o
              )) : (Et(e), e.flags &= -16777217) : (o = t.memoizedProps, ee ? o !== l && je(e) : ar(
                t,
                e,
                r,
                l
              ), Et(e), lr(
                e,
                r,
                o,
                l,
                a
              )), null;
            }
          case 27:
            if (Yt) {
              if (Vt(e), a = ga.current, r = e.type, t !== null && e.stateNode != null)
                ee ? t.memoizedProps !== l && je(e) : ar(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return Et(e), null;
                }
                t = Ft.current, Te(e) ? ka(e, t) : (t = gc(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, je(e));
              }
              return Et(e), null;
            }
          case 5:
            if (Vt(e), r = e.type, t !== null && e.stateNode != null)
              ar(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return Et(e), null;
              }
              if (o = Ft.current, Te(e))
                ka(e, o), Qf(
                  e.stateNode,
                  r,
                  l,
                  o
                ) && (e.flags |= 64);
              else {
                var d = Rm(
                  r,
                  l,
                  ga.current,
                  o,
                  e
                );
                Tn(e), er(d, e, !1, !1), e.stateNode = d, Iu(
                  d,
                  r,
                  l,
                  o
                ) && je(e);
              }
            }
            return Et(e), lr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ee ? a !== l && je(e) : qe && (a !== l ? (t = ga.current, a = Ft.current, Tn(e), e.stateNode = $u(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = ga.current, a = Ft.current, Te(e)) {
                if (!ae) throw Error(c(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = It, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                Of(
                  t,
                  a,
                  e,
                  l
                ) || rt(e, !0);
              } else
                Tn(e), e.stateNode = $u(
                  l,
                  t,
                  a,
                  e
                );
            }
            return Et(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = Te(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(c(318));
                  if (!ae) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  Rf(t, e);
                } else
                  Ce(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Et(e), t = !1;
              } else
                a = ia(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (de(e), e) : (de(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return Et(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Te(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!ae) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  Hf(r, e);
                } else
                  Ce(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Et(e), r = !1;
              } else
                r = ia(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (de(e), e) : (de(e), null);
            }
            return de(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), o = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (o = l.memoizedState.cachePool.pool), o !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Cn(e, e.updateQueue), Et(e), null);
          case 4:
            return $(), tu(t, e), t === null && qm(e.stateNode.containerInfo), Et(e), null;
          case 10:
            return Ve(e.type), Et(e), null;
          case 19:
            if (E(Rt), l = e.memoizedState, l === null) return Et(e), null;
            if (r = (e.flags & 128) !== 0, o = l.rendering, o === null)
              if (r) Ol(l, !1);
              else {
                if (At !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (o = vn(t), o !== null) {
                      for (e.flags |= 128, Ol(l, !1), t = o.updateQueue, e.updateQueue = t, Cn(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Yu(a, t), a = a.sibling;
                      return x(
                        Rt,
                        Rt.current & 1 | 2
                      ), ht && B(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && re() > Il && (e.flags |= 128, r = !0, Ol(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = vn(o), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Cn(e, t), Ol(l, !0), l.tail === null && l.tailMode === "hidden" && !o.alternate && !ht)
                    return Et(e), null;
                } else
                  2 * re() - l.renderingStartTime > Il && a !== 536870912 && (e.flags |= 128, r = !0, Ol(l, !1), e.lanes = 4194304);
              l.isBackwards ? (o.sibling = e.child, e.child = o) : (t = l.last, t !== null ? t.sibling = o : e.child = o, l.last = o);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = re(), t.sibling = null, a = Rt.current, x(
              Rt,
              r ? a & 1 | 2 : a & 1
            ), ht && B(e, l.treeForkCount), t) : (Et(e), null);
          case 22:
          case 23:
            return de(e), Ci(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Et(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Et(e), a = e.updateQueue, a !== null && Cn(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && E(Ba), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ve(Tt), Et(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function dm(t, e) {
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
            return de(e), Ci(), t !== null && E(Ba), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ve(Tt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function au(t, e) {
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
            de(e), Ci(), t !== null && E(Ba);
            break;
          case 24:
            Ve(Tt);
        }
      }
      function Rl(t, e) {
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
      function da(t, e, a) {
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
                  var z = a, C = h;
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
              l = l.next;
            } while (l !== o);
          }
        } catch (Y) {
          vt(e, e.return, Y);
        }
      }
      function lu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Fo(e, a);
          } catch (l) {
            vt(t, t.return, l);
          }
        }
      }
      function nu(t, e, a) {
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
      function Hl(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var l = Bl(t.stateNode);
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
      function De(t, e) {
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
      function iu(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          nf(l, e, a, t);
        } catch (r) {
          vt(t, t.return, r);
        }
      }
      function nr(t, e, a) {
        try {
          rf(
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
      function ru(t) {
        return t.tag === 5 || t.tag === 3 || (Oe ? t.tag === 26 : !1) || (Yt ? t.tag === 27 && ll(t.type) : !1) || t.tag === 4;
      }
      function ir(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || ru(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Yt && t.tag === 27 && ll(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function rr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? sf(a, t, e) : af(a, t);
        else if (l !== 4 && (Yt && l === 27 && ll(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (rr(t, e, a), t = t.sibling; t !== null; )
            rr(t, e, a), t = t.sibling;
      }
      function jn(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? of(a, t, e) : ef(a, t);
        else if (l !== 4 && (Yt && l === 27 && ll(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (jn(t, e, a), t = t.sibling; t !== null; )
            jn(t, e, a), t = t.sibling;
      }
      function ou(t, e, a) {
        t = t.containerInfo;
        try {
          nc(t, a);
        } catch (l) {
          vt(e, e.return, l);
        }
      }
      function su(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          ep(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          vt(t, t.return, l);
        }
      }
      function mm(t, e) {
        for (Mm(t.containerInfo), Xt = e; Xt !== null; )
          if (t = Xt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Xt = e;
          else
            for (; Xt !== null; ) {
              t = Xt;
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
                  (e & 1024) !== 0 && ee && hf(t.stateNode.containerInfo);
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
      function uu(t, e, a) {
        var l = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Ze(t, a), l & 4 && Rl(5, a);
            break;
          case 1:
            if (Ze(t, a), l & 4)
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
            l & 64 && lu(a), l & 512 && Hl(a, a.return);
            break;
          case 3:
            if (Ze(t, a), l & 64 && (l = a.updateQueue, l !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Bl(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                Fo(l, t);
              } catch (d) {
                vt(a, a.return, d);
              }
            }
            break;
          case 27:
            Yt && e === null && l & 4 && su(a);
          case 26:
          case 5:
            if (Ze(t, a), e === null) {
              if (l & 4) iu(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  qf(
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
            l & 512 && Hl(a, a.return);
            break;
          case 12:
            Ze(t, a);
            break;
          case 31:
            Ze(t, a), l & 4 && du(t, a);
            break;
          case 13:
            Ze(t, a), l & 4 && mu(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = ym.bind(
              null,
              a
            ), yf(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || Pe, !l) {
              e = e !== null && e.memoizedState !== null || qt, r = Pe;
              var o = qt;
              Pe = l, (qt = e) && !o ? Je(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Ze(t, a), Pe = r, qt = o;
            }
            break;
          case 30:
            break;
          default:
            Ze(t, a);
        }
      }
      function cu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, cu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Gm(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ae(t, e, a) {
        for (a = a.child; a !== null; )
          or(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function or(t, e, a) {
        if (he && typeof he.onCommitFiberUnmount == "function")
          try {
            he.onCommitFiberUnmount(Ql, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Oe) {
              qt || De(a, e), Ae(
                t,
                e,
                a
              ), a.memoizedState ? mc(a.memoizedState) : a.stateNode && pc(a.stateNode);
              break;
            }
          case 27:
            if (Yt) {
              qt || De(a, e);
              var l = Bt, r = oe;
              ll(a.type) && (Bt = a.stateNode, oe = !1), Ae(
                t,
                e,
                a
              ), vc(a.stateNode), Bt = l, oe = r;
              break;
            }
          case 5:
            qt || De(a, e);
          case 6:
            if (ee) {
              if (l = Bt, r = oe, Bt = null, Ae(
                t,
                e,
                a
              ), Bt = l, oe = r, Bt !== null)
                if (oe)
                  try {
                    cf(Bt, a.stateNode);
                  } catch (o) {
                    vt(
                      a,
                      e,
                      o
                    );
                  }
                else
                  try {
                    uf(Bt, a.stateNode);
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
            ee && Bt !== null && (oe ? Xf(
              Bt,
              a.stateNode
            ) : Kf(Bt, a.stateNode));
            break;
          case 4:
            ee ? (l = Bt, r = oe, Bt = a.stateNode.containerInfo, oe = !0, Ae(
              t,
              e,
              a
            ), Bt = l, oe = r) : (qe && ou(
              a.stateNode,
              a,
              ac()
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
            da(2, a, e), qt || da(4, a, e), Ae(
              t,
              e,
              a
            );
            break;
          case 1:
            qt || (De(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && nu(
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
            qt = (l = qt) || a.memoizedState !== null, Ae(
              t,
              e,
              a
            ), qt = l;
            break;
          default:
            Ae(
              t,
              e,
              a
            );
        }
      }
      function du(t, e) {
        if (ae && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Yf(t);
          } catch (a) {
            vt(e, e.return, a);
          }
        }
      }
      function mu(t, e) {
        if (ae && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Gf(t);
          } catch (a) {
            vt(e, e.return, a);
          }
      }
      function fm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Nc()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Nc()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function An(t, e) {
        var a = fm(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = xm.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function te(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], o = t, d = e;
            if (ee) {
              var h = d;
              t: for (; h !== null; ) {
                switch (h.tag) {
                  case 27:
                    if (Yt) {
                      if (ll(h.type)) {
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
            fu(e, t), e = e.sibling;
      }
      function fu(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            te(e, t), ne(t), l & 4 && (da(3, t, t.return), Rl(3, t), da(5, t, t.return));
            break;
          case 1:
            te(e, t), ne(t), l & 512 && (qt || a === null || De(a, a.return)), l & 64 && Pe && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (Oe) {
              var r = Re;
              if (te(e, t), ne(t), l & 512 && (qt || a === null || De(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var o = t.memoizedState;
                a === null ? o === null ? t.stateNode === null ? t.stateNode = Ff(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : fc(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = dc(
                  r,
                  o,
                  t.memoizedProps
                ) : l !== o ? (l === null ? a.stateNode !== null && pc(a.stateNode) : mc(l), o === null ? fc(
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
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Yt) {
              te(e, t), ne(t), l & 512 && (qt || a === null || De(a, a.return)), a !== null && l & 4 && nr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (te(e, t), ne(t), l & 512 && (qt || a === null || De(a, a.return)), ee) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  ec(r);
                } catch (U) {
                  vt(t, t.return, U);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, nr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (Wr = !0);
            } else
              qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (te(e, t), ne(t), l & 4 && ee) {
              if (t.stateNode === null)
                throw Error(c(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                lf(r, a, l);
              } catch (U) {
                vt(t, t.return, U);
              }
            }
            break;
          case 3:
            if (Oe ? ($f(), r = Re, Re = Mr(e.containerInfo), te(e, t), Re = r) : te(e, t), ne(t), l & 4) {
              if (ee && ae && a !== null && a.memoizedState.isDehydrated)
                try {
                  Bf(e.containerInfo);
                } catch (U) {
                  vt(t, t.return, U);
                }
              if (qe) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  nc(l, a);
                } catch (U) {
                  vt(t, t.return, U);
                }
              }
            }
            Wr && (Wr = !1, pu(t));
            break;
          case 4:
            Oe ? (a = Re, Re = Mr(
              t.stateNode.containerInfo
            ), te(e, t), ne(t), Re = a) : (te(e, t), ne(t)), l & 4 && qe && ou(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            te(e, t), ne(t);
            break;
          case 31:
            te(e, t), ne(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, An(t, l)));
            break;
          case 13:
            te(e, t), ne(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (ni = re()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, An(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var d = a !== null && a.memoizedState !== null, h = Pe, z = qt;
            if (Pe = h || r, qt = z || d, te(e, t), qt = z, Pe = h, ne(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || d || Pe || qt || Ma(t)), ee)) {
              t: if (a = null, ee)
                for (e = t; ; ) {
                  if (e.tag === 5 || Oe && e.tag === 26) {
                    if (a === null) {
                      d = a = e;
                      try {
                        o = d.stateNode, r ? df(o) : ff(
                          d.stateNode,
                          d.memoizedProps
                        );
                      } catch (U) {
                        vt(d, d.return, U);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      d = e;
                      try {
                        var C = d.stateNode;
                        r ? mf(C) : pf(C, d.memoizedProps);
                      } catch (U) {
                        vt(d, d.return, U);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      d = e;
                      try {
                        var Y = d.stateNode;
                        r ? Zf(Y) : Jf(d.stateNode);
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
                    a === e && (a = null), e = e.return;
                  }
                  a === e && (a = null), e.sibling.return = e.return, e = e.sibling;
                }
            }
            l & 4 && (l = t.updateQueue, l !== null && (a = l.retryQueue, a !== null && (l.retryQueue = null, An(t, a))));
            break;
          case 19:
            te(e, t), ne(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, An(t, l)));
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
            for (var a, l = t.return; l !== null; ) {
              if (ru(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (ee) {
              if (a == null) throw Error(c(160));
              switch (a.tag) {
                case 27:
                  if (Yt) {
                    var r = a.stateNode, o = ir(t);
                    jn(t, o, r);
                    break;
                  }
                case 5:
                  var d = a.stateNode;
                  a.flags & 32 && (ec(d), a.flags &= -33);
                  var h = ir(t);
                  jn(t, h, d);
                  break;
                case 3:
                case 4:
                  var z = a.stateNode.containerInfo, C = ir(t);
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
      function pu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            pu(e), e.tag === 5 && e.flags & 1024 && Zm(e.stateNode), t = t.sibling;
          }
      }
      function Ze(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            uu(t, e.alternate, e), e = e.sibling;
      }
      function Ma(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              da(4, e, e.return), Ma(e);
              break;
            case 1:
              De(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && nu(
                e,
                e.return,
                a
              ), Ma(e);
              break;
            case 27:
              Yt && vc(e.stateNode);
            case 26:
            case 5:
              De(e, e.return), Ma(e);
              break;
            case 22:
              e.memoizedState === null && Ma(e);
              break;
            case 30:
              Ma(e);
              break;
            default:
              Ma(e);
          }
          t = t.sibling;
        }
      }
      function Je(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var l = e.alternate, r = t, o = e, d = o.flags;
          switch (o.tag) {
            case 0:
            case 11:
            case 15:
              Je(
                r,
                o,
                a
              ), Rl(4, o);
              break;
            case 1:
              if (Je(
                r,
                o,
                a
              ), l = o, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (C) {
                  vt(l, l.return, C);
                }
              if (l = o, r = l.updateQueue, r !== null) {
                var h = l.stateNode;
                try {
                  var z = r.shared.hiddenCallbacks;
                  if (z !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < z.length; r++)
                      Wo(z[r], h);
                } catch (C) {
                  vt(l, l.return, C);
                }
              }
              a && d & 64 && lu(o), Hl(o, o.return);
              break;
            case 27:
              Yt && su(o);
            case 26:
            case 5:
              Je(
                r,
                o,
                a
              ), a && l === null && d & 4 && iu(o), Hl(o, o.return);
              break;
            case 12:
              Je(
                r,
                o,
                a
              );
              break;
            case 31:
              Je(
                r,
                o,
                a
              ), a && d & 4 && du(r, o);
              break;
            case 13:
              Je(
                r,
                o,
                a
              ), a && d & 4 && mu(r, o);
              break;
            case 22:
              o.memoizedState === null && Je(
                r,
                o,
                a
              ), Hl(o, o.return);
              break;
            case 30:
              break;
            default:
              Je(
                r,
                o,
                a
              );
          }
          e = e.sibling;
        }
      }
      function sr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && El(a));
      }
      function ur(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && El(t));
      }
      function Me(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            hu(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function hu(t, e, a, l) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Me(
              t,
              e,
              a,
              l
            ), r & 2048 && Rl(9, e);
            break;
          case 1:
            Me(
              t,
              e,
              a,
              l
            );
            break;
          case 3:
            Me(
              t,
              e,
              a,
              l
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && El(t)));
            break;
          case 12:
            if (r & 2048) {
              Me(
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
              } catch (z) {
                vt(e, e.return, z);
              }
            } else
              Me(
                t,
                e,
                a,
                l
              );
            break;
          case 31:
            Me(
              t,
              e,
              a,
              l
            );
            break;
          case 13:
            Me(
              t,
              e,
              a,
              l
            );
            break;
          case 23:
            break;
          case 22:
            o = e.stateNode, d = e.alternate, e.memoizedState !== null ? o._visibility & 2 ? Me(
              t,
              e,
              a,
              l
            ) : Ul(
              t,
              e
            ) : o._visibility & 2 ? Me(
              t,
              e,
              a,
              l
            ) : (o._visibility |= 2, Ia(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && sr(d, e);
            break;
          case 24:
            Me(
              t,
              e,
              a,
              l
            ), r & 2048 && ur(e.alternate, e);
            break;
          default:
            Me(
              t,
              e,
              a,
              l
            );
        }
      }
      function Ia(t, e, a, l, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var o = t, d = e, h = a, z = l, C = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              Ia(
                o,
                d,
                h,
                z,
                r
              ), Rl(8, d);
              break;
            case 23:
              break;
            case 22:
              var Y = d.stateNode;
              d.memoizedState !== null ? Y._visibility & 2 ? Ia(
                o,
                d,
                h,
                z,
                r
              ) : Ul(
                o,
                d
              ) : (Y._visibility |= 2, Ia(
                o,
                d,
                h,
                z,
                r
              )), r && C & 2048 && sr(
                d.alternate,
                d
              );
              break;
            case 24:
              Ia(
                o,
                d,
                h,
                z,
                r
              ), r && C & 2048 && ur(d.alternate, d);
              break;
            default:
              Ia(
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
      function Ul(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, l = e, r = l.flags;
            switch (l.tag) {
              case 22:
                Ul(a, l), r & 2048 && sr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Ul(a, l), r & 2048 && ur(
                  l.alternate,
                  l
                );
                break;
              default:
                Ul(a, l);
            }
            e = e.sibling;
          }
      }
      function Oa(t, e, a) {
        if (t.subtreeFlags & vl)
          for (t = t.child; t !== null; )
            gu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function gu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Oa(
              t,
              e,
              a
            ), t.flags & vl)
              if (t.memoizedState !== null)
                tp(
                  a,
                  Re,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Cr(r, t)) && tc(a, l, r, t);
              }
            break;
          case 5:
            Oa(
              t,
              e,
              a
            ), t.flags & vl && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Cr(r, t)) && tc(a, l, r, t));
            break;
          case 3:
          case 4:
            Oe ? (l = Re, Re = Mr(
              t.stateNode.containerInfo
            ), Oa(
              t,
              e,
              a
            ), Re = l) : Oa(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = vl, vl = 16777216, Oa(
              t,
              e,
              a
            ), vl = l) : Oa(
              t,
              e,
              a
            ));
            break;
          default:
            Oa(
              t,
              e,
              a
            );
        }
      }
      function vu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Dl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Xt = l, yu(
                l,
                t
              );
            }
          vu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            bu(t), t = t.sibling;
      }
      function bu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Dl(t), t.flags & 2048 && da(9, t, t.return);
            break;
          case 3:
            Dl(t);
            break;
          case 12:
            Dl(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Mn(t)) : Dl(t);
            break;
          default:
            Dl(t);
        }
      }
      function Mn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Xt = l, yu(
                l,
                t
              );
            }
          vu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              da(8, e, e.return), Mn(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Mn(e));
              break;
            default:
              Mn(e);
          }
          t = t.sibling;
        }
      }
      function yu(t, e) {
        for (; Xt !== null; ) {
          var a = Xt;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              da(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var l = a.memoizedState.cachePool.pool;
                l != null && l.refCount++;
              }
              break;
            case 24:
              El(a.memoizedState.cache);
          }
          if (l = a.child, l !== null) l.return = a, Xt = l;
          else
            t: for (a = t; Xt !== null; ) {
              l = Xt;
              var r = l.sibling, o = l.return;
              if (cu(l), l === a) {
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
        var e = Dm(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = Wm(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function dr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case Pn:
            if (t.type === e.value) return !0;
            break;
          case ti:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, o = t[a++], d = e[o];
                if (r !== 5 && r !== 26 && r !== 27 || !Gl(l)) {
                  for (; d != null && dr(l, d); )
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
          case ei:
            if ((a === 5 || a === 26 || a === 27) && $m(t.stateNode, e.value))
              return !0;
            break;
          case li:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Im(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ai:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function mr(t) {
        switch (t.$$typeof) {
          case Pn:
            return "<" + (R(t.value) || "Unknown") + ">";
          case ti:
            return ":has(" + (mr(t) || "") + ")";
          case ei:
            return '[role="' + t.value + '"]';
          case li:
            return '"' + t.value + '"';
          case ai:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function xu(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], o = r.tag, d = t[l++], h = e[d];
          if (o !== 5 && o !== 26 && o !== 27 || !Gl(r)) {
            for (; h != null && dr(r, h); )
              d++, h = e[d];
            if (d === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, d), r = r.sibling;
          }
        }
        return a;
      }
      function fr(t, e) {
        if (!Yl) throw Error(c(363));
        t = cr(t), t = xu(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var l = t[a++], r = l.tag;
          if (r === 5 || r === 26 || r === 27)
            Gl(l) || e.push(l.stateNode);
          else
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
        }
        return e;
      }
      function me() {
        return (dt & 2) !== 0 && pt !== 0 ? pt & -pt : P.T !== null ? _i() : Bm();
      }
      function wu() {
        if (ye === 0)
          if ((pt & 536870912) === 0 || ht) {
            var t = Yn;
            Yn <<= 1, (Yn & 3932160) === 0 && (Yn = 262144), ye = t;
          } else ye = 536870912;
        return t = ve.current, t !== null && (t.flags |= 32), ye;
      }
      function ie(t, e, a) {
        (t === St && (xt === 2 || xt === 9) || t.cancelPendingCommit !== null) && ($a(t, 0), ma(
          t,
          pt,
          ye,
          !1
        )), J(t, a), ((dt & 2) === 0 || t !== St) && (t === St && ((dt & 2) === 0 && (Va |= a), At === 4 && ma(
          t,
          pt,
          ye,
          !1
        )), Ue(t));
      }
      function _u(t, e, a) {
        if ((dt & 6) !== 0) throw Error(c(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || j(t, e), r = l ? gm(t, e) : hr(t, e, !0), o = l;
        do {
          if (r === 0) {
            bl && !l && ma(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, o && !pm(a)) {
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
                  r = Fl;
                  var z = ae && h.current.memoizedState.isDehydrated;
                  if (z && ($a(h, d).flags |= 256), d = hr(
                    h,
                    d,
                    !1
                  ), d !== 2) {
                    if (Fr && !z) {
                      h.errorRecoveryDisabledLanes |= o, Va |= o, r = 4;
                      break t;
                    }
                    o = se, se = r, o !== null && (se === null ? se = o : se.push.apply(
                      se,
                      o
                    ));
                  }
                  r = d;
                }
                if (o = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              $a(t, 0), ma(t, e, 0, !0);
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
                  ma(
                    l,
                    e,
                    ye,
                    !ya
                  );
                  break t;
                case 2:
                  se = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(c(329));
              }
              if ((e & 62914560) === e && (r = ni + 300 - re(), 10 < r)) {
                if (ma(
                  l,
                  e,
                  ye,
                  !ya
                ), A(l, 0, !0) !== 0) break t;
                ea = e, l.timeoutHandle = Hm(
                  Su.bind(
                    null,
                    l,
                    a,
                    se,
                    ii,
                    $r,
                    e,
                    ye,
                    Va,
                    yl,
                    ya,
                    o,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Su(
                l,
                a,
                se,
                ii,
                $r,
                e,
                ye,
                Va,
                yl,
                ya,
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
      function Su(t, e, a, l, r, o, d, h, z, C, Y, U, K, ot) {
        if (t.timeoutHandle = Ha, U = e.subtreeFlags, U & 8192 || (U & 16785408) === 16785408) {
          U = Km(), gu(
            e,
            o,
            U
          );
          var $t = (o & 62914560) === o ? ni - re() : (o & 4194048) === o ? Tc - re() : 0;
          if ($t = Xm(
            U,
            $t
          ), $t !== null) {
            ea = o, t.cancelPendingCommit = $t(
              Mu.bind(
                null,
                t,
                e,
                o,
                a,
                l,
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
            ), ma(t, o, d, !C);
            return;
          }
        }
        Mu(
          t,
          e,
          o,
          a,
          l,
          r,
          d,
          h,
          z
        );
      }
      function pm(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var l = 0; l < a.length; l++) {
              var r = a[l], o = r.getSnapshot;
              r = r.value;
              try {
                if (!ge(o(), r)) return !1;
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
      function ma(t, e, a, l) {
        e &= ~Ir, e &= ~Va, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var o = 31 - pe(r), d = 1 << o;
          l[o] = -1, r &= ~d;
        }
        a !== 0 && k(t, a, e);
      }
      function zu() {
        return (dt & 6) === 0 ? (Wa(0), !1) : !0;
      }
      function pr() {
        if (mt !== null) {
          if (xt === 0)
            var t = mt.return;
          else
            t = mt, Ie = Da = null, Hi(t), ml = null, Zl = 0, t = mt;
          for (; t !== null; )
            au(t.alternate, t), t = t.return;
          mt = null;
        }
      }
      function $a(t, e) {
        var a = t.timeoutHandle;
        a !== Ha && (t.timeoutHandle = Ha, Um(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ea = 0, pr(), St = t, mt = a = Le(t.current, null), pt = e, xt = 0, be = null, ya = !1, bl = j(t, e), Fr = !1, yl = ye = Ir = Va = xa = At = 0, se = Fl = null, $r = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - pe(l), o = 1 << r;
            e |= t[r], l &= ~o;
          }
        return ta = e, pn(), a;
      }
      function Eu(t, e) {
        st = null, P.H = Ll, e === dl || e === Ln ? (e = Xo(), xt = 3) : e === Qr ? (e = Xo(), xt = 4) : xt = e === Jr ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, be = e, mt === null && (At = 1, zn(
          t,
          it(e, t.current)
        ));
      }
      function ku() {
        var t = ve.current;
        return t === null ? !0 : (pt & 4194048) === pt ? Ne === null : (pt & 62914560) === pt || (pt & 536870912) !== 0 ? t === Ne : !1;
      }
      function Nu() {
        var t = P.H;
        return P.H = Ll, t === null ? Ll : t;
      }
      function Tu() {
        var t = P.A;
        return P.A = hp, t;
      }
      function On() {
        At = 4, ya || (pt & 4194048) !== pt && ve.current !== null || (bl = !0), (xa & 134217727) === 0 && (Va & 134217727) === 0 || St === null || ma(
          St,
          pt,
          ye,
          !1
        );
      }
      function hr(t, e, a) {
        var l = dt;
        dt |= 2;
        var r = Nu(), o = Tu();
        (St !== t || pt !== e) && (ii = null, $a(t, e)), e = !1;
        var d = At;
        t: do
          try {
            if (xt !== 0 && mt !== null) {
              var h = mt, z = be;
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
                  if (xt = 0, be = null, Pa(t, h, z, C), a && bl) {
                    d = 0;
                    break t;
                  }
                  break;
                default:
                  C = xt, xt = 0, be = null, Pa(t, h, z, C);
              }
            }
            hm(), d = At;
            break;
          } catch (Y) {
            Eu(t, Y);
          }
        while (!0);
        return e && t.shellSuspendCounter++, Ie = Da = null, dt = l, P.H = r, P.A = o, mt === null && (St = null, pt = 0, pn()), d;
      }
      function hm() {
        for (; mt !== null; ) Cu(mt);
      }
      function gm(t, e) {
        var a = dt;
        dt |= 2;
        var l = Nu(), r = Tu();
        St !== t || pt !== e ? (ii = null, Il = re() + 500, $a(t, e)) : bl = j(
          t,
          e
        );
        t: do
          try {
            if (xt !== 0 && mt !== null) {
              e = mt;
              var o = be;
              e: switch (xt) {
                case 1:
                  xt = 0, be = null, Pa(t, e, o, 1);
                  break;
                case 2:
                case 9:
                  if (Vo(o)) {
                    xt = 0, be = null, ju(e);
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
                  Vo(o) ? (xt = 0, be = null, ju(e)) : (xt = 0, be = null, Pa(t, e, o, 7));
                  break;
                case 5:
                  var d = null;
                  switch (mt.tag) {
                    case 26:
                      d = mt.memoizedState;
                    case 5:
                    case 27:
                      var h = mt, z = h.type, C = h.pendingProps;
                      if (d ? hc(d) : Pu(h.stateNode, z, C)) {
                        xt = 0, be = null;
                        var Y = h.sibling;
                        if (Y !== null) mt = Y;
                        else {
                          var U = h.return;
                          U !== null ? (mt = U, Rn(U)) : mt = null;
                        }
                        break e;
                      }
                  }
                  xt = 0, be = null, Pa(t, e, o, 5);
                  break;
                case 6:
                  xt = 0, be = null, Pa(t, e, o, 6);
                  break;
                case 8:
                  pr(), At = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            vm();
            break;
          } catch (K) {
            Eu(t, K);
          }
        while (!0);
        return Ie = Da = null, P.H = l, P.A = r, dt = a, mt !== null ? 0 : (St = null, pt = 0, pn(), At);
      }
      function vm() {
        for (; mt !== null && !np(); )
          Cu(mt);
      }
      function Cu(t) {
        var e = Is(
          t.alternate,
          t,
          ta
        );
        t.memoizedProps = t.pendingProps, e === null ? Rn(t) : mt = e;
      }
      function ju(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Xs(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              pt
            );
            break;
          case 11:
            e = Xs(
              a,
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
            au(a, e), e = mt = Yu(e, ta), e = Is(a, e, ta);
        }
        t.memoizedProps = t.pendingProps, e === null ? Rn(t) : mt = e;
      }
      function Pa(t, e, a, l) {
        Ie = Da = null, Hi(e), ml = null, Zl = 0;
        var r = e.return;
        try {
          if (om(
            t,
            r,
            e,
            a,
            pt
          )) {
            At = 1, zn(
              t,
              it(a, t.current)
            ), mt = null;
            return;
          }
        } catch (o) {
          if (r !== null) throw mt = r, o;
          At = 1, zn(
            t,
            it(a, t.current)
          ), mt = null;
          return;
        }
        e.flags & 32768 ? (ht || l === 1 ? t = !0 : bl || (pt & 536870912) !== 0 ? t = !1 : (ya = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = ve.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Au(e, t)) : Rn(e);
      }
      function Rn(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Au(
              e,
              ya
            );
            return;
          }
          t = e.return;
          var a = cm(
            e.alternate,
            e,
            ta
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
        At === 0 && (At = 5);
      }
      function Au(t, e) {
        do {
          var a = dm(t.alternate, t);
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
        At = 6, mt = null;
      }
      function Mu(t, e, a, l, r, o, d, h, z) {
        t.cancelPendingCommit = null;
        do
          ql();
        while (Gt !== 0);
        if ((dt & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (o = e.lanes | e.childLanes, o |= Vr, N(
            t,
            a,
            o,
            d,
            h,
            z
          ), t === St && (mt = St = null, pt = 0), xl = e, _a = t, ea = a, Pr = o, to = r, Cc = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, wm(Hr, function() {
            return Du(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = P.T, P.T = null, r = Fe(), Kt(2), d = dt, dt |= 4;
            try {
              mm(t, e, a);
            } finally {
              dt = d, Kt(r), P.T = l;
            }
          }
          Gt = 1, Ou(), Ru(), Hu();
        }
      }
      function Ou() {
        if (Gt === 1) {
          Gt = 0;
          var t = _a, e = xl, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = P.T, P.T = null;
            var l = Fe();
            Kt(2);
            var r = dt;
            dt |= 4;
            try {
              fu(e, t), Om(t.containerInfo);
            } finally {
              dt = r, Kt(l), P.T = a;
            }
          }
          t.current = e, Gt = 2;
        }
      }
      function Ru() {
        if (Gt === 2) {
          Gt = 0;
          var t = _a, e = xl, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = P.T, P.T = null;
            var l = Fe();
            Kt(2);
            var r = dt;
            dt |= 4;
            try {
              uu(t, e.alternate, e);
            } finally {
              dt = r, Kt(l), P.T = a;
            }
          }
          Gt = 3;
        }
      }
      function Hu() {
        if (Gt === 4 || Gt === 3) {
          Gt = 0, ip();
          var t = _a, e = xl, a = ea, l = Cc;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Gt = 5 : (Gt = 0, xl = _a = null, Uu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (wa = null), zt(a), e = e.stateNode, he && typeof he.onCommitFiberRoot == "function")
            try {
              he.onCommitFiberRoot(
                Ql,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (l !== null) {
            e = P.T, r = Fe(), Kt(2), P.T = null;
            try {
              for (var o = t.onRecoverableError, d = 0; d < l.length; d++) {
                var h = l[d];
                o(h.value, {
                  componentStack: h.stack
                });
              }
            } finally {
              P.T = e, Kt(r);
            }
          }
          (ea & 3) !== 0 && ql(), Ue(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === eo ? $l++ : ($l = 0, eo = t) : $l = 0, ae && Vf(), Wa(0);
        }
      }
      function Uu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, El(e)));
      }
      function ql() {
        return Ou(), Ru(), Hu(), Du();
      }
      function Du() {
        if (Gt !== 5) return !1;
        var t = _a, e = Pr;
        Pr = 0;
        var a = zt(ea), l = 32 > a ? 32 : a;
        a = P.T;
        var r = Fe();
        try {
          Kt(l), P.T = null, l = to, to = null;
          var o = _a, d = ea;
          if (Gt = 0, xl = _a = null, ea = 0, (dt & 6) !== 0)
            throw Error(c(331));
          var h = dt;
          if (dt |= 4, bu(o.current), hu(
            o,
            o.current,
            d,
            l
          ), dt = h, Wa(0, !1), he && typeof he.onPostCommitFiberRoot == "function")
            try {
              he.onPostCommitFiberRoot(Ql, o);
            } catch {
            }
          return !0;
        } finally {
          Kt(r), P.T = a, Uu(t, e);
        }
      }
      function qu(t, e, a) {
        e = it(a, e), e = Ji(t.stateNode, e, 2), t = sa(t, e, 2), t !== null && (J(t, 2), Ue(t));
      }
      function vt(t, e, a) {
        if (t.tag === 3)
          qu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              qu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (wa === null || !wa.has(l))) {
                t = it(a, t), a = Ds(2), l = sa(e, a, 2), l !== null && (qs(
                  a,
                  l,
                  e,
                  t
                ), J(l, 2), Ue(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function gr(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new gp();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (Fr = !0, r.add(a), t = bm.bind(null, t, e, a), e.then(t, t));
      }
      function bm(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, St === t && (pt & a) === a && (At === 4 || At === 3 && (pt & 62914560) === pt && 300 > re() - ni ? (dt & 2) === 0 && $a(t, 0) : Ir |= a, yl === pt && (yl = 0)), Ue(t);
      }
      function Bu(t, e) {
        e === 0 && (e = V()), t = ja(t, e), t !== null && (J(t, e), Ue(t));
      }
      function ym(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Bu(t, a);
      }
      function xm(t, e) {
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
        l !== null && l.delete(e), Bu(t, a);
      }
      function wm(t, e) {
        return Qn(t, e);
      }
      function _m(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function vr(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function Le(t, e) {
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
      function Yu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Hn(t, e, a, l, r, o) {
        var d = 0;
        if (l = t, typeof t == "function") vr(t) && (d = 1);
        else if (typeof t == "string")
          d = Oe && Yt ? uc(t, a, Ft.current) ? 26 : bc(t) ? 27 : 5 : Oe ? uc(
            t,
            a,
            Ft.current
          ) ? 26 : 5 : Yt && bc(t) ? 27 : 5;
        else
          t: switch (t) {
            case Nr:
              return t = s(31, a, e, r), t.elementType = Nr, t.lanes = o, t;
            case el:
              return Ra(
                a.children,
                r,
                o,
                e
              );
            case Ju:
              d = 8, r |= 24;
              break;
            case _r:
              return t = s(12, a, e, r | 2), t.elementType = _r, t.lanes = o, t;
            case zr:
              return t = s(13, a, e, r), t.elementType = zr, t.lanes = o, t;
            case Er:
              return t = s(19, a, e, r), t.elementType = Er, t.lanes = o, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case fa:
                    d = 10;
                    break t;
                  case Lu:
                    d = 9;
                    break t;
                  case Sr:
                    d = 11;
                    break t;
                  case kr:
                    d = 14;
                    break t;
                  case pa:
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
      function Ra(t, e, a, l) {
        return t = s(7, t, l, e), t.lanes = a, t;
      }
      function br(t, e, a) {
        return t = s(6, t, null, e), t.lanes = a, t;
      }
      function Gu(t) {
        var e = s(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function yr(t, e, a) {
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
      function Sm(t, e, a, l, r, o, d, h, z) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Ha, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = lt(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = lt(0), this.hiddenUpdates = lt(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = o, this.onRecoverableError = d, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = z, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Qu(t, e, a, l, r, o, d, h, z, C, Y, U) {
        return t = new Sm(
          t,
          e,
          a,
          d,
          z,
          C,
          Y,
          U,
          h
        ), e = 1, o === !0 && (e |= 24), o = s(3, null, null, e), t.current = o, o.stateNode = t, e = wi(), e.refCount++, t.pooledCache = e, e.refCount++, o.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Ei(o), t;
      }
      function Vu(t) {
        return t ? (t = il, t) : il;
      }
      function Ku(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = p(e), t = t !== null ? w(t) : null, t === null ? null : Bl(t.stateNode);
      }
      function Xu(t, e, a, l, r, o) {
        r = Vu(r), l.context === null ? l.context = r : l.pendingContext = r, l = oa(e), l.payload = { element: a }, o = o === void 0 ? null : o, o !== null && (l.callback = o), a = sa(t, l, e), a !== null && (ie(a, t, e), Nl(a, t, e));
      }
      function Zu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function xr(t, e) {
        Zu(t, e), (t = t.alternate) && Zu(t, e);
      }
      var ct = {}, zm = bd(), fe = qp(), wr = Object.assign, Em = Symbol.for("react.element"), Un = Symbol.for("react.transitional.element"), tl = Symbol.for("react.portal"), el = Symbol.for("react.fragment"), Ju = Symbol.for("react.strict_mode"), _r = Symbol.for("react.profiler"), Lu = Symbol.for("react.consumer"), fa = Symbol.for("react.context"), Sr = Symbol.for("react.forward_ref"), zr = Symbol.for("react.suspense"), Er = Symbol.for("react.suspense_list"), kr = Symbol.for("react.memo"), pa = Symbol.for("react.lazy"), Nr = Symbol.for("react.activity"), km = Symbol.for("react.memo_cache_sentinel"), Wu = Symbol.iterator, Nm = Symbol.for("react.client.reference"), Dn = Array.isArray, P = zm.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Tm = i.rendererVersion, Cm = i.rendererPackageName, Fu = i.extraDevToolsConfig, Bl = i.getPublicInstance, jm = i.getRootHostContext, Am = i.getChildHostContext, Mm = i.prepareForCommit, Om = i.resetAfterCommit, Rm = i.createInstance;
      i.cloneMutableInstance;
      var Tr = i.appendInitialChild, Iu = i.finalizeInitialChildren, qn = i.shouldSetTextContent, $u = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Hm = i.scheduleTimeout, Um = i.cancelTimeout, Ha = i.noTimeout, We = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ee = i.supportsMutation, qe = i.supportsPersistence, ae = i.supportsHydration, Dm = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var qm = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Kt = i.setCurrentUpdatePriority, Fe = i.getCurrentUpdatePriority, Bm = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var Ym = i.shouldAttemptEagerTransition, Gm = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var Qm = i.maySuspendCommit, Vm = i.maySuspendCommitOnUpdate, Cr = i.maySuspendCommitInSyncRender, Pu = i.preloadInstance, Km = i.startSuspendingCommit, tc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var Xm = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var al = i.NotPendingTransition, Ua = i.HostTransitionContext, Zm = i.resetFormInstance;
      i.bindToConsole;
      var Jm = i.supportsMicrotasks, Lm = i.scheduleMicrotask, Yl = i.supportsTestSelectors, Wm = i.findFiberRoot, Fm = i.getBoundingRect, Im = i.getTextContent, Gl = i.isHiddenSubtree, $m = i.matchAccessibilityRole, Pm = i.setFocusIfFocusable, tf = i.setupIntersectionObserver, ef = i.appendChild, af = i.appendChildToContainer, lf = i.commitTextUpdate, nf = i.commitMount, rf = i.commitUpdate, of = i.insertBefore, sf = i.insertInContainerBefore, uf = i.removeChild, cf = i.removeChildFromContainer, ec = i.resetTextContent, df = i.hideInstance, mf = i.hideTextInstance, ff = i.unhideInstance, pf = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var hf = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var gf = i.cloneInstance, ac = i.createContainerChildSet, lc = i.appendChildToContainerChildSet, vf = i.finalizeContainerChildren, nc = i.replaceContainerChildren, ic = i.cloneHiddenInstance, rc = i.cloneHiddenTextInstance, jr = i.isSuspenseInstancePending, Ar = i.isSuspenseInstanceFallback, bf = i.getSuspenseInstanceFallbackErrorDetails, yf = i.registerSuspenseInstanceRetry, xf = i.canHydrateFormStateMarker, wf = i.isFormStateMarkerMatching, oc = i.getNextHydratableSibling, _f = i.getNextHydratableSiblingAfterSingleton, Sf = i.getFirstHydratableChild, zf = i.getFirstHydratableChildWithinContainer, Ef = i.getFirstHydratableChildWithinActivityInstance, kf = i.getFirstHydratableChildWithinSuspenseInstance, Nf = i.getFirstHydratableChildWithinSingleton, Tf = i.canHydrateInstance, Cf = i.canHydrateTextInstance, jf = i.canHydrateActivityInstance, Af = i.canHydrateSuspenseInstance, Mf = i.hydrateInstance, Of = i.hydrateTextInstance, Rf = i.hydrateActivityInstance, Hf = i.hydrateSuspenseInstance, Uf = i.getNextHydratableInstanceAfterActivityInstance, Df = i.getNextHydratableInstanceAfterSuspenseInstance, qf = i.commitHydratedInstance, Bf = i.commitHydratedContainer, Yf = i.commitHydratedActivityInstance, Gf = i.commitHydratedSuspenseInstance, Qf = i.finalizeHydratedChildren, Vf = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var Kf = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var Xf = i.clearSuspenseBoundaryFromContainer, Zf = i.hideDehydratedBoundary, Jf = i.unhideDehydratedBoundary, sc = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var Lf = i.validateHydratableInstance, Wf = i.validateHydratableTextInstance, Oe = i.supportsResources, uc = i.isHostHoistableType, Mr = i.getHoistableRoot, cc = i.getResource, dc = i.acquireResource, mc = i.releaseResource, Ff = i.hydrateHoistable, fc = i.mountHoistable, pc = i.unmountHoistable, If = i.createHoistableInstance, $f = i.prepareToCommitHoistables, Pf = i.mayResourceSuspendCommit, hc = i.preloadResource, tp = i.suspendResource, Yt = i.supportsSingletons, gc = i.resolveSingletonInstance, ep = i.acquireSingletonInstance, vc = i.releaseSingletonInstance, bc = i.isHostSingletonType, ll = i.isSingletonScope, Or = [], nl = -1, il = {}, pe = Math.clz32 ? Math.clz32 : T, ap = Math.log, lp = Math.LN2, Bn = 256, Yn = 262144, Gn = 4194304, Qn = fe.unstable_scheduleCallback, Rr = fe.unstable_cancelCallback, np = fe.unstable_shouldYield, ip = fe.unstable_requestPaint, re = fe.unstable_now, yc = fe.unstable_ImmediatePriority, rp = fe.unstable_UserBlockingPriority, Hr = fe.unstable_NormalPriority, op = fe.unstable_IdlePriority, sp = fe.log, up = fe.unstable_setDisableYieldValue, Ql = null, he = null, ge = typeof Object.is == "function" ? Object.is : Jt, xc = typeof reportError == "function" ? reportError : function(t) {
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
      }, cp = Object.prototype.hasOwnProperty, Ur, wc, Dr = !1, _c = /* @__PURE__ */ new WeakMap(), rl = [], ol = 0, Vn = null, Vl = 0, Se = [], ze = 0, ha = null, Be = 1, Ye = "", Ft = y(null), Kl = y(null), ga = y(null), Kn = y(null), It = null, Nt = null, ht = !1, va = null, Ee = !1, qr = Error(c(519)), Xn = y(null), Da = null, Ie = null, dp = typeof AbortController < "u" ? AbortController : function() {
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
      }, mp = fe.unstable_scheduleCallback, fp = fe.unstable_NormalPriority, Tt = {
        $$typeof: fa,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Zn = null, sl = null, Br = !1, Jn = !1, Yr = !1, qa = 0, Xl = null, Gr = 0, ul = 0, cl = null, Sc = P.S;
      P.S = function(t, e) {
        Tc = re(), typeof e == "object" && e !== null && typeof e.then == "function" && Pd(t, e), Sc !== null && Sc(t, e);
      };
      var Ba = y(null), dl = Error(c(460)), Qr = Error(c(474)), Ln = Error(c(542)), Wn = { then: function() {
      } }, Ya = null, ml = null, Zl = 0, Ga = Jo(!0), zc = Jo(!1), ke = [], fl = 0, Vr = 0, ba = !1, Kr = !1, pl = y(null), Fn = y(0), ve = y(null), Ne = null, Rt = y(0), $e = 0, st = null, _t = null, Ut = null, In = !1, hl = !1, Qa = !1, $n = 0, Jl = 0, gl = null, pp = 0, Ll = {
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
      Ll.useEffectEvent = jt;
      var Ec = {
        readContext: Lt,
        use: yn,
        useCallback: function(t, e) {
          return le().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Lt,
        useEffect: bs,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, wn(
            4194308,
            4,
            _s.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return wn(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          wn(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = le();
          e = e === void 0 ? null : e;
          var l = t();
          if (Qa) {
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
          var l = le();
          if (a !== void 0) {
            var r = a(e);
            if (Qa) {
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
          }, l.queue = t, t = t.dispatch = rm.bind(
            null,
            st,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = le();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Bi(t);
          var e = t.queue, a = As.bind(
            null,
            st,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var a = le();
          return Vi(a, t, e);
        },
        useTransition: function() {
          var t = Bi(!1);
          return t = Ns.bind(
            null,
            st,
            t.queue,
            !0,
            !1
          ), le().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = st, r = le();
          if (ht) {
            if (a === void 0)
              throw Error(c(407));
            a = a();
          } else {
            if (a = e(), St === null)
              throw Error(c(349));
            (pt & 127) !== 0 || as(l, e, a);
          }
          r.memoizedState = a;
          var o = { value: a, getSnapshot: e };
          return r.queue = o, bs(ns.bind(null, l, o, t), [
            t
          ]), l.flags |= 2048, Fa(
            9,
            { destroy: void 0 },
            ls.bind(
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
          var t = le(), e = St.identifierPrefix;
          if (ht) {
            var a = Ye, l = Be;
            a = (l & ~(1 << 32 - pe(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = $n++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = pp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ki,
        useFormState: fs,
        useActionState: fs,
        useOptimistic: function(t) {
          var e = le();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = Xi.bind(
            null,
            st,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Ui,
        useCacheRefresh: function() {
          return le().memoizedState = im.bind(
            null,
            st
          );
        },
        useEffectEvent: function(t) {
          var e = le(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((dt & 2) !== 0)
              throw Error(c(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, Xr = {
        readContext: Lt,
        use: yn,
        useCallback: zs,
        useContext: Lt,
        useEffect: Gi,
        useImperativeHandle: Ss,
        useInsertionEffect: xs,
        useLayoutEffect: ws,
        useMemo: Es,
        useReducer: xn,
        useRef: vs,
        useState: function() {
          return xn(Ke);
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var a = Ot();
          return ks(
            a,
            _t.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = xn(Ke)[0], e = Ot().memoizedState;
          return [
            typeof t == "boolean" ? t : jl(t),
            e
          ];
        },
        useSyncExternalStore: es,
        useId: Cs,
        useHostTransitionStatus: Ki,
        useFormState: ps,
        useActionState: ps,
        useOptimistic: function(t, e) {
          var a = Ot();
          return os(a, _t, t, e);
        },
        useMemoCache: Ui,
        useCacheRefresh: js
      };
      Xr.useEffectEvent = ys;
      var kc = {
        readContext: Lt,
        use: yn,
        useCallback: zs,
        useContext: Lt,
        useEffect: Gi,
        useImperativeHandle: Ss,
        useInsertionEffect: xs,
        useLayoutEffect: ws,
        useMemo: Es,
        useReducer: qi,
        useRef: vs,
        useState: function() {
          return qi(Ke);
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var a = Ot();
          return _t === null ? Vi(a, t, e) : ks(
            a,
            _t.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = qi(Ke)[0], e = Ot().memoizedState;
          return [
            typeof t == "boolean" ? t : jl(t),
            e
          ];
        },
        useSyncExternalStore: es,
        useId: Cs,
        useHostTransitionStatus: Ki,
        useFormState: gs,
        useActionState: gs,
        useOptimistic: function(t, e) {
          var a = Ot();
          return _t !== null ? os(a, _t, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Ui,
        useCacheRefresh: js
      };
      kc.useEffectEvent = ys;
      var Zr = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = me(), r = oa(l);
          r.payload = e, a != null && (r.callback = a), e = sa(t, r, l), e !== null && (ie(e, t, l), Nl(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = me(), r = oa(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = sa(t, r, l), e !== null && (ie(e, t, l), Nl(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = me(), l = oa(a);
          l.tag = 2, e != null && (l.callback = e), e = sa(t, l, a), e !== null && (ie(e, t, a), Nl(e, t, a));
        }
      }, Jr = Error(c(461)), Dt = !1, Lr = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, Pe = !1, qt = !1, Wr = !1, Nc = typeof WeakSet == "function" ? WeakSet : Set, Xt = null, Bt = null, oe = !1, Re = null, vl = 8192, hp = {
        getCacheForType: function(t) {
          var e = Lt(Tt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return Lt(Tt).controller.signal;
        }
      }, Pn = 0, ti = 1, ei = 2, ai = 3, li = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Wl = Symbol.for;
        Pn = Wl("selector.component"), ti = Wl("selector.has_pseudo_class"), ei = Wl("selector.role"), ai = Wl("selector.test_id"), li = Wl("selector.text");
      }
      var gp = typeof WeakMap == "function" ? WeakMap : Map, dt = 0, St = null, mt = null, pt = 0, xt = 0, be = null, ya = !1, bl = !1, Fr = !1, ta = 0, At = 0, xa = 0, Va = 0, Ir = 0, ye = 0, yl = 0, Fl = null, se = null, $r = !1, ni = 0, Tc = 0, Il = 1 / 0, ii = null, wa = null, Gt = 0, _a = null, xl = null, ea = 0, Pr = 0, to = null, Cc = null, $l = 0, eo = null;
      return ct.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ja(t, 67108864);
          e !== null && ie(e, t, 67108864), xr(t, 67108864);
        }
      }, ct.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = me();
          e = wt(e);
          var a = ja(t, e);
          a !== null && ie(a, t, e), xr(t, e);
        }
      }, ct.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = O(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - pe(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ue(t), (dt & 6) === 0 && (Il = re() + 500, Wa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = ja(t, 2), e !== null && ie(e, t, 2), zu(), xr(t, 2);
        }
      }, ct.batchedUpdates = function(t, e) {
        return t(e);
      }, ct.createComponentSelector = function(t) {
        return { $$typeof: Pn, value: t };
      }, ct.createContainer = function(t, e, a, l, r, o, d, h, z, C) {
        return Qu(
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
          z,
          C
        );
      }, ct.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ti, value: t };
      }, ct.createHydrationContainer = function(t, e, a, l, r, o, d, h, z, C, Y, U, K, ot) {
        return t = Qu(
          a,
          l,
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
        ), t.context = Vu(null), a = t.current, l = me(), l = wt(l), r = oa(l), r.callback = e ?? null, sa(a, r, l), e = l, t.current.lanes = e, J(t, e), Ue(t), t;
      }, ct.createPortal = function(t, e, a) {
        var l = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: tl,
          key: l == null ? null : "" + l,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, ct.createRoleSelector = function(t) {
        return { $$typeof: ei, value: t };
      }, ct.createTestNameSelector = function(t) {
        return { $$typeof: ai, value: t };
      }, ct.createTextSelector = function(t) {
        return { $$typeof: li, value: t };
      }, ct.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ct.defaultOnRecoverableError = function(t) {
        xc(t);
      }, ct.defaultOnUncaughtError = function(t) {
        xc(t);
      }, ct.deferredUpdates = function(t) {
        var e = P.T, a = Fe();
        try {
          return Kt(32), P.T = null, t();
        } finally {
          Kt(a), P.T = e;
        }
      }, ct.discreteUpdates = function(t, e, a, l, r) {
        var o = P.T, d = Fe();
        try {
          return Kt(2), P.T = null, t(e, a, l, r);
        } finally {
          Kt(d), P.T = o, dt === 0 && (Il = re() + 500);
        }
      }, ct.findAllNodes = fr, ct.findBoundingRects = function(t, e) {
        if (!Yl) throw Error(c(363));
        e = fr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Fm(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, o = a.y, d = o + a.height, h = e - 1; 0 <= h; h--)
            if (e !== h) {
              var z = t[h], C = z.x, Y = C + z.width, U = z.y, K = U + z.height;
              if (l >= C && o >= U && r <= Y && d <= K) {
                t.splice(e, 1);
                break;
              } else if (l !== C || a.width !== z.width || K < o || U > d) {
                if (!(o !== U || a.height !== z.height || Y < l || C > r)) {
                  C > l && (z.width += C - l, z.x = l), Y < r && (z.width = r - C), t.splice(e, 1);
                  break;
                }
              } else {
                U > o && (z.height += U - o, z.y = o), K < d && (z.height = d - U), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ct.findHostInstance = Ku, ct.findHostInstanceWithNoPortals = function(t) {
        return t = p(t), t = t !== null ? v(t) : null, t === null ? null : Bl(t.stateNode);
      }, ct.findHostInstanceWithWarning = function(t) {
        return Ku(t);
      }, ct.flushPassiveEffects = ql, ct.flushSyncFromReconciler = function(t) {
        var e = dt;
        dt |= 1;
        var a = P.T, l = Fe();
        try {
          if (Kt(2), P.T = null, t)
            return t();
        } finally {
          Kt(l), P.T = a, dt = e, (dt & 6) === 0 && Wa(0);
        }
      }, ct.flushSyncWork = zu, ct.focusWithin = function(t, e) {
        if (!Yl) throw Error(c(363));
        for (t = cr(t), e = xu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!Gl(a)) {
            if ((l === 5 || l === 26 || l === 27) && Pm(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ct.getFindAllNodesFailureDescription = function(t, e) {
        if (!Yl) throw Error(c(363));
        var a = 0, l = [];
        t = [cr(t), 0];
        for (var r = 0; r < t.length; ) {
          var o = t[r++], d = o.tag, h = t[r++], z = e[h];
          if ((d !== 5 && d !== 26 && d !== 27 || !Gl(o)) && (dr(o, z) && (l.push(mr(z)), h++, h > a && (a = h)), h < e.length))
            for (o = o.child; o !== null; )
              t.push(o, h), o = o.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(mr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (l.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, ct.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Bl(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, ct.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Tm,
          rendererPackageName: Cm,
          currentDispatcherRef: P,
          reconcilerVersion: "19.2.0"
        };
        if (Fu !== null && (t.rendererConfig = Fu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Ql = e.inject(t), he = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ct.isAlreadyRendering = function() {
        return (dt & 6) !== 0;
      }, ct.observeVisibleRects = function(t, e, a, l) {
        if (!Yl) throw Error(c(363));
        t = fr(t, e);
        var r = tf(
          t,
          a,
          l
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
      }, ct.startHostTransition = function(t, e, a, l) {
        if (t.tag !== 5) throw Error(c(476));
        var r = Ts(t).queue;
        Ns(
          t,
          r,
          e,
          al,
          a === null ? u : function() {
            var o = Ts(t);
            return o.next === null && (o = t.alternate.memoizedState), Al(
              t,
              o.next.queue,
              {},
              me()
            ), a(l);
          }
        );
      }, ct.updateContainer = function(t, e, a, l) {
        var r = e.current, o = me();
        return Xu(
          r,
          o,
          t,
          e,
          a,
          l
        ), o;
      }, ct.updateContainerSync = function(t, e, a, l) {
        return Xu(
          e.current,
          2,
          t,
          e,
          a,
          l
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
var uo = { exports: {} }, aa = {};
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
  return Gc || (Gc = 1, aa.ConcurrentRoot = 1, aa.ContinuousEventPriority = 8, aa.DefaultEventPriority = 32, aa.DiscreteEventPriority = 2, aa.IdleEventPriority = 268435456, aa.LegacyRoot = 0, aa.NoEventPriority = 0), aa;
}
var Qc;
function Kp() {
  return Qc || (Qc = 1, uo.exports = Vp()), uo.exports;
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
function ue(n, i = " ") {
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
function go(n, i, s = 0) {
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
    const w = n.slice(m + 4, p - 1), v = ue(w, ","), q = v[0].trim(), R = v.length > 1 ? w.slice(w.indexOf(",") + 1).trim() : null;
    let y = i(q);
    if ((y == null || y === "initial") && (y = R), y == null) return null;
    const E = go(y, i, s + 1);
    if (E === null) return null;
    u += E, c = p;
  }
}
function Lp(n) {
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
function vo(n, i) {
  const s = Lp(n.trim());
  if (!s) return null;
  let u = 0;
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
  }, m = (y, E, x) => y && E ? { px: y.px + x * E.px, pct: y.pct + x * E.pct, num: y.num + x * E.num, unitless: y.unitless && E.unitless } : null, f = (y, E) => y ? { px: y.px * E, pct: y.pct * E, num: y.num * E, unitless: y.unitless } : null, p = (y) => y && y.unitless;
  function w() {
    const y = s[u++];
    if (!y) return null;
    if (y.num !== void 0) return c(y);
    if (y.op === "(") {
      const E = q();
      return s[u]?.op !== ")" ? null : (u++, E);
    }
    if (y.op === "-" || y.op === "+") {
      const E = w();
      return y.op === "-" ? f(E, -1) : E;
    }
    if (y.fn) {
      const E = [];
      for (; ; ) {
        E.push(q());
        const O = s[u++];
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
    for (; s[u] && (s[u].op === "*" || s[u].op === "/"); ) {
      const E = s[u++].op, x = w();
      if (!y || !x) return null;
      E === "*" ? y = p(x) ? f(y, x.num) : p(y) ? f(x, y.num) : null : y = p(x) && x.num !== 0 ? f(y, 1 / x.num) : null;
    }
    return y;
  }
  function q() {
    let y = v();
    for (; s[u] && (s[u].op === "+" || s[u].op === "-"); ) {
      const E = s[u++].op;
      y = m(y, v(), E === "-" ? -1 : 1);
    }
    return y;
  }
  const R = q();
  return u !== s.length || !R ? null : R;
}
function bo(n, i) {
  const s = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(s))
    return s === "thin" ? { px: 1 } : s === "medium" ? { px: 3 } : s === "thick" ? { px: 5 } : s;
  const u = vo(s, i);
  return u ? u.unitless ? u.num === 0 ? { px: 0 } : { expr: n.trim() } : u.pct && (u.px || u.num) ? { expr: n.trim() } : u.pct ? { pct: u.pct } : { px: Wp(u.px) } : { expr: n.trim() };
}
const Wp = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, oi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Fp = ([n, i, s, u]) => `#${oi(n)}${oi(i)}${oi(s)}${oi(u * 255)}`;
function Kc(n) {
  const i = n.slice(1), s = i.length <= 4 ? i.split("").map((c) => c + c).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
  const u = (c) => parseInt(s.slice(c, c + 2), 16);
  return [u(0), u(2), u(4), s.length === 8 ? u(6) / 255 : 1];
}
function fi(n, i) {
  const s = n.trim().toLowerCase();
  if (s === "currentcolor") return "currentcolor";
  const u = /^perchtoken\(([a-z0-9-]+)\)$/.exec(s);
  if (u) {
    const v = i(u[1]), q = v && Kc(v);
    return q ? { rgba: q, token: u[1] } : null;
  }
  if (s.startsWith("#")) {
    const v = Kc(s);
    return v ? { rgba: v, token: null } : null;
  }
  if (Vc[s]) return { rgba: [...Vc[s]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(s);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const v = ue(c[2], ",");
    if (v.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(v[0])) return null;
    const q = (Mt) => {
      const Jt = ue(Mt), kt = Jt.findIndex((et) => /%$/.test(et)), H = kt >= 0 ? parseFloat(Jt[kt]) / 100 : null;
      return { color: fi(Jt.filter((et, it) => it !== kt).join(" "), i), pct: H };
    }, R = q(v[1]), y = q(v[2]);
    if (!R.color || !y.color || R.color === "currentcolor" || y.color === "currentcolor") return null;
    let E = R.pct, x = y.pct;
    E === null && x === null ? (E = 0.5, x = 0.5) : E === null ? E = 1 - x : x === null && (x = 1 - E);
    const T = E + x, O = T < 1 ? T : 1;
    E /= T, x /= T;
    const [A, j, G, V] = R.color.rgba, [lt, J, N, k] = y.color.rgba, Q = V * E + k * x, ft = (Mt, Jt) => Q === 0 ? 0 : (Mt * V * E + Jt * k * x) / Q, wt = [ft(A, lt), ft(j, J), ft(G, N), Q * O], zt = k === 0 ? R.color.token : V === 0 ? y.color.token : null;
    return { rgba: wt, token: zt };
  }
  const m = c[2].includes(",") ? ue(c[2], ",") : ue(c[2].replace("/", " / ")).filter((v) => v !== "/");
  if (m.length < 3) return null;
  const f = (v) => v.endsWith("%") ? parseFloat(v) / 100 * 255 : parseFloat(v), p = m[3] === void 0 ? 1 : m[3].endsWith("%") ? parseFloat(m[3]) / 100 : parseFloat(m[3]), w = [f(m[0]), f(m[1]), f(m[2]), p];
  return w.some((v) => Number.isNaN(v)) ? null : { rgba: w, token: null };
}
const an = ["top", "right", "bottom", "left"], Ip = ["top-left", "top-right", "bottom-right", "bottom-left"], si = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Xc = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function yo(n, i) {
  const s = i.trim(), u = () => ue(s);
  switch (n) {
    case "padding":
    case "margin": {
      const c = si(u());
      return an.map((m, f) => [`${n}-${m}`, c[f]]);
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
      const c = si(u());
      return an.map((m, f) => [m, c[f]]);
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
      const c = n.split("-")[1], m = si(u());
      return an.map((f, p) => [`border-${f}-${c}`, m[p]]);
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
      const c = n === "border" ? an : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let m = "medium", f = "none", p = "currentcolor";
      if (s !== "none" && s !== "0")
        for (const w of u())
          Xc.has(w) ? f = w : /^(thin|medium|thick|-?[\d.]|calc\()/.test(w) ? m = w : p = w;
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
      const c = si(ue(s.split("/")[0]));
      return Ip.map((m, f) => [`border-${m}-radius`, c[f]]);
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
      return s === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : fi(s, () => "#000000") ? [["background-color", s], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", s]];
    case "overflow": {
      const c = u();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = u();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return yo("gap", s);
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
        Xc.has(p) || p === "auto" ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? c = p : f = p;
      return [["outline-width", c], ["outline-style", m], ["outline-color", f]];
    }
    case "transition": {
      if (s === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = ue(s, ","), m = c.map((p) => ue(p).find((w) => !/^[\d.]+m?s$/.test(w) && !/^(ease|linear|step|cubic)/.test(w)) ?? "all"), f = c.map((p) => ue(p).find((w) => /^[\d.]+m?s$/.test(w)) ?? "0s");
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
function $p(n, i) {
  return n ? ue(n, ",").some((s) => {
    let u = s.trim().toLowerCase(), c = !1;
    u.startsWith("not ") && (c = !0, u = u.slice(4)), u.startsWith("only ") && (u = u.slice(5));
    const m = u.split(/\s+and\s+/).every((f) => {
      if (f = f.trim(), f === "all" || f === "screen") return !0;
      if (f === "print") return !1;
      const p = /^\((.+)\)$/.exec(f);
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
    return c ? !m : m;
  }) : !0;
}
function Pp(n, i) {
  const s = i[i.length - 1].compound;
  return jo(s)[0] ?? n;
}
function th(n) {
  const i = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), u = (c, m) => {
    c.forEach(({ compound: f }, p) => {
      const w = m && p === c.length - 1;
      for (const v of f.pseudos)
        if (xd.has(v.name) && (w ? i : s).add(v.name), v.list && v.name !== "not") for (const q of v.list) u(q, w);
    });
  };
  return u(n, !0), { subject: i, ancestor: s };
}
function jo(n) {
  const i = [...n.classes];
  for (const s of n.pseudos)
    if (!(s.name !== "is" && s.name !== "where"))
      for (const u of s.list) u.length === 1 && i.push(...jo(u[0].compound));
  return i;
}
function eh(n, i) {
  const s = (u, c) => {
    u.forEach(({ compound: m }, f) => {
      const p = c && f === u.length - 1, w = m.pseudos.filter((v) => xd.has(v.name)).map((v) => v.name);
      if (!p) for (const v of w) for (const q of jo(m)) i.add(`${v}:${q}`);
      for (const v of m.pseudos) if (v.list && v.name !== "not") for (const q of v.list) s(q, p);
    });
  };
  s(n, !0);
}
class ah {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const s = (m, f) => {
      const p = f[f.length - 1].compound, w = p.classes.length ? `.${p.classes[0]}` : p.tag && p.tag !== "*" ? p.tag : "*";
      this.index.has(w) || this.index.set(w, []), this.index.get(w).push(m);
    };
    let u = 0;
    const c = (m, f) => {
      for (const [p, w, v, q] of m)
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
          const x = { steps: y, media: w, layer: v, origin: f, order: u++, specificity: hd(y), decls: q, states: E, source: f === 0 ? `ua:${y[y.length - 1].compound.tag ?? "*"}` : Pp(R, y) };
          this.rules.push(x), s(x, y);
        }
    };
    c(Xp.map(([m, f]) => [m, null, 0, Object.entries(f)]), 0), c(i.rules, 1);
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
const lh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function nh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [s, u] of Object.entries(n)) {
    if (u == null || u === "" || typeof u == "boolean") continue;
    const c = s.startsWith("--") ? s : s.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), m = typeof u == "number" && u !== 0 && !lh.has(c) && !c.startsWith("--") ? `${u}px` : String(u);
    i.push([c, m]);
  }
  return i;
}
function ih(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const s of ["width", "height"]) {
    const u = n.getAttribute(s);
    u !== null && i.push([s, /^[\d.]+$/.test(u) ? `${u}px` : u]);
  }
  return i;
}
const rh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class oh {
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
    return this.sheet.candidates(i).filter((c) => (!c.media || c.media.every((m) => $p(m, this.viewport))) && kp(i, c.steps, { state: u }));
  }
  compute(i, s, u = /* @__PURE__ */ new Set()) {
    const c = this.matching(i, u), m = [];
    for (const N of c)
      for (const [k, Q, ft] of N.decls) m.push({ prop: k, value: Q, important: ft ? 1 : 0, origin: N.origin === 0 ? 0 : 2, layer: N.layer, specificity: N.specificity, order: N.order, source: N.source });
    for (const [N, k] of ih(i)) m.push({ prop: N, value: k, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${N}` });
    for (const [N, k] of nh(i.props?.style)) m.push({ prop: N, value: k, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    m.sort(rh);
    const f = this.sheet.properties, p = Object.create(s?.customs ?? null), w = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
    for (const N of m) N.prop.startsWith("--") && v.set(N.prop, N.value);
    if (!s && this.theme) for (const N of yd) this.theme[N] && v.set(`--${N}`, `perchtoken(${N})`);
    const q = (N) => {
      if (w.has(N)) return w.get(N);
      const k = f[N];
      return k && !k.inherits ? k.initial ?? null : N in p ? p[N] : k?.initial ?? null;
    }, R = /* @__PURE__ */ new Set(), y = (N) => {
      if (!v.has(N)) return q(N);
      if (R.has(N)) return null;
      R.add(N);
      const k = go(v.get(N), y);
      return R.delete(N), v.delete(N), w.set(N, k), (!f[N] || f[N].inherits) && (p[N] = k), k;
    };
    for (const N of [...v.keys()]) y(N);
    const E = /* @__PURE__ */ new Map();
    for (const N of m) {
      if (N.prop.startsWith("--")) continue;
      const k = go(N.value, q);
      if (k === null) {
        for (const [Q] of yo(N.prop, "unset")) E.set(Q, { value: "unset", source: N.source, origin: N.origin });
        continue;
      }
      for (const [Q, ft] of yo(N.prop, k)) E.set(Q, { value: ft, source: N.source, origin: N.origin });
    }
    const x = {}, T = {}, O = /* @__PURE__ */ new Set(), A = /* @__PURE__ */ new Set(), j = s?.values, G = { fontSize: j?.["font-size"] ?? po, viewport: this.viewport }, V = (N, k) => {
      if (/currentcolor/i.test(k)) return this.parseValue(N, k, G, x, j);
      const Q = `${N}\0${k}\0${G.fontSize}`;
      let ft = this.parsed.get(Q);
      return ft === void 0 && this.parsed.set(Q, ft = this.parseValue(N, k, G, x, j)), ft;
    }, lt = E.size ? [...ho, ...[...E.keys()].filter((N) => !Jp.has(N))] : ho;
    for (const N of lt) {
      const k = E.get(N);
      let Q = k?.value;
      const ft = Zp.has(N);
      if ((Q === void 0 || Q === "unset" || Q === "revert" || Q === "revert-layer") && (Q = ft ? "inherit" : "initial"), k && (T[N] = k.source, k.origin !== 0 && O.add(N)), Q === "inherit" && j && N in j) {
        x[N] = j[N], A.add(N);
        continue;
      }
      (Q === "inherit" || Q === "initial") && (Q = ft ? _d[N] : wd[N]), x[N] = V(N, Q), N === "font-size" && (G.fontSize = x["font-size"]);
    }
    for (const N of an) {
      const k = x[`border-${N}-style`];
      (k === "none" || k === "hidden") && (x[`border-${N}-width`] = { px: 0 });
    }
    x["outline-style"] === "none" && (x["outline-width"] = { px: 0 });
    const J = j?.display;
    return (J === "flex" || J === "inline-flex" || J === "grid" || J === "inline-grid") && x.position !== "absolute" && x.position !== "fixed" && (x.display = Zc(x.display)), (x.position === "absolute" || x.position === "fixed") && (x.display = Zc(x.display)), { values: x, sources: T, own: O, inherited: A, customs: p, rules: c, element: i };
  }
  parseValue(i, s, u, c, m) {
    const f = String(s).trim();
    switch (i) {
      case "font-size": {
        const p = f.toLowerCase(), w = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (w[p]) return w[p];
        if (p === "smaller") return u.fontSize / 1.2;
        if (p === "larger") return u.fontSize * 1.2;
        const v = vo(p, { fontSize: u.fontSize, viewport: u.viewport });
        return !v || v.num ? u.fontSize : v.px + v.pct / 100 * u.fontSize;
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
        const w = vo(p, { fontSize: u.fontSize, viewport: u.viewport });
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
        const p = fi(f, (w) => this.themeHex(w));
        return p === "currentcolor" || !p ? m?.color ?? { rgba: [0, 0, 0, 1], token: null } : p;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const p = fi(f, (w) => this.themeHex(w));
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
        return bo(f, u);
      default:
        return f.toLowerCase().startsWith("var(") ? f : /^[a-z-]+$/i.test(f) ? f.toLowerCase() : f;
    }
  }
}
function Zc(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const pi = (n) => n && n.rgba ? { value: Fp(n.rgba), token: n.token ?? null } : null, sh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function uh(n, i) {
  const s = i?.(n);
  if (Number.isFinite(s)) return s;
  const u = Math.round(n * 100) / 100;
  return sh[u] ?? Math.round(n * 1.2);
}
function Sd(n, i) {
  const s = n["line-height"], u = n["font-size"];
  return s.normal ? uh(u, i) : s.factor !== void 0 ? s.factor * u : s.px;
}
const ch = (n) => ue(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const dh = "perch-native-description/1", ui = Symbol("display"), hi = {
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
}, mh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of mh) hi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
hi.rounded = 0;
const fh = /* @__PURE__ */ new Set([
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
  const s = n.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? n.classList[0];
  if (s) return `${n.tagName}.${s}`;
  const u = n.parentElement;
  return u && u.tagName !== "body" ? `${zd(u)} > ${n.tagName}` : n.tagName;
};
class bh {
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
const na = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
};
function Lc(n, i) {
  const s = n.values, u = {}, c = (A) => n.sources[A], m = (A) => n.sources[A] !== void 0, f = s.display;
  f === "none" ? u.display = "hidden" : f === "flex" || f === "inline-flex" ? u.display = "flex" : (f === "grid" || f === "inline-grid") && (u.display = "flex", u.flex_direction = "col", i("approximated", "display", f, c("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", s["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (u.display = "hidden");
  const p = u.display === "flex";
  if (p && u.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    u.flex_direction = A;
  }
  if (p) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (u.flex_wrap = "wrap");
    const A = f === "grid" || f === "inline-grid", j = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    j && (u.items = j);
    let G = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (A) {
      const J = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      J && (u.items = J), s["align-items"] === "center" && (G = "center");
    }
    G && (u.justify = G);
    const V = na(s["row-gap"]), lt = na(s["column-gap"]);
    typeof V == "number" && V && (u.gap_y = V), typeof lt == "number" && lt && !A && (u.gap_x = lt);
  }
  s["flex-grow"] && (u.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (u.flex_shrink = s["flex-shrink"]);
  const w = na(s["flex-basis"]);
  w !== void 0 && w !== "auto" && (u.flex_basis = w);
  const v = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  v && (u.self = v);
  for (const [A, j] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const G = s[j], V = na(G);
    if (V === void 0) {
      typeof G == "object" && G.expr ? i("unsupported", j, G.expr, c(j), "no calc() in the engine") : typeof G == "string" && !["auto", "none"].includes(G) && i("unsupported", j, G, c(j));
      continue;
    }
    V !== "auto" && (u[A] = V);
  }
  const q = ["top", "right", "bottom", "left"];
  for (const A of q) {
    const j = A[0];
    for (const [G, V] of [["p", "padding"], ["m", "margin"]]) {
      const lt = s[`${V}-${A}`], J = na(lt);
      if (J === void 0) {
        lt?.expr && i("unsupported", `${V}-${A}`, lt.expr, c(`${V}-${A}`), "no calc() in the engine");
        continue;
      }
      J !== 0 && (u[`${G}${j}`] = J);
    }
  }
  const R = s.position;
  if (R === "absolute" || R === "fixed") {
    u.position = "absolute", R === "fixed" && i("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const A of q) {
      const j = na(s[A]);
      j !== void 0 && j !== "auto" && (u[A] = j);
    }
  } else R === "sticky" && i("unsupported", "position", "sticky", c("position"));
  s["z-index"] !== "auto" && m("z-index") && i("unsupported", "z-index", s["z-index"], c("z-index"), "paint order is tree order");
  for (const [A, j] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const G = s[j];
    G === "hidden" || G === "clip" ? u[A] = "hidden" : (G === "auto" || G === "scroll") && (u[A] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (u.visibility = "invisible");
  const y = s["background-color"];
  y?.unreadable ? i("unsupported", "background-color", y.unreadable, c("background-color")) : y?.rgba && y.rgba[3] > 0 && (u.bg = pi(y)), s["background-image"] && s["background-image"] !== "none" && i("unsupported", "background-image", s["background-image"], c("background-image"));
  const E = q.map((A) => na(s[`border-${A}-width`]) || 0), x = [];
  q.forEach((A, j) => {
    if (!E[j]) return;
    u[`border_${A[0]}`] = E[j];
    const G = s[`border-${A}-style`];
    G !== "solid" && i("approximated", `border-${A}-style`, G, c(`border-${A}-style`), "drawn solid");
    const V = pi(s[`border-${A}-color`]);
    V && x.push(V);
  }), x.length && (u.border_color = x[0], x.some((A) => A.value !== x[0].value) && i("approximated", "border-color", x.map((A) => A.value).join(" "), c("border-top-color"), "one border colour"));
  const T = ["top-left", "top-right", "bottom-right", "bottom-left"].map((A) => na(s[`border-${A}-radius`]) || 0);
  T.every((A) => A === T[0]) ? T[0] && (u.rounded = T[0]) : ["tl", "tr", "br", "bl"].forEach((A, j) => {
    T[j] && (u[`rounded_${A}`] = T[j]);
  }), s.opacity !== 1 && (u.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const O = s["box-shadow"];
  if (O && O !== "none" && ue(O, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (u.shadow = "lg", i("approximated", "box-shadow", O, c("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !n.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    A ? u.cursor = A : i("unsupported", "cursor", s.cursor, c("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (u.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? u.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", s["text-decoration-line"], c("text-decoration-line")), u;
}
function Wc(n, i) {
  const s = n.values, u = s["line-height"];
  return {
    text_color: pi(s.color),
    text_size: Math.round(s["font-size"] * 1e3) / 1e3,
    font_weight: s["font-weight"],
    line_height: u.factor !== void 0 ? { factor: u.factor } : { px: Math.round(Sd(s, i) * 1e3) / 1e3 },
    font_family: gh(s["font-family"]),
    italic: s["font-style"] === "italic" || s["font-style"] === "oblique",
    whitespace: s["white-space"] === "nowrap" || s["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[s["text-align"]] ?? "left"
  };
}
const Fc = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, Ed = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function Ic(n, i, s) {
  const u = {}, c = (p, w) => w.some((v) => !n.inherited.has(v));
  for (const [p, w] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]]])
    (c(p, w) || !Ed(i[p], s[p])) && (u[p] = i[p]);
  const m = Fc(i.line_height, i.text_size), f = s.line_height ? Fc(s.line_height, i.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(m - f) <= 1e-3)) && (u.line_height = i.line_height), u;
}
const yh = (n, i) => ({ ...n, ...i });
function $c(n, i) {
  const s = {};
  for (const [u, c] of Object.entries(n))
    c && typeof c == "object" && "value" in c ? (s[u] = c.value, c.token && (i[u] = c.token)) : u === "line_height" ? s[u] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : u === "italic" ? c && (s.italic = !0) : s[u] = c;
  return s.italic === !1 && delete s.italic, s;
}
function xh(n, i) {
  const s = {};
  for (const u of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const c = n[u], m = i[u];
    Ed(c, m) || (s[u] = m === void 0 ? u in hi ? hi[u] : null : m);
  }
  return s;
}
function Pc(n, i) {
  const s = n.values;
  for (const [u, c] of Object.entries(n.sources)) {
    if (u.startsWith("--") || fh.has(u) || c.startsWith("ua:")) continue;
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
        u === "transition-property" && f && ue(f, ",").some((p) => parseFloat(p) > 0) && s["transition-property"] !== "none" && i("unsupported", "transition", `${s["transition-property"]} ${f}`, c, "changes are instant (the engine animates only opacity and size)");
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
        s["outline-style"] !== "none" && u === "outline-style" && i("unsupported", "outline", `${na(s["outline-width"])}px ${s["outline-style"]} ${pi(s["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
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
function wh(n, i, s, u) {
  const c = zd(n), m = [], f = (O, A, j, G, V) => m.push([O, A, j, G ?? "(user agent)", c, V]), p = u.cascade.compute(n, i), w = {}, v = Lc(p, f);
  Pc(p, f);
  const q = Wc(p, u.measure), R = Ic(p, q, s), y = $c({ ...v, ...R }, w), E = {}, x = u.cascade.matching(n, "*").filter((O) => O.states.subject.size);
  for (const [O, A] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!x.some((J) => A.some((N) => J.states.subject.has(N)))) continue;
    const j = u.cascade.compute(n, i, new Set(A)), G = {}, V = $c({ ...Lc(j, () => {
    }), ...Ic(j, Wc(j, u.measure), s) }, G);
    O === "focus" && Pc(j, f);
    const lt = xh(y, V);
    if (Object.keys(lt).length) {
      E[O] = lt;
      const J = Object.fromEntries(Object.entries(G).filter(([N]) => N in lt));
      Object.keys(J).length && (E[`${O}_tokens`] = J);
    }
  }
  u.cascade.sheet.tracks(n, "hover") && (E.track_hover = !0);
  const T = Object.entries(vh).filter(([, O]) => O.some((A) => typeof n.props[A] == "function")).map(([O]) => O);
  return T.length && (E.events = T), { computed: p, style: y, tokens: w, extra: E, meta: kh(n), reports: m, childText: yh(s, R), where: c };
}
function kd(n, i, s, u, c = "") {
  const m = `${c}/${n.id}.${n.version}`;
  let f = u.cache.get(n);
  (!f || f.key !== m) && u.cache.set(n, f = { key: m, part: wh(n, i, s, u) });
  const { computed: p, tokens: w, extra: v, reports: q, childText: R, where: y } = f.part;
  for (const k of q) u.findings.add(...k);
  const E = (k, Q, ft, wt, zt) => u.findings.add(k, Q, ft, wt, y, zt), x = { ...f.part.style }, T = { kind: "div", id: n.id, style: x, tokens: w, meta: f.part.meta, ...v };
  Object.defineProperty(T, ui, { value: p.values.display });
  const O = n.tagName;
  if (O === "svg")
    return T.kind = n.props["data-perch-image"] ? "image" : "svg", T.markup = Th(n), T;
  if (O === "input" || O === "textarea" || O === "select") {
    T.kind = "input", T.input_type = O === "input" ? String(n.props.type ?? "text") : O;
    for (const k of ["value", "defaultValue", "placeholder", "checked", "disabled"]) n.props[k] !== void 0 && (T[k === "defaultValue" ? "value" : k] = n.props[k]);
    return T;
  }
  if (O === "img")
    return T.kind = "image", T.src = n.props.src ?? null, T;
  const A = p.values["text-transform"], j = [];
  let G = !1, V = !1;
  for (const k of n.childNodes) {
    if (k instanceof To) {
      if (k.hidden || k.data === "") continue;
      G = !0;
      const wt = j[j.length - 1];
      if (wt?.kind === "text")
        wt.source = (wt.source ?? wt.text) + k.data, wt.text = ed(wt.source, A), wt.text === wt.source && delete wt.source;
      else {
        const zt = ed(k.data, A);
        j.push(zt === k.data ? { kind: "text", text: zt } : { kind: "text", text: zt, source: k.data });
      }
      continue;
    }
    if (!(k instanceof _e)) continue;
    const Q = kd(k, p, R, u, m), ft = Q[ui];
    ft === "inline" || ft === "inline-block" || ft === "inline-flex" ? G = !0 : ft !== "none" && (V = !0), j.push(Q);
  }
  const lt = j.some((k) => k.kind !== "text"), J = j.length === 1 && j[0].kind !== "text" && /^inline-(block|flex)$/.test(j[0][ui]) ? j[0] : null;
  if (!x.display && J) {
    const k = u.cache.get(n.childNodes.find((ft) => ft.id === J.id))?.part.computed, Q = k ? Nd(p.values, u.measure) - Eh(k.values, u.measure) : 0;
    x.display = "flex", x.flex_direction = "col", x.items = "start", Q > 0 && (J.style.mt = Math.round(((J.style.mt ?? 0) + Q) * 100) / 100), E("approximated", "display", `${p.values.display} holding one ${J[ui]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else !x.display && G && lt && (x.display = "flex", x.flex_direction = V ? "col" : "row", V || (x.items = "baseline"), E("approximated", "display", `${p.values.display} with inline content`, "(inline formatting)", V ? "a column of its children" : "a row on the text baseline"));
  const N = p.values["letter-spacing"]?.px;
  if (N)
    for (let k = 0; k < j.length; k++) {
      const Q = j[k];
      if (Q.kind !== "text") continue;
      const ft = Math.round(N * [...Q.text].length * 1e3) / 1e3;
      j[k] = { kind: "div", style: { pr: ft }, tokens: {}, children: [Q] };
    }
  return T.children = j, T;
}
function _h(n, i) {
  if (!i) return null;
  let u = (i.self ? n : i.closest ? gd(n, i.closest) : i.find ? ln(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return u && i.strip && u.startsWith(i.strip) && (u = u.slice(i.strip.length)), u;
}
function Sh(n, i, s) {
  for (const u of i)
    for (const c of ln(n.documentElement, u.selector)) {
      const m = s.get(c.id);
      if (!m) continue;
      const f = _h(c, u.key);
      m[u.textRange ? "range_name" : "name"] ??= f == null ? u.name : `${u.name}:${f}`;
    }
}
const td = 0.9521, zh = 0.2256, Nd = (n, i) => (Sd(n, i) - (td + zh) * n["font-size"]) / 2 + td * n["font-size"];
function Eh(n, i) {
  const s = (c) => c && typeof c == "object" && "px" in c ? c.px : 0, u = n["border-top-style"] === "none" ? 0 : s(n["border-top-width"]);
  return s(n["padding-top"]) + u + Nd(n, i);
}
const ed = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (s) => s.toUpperCase()) : n, Td = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function kh(n) {
  const i = {};
  for (const [s, u] of Object.entries(n.props)) {
    if (Td.has(s) || typeof u == "function" || u === void 0 || u === null || typeof u == "object") continue;
    const c = s.startsWith("aria-") || s.startsWith("data-");
    if (u === !1 && !c) continue;
    const m = s === "htmlFor" ? "for" : s === "tabIndex" ? "tabindex" : s;
    i[m] = typeof u == "boolean" ? c ? String(u) : "" : String(u);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const Nh = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), ad = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Th(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (s) => {
    const u = [];
    for (const [m, f] of Object.entries(s.props))
      Td.has(m) || typeof f == "function" || f === void 0 || f === null || f === !1 || typeof f == "object" || m.startsWith("data-") || m.startsWith("aria-") || m === "focusable" || m === "role" || m === "title" || u.push(`${Nh(m)}="${ad(f === !0 ? "" : f)}"`);
    s.tagName === "svg" && !s.props.xmlns && u.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = s.childNodes.map((m) => m instanceof To ? ad(m.data) : i(m)).join("");
    return `<${s.tagName}${u.length ? ` ${u.join(" ")}` : ""}>${c}</${s.tagName}>`;
  };
  return i(n);
}
function Ch(n) {
  const i = n.theme?.() ?? {}, s = {};
  for (const u of yd) i[u] && (s[u] = i[u]);
  return s;
}
const jh = {};
function Ah(n, i, s, u = {}, c = null) {
  const m = Ch(i), f = i.viewport?.() ?? { width: 1e3, height: 800 }, p = JSON.stringify([m, f]);
  (u.look !== p || u.sheet !== s) && Object.assign(u, { look: p, sheet: s, cache: /* @__PURE__ */ new WeakMap(), cascade: new oh(s, { theme: m, viewport: f }), top: null });
  const { cascade: w, cache: v } = u, q = { cascade: w, cache: v, findings: new bh(), measure: i.lineHeight ? (E) => i.lineHeight(E) : null };
  u.top ??= w.compute(n.body, w.compute(n.documentElement, null));
  const R = n.body.children.map((E) => kd(E, u.top, jh, q));
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
const Rh = () => Oh ??= new ah(Mh);
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
let Za = nn.NoEventPriority;
function Hh(n, i) {
  const s = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const u of s) {
    if (u === "children") continue;
    const c = n[u], m = i[u];
    if (!(c === m || typeof c == "function" && typeof m == "function") && !(u === "style" && c && m && typeof c == "object" && typeof m == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(m)])].every((p) => c[p] === m[p])))
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
  createInstance: (n, i, s) => new _e(n, i, s.ownerDocument),
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
    n.props = u, Hh(s, u) && n.touch();
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
    Za = n;
  },
  getCurrentUpdatePriority: () => Za,
  resolveUpdatePriority: () => Za !== nn.NoEventPriority ? Za : nn.DefaultEventPriority,
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
}, xe = Qp(Uh), Ao = (n, i, s = null) => xe.createPortal(n, i, null, s), Dh = {
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
function ci(n, i, s) {
  i.currentTarget = n;
  for (const { type: u, listener: c, capture: m } of [...n.listeners ?? []])
    u === i.type && m === s && c.call(n, i);
  if (n instanceof _e) {
    const u = Dh[i.type], c = u && n.props[s ? `${u}Capture` : u];
    typeof c == "function" && c(i);
  }
}
function Dg(n, i, s = {}) {
  const { document: u, window: c } = Ap(n), m = new _e("div", { id: "root", style: s.container ?? {} }, u);
  u.body.appendChild(m);
  const f = [];
  let p = null;
  const w = () => [u, c].map((j) => j.listeners.map((G) => `${G.type}:${G.capture}`).sort().join(",")).join("|");
  let v = "";
  const q = {}, R = () => (p = Ah(u, n, Rh(), q, s.names), v = w(), n.render?.(p), p), y = () => {
    xe.flushPassiveEffects(), xe.flushSyncWork(), w() !== v && R();
  };
  u.afterCommit = R;
  const E = (j) => {
    f.push(j), n.error?.(j);
  }, x = xe.createContainer(m, nn.ConcurrentRoot, null, !1, null, "", E, E, E, null);
  xe.updateContainerSync(Ht.createElement(i, s.props ?? {}), x, null, null), xe.flushSyncWork(), y();
  const T = (j) => {
    const G = (V) => {
      if (V.id === j) return V;
      for (const lt of V.children) {
        const J = G(lt);
        if (J) return J;
      }
      return null;
    };
    return G(u.documentElement);
  }, O = (j) => {
    const G = Za;
    Za = nn.DiscreteEventPriority;
    try {
      return j();
    } finally {
      Za = G, xe.flushSyncWork(), y();
    }
  }, A = {
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
    dispatch(j, G, V = {}) {
      const lt = typeof j == "string" ? T(j) : j;
      if (!lt) return !1;
      const J = new qh(G, V, lt), N = [];
      for (let Q = lt; Q; Q = Q.parentNode) N.push(Q);
      const k = [...N, u, c];
      return O(() => {
        for (let Q = k.length - 1; Q > 0 && !J.propagationStopped; Q--) ci(k[Q], J, !0);
        J.propagationStopped || (ci(lt, J, !0), J.propagationStopped || ci(lt, J, !1));
        for (let Q = 1; Q < k.length && !J.propagationStopped; Q++) ci(k[Q], J, !1);
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
      for (const lt of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) A.dispatch(j, lt, V);
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
        const V = u.activeElement;
        V && V !== G && V !== u.body && A.dispatch(V, "blur"), u.focus(G), A.dispatch(G, "focus");
      }), R());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: y,
    update(j) {
      xe.updateContainerSync(Ht.createElement(i, j ?? {}), x, null, null), xe.flushSyncWork(), y();
    },
    unmount() {
      xe.updateContainerSync(null, x, null, null), xe.flushSyncWork(), xe.flushPassiveEffects(), u.afterCommit = null;
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
  var i, s, u = "";
  if (typeof n == "string" || typeof n == "number") u += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var c = n.length;
    for (i = 0; i < c; i++) n[i] && (s = jd(n[i])) && (u && (u += " "), u += s);
  } else for (s in n) n[s] && (u && (u += " "), u += s);
  return u;
}
function Ad() {
  for (var n, i, s = 0, u = "", c = arguments.length; s < c; s++) (n = arguments[s]) && (i = jd(n)) && (u && (u += " "), u += i);
  return u;
}
const Yh = (n, i) => {
  const s = new Array(n.length + i.length);
  for (let u = 0; u < n.length; u++)
    s[u] = n[u];
  for (let u = 0; u < i.length; u++)
    s[n.length + u] = i[u];
  return s;
}, Gh = (n, i) => ({
  classGroupId: n,
  validator: i
}), Md = (n = /* @__PURE__ */ new Map(), i = null, s) => ({
  nextPart: n,
  validators: i,
  classGroupId: s
}), gi = "-", ld = [], Qh = "arbitrary..", Vh = (n) => {
  const i = Xh(n), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: u
  } = n;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return Kh(f);
      const p = f.split(gi), w = p[0] === "" && p.length > 1 ? 1 : 0;
      return Od(p, w, i);
    },
    getConflictingClassGroupIds: (f, p) => {
      if (p) {
        const w = u[f], v = s[f];
        return w ? v ? Yh(v, w) : w : v || ld;
      }
      return s[f] || ld;
    }
  };
}, Od = (n, i, s) => {
  if (n.length - i === 0)
    return s.classGroupId;
  const c = n[i], m = s.nextPart.get(c);
  if (m) {
    const v = Od(n, i + 1, m);
    if (v) return v;
  }
  const f = s.validators;
  if (f === null)
    return;
  const p = i === 0 ? n.join(gi) : n.slice(i).join(gi), w = f.length;
  for (let v = 0; v < w; v++) {
    const q = f[v];
    if (q.validator(p))
      return q.classGroupId;
  }
}, Kh = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), s = i.indexOf(":"), u = i.slice(0, s);
  return u ? Qh + u : void 0;
})(), Xh = (n) => {
  const {
    theme: i,
    classGroups: s
  } = n;
  return Zh(s, i);
}, Zh = (n, i) => {
  const s = Md();
  for (const u in n) {
    const c = n[u];
    Mo(c, s, u, i);
  }
  return s;
}, Mo = (n, i, s, u) => {
  const c = n.length;
  for (let m = 0; m < c; m++) {
    const f = n[m];
    Jh(f, i, s, u);
  }
}, Jh = (n, i, s, u) => {
  if (typeof n == "string") {
    Lh(n, i, s);
    return;
  }
  if (typeof n == "function") {
    Wh(n, i, s, u);
    return;
  }
  Fh(n, i, s, u);
}, Lh = (n, i, s) => {
  const u = n === "" ? i : Rd(i, n);
  u.classGroupId = s;
}, Wh = (n, i, s, u) => {
  if (Ih(n)) {
    Mo(n(u), i, s, u);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(Gh(s, n));
}, Fh = (n, i, s, u) => {
  const c = Object.entries(n), m = c.length;
  for (let f = 0; f < m; f++) {
    const [p, w] = c[f];
    Mo(w, Rd(i, p), s, u);
  }
}, Rd = (n, i) => {
  let s = n;
  const u = i.split(gi), c = u.length;
  for (let m = 0; m < c; m++) {
    const f = u[m];
    let p = s.nextPart.get(f);
    p || (p = Md(), s.nextPart.set(f, p)), s = p;
  }
  return s;
}, Ih = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, $h = (n) => {
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
}, xo = "!", nd = ":", Ph = [], id = (n, i, s, u, c) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: s,
  maybePostfixModifierPosition: u,
  isExternal: c
}), t0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: s
  } = n;
  let u = (c) => {
    const m = [];
    let f = 0, p = 0, w = 0, v;
    const q = c.length;
    for (let T = 0; T < q; T++) {
      const O = c[T];
      if (f === 0 && p === 0) {
        if (O === nd) {
          m.push(c.slice(w, T)), w = T + 1;
          continue;
        }
        if (O === "/") {
          v = T;
          continue;
        }
      }
      O === "[" ? f++ : O === "]" ? f-- : O === "(" ? p++ : O === ")" && p--;
    }
    const R = m.length === 0 ? c : c.slice(w);
    let y = R, E = !1;
    R.endsWith(xo) ? (y = R.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      R.startsWith(xo) && (y = R.slice(1), E = !0)
    );
    const x = v && v > w ? v - w : void 0;
    return id(m, E, y, x);
  };
  if (i) {
    const c = i + nd, m = u;
    u = (f) => f.startsWith(c) ? m(f.slice(c.length)) : id(Ph, !1, f, void 0, !0);
  }
  if (s) {
    const c = u;
    u = (m) => s({
      className: m,
      parseClassName: c
    });
  }
  return u;
}, e0 = (n) => {
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
}, a0 = (n) => ({
  cache: $h(n.cacheSize),
  parseClassName: t0(n),
  sortModifiers: e0(n),
  postfixLookupClassGroupIds: l0(n),
  ...Vh(n)
}), l0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), s = n.postfixLookupClassGroups;
  if (s)
    for (let u = 0; u < s.length; u++)
      i[s[u]] = !0;
  return i;
}, n0 = /\s+/, i0 = (n, i) => {
  const {
    parseClassName: s,
    getClassGroupId: u,
    getConflictingClassGroupIds: c,
    sortModifiers: m,
    postfixLookupClassGroupIds: f
  } = i, p = [], w = n.trim().split(n0);
  let v = "";
  for (let q = w.length - 1; q >= 0; q -= 1) {
    const R = w[q], {
      isExternal: y,
      modifiers: E,
      hasImportantModifier: x,
      baseClassName: T,
      maybePostfixModifierPosition: O
    } = s(R);
    if (y) {
      v = R + (v.length > 0 ? " " + v : v);
      continue;
    }
    let A = !!O, j;
    if (A) {
      const N = T.substring(0, O);
      j = u(N);
      const k = j && f[j] ? u(T) : void 0;
      k && k !== j && (j = k, A = !1);
    } else
      j = u(T);
    if (!j) {
      if (!A) {
        v = R + (v.length > 0 ? " " + v : v);
        continue;
      }
      if (j = u(T), !j) {
        v = R + (v.length > 0 ? " " + v : v);
        continue;
      }
      A = !1;
    }
    const G = E.length === 0 ? "" : E.length === 1 ? E[0] : m(E).join(":"), V = x ? G + xo : G, lt = V + j;
    if (p.indexOf(lt) > -1)
      continue;
    p.push(lt);
    const J = c(j, A);
    for (let N = 0; N < J.length; ++N) {
      const k = J[N];
      p.push(V + k);
    }
    v = R + (v.length > 0 ? " " + v : v);
  }
  return v;
}, r0 = (...n) => {
  let i = 0, s, u, c = "";
  for (; i < n.length; )
    (s = n[i++]) && (u = Hd(s)) && (c && (c += " "), c += u);
  return c;
}, Hd = (n) => {
  if (typeof n == "string")
    return n;
  let i, s = "";
  for (let u = 0; u < n.length; u++)
    n[u] && (i = Hd(n[u])) && (s && (s += " "), s += i);
  return s;
}, o0 = (n, ...i) => {
  let s, u, c, m;
  const f = (w) => {
    const v = i.reduce((q, R) => R(q), n());
    return s = a0(v), u = s.cache.get, c = s.cache.set, m = p, p(w);
  }, p = (w) => {
    const v = u(w);
    if (v)
      return v;
    const q = i0(w, s);
    return c(w, q), q;
  };
  return m = f, (...w) => m(r0(...w));
}, s0 = [], Qt = (n) => {
  const i = (s) => s[n] || s0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, Ud = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Dd = /^\((?:(\w[\w-]*):)?(.+)\)$/i, u0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, c0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, d0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, m0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, f0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, p0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, za = (n) => u0.test(n), ut = (n) => !!n && !Number.isNaN(Number(n)), Ge = (n) => !!n && Number.isInteger(Number(n)), co = (n) => n.endsWith("%") && ut(n.slice(0, -1)), la = (n) => c0.test(n), qd = () => !0, h0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  d0.test(n) && !m0.test(n)
), Oo = () => !1, g0 = (n) => f0.test(n), v0 = (n) => p0.test(n), b0 = (n) => !X(n) && !Z(n), y0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), x0 = (n) => Ea(n, Gd, Oo), X = (n) => Ud.test(n), Xa = (n) => Ea(n, Qd, h0), rd = (n) => Ea(n, T0, ut), w0 = (n) => Ea(n, Kd, qd), _0 = (n) => Ea(n, Vd, Oo), od = (n) => Ea(n, Bd, Oo), S0 = (n) => Ea(n, Yd, v0), di = (n) => Ea(n, Xd, g0), Z = (n) => Dd.test(n), en = (n) => Ja(n, Qd), z0 = (n) => Ja(n, Vd), sd = (n) => Ja(n, Bd), E0 = (n) => Ja(n, Gd), k0 = (n) => Ja(n, Yd), mi = (n) => Ja(n, Xd, !0), N0 = (n) => Ja(n, Kd, !0), Ea = (n, i, s) => {
  const u = Ud.exec(n);
  return u ? u[1] ? i(u[1]) : s(u[2]) : !1;
}, Ja = (n, i, s = !1) => {
  const u = Dd.exec(n);
  return u ? u[1] ? i(u[1]) : s : !1;
}, Bd = (n) => n === "position" || n === "percentage", Yd = (n) => n === "image" || n === "url", Gd = (n) => n === "length" || n === "size" || n === "bg-size", Qd = (n) => n === "length", T0 = (n) => n === "number", Vd = (n) => n === "family-name", Kd = (n) => n === "number" || n === "weight", Xd = (n) => n === "shadow", C0 = () => {
  const n = Qt("color"), i = Qt("font"), s = Qt("text"), u = Qt("font-weight"), c = Qt("tracking"), m = Qt("leading"), f = Qt("breakpoint"), p = Qt("container"), w = Qt("spacing"), v = Qt("radius"), q = Qt("shadow"), R = Qt("inset-shadow"), y = Qt("text-shadow"), E = Qt("drop-shadow"), x = Qt("blur"), T = Qt("perspective"), O = Qt("aspect"), A = Qt("ease"), j = Qt("animate"), G = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], V = () => [
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
  ], lt = () => [...V(), Z, X], J = () => ["auto", "hidden", "clip", "visible", "scroll"], N = () => ["auto", "contain", "none"], k = () => [Z, X, w], Q = () => [za, "full", "auto", ...k()], ft = () => [Ge, "none", "subgrid", Z, X], wt = () => ["auto", {
    span: ["full", Ge, Z, X]
  }, Ge, Z, X], zt = () => [Ge, "auto", Z, X], Mt = () => ["auto", "min", "max", "fr", Z, X], Jt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], kt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], H = () => ["auto", ...k()], F = () => [za, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...k()], et = () => [p, za, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...k()], it = () => [za, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...k()], B = () => [n, Z, X], g = () => [...V(), sd, od, {
    position: [Z, X]
  }], M = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], I = () => ["auto", "cover", "contain", E0, x0, {
    size: [Z, X]
  }], L = () => [co, en, Xa], W = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    v,
    Z,
    X
  ], $ = () => ["", ut, en, Xa], gt = () => ["solid", "dashed", "dotted", "double"], Vt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], rt = () => [ut, co, sd, od], ka = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    x,
    Z,
    X
  ], Na = () => ["none", ut, Z, X], Te = () => ["none", ut, Z, X], Ce = () => [ut, Z, X], ia = () => [za, "full", ...k()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [la],
      breakpoint: [la],
      color: [qd],
      container: [la],
      "drop-shadow": [la],
      ease: ["in", "out", "in-out"],
      font: [b0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [la],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [la],
      shadow: [la],
      spacing: ["px", ut],
      text: [la],
      "text-shadow": [la],
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
        aspect: ["auto", "square", za, X, Z, O]
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
        columns: [ut, "auto", X, Z, p]
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
        object: lt()
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
        basis: [za, "full", "auto", p, ...k()]
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
        flex: [ut, za, "auto", "initial", "none", X]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ut, Z, X]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ut, Z, X]
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
        "grid-cols": ft()
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
        "grid-rows": ft()
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
        gap: k()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": k()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": k()
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
        "justify-items": [...kt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...kt()]
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
        items: [...kt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...kt(), {
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
        "place-items": [...kt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...kt()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: k()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: k()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: k()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: k()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: k()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: k()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: k()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: k()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: k()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: k()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: k()
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
        "space-x": k()
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
        "space-y": k()
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
            screen: [f]
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
        text: ["base", s, en, Xa]
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
        font: [u, N0, w0]
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
        "line-clamp": [ut, "none", Z, rd]
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
          ...k()
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
        decoration: [ut, "from-font", "auto", Z, Xa]
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
        "underline-offset": [ut, "auto", Z, X]
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
        indent: k()
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
        }, k0, S0]
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
        "outline-offset": [ut, Z, X]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ut, en, Xa]
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
          mi,
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
        "inset-shadow": ["none", R, mi, di]
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
        "ring-offset": [ut, Xa]
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
        "text-shadow": ["none", y, mi, di]
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
        opacity: [ut, Z, X]
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
        "mask-linear": [ut]
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
        "mask-conic": [ut]
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
        blur: ka()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [ut, Z, X]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ut, Z, X]
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
          mi,
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
        grayscale: ["", ut, Z, X]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ut, Z, X]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ut, Z, X]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ut, Z, X]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ut, Z, X]
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
        "backdrop-blur": ka()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [ut, Z, X]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ut, Z, X]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ut, Z, X]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ut, Z, X]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ut, Z, X]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ut, Z, X]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ut, Z, X]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ut, Z, X]
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
        "border-spacing": k()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": k()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": k()
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
        duration: [ut, "initial", Z, X]
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
        delay: [ut, Z, X]
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
        "perspective-origin": lt()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Na()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Na()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Na()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Na()
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
        origin: lt()
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
        translate: ia()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": ia()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": ia()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": ia()
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
        "scroll-m": k()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": k()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": k()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": k()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": k()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": k()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": k()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": k()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": k()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": k()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": k()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": k()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": k()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": k()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": k()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": k()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": k()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": k()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": k()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": k()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": k()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": k()
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
        stroke: [ut, en, Xa, rd]
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
const ud = /* @__PURE__ */ new Map();
function Jd(n, i = Zd) {
  const s = `${i}|${n}`, u = ud.get(s);
  if (u) return u;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const m of n.split("+"))
    if (m === "mod")
      i ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (m === "cmd" || m === "ctrl" || m === "shift" || m === "alt") c[m] = !0;
    else if (/^[a-z]$/.test(m))
      c.code = `Key${m.toUpperCase()}`, c.letter = m;
    else if (/^[0-9]$/.test(m)) c.code = `Digit${m}`;
    else if (vi[m]) c.code = vi[m];
    else throw new Error(`unknown key "${m}" in "${n}"`);
  if (!c.code) throw new Error(`no key in "${n}"`);
  return ud.set(s, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = Jd(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function R0(n, i = Zd) {
  const s = Jd(n, i), u = H0(O0(s.code) ?? "");
  return i ? `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.cmd ? "⌘" : ""}${u}` : [s.ctrl && "Ctrl", s.alt && "Alt", s.shift && "Shift", u].filter(Boolean).join("+");
}
const H0 = (n) => M0[n] ?? n.toUpperCase(), cd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, dd = Ad, bi = (n, i) => (s) => {
  var u;
  if (i?.variants == null) return dd(n, s?.class, s?.className);
  const { variants: c, defaultVariants: m } = i, f = Object.keys(c).map((v) => {
    const q = s?.[v], R = m?.[v];
    if (q === null) return null;
    const y = cd(q) || cd(R);
    return c[v][y];
  }), p = s && Object.entries(s).reduce((v, q) => {
    let [R, y] = q;
    return y === void 0 || (v[R] = y), v;
  }, {}), w = i == null || (u = i.compoundVariants) === null || u === void 0 ? void 0 : u.reduce((v, q) => {
    let { class: R, className: y, ...E } = q;
    return Object.entries(E).every((x) => {
      let [T, O] = x;
      return Array.isArray(O) ? O.includes({
        ...m,
        ...p
      }[T]) : {
        ...m,
        ...p
      }[T] === O;
    }) ? [
      ...v,
      R,
      y
    ] : v;
  }, []);
  return dd(n, f, w, s?.class, s?.className);
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
const md = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function J0({ state: n, error: i }) {
  return /* @__PURE__ */ Pt.jsx(
    "span",
    {
      className: Qe("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", md[n] ?? md.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function L0({ title: n, onClose: i, children: s, testId: u }) {
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
            "data-testid": u,
            children: [
              /* @__PURE__ */ Pt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              s
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
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((s) => s.id === n.parentSessionId);
}
function F0(n) {
  const i = /* @__PURE__ */ new Map();
  for (const s of n)
    _o(s, n) && i.set(s.parentSessionId, [...i.get(s.parentSessionId) ?? [], s]);
  return i.size ? n.filter((s) => !_o(s, n)).flatMap((s) => [s, ...i.get(s.id) ?? []]) : n;
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
}), P0 = globalThis.perch?.isMac !== !1, tg = (n) => R0(n, ce().isMac !== !1), eg = (n) => U0(n), ag = ({ className: n, ...i } = {}) => Qe(q0(i), n), lg = Y0, ng = (n) => Q0(n), ig = V0, rg = Wd, og = Ld, sg = (n) => wo[n].color, ug = (n, i) => ce().command(n, i ?? {}) !== !1, cg = (n, i, s) => ce().startSession?.(n, i, s), dg = globalThis.perch?.pickFolder ? (n) => ce().pickFolder(n) : null;
function rn(n) {
  const i = Ht.useRef(n);
  return i.current = n, Ht.useSyncExternalStore($0, () => i.current(ce()));
}
const mg = (n = {}) => rn((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), fg = () => rn((n) => n.hosts()), pg = () => rn((n) => n.sessionFolders());
function hg() {
  const n = rn((i) => i.addProject?.() ?? gg);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, s, u) => {
      i.trim() && n.status !== "pending" && ce().addProjectFolder?.(i, s, u);
    },
    clear: () => ce().clearAddProject?.()
  };
}
const gg = Object.freeze({ status: "idle" });
function vg(n) {
  Ht.useEffect(() => ce().onRequest?.("add-project", n) ?? void 0, [n]);
}
function bg(n) {
  const i = n.map((s) => ({ id: s.id, parentSessionId: s.parentId, session: s }));
  return F0(i).map((s) => ({ session: s.session, nested: _o(s, i) }));
}
function yg({ id: n, plain: i, className: s }) {
  const u = rn((v) => v.session(n));
  if (!u) return null;
  const c = u.state ?? W0(u), m = wo[c]?.color ?? wo.unknown.color, f = u.provider, p = f === "claude" || f === "claude-agent-teams" || f === "omp", w = i ? Qe("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", s) : Qe("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", s);
  return Ht.createElement(
    "span",
    { className: w, style: i ? void 0 : { borderColor: m }, "data-provider": f ?? "unknown", title: i ? f ?? "Agent" : `${f ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    Ht.createElement("span", { className: Qe("inline-flex text-fg", p && "rounded-full bg-[#161616]") }, Ht.createElement(Id, { provider: f, size: 14 }))
  );
}
function Id({ provider: n, size: i = 14 }) {
  const s = ce().agentIcon?.(n, i) ?? null, u = s?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return Ht.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": u, ...s && s.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const xg = ({ children: n }) => Ht.createElement(Ht.Fragment, null, n);
function wg(n, i) {
  const s = Ht.useRef(i);
  return s.current = i, Ht.useEffect(() => {
    const u = ce();
    if (!u.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const c = {};
    for (const [f, p] of Object.entries(s.current))
      c[f] = typeof p == "function" ? (...w) => s.current[f]?.(...w) : p;
    const m = u.openOverlay(n, c);
    return () => u.closeOverlay?.(m);
  }, [n]), null;
}
const Sl = (n) => function(s) {
  return wg(n, s);
}, _g = Sl("session-menu"), Sg = Sl("new-session-menu"), zg = Sl("confirm");
function Eg({ value: n, onChange: i, options: s = [], className: u, ariaLabel: c, testId: m, title: f, disabled: p, placeholder: w }) {
  const v = Ht.useRef(null), q = s.find((R) => R.value === n);
  return Ht.createElement(
    "button",
    {
      type: "button",
      ref: v,
      title: f,
      disabled: p,
      "aria-label": c,
      "data-testid": m,
      "aria-haspopup": "listbox",
      className: Qe("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", u),
      onClick: () => ce().openOverlay?.("select", { value: n, options: s, onChange: (R) => i?.(R), anchor: v.current?.getBoundingClientRect() })
    },
    Ht.createElement("span", { className: "min-w-0 flex-1 truncate" }, q ? q.label : w ?? "")
  );
}
const kg = Sl("folder-browser"), Ng = Sl("instructions"), Tg = Sl("memory"), Cg = L0;
function jg({ hostId: n, path: i, className: s }) {
  const u = Ht.useRef(null);
  return Ht.createElement(
    "button",
    {
      type: "button",
      ref: u,
      className: Qe("worktree-menu__btn", Ld, s),
      "data-testid": `worktree-menu-${n}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => ce().openOverlay?.("worktree", { hostId: n, cwd: i, anchor: u.current?.getBoundingClientRect() })
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
  FolderBrowser: kg,
  GearIcon: X0,
  HostStateDot: J0,
  InstructionsDialog: Ng,
  MemoryDialog: Tg,
  NewSessionMenu: Sg,
  PlusIcon: Fd,
  Select: Eg,
  SessionDot: yg,
  SessionMenu: _g,
  Slot: xg,
  WorktreeMenu: jg,
  agentStateColor: sg,
  beginReorderDrag: Ag,
  buttonClass: lg,
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
  rowActionClass: ag,
  runCommand: ug,
  segmentClass: eg,
  startSession: cg,
  useAddProject: hg,
  useAddProjectRequest: vg,
  useHosts: fg,
  useNavigation: mg,
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
  Ro[n] = (i, s) => i[n](s);
const Yg = Object.keys(Ro);
function fd(n, i) {
  for (const [s, u] of Object.entries(i)) {
    const c = Ro[s];
    if (!c) throw new Error(`the description key ${s} has no GPUI builder`);
    u != null && (n = c(n, u));
  }
  return n;
}
const wl = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 });
function Mg(n, i, s) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || s)) return null;
  const u = n.meta?.attrs["data-testid"];
  return u ? `~${n.id}:${u}` : `~${n.id}`;
}
const Og = (n) => n.style?.display !== "hidden";
function So(n, i, s, u, c = !1, m = !1, f = null, p = {}) {
  if (n.kind === "text") return n.text;
  m ||= n.style.opacity === 0 || n.style.visibility === "invisible", m && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0 }), f = n.style.text_color ?? f, p = { ...p };
  for (const x of ["text_size", "line_height", "whitespace"]) n.style[x] !== void 0 && (p[x] = n.style[x]);
  const w = new Set(n.events ?? []);
  let v;
  n.kind === "image" && !n.markup ? v = i.image(n.src) : v = i.div(), n.markup && (v = v.child(u.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? f : "")));
  const q = Mg(n, w, c);
  q && (v = v.id(q)), v = fd(v, n.style);
  for (const x of ["hover", "focus", "active"]) n[x] && (v = v[x]((T) => fd(T, n[x])));
  ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((x) => w.has(x)) && (v = v.on_mouse_down("left", (x, T) => {
    T.stop_propagation?.(), x.bounds && s.setBounds(n.id, x.bounds);
    const O = { ...wl(x), button: 0, buttons: 1, detail: x.click_count };
    s.dispatch(n.id, "pointerdown", { ...O, pointerType: "mouse" }), s.dispatch(n.id, "mousedown", O), T.notify();
  }), v = v.on_mouse_down("right", (x, T) => {
    T.stop_propagation?.(), x.bounds && s.setBounds(n.id, x.bounds), s.dispatch(n.id, "contextmenu", { ...wl(x), button: 2 }), T.notify();
  }), v = v.on_mouse_up("left", (x, T) => {
    T.stop_propagation?.();
    const O = { ...wl(x), button: 0 };
    s.dispatch(n.id, "pointerup", { ...O, pointerType: "mouse" }), s.dispatch(n.id, "mouseup", O), T.notify();
  }), v = v.on_click((x, T) => {
    s.dispatch(n.id, x.click_count === 2 && w.has("double_click") ? "dblclick" : "click", { detail: x.click_count, button: 0 }), T.notify();
  })), w.has("mouse_move") && (v = v.on_mouse_move((x, T) => {
    s.dispatch(n.id, "pointermove", { ...wl(x), pointerType: "mouse" }), T.notify();
  })), n.track_hover && (v = v.on_hover((x, T) => {
    s.hover(n.id, x), T.notify();
  })), c && (v = v.on_mouse_down_out((x, T) => {
    s.dispatch(s.document.body.id, "pointerdown", { ...wl(x), pointerType: "mouse" }), s.dispatch(s.document.body.id, "mousedown", wl(x)), T.notify();
  }));
  const y = p.whitespace === "nowrap" ? Rg(p) : null;
  let E = !n.range_name;
  for (const x of (n.children ?? []).filter(Og)) {
    let T = So(x, i, s, u, !1, m, f, p);
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
function Gg(n, i, s, u) {
  let c = i.div().relative().size_full().child(So(n.root, i, s, u));
  for (const m of n.overlays) c = c.child(So(m, i, s, u, !0));
  return c;
}
const Qg = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }] };
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
