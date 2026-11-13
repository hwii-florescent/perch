function pf(a, i) {
  for (var u = 0; u < i.length; u++) {
    const c = i[u];
    if (typeof c != "string" && !Array.isArray(c)) {
      for (const s in c)
        if (s !== "default" && !(s in a)) {
          const d = Object.getOwnPropertyDescriptor(c, s);
          d && Object.defineProperty(a, s, d.get ? d : {
            enumerable: !0,
            get: () => c[s]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(a, Symbol.toStringTag, { value: "Module" }));
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
const pp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), hp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), vp = /* @__PURE__ */ new Set(["first-child", "last-child", "root", ...pp]);
function co(a) {
  return a.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, u, c) => u ? String.fromCodePoint(parseInt(u, 16)) : c);
}
function ii(a, i) {
  let u = i;
  for (; u < a.length; ) {
    const c = a[u];
    if (c === "\\") {
      u += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(c)) {
      u++;
      continue;
    }
    break;
  }
  if (u === i) throw new we(`expected a name at ${i} in ${JSON.stringify(a)}`);
  return [co(a.slice(i, u)), u];
}
function gp(a, i) {
  let u = 1;
  for (let c = i; c < a.length; c++) {
    const s = a[c];
    if (s === "\\") {
      c++;
      continue;
    }
    if (s === '"' || s === "'") {
      if (c = a.indexOf(s, c + 1), c < 0) break;
      continue;
    }
    if (s === "(") u++;
    else if (s === ")" && --u === 0) return c;
  }
  throw new we(`unbalanced parenthesis in ${JSON.stringify(a)}`);
}
function So(a) {
  const i = [];
  let u = 0, c = 0;
  for (let s = 0; s < a.length; s++) {
    const d = a[s];
    if (d === "\\") {
      s++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (s = a.indexOf(d, s + 1), s < 0) break;
      continue;
    }
    d === "(" || d === "[" ? u++ : d === ")" || d === "]" ? u-- : d === "," && u === 0 && (i.push(a.slice(c, s).trim()), c = s + 1);
  }
  return i.push(a.slice(c).trim()), i.filter(Boolean);
}
function bp(a, i) {
  const u = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let c = !1;
  for (; i < a.length; ) {
    const s = a[i];
    if (s === "*") {
      u.tag = "*", i++, c = !0;
      continue;
    }
    if (s === ".") {
      const [d, m] = ii(a, i + 1);
      u.classes.push(d), i = m, c = !0;
      continue;
    }
    if (s === "#") {
      const [d, m] = ii(a, i + 1);
      u.id = d, i = m, c = !0;
      continue;
    }
    if (s === "[") {
      const d = a.indexOf("]", i);
      if (d < 0) throw new we(`unclosed [ in ${JSON.stringify(a)}`);
      const m = a.slice(i + 1, d).trim(), h = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!h) throw new we(`cannot read the attribute selector [${m}]`);
      const g = h[3] ?? h[4] ?? h[5];
      u.attrs.push({ name: co(h[1]).toLowerCase(), op: h[2] ?? null, value: g === void 0 ? null : co(g) }), i = d + 1, c = !0;
      continue;
    }
    if (s === ":") {
      if (a[i + 1] === ":") throw new we(`pseudo-elements are not supported (${JSON.stringify(a)})`);
      const [d, m] = ii(a, i + 1);
      i = m;
      const h = d.toLowerCase();
      if (a[i] === "(") {
        if (!hp.has(h)) throw new we(`:${h}() is not supported`);
        const g = gp(a, i + 1), y = a.slice(i + 1, g).trim();
        if (i = g + 1, h === "nth-child") {
          if (!/^\d+$/.test(y)) throw new we(`:nth-child(${y}) is not supported (only a number)`);
          u.pseudos.push({ name: h, n: Number(y) });
        } else
          u.pseudos.push({ name: h, list: So(y).map(zo) });
      } else {
        if (!vp.has(h)) throw new we(`:${h} is not supported`);
        u.pseudos.push({ name: h });
      }
      c = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !c) {
      const [d, m] = ii(a, i);
      u.tag = d.toLowerCase(), i = m, c = !0;
      continue;
    }
    break;
  }
  if (!c) throw new we(`empty compound selector at ${i} in ${JSON.stringify(a)}`);
  return [u, i];
}
function zo(a) {
  const i = [];
  let u = 0, c = null;
  for (a = a.trim(); u < a.length; ) {
    const [s, d] = bp(a, u);
    i.push({ compound: s, combinator: c }), u = d;
    let m = !1;
    for (; a[u] === " " || a[u] === `
` || a[u] === "	"; )
      u++, m = !0;
    if (u >= a.length) break;
    const h = a[u];
    if (h === ">")
      for (c = ">", u++; a[u] === " "; ) u++;
    else {
      if (h === "+" || h === "~") throw new we(`the ${h} combinator is not supported`);
      if (m) c = " ";
      else throw new we(`unexpected ${JSON.stringify(h)} in ${JSON.stringify(a)}`);
    }
  }
  if (!i.length) throw new we("empty selector");
  return i;
}
const ks = /* @__PURE__ */ new Map();
function Eo(a) {
  let i = ks.get(a);
  return i || (i = So(a).map(zo), ks.set(a, i)), i;
}
function hf(a) {
  const i = [0, 0, 0], u = (c) => {
    i[0] += c[0], i[1] += c[1], i[2] += c[2];
  };
  for (const { compound: c } of a) {
    c.id && i[0]++, i[1] += c.classes.length + c.attrs.length, c.tag && c.tag !== "*" && i[2]++;
    for (const s of c.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(hf).sort((m, h) => h[0] - m[0] || h[1] - m[1] || h[2] - m[2])[0];
          u(d);
        } else i[1]++;
  }
  return i;
}
function yp(a, { name: i, op: u, value: c }) {
  const s = a.getAttribute(i);
  if (s == null) return !1;
  if (u === null) return !0;
  switch (u) {
    case "=":
      return s === c;
    case "^=":
      return c !== "" && s.startsWith(c);
    case "$=":
      return c !== "" && s.endsWith(c);
    case "*=":
      return c !== "" && s.includes(c);
    case "~=":
      return s.split(/\s+/).includes(c);
    case "|=":
      return s === c || s.startsWith(`${c}-`);
    default:
      return !1;
  }
}
function to(a) {
  return a.parentElement ? a.parentElement.children : [a];
}
function xp(a, i, u, c) {
  if (i.tag && i.tag !== "*" && a.tagName !== i.tag || i.id && a.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const s = a.classList ?? [];
    for (const d of i.classes) if (!s.includes(d)) return !1;
  }
  for (const s of i.attrs) if (!yp(a, s)) return !1;
  for (const s of i.pseudos)
    switch (s.name) {
      case "first-child":
        if (to(a)[0] !== a) return !1;
        break;
      case "last-child": {
        const d = to(a);
        if (d[d.length - 1] !== a) return !1;
        break;
      }
      case "nth-child":
        if (to(a).indexOf(a) !== s.n - 1) return !1;
        break;
      case "root":
        if (!a.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => Sn(a, d, u, c))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((d) => Sn(a, d, u, c))) return !1;
        break;
      default:
        if (!u.state || !u.state(a, s.name, c)) return !1;
    }
  return !0;
}
function Sn(a, i, u, c = !0) {
  const s = (d, m, h) => {
    const { compound: g, combinator: y } = i[m];
    if (!xp(d, g, u, h)) return !1;
    if (m === 0) return !0;
    if (y === ">") return !!d.parentElement && s(d.parentElement, m - 1, !1);
    for (let R = d.parentElement; R; R = R.parentElement) if (s(R, m - 1, !1)) return !0;
    return !1;
  };
  return s(a, i.length - 1, c);
}
function wp(a, i, u = {}) {
  return (typeof i == "string" ? Eo(i) : i).some((s) => Sn(a, s, u));
}
function _p(a, i, u = {}) {
  return Sn(a, i, u);
}
function so(a, i, u = {}) {
  const c = Eo(i), s = [], d = (m) => {
    for (const h of m.children)
      c.some((g) => Sn(h, g, u)) && s.push(h), d(h);
  };
  return d(a), s;
}
function Sp(a, i, u = {}) {
  const c = Eo(i);
  for (let s = a; s; s = s.parentElement) if (c.some((d) => Sn(s, d, u))) return s;
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
let zp = 1;
class fo {
  constructor(i = 0, u = 0, c = 0, s = 0) {
    this.x = i, this.y = u, this.width = c, this.height = s;
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
  addEventListener(i, u, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners.some((d) => d.type === i && d.listener === u && d.capture === s) || this.listeners.push({ type: i, listener: u, capture: s });
  }
  removeEventListener(i, u, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === i && d.listener === u && d.capture === s));
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
  constructor(i, u = {}, c = null) {
    super(), this.nodeType = 1, this.id = `n${zp++}`, this.tagName = i.toLowerCase(), this.props = u, this.childNodes = [], this.parentNode = null, this.ownerDocument = c, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    for (const [u, c] of Object.entries(this.props))
      u.startsWith("data-") && c != null && c !== !1 && (i[u.slice(5).replace(/-([a-z])/g, (s, d) => d.toUpperCase())] = String(c));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const u = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return u.id != null ? String(u.id) : null;
    if (i === "style") return null;
    let s = u[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (s === void 0 && !i.includes("-")) {
      const d = i.replace(/-([a-z])/g, (m, h) => h.toUpperCase());
      s = u[d];
    }
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(i) {
    return this.getAttribute(i) !== null;
  }
  appendChild(i) {
    return i.parentNode && i.parentNode.removeChild(i), i.parentNode = this, this.childNodes.push(i), this.touch(), i;
  }
  insertBefore(i, u) {
    i.parentNode && i.parentNode.removeChild(i);
    const c = this.childNodes.indexOf(u);
    return i.parentNode = this, c < 0 ? this.childNodes.push(i) : this.childNodes.splice(c, 0, i), this.touch(), i;
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
    return wp(this, i);
  }
  closest(i) {
    return Sp(this, i);
  }
  querySelectorAll(i) {
    return so(this, i);
  }
  querySelector(i) {
    return so(this, i)[0] ?? null;
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
class Ep {
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
function As(a) {
  for (let i = a; i instanceof _e; i = i.parentElement) i.touch();
}
class Np extends No {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new _e("html", {}, this), this.body = new _e("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new _e(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, As(i);
  }
  blur(i) {
    i.state.focus = !1, As(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return so(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
}
class Tp extends No {
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
  setTimeout(i, u, ...c) {
    return globalThis.setTimeout(i, u, ...c);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function vf(a) {
  return {
    setTimeout: (i, u = 0, ...c) => a.setTimeout(() => i(...c), Math.max(0, Number(u) || 0)),
    clearTimeout: (i) => {
      i != null && a.clearTimeout(i);
    }
  };
}
function je(a, i, u) {
  Object.defineProperty(a, i, { value: u, configurable: !0, writable: !0, enumerable: !1 });
}
function Cp(a, i = globalThis) {
  const u = new Np(a), c = new Tp(a, u);
  u.defaultView = c;
  const s = a.storage ?? new Ep();
  if (typeof i.setTimeout != "function") {
    if (typeof a.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const m = vf(a);
    je(i, "setTimeout", m.setTimeout), je(i, "clearTimeout", m.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && je(i, "queueMicrotask", (m) => {
    Promise.resolve().then(m);
  }), je(i, "document", u), je(i, "window", c), je(i, "localStorage", s), je(i, "HTMLElement", _e), je(i, "Element", _e), je(i, "DOMRect", fo);
  const d = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!d.clipboard && a.clipboard)
    try {
      je(d, "clipboard", a.clipboard);
    } catch {
    }
  return i.navigator || je(i, "navigator", d), { document: u, window: c };
}
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Ms = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Ms?.setTimeout == "function") {
  const a = vf(Ms);
  globalThis.setTimeout = a.setTimeout, globalThis.clearTimeout = a.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (a) => {
  Promise.resolve().then(a);
});
function Co(a) {
  return a && a.__esModule && Object.prototype.hasOwnProperty.call(a, "default") ? a.default : a;
}
var eo = { exports: {} }, at = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Os;
function kp() {
  if (Os) return at;
  Os = 1;
  var a = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), u = Symbol.for("react.fragment"), c = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), h = Symbol.for("react.forward_ref"), g = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), R = Symbol.for("react.lazy"), H = Symbol.for("react.activity"), x = Symbol.iterator;
  function E(v) {
    return v === null || typeof v != "object" ? null : (v = x && v[x] || v["@@iterator"], typeof v == "function" ? v : null);
  }
  var T = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, B = Object.assign, D = {};
  function M(v, k, I) {
    this.props = v, this.context = k, this.refs = D, this.updater = I || T;
  }
  M.prototype.isReactComponent = {}, M.prototype.setState = function(v, k) {
    if (typeof v != "object" && typeof v != "function" && v != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, v, k, "setState");
  }, M.prototype.forceUpdate = function(v) {
    this.updater.enqueueForceUpdate(this, v, "forceUpdate");
  };
  function A() {
  }
  A.prototype = M.prototype;
  function G(v, k, I) {
    this.props = v, this.context = k, this.refs = D, this.updater = I || T;
  }
  var K = G.prototype = new A();
  K.constructor = G, B(K, M.prototype), K.isPureReactComponent = !0;
  var nt = Array.isArray;
  function Q() {
  }
  var z = { H: null, A: null, T: null, S: null }, N = Object.prototype.hasOwnProperty;
  function V(v, k, I) {
    var L = I.ref;
    return {
      $$typeof: a,
      type: v,
      key: k,
      ref: L !== void 0 ? L : null,
      props: I
    };
  }
  function yt(v, k) {
    return V(v.type, k, v.props);
  }
  function Pt(v) {
    return typeof v == "object" && v !== null && v.$$typeof === a;
  }
  function qt(v) {
    var k = { "=": "=0", ":": "=2" };
    return "$" + v.replace(/[=:]/g, function(I) {
      return k[I];
    });
  }
  var At = /\/+/g;
  function Zt(v, k) {
    return typeof v == "object" && v !== null && v.key != null ? qt("" + v.key) : k.toString(36);
  }
  function zt(v) {
    switch (v.status) {
      case "fulfilled":
        return v.value;
      case "rejected":
        throw v.reason;
      default:
        switch (typeof v.status == "string" ? v.then(Q, Q) : (v.status = "pending", v.then(
          function(k) {
            v.status === "pending" && (v.status = "fulfilled", v.value = k);
          },
          function(k) {
            v.status === "pending" && (v.status = "rejected", v.reason = k);
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
  function O(v, k, I, L, W) {
    var $ = typeof v;
    ($ === "undefined" || $ === "boolean") && (v = null);
    var ht = !1;
    if (v === null) ht = !0;
    else
      switch ($) {
        case "bigint":
        case "string":
        case "number":
          ht = !0;
          break;
        case "object":
          switch (v.$$typeof) {
            case a:
            case i:
              ht = !0;
              break;
            case R:
              return ht = v._init, O(
                ht(v._payload),
                k,
                I,
                L,
                W
              );
          }
      }
    if (ht)
      return W = W(v), ht = L === "" ? "." + Zt(v, 0) : L, nt(W) ? (I = "", ht != null && (I = ht.replace(At, "$&/") + "/"), O(W, k, I, "", function(Nl) {
        return Nl;
      })) : W != null && (Pt(W) && (W = yt(
        W,
        I + (W.key == null || v && v.key === W.key ? "" : ("" + W.key).replace(
          At,
          "$&/"
        ) + "/") + ht
      )), k.push(W)), 1;
    ht = 0;
    var Qt = L === "" ? "." : L + ":";
    if (nt(v))
      for (var rt = 0; rt < v.length; rt++)
        L = v[rt], $ = Qt + Zt(L, rt), ht += O(
          L,
          k,
          I,
          $,
          W
        );
    else if (rt = E(v), typeof rt == "function")
      for (v = rt.call(v), rt = 0; !(L = v.next()).done; )
        L = L.value, $ = Qt + Zt(L, rt++), ht += O(
          L,
          k,
          I,
          $,
          W
        );
    else if ($ === "object") {
      if (typeof v.then == "function")
        return O(
          zt(v),
          k,
          I,
          L,
          W
        );
      throw k = String(v), Error(
        "Objects are not valid as a React child (found: " + (k === "[object Object]" ? "object with keys {" + Object.keys(v).join(", ") + "}" : k) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return ht;
  }
  function F(v, k, I) {
    if (v == null) return v;
    var L = [], W = 0;
    return O(v, L, "", "", function($) {
      return k.call(I, $, W++);
    }), L;
  }
  function et(v) {
    if (v._status === -1) {
      var k = v._result;
      k = k(), k.then(
        function(I) {
          (v._status === 0 || v._status === -1) && (v._status = 1, v._result = I);
        },
        function(I) {
          (v._status === 0 || v._status === -1) && (v._status = 2, v._result = I);
        }
      ), v._status === -1 && (v._status = 0, v._result = k);
    }
    if (v._status === 1) return v._result.default;
    throw v._result;
  }
  var it = typeof reportError == "function" ? reportError : function(v) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var k = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof v == "object" && v !== null && typeof v.message == "string" ? String(v.message) : String(v),
        error: v
      });
      if (!window.dispatchEvent(k)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", v);
      return;
    }
    console.error(v);
  }, q = {
    map: F,
    forEach: function(v, k, I) {
      F(
        v,
        function() {
          k.apply(this, arguments);
        },
        I
      );
    },
    count: function(v) {
      var k = 0;
      return F(v, function() {
        k++;
      }), k;
    },
    toArray: function(v) {
      return F(v, function(k) {
        return k;
      }) || [];
    },
    only: function(v) {
      if (!Pt(v))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return v;
    }
  };
  return at.Activity = H, at.Children = q, at.Component = M, at.Fragment = u, at.Profiler = s, at.PureComponent = G, at.StrictMode = c, at.Suspense = g, at.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = z, at.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(v) {
      return z.H.useMemoCache(v);
    }
  }, at.cache = function(v) {
    return function() {
      return v.apply(null, arguments);
    };
  }, at.cacheSignal = function() {
    return null;
  }, at.cloneElement = function(v, k, I) {
    if (v == null)
      throw Error(
        "The argument must be a React element, but you passed " + v + "."
      );
    var L = B({}, v.props), W = v.key;
    if (k != null)
      for ($ in k.key !== void 0 && (W = "" + k.key), k)
        !N.call(k, $) || $ === "key" || $ === "__self" || $ === "__source" || $ === "ref" && k.ref === void 0 || (L[$] = k[$]);
    var $ = arguments.length - 2;
    if ($ === 1) L.children = I;
    else if (1 < $) {
      for (var ht = Array($), Qt = 0; Qt < $; Qt++)
        ht[Qt] = arguments[Qt + 2];
      L.children = ht;
    }
    return V(v.type, W, L);
  }, at.createContext = function(v) {
    return v = {
      $$typeof: m,
      _currentValue: v,
      _currentValue2: v,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, v.Provider = v, v.Consumer = {
      $$typeof: d,
      _context: v
    }, v;
  }, at.createElement = function(v, k, I) {
    var L, W = {}, $ = null;
    if (k != null)
      for (L in k.key !== void 0 && ($ = "" + k.key), k)
        N.call(k, L) && L !== "key" && L !== "__self" && L !== "__source" && (W[L] = k[L]);
    var ht = arguments.length - 2;
    if (ht === 1) W.children = I;
    else if (1 < ht) {
      for (var Qt = Array(ht), rt = 0; rt < ht; rt++)
        Qt[rt] = arguments[rt + 2];
      W.children = Qt;
    }
    if (v && v.defaultProps)
      for (L in ht = v.defaultProps, ht)
        W[L] === void 0 && (W[L] = ht[L]);
    return V(v, $, W);
  }, at.createRef = function() {
    return { current: null };
  }, at.forwardRef = function(v) {
    return { $$typeof: h, render: v };
  }, at.isValidElement = Pt, at.lazy = function(v) {
    return {
      $$typeof: R,
      _payload: { _status: -1, _result: v },
      _init: et
    };
  }, at.memo = function(v, k) {
    return {
      $$typeof: y,
      type: v,
      compare: k === void 0 ? null : k
    };
  }, at.startTransition = function(v) {
    var k = z.T, I = {};
    z.T = I;
    try {
      var L = v(), W = z.S;
      W !== null && W(I, L), typeof L == "object" && L !== null && typeof L.then == "function" && L.then(Q, it);
    } catch ($) {
      it($);
    } finally {
      k !== null && I.types !== null && (k.types = I.types), z.T = k;
    }
  }, at.unstable_useCacheRefresh = function() {
    return z.H.useCacheRefresh();
  }, at.use = function(v) {
    return z.H.use(v);
  }, at.useActionState = function(v, k, I) {
    return z.H.useActionState(v, k, I);
  }, at.useCallback = function(v, k) {
    return z.H.useCallback(v, k);
  }, at.useContext = function(v) {
    return z.H.useContext(v);
  }, at.useDebugValue = function() {
  }, at.useDeferredValue = function(v, k) {
    return z.H.useDeferredValue(v, k);
  }, at.useEffect = function(v, k) {
    return z.H.useEffect(v, k);
  }, at.useEffectEvent = function(v) {
    return z.H.useEffectEvent(v);
  }, at.useId = function() {
    return z.H.useId();
  }, at.useImperativeHandle = function(v, k, I) {
    return z.H.useImperativeHandle(v, k, I);
  }, at.useInsertionEffect = function(v, k) {
    return z.H.useInsertionEffect(v, k);
  }, at.useLayoutEffect = function(v, k) {
    return z.H.useLayoutEffect(v, k);
  }, at.useMemo = function(v, k) {
    return z.H.useMemo(v, k);
  }, at.useOptimistic = function(v, k) {
    return z.H.useOptimistic(v, k);
  }, at.useReducer = function(v, k, I) {
    return z.H.useReducer(v, k, I);
  }, at.useRef = function(v) {
    return z.H.useRef(v);
  }, at.useState = function(v) {
    return z.H.useState(v);
  }, at.useSyncExternalStore = function(v, k, I) {
    return z.H.useSyncExternalStore(
      v,
      k,
      I
    );
  }, at.useTransition = function() {
    return z.H.useTransition();
  }, at.version = "19.2.8", at;
}
var Hs;
function gf() {
  return Hs || (Hs = 1, eo.exports = kp()), eo.exports;
}
var Ht = gf();
const Ap = /* @__PURE__ */ Co(Ht), Nv = /* @__PURE__ */ pf({
  __proto__: null,
  default: Ap
}, [Ht]);
var lo = { exports: {} }, ea = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Rs;
function Mp() {
  if (Rs) return ea;
  Rs = 1;
  var a = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function u(c, s, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), s.key !== void 0 && (m = "" + s.key), "key" in s) {
      d = {};
      for (var h in s)
        h !== "key" && (d[h] = s[h]);
    } else d = s;
    return s = d.ref, {
      $$typeof: a,
      type: c,
      key: m,
      ref: s !== void 0 ? s : null,
      props: d
    };
  }
  return ea.Fragment = i, ea.jsx = u, ea.jsxs = u, ea;
}
var js;
function Op() {
  return js || (js = 1, lo.exports = Mp()), lo.exports;
}
var $t = Op();
const Hp = /* @__PURE__ */ Co($t), Tv = /* @__PURE__ */ pf({
  __proto__: null,
  default: Hp
}, [$t]);
var no = { exports: {} }, ao = { exports: {} }, io = { exports: {} }, ro = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Us;
function Rp() {
  return Us || (Us = 1, (function(a) {
    function i(O, F) {
      var et = O.length;
      O.push(F);
      t: for (; 0 < et; ) {
        var it = et - 1 >>> 1, q = O[it];
        if (0 < s(q, F))
          O[it] = F, O[et] = q, et = it;
        else break t;
      }
    }
    function u(O) {
      return O.length === 0 ? null : O[0];
    }
    function c(O) {
      if (O.length === 0) return null;
      var F = O[0], et = O.pop();
      if (et !== F) {
        O[0] = et;
        t: for (var it = 0, q = O.length, v = q >>> 1; it < v; ) {
          var k = 2 * (it + 1) - 1, I = O[k], L = k + 1, W = O[L];
          if (0 > s(I, et))
            L < q && 0 > s(W, I) ? (O[it] = W, O[L] = et, it = L) : (O[it] = I, O[k] = et, it = k);
          else if (L < q && 0 > s(W, et))
            O[it] = W, O[L] = et, it = L;
          else break t;
        }
      }
      return F;
    }
    function s(O, F) {
      var et = O.sortIndex - F.sortIndex;
      return et !== 0 ? et : O.id - F.id;
    }
    if (a.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      a.unstable_now = function() {
        return d.now();
      };
    } else {
      var m = Date, h = m.now();
      a.unstable_now = function() {
        return m.now() - h;
      };
    }
    var g = [], y = [], R = 1, H = null, x = 3, E = !1, T = !1, B = !1, D = !1, M = typeof setTimeout == "function" ? setTimeout : null, A = typeof clearTimeout == "function" ? clearTimeout : null, G = typeof setImmediate < "u" ? setImmediate : null;
    function K(O) {
      for (var F = u(y); F !== null; ) {
        if (F.callback === null) c(y);
        else if (F.startTime <= O)
          c(y), F.sortIndex = F.expirationTime, i(g, F);
        else break;
        F = u(y);
      }
    }
    function nt(O) {
      if (B = !1, K(O), !T)
        if (u(g) !== null)
          T = !0, Q || (Q = !0, qt());
        else {
          var F = u(y);
          F !== null && zt(nt, F.startTime - O);
        }
    }
    var Q = !1, z = -1, N = 5, V = -1;
    function yt() {
      return D ? !0 : !(a.unstable_now() - V < N);
    }
    function Pt() {
      if (D = !1, Q) {
        var O = a.unstable_now();
        V = O;
        var F = !0;
        try {
          t: {
            T = !1, B && (B = !1, A(z), z = -1), E = !0;
            var et = x;
            try {
              e: {
                for (K(O), H = u(g); H !== null && !(H.expirationTime > O && yt()); ) {
                  var it = H.callback;
                  if (typeof it == "function") {
                    H.callback = null, x = H.priorityLevel;
                    var q = it(
                      H.expirationTime <= O
                    );
                    if (O = a.unstable_now(), typeof q == "function") {
                      H.callback = q, K(O), F = !0;
                      break e;
                    }
                    H === u(g) && c(g), K(O);
                  } else c(g);
                  H = u(g);
                }
                if (H !== null) F = !0;
                else {
                  var v = u(y);
                  v !== null && zt(
                    nt,
                    v.startTime - O
                  ), F = !1;
                }
              }
              break t;
            } finally {
              H = null, x = et, E = !1;
            }
            F = void 0;
          }
        } finally {
          F ? qt() : Q = !1;
        }
      }
    }
    var qt;
    if (typeof G == "function")
      qt = function() {
        G(Pt);
      };
    else if (typeof MessageChannel < "u") {
      var At = new MessageChannel(), Zt = At.port2;
      At.port1.onmessage = Pt, qt = function() {
        Zt.postMessage(null);
      };
    } else
      qt = function() {
        M(Pt, 0);
      };
    function zt(O, F) {
      z = M(function() {
        O(a.unstable_now());
      }, F);
    }
    a.unstable_IdlePriority = 5, a.unstable_ImmediatePriority = 1, a.unstable_LowPriority = 4, a.unstable_NormalPriority = 3, a.unstable_Profiling = null, a.unstable_UserBlockingPriority = 2, a.unstable_cancelCallback = function(O) {
      O.callback = null;
    }, a.unstable_forceFrameRate = function(O) {
      0 > O || 125 < O ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : N = 0 < O ? Math.floor(1e3 / O) : 5;
    }, a.unstable_getCurrentPriorityLevel = function() {
      return x;
    }, a.unstable_next = function(O) {
      switch (x) {
        case 1:
        case 2:
        case 3:
          var F = 3;
          break;
        default:
          F = x;
      }
      var et = x;
      x = F;
      try {
        return O();
      } finally {
        x = et;
      }
    }, a.unstable_requestPaint = function() {
      D = !0;
    }, a.unstable_runWithPriority = function(O, F) {
      switch (O) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          O = 3;
      }
      var et = x;
      x = O;
      try {
        return F();
      } finally {
        x = et;
      }
    }, a.unstable_scheduleCallback = function(O, F, et) {
      var it = a.unstable_now();
      switch (typeof et == "object" && et !== null ? (et = et.delay, et = typeof et == "number" && 0 < et ? it + et : it) : et = it, O) {
        case 1:
          var q = -1;
          break;
        case 2:
          q = 250;
          break;
        case 5:
          q = 1073741823;
          break;
        case 4:
          q = 1e4;
          break;
        default:
          q = 5e3;
      }
      return q = et + q, O = {
        id: R++,
        callback: F,
        priorityLevel: O,
        startTime: et,
        expirationTime: q,
        sortIndex: -1
      }, et > it ? (O.sortIndex = et, i(y, O), u(g) === null && O === u(y) && (B ? (A(z), z = -1) : B = !0, zt(nt, et - it))) : (O.sortIndex = q, i(g, O), T || E || (T = !0, Q || (Q = !0, qt()))), O;
    }, a.unstable_shouldYield = yt, a.unstable_wrapCallback = function(O) {
      var F = x;
      return function() {
        var et = x;
        x = F;
        try {
          return O.apply(this, arguments);
        } finally {
          x = et;
        }
      };
    };
  })(ro)), ro;
}
var Ds;
function jp() {
  return Ds || (Ds = 1, io.exports = Rp()), io.exports;
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
var qs;
function Up() {
  return qs || (qs = 1, (function(a) {
    a.exports = function(i) {
      function u(t, e, l, n) {
        return new yd(t, e, l, n);
      }
      function c() {
      }
      function s(t) {
        var e = "https://react.dev/errors/" + t;
        if (1 < arguments.length) {
          e += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var l = 2; l < arguments.length; l++)
            e += "&args[]=" + encodeURIComponent(arguments[l]);
        }
        return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function d(t) {
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
        if (d(t) !== t)
          throw Error(s(188));
      }
      function h(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(s(188));
          return e !== t ? null : t;
        }
        for (var l = t, n = e; ; ) {
          var r = l.return;
          if (r === null) break;
          var o = r.alternate;
          if (o === null) {
            if (n = r.return, n !== null) {
              l = n;
              continue;
            }
            break;
          }
          if (r.child === o.child) {
            for (o = r.child; o; ) {
              if (o === l) return m(r), t;
              if (o === n) return m(r), e;
              o = o.sibling;
            }
            throw Error(s(188));
          }
          if (l.return !== n.return) l = r, n = o;
          else {
            for (var f = !1, p = r.child; p; ) {
              if (p === l) {
                f = !0, l = r, n = o;
                break;
              }
              if (p === n) {
                f = !0, n = r, l = o;
                break;
              }
              p = p.sibling;
            }
            if (!f) {
              for (p = o.child; p; ) {
                if (p === l) {
                  f = !0, l = o, n = r;
                  break;
                }
                if (p === n) {
                  f = !0, n = o, l = r;
                  break;
                }
                p = p.sibling;
              }
              if (!f) throw Error(s(189));
            }
          }
          if (l.alternate !== n) throw Error(s(190));
        }
        if (l.tag !== 3) throw Error(s(188));
        return l.stateNode.current === l ? t : e;
      }
      function g(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = g(t), e !== null) return e;
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
      function R(t) {
        return t === null || typeof t != "object" ? null : (t = Lc && t[Lc] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function H(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === zd ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case en:
            return "Fragment";
          case xr:
            return "Profiler";
          case Zc:
            return "StrictMode";
          case _r:
            return "Suspense";
          case Sr:
            return "SuspenseList";
          case Er:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case tn:
              return "Portal";
            case ml:
              return t.displayName || "Context";
            case Jc:
              return (t._context.displayName || "Context") + ".Consumer";
            case wr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case zr:
              return e = t.displayName || null, e !== null ? e : H(t.type) || "Memo";
            case pl:
              e = t._payload, t = t._init;
              try {
                return H(t(e));
              } catch {
              }
          }
        return null;
      }
      function x(t) {
        return { current: t };
      }
      function E(t) {
        0 > an || (t.current = Mr[an], Mr[an] = null, an--);
      }
      function T(t, e) {
        an++, Mr[an] = t.current, t.current = e;
      }
      function B(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - ($m(t) / Pm | 0) | 0;
      }
      function D(t) {
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
      function M(t, e, l) {
        var n = t.pendingLanes;
        if (n === 0) return 0;
        var r = 0, o = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var p = n & 134217727;
        return p !== 0 ? (n = p & ~o, n !== 0 ? r = D(n) : (f &= p, f !== 0 ? r = D(f) : l || (l = p & ~t, l !== 0 && (r = D(l))))) : (p = n & ~o, p !== 0 ? r = D(p) : f !== 0 ? r = D(f) : l || (l = n & ~t, l !== 0 && (r = D(l)))), r === 0 ? 0 : e !== 0 && e !== r && (e & o) === 0 && (o = r & -r, l = e & -e, o >= l || o === 32 && (l & 4194048) !== 0) ? e : r;
      }
      function A(t, e) {
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
      function K() {
        var t = Ya;
        return Ya <<= 1, (Ya & 62914560) === 0 && (Ya = 4194304), t;
      }
      function nt(t) {
        for (var e = [], l = 0; 31 > l; l++) e.push(t);
        return e;
      }
      function Q(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function z(t, e, l, n, r, o) {
        var f = t.pendingLanes;
        t.pendingLanes = l, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= l, t.entangledLanes &= l, t.errorRecoveryDisabledLanes &= l, t.shellSuspendCounter = 0;
        var p = t.entanglements, S = t.expirationTimes, C = t.hiddenUpdates;
        for (l = f & ~l; 0 < l; ) {
          var Y = 31 - pe(l), j = 1 << Y;
          p[Y] = 0, S[Y] = -1;
          var X = C[Y];
          if (X !== null)
            for (C[Y] = null, Y = 0; Y < X.length; Y++) {
              var ot = X[Y];
              ot !== null && (ot.lane &= -536870913);
            }
          l &= ~j;
        }
        n !== 0 && N(t, n, 0), o !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= o & ~(f & ~e));
      }
      function N(t, e, l) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var n = 31 - pe(e);
        t.entangledLanes |= e, t.entanglements[n] = t.entanglements[n] | 1073741824 | l & 261930;
      }
      function V(t, e) {
        var l = t.entangledLanes |= e;
        for (t = t.entanglements; l; ) {
          var n = 31 - pe(l), r = 1 << n;
          r & e | t[n] & e && (t[n] |= e), l &= ~r;
        }
      }
      function yt(t, e) {
        var l = e & -e;
        return l = (l & 42) !== 0 ? 1 : Pt(l), (l & (t.suspendedLanes | e)) !== 0 ? 0 : l;
      }
      function Pt(t) {
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
      function qt(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function At(t) {
        if (typeof ap == "function" && ip(t), he && typeof he.setStrictMode == "function")
          try {
            he.setStrictMode(Vn, t);
          } catch {
          }
      }
      function Zt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function zt(t) {
        if (Rr === void 0)
          try {
            throw Error();
          } catch (l) {
            var e = l.stack.trim().match(/\n( *(at )?)/);
            Rr = e && e[1] || "", xs = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Rr + t + xs;
      }
      function O(t, e) {
        if (!t || jr) return "";
        jr = !0;
        var l = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var n = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var j = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(j.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(j, []);
                    } catch (ot) {
                      var X = ot;
                    }
                    Reflect.construct(t, [], j);
                  } else {
                    try {
                      j.call();
                    } catch (ot) {
                      X = ot;
                    }
                    t.call(j.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ot) {
                    X = ot;
                  }
                  (j = t()) && typeof j.catch == "function" && j.catch(function() {
                  });
                }
              } catch (ot) {
                if (ot && X && typeof ot.stack == "string")
                  return [ot.stack, X.stack];
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
          var o = n.DetermineComponentFrameRoot(), f = o[0], p = o[1];
          if (f && p) {
            var S = f.split(`
`), C = p.split(`
`);
            for (r = n = 0; n < S.length && !S[n].includes("DetermineComponentFrameRoot"); )
              n++;
            for (; r < C.length && !C[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (n === S.length || r === C.length)
              for (n = S.length - 1, r = C.length - 1; 1 <= n && 0 <= r && S[n] !== C[r]; )
                r--;
            for (; 1 <= n && 0 <= r; n--, r--)
              if (S[n] !== C[r]) {
                if (n !== 1 || r !== 1)
                  do
                    if (n--, r--, 0 > r || S[n] !== C[r]) {
                      var Y = `
` + S[n].replace(" at new ", " at ");
                      return t.displayName && Y.includes("<anonymous>") && (Y = Y.replace("<anonymous>", t.displayName)), Y;
                    }
                  while (1 <= n && 0 <= r);
                break;
              }
          }
        } finally {
          jr = !1, Error.prepareStackTrace = l;
        }
        return (l = t ? t.displayName || t.name : "") ? zt(l) : "";
      }
      function F(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return zt(t.type);
          case 16:
            return zt("Lazy");
          case 13:
            return t.child !== e && e !== null ? zt("Suspense Fallback") : zt("Suspense");
          case 19:
            return zt("SuspenseList");
          case 0:
          case 15:
            return O(t.type, !1);
          case 11:
            return O(t.type.render, !1);
          case 1:
            return O(t.type, !0);
          case 31:
            return zt("Activity");
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
        } catch (n) {
          return `
Error generating stack: ` + n.message + `
` + n.stack;
        }
      }
      function it(t, e) {
        if (typeof t == "object" && t !== null) {
          var l = ws.get(t);
          return l !== void 0 ? l : (e = {
            value: t,
            source: e,
            stack: et(e)
          }, ws.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: et(e)
        };
      }
      function q(t, e) {
        on[un++] = Kn, on[un++] = Qa, Qa = t, Kn = e;
      }
      function v(t, e, l) {
        Se[ze++] = Be, Se[ze++] = Ye, Se[ze++] = hl, hl = t;
        var n = Be;
        t = Ye;
        var r = 32 - pe(n) - 1;
        n &= ~(1 << r), l += 1;
        var o = 32 - pe(e) + r;
        if (30 < o) {
          var f = r - r % 5;
          o = (n & (1 << f) - 1).toString(32), n >>= f, r -= f, Be = 1 << 32 - pe(e) + r | l << r | n, Ye = o + t;
        } else
          Be = 1 << o | l << r | n, Ye = t;
      }
      function k(t) {
        t.return !== null && (q(t, 1), v(t, 1, 0));
      }
      function I(t) {
        for (; t === Qa; )
          Qa = on[--un], on[un] = null, Kn = on[--un], on[un] = null;
        for (; t === hl; )
          hl = Se[--ze], Se[ze] = null, Ye = Se[--ze], Se[ze] = null, Be = Se[--ze], Se[ze] = null;
      }
      function L(t, e) {
        Se[ze++] = Be, Se[ze++] = Ye, Se[ze++] = hl, Be = e.id, Ye = e.overflow, hl = t;
      }
      function W(t, e) {
        T(vl, e), T(Xn, t), T(Wt, null), t = Td(e), E(Wt), T(Wt, t);
      }
      function $() {
        E(Wt), E(Xn), E(vl);
      }
      function ht(t) {
        t.memoizedState !== null && T(Va, t);
        var e = Wt.current, l = Cd(e, t.type);
        e !== l && (T(Xn, t), T(Wt, l));
      }
      function Qt(t) {
        Xn.current === t && (E(Wt), E(Xn)), Va.current === t && (E(Va), We ? Ul._currentValue = ln : Ul._currentValue2 = ln);
      }
      function rt(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw En(it(e, t)), Ur;
      }
      function Nl(t, e) {
        if (!le) throw Error(s(175));
        Cm(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || rt(t, !0);
      }
      function Tl(t) {
        for (Ft = t.return; Ft; )
          switch (Ft.tag) {
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
              Ft = Ft.return;
          }
      }
      function Ce(t) {
        if (!le || t !== Ft) return !1;
        if (!pt) return Tl(t), pt = !0, !1;
        var e = t.tag;
        if (Bt ? e !== 3 && e !== 27 && (e !== 5 || os(t.type) && !Da(t.type, t.memoizedProps)) && Et && rt(t) : e !== 3 && (e !== 5 || os(t.type) && !Da(t.type, t.memoizedProps)) && Et && rt(t), Tl(t), e === 13) {
          if (!le) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Et = Hm(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Et = Om(t);
        } else
          Et = Bt && e === 27 ? bm(
            t.type,
            Et
          ) : Ft ? rs(t.stateNode) : null;
        return !0;
      }
      function ke() {
        le && (Et = Ft = null, pt = !1);
      }
      function il() {
        var t = gl;
        return t !== null && (ue === null ? ue = t : ue.push.apply(
          ue,
          t
        ), gl = null), t;
      }
      function En(t) {
        gl === null ? gl = [t] : gl.push(t);
      }
      function rl(t, e, l) {
        We ? (T(Ka, e._currentValue), e._currentValue = l) : (T(Ka, e._currentValue2), e._currentValue2 = l);
      }
      function Ve(t) {
        var e = Ka.current;
        We ? t._currentValue = e : t._currentValue2 = e, E(Ka);
      }
      function gi(t, e, l) {
        for (; t !== null; ) {
          var n = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, n !== null && (n.childLanes |= e)) : n !== null && (n.childLanes & e) !== e && (n.childLanes |= e), t === l) break;
          t = t.return;
        }
      }
      function bi(t, e, l, n) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var o = r.dependencies;
          if (o !== null) {
            var f = r.child;
            o = o.firstContext;
            t: for (; o !== null; ) {
              var p = o;
              o = r;
              for (var S = 0; S < e.length; S++)
                if (p.context === e[S]) {
                  o.lanes |= l, p = o.alternate, p !== null && (p.lanes |= l), gi(
                    o.return,
                    l,
                    t
                  ), n || (f = null);
                  break t;
                }
              o = p.next;
            }
          } else if (r.tag === 18) {
            if (f = r.return, f === null) throw Error(s(341));
            f.lanes |= l, o = f.alternate, o !== null && (o.lanes |= l), gi(f, l, t), f = null;
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
      function Ll(t, e, l, n) {
        t = null;
        for (var r = e, o = !1; r !== null; ) {
          if (!o) {
            if ((r.flags & 524288) !== 0) o = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var f = r.alternate;
            if (f === null) throw Error(s(387));
            if (f = f.memoizedProps, f !== null) {
              var p = r.type;
              ve(r.pendingProps.value, f.value) || (t !== null ? t.push(p) : t = [p]);
            }
          } else if (r === Va.current) {
            if (f = r.alternate, f === null) throw Error(s(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ul) : t = [Ul]);
          }
          r = r.return;
        }
        t !== null && bi(
          e,
          t,
          l,
          n
        ), e.flags |= 262144;
      }
      function ra(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ve(
            We ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Cl(t) {
        Dl = t, Ie = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Jt(t) {
        return Ro(Dl, t);
      }
      function oa(t, e) {
        return Dl === null && Cl(t), Ro(t, e);
      }
      function Ro(t, e) {
        var l = We ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: l, next: null }, Ie === null) {
          if (t === null) throw Error(s(308));
          Ie = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else Ie = Ie.next = e;
        return l;
      }
      function yi() {
        return {
          controller: new op(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Nn(t) {
        t.refCount--, t.refCount === 0 && up(cp, function() {
          t.controller.abort();
        });
      }
      function ua() {
      }
      function Ue(t) {
        t !== cn && t.next === null && (cn === null ? Xa = cn = t : cn = cn.next = t), Za = !0, Dr || (Dr = !0, Wf());
      }
      function Wl(t, e) {
        if (!qr && Za) {
          qr = !0;
          do
            for (var l = !1, n = Xa; n !== null; ) {
              if (t !== 0) {
                var r = n.pendingLanes;
                if (r === 0) var o = 0;
                else {
                  var f = n.suspendedLanes, p = n.pingedLanes;
                  o = (1 << 31 - pe(42 | t) + 1) - 1, o &= r & ~(f & ~p), o = o & 201326741 ? o & 201326741 | 1 : o ? o | 2 : 0;
                }
                o !== 0 && (l = !0, Bo(n, o));
              } else
                o = mt, o = M(
                  n,
                  n === _t ? o : 0,
                  n.cancelPendingCommit !== null || n.timeoutHandle !== jl
                ), (o & 3) === 0 || A(n, o) || (l = !0, Bo(n, o));
              n = n.next;
            }
          while (l);
          qr = !1;
        }
      }
      function jo() {
        Uo();
      }
      function Uo() {
        Za = Dr = !1;
        var t = 0;
        ql !== 0 && Dd() && (t = ql);
        for (var e = re(), l = null, n = Xa; n !== null; ) {
          var r = n.next, o = Do(n, e);
          o === 0 ? (n.next = null, l === null ? Xa = r : l.next = r, r === null && (cn = l)) : (l = n, (t !== 0 || (o & 3) !== 0) && (Za = !0)), n = r;
        }
        Yt !== 0 && Yt !== 5 || Wl(t), ql !== 0 && (ql = 0);
      }
      function Do(t, e) {
        for (var l = t.suspendedLanes, n = t.pingedLanes, r = t.expirationTimes, o = t.pendingLanes & -62914561; 0 < o; ) {
          var f = 31 - pe(o), p = 1 << f, S = r[f];
          S === -1 ? ((p & l) === 0 || (p & n) !== 0) && (r[f] = G(p, e)) : S <= e && (t.expiredLanes |= p), o &= ~p;
        }
        if (e = _t, l = mt, l = M(
          t,
          t === e ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== jl
        ), n = t.callbackNode, l === 0 || t === e && (xt === 2 || xt === 9) || t.cancelPendingCommit !== null)
          return n !== null && n !== null && Or(n), t.callbackNode = null, t.callbackPriority = 0;
        if ((l & 3) === 0 || A(t, l)) {
          if (e = l & -l, e === t.callbackPriority) return e;
          switch (n !== null && Or(n), qt(l)) {
            case 2:
            case 8:
              l = lp;
              break;
            case 32:
              l = Hr;
              break;
            case 268435456:
              l = np;
              break;
            default:
              l = Hr;
          }
          return n = qo.bind(null, t), l = Ga(l, n), t.callbackPriority = e, t.callbackNode = l, e;
        }
        return n !== null && n !== null && Or(n), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function qo(t, e) {
        if (Yt !== 0 && Yt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var l = t.callbackNode;
        if (Bn() && t.callbackNode !== l)
          return null;
        var n = mt;
        return n = M(
          t,
          t === _t ? n : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== jl
        ), n === 0 ? null : (wc(t, n, e), Do(t, re()), t.callbackNode != null && t.callbackNode === l ? qo.bind(null, t) : null);
      }
      function Bo(t, e) {
        if (Bn()) return null;
        wc(t, e, !0);
      }
      function Wf() {
        Kd ? Xd(function() {
          (ft & 6) !== 0 ? Ga(
            bs,
            jo
          ) : Uo();
        }) : Ga(
          bs,
          jo
        );
      }
      function xi() {
        if (ql === 0) {
          var t = sn;
          t === 0 && (t = qa, qa <<= 1, (qa & 261888) === 0 && (qa = 256)), ql = t;
        }
        return ql;
      }
      function Ff(t, e) {
        if (Zn === null) {
          var l = Zn = [];
          Br = 0, sn = xi(), fn = {
            status: "pending",
            value: void 0,
            then: function(n) {
              l.push(n);
            }
          };
        }
        return Br++, e.then(Yo, Yo), e;
      }
      function Yo() {
        if (--Br === 0 && Zn !== null) {
          fn !== null && (fn.status = "fulfilled");
          var t = Zn;
          Zn = null, sn = 0, fn = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function If(t, e) {
        var l = [], n = {
          status: "pending",
          value: null,
          reason: null,
          then: function(r) {
            l.push(r);
          }
        };
        return t.then(
          function() {
            n.status = "fulfilled", n.value = e;
            for (var r = 0; r < l.length; r++) (0, l[r])(e);
          },
          function(r) {
            for (n.status = "rejected", n.reason = r, r = 0; r < l.length; r++)
              (0, l[r])(void 0);
          }
        ), n;
      }
      function wi() {
        var t = Bl.current;
        return t !== null ? t : _t.pooledCache;
      }
      function ca(t, e) {
        e === null ? T(Bl, Bl.current) : T(Bl, e.pool);
      }
      function Go() {
        var t = wi();
        return t === null ? null : {
          parent: We ? Nt._currentValue : Nt._currentValue2,
          pool: t
        };
      }
      function sa(t, e) {
        if (ve(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var l = Object.keys(t), n = Object.keys(e);
        if (l.length !== n.length) return !1;
        for (n = 0; n < l.length; n++) {
          var r = l[n];
          if (!rp.call(e, r) || !ve(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function Qo(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Vo(t, e, l) {
        switch (l = t[l], l === void 0 ? t.push(e) : l !== e && (e.then(ua, ua), e = l), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Xo(t), t;
          default:
            if (typeof e.status == "string") e.then(ua, ua);
            else {
              if (t = _t, t !== null && 100 < t.shellSuspendCounter)
                throw Error(s(482));
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
                throw t = e.reason, Xo(t), t;
            }
            throw Yl = e, dn;
        }
      }
      function kl(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (Yl = l, dn) : l;
        }
      }
      function Ko() {
        if (Yl === null) throw Error(s(459));
        var t = Yl;
        return Yl = null, t;
      }
      function Xo(t) {
        if (t === dn || t === Ja)
          throw Error(s(483));
      }
      function fa(t) {
        var e = Jn;
        return Jn += 1, mn === null && (mn = []), Vo(mn, t, e);
      }
      function Tn(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function da(t, e) {
        throw e.$$typeof === _d ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Zo(t) {
        function e(w, b) {
          if (t) {
            var _ = w.deletions;
            _ === null ? (w.deletions = [b], w.flags |= 16) : _.push(b);
          }
        }
        function l(w, b) {
          if (!t) return null;
          for (; b !== null; )
            e(w, b), b = b.sibling;
          return null;
        }
        function n(w) {
          for (var b = /* @__PURE__ */ new Map(); w !== null; )
            w.key !== null ? b.set(w.key, w) : b.set(w.index, w), w = w.sibling;
          return b;
        }
        function r(w, b) {
          return w = Le(w, b), w.index = 0, w.sibling = null, w;
        }
        function o(w, b, _) {
          return w.index = _, t ? (_ = w.alternate, _ !== null ? (_ = _.index, _ < b ? (w.flags |= 67108866, b) : _) : (w.flags |= 67108866, b)) : (w.flags |= 1048576, b);
        }
        function f(w) {
          return t && w.alternate === null && (w.flags |= 67108866), w;
        }
        function p(w, b, _, U) {
          return b === null || b.tag !== 6 ? (b = vr(_, w.mode, U), b.return = w, b) : (b = r(b, _), b.return = w, b);
        }
        function S(w, b, _, U) {
          var tt = _.type;
          return tt === en ? Y(
            w,
            b,
            _.props.children,
            U,
            _.key
          ) : b !== null && (b.elementType === tt || typeof tt == "object" && tt !== null && tt.$$typeof === pl && kl(tt) === b.type) ? (b = r(b, _.props), Tn(b, _), b.return = w, b) : (b = Ra(
            _.type,
            _.key,
            _.props,
            null,
            w.mode,
            U
          ), Tn(b, _), b.return = w, b);
        }
        function C(w, b, _, U) {
          return b === null || b.tag !== 4 || b.stateNode.containerInfo !== _.containerInfo || b.stateNode.implementation !== _.implementation ? (b = gr(_, w.mode, U), b.return = w, b) : (b = r(b, _.children || []), b.return = w, b);
        }
        function Y(w, b, _, U, tt) {
          return b === null || b.tag !== 7 ? (b = Rl(
            _,
            w.mode,
            U,
            tt
          ), b.return = w, b) : (b = r(b, _), b.return = w, b);
        }
        function j(w, b, _) {
          if (typeof b == "string" && b !== "" || typeof b == "number" || typeof b == "bigint")
            return b = vr(
              "" + b,
              w.mode,
              _
            ), b.return = w, b;
          if (typeof b == "object" && b !== null) {
            switch (b.$$typeof) {
              case ja:
                return _ = Ra(
                  b.type,
                  b.key,
                  b.props,
                  null,
                  w.mode,
                  _
                ), Tn(_, b), _.return = w, _;
              case tn:
                return b = gr(
                  b,
                  w.mode,
                  _
                ), b.return = w, b;
              case pl:
                return b = kl(b), j(w, b, _);
            }
            if (Ua(b) || R(b))
              return b = Rl(
                b,
                w.mode,
                _,
                null
              ), b.return = w, b;
            if (typeof b.then == "function")
              return j(w, fa(b), _);
            if (b.$$typeof === ml)
              return j(
                w,
                oa(w, b),
                _
              );
            da(w, b);
          }
          return null;
        }
        function X(w, b, _, U) {
          var tt = b !== null ? b.key : null;
          if (typeof _ == "string" && _ !== "" || typeof _ == "number" || typeof _ == "bigint")
            return tt !== null ? null : p(w, b, "" + _, U);
          if (typeof _ == "object" && _ !== null) {
            switch (_.$$typeof) {
              case ja:
                return _.key === tt ? S(w, b, _, U) : null;
              case tn:
                return _.key === tt ? C(w, b, _, U) : null;
              case pl:
                return _ = kl(_), X(w, b, _, U);
            }
            if (Ua(_) || R(_))
              return tt !== null ? null : Y(w, b, _, U, null);
            if (typeof _.then == "function")
              return X(
                w,
                b,
                fa(_),
                U
              );
            if (_.$$typeof === ml)
              return X(
                w,
                b,
                oa(w, _),
                U
              );
            da(w, _);
          }
          return null;
        }
        function ot(w, b, _, U, tt) {
          if (typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint")
            return w = w.get(_) || null, p(b, w, "" + U, tt);
          if (typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case ja:
                return w = w.get(
                  U.key === null ? _ : U.key
                ) || null, S(b, w, U, tt);
              case tn:
                return w = w.get(
                  U.key === null ? _ : U.key
                ) || null, C(b, w, U, tt);
              case pl:
                return U = kl(U), ot(
                  w,
                  b,
                  _,
                  U,
                  tt
                );
            }
            if (Ua(U) || R(U))
              return w = w.get(_) || null, Y(b, w, U, tt, null);
            if (typeof U.then == "function")
              return ot(
                w,
                b,
                _,
                fa(U),
                tt
              );
            if (U.$$typeof === ml)
              return ot(
                w,
                b,
                _,
                oa(b, U),
                tt
              );
            da(b, U);
          }
          return null;
        }
        function It(w, b, _, U) {
          for (var tt = null, Tt = null, lt = b, gt = b = 0, Xt = null; lt !== null && gt < _.length; gt++) {
            lt.index > gt ? (Xt = lt, lt = null) : Xt = lt.sibling;
            var bt = X(
              w,
              lt,
              _[gt],
              U
            );
            if (bt === null) {
              lt === null && (lt = Xt);
              break;
            }
            t && lt && bt.alternate === null && e(w, lt), b = o(bt, b, gt), Tt === null ? tt = bt : Tt.sibling = bt, Tt = bt, lt = Xt;
          }
          if (gt === _.length)
            return l(w, lt), pt && q(w, gt), tt;
          if (lt === null) {
            for (; gt < _.length; gt++)
              lt = j(w, _[gt], U), lt !== null && (b = o(
                lt,
                b,
                gt
              ), Tt === null ? tt = lt : Tt.sibling = lt, Tt = lt);
            return pt && q(w, gt), tt;
          }
          for (lt = n(lt); gt < _.length; gt++)
            Xt = ot(
              lt,
              w,
              gt,
              _[gt],
              U
            ), Xt !== null && (t && Xt.alternate !== null && lt.delete(
              Xt.key === null ? gt : Xt.key
            ), b = o(
              Xt,
              b,
              gt
            ), Tt === null ? tt = Xt : Tt.sibling = Xt, Tt = Xt);
          return t && lt.forEach(function(Sl) {
            return e(w, Sl);
          }), pt && q(w, gt), tt;
        }
        function ta(w, b, _, U) {
          if (_ == null) throw Error(s(151));
          for (var tt = null, Tt = null, lt = b, gt = b = 0, Xt = null, bt = _.next(); lt !== null && !bt.done; gt++, bt = _.next()) {
            lt.index > gt ? (Xt = lt, lt = null) : Xt = lt.sibling;
            var Sl = X(w, lt, bt.value, U);
            if (Sl === null) {
              lt === null && (lt = Xt);
              break;
            }
            t && lt && Sl.alternate === null && e(w, lt), b = o(Sl, b, gt), Tt === null ? tt = Sl : Tt.sibling = Sl, Tt = Sl, lt = Xt;
          }
          if (bt.done)
            return l(w, lt), pt && q(w, gt), tt;
          if (lt === null) {
            for (; !bt.done; gt++, bt = _.next())
              bt = j(w, bt.value, U), bt !== null && (b = o(
                bt,
                b,
                gt
              ), Tt === null ? tt = bt : Tt.sibling = bt, Tt = bt);
            return pt && q(w, gt), tt;
          }
          for (lt = n(lt); !bt.done; gt++, bt = _.next())
            bt = ot(
              lt,
              w,
              gt,
              bt.value,
              U
            ), bt !== null && (t && bt.alternate !== null && lt.delete(bt.key === null ? gt : bt.key), b = o(bt, b, gt), Tt === null ? tt = bt : Tt.sibling = bt, Tt = bt);
          return t && lt.forEach(function(mp) {
            return e(w, mp);
          }), pt && q(w, gt), tt;
        }
        function Kl(w, b, _, U) {
          if (typeof _ == "object" && _ !== null && _.type === en && _.key === null && (_ = _.props.children), typeof _ == "object" && _ !== null) {
            switch (_.$$typeof) {
              case ja:
                t: {
                  for (var tt = _.key; b !== null; ) {
                    if (b.key === tt) {
                      if (tt = _.type, tt === en) {
                        if (b.tag === 7) {
                          l(
                            w,
                            b.sibling
                          ), U = r(
                            b,
                            _.props.children
                          ), U.return = w, w = U;
                          break t;
                        }
                      } else if (b.elementType === tt || typeof tt == "object" && tt !== null && tt.$$typeof === pl && kl(tt) === b.type) {
                        l(
                          w,
                          b.sibling
                        ), U = r(b, _.props), Tn(U, _), U.return = w, w = U;
                        break t;
                      }
                      l(w, b);
                      break;
                    } else e(w, b);
                    b = b.sibling;
                  }
                  _.type === en ? (U = Rl(
                    _.props.children,
                    w.mode,
                    U,
                    _.key
                  ), U.return = w, w = U) : (U = Ra(
                    _.type,
                    _.key,
                    _.props,
                    null,
                    w.mode,
                    U
                  ), Tn(U, _), U.return = w, w = U);
                }
                return f(w);
              case tn:
                t: {
                  for (tt = _.key; b !== null; ) {
                    if (b.key === tt)
                      if (b.tag === 4 && b.stateNode.containerInfo === _.containerInfo && b.stateNode.implementation === _.implementation) {
                        l(
                          w,
                          b.sibling
                        ), U = r(
                          b,
                          _.children || []
                        ), U.return = w, w = U;
                        break t;
                      } else {
                        l(w, b);
                        break;
                      }
                    else e(w, b);
                    b = b.sibling;
                  }
                  U = gr(_, w.mode, U), U.return = w, w = U;
                }
                return f(w);
              case pl:
                return _ = kl(_), Kl(
                  w,
                  b,
                  _,
                  U
                );
            }
            if (Ua(_))
              return It(
                w,
                b,
                _,
                U
              );
            if (R(_)) {
              if (tt = R(_), typeof tt != "function")
                throw Error(s(150));
              return _ = tt.call(_), ta(
                w,
                b,
                _,
                U
              );
            }
            if (typeof _.then == "function")
              return Kl(
                w,
                b,
                fa(_),
                U
              );
            if (_.$$typeof === ml)
              return Kl(
                w,
                b,
                oa(w, _),
                U
              );
            da(w, _);
          }
          return typeof _ == "string" && _ !== "" || typeof _ == "number" || typeof _ == "bigint" ? (_ = "" + _, b !== null && b.tag === 6 ? (l(w, b.sibling), U = r(b, _), U.return = w, w = U) : (l(w, b), U = vr(_, w.mode, U), U.return = w, w = U), f(w)) : l(w, b);
        }
        return function(w, b, _, U) {
          try {
            Jn = 0;
            var tt = Kl(
              w,
              b,
              _,
              U
            );
            return mn = null, tt;
          } catch (lt) {
            if (lt === dn || lt === Ja) throw lt;
            var Tt = u(29, lt, null, w.mode);
            return Tt.lanes = U, Tt.return = w, Tt;
          } finally {
          }
        };
      }
      function ma() {
        for (var t = pn, e = Gr = pn = 0; e < t; ) {
          var l = Ne[e];
          Ne[e++] = null;
          var n = Ne[e];
          Ne[e++] = null;
          var r = Ne[e];
          Ne[e++] = null;
          var o = Ne[e];
          if (Ne[e++] = null, n !== null && r !== null) {
            var f = n.pending;
            f === null ? r.next = r : (r.next = f.next, f.next = r), n.pending = r;
          }
          o !== 0 && Jo(l, r, o);
        }
      }
      function pa(t, e, l, n) {
        Ne[pn++] = t, Ne[pn++] = e, Ne[pn++] = l, Ne[pn++] = n, Gr |= n, t.lanes |= n, t = t.alternate, t !== null && (t.lanes |= n);
      }
      function _i(t, e, l, n) {
        return pa(t, e, l, n), ha(t);
      }
      function Al(t, e) {
        return pa(t, null, null, e), ha(t);
      }
      function Jo(t, e, l) {
        t.lanes |= l;
        var n = t.alternate;
        n !== null && (n.lanes |= l);
        for (var r = !1, o = t.return; o !== null; )
          o.childLanes |= l, n = o.alternate, n !== null && (n.childLanes |= l), o.tag === 22 && (t = o.stateNode, t === null || t._visibility & 1 || (r = !0)), t = o, o = o.return;
        return t.tag === 3 ? (o = t.stateNode, r && e !== null && (r = 31 - pe(l), t = o.hiddenUpdates, n = t[r], n === null ? t[r] = [e] : n.push(e), e.lane = l | 536870912), o) : null;
      }
      function ha(t) {
        if (50 < Pn)
          throw Pn = 0, Pr = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Si(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function zi(t, e) {
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
        var n = t.updateQueue;
        if (n === null) return null;
        if (n = n.shared, (ft & 2) !== 0) {
          var r = n.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), n.pending = e, e = ha(t), Jo(t, null, l), e;
        }
        return pa(t, n, e, l), ha(t);
      }
      function Cn(t, e, l) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (l & 4194048) !== 0)) {
          var n = e.lanes;
          n &= t.pendingLanes, l |= n, e.lanes = l, V(t, l);
        }
      }
      function Ei(t, e) {
        var l = t.updateQueue, n = t.alternate;
        if (n !== null && (n = n.updateQueue, l === n)) {
          var r = null, o = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var f = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              o === null ? r = o = f : o = o.next = f, l = l.next;
            } while (l !== null);
            o === null ? r = o = e : o = o.next = e;
          } else r = o = e;
          l = {
            baseState: n.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: o,
            shared: n.shared,
            callbacks: n.callbacks
          }, t.updateQueue = l;
          return;
        }
        t = l.lastBaseUpdate, t === null ? l.firstBaseUpdate = e : t.next = e, l.lastBaseUpdate = e;
      }
      function kn() {
        if (Qr) {
          var t = fn;
          if (t !== null) throw t;
        }
      }
      function An(t, e, l, n) {
        Qr = !1;
        var r = t.updateQueue;
        bl = !1;
        var o = r.firstBaseUpdate, f = r.lastBaseUpdate, p = r.shared.pending;
        if (p !== null) {
          r.shared.pending = null;
          var S = p, C = S.next;
          S.next = null, f === null ? o = C : f.next = C, f = S;
          var Y = t.alternate;
          Y !== null && (Y = Y.updateQueue, p = Y.lastBaseUpdate, p !== f && (p === null ? Y.firstBaseUpdate = C : p.next = C, Y.lastBaseUpdate = S));
        }
        if (o !== null) {
          var j = r.baseState;
          f = 0, Y = C = S = null, p = o;
          do {
            var X = p.lane & -536870913, ot = X !== p.lane;
            if (ot ? (mt & X) === X : (n & X) === X) {
              X !== 0 && X === sn && (Qr = !0), Y !== null && (Y = Y.next = {
                lane: 0,
                tag: p.tag,
                payload: p.payload,
                callback: null,
                next: null
              });
              t: {
                var It = t, ta = p;
                X = e;
                var Kl = l;
                switch (ta.tag) {
                  case 1:
                    if (It = ta.payload, typeof It == "function") {
                      j = It.call(
                        Kl,
                        j,
                        X
                      );
                      break t;
                    }
                    j = It;
                    break t;
                  case 3:
                    It.flags = It.flags & -65537 | 128;
                  case 0:
                    if (It = ta.payload, X = typeof It == "function" ? It.call(Kl, j, X) : It, X == null) break t;
                    j = yr({}, j, X);
                    break t;
                  case 2:
                    bl = !0;
                }
              }
              X = p.callback, X !== null && (t.flags |= 64, ot && (t.flags |= 8192), ot = r.callbacks, ot === null ? r.callbacks = [X] : ot.push(X));
            } else
              ot = {
                lane: X,
                tag: p.tag,
                payload: p.payload,
                callback: p.callback,
                next: null
              }, Y === null ? (C = Y = ot, S = j) : Y = Y.next = ot, f |= X;
            if (p = p.next, p === null) {
              if (p = r.shared.pending, p === null)
                break;
              ot = p, p = ot.next, ot.next = null, r.lastBaseUpdate = ot, r.shared.pending = null;
            }
          } while (!0);
          Y === null && (S = j), r.baseState = S, r.firstBaseUpdate = C, r.lastBaseUpdate = Y, o === null && (r.shared.lanes = 0), xl |= f, t.lanes = f, t.memoizedState = j;
        }
      }
      function Lo(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function Wo(t, e) {
        var l = t.callbacks;
        if (l !== null)
          for (t.callbacks = null, t = 0; t < l.length; t++)
            Lo(l[t], e);
      }
      function Fo(t, e) {
        t = tl, T(Wa, t), T(hn, e), tl = t | e.baseLanes;
      }
      function Ni() {
        T(Wa, tl), T(hn, hn.current);
      }
      function Ti() {
        tl = Wa.current, E(hn), E(Wa);
      }
      function cl(t) {
        var e = t.alternate;
        T(Ot, Ot.current & 1), T(ge, t), Te === null && (e === null || hn.current !== null || e.memoizedState !== null) && (Te = t);
      }
      function Ci(t) {
        T(Ot, Ot.current), T(ge, t), Te === null && (Te = t);
      }
      function Io(t) {
        t.tag === 22 ? (T(Ot, Ot.current), T(ge, t), Te === null && (Te = t)) : sl();
      }
      function sl() {
        T(Ot, Ot.current), T(ge, ge.current);
      }
      function fe(t) {
        E(ge), Te === t && (Te = null), E(Ot);
      }
      function va(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var l = e.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || Cr(l) || kr(l)))
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
      function Ct() {
        throw Error(s(321));
      }
      function ki(t, e) {
        if (e === null) return !1;
        for (var l = 0; l < e.length && l < t.length; l++)
          if (!ve(t[l], e[l])) return !1;
        return !0;
      }
      function Ai(t, e, l, n, r, o) {
        return $e = o, ut = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, P.H = t === null || t.memoizedState === null ? zs : Vr, Ql = !1, o = l(n, r), Ql = !1, vn && (o = Po(
          e,
          l,
          n,
          r
        )), $o(t), o;
      }
      function $o(t) {
        P.H = Wn;
        var e = wt !== null && wt.next !== null;
        if ($e = 0, Rt = wt = ut = null, Fa = !1, Ln = 0, gn = null, e) throw Error(s(300));
        t === null || jt || (t = t.dependencies, t !== null && ra(t) && (jt = !0));
      }
      function Po(t, e, l, n) {
        ut = t;
        var r = 0;
        do {
          if (vn && (gn = null), Ln = 0, vn = !1, 25 <= r) throw Error(s(301));
          if (r += 1, Rt = wt = null, t.updateQueue != null) {
            var o = t.updateQueue;
            o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
          }
          P.H = Es, o = e(l, n);
        } while (vn);
        return o;
      }
      function $f() {
        var t = P.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Mn(e) : e, t = t.useState()[0], (wt !== null ? wt.memoizedState : null) !== t && (ut.flags |= 1024), e;
      }
      function Mi() {
        var t = Ia !== 0;
        return Ia = 0, t;
      }
      function Oi(t, e, l) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~l;
      }
      function Hi(t) {
        if (Fa) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          Fa = !1;
        }
        $e = 0, Rt = wt = ut = null, vn = !1, Ln = Ia = 0, gn = null;
      }
      function ne() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Rt === null ? ut.memoizedState = Rt = t : Rt = Rt.next = t, Rt;
      }
      function Mt() {
        if (wt === null) {
          var t = ut.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = wt.next;
        var e = Rt === null ? ut.memoizedState : Rt.next;
        if (e !== null)
          Rt = e, wt = t;
        else {
          if (t === null)
            throw ut.alternate === null ? Error(s(467)) : Error(s(310));
          wt = t, t = {
            memoizedState: wt.memoizedState,
            baseState: wt.baseState,
            baseQueue: wt.baseQueue,
            queue: wt.queue,
            next: null
          }, Rt === null ? ut.memoizedState = Rt = t : Rt = Rt.next = t;
        }
        return Rt;
      }
      function ga() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Mn(t) {
        var e = Ln;
        return Ln += 1, gn === null && (gn = []), t = Vo(gn, t, e), e = ut, (Rt === null ? e.memoizedState : Rt.next) === null && (e = e.alternate, P.H = e === null || e.memoizedState === null ? zs : Vr), t;
      }
      function ba(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Mn(t);
          if (t.$$typeof === ml) return Jt(t);
        }
        throw Error(s(438, String(t)));
      }
      function Ri(t) {
        var e = null, l = ut.updateQueue;
        if (l !== null && (e = l.memoCache), e == null) {
          var n = ut.alternate;
          n !== null && (n = n.updateQueue, n !== null && (n = n.memoCache, n != null && (e = {
            data: n.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), l === null && (l = ga(), ut.updateQueue = l), l.memoCache = e, l = e.data[e.index], l === void 0)
          for (l = e.data[e.index] = Array(t), n = 0; n < t; n++)
            l[n] = Sd;
        return e.index++, l;
      }
      function Ke(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function ya(t) {
        var e = Mt();
        return ji(e, wt, t);
      }
      function ji(t, e, l) {
        var n = t.queue;
        if (n === null) throw Error(s(311));
        n.lastRenderedReducer = l;
        var r = t.baseQueue, o = n.pending;
        if (o !== null) {
          if (r !== null) {
            var f = r.next;
            r.next = o.next, o.next = f;
          }
          e.baseQueue = r = o, n.pending = null;
        }
        if (o = t.baseState, r === null) t.memoizedState = o;
        else {
          e = r.next;
          var p = f = null, S = null, C = e, Y = !1;
          do {
            var j = C.lane & -536870913;
            if (j !== C.lane ? (mt & j) === j : ($e & j) === j) {
              var X = C.revertLane;
              if (X === 0)
                S !== null && (S = S.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: C.action,
                  hasEagerState: C.hasEagerState,
                  eagerState: C.eagerState,
                  next: null
                }), j === sn && (Y = !0);
              else if (($e & X) === X) {
                C = C.next, X === sn && (Y = !0);
                continue;
              } else
                j = {
                  lane: 0,
                  revertLane: C.revertLane,
                  gesture: null,
                  action: C.action,
                  hasEagerState: C.hasEagerState,
                  eagerState: C.eagerState,
                  next: null
                }, S === null ? (p = S = j, f = o) : S = S.next = j, ut.lanes |= X, xl |= X;
              j = C.action, Ql && l(o, j), o = C.hasEagerState ? C.eagerState : l(o, j);
            } else
              X = {
                lane: j,
                revertLane: C.revertLane,
                gesture: C.gesture,
                action: C.action,
                hasEagerState: C.hasEagerState,
                eagerState: C.eagerState,
                next: null
              }, S === null ? (p = S = X, f = o) : S = S.next = X, ut.lanes |= j, xl |= j;
            C = C.next;
          } while (C !== null && C !== e);
          if (S === null ? f = o : S.next = p, !ve(o, t.memoizedState) && (jt = !0, Y && (l = fn, l !== null)))
            throw l;
          t.memoizedState = o, t.baseState = f, t.baseQueue = S, n.lastRenderedState = o;
        }
        return r === null && (n.lanes = 0), [t.memoizedState, n.dispatch];
      }
      function Ui(t) {
        var e = Mt(), l = e.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = t;
        var n = l.dispatch, r = l.pending, o = e.memoizedState;
        if (r !== null) {
          l.pending = null;
          var f = r = r.next;
          do
            o = t(o, f.action), f = f.next;
          while (f !== r);
          ve(o, e.memoizedState) || (jt = !0), e.memoizedState = o, e.baseQueue === null && (e.baseState = o), l.lastRenderedState = o;
        }
        return [o, n];
      }
      function tu(t, e, l) {
        var n = ut, r = Mt(), o = pt;
        if (o) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = e();
        var f = !ve(
          (wt || r).memoizedState,
          l
        );
        if (f && (r.memoizedState = l, jt = !0), r = r.queue, Bi(nu.bind(null, n, r, t), [
          t
        ]), r.getSnapshot !== e || f || Rt !== null && Rt.memoizedState.tag & 1) {
          if (n.flags |= 2048, Fl(
            9,
            { destroy: void 0 },
            lu.bind(
              null,
              n,
              r,
              l,
              e
            ),
            null
          ), _t === null) throw Error(s(349));
          o || ($e & 127) !== 0 || eu(n, e, l);
        }
        return l;
      }
      function eu(t, e, l) {
        t.flags |= 16384, t = { getSnapshot: e, value: l }, e = ut.updateQueue, e === null ? (e = ga(), ut.updateQueue = e, e.stores = [t]) : (l = e.stores, l === null ? e.stores = [t] : l.push(t));
      }
      function lu(t, e, l, n) {
        e.value = l, e.getSnapshot = n, au(e) && iu(t);
      }
      function nu(t, e, l) {
        return l(function() {
          au(e) && iu(t);
        });
      }
      function au(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var l = e();
          return !ve(t, l);
        } catch {
          return !0;
        }
      }
      function iu(t) {
        var e = Al(t, 2);
        e !== null && ie(e, t, 2);
      }
      function Di(t) {
        var e = ne();
        if (typeof t == "function") {
          var l = t;
          if (t = l(), Ql) {
            At(!0);
            try {
              l();
            } finally {
              At(!1);
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
      function ru(t, e, l, n) {
        return t.baseState = l, ji(
          t,
          wt,
          typeof n == "function" ? n : Ke
        );
      }
      function Pf(t, e, l, n, r) {
        if (_a(t)) throw Error(s(485));
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
            then: function(f) {
              o.listeners.push(f);
            }
          };
          P.T !== null ? l(!0) : o.isTransition = !1, n(o), l = e.pending, l === null ? (o.next = e.pending = o, ou(e, o)) : (o.next = l.next, e.pending = l.next = o);
        }
      }
      function ou(t, e) {
        var l = e.action, n = e.payload, r = t.state;
        if (e.isTransition) {
          var o = P.T, f = {};
          P.T = f;
          try {
            var p = l(r, n), S = P.S;
            S !== null && S(f, p), uu(t, e, p);
          } catch (C) {
            qi(t, e, C);
          } finally {
            o !== null && f.types !== null && (o.types = f.types), P.T = o;
          }
        } else
          try {
            o = l(r, n), uu(t, e, o);
          } catch (C) {
            qi(t, e, C);
          }
      }
      function uu(t, e, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(n) {
            cu(t, e, n);
          },
          function(n) {
            return qi(t, e, n);
          }
        ) : cu(t, e, l);
      }
      function cu(t, e, l) {
        e.status = "fulfilled", e.value = l, su(e), t.state = l, e = t.pending, e !== null && (l = e.next, l === e ? t.pending = null : (l = l.next, e.next = l, ou(t, l)));
      }
      function qi(t, e, l) {
        var n = t.pending;
        if (t.pending = null, n !== null) {
          n = n.next;
          do
            e.status = "rejected", e.reason = l, su(e), e = e.next;
          while (e !== n);
        }
        t.action = null;
      }
      function su(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function fu(t, e) {
        return e;
      }
      function du(t, e) {
        if (pt) {
          var l = _t.formState;
          if (l !== null) {
            t: {
              var n = ut;
              if (pt) {
                if (Et) {
                  var r = vm(
                    Et,
                    Ee
                  );
                  if (r) {
                    Et = rs(r), n = gm(r);
                    break t;
                  }
                }
                rt(n);
              }
              n = !1;
            }
            n && (e = l[0]);
          }
        }
        l = ne(), l.memoizedState = l.baseState = e, n = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: fu,
          lastRenderedState: e
        }, l.queue = n, l = Au.bind(
          null,
          ut,
          n
        ), n.dispatch = l, n = Di(!1);
        var o = Vi.bind(
          null,
          ut,
          !1,
          n.queue
        );
        return n = ne(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, n.queue = r, l = Pf.bind(
          null,
          ut,
          r,
          o,
          l
        ), r.dispatch = l, n.memoizedState = t, [e, l, !1];
      }
      function mu(t) {
        var e = Mt();
        return pu(e, wt, t);
      }
      function pu(t, e, l) {
        if (e = ji(
          t,
          e,
          fu
        )[0], t = ya(Ke)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var n = Mn(e);
          } catch (f) {
            throw f === dn ? Ja : f;
          }
        else n = e;
        e = Mt();
        var r = e.queue, o = r.dispatch;
        return l !== e.memoizedState && (ut.flags |= 2048, Fl(
          9,
          { destroy: void 0 },
          td.bind(null, r, l),
          null
        )), [n, o, t];
      }
      function td(t, e) {
        t.action = e;
      }
      function hu(t) {
        var e = Mt(), l = wt;
        if (l !== null)
          return pu(e, l, t);
        Mt(), e = e.memoizedState, l = Mt();
        var n = l.queue.dispatch;
        return l.memoizedState = t, [e, n, !1];
      }
      function Fl(t, e, l, n) {
        return t = { tag: t, create: l, deps: n, inst: e, next: null }, e = ut.updateQueue, e === null && (e = ga(), ut.updateQueue = e), l = e.lastEffect, l === null ? e.lastEffect = t.next = t : (n = l.next, l.next = t, t.next = n, e.lastEffect = t), t;
      }
      function vu() {
        return Mt().memoizedState;
      }
      function xa(t, e, l, n) {
        var r = ne();
        ut.flags |= t, r.memoizedState = Fl(
          1 | e,
          { destroy: void 0 },
          l,
          n === void 0 ? null : n
        );
      }
      function wa(t, e, l, n) {
        var r = Mt();
        n = n === void 0 ? null : n;
        var o = r.memoizedState.inst;
        wt !== null && n !== null && ki(n, wt.memoizedState.deps) ? r.memoizedState = Fl(e, o, l, n) : (ut.flags |= t, r.memoizedState = Fl(
          1 | e,
          o,
          l,
          n
        ));
      }
      function gu(t, e) {
        xa(8390656, 8, t, e);
      }
      function Bi(t, e) {
        wa(2048, 8, t, e);
      }
      function ed(t) {
        ut.flags |= 4;
        var e = ut.updateQueue;
        if (e === null)
          e = ga(), ut.updateQueue = e, e.events = [t];
        else {
          var l = e.events;
          l === null ? e.events = [t] : l.push(t);
        }
      }
      function bu(t) {
        var e = Mt().memoizedState;
        return ed({ ref: e, nextImpl: t }), function() {
          if ((ft & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function yu(t, e) {
        return wa(4, 2, t, e);
      }
      function xu(t, e) {
        return wa(4, 4, t, e);
      }
      function wu(t, e) {
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
      function _u(t, e, l) {
        l = l != null ? l.concat([t]) : null, wa(
          4,
          4,
          wu.bind(null, e, t),
          l
        );
      }
      function Yi() {
      }
      function Su(t, e) {
        var l = Mt();
        e = e === void 0 ? null : e;
        var n = l.memoizedState;
        return e !== null && ki(e, n[1]) ? n[0] : (l.memoizedState = [t, e], t);
      }
      function zu(t, e) {
        var l = Mt();
        e = e === void 0 ? null : e;
        var n = l.memoizedState;
        if (e !== null && ki(e, n[1]))
          return n[0];
        if (n = t(), Ql) {
          At(!0);
          try {
            t();
          } finally {
            At(!1);
          }
        }
        return l.memoizedState = [n, e], n;
      }
      function Gi(t, e, l) {
        return l === void 0 || ($e & 1073741824) !== 0 && (mt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = l, t = xc(), ut.lanes |= t, xl |= t, l);
      }
      function Eu(t, e, l, n) {
        return ve(l, e) ? l : hn.current !== null ? (t = Gi(t, l, n), ve(t, e) || (jt = !0), t) : ($e & 42) === 0 || ($e & 1073741824) !== 0 && (mt & 261930) === 0 ? (jt = !0, t.memoizedState = l) : (t = xc(), ut.lanes |= t, xl |= t, e);
      }
      function Nu(t, e, l, n, r) {
        var o = Fe();
        Vt(
          o !== 0 && 8 > o ? o : 8
        );
        var f = P.T, p = {};
        P.T = p, Vi(t, !1, e, l);
        try {
          var S = r(), C = P.S;
          if (C !== null && C(p, S), S !== null && typeof S == "object" && typeof S.then == "function") {
            var Y = If(
              S,
              n
            );
            On(
              t,
              e,
              Y,
              de(t)
            );
          } else
            On(
              t,
              e,
              n,
              de(t)
            );
        } catch (j) {
          On(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: j },
            de()
          );
        } finally {
          Vt(o), f !== null && p.types !== null && (f.types = p.types), P.T = f;
        }
      }
      function Tu(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: ln,
          baseState: ln,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ke,
            lastRenderedState: ln
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
      function Qi() {
        return Jt(Ul);
      }
      function Cu() {
        return Mt().memoizedState;
      }
      function ku() {
        return Mt().memoizedState;
      }
      function ld(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var l = de();
              t = ol(l);
              var n = ul(e, t, l);
              n !== null && (ie(n, e, l), Cn(n, e, l)), e = { cache: yi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function nd(t, e, l) {
        var n = de();
        l = {
          lane: n,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, _a(t) ? Mu(e, l) : (l = _i(t, e, l, n), l !== null && (ie(l, t, n), Ou(l, e, n)));
      }
      function Au(t, e, l) {
        var n = de();
        On(t, e, l, n);
      }
      function On(t, e, l, n) {
        var r = {
          lane: n,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (_a(t)) Mu(e, r);
        else {
          var o = t.alternate;
          if (t.lanes === 0 && (o === null || o.lanes === 0) && (o = e.lastRenderedReducer, o !== null))
            try {
              var f = e.lastRenderedState, p = o(f, l);
              if (r.hasEagerState = !0, r.eagerState = p, ve(p, f))
                return pa(t, e, r, 0), _t === null && ma(), !1;
            } catch {
            } finally {
            }
          if (l = _i(t, e, r, n), l !== null)
            return ie(l, t, n), Ou(l, e, n), !0;
        }
        return !1;
      }
      function Vi(t, e, l, n) {
        if (n = {
          lane: 2,
          revertLane: xi(),
          gesture: null,
          action: n,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, _a(t)) {
          if (e) throw Error(s(479));
        } else
          e = _i(
            t,
            l,
            n,
            2
          ), e !== null && ie(e, t, 2);
      }
      function _a(t) {
        var e = t.alternate;
        return t === ut || e !== null && e === ut;
      }
      function Mu(t, e) {
        vn = Fa = !0;
        var l = t.pending;
        l === null ? e.next = e : (e.next = l.next, l.next = e), t.pending = e;
      }
      function Ou(t, e, l) {
        if ((l & 4194048) !== 0) {
          var n = e.lanes;
          n &= t.pendingLanes, l |= n, e.lanes = l, V(t, l);
        }
      }
      function Ki(t, e, l, n) {
        e = t.memoizedState, l = l(n, e), l = l == null ? e : yr({}, e, l), t.memoizedState = l, t.lanes === 0 && (t.updateQueue.baseState = l);
      }
      function Hu(t, e, l, n, r, o, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(n, o, f) : e.prototype && e.prototype.isPureReactComponent ? !sa(l, n) || !sa(r, o) : !0;
      }
      function Ru(t, e, l, n) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(l, n), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(l, n), e.state !== t && Kr.enqueueReplaceState(e, e.state, null);
      }
      function Ml(t, e) {
        var l = e;
        if ("ref" in e) {
          l = {};
          for (var n in e)
            n !== "ref" && (l[n] = e[n]);
        }
        if (t = t.defaultProps) {
          l === e && (l = yr({}, l));
          for (var r in t)
            l[r] === void 0 && (l[r] = t[r]);
        }
        return l;
      }
      function Sa(t, e) {
        try {
          var l = t.onUncaughtError;
          l(e.value, { componentStack: e.stack });
        } catch (n) {
          setTimeout(function() {
            throw n;
          });
        }
      }
      function ju(t, e, l) {
        try {
          var n = t.onCaughtError;
          n(l.value, {
            componentStack: l.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Xi(t, e, l) {
        return l = ol(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          Sa(t, e);
        }, l;
      }
      function Uu(t) {
        return t = ol(t), t.tag = 3, t;
      }
      function Du(t, e, l, n) {
        var r = l.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var o = n.value;
          t.payload = function() {
            return r(o);
          }, t.callback = function() {
            ju(e, l, n);
          };
        }
        var f = l.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          ju(e, l, n), typeof r != "function" && (wl === null ? wl = /* @__PURE__ */ new Set([this]) : wl.add(this));
          var p = n.stack;
          this.componentDidCatch(n.value, {
            componentStack: p !== null ? p : ""
          });
        });
      }
      function ad(t, e, l, n, r) {
        if (l.flags |= 32768, n !== null && typeof n == "object" && typeof n.then == "function") {
          if (e = l.alternate, e !== null && Ll(
            e,
            l,
            r,
            !0
          ), l = ge.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return Te === null ? Oa() : l.alternate === null && kt === 0 && (kt = 3), l.flags &= -257, l.flags |= 65536, l.lanes = r, n === La ? l.flags |= 16384 : (e = l.updateQueue, e === null ? l.updateQueue = /* @__PURE__ */ new Set([n]) : e.add(n), pr(t, n, r)), !1;
              case 22:
                return l.flags |= 65536, n === La ? l.flags |= 16384 : (e = l.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([n])
                }, l.updateQueue = e) : (l = e.retryQueue, l === null ? e.retryQueue = /* @__PURE__ */ new Set([n]) : l.add(n)), pr(t, n, r)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return pr(t, n, r), Oa(), !1;
        }
        if (pt)
          return e = ge.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, n !== Ur && (t = Error(s(422), { cause: n }), En(
            it(t, l)
          ))) : (n !== Ur && (e = Error(s(423), {
            cause: n
          }), En(
            it(e, l)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, n = it(n, l), r = Xi(
            t.stateNode,
            n,
            r
          ), Ei(t, r), kt !== 4 && (kt = 2)), !1;
        var o = Error(s(520), { cause: n });
        if (o = it(o, l), In === null ? In = [o] : In.push(o), kt !== 4 && (kt = 2), e === null) return !0;
        n = it(n, l), l = e;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, t = r & -r, l.lanes |= t, t = Xi(l.stateNode, n, t), Ei(l, t), !1;
            case 1:
              if (e = l.type, o = l.stateNode, (l.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (wl === null || !wl.has(
                o
              ))))
                return l.flags |= 65536, r &= -r, l.lanes |= r, r = Uu(r), Du(
                  r,
                  t,
                  l,
                  n
                ), Ei(l, r), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function Lt(t, e, l, n) {
        e.child = t === null ? Ss(e, null, l, n) : Gl(
          e,
          t.child,
          l,
          n
        );
      }
      function qu(t, e, l, n, r) {
        l = l.render;
        var o = e.ref;
        if ("ref" in n) {
          var f = {};
          for (var p in n)
            p !== "ref" && (f[p] = n[p]);
        } else f = n;
        return Cl(e), n = Ai(
          t,
          e,
          l,
          f,
          o,
          r
        ), p = Mi(), t !== null && !jt ? (Oi(t, e, r), Xe(t, e, r)) : (pt && p && k(e), e.flags |= 1, Lt(t, e, n, r), e.child);
      }
      function Bu(t, e, l, n, r) {
        if (t === null) {
          var o = l.type;
          return typeof o == "function" && !hr(o) && o.defaultProps === void 0 && l.compare === null ? (e.tag = 15, e.type = o, Yu(
            t,
            e,
            o,
            n,
            r
          )) : (t = Ra(
            l.type,
            null,
            n,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (o = t.child, !$i(t, r)) {
          var f = o.memoizedProps;
          if (l = l.compare, l = l !== null ? l : sa, l(f, n) && t.ref === e.ref)
            return Xe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Le(o, n), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Yu(t, e, l, n, r) {
        if (t !== null) {
          var o = t.memoizedProps;
          if (sa(o, n) && t.ref === e.ref)
            if (jt = !1, e.pendingProps = n = o, $i(t, r))
              (t.flags & 131072) !== 0 && (jt = !0);
            else
              return e.lanes = t.lanes, Xe(t, e, r);
        }
        return Zi(
          t,
          e,
          l,
          n,
          r
        );
      }
      function Gu(t, e, l, n) {
        var r = n.children, o = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), n.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (o = o !== null ? o.baseLanes | l : l, t !== null) {
              for (n = e.child = t.child, r = 0; n !== null; )
                r = r | n.lanes | n.childLanes, n = n.sibling;
              n = r & ~o;
            } else n = 0, e.child = null;
            return Qu(
              t,
              e,
              o,
              l,
              n
            );
          }
          if ((l & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && ca(
              e,
              o !== null ? o.cachePool : null
            ), o !== null ? Fo(e, o) : Ni(), Io(e);
          else
            return n = e.lanes = 536870912, Qu(
              t,
              e,
              o !== null ? o.baseLanes | l : l,
              l,
              n
            );
        } else
          o !== null ? (ca(e, o.cachePool), Fo(e, o), sl(), e.memoizedState = null) : (t !== null && ca(e, null), Ni(), sl());
        return Lt(t, e, r, l), e.child;
      }
      function Hn(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Qu(t, e, l, n, r) {
        var o = wi();
        return o = o === null ? null : {
          parent: We ? Nt._currentValue : Nt._currentValue2,
          pool: o
        }, e.memoizedState = {
          baseLanes: l,
          cachePool: o
        }, t !== null && ca(e, null), Ni(), Io(e), t !== null && Ll(t, e, n, !0), e.childLanes = r, null;
      }
      function za(t, e) {
        return e = Na(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Vu(t, e, l) {
        return Gl(e, t.child, null, l), t = za(
          e,
          e.pendingProps
        ), t.flags |= 2, fe(e), e.memoizedState = null, t;
      }
      function id(t, e, l) {
        var n = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (pt) {
            if (n.mode === "hidden")
              return t = za(e, n), e.lanes = 536870912, Hn(null, t);
            if (Ci(e), (t = Et) ? (t = Nm(
              t,
              Ee
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: hl !== null ? { id: Be, overflow: Ye } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Yc(t), l.return = e, e.child = l, Ft = e, Et = null)) : t = null, t === null) throw rt(e);
            return e.lanes = 536870912, null;
          }
          return za(e, n);
        }
        var o = t.memoizedState;
        if (o !== null) {
          var f = o.dehydrated;
          if (Ci(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = Vu(
                t,
                e,
                l
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (jt || Ll(
            t,
            e,
            l,
            !1
          ), r = (l & t.childLanes) !== 0, jt || r) {
            if (n = _t, n !== null && (f = yt(n, l), f !== 0 && f !== o.retryLane))
              throw o.retryLane = f, Al(t, f), ie(n, t, f), Xr;
            Oa(), e = Vu(
              t,
              e,
              l
            );
          } else
            t = o.treeContext, le && (Et = wm(f), Ft = e, pt = !0, gl = null, Ee = !1, t !== null && L(e, t)), e = za(e, n), e.flags |= 4096;
          return e;
        }
        return t = Le(t.child, {
          mode: n.mode,
          children: n.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Ea(t, e) {
        var l = e.ref;
        if (l === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (t === null || t.ref !== l) && (e.flags |= 4194816);
        }
      }
      function Zi(t, e, l, n, r) {
        return Cl(e), l = Ai(
          t,
          e,
          l,
          n,
          void 0,
          r
        ), n = Mi(), t !== null && !jt ? (Oi(t, e, r), Xe(t, e, r)) : (pt && n && k(e), e.flags |= 1, Lt(t, e, l, r), e.child);
      }
      function Ku(t, e, l, n, r, o) {
        return Cl(e), e.updateQueue = null, l = Po(
          e,
          n,
          l,
          r
        ), $o(t), n = Mi(), t !== null && !jt ? (Oi(t, e, o), Xe(t, e, o)) : (pt && n && k(e), e.flags |= 1, Lt(t, e, l, o), e.child);
      }
      function Xu(t, e, l, n, r) {
        if (Cl(e), e.stateNode === null) {
          var o = rn, f = l.contextType;
          typeof f == "object" && f !== null && (o = Jt(f)), o = new l(n, o), e.memoizedState = o.state !== null && o.state !== void 0 ? o.state : null, o.updater = Kr, e.stateNode = o, o._reactInternals = e, o = e.stateNode, o.props = n, o.state = e.memoizedState, o.refs = {}, Si(e), f = l.contextType, o.context = typeof f == "object" && f !== null ? Jt(f) : rn, o.state = e.memoizedState, f = l.getDerivedStateFromProps, typeof f == "function" && (Ki(
            e,
            l,
            f,
            n
          ), o.state = e.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof o.getSnapshotBeforeUpdate == "function" || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (f = o.state, typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount(), f !== o.state && Kr.enqueueReplaceState(
            o,
            o.state,
            null
          ), An(e, n, o, r), kn(), o.state = e.memoizedState), typeof o.componentDidMount == "function" && (e.flags |= 4194308), n = !0;
        } else if (t === null) {
          o = e.stateNode;
          var p = e.memoizedProps, S = Ml(l, p);
          o.props = S;
          var C = o.context, Y = l.contextType;
          f = rn, typeof Y == "object" && Y !== null && (f = Jt(Y));
          var j = l.getDerivedStateFromProps;
          Y = typeof j == "function" || typeof o.getSnapshotBeforeUpdate == "function", p = e.pendingProps !== p, Y || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (p || C !== f) && Ru(
            e,
            o,
            n,
            f
          ), bl = !1;
          var X = e.memoizedState;
          o.state = X, An(e, n, o, r), kn(), C = e.memoizedState, p || X !== C || bl ? (typeof j == "function" && (Ki(
            e,
            l,
            j,
            n
          ), C = e.memoizedState), (S = bl || Hu(
            e,
            l,
            S,
            n,
            X,
            C,
            f
          )) ? (Y || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = n, e.memoizedState = C), o.props = n, o.state = C, o.context = f, n = S) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), n = !1);
        } else {
          o = e.stateNode, zi(t, e), f = e.memoizedProps, Y = Ml(l, f), o.props = Y, j = e.pendingProps, X = o.context, C = l.contextType, S = rn, typeof C == "object" && C !== null && (S = Jt(C)), p = l.getDerivedStateFromProps, (C = typeof p == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (f !== j || X !== S) && Ru(
            e,
            o,
            n,
            S
          ), bl = !1, X = e.memoizedState, o.state = X, An(e, n, o, r), kn();
          var ot = e.memoizedState;
          f !== j || X !== ot || bl || t !== null && t.dependencies !== null && ra(t.dependencies) ? (typeof p == "function" && (Ki(
            e,
            l,
            p,
            n
          ), ot = e.memoizedState), (Y = bl || Hu(
            e,
            l,
            Y,
            n,
            X,
            ot,
            S
          ) || t !== null && t.dependencies !== null && ra(t.dependencies)) ? (C || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(n, ot, S), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(
            n,
            ot,
            S
          )), typeof o.componentDidUpdate == "function" && (e.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || f === t.memoizedProps && X === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && X === t.memoizedState || (e.flags |= 1024), e.memoizedProps = n, e.memoizedState = ot), o.props = n, o.state = ot, o.context = S, n = Y) : (typeof o.componentDidUpdate != "function" || f === t.memoizedProps && X === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && X === t.memoizedState || (e.flags |= 1024), n = !1);
        }
        return o = n, Ea(t, e), n = (e.flags & 128) !== 0, o || n ? (o = e.stateNode, l = n && typeof l.getDerivedStateFromError != "function" ? null : o.render(), e.flags |= 1, t !== null && n ? (e.child = Gl(
          e,
          t.child,
          null,
          r
        ), e.child = Gl(
          e,
          null,
          l,
          r
        )) : Lt(t, e, l, r), e.memoizedState = o.state, t = e.child) : t = Xe(
          t,
          e,
          r
        ), t;
      }
      function Zu(t, e, l, n) {
        return ke(), e.flags |= 256, Lt(t, e, l, n), e.child;
      }
      function Ji(t) {
        return { baseLanes: t, cachePool: Go() };
      }
      function Li(t, e, l) {
        return t = t !== null ? t.childLanes & ~l : 0, e && (t |= ye), t;
      }
      function Ju(t, e, l) {
        var n = e.pendingProps, r = !1, o = (e.flags & 128) !== 0, f;
        if ((f = o) || (f = t !== null && t.memoizedState === null ? !1 : (Ot.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (pt) {
            if (r ? cl(e) : sl(), (t = Et) ? (t = Tm(
              t,
              Ee
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: hl !== null ? { id: Be, overflow: Ye } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Yc(t), l.return = e, e.child = l, Ft = e, Et = null)) : t = null, t === null) throw rt(e);
            return kr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var p = n.children;
          return n = n.fallback, r ? (sl(), r = e.mode, p = Na(
            { mode: "hidden", children: p },
            r
          ), n = Rl(
            n,
            r,
            l,
            null
          ), p.return = e, n.return = e, p.sibling = n, e.child = p, n = e.child, n.memoizedState = Ji(l), n.childLanes = Li(
            t,
            f,
            l
          ), e.memoizedState = Zr, Hn(null, n)) : (cl(e), Wi(e, p));
        }
        var S = t.memoizedState;
        if (S !== null && (p = S.dehydrated, p !== null)) {
          if (o)
            e.flags & 256 ? (cl(e), e.flags &= -257, e = Fi(
              t,
              e,
              l
            )) : e.memoizedState !== null ? (sl(), e.child = t.child, e.flags |= 128, e = null) : (sl(), p = n.fallback, r = e.mode, n = Na(
              { mode: "visible", children: n.children },
              r
            ), p = Rl(
              p,
              r,
              l,
              null
            ), p.flags |= 2, n.return = e, p.return = e, n.sibling = p, e.child = n, Gl(
              e,
              t.child,
              null,
              l
            ), n = e.child, n.memoizedState = Ji(l), n.childLanes = Li(
              t,
              f,
              l
            ), e.memoizedState = Zr, e = Hn(null, n));
          else if (cl(e), kr(p))
            f = pm(p).digest, n = Error(s(419)), n.stack = "", n.digest = f, En({ value: n, source: null, stack: null }), e = Fi(
              t,
              e,
              l
            );
          else if (jt || Ll(
            t,
            e,
            l,
            !1
          ), f = (l & t.childLanes) !== 0, jt || f) {
            if (f = _t, f !== null && (n = yt(
              f,
              l
            ), n !== 0 && n !== S.retryLane))
              throw S.retryLane = n, Al(t, n), ie(f, t, n), Xr;
            Cr(p) || Oa(), e = Fi(
              t,
              e,
              l
            );
          } else
            Cr(p) ? (e.flags |= 192, e.child = t.child, e = null) : (t = S.treeContext, le && (Et = _m(
              p
            ), Ft = e, pt = !0, gl = null, Ee = !1, t !== null && L(e, t)), e = Wi(
              e,
              n.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (sl(), p = n.fallback, r = e.mode, S = t.child, o = S.sibling, n = Le(S, {
          mode: "hidden",
          children: n.children
        }), n.subtreeFlags = S.subtreeFlags & 65011712, o !== null ? p = Le(
          o,
          p
        ) : (p = Rl(
          p,
          r,
          l,
          null
        ), p.flags |= 2), p.return = e, n.return = e, n.sibling = p, e.child = n, Hn(null, n), n = e.child, p = t.child.memoizedState, p === null ? p = Ji(l) : (r = p.cachePool, r !== null ? (S = We ? Nt._currentValue : Nt._currentValue2, r = r.parent !== S ? { parent: S, pool: S } : r) : r = Go(), p = {
          baseLanes: p.baseLanes | l,
          cachePool: r
        }), n.memoizedState = p, n.childLanes = Li(
          t,
          f,
          l
        ), e.memoizedState = Zr, Hn(t.child, n)) : (cl(e), l = t.child, t = l.sibling, l = Le(l, {
          mode: "visible",
          children: n.children
        }), l.return = e, l.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = l, e.memoizedState = null, l);
      }
      function Wi(t, e) {
        return e = Na(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Na(t, e) {
        return t = u(22, t, null, e), t.lanes = 0, t;
      }
      function Fi(t, e, l) {
        return Gl(e, t.child, null, l), t = Wi(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Lu(t, e, l) {
        t.lanes |= e;
        var n = t.alternate;
        n !== null && (n.lanes |= e), gi(t.return, e, l);
      }
      function Ii(t, e, l, n, r, o) {
        var f = t.memoizedState;
        f === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: n,
          tail: l,
          tailMode: r,
          treeForkCount: o
        } : (f.isBackwards = e, f.rendering = null, f.renderingStartTime = 0, f.last = n, f.tail = l, f.tailMode = r, f.treeForkCount = o);
      }
      function Wu(t, e, l) {
        var n = e.pendingProps, r = n.revealOrder, o = n.tail;
        n = n.children;
        var f = Ot.current, p = (f & 2) !== 0;
        if (p ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, T(Ot, f), Lt(t, e, n, l), n = pt ? Kn : 0, !p && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Lu(t, l, e);
            else if (t.tag === 19)
              Lu(t, l, e);
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
              t = l.alternate, t !== null && va(t) === null && (r = l), l = l.sibling;
            l = r, l === null ? (r = e.child, e.child = null) : (r = l.sibling, l.sibling = null), Ii(
              e,
              !1,
              r,
              l,
              o,
              n
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (l = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && va(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = l, l = r, r = t;
            }
            Ii(
              e,
              !0,
              l,
              null,
              o,
              n
            );
            break;
          case "together":
            Ii(
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
          throw Error(s(153));
        if (e.child !== null) {
          for (t = e.child, l = Le(t, t.pendingProps), e.child = l, l.return = e; t.sibling !== null; )
            t = t.sibling, l = l.sibling = Le(t, t.pendingProps), l.return = e;
          l.sibling = null;
        }
        return e.child;
      }
      function $i(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && ra(t)));
      }
      function rd(t, e, l) {
        switch (e.tag) {
          case 3:
            W(
              e,
              e.stateNode.containerInfo
            ), rl(e, Nt, t.memoizedState.cache), ke();
            break;
          case 27:
          case 5:
            ht(e);
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
              return e.flags |= 128, Ci(e), null;
            break;
          case 13:
            var n = e.memoizedState;
            if (n !== null)
              return n.dehydrated !== null ? (cl(e), e.flags |= 128, null) : (l & e.child.childLanes) !== 0 ? Ju(
                t,
                e,
                l
              ) : (cl(e), t = Xe(
                t,
                e,
                l
              ), t !== null ? t.sibling : null);
            cl(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (n = (l & e.childLanes) !== 0, n || (Ll(
              t,
              e,
              l,
              !1
            ), n = (l & e.childLanes) !== 0), r) {
              if (n)
                return Wu(
                  t,
                  e,
                  l
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), T(Ot, Ot.current), n) break;
            return null;
          case 22:
            return e.lanes = 0, Gu(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            rl(e, Nt, t.memoizedState.cache);
        }
        return Xe(t, e, l);
      }
      function Fu(t, e, l) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            jt = !0;
          else {
            if (!$i(t, l) && (e.flags & 128) === 0)
              return jt = !1, rd(
                t,
                e,
                l
              );
            jt = (t.flags & 131072) !== 0;
          }
        else
          jt = !1, pt && (e.flags & 1048576) !== 0 && v(e, Kn, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var n = e.pendingProps;
              if (t = kl(e.elementType), e.type = t, typeof t == "function")
                hr(t) ? (n = Ml(t, n), e.tag = 1, e = Xu(
                  null,
                  e,
                  t,
                  n,
                  l
                )) : (e.tag = 0, e = Zi(
                  null,
                  e,
                  t,
                  n,
                  l
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === wr) {
                    e.tag = 11, e = qu(
                      null,
                      e,
                      t,
                      n,
                      l
                    );
                    break t;
                  } else if (r === zr) {
                    e.tag = 14, e = Bu(
                      null,
                      e,
                      t,
                      n,
                      l
                    );
                    break t;
                  }
                }
                throw e = H(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return Zi(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 1:
            return n = e.type, r = Ml(
              n,
              e.pendingProps
            ), Xu(
              t,
              e,
              n,
              r,
              l
            );
          case 3:
            t: {
              if (W(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var o = e.pendingProps;
              r = e.memoizedState, n = r.element, zi(t, e), An(e, o, null, l);
              var f = e.memoizedState;
              if (o = f.cache, rl(e, Nt, o), o !== r.cache && bi(
                e,
                [Nt],
                l,
                !0
              ), kn(), o = f.element, le && r.isDehydrated)
                if (r = {
                  element: o,
                  isDehydrated: !1,
                  cache: f.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = Zu(
                    t,
                    e,
                    o,
                    l
                  );
                  break t;
                } else if (o !== n) {
                  n = it(
                    Error(s(424)),
                    e
                  ), En(n), e = Zu(
                    t,
                    e,
                    o,
                    l
                  );
                  break t;
                } else
                  for (le && (Et = xm(
                    e.stateNode.containerInfo
                  ), Ft = e, pt = !0, gl = null, Ee = !0), l = Ss(
                    e,
                    null,
                    o,
                    l
                  ), e.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (ke(), o === n) {
                  e = Xe(
                    t,
                    e,
                    l
                  );
                  break t;
                }
                Lt(t, e, o, l);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (He)
              return Ea(t, e), t === null ? (l = cs(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = l : pt || (e.stateNode = Jm(
                e.type,
                e.pendingProps,
                vl.current,
                e
              )) : e.memoizedState = cs(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Bt)
              return ht(e), t === null && Bt && pt && (n = e.stateNode = hs(
                e.type,
                e.pendingProps,
                vl.current,
                Wt.current,
                !1
              ), Ft = e, Ee = !0, Et = Sm(
                e.type,
                n,
                Et
              )), Lt(
                t,
                e,
                e.pendingProps.children,
                l
              ), Ea(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && pt && (Km(
              e.type,
              e.pendingProps,
              Wt.current
            ), (r = n = Et) && (n = zm(
              n,
              e.type,
              e.pendingProps,
              Ee
            ), n !== null ? (e.stateNode = n, Ft = e, Et = ym(n), Ee = !1, r = !0) : r = !1), r || rt(e)), ht(e), r = e.type, o = e.pendingProps, f = t !== null ? t.memoizedProps : null, n = o.children, Da(r, o) ? n = null : f !== null && Da(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = Ai(
              t,
              e,
              $f,
              null,
              null,
              l
            ), We ? Ul._currentValue = r : Ul._currentValue2 = r), Ea(t, e), Lt(t, e, n, l), e.child;
          case 6:
            return t === null && pt && (Xm(
              e.pendingProps,
              Wt.current
            ), (t = l = Et) && (l = Em(
              l,
              e.pendingProps,
              Ee
            ), l !== null ? (e.stateNode = l, Ft = e, Et = null, t = !0) : t = !1), t || rt(e)), null;
          case 13:
            return Ju(t, e, l);
          case 4:
            return W(
              e,
              e.stateNode.containerInfo
            ), n = e.pendingProps, t === null ? e.child = Gl(
              e,
              null,
              n,
              l
            ) : Lt(t, e, n, l), e.child;
          case 11:
            return qu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 7:
            return Lt(
              t,
              e,
              e.pendingProps,
              l
            ), e.child;
          case 8:
            return Lt(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 12:
            return Lt(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 10:
            return n = e.pendingProps, rl(e, e.type, n.value), Lt(
              t,
              e,
              n.children,
              l
            ), e.child;
          case 9:
            return r = e.type._context, n = e.pendingProps.children, Cl(e), r = Jt(r), n = n(r), e.flags |= 1, Lt(t, e, n, l), e.child;
          case 14:
            return Bu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 15:
            return Yu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 19:
            return Wu(
              t,
              e,
              l
            );
          case 31:
            return id(t, e, l);
          case 22:
            return Gu(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            return Cl(e), n = Jt(Nt), t === null ? (r = wi(), r === null && (r = _t, o = yi(), r.pooledCache = o, o.refCount++, o !== null && (r.pooledCacheLanes |= l), r = o), e.memoizedState = {
              parent: n,
              cache: r
            }, Si(e), rl(e, Nt, r)) : ((t.lanes & l) !== 0 && (zi(t, e), An(e, null, null, l), kn()), r = t.memoizedState, o = e.memoizedState, r.parent !== n ? (r = { parent: n, cache: n }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), rl(e, Nt, n)) : (n = o.cache, rl(e, Nt, n), n !== r.cache && bi(
              e,
              [Nt],
              l,
              !0
            ))), Lt(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 29:
            throw e.pendingProps;
        }
        throw Error(s(156, e.tag));
      }
      function Ae(t) {
        t.flags |= 4;
      }
      function Ta(t) {
        qe && (t.flags |= 8);
      }
      function Iu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Pi(t, e, l, n) {
        if (ee)
          for (l = e.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              Nr(t, l.stateNode);
            else if (!(l.tag === 4 || Bt && l.tag === 27) && l.child !== null) {
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
              l && n && (o = as(
                o,
                r.type,
                r.memoizedProps
              )), Nr(t, o);
            } else if (r.tag === 6)
              o = r.stateNode, l && n && (o = is(
                o,
                r.memoizedProps
              )), Nr(t, o);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                o = r.child, o !== null && (o.return = r), Pi(t, r, !0, !0);
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
      function $u(t, e, l, n) {
        var r = !1;
        if (qe)
          for (var o = e.child; o !== null; ) {
            if (o.tag === 5) {
              var f = o.stateNode;
              l && n && (f = as(
                f,
                o.type,
                o.memoizedProps
              )), ls(t, f);
            } else if (o.tag === 6)
              f = o.stateNode, l && n && (f = is(
                f,
                o.memoizedProps
              )), ls(t, f);
            else if (o.tag !== 4) {
              if (o.tag === 22 && o.memoizedState !== null)
                r = o.child, r !== null && (r.return = o), $u(t, o, !0, !0), r = !0;
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
      function Pu(t, e) {
        if (qe && Iu(t, e)) {
          t = e.stateNode;
          var l = t.containerInfo, n = es();
          $u(n, e, !1, !1), t.pendingChildren = n, Ae(e), mm(l, n);
        }
      }
      function tr(t, e, l, n) {
        if (ee)
          t.memoizedProps !== n && Ae(e);
        else if (qe) {
          var r = t.stateNode, o = t.memoizedProps;
          if ((t = Iu(t, e)) || o !== n) {
            var f = Wt.current;
            o = dm(
              r,
              l,
              o,
              n,
              !t,
              null
            ), o === r ? e.stateNode = r : (Ta(e), Fc(
              o,
              l,
              n,
              f
            ) && Ae(e), e.stateNode = o, t && Pi(o, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function er(t, e, l, n, r) {
        if ((t.mode & 32) !== 0 && (l === null ? Bd(e, n) : Yd(e, l, n))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Tr(e, n))
            if ($c(t.stateNode, e, n))
              t.flags |= 8192;
            else if (Ec()) t.flags |= 8192;
            else
              throw Yl = La, Yr;
        } else t.flags &= -16777217;
      }
      function tc(t, e) {
        if (Wm(e)) {
          if (t.flags |= 16777216, !ps(e))
            if (Ec()) t.flags |= 8192;
            else
              throw Yl = La, Yr;
        } else t.flags &= -16777217;
      }
      function Ca(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? K() : 536870912, t.lanes |= e, xn |= e);
      }
      function Rn(t, e) {
        if (!pt)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var l = null; e !== null; )
                e.alternate !== null && (l = e), e = e.sibling;
              l === null ? t.tail = null : l.sibling = null;
              break;
            case "collapsed":
              l = t.tail;
              for (var n = null; l !== null; )
                l.alternate !== null && (n = l), l = l.sibling;
              n === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : n.sibling = null;
          }
      }
      function St(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, l = 0, n = 0;
        if (e)
          for (var r = t.child; r !== null; )
            l |= r.lanes | r.childLanes, n |= r.subtreeFlags & 65011712, n |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            l |= r.lanes | r.childLanes, n |= r.subtreeFlags, n |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= n, t.childLanes = l, e;
      }
      function od(t, e, l) {
        var n = e.pendingProps;
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
            return St(e), null;
          case 1:
            return St(e), null;
          case 3:
            return l = e.stateNode, n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), Ve(Nt), $(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (t === null || t.child === null) && (Ce(e) ? Ae(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, il())), Pu(t, e), St(e), null;
          case 26:
            if (He) {
              var r = e.type, o = e.memoizedState;
              return t === null ? (Ae(e), o !== null ? (St(e), tc(
                e,
                o
              )) : (St(e), er(
                e,
                r,
                null,
                n,
                l
              ))) : o ? o !== t.memoizedState ? (Ae(e), St(e), tc(
                e,
                o
              )) : (St(e), e.flags &= -16777217) : (o = t.memoizedProps, ee ? o !== n && Ae(e) : tr(
                t,
                e,
                r,
                n
              ), St(e), er(
                e,
                r,
                o,
                n,
                l
              )), null;
            }
          case 27:
            if (Bt) {
              if (Qt(e), l = vl.current, r = e.type, t !== null && e.stateNode != null)
                ee ? t.memoizedProps !== n && Ae(e) : tr(t, e, r, n);
              else {
                if (!n) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return St(e), null;
                }
                t = Wt.current, Ce(e) ? Nl(e, t) : (t = hs(
                  r,
                  n,
                  l,
                  t,
                  !0
                ), e.stateNode = t, Ae(e));
              }
              return St(e), null;
            }
          case 5:
            if (Qt(e), r = e.type, t !== null && e.stateNode != null)
              tr(t, e, r, n);
            else {
              if (!n) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return St(e), null;
              }
              if (o = Wt.current, Ce(e))
                Nl(e, o), qm(
                  e.stateNode,
                  r,
                  n,
                  o
                ) && (e.flags |= 64);
              else {
                var f = Md(
                  r,
                  n,
                  vl.current,
                  o,
                  e
                );
                Ta(e), Pi(f, e, !1, !1), e.stateNode = f, Fc(
                  f,
                  r,
                  n,
                  o
                ) && Ae(e);
              }
            }
            return St(e), er(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              l
            ), null;
          case 6:
            if (t && e.stateNode != null)
              l = t.memoizedProps, ee ? l !== n && Ae(e) : qe && (l !== n ? (t = vl.current, l = Wt.current, Ta(e), e.stateNode = Ic(
                n,
                t,
                l,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof n != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = vl.current, l = Wt.current, Ce(e)) {
                if (!le) throw Error(s(176));
                if (t = e.stateNode, l = e.memoizedProps, n = null, r = Ft, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      n = r.memoizedProps;
                  }
                km(
                  t,
                  l,
                  e,
                  n
                ) || rt(e, !0);
              } else
                Ta(e), e.stateNode = Ic(
                  n,
                  t,
                  l,
                  e
                );
            }
            return St(e), null;
          case 31:
            if (l = e.memoizedState, t === null || t.memoizedState !== null) {
              if (n = Ce(e), l !== null) {
                if (t === null) {
                  if (!n) throw Error(s(318));
                  if (!le) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  Am(t, e);
                } else
                  ke(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                St(e), t = !1;
              } else
                l = il(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = l), t = !0;
              if (!t)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return St(e), null;
          case 13:
            if (n = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ce(e), n !== null && n.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!le) throw Error(s(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(s(317));
                  Mm(r, e);
                } else
                  ke(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                St(e), r = !1;
              } else
                r = il(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
            }
            return fe(e), (e.flags & 128) !== 0 ? (e.lanes = l, e) : (l = n !== null, t = t !== null && t.memoizedState !== null, l && (n = e.child, r = null, n.alternate !== null && n.alternate.memoizedState !== null && n.alternate.memoizedState.cachePool !== null && (r = n.alternate.memoizedState.cachePool.pool), o = null, n.memoizedState !== null && n.memoizedState.cachePool !== null && (o = n.memoizedState.cachePool.pool), o !== r && (n.flags |= 2048)), l !== t && l && (e.child.flags |= 8192), Ca(e, e.updateQueue), St(e), null);
          case 4:
            return $(), Pu(t, e), t === null && jd(e.stateNode.containerInfo), St(e), null;
          case 10:
            return Ve(e.type), St(e), null;
          case 19:
            if (E(Ot), n = e.memoizedState, n === null) return St(e), null;
            if (r = (e.flags & 128) !== 0, o = n.rendering, o === null)
              if (r) Rn(n, !1);
              else {
                if (kt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (o = va(t), o !== null) {
                      for (e.flags |= 128, Rn(n, !1), t = o.updateQueue, e.updateQueue = t, Ca(e, t), e.subtreeFlags = 0, t = l, l = e.child; l !== null; )
                        Bc(l, t), l = l.sibling;
                      return T(
                        Ot,
                        Ot.current & 1 | 2
                      ), pt && q(e, n.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                n.tail !== null && re() > $n && (e.flags |= 128, r = !0, Rn(n, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = va(o), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Ca(e, t), Rn(n, !0), n.tail === null && n.tailMode === "hidden" && !o.alternate && !pt)
                    return St(e), null;
                } else
                  2 * re() - n.renderingStartTime > $n && l !== 536870912 && (e.flags |= 128, r = !0, Rn(n, !1), e.lanes = 4194304);
              n.isBackwards ? (o.sibling = e.child, e.child = o) : (t = n.last, t !== null ? t.sibling = o : e.child = o, n.last = o);
            }
            return n.tail !== null ? (t = n.tail, n.rendering = t, n.tail = t.sibling, n.renderingStartTime = re(), t.sibling = null, l = Ot.current, T(
              Ot,
              r ? l & 1 | 2 : l & 1
            ), pt && q(e, n.treeForkCount), t) : (St(e), null);
          case 22:
          case 23:
            return fe(e), Ti(), n = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== n && (e.flags |= 8192) : n && (e.flags |= 8192), n ? (l & 536870912) !== 0 && (e.flags & 128) === 0 && (St(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : St(e), l = e.updateQueue, l !== null && Ca(e, l.retryQueue), l = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), n = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), n !== l && (e.flags |= 2048), t !== null && E(Bl), null;
          case 24:
            return l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Ve(Nt), St(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function ud(t, e) {
        switch (I(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ve(Nt), $(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Qt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (fe(e), e.alternate === null)
                throw Error(s(340));
              ke();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (fe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              ke();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return E(Ot), null;
          case 4:
            return $(), null;
          case 10:
            return Ve(e.type), null;
          case 22:
          case 23:
            return fe(e), Ti(), t !== null && E(Bl), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ve(Nt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function ec(t, e) {
        switch (I(e), e.tag) {
          case 3:
            Ve(Nt), $();
            break;
          case 26:
          case 27:
          case 5:
            Qt(e);
            break;
          case 4:
            $();
            break;
          case 31:
            e.memoizedState !== null && fe(e);
            break;
          case 13:
            fe(e);
            break;
          case 19:
            E(Ot);
            break;
          case 10:
            Ve(e.type);
            break;
          case 22:
          case 23:
            fe(e), Ti(), t !== null && E(Bl);
            break;
          case 24:
            Ve(Nt);
        }
      }
      function jn(t, e) {
        try {
          var l = e.updateQueue, n = l !== null ? l.lastEffect : null;
          if (n !== null) {
            var r = n.next;
            l = r;
            do {
              if ((l.tag & t) === t) {
                n = void 0;
                var o = l.create, f = l.inst;
                n = o(), f.destroy = n;
              }
              l = l.next;
            } while (l !== r);
          }
        } catch (p) {
          vt(e, e.return, p);
        }
      }
      function fl(t, e, l) {
        try {
          var n = e.updateQueue, r = n !== null ? n.lastEffect : null;
          if (r !== null) {
            var o = r.next;
            n = o;
            do {
              if ((n.tag & t) === t) {
                var f = n.inst, p = f.destroy;
                if (p !== void 0) {
                  f.destroy = void 0, r = e;
                  var S = l, C = p;
                  try {
                    C();
                  } catch (Y) {
                    vt(
                      r,
                      S,
                      Y
                    );
                  }
                }
              }
              n = n.next;
            } while (n !== o);
          }
        } catch (Y) {
          vt(e, e.return, Y);
        }
      }
      function lc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var l = t.stateNode;
          try {
            Wo(e, l);
          } catch (n) {
            vt(t, t.return, n);
          }
        }
      }
      function nc(t, e, l) {
        l.props = Ml(
          t.type,
          t.memoizedProps
        ), l.state = t.memoizedState;
        try {
          l.componentWillUnmount();
        } catch (n) {
          vt(t, e, n);
        }
      }
      function Un(t, e) {
        try {
          var l = t.ref;
          if (l !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var n = Yn(t.stateNode);
                break;
              case 30:
                n = t.stateNode;
                break;
              default:
                n = t.stateNode;
            }
            typeof l == "function" ? t.refCleanup = l(n) : l.current = n;
          }
        } catch (r) {
          vt(t, e, r);
        }
      }
      function De(t, e) {
        var l = t.ref, n = t.refCleanup;
        if (l !== null)
          if (typeof n == "function")
            try {
              n();
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
      function ac(t) {
        var e = t.type, l = t.memoizedProps, n = t.stateNode;
        try {
          em(n, e, l, t);
        } catch (r) {
          vt(t, t.return, r);
        }
      }
      function lr(t, e, l) {
        try {
          lm(
            t.stateNode,
            t.type,
            l,
            e,
            t
          );
        } catch (n) {
          vt(t, t.return, n);
        }
      }
      function ic(t) {
        return t.tag === 5 || t.tag === 3 || (He ? t.tag === 26 : !1) || (Bt ? t.tag === 27 && nn(t.type) : !1) || t.tag === 4;
      }
      function nr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || ic(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Bt && t.tag === 27 && nn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function ar(t, e, l) {
        var n = t.tag;
        if (n === 5 || n === 6)
          t = t.stateNode, e ? am(l, t, e) : Pd(l, t);
        else if (n !== 4 && (Bt && n === 27 && nn(t.type) && (l = t.stateNode, e = null), t = t.child, t !== null))
          for (ar(t, e, l), t = t.sibling; t !== null; )
            ar(t, e, l), t = t.sibling;
      }
      function ka(t, e, l) {
        var n = t.tag;
        if (n === 5 || n === 6)
          t = t.stateNode, e ? nm(l, t, e) : $d(l, t);
        else if (n !== 4 && (Bt && n === 27 && nn(t.type) && (l = t.stateNode), t = t.child, t !== null))
          for (ka(t, e, l), t = t.sibling; t !== null; )
            ka(t, e, l), t = t.sibling;
      }
      function rc(t, e, l) {
        t = t.containerInfo;
        try {
          ns(t, l);
        } catch (n) {
          vt(e, e.return, n);
        }
      }
      function oc(t) {
        var e = t.stateNode, l = t.memoizedProps;
        try {
          Im(
            t.type,
            l,
            e,
            t
          );
        } catch (n) {
          vt(t, t.return, n);
        }
      }
      function cd(t, e) {
        for (kd(t.containerInfo), Kt = e; Kt !== null; )
          if (t = Kt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Kt = e;
          else
            for (; Kt !== null; ) {
              t = Kt;
              var l = t.alternate;
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
                  if ((e & 1024) !== 0 && l !== null) {
                    e = void 0, n = t, r = l.memoizedProps, l = l.memoizedState;
                    var o = n.stateNode;
                    try {
                      var f = Ml(
                        n.type,
                        r
                      );
                      e = o.getSnapshotBeforeUpdate(
                        f,
                        l
                      ), o.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (p) {
                      vt(n, n.return, p);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ee && fm(t.stateNode.containerInfo);
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
                    throw Error(s(163));
              }
              if (e = t.sibling, e !== null) {
                e.return = t.return, Kt = e;
                break;
              }
              Kt = t.return;
            }
      }
      function uc(t, e, l) {
        var n = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            Ze(t, l), n & 4 && jn(5, l);
            break;
          case 1:
            if (Ze(t, l), n & 4)
              if (t = l.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (f) {
                  vt(l, l.return, f);
                }
              else {
                var r = Ml(
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
                } catch (f) {
                  vt(
                    l,
                    l.return,
                    f
                  );
                }
              }
            n & 64 && lc(l), n & 512 && Un(l, l.return);
            break;
          case 3:
            if (Ze(t, l), n & 64 && (n = l.updateQueue, n !== null)) {
              if (t = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    t = Yn(l.child.stateNode);
                    break;
                  case 1:
                    t = l.child.stateNode;
                }
              try {
                Wo(n, t);
              } catch (f) {
                vt(l, l.return, f);
              }
            }
            break;
          case 27:
            Bt && e === null && n & 4 && oc(l);
          case 26:
          case 5:
            if (Ze(t, l), e === null) {
              if (n & 4) ac(l);
              else if (n & 64) {
                t = l.type, e = l.memoizedProps, r = l.stateNode;
                try {
                  Rm(
                    r,
                    t,
                    e,
                    l
                  );
                } catch (f) {
                  vt(l, l.return, f);
                }
              }
            }
            n & 512 && Un(l, l.return);
            break;
          case 12:
            Ze(t, l);
            break;
          case 31:
            Ze(t, l), n & 4 && sc(t, l);
            break;
          case 13:
            Ze(t, l), n & 4 && fc(t, l), n & 64 && (n = l.memoizedState, n !== null && (n = n.dehydrated, n !== null && (l = vd.bind(
              null,
              l
            ), hm(n, l))));
            break;
          case 22:
            if (n = l.memoizedState !== null || Pe, !n) {
              e = e !== null && e.memoizedState !== null || Ut, r = Pe;
              var o = Ut;
              Pe = n, (Ut = e) && !o ? Je(
                t,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : Ze(t, l), Pe = r, Ut = o;
            }
            break;
          case 30:
            break;
          default:
            Ze(t, l);
        }
      }
      function cc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, cc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && qd(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Me(t, e, l) {
        for (l = l.child; l !== null; )
          ir(
            t,
            e,
            l
          ), l = l.sibling;
      }
      function ir(t, e, l) {
        if (he && typeof he.onCommitFiberUnmount == "function")
          try {
            he.onCommitFiberUnmount(Vn, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (He) {
              Ut || De(l, e), Me(
                t,
                e,
                l
              ), l.memoizedState ? fs(l.memoizedState) : l.stateNode && ms(l.stateNode);
              break;
            }
          case 27:
            if (Bt) {
              Ut || De(l, e);
              var n = Dt, r = oe;
              nn(l.type) && (Dt = l.stateNode, oe = !1), Me(
                t,
                e,
                l
              ), vs(l.stateNode), Dt = n, oe = r;
              break;
            }
          case 5:
            Ut || De(l, e);
          case 6:
            if (ee) {
              if (n = Dt, r = oe, Dt = null, Me(
                t,
                e,
                l
              ), Dt = n, oe = r, Dt !== null)
                if (oe)
                  try {
                    rm(Dt, l.stateNode);
                  } catch (o) {
                    vt(
                      l,
                      e,
                      o
                    );
                  }
                else
                  try {
                    im(Dt, l.stateNode);
                  } catch (o) {
                    vt(
                      l,
                      e,
                      o
                    );
                  }
            } else
              Me(
                t,
                e,
                l
              );
            break;
          case 18:
            ee && Dt !== null && (oe ? Gm(
              Dt,
              l.stateNode
            ) : Ym(Dt, l.stateNode));
            break;
          case 4:
            ee ? (n = Dt, r = oe, Dt = l.stateNode.containerInfo, oe = !0, Me(
              t,
              e,
              l
            ), Dt = n, oe = r) : (qe && rc(
              l.stateNode,
              l,
              es()
            ), Me(
              t,
              e,
              l
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            fl(2, l, e), Ut || fl(4, l, e), Me(
              t,
              e,
              l
            );
            break;
          case 1:
            Ut || (De(l, e), n = l.stateNode, typeof n.componentWillUnmount == "function" && nc(
              l,
              e,
              n
            )), Me(
              t,
              e,
              l
            );
            break;
          case 21:
            Me(
              t,
              e,
              l
            );
            break;
          case 22:
            Ut = (n = Ut) || l.memoizedState !== null, Me(
              t,
              e,
              l
            ), Ut = n;
            break;
          default:
            Me(
              t,
              e,
              l
            );
        }
      }
      function sc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Um(t);
          } catch (l) {
            vt(e, e.return, l);
          }
        }
      }
      function fc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Dm(t);
          } catch (l) {
            vt(e, e.return, l);
          }
      }
      function sd(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Ns()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Ns()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function Aa(t, e) {
        var l = sd(t);
        e.forEach(function(n) {
          if (!l.has(n)) {
            l.add(n);
            var r = gd.bind(null, t, n);
            n.then(r, r);
          }
        });
      }
      function te(t, e) {
        var l = e.deletions;
        if (l !== null)
          for (var n = 0; n < l.length; n++) {
            var r = l[n], o = t, f = e;
            if (ee) {
              var p = f;
              t: for (; p !== null; ) {
                switch (p.tag) {
                  case 27:
                    if (Bt) {
                      if (nn(p.type)) {
                        Dt = p.stateNode, oe = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Dt = p.stateNode, oe = !1;
                    break t;
                  case 3:
                  case 4:
                    Dt = p.stateNode.containerInfo, oe = !0;
                    break t;
                }
                p = p.return;
              }
              if (Dt === null) throw Error(s(160));
              ir(o, f, r), Dt = null, oe = !1;
            } else ir(o, f, r);
            o = r.alternate, o !== null && (o.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            dc(e, t), e = e.sibling;
      }
      function dc(t, e) {
        var l = t.alternate, n = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            te(e, t), ae(t), n & 4 && (fl(3, t, t.return), jn(3, t), fl(5, t, t.return));
            break;
          case 1:
            te(e, t), ae(t), n & 512 && (Ut || l === null || De(l, l.return)), n & 64 && Pe && (t = t.updateQueue, t !== null && (n = t.callbacks, n !== null && (l = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = l === null ? n : l.concat(n))));
            break;
          case 26:
            if (He) {
              var r = Re;
              if (te(e, t), ae(t), n & 512 && (Ut || l === null || De(l, l.return)), n & 4) {
                n = l !== null ? l.memoizedState : null;
                var o = t.memoizedState;
                l === null ? o === null ? t.stateNode === null ? t.stateNode = Zm(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : ds(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = ss(
                  r,
                  o,
                  t.memoizedProps
                ) : n !== o ? (n === null ? l.stateNode !== null && ms(l.stateNode) : fs(n), o === null ? ds(
                  r,
                  t.type,
                  t.stateNode
                ) : ss(
                  r,
                  o,
                  t.memoizedProps
                )) : o === null && t.stateNode !== null && lr(
                  t,
                  t.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Bt) {
              te(e, t), ae(t), n & 512 && (Ut || l === null || De(l, l.return)), l !== null && n & 4 && lr(
                t,
                t.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (te(e, t), ae(t), n & 512 && (Ut || l === null || De(l, l.return)), ee) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  ts(r);
                } catch (j) {
                  vt(t, t.return, j);
                }
              }
              n & 4 && t.stateNode != null && (r = t.memoizedProps, lr(
                t,
                r,
                l !== null ? l.memoizedProps : r
              )), n & 1024 && (Jr = !0);
            } else
              qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (te(e, t), ae(t), n & 4 && ee) {
              if (t.stateNode === null)
                throw Error(s(162));
              n = t.memoizedProps, l = l !== null ? l.memoizedProps : n, r = t.stateNode;
              try {
                tm(r, l, n);
              } catch (j) {
                vt(t, t.return, j);
              }
            }
            break;
          case 3:
            if (He ? (Lm(), r = Re, Re = Ar(e.containerInfo), te(e, t), Re = r) : te(e, t), ae(t), n & 4) {
              if (ee && le && l !== null && l.memoizedState.isDehydrated)
                try {
                  jm(e.containerInfo);
                } catch (j) {
                  vt(t, t.return, j);
                }
              if (qe) {
                n = e.containerInfo, l = e.pendingChildren;
                try {
                  ns(n, l);
                } catch (j) {
                  vt(t, t.return, j);
                }
              }
            }
            Jr && (Jr = !1, mc(t));
            break;
          case 4:
            He ? (l = Re, Re = Ar(
              t.stateNode.containerInfo
            ), te(e, t), ae(t), Re = l) : (te(e, t), ae(t)), n & 4 && qe && rc(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            te(e, t), ae(t);
            break;
          case 31:
            te(e, t), ae(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, Aa(t, n)));
            break;
          case 13:
            te(e, t), ae(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (ni = re()), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, Aa(t, n)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = l !== null && l.memoizedState !== null, p = Pe, S = Ut;
            if (Pe = p || r, Ut = S || f, te(e, t), Ut = S, Pe = p, ae(t), n & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (l === null || f || Pe || Ut || Ol(t)), ee)) {
              t: if (l = null, ee)
                for (e = t; ; ) {
                  if (e.tag === 5 || He && e.tag === 26) {
                    if (l === null) {
                      f = l = e;
                      try {
                        o = f.stateNode, r ? om(o) : cm(
                          f.stateNode,
                          f.memoizedProps
                        );
                      } catch (j) {
                        vt(f, f.return, j);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (l === null) {
                      f = e;
                      try {
                        var C = f.stateNode;
                        r ? um(C) : sm(C, f.memoizedProps);
                      } catch (j) {
                        vt(f, f.return, j);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (l === null) {
                      f = e;
                      try {
                        var Y = f.stateNode;
                        r ? Qm(Y) : Vm(f.stateNode);
                      } catch (j) {
                        vt(f, f.return, j);
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
            n & 4 && (n = t.updateQueue, n !== null && (l = n.retryQueue, l !== null && (n.retryQueue = null, Aa(t, l))));
            break;
          case 19:
            te(e, t), ae(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, Aa(t, n)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            te(e, t), ae(t);
        }
      }
      function ae(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var l, n = t.return; n !== null; ) {
              if (ic(n)) {
                l = n;
                break;
              }
              n = n.return;
            }
            if (ee) {
              if (l == null) throw Error(s(160));
              switch (l.tag) {
                case 27:
                  if (Bt) {
                    var r = l.stateNode, o = nr(t);
                    ka(t, o, r);
                    break;
                  }
                case 5:
                  var f = l.stateNode;
                  l.flags & 32 && (ts(f), l.flags &= -33);
                  var p = nr(t);
                  ka(t, p, f);
                  break;
                case 3:
                case 4:
                  var S = l.stateNode.containerInfo, C = nr(t);
                  ar(
                    t,
                    C,
                    S
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (Y) {
            vt(t, t.return, Y);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function mc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            mc(e), e.tag === 5 && e.flags & 1024 && Vd(e.stateNode), t = t.sibling;
          }
      }
      function Ze(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            uc(t, e.alternate, e), e = e.sibling;
      }
      function Ol(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              fl(4, e, e.return), Ol(e);
              break;
            case 1:
              De(e, e.return);
              var l = e.stateNode;
              typeof l.componentWillUnmount == "function" && nc(
                e,
                e.return,
                l
              ), Ol(e);
              break;
            case 27:
              Bt && vs(e.stateNode);
            case 26:
            case 5:
              De(e, e.return), Ol(e);
              break;
            case 22:
              e.memoizedState === null && Ol(e);
              break;
            case 30:
              Ol(e);
              break;
            default:
              Ol(e);
          }
          t = t.sibling;
        }
      }
      function Je(t, e, l) {
        for (l = l && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var n = e.alternate, r = t, o = e, f = o.flags;
          switch (o.tag) {
            case 0:
            case 11:
            case 15:
              Je(
                r,
                o,
                l
              ), jn(4, o);
              break;
            case 1:
              if (Je(
                r,
                o,
                l
              ), n = o, r = n.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (C) {
                  vt(n, n.return, C);
                }
              if (n = o, r = n.updateQueue, r !== null) {
                var p = n.stateNode;
                try {
                  var S = r.shared.hiddenCallbacks;
                  if (S !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < S.length; r++)
                      Lo(S[r], p);
                } catch (C) {
                  vt(n, n.return, C);
                }
              }
              l && f & 64 && lc(o), Un(o, o.return);
              break;
            case 27:
              Bt && oc(o);
            case 26:
            case 5:
              Je(
                r,
                o,
                l
              ), l && n === null && f & 4 && ac(o), Un(o, o.return);
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
              ), l && f & 4 && sc(r, o);
              break;
            case 13:
              Je(
                r,
                o,
                l
              ), l && f & 4 && fc(r, o);
              break;
            case 22:
              o.memoizedState === null && Je(
                r,
                o,
                l
              ), Un(o, o.return);
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
      function rr(t, e) {
        var l = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== l && (t != null && t.refCount++, l != null && Nn(l));
      }
      function or(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Nn(t));
      }
      function Oe(t, e, l, n) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            pc(
              t,
              e,
              l,
              n
            ), e = e.sibling;
      }
      function pc(t, e, l, n) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Oe(
              t,
              e,
              l,
              n
            ), r & 2048 && jn(9, e);
            break;
          case 1:
            Oe(
              t,
              e,
              l,
              n
            );
            break;
          case 3:
            Oe(
              t,
              e,
              l,
              n
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Nn(t)));
            break;
          case 12:
            if (r & 2048) {
              Oe(
                t,
                e,
                l,
                n
              ), t = e.stateNode;
              try {
                var o = e.memoizedProps, f = o.id, p = o.onPostCommit;
                typeof p == "function" && p(
                  f,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (S) {
                vt(e, e.return, S);
              }
            } else
              Oe(
                t,
                e,
                l,
                n
              );
            break;
          case 31:
            Oe(
              t,
              e,
              l,
              n
            );
            break;
          case 13:
            Oe(
              t,
              e,
              l,
              n
            );
            break;
          case 23:
            break;
          case 22:
            o = e.stateNode, f = e.alternate, e.memoizedState !== null ? o._visibility & 2 ? Oe(
              t,
              e,
              l,
              n
            ) : Dn(
              t,
              e
            ) : o._visibility & 2 ? Oe(
              t,
              e,
              l,
              n
            ) : (o._visibility |= 2, Il(
              t,
              e,
              l,
              n,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && rr(f, e);
            break;
          case 24:
            Oe(
              t,
              e,
              l,
              n
            ), r & 2048 && or(e.alternate, e);
            break;
          default:
            Oe(
              t,
              e,
              l,
              n
            );
        }
      }
      function Il(t, e, l, n, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var o = t, f = e, p = l, S = n, C = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              Il(
                o,
                f,
                p,
                S,
                r
              ), jn(8, f);
              break;
            case 23:
              break;
            case 22:
              var Y = f.stateNode;
              f.memoizedState !== null ? Y._visibility & 2 ? Il(
                o,
                f,
                p,
                S,
                r
              ) : Dn(
                o,
                f
              ) : (Y._visibility |= 2, Il(
                o,
                f,
                p,
                S,
                r
              )), r && C & 2048 && rr(
                f.alternate,
                f
              );
              break;
            case 24:
              Il(
                o,
                f,
                p,
                S,
                r
              ), r && C & 2048 && or(f.alternate, f);
              break;
            default:
              Il(
                o,
                f,
                p,
                S,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Dn(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var l = t, n = e, r = n.flags;
            switch (n.tag) {
              case 22:
                Dn(l, n), r & 2048 && rr(
                  n.alternate,
                  n
                );
                break;
              case 24:
                Dn(l, n), r & 2048 && or(
                  n.alternate,
                  n
                );
                break;
              default:
                Dn(l, n);
            }
            e = e.sibling;
          }
      }
      function Hl(t, e, l) {
        if (t.subtreeFlags & bn)
          for (t = t.child; t !== null; )
            hc(
              t,
              e,
              l
            ), t = t.sibling;
      }
      function hc(t, e, l) {
        switch (t.tag) {
          case 26:
            if (Hl(
              t,
              e,
              l
            ), t.flags & bn)
              if (t.memoizedState !== null)
                Fm(
                  l,
                  Re,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var n = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Tr(r, t)) && Pc(l, n, r, t);
              }
            break;
          case 5:
            Hl(
              t,
              e,
              l
            ), t.flags & bn && (n = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Tr(r, t)) && Pc(l, n, r, t));
            break;
          case 3:
          case 4:
            He ? (n = Re, Re = Ar(
              t.stateNode.containerInfo
            ), Hl(
              t,
              e,
              l
            ), Re = n) : Hl(
              t,
              e,
              l
            );
            break;
          case 22:
            t.memoizedState === null && (n = t.alternate, n !== null && n.memoizedState !== null ? (n = bn, bn = 16777216, Hl(
              t,
              e,
              l
            ), bn = n) : Hl(
              t,
              e,
              l
            ));
            break;
          default:
            Hl(
              t,
              e,
              l
            );
        }
      }
      function vc(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function qn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var n = e[l];
              Kt = n, bc(
                n,
                t
              );
            }
          vc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            gc(t), t = t.sibling;
      }
      function gc(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            qn(t), t.flags & 2048 && fl(9, t, t.return);
            break;
          case 3:
            qn(t);
            break;
          case 12:
            qn(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Ma(t)) : qn(t);
            break;
          default:
            qn(t);
        }
      }
      function Ma(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var n = e[l];
              Kt = n, bc(
                n,
                t
              );
            }
          vc(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              fl(8, e, e.return), Ma(e);
              break;
            case 22:
              l = e.stateNode, l._visibility & 2 && (l._visibility &= -3, Ma(e));
              break;
            default:
              Ma(e);
          }
          t = t.sibling;
        }
      }
      function bc(t, e) {
        for (; Kt !== null; ) {
          var l = Kt;
          switch (l.tag) {
            case 0:
            case 11:
            case 15:
              fl(8, l, e);
              break;
            case 23:
            case 22:
              if (l.memoizedState !== null && l.memoizedState.cachePool !== null) {
                var n = l.memoizedState.cachePool.pool;
                n != null && n.refCount++;
              }
              break;
            case 24:
              Nn(l.memoizedState.cache);
          }
          if (n = l.child, n !== null) n.return = l, Kt = n;
          else
            t: for (l = t; Kt !== null; ) {
              n = Kt;
              var r = n.sibling, o = n.return;
              if (cc(n), n === l) {
                Kt = null;
                break t;
              }
              if (r !== null) {
                r.return = o, Kt = r;
                break t;
              }
              Kt = o;
            }
        }
      }
      function ur(t) {
        var e = Rd(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Zd(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function cr(t, e) {
        var l = t.tag;
        switch (e.$$typeof) {
          case $a:
            if (t.type === e.value) return !0;
            break;
          case Pa:
            t: {
              for (e = e.value, t = [t, 0], l = 0; l < t.length; ) {
                var n = t[l++], r = n.tag, o = t[l++], f = e[o];
                if (r !== 5 && r !== 26 && r !== 27 || !Qn(n)) {
                  for (; f != null && cr(n, f); )
                    o++, f = e[o];
                  if (o === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (n = n.child; n !== null; )
                      t.push(n, o), n = n.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ti:
            if ((l === 5 || l === 26 || l === 27) && Wd(t.stateNode, e.value))
              return !0;
            break;
          case li:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (t = Ld(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ei:
            if ((l === 5 || l === 26 || l === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function sr(t) {
        switch (t.$$typeof) {
          case $a:
            return "<" + (H(t.value) || "Unknown") + ">";
          case Pa:
            return ":has(" + (sr(t) || "") + ")";
          case ti:
            return '[role="' + t.value + '"]';
          case li:
            return '"' + t.value + '"';
          case ei:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function yc(t, e) {
        var l = [];
        t = [t, 0];
        for (var n = 0; n < t.length; ) {
          var r = t[n++], o = r.tag, f = t[n++], p = e[f];
          if (o !== 5 && o !== 26 && o !== 27 || !Qn(r)) {
            for (; p != null && cr(r, p); )
              f++, p = e[f];
            if (f === e.length) l.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return l;
      }
      function fr(t, e) {
        if (!Gn) throw Error(s(363));
        t = ur(t), t = yc(t, e), e = [], t = Array.from(t);
        for (var l = 0; l < t.length; ) {
          var n = t[l++], r = n.tag;
          if (r === 5 || r === 26 || r === 27)
            Qn(n) || e.push(n.stateNode);
          else
            for (n = n.child; n !== null; )
              t.push(n), n = n.sibling;
        }
        return e;
      }
      function de() {
        return (ft & 2) !== 0 && mt !== 0 ? mt & -mt : P.T !== null ? xi() : Ud();
      }
      function xc() {
        if (ye === 0)
          if ((mt & 536870912) === 0 || pt) {
            var t = Ba;
            Ba <<= 1, (Ba & 3932160) === 0 && (Ba = 262144), ye = t;
          } else ye = 536870912;
        return t = ge.current, t !== null && (t.flags |= 32), ye;
      }
      function ie(t, e, l) {
        (t === _t && (xt === 2 || xt === 9) || t.cancelPendingCommit !== null) && ($l(t, 0), dl(
          t,
          mt,
          ye,
          !1
        )), Q(t, l), ((ft & 2) === 0 || t !== _t) && (t === _t && ((ft & 2) === 0 && (Vl |= l), kt === 4 && dl(
          t,
          mt,
          ye,
          !1
        )), Ue(t));
      }
      function wc(t, e, l) {
        if ((ft & 6) !== 0) throw Error(s(327));
        var n = !l && (e & 127) === 0 && (e & t.expiredLanes) === 0 || A(t, e), r = n ? md(t, e) : mr(t, e, !0), o = n;
        do {
          if (r === 0) {
            yn && !n && dl(t, e, 0, !1);
            break;
          } else {
            if (l = t.current.alternate, o && !fd(l)) {
              r = mr(t, e, !1), o = !1;
              continue;
            }
            if (r === 2) {
              if (o = e, t.errorRecoveryDisabledLanes & o)
                var f = 0;
              else
                f = t.pendingLanes & -536870913, f = f !== 0 ? f : f & 536870912 ? 536870912 : 0;
              if (f !== 0) {
                e = f;
                t: {
                  var p = t;
                  r = In;
                  var S = le && p.current.memoizedState.isDehydrated;
                  if (S && ($l(p, f).flags |= 256), f = mr(
                    p,
                    f,
                    !1
                  ), f !== 2) {
                    if (Lr && !S) {
                      p.errorRecoveryDisabledLanes |= o, Vl |= o, r = 4;
                      break t;
                    }
                    o = ue, ue = r, o !== null && (ue === null ? ue = o : ue.push.apply(
                      ue,
                      o
                    ));
                  }
                  r = f;
                }
                if (o = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              $l(t, 0), dl(t, e, 0, !0);
              break;
            }
            t: {
              switch (n = t, o = r, o) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  dl(
                    n,
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
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (r = ni + 300 - re(), 10 < r)) {
                if (dl(
                  n,
                  e,
                  ye,
                  !yl
                ), M(n, 0, !0) !== 0) break t;
                el = e, n.timeoutHandle = Od(
                  _c.bind(
                    null,
                    n,
                    l,
                    ue,
                    ai,
                    Fr,
                    e,
                    ye,
                    Vl,
                    xn,
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
              _c(
                n,
                l,
                ue,
                ai,
                Fr,
                e,
                ye,
                Vl,
                xn,
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
      function _c(t, e, l, n, r, o, f, p, S, C, Y, j, X, ot) {
        if (t.timeoutHandle = jl, j = e.subtreeFlags, j & 8192 || (j & 16785408) === 16785408) {
          j = Gd(), hc(
            e,
            o,
            j
          );
          var It = (o & 62914560) === o ? ni - re() : (o & 4194048) === o ? Ts - re() : 0;
          if (It = Qd(
            j,
            It
          ), It !== null) {
            el = o, t.cancelPendingCommit = It(
              Mc.bind(
                null,
                t,
                e,
                o,
                l,
                n,
                r,
                f,
                p,
                S,
                Y,
                j,
                null,
                X,
                ot
              )
            ), dl(t, o, f, !C);
            return;
          }
        }
        Mc(
          t,
          e,
          o,
          l,
          n,
          r,
          f,
          p,
          S
        );
      }
      function fd(t) {
        for (var e = t; ; ) {
          var l = e.tag;
          if ((l === 0 || l === 11 || l === 15) && e.flags & 16384 && (l = e.updateQueue, l !== null && (l = l.stores, l !== null)))
            for (var n = 0; n < l.length; n++) {
              var r = l[n], o = r.getSnapshot;
              r = r.value;
              try {
                if (!ve(o(), r)) return !1;
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
      function dl(t, e, l, n) {
        e &= ~Wr, e &= ~Vl, t.suspendedLanes |= e, t.pingedLanes &= ~e, n && (t.warmLanes |= e), n = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var o = 31 - pe(r), f = 1 << o;
          n[o] = -1, r &= ~f;
        }
        l !== 0 && N(t, l, e);
      }
      function Sc() {
        return (ft & 6) === 0 ? (Wl(0), !1) : !0;
      }
      function dr() {
        if (dt !== null) {
          if (xt === 0)
            var t = dt.return;
          else
            t = dt, Ie = Dl = null, Hi(t), mn = null, Jn = 0, t = dt;
          for (; t !== null; )
            ec(t.alternate, t), t = t.return;
          dt = null;
        }
      }
      function $l(t, e) {
        var l = t.timeoutHandle;
        l !== jl && (t.timeoutHandle = jl, Hd(l)), l = t.cancelPendingCommit, l !== null && (t.cancelPendingCommit = null, l()), el = 0, dr(), _t = t, dt = l = Le(t.current, null), mt = e, xt = 0, be = null, yl = !1, yn = A(t, e), Lr = !1, xn = ye = Wr = Vl = xl = kt = 0, ue = In = null, Fr = !1, (e & 8) !== 0 && (e |= e & 32);
        var n = t.entangledLanes;
        if (n !== 0)
          for (t = t.entanglements, n &= e; 0 < n; ) {
            var r = 31 - pe(n), o = 1 << r;
            e |= t[r], n &= ~o;
          }
        return tl = e, ma(), l;
      }
      function zc(t, e) {
        ut = null, P.H = Wn, e === dn || e === Ja ? (e = Ko(), xt = 3) : e === Yr ? (e = Ko(), xt = 4) : xt = e === Xr ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, be = e, dt === null && (kt = 1, Sa(
          t,
          it(e, t.current)
        ));
      }
      function Ec() {
        var t = ge.current;
        return t === null ? !0 : (mt & 4194048) === mt ? Te === null : (mt & 62914560) === mt || (mt & 536870912) !== 0 ? t === Te : !1;
      }
      function Nc() {
        var t = P.H;
        return P.H = Wn, t === null ? Wn : t;
      }
      function Tc() {
        var t = P.A;
        return P.A = fp, t;
      }
      function Oa() {
        kt = 4, yl || (mt & 4194048) !== mt && ge.current !== null || (yn = !0), (xl & 134217727) === 0 && (Vl & 134217727) === 0 || _t === null || dl(
          _t,
          mt,
          ye,
          !1
        );
      }
      function mr(t, e, l) {
        var n = ft;
        ft |= 2;
        var r = Nc(), o = Tc();
        (_t !== t || mt !== e) && (ai = null, $l(t, e)), e = !1;
        var f = kt;
        t: do
          try {
            if (xt !== 0 && dt !== null) {
              var p = dt, S = be;
              switch (xt) {
                case 8:
                  dr(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ge.current === null && (e = !0);
                  var C = xt;
                  if (xt = 0, be = null, Pl(t, p, S, C), l && yn) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  C = xt, xt = 0, be = null, Pl(t, p, S, C);
              }
            }
            dd(), f = kt;
            break;
          } catch (Y) {
            zc(t, Y);
          }
        while (!0);
        return e && t.shellSuspendCounter++, Ie = Dl = null, ft = n, P.H = r, P.A = o, dt === null && (_t = null, mt = 0, ma()), f;
      }
      function dd() {
        for (; dt !== null; ) Cc(dt);
      }
      function md(t, e) {
        var l = ft;
        ft |= 2;
        var n = Nc(), r = Tc();
        _t !== t || mt !== e ? (ai = null, $n = re() + 500, $l(t, e)) : yn = A(
          t,
          e
        );
        t: do
          try {
            if (xt !== 0 && dt !== null) {
              e = dt;
              var o = be;
              e: switch (xt) {
                case 1:
                  xt = 0, be = null, Pl(t, e, o, 1);
                  break;
                case 2:
                case 9:
                  if (Qo(o)) {
                    xt = 0, be = null, kc(e);
                    break;
                  }
                  e = function() {
                    xt !== 2 && xt !== 9 || _t !== t || (xt = 7), Ue(t);
                  }, o.then(e, e);
                  break t;
                case 3:
                  xt = 7;
                  break t;
                case 4:
                  xt = 5;
                  break t;
                case 7:
                  Qo(o) ? (xt = 0, be = null, kc(e)) : (xt = 0, be = null, Pl(t, e, o, 7));
                  break;
                case 5:
                  var f = null;
                  switch (dt.tag) {
                    case 26:
                      f = dt.memoizedState;
                    case 5:
                    case 27:
                      var p = dt, S = p.type, C = p.pendingProps;
                      if (f ? ps(f) : $c(p.stateNode, S, C)) {
                        xt = 0, be = null;
                        var Y = p.sibling;
                        if (Y !== null) dt = Y;
                        else {
                          var j = p.return;
                          j !== null ? (dt = j, Ha(j)) : dt = null;
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
                  dr(), kt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            pd();
            break;
          } catch (X) {
            zc(t, X);
          }
        while (!0);
        return Ie = Dl = null, P.H = n, P.A = r, ft = l, dt !== null ? 0 : (_t = null, mt = 0, ma(), kt);
      }
      function pd() {
        for (; dt !== null && !tp(); )
          Cc(dt);
      }
      function Cc(t) {
        var e = Fu(
          t.alternate,
          t,
          tl
        );
        t.memoizedProps = t.pendingProps, e === null ? Ha(t) : dt = e;
      }
      function kc(t) {
        var e = t, l = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Ku(
              l,
              e,
              e.pendingProps,
              e.type,
              void 0,
              mt
            );
            break;
          case 11:
            e = Ku(
              l,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              mt
            );
            break;
          case 5:
            Hi(e);
          default:
            ec(l, e), e = dt = Bc(e, tl), e = Fu(l, e, tl);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ha(t) : dt = e;
      }
      function Pl(t, e, l, n) {
        Ie = Dl = null, Hi(e), mn = null, Jn = 0;
        var r = e.return;
        try {
          if (ad(
            t,
            r,
            e,
            l,
            mt
          )) {
            kt = 1, Sa(
              t,
              it(l, t.current)
            ), dt = null;
            return;
          }
        } catch (o) {
          if (r !== null) throw dt = r, o;
          kt = 1, Sa(
            t,
            it(l, t.current)
          ), dt = null;
          return;
        }
        e.flags & 32768 ? (pt || n === 1 ? t = !0 : yn || (mt & 536870912) !== 0 ? t = !1 : (yl = t = !0, (n === 2 || n === 9 || n === 3 || n === 6) && (n = ge.current, n !== null && n.tag === 13 && (n.flags |= 16384))), Ac(e, t)) : Ha(e);
      }
      function Ha(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Ac(
              e,
              yl
            );
            return;
          }
          t = e.return;
          var l = od(
            e.alternate,
            e,
            tl
          );
          if (l !== null) {
            dt = l;
            return;
          }
          if (e = e.sibling, e !== null) {
            dt = e;
            return;
          }
          dt = e = t;
        } while (e !== null);
        kt === 0 && (kt = 5);
      }
      function Ac(t, e) {
        do {
          var l = ud(t.alternate, t);
          if (l !== null) {
            l.flags &= 32767, dt = l;
            return;
          }
          if (l = t.return, l !== null && (l.flags |= 32768, l.subtreeFlags = 0, l.deletions = null), !e && (t = t.sibling, t !== null)) {
            dt = t;
            return;
          }
          dt = t = l;
        } while (t !== null);
        kt = 6, dt = null;
      }
      function Mc(t, e, l, n, r, o, f, p, S) {
        t.cancelPendingCommit = null;
        do
          Bn();
        while (Yt !== 0);
        if ((ft & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (o = e.lanes | e.childLanes, o |= Gr, z(
            t,
            l,
            o,
            f,
            p,
            S
          ), t === _t && (dt = _t = null, mt = 0), wn = e, _l = t, el = l, Ir = o, $r = r, Cs = n, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, bd(Hr, function() {
            return Uc(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), n = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || n) {
            n = P.T, P.T = null, r = Fe(), Vt(2), f = ft, ft |= 4;
            try {
              cd(t, e, l);
            } finally {
              ft = f, Vt(r), P.T = n;
            }
          }
          Yt = 1, Oc(), Hc(), Rc();
        }
      }
      function Oc() {
        if (Yt === 1) {
          Yt = 0;
          var t = _l, e = wn, l = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || l) {
            l = P.T, P.T = null;
            var n = Fe();
            Vt(2);
            var r = ft;
            ft |= 4;
            try {
              dc(e, t), Ad(t.containerInfo);
            } finally {
              ft = r, Vt(n), P.T = l;
            }
          }
          t.current = e, Yt = 2;
        }
      }
      function Hc() {
        if (Yt === 2) {
          Yt = 0;
          var t = _l, e = wn, l = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || l) {
            l = P.T, P.T = null;
            var n = Fe();
            Vt(2);
            var r = ft;
            ft |= 4;
            try {
              uc(t, e.alternate, e);
            } finally {
              ft = r, Vt(n), P.T = l;
            }
          }
          Yt = 3;
        }
      }
      function Rc() {
        if (Yt === 4 || Yt === 3) {
          Yt = 0, ep();
          var t = _l, e = wn, l = el, n = Cs;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Yt = 5 : (Yt = 0, wn = _l = null, jc(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (wl = null), qt(l), e = e.stateNode, he && typeof he.onCommitFiberRoot == "function")
            try {
              he.onCommitFiberRoot(
                Vn,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (n !== null) {
            e = P.T, r = Fe(), Vt(2), P.T = null;
            try {
              for (var o = t.onRecoverableError, f = 0; f < n.length; f++) {
                var p = n[f];
                o(p.value, {
                  componentStack: p.stack
                });
              }
            } finally {
              P.T = e, Vt(r);
            }
          }
          (el & 3) !== 0 && Bn(), Ue(t), r = t.pendingLanes, (l & 261930) !== 0 && (r & 42) !== 0 ? t === Pr ? Pn++ : (Pn = 0, Pr = t) : Pn = 0, le && Bm(), Wl(0);
        }
      }
      function jc(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Nn(e)));
      }
      function Bn() {
        return Oc(), Hc(), Rc(), Uc();
      }
      function Uc() {
        if (Yt !== 5) return !1;
        var t = _l, e = Ir;
        Ir = 0;
        var l = qt(el), n = 32 > l ? 32 : l;
        l = P.T;
        var r = Fe();
        try {
          Vt(n), P.T = null, n = $r, $r = null;
          var o = _l, f = el;
          if (Yt = 0, wn = _l = null, el = 0, (ft & 6) !== 0)
            throw Error(s(331));
          var p = ft;
          if (ft |= 4, gc(o.current), pc(
            o,
            o.current,
            f,
            n
          ), ft = p, Wl(0, !1), he && typeof he.onPostCommitFiberRoot == "function")
            try {
              he.onPostCommitFiberRoot(Vn, o);
            } catch {
            }
          return !0;
        } finally {
          Vt(r), P.T = l, jc(t, e);
        }
      }
      function Dc(t, e, l) {
        e = it(l, e), e = Xi(t.stateNode, e, 2), t = ul(t, e, 2), t !== null && (Q(t, 2), Ue(t));
      }
      function vt(t, e, l) {
        if (t.tag === 3)
          Dc(t, t, l);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Dc(
                e,
                t,
                l
              );
              break;
            } else if (e.tag === 1) {
              var n = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof n.componentDidCatch == "function" && (wl === null || !wl.has(n))) {
                t = it(l, t), l = Uu(2), n = ul(e, l, 2), n !== null && (Du(
                  l,
                  n,
                  e,
                  t
                ), Q(n, 2), Ue(n));
                break;
              }
            }
            e = e.return;
          }
      }
      function pr(t, e, l) {
        var n = t.pingCache;
        if (n === null) {
          n = t.pingCache = new dp();
          var r = /* @__PURE__ */ new Set();
          n.set(e, r);
        } else
          r = n.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), n.set(e, r));
        r.has(l) || (Lr = !0, r.add(l), t = hd.bind(null, t, e, l), e.then(t, t));
      }
      function hd(t, e, l) {
        var n = t.pingCache;
        n !== null && n.delete(e), t.pingedLanes |= t.suspendedLanes & l, t.warmLanes &= ~l, _t === t && (mt & l) === l && (kt === 4 || kt === 3 && (mt & 62914560) === mt && 300 > re() - ni ? (ft & 2) === 0 && $l(t, 0) : Wr |= l, xn === mt && (xn = 0)), Ue(t);
      }
      function qc(t, e) {
        e === 0 && (e = K()), t = Al(t, e), t !== null && (Q(t, e), Ue(t));
      }
      function vd(t) {
        var e = t.memoizedState, l = 0;
        e !== null && (l = e.retryLane), qc(t, l);
      }
      function gd(t, e) {
        var l = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var n = t.stateNode, r = t.memoizedState;
            r !== null && (l = r.retryLane);
            break;
          case 19:
            n = t.stateNode;
            break;
          case 22:
            n = t.stateNode._retryCache;
            break;
          default:
            throw Error(s(314));
        }
        n !== null && n.delete(e), qc(t, l);
      }
      function bd(t, e) {
        return Ga(t, e);
      }
      function yd(t, e, l, n) {
        this.tag = t, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = n, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function hr(t) {
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
      function Bc(t, e) {
        t.flags &= 65011714;
        var l = t.alternate;
        return l === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = l.childLanes, t.lanes = l.lanes, t.child = l.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = l.memoizedProps, t.memoizedState = l.memoizedState, t.updateQueue = l.updateQueue, t.type = l.type, e = l.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Ra(t, e, l, n, r, o) {
        var f = 0;
        if (n = t, typeof t == "function") hr(t) && (f = 1);
        else if (typeof t == "string")
          f = He && Bt ? us(t, l, Wt.current) ? 26 : gs(t) ? 27 : 5 : He ? us(
            t,
            l,
            Wt.current
          ) ? 26 : 5 : Bt && gs(t) ? 27 : 5;
        else
          t: switch (t) {
            case Er:
              return t = u(31, l, e, r), t.elementType = Er, t.lanes = o, t;
            case en:
              return Rl(
                l.children,
                r,
                o,
                e
              );
            case Zc:
              f = 8, r |= 24;
              break;
            case xr:
              return t = u(12, l, e, r | 2), t.elementType = xr, t.lanes = o, t;
            case _r:
              return t = u(13, l, e, r), t.elementType = _r, t.lanes = o, t;
            case Sr:
              return t = u(19, l, e, r), t.elementType = Sr, t.lanes = o, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ml:
                    f = 10;
                    break t;
                  case Jc:
                    f = 9;
                    break t;
                  case wr:
                    f = 11;
                    break t;
                  case zr:
                    f = 14;
                    break t;
                  case pl:
                    f = 16, n = null;
                    break t;
                }
              f = 29, l = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), n = null;
          }
        return e = u(f, l, e, r), e.elementType = t, e.type = n, e.lanes = o, e;
      }
      function Rl(t, e, l, n) {
        return t = u(7, t, n, e), t.lanes = l, t;
      }
      function vr(t, e, l) {
        return t = u(6, t, null, e), t.lanes = l, t;
      }
      function Yc(t) {
        var e = u(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function gr(t, e, l) {
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
      function xd(t, e, l, n, r, o, f, p, S) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = jl, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = nt(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = nt(0), this.hiddenUpdates = nt(null), this.identifierPrefix = n, this.onUncaughtError = r, this.onCaughtError = o, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = S, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Gc(t, e, l, n, r, o, f, p, S, C, Y, j) {
        return t = new xd(
          t,
          e,
          l,
          f,
          S,
          C,
          Y,
          j,
          p
        ), e = 1, o === !0 && (e |= 24), o = u(3, null, null, e), t.current = o, o.stateNode = t, e = yi(), e.refCount++, t.pooledCache = e, e.refCount++, o.memoizedState = {
          element: n,
          isDehydrated: l,
          cache: e
        }, Si(o), t;
      }
      function Qc(t) {
        return t ? (t = rn, t) : rn;
      }
      function Vc(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = h(e), t = t !== null ? g(t) : null, t === null ? null : Yn(t.stateNode);
      }
      function Kc(t, e, l, n, r, o) {
        r = Qc(r), n.context === null ? n.context = r : n.pendingContext = r, n = ol(e), n.payload = { element: l }, o = o === void 0 ? null : o, o !== null && (n.callback = o), l = ul(t, n, e), l !== null && (ie(l, t, e), Cn(l, t, e));
      }
      function Xc(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var l = t.retryLane;
          t.retryLane = l !== 0 && l < e ? l : e;
        }
      }
      function br(t, e) {
        Xc(t, e), (t = t.alternate) && Xc(t, e);
      }
      var st = {}, wd = gf(), me = jp(), yr = Object.assign, _d = Symbol.for("react.element"), ja = Symbol.for("react.transitional.element"), tn = Symbol.for("react.portal"), en = Symbol.for("react.fragment"), Zc = Symbol.for("react.strict_mode"), xr = Symbol.for("react.profiler"), Jc = Symbol.for("react.consumer"), ml = Symbol.for("react.context"), wr = Symbol.for("react.forward_ref"), _r = Symbol.for("react.suspense"), Sr = Symbol.for("react.suspense_list"), zr = Symbol.for("react.memo"), pl = Symbol.for("react.lazy"), Er = Symbol.for("react.activity"), Sd = Symbol.for("react.memo_cache_sentinel"), Lc = Symbol.iterator, zd = Symbol.for("react.client.reference"), Ua = Array.isArray, P = wd.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Ed = i.rendererVersion, Nd = i.rendererPackageName, Wc = i.extraDevToolsConfig, Yn = i.getPublicInstance, Td = i.getRootHostContext, Cd = i.getChildHostContext, kd = i.prepareForCommit, Ad = i.resetAfterCommit, Md = i.createInstance;
      i.cloneMutableInstance;
      var Nr = i.appendInitialChild, Fc = i.finalizeInitialChildren, Da = i.shouldSetTextContent, Ic = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Od = i.scheduleTimeout, Hd = i.cancelTimeout, jl = i.noTimeout, We = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ee = i.supportsMutation, qe = i.supportsPersistence, le = i.supportsHydration, Rd = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var jd = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Vt = i.setCurrentUpdatePriority, Fe = i.getCurrentUpdatePriority, Ud = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var Dd = i.shouldAttemptEagerTransition, qd = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var Bd = i.maySuspendCommit, Yd = i.maySuspendCommitOnUpdate, Tr = i.maySuspendCommitInSyncRender, $c = i.preloadInstance, Gd = i.startSuspendingCommit, Pc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var Qd = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var ln = i.NotPendingTransition, Ul = i.HostTransitionContext, Vd = i.resetFormInstance;
      i.bindToConsole;
      var Kd = i.supportsMicrotasks, Xd = i.scheduleMicrotask, Gn = i.supportsTestSelectors, Zd = i.findFiberRoot, Jd = i.getBoundingRect, Ld = i.getTextContent, Qn = i.isHiddenSubtree, Wd = i.matchAccessibilityRole, Fd = i.setFocusIfFocusable, Id = i.setupIntersectionObserver, $d = i.appendChild, Pd = i.appendChildToContainer, tm = i.commitTextUpdate, em = i.commitMount, lm = i.commitUpdate, nm = i.insertBefore, am = i.insertInContainerBefore, im = i.removeChild, rm = i.removeChildFromContainer, ts = i.resetTextContent, om = i.hideInstance, um = i.hideTextInstance, cm = i.unhideInstance, sm = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var fm = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var dm = i.cloneInstance, es = i.createContainerChildSet, ls = i.appendChildToContainerChildSet, mm = i.finalizeContainerChildren, ns = i.replaceContainerChildren, as = i.cloneHiddenInstance, is = i.cloneHiddenTextInstance, Cr = i.isSuspenseInstancePending, kr = i.isSuspenseInstanceFallback, pm = i.getSuspenseInstanceFallbackErrorDetails, hm = i.registerSuspenseInstanceRetry, vm = i.canHydrateFormStateMarker, gm = i.isFormStateMarkerMatching, rs = i.getNextHydratableSibling, bm = i.getNextHydratableSiblingAfterSingleton, ym = i.getFirstHydratableChild, xm = i.getFirstHydratableChildWithinContainer, wm = i.getFirstHydratableChildWithinActivityInstance, _m = i.getFirstHydratableChildWithinSuspenseInstance, Sm = i.getFirstHydratableChildWithinSingleton, zm = i.canHydrateInstance, Em = i.canHydrateTextInstance, Nm = i.canHydrateActivityInstance, Tm = i.canHydrateSuspenseInstance, Cm = i.hydrateInstance, km = i.hydrateTextInstance, Am = i.hydrateActivityInstance, Mm = i.hydrateSuspenseInstance, Om = i.getNextHydratableInstanceAfterActivityInstance, Hm = i.getNextHydratableInstanceAfterSuspenseInstance, Rm = i.commitHydratedInstance, jm = i.commitHydratedContainer, Um = i.commitHydratedActivityInstance, Dm = i.commitHydratedSuspenseInstance, qm = i.finalizeHydratedChildren, Bm = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var Ym = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var Gm = i.clearSuspenseBoundaryFromContainer, Qm = i.hideDehydratedBoundary, Vm = i.unhideDehydratedBoundary, os = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var Km = i.validateHydratableInstance, Xm = i.validateHydratableTextInstance, He = i.supportsResources, us = i.isHostHoistableType, Ar = i.getHoistableRoot, cs = i.getResource, ss = i.acquireResource, fs = i.releaseResource, Zm = i.hydrateHoistable, ds = i.mountHoistable, ms = i.unmountHoistable, Jm = i.createHoistableInstance, Lm = i.prepareToCommitHoistables, Wm = i.mayResourceSuspendCommit, ps = i.preloadResource, Fm = i.suspendResource, Bt = i.supportsSingletons, hs = i.resolveSingletonInstance, Im = i.acquireSingletonInstance, vs = i.releaseSingletonInstance, gs = i.isHostSingletonType, nn = i.isSingletonScope, Mr = [], an = -1, rn = {}, pe = Math.clz32 ? Math.clz32 : B, $m = Math.log, Pm = Math.LN2, qa = 256, Ba = 262144, Ya = 4194304, Ga = me.unstable_scheduleCallback, Or = me.unstable_cancelCallback, tp = me.unstable_shouldYield, ep = me.unstable_requestPaint, re = me.unstable_now, bs = me.unstable_ImmediatePriority, lp = me.unstable_UserBlockingPriority, Hr = me.unstable_NormalPriority, np = me.unstable_IdlePriority, ap = me.log, ip = me.unstable_setDisableYieldValue, Vn = null, he = null, ve = typeof Object.is == "function" ? Object.is : Zt, ys = typeof reportError == "function" ? reportError : function(t) {
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
      }, rp = Object.prototype.hasOwnProperty, Rr, xs, jr = !1, ws = /* @__PURE__ */ new WeakMap(), on = [], un = 0, Qa = null, Kn = 0, Se = [], ze = 0, hl = null, Be = 1, Ye = "", Wt = x(null), Xn = x(null), vl = x(null), Va = x(null), Ft = null, Et = null, pt = !1, gl = null, Ee = !1, Ur = Error(s(519)), Ka = x(null), Dl = null, Ie = null, op = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(l, n) {
            t.push(n);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(l) {
            return l();
          });
        };
      }, up = me.unstable_scheduleCallback, cp = me.unstable_NormalPriority, Nt = {
        $$typeof: ml,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Xa = null, cn = null, Dr = !1, Za = !1, qr = !1, ql = 0, Zn = null, Br = 0, sn = 0, fn = null, _s = P.S;
      P.S = function(t, e) {
        Ts = re(), typeof e == "object" && e !== null && typeof e.then == "function" && Ff(t, e), _s !== null && _s(t, e);
      };
      var Bl = x(null), dn = Error(s(460)), Yr = Error(s(474)), Ja = Error(s(542)), La = { then: function() {
      } }, Yl = null, mn = null, Jn = 0, Gl = Zo(!0), Ss = Zo(!1), Ne = [], pn = 0, Gr = 0, bl = !1, Qr = !1, hn = x(null), Wa = x(0), ge = x(null), Te = null, Ot = x(0), $e = 0, ut = null, wt = null, Rt = null, Fa = !1, vn = !1, Ql = !1, Ia = 0, Ln = 0, gn = null, sp = 0, Wn = {
        readContext: Jt,
        use: ba,
        useCallback: Ct,
        useContext: Ct,
        useEffect: Ct,
        useImperativeHandle: Ct,
        useLayoutEffect: Ct,
        useInsertionEffect: Ct,
        useMemo: Ct,
        useReducer: Ct,
        useRef: Ct,
        useState: Ct,
        useDebugValue: Ct,
        useDeferredValue: Ct,
        useTransition: Ct,
        useSyncExternalStore: Ct,
        useId: Ct,
        useHostTransitionStatus: Ct,
        useFormState: Ct,
        useActionState: Ct,
        useOptimistic: Ct,
        useMemoCache: Ct,
        useCacheRefresh: Ct
      };
      Wn.useEffectEvent = Ct;
      var zs = {
        readContext: Jt,
        use: ba,
        useCallback: function(t, e) {
          return ne().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Jt,
        useEffect: gu,
        useImperativeHandle: function(t, e, l) {
          l = l != null ? l.concat([t]) : null, xa(
            4194308,
            4,
            wu.bind(null, e, t),
            l
          );
        },
        useLayoutEffect: function(t, e) {
          return xa(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          xa(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var l = ne();
          e = e === void 0 ? null : e;
          var n = t();
          if (Ql) {
            At(!0);
            try {
              t();
            } finally {
              At(!1);
            }
          }
          return l.memoizedState = [n, e], n;
        },
        useReducer: function(t, e, l) {
          var n = ne();
          if (l !== void 0) {
            var r = l(e);
            if (Ql) {
              At(!0);
              try {
                l(e);
              } finally {
                At(!1);
              }
            }
          } else r = e;
          return n.memoizedState = n.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, n.queue = t, t = t.dispatch = nd.bind(
            null,
            ut,
            t
          ), [n.memoizedState, t];
        },
        useRef: function(t) {
          var e = ne();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Di(t);
          var e = t.queue, l = Au.bind(
            null,
            ut,
            e
          );
          return e.dispatch = l, [t.memoizedState, l];
        },
        useDebugValue: Yi,
        useDeferredValue: function(t, e) {
          var l = ne();
          return Gi(l, t, e);
        },
        useTransition: function() {
          var t = Di(!1);
          return t = Nu.bind(
            null,
            ut,
            t.queue,
            !0,
            !1
          ), ne().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, l) {
          var n = ut, r = ne();
          if (pt) {
            if (l === void 0)
              throw Error(s(407));
            l = l();
          } else {
            if (l = e(), _t === null)
              throw Error(s(349));
            (mt & 127) !== 0 || eu(n, e, l);
          }
          r.memoizedState = l;
          var o = { value: l, getSnapshot: e };
          return r.queue = o, gu(nu.bind(null, n, o, t), [
            t
          ]), n.flags |= 2048, Fl(
            9,
            { destroy: void 0 },
            lu.bind(
              null,
              n,
              o,
              l,
              e
            ),
            null
          ), l;
        },
        useId: function() {
          var t = ne(), e = _t.identifierPrefix;
          if (pt) {
            var l = Ye, n = Be;
            l = (n & ~(1 << 32 - pe(n) - 1)).toString(32) + l, e = "_" + e + "R_" + l, l = Ia++, 0 < l && (e += "H" + l.toString(32)), e += "_";
          } else
            l = sp++, e = "_" + e + "r_" + l.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Qi,
        useFormState: du,
        useActionState: du,
        useOptimistic: function(t) {
          var e = ne();
          e.memoizedState = e.baseState = t;
          var l = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = l, e = Vi.bind(
            null,
            ut,
            !0,
            l
          ), l.dispatch = e, [t, e];
        },
        useMemoCache: Ri,
        useCacheRefresh: function() {
          return ne().memoizedState = ld.bind(
            null,
            ut
          );
        },
        useEffectEvent: function(t) {
          var e = ne(), l = { impl: t };
          return e.memoizedState = l, function() {
            if ((ft & 2) !== 0)
              throw Error(s(440));
            return l.impl.apply(void 0, arguments);
          };
        }
      }, Vr = {
        readContext: Jt,
        use: ba,
        useCallback: Su,
        useContext: Jt,
        useEffect: Bi,
        useImperativeHandle: _u,
        useInsertionEffect: yu,
        useLayoutEffect: xu,
        useMemo: zu,
        useReducer: ya,
        useRef: vu,
        useState: function() {
          return ya(Ke);
        },
        useDebugValue: Yi,
        useDeferredValue: function(t, e) {
          var l = Mt();
          return Eu(
            l,
            wt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = ya(Ke)[0], e = Mt().memoizedState;
          return [
            typeof t == "boolean" ? t : Mn(t),
            e
          ];
        },
        useSyncExternalStore: tu,
        useId: Cu,
        useHostTransitionStatus: Qi,
        useFormState: mu,
        useActionState: mu,
        useOptimistic: function(t, e) {
          var l = Mt();
          return ru(l, wt, t, e);
        },
        useMemoCache: Ri,
        useCacheRefresh: ku
      };
      Vr.useEffectEvent = bu;
      var Es = {
        readContext: Jt,
        use: ba,
        useCallback: Su,
        useContext: Jt,
        useEffect: Bi,
        useImperativeHandle: _u,
        useInsertionEffect: yu,
        useLayoutEffect: xu,
        useMemo: zu,
        useReducer: Ui,
        useRef: vu,
        useState: function() {
          return Ui(Ke);
        },
        useDebugValue: Yi,
        useDeferredValue: function(t, e) {
          var l = Mt();
          return wt === null ? Gi(l, t, e) : Eu(
            l,
            wt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ui(Ke)[0], e = Mt().memoizedState;
          return [
            typeof t == "boolean" ? t : Mn(t),
            e
          ];
        },
        useSyncExternalStore: tu,
        useId: Cu,
        useHostTransitionStatus: Qi,
        useFormState: hu,
        useActionState: hu,
        useOptimistic: function(t, e) {
          var l = Mt();
          return wt !== null ? ru(l, wt, t, e) : (l.baseState = t, [t, l.queue.dispatch]);
        },
        useMemoCache: Ri,
        useCacheRefresh: ku
      };
      Es.useEffectEvent = bu;
      var Kr = {
        enqueueSetState: function(t, e, l) {
          t = t._reactInternals;
          var n = de(), r = ol(n);
          r.payload = e, l != null && (r.callback = l), e = ul(t, r, n), e !== null && (ie(e, t, n), Cn(e, t, n));
        },
        enqueueReplaceState: function(t, e, l) {
          t = t._reactInternals;
          var n = de(), r = ol(n);
          r.tag = 1, r.payload = e, l != null && (r.callback = l), e = ul(t, r, n), e !== null && (ie(e, t, n), Cn(e, t, n));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var l = de(), n = ol(l);
          n.tag = 2, e != null && (n.callback = e), e = ul(t, n, l), e !== null && (ie(e, t, l), Cn(e, t, l));
        }
      }, Xr = Error(s(461)), jt = !1, Zr = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, Pe = !1, Ut = !1, Jr = !1, Ns = typeof WeakSet == "function" ? WeakSet : Set, Kt = null, Dt = null, oe = !1, Re = null, bn = 8192, fp = {
        getCacheForType: function(t) {
          var e = Jt(Nt), l = e.data.get(t);
          return l === void 0 && (l = t(), e.data.set(t, l)), l;
        },
        cacheSignal: function() {
          return Jt(Nt).controller.signal;
        }
      }, $a = 0, Pa = 1, ti = 2, ei = 3, li = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Fn = Symbol.for;
        $a = Fn("selector.component"), Pa = Fn("selector.has_pseudo_class"), ti = Fn("selector.role"), ei = Fn("selector.test_id"), li = Fn("selector.text");
      }
      var dp = typeof WeakMap == "function" ? WeakMap : Map, ft = 0, _t = null, dt = null, mt = 0, xt = 0, be = null, yl = !1, yn = !1, Lr = !1, tl = 0, kt = 0, xl = 0, Vl = 0, Wr = 0, ye = 0, xn = 0, In = null, ue = null, Fr = !1, ni = 0, Ts = 0, $n = 1 / 0, ai = null, wl = null, Yt = 0, _l = null, wn = null, el = 0, Ir = 0, $r = null, Cs = null, Pn = 0, Pr = null;
      return st.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Al(t, 67108864);
          e !== null && ie(e, t, 67108864), br(t, 67108864);
        }
      }, st.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = de();
          e = Pt(e);
          var l = Al(t, e);
          l !== null && ie(l, t, e), br(t, e);
        }
      }, st.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = D(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var l = 1 << 31 - pe(e);
                  t.entanglements[1] |= l, e &= ~l;
                }
                Ue(t), (ft & 6) === 0 && ($n = re() + 500, Wl(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Al(t, 2), e !== null && ie(e, t, 2), Sc(), br(t, 2);
        }
      }, st.batchedUpdates = function(t, e) {
        return t(e);
      }, st.createComponentSelector = function(t) {
        return { $$typeof: $a, value: t };
      }, st.createContainer = function(t, e, l, n, r, o, f, p, S, C) {
        return Gc(
          t,
          e,
          !1,
          null,
          l,
          n,
          o,
          null,
          f,
          p,
          S,
          C
        );
      }, st.createHasPseudoClassSelector = function(t) {
        return { $$typeof: Pa, value: t };
      }, st.createHydrationContainer = function(t, e, l, n, r, o, f, p, S, C, Y, j, X, ot) {
        return t = Gc(
          l,
          n,
          !0,
          t,
          r,
          o,
          p,
          ot,
          S,
          C,
          Y,
          j
        ), t.context = Qc(null), l = t.current, n = de(), n = Pt(n), r = ol(n), r.callback = e ?? null, ul(l, r, n), e = n, t.current.lanes = e, Q(t, e), Ue(t), t;
      }, st.createPortal = function(t, e, l) {
        var n = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: tn,
          key: n == null ? null : "" + n,
          children: t,
          containerInfo: e,
          implementation: l
        };
      }, st.createRoleSelector = function(t) {
        return { $$typeof: ti, value: t };
      }, st.createTestNameSelector = function(t) {
        return { $$typeof: ei, value: t };
      }, st.createTextSelector = function(t) {
        return { $$typeof: li, value: t };
      }, st.defaultOnCaughtError = function(t) {
        console.error(t);
      }, st.defaultOnRecoverableError = function(t) {
        ys(t);
      }, st.defaultOnUncaughtError = function(t) {
        ys(t);
      }, st.deferredUpdates = function(t) {
        var e = P.T, l = Fe();
        try {
          return Vt(32), P.T = null, t();
        } finally {
          Vt(l), P.T = e;
        }
      }, st.discreteUpdates = function(t, e, l, n, r) {
        var o = P.T, f = Fe();
        try {
          return Vt(2), P.T = null, t(e, l, n, r);
        } finally {
          Vt(f), P.T = o, ft === 0 && ($n = re() + 500);
        }
      }, st.findAllNodes = fr, st.findBoundingRects = function(t, e) {
        if (!Gn) throw Error(s(363));
        e = fr(t, e), t = [];
        for (var l = 0; l < e.length; l++)
          t.push(Jd(e[l]));
        for (e = t.length - 1; 0 < e; e--) {
          l = t[e];
          for (var n = l.x, r = n + l.width, o = l.y, f = o + l.height, p = e - 1; 0 <= p; p--)
            if (e !== p) {
              var S = t[p], C = S.x, Y = C + S.width, j = S.y, X = j + S.height;
              if (n >= C && o >= j && r <= Y && f <= X) {
                t.splice(e, 1);
                break;
              } else if (n !== C || l.width !== S.width || X < o || j > f) {
                if (!(o !== j || l.height !== S.height || Y < n || C > r)) {
                  C > n && (S.width += C - n, S.x = n), Y < r && (S.width = r - C), t.splice(e, 1);
                  break;
                }
              } else {
                j > o && (S.height += j - o, S.y = o), X < f && (S.height = f - j), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, st.findHostInstance = Vc, st.findHostInstanceWithNoPortals = function(t) {
        return t = h(t), t = t !== null ? y(t) : null, t === null ? null : Yn(t.stateNode);
      }, st.findHostInstanceWithWarning = function(t) {
        return Vc(t);
      }, st.flushPassiveEffects = Bn, st.flushSyncFromReconciler = function(t) {
        var e = ft;
        ft |= 1;
        var l = P.T, n = Fe();
        try {
          if (Vt(2), P.T = null, t)
            return t();
        } finally {
          Vt(n), P.T = l, ft = e, (ft & 6) === 0 && Wl(0);
        }
      }, st.flushSyncWork = Sc, st.focusWithin = function(t, e) {
        if (!Gn) throw Error(s(363));
        for (t = ur(t), e = yc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var l = e[t++], n = l.tag;
          if (!Qn(l)) {
            if ((n === 5 || n === 26 || n === 27) && Fd(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              e.push(l), l = l.sibling;
          }
        }
        return !1;
      }, st.getFindAllNodesFailureDescription = function(t, e) {
        if (!Gn) throw Error(s(363));
        var l = 0, n = [];
        t = [ur(t), 0];
        for (var r = 0; r < t.length; ) {
          var o = t[r++], f = o.tag, p = t[r++], S = e[p];
          if ((f !== 5 && f !== 26 && f !== 27 || !Qn(o)) && (cr(o, S) && (n.push(sr(S)), p++, p > l && (l = p)), p < e.length))
            for (o = o.child; o !== null; )
              t.push(o, p), o = o.sibling;
        }
        if (l < e.length) {
          for (t = []; l < e.length; l++)
            t.push(sr(e[l]));
          return `findAllNodes was able to match part of the selector:
  ` + (n.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, st.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Yn(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, st.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Ed,
          rendererPackageName: Nd,
          currentDispatcherRef: P,
          reconcilerVersion: "19.2.0"
        };
        if (Wc !== null && (t.rendererConfig = Wc), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Vn = e.inject(t), he = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, st.isAlreadyRendering = function() {
        return (ft & 6) !== 0;
      }, st.observeVisibleRects = function(t, e, l, n) {
        if (!Gn) throw Error(s(363));
        t = fr(t, e);
        var r = Id(
          t,
          l,
          n
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, st.shouldError = function() {
        return null;
      }, st.shouldSuspend = function() {
        return !1;
      }, st.startHostTransition = function(t, e, l, n) {
        if (t.tag !== 5) throw Error(s(476));
        var r = Tu(t).queue;
        Nu(
          t,
          r,
          e,
          ln,
          l === null ? c : function() {
            var o = Tu(t);
            return o.next === null && (o = t.alternate.memoizedState), On(
              t,
              o.next.queue,
              {},
              de()
            ), l(n);
          }
        );
      }, st.updateContainer = function(t, e, l, n) {
        var r = e.current, o = de();
        return Kc(
          r,
          o,
          t,
          e,
          l,
          n
        ), o;
      }, st.updateContainerSync = function(t, e, l, n) {
        return Kc(
          e.current,
          2,
          t,
          e,
          l,
          n
        ), 2;
      }, st;
    }, a.exports.default = a.exports, Object.defineProperty(a.exports, "__esModule", { value: !0 });
  })(ao)), ao.exports;
}
var Bs;
function Dp() {
  return Bs || (Bs = 1, no.exports = Up()), no.exports;
}
var qp = Dp();
const Bp = /* @__PURE__ */ Co(qp);
var oo = { exports: {} }, ll = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ys;
function Yp() {
  return Ys || (Ys = 1, ll.ConcurrentRoot = 1, ll.ContinuousEventPriority = 8, ll.DefaultEventPriority = 32, ll.DiscreteEventPriority = 2, ll.IdleEventPriority = 268435456, ll.LegacyRoot = 0, ll.NoEventPriority = 0), ll;
}
var Gs;
function Gp() {
  return Gs || (Gs = 1, oo.exports = Yp()), oo.exports;
}
var aa = Gp();
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
const bf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], mo = 16, yf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Qp = [
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
], Qs = {
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
}, Vp = /* @__PURE__ */ new Set([
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
]), xf = {
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
}, wf = {
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
}, po = ["font-size", "color", ...new Set([...Object.keys(xf), ...Object.keys(wf)].filter((a) => a !== "font-size" && a !== "color"))], Kp = new Set(po);
function ce(a, i = " ") {
  const u = [];
  let c = 0, s = "";
  for (let d = 0; d < a.length; d++) {
    const m = a[d];
    if (m === "(" ? c++ : m === ")" && c--, c === 0 && (i === " " ? /\s/.test(m) : m === i)) {
      (s.trim() || i !== " ") && u.push(s.trim()), s = "";
      continue;
    }
    s += m;
  }
  return (s.trim() || i !== " " && u.length) && u.push(s.trim()), u;
}
function ho(a, i, u = 0) {
  if (u > 32) return null;
  let c = "", s = 0;
  for (; ; ) {
    const d = a.indexOf("var(", s);
    if (d < 0)
      return c += a.slice(s), c;
    c += a.slice(s, d);
    let m = 1, h = d + 4;
    for (; h < a.length && m; h++)
      a[h] === "(" ? m++ : a[h] === ")" && m--;
    const g = a.slice(d + 4, h - 1), y = ce(g, ","), R = y[0].trim(), H = y.length > 1 ? g.slice(g.indexOf(",") + 1).trim() : null;
    let x = i(R);
    if ((x == null || x === "initial") && (x = H), x == null) return null;
    const E = ho(x, i, u + 1);
    if (E === null) return null;
    c += E, s = h;
  }
}
function Xp(a) {
  const i = [], u = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let c, s = 0;
  for (; s < a.length; ) {
    if (u.lastIndex = s, c = u.exec(a), !c || c.index !== s) {
      if (/^\s+$/.test(a.slice(s))) break;
      return null;
    }
    s = u.lastIndex, c[1] !== void 0 ? i.push({ num: parseFloat(c[1]), unit: (c[2] ?? "").toLowerCase() }) : c[3] ? i.push({ fn: c[3].toLowerCase() }) : c[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: c[5] ?? c[6] });
  }
  return i;
}
function vo(a, i) {
  const u = Xp(a.trim());
  if (!u) return null;
  let c = 0;
  const s = ({ num: x, unit: E }) => {
    switch (E) {
      case "":
        return { px: 0, pct: 0, num: x, unitless: !0 };
      case "px":
        return { px: x, pct: 0, num: 0 };
      case "rem":
        return { px: x * mo, pct: 0, num: 0 };
      case "em":
        return { px: x * (i.fontSize ?? mo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: x, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: x / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: x / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: x * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (x, E, T) => x && E ? { px: x.px + T * E.px, pct: x.pct + T * E.pct, num: x.num + T * E.num, unitless: x.unitless && E.unitless } : null, m = (x, E) => x ? { px: x.px * E, pct: x.pct * E, num: x.num * E, unitless: x.unitless } : null, h = (x) => x && x.unitless;
  function g() {
    const x = u[c++];
    if (!x) return null;
    if (x.num !== void 0) return s(x);
    if (x.op === "(") {
      const E = R();
      return u[c]?.op !== ")" ? null : (c++, E);
    }
    if (x.op === "-" || x.op === "+") {
      const E = g();
      return x.op === "-" ? m(E, -1) : E;
    }
    if (x.fn) {
      const E = [];
      for (; ; ) {
        E.push(R());
        const D = u[c++];
        if (!D) return null;
        if (D.op === ")") break;
        if (D.op !== ",") return null;
      }
      if (E.some((D) => !D)) return null;
      if (x.fn === "calc") return E[0];
      if (!(E.every((D) => !D.pct) || E.every((D) => !D.px && !D.num))) return null;
      const B = (D) => D.px + D.pct + D.num;
      return x.fn === "min" ? E.reduce((D, M) => B(M) < B(D) ? M : D) : x.fn === "max" ? E.reduce((D, M) => B(M) > B(D) ? M : D) : x.fn === "clamp" && E.length === 3 ? B(E[1]) < B(E[0]) ? E[0] : B(E[1]) > B(E[2]) ? E[2] : E[1] : null;
    }
    return null;
  }
  function y() {
    let x = g();
    for (; u[c] && (u[c].op === "*" || u[c].op === "/"); ) {
      const E = u[c++].op, T = g();
      if (!x || !T) return null;
      E === "*" ? x = h(T) ? m(x, T.num) : h(x) ? m(T, x.num) : null : x = h(T) && T.num !== 0 ? m(x, 1 / T.num) : null;
    }
    return x;
  }
  function R() {
    let x = y();
    for (; u[c] && (u[c].op === "+" || u[c].op === "-"); ) {
      const E = u[c++].op;
      x = d(x, y(), E === "-" ? -1 : 1);
    }
    return x;
  }
  const H = R();
  return c !== u.length || !H ? null : H;
}
function go(a, i) {
  const u = a.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(u))
    return u === "thin" ? { px: 1 } : u === "medium" ? { px: 3 } : u === "thick" ? { px: 5 } : u;
  const c = vo(u, i);
  return c ? c.unitless ? c.num === 0 ? { px: 0 } : { expr: a.trim() } : c.pct && (c.px || c.num) ? { expr: a.trim() } : c.pct ? { pct: c.pct } : { px: Zp(c.px) } : { expr: a.trim() };
}
const Zp = (a) => Number.isFinite(a) ? a : a > 0 ? 34e37 : -34e37, ri = (a) => Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, "0"), Jp = ([a, i, u, c]) => `#${ri(a)}${ri(i)}${ri(u)}${ri(c * 255)}`;
function Vs(a) {
  const i = a.slice(1), u = i.length <= 4 ? i.split("").map((s) => s + s).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(u)) return null;
  const c = (s) => parseInt(u.slice(s, s + 2), 16);
  return [c(0), c(2), c(4), u.length === 8 ? c(6) / 255 : 1];
}
function fi(a, i) {
  const u = a.trim().toLowerCase();
  if (u === "currentcolor") return "currentcolor";
  const c = /^perchtoken\(([a-z0-9-]+)\)$/.exec(u);
  if (c) {
    const y = i(c[1]), R = y && Vs(y);
    return R ? { rgba: R, token: c[1] } : null;
  }
  if (u.startsWith("#")) {
    const y = Vs(u);
    return y ? { rgba: y, token: null } : null;
  }
  if (Qs[u]) return { rgba: [...Qs[u]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(u);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = ce(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const R = (At) => {
      const Zt = ce(At), zt = Zt.findIndex((et) => /%$/.test(et)), O = zt >= 0 ? parseFloat(Zt[zt]) / 100 : null;
      return { color: fi(Zt.filter((et, it) => it !== zt).join(" "), i), pct: O };
    }, H = R(y[1]), x = R(y[2]);
    if (!H.color || !x.color || H.color === "currentcolor" || x.color === "currentcolor") return null;
    let E = H.pct, T = x.pct;
    E === null && T === null ? (E = 0.5, T = 0.5) : E === null ? E = 1 - T : T === null && (T = 1 - E);
    const B = E + T, D = B < 1 ? B : 1;
    E /= B, T /= B;
    const [M, A, G, K] = H.color.rgba, [nt, Q, z, N] = x.color.rgba, V = K * E + N * T, yt = (At, Zt) => V === 0 ? 0 : (At * K * E + Zt * N * T) / V, Pt = [yt(M, nt), yt(A, Q), yt(G, z), V * D], qt = N === 0 ? H.color.token : K === 0 ? x.color.token : null;
    return { rgba: Pt, token: qt };
  }
  const d = s[2].includes(",") ? ce(s[2], ",") : ce(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const m = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), h = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), g = [m(d[0]), m(d[1]), m(d[2]), h];
  return g.some((y) => Number.isNaN(y)) ? null : { rgba: g, token: null };
}
const na = ["top", "right", "bottom", "left"], Lp = ["top-left", "top-right", "bottom-right", "bottom-left"], oi = (a) => [a[0], a[1] ?? a[0], a[2] ?? a[0], a[3] ?? a[1] ?? a[0]], Ks = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function bo(a, i) {
  const u = i.trim(), c = () => ce(u);
  switch (a) {
    case "padding":
    case "margin": {
      const s = oi(c());
      return na.map((d, m) => [`${a}-${d}`, s[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = c(), d = a.split("-")[0];
      return [[`${d}-left`, s[0]], [`${d}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = c(), d = a.split("-")[0];
      return [[`${d}-top`, s[0]], [`${d}-bottom`, s[1] ?? s[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${a.split("-")[0]}-left`, u]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${a.split("-")[0]}-right`, u]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${a.split("-")[0]}-top`, u]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${a.split("-")[0]}-bottom`, u]];
    case "inset": {
      const s = oi(c());
      return na.map((d, m) => [d, s[m]]);
    }
    case "inset-inline": {
      const s = c();
      return [["left", s[0]], ["right", s[1] ?? s[0]]];
    }
    case "inset-block": {
      const s = c();
      return [["top", s[0]], ["bottom", s[1] ?? s[0]]];
    }
    case "inset-inline-start":
      return [["left", u]];
    case "inset-inline-end":
      return [["right", u]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const s = a.split("-")[1], d = oi(c());
      return na.map((m, h) => [`border-${m}-${s}`, d[h]]);
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
      const s = a === "border" ? na : a === "border-inline" ? ["left", "right"] : a === "border-block" ? ["top", "bottom"] : a === "border-inline-start" ? ["left"] : a === "border-inline-end" ? ["right"] : [a.slice(7)];
      let d = "medium", m = "none", h = "currentcolor";
      if (u !== "none" && u !== "0")
        for (const g of c())
          Ks.has(g) ? m = g : /^(thin|medium|thick|-?[\d.]|calc\()/.test(g) ? d = g : h = g;
      else u === "0" && (d = "0");
      return s.flatMap((g) => [[`border-${g}-width`, d], [`border-${g}-style`, m], [`border-${g}-color`, h]]);
    }
    case "border-inline-width": {
      const s = c();
      return [["border-left-width", s[0]], ["border-right-width", s[1] ?? s[0]]];
    }
    case "border-block-width": {
      const s = c();
      return [["border-top-width", s[0]], ["border-bottom-width", s[1] ?? s[0]]];
    }
    case "border-inline-style": {
      const s = c();
      return [["border-left-style", s[0]], ["border-right-style", s[1] ?? s[0]]];
    }
    case "border-inline-color": {
      const s = c();
      return [["border-left-color", s[0]], ["border-right-color", s[1] ?? s[0]]];
    }
    case "border-radius": {
      const s = oi(ce(u.split("/")[0]));
      return Lp.map((d, m) => [`border-${d}-radius`, s[m]]);
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
      return u === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : fi(u, () => "#000000") ? [["background-color", u], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", u]];
    case "overflow": {
      const s = c();
      return [["overflow-x", s[0]], ["overflow-y", s[1] ?? s[0]]];
    }
    case "gap": {
      const s = c();
      return [["row-gap", s[0]], ["column-gap", s[1] ?? s[0]]];
    }
    case "grid-gap":
      return bo("gap", u);
    case "place-items": {
      const s = c();
      return [["align-items", s[0]], ["justify-items", s[1] ?? s[0]]];
    }
    case "place-self": {
      const s = c();
      return [["align-self", s[0]], ["justify-self", s[1] ?? s[0]]];
    }
    case "place-content": {
      const s = c();
      return [["align-content", s[0]], ["justify-content", s[1] ?? s[0]]];
    }
    case "flex": {
      if (u === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (u === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (u === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const s = c(), d = s.filter((h) => /^[\d.]+$/.test(h)), m = s.find((h) => !/^[\d.]+$/.test(h));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", m ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const d of c()) s.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return s;
    }
    case "outline": {
      if (u === "none" || u === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", d = "none", m = "currentcolor";
      for (const h of c())
        Ks.has(h) || h === "auto" ? d = h : /^(thin|medium|thick|-?[\d.]|calc\()/.test(h) ? s = h : m = h;
      return [["outline-width", s], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (u === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ce(u, ","), d = s.map((h) => ce(h).find((g) => !/^[\d.]+m?s$/.test(g) && !/^(ease|linear|step|cubic)/.test(g)) ?? "all"), m = s.map((h) => ce(h).find((g) => /^[\d.]+m?s$/.test(g)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", c()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", u]];
    case "word-wrap":
      return [["overflow-wrap", u]];
    default:
      return [[a, u]];
  }
}
function Wp(a, i) {
  return a ? ce(a, ",").some((u) => {
    let c = u.trim().toLowerCase(), s = !1;
    c.startsWith("not ") && (s = !0, c = c.slice(4)), c.startsWith("only ") && (c = c.slice(5));
    const d = c.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const h = /^\((.+)\)$/.exec(m);
      if (!h) return !1;
      const g = h[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(g);
      if (y) {
        const [, H, x] = y, E = (T) => {
          const B = go(T, { viewport: i });
          return typeof B == "object" && "px" in B ? B.px : NaN;
        };
        switch (H) {
          case "min-width":
            return i.width >= E(x);
          case "max-width":
            return i.width <= E(x);
          case "min-height":
            return i.height >= E(x);
          case "max-height":
            return i.height <= E(x);
          case "hover":
          case "any-hover":
            return x.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return x.trim() === "fine";
          case "prefers-reduced-motion":
            return x.trim() === "no-preference";
          case "prefers-color-scheme":
            return x.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const R = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(g);
      if (R) {
        const H = R[1] === "width" ? i.width : i.height, x = go(R[3], { viewport: i }), E = typeof x == "object" && "px" in x ? x.px : NaN;
        switch (R[2]) {
          case ">=":
            return H >= E;
          case "<=":
            return H <= E;
          case ">":
            return H > E;
          case "<":
            return H < E;
          default:
            return H === E;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function Fp(a, i) {
  const u = i[i.length - 1].compound;
  return ko(u)[0] ?? a;
}
function Ip(a) {
  const i = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Set(), c = (s, d) => {
    s.forEach(({ compound: m }, h) => {
      const g = d && h === s.length - 1;
      for (const y of m.pseudos)
        if (yf.has(y.name) && (g ? i : u).add(y.name), y.list && y.name !== "not") for (const R of y.list) c(R, g);
    });
  };
  return c(a, !0), { subject: i, ancestor: u };
}
function ko(a) {
  const i = [...a.classes];
  for (const u of a.pseudos)
    if (!(u.name !== "is" && u.name !== "where"))
      for (const c of u.list) c.length === 1 && i.push(...ko(c[0].compound));
  return i;
}
function $p(a, i) {
  const u = (c, s) => {
    c.forEach(({ compound: d }, m) => {
      const h = s && m === c.length - 1, g = d.pseudos.filter((y) => yf.has(y.name)).map((y) => y.name);
      if (!h) for (const y of g) for (const R of ko(d)) i.add(`${y}:${R}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const R of y.list) u(R, h);
    });
  };
  u(a, !0);
}
class Pp {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const u = (d, m) => {
      const h = m[m.length - 1].compound, g = h.classes.length ? `.${h.classes[0]}` : h.tag && h.tag !== "*" ? h.tag : "*";
      this.index.has(g) || this.index.set(g, []), this.index.get(g).push(d);
    };
    let c = 0;
    const s = (d, m) => {
      for (const [h, g, y, R] of d)
        for (const H of So(h)) {
          let x;
          try {
            x = zo(H);
          } catch (B) {
            if (B instanceof we) {
              this.skipped++;
              continue;
            }
            throw B;
          }
          const E = Ip(x);
          $p(x, this.trackedStates);
          const T = { steps: x, media: g, layer: y, origin: m, order: c++, specificity: hf(x), decls: R, states: E, source: m === 0 ? `ua:${x[x.length - 1].compound.tag ?? "*"}` : Fp(H, x) };
          this.rules.push(T), u(T, x);
        }
    };
    s(Qp.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), s(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const u = [], c = /* @__PURE__ */ new Set(), s = (d) => {
      if (d) for (const m of d) c.has(m) || (c.add(m), u.push(m));
    };
    for (const d of i.classList) s(this.index.get(`.${d}`));
    return s(this.index.get(i.tagName)), s(this.index.get("*")), u;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, u) {
    for (const c of i.classList) if (this.trackedStates.has(`${u}:${c}`)) return !0;
    return !1;
  }
}
const th = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function eh(a) {
  if (!a || typeof a != "object") return [];
  const i = [];
  for (const [u, c] of Object.entries(a)) {
    if (c == null || c === "" || typeof c == "boolean") continue;
    const s = u.startsWith("--") ? u : u.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof c == "number" && c !== 0 && !th.has(s) && !s.startsWith("--") ? `${c}px` : String(c);
    i.push([s, d]);
  }
  return i;
}
function lh(a) {
  if (a.tagName !== "svg") return [];
  const i = [];
  for (const u of ["width", "height"]) {
    const c = a.getAttribute(u);
    c !== null && i.push([u, /^[\d.]+$/.test(c) ? `${c}px` : c]);
  }
  return i;
}
const nh = (a, i) => a.important - i.important || a.origin - i.origin || a.layer - i.layer || a.specificity[0] - i.specificity[0] || a.specificity[1] - i.specificity[1] || a.specificity[2] - i.specificity[2] || a.order - i.order;
class ah {
  constructor(i, { theme: u, viewport: c }) {
    this.sheet = i, this.theme = u, this.viewport = c, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, u) {
    const c = (s, d, m) => {
      if (d === "disabled") return !!s.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(s.tagName);
      if (d === "enabled") return !s.props?.disabled && ["button", "input", "select", "textarea"].includes(s.tagName);
      if (d === "checked") return !!s.props?.checked;
      if (u === "*") return !0;
      if (d === "focus-within") {
        const h = s.ownerDocument?.activeElement;
        return !!h && h !== s.ownerDocument.body && typeof s.contains == "function" && s.contains(h);
      }
      return m ? u.has(d) : d === "focus-visible" ? !!s.state?.focus : !!s.state?.[d];
    };
    return this.sheet.candidates(i).filter((s) => (!s.media || s.media.every((d) => Wp(d, this.viewport))) && _p(i, s.steps, { state: c }));
  }
  compute(i, u, c = /* @__PURE__ */ new Set()) {
    const s = this.matching(i, c), d = [];
    for (const z of s)
      for (const [N, V, yt] of z.decls) d.push({ prop: N, value: V, important: yt ? 1 : 0, origin: z.origin === 0 ? 0 : 2, layer: z.layer, specificity: z.specificity, order: z.order, source: z.source });
    for (const [z, N] of lh(i)) d.push({ prop: z, value: N, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${z}` });
    for (const [z, N] of eh(i.props?.style)) d.push({ prop: z, value: N, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(nh);
    const m = this.sheet.properties, h = Object.create(u?.customs ?? null), g = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const z of d) z.prop.startsWith("--") && y.set(z.prop, z.value);
    if (!u && this.theme) for (const z of bf) this.theme[z] && y.set(`--${z}`, `perchtoken(${z})`);
    const R = (z) => {
      if (g.has(z)) return g.get(z);
      const N = m[z];
      return N && !N.inherits ? N.initial ?? null : z in h ? h[z] : N?.initial ?? null;
    }, H = /* @__PURE__ */ new Set(), x = (z) => {
      if (!y.has(z)) return R(z);
      if (H.has(z)) return null;
      H.add(z);
      const N = ho(y.get(z), x);
      return H.delete(z), y.delete(z), g.set(z, N), (!m[z] || m[z].inherits) && (h[z] = N), N;
    };
    for (const z of [...y.keys()]) x(z);
    const E = /* @__PURE__ */ new Map();
    for (const z of d) {
      if (z.prop.startsWith("--")) continue;
      const N = ho(z.value, R);
      if (N === null) {
        for (const [V] of bo(z.prop, "unset")) E.set(V, { value: "unset", source: z.source, origin: z.origin });
        continue;
      }
      for (const [V, yt] of bo(z.prop, N)) E.set(V, { value: yt, source: z.source, origin: z.origin });
    }
    const T = {}, B = {}, D = /* @__PURE__ */ new Set(), M = /* @__PURE__ */ new Set(), A = u?.values, G = { fontSize: A?.["font-size"] ?? mo, viewport: this.viewport }, K = (z, N) => {
      if (/currentcolor/i.test(N)) return this.parseValue(z, N, G, T, A);
      const V = `${z}\0${N}\0${G.fontSize}`;
      let yt = this.parsed.get(V);
      return yt === void 0 && this.parsed.set(V, yt = this.parseValue(z, N, G, T, A)), yt;
    }, nt = E.size ? [...po, ...[...E.keys()].filter((z) => !Kp.has(z))] : po;
    for (const z of nt) {
      const N = E.get(z);
      let V = N?.value;
      const yt = Vp.has(z);
      if ((V === void 0 || V === "unset" || V === "revert" || V === "revert-layer") && (V = yt ? "inherit" : "initial"), N && (B[z] = N.source, N.origin !== 0 && D.add(z)), V === "inherit" && A && z in A) {
        T[z] = A[z], M.add(z);
        continue;
      }
      (V === "inherit" || V === "initial") && (V = yt ? wf[z] : xf[z]), T[z] = K(z, V), z === "font-size" && (G.fontSize = T["font-size"]);
    }
    for (const z of na) {
      const N = T[`border-${z}-style`];
      (N === "none" || N === "hidden") && (T[`border-${z}-width`] = { px: 0 });
    }
    T["outline-style"] === "none" && (T["outline-width"] = { px: 0 });
    const Q = A?.display;
    return (Q === "flex" || Q === "inline-flex" || Q === "grid" || Q === "inline-grid") && T.position !== "absolute" && T.position !== "fixed" && (T.display = Xs(T.display)), (T.position === "absolute" || T.position === "fixed") && (T.display = Xs(T.display)), { values: T, sources: B, own: D, inherited: M, customs: h, rules: s, element: i };
  }
  parseValue(i, u, c, s, d) {
    const m = String(u).trim();
    switch (i) {
      case "font-size": {
        const h = m.toLowerCase(), g = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (g[h]) return g[h];
        if (h === "smaller") return c.fontSize / 1.2;
        if (h === "larger") return c.fontSize * 1.2;
        const y = vo(h, { fontSize: c.fontSize, viewport: c.viewport });
        return !y || y.num ? c.fontSize : y.px + y.pct / 100 * c.fontSize;
      }
      case "font-weight": {
        const h = m.toLowerCase();
        if (h === "normal") return 400;
        if (h === "bold") return 700;
        if (h === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (h === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const g = parseFloat(h);
        return Number.isFinite(g) ? g : 400;
      }
      case "line-height": {
        const h = m.toLowerCase();
        if (h === "normal") return { normal: !0 };
        const g = vo(h, { fontSize: c.fontSize, viewport: c.viewport });
        return g ? g.unitless ? { factor: g.num } : { px: g.px + g.pct / 100 * c.fontSize } : { normal: !0 };
      }
      case "font-family":
        return m;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const h = m.endsWith("%") ? parseFloat(m) / 100 : parseFloat(m);
        return Number.isFinite(h) ? h : parseFloat(i === "flex-shrink" || i === "opacity" ? 1 : 0);
      }
      case "color": {
        const h = fi(m, (g) => this.themeHex(g));
        return h === "currentcolor" || !h ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : h;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const h = fi(m, (g) => this.themeHex(g));
        return h === "currentcolor" ? s.color : h ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return go(m, c);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Xs(a) {
  return a === "inline" || a === "inline-block" || a === "contents" ? "block" : a === "inline-flex" ? "flex" : a === "inline-grid" ? "grid" : a;
}
const di = (a) => a && a.rgba ? { value: Jp(a.rgba), token: a.token ?? null } : null, ih = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function rh(a, i) {
  const u = i?.(a);
  if (Number.isFinite(u)) return u;
  const c = Math.round(a * 100) / 100;
  return ih[c] ?? Math.round(a * 1.2);
}
function oh(a, i) {
  const u = a["line-height"], c = a["font-size"];
  return u.normal ? rh(c, i) : u.factor !== void 0 ? u.factor * c : u.px;
}
const uh = (a) => ce(a, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
//!
//! Text styles follow GPUI's inheritance: a node carries a text style when it sets one itself (so an ancestor's
//! hover colour does not reach it, as in CSS) or when the inherited value would differ (`line-height: normal`, a
//! multiplier under a new size). `tokens` names the theme token each colour came from.
const ch = "perch-native-description/1", Zs = Symbol("display"), mi = {
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
}, sh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const a of sh) mi[a] = /^(w|h|min_|max_|top|right|bottom|left)/.test(a) ? "auto" : 0;
mi.rounded = 0;
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
]), dh = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, mh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, ph = (a) => mh.test(a) ? "Menlo" : dh.test(a) ? ".SystemUIFont" : uh(a).split(",")[0].trim(), hh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Js = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, _f = (a) => {
  const i = a.props["data-testid"];
  if (i) return `${a.tagName}[data-testid="${i}"]`;
  if (a.props.id) return `${a.tagName}#${a.props.id}`;
  const u = a.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? a.classList[0];
  if (u) return `${a.tagName}.${u}`;
  const c = a.parentElement;
  return c && c.tagName !== "body" ? `${_f(c)} > ${a.tagName}` : a.tagName;
};
class vh {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, u, c, s, d, m = "") {
    const h = `${i}|${u}|${c}|${s}`, g = this.map.get(h);
    if (g) {
      !g.elements.includes(d) && g.elements.length < 4 && g.elements.push(d), g.count++;
      return;
    }
    this.map.set(h, { kind: i, property: u, value: String(c), class: s ?? null, elements: [d], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, u) => i.kind < u.kind ? -1 : i.kind > u.kind ? 1 : i.property < u.property ? -1 : i.property > u.property ? 1 : 0);
  }
}
const al = (a) => {
  if (a != null) {
    if (typeof a == "string") return a === "auto" || a === "none" || a === "normal" ? "auto" : void 0;
    if ("px" in a) return Math.round(Math.min(Math.max(a.px, -9999), 9999) * 100) / 100;
    if ("pct" in a) return `${Math.round(a.pct * 1e3) / 1e3}%`;
  }
};
function Ls(a, i) {
  const u = a.values, c = {}, s = (M) => a.sources[M], d = (M) => a.sources[M] !== void 0, m = u.display;
  m === "none" ? c.display = "hidden" : m === "flex" || m === "inline-flex" ? c.display = "flex" : (m === "grid" || m === "inline-grid") && (c.display = "flex", c.flex_direction = "col", i("approximated", "display", m, s("display"), "one-column flex column"), u["grid-template-columns"] && u["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", u["grid-template-columns"], s("grid-template-columns"))), a.element.hidden && (c.display = "hidden");
  const h = c.display === "flex";
  if (h && c.flex_direction !== "col") {
    const M = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[u["flex-direction"]] ?? "row";
    c.flex_direction = M;
  }
  if (h) {
    (u["flex-wrap"] === "wrap" || u["flex-wrap"] === "wrap-reverse") && (c.flex_wrap = "wrap");
    const M = m === "grid" || m === "inline-grid", A = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[u["align-items"]];
    A && (c.items = A);
    let G = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[u["justify-content"]];
    if (M) {
      const Q = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[u["justify-items"]];
      Q && (c.items = Q), u["align-items"] === "center" && (G = "center");
    }
    G && (c.justify = G);
    const K = al(u["row-gap"]), nt = al(u["column-gap"]);
    typeof K == "number" && K && (c.gap_y = K), typeof nt == "number" && nt && !M && (c.gap_x = nt);
  }
  u["flex-grow"] && (c.flex_grow = u["flex-grow"]), u["flex-shrink"] !== 1 && (c.flex_shrink = u["flex-shrink"]);
  const g = al(u["flex-basis"]);
  g !== void 0 && g !== "auto" && (c.flex_basis = g);
  const y = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[u["align-self"]];
  y && (c.self = y);
  for (const [M, A] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const G = u[A], K = al(G);
    if (K === void 0) {
      typeof G == "object" && G.expr ? i("unsupported", A, G.expr, s(A), "no calc() in the engine") : typeof G == "string" && !["auto", "none"].includes(G) && i("unsupported", A, G, s(A));
      continue;
    }
    K !== "auto" && (c[M] = K);
  }
  const R = ["top", "right", "bottom", "left"];
  for (const M of R) {
    const A = M[0];
    for (const [G, K] of [["p", "padding"], ["m", "margin"]]) {
      const nt = u[`${K}-${M}`], Q = al(nt);
      if (Q === void 0) {
        nt?.expr && i("unsupported", `${K}-${M}`, nt.expr, s(`${K}-${M}`), "no calc() in the engine");
        continue;
      }
      Q !== 0 && (c[`${G}${A}`] = Q);
    }
  }
  const H = u.position;
  if (H === "absolute" || H === "fixed") {
    c.position = "absolute", H === "fixed" && i("approximated", "position", "fixed", s("position"), "absolute in the overlay layer");
    for (const M of R) {
      const A = al(u[M]);
      A !== void 0 && A !== "auto" && (c[M] = A);
    }
  } else H === "sticky" && i("unsupported", "position", "sticky", s("position"));
  u["z-index"] !== "auto" && d("z-index") && i("unsupported", "z-index", u["z-index"], s("z-index"), "paint order is tree order");
  for (const [M, A] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const G = u[A];
    G === "hidden" || G === "clip" ? c[M] = "hidden" : (G === "auto" || G === "scroll") && (c[M] = "scroll");
  }
  (u.visibility === "hidden" || u.visibility === "collapse") && (c.visibility = "invisible");
  const x = u["background-color"];
  x?.unreadable ? i("unsupported", "background-color", x.unreadable, s("background-color")) : x?.rgba && x.rgba[3] > 0 && (c.bg = di(x)), u["background-image"] && u["background-image"] !== "none" && i("unsupported", "background-image", u["background-image"], s("background-image"));
  const E = R.map((M) => al(u[`border-${M}-width`]) || 0), T = [];
  R.forEach((M, A) => {
    if (!E[A]) return;
    c[`border_${M[0]}`] = E[A];
    const G = u[`border-${M}-style`];
    G !== "solid" && i("approximated", `border-${M}-style`, G, s(`border-${M}-style`), "drawn solid");
    const K = di(u[`border-${M}-color`]);
    K && T.push(K);
  }), T.length && (c.border_color = T[0], T.some((M) => M.value !== T[0].value) && i("approximated", "border-color", T.map((M) => M.value).join(" "), s("border-top-color"), "one border colour"));
  const B = ["top-left", "top-right", "bottom-right", "bottom-left"].map((M) => al(u[`border-${M}-radius`]) || 0);
  B.every((M) => M === B[0]) ? B[0] && (c.rounded = B[0]) : ["tl", "tr", "br", "bl"].forEach((M, A) => {
    B[A] && (c[`rounded_${M}`] = B[A]);
  }), u.opacity !== 1 && (c.opacity = Math.round(u.opacity * 1e3) / 1e3);
  const D = u["box-shadow"];
  if (D && D !== "none" && ce(D, ",").some((M) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(M.trim())) && (c.shadow = "lg", i("approximated", "box-shadow", D, s("box-shadow"), "the engine's large shadow preset")), u.cursor && u.cursor !== "auto" && !a.inherited.has("cursor")) {
    const M = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[u.cursor];
    M ? c.cursor = M : i("unsupported", "cursor", u.cursor, s("cursor"));
  }
  return u["text-overflow"] === "ellipsis" && (c.text_ellipsis = !0), u["text-decoration-line"] === "underline" ? c.underline = !0 : u["text-decoration-line"] && u["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", u["text-decoration-line"], s("text-decoration-line")), c;
}
function Ws(a, i) {
  const u = a.values, c = u["line-height"];
  return {
    text_color: di(u.color),
    text_size: Math.round(u["font-size"] * 1e3) / 1e3,
    font_weight: u["font-weight"],
    line_height: c.factor !== void 0 ? { factor: c.factor } : { px: Math.round(oh(u, i) * 1e3) / 1e3 },
    font_family: ph(u["font-family"]),
    italic: u["font-style"] === "italic" || u["font-style"] === "oblique",
    whitespace: u["white-space"] === "nowrap" || u["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[u["text-align"]] ?? "left"
  };
}
const Fs = (a, i) => a.factor !== void 0 ? a.factor * i : a.px, Sf = (a, i) => JSON.stringify(a) === JSON.stringify(i);
function Is(a, i, u) {
  const c = {}, s = (h, g) => g.some((y) => !a.inherited.has(y));
  for (const [h, g] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]]])
    (s(h, g) || !Sf(i[h], u[h])) && (c[h] = i[h]);
  const d = Fs(i.line_height, i.text_size), m = u.line_height ? Fs(u.line_height, i.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (c.line_height = i.line_height), c;
}
const gh = (a, i) => ({ ...a, ...i });
function $s(a, i) {
  const u = {};
  for (const [c, s] of Object.entries(a))
    s && typeof s == "object" && "value" in s ? (u[c] = s.value, s.token && (i[c] = s.token)) : c === "line_height" ? u[c] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : c === "italic" ? s && (u.italic = !0) : u[c] = s;
  return u.italic === !1 && delete u.italic, u;
}
function bh(a, i) {
  const u = {};
  for (const c of /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(i)])) {
    const s = a[c], d = i[c];
    Sf(s, d) || (u[c] = d === void 0 ? c in mi ? mi[c] : null : d);
  }
  return u;
}
function Ps(a, i) {
  const u = a.values;
  for (const [c, s] of Object.entries(a.sources)) {
    if (c.startsWith("--") || fh.has(c) || s.startsWith("ua:")) continue;
    const d = u[c];
    switch (c) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("unsupported", c, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, "no letter spacing in the engine");
        break;
      case "font-variant-numeric":
        d !== "normal" && i("unsupported", c, d, s, "no font features in the engine");
        break;
      case "text-transform":
        d !== "none" && i("approximated", c, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = u["transition-duration"];
        c === "transition-property" && m && ce(m, ",").some((h) => parseFloat(h) > 0) && u["transition-property"] !== "none" && i("unsupported", "transition", `${u["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && i("unsupported", c, d, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        c === "overflow-wrap" && d !== "normal" && i("unsupported", c, d, s);
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        u["outline-style"] !== "none" && c === "outline-style" && i("unsupported", "outline", `${al(u["outline-width"])}px ${u["outline-style"]} ${di(u["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && i("unsupported", c, d, s);
        break;
    }
  }
}
function yh(a, i, u, c) {
  const s = _f(a), d = [], m = (D, M, A, G, K) => d.push([D, M, A, G ?? "(user agent)", s, K]), h = c.cascade.compute(a, i), g = {}, y = Ls(h, m);
  Ps(h, m);
  const R = Ws(h, c.measure), H = Is(h, R, u), x = $s({ ...y, ...H }, g), E = {}, T = c.cascade.matching(a, "*").filter((D) => D.states.subject.size);
  for (const [D, M] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!T.some((Q) => M.some((z) => Q.states.subject.has(z)))) continue;
    const A = c.cascade.compute(a, i, new Set(M)), G = {}, K = $s({ ...Ls(A, () => {
    }), ...Is(A, Ws(A, c.measure), u) }, G);
    D === "focus" && Ps(A, m);
    const nt = bh(x, K);
    if (Object.keys(nt).length) {
      E[D] = nt;
      const Q = Object.fromEntries(Object.entries(G).filter(([z]) => z in nt));
      Object.keys(Q).length && (E[`${D}_tokens`] = Q);
    }
  }
  c.cascade.sheet.tracks(a, "hover") && (E.track_hover = !0);
  const B = Object.entries(hh).filter(([, D]) => D.some((M) => typeof a.props[M] == "function")).map(([D]) => D);
  return B.length && (E.events = B), { computed: h, style: x, tokens: g, extra: E, meta: xh(a), reports: d, childText: gh(u, H), where: s };
}
function zf(a, i, u, c, s = "") {
  const d = `${s}/${a.id}.${a.version}`;
  let m = c.cache.get(a);
  (!m || m.key !== d) && c.cache.set(a, m = { key: d, part: yh(a, i, u, c) });
  const { computed: h, tokens: g, extra: y, reports: R, childText: H, where: x } = m.part;
  for (const Q of R) c.findings.add(...Q);
  const E = (Q, z, N, V, yt) => c.findings.add(Q, z, N, V, x, yt), T = { ...m.part.style }, B = { kind: "div", id: a.id, style: T, tokens: g, meta: m.part.meta, ...y };
  Object.defineProperty(B, Zs, { value: h.values.display });
  const D = a.tagName;
  if (D === "svg")
    return B.kind = a.props["data-perch-image"] ? "image" : "svg", B.markup = _h(a), B;
  if (D === "input" || D === "textarea" || D === "select") {
    B.kind = "input", B.input_type = D === "input" ? String(a.props.type ?? "text") : D;
    for (const Q of ["value", "defaultValue", "placeholder", "checked", "disabled"]) a.props[Q] !== void 0 && (B[Q === "defaultValue" ? "value" : Q] = a.props[Q]);
    return B;
  }
  if (D === "img")
    return B.kind = "image", B.src = a.props.src ?? null, B;
  const M = h.values["text-transform"], A = [];
  let G = !1, K = !1;
  for (const Q of a.childNodes) {
    if (Q instanceof To) {
      if (Q.hidden || Q.data === "") continue;
      G = !0;
      const V = A[A.length - 1];
      if (V?.kind === "text")
        V.source = (V.source ?? V.text) + Q.data, V.text = tf(V.source, M), V.text === V.source && delete V.source;
      else {
        const yt = tf(Q.data, M);
        A.push(yt === Q.data ? { kind: "text", text: yt } : { kind: "text", text: yt, source: Q.data });
      }
      continue;
    }
    if (!(Q instanceof _e)) continue;
    const z = zf(Q, h, H, c, d), N = z[Zs];
    N === "inline" || N === "inline-block" || N === "inline-flex" ? G = !0 : N !== "none" && (K = !0), A.push(z);
  }
  const nt = A.some((Q) => Q.kind !== "text");
  return !T.display && G && nt && (T.display = "flex", T.flex_direction = K ? "col" : "row", K || (T.items = "baseline"), E("approximated", "display", `${h.values.display} with inline content`, "(inline formatting)", K ? "a column of its children" : "a row on the text baseline")), B.children = A, B;
}
const tf = (a, i) => i === "uppercase" ? a.toUpperCase() : i === "lowercase" ? a.toLowerCase() : i === "capitalize" ? a.replace(/\b\p{L}/gu, (u) => u.toUpperCase()) : a, Ef = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function xh(a) {
  const i = {};
  for (const [u, c] of Object.entries(a.props)) {
    if (Ef.has(u) || typeof c == "function" || c === void 0 || c === null || typeof c == "object") continue;
    const s = u.startsWith("aria-") || u.startsWith("data-");
    if (c === !1 && !s) continue;
    const d = u === "htmlFor" ? "for" : u === "tabIndex" ? "tabindex" : u;
    i[d] = typeof c == "boolean" ? s ? String(c) : "" : String(c);
  }
  return { tag: a.tagName, classes: a.classList, attrs: i };
}
const wh = (a) => a === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(a) ? a : a.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), ef = (a) => String(a).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function _h(a) {
  if (a.props["data-perch-markup"]) return String(a.props["data-perch-markup"]);
  const i = (u) => {
    const c = [];
    for (const [d, m] of Object.entries(u.props))
      Ef.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || c.push(`${wh(d)}="${ef(m === !0 ? "" : m)}"`);
    u.tagName === "svg" && !u.props.xmlns && c.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = u.childNodes.map((d) => d instanceof To ? ef(d.data) : i(d)).join("");
    return `<${u.tagName}${c.length ? ` ${c.join(" ")}` : ""}>${s}</${u.tagName}>`;
  };
  return i(a);
}
function Sh(a) {
  const i = a.theme?.() ?? {}, u = {};
  for (const c of bf) i[c] && (u[c] = i[c]);
  return u;
}
const zh = {};
function Eh(a, i, u, c = {}) {
  const s = Sh(i), d = i.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([s, d]);
  (c.look !== m || c.sheet !== u) && Object.assign(c, { look: m, sheet: u, cache: /* @__PURE__ */ new WeakMap(), cascade: new ah(u, { theme: s, viewport: d }), top: null });
  const { cascade: h, cache: g } = c, y = { cascade: h, cache: g, findings: new vh(), measure: i.lineHeight ? (x) => i.lineHeight(x) : null };
  c.top ??= h.compute(a.body, h.compute(a.documentElement, null));
  const R = a.body.children.map((x) => zf(x, c.top, zh, y)), H = /* @__PURE__ */ new Set();
  for (const x of [a, a.defaultView])
    for (const { type: E } of x?.listeners ?? []) Js[E] && H.add(Js[E]);
  return { schema: ch, root: R[0] ?? null, overlays: R.slice(1), document_events: [...H].sort(), unsupported: y.findings.list() };
}
const Nh = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Th = null;
const Ch = () => Th ??= new Pp(Nh);
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
let Zl = aa.NoEventPriority;
function kh(a, i) {
  const u = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(i)]);
  for (const c of u) {
    if (c === "children") continue;
    const s = a[c], d = i[c];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(c === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((h) => s[h] === d[h])))
      return !0;
  }
  return !1;
}
const Ah = {
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
  scheduleTimeout: (a, i) => setTimeout(a, i),
  cancelTimeout: (a) => clearTimeout(a),
  scheduleMicrotask: (a) => queueMicrotask(a),
  getRootHostContext: () => null,
  getChildHostContext: (a) => a,
  getPublicInstance: (a) => a,
  prepareForCommit: () => null,
  resetAfterCommit: (a) => a.ownerDocument?.afterCommit?.(),
  preparePortalMount: () => {
  },
  createInstance: (a, i, u) => new _e(a, i, u.ownerDocument),
  createTextInstance: (a, i) => new To(a),
  appendInitialChild: (a, i) => {
    a.appendChild(i);
  },
  finalizeInitialChildren: () => !1,
  shouldSetTextContent: () => !1,
  appendChild: (a, i) => {
    a.appendChild(i);
  },
  appendChildToContainer: (a, i) => {
    a.appendChild(i);
  },
  insertBefore: (a, i, u) => {
    a.insertBefore(i, u);
  },
  insertInContainerBefore: (a, i, u) => {
    a.insertBefore(i, u);
  },
  removeChild: (a, i) => {
    a.removeChild(i);
  },
  removeChildFromContainer: (a, i) => {
    a.removeChild(i);
  },
  clearContainer: (a) => {
    for (const i of [...a.childNodes]) a.removeChild(i);
  },
  commitUpdate: (a, i, u, c) => {
    a.props = c, kh(u, c) && a.touch();
  },
  commitTextUpdate: (a, i, u) => {
    a.data = String(u);
  },
  commitMount: () => {
  },
  resetTextContent: () => {
  },
  hideInstance: (a) => {
    a.hidden = !0, a.touch();
  },
  unhideInstance: (a) => {
    a.hidden = !1, a.touch();
  },
  hideTextInstance: (a) => {
    a.hidden = !0;
  },
  unhideTextInstance: (a) => {
    a.hidden = !1;
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
  setCurrentUpdatePriority: (a) => {
    Zl = a;
  },
  getCurrentUpdatePriority: () => Zl,
  resolveUpdatePriority: () => Zl !== aa.NoEventPriority ? Zl : aa.DefaultEventPriority,
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
  bindToConsole: (a, i) => Function.prototype.bind.call(console[a], console, ...i)
}, xe = Bp(Ah), Ao = (a, i, u = null) => xe.createPortal(a, i, null, u), Mh = {
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
class Oh {
  constructor(i, u, c) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1 }, u), this.type = i, this.target = c, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function ui(a, i, u) {
  i.currentTarget = a;
  for (const { type: c, listener: s, capture: d } of [...a.listeners ?? []])
    c === i.type && d === u && s.call(a, i);
  if (a instanceof _e) {
    const c = Mh[i.type], s = c && a.props[u ? `${c}Capture` : c];
    typeof s == "function" && s(i);
  }
}
function Cv(a, i, u = {}) {
  const { document: c, window: s } = Cp(a), d = new _e("div", { id: "root", style: u.container ?? {} }, c);
  c.body.appendChild(d);
  const m = [];
  let h = null;
  const g = () => [c, s].map((A) => A.listeners.map((G) => `${G.type}:${G.capture}`).sort().join(",")).join("|");
  let y = "";
  const R = {}, H = () => (h = Eh(c, a, Ch(), R), y = g(), a.render?.(h), h), x = () => {
    xe.flushPassiveEffects(), xe.flushSyncWork(), g() !== y && H();
  };
  c.afterCommit = H;
  const E = (A) => {
    m.push(A), a.error?.(A);
  }, T = xe.createContainer(d, aa.ConcurrentRoot, null, !1, null, "", E, E, E, null);
  xe.updateContainerSync(Ht.createElement(i, u.props ?? {}), T, null, null), xe.flushSyncWork(), x();
  const B = (A) => {
    const G = (K) => {
      if (K.id === A) return K;
      for (const nt of K.children) {
        const Q = G(nt);
        if (Q) return Q;
      }
      return null;
    };
    return G(c.documentElement);
  }, D = (A) => {
    const G = Zl;
    Zl = aa.DiscreteEventPriority;
    try {
      return A();
    } finally {
      Zl = G, xe.flushSyncWork(), x();
    }
  }, M = {
    document: c,
    window: s,
    container: d,
    errors: m,
    /** The latest description (after the last commit or state change). */
    get description() {
      return h;
    },
    describe: H,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(A, G, K = {}) {
      const nt = typeof A == "string" ? B(A) : A;
      if (!nt) return !1;
      const Q = new Oh(G, K, nt), z = [];
      for (let V = nt; V; V = V.parentNode) z.push(V);
      const N = [...z, c, s];
      return D(() => {
        for (let V = N.length - 1; V > 0 && !Q.propagationStopped; V--) ui(N[V], Q, !0);
        Q.propagationStopped || (ui(nt, Q, !0), Q.propagationStopped || ui(nt, Q, !1));
        for (let V = 1; V < N.length && !Q.propagationStopped; V++) ui(N[V], Q, !1);
      }), !Q.defaultPrevented;
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(A, G) {
      const K = B(A);
      K && (K.bounds = { x: G.x, y: G.y, width: G.width, height: G.height });
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(A, G = {}) {
      const K = { button: 0, buttons: 1, pointerType: "mouse", ...G };
      for (const nt of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) M.dispatch(A, nt, K);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    hover(A, G) {
      const K = B(A);
      !K || K.state.hover === G || (K.state.hover = G, K.touch(), H());
    },
    focus(A) {
      const G = B(A);
      G && (D(() => {
        const K = c.activeElement;
        K && K !== G && K !== c.body && M.dispatch(K, "blur"), c.focus(G), M.dispatch(G, "focus");
      }), H());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: x,
    update(A) {
      xe.updateContainerSync(Ht.createElement(i, A ?? {}), T, null, null), xe.flushSyncWork(), x();
    },
    unmount() {
      xe.updateContainerSync(null, T, null, null), xe.flushSyncWork(), xe.flushPassiveEffects(), c.afterCommit = null;
    }
  };
  return M;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Nf = (a) => xe.flushSyncFromReconciler(a), Hh = { createPortal: Ao, flushSync: Nf }, kv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Ao,
  default: Hh,
  flushSync: Nf
}, Symbol.toStringTag, { value: "Module" }));
function Tf(a) {
  var i, u, c = "";
  if (typeof a == "string" || typeof a == "number") c += a;
  else if (typeof a == "object") if (Array.isArray(a)) {
    var s = a.length;
    for (i = 0; i < s; i++) a[i] && (u = Tf(a[i])) && (c && (c += " "), c += u);
  } else for (u in a) a[u] && (c && (c += " "), c += u);
  return c;
}
function Cf() {
  for (var a, i, u = 0, c = "", s = arguments.length; u < s; u++) (a = arguments[u]) && (i = Tf(a)) && (c && (c += " "), c += i);
  return c;
}
const Rh = (a, i) => {
  const u = new Array(a.length + i.length);
  for (let c = 0; c < a.length; c++)
    u[c] = a[c];
  for (let c = 0; c < i.length; c++)
    u[a.length + c] = i[c];
  return u;
}, jh = (a, i) => ({
  classGroupId: a,
  validator: i
}), kf = (a = /* @__PURE__ */ new Map(), i = null, u) => ({
  nextPart: a,
  validators: i,
  classGroupId: u
}), pi = "-", lf = [], Uh = "arbitrary..", Dh = (a) => {
  const i = Bh(a), {
    conflictingClassGroups: u,
    conflictingClassGroupModifiers: c
  } = a;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return qh(m);
      const h = m.split(pi), g = h[0] === "" && h.length > 1 ? 1 : 0;
      return Af(h, g, i);
    },
    getConflictingClassGroupIds: (m, h) => {
      if (h) {
        const g = c[m], y = u[m];
        return g ? y ? Rh(y, g) : g : y || lf;
      }
      return u[m] || lf;
    }
  };
}, Af = (a, i, u) => {
  if (a.length - i === 0)
    return u.classGroupId;
  const s = a[i], d = u.nextPart.get(s);
  if (d) {
    const y = Af(a, i + 1, d);
    if (y) return y;
  }
  const m = u.validators;
  if (m === null)
    return;
  const h = i === 0 ? a.join(pi) : a.slice(i).join(pi), g = m.length;
  for (let y = 0; y < g; y++) {
    const R = m[y];
    if (R.validator(h))
      return R.classGroupId;
  }
}, qh = (a) => a.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = a.slice(1, -1), u = i.indexOf(":"), c = i.slice(0, u);
  return c ? Uh + c : void 0;
})(), Bh = (a) => {
  const {
    theme: i,
    classGroups: u
  } = a;
  return Yh(u, i);
}, Yh = (a, i) => {
  const u = kf();
  for (const c in a) {
    const s = a[c];
    Mo(s, u, c, i);
  }
  return u;
}, Mo = (a, i, u, c) => {
  const s = a.length;
  for (let d = 0; d < s; d++) {
    const m = a[d];
    Gh(m, i, u, c);
  }
}, Gh = (a, i, u, c) => {
  if (typeof a == "string") {
    Qh(a, i, u);
    return;
  }
  if (typeof a == "function") {
    Vh(a, i, u, c);
    return;
  }
  Kh(a, i, u, c);
}, Qh = (a, i, u) => {
  const c = a === "" ? i : Mf(i, a);
  c.classGroupId = u;
}, Vh = (a, i, u, c) => {
  if (Xh(a)) {
    Mo(a(c), i, u, c);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(jh(u, a));
}, Kh = (a, i, u, c) => {
  const s = Object.entries(a), d = s.length;
  for (let m = 0; m < d; m++) {
    const [h, g] = s[m];
    Mo(g, Mf(i, h), u, c);
  }
}, Mf = (a, i) => {
  let u = a;
  const c = i.split(pi), s = c.length;
  for (let d = 0; d < s; d++) {
    const m = c[d];
    let h = u.nextPart.get(m);
    h || (h = kf(), u.nextPart.set(m, h)), u = h;
  }
  return u;
}, Xh = (a) => "isThemeGetter" in a && a.isThemeGetter === !0, Zh = (a) => {
  if (a < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, u = /* @__PURE__ */ Object.create(null), c = /* @__PURE__ */ Object.create(null);
  const s = (d, m) => {
    u[d] = m, i++, i > a && (i = 0, c = u, u = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let m = u[d];
      if (m !== void 0)
        return m;
      if ((m = c[d]) !== void 0)
        return s(d, m), m;
    },
    set(d, m) {
      d in u ? u[d] = m : s(d, m);
    }
  };
}, yo = "!", nf = ":", Jh = [], af = (a, i, u, c, s) => ({
  modifiers: a,
  hasImportantModifier: i,
  baseClassName: u,
  maybePostfixModifierPosition: c,
  isExternal: s
}), Lh = (a) => {
  const {
    prefix: i,
    experimentalParseClassName: u
  } = a;
  let c = (s) => {
    const d = [];
    let m = 0, h = 0, g = 0, y;
    const R = s.length;
    for (let B = 0; B < R; B++) {
      const D = s[B];
      if (m === 0 && h === 0) {
        if (D === nf) {
          d.push(s.slice(g, B)), g = B + 1;
          continue;
        }
        if (D === "/") {
          y = B;
          continue;
        }
      }
      D === "[" ? m++ : D === "]" ? m-- : D === "(" ? h++ : D === ")" && h--;
    }
    const H = d.length === 0 ? s : s.slice(g);
    let x = H, E = !1;
    H.endsWith(yo) ? (x = H.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      H.startsWith(yo) && (x = H.slice(1), E = !0)
    );
    const T = y && y > g ? y - g : void 0;
    return af(d, E, x, T);
  };
  if (i) {
    const s = i + nf, d = c;
    c = (m) => m.startsWith(s) ? d(m.slice(s.length)) : af(Jh, !1, m, void 0, !0);
  }
  if (u) {
    const s = c;
    c = (d) => u({
      className: d,
      parseClassName: s
    });
  }
  return c;
}, Wh = (a) => {
  const i = /* @__PURE__ */ new Map();
  return a.orderSensitiveModifiers.forEach((u, c) => {
    i.set(u, 1e6 + c);
  }), (u) => {
    const c = [];
    let s = [];
    for (let d = 0; d < u.length; d++) {
      const m = u[d], h = m[0] === "[", g = i.has(m);
      h || g ? (s.length > 0 && (s.sort(), c.push(...s), s = []), c.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), c.push(...s)), c;
  };
}, Fh = (a) => ({
  cache: Zh(a.cacheSize),
  parseClassName: Lh(a),
  sortModifiers: Wh(a),
  postfixLookupClassGroupIds: Ih(a),
  ...Dh(a)
}), Ih = (a) => {
  const i = /* @__PURE__ */ Object.create(null), u = a.postfixLookupClassGroups;
  if (u)
    for (let c = 0; c < u.length; c++)
      i[u[c]] = !0;
  return i;
}, $h = /\s+/, Ph = (a, i) => {
  const {
    parseClassName: u,
    getClassGroupId: c,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = i, h = [], g = a.trim().split($h);
  let y = "";
  for (let R = g.length - 1; R >= 0; R -= 1) {
    const H = g[R], {
      isExternal: x,
      modifiers: E,
      hasImportantModifier: T,
      baseClassName: B,
      maybePostfixModifierPosition: D
    } = u(H);
    if (x) {
      y = H + (y.length > 0 ? " " + y : y);
      continue;
    }
    let M = !!D, A;
    if (M) {
      const z = B.substring(0, D);
      A = c(z);
      const N = A && m[A] ? c(B) : void 0;
      N && N !== A && (A = N, M = !1);
    } else
      A = c(B);
    if (!A) {
      if (!M) {
        y = H + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (A = c(B), !A) {
        y = H + (y.length > 0 ? " " + y : y);
        continue;
      }
      M = !1;
    }
    const G = E.length === 0 ? "" : E.length === 1 ? E[0] : d(E).join(":"), K = T ? G + yo : G, nt = K + A;
    if (h.indexOf(nt) > -1)
      continue;
    h.push(nt);
    const Q = s(A, M);
    for (let z = 0; z < Q.length; ++z) {
      const N = Q[z];
      h.push(K + N);
    }
    y = H + (y.length > 0 ? " " + y : y);
  }
  return y;
}, t0 = (...a) => {
  let i = 0, u, c, s = "";
  for (; i < a.length; )
    (u = a[i++]) && (c = Of(u)) && (s && (s += " "), s += c);
  return s;
}, Of = (a) => {
  if (typeof a == "string")
    return a;
  let i, u = "";
  for (let c = 0; c < a.length; c++)
    a[c] && (i = Of(a[c])) && (u && (u += " "), u += i);
  return u;
}, e0 = (a, ...i) => {
  let u, c, s, d;
  const m = (g) => {
    const y = i.reduce((R, H) => H(R), a());
    return u = Fh(y), c = u.cache.get, s = u.cache.set, d = h, h(g);
  }, h = (g) => {
    const y = c(g);
    if (y)
      return y;
    const R = Ph(g, u);
    return s(g, R), R;
  };
  return d = m, (...g) => d(t0(...g));
}, l0 = [], Gt = (a) => {
  const i = (u) => u[a] || l0;
  return i.isThemeGetter = !0, i.themeKey = a, i;
}, Hf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Rf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, n0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, a0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, i0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, r0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, o0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, u0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, zl = (a) => n0.test(a), ct = (a) => !!a && !Number.isNaN(Number(a)), Ge = (a) => !!a && Number.isInteger(Number(a)), uo = (a) => a.endsWith("%") && ct(a.slice(0, -1)), nl = (a) => a0.test(a), jf = () => !0, c0 = (a) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  i0.test(a) && !r0.test(a)
), Oo = () => !1, s0 = (a) => o0.test(a), f0 = (a) => u0.test(a), d0 = (a) => !Z(a) && !J(a), m0 = (a) => a.startsWith("@container") && (a[10] === "/" && a[11] !== void 0 || a[11] === "s" && a[16] !== void 0 && a.startsWith("-size/", 10) || a[11] === "n" && a[18] !== void 0 && a.startsWith("-normal/", 10)), p0 = (a) => El(a, qf, Oo), Z = (a) => Hf.test(a), Xl = (a) => El(a, Bf, c0), rf = (a) => El(a, _0, ct), h0 = (a) => El(a, Gf, jf), v0 = (a) => El(a, Yf, Oo), of = (a) => El(a, Uf, Oo), g0 = (a) => El(a, Df, f0), ci = (a) => El(a, Qf, s0), J = (a) => Rf.test(a), la = (a) => Jl(a, Bf), b0 = (a) => Jl(a, Yf), uf = (a) => Jl(a, Uf), y0 = (a) => Jl(a, qf), x0 = (a) => Jl(a, Df), si = (a) => Jl(a, Qf, !0), w0 = (a) => Jl(a, Gf, !0), El = (a, i, u) => {
  const c = Hf.exec(a);
  return c ? c[1] ? i(c[1]) : u(c[2]) : !1;
}, Jl = (a, i, u = !1) => {
  const c = Rf.exec(a);
  return c ? c[1] ? i(c[1]) : u : !1;
}, Uf = (a) => a === "position" || a === "percentage", Df = (a) => a === "image" || a === "url", qf = (a) => a === "length" || a === "size" || a === "bg-size", Bf = (a) => a === "length", _0 = (a) => a === "number", Yf = (a) => a === "family-name", Gf = (a) => a === "number" || a === "weight", Qf = (a) => a === "shadow", S0 = () => {
  const a = Gt("color"), i = Gt("font"), u = Gt("text"), c = Gt("font-weight"), s = Gt("tracking"), d = Gt("leading"), m = Gt("breakpoint"), h = Gt("container"), g = Gt("spacing"), y = Gt("radius"), R = Gt("shadow"), H = Gt("inset-shadow"), x = Gt("text-shadow"), E = Gt("drop-shadow"), T = Gt("blur"), B = Gt("perspective"), D = Gt("aspect"), M = Gt("ease"), A = Gt("animate"), G = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], K = () => [
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
  ], nt = () => [...K(), J, Z], Q = () => ["auto", "hidden", "clip", "visible", "scroll"], z = () => ["auto", "contain", "none"], N = () => [J, Z, g], V = () => [zl, "full", "auto", ...N()], yt = () => [Ge, "none", "subgrid", J, Z], Pt = () => ["auto", {
    span: ["full", Ge, J, Z]
  }, Ge, J, Z], qt = () => [Ge, "auto", J, Z], At = () => ["auto", "min", "max", "fr", J, Z], Zt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], zt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], O = () => ["auto", ...N()], F = () => [zl, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...N()], et = () => [h, zl, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...N()], it = () => [zl, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...N()], q = () => [a, J, Z], v = () => [...K(), uf, of, {
    position: [J, Z]
  }], k = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], I = () => ["auto", "cover", "contain", y0, p0, {
    size: [J, Z]
  }], L = () => [uo, la, Xl], W = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    J,
    Z
  ], $ = () => ["", ct, la, Xl], ht = () => ["solid", "dashed", "dotted", "double"], Qt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], rt = () => [ct, uo, uf, of], Nl = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    T,
    J,
    Z
  ], Tl = () => ["none", ct, J, Z], Ce = () => ["none", ct, J, Z], ke = () => [ct, J, Z], il = () => [zl, "full", ...N()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [nl],
      breakpoint: [nl],
      color: [jf],
      container: [nl],
      "drop-shadow": [nl],
      ease: ["in", "out", "in-out"],
      font: [d0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [nl],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [nl],
      shadow: [nl],
      spacing: ["px", ct],
      text: [nl],
      "text-shadow": [nl],
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
        aspect: ["auto", "square", zl, Z, J, D]
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
        "@container": ["", "normal", "size", J, Z]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [m0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [ct, "auto", Z, J, h]
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
        object: nt()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: Q()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": Q()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": Q()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: z()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": z()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": z()
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
        inset: V()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": V()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": V()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": V(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: V()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": V(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: V()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": V()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": V()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: V()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: V()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: V()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: V()
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
        z: [Ge, "auto", J, Z]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [zl, "full", "auto", h, ...N()]
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
        flex: [ct, zl, "auto", "initial", "none", Z]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ct, J, Z]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ct, J, Z]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Ge, "first", "last", "none", J, Z]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": yt()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: Pt()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": qt()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": qt()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": yt()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: Pt()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": qt()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": qt()
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
        "auto-cols": At()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": At()
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
        justify: [...Zt(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...zt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...zt()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...Zt()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...zt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...zt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": Zt()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...zt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...zt()]
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
        m: O()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: O()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: O()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: O()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: O()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: O()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: O()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: O()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: O()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: O()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: O()
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
        w: [h, "screen", ...F()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          h,
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
          h,
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
        text: ["base", u, la, Xl]
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
        font: [c, w0, h0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", uo, Z]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [b0, v0, i]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [Z]
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
        tracking: [s, J, Z]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [ct, "none", J, rf]
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
          ...N()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", J, Z]
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
        list: ["disc", "decimal", "none", J, Z]
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
        placeholder: q()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: q()
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
        decoration: [...ht(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [ct, "from-font", "auto", J, Xl]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: q()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [ct, "auto", J, Z]
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
        tab: [Ge, J, Z]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", J, Z]
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
        content: ["none", J, Z]
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
        bg: k()
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
          }, Ge, J, Z],
          radial: ["", J, Z],
          conic: ["", Ge, J, Z]
        }, x0, g0]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: q()
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
        from: q()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: q()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: q()
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
        border: [...ht(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...ht(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: q()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": q()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": q()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": q()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": q()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": q()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": q()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": q()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": q()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": q()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": q()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: q()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...ht(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [ct, J, Z]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ct, la, Xl]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: q()
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
          si,
          ci
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: q()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", H, si, ci]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": q()
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
        ring: q()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [ct, Xl]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": q()
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
        "inset-ring": q()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", x, si, ci]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": q()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [ct, J, Z]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Qt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Qt()
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
        "mask-linear-from": q()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": q()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": rt()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": rt()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": q()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": q()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": rt()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": rt()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": q()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": q()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": rt()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": rt()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": q()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": q()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": rt()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": rt()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": q()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": q()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": rt()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": rt()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": q()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": q()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": rt()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": rt()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": q()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": q()
      }],
      "mask-image-radial": [{
        "mask-radial": [J, Z]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": rt()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": rt()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": q()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": q()
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
        "mask-radial-at": K()
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
        "mask-conic-from": q()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": q()
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
        mask: k()
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
        mask: ["none", J, Z]
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
          J,
          Z
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
        brightness: [ct, J, Z]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ct, J, Z]
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
          si,
          ci
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": q()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", ct, J, Z]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ct, J, Z]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ct, J, Z]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ct, J, Z]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ct, J, Z]
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
          J,
          Z
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
        "backdrop-brightness": [ct, J, Z]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ct, J, Z]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ct, J, Z]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ct, J, Z]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ct, J, Z]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ct, J, Z]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ct, J, Z]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ct, J, Z]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", J, Z]
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
        duration: [ct, "initial", J, Z]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", M, J, Z]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [ct, J, Z]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", A, J, Z]
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
        perspective: [B, J, Z]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": nt()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Tl()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Tl()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Tl()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Tl()
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
        skew: ke()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": ke()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": ke()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [J, Z, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: nt()
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
        zoom: [Ge, J, Z]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: q()
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
        caret: q()
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", J, Z]
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
        "scrollbar-thumb": q()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": q()
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
        "will-change": ["auto", "scroll", "contents", "transform", J, Z]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...q()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [ct, la, Xl, rf]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...q()]
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
}, z0 = /* @__PURE__ */ e0(S0);
function Qe(...a) {
  return z0(Cf(a));
}
const Vf = typeof navigator < "u" && /Mac/i.test(navigator.platform), hi = {
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
for (let a = 1; a <= 12; a++) hi[`f${a}`] = `F${a}`;
const E0 = Object.fromEntries(Object.entries(hi).map(([a, i]) => [i, a])), N0 = {
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
function T0(a) {
  const i = /^Key([A-Z])$/.exec(a) ?? /^Digit(\d)$/.exec(a);
  return i ? i[1].toLowerCase() : E0[a];
}
const cf = /* @__PURE__ */ new Map();
function Kf(a, i = Vf) {
  const u = `${i}|${a}`, c = cf.get(u);
  if (c) return c;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of a.split("+"))
    if (d === "mod")
      i ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (hi[d]) s.code = hi[d];
    else throw new Error(`unknown key "${d}" in "${a}"`);
  if (!s.code) throw new Error(`no key in "${a}"`);
  return cf.set(u, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((a) => {
  const i = Kf(a, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function C0(a, i = Vf) {
  const u = Kf(a, i), c = k0(T0(u.code) ?? "");
  return i ? `${u.ctrl ? "⌃" : ""}${u.alt ? "⌥" : ""}${u.shift ? "⇧" : ""}${u.cmd ? "⌘" : ""}${c}` : [u.ctrl && "Ctrl", u.alt && "Alt", u.shift && "Shift", c].filter(Boolean).join("+");
}
const k0 = (a) => N0[a] ?? a.toUpperCase(), sf = (a) => typeof a == "boolean" ? `${a}` : a === 0 ? "0" : a, ff = Cf, vi = (a, i) => (u) => {
  var c;
  if (i?.variants == null) return ff(a, u?.class, u?.className);
  const { variants: s, defaultVariants: d } = i, m = Object.keys(s).map((y) => {
    const R = u?.[y], H = d?.[y];
    if (R === null) return null;
    const x = sf(R) || sf(H);
    return s[y][x];
  }), h = u && Object.entries(u).reduce((y, R) => {
    let [H, x] = R;
    return x === void 0 || (y[H] = x), y;
  }, {}), g = i == null || (c = i.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((y, R) => {
    let { class: H, className: x, ...E } = R;
    return Object.entries(E).every((T) => {
      let [B, D] = T;
      return Array.isArray(D) ? D.includes({
        ...d,
        ...h
      }[B]) : {
        ...d,
        ...h
      }[B] === D;
    }) ? [
      ...y,
      H,
      x
    ] : y;
  }, []);
  return ff(a, m, g, u?.class, u?.className);
}, A0 = vi(
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
), M0 = vi(
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
function O0({ className: a, ...i } = {}) {
  return Qe(M0(i), a);
}
const Xf = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Zf = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", H0 = vi(`${Zf} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function R0({ className: a, ...i } = {}) {
  return Qe(H0(i), a);
}
const j0 = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", U0 = vi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), D0 = "my-1 h-px bg-overlay-0";
function q0({ size: a = 14, className: i }) {
  return /* @__PURE__ */ $t.jsxs("svg", { className: i, width: a, height: a, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ $t.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ $t.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ $t.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function B0({ size: a = 16, className: i }) {
  return /* @__PURE__ */ $t.jsxs("svg", { className: i, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ $t.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ $t.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Y0({ size: a = 14, className: i }) {
  return /* @__PURE__ */ $t.jsx("svg", { className: i, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ $t.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Jf({ size: a = 14, className: i }) {
  return /* @__PURE__ */ $t.jsx("svg", { className: i, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ $t.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const df = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function G0({ state: a, error: i }) {
  return /* @__PURE__ */ $t.jsx(
    "span",
    {
      className: Qe("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", df[a] ?? df.disabled),
      title: a === "error" && i ? i : a
    }
  );
}
function Q0({ title: a, onClose: i, children: u, testId: c }) {
  return Ao(
    /* @__PURE__ */ $t.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && i();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && i();
        },
        children: /* @__PURE__ */ $t.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": a,
            "data-testid": c,
            children: [
              /* @__PURE__ */ $t.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: a }),
              u
            ]
          }
        )
      }
    ),
    document.body
  );
}
function V0(a) {
  return a.blocked && !a.stale ? "blocked" : a.status === "running" && !a.stale ? "working" : a.unseen ? "done" : "idle";
}
const xo = {
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
function wo(a, i) {
  return !!a.parentSessionId && a.parentSessionId !== a.id && i.some((u) => u.id === a.parentSessionId);
}
function K0(a) {
  const i = /* @__PURE__ */ new Map();
  for (const u of a)
    wo(u, a) && i.set(u.parentSessionId, [...i.get(u.parentSessionId) ?? [], u]);
  return i.size ? a.filter((u) => !wo(u, a)).flatMap((u) => [u, ...i.get(u.id) ?? []]) : a;
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const X0 = "1.3.0";
function se() {
  const a = globalThis.perch;
  if (!a) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return a;
}
const Z0 = (a) => se().subscribe?.(a) ?? (() => {
}), J0 = globalThis.perch?.isMac !== !1, L0 = (a) => C0(a, se().isMac !== !1), W0 = (a) => A0(a), F0 = ({ className: a, ...i } = {}) => Qe(O0(i), a), I0 = R0, $0 = (a) => U0(a), P0 = D0, tv = Zf, ev = Xf, lv = (a) => xo[a].color, nv = (a, i) => se().command(a, i ?? {}) !== !1, av = (a, i, u) => se().startSession?.(a, i, u), iv = globalThis.perch?.pickFolder ? (a) => se().pickFolder(a) : null;
function ia(a) {
  const i = Ht.useRef(a);
  return i.current = a, Ht.useSyncExternalStore(Z0, () => i.current(se()));
}
const rv = (a = {}) => ia((i) => i.navigation({ showTerminals: !!a.showTerminals, sortByAttention: !!a.sortByAttention })), ov = () => ia((a) => a.hosts()), uv = () => ia((a) => a.sessionFolders());
function cv() {
  const a = ia((i) => i.addProject?.() ?? sv);
  return {
    status: a.status ?? "idle",
    error: a.error,
    hostId: a.hostId,
    add: (i, u, c) => {
      i.trim() && a.status !== "pending" && se().addProjectFolder?.(i, u, c);
    },
    clear: () => se().clearAddProject?.()
  };
}
const sv = Object.freeze({ status: "idle" });
function fv(a) {
  Ht.useEffect(() => se().onRequest?.("add-project", a) ?? void 0, [a]);
}
function dv(a) {
  const i = a.map((u) => ({ id: u.id, parentSessionId: u.parentId, session: u }));
  return K0(i).map((u) => ({ session: u.session, nested: wo(u, i) }));
}
function mv({ id: a, plain: i, className: u }) {
  const c = ia((y) => y.session(a));
  if (!c) return null;
  const s = c.state ?? V0(c), d = xo[s]?.color ?? xo.unknown.color, m = c.provider, h = m === "claude" || m === "claude-agent-teams" || m === "omp", g = i ? Qe("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", u) : Qe("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", u);
  return Ht.createElement(
    "span",
    { className: g, style: i ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: i ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    Ht.createElement("span", { className: Qe("inline-flex text-fg", h && "rounded-full bg-[#161616]") }, Ht.createElement(Lf, { provider: m, size: 14 }))
  );
}
function Lf({ provider: a, size: i = 14 }) {
  const u = se().agentIcon?.(a, i) ?? null, c = u?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return Ht.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": a ?? "unknown", "data-perch-markup": c, ...u && u.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const pv = ({ children: a }) => Ht.createElement(Ht.Fragment, null, a);
function hv(a, i) {
  const u = Ht.useRef(i);
  return u.current = i, Ht.useEffect(() => {
    const c = se();
    if (!c.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${a} cannot open`);
    const s = {};
    for (const [m, h] of Object.entries(u.current))
      s[m] = typeof h == "function" ? (...g) => u.current[m]?.(...g) : h;
    const d = c.openOverlay(a, s);
    return () => c.closeOverlay?.(d);
  }, [a]), null;
}
const zn = (a) => function(u) {
  return hv(a, u);
}, vv = zn("session-menu"), gv = zn("new-session-menu"), bv = zn("confirm");
function yv({ value: a, onChange: i, options: u = [], className: c, ariaLabel: s, testId: d, title: m, disabled: h, placeholder: g }) {
  const y = Ht.useRef(null), R = u.find((H) => H.value === a);
  return Ht.createElement(
    "button",
    {
      type: "button",
      ref: y,
      title: m,
      disabled: h,
      "aria-label": s,
      "data-testid": d,
      "aria-haspopup": "listbox",
      className: Qe("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", c),
      onClick: () => se().openOverlay?.("select", { value: a, options: u, onChange: (H) => i?.(H), anchor: y.current?.getBoundingClientRect() })
    },
    Ht.createElement("span", { className: "min-w-0 flex-1 truncate" }, R ? R.label : g ?? "")
  );
}
const xv = zn("folder-browser"), wv = zn("instructions"), _v = zn("memory"), Sv = Q0;
function zv({ hostId: a, path: i, className: u }) {
  const c = Ht.useRef(null);
  return Ht.createElement(
    "button",
    {
      type: "button",
      ref: c,
      className: Qe("worktree-menu__btn", Xf, u),
      "data-testid": `worktree-menu-${a}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => se().openOverlay?.("worktree", { hostId: a, cwd: i, anchor: c.current?.getBoundingClientRect() })
    },
    Ht.createElement(Jf, null)
  );
}
const Ev = (a, i) => se().beginReorderDrag?.(a, i), Av = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Lf,
  CloseIcon: Y0,
  ConfirmDialog: bv,
  Dialog: Sv,
  EllipsisIcon: q0,
  FolderBrowser: xv,
  GearIcon: B0,
  HostStateDot: G0,
  InstructionsDialog: wv,
  MemoryDialog: _v,
  NewSessionMenu: gv,
  PlusIcon: Jf,
  Select: yv,
  SessionDot: mv,
  SessionMenu: vv,
  Slot: pv,
  WorktreeMenu: zv,
  agentStateColor: lv,
  beginReorderDrag: Ev,
  buttonClass: I0,
  cn: Qe,
  ghostButton: tv,
  iconButton: ev,
  isMac: J0,
  keyLabel: L0,
  menuDividerClass: P0,
  menuItemClass: $0,
  menuPanel: j0,
  nestSessions: dv,
  pickFolder: iv,
  rowActionClass: F0,
  runCommand: nv,
  segmentClass: W0,
  startSession: av,
  useAddProject: cv,
  useAddProjectRequest: fv,
  useHosts: ov,
  useNavigation: rv,
  useSessionFolders: uv,
  version: X0
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
//! `kit` is `{ div, svg, image }` from `gpui-kit`; `files.svg(markup)` gives an application path for an icon's
//! markup (`svg()` and `image()` take paths).
const Ho = {
  display: (a, i) => i === "hidden" ? a.hidden() : i === "flex" ? a.flex() : a.block(),
  flex_direction: (a, i) => a[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[i]](),
  flex_wrap: (a, i) => i === "wrap" ? a.flex_wrap() : a.flex_nowrap(),
  items: (a, i) => a[`items_${i}`](),
  justify: (a, i) => a[`justify_${i}`](),
  self: (a, i) => i === "auto" ? a : a[`self_${i}`](),
  flex_grow: (a, i) => a.flex_grow(i),
  flex_shrink: (a, i) => a.flex_shrink(i),
  flex_basis: (a, i) => a.flex_basis(i),
  position: (a, i) => i === "absolute" ? a.absolute() : a.relative(),
  overflow_x: (a, i) => i === "hidden" ? a.overflow_x_hidden() : i === "scroll" ? a.overflow_x_scroll() : a,
  overflow_y: (a, i) => i === "hidden" ? a.overflow_y_hidden() : i === "scroll" ? a.overflow_y_scroll() : a,
  visibility: (a, i) => i === "invisible" ? a.invisible() : a.visible(),
  bg: (a, i) => a.bg(i),
  opacity: (a, i) => a.opacity(i),
  shadow: (a, i) => i === "none" ? a.shadow_none() : a[`shadow_${i}`](),
  cursor: (a, i) => a[`cursor_${i}`](),
  border_color: (a, i) => a.border_color(i),
  text_ellipsis: (a, i) => i ? a.text_ellipsis() : a,
  underline: (a, i) => i ? a.underline() : a,
  text_color: (a, i) => a.text_color(i),
  text_size: (a, i) => a.text_size(i),
  font_weight: (a, i) => a.font_weight(i),
  font_family: (a, i) => a.font_family(i),
  line_height: (a, i) => a.line_height(i),
  italic: (a, i) => i ? a.italic() : a.not_italic(),
  whitespace: (a, i) => i === "nowrap" ? a.whitespace_nowrap() : a.whitespace_normal(),
  text_align: (a, i) => a[`text_${i}`](),
  rounded: (a, i) => a.rounded(i)
};
for (const a of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  Ho[a] = (i, u) => i[a](u);
const Mv = Object.keys(Ho);
function mf(a, i) {
  for (const [u, c] of Object.entries(i)) {
    const s = Ho[u];
    if (!s) throw new Error(`the description key ${u} has no GPUI builder`);
    c != null && (a = s(a, c));
  }
  return a;
}
const _n = (a) => ({ clientX: a?.position?.x ?? 0, clientY: a?.position?.y ?? 0 });
function _o(a, i, u, c, s = !1) {
  if (a.kind === "text") return a.text;
  let d;
  a.kind === "svg" ? d = i.svg(c.svg(a.markup)) : a.kind === "image" ? d = i.image(a.markup ? c.svg(a.markup) : a.src) : d = i.div(), d = mf(d.id(a.id), a.style);
  for (const g of ["hover", "focus", "active"]) a[g] && (d = d[g]((y) => mf(y, a[g])));
  const m = new Set(a.events ?? []);
  ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((g) => m.has(g)) && (d = d.on_mouse_down("left", (g, y) => {
    y.stop_propagation?.(), g.bounds && u.setBounds(a.id, g.bounds);
    const R = { ..._n(g), button: 0, buttons: 1, detail: g.click_count };
    u.dispatch(a.id, "pointerdown", { ...R, pointerType: "mouse" }), u.dispatch(a.id, "mousedown", R), y.notify();
  }), d = d.on_mouse_down("right", (g, y) => {
    y.stop_propagation?.(), g.bounds && u.setBounds(a.id, g.bounds), u.dispatch(a.id, "contextmenu", { ..._n(g), button: 2 }), y.notify();
  }), d = d.on_mouse_up("left", (g, y) => {
    y.stop_propagation?.();
    const R = { ..._n(g), button: 0 };
    u.dispatch(a.id, "pointerup", { ...R, pointerType: "mouse" }), u.dispatch(a.id, "mouseup", R), y.notify();
  }), d = d.on_click((g, y) => {
    u.dispatch(a.id, g.click_count === 2 && m.has("double_click") ? "dblclick" : "click", { detail: g.click_count, button: 0 }), y.notify();
  })), m.has("mouse_move") && (d = d.on_mouse_move((g, y) => {
    u.dispatch(a.id, "pointermove", { ..._n(g), pointerType: "mouse" }), y.notify();
  })), a.track_hover && (d = d.on_hover((g, y) => {
    u.hover(a.id, g), y.notify();
  })), s && (d = d.on_mouse_down_out((g, y) => {
    u.dispatch(u.document.body.id, "pointerdown", { ..._n(g), pointerType: "mouse" }), u.dispatch(u.document.body.id, "mousedown", _n(g)), y.notify();
  }));
  for (const g of a.children ?? []) d = d.child(_o(g, i, u, c));
  return d;
}
function Ov(a, i, u, c) {
  let s = i.div().id("perch-react-layer").relative().size_full().child(_o(a.root, i, u, c));
  for (const d of a.overlays) s = s.child(_o(d, i, u, c, !0));
  return s;
}
export {
  Nv as React,
  ch as SCHEMA,
  Mv as STYLE_KEYS,
  Ov as describeToGpui,
  Tv as jsxRuntime,
  Cv as mount,
  kv as reactDom,
  Av as sdk
};
